/**
 * database/compare-phrases.js — Phrases de conclusion pour la comparaison de stats
 * ──────────────────────────────────────────────────────────────────────────────────
 * Chaque entrée est un tableau de phrases. Les variables disponibles :
 *   {{me}}      → pseudo du joueur connecté
 *   {{friend}}  → pseudo de l'ami
 *   {{winner}}  → pseudo du joueur qui gagne (global win rate)
 *   {{loser}}   → pseudo du joueur qui perd
 *
 * Catégories :
 *   overall_win       → l'utilisateur a un meilleur win rate global (+5%)
 *   overall_lose      → l'ami a un meilleur win rate global (+5%)
 *   equal             → win rates quasi identiques (écart ≤ 5%)
 *   streak_win        → l'utilisateur a une meilleure streak (écart > 5)
 *   streak_lose       → l'ami a une meilleure streak (écart > 5)
 *   perfect_win       → (réservé — non utilisé actuellement)
 *   perfect_lose      → (réservé — non utilisé actuellement)
 *   mode_win.<mode>   → l'utilisateur est meilleur dans ce mode spécifique
 *   mode_lose.<mode>  → l'ami est meilleur dans ce mode spécifique
 *   rare              → phrases rares (12% de chance), Persona deep lore
 */

export const COMPARE_PHRASES = {

  // ── ENGLISH ────────────────────────────────────────────────────────────────
  en: {
    overall_win: [
      "Your stats speak for themselves. {{friend}} would need a second awakening to match your level.",
      "The Wild Card has spoken — {{friend}} was never a match.",
      "Even Igor would be impressed. Your record towers over {{friend}}'s.",
    ],
    overall_lose: [
      "{{friend}} carries this friendship. Time to flip the script.",
      "If this were a Velvet Room assessment, {{friend}} just unlocked a Rank 10 Persona… and you didn't.",
      "Morgana would be disappointed. But hey — there's always tomorrow.",
    ],
    equal: [
      "Two Wild Cards. Two destinies. The gap is razor-thin — rivalry confirmed.",
      "You and {{friend}} are statistically identical. The universe is afraid.",
      "This is less a comparison and more a mirror. Uncanny.",
    ],
    streak_win: [
      "Your streak rivals Joker's dedication to the Phantom Thieves.",
      "{{friend}} hasn't matched your consistency. Not even close.",
    ],
    streak_lose: [
      "{{friend}}'s streak makes yours look like a tutorial run.",
      "Consistency is a virtue. {{friend}} has mastered it. You… are learning.",
    ],
    perfect_win: [
      "Perfect wins? You hunt them. {{friend}} is still figuring out how.",
      "No mistakes, no compromises. Your record speaks volumes.",
    ],
    perfect_lose: [
      "{{friend}} doesn't guess — they know. Every single time.",
      "Perfect wins are earned, not given. {{friend}} has earned many.",
    ],
    mode_win: {
      classic:      ["Classic mode is where legends are born — and you are one.", "Your Compendium knowledge is vast. {{friend}}'s needs work."],
      emoji:        ["Emoji mode? You read them like sheet music. {{friend}} is still decoding.", "The symbols speak to you. {{friend}} is still learning the alphabet."],
      silhouette:   ["You see the shadow and know the soul. {{friend}} is still squinting.", "Shadows don't fool you. They apparently fool {{friend}}."],
      alloutattack: ["All-Out Attack is your domain. {{friend}} never stood a chance.", "You feel the rush of every All-Out Attack. {{friend}} feels the defeat."],
      personae:     ["The Velvet Room archives bend to your will. {{friend}} is still browsing.", "Personas are your second language. {{friend}} is still on chapter one."],
      music:        ["Your ears are tuned to the Velvet Room. {{friend}} clearly skips the soundtrack.", "Shoji Meguro's legacy lives through you. {{friend}} plays on mute."],
    },
    mode_lose: {
      classic:      ["{{friend}} knows these characters inside out. Maybe replay the games?", "Classic mode: {{friend}} 1 — You 0. The Compendium weeps."],
      emoji:        ["{{friend}} reads emojis like a Wild Card reads Arcanas. You're still learning.", "The symbols are unclear to you. {{friend}} has already solved them."],
      silhouette:   ["Shadows deceive you. {{friend}} sees right through them.", "{{friend}} spots the silhouette before you even load the page."],
      alloutattack: ["{{friend}} dominates the All-Out Attack stage. You're the one getting swept.", "You're on the receiving end of {{friend}}'s All-Out Attack. Ouch."],
      personae:     ["{{friend}}'s Velvet Room access is clearly Gold. Yours is Economy.", "{{friend}} names Personas in their sleep. You're still reading the Compendium."],
      music:        ["Music? {{friend}} hears things you'll never understand.", "Shoji Meguro would choose {{friend}} over you. Music is not your forte."],
    },
    rare: [
      "Even Nyx would acknowledge this record. Respect.",
      "The power of the Universe Arcana flows through {{winner}}. It was predetermined.",
      "A bond is measured not in time, but in losses. Study them both.",
      "Beware the one who has awakened to all Personas — in this friendship, that's {{winner}}.",
      "The Wild Card chooses: Growth or Stagnation. {{loser}} has chosen poorly.",
      "Igor whispers: 'Your potential is… promising.' He was looking at {{winner}}.",
      "Some call it luck. The Velvet Room calls it destiny. {{winner}} was chosen.",
      "You have faced your Shadow. {{loser}} has yet to accept theirs.",
      "The Midnight Channel never lies. It showed {{winner}} on top.",
      "Chie would eat all the meat and still outperform {{loser}}.",
    ],
  },

  // ── FRANÇAIS ───────────────────────────────────────────────────────────────
  fr: {
    overall_win: [
      "Tes stats parlent d'elles-mêmes. {{friend}} aurait besoin d'un second éveil pour t'atteindre.",
      "Le Wild Card a parlé — {{friend}} n'était pas à la hauteur.",
      "Même Igor serait impressionné. Ton bilan écrase celui de {{friend}}.",
    ],
    overall_lose: [
      "{{friend}} porte cette amitié. Il est temps de renverser la situation.",
      "Si c'était une évaluation Salle de Velours, {{friend}} vient de débloquer un Persona rang 10… pas toi.",
      "Morgana serait déçu. Mais bon — il y a toujours demain.",
    ],
    equal: [
      "Deux Wild Cards. Deux destins. L'écart est infime — rivalité confirmée.",
      "Toi et {{friend}} êtes statistiquement identiques. L'univers tremble.",
      "C'est moins une comparaison qu'un miroir. Déconcertant.",
    ],
    streak_win: [
      "Ta série rivalise avec le dévouement de Joker aux Voleurs Fantômes.",
      "{{friend}} n'a pas ta constance. Loin de là.",
    ],
    streak_lose: [
      "La série de {{friend}} fait passer la tienne pour un run tutoriel.",
      "La constance est une vertu. {{friend}} l'a maîtrisée. Toi… tu apprends.",
    ],
    perfect_win: [
      "Sans fautes ? Tu les chasses. {{friend}} cherche encore comment.",
      "Pas d'erreurs, pas de compromis. Ton record parle.",
    ],
    perfect_lose: [
      "{{friend}} ne devine pas — il sait. À chaque fois.",
      "Les victoires parfaites se méritent. {{friend}} en a beaucoup mérité.",
    ],
    mode_win: {
      classic:      ["Le mode Classique, c'est ton terrain. Tu y es une légende.", "Ton Compendium est vaste. Celui de {{friend}} a besoin de travail."],
      emoji:        ["Le mode Emoji ? Tu les lis comme une partition. {{friend}} décode encore.", "Les symboles te parlent. {{friend}} apprend encore l'alphabet."],
      silhouette:   ["Tu vois l'ombre et tu connais l'âme. {{friend}} plisse encore les yeux.", "Les silhouettes ne te trompent pas. Elles trompent apparemment {{friend}}."],
      alloutattack: ["L'All-Out Attack, c'est ton domaine. {{friend}} n'avait aucune chance.", "Tu sens l'ivresse de chaque All-Out Attack. {{friend}} sent la défaite."],
      personae:     ["Les archives de la Salle de Velours s'inclinent devant toi. {{friend}} parcourt encore.", "Les Personas sont ta seconde langue. {{friend}} est au chapitre un."],
      music:        ["Tes oreilles sont accordées à la Salle de Velours. {{friend}} zappe la BO.", "L'œuvre de Shoji Meguro vit à travers toi. {{friend}} joue en sourdine."],
    },
    mode_lose: {
      classic:      ["{{friend}} connaît ces personnages par cœur. Peut-être rejouer les jeux ?", "Mode Classique : {{friend}} 1 — Toi 0. Le Compendium pleure."],
      emoji:        ["{{friend}} lit les emojis comme un Wild Card lit les Arcanes. Toi, tu apprends.", "Les symboles restent flous pour toi. {{friend}} les a déjà résolus."],
      silhouette:   ["Les ombres te trompent. {{friend}} les traverse sans effort.", "{{friend}} repère la silhouette avant que tu aies chargé la page."],
      alloutattack: ["{{friend}} domine la scène All-Out Attack. C'est toi qui te fais balayer.", "Tu encaisses l'All-Out Attack de {{friend}}. Ça fait mal."],
      personae:     ["L'accès de {{friend}} à la Salle de Velours est Gold. Le tien est Économie.", "{{friend}} nomme les Personas dans son sommeil. Toi tu lis encore."],
      music:        ["La musique ? {{friend}} entend des choses que tu ne comprendras jamais.", "Shoji Meguro choisirait {{friend}} plutôt que toi. La musique n'est pas ton fort."],
    },
    rare: [
      "Même Nyx reconnaîtrait ce bilan. Respect.",
      "Le pouvoir de l'Arcane Univers coule en {{winner}}. C'était prédestiné.",
      "Un lien se mesure non pas au temps, mais aux défaites. Méditez-les tous les deux.",
      "Méfie-toi de celui qui a éveillé tous les Personas — dans cette amitié, c'est {{winner}}.",
      "Le Wild Card choisit : Croissance ou Stagnation. {{loser}} a mal choisi.",
      "Igor murmure : 'Ton potentiel est… prometteur.' Il regardait {{winner}}.",
      "Certains appellent ça de la chance. La Salle de Velours appelle ça le destin. {{winner}} était choisi.",
      "Tu as affronté ton Ombre. {{loser}} n'a pas encore accepté la sienne.",
      "Le Midnight Channel ne ment jamais. Il a montré {{winner}} en tête.",
      "Chie mangerait toute la viande et surpasserait quand même {{loser}}.",
    ],
  },

  // ── ESPAÑOL ────────────────────────────────────────────────────────────────
  es: {
    overall_win: [
      "Tus estadísticas hablan por sí solas. {{friend}} necesitaría un segundo despertar.",
      "El Wild Card ha hablado — {{friend}} nunca fue rival.",
      "Incluso Igor quedaría impresionado. Tu historial aplasta el de {{friend}}.",
    ],
    overall_lose: [
      "{{friend}} sostiene esta amistad. Es hora de cambiar el guion.",
      "En una evaluación del Velvet Room, {{friend}} acaba de desbloquear un Persona rango 10… tú no.",
      "Morgana estaría decepcionado. Pero bueno — siempre hay un mañana.",
    ],
    equal: [
      "Dos Wild Cards. Dos destinos. La diferencia es mínima — rivalidad confirmada.",
      "Tú y {{friend}} sois estadísticamente idénticos. El universo tiene miedo.",
      "Esto no es una comparación, es un espejo. Desconcertante.",
    ],
    streak_win: [
      "Tu racha rivaliza con la dedicación de Joker a los Phantom Thieves.",
      "{{friend}} no ha igualado tu constancia. Ni de lejos.",
    ],
    streak_lose: [
      "La racha de {{friend}} hace que la tuya parezca una partida tutorial.",
      "La constancia es una virtud. {{friend}} la ha dominado. Tú… la estás aprendiendo.",
    ],
    perfect_win: [
      "¿Victorias perfectas? Tú las cazas. {{friend}} aún averigua cómo.",
      "Sin errores, sin compromisos. Tu récord habla por sí solo.",
    ],
    perfect_lose: [
      "{{friend}} no adivina — sabe. Cada vez.",
      "Las victorias perfectas se ganan. {{friend}} ha ganado muchas.",
    ],
    mode_win: {
      classic:      ["El modo Clásico es tu territorio. Eres una leyenda allí.", "Tu Compendio es vasto. El de {{friend}} necesita trabajo."],
      emoji:        ["¿Modo Emoji? Los lees como música. {{friend}} aún los descifra.", "Los símbolos te hablan. {{friend}} aún aprende el alfabeto."],
      silhouette:   ["Ves la sombra y conoces el alma. {{friend}} aún entrecierra los ojos.", "Las siluetas no te engañan. Aparentemente engañan a {{friend}}."],
      alloutattack: ["El All-Out Attack es tu dominio. {{friend}} nunca tuvo oportunidad.", "Sientes el rush de cada All-Out Attack. {{friend}} siente la derrota."],
      personae:     ["Los archivos del Velvet Room se doblan ante tu voluntad. {{friend}} aún navega.", "Los Personas son tu segundo idioma. {{friend}} está en el capítulo uno."],
      music:        ["Tus oídos están sintonizados al Velvet Room. {{friend}} claramente omite la banda sonora.", "El legado de Shoji Meguro vive a través de ti. {{friend}} juega en silencio."],
    },
    mode_lose: {
      classic:      ["{{friend}} conoce estos personajes de memoria. ¿Quizás rejugar los juegos?", "Modo Clásico: {{friend}} 1 — Tú 0. El Compendio llora."],
      emoji:        ["{{friend}} lee emojis como un Wild Card lee Arcanas. Tú aún aprendes.", "Los símbolos no te quedan claros. {{friend}} ya los resolvió."],
      silhouette:   ["Las sombras te engañan. {{friend}} las atraviesa sin esfuerzo.", "{{friend}} detecta la silueta antes de que tú cargues la página."],
      alloutattack: ["{{friend}} domina el escenario All-Out Attack. Tú eres quien cae.", "Recibes el All-Out Attack de {{friend}}. Duele."],
      personae:     ["El acceso de {{friend}} al Velvet Room es Gold. El tuyo es Económico.", "{{friend}} nombra Personas dormido. Tú aún lees el Compendio."],
      music:        ["¿Música? {{friend}} oye cosas que nunca entenderás.", "Shoji Meguro elegiría a {{friend}} sobre ti. La música no es tu fuerte."],
    },
    rare: [
      "Incluso Nyx reconocería este historial. Respeto.",
      "El poder del Arcana Universo fluye por {{winner}}. Estaba predestinado.",
      "Un vínculo se mide no en el tiempo, sino en las derrotas. Estudiadlas ambos.",
      "Cuidado con quien ha despertado todos los Personas — en esta amistad, es {{winner}}.",
      "El Wild Card elige: Crecimiento o Estancamiento. {{loser}} ha elegido mal.",
      "Igor susurra: 'Tu potencial es… prometedor.' Miraba a {{winner}}.",
      "Algunos lo llaman suerte. El Velvet Room lo llama destino. {{winner}} fue elegido.",
      "Has enfrentado tu Sombra. {{loser}} aún no acepta la suya.",
      "El Midnight Channel nunca miente. Mostró a {{winner}} en lo alto.",
      "Chie comería toda la carne y aún superaría a {{loser}}.",
    ],
  },

  // ── DEUTSCH ────────────────────────────────────────────────────────────────
  de: {
    overall_win: [
      "Deine Statistiken sprechen für sich. {{friend}} bräuchte ein zweites Erwachen.",
      "Das Wild Card hat gesprochen — {{friend}} war nie ebenbürtig.",
      "Selbst Igor wäre beeindruckt. Deine Bilanz übertrifft {{friend}}'s bei weitem.",
    ],
    overall_lose: [
      "{{friend}} trägt diese Freundschaft. Zeit, das Drehbuch umzuschreiben.",
      "In einer Velvet Room-Bewertung hat {{friend}} gerade einen Rang-10-Persona freigeschaltet… du nicht.",
      "Morgana wäre enttäuscht. Aber hey — es gibt immer ein Morgen.",
    ],
    equal: [
      "Zwei Wild Cards. Zwei Schicksale. Der Abstand ist winzig — Rivalität bestätigt.",
      "Du und {{friend}} seid statistisch identisch. Das Universum hat Angst.",
      "Das ist weniger ein Vergleich als ein Spiegel. Verblüffend.",
    ],
    streak_win: [
      "Deine Serie rivalisiert mit Jokers Hingabe an die Phantom Thieves.",
      "{{friend}} hat deine Beständigkeit nicht erreicht. Nicht annähernd.",
    ],
    streak_lose: [
      "{{friend}}'s Serie lässt deine wie einen Tutorial-Run aussehen.",
      "Beständigkeit ist eine Tugend. {{friend}} hat sie gemeistert. Du… lernst noch.",
    ],
    perfect_win: [
      "Perfekte Siege? Du jagst sie. {{friend}} versucht noch zu verstehen, wie.",
      "Keine Fehler, keine Kompromisse. Dein Rekord spricht Bände.",
    ],
    perfect_lose: [
      "{{friend}} rät nicht — sie wissen es. Jedes Mal.",
      "Perfekte Siege werden verdient. {{friend}} hat viele verdient.",
    ],
    mode_win: {
      classic:      ["Der Classic-Modus ist dein Territorium. Du bist eine Legende dort.", "Dein Kompendium-Wissen ist umfangreich. {{friend}}'s braucht Arbeit."],
      emoji:        ["Emoji-Modus? Du liest sie wie Notenblätter. {{friend}} entschlüsselt noch.", "Die Symbole sprechen zu dir. {{friend}} lernt noch das Alphabet."],
      silhouette:   ["Du siehst den Schatten und kennst die Seele. {{friend}} kneift noch die Augen zusammen.", "Silhouetten täuschen dich nicht. Sie täuschen offenbar {{friend}}."],
      alloutattack: ["All-Out Attack ist dein Gebiet. {{friend}} hatte nie eine Chance.", "Du spürst den Rush jedes All-Out Attacks. {{friend}} spürt die Niederlage."],
      personae:     ["Die Velvet Room Archive beugen sich deinem Willen. {{friend}} stöbert noch.", "Personas sind deine Zweitsprache. {{friend}} ist noch bei Kapitel eins."],
      music:        ["Deine Ohren sind auf den Velvet Room eingestimmt. {{friend}} überspringt offensichtlich den Soundtrack.", "Shoji Meguro's Erbe lebt durch dich. {{friend}} spielt auf Stumm."],
    },
    mode_lose: {
      classic:      ["{{friend}} kennt diese Charaktere in- und auswendig. Vielleicht die Spiele nochmal spielen?", "Classic-Modus: {{friend}} 1 — Du 0. Das Kompendium weint."],
      emoji:        ["{{friend}} liest Emojis wie ein Wild Card Arkanen liest. Du lernst noch.", "Die Symbole sind dir unklar. {{friend}} hat sie bereits gelöst."],
      silhouette:   ["Schatten täuschen dich. {{friend}} sieht direkt durch sie.", "{{friend}} erkennt die Silhouette, bevor du die Seite geladen hast."],
      alloutattack: ["{{friend}} dominiert die All-Out Attack-Bühne. Du bist derjenige, der gefegt wird.", "Du steckst {{friend}}'s All-Out Attack ein. Autsch."],
      personae:     ["{{friend}}'s Velvet Room-Zugang ist Gold. Deiner ist Economy.", "{{friend}} benennt Personas im Schlaf. Du liest noch im Kompendium."],
      music:        ["Musik? {{friend}} hört Dinge, die du nie verstehen wirst.", "Shoji Meguro würde {{friend}} dir vorziehen. Musik ist nicht deine Stärke."],
    },
    rare: [
      "Selbst Nyx würde diese Bilanz anerkennen. Respekt.",
      "Die Macht des Universum-Arkanum fließt durch {{winner}}. Es war vorherbestimmt.",
      "Eine Verbindung wird nicht in Zeit gemessen, sondern in Niederlagen. Studiert sie beide.",
      "Hütet euch vor demjenigen, der alle Personas erweckt hat — in dieser Freundschaft ist das {{winner}}.",
      "Das Wild Card wählt: Wachstum oder Stagnation. {{loser}} hat schlecht gewählt.",
      "Igor flüstert: 'Dein Potenzial ist… vielversprechend.' Er schaute {{winner}} an.",
      "Manche nennen es Glück. Der Velvet Room nennt es Schicksal. {{winner}} wurde auserwählt.",
      "Du hast deinem Schatten gegenübergestanden. {{loser}} hat seinen noch nicht akzeptiert.",
      "Der Midnight Channel lügt nie. Er zeigte {{winner}} an der Spitze.",
      "Chie würde das ganze Fleisch essen und {{loser}} trotzdem übertreffen.",
    ],
  },

  // ── ITALIANO ───────────────────────────────────────────────────────────────
  it: {
    overall_win: [
      "Le tue statistiche parlano da sole. {{friend}} avrebbe bisogno di un secondo risveglio.",
      "Il Wild Card ha parlato — {{friend}} non era mai alla tua altezza.",
      "Persino Igor sarebbe impressionato. Il tuo record supera di gran lunga quello di {{friend}}.",
    ],
    overall_lose: [
      "{{friend}} regge questa amicizia. È ora di cambiare copione.",
      "In una valutazione della Velvet Room, {{friend}} ha appena sbloccato un Persona rango 10… tu no.",
      "Morgana sarebbe deluso. Ma hey — c'è sempre un domani.",
    ],
    equal: [
      "Due Wild Card. Due destini. Il divario è minimo — rivalità confermata.",
      "Tu e {{friend}} siete statisticamente identici. L'universo ha paura.",
      "Questo è meno un confronto e più uno specchio. Sconcertante.",
    ],
    streak_win: [
      "La tua serie rivaleggia con la dedizione di Joker ai Phantom Thieves.",
      "{{friend}} non ha raggiunto la tua costanza. Nemmeno vicino.",
    ],
    streak_lose: [
      "La serie di {{friend}} fa sembrare la tua un tutorial.",
      "La costanza è una virtù. {{friend}} l'ha padroneggiata. Tu… stai imparando.",
    ],
    perfect_win: [
      "Vittorie perfette? Le cacci. {{friend}} sta ancora capendo come.",
      "Nessun errore, nessun compromesso. Il tuo record parla chiaro.",
    ],
    perfect_lose: [
      "{{friend}} non indovina — sa. Ogni volta.",
      "Le vittorie perfette si guadagnano. {{friend}} ne ha guadagnate molte.",
    ],
    mode_win: {
      classic:      ["La modalità Classic è il tuo territorio. Sei una leggenda lì.", "La tua conoscenza del Compendio è vasta. Quella di {{friend}} ha bisogno di lavoro."],
      emoji:        ["Modalità Emoji? Li leggi come spartiti. {{friend}} sta ancora decifrando.", "I simboli ti parlano. {{friend}} sta ancora imparando l'alfabeto."],
      silhouette:   ["Vedi l'ombra e conosci l'anima. {{friend}} sta ancora strizzando gli occhi.", "Le sagome non ti ingannano. Ingannano apparentemente {{friend}}."],
      alloutattack: ["L'All-Out Attack è il tuo dominio. {{friend}} non ha mai avuto chance.", "Senti il brivido di ogni All-Out Attack. {{friend}} sente la sconfitta."],
      personae:     ["Gli archivi della Velvet Room si piegano alla tua volontà. {{friend}} sta ancora sfogliando.", "I Persona sono la tua seconda lingua. {{friend}} è ancora al capitolo uno."],
      music:        ["Le tue orecchie sono sintonizzate sulla Velvet Room. {{friend}} salta chiaramente la colonna sonora.", "L'eredità di Shoji Meguro vive attraverso di te. {{friend}} gioca in muto."],
    },
    mode_lose: {
      classic:      ["{{friend}} conosce questi personaggi a memoria. Forse rigioca i titoli?", "Modalità Classic: {{friend}} 1 — Tu 0. Il Compendio piange."],
      emoji:        ["{{friend}} legge emoji come un Wild Card legge Arcani. Tu stai ancora imparando.", "I simboli ti sono poco chiari. {{friend}} li ha già risolti."],
      silhouette:   ["Le ombre ti ingannano. {{friend}} le attraversa senza sforzo.", "{{friend}} individua la sagoma prima che tu carichi la pagina."],
      alloutattack: ["{{friend}} domina la scena All-Out Attack. Sei tu a essere spazzato via.", "Incassi l'All-Out Attack di {{friend}}. Fa male."],
      personae:     ["L'accesso di {{friend}} alla Velvet Room è Gold. Il tuo è Economy.", "{{friend}} nomina i Persona nel sonno. Tu stai ancora leggendo il Compendio."],
      music:        ["Musica? {{friend}} sente cose che non capirai mai.", "Shoji Meguro sceglierebbe {{friend}} su di te. La musica non è il tuo forte."],
    },
    rare: [
      "Persino Nyx riconoscerebbe questo record. Rispetto.",
      "Il potere dell'Arcano Universo scorre in {{winner}}. Era predestinato.",
      "Un legame si misura non nel tempo, ma nelle sconfitte. Studiatele entrambe.",
      "Attenti a chi ha risvegliato tutti i Persona — in questa amicizia, è {{winner}}.",
      "Il Wild Card sceglie: Crescita o Stagnazione. {{loser}} ha scelto male.",
      "Igor sussurra: 'Il tuo potenziale è… promettente.' Guardava {{winner}}.",
      "Alcuni lo chiamano fortuna. La Velvet Room lo chiama destino. {{winner}} era stato scelto.",
      "Hai affrontato la tua Ombra. {{loser}} non ha ancora accettato la propria.",
      "Il Midnight Channel non mente mai. Ha mostrato {{winner}} in cima.",
      "Chie mangerebbe tutta la carne e supererebbe comunque {{loser}}.",
    ],
  },
};
