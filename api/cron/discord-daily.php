<?php
/**
 * api/cron/discord-daily.php — Annonce quotidienne du PersonaDLE sur Discord
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/discord-daily.php
 *   Header: X-Cron-Key: <CRON_SECRET>
 *
 * Fréquence : tous les jours à 06:00 UTC (8 h Paris l'été, 7 h l'hiver) — décision Hamza
 * 2026-09-21 : le matin plutôt que 00:05 Paris, personne ne joue à minuit et le ping réveillait.
 * La cible du jour, elle, change à minuit Paris : le message reste juste (« jusqu'à minuit »).
 *
 * Un webhook Discord accepte 'username' et 'avatar_url' à CHAQUE message : un
 * seul webhook fait donc parler plusieurs personnages, avec leur avatar, sans
 * bot à héberger ni token supplémentaire. Huit voix tournent, six phrases
 * chacune — le but n'est pas d'annoncer, c'est de faire réagir dans le salon.
 *
 * Sécurité : clé en header (hash_equals, via requireCronSecret). L'URL du
 * webhook vit dans api/config.php (gitignoré) et ne doit JAMAIS ressortir, ni
 * dans la réponse HTTP ni dans les logs : tout ce qui pourrait la contenir
 * passe par _discordRedact().
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/event_calendar.php';
require_once __DIR__ . '/../lib/discord_webhook.php';

requireCronSecret();

// Pas de header() ici : bootstrap.php pose déjà application/json; charset=utf-8.
// Le reposer sans le charset casserait les emoji des titres.

$start = microtime(true);

if (!defined('DISCORD_DAILY_WEBHOOK') || DISCORD_DAILY_WEBHOOK === '') {
    jsonError('DISCORD_DAILY_WEBHOOK missing from config.php', 500);
}

// Forme attendue : https://discord.com/api/webhooks/<id>/<token>
// Valider avant curl garantit deux choses : une config erronée ne peut pas
// faire poster le contenu ailleurs que chez Discord, et l'URL n'a pas de query
// string — l'ajout de « ?wait=true » plus bas est donc sûr.
if (!preg_match(
    '#^https://(?:canary\.|ptb\.)?discord(?:app)?\.com/api/(?:v\d+/)?webhooks/\d+/[\w-]+$#',
    DISCORD_DAILY_WEBHOOK
)) {
    jsonError('DISCORD_DAILY_WEBHOOK malformed', 500);
}

const SITE    = 'https://www.personadle.net/';
const JEU_URL = 'https://www.personadle.net/index.html';

$paris = new DateTimeZone('Europe/Paris');
$now   = new DateTime('now', $paris);

/**
 * Les voix.
 *
 * Les huit premières brisent le quatrième mur dans les jeux — Velvet Room et
 * mascottes — et pouvaient donc s'adresser au joueur sans que ça sonne faux.
 * Le casting s'ouvre depuis au cast principal de P3, P4 et P5 (décision Hamza
 * du 2026-09-25) : eux ne parlent pas AU joueur depuis l'extérieur, ils lui
 * parlent comme à quelqu'un qui joue à côté d'eux. C'est ce registre-là qui
 * est tenu — pas celui du narrateur omniscient.
 *
 * 'image' est un chemin depuis la racine du site — Discord télécharge l'image
 *         lui-même, elle DOIT donc être publiquement servie. Merope et Philemon
 *         n'ont pas d'avatar dédié : on prend leur portrait de jeu.
 * 'color' teinte la barre latérale de l'embed, une par personnage.
 *
 * ⚠️ Le nombre de voix ne doit JAMAIS être un multiple de 7. Avec 7 pile,
 * « jour de l'année % 7 » fige une voix par jour de la semaine : le joueur qui
 * passe tous les lundis n'en verrait qu'une seule, à vie. À 8, le cycle dérive.
 */
