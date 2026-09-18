<?php
/**
 * api/cron/discord-daily.php — Annonce quotidienne du PersonaDLE sur Discord
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/discord-daily.php
 *   Header: X-Cron-Key: <CRON_SECRET>
 *
 * Fréquence : tous les jours à 00:05 (Paris), juste après le reset du jeu.
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
 * Les voix. Toutes brisent le quatrième mur dans les jeux : Velvet Room et
 * mascottes. Ce sont les seuls personnages qui peuvent s'adresser au joueur
 * sans que ça sonne faux.
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
];

// Voix par jour, phrase par tour de rotation : la voix revient tous les 8 jours
// et dit alors la phrase suivante. Cycle complet = 8 × 6 = 48 jours.
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

$payload = [
    'username'   => $v['nom'],
    'avatar_url' => $avatar,
    'embeds'     => [[
        'title'       => $ph['titre'],
        'description' => $corps,
        'color'       => $v['color'],
        'thumbnail'   => ['url' => $avatar],
        'footer'      => ['text' => 'PersonaDLE — ' . $now->format('d/m/Y')],
    ]],
    'allowed_mentions' => ['parse' => []],
];

$body = json_encode($payload, JSON_UNESCAPED_UNICODE);
if ($body === false) {
    jsonError('Failed to encode Discord payload', 500);
}

// curl_init() sans argument : passer l'URL ici peut renvoyer false, et
// curl_setopt_array(false, …) est une TypeError fatale en PHP 8.
// « ?wait=true » fait répondre Discord avec le message créé (200) au lieu d'un
// 204 muet — sinon un webhook révoqué serait indiscernable d'un envoi réussi.
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => DISCORD_DAILY_WEBHOOK . '?wait=true',
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT        => 15,
]);
$reponse = curl_exec($ch);
$code    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$erreur  = curl_error($ch);
curl_close($ch);

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

jsonSuccess([
    'success' => true,
    'data'    => [
        'date'         => $now->format('Y-m-d'),
        'voix'         => $v['nom'],
        'index_voix'   => $iVoix,
        'index_phrase' => $iPhrase,
        'total_voix'   => count($voix),
        'combinaisons' => count($voix) * count($v['phrases']),
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