$voix = [
    [
        'nom'   => 'Morgana',
        'image' => 'img/avatar/Morgana.jpg',
        'color' => 0x1F2A44,
        'phrases' => [
            ["titre" => "🐈‍⬛ Debout, feignant",
             "fr" => "Le puzzle du jour est en ligne. Je te laisse cinq minutes, pas une de plus.",
             "en" => "Today's puzzle is up. You get five minutes, not one more.",
             "relance" => "Tu commences par quel mode ? / Which mode are you starting with?"],
            ["titre" => "🐈‍⬛ Ce n'est pas moi qui vais jouer",
             "fr" => "J'ai déjà la réponse, évidemment. Mais si je te la donne, tu n'apprends rien.",
             "en" => "I already know the answer, obviously. But if I tell you, you learn nothing.",
             "relance" => "Alors ? / Well?"],
            ["titre" => "🐈‍⬛ Ta série te regarde",
             "fr" => "Un jour manqué et tout repart de zéro. Je dis ça, je ne dis rien.",
             "en" => "Miss one day and it all resets. Just saying.",
             "relance" => "Tu tiens depuis combien ? / How long have you kept it going?"],
            ["titre" => "🐈‍⬛ Six modes, aucune excuse",
             "fr" => "Classique, Emoji, Silhouette, All-Out Attack, Personae, Musique. Choisis.",
             "en" => "Classic, Emoji, Silhouette, All-Out Attack, Personae, Music. Pick one.",
             "relance" => "Lequel te fait peur ? / Which one scares you?"],
            ["titre" => "🐈‍⬛ Un vrai voleur ne rate pas",
             "fr" => "On prépare, on observe, on frappe une seule fois. Ça vaut aussi pour deviner.",
             "en" => "You prepare, you watch, you strike once. Same goes for guessing.",
             "relance" => "Combien d'essais aujourd'hui ? / How many tries today?"],
            ["titre" => "🐈‍⬛ Encore endormi ?",
             "fr" => "La cible du jour, elle, est déjà debout. Toi non.",
             "en" => "Today's target is already awake. You're not.",
             "relance" => "Allez, bouge. / Come on, move."],
        ],
    ],
    [
        'nom'   => 'Teddie',
        'image' => 'img/avatar/Teddie.jpg',
        'color' => 0xFFC0CB,
        'phrases' => [
            ["titre" => "🐻 Ça sent le nouveau puzzle !",
             "fr" => "Mon flair ne me trompe jamais : quelqu'un de tout neuf attend d'être deviné aujourd'hui.",
             "en" => "My nose never lies — someone brand new is waiting to be guessed today.",
             "relance" => "Un indice ? Il a deux yeux. / A hint? It has two eyes."],
            ["titre" => "🐻 Ours-ment, tu peux le faire",
             "fr" => "Je crois en toi ! Enfin, je crois surtout que je m'ennuie tout seul ici.",
             "en" => "I believe in you! Well, mostly I believe I'm bored alone in here.",
             "relance" => "Viens jouer avec moi ! / Come play with me!"],
            ["titre" => "🐻 J'ai une théorie",
             "fr" => "Je pense que la réponse du jour aime le tofu. Ne me demandez pas pourquoi.",
             "en" => "I think today's answer likes tofu. Don't ask me why.",
             "relance" => "Qui parie avec moi ? / Who's betting with me?"],
            ["titre" => "🐻 Le brouillard s'est levé",
             "fr" => "Tout est clair de mon côté. De ton côté, j'ai comme un doute.",
             "en" => "Everything's clear on my side. On yours, I have my doubts.",
             "relance" => "Prouve-moi le contraire. / Prove me wrong."],
            ["titre" => "🐻 Score-ci, score-là",
             "fr" => "Postez vos résultats ! J'adore compter, même si je compte très mal.",
             "en" => "Post your scores! I love counting, even though I'm terrible at it.",
             "relance" => "Combien d'essais ? / How many tries?"],
            ["titre" => "🐻 Une question importante",
             "fr" => "Est-ce que deviner quelqu'un, c'est un peu comme le retrouver ? Je trouve que oui.",
             "en" => "Is guessing someone a bit like finding them? I think so.",
             "relance" => "Trouve-le aujourd'hui. / Go find them today."],
        ],
    ],
    [
        'nom'   => 'Elizabeth',
        'image' => 'img/avatar/Elisabeth.jpeg',
        'color' => 0x9B59B6,
        'phrases' => [
            ["titre" => "🕯️ Une question, avant de commencer",
             "fr" => "On m'a dit que deviner un visage procurait de la joie. Je souhaite vérifier cette affirmation.",
             "en" => "I was told that guessing a face brings joy. I wish to verify this claim.",
             "relance" => "Est-ce vrai ? Démontrez-le. / Is it true? Demonstrate."],
            ["titre" => "🕯️ J'ai pris des notes",
             "fr" => "Hier, un invité a échoué six fois de suite. Fascinant. J'aimerais reproduire l'expérience.",
             "en" => "Yesterday a guest failed six times in a row. Fascinating. I should like to reproduce it.",
             "relance" => "Un volontaire ? / Any volunteers?"],
            ["titre" => "🕯️ Le contrat, encore",
             "fr" => "Vous avez signé. Cela vous engage à essayer, pas nécessairement à réussir.",
             "en" => "You signed. That commits you to trying — not necessarily to succeeding.",
             "relance" => "Essayez donc. / So, try."],
            ["titre" => "🕯️ On m'a parlé de « série »",
             "fr" => "Un nombre qui monte, puis retombe d'un seul coup. Les humains y tiennent beaucoup. Pourquoi ?",
             "en" => "A number that climbs, then falls all at once. Humans care deeply about it. Why?",
             "relance" => "Expliquez-moi. / Explain it to me."],
            ["titre" => "🕯️ Observation du jour",
             "fr" => "Vous devinez plus vite lorsque vous cessez de réfléchir. C'est contre-intuitif, je l'ai noté.",
             "en" => "You guess faster when you stop thinking. Counter-intuitive. I wrote it down.",
             "relance" => "Confirmez-vous ? / Do you confirm?"],
            ["titre" => "🕯️ Je vous attendais",
             "fr" => "La journée est ouverte. Statistiquement, le premier échec est prévu d'ici quelques instants.",
             "en" => "The day is open. Statistically, the first failure is due any moment now.",
             "relance" => "Démentez-moi. / Prove me wrong."],
        ],
    ],
    [
        'nom'   => 'Margaret',
        'image' => 'img/avatar/margaret.jpg',
        'color' => 0xB03A2E,
        'phrases' => [
            ["titre" => "📖 Le tome du jour est ouvert",
             "fr" => "Chaque réponse trouvée s'inscrit ici. Chaque échec également. Je note tout.",
             "en" => "Every answer found is recorded here. Every failure too. I write it all down.",
             "relance" => "Que dois-je inscrire aujourd'hui ? / What shall I write today?"],
            ["titre" => "📖 Une épreuve vous attend",
             "fr" => "Vous progressez. Lentement, mais vous progressez. Voyons si cela tient aujourd'hui.",
             "en" => "You are improving. Slowly, but improving. Let us see if it holds today.",
             "relance" => "Prouvez-le. / Prove it."],
            ["titre" => "📖 La force vient de la variété",
             "fr" => "Un invité qui ne joue qu'un seul mode demeure un invité incomplet.",
             "en" => "A guest who plays only one mode remains an incomplete guest.",
             "relance" => "Lequel évitez-vous ? / Which one are you avoiding?"],
            ["titre" => "📖 Sur la question de la chance",
             "fr" => "Certains appellent cela de la chance. Je préfère parler de préparation.",
             "en" => "Some call it luck. I prefer to call it preparation.",
             "relance" => "Combien d'essais ? / How many tries?"],
            ["titre" => "📖 Vous êtes en retard",
             "fr" => "La journée a commencé sans vous. Elle se terminera sans vous si vous tardez.",
             "en" => "The day began without you. It will end without you if you linger.",
             "relance" => "Commencez. / Begin."],
            ["titre" => "📖 Un mot sur l'échec",
             "fr" => "Se tromper renseigne davantage que réussir du premier coup. Retenez-le.",
             "en" => "Being wrong teaches more than being right on the first try. Remember it.",
             "relance" => "Racontez votre erreur. / Tell us your mistake."],
        ],
    ],
    [
        'nom'   => 'Theodore',
        'image' => 'img/avatar/theodore.jpeg',
        'color' => 0x34495E,
        'phrases' => [
            ["titre" => "🎩 Bonjour à vous",
             "fr" => "Ma sœur m'a confié l'annonce du jour. Je m'efforcerai de bien faire.",
             "en" => "My sister entrusted today's announcement to me. I shall do my very best.",
             "relance" => "Souhaitez-vous commencer ? / Would you care to begin?"],
            ["titre" => "🎩 J'ai une question",
             "fr" => "Pourquoi certains invités devinent-ils en criant ? Est-ce réellement plus efficace ?",
             "en" => "Why do some guests shout while guessing? Is it genuinely more effective?",
             "relance" => "Testez pour moi. / Test it for me."],
            ["titre" => "🎩 On m'a expliqué les modes",
             "fr" => "Il y en a six. J'ai essayé les six. J'ai échoué aux six. Ce fut très instructif.",
             "en" => "There are six. I tried all six. I failed all six. Most instructive.",
             "relance" => "Faites mieux que moi. / Do better than me."],
            ["titre" => "🎩 À propos de votre série",
             "fr" => "Elle représente vos jours consécutifs. J'ai trouvé cela touchant, à ma manière.",
             "en" => "It represents your consecutive days. I found that touching, in my own way.",
             "relance" => "La vôtre en est où ? / Where is yours at?"],
            ["titre" => "🎩 Le puzzle est prêt",
             "fr" => "Je l'ai vérifié deux fois. Il ne devrait pas être trop difficile. Je crois.",
             "en" => "I checked it twice. It should not be too difficult. I believe.",
             "relance" => "Dites-moi si je me trompe. / Tell me if I am wrong."],
            ["titre" => "🎩 Une observation",
             "fr" => "Les invités reviennent chaque jour sans y être contraints. Je trouve cela remarquable.",
             "en" => "Guests return every day under no obligation at all. I find that remarkable.",
             "relance" => "Revenez demain aussi. / Come back tomorrow too."],
        ],
    ],
    [
        'nom'   => 'Lavenza',
        'image' => 'img/avatar/Lavenza.jpg',
        'color' => 0x4169E1,
        'phrases' => [
            ["titre" => "🔮 Bienvenue à la Velvet Room",
             "fr" => "Une nouvelle épreuve vous attend, invité. Votre contrat reste valable — pour aujourd'hui encore.",
             "en" => "A new trial awaits you, guest. Your contract remains valid — for today, at least.",
             "relance" => "Votre série tiendra-t-elle ? / Will your streak hold?"],
            ["titre" => "🔮 La réhabilitation continue",
             "fr" => "Chaque jour deviné vous rapproche un peu. De quoi, cela reste à déterminer.",
             "en" => "Each day you solve brings you a little closer. To what, remains to be determined.",
             "relance" => "Poursuivez. / Continue."],
            ["titre" => "🔮 Un avertissement bienveillant",
             "fr" => "La précipitation coûte des essais. La lenteur coûte la journée. Trouvez l'équilibre.",
             "en" => "Haste costs attempts. Slowness costs the day. Find the balance.",
             "relance" => "Combien d'essais ? / How many attempts?"],
            ["titre" => "🔮 Sur les masques",
             "fr" => "Deviner un visage, c'est reconnaître ce qu'il dissimule. Vous en êtes capable.",
             "en" => "To guess a face is to recognise what it conceals. You are capable of this.",
             "relance" => "Montrez-le. / Show it."],
            ["titre" => "🔮 Le registre est à jour",
             "fr" => "Vos résultats d'hier ont été consignés. Certains méritent d'être améliorés.",
             "en" => "Yesterday's results have been recorded. Some deserve improvement.",
             "relance" => "Faites mieux. / Do better."],
            ["titre" => "🔮 La journée vous appartient",
             "fr" => "Jusqu'à minuit, heure de Paris. Ensuite, une autre épreuve prendra sa place.",
             "en" => "Until midnight, Paris time. After that, another trial takes its place.",
             "relance" => "Ne la gâchez pas. / Do not waste it."],
        ],
    ],
    [
        'nom'   => 'Merope',
        'image' => 'database/portraits/Merope.webp',
        'color' => 0x16A085,
        'phrases' => [
            ["titre" => "🗝️ Les archives sont ouvertes",
             "fr" => "Un nouveau dossier vous attend, invité. Il n'attendra pas indéfiniment.",
             "en" => "A new file awaits you, guest. It will not wait indefinitely.",
             "relance" => "Consultez-le. / Open it."],
            ["titre" => "🗝️ Une entrée manquante",
             "fr" => "Votre nom ne figure pas encore au registre du jour. Cela peut se corriger.",
             "en" => "Your name does not yet appear in today's record. That can be corrected.",
             "relance" => "Corrigez-le. / Correct it."],
            ["titre" => "🗝️ Question de méthode",
             "fr" => "Vous procédez à l'intuition. D'autres procèdent par élimination. Les deux se valent, un jour sur deux.",
             "en" => "You go by instinct. Others go by elimination. Both work — every other day.",
             "relance" => "Laquelle aujourd'hui ? / Which one today?"],
            ["titre" => "🗝️ Sur la constance",
             "fr" => "Un invité régulier vaut mieux qu'un invité brillant. Les registres sont formels.",
             "en" => "A consistent guest is worth more than a brilliant one. The records are clear.",
             "relance" => "Votre série ? / Your streak?"],
            ["titre" => "🗝️ Le dossier du jour",
             "fr" => "Six approches sont possibles. Une seule vous conviendra vraiment. À vous de trouver laquelle.",
             "en" => "Six approaches are possible. Only one will truly suit you. Find which.",
             "relance" => "Vous commencez par laquelle ? / Which do you start with?"],
            ["titre" => "🗝️ Rien n'est perdu",
             "fr" => "Une série rompue se reconstruit. C'est moins glorieux, mais tout aussi valable.",
             "en" => "A broken streak can be rebuilt. Less glorious, but just as valid.",
             "relance" => "Reprenez aujourd'hui. / Start again today."],
        ],
    ],
    [
        'nom'   => 'Philemon',
        'image' => 'database/portraits/Philemon.webp',
        'color' => 0xF4D03F,
        'phrases' => [
            ["titre" => "🦋 Nous nous rencontrons de nouveau",
             "fr" => "Chaque jour vous offre un visage à reconnaître. Chaque visage vous en apprend un sur le vôtre.",
             "en" => "Each day offers you a face to recognise. Each face teaches you one about your own.",
             "relance" => "Qui verrez-vous aujourd'hui ? / Who will you see today?"],
            ["titre" => "🦋 Sur la dualité",
             "fr" => "L'erreur et la réussite naissent du même geste. Seul l'ordre change.",
             "en" => "Error and success are born of the same gesture. Only the order differs.",
             "relance" => "Lequel viendra en premier ? / Which comes first for you?"],
            ["titre" => "🦋 Le potentiel humain",
             "fr" => "Vous possédez déjà la réponse. Il ne vous manque que la certitude.",
             "en" => "You already hold the answer. You lack only the certainty.",
             "relance" => "Osez la donner. / Dare to give it."],
            ["titre" => "🦋 Une invitation",
             "fr" => "Je n'interviens jamais dans vos choix. J'observe, simplement, et je note ce qui advient.",
             "en" => "I never interfere with your choices. I merely watch, and note what unfolds.",
             "relance" => "Faites votre choix. / Make your choice."],
            ["titre" => "🦋 Sur la persévérance",
             "fr" => "Revenir chaque jour sans y être contraint : voilà ce qui m'intéresse chez vous.",
             "en" => "Returning every day under no compulsion — that is what interests me about you.",
             "relance" => "Revenez demain. / Return tomorrow."],
            ["titre" => "🦋 Le masque et le visage",
             "fr" => "Ce que vous cherchez porte un masque. Vous aussi. C'est ce qui rend la chose équitable.",
             "en" => "What you seek wears a mask. So do you. That is what makes it fair.",
             "relance" => "Trouvez-le. / Find it."],
        ],
    ],

    // ═══════════════════════════════════════════════════════════════════════
    // PERSONA 3 — S.E.E.S.
    // ═══════════════════════════════════════════════════════════════════════
    [
        'nom'   => 'Makoto Yuki',
        'image' => 'img/avatar/makoto_yuki.jpg',
        'color' => 0x3A5BA0,
        'phrases' => [
            ["titre" => "🎧 Une journée de plus",
             "fr" => "Nouveau puzzle. Ça revient chaque jour, sans faute. C'est reposant, quelque part.",
             "en" => "New puzzle. It comes back every day, without fail. There's something restful in that.",
             "relance" => "Tu joues ? / Are you playing?"],
            ["titre" => "🎧 Memento mori",
             "fr" => "Rien ne dure. Ni les séries, ni les jours. Raison de plus pour jouer celui-là.",
             "en" => "Nothing lasts. Not streaks, not days. All the more reason to play this one.",
             "relance" => "Vas-y. / Go ahead."],
            ["titre" => "🎧 Sans commentaire",
             "fr" => "J'ai trouvé. Je n'ai rien dit à personne. Tu peux faire pareil.",
             "en" => "I got it. I didn't tell anyone. You can do the same.",
             "relance" => "Ou pas. / Or not."],
        ],
    ],
    [
        'nom'   => 'Kotone Shiomi',
        'image' => 'img/avatar/kotone_shiomi_p5x_crossover.jpg',
        'color' => 0xE8447E,
        'phrases' => [
            ["titre" => "🎀 Salut, toi !",
             "fr" => "Nouveau puzzle ! Moi je l'ai déjà fait, évidemment. Mais je ne dis rien, promis.",
             "en" => "New puzzle! I've already done it, obviously. But I'm not saying a word, promise.",
             "relance" => "À toi ! / Your turn!"],
            ["titre" => "🎀 Même dortoir, autre chanson",
             "fr" => "On a vécu la même année, lui et moi. On ne l'a pas racontée pareil.",
             "en" => "He and I lived through the same year. We didn't tell it the same way.",
             "relance" => "Tu préfères laquelle ? / Which version do you prefer?"],
            ["titre" => "🎀 Pas une princesse",
             "fr" => "Personne ne viendra te souffler la réponse. Tant mieux — c'est plus drôle comme ça.",
             "en" => "Nobody's coming to hand you the answer. Good — it's more fun that way.",
             "relance" => "Vas-y, fonce. / Go on, jump in."],
        ],
    ],
    [
        'nom'   => 'Junpei Iori',
        'image' => 'img/avatar/Junpei.png',
        'color' => 0x2E6DB4,
        'phrases' => [
            ["titre" => "⚾ Le grand Junpei a parlé",
             "fr" => "J'ai trouvé la réponse du premier coup. Bon, du troisième. Mais j'ai trouvé.",
             "en" => "Got today's answer first try. Okay, third try. But I got it.",
             "relance" => "Et toi, combien d'essais ? / How many tries did you need?"],
            ["titre" => "⚾ Deuxième base",
             "fr" => "Au baseball on te donne trois prises. Ici t'en as plus. Franchement, c'est cadeau.",
             "en" => "In baseball you get three strikes. Here you get more. Honestly, that's generous.",
             "relance" => "Tu t'en sors ? / Holding up?"],
            ["titre" => "⚾ Pas Stupei aujourd'hui",
             "fr" => "On m'a assez appelé Stupei pour aujourd'hui. Va rater le tien, ça m'arrangerait.",
             "en" => "I've been called Stupei enough for one day. Go miss yours, it'd help.",
             "relance" => "Alors, raté ? / So, did you?"],
        ],
    ],
    [
        'nom'   => 'Yukari Takeba',
        'image' => 'img/avatar/Yukari.jpg',
        'color' => 0xE8447E,
        'phrases' => [
            ["titre" => "🏹 Vise mieux que ça",
             "fr" => "Une flèche part droit ou elle ne part pas. Réfléchis avant de répondre n'importe quoi.",
             "en" => "An arrow flies straight or it doesn't fly. Think before you answer anything.",
             "relance" => "Premier essai, sérieusement ? / First try, seriously?"],
            ["titre" => "🏹 Ne me refais pas ça",
             "fr" => "Hier tu as abandonné. Je ne dirai rien à personne. Mais moi, je l'ai vu.",
             "en" => "You gave up yesterday. I won't tell anyone. But I saw it.",
             "relance" => "Aujourd'hui, on fait mieux ? / Better today?"],
            ["titre" => "🏹 Pas le temps",
             "fr" => "Il y a un épisode de Featherman ce soir. Donc fais vite, je ne t'attends pas.",
             "en" => "There's a Featherman episode tonight. So be quick, I'm not waiting.",
             "relance" => "Tu tiens ta série ? / Streak still alive?"],
        ],
    ],
    [
        'nom'   => 'Mitsuru Kirijo',
        'image' => 'img/avatar/Mitsuru.jpg',
        'color' => 0x8E1230,
        'phrases' => [
            ["titre" => "❄️ Rapport de mission",
             "fr" => "La cible du jour est identifiée. Je compte sur une exécution propre.",
             "en" => "Today's target has been identified. I expect a clean execution.",
             "relance" => "Rapport, s'il vous plaît. / Your report, please."],
            ["titre" => "❄️ La discipline avant tout",
             "fr" => "Abandonner reste une option. Ce n'est simplement pas celle que j'attends de vous.",
             "en" => "Giving up remains an option. It is simply not the one I expect from you.",
             "relance" => "Combien d'essais ? / How many attempts?"],
            ["titre" => "❄️ Vous êtes attendu",
             "fr" => "Six modes. Vous en éviterez un, comme d'habitude. Lequel, cette fois ?",
             "en" => "Six modes. You will avoid one, as usual. Which one today?",
             "relance" => "Avouez. / Admit it."],
        ],
    ],
    [
        'nom'   => 'Akihiko Sanada',
        'image' => 'img/avatar/Akihiko.jpg',
        'color' => 0xC0392B,
        'phrases' => [
            ["titre" => "🥊 L'entraînement du jour",
             "fr" => "Une partie par jour, tous les jours. C'est comme ça qu'on progresse, pas autrement.",
             "en" => "One game a day, every day. That's how you get better, no other way.",
             "relance" => "Tu tiens depuis combien ? / How long's your streak?"],
            ["titre" => "🥊 Encore une série",
             "fr" => "Tu as trouvé ? Bien. Recommence dans un autre mode. On ne s'arrête pas sur une victoire.",
             "en" => "Got it? Good. Now do another mode. You don't stop on a win.",
             "relance" => "Lequel ensuite ? / Which one next?"],
            ["titre" => "🥊 Pas d'excuses",
             "fr" => "« J'ai pas eu le temps. » Moi non plus. J'ai quand même couru ce matin.",
             "en" => "\"I didn't have time.\" Neither did I. I still ran this morning.",
             "relance" => "Alors ? / Well?"],
        ],
    ],
    [
        'nom'   => 'Fuuka Yamagishi',
        'image' => 'img/avatar/Fuuka.jpeg',
        'color' => 0x27AE60,
        'phrases' => [
            ["titre" => "📡 Je capte quelque chose",
             "fr" => "La cible du jour est en place. Je ne peux pas t'en dire plus… ce ne serait pas juste.",
             "en" => "Today's target is in place. I can't tell you more… that wouldn't be fair.",
             "relance" => "Tu veux que je cherche encore ? / Want me to keep scanning?"],
            ["titre" => "📡 Bon courage",
             "fr" => "Prends ton temps. Vraiment. Personne ne te chronomètre ici.",
             "en" => "Take your time. Really. Nobody's timing you here.",
             "relance" => "Ça avance ? / How's it going?"],
            ["titre" => "📡 J'ai préparé quelque chose",
             "fr" => "J'ai fait des cookies pour fêter ta série. Ne les mange pas tout de suite.",
             "en" => "I baked cookies to celebrate your streak. Don't eat them right away.",
             "relance" => "Tu es sûr ? / Are you sure?"],
        ],
    ],
    [
        'nom'   => 'Aigis',
        'image' => 'img/avatar/Aigis.jpg',
        'color' => 0xD4AF37,
        'phrases' => [
            ["titre" => "🤖 Rapport quotidien",
             "fr" => "Nouvelle cible détectée. Probabilité de réussite estimée : inconnue. Je manque de données sur toi.",
             "en" => "New target detected. Estimated success rate: unknown. I lack data on you.",
             "relance" => "Fournis-moi un résultat. / Provide me with a result."],
            ["titre" => "🤖 Observation",
             "fr" => "Tu joues chaque jour à la même heure. J'ai remarqué. Ce n'est pas un reproche.",
             "en" => "You play at the same hour every day. I have noticed. This is not a criticism.",
             "relance" => "Est-ce que je me trompe ? / Am I mistaken?"],
            ["titre" => "🤖 Protéger",
             "fr" => "Ma mission est de te protéger. Je ne peux rien contre une mauvaise réponse.",
             "en" => "My mission is to protect you. I can do nothing about a wrong answer.",
             "relance" => "Combien d'essais ? / How many tries?"],
        ],
    ],
    [
        'nom'   => 'Ken Amada',
        'image' => 'img/avatar/Ken.jpeg',
        'color' => 0x5DADE2,
        'phrases' => [
            ["titre" => "🔱 Je ne suis pas un enfant",
             "fr" => "J'ai trouvé avant toi. Ça arrive plus souvent que tu ne le crois.",
             "en" => "I got it before you did. That happens more often than you'd think.",
             "relance" => "Prouve le contraire. / Prove me wrong."],
            ["titre" => "🔱 Après les devoirs",
             "fr" => "Je joue toujours après mes devoirs. Toi, tu as quoi comme excuse ?",
             "en" => "I always play after my homework. What's your excuse?",
             "relance" => "Alors ? / Well?"],
            ["titre" => "🔱 On tient bon",
             "fr" => "Rater un jour, ça arrive. Ce n'est pas une raison pour arrêter.",
             "en" => "Missing a day happens. That's no reason to stop.",
             "relance" => "Ta série va bien ? / Streak okay?"],
        ],
    ],
    [
        'nom'   => 'Shinjiro Aragaki',
        'image' => 'img/avatar/shinjiro_aragaki_p3.jpg',
        'color' => 0x6E4B3A,
        'phrases' => [
            ["titre" => "🍲 Tch.",
             "fr" => "Le puzzle est sorti. Tu fais ce que tu veux, ça ne me regarde pas.",
             "en" => "Puzzle's up. Do what you want, it's none of my business.",
             "relance" => "…tu l'as eu ? / …did you get it?"],
            ["titre" => "🍲 Mange d'abord",
             "fr" => "J'ai laissé quelque chose sur le feu. Joue après. On réfléchit mal le ventre vide.",
             "en" => "Left something on the stove. Play after. You think badly on an empty stomach.",
             "relance" => "C'était bon ? / Was it good?"],
            ["titre" => "🍲 Pas de sermon",
             "fr" => "Je ne vais pas te dire de continuer ta série. Tu sais très bien ce que tu fais.",
             "en" => "I'm not gonna tell you to keep your streak. You know what you're doing.",
             "relance" => "…ou pas. / …or not."],
        ],
    ],
    [
        'nom'   => 'Koromaru',
        'image' => 'img/avatar/Koromaru.jpg',
        'color' => 0xECF0F1,
        'phrases' => [
            ["titre" => "🐕 Wan !",
             "fr" => "*Koromaru attend devant l'écran, la laisse dans la gueule. Le puzzle du jour est sorti.*",
             "en" => "*Koromaru waits by the screen, leash in his mouth. Today's puzzle is up.*",
             "relance" => "*Il remue la queue.* / *He wags his tail.*"],
            ["titre" => "🐕 Il a déjà trouvé",
             "fr" => "*Koromaru aboie une fois, s'assoit, et attend. On dirait qu'il connaît la réponse.*",
             "en" => "*Koromaru barks once, sits, and waits. He seems to know the answer.*",
             "relance" => "*Il penche la tête.* / *He tilts his head.*"],
            ["titre" => "🐕 Fidèle au poste",
             "fr" => "*Il est venu hier. Avant-hier aussi. Sa série est plus longue que la tienne.*",
             "en" => "*He came yesterday. And the day before. His streak is longer than yours.*",
             "relance" => "*Wan !* / *Woof!*"],
        ],
    ],
    [
        'nom'   => 'Metis',
        'image' => 'img/avatar/Metis.jpg',
        'color' => 0x9B59B6,
        'phrases' => [
            ["titre" => "⚙️ Cible identifiée",
             "fr" => "Le puzzle du jour existe. Je te le signale. Ne me remercie pas, je le fais pour ma sœur.",
             "en" => "Today's puzzle exists. I am informing you. Don't thank me, I do it for my sister.",
             "relance" => "Va jouer. / Go play."],
            ["titre" => "⚙️ Analyse",
             "fr" => "Tu abandonnes trop tôt. Ce n'est pas une opinion, c'est une moyenne.",
             "en" => "You give up too early. That is not an opinion, it is an average.",
             "relance" => "Corrige ça. / Correct that."],
            ["titre" => "⚙️ Je reste",
             "fr" => "Je n'ai nulle part où aller. Autant te regarder chercher.",
             "en" => "I have nowhere to be. I may as well watch you search.",
             "relance" => "Continue. / Continue."],
        ],
    ],
    // ═══════════════════════════════════════════════════════════════════════
    // PERSONA 4 — Investigation Team
    // ═══════════════════════════════════════════════════════════════════════
    [
        'nom'   => 'Yu Narukami',
        'image' => 'img/avatar/Yu.gif',
        'color' => 0x9FA8DA,
        'phrases' => [
            ["titre" => "📺 …",
             "fr" => "Le puzzle du jour est sorti. J'ai déjà joué. Je ne dirai rien de plus.",
             "en" => "Today's puzzle is up. I've already played. I won't say more.",
             "relance" => "À toi. / Your turn."],
            ["titre" => "📺 Question de liens",
             "fr" => "Défie un ami aujourd'hui. On progresse plus vite à deux qu'en boucle tout seul.",
             "en" => "Challenge a friend today. You improve faster together than alone on a loop.",
             "relance" => "Qui tu défies ? / Who are you challenging?"],
            ["titre" => "📺 Dans le brouillard",
             "fr" => "La réponse est là, derrière. Il suffit de regarder assez longtemps.",
             "en" => "The answer is right there, behind it. You just have to look long enough.",
             "relance" => "Tu vois quelque chose ? / See anything?"],
        ],
    ],
    [
        'nom'   => 'Yosuke Hanamura',
        'image' => 'img/avatar/Yosuke.jpg',
        'color' => 0xF39C12,
        'phrases' => [
            ["titre" => "🎧 Chaque jour est un grand jour",
             "fr" => "Nouveau puzzle ! Bon, j'ai séché sur celui d'hier. Genre longtemps. On n'en parle pas.",
             "en" => "New puzzle! Okay, I blanked on yesterday's. For a while. We don't talk about it.",
             "relance" => "Toi t'as fait mieux ? / Did you do better?"],
            ["titre" => "🎧 Pause déjeuner",
             "fr" => "Je joue entre deux rayons. Si le chef passe, tu ne m'as pas vu.",
             "en" => "I play between aisles. If the boss walks by, you didn't see me.",
             "relance" => "Tu couvres, hein ? / You'll cover for me, right?"],
            ["titre" => "🎧 Sérieux ?",
             "fr" => "Trois essais et toujours rien. Je commence à croire que le jeu me déteste.",
             "en" => "Three tries and nothing. I'm starting to think the game hates me.",
             "relance" => "Dis-moi que t'as galéré aussi. / Tell me you struggled too."],
        ],
    ],
    [
        'nom'   => 'Chie Satonaka',
        'image' => 'img/avatar/Chie.jpg',
        'color' => 0x27AE60,
        'phrases' => [
            ["titre" => "🥋 Allez, on y va !",
             "fr" => "Nouveau puzzle ! Si tu le trouves du premier coup, je te paie un steak. Enfin, peut-être.",
             "en" => "New puzzle! Get it first try and I'll buy you steak. Well — maybe.",
             "relance" => "Alors, ce premier essai ? / So, first try?"],
            ["titre" => "🥋 Technique secrète",
             "fr" => "Mon secret : je réponds vite et fort. Ça marche pas toujours mais c'est marrant.",
             "en" => "My secret: answer fast and loud. Doesn't always work but it's fun.",
             "relance" => "Essaie, pour voir. / Try it, see what happens."],
            ["titre" => "🥋 Pas d'abandon",
             "fr" => "Abandonner ? Devant moi ? Recommence, et cette fois réfléchis.",
             "en" => "Give up? In front of me? Start over, and actually think this time.",
             "relance" => "C'est mieux ? / Better?"],
        ],
    ],
    [
        'nom'   => 'Yukiko Amagi',
        'image' => 'img/avatar/Yukiko.jpg',
        'color' => 0xC0392B,
        'phrases' => [
            ["titre" => "🏮 Bienvenue",
             "fr" => "Le puzzle du jour vous attend. Prenez votre temps, la maison ne ferme pas.",
             "en" => "Today's puzzle awaits you. Take your time, the inn doesn't close.",
             "relance" => "Bien installé ? / Comfortable?"],
            ["titre" => "🏮 Pff… hahaha !",
             "fr" => "Pardon. J'ai repensé à ma réponse d'hier. Elle était… vraiment très mauvaise. Hahaha !",
             "en" => "Sorry. I remembered my answer from yesterday. It was… really quite bad. Hahaha!",
             "relance" => "Ne demandez pas. / Don't ask."],
            ["titre" => "🏮 Une série tenue",
             "fr" => "Revenir chaque jour, c'est tout un art. Je le sais, c'est mon métier.",
             "en" => "Coming back every day is an art. I'd know — it's my family's trade.",
             "relance" => "Vous tenez depuis quand ? / How long have you kept it?"],
        ],
    ],
    [
        'nom'   => 'Kanji Tatsumi',
        'image' => 'img/avatar/Kanji.jpg',
        'color' => 0x34495E,
        'phrases' => [
            ["titre" => "🧵 Qu'est-ce tu regardes ?",
             "fr" => "Ouais, je joue tous les jours. Et alors ? T'as un problème avec ça ?",
             "en" => "Yeah, I play every day. So what? You got a problem with that?",
             "relance" => "C'est bien ce que je pensais. / That's what I thought."],
            ["titre" => "🧵 Du travail soigné",
             "fr" => "Une bonne réponse, c'est comme une bonne couture. Ça se voit pas, mais ça tient.",
             "en" => "A good answer's like good stitching. You don't see it, but it holds.",
             "relance" => "Quoi ? / What?"],
            ["titre" => "🧵 Vas-y franchement",
             "fr" => "Arrête de tourner autour. Réponds. Le pire qui arrive, c'est que t'as tort.",
             "en" => "Quit circling it. Answer. Worst case, you're wrong.",
             "relance" => "Alors ? / Well?"],
        ],
    ],
    [
        'nom'   => 'Rise Kujikawa',
        'image' => 'img/avatar/Rise.jpg',
        'color' => 0xE84393,
        'phrases' => [
            ["titre" => "🎤 Risette est en ligne !",
             "fr" => "Le puzzle du jour est là, et je le sens bien pour toi. Vas-y, je te regarde !",
             "en" => "Today's puzzle is up, and I've got a good feeling about you. Go on, I'm watching!",
             "relance" => "Tu me montres ? / Show me?"],
            ["titre" => "🎤 Analyse en cours",
             "fr" => "Je vois tes faiblesses d'ici. Le mode Émoji, par exemple. On en parle ?",
             "en" => "I can see your weak spots from here. Emoji mode, for instance. Shall we talk?",
             "relance" => "Je me trompe ? / Am I wrong?"],
            ["titre" => "🎤 Encore une !",
             "fr" => "Une partie de plus ? Allez, une seule. Pour moi.",
             "en" => "One more round? Come on, just one. For me.",
             "relance" => "Tu peux pas dire non. / You can't say no."],
        ],
    ],
    [
        'nom'   => 'Naoto Shirogane',
        'image' => 'img/avatar/Naoto.jpg',
        'color' => 0x2C3E50,
        'phrases' => [
            ["titre" => "🔍 Le dossier du jour",
             "fr" => "Une nouvelle affaire. Les indices sont tous là ; il ne manque que la déduction.",
             "en" => "A new case. Every clue is present; only the deduction is missing.",
             "relance" => "Votre conclusion ? / Your conclusion?"],
            ["titre" => "🔍 Méthode",
             "fr" => "Éliminez ce qui est impossible. Ce qui reste, aussi improbable soit-il, est la réponse.",
             "en" => "Eliminate the impossible. What remains, however improbable, is the answer.",
             "relance" => "Combien d'essais ? / How many attempts?"],
            ["titre" => "🔍 Une remarque",
             "fr" => "Vous abandonnez plus souvent en Silhouette qu'ailleurs. J'ai vérifié.",
             "en" => "You give up more often in Silhouette than elsewhere. I checked.",
             "relance" => "Démentez-moi. / Prove me wrong."],
        ],
    ],
    [
        'nom'   => 'Nanako Dojima',
        'image' => 'img/avatar/Nanako.jpg',
        'color' => 0xF8C471,
        'phrases' => [
            ["titre" => "🌻 Grand frère !",
             "fr" => "Il y a un nouveau puzzle ! J'ai essayé mais c'est dur. Tu m'aides ?",
             "en" => "There's a new puzzle! I tried but it's hard. Will you help me?",
             "relance" => "Dis, tu as trouvé ? / Did you get it?"],
            ["titre" => "🌻 Every day's great…",
             "fr" => "J'ai la chanson de Junes dans la tête depuis ce matin. Maintenant toi aussi.",
             "en" => "I've had the Junes song stuck in my head all morning. Now you do too.",
             "relance" => "Désolée ! / Sorry!"],
            ["titre" => "🌻 Tu reviens demain ?",
             "fr" => "Papa rentre tard encore. Mais toi tu reviens demain, hein ?",
             "en" => "Dad's working late again. But you'll come back tomorrow, right?",
             "relance" => "Promis ? / Promise?"],
        ],
    ],
    [
        'nom'   => 'Tohru Adachi',
        'image' => 'img/avatar/Adachi.jpg',
        'color' => 0x7F8C8D,
        'phrases' => [
            ["titre" => "🥬 Encore un puzzle",
             "fr" => "Un de plus. Tu vas le faire, tu vas gagner, et demain ça recommence. Passionnant.",
             "en" => "Another one. You'll do it, you'll win, and tomorrow it starts over. Riveting.",
             "relance" => "Amuse-toi bien. / Have fun with that."],
            ["titre" => "🥬 Entre nous",
             "fr" => "Personne ne vérifie si tu abandonnes. Personne ne regarde. Enfin — presque personne.",
             "en" => "Nobody checks if you give up. Nobody's watching. Well — almost nobody.",
             "relance" => "Quoi ? / What?"],
            ["titre" => "🥬 Du chou",
             "fr" => "J'ai encore mangé du chou ce midi. Voilà, c'était mon actualité. À toi de jouer.",
             "en" => "Had cabbage for lunch again. There, that's my news. Your turn.",
             "relance" => "Fascinant, hein ? / Fascinating, right?"],
        ],
    ],
    // ═══════════════════════════════════════════════════════════════════════
    // PERSONA 5 — Phantom Thieves
    // ═══════════════════════════════════════════════════════════════════════
    [
        'nom'   => 'Joker',
        'image' => 'img/avatar/JOKER.webp',
        'color' => 0xE60012,
        'phrases' => [
            ["titre" => "🃏 La cible du jour",
             "fr" => "On a repéré la cible. Le reste, c'est de l'exécution. Ne rate pas ton entrée.",
             "en" => "Target's been marked. The rest is execution. Don't miss your entrance.",
             "relance" => "Tu prends quel mode ? / Which mode are you taking?"],
            ["titre" => "🃏 Vole-la",
             "fr" => "Une réponse, ça ne se devine pas. Ça se prend. Avance et sers-toi.",
             "en" => "You don't guess an answer. You take it. Move in and help yourself.",
             "relance" => "Alors ? / Well?"],
            ["titre" => "🃏 Je l'avais",
             "fr" => "Premier essai. Non, je ne vais pas te dire comment. Cherche.",
             "en" => "First try. No, I'm not telling you how. Go look.",
             "relance" => "Bonne chance. / Good luck."],
        ],
    ],
    [
        'nom'   => 'Ryuji Sakamoto',
        'image' => 'img/avatar/Ryuji.jpg',
        'color' => 0xF1C40F,
        'phrases' => [
            ["titre" => "💀 Sérieux ?!",
             "fr" => "Nouveau puzzle ! Bon j'ai rien compris au premier essai, mais on s'en fout, on y va.",
             "en" => "New puzzle! Okay I got nothin' on the first try, but whatever, let's go.",
             "relance" => "Tu viens ou quoi ? / You comin' or what?"],
            ["titre" => "💀 On fonce",
             "fr" => "Réfléchir c'est surfait. Moi je réponds, et après je réfléchis. Ça marche… des fois.",
             "en" => "Thinking's overrated. I answer first, think after. Works… sometimes.",
             "relance" => "Fais pas comme moi. / Don't do it like me."],
            ["titre" => "💀 Ta série !",
             "fr" => "Hé, t'as pas joué hier. J'ai vu. Me laisse pas tout seul là-dedans.",
             "en" => "Yo, you didn't play yesterday. I saw. Don't leave me hangin' here.",
             "relance" => "Aujourd'hui tu viens. / Today you show up."],
        ],
    ],
    [
        'nom'   => 'Ann Takamaki',
        'image' => 'img/avatar/Ann.jpg',
        'color' => 0xE74C3C,
        'phrases' => [
            ["titre" => "🍰 Pause crêpe",
             "fr" => "Nouveau puzzle ! Je le fais en mangeant une crêpe. C'est ma méthode, elle vaut ce qu'elle vaut.",
             "en" => "New puzzle! I'm doing it over a crepe. That's my method, take it or leave it.",
             "relance" => "Tu manges quoi, toi ? / What are you having?"],
            ["titre" => "🍰 Pas d'abandon",
             "fr" => "Abandonner, jamais. Enfin… presque jamais. Bon, hier. Mais c'était injuste.",
             "en" => "Never give up. Well… almost never. Okay, yesterday. But that one was unfair.",
             "relance" => "Tu l'as trouvé, toi ? / Did you get it?"],
            ["titre" => "🍰 Ne te compare pas",
             "fr" => "Peu importe le nombre d'essais. Tu es venu jouer, c'est déjà ça.",
             "en" => "Doesn't matter how many tries. You showed up, that already counts.",
             "relance" => "Alors ? / So?"],
        ],
    ],
    [
        'nom'   => 'Yusuke Kitagawa',
        'image' => 'img/avatar/Yusuke.jpg',
        'color' => 0x3498DB,
        'phrases' => [
            ["titre" => "🎨 Magnifique",
             "fr" => "La composition de ce puzzle est remarquable. Je l'observe depuis vingt minutes. Sans répondre.",
             "en" => "The composition of today's puzzle is remarkable. I have observed it for twenty minutes. Without answering.",
             "relance" => "Vous voyez ce que je vois ? / Do you see what I see?"],
            ["titre" => "🎨 Une question de forme",
             "fr" => "Une silhouette n'est jamais vide. Elle contient tout ce que l'œil veut bien y mettre.",
             "en" => "A silhouette is never empty. It holds whatever the eye is willing to place in it.",
             "relance" => "Regardez encore. / Look again."],
            ["titre" => "🎨 Je suis fauché",
             "fr" => "J'ai dépensé mon dernier yen en pinceaux. Heureusement, ce jeu est gratuit.",
             "en" => "I spent my last yen on brushes. Fortunately, this game is free.",
             "relance" => "Quelle chance. / How fortunate."],
        ],
    ],
    [
        'nom'   => 'Makoto Niijima',
        'image' => 'img/avatar/Makoto.jpg',
        'color' => 0x8E44AD,
        'phrases' => [
            ["titre" => "📋 Ordre du jour",
             "fr" => "Nouveau puzzle. Je propose de commencer par le mode où tu es le plus faible.",
             "en" => "New puzzle. I suggest starting with the mode you're weakest in.",
             "relance" => "Tu sais lequel. / You know which one."],
            ["titre" => "📋 De la méthode",
             "fr" => "Répondre au hasard n'est pas une stratégie. C'est l'absence de stratégie.",
             "en" => "Answering at random isn't a strategy. It's the absence of one.",
             "relance" => "On recommence ? / Shall we start over?"],
            ["titre" => "📋 Un bilan",
             "fr" => "Ta série tient bon. Je le note, parce que personne d'autre ne le fera.",
             "en" => "Your streak is holding. I'm noting it, since no one else will.",
             "relance" => "Continue. / Keep going."],
        ],
    ],
    [
        'nom'   => 'Haru Okumura',
        'image' => 'img/avatar/Haru.png',
        'color' => 0xD98CB3,
        'phrases' => [
            ["titre" => "🌱 Bonjour !",
             "fr" => "Le puzzle du jour a fleuri. Prenez-en soin, il ne durera qu'une journée.",
             "en" => "Today's puzzle has bloomed. Do take care of it — it only lasts a day.",
             "relance" => "Vous l'avez trouvé ? / Did you find it?"],
            ["titre" => "🌱 Avec douceur",
             "fr" => "Rien ne presse. Un jardin ne pousse pas plus vite parce qu'on crie dessus.",
             "en" => "There's no rush. A garden doesn't grow faster because you shout at it.",
             "relance" => "Respirez. / Breathe."],
            ["titre" => "🌱 Ah, et…",
             "fr" => "Si le puzzle vous résiste, écrasez-le. Métaphoriquement, bien sûr. ☺️",
             "en" => "If the puzzle resists you, crush it. Metaphorically, of course. ☺️",
             "relance" => "Bien sûr. / Of course."],
        ],
    ],
    [
        'nom'   => 'Futaba Sakura',
        'image' => 'img/avatar/Futaba.jpg',
        'color' => 0x16A085,
        'phrases' => [
            ["titre" => "💻 Oracle en ligne",
             "fr" => "J'ai regardé le code. Non je rigole. Enfin… presque. Bon, joue.",
             "en" => "I looked at the code. Kidding. Well… mostly. Anyway, go play.",
             "relance" => "T'as trouvé ? / Got it?"],
            ["titre" => "💻 Statistiques",
             "fr" => "Tu joues toujours le même mode en premier. Toujours. J'ai les chiffres.",
             "en" => "You always play the same mode first. Always. I have the numbers.",
             "relance" => "Je peux les montrer. / I can show them."],
            ["titre" => "💻 Sors de ta chambre",
             "fr" => "Bon, moi je peux parler. Mais toi, va au moins jusqu'à l'écran.",
             "en" => "Okay, look who's talking. But you — at least make it to the screen.",
             "relance" => "Allez. / Go."],
        ],
    ],
    [
        'nom'   => 'Goro Akechi',
        'image' => 'img/avatar/Akechi.jpg',
        'color' => 0xB03A2E,
        'phrases' => [
            ["titre" => "🎩 Le Prince Détective",
             "fr" => "Une nouvelle énigme. J'ai déjà la réponse, naturellement. Mais je vous laisse chercher.",
             "en" => "A new riddle. I already have the answer, naturally. But I'll let you look.",
             "relance" => "Prenez votre temps. / Do take your time."],
            ["titre" => "🎩 Un détail",
             "fr" => "Vous hésitez trop longtemps. C'est révélateur — mais je ne dirai pas de quoi.",
             "en" => "You hesitate too long. It's revealing — though I won't say of what.",
             "relance" => "Continuez. / Do go on."],
            ["titre" => "🎩 Des pancakes",
             "fr" => "J'ai un rendez-vous, un tournage, et une pile de pancakes qui m'attend. Faites vite.",
             "en" => "I have an appointment, a shoot, and a stack of pancakes waiting. Be quick.",
             "relance" => "Alors ? / Well?"],
        ],
    ],
    [
        'nom'   => 'Sae Niijima',
        'image' => 'img/avatar/sae_niijima_p5.jpg',
        'color' => 0x5D6D7E,
        'phrases' => [
            ["titre" => "⚖️ Soyons directs",
             "fr" => "Le puzzle du jour. Vous avez vos indices. Je veux une réponse, pas une hypothèse.",
             "en" => "Today's puzzle. You have your evidence. I want an answer, not a theory.",
             "relance" => "J'écoute. / I'm listening."],
            ["titre" => "⚖️ Contre-interrogatoire",
             "fr" => "Vous avez abandonné hier. Expliquez-moi pourquoi. Je ne juge pas — je note.",
             "en" => "You gave up yesterday. Explain why. I'm not judging — I'm recording.",
             "relance" => "Je vous écoute. / I'm waiting."],
            ["titre" => "⚖️ Le dossier tient",
             "fr" => "Votre série est solide. C'est rare. Ne la compromettez pas ce soir.",
             "en" => "Your streak is solid. That's rare. Don't compromise it tonight.",
             "relance" => "C'est noté ? / Understood?"],
        ],
    ],
    [
        'nom'   => 'Sumire Yoshizawa',
        'image' => 'img/avatar/Sumire.jpg',
        'color' => 0xCD6155,
        'phrases' => [
            ["titre" => "🤸 Encore une fois",
             "fr" => "Nouveau puzzle ! Si vous ratez, recommencez. C'est comme ça qu'on apprend une figure.",
             "en" => "New puzzle! If you miss, start again. That's how you learn a routine.",
             "relance" => "On y retourne ? / Shall we go again?"],
            ["titre" => "🤸 Sans trembler",
             "fr" => "Le plus dur n'est pas de trouver. C'est de valider la réponse dont on est sûr.",
             "en" => "The hard part isn't finding it. It's committing to the answer you're sure of.",
             "relance" => "Vous hésitez ? / Hesitating?"],
            ["titre" => "🤸 Merci d'être là",
             "fr" => "Vous revenez tous les jours. Ça compte plus que le score, vraiment.",
             "en" => "You come back every day. That matters more than the score, truly.",
             "relance" => "À demain ! / See you tomorrow!"],
        ],
    ],
];

// Voix par jour, phrase par tour de rotation : la voix revient tous les 39 jours
// et dit alors la phrase suivante. Cycle complet = 39 × 3 = 117 jours, soit ~9
// passages par personnage et par an.
//
// ⚠️ Le nombre de voix ne doit JAMAIS être un multiple de 7 : « jour de l'année
// % nombre de voix » figerait alors une voix par jour de la semaine, et le
// joueur qui ne vient que le lundi n'en entendrait qu'une, à vie. 39 laisse un
// reste de 4.
$z       = (int) $now->format('z');
$iVoix   = $z % count($voix);
$v       = $voix[$iVoix];
$iPhrase = intdiv($z, count($voix)) % count($v['phrases']);
$ph      = $v['phrases'][$iPhrase];

$avatar = SITE . $v['image'];

$corps = sprintf(
    "🇫🇷 %s\n🇬🇧 *%s*\n\n**[Jouer / Play →](%s)**\n\n-# %s",
    $ph['fr'],
    $ph['en'],
    JEU_URL,
    $ph['relance']
);

// Mention optionnelle, pilotée par config.php.
// ⚠️ Ne PAS y mettre le rôle Membres : un ping quotidien sur un rendez-vous
// de routine pousse les gens à couper les notifications du salon, voire à
// partir. Utiliser le rôle opt-in « 🔔 Daily », que chacun prend s'il veut.
$mention = defined('DISCORD_DAILY_MENTION_ROLE')
    ? preg_replace('/\D/', '', (string) DISCORD_DAILY_MENTION_ROLE)
    : '';

// 🎁 Récompense du jour : badges/titres à date et codes événement qui commencent ou
// finissent aujourd'hui, lus dans le catalogue (api/lib/event_calendar.php). Plus rien
// à écrire à la main : créer le code dans l'admin suffit (demande Hamza, 2026-09-20).
$rewards = personadle_rewards_for_date(pdo(), DateTimeImmutable::createFromMutable($now));
$fields  = [];
if ($rewards !== []) {
    $fields[] = [
        'name'   => "🎁 Récompense du jour / Today's reward",
        'value'  => mb_substr(personadle_rewards_announcement($rewards), 0, 1024),
        'inline' => false,
    ];
}

$payload = [
    'username'   => $v['nom'],
    'avatar_url' => $avatar,
    'embeds'     => [[
        'title'       => $ph['titre'],
        'description' => $corps,
        'color'       => $v['color'],
        'thumbnail'   => ['url' => $avatar],
        'fields'      => $fields,
        'footer'      => ['text' => 'PersonaDLE — ' . $now->format('d/m/Y')],
    ]],
    'allowed_mentions' => ['parse' => [], 'roles' => $mention !== '' ? [$mention] : []],
];

if ($mention !== '') {
    $payload['content'] = '<@&' . $mention . '>';
}

/* Le salon peut être un forum (un fil par jour, pour que les scores des joueurs
   répondent à quelque chose au lieu de se perdre entre deux annonces). Un webhook
   ne peut pas poster dans un forum sans `thread_name`, ni dans un salon texte avec
   — d'où le helper, qui se replie tout seul dans les deux sens. `DISCORD_DAILY_FORUM`
   n'économise qu'un aller-retour : le cron marche même si la constante est fausse. */
$forum = defined('DISCORD_DAILY_FORUM') && (bool) DISCORD_DAILY_FORUM;
$fil   = personadle_discord_thread_name($now, $v['nom']);

$envoi   = personadle_discord_post_thread(DISCORD_DAILY_WEBHOOK, $payload, $fil, $forum);
$code    = $envoi['code'];
$erreur  = $envoi['error'];
$reponse = $envoi['body'];

// curl_exec() renvoie false sur échec réseau ($code reste 0) ; Discord renvoie
// 401/404 sur webhook révoqué et 429 sur rate limit. Les trois sont couverts.
if ($erreur !== '' || $code < 200 || $code >= 300) {
    // Le détail part en log, caviardé — jamais dans la réponse HTTP.
    personadle_log_error(pdo(), 'error', 'Discord daily announce failed (HTTP ' . $code . ')', [
        'source' => 'cron-discord-daily',
        'curl'   => _discordRedact($erreur),
        'body'   => _discordRedact(substr((string) $reponse, 0, 300)),
    ]);
    jsonError('Discord webhook call failed (HTTP ' . $code . ')', 502);
}

// Le repli a servi : la constante DISCORD_DAILY_FORUM ne dit pas la vérité sur
// le type du salon. Le message est passé quand même, mais chaque envoi coûte
// désormais deux appels — et c'est le log qui le signale, pas un joueur.
if (isset($envoi['repli'])) {
    personadle_log_error(pdo(), 'warning', 'Discord daily : ' . $envoi['repli'], [
        'source' => 'cron-discord-daily',
        'forum_attendu' => $forum ? 'oui' : 'non',
    ]);
}

// Trace de succès (Admin → Logs) : un cron hPanel qui ne tourne pas ne laisse
// AUCUNE autre empreinte — vécu du 9 au 19 septembre 2026, clé fausse, silence.
personadle_log_error(pdo(), 'info', 'Discord daily posted (' . $v['nom'] . ')', [
    'source' => 'cron-discord-daily',
    'date'   => $now->format('Y-m-d H:i'),
]);

jsonSuccess([
    'success' => true,
    'data'    => [
        'mention'    => $mention !== '' ? $mention : null,
        'date'         => $now->format('Y-m-d'),
        'voix'         => $v['nom'],
        'index_voix'   => $iVoix,
        'index_phrase' => $iPhrase,
        'total_voix'   => count($voix),
        'combinaisons' => count($voix) * count($v['phrases']),
        'rewards'      => array_map(static fn($r) => $r['slug'] . ':' . $r['phase'], $rewards),
        'status'       => $code,
        'elapsed_ms'   => round((microtime(true) - $start) * 1000),
        'ran_at'       => $now->format('Y-m-d H:i:s'),
    ],
]);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Neutralise toute trace du webhook dans une chaîne avant qu'elle ne parte en log.
 *
 * curl et Discord recopient parfois l'URL appelée dans leurs messages d'erreur.
 * Sans ce filet, un simple incident réseau écrirait le secret dans error_log()
 * ET dans la table error_log, relue par api/admin/error_logs.php — donc lisible
 * depuis l'admin. Le token est aussi remplacé seul, au cas où seule cette
 * portion de l'URL ressortirait.
 */
function _discordRedact(string $s): string
{
    if ($s === '') return '';

    $s = str_replace(DISCORD_DAILY_WEBHOOK, '[webhook]', $s);

    $slash = strrpos(DISCORD_DAILY_WEBHOOK, '/');
    if ($slash !== false) {
        $token = substr(DISCORD_DAILY_WEBHOOK, $slash + 1);
        if ($token !== '') {
            $s = str_replace($token, '[token]', $s);
        }
    }

    return $s;
}
