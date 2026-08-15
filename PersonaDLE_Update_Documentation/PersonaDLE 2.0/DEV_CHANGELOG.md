# Changelog technique — PersonaDLE v2.0

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE_Update.html` reste le changelog **joueur** — highlights
> uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur
> si elle est réellement visible/parlante côté joueur.

---

## 2026-08-13 — fix(data): Thanatos re-fusionné en une seule entrée (P3 + P4AU)

Retour en arrière sur le split de Thanatos fait dans le commit précédent, suite à un
signalement produit : les deux entrées affichaient la **même image**, donc un joueur
répondant "Elizabeth" (vrai dans l'absolu) pouvait être marqué faux si la cible tirée était
la version P3 — ressenti comme un bug, pas comme une règle de contenu.

- **`personaeMode/database/personaeCharacters.js`** — `Thanatos` redevient une seule entrée
  `user: ["Makoto Yuki", "Kotone Shiomi", "Elizabeth"]`, `opus: ["P3", "P3FES", "P3P",
  "P3R", "P4AU"]`. Précédent déjà établi par `Orpheus Telos` (même fichier), qui fusionne
  déjà des wielders de sous-continuités différentes dans une seule entrée — principe du
  dataset : une entrée par persona, tous les wielders documentés dedans, pas une entrée par
  jeu.
- `api/data/daily_pools.json` régénéré (`npm run pools:build`) — 150 entrées personae
  (au lieu de 151 avec le split).
- Le fix `challengeKey()`/`findByChallengeKey()` du commit précédent reste utile et inchangé
  : `Thanatos` n'est simplement plus détecté comme dupliqué (fonction dynamique, pas de
  liste en dur), `Hermes`/`Prometheus` restent correctement désambiguïsés (ce sont deux
  personnages réellement différents, pas une question de générosité d'acceptation).

⚠️ **Effet de bord sur un test PHPUnit existant** (`tests/php/DailyTargetTest.php` —
`testComputeDailyTargetForPersonaeFallsBackToFilteredPoolWhenDailyIsExcluded`) : ce test
utilise un couple date/seed codé en dur, choisi à l'origine pour déclencher un scénario
précis (tirage non filtré ≠ tirage filtré P4) contre le pool personae de l'époque. Les
opus P4AU ajoutés sur plusieurs entrées ont décalé le tirage seedé déterministe pour ce
couple précis — recalculé un nouveau couple (`2026-08-01` / seed `1`) qui redéclenche le
même scénario contre le pool actuel, vérifié en exécutant directement
`personadle_compute_daily_target()` (pas de DB nécessaire pour cette classe de test, mais
PHPUnit lui-même injoignable dans cet environnement — `phar.phpunit.de` hors de la liste
blanche du proxy sortant — vérification faite en appelant la fonction réelle directement).

## 2026-08-13 — fix(challenge): cible de défi Personae mal résolue sur les personas dupliquées

Suite immédiate du lot P4AU ci-dessous : le fait de scinder `Thanatos` en 2 entrées
(P3 vs P4AU) a rendu concret un angle mort déjà documenté mais laissé de côté — la
résolution de cible de défi ami en mode Personae matchait par simple nom de persona.

- **Root cause** (`personaeMode/modePersonae.js`) : le pool de défi (`showChallengeButton`)
  envoyait `c.persona` brut comme identifiant de cible, et la résolution côté ami
  (`originalCharacters.find(c => c.persona === name)`) retombait toujours sur la
  **première** entrée du tableau portant ce nom. Avec des noms dupliqués entre deux
  personnages différents (`Thanatos` : Makoto/Kotone vs Elizabeth ; `Hermes` : Junpei vs
  Jun Kurosu/P2IS ; `Prometheus` : Futaba vs Baofu/P2EP), un défi tombant sur la 2e entrée
  se résolvait côté ami sur la mauvaise réponse acceptée.
- **Fix** : `challengeKey(c)` calcule un identifiant — `c.persona` seul si le nom n'est pas
  dupliqué dans le dataset (immense majorité des cas, format inchangé, rétro-compatible
  avec un défi déjà en vol), sinon `"{persona}::{premier opus}"`. `findByChallengeKey(key)`
  fait l'inverse, avec repli sur le comportement historique (1er match par nom) si le
  suffixe ne matche plus rien — robustesse si le contenu change entre-temps.
- **Pourquoi c'est sûr de changer le format de la chaîne stockée** : vérifié tout le
  pipeline (`js/gameCore.js` → `api/messages/index.php` → `js/notifications.js` →
  `js/challenge-notif.js` → `profile/friends/friends.js`) — la cible n'est **jamais**
  affichée en texte au joueur défié (elle reste un attribut `data-target`/valeur
  programmatique, jamais interpolée dans du HTML visible), donc changer son format
  n'impacte aucun affichage, seulement la résolution interne côté Personae.
- Validé par un round-trip exhaustif (`challengeKey` → `findByChallengeKey`) sur les 151
  entrées de `personaeCharacters.js` (script ponctuel, pas de DB/E2E disponible dans cet
  environnement pour tester le flux défi à deux comptes en conditions réelles — à
  confirmer manuellement si possible avant release). Pas de nouveau test unitaire ajouté :
  `modePersonae.js` n'exporte pas ses handlers internes, même convention que les fixes
  challenge précédents sur ces fichiers.

## 2026-08-13 — fix(data): opus P4AU manquant sur le casting P3 + personas jouables en P4AU

Corrections de contenu sur le casting Persona 3, faites en 2 passes suite à des
clarifications successives de Hamza sur le roster réel de Persona 4 Arena Ultimax (pas de
bug symptomatique signalé côté joueur, juste des tags opus incomplets/imprécis).

- **`database/characters_clean.js`** — ajout de l'opus `P4AU` au casting complet du groupe
  P3 jouable dans ce jeu (personnage, pas persona précise) : Junpei Iori, Yukari Takeba,
  Fuuka Yamagishi, Mitsuru Kirijo, Akihiko Sanada, Aigis, Ken Amada, Koromaru, ainsi qu'à
  Elizabeth (Velvet Room).
- **`personaeMode/database/personaeCharacters.js`** — `P4AU` ajouté aux 7 personas P3
  précisément jouables dans ce jeu (confirmées par Hamza, pas la persona de base du
  personnage à chaque fois) : `Isis` (Yukari), `Trismegistus` (Junpei), `Caesar` (Akihiko),
  `Artemisia` (Mitsuru), `Athena` (Aigis), `Kala-Nemi` (Ken), `Cerberus` (Koromaru — Ken et
  Koromaru partagent un seul slot jouable mais chacun garde ses techniques/persona propres).
  `Thanatos` scindé en 2 entrées distinctes plutôt qu'un seul `user` élargi : l'entrée P3
  historique garde `["Makoto Yuki", "Kotone Shiomi"]` inchangée, une **nouvelle** entrée
  `{ persona: "Thanatos", opus: ["P4AU"], user: ["Elizabeth"] }` couvre P4AU — dans ce jeu
  seule Elizabeth l'utilise (le protagoniste P3 n'y est pas jouable), un `user` fusionné
  aurait accepté Makoto/Kotone comme réponse même quand la cible réelle est la version P4AU.
- **`personaeMode/database/persona.js`** — Elizabeth ajoutée à la liste d'autocomplétion du
  mode Personae. Sans ça, si elle est un jour tirée comme wielder cible pour Thanatos, elle
  serait injouable (jamais proposée à la saisie) — même classe de bug que le garde-fou
  `tests/autocompleteNames.test.js` ajouté en 2.1 (PR #66) pour Classic/Emoji/Silhouette/AOA.
- `api/data/daily_pools.json` régénéré (`npm run pools:build`) suite au nouveau `Thanatos`
  P4AU et aux opus modifiés sur les 7 autres entrées — 151 entrées personae au lieu de 150.

✅ **Angle mort corrigé** (voir entrée juste au-dessus, même jour) : la résolution de
cible de défi entre amis en mode Personae matchait par nom de persona seul, pas par
entrée précise — avec `Thanatos` en double (P3/P4AU) ça aurait résolu le mauvais
personnage côté ami. `challengeKey()`/`findByChallengeKey()` désambiguïsent désormais
les noms dupliqués par opus.

⏳ **Pas d'entrée dans `PersonaDLE_Update.html` pour l'instant** : ce lot fait partie du
contenu 2.1 pas encore livré (branche `feat/v2.1-content`, PR #66, elle-même pas encore
mergée). À regrouper avec le reste du changelog joueur 2.1 (Trinity Souls, badge Gyotre,
titres P4, etc.) au moment du lancement de la version — pas avant, pour ne pas fragmenter
le highlight en plusieurs entrées.

---

## 2026-08-15 — feat(music): lecteur rouge pour Persona 3 FES

Demande de Hamza : P3FES héritait du bleu de Persona 3, alors que sa jaquette est rouge.

### Détails techniques

- `OPUS_THEMES.P3FES` (`musicsMode/modeMusic.js`) passe de `#3b82f6` (bleu P3) à `#d61f26`.
  Trois rouges cohabitent désormais dans le lecteur et doivent rester distinguables :
  P3FES `#d61f26` (chaud, sombre), P5 `#e63946` (vif, plus rose), P5X `#c0193a` (bordeaux).
- P3, P3P et P3R gardent leur bleu — seul FES change, c'est bien sa jaquette qui est rouge,
  pas celle de la série.
- Aucun autre endroit à toucher : `OPUS_THEMES` n'est défini qu'ici, le lecteur du profil
  (`profile/song-player.js`) n'a pas de thème par opus.

## 2026-08-15 — feat(expert): stats Expert, E2E, défis cloisonnés et correctifs UI

Finition du Mode Music Expert : les parties Expert sont enfin lisibles quelque part, le
parcours joueur est couvert de bout en bout, et les défis ne peuvent plus produire d'état
incohérent.

### Correctifs signalés en test manuel

- **Compteur sous « Abandonner » faux** — il affichait `(essais / nombre de vers)`, soit
  « 2 / 18 » alors que l'abandon se débloque à 5. Le compteur mesure la progression vers
  le **déblocage** (3/3 en mode normal), pas le stock d'indices : il affiche désormais
  `(min(essais, seuil) / seuil)`. `maxAttempts()` n'avait plus d'appelant → supprimée.
- **Débordement horizontal sur mobile** — `.audio-wrapper` et `.expert-lyrics-wrapper`
  n'avaient pas `box-sizing: border-box`, donc le padding s'ajoutait à `max-width` : 380px
  de large pour un viewport de 375. Le bug est **pré-existant** (le mode normal débordait
  déjà), corrigé pour les deux. Reste le débordement de `.nav-item` (barre du bas), commun
  aux 6 modes et hors périmètre.
- **Hover du bouton Expert** aligné sur les boutons Submit / Abandonner : réutilise
  l'animation `tiltBounce` de `css/global.css` au lieu d'une variante locale, avec
  `:focus-visible` et une sortie propre en `prefers-reduced-motion`.

### Défis — cloisonnés plutôt qu'à moitié adaptés

Un défi porte un barème (nombre d'essais) et une cible. Joué en Expert, le barème n'est plus
comparable (5–30 essais contre 3), et la cible peut être un instrumental — sans aucune parole
à révéler, donc un panneau vide et un jeu injouable.

- Ouvrir `musics.html?expert=1` avec un défi actif **redirige vers le mode normal**.
- L'Expert **n'émet pas** de défi (bouton masqué) : le destinataire le jouerait en normal
  avec l'audio, pour un score incomparable.
- `showCommunityStats()` sauté en Expert, comme dans `savePendingSession()` : la cible y est
  différente et `community-stats.php` ne compte que le non-Expert → 0 % à vie.
- La feature complète (colonne `challenge_is_expert`, URL d'acceptation, barème dédié) est
  spécifiée dans `ROADMAP.md`, à coder sur la branche du déblocage.

### Stats Expert visibles

- `personadle_expert_stats_by_mode()` (`api/lib/game_session.php`) agrège **directement
  depuis `game_sessions`** : parties, victoires, abandons, meilleure victoire (moins
  d'essais), temps total, dernière date, et streak recalculée depuis l'historique.
  `user_stats` reste hors du coup, conformément à la décision du lot précédent.
  `personadle_recompute_mode_streak()` prend un paramètre `$isExpert` pour ça.
- `api/user/stats.php` expose `stats.expert_by_mode` (tableau vide si aucune partie Expert).
  Aucun nouveau fichier, donc aucune `RewriteRule` à ajouter.
- `profile/profile-page.js` — `renderExpertStats()` remplit `#expertStatsContainer` depuis
  l'API et non depuis `profile.stats` (l'Expert n'y écrit rien). Silencieux hors ligne ou
  déconnecté : c'est un bonus d'affichage, il ne doit jamais casser la page profil.
- 6 tests PHPUnit : coexistence normal+Expert le même jour, `user_stats` intouché mais
  streak globale incrémentée, **une victoire Expert n'upgrade pas l'abandon normal du jour**,
  doublon Expert toujours rejeté, agrégation correcte, tableau vide sans partie Expert.

### E2E — `tests-e2e/expert-music.spec.js`, 9 tests

Le parcours complet dans un vrai navigateur : bascule normal ⇄ Expert et retour, parties
indépendantes le même jour (clés localStorage distinctes), un vers au départ puis un de plus
par erreur avec les précédents conservés, compteur de vers, **titre jamais visible avant la
fin**, déblocage de l'abandon à 5 exactement, abandon et victoire révélant tout sans masque
avec `is_expert: true` dans la session en attente, et non-débordement du panneau sur 375px.

Deux assertions ont dû être dérivées du tirage plutôt qu'écrites en dur (nombre de vers) :
la cible change chaque jour et par joueur, un total figé aurait rendu le test rouge un jour
sur deux.

## 2026-08-15 — feat(expert): Mode Music Expert jouable

Le mode est enfin jouable : bouton sur la page Music, paroles révélées vers par vers,
règles dédiées, i18n dans les 6 langues.

### Détails techniques

- **Un flag dans `modeMusic.js`, pas une page séparée.** Filtres opus, autocomplétion,
  défis, reset quotidien, musique de victoire, dark mode : tout est partagé. Dupliquer
  la page aurait signifié maintenir 1600 lignes en double, avec la garantie qu'un fix ne
  parte un jour que d'un seul côté.
- **L'état vit dans l'URL** (`musics.html?expert=1`), pas en localStorage : le mode reste
  partageable et bookmarkable, un rechargement ne perd rien, et une même URL ne peut pas
  afficher deux jeux différents selon un état caché. Le bouton est donc un `<a>`, pas un
  `<button>` — il suit l'historique du navigateur et s'ouvre dans un onglet.
- `KEY_PREFIX` / `STATS_KEY` séparent intégralement les clés localStorage des deux parties
  (`musicExpertTarget`, `statsLogged_MusicExpert_<date>`…). Les filtres opus, eux, restent
  **partagés** : ce sont les préférences du joueur, pas un état de partie.
- **Essais = nombre de vers** (5 à 30 selon la chanson), `maxAttempts()` calculé sur la
  cible. « Abandonner » se débloque après 5 essais, seuil fixe (décision 2026-08-15).
- `renderLyrics()` — un vers au départ, +1 par erreur, les précédents restent affichés et
  la liste défile sur le dernier (`scroll-behavior: smooth`, conteneur borné à 46vh pour
  que le champ de réponse reste visible). Le titre est masqué par `maskTerms()` **à
  l'affichage** ; en fin de partie `renderLyrics(true)` réaffiche tout en clair, les vers
  jamais gagnés en retrait (`.unheard`).
- **Aucune écriture dans les stats client en Expert** : `updateProfileStats()` et
  `checkUnlocksAfterGame()` sont sautés. Ils alimentent le mode Music normal, que le
  serveur exclut déjà (`user_stats` intouché) — les appeler ici ferait diverger le profil
  local du backend au prochain `pullProfileFromCloud()`.
- Règles : deux blocs distincts (`#rulesNormal` / `#rulesExpert`) plutôt que des phrases
  conditionnelles — la mécanique n'a rien à voir d'un mode à l'autre.
- CSS : habillage rouge constant (le mode normal garde son thème par opus), angles coupés
  façon P5, halo de page en `background-attachment: fixed` pour que le repère visuel
  survive au scroll. Responsive sous 480px.
- i18n : 11 clés × 6 langues (`ui.expert_*`, `modes.music.expert_*`). Les paroles
  elles-mêmes ne sont pas traduites (CLAUDE.md §5).

### Garde-fou le plus important

`tests/expertContent.test.js` compare le pool client (`songs.filter(s => expertLyrics[...])`)
au pool serveur `daily_pools.json` — **contenu et ordre**. L'index du tirage étant
`hash % pool.length`, la moindre divergence ferait viser deux cibles différentes au client
et au serveur, et `api/sessions.php` loguerait alors chaque partie Expert en `anti_cheat`.
Deux autres tests vérifient que la cible Expert a toujours des paroles et que les deux
modes ne tirent pas la même chanson jour après jour.

### Angles morts connus

- Le bouton Expert n'est pas encore conditionné à un déblocage (prévu ROADMAP v2.1) : il
  est visible et cliquable par tout le monde.
- Aucun écran ne montre de stats Expert — les parties sont en base (`game_sessions`), rien
  ne les lit encore.
- Pas de test E2E sur la boucle complète : la mécanique est vérifiée unitairement (pools,
  masquage), le parcours joueur reste à valider à la main.

## 2026-08-15 — feat(expert): couche serveur du Mode Expert

Câblage backend de `is_expert` : tirage quotidien dédié, enregistrement de session, et
cloisonnement de toutes les lectures qui agrègent `game_sessions`. Le front n'existe
toujours pas — ce lot rend l'Expert *enregistrable* correctement.

### Détails techniques

- **`api/lib/daily_target.php`** — nouveau cas `music_expert` : pool des 73 chansons à
  paroles et **clé de hash distincte** (`'MusicExpert'`). Sans clé distincte, les deux
  modes tireraient la même chanson et jouer le normal (où l'audio est donné) offrirait
  l'Expert du jour. Le client doit passer exactement la même chaîne à `getDailyTarget()`,
  sinon chaque partie Expert est loguée en `anti_cheat`.
- **`api/sessions.php`** — accepte `is_expert`, refusé sur un autre mode que `music`
  (rien ne saurait relire ces lignes). Plafond d'essais porté à 40 en Expert : une
  chanson de 30 vers autorise 30 essais, contre 20 max dans les modes normaux. Le test
  « a-t-il déjà joué aujourd'hui ? » et la route du pool anti-triche sont scopés sur
  `is_expert`.
- **`api/lib/game_session.php`** :
  - `personadle_record_game_session(..., bool $isExpert)` — INSERT avec `is_expert`.
  - `personadle_upgrade_giveup_to_win()` scopé sur `is_expert`. **C'était le vrai piège** :
    sans ce scope, une victoire en Expert retrouvait l'abandon du mode NORMAL du même jour
    et l'upgradait en victoire — le joueur gagnait une partie qu'il avait abandonnée.
  - `personadle_recompute_mode_streak()` filtre `is_expert = 0` : une victoire Expert ne
    prolonge pas la streak du mode normal.
  - `personadle_bump_global_streak()` extrait du bloc 2b, appelé aussi en Expert : une
    journée où le joueur n'a fait que de l'Expert reste une journée jouée, l'exclure
    casserait sa streak globale alors qu'il a joué.
- **`user_stats` volontairement non touché en Expert.** Cette table d'agrégat est lue par
  15 fichiers API (profil, cloud-sync, classement, compare, conditions de badges) ; y
  ajouter une dimension `is_expert` demanderait de tous les auditer pour un affichage qui
  n'existe pas encore. Les parties Expert vivent dans `game_sessions`, où le futur écran
  Expert ira les lire — ou qui recevra sa propre migration à ce moment-là.
  `ponytail:` agrégation différée, marqué dans le docbloc de la fonction.
- **Lectures agrégées cloisonnées** (`AND is_expert = 0`) : `api/cron/leaderboard.php`,
  `api/leaderboard/index.php` (requête principale + comptage de pagination) et
  `api/community-stats.php`. Sans ça les parties Expert gonflaient le classement du mode
  normal, et le « X % des joueurs ont trouvé la cible du jour » mélangeait deux cibles
  différentes.
- **`js/gameCore.js`** — `buildGameSession({ isExpert })` ajoute `is_expert` au payload.
  Le `mode` reste `music` : un mode dédié casserait `normalizeModeKey()` et le vocabulaire
  des 6 modes partagé par le profil, les défis et le classement. `savePendingSession()`
  saute `showCommunityStats()` en Expert — la cible y est différente et
  `community-stats.php` ne compte que le non-Expert, le compteur afficherait 0 % à vie.
- Tests : 5 PHPUnit dans `DailyTargetTest` (sous-ensemble strict, ordre source préservé,
  tirages décorrélés sur 28 jours, cible toujours dans le pool, mode inconnu → null) et
  2 Vitest sur `buildGameSession`.

### Angle mort connu

Le front n'envoie encore rien : aucune partie Expert n'existe. La chaîne complète
(client → `sessions.php` → BDD) ne sera vérifiée de bout en bout qu'avec l'UI.

## 2026-08-15 — feat(music): contrôle de volume dans le lecteur

Demande de Hamza : pouvoir régler le son du lecteur, avec un habillage cohérent avec le reste
du player (couleur par opus).

### Détails techniques

- `musicsMode/musics.html` — bouton mute + piste de volume ajoutés dans `.p5-player-controls`.
  La piste réutilise **les classes existantes** `.p5-progress` / `.p5-progress-fill` : le
  dégradé vient des mêmes variables `--player-*` que la timeline, donc `setPlayerTheme()`
  colore le volume en même temps que le reste, sans une seule règle de thème en plus. Un
  composant séparé aurait signifié dupliquer les 20 propriétés custom par opus.
- `musicsMode/modeMusic.js` — `initVolumeControl(audio = audioPlayer)`, appelée par
  `initCustomPlayer()`. Le paramètre existe pour les tests : jsdom n'exécute pas
  `DOMContentLoaded` à l'import, donc la référence interne au `<audio>` n'est jamais assignée.
- **Le niveau est persisté** (`musicVolume`) — le joueur revient chaque jour, remettre le son
  à fond à chaque visite serait une agression quotidienne. Valeur relue avec garde-fou :
  `NaN`/hors [0,1] retombe sur 1 plutôt que de couper le son sur un localStorage corrompu.
- **Le mute mémorise le niveau au lieu de l'écraser** : couper puis rétablir rend le réglage
  d'avant, et non 100 %. Muter alors qu'on est déjà à 0 remonte à fond (sinon le bouton
  paraîtrait cassé).
- Pointer events plutôt que mouse + touch : un seul jeu de handlers couvre souris et tactile,
  et `setPointerCapture` garde le suivi quand le doigt sort de la piste. Appels optionnels
  (`?.`) — jsdom ne les implémente pas.
- Accessibilité : `role="slider"` + `aria-valuenow` tenu à jour, flèches clavier par pas de
  5 %, curseur du volume visible en permanence (à 0 %, une piste sans poignée paraît morte).
- Responsive : sous 480px le volume passe sous la timeline en pleine largeur
  (`.p5-player-controls { flex-wrap: wrap }`) — la ligne à trois éléments devenait illisible.
- `tests/musicVolume.test.js` — 11 tests : persistance, valeurs corrompues, bornage hors
  piste, aller-retour du mute, icône suivant le niveau, clavier, absence du lecteur dans le DOM.

Pas d'entrée joueur dans `PersonaDLE_Update.html` pour l'instant — à ajouter au prochain lot
visible, le contrôle de volume étant typiquement le genre de détail que le joueur remarque.

## 2026-08-15 — feat(expert): contenu des modes Expert Music & Personae (données uniquement)

Premier lot de contenu pour le Mode Expert (v2.1) : les paroles des 73 chansons à texte, et les
fiches lore de 39 personae — Persona 2 (IS + EP) puis Persona 3 — en EN et FR. **Aucune UI de
jeu dans ce lot** : uniquement les données, l'utilitaire de masquage partagé et leurs garde-fous.

Source du contenu : `expert_mode_content.md` à la racine, rempli à la main par Hamza. Ce fichier
est **curé**, pas une copie des datasets : les variantes de personae (`* Picaro`,
`Orpheus ( Male/Female )`…) sont fusionnées en une entrée, et 17 musiques instrumentales n'y
figurent pas puisqu'elles n'ont pas de paroles à révéler. Ne jamais le régénérer en masse.

### Détails techniques

- **`js/gameCore.js` — `maskTerms(terms, text, token)`** : masquage partagé par les deux modes
  Expert. Insensible à la casse, tolère la ponctuation interne (« Dance! » masque « dance ») et
  les espaces multiples, ne coupe jamais au milieu d'un mot (« Mask » ne touche pas « Masked »),
  ignore les termes < 4 caractères (trop fréquents pour être masqués sans mutiler le texte).
- **Décision d'archi — masquer à l'affichage, jamais dans les données.** Les paroles et les
  fiches sont stockées **brutes**, avec le nom/titre en clair. La censure est appliquée au rendu.
  Conséquence voulue : la révélation de fin de partie (victoire **ou** abandon) consiste à
  ré-afficher le texte brut, sans seconde copie du contenu à maintenir synchronisée.
- **`musicsMode/database/expert_lyrics.js`** (généré) : 73 chansons, 1078 vers. Clé = `titre`
  exact de `songs.js`, valeur = les vers dans l'ordre, **un par palier de révélation** (le mode
  Music Expert révèle ligne par ligne et cumulativement, contrairement à la règle « une seule
  tentative » des autres modes Expert — arbitré avec Hamza le 2026-08-15). Généré par
  `scripts/export_expert_lyrics.js` (`npm run lyrics:build`), jamais édité à la main.
- **31 chansons sur 73 citent leur propre titre dans leurs paroles** (« Burn my dread »,
  « Mass Destruction », « Dream of Butterfly, or is life a dream? ») — réponse offerte sans
  masquage. Un test parcourt les 1078 vers et échoue si un titre fuite après masquage.
- **`personaeMode/database/expert_lore/{en,fr}.json`** : 39 fiches (17 P2IS/P2EP + 22 P3/P3FES ; `Hermes` est commun aux deux lots),
  ~90 mots chacune, réécrites depuis les textes sources (les longs taillés — Eros passait de 340
  à 95 mots ; les trop courts complétés — Helios de 30 à 95). Un fichier par langue, chargeable à
  la demande — délibérément **pas** dans `lang/*.json`, qui est chargé sur toutes les pages : à
  terme 139 personae × 6 langues y pèseraient pour rien.
- **Variantes cosmétiques hors contenu Expert** : `Orpheus Picaro`, `Thanatos Picaro`,
  `Messiah Picaro`, `Athena Picaros`, `Orpheus Telos`, `Orpheus ( Female )` n'ont pas de fiche.
  Même mythe, donc fiche identique à l'entrée de base : les inclure rendrait la réponse
  ambiguë (rien dans un texte ne distingue « Orpheus » de « Orpheus Picaro »). La famille
  Orpheus est portée par `Orpheus ( Male )` — **choix à confirmer par Hamza**, c'est la seule
  entrée du dataset qui pouvait porter le texte, le `.md` ne connaissant qu'« Orpheus ».
- `Hermes` et `Prometheus` existent chacun **deux fois** dans le dataset (P2IS/P3 et P2EP/P5).
  Les fiches sont volontairement keyées par le nom nu, pas par la clé désambiguïsée
  `Nom::OPUS` de `challengeKey()` : le mythe est le même des deux côtés et le joueur tape le
  même nom, donc une fiche unique partagée est le comportement correct.
- Le tableau `mask` est **propre à chaque langue**, pas dupliqué par erreur : le texte FR emploie
  souvent une autre forme du nom (« Maïa » vs « Maia », « Astéria » vs « Asteria »), qui doit
  être masquée elle aussi. `maskTerms()` ne normalise pas les diacritiques — les variantes
  accentuées doivent être listées explicitement.
- **`maskTerms()` accepte les noms de 2 caractères** (seuls les termes d'une lettre sont
  ignorés) : `Io`, la persona initiale de Yukari, est un nom de 2 lettres — avec l'ancien seuil
  à 4, sa fiche donnait la réponse dès la première ligne. La frontière de mot suffit à éviter
  les faux positifs (`Io` ne touche pas « Ionian »).
- **`tests/expertContent.test.js`** — 27 tests : cohérence des clés avec `songs.js` /
  `personaeCharacters.js`, parité EN/FR, couverture complète du roster P2, longueur jouable
  (50–140 mots), absence de masque pré-appliqué dans les données, et les deux garde-fous de
  fuite (aucun titre ni nom de persona ne survit au masquage). Les garde-fous raisonnent en
  **frontière de mot**, pas en sous-chaîne : « Christ » dans « Christianity » n'est pas une
  fuite, et `maskTerms()` ne le masque pas non plus — une assertion `toContain()` naïve
  échouait à tort sur la fiche Messiah.

### Angles morts connus

- Le tirage quotidien Expert n'existe pas encore : `scripts/export-daily-pools.js` ignore ces
  deux fichiers. Tant qu'il n'est pas branché, rien ne garantit côté serveur que la cible du
  jour en Expert soit bien une chanson à paroles ou une persona dotée d'une fiche.
- Un titre de chanson coupé sur deux vers n'est pas masqué (`maskTerms()` reçoit un vers à la
  fois). Aucun cas dans les 73 chansons actuelles, le test le vérifie vers par vers.
- Reste 105 entrées du dataset sans fiche (P4 → P5X, plus Trinity Souls) ; les 39 fiches
  couvrent 41 entrées, `Hermes` et `Prometheus` étant partagées par deux entrées chacune et 4 langues sans traduction
  (ES/DE/IT/PT) : l'anglais et le français d'abord, sur deux jeux, pour valider le format et le
  ton avant d'engager ×6 le coût de traduction.

## 2026-07-31 — fix(challenge): filtres opus écrasés à "tout désélectionné" après un défi

Signalement joueur : après avoir joué un défi (surtout remarqué en mode Music), plus aucun
filtre opus n'était actif — obligé de tout recocher à la main à chaque fois.

### Détails techniques

- **Root cause** (`profile/friends/friends.js` et `js/challenge-notif.js`, les deux points
  d'acceptation d'un défi) : la sauvegarde des filtres avant d'appliquer ceux de l'expéditeur
  utilisait `localStorage.getItem(filterKey) ?? "[]"`. Si le joueur n'avait **jamais** touché
  le menu de filtres pour ce mode, la clé localStorage n'existe pas encore (son état réel est
  "tout actif", le défaut calculé par `initFilterMenu()` — `js/filterMenu.js` — mais jamais
  écrit tant qu'on n'interagit pas avec le menu). `localStorage.getItem()` renvoie alors `null`,
  et le `?? "[]"` le remplaçait par la chaîne `"[]"` — qui n'est **pas** "pas de sauvegarde",
  c'est un état volontaire "tout désélectionné" (`filterMenu.js` : `if (saved.length === 0)
  return []; // preserve "all deselected" state`). À la fin du défi,
  `checkChallengeCompletion()` (`js/challenge-result.js`) restaure fidèlement ce `"[]"` bidon
  dans le localStorage réel du joueur — écrasant son "tout actif" implicite par un "tout
  désélectionné" explicite qui n'a jamais existé.
- **Fix** : suppression du fallback `?? "[]"` dans les deux points d'acceptation — `null` reste
  `null` si la clé n'existe pas. La restauration dans `checkChallengeCompletion()` skip déjà
  ce cas (`challenge.originalFilters !== null`), donc l'absence de clé reste absente après le
  défi, et `initFilterMenu()` retombe naturellement sur "tout actif" au prochain chargement —
  exactement le comportement attendu pour un joueur qui n'a jamais personnalisé ses filtres.
  Aucune régression sur le cas où le joueur avait explicitement tout décoché avant le défi
  (`localStorage.getItem()` renvoie alors la vraie chaîne `"[]"`, comportement inchangé).
- Pas de nouveau test unitaire ajouté — même convention que le fix 404/cible de défi du
  2026-07-29 sur ces mêmes fichiers (handlers DOM non exportés, gros fichiers non testés
  unitairement dans ce projet).

Pas d'entrée dans `PersonaDLE_Update.html` — correctif de fiabilité interne, pas de nouvelle
feature visible par le joueur.

## 2026-07-29 — fix(challenge): 404 à l'acceptation depuis la page Amis + défis fantômes bloqués en "accepted"

Signalement joueur : accepter un défi depuis la liste de notifications de la page Amis
(après avoir raté/fermé l'animation popup) menait à une 404. Audit du même code path a
remonté deux bugs supplémentaires liés, corrigés dans le même lot.

### Détails techniques

- **404** (`profile/friends/friends.js`, handler `js-accept-challenge`) : `modePageMap`
  utilisait des chemins relatifs à 1 niveau (`../classiqueMode/...`) alors que
  `friends.html` est servi depuis `profile/friends/` (2 niveaux sous la racine — tout le
  reste du fichier utilise déjà `../../js/`, `../../css/`, `../../img/`). Résolvait vers
  `profile/classiqueMode/...` (inexistant) au lieu de `classiqueMode/...` à la racine.
  Corrigé en `../../`.
- **Cible de défi perdue silencieusement** : contrairement à la popup d'animation
  (`js/challenge-notif.js`, qui pose `activeChallenge.target`), le bouton "Accepter" de la
  liste de messages ne lisait/posait jamais `challenge_target` — accepter un défi depuis
  cette liste retombait donc sur la cible du jour au lieu de la cible dédiée
  (`getActiveChallengeTarget()`/`isChallengePlay()`, décision produit 2026-07-17). Ajout de
  `data-target` sur le bouton (déjà exposé par l'API, `api/messages/index.php`) et propagé
  dans `activeChallenge.target`.
- **Défis bloqués en `accepted` pour toujours** (root cause plus large) : `activeChallenge`
  est une case localStorage **unique**, pas une file. Accepter un 2ᵉ défi (popup ou liste)
  avant d'avoir fini le 1ᵉʳ écrasait silencieusement ce dernier — son message ne se
  résolvait alors jamais en `beaten`/`expired` côté serveur, restant `accepted` à vie,
  invisible pour "Vider les résolus" (`clearReadMessages()`, qui ne supprime que
  `read`/`beaten`/`expired`, comportement voulu). Nouveau `getPendingActiveChallenge()`
  (`js/gameCore.js`, testé dans `tests/gameCore.test.js`) : renvoie le défi en attente s'il
  date d'aujourd'hui (heure Paris, même logique que `initChallengeBanner()`), sinon `null`
  (périmé → pas de blocage indéfini). Câblé en garde-fou dans les deux points
  d'acceptation (`js/challenge-notif.js`, `profile/friends/friends.js`) : si un autre défi
  est déjà en cours, toast `challenge.already_active` au lieu d'écraser.
- **UX poubelle** : "Vider les résolus" reste inchangé dans son périmètre (unread protégé,
  décision produit — supprimer une invitation jamais vue l'effacerait aussi chez
  l'expéditeur, `DELETE` partagé sender/receiver côté `api/messages/index.php`, pas un
  masquage par utilisateur) mais affiche désormais un toast quand des défis `accepted` sont
  gardés, pour expliquer pourquoi la liste ne se vide pas entièrement.
- `js/challenge-notif.js` : au passage, `_t()` reproduisait le piège CLAUDE.md §5
  (`t(key) ?? fallback` — ne se déclenche jamais, `t()` retourne la clé brute si absente).
  Corrigé avec le pattern correct.
- Nouvelles clés i18n `challenge.already_active` et `friends.msg_clear_kept_active` (EN
  source de vérité, propagées fr/es/de/it/pt).

Pas d'entrée dans `PersonaDLE_Update.html` — correctifs de fiabilité internes, pas de
nouvelle feature visible par le joueur au-delà du toast explicatif.

## 2026-07-28 — fix(titles): adachi_boring_isnt_it (giveups_total) ne se débloquait jamais

Audit complet demandé côté badges/wallpapers (vérifier qu'on ne garde pas d'autres bugs du
genre Naoya) — les 60 badges et les 7 wallpapers sont tous corrects (chaque champ lu par un
`check()` est bien écrit quelque part), mais l'audit a fait remonter un 4e cas côté titres —
cette fois dans la glue code plutôt que dans `isTitleConditionMet()` elle-même :

`profile/titles-ui.js::checkAndUnlockTitles()` calculait `giveups` via
`Object.values(stats.modeGiveups || {}).reduce((a, b) => a + b, 0)` — mais
`js/cloud-sync.js` ne peuple jamais `stats.modeGiveups` (seulement `modeCount`/`modeWins`
par mode, pas de détail des abandons). `giveups` valait donc toujours 0, quel que soit le
nombre réel d'abandons, bloquant structurellement `adachi_boring_isnt_it` ("Boring, Isn't
It?", `giveups_total` >= 50). Le test existant sur `isTitleConditionMet()` ne pouvait pas
l'attraper : il passe `giveups` directement dans le ctx, sans jamais exercer le calcul cassé
en amont dans `checkAndUnlockTitles()`.

- `profile/titles-ui.js` — lit maintenant `stats.giveups` (le total, déjà correctement
  peuplé) au lieu de sommer un `modeGiveups` fantôme — même champ que la badge
  `ace_defective` utilise déjà pour la même stat.
- Test de régression ajouté à un niveau différent des précédents (`checkTitlesAfterGame()`,
  pas `isTitleConditionMet()` directement) pour couvrir la glue code, pas seulement la
  fonction pure.

### Audit badges/wallpapers — résultat

- **60 badges** (`badgesData.js`) : tous les champs `profile.xxx`/`stats.xxx` référencés par
  un `check()` vérifiés écrits quelque part dans le code. Seule anomalie cosmétique (pas un
  bug fonctionnel) : le badge `sport` vérifie `profile.eventBadges?.sport` (jamais écrit),
  mais son vrai déblocage passe par `condition_type = 'manual'` côté serveur (redeem du code
  événementiel "SPORT", `sql/migrations/011_event_codes_moderation.sql`) — `check()` n'est
  jamais consulté pour ce badge, le mismatch est invisible en pratique. Fenêtre de l'event
  (avril-mai 2025) de toute façon expirée, non traité.
- **7 wallpapers** (`wallpapers-ui.js`) : tous les champs vérifiés écrits (`modeCount`,
  `avatar`, `p4ConsecutiveDays`, `challengeAcceptedByFriend`, `bestSocialLinkRank`) — rien à
  corriger.

---

## 2026-07-28 — feat(titles): suivi glissant 7 jours pour akechi_pancakes (weekly_clean_modes)

Suite de l'audit post-Naoya : `akechi_pancakes` ("Pancakes?") vérifiait
`profile.weeklyCleanWinModes`, jamais écrit nulle part — structurellement bloqué comme
Naoya/Maya/github_contributor, mais contrairement à eux il n'existait aucune donnée locale
pour le calculer (pas de suivi "par jour, par mode" côté client). Implémenté maintenant.

### Décision : miroir de l'approximation serveur, pas du texte affiché

Le texte du titre annonce *"Win all modes in one week without giving up"*, mais la vraie
requête serveur (`api/lib/condition_check.php::weekly_clean_modes`) compte les modes
**distincts** joués sur 7 jours, peu importe le résultat (win ou give-up) — son propre
docblock le documente comme une approximation. Un check client plus strict que le serveur
(exiger des victoires sans give-up) bloquerait des déblocages que le serveur accorderait
pourtant — recréerait une version plus douce du même bug. Le client reproduit donc
exactement ce que le serveur vérifie réellement, et le texte affiché a été corrigé pour ne
plus promettre autre chose (`profile/titles-ui.js::titleConditionText()`).

### Implémentation

- `profile/badges/badgesManager.js` — nouvelle fonction `trackWeeklyModePlay(profile,
  saveProfile, mode)` : journal `profile.weeklyModeLog` (`{ "2026-07-28": ["classic", …] }`),
  purge des entrées de plus de 7 jours à chaque appel, recalcule
  `profile.weeklyCleanWinModes` = nombre de modes distincts restants dans la fenêtre. Mode
  normalisé via `normalizeModeKey()` (gameCore.js) pour absorber toutes les graphies
  ("All Out Attack", "Music", "classic"…).
- `js/unlock-notify.js::checkUnlocksAfterGame(mode)` — nouveau paramètre optionnel (compat
  ascendante : omis, le suivi est simplement sauté). Centralise l'appel à
  `trackWeeklyModePlay()` ici plutôt que de dupliquer l'import + l'appel dans les 6 fichiers
  de mode — seul le mode joué doit leur être passé.
- 6 fichiers de mode mis à jour pour passer leur mode à `checkUnlocksAfterGame(...)` : le
  point d'appel étant déjà partagé entre win ET give-up dans emoji/silhouette/personae/music
  (fonction unique avec un paramètre `force`/`result`), un seul edit par fichier suffit pour
  ces 4-là ; `classiqueMode.js` et `allOutAttackMode.js` ont des handlers win/give-up séparés
  → 2 points d'appel modifiés chacun (le 3e appel redondant de `allOutAttackMode.js`, déjà
  documenté comme tel dans le code, laissé sans argument — idempotent, sans risque).
- Tests : `tests/badgesManager.test.js` (7 cas sur `trackWeeklyModePlay` — normalisation,
  anti-doublon même jour, agrégation sur plusieurs jours, purge après 7 jours, give-up compté
  comme un win, no-op sans mode), `tests/unlockNotify.test.js` (mode bien relayé,
  rétrocompatibilité sans mode), `tests/titlesUi.test.js` (régression `isTitleConditionMet`).

### `trackUniqueDay()` manquant dans All-Out Attack / Personae — corrigé dans la foulée

`trackUniqueDay()` (le suivi équivalent pour `unique_days`/`uniqueDaysPlayed`, titre
`makoto_yuki_memento_mori` + badge 50-jours) n'était appelé **que** depuis
classiqueMode/emojiMode/silhouetteMode/musicsMode — **jamais** depuis
`allOutAttackMode.js` ni `personaeMode.js`. Un joueur qui ne joue qu'à ces deux modes ne
voyait jamais son `uniqueDaysPlayed` progresser ces jours-là. Repéré par comparaison avec
les points d'appel de `checkUnlocksAfterGame()` (qui, eux, couvrent bien les 6 modes).

- `allOutAttackMode.js` — import ajouté + appel dans les 2 handlers (win ET give-up séparés,
  comme pour `checkUnlocksAfterGame()` plus haut).
- `personaeMode.js` — import ajouté + appel dans le handler partagé win/give-up.
- **Décision de placement** : plutôt que de reproduire le `if (!force)` (win seulement) déjà
  présent dans classiqueMode/emojiMode/silhouetteMode, l'appel est inconditionnel (win ET
  give-up), comme le fait déjà `musicsMode/modeMusic.js` — et comme le serveur le vérifie
  réellement (`unique_days` = `COUNT(DISTINCT played_date) FROM game_sessions`, sans filtre
  sur `result`). Reproduire le filtre "win only" des 3 autres modes aurait propagé un bug
  supplémentaire au lieu de le corriger.
- **Angle mort restant, pas corrigé ici** : classiqueMode/emojiMode/silhouetteMode ne
  comptent donc toujours un jour unique que s'il contient au moins une victoire — un joueur
  qui n'enchaîne que des give-up sur ces 3 modes précis ne progresse pas son
  `uniqueDaysPlayed` ces jours-là, contrairement à musicsMode/allOutAttackMode/personaeMode
  (désormais cohérents entre eux). Même classe de bug une 3e fois, mais qui touche cette
  fois du code déjà "fonctionnel" dans 3 fichiers différents plutôt qu'un appel totalement
  absent — traitement séparé si voulu.

---

## 2026-07-28 — fix(badges): "Phantom Coder" (github_contributor) ne se débloquait jamais

Audit systématique post-mortem du bug Naoya (voir entrée du jour ci-dessous) : tous les
champs `profile.xxx` lus par les conditions de titres/badges/wallpapers, croisés avec les
endroits où ils sont réellement écrits dans le code. Un cas identique trouvé côté badges :

- `profile/badges/badgesData.js` — le badge secret `github_contributor` ("Phantom Coder")
  vérifie `profile?.visitedGithub === true`, mais ce flag n'était écrit **nulle part** —
  débloquage structurellement impossible, pour n'importe quel joueur.
- `index.html` — lien GitHub (`#githubLink`) : ajout d'un `onclick` inline qui pose
  `profile.visitedGithub = true` en localStorage, exactement le même pattern déjà utilisé
  par le lien "Suggestions & Bug Report" juste en dessous (`reportSubmitted`).

Même audit : un autre cas trouvé côté titres (`akechi_pancakes` / `weekly_clean_modes`,
`profile.weeklyCleanWinModes` jamais écrit non plus) mais **pas corrigé ici** — contrairement
à `visitedGithub`, il n'existe aucun suivi local "par jour, par mode" pour reproduire
l'approximation serveur (`api/lib/condition_check.php::weekly_clean_modes`, qui compte les
modes distincts joués sur 7 jours peu importe le résultat, alors que le texte du titre
annonce "gagner tous les modes sans abandonner"). Nécessite soit un vrai suivi glissant
7 jours côté client, soit de repenser `checkAndUnlockTitles()` pour laisser le serveur
authoritatif sur ce titre sans marquer un faux-positif local optimiste. Laissé en l'état en
attendant une décision produit — pas pire qu'avant, toujours bloqué comme il l'était déjà.

---

## 2026-07-28 — fix: lot de bugs remontés (musique, titres, stats, remember-me)

Cinq correctifs indépendants issus d'un signalement groupé du lead dev.

### Musique — typo titre, opus Eriko, tri autocomplete

- `musicsMode/database/songs.js` + `musicsMode/database/musicTitles.js` — "Blood Destiny" →
  "Bloody Destiny" (coquille dans le titre de la chanson, `api/data/daily_pools.json`
  régénéré via `npm run pools:build`)
- `database/characters_clean.js` — Eriko Kirishima apparaît aussi dans P2IS (Innocent Sin),
  pas seulement P1/P2EP
- `musicsMode/modeMusic.js` — le dropdown d'autocomplete du mode musique n'appliquait aucun
  tri (contrairement aux 4 autres modes qui trient préfixe > alphabétique via
  `js/autocomplete.js` et leurs propres `initializeAutocomplete()`) : les titres tapés à la
  fin de `songs.js` sortaient dans un ordre non alphabétique. Ajout du même tri
  préfixe-puis-`localeCompare` sur `matches` pour un comportement uniforme partout.

### Titres — naoya_first_awakening/maya_always_be_positive jamais débloqués, course d'équipement

- `profile/titles-ui.js::isTitleConditionMet()` lisait `profile.classicP1Wins` /
  `profile.emojiP2Wins` pour les `condition_type` `classic_p1_wins`/`emoji_p2_wins` — ces
  champs n'ont **jamais existé** côté client (aucune écriture nulle part dans le code), donc
  la condition était toujours `0 >= v` → `false`, quel que soit le nombre de victoires.
  `api/lib/condition_check.php` traite déjà ces deux `condition_type` comme des alias de
  `mode_wins` pour classic/emoji côté serveur — le client lit maintenant
  `stats.modeWins.Classic`/`stats.modeWins.Emoji`, comme le fait déjà le cas `mode_wins`
  existant.
- Cherry-pick de `fedc95e` (déjà sur `main`, jamais mergé sur `develop`) : image du toast
  d'unlock cassée sur les pages de mode (chemin relatif au lieu d'absolu).
- `_renderTitlesGrid()` : cliquer "équiper" dans la fenêtre entre le rendu immédiat de la
  modale (depuis localStorage, avant auth) et la résolution des vrais IDs par
  `initTitlesSection()` (après `/api/titles`) envoyait `equipped_title_id: null` au serveur.
  `api/user/index.php` accepte silencieusement un ID `null` (c'est le comportement voulu pour
  le *déséquipement*), donc ça déséquipait le titre déjà équipé sans erreur visible. Le clic
  est maintenant ignoré tant que l'ID réel n'est pas chargé.
- Tests de régression ajoutés (`tests/titlesUi.test.js`).

### Stats de profil faussées après migration d'un compte

- `api/user/migrate.php` — la migration des sessions `localStorage` (jouées en anonyme) vers
  un compte cloud (déclenchée à l'inscription/première connexion,
  `js/auth.js::migrateLocalStorageToCloud()`) faisait un `UPDATE user_stats SET games =
  games + 1, ...` sans garantir d'abord que la ligne `(user_id, mode)` existe. Pour un compte
  tout neuf (cas courant), l'`UPDATE` matchait 0 ligne — PDO ne lève rien pour un `UPDATE` à 0
  ligne affectée, donc la transaction committait quand même et l'endpoint répondait succès
  (`migrated_sessions: N`) alors que `user_stats` restait vide pour ce mode. `game_sessions`
  recevait bien les lignes, mais victoires/temps de jeu/abandons/mode préféré (tous dérivés de
  `user_stats` par `cloud-sync.js`) restaient à zéro/faux. Root cause unique pour les 4
  symptômes signalés. Ajout du même garde-fou `INSERT IGNORE INTO user_stats (user_id, mode)`
  que `api/lib/game_session.php::personadle_record_session()` utilise déjà, avant chaque
  lecture/mise à jour dans la boucle de migration.

### "Se souvenir de moi" ne survivait pas au changement apex/www

- Le mécanisme remember-me lui-même (token 64 octets, hash SHA-256 + expiration 30j en BDD,
  cookie httpOnly) était déjà correctement implémenté de bout en bout. Le bug : tous les
  cookies (session, CSRF, remember_me) étaient posés avec `'domain' => ''` (host-only), alors
  que `$allowedOrigins` (api/bootstrap.php) whiteliste `personadle.net` ET
  `www.personadle.net` — un cookie posé sur l'un n'est jamais envoyé sur l'autre. Un
  utilisateur connecté sur `www.` puis revenant sur l'apex (ou l'inverse) se retrouvait donc
  déconnecté malgré "se souvenir de moi" coché.
  - `api/bootstrap.php` — nouvelle constante `PERSONADLE_COOKIE_DOMAIN` (`.personadle.net` en
    prod, `''` en dev — un domaine avec point de tête casserait les cookies sur `localhost`),
    utilisée pour le cookie de session et le cookie CSRF.
  - `api/auth/login.php`, `api/auth/me.php`, `api/auth/logout.php` — même constante sur les 5
    `setcookie('remember_me', …)` (pose, rotation, révocation) pour que le cookie soit lisible
    (et supprimable) depuis les deux hôtes.

### Backfill des `user_stats` déjà perdus (mode préféré + classement faux)

Cas concret confirmé en prod le jour même : un joueur avec 100+ victoires réelles en mode
Music (son mode le plus joué, `game_sessions` en fait foi) voyait "Emoji" comme mode préféré
et n'apparaissait pas correctement dans le classement Music — sa ligne
`user_stats(mode='music')` était restée à zéro/manquante, exactement le bug décrit ci-dessus
(`api/user/migrate.php`) et/ou son équivalent historique côté `game_session.php` (le garde-fou
`INSERT IGNORE` y existait déjà mais commentait explicitement le même risque, signe qu'il a pu
manquer par le passé). `js/cloud-sync.js:157` (mode préféré = mode avec le plus de `games` dans
`user_stats`) et `api/leaderboard/index.php` (classement "ever" = lecture directe de
`user_stats`) lisent tous les deux cette même table — une ligne manquante y est invisible des
deux côtés à la fois, peu importe le nombre réel de parties dans `game_sessions`.

- `sql/migrations/028_reconcile_user_stats_from_sessions.sql` — recalcule
  `games/wins/giveups/perfect_wins/total_time_ms` de `user_stats` par `(user_id, mode)`
  directement depuis `game_sessions` (`INSERT … SELECT … ON DUPLICATE KEY UPDATE`, idempotent).
  Volontairement **pas** touché : `streak`/`streak_record`/`last_played_at`/`first_played_at`
  — dérivés de la consécutivité jour par jour (`personadle_compute_streak()`), pas de simples
  agrégats ; les recalculer depuis `game_sessions` écraserait des streaks en cours légitimes.
  Ils continuent de s'incrémenter normalement à la prochaine partie réelle du joueur.
- À rejouer sur Hostinger via SSH (`mysql -u … -p … < sql/migrations/028_….sql`) — même
  procédure que les migrations précédentes, pas de `DELIMITER` particulier ici (pas de
  procédure stockée).
- **Testée réellement** contre une instance MariaDB 10.11 jetable (`mariadb-server-core` +
  `mariadb-install-db`, montée localement le temps de la vérif) chargée avec `bdd_mysql.sql` :
  reproduction du bug exact (125 sessions `game_sessions` en mode music — 120 wins/5 giveups/20
  perfect — sans AUCUNE ligne `user_stats` correspondante, + une ligne `emoji` déjà correcte en
  contrôle). Après migration : ligne `music` créée avec les totaux exacts
  (games=125, wins=120, giveups=5, perfect_wins=20, total_time_ms=4525000, calculs
  vérifiés à la main), ligne `emoji` **inchangée** (streak/streak_record=2/2 préservés). Rejouée
  une 2e fois → résultat identique (idempotence confirmée). Requêtes leaderboard "ever" et
  mode-préféré rejouées à la main sur ces données : music remonte bien en tête des deux
  désormais.

### Definition of Done (§13 CLAUDE.md)

- `npm test` (604/604), `npm run lint`, `npm run data:check`, `npm run docs:fix` — tous verts
  en local. CI GitHub Actions (run 30391448157, commit 7cd503d) verte sur les 3 jobs : PHP Lint
  & Tests (PHPUnit inclus), JS Tests & i18n check, E2E Playwright — confirme que PHPUnit, non
  exécutable dans cet environnement (proxy réseau bloque le téléchargement du phar), passe bien
  en CI.
- `php -l` sur les fichiers PHP modifiés — aucune erreur de syntaxe.
- Migration 028 validée contre une vraie instance MariaDB (voir ci-dessus) — pas seulement
  relue, réellement exécutée avec reproduction du bug.
- Angle mort résiduel : la migration 028 corrige les comptes déjà affectés au moment où elle
  tourne, mais si le root cause `migrate.php` n'était pas fixé (voir plus haut), de nouveaux
  comptes referaient le même trou — les deux correctifs (code + backfill) vont ensemble, ne pas
  déployer l'un sans l'autre.

---
## 2026-08-05 — feat(2.1): silhouettes, All-Out Attack, 7 musiques, filtre PTS

Suite et fin du lot de contenu 2.1 :
- **Silhouettes** : Saki, Mayumi (dup portrait), trio Kanzato (images dédiées) —
  `silhouetteCharacters.js` + `portraitsMapSilhouette.js`.
- **All-Out Attack** : Panther Starlight (Ann Takamaki, P5X) — animation `mp4→webp`
  (640×360, 60fps), image sélection + battle still.
- **7 musiques** : Junes Themes (P4), Mass Destruction (P3FES), P3 FES (P3FES, nouvelle
  icône), Show Stealer (P5X, nouvelle icône), Tokyo Emergency (P5/P5R), What You Wish For
  (P5S), Hoshi to Bokura to (P5/P5R). mp3 + icônes locales, `songs.js` + `musicTitles.js`.
  Métadonnées (vocalistes, liens) fournies par Hamza.
- **Filtre Persona Trinity Souls** : bouton + logo dans les 4 modes à contenu PTS
  (classic/emoji/silhouette/personae), règle CSS `filter-color-pts`.

## 2026-08-05 — feat(2.1): personae Abel/Seth/Cain + fix collision portrait Mayumi

Trois personae Trinity Souls (Abel/Shin, Seth/Jun, Cain/Ryo) ajoutées à
`personaeCharacters.js` (opus PTS), images dans `personaeMode/database/img/`, wielders
mappés dans `portraitsMapPersonae.js`.
Fix au passage : la slice NPC avait écrasé `database/portraits/Mayumi.webp` (utilisé par
Mayumi Hashimoto, P2) car Mayumi Yamano avait été mappée sur le même id `Mayumi`. Portrait
original restauré, Yamano remappée sur `Mayumi_Yamano`. Vérifié : plus aucun id de portrait
en double dans `portraitsMap`.

## 2026-08-05 — feat(2.1): titres Junes & Investigation Team (P4)

Deux titres P4 avec conditions proxy simplifiées (les conditions "collection" d'origine
n'étant pas exprimables dans le système `condition_type`) : `investigation_team` =
`mode_wins personae 8`, `junes` = `mode_wins music 15`. Seed `bdd_mysql.sql`, migration
`030`, images converties png→webp dans `profile/titles/`. Côté client (`titles-ui.js`),
le cas `mode_wins` respecte désormais `condition_mode` (map `_MODEWINS_KEY`) au lieu du
Classic codé en dur — corrige aussi un angle mort latent (aigis restait sur classic, OK).

## 2026-08-05 — feat(2.1): badge secret Gyotre (code GYOTRE)

Badge secret easter-egg `gyotre` sur le modèle d'Arati : déblocable par le code permanent
`GYOTRE`. Seed `bdd_mysql.sql` (badges + event_codes), entrée `badgesData.js`, i18n dans les
6 langues (`badges.gyotre.*`), image `profile/badges/images/Badge_Gyotre.webp`. Migration
`029_badge_gyotre.sql` pour l'insérer en prod (INSERT IGNORE). Description FR = la blague
maison ("comment build violet") ; autres langues = générique.

## 2026-08-05 — feat(2.1): opus Persona Trinity Souls + trio Kanzato

Nouvel opus `PTS` (Persona Trinity Souls, anime) ajouté à `VALID_OPUS`
(`scripts/validate_characters.js`) et aux `ALL_OPUS` des modes Classic/Emoji/Silhouette/
Personae. Trois personnages à persona : Shin Kanzato (Abel), Jun Kanzato (Seth),
Ryo Kanzato (Cain) — jouables en Classic + Emoji. Portraits + portraitsMap. Quotes vides
(anime obscur, pas de source fiable). Reste pour PTS : bouton/logo filtre dans le HTML de
chaque mode (le logo `Trinity_soul.webp` est prêt), les personae Abel/Seth/Cain dans le
mode Personae, et les silhouettes du trio.

## 2026-08-05 — feat(2.1): personnages NPC P4/P5 (Saki, Mayumi, Kobayakawa, Wakaba)

Début du contenu 2.1. 4 personnages humains sans persona (`arcane: ["NONE"]`,
`personaUser: false`) ajoutés à `database/characters_clean.js` (donc modes Classic +
Emoji) : Saki Konishi & Mayumi Yamano (P4/P4G), Kobayakawa & Wakaba Isshiki (P5/P5R).
Portraits copiés dans `database/portraits/`, entrées ajoutées à `portraitsMap.js`.
Quote de Wakaba laissée vide (aucune source fiable — décision produit). Reste à venir
pour ces persos : silhouette (Saki/Mayumi uniquement), le reste du lot 2.1 (opus Trinity
Souls + trio Kanzato, songs, titres, badge Gyotre, All-Out Attack Ann).

## 2026-07-24 — chore(ci): outillage anti-régression post-lancement v2.0

Suite au lancement prod v2.0 et à sa série de bugs de schéma/défaut, ajout de 4 outils
pour ne plus découvrir ce genre de problème à la main :

### Détails techniques

- **Smoke test** (`scripts/smoke_test.sh` + `.github/workflows/smoke.yml`) : après chaque
  push sur `main`, attend le déploiement Hostinger (~75 s) puis `curl` les endpoints clés
  (home 200, `/api/auth/me` 200 JSON, catalogues 401=route+auth, `/sql/` 403). Non bloquant
  (alerte). `npm run smoke [URL]` en local. Aurait attrapé les 500 du jour automatiquement.
- **Détecteur de dérive schéma** (`scripts/check_prod_schema.php`, `npm run schema:check-prod`)
  : diff `information_schema` vs `bdd_mysql.sql`, liste les colonnes attendues manquantes.
  À lancer sur le serveur / en cron. (Ne couvre pas encore les défauts/types — cf. bug
  `messages.status`.)
- **Suivi de migrations** (`sql/migrations/026_schema_migrations_tracking.sql` +
  `scripts/apply_migrations.sh`) : table `schema_migrations` (amorcée avec 000→026 comme
  appliquées) + script qui n'applique que les migrations en attente (backup auto avant).
  Fini de deviner colonne par colonne l'état de la prod.
- **Dependabot** (`.github/dependabot.yml`) : groupes `vitest` (+`@vitest/*`) et `eslint`
  (+`@eslint/*`) incluant les majeures → plus de PRs cassées par peer-deps splittées.

## 2026-07-24 — fix(messages): notifs de défi jamais reçues (défaut messages.status)

Symptôme prod : les demandes d'ami notifiaient bien, mais **jamais les défis**. Cause :
`messages.status` avait en prod `DEFAULT 'pending'` (héritage de l'archive du 6 mai), alors
que le code n'emploie que `unread/read/accepted/beaten/expired`. Les défis (INSERT sans
statut explicite) naissaient donc `'pending'` ; le poller `js/notifications.js`
(`_checkPendingChallenges`, filtre `status === 'unread'`) ne les voyait jamais. Les amis
passaient par `friendships.seen_at` → non affectés. Dérive de **défaut** (pas de colonne),
non couverte par l'audit 025.

### Détails techniques

- `api/messages/index.php` : les 3 INSERT (message + défi + fallback défi) forcent désormais
  `status = 'unread'` explicitement — le code ne dépend plus du défaut BDD pour une valeur
  métier critique (fix principal, part en prod via l'auto-déploiement).
- `sql/migrations/027_fix_messages_status_default.sql` : aligne le défaut prod
  (`ALTER COLUMN status SET DEFAULT 'unread'`) + corrige d'éventuelles lignes `'pending'`.
- Angle mort mis en lumière : l'audit 025 comparait l'existence des colonnes, pas leurs
  **défauts/types**. `scripts/check_prod_schema.php` (nouveau) pourrait être étendu aux
  défauts dans un second temps.

## 2026-07-24 — fix(db): migration 025 — audit global schéma prod, 4 colonnes manquantes

Suite de 024. Plutôt que corriger les 500 un par un (badges → codes → défis → amis…),
audit complet du schéma prod : diff `information_schema` (prod réelle) vs `bdd_mysql.sql`
(source), table par table, colonne par colonne, CROISÉ avec l'usage réel dans `api/*.php`.

### Résultat de l'audit

- **Objets** : toutes les tables/procédures/fonctions référencées par le code existent en
  prod (`add_social_link_xp`/`get_or_create_social_link` recréées par 024). Le code n'utilise
  aucune vue. Aucune table manquante.
- **Colonnes manquantes ET utilisées par le code** (→ 500), corrigées par
  `025_reconcile_prod_missing_columns.sql` :
  - `badges_unlocked.id` (SELECT id — api/admin/user_badges.php, "donner un badge")
  - `event_codes_redeemed.id` (SELECT id — api/badges/index.php, "utiliser un code")
  - `friendships.accepted_at` (UPDATE — api/friends/index.php, "accepter un ami")
  - `messages.challenge_score` (INSERT/SELECT — api/messages/index.php, "envoyer un défi")
- **Dérive cosmétique laissée en l'état** (colonnes présentes dans bdd_mysql.sql mais
  **0 usage** dans le code, confirmé par grep) : `titles.description_*`/`name_jp`,
  `social_link_ranks.name_jp`, `user_stats.id`, `user_titles.id`, `game_sessions.created_at`.
  Les ajouter serait du zèle risqué sans gain fonctionnel.

### Détails techniques

- Les deux `id` sont ajoutés en `AUTO_INCREMENT` + `UNIQUE KEY` **sans** toucher la PK
  composite existante (AUTO_INCREMENT autorisé sur la 1re colonne d'une UNIQUE KEY) → pas de
  `DROP PRIMARY KEY` risqué sur la prod.
- `ADD COLUMN IF NOT EXISTS` + `ADD UNIQUE KEY IF NOT EXISTS` (MariaDB) → ré-exécutable.
- Cause racine commune à 024+025 : base prod initialisée depuis l'archive `hostinger_full.sql`
  (2026-05-06) + migrations 001-023 ; les colonnes non couvertes par une migration numérotée
  sont restées à l'ancien schéma. Angle non audité : les *types* des colonnes existantes
  (ne provoquent pas de 500).

## 2026-07-24 — fix(db): migration 024 — reconcilie social_links en prod (500 panel admin)

Premier déploiement backend v2.0 en prod (auto-déploiement Git Hostinger activé le même
jour). La base Hostinger avait été initialisée depuis l'ancienne archive `hostinger_full.sql`
(2026-05-06), où `social_links` portait `current_rank`/`last_interaction`/`rank_updated_at`.
Le code déployé + `bdd_mysql.sql` attendent `rank`/`created_at`/`last_interaction_at` :
`GET /api/admin/users/:id` (et tout le sous-système social) plantait en 500
(`Unknown column 'rank'`). Aucune migration n'avait capturé ce renommage.

### Détails techniques

- Diagnostic : rejeu des requêtes de `api/admin/user.php` en base prod → `ERROR 1054` sur
  `social_links.rank`. `SHOW CREATE TABLE` confirme l'ancien nommage (archive du 6 mai).
- `sql/migrations/024_reconcile_social_links_prod_schema.sql` : renomme les colonnes
  (data-safe via `CHANGE`), ajoute `created_at`, retire `rank_updated_at`, et **recrée la
  vue `v_social_links` + la fonction `get_or_create_social_link` + la procédure
  `add_social_link_xp`** avec les nouveaux noms (définitions alignées sur `bdd_mysql.sql`).
- Non idempotente, à jouer une seule fois sur une base issue de l'archive du 6 mai ; contient
  `DELIMITER` → appliquer via le client mysql en SSH (jamais phpMyAdmin), mysqldump avant.
- Aucun changement de code ni de `bdd_mysql.sql` : dev/CI (qui chargent `bdd_mysql.sql`)
  étaient déjà corrects. Dérive strictement côté prod.
- Angle mort restant : d'autres tables issues de l'archive du 6 mai pourraient avoir une
  dérive similaire non encore rencontrée — les endpoints exercés jusqu'ici (users, profiles,
  user_stats, badges, wallpapers, titles, friendships) passent, seul social_links divergeait.

## 2026-07-24 — chore(deploy): durcissement .htaccess en vue de l'auto-déploiement Git

Préparation du passage à l'auto-déploiement Hostinger (webhook GitHub sur `main` →
`git pull` dans `public_html`). Contrairement à l'ancien upload SFTP manuel (qui excluait
les dossiers de dev, cf. `DEPLOY.md` étape 3), un déploiement Git copie **tout** le dépôt
dans `public_html`. Les dossiers/fichiers d'outillage deviendraient donc accessibles
publiquement (`/sql/bdd_mysql.sql`, `/.git/`, `/tests/`, `/scripts/`…).

### Détails techniques

- `.htaccess` racine : ajout de deux blocs de blocage web.
  - `mod_rewrite` → `[F,L]` sur `.git`, `sql/`, `tests/`, `tests-e2e/`, `scripts/`,
    `coverage/`, `node_modules/`.
  - `mod_authz_core` → `Require all denied` sur les fichiers de config racine
    (`package.json`, `*.config.js`, `phpunit.xml`, `phpstan.neon`, `docker-compose.yml`,
    `Makefile`, `setup.sh`, `*.phar`, `.env*`, `.hostinger`).
- Bloc `mod_authz_core` guardé par `<IfModule>` : si le module manque, ignoré au lieu de
  renvoyer une 500 (angle mort évité).
- **Non bloqués volontairement** (servis à l'exécution) : `database/`, `assets/`, `css/`,
  `js/`, `lang/`, `img/`, `font/`, `pages/`, `profile/`, `api/`, dossiers de modes.
- Angle mort connu : l'auto-déploiement ne met à jour que le **code**. Les migrations SQL
  (`sql/migrations/`) restent à appliquer manuellement (SSH `mysql`/phpMyAdmin) après un
  merge qui en introduit une — le `git pull` ne touche jamais à la BDD ni à `api/config.php`
  (gitignoré, préservé sur le serveur).

## 2026-07-24 — chore(ci): job E2E devient bloquant (critère de sortie atteint)

Branché en CI le 8 juillet 2026 en `continue-on-error: true`, le temps de confirmer sa
stabilité avant de pouvoir bloquer les merges dessus. Critère de sortie documenté dans
`ci.yml` : 10 runs consécutifs verts sur `develop`.

### Détails techniques

- Vérifié job par job (pas juste le statut top-level du workflow, qui peut être trompeur
  avec `continue-on-error`) sur 28 runs consécutifs de `develop` entre le 8 et le 24 juillet
  2026 — toutes les étapes du job `e2e` réussissent réellement à chaque fois, largement
  au-dessus du seuil des 10.
- `continue-on-error: true` retiré du job `e2e` dans `.github/workflows/ci.yml`.
- `tests-e2e/README.md` § Statut CI et `CLAUDE.md` §8 mis à jour en conséquence.
- Suite complète revérifiée : Vitest 601/601, ESLint 0 erreur, `docs:check` OK.

## 2026-07-23 — fix(i18n): règles de jeu enfin traduites dans les 6 langues (6 modes)

Bug remonté par Hamza : en portugais (et es/de/it), le **corps des règles** de
chaque mode restait en anglais. Cause : les modales règles utilisaient le système
`data-i18n-block="en"/"fr"` (blocs HTML en dur) → seuls EN et FR existaient,
es/de/it/pt retombaient sur le bloc EN via le fallback de `applyToDOM()`. Les
traductions existaient pourtant déjà dans `lang/*.json` (`modes.<mode>.goal`,
`rule_1`, `tip_1`…), simplement pas câblées.

### Détails techniques

- **Refactor des 6 modales règles** (`classiqueMode`, `emojiMode`,
  `silhouetteMode`, `allOutAttackMode`, `personaeMode`, `musicsMode`) : suppression
  des blocs `data-i18n-block="en"/"fr"` (duplication + couverture partielle),
  remplacés par un **jeu unique d'éléments `data-i18n="modes.<mode>.<clé>"`** qui
  pointent vers les clés JSON déjà traduites → **traduit dans les 6 langues** (et
  toute langue future) depuis la source de vérité unique, sans duplication.
- HTML généré depuis `lang/en.json` (script one-shot) pour que le texte de repli
  corresponde exactement aux clés (zéro erreur de recopie), puis `prettier --write`.
- `data-i18n` pose `textContent` (cf. `js/i18n.js`) : les libellés de section
  gardent leur style (`#rulesText strong`), on perd juste le gras inline sur
  quelques noms de critères (les valeurs JSON sont du texte plat) — compromis
  assumé pour une i18n complète.
- Écart mineur réconcilié : le mode Classique avait un critère « Name » en dur sans
  clé JSON — fusionné sur les 6 clés `criteria_*` existantes.
- Vérifié en navigateur (Playwright, lang=pt) : Classique, Emoji, Music, Personae —
  règles intégralement en portugais.
- `i18n:check` inchangé (985 clés × 6, aucune clé ajoutée/retirée), Vitest 601/601.

## 2026-07-23 — fix(content): modale in-app "Historique des MAJ" — nouveaux persos + collab Discord manquants

Revue demandée par Hamza : la modale `#newsModal` d'`index.html` (celle que la
quasi-totalité des joueurs consultent réellement, contrairement à la page
`PersonaDLE_Update.html` séparée) ne mentionnait ni les nouveaux personnages
de la v2.0 ni la collab Discord — deux features pourtant déjà documentées
ailleurs, jamais reportées ici.

### Détails techniques

- **Nouveaux personnages** — 1er passage de review incomplet : je m'étais
  arrêté à "Joker Starlight" en lisant `PersonaDLE_Update.html` et j'ai raté
  Mona Starlight, les 5 tenues Summer 2026, l'event Radiance et la collab
  Hatsune Miku (corrigé après relecture complète demandée par Hamza). Bullet
  condensé ajouté (`✨ New Characters`) plutôt qu'une entrée par perso (24 au
  total, disproportionné pour une liste de highlights) : 3 antagonistes
  jouables (Nyx, Ameno-sagiri, Yaldabaoth), 6 personnages Persona 5 Strikers,
  nouveaux Phantom Idols P5X, + exclusivités All-Out Attack (Joker/Mona
  Starlight, 5 tenues Summer 2026, collab Hatsune Miku).
- **Collab Discord** — bullet `💬 Discord Collab` ajouté, alignée sur le
  wording déjà utilisé dans `PersonaDLE_Update.html` (PR #38).
- **`index.html`** — les deux bullets ajoutés dans les **6 blocs de langue**
  (`data-i18n-block="en|fr|es|de|it|pt"`) de la section Version 2.0 de la
  modale, traduits (pas de placeholder anglais qui traîne). Positionnement :
  "New Characters" juste avant "Music Mode Revamp" (contenu de jeu groupé),
  "Discord Collab" juste après "6 Languages" (communauté groupée).
- Rendu vérifié en navigateur réel (Playwright) sur les 6 langues : les deux
  bullets s'affichent au bon endroit, aucune régression sur le reste de la
  liste.
- Suite complète revérifiée : Vitest 601/601, ESLint 0 erreur, `i18n:check`
  985 clés × 6 langues, `docs:check` OK (ce changement ne touche pas les
  clés i18n — texte inline `data-i18n-block`, pas `lang/*.json`).

## 2026-07-23 — fix(perf): boutons FR/ES/DE/IT redimensionnés + recompressés (25,4 Mo → 6,2 Mo)

Suite du fix du 2026-07-23 sur `assets/buttons/PT/` (PR #39) : le même défaut
d'export (3246×1312px au lieu de 1640×664, résolution EN déjà confortable pour
le rétina vu l'affichage in-game à ~90-100px de haut) touchait en fait **les 4
langues déjà en prod**, pas seulement PT — 48 fichiers, 0,77 à 1,8 Mo chacun.

### Détails techniques

- Même pipeline que PT : `dwebp` → `cwebp -resize 1640 0 -lossless -z 9 -m 6`,
  canal alpha revérifié sur toutes les variantes `_Transparent` (`webpmux
  -info`). Lossless conservé (cohérence avec le format existant, pas
  d'artefact autour du texte détouré).
- Les 3 variantes par bouton (normal / `_Rouge` hover / `_Transparent`) × 4
  boutons × 4 langues = 48 fichiers traités.
- Résultat par langue : DE 6,3 Mo → 1,5 Mo, ES 5,7 Mo → 1,4 Mo, FR 6,4 Mo →
  1,6 Mo, IT 7,0 Mo → 1,7 Mo. Rendu vérifié en navigateur réel (Playwright,
  `classiqueMode.html`) sur les 4 langues, état normal **et** hover (`_Rouge`) :
  aucune régression visuelle, texte net.
- Typo préexistante repérée mais **non corrigée ici** (hors périmètre) :
  `assets/buttons/DE/Aufgeben_Buttonu_Transparent.webp` (« Buttonu » au lieu de
  « Button ») — renommer casserait la référence dans `js/i18n.js` sans
  bénéfice fonctionnel, à faire dans un commit dédié si on nettoie ce nom un
  jour.
- **`sw.js`** — `CACHE_VERSION` bump `v77 → v78`.
- Suite complète revérifiée : Vitest 601/601, ESLint 0 erreur, `i18n:check`
  985 clés × 6 langues, `docs:check` OK.

## 2026-07-18 — feat: modale Discord collab (PersonaDLE × Le Grimoire du Cœur)

Collaboration officialisée avec le serveur FR partenaire **Le Grimoire du Cœur**.
Le bouton Discord de l'accueil n'ouvre plus directement le serveur PersonaDLE :
il affiche une modale style Discord présentant les deux serveurs.

### Détails techniques

- **`index.html`** — nouvelle modale `#discordModal` (deux cartes serveur côte à
  côte : Grimoire à gauche = FR/le plus actif, PersonaDLE à droite = international/
  recrute). Le bouton `#discordBtn` reste un `<a>` vers PersonaDLE (fallback si JS
  désactivé) ; un script inline intercepte le clic pour ouvrir la modale (même
  pattern que la modale News : `display none↔flex`, fermeture X / clic overlay /
  Escape).
- **`css/index.css`** — bloc `.discord-modal*` : palette officielle Discord
  (blurple `#5865F2`, surfaces `#313338`/`#2b2d31`), grille 2 colonnes qui passe
  en 1 colonne sous 600px, animation d'ouverture, `backdrop-filter`.
- **Icônes serveurs en statique** — `assets/discord/{grimoire,personadle}_server.png`
  récupérées via l'API invite Discord puis servies en local : la CSP du site
  (`img-src 'self' data: …r2.dev`) bloque `cdn.discordapp.com`, donc pas de fetch
  runtime. À re-télécharger manuellement si une icône de serveur change.
- **i18n** — 7 nouvelles clés `index.discord_*` (titre, sous-titre, tags FR/intl,
  descriptions, bouton Join) × 5 langues. Réponse FAQ `a12` réécrite (×5) pour
  citer les deux serveurs.
- **Docs** — `README.md` liste désormais les deux liens Discord (international vs
  partenaire FR).
- Vérifié en navigateur réel (Playwright) : rendu desktop + responsive 375px, les
  deux icônes se chargent bien (HTTP 200 `image/png`, CSP OK).

### À suivre

- Changelog **joueur** (`PersonaDLE_Update.html`) pas encore alimenté — feature
  visible côté joueur, à ajouter au prochain lot de comm'.

## 2026-07-23 — fix: modale Discord aussi sur la FAQ + changelog joueur

Revue de la PR : le bouton Discord de `pages/faq.html` (question "Is there a
Discord server?") n'avait pas été mis à jour — la réponse (`faq.a12`) mentionne
désormais les deux serveurs, mais le bouton restait un lien direct en dur vers
PersonaDLE, sans aucun moyen d'atteindre Le Grimoire du Cœur depuis cette page.

### Détails techniques

- **CSS partagé** — bloc `.discord-modal*` déplacé de `css/index.css` vers
  `css/global.css` (173 lignes) : composant maintenant utilisé par 2 pages,
  n'a plus sa place dans un CSS scopé à `index.html`. Version cache-buster
  bump `?v=10 → ?v=11` sur toutes les pages qui chargent `global.css`.
- **`pages/faq.html`** — même modale `#discordModal` que `index.html` (chemins
  `../assets/...` adaptés), même script de branchement (clic bouton → `display:
  flex`, fermeture X / clic overlay / Escape). Le bouton `#discordBtn` de la FAQ
  reste un `<a href>` réel vers PersonaDLE (fallback JS désactivé), identique au
  pattern de l'accueil.
- **Changelog joueur** (`PersonaDLE_Update.html`) — item "Discord Collab — Le
  Grimoire du Cœur" ajouté à la grille de highlights v2.0 (EN/FR), ce qui
  répond au "À suivre" laissé dans l'entrée du 2026-07-18.
- **`sw.js`** — `CACHE_VERSION` bump `v75 → v76` : le cache-first du service
  worker sert `css/global.css`/`css/index.css` depuis le cache, sans ce bump les
  PWA déjà installées auraient gardé l'ancien CSS (donc pas de modale Discord)
  jusqu'à un hasard de cycle de mise à jour.
- Suite complète revérifiée après ces changements : Vitest 586/586, ESLint 0
  erreur, `i18n:check` 985 clés × 5 langues, `docs:check` et `pools:check` OK.

## 2026-07-18 — feat(i18n): ajout du portugais (pt) — 6ᵉ langue

Portugais (pt-PT) ajouté comme 6ᵉ langue. Traduction complète des 978 clés +
câblage dans tous les points d'énumération de langues.

### Détails techniques

- **`lang/pt.json`** — 978 clés traduites (pt-PT), parité exacte avec `en.json`
  (0 clé manquante/en trop, `{{placeholders}}` cohérents). Noms propres, codes
  opus, titres de musiques et termes de lore préservés (Velvet Room, Wild Card,
  Phantom Thief, Social Link, True Confidant…), même politique que es/fr.
- **Câblage** : `js/i18n.js` (`SUPPORTED` + config `_BUTTON_CFG.pt`),
  `js/lang-selector.js` (`LABELS` + `LANG_OPTIONS`, personnage Matador),
  `scripts/check-i18n.js` & `check-i18n-untranslated.js` (`TARGET_LANGS`),
  `scripts/check-doc-numbers.js` (regex liste de langues), `admin/admin.js`
  (liste des langues éditables).
- **Sélecteur** : bloc `.lang-opt--pt` ajouté dans les 4 pages à sélecteur inline
  (`index.html`, `pages/faq.html`, `pages/privacy.html`, `profile/profile.html`)
  + style `.lang-opt--pt` dans `css/langSelector.css` (accent vert Portugal,
  serif système — aucune Google Font supplémentaire à charger).
- **Boutons illustrés in-game** : config `pt` pointant vers `assets/buttons/PT/`
  (Dica / Desistir / Jogar_de_Novo / Confirmar). ⚠️ **Assets à fournir par le
  design (Hamza)** — tant qu'ils n'existent pas, `updateLangButtons()` retombe
  automatiquement sur les images EN (fallback `_BUTTON_CFG[lang] || en`).
- **Docs** : `README.md`, `ROADMAP.md`, `lang/README.md`, `CLAUDE.md` — listes de
  langues passées à 6 (badges shields, tableaux, texte). Nombres de clés/tests
  auto-synchronisés par `docs:fix`.
- **Tests** : nouveau `tests/langParity.test.js` (15 tests — parité clés +
  `{{placeholders}}` des 5 langues cibles contre en.json, dont pt) ;
  `tests/langSelector.test.js` mis à jour (6 options, assertion sur l'option pt) ;
  `tests/i18n.test.js` liste des langues supportées complétée (it + pt).
- Vérifié en navigateur réel (Playwright) : option Português (personnage Matador)
  dans le sélecteur + bascule complète de l'UI en portugais.
- **Boutons illustrés PT** fournis (Hamza) et câblés : `assets/buttons/PT/`
  (Indice / Desistir / Jogar_Novamente / Confirmar). Choix produit : pas de
  variante `_Rouge` (survol) pour PT → `a` = image normale sur les 4 (survol
  uniforme). Le hint reste « Índice » (choix Hamza via DeepL, malgré « Dica »
  plus courant). Renommage propre des fichiers déposés.
- **Modale « Historique des MAJ » (index.html) enfin i18n.** Elle utilisait des
  blocs `data-i18n-block="en|fr"` uniquement → es/de/it/pt retombaient en
  anglais (fallback `_blockLang`). Ajout des blocs **es/de/it/pt pour les 5
  versions** (v2.0, v1.1, v1.02, v1.01, v1.0) — 6 langues × 5 = 30 blocs.
  Easter-egg badge `hifumi_archives` déplacé sur un listener délégué
  (`.see-more-btn`) au lieu d'un `onclick` inline par bloc → couvre les 6 langues
  sans duplication. Angle mort : les **titres/dates de version** (« Version 2.0
  — Major Update », « May 2026 ») restent partagés en anglais (hors blocs) — à
  i18n plus tard si besoin.
- **Enrichissement de l'entrée v2.0** (retours joueurs) : ajout de highlights
  qui manquaient — Séries & Jack Frost, Mode Musique repensé, Personnalisation
  du profil (wallpapers + musique de profil), Accessibilité (daltonien /
  reduced-motion / clavier). Mise à jour « 5 Langues → 6 Langues EN·FR·ES·DE·IT·PT »
  et retrait du compte de clés figé (760).

## 2026-07-23 — fix(perf): boutons PT redimensionnés + recompressés (10 Mo → 1,1 Mo)

Revue de la PR : les 8 fichiers `assets/buttons/PT/*.webp` livrés par le design
pesaient 862 Ko à 1,7 Mo **chacun** (~10 Mo au total), contre 8-15 Ko pour
l'équivalent EN. Cause : export à 3246×1312px alors que les boutons s'affichent
en jeu à ~90-100px de haut (`#guessButton`/`#resetButton { height: 90px }`,
`css/global.css`) — même en comptant large pour le rétina, 1640×664 (résolution
EN) est déjà très confortable. Texte du bouton lui-même **non modifié** (choix
produit Hamza conservé : « Índice », pas de variante `_Rouge`).

### Détails techniques

- Pipeline : `dwebp` (décodage) → `cwebp -resize 1640 0 -lossless -z 9 -m 6`
  (réencodage lossless à la bonne échelle, canal alpha vérifié préservé sur les
  variantes `_Transparent` via `webpmux -info`). Lossless conservé (pas de passage
  en lossy) pour rester cohérent avec le format des autres langues et ne pas
  introduire d'artefacts autour du texte détouré.
- Résultat par fichier : Confirmar 1,7 Mo → 130 Ko, Desistir 1,5 Mo → 160 Ko,
  Indice 1,3 Mo → 106 Ko, Jogar_Novamente 1,2 Mo → 217 Ko (+ variantes
  `_Transparent`, toutes plus légères). Rendu vérifié en navigateur réel
  (Playwright, `classiqueMode.html` en langue `pt`) : boutons nets, alpha intact,
  aucune régression visuelle.
- **⚠️ Angle mort découvert en creusant ce fix — pas corrigé ici (hors périmètre
  de cette PR)** : `assets/buttons/FR/`, `ES/`, `DE/`, `IT/` ont **exactement le
  même défaut** (3246×1312px, 1,3-1,8 Mo par fichier, déjà mergés sur `develop`
  depuis un moment) — ce n'était donc pas une erreur spécifique au lot PT mais un
  bug systémique déjà en prod sur 4 langues. À traiter dans une PR dédiée
  (même pipeline resize+recompress, ~24 fichiers).
- `assets/lang/Matador_portugal.webp` (illustration du sélecteur de langue,
  128 Ko) vérifié à part — cohérent avec les 6 autres personnages du sélecteur
  (74-128 Ko), aucun problème là-dessus.
- Suite complète revérifiée après ces changements : Vitest 601/601, ESLint 0
  erreur, `i18n:check` 978 clés × 6 langues, `docs:check` OK.

## 2026-07-23 — chore(i18n): rebase post-merge Discord (#38) — pt.json 978 → 985 clés

La PR #38 (modale Discord) a mergé sur `develop` pendant que cette PR était en
review, ajoutant 7 clés `index.discord_*` à en/fr/es/de/it (985 clés). Rebase
de cette branche sur `develop` à jour + traduction des 7 clés manquantes en
`pt.json` pour rétablir la parité à 6 langues (sinon `tests/langParity.test.js`
aurait cassé au merge, faute des clés `discord_*` côté PT).

### Détails techniques

- **`lang/pt.json`** — `discord_modal_title`, `discord_modal_sub`,
  `discord_grimoire_tag`, `discord_grimoire_desc`, `discord_personadle_tag`,
  `discord_personadle_desc`, `discord_join` traduits (pt-PT, forme "tu",
  vocabulaire aligné sur l'existant : "juntar-se" déjà utilisé pour "join
  Discord" dans `faq.a13`/`faq.a30`). `faq.a12` (réponse FAQ Discord) était
  déjà à jour côté PT — mentionnait déjà les deux serveurs.
- Conflits de rebase (nombres doc figés dans le même diff que #38) résolus dans
  `CLAUDE.md`, `README.md`, `ROADMAP.md`, `lang/README.md`,
  `DEV_CHANGELOG.md`. Au passage, `lang/README.md` avait aussi deux oublis
  **antérieurs à cette PR** (pas liés au rebase) : « Cinq langues » au lieu de
  six dans le sous-titre, et pas de ligne `pt.json` dans le tableau des
  fichiers — corrigés ici.
- **`sw.js`** — `CACHE_VERSION` bump `v76 → v77` (v76 déjà pris par le merge de
  #38 entre-temps).
- Suite complète revérifiée après rebase : Vitest 601/601, ESLint 0 erreur,
  `i18n:check` **985 clés × 6 langues**, `i18n:check-untranslated` (aucune des
  7 nouvelles clés PT signalée comme copiée de l'anglais), `docs:check` et
  `pools:check` OK.

## 2026-07-20 — test: couverture des périmètres à 0% (social-link, challenge-result, stats-compare, bottomNav)

Suite à l'audit demandé par Hamza sur `cloud-sync.js` (couverture faible) : élargi
le scan à tout le repo. `vitest.config.js` limite le rapport de couverture à une
allowlist de 7 fichiers (`coverage.include`) — la plupart du code (badgesManager,
titles-ui, tous les modes de jeu…) n'y figure jamais, donc `npm run test:coverage`
ne le voit pas. Cherché autrement : quels fichiers source ne sont importés par
**aucun** test (`grep` des imports de `tests/*.test.js` contre la liste réelle des
fichiers JS). Root cause de plusieurs trous : des fonctions utilitaires restaient
`function` (privées) au lieu d'`export function`, comme documenté par la convention
déjà en place (`_renderFriendCode`, `_resetTitlesData`…) — exportées ici avec le
même traitement, sans renommage.

- **`js/social-link.js`** (le pire du repo : 64,7% fonctions) — `getSocialLinkData`,
  `gainSocialLinkXp`, `renderSocialLinkGauge` avaient **0 test** : les 3 vraies
  fonctions métier (appels backend XP/rang), seules les fonctions visuelles
  annexes étaient couvertes. 12 tests ajoutés (cache du `link_id`, propagation
  d'erreur serveur, effet de bord `bestSocialLinkRank` en localStorage pour le
  wallpaper "Dark Shopping District" — jamais/pas régressif). 64,7%→100% fonctions,
  83,4%→99,2% lignes.
- **`js/challenge-result.js`** — `checkChallengeCompletion()`, 0% avant, jamais
  dans aucun test. 15 tests sur la logique de décision (pas le rendu de l'overlay,
  DOM pur) : correspondance de mode insensible à la casse, calcul beaten/expired
  (`isWin && myAttempts <= challenge.score`), consommation de `activeChallenge`,
  restauration des filtres opus sauvegardés, nettoyage de l'état du mode
  spécifiquement pour un défi à cible dédiée (pas pour l'ancien format sans
  `target`). Ajouté à `vitest.config.js` (`coverage.include`) — 76%/73%/78% lignes/
  branches/fonctions, comparable à `streak-recovery.js` déjà dans la liste.
- **`js/stats-compare.js`** — `_globalWr`/`_pickConclusion`/`_formatCooldown`
  (préfixe `_` gardé, déjà la convention de tout le fichier) : calcul de winrate,
  formatage du cooldown de comparaison, sélection de la phrase de conclusion
  (12 tests, dont le random de `_pickConclusion` fixé via `vi.spyOn(Math,
  "random")` pour tester le branchement gap/catégorie sans dépendre du hasard).
  **Pas** ajouté à `coverage.include` : le reste du fichier est du rendu DOM/canvas
  volontairement non testé (même logique que pour `badgesManager.js` ou
  `leaderboard.js`, jamais dans cette liste) — l'inclure aurait fait chuter la
  moyenne agrégée de ~90%→~80% sans rien dire de la vraie qualité des tests.
- **`js/bottomNav.js`** — `getCurrentPage`/`getProfileAvatar`/`buildHrefs`, 0%
  avant. 22 tests sur le calcul de profondeur relative des liens (`./`, `../`,
  `../../` selon la page hôte) — exactement la classe de bug déjà vue une fois en
  vrai sur ce projet (`pages/404.html`, chemins relatifs cassés, cf. entrée
  2026-07-17 plus bas). Pas ajouté à `coverage.include` non plus (même raison que
  stats-compare.js — `showToast`/`buildNavHTML`/`initBottomNav` sont du DOM).

526→586 tests (+60), 28→31 suites. `coverage.include` passe de 4 à 5 fichiers —
toujours volontairement une allowlist des fichiers majoritairement logique-métier,
pas une couverture globale du repo (cf. commentaire dans `vitest.config.js`).

---

## 2026-07-19 — fix(badges): le champ "Entrer un code" du profil ne parlait jamais au serveur

Léo a envoyé une vidéo : il crée `QATEST2026` → `ace_defective` en admin (actif, permanent,
0 utilisation), va sur son profil, entre le code — "❌ Invalid code. Check your spelling!".
Le code est pourtant réel et actif côté admin.

Root cause, différente du fix du jour précédent (badge_id inexistant à la création) :
`handleEventCodeSubmit()` (`profile/badges/badgesManager.js`) ne faisait **aucun appel réseau**.
Il validait le code contre `eventCodes`, un dictionnaire JS codé en dur dans
`profile/badges/badgesData.js` — recopié manuellement depuis la table `event_codes` à un moment
donné (les codes `ALIBABA`, `GOURMET`, `XMAS2025`… y figurent tous), mais jamais resynchronisé
depuis. `api/badges/index.php` (l'endpoint `POST /api/badges/redeem`, déjà réécrit et testé la
veille pour le fix badge_id) n'était appelé **nulle part** dans le client — `grep` confirmé.
Concrètement : tout code créé (ou modifié) en admin après ce recopiage initial est invisible du
dictionnaire JS et renvoie "Invalid code" à 100% des joueurs, indéfiniment, sans nouveau
déploiement. Le panneau admin "Codes événement" était donc silencieusement non-fonctionnel pour
tout nouveau code depuis sa création — seuls les anciens codes déjà connus du JS marchaient,
par coïncidence de synchronisation, pas par design.

Fix : `handleEventCodeSubmit()` devient async et appelle réellement `api.badges.redeem(code)`.
Les messages UX (déjà utilisé/expiré/invalide) sont mappés depuis les codes HTTP réels du
backend (409/410/404) au lieu de la logique locale. `profile.eventCodes`/`profile.badges`
restent mis à jour en local à la réception de la réponse serveur — nécessaire car 11 badges
"secrets" legacy (`true_hacker`, `chef`, `dzulian`…) lisent encore `profile.eventCodes.includes()`
dans leur condition `check()` côté `badgesData.js`. Import mort retiré (`eventCodes`,
`isEventCodeValid` — plus référencés nulle part après ce fix, mais laissés en place dans
`badgesData.js` : suppression hors scope de ce correctif, aucune fonction n'y fait plus appel
donc aucun risque à les laisser). 5 tests de `tests/badgesManager.test.js` réécrits pour mocker
`window._personadleApi.badges.redeem` au lieu du dictionnaire local — ils testaient jusque-là
exactement le comportement cassé (validation locale sans aller-retour serveur). TEST_PLAN.md §27.

---

## 2026-07-19 — fix(badges): valide badge_id à la création d'un code événement, plus de succès silencieux au redeem

Léo : "même si je crée un code pr un badge ça marche tjrs pas". `api/admin/event_codes.php`
créait un code événement sans jamais vérifier que `badge_id` correspond à un slug existant
dans `badges` (`event_codes.badge_id` n'a pas de FK vers `badges.slug` — juste un champ texte
libre dans `admin/event-codes.js`, placeholder `slug_du_badge`, zéro validation). Un slug mal
tapé se créait sans erreur, puis `POST /api/badges/redeem` retournait quand même `200
{"redeemed":true}` sans jamais insérer dans `badges_unlocked` — le joueur croit avoir eu le
badge, rien ne se passe, aucun message pour comprendre pourquoi.

Fix des deux côtés :
- `api/admin/event_codes.php` : rejette la création (400) si `badge_id` n'existe pas dans
  `badges`.
- `api/badges/index.php` (redeem) : vérifie l'existence du badge **avant** toute écriture — si
  absent, erreur 500 explicite et **la redemption n'est pas consommée** (sinon un code cassé
  brûle l'unique essai du joueur, même une fois le slug corrigé côté admin ensuite).

4 tests d'intégration ajoutés dans `DatabaseIntegrationTest.php` (rejeu de la requête exacte
des 2 endpoints contre vraie MariaDB, même convention que `BadgeWallpaperCatalogTest.php`).
TEST_PLAN.md §26.

En creusant le sujet, Hamza a proposé un vrai CRUD badges en admin (formulaire création avec
upload image, plus de SQL/SSH manuel). Analyse faite : la table `badges` a déjà toutes les
colonnes nécessaires, mais le rendu client actuel ne lit **pas** la DB — il duplique chaque
badge dans `profile/badges/badgesData.js` (`badgesList` + fonction `check()` client) et dans
`lang/*.json` (bloc `badges.<slug>`). Un badge créé uniquement en DB via un futur CRUD serait
débloquable côté serveur mais invisible dans l'UI joueur tant que ces 2 fichiers ne sont pas
mis à jour en code. Trouvé au passage, indépendant de ce sujet : `condition_type='manual'`
retourne toujours `true` dans `personadle_verify_condition()` → n'importe quel badge `manual`
est auto-déblocable par n'importe quel utilisateur connecté via `POST /api/badges/unlock`,
sans code ni jeu (déjà vrai aujourd'hui pour plusieurs badges existants). Détail complet et
découpage proposé (Phase A "bookkeeping" / Phase B "source unique") dans ROADMAP.md — reporté
à la v2.1, pas d'implémentation pour l'instant.

---

## 2026-07-18 — chore(qa): review de cette PR — tests manquants ajoutés, doc à jour

Hamza a demandé une review complète de cette PR avant merge ("vérifier qu'on a tout bien
respecté"). Code relu diff par diff (pas juste la description) — tout ce qui était annoncé
correspondait bien au diff réel, mais deux angles morts trouvés :

1. **Zéro nouveau test** pour `wallpaperConditionText()`, le bouton copie du code ami, et le
   footer sticky des badges — seul `tests/gameCore.test.js` avait été touché (pour le retrait de
   `showCommunityStats`). Ajoutés : 3 tests `wallpaperConditionText` (fallback EN sans i18n,
   fallback EN si clé manquante, traduction utilisée) + 2 tests de rendu de la galerie (overlay
   hover uniquement sur les débloqués, tooltip nom+condition) dans `tests/wallpapersUi.test.js` ;
   7 tests `_renderFriendCode` (création, idempotence, mise à jour du code affiché, suppression
   au logout, copie clipboard + feedback temporisé, fallback `execCommand`) dans
   `tests/profilePage.test.js` — fonction exportée pour l'occasion (même convention que
   `_resetTitlesData` dans `titles-ui.js`).
2. **Changements réels non mentionnés dans la description de la PR** : `musicsMode` a un thème
   visuel dédié "VELVET" pour les musiques transversales à toute la série (ex: Aria of the Soul)
   + une bordure tournante mi-bleu/mi-rose pour P3P (Makoto/Kotone), et surtout un vrai fix —
   `todayKey` utilisait `toISOString()` (UTC) au lieu de `parisDateKey()`, exactement le piège
   documenté au CLAUDE.md §7. Rien de tout ça n'apparaissait dans le corps de la PR. Documenté a
   posteriori ici + ajouté au plan de test (§24.7-24.8) pour que Léo/Damien le testent aussi.

Fix mineur au passage : un commentaire CSS (`.badges-modal-footer`) affirmait annuler "le
padding-bottom (30px) du #badgesModal" — aucune règle CSS de ce nom n'existe nulle part dans le
fichier (`grep` sur tout `profile-page.css` : 0 résultat en dehors du commentaire lui-même).
Probablement une justification a posteriori d'une valeur calée à l'œil. Reformulé pour ne plus
affirmer une origine non vérifiée.

### Angle mort assumé, pas corrigé ici
PR #32 (stackée sur celle-ci) affichait des ✅ CI (PHPUnit 181/181, Vitest 502/502, lint) dans sa
description alors que GitHub Actions n'avait tourné **aucune fois** dessus — le workflow ne se
déclenche que sur PR ciblant `main`/`develop` (`.github/workflows/ci.yml`), pas sur une PR qui en
cible une autre. Comportement inhérent au stacking, pas un bug : vérifié à la main (checkout de
la branche, `npm test`/`lint`/`i18n:check`/`docs:check`/`php -l` — tout correspondait aux
chiffres annoncés), mais la CI réelle ne pourra confirmer qu'une fois cette PR mergée et la base
de #32 rebasée sur `develop`. Ne pas merger #32 sur la seule foi de sa description tant que sa
CI n'a pas tourné pour de vrai.

> Mise à jour (post-rebase) : ce point est résolu — PR #32 a été rebasée directement sur
> `develop` après le merge de #31, la CI a enfin pu tourner dessus pour de vrai.

---

## 2026-07-18 — feat: victoire post-abandon comptabilisée + défi à cible aléatoire

Implémentation des 2 décisions produit actées le 17 juillet (voir l'entrée
« Décisions de design — TRANCHÉES » plus bas). Branche/PR dédiée, séparée du
lot QA, car ça touche backend + anti-triche + les 6 modes.

### Feature 1 — une victoire compte toujours, même après un abandon le même jour

Cause racine du vécu de Hamza : les 5 modes sur 6 dont le bouton Replay efface
la garde `statsLogged_*` permettaient DÉJÀ de rejouer et poster une victoire —
mais le serveur la rejetait en 409 (contrainte `UNIQUE (user_id, mode,
played_date)`) et le cloud-sync suivant écrasait la victoire locale. Le fix est
donc principalement serveur :

- `api/lib/game_session.php` — sur doublon 23000 avec `result='win'` et ligne
  du jour en `giveup`, **upgrade** au lieu de 409 :
  `personadle_upgrade_giveup_to_win()` passe la ligne en `win`, ajuste
  `user_stats` (+1 win / −1 giveup, `games` inchangé, `total_time_ms` cumulé),
  et recalcule la streak depuis l'historique `game_sessions`
  (`personadle_recompute_mode_streak()` — le giveup l'avait mise à 0 sans
  mémoire de sa valeur d'avant). **Choix assumé : `perfect_wins` PAS incrémenté**
  sur un win post-abandon (la réponse a été révélée — le win compte, pas le
  perfect). win→win, win→giveup, giveup→giveup restent des 409.
- `api/sessions.php` — l'anti-triche daily target ne vérifie plus que la
  **première** session du jour : les replays tirent une cible aléatoire côté
  client, chaque replay loggait donc un faux positif `anti_cheat` (défaut
  pré-existant, aggravé par cette feature — corrigé à la racine).
- `emojiMode/emojiMode.js` — le Replay d'Emoji n'effaçait pas sa garde stats,
  seul mode dans ce cas ; aligné sur les 5 autres.
- Tests : +5 méthodes `DatabaseIntegrationTest` (upgrade, frontières 409, pas
  de perfect farmé, streak recalculée depuis l'historique), **exécutées contre
  la vraie MariaDB Docker** (`DB_TEST_HOST=db DB_TEST_PORT=3306`), pas skippées.

### Feature 2 — le défi tire une cible aléatoire dédiée (« le défi doit défier »)

- **Migration `023_challenge_target.sql`** (+ `bdd_mysql.sql`) : colonne
  `messages.challenge_target VARCHAR(200) NULL`. NULL = ancien défi → cible du
  jour (compat ascendante). Rejouée sur base VIERGE (26 tables ✓) + garde-fou
  `testMessagesTableHasChallengeColumns`.
- **API** `api/messages/index.php` : accepte/stocke/renvoie `challenge_target`
  (fallback INSERT sans la colonne si migration pas encore passée, comme
  `challenge_filters`).
- **Envoi** (`js/gameCore.js`) : `showChallengeButton(mode, score, targetPool)`
  — chaque mode passe son pool filtré **moins la cible du jour** ; le tirage se
  fait au clic d'envoi. Pools par mode : Classic/Silhouette noms filtrés, Emoji
  restreint aux persos avec données emoji, AOA noms filtrés, Personae **noms de
  persona** (identité de cible de ce mode), Music titres filtrés.
- **Acceptation** (`js/notifications.js`, `js/challenge-notif.js`) :
  `challenge_target` transporté jusqu'à `activeChallenge.target`.
- **Modes ×6** : la cible du défi prime sur le tirage du jour (et sur le random
  du Replay) tant que le défi est actif — `getActiveChallengeTarget(mode)` ; un
  refresh mi-défi reprend la même cible (persistée dans l'état du mode, wipé à
  l'acceptation). **Une partie de défi à cible dédiée n'est PAS enregistrée en
  session quotidienne** (`isChallengePlay(mode)`, capturé AVANT
  `checkChallengeCompletion` qui consomme `activeChallenge`) : pas de collision
  avec `uq_session_per_day`, pas de pollution stats/anti-triche, et la partie
  quotidienne du destinataire reste disponible.
- **Complétion** (`js/challenge-result.js`) : si le défi avait une cible dédiée,
  l'état du mode est effacé (`MODE_STATE_KEYS`, désormais exporté de
  `challenge-notif.js`) → le prochain chargement retombe sur la cible du jour
  (seedée, donc parfaitement restaurable).
- Tests : +6 tests Vitest `getActiveChallengeTarget`/`isChallengePlay`
  (mode-mismatch, ancien format, JSON corrompu, normalisation de graphie).

### Angles morts connus (à tester en navigateur)

- Le flux complet à 2 comptes (envoi → acceptation → partie → résultat) n'a pas
  encore tourné dans un vrai navigateur — priorité au prochain passage QA.
- Un défi Emoji dont la cible n'a pas de données emoji est impossible par
  construction côté envoi, mais un défi forgé à la main retomberait sur la
  cible du jour (fallback silencieux voulu).

---

## 2026-07-17 — fix(qa): 2e lot de retours de test manuel (Hamza)

Suite de la session de test manuel. Trois correctifs + deux décisions de design
laissées ouvertes.

### Détails techniques

- **Personae — portrait du propriétaire absent au refresh après un abandon**
  (`personaeMode/modePersonae.js`). À la restauration de session (bloc `if (storedGameOver)`),
  un abandon appelait `showVictory(true, null)` : `showVictory` ne pose le portrait
  que `if (name)`, donc zone image vide. L'abandon EN DIRECT passait pourtant bien
  `target.user[0]`. Fix : la restauration passe toujours le propriétaire du persona,
  quel que soit `force`.
- **Music — clé de garde quotidienne en UTC au lieu de Paris** (`musicsMode/modeMusic.js`,
  `personaeMode/modePersonae.js`). Music et Personae construisaient
  `statsLogged_<mode>_<date>` avec `new Date().toISOString()` (UTC) alors que les 4
  autres modes utilisent `parisDateKey()`. Conséquence : la garde « déjà joué »
  basculait à minuit UTC (1-2h du matin à Paris). Corrigé — `parisDateKey()` importé
  dans les deux fichiers (piège CLAUDE.md « toujours parisDateKey() »).
- **Music — thème couleur** (`musicsMode/modeMusic.js`, `musicsMode/music.css`,
  `musicsMode/database/songs.js`). (1) `setPlayerTheme` accepte désormais l'objet
  chanson et lit un champ `theme` explicite prioritaire sur l'opus. (2) Nouveau thème
  `VELVET` (bleu profond `#151da6`) pour les morceaux transversaux à toute la série ;
  *Aria of the Souls* (opus P3 en tête, présente dans tous les Persona majeurs) le
  reçoit via `theme: "VELVET"` — avant elle héritait du bleu P3. (3) P3P gagne un
  flag `duality` qui active une **bordure conique tournante mi-bleu (Makoto) /
  mi-rose (Kotone)** autour du player (`.p3p-duality`, `@property --p3p-angle` +
  `@keyframes`, garde `prefers-reduced-motion`).

### Décisions de design — TRANCHÉES par Hamza (implémentation dans un lot dédié)

Les deux points ci-dessous ont été **décidés** ; volontairement **pas implémentés
dans ce lot QA** car ce sont des features backend + anti-triche qui méritent leur
propre branche/PR + tests dédiés (ne pas polluer la PR QA propre).

- **✅ DÉCIDÉ — une victoire compte toujours, même après un abandon le même jour.**
  Choix produit Hamza : les give up sont déjà visibles dans les stats (le ratio est
  connu), donc pas de double peine ni d'attente d'un jour pour la récompense — 6
  victoires = récompense, même avec 55 abandons. Implémentation à prévoir :
  (1) client — la garde `statsLogged_<mode>_<date>` ne doit plus bloquer un `win`
  (mais toujours éviter le double-comptage win→win) ; (2) backend — `game_sessions`
  a `UNIQUE (user_id, mode, played_date)` : `personadle_record_game_session` doit
  **upserter** (si ligne du jour = `giveup` et nouveau = `win` → passer en `win`,
  ajuster `user_stats` : +1 win / −1 giveup, `games` inchangé) au lieu de lever un
  409. Angle mort assumé : l'abandon révèle la réponse, donc un win post-abandon est
  « gratuit » — accepté par Hamza.
- **✅ DÉCIDÉ — un défi tire une cible ALÉATOIRE dédiée, pas la cible du jour.**
  « Le défi doit défier » : nouvelle partie aléatoire dans le mode du défi, un autre
  perso/chanson à deviner (le même pour les deux joueurs). Implémentation à prévoir :
  (1) tirer une cible aléatoire à la création du défi et la **stocker/transmettre**
  dans le message (`api/messages`, nouveau champ `challenge_target` + éventuel seed) ;
  (2) état de partie de défi **séparé** du quotidien côté client ; (3) **exempter
  l'anti-triche** `api/lib/daily_target.php` pour les sessions de défi (cible ≠ cible
  du jour = normal) ; (4) gérer la contrainte `UNIQUE (user_id, mode, played_date)`
  de `game_sessions` (une partie de défi ne doit pas entrer en collision avec la
  partie quotidienne — soit table/flag distinct, soit ne pas la compter dans les
  stats quotidiennes).

## 2026-07-17 — fix(qa): lot de retours de test manuel (Hamza)

Session de test manuel sur une BDD vierge. Six retours traités en un lot ; deux
autres restent ouverts (voir « Angles morts » plus bas).

### Détails techniques

- **Stat communautaire retirée** — la ligne « X% of N players found this today! »
  (`showCommunityStats`, `js/gameCore.js`) encombrait/enlaidissait l'écran de
  victoire. Décision Hamza : suppression complète. La fonction devient un no-op
  (export conservé : 6 modes l'importent + `savePendingSession` l'appelle) ;
  plus d'injection DOM ni d'appel API. L'endpoint backend `community_stats` reste
  en place mais inutilisé (à retirer plus tard si on confirme). Bloc de tests
  `showCommunityStats` de `tests/gameCore.test.js` remplacé par 2 gardes-fous de
  non-régression (n'injecte plus rien, ne tape plus l'API).
- **AOA — réponse qui cassait en plein milieu** (`allOutAttackMode/modeAllOutAttack.js`).
  `showVictoryBox` passait de `textContent` à un rendu où le nom (souvent long en
  FR, ex : « Cherish ( Masaki Ashiya ) ») est isolé dans un `<span>` `white-space:nowrap`.
  Le template i18n reste intact via une sentinelle U+E000 (zone privée) qui n'apparaît
  jamais dans une traduction ; échappement HTML du `before`/`name`/`after`.
- **Code ami cliquable + lisible** (`profile/profile-page.js`, `profile/profile-page.css`).
  `_renderFriendCode` devient un `<button>` : clic = copie presse-papier
  (`navigator.clipboard` + fallback `execCommand` pour contexte non sécurisé),
  feedback inline « Copié ! ». Style passé de fantôme (opacity 0.5, 0.73rem) à un
  badge pill accentué. Nouvelles clés i18n `profile.friend_code_copy_hint` /
  `friend_code_copied` (×5 langues). Espacement ajouté entre le badge et le
  bouton « Change Picture » (`#editAvatarBtn` margin-top).
- **Wallpapers — conditions i18n + rappel au survol** (`profile/wallpapers-ui.js`,
  `profile/profile-page.css`). Les 7 conditions d'obtention étaient hardcodées en
  anglais : nouvelles clés `profile.wp_cond_*` (×5 langues) + helper
  `wallpaperConditionText()` (fallback sur la chaîne EN du catalogue). Un wallpaper
  **débloqué** affiche maintenant sa condition au survol (overlay `.wp-cond-hover`),
  comme badges/titres — avant, seul le nom apparaissait.
- **Bouton Save de la modale badges déplacé en bas** (`profile/badges/badgesManager.js`,
  `profile/profile-page.css`). Le bouton existait déjà mais était inséré en haut
  (après le compteur) — peu intuitif. Déplacé dans un footer sticky en bas de la
  modale, feedback inline « ✅ Badges saved! » garanti (ne dépend plus de
  `window.showToast` qui peut manquer), thèmes clair/sombre gérés.
- **Silhouette — image de Seiji** (`silhouetteMode/database/img/Seiji_silhouette.webp`)
  remplacée (l'ancienne ne rendait pas correctement).

### Angles morts / à suivre

- **Titre équipé qui ne persiste pas au Save** (`profile/titles-ui.js` +
  `profile-page.js`) — reproduit par Hamza mais pas encore corrigé : l'équipement
  est immédiat au clic (`saveProfileToCloud`), puis le Save global relance
  `pullProfileFromCloud` → suspicion de revert si le back ne remappe pas bien
  `equipped_title_id`↔slug (piège CLAUDE.md « état dérivé »). Nécessite une repro
  live à deux pour trancher. **Non inclus dans ce lot.**
- **AOA — 1er chargement des filtres lent (Ctrl+Shift+R)** : comportement Service
  Worker déjà documenté (§22.1 du TEST_PLAN), attendu après un `git pull`. Pas un
  bug — laissé tel quel.

## 2026-07-17 — style(auth): "mot de passe oublié" ne ressemble plus à un lien

Léo : malgré le fix PR25 (soulignement retiré), le texte se lit toujours comme un
lien classique. Carte blanche donnée par Hamza. Taille et poids augmentés
(0.8rem/400 → 0.92rem/600), couleur rapprochée du texte normal du formulaire
(hover → `var(--accent)`) — se lit maintenant comme un bouton texte intégré,
pas comme du texte de bas de page. `profile/profile-page.css`, `.auth-forgot-link`.

---

## 2026-07-17 — fix(streak-recovery): garde anti-clic-accidentel sur le fond du popup

Repéré en revue (comportement confirmé, discutable) : cliquer n'importe où sur
`#sr-backdrop` fermait le popup Jack Frost immédiatement, contrairement à la
modale login/register (PR26) qui a une garde anti-clic-accidentel. Carte blanche
donnée par Hamza pour trancher — implémenté (rien n'était perdu définitivement,
mais facile à fermer par erreur pour un truc important).

Fix : même pattern exact que `js/auth.js` (`_dragStartedInside` sur mousedown,
vérifié au click sur le fond) — adapté au fait que `#sr-backdrop` et `#sr-menu`
sont des éléments frères (pas un wrapper autour du contenu comme la modale login),
donc le check compare `e.target !== backdrop` au mousedown plutôt que
`e.target.id !== id`. 3 tests ajoutés (`tests/streakRecovery.test.js`).

---

## 2026-07-17 — feat(badges,titres,wallpapers): notifications de déblocage sur n'importe quelle page

Léo : "les notifications d'obtention doivent se faire peu importe la page, je
viens de gagner et hop notification si j'ai rempli les conditions". Point de
départ de l'investigation : les badges avaient déjà `checkBadgesAfterGame()`
(`profile/badges/badgesManager.js`) câblé dans les 6 modes de jeu depuis un
moment — mais **titres et wallpapers n'avaient strictement aucun équivalent**,
jamais vérifiés en dehors du chargement de la page profil.

En creusant pourquoi les badges eux-mêmes semblaient malgré tout capricieux
(cf. le fix `ace_defective` de la veille, qui ne couvrait que le chemin
serveur/cloud-sync), **deux vrais bugs distincts trouvés côté client** :

1. **`classiqueMode/modeClassique.js`** : le chemin Give Up n'appelait **jamais**
   `checkBadgesAfterGame()` — seul `checkGuess()` côté victoire l'appelait, dans
   un bloc explicitement gardé par `!forceReveal`. Un badge comme `ace_defective`
   (10 give-ups) ne se vérifiait donc jamais juste après l'action qui devait le
   débloquer.
2. **`silhouetteMode/modeSilhouette.js`** : `giveUp()` appelait `showVictory(true)`
   — qui déclenche `checkBadgesAfterGame()` en interne, à la toute fin — **avant**
   d'écrire `stats.giveups` pour CE give-up (le `updateProfileStats`/
   `savePendingSession` de `giveUp()` tournait après le retour de `showVictory()`).
   Le check tournait donc systématiquement sur le compteur d'avant, un tour de
   retard — corrigé en réordonnant : stats loggées avant l'appel à `showVictory()`.

`emojiMode`/`personaeMode`/`musicsMode`/`allOutAttackMode` (chemin give-up direct,
pas de fonction `showVictory()` partagée avec le même piège d'ordre) étaient déjà
corrects des deux côtés.

**Code mort trouvé au passage** : `allOutAttackMode/modeAllOutAttack.js` référençait
`window.forceCheckBadges` — jamais défini nulle part dans tout le repo (`grep`
confirmé), le bloc ne s'exécutait donc jamais. Remplacé par un vrai appel.

### Fix

- `profile/titles-ui.js` : nouvelle fonction exportée `checkTitlesAfterGame()`,
  même contrat que `checkBadgesAfterGame()` (lit `localStorage`, vérifie les
  conditions, notifie, ne rend rien de l'UI profil).
- `profile/wallpapers-ui.js` : idem, `checkWallpapersAfterGame()`.
- `js/unlock-notify.js` (nouveau) : `checkUnlocksAfterGame()`, point d'appel
  unique regroupant les 3 checks — évite de dupliquer 3 imports + 3 appels dans
  les 6 fichiers de mode. **Volontairement pas importé par `gameCore.js`** (qui
  reste sans imports statiques pour éviter tout risque de cycle avec `api.js`,
  cf. CLAUDE.md § Pièges critiques) — chaque mode l'importe directement, comme
  il importait déjà `badgesManager.js`.
- Les 12 points d'appel (6 modes × win/give-up) basculés sur
  `checkUnlocksAfterGame()` ; les 2 bugs ci-dessus corrigés au passage.
- `css/title-notification.css` (nouveau, extrait de `profile-page.css`) +
  `wallpaper-notification.css` : chargés désormais sur les 6 pages de mode en
  plus de `profile.html` — sans ça la notif se déclenchait bien en JS mais
  s'affichait sans style (`.title-notification`/`.wallpaper-notif` n'étaient
  stylées que sur `profile.html`). `.badge-notification`, lui, était déjà dans
  `global.css` — les notifs badges s'affichaient donc déjà correctement partout,
  juste jamais déclenchées au bon moment.

### Angle mort noté, pas recréé par erreur
`.title-rarity-tag` (utilisé dans le HTML généré par `titles-ui.js`, notification
et zoom) n'est stylé nulle part — même pas sur `profile.html` avant ce commit
(`grep` sur tout `profile-page.css` : 0 résultat). Pré-existant, pas dans le
périmètre de ce fix — vérifié pour ne pas l'inventer par erreur en extrayant le
CSS vers le nouveau fichier.

### Tests
20 nouveaux : `checkTitlesAfterGame` (titlesUi.test.js), `checkWallpapersAfterGame`
(wallpapersUi.test.js), `checkBadgesAfterGame` — jusqu'ici sans **aucune**
couverture malgré son usage déjà répandu — (badgesManager.test.js), et
`checkUnlocksAfterGame` bout-en-bout (nouveau `unlockNotify.test.js`).

---

## 2026-07-17 — docs: audit TEST_PLAN_DEV.md

Même traitement que `TEST_PLAN.md` la veille — relu contre le code réel, pas
juste contre sa propre description. Trouvé : incohérence interne (139 vs 168
méthodes PHPUnit citées à deux endroits différents du même document, écrits à
des moments différents de sa rédaction), "Menu de filtres (Jack Frost)" — mix-up
avec la récupération de streak (Jack Frost n'a rien à voir avec le panneau de
filtres opus, visiblement copié par erreur depuis la section §14 dédiée),
"Export/Import JSON" testé comme si le bouton Import existait alors qu'aucune
trace de ce bouton n'existe dans l'UI (`profile-page.js`, aucun HTML). "Chiffres
actuels" relabellisé "à la date de rédaction (6 juillet)" pour ne plus laisser
croire qu'ils sont à jour, avec pointeur vers `TEST_PLAN.md` §22-23 pour tout ce
qui est venu après (PR #25→#30, 17 juillet).

---

## 2026-07-17 — fix(badges): bfcache + collision de nom de persona (Naoto/Futaba)

Hamza : même famille de bug que le badge `ace_defective` de la veille (action faite,
badge pas débloqué, refaire l'action "corrige" — alors que ce n'est pas l'action qui
manquait). Exemple donné : badge "Chronological Convergence" (Naoto + Futaba), a dû
regagner une partie avec la persona de Naoto pour que le badge apparaisse.

Deux causes distinctes, pas une seule :

1. **bfcache jamais géré sur `profile-page.js`** — aucun listener `pageshow` nulle
   part dans le repo (`grep -rl pageshow` vide avant ce commit). Revenir sur la page
   profil via le bouton "précédent" du navigateur après avoir joué ailleurs restaure
   la page **depuis le cache mémoire**, sans ré-exécuter ce script : la variable
   module-level `profile` reste l'objet chargé AVANT la partie. `initBadgesSystem()`
   ayant déjà tourné une fois au tout premier chargement, rien ne le relance sur un
   retour bfcache — le badge fraîchement mérité reste invisible jusqu'au prochain
   rechargement complet **fortuit** de la page (typiquement : l'utilisateur, frustré,
   rejoue "pour être sûr", puis retape l'URL ou fait F5 au lieu de "précédent" — d'où
   l'illusion qu'il fallait rejouer). Fix : listener `pageshow`, si `event.persisted`
   relance `_fullCloudSync()` (qui inclut déjà `forceCheckBadges()` depuis le fix de
   la veille).
2. **Vrai faux-positif de badge, trouvé en creusant celui-ci en particulier** :
   `personaeMode/modePersonae.js` détectait la persona de Futaba via
   `["Necronomicon", "Prometheus"].includes(target.persona)` — mais "Prometheus" est
   le nom de la persona de **2 personnages différents** dans
   `personaeCharacters.js` (Futaba, P5/P5R, ligne ~512 ; Baofu, P2EP, ligne ~874).
   Gagner sur Baofu déclenchait `foundFutabaPersona = true` par erreur (unlock trop
   permissif, pas trop strict — n'explique pas le symptôme "il a fallu rejouer", mais
   bug réel trouvé au passage). Fix : vérifie aussi `target.user.includes("Futaba
   Sakura")`, pas seulement le nom de la persona.

### Angle mort restant
Vérifié que "Prometheus" est la SEULE collision de nom parmi les personas utilisées
par des conditions de badges à flags (`grep -c` sur chaque nom dans
`personaeCharacters.js` — tous les autres n'apparaissent qu'une fois). Si un futur
personnage réutilise un nom de persona déjà utilisé dans une condition de badge à
flags, même angle mort à vérifier au cas par cas — pas de garde générique ajoutée
(le système `condition_type='manual'` reste entièrement à base de flags ad hoc côté
client, cf. TEST_PLAN_DEV.md §2.11 sur les badges "à flags" laissés tels quels).

---

## 2026-07-17 — feat(auth): case "Remember me" réelle — décrite dans TEST_PLAN.md mais jamais codée

Hamza : "vérifie qu'on n'a pas un truc noté dans le plan de test mais pas codé".
Trouvé : `TEST_PLAN.md` §4.4 documentait un test pour une case "Remember me" "si elle
existe" — elle n'existait nulle part (`grep -ri remember js/auth.js` + tout le HTML :
0 résultat). `api/auth/login.php` posait pourtant déjà le cookie `remember_me` +
`remember_me_hash` en base à **chaque** connexion, sans condition — alors que
`lang/*.json` (`auth.cookies_body`, texte RGPD) décrivait déjà ce cookie comme
"optional... if you choose to stay logged in". Fonctionnalité à moitié construite :
le texte légal promettait un choix qui n'existait pas côté UI.

Fix : case à cocher réelle (`#loginRememberMe` dans `profile.html`, cochée par
défaut — comportement historique préservé si l'utilisateur n'y touche pas), envoyée
par `js/auth.js` en `remember_me` au login. `login.php` ne pose le cookie que si
`remember_me` est truthy (absent → `true`, compat clients pas encore à jour).
Décochée : révoque explicitement tout `remember_me_hash` déjà en base + expire le
cookie côté navigateur — sinon décocher n'aurait aucun effet sur un appareil déjà
"mémorisé" par une connexion précédente. Clé i18n `auth.remember_me` ajoutée aux
5 langues. `TEST_PLAN.md` §4.4 mis à jour pour tester coché **et** décoché.

---

## 2026-07-17 — fix(classic,badges): victoryBox persiste après reset + badge giveups_total jamais re-vérifié après cloud sync

Léo (test §22) : "j'ai fait reset en Classic mode mais l'image de victoire est
restée à l'écran" + "j'ai pas réussi à débloquer ace_defective malgré 10+ give-ups".

**Classic mode** : `resetButton` (classiqueMode/modeClassique.js) remettait à zéro
`attempts`/`history`/tous les champs d'input, mais oubliait de cacher
`#victoryBox` — contrairement aux 4 autres modes concernés (allOutAttack, personae,
music, emoji) qui le font tous en tête de leur handler de reset, juste après
`gameOver = false; attempts = 0;`. Vérifié via grep croisé sur les 5 fichiers de
mode — silhouetteMode utilise un mécanisme différent (élément `.victory-box` créé/
détruit dynamiquement, déjà correctement nettoyé dans son `resetGame()`), donc pas
concerné. Fix : ajout de `document.getElementById("victoryBox").style.display =
"none";` au même endroit que les autres modes.

**Badge ace_defective (`giveups_total >= 10`)** : bug d'ordre d'exécution, pas de
logique de comptage — `api/lib/game_session.php` incrémente bien `user_stats.giveups`
à chaque give-up, et `js/profileStats.js`/`js/cloud-sync.js` répercutent
correctement ce total dans `profile.stats.giveups` (local à chaque give-up, cloud
au pull). Le vrai trou : `initBadgesSystem()` (donc `checkAndUnlockBadges()`) est
appelé de façon **synchrone** au chargement de `profile-page.js`, avant que
`pullProfileFromCloud()` (async, dans `_fullCloudSync()`) ait eu la moindre chance
de résoudre et d'écraser `profile.stats` avec le total serveur autoritatif. Tout
badge dont la condition dépend d'un stat agrégé multi-device/multi-session
(`giveups_total`, mais potentiellement d'autres) n'est donc testé qu'une seule
fois, contre un profil local possiblement périmé — et jamais re-testé une fois
les données fraîches arrivées. Classique cas "État dérivé" (CLAUDE.md §13) :
tracer les écritures ne suffit pas, il fallait aussi tracer *quand* la lecture
(le check) a lieu par rapport à ces écritures.

Fix : appel de `forceCheckBadges(profile, saveProfileAndSyncBadges)` dans
`_fullCloudSync()`, juste après `pullProfileFromCloud()`/`_applyCloudToUI()` et
avant `syncBadgesWithBackend()` (pour que tout badge fraîchement débloqué soit
inclus dans le push local→cloud qui suit).

### Angle mort restant
`initBadgesSystem()` (1er check, synchrone) et ce nouveau `forceCheckBadges()`
(2e check, post-sync) tournent tous les deux à chaque chargement de page profil —
redondant mais inoffensif (`checkAndUnlockBadges` ignore déjà les badges présents
dans `profile.badges`). Pas de fix nécessaire, juste noté pour éviter la surprise
en lisant les logs console (`🎉 Badge unlocked` peut apparaître différé de
quelques centaines de ms après le premier rendu de page).

---

## 2026-07-17 — fix(profile): code ami jamais affiché sur son propre profil

Léo : "on peut toujours pas voir notre code ami" — signalé pendant le test de §9
(système social), qui suppose que le code ami est visible sur son propre profil
(explicitement documenté ainsi en tête de §9 dans `TEST_PLAN.md`).

Confirmé un vrai trou, pas une question de config : le backend renvoie bien
`friend_code` (`api/auth/me.php`, `api/user/index.php`), et `profile/profile-view.js`
l'affiche déjà correctement pour un profil **public** (`.profile-friend-code`, classe
CSS déjà stylée dans `profile-page.css`). Mais `profile/profile-page.js` (sa propre
page de profil, connecté) ne l'a jamais câblé — fonctionnalité à moitié construite.

Fix : nouvelle fonction `_renderFriendCode()` dans `profile-page.js`, même pattern que
`profile-view.js` (élément `.profile-friend-code` sous le pseudo dans
`.avatar-card-info`). Idempotente (créée une fois, réutilisée) et appelée dans
`_fullCloudSync()` (login/auth-ready) + au logout (retire l'élément, `window._currentUser`
déjà à `null` à ce moment).

Non testé unitairement — même choix que pour `js/auth.js` (orchestration DOM, cf.
convention de ce projet) ; à vérifier manuellement/E2E.

---

## 2026-07-17 — fix(404): chemins relatifs cassés + doc test plan codes événement

Trouvé en creusant les retours de Léo sur les PR #25-28 fraîchement testées.

### `pages/404.html` — chemins relatifs résolus par rapport à la mauvaise URL

`.htaccess` sert cette page via `ErrorDocument 404 /pages/404.html` (chemin absolu),
mais Apache ne change pas l'URL du navigateur pour un ErrorDocument — elle reste celle
qui a cassé. Tous les chemins **relatifs** de la page (`../css/*.css`, `../img/*.gif`,
imports `../js/*.js`, `../sw.js` pour l'enregistrement du Service Worker,
`../index.html` sur le bouton retour) se résolvaient donc par rapport à l'URL cassée,
pas par rapport à `pages/` — comportement incohérent selon la profondeur de l'URL
d'origine (peut fonctionner par coïncidence pour une URL cassée à la racine, casser pour
une URL cassée plus profonde). Correspond exactement au signalement de Léo : le bouton
"Return to PersonaDLE" ne ramenait pas au bon endroit.

Fix : tous les chemins passés en absolu (`/css/...`, `/img/...`, `/js/...`, `/sw.js`,
`/index.html`). Fonctionne pour Docker local et Hostinger (tous deux servis à la racine
du domaine) — angle mort connu et accepté : ne couvre pas un déploiement Apache local
hors-Docker servi sous un sous-chemin `/personadle/` (cf. CLAUDE.md §3), cas de moins en
moins pertinent vu que `make up` est le flux documenté.

### `TEST_PLAN.md` §8.3 — instruction obsolète (champ "quota" inexistant)

La section demandait de renseigner un "quota" à la création d'un code événement — ce
champ n'existe ni dans `admin/event-codes.js` ni dans la table `event_codes`. Réécrite
pour matcher le vrai formulaire (Code, Badge ID = slug exact, Description, Code
permanent, Date début/fin). Ajout d'une note de diagnostic (onglet Network → réponse de
`redeem`) pour la prochaine fois qu'un testeur rapporte "le code n'existe pas" sans plus
de détail — cause exacte encore non identifiée au moment de ce commit (piste : Léo à
recontacter avec la réponse HTTP précise).

### Non résolu / à trancher

- **Popup streak recovery** : `#sr-backdrop` ferme le popup au moindre clic, sans la
  garde anti-clic-accidentel ajoutée à la modale login/register (PR #26,
  `_dragStartedInside`). Rien n'est perdu définitivement (le bouton profil reste
  disponible ensuite), mais correspond au "despawn" rapporté par Léo. Pas corrigé ici —
  "cliquer dehors pour fermer" peut être un choix voulu, à confirmer avant de toucher au
  comportement.
- **Panel admin mobile** : code du tiroir (`admin.css`/`admin.js`) relu, structurellement
  correct (position fixed, transform, overlay, z-index). Signalé par Léo comme "pas
  optimisé" mais pas de bug identifié dans le code — à reconfirmer s'il a bien utilisé le
  bouton ☰.

## 2026-07-17 — fix(css): `.badge-notification` déborde sur petits viewports

`css/global.css` : `min-width: 300px; max-width: 360px;` faisait déborder la
notification de déblocage de badge à gauche sur viewports très étroits
(iPhone SE 1ère gen : 320 px — bord gauche à −60 px, hors écran).
Remplacé par `min(300px, calc(100vw - 40px))` / `min(360px, calc(100vw - 40px))`
pour que la notification reste toujours dans le viewport avec 20 px de marge
de chaque côté.

Note : la PR d'origine (#28) proposait aussi un fix `_addAdminNavItem`
(profondeur `/profile/friends/`, `/profile/leaderboard/`) et une correction
`lang/README.md` (967 → 968 clés) — les deux étaient déjà appliqués sur
`develop` au moment du merge (PR #26 et le fix `docs:fix` de PR #27,
respectivement) ; la branche #28 avait divergé avant ces merges. Rebasée
sans conflit fonctionnel, seul le fix CSS restait réellement nouveau.

---

## 2026-07-16 — fix: streak recovery visuel + challenges classiques + console + admin responsive

### Streak recovery (bug 14.2)

- **`profile/profile.html`** : ajout `<div id="streakRecoveryPrompt" class="srp hidden">` entre `statsContainer` et `modeStatsContainer`.
- **`js/streak-recovery.js`** : export de `getPreviousStreak()` — retourne `previousStreak` stocké en localStorage (0 si absent).
- **`profile/profile-page.js`** : quand `streak === 0 && canRecover() && previousStreak > 1`, injecte un bouton proéminent "❄️ Rallumer — 0 → N jours" qui déclenche `showStreakRecoveryMenu(prev)`. Animation ❄️ gelée ajoutée sur la carte streak tier-0 (`streakIceGlow`, `flakeSpin`).
- **`profile/profile-page.css`** : `.stat-streak-t0` (fond bleu glacier, border translucide, glow cyclique), `.streak-side-flake` (rotation infinie), `.srp-btn` (gradient bleu-cyan, hover subtil).
- **`lang/{en,fr,es,de,it}.json`** : clé `streak_recovery.profile_btn` ajoutée dans les 5 langues.

### Challenges classiques (bug classique)

- **`classiqueMode/modeClassique.js` l.558** : `textbar.value = ""` à l'init — empêche le bfcache de restaurer la saisie précédente de Player A quand Player B ouvre le même classiqueMode.html depuis une notification.
- **`classiqueMode/modeClassique.js` l.753-755** : guard `if (localStorage.getItem("activeChallenge")) return;` dans le callback de `checkResetOnLoad`. Sans ce guard, un Player B n'ayant pas encore joué aujourd'hui déclenchait `resetButton.click()` (reset aléatoire via `Math.random()`) qui écrasait la cible quotidienne déterministe posée par `getDailyTarget` — entraînant Igor comme cible sur les pools filtrés minuscules.

### Console (bug 6.3)

- **`profile/badges/badgesManager.js` l.421** : suppression du `console.log("🔍 Checking badges...")` appelé à chaque `DOMContentLoaded` (toutes les pages chargent l'index, qui appelle `checkBadgesAfterGame` en permanence).

### Admin responsive (bug 11.5)

- **`admin/admin.css`** breakpoint `max-width: 480px` : `.admin-header-right` passe en `overflow-x: auto; flex-shrink: 1; min-width: 0` avec enfants `flex-shrink: 0`. Permet de scroller la barre des boutons (Codes, Logs, Audit, RGPD, Rate Limits) sans les cacher — les fonctions restent accessibles sur mobile sans régression.

---

## 2026-07-16 — fix: onglet Admin nav + stats profil i18n + drag-to-close modale

Trois bugs isolés corrigés dans la même PR.

### Onglet Admin manquant sur friends/leaderboard (`js/auth.js`, `js/bottomNav.js`)

`personadle:auth-ready` n'était jamais dispatché : seul `personadle:auth-login` existait,
déclenché uniquement lors d'une connexion manuelle. Sur les pages friends et leaderboard,
`initBottomNav()` est appelé avant que la promesse `initAuth()` soit résolue — le check
synchrone `window._currentUser?.is_admin` échoue, et le listener `personadle:auth-ready`
ne se déclenchait jamais → l'onglet Admin n'apparaissait pas.

Fix : dispatch `personadle:auth-ready` dans le bloc `finally` d'`initAuth()`, après
`window._authResolved = true`.

Second bug associé : le calcul du href admin dans `_addAdminNavItem()` ne distinguait
pas les pages 2 niveaux de profondeur (`/profile/friends/`, `/profile/leaderboard/`)
— elles recevaient `../admin/` au lieu de `../../admin/`. Corrigé en réutilisant
le pattern `isDeepSubpath` déjà présent dans `buildHrefs()`.

### Stats profil en anglais quelle que soit la langue (`profile/profile-page.js`)

Les labels des stats (`renderStats`) et des en-têtes du tableau de modes
(`renderModeStats`) étaient des chaînes hardcodées en anglais, ignorant les clés i18n
qui existent pourtant dans `lang/*.json` :
`profile.stat_wins_label`, `stat_giveups_label`, `stat_games_label`,
`stat_best_streak_label`, `stat_time_label`, `stat_first_played_label`,
`stat_fav_mode_label`, `stat_current_streak_label`, `mode_col_mode`, `mode_col_games`.

Fix : remplacement par `tf()`. Ajout de `renderModeStats()` dans le listener
`personadle:i18n-ready` (seul `renderStats()` y était, le tableau de modes restait
donc en anglais même après changement de langue).

### Drag text → fermeture modale compte (`js/auth.js`)

Si l'utilisateur sélectionnait du texte dans le formulaire et relâchait la souris
sur le backdrop, le navigateur générait un `click` sur le backdrop (cible commune
du mousedown/mouseup) → fermeture involontaire de la modale.

Fix : flag `_dragStartedInside` posé sur `mousedown`. Le handler `click` ignore la
fermeture si le drag a commencé à l'intérieur du contenu de la modale.

---

## 2026-07-16 — feat: nouveau logo + avatars Theodore + correctifs UI/perf

### Logo

`img/New_Logo_PersonaDLE.png` remplace `img/Logo_PersonaDLE.png` dans tous les
points d'entrée : `index.html` (src + og:image), les 6 pages mode, `README.md`.
L'ancien fichier reste présent pour l'affichage avant/après dans `PersonaDLE_Update.html`.

### Avatars Theodore (P3 Portable)

`theodore.jpeg`, `theodore2-5.jpeg` ajoutés dans `profile/avatars_data.js` (groupe P3),
juste après Elisabeth/Elisabeth2. `img/avatar/` contient déjà les fichiers — le
user les a déposés manuellement.

### Fix gitignore — illustrations docs

`.gitignore` : ajout de règles `!` pour `*.png`, `*.jpg`, `*.jpeg`, `*.gif`,
`*.webp`, `*.pdf`, `note_ajout.md`, `PersonaDLE_Update.md` dans
`PersonaDLE_Update_Documentation/PersonaDLE 2.0/`. 13 fichiers de doc précédemment
exclus sont maintenant versionnés.

### Fix "Mot de passe oublié?" — ressemble à un lien

`.auth-forgot-link` dans `profile/profile-page.css` : suppression de
`text-decoration: underline`, couleur neutre muted au lieu de la couleur accent
rouge. Hover subtil au lieu du `filter: brightness`. Aucun changement fonctionnel.

### Fix AOA lag — CDN CloudFlare R2 exclu du SW

`sw.js` : le CDN R2 (`pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev`) était capturé
par la stratégie `cacheFirst` des images, créant des réponses opaques stale qui
causaient le lag du mode All-Out Attack (Ctrl+Shift+R le contournait). Ajout d'un
cas `network-only` avant `cacheFirst`. CACHE_VERSION bumped `v74 → v75`.

### Grille index — 2 colonnes + tailles ajustées

`css/index.css` :

- `#gameModeSelector` : grille 2×3 sur desktop (>768px). Colonne gauche :
  Classique, Emoji, All-Out Attack. Colonne droite : Silhouette, Personae, Music.
  `grid-template-columns: repeat(2, 1fr)`, max-width 900px.
- `.gamemode-title` : font-size 36px → 27px (proportionnel 75 %), responsive
  adapté (22px → 16px sur tablette, 16px sur mobile).

### Fix background 404

`pages/404.html` : redesign du background — gradient diagonal plus marqué,
motif de lignes en relief, suppression des scanlines plates au profit d'un
effet velvet room plus riche visuellement.

---

## 2026-07-16 — fix(build): Makefile portable Windows natif (sans Git Bash/WSL)

Trouvé en aidant un testeur (Windows, PowerShell natif) : `make test-php`
échouait avec `'test' n'est pas reconnu` / `'wget' n'est pas reconnu`.

`SHELL := /bin/bash` ne résout à rien sur Windows natif (le chemin littéral
`/bin/bash` n'existe pas hors WSL) — Make retombe silencieusement sur
`cmd.exe`, qui n'a ni `test`, ni `wget`, ni `grep`/`sort`/`awk`, ni `rm`.
3 cibles en dépendaient :

- `$(PHPUNIT_PHAR)` (`test -f || wget`) → `scripts/download_phpunit.js`
  (télécharge via le module `https` de Node, suit les redirections, no-op si
  le fichier existe déjà)
- `help` (`grep | sort | awk`) → `scripts/make_help.js` (parse le Makefile
  lui-même)
- `clean` (`rm -f`/`rm -rf`) → `scripts/clean_artifacts.js`
  (`fs.rmSync(..., { recursive: true, force: true })`)

Node est déjà une dépendance obligatoire du projet (Vitest) donc ces 3
scripts tournent identiquement sur Windows/Mac/Linux/CI, sans dépendre du
shell que `make` choisit d'invoquer. `SHELL := /bin/bash` retiré (plus aucune
cible n'a besoin de syntaxe bash — `&&`/`||`/sous-shells) ; toutes les autres
cibles (`up`/`down`/`db-import`…) n'appelaient déjà que des binaires
multiplateformes (`npm`, `php`, `docker compose`) et n'ont pas changé.

### Angle mort documenté

Le téléchargement réel de `phpunit.phar` n'a pas pu être testé de bout en
bout dans cette session (proxy sandbox bloquant `phar.phpunit.de`, cf.
`/__agentproxy/status` → `connect_rejected`) — vérifié à la place : usage
sans argument, no-op si le fichier existe déjà, `make help`/`make clean`
réellement exécutés via `make` (pas juste les scripts isolés), `php -l`/
`npm run lint` propres. Le téléchargement effectif reste à confirmer par un
contributeur (CI ou local) non bloqué par ce proxy.

### `test-php` déplacé vers Docker (suite du même fil)

Le même testeur n'avait pas PHP installé nativement sur Windows (seulement
dans le conteneur `personadle_php`, monté sur `.:/var/www/html`) —
`php phpunit.phar` échouait avec `php n'est pas reconnu`. Plutôt que
d'exiger un PHP natif juste pour lancer les tests (jamais documenté comme
prérequis), `test-php` tourne maintenant dans le conteneur :
`$(DC) exec -T php php $(PHPUNIT_PHAR)` au lieu de `php $(PHPUNIT_PHAR)`.
Nécessite `make up` (déjà un prérequis documenté dans `CONTRIBUTING.md`).
Confirmé fonctionnel en conditions réelles côté testeur : 175 tests, 317
assertions, 71 skipped (attendu — tests d'intégration BDD spécifiques).

`CONTRIBUTING.md` mis à jour en conséquence (retire la mention implicite
d'un PHP natif requis).

## 2026-07-16 — fix(api): rateLimit() fail-open + erreur JS brute côté auth

Bug remonté par un testeur (compte local, schéma Docker périmé) : inscription
impossible, message d'erreur JS interne affiché à l'utilisateur.

- **`js/auth.js`** (PR #22) : `setupLoginForm()`/`setupRegisterForm()`
  affichaient `err.message` brut pour toute erreur non reconnue par
  `resolveLoginError`/`resolveRegisterError` — y compris une `TypeError` JS
  interne (`const { user } = await api.auth.register(...)` avec `user` `null`
  quand `apiCall()` reçoit un statut succès mais un corps non-JSON). Fix :
  n'afficher le message brut que si `err instanceof ApiError`, sinon message
  générique traduit.
- **`api/bootstrap.php` — `rateLimit()`** : cause racine trouvée côté serveur
  du testeur — sa table `rate_limits` n'existait pas (volume Docker créé
  avant l'ajout de cette table à `sql/bdd_mysql.sql`, jamais recréé depuis).
  `rateLimit()` n'avait aucune gestion d'erreur et est appelée en tout premier
  sur chaque endpoint protégé (login, register, sessions, messages…), avant
  tout `try/catch` de l'endpoint lui-même : une `PDOException` (table
  manquante, coupure BDD momentanée) faisait planter tout l'endpoint avec une
  fatal error PHP brute — renvoyée en HTTP 200 par Apache/mod_php (pas 500),
  ce qui explique le corps non-JSON reçu côté frontend. Fix : `rateLimit()`
  attrape désormais l'exception, journalise (`error_log`), et **fail open**
  (laisse passer la requête plutôt que de planter l'endpoint). Compromis
  volontaire : en cas d'indisponibilité de `rate_limits`, le throttling est
  temporairement inactif plutôt que de bloquer toute l'API — accepté car le
  scénario déclencheur (table manquante/BDD indisponible) est déjà couvert
  côté disponibilité générale par `pdo()` (503 sur échec de connexion), et le
  risque d'abus pendant cette fenêtre est jugé plus faible que le risque de
  panne totale de l'auth pour un incident BDD ponctuel.

### Angle mort documenté

Aucun test unitaire dédié à `rateLimit()` (testé indirectement via
`DatabaseIntegrationTest.php`, qui nécessite Docker/MariaDB — non exécutable
en session sandboxée, comme les autres tests d'intégration PHP de ce projet).
Vérifié : `php -l` sur tout `api/`, `npm test` (482/482), et
`DatabaseIntegrationTest::testDatabaseSchema` couvre déjà la présence de
`rate_limits` (« schéma Docker périmé ? ») — confirmera en CI que ce fix ne
casse rien côté intégration BDD.

## 2026-07-12 — fix: régression port E2E (8090) + avatarSrc stale après cloud sync

Corrections suite à une review de la PR `feat/ui-pages-joker-profile-kotone`.

- **Port E2E** : `playwright.config.js` et les specs `admin.spec.js`,
  `admin-extended.spec.js`, `api.spec.js`, `social-link.spec.js` avaient basculé
  le défaut de `8080` vers `8090`, exactement l'inverse du fix déjà documenté le
  2026-07-04 (`docker-compose.yml`/`.env.example` exposent `8080` par défaut).
  La CI restait verte car `PLAYWRIGHT_BASE_URL` y est fixé explicitement — le
  cassage n'était visible qu'en local (`make up` + `npm run test:e2e` sans
  variable d'env). Remis à `8080` partout (config, 4 specs, `TEST_PLAN.md`,
  `TEST_PLAN_DEV.md`).
- **`profile.avatarSrc` stale après sync cloud** : `js/cloud-sync.js` écrit
  `p.avatar` depuis `avatar_data` mais ne touchait jamais `p.avatarSrc`. Or
  `profile/titles-ui.js` donne la priorité à `avatarSrc` sur `avatar` pour la
  condition du titre "Looking Cool" (déblocage via avatar Joker/Ren, ajouté
  dans cette même PR) — un changement d'avatar légitime via cloud pull sur un
  autre appareil laissait `avatarSrc` pointer sur l'ancien avatar, gardant le
  titre affiché comme débloqué à tort. Fix : `delete p.avatarSrc` dans
  `pullProfileFromCloud()` dès que `avatar_data` est mis à jour.

---

## 2026-07-11 — Migrations BDD Hostinger m000→m022 + audit schéma

Application de toutes les migrations en attente sur la base Hostinger
(MariaDB 11.8.8) et alignement du schéma de production.

### Migrations appliquées

- Script consolidé idempotent `sql/migration_hostinger_full.sql` (m000→m022) :
  tables `badges`, `wallpapers`, `event_codes`, `rate_limits`, `error_log`,
  `admin_audit_log`, `social_link_ranks`, `social_links`, `social_link_badge_configs`,
  `social_link_interactions`, `social_link_rankup_notifs`, `leaderboard_cache` ;
  colonnes ajoutées : `users.global_streak/record/date`, `users.reset_token_*`,
  `users.streak_recovered_at`, `badges.condition_*`, `wallpapers.condition_*`,
  `titles.condition_mode` ; slugs de titres normalisés.

### Correctifs appliqués (spécifiques Hostinger)

- `friendships.seen_at` : ajouté sans `AFTER accepted_at` (colonne inexistante
  sur Hostinger — schema Hostinger n'a jamais eu `accepted_at`).
- `titles.condition_mode/type/value` : colonnes manquantes sur Hostinger
  (créées localement dans `bdd_mysql.sql` sans migration correspondante).
- `social_link_rankup_notifs` FK : `recipient_id`/`partner_id` étaient `INT(11)`
  (signé) alors que `users.id` est `BIGINT(20) UNSIGNED` → corrigé, FK ajoutées.
- `ADD CONSTRAINT IF NOT EXISTS` : syntaxe non supportée sur MariaDB 11.8 pour
  les FK → remplacé par pattern `PREPARE/EXECUTE` conditionnel.
- `leaderboard_cache.uq_leaderboard` : déjà à 5 colonnes (metric inclus),
  aucune action requise.

### Audit schéma (hostinger vs local)

Export `sql/hostinger_current_schema.sql` (snapshot 2026-07-11). Diffs connus
sans impact fonctionnel :

- `friendships` : `accepted_at` existe localement, pas sur Hostinger.
- `titles`/`social_link_ranks` : colonnes `name_jp`, `description_*` localement
  uniquement (pas de langue JP en prod).
- `user_titles`/`user_stats`/`badges_unlocked` : PK avec `id` auto-increment
  local, PK composite sur Hostinger.
- `game_sessions.result` : `VARCHAR` local vs `ENUM` Hostinger.
- Types `ENUM` vs `VARCHAR` sur `rarity` (titles/badges) — valeurs identiques.

### Correction post-review (2026-07-12)

Le script `migration_hostinger_full.sql` committé ne reflétait pas fidèlement les
correctifs listés ci-dessus (probablement appliqués à la main sur Hostinger sans
être reportés dans le fichier). Corrigé :

- `friendships.seen_at` : `AFTER accepted_at` remplacé par `AFTER updated_at`
  (le script plantait sur une base fraîche, `accepted_at` n'existant pas).
- `social_link_rankup_notifs.recipient_id/partner_id` : `MODIFY COLUMN` vers
  `BIGINT UNSIGNED` ajouté avant les `ADD CONSTRAINT` (m015) — la FK vers
  `users.id` échouait sinon (type mismatch, la colonne restait `INT` depuis m009).
- `ADD CONSTRAINT IF NOT EXISTS` (FK) réellement remplacé par le pattern
  `PREPARE/EXECUTE` conditionnel (il était encore utilisé tel quel en m015).
- `social_link_rankup_notifs.is_badge_prompt` : colonne présente sur Hostinger
  mais absente du script — ajoutée (`ADD COLUMN IF NOT EXISTS`).
- Rappel de sauvegarde ajouté avant le `DROP TABLE IF EXISTS social_link_badges`
  (destructif, aucun backup mentionné auparavant).

---

## 2026-07-04 — Sécurité, tests réels, CI E2E (revue de projet)

Suite à une revue complète du projet sur `develop` : correctifs de sécurité,
correction de tests qui vérifiaient une copie du code plutôt que le code
réel, et branchement des tests E2E en CI. Pas de nouvelle feature joueur.

### Sécurité

- **CSRF (synchronizer token / double-submit cookie)** — documenté dans
  CLAUDE.md §5.1 mais jamais implémenté (SameSite=Lax seul). Ajouté :
  - `api/lib/authz.php` : `personadle_csrf_required(method)` et
    `personadle_csrf_valid(sessionToken, headerToken)` — logique pure, testée
    (`tests/php/AuthzTest.php`, 7 nouveaux tests).
  - `api/bootstrap.php` : émet un cookie `csrf_token` lisible par JS (pas
    HttpOnly — c'est le principe du double-submit) dès l'ouverture de session,
    et `requireCsrf()` (appelée depuis `requireAuth()`) vérifie le header
    `X-CSRF-Token` pour toute méthode mutante (POST/PATCH/DELETE/PUT).
  - **Portée volontairement limitée aux endpoints authentifiés** (via
    `requireAuth()`) : login/register/reset-password/logout restent protégés
    par SameSite=Lax uniquement. Justification : le token CSRF de session
    n'existe de façon fiable côté client qu'après un premier GET (ex.
    `initAuth()` → `GET /auth/me` au chargement de page) — l'imposer sur
    l'endpoint de login lui-même casserait le cas d'un POST de login comme
    toute première requête réseau de la page. Cette portée couvre l'essentiel
    du risque réel (actions authentifiées : profil, amis, RGPD…), conforme à
    la recommandation OWASP de prioriser les actions à état plutôt que
    l'authentification elle-même.
  - `js/api.js` : nouvel export `getCsrfToken()` (lit le cookie), header
    `X-CSRF-Token` ajouté automatiquement dans `apiCall()`.
  - `admin/admin.js` (fetch wrapper indépendant de `js/api.js`) et
    `js/streak-recovery.js` (fetch direct vers `/api/user/recover-streak`,
    authentifié) mis à jour individuellement — ce sont les 2 seuls appels
    mutants authentifiés en dehors de `js/api.js`.
  - CORS : `Access-Control-Allow-Headers` étendu avec `X-CSRF-Token`
    (sinon le preflight OPTIONS rejette la requête réelle).

- **Secret cron en header plutôt qu'en query string** — `api/cron/{leaderboard,
  hard-delete,purge-rate-limits}.php` lisaient `$_GET['key']`, qui finit en
  clair dans les logs d'accès HTTP (serveur/proxy). Remplacé par
  `requireCronSecret()` (nouvelle fonction dans `bootstrap.php`, factorise les
  3 copies identiques) qui lit le header `X-Cron-Key`. Mis à jour :
  `docs/hostinger-cron-setup.md` (réécrit, documente les 3 crons — il ne
  documentait auparavant que `leaderboard.php`) et `DEPLOY.md` (exemples
  `wget --header=`/`curl -H`).

### Tests — corriger les tests qui vérifient une copie du code

Trois suites Vitest réimplémentaient la logique testée au lieu d'importer la
vraie fonction, avec un commentaire "cannot be imported directly" — ce qui
veut dire qu'une régression dans le vrai code peut passer inaperçue tant que
la copie du test reste correcte.

- **`js/filterMenu.js`** : `_migrate()` (migration des filtres opus legacy)
  n'était pas exportée. Ajout d'un export réservé aux tests :
  `export { _migrate as migrateLegacyOpusFilters }`. `tests/gameCore.test.js`
  importe maintenant la vraie fonction au lieu d'une copie de
  `LEGACY_EXPAND`/`_migrate` maintenue à la main dans le fichier de test.

- **`js/api.js`** : `api.stats.syncPending()` est exporté (propriété de l'objet
  `api`) mais appelle `fetch()` réel — le test le contournait avec un helper
  `syncPendingLoop()` recopiant la boucle documentée. Remplacé par un appel
  direct à `api.stats.syncPending()` avec `vi.stubGlobal("fetch", …)` pour
  contrôler les réponses (409 / erreur réseau). Effet de bord découvert :
  `js/api.js` fait `window._personadleApi = api` à l'import — comme
  `tests/gameCore.test.js` importe désormais `{ api }`, ce side-effect
  s'applique à **tout le fichier de test**, pas seulement aux nouveaux tests.
  Ça cassait silencieusement les tests `savePendingSession` existants (qui
  supposaient `window._personadleApi === undefined` par défaut) : leur
  `beforeEach` réinitialise maintenant explicitement `window._personadleApi
  = undefined`.

- **`js/auth.js`** : `updateAuthUI()` n'était pas exportée ("dépendances DOM
  complexes" selon le commentaire du test — en réalité aucune, jsdom suffit).
  Exportée telle quelle, `tests/backend.test.js` importe la vraie fonction.
  **Ceci a révélé un vrai trou de couverture** : la copie du test ne
  reproduisait pas la synchronisation `localStorage.playerUserId` que fait la
  vraie `updateAuthUI()` (utilisée par `getPlayerSeedId()` dans
  `gameCore.js` pour la cible quotidienne). Un nouveau test couvre ce
  comportement (`tests/backend.test.js`).

Résultat : 449 tests Vitest passent (448 → +1 net ; 3 tests réécrits sans
changer le total, 1 nouveau test ajouté sur le gap `playerUserId` découvert).

### CI / E2E

- **Job `e2e` ajouté à `.github/workflows/ci.yml`** : démarre la stack Docker
  complète (`docker compose up -d --build`), attend que `/api/auth/me`
  réponde, lance `npx playwright test` contre `http://localhost:8080`, dump
  les logs Docker en cas d'échec. Marqué `continue-on-error: true` — premier
  branchement, à retirer une fois la stabilité confirmée sur plusieurs runs.
- **Bug de config découvert en préparant ce job** : `playwright.config.js` et
  2 specs (`api.spec.js`, `social-link.spec.js`) avaient `8090` comme port par
  défaut, alors que `docker-compose.yml`/`.env.example` exposent le site sur
  `8080` par défaut. `TEST_PLAN.md` documentait déjà ce mismatch comme un
  contournement connu (`PLAYWRIGHT_BASE_URL=http://localhost:8080` à passer
  systématiquement) plutôt que de corriger le défaut. Le défaut est maintenant
  `8080` dans les 3 fichiers — la variable d'env reste disponible pour
  surcharger si `.env` change `APP_PORT`.

### Documentation interne

- `js/gameCore.js` : docblock d'en-tête resynchronisé avec les 20 exports
  réels du fichier (`MODES`, `normalizeModeKey`, `modeLabel`,
  `FILTER_STORAGE_KEYS`, `showChallengeButton` manquaient).
- `CLAUDE.md` §8 : "242 tests, 8 suites" → "448 tests, 24 suites" (comptage
  réel via `npm test`), et note sur le job `e2e` en CI.
- `js/i18n.js` : docblock dupliqué de `initLang()` supprimé (gardé la version
  avec le bon type de retour `Promise<string>`).
- `README.md` : date "Last updated" (mai → juillet 2026).
- `ROADMAP.md` : ajout de 2 points identifiés pendant la revue —
  anti-triche absent sur `api/sessions.php` (`daily_targets` jamais lu côté
  serveur, un joueur connecté peut POST un résultat arbitraire) et
  duplication de `initializeAutocomplete()`/dark-mode inline dans les 6
  fichiers de mode (`js/autocomplete.js`/`js/gameCore.js` existent déjà pour
  ça). Le point sur le bloat `.git` était déjà tracké (ROADMAP.md +
  AMELIORATIONS.md), pas dupliqué.

---

## 2026-07-04 — `347561d` feat(admin): panel admin — audit trail, RGPD, rate limits + a11y modales

- **Focus trap générique** : `js/modal.js` (nouveau) extrait `openModal()`/
  `closeModal()` de `js/auth.js`, généralisé à un `Map<id, state>` (plusieurs
  modales indépendantes sans écraser l'état les unes des autres — corrige un
  bug latent de l'implémentation d'origine à slot global unique). Option
  `onClose` pour synchroniser un état additionnel (overlay de `titlesModal`).
  Migré : `avatarCropModal`/`sharePreviewModal`/`songModal`/`titlesModal`.
  `tests/modal.test.js` (13 tests) : ARIA, focus initial/restauré, trap
  Tab/Shift+Tab, indépendance entre modales.
- **Audit trail admin** : table `admin_audit_log` (migration 020) +
  `personadle_log_admin_action()` (`api/lib/admin_audit.php`) câblé sur
  toutes les mutations admin (ban/unban, grant/revoke admin, badges/titres/
  wallpapers, event codes, social links, hard delete). Panel "📋 Audit".
- **RGPD — visibilité + déclenchement manuel** : logique de
  `api/cron/hard-delete.php` extraite vers `api/lib/deletion_requests.php`
  (réutilisée par le cron ET le nouveau panel admin "🗑️ RGPD").
- **Rate limits — visibilité + purge manuelle** : `api/admin/rate_limits.php`
  (nouveau), panel "⏱️ Rate Limits".
- **Observabilité** : table `error_log` (migration 019) +
  `personadle_log_error()` (`api/lib/error_log.php`), panel "🪵 Logs". Câblé
  uniquement sur les 3 endpoints critiques traités dans ce lot (sessions,
  recover-streak, social-links interact) — le reste des `error_log()`
  existants dans le codebase n'a volontairement pas été balayé.
- **Suivi PR #6** : `api/lib/game_session.php` (docblock `@return` corrigé,
  bloquait PHPStan) ; `js/modal.js` (listener `keydown` fantôme si une modale
  est rouverte sans `closeModal()` entre les deux — fix + test de régression) ;
  angle mort d'audit comblé sur `user_stats.php` (écrasement de stats) et
  `user_friends.php` (suppression forcée d'amitié).
- Non exécuté en sandbox faute de Docker/MariaDB (`tests/php/
  DatabaseIntegrationTest.php` étendu de 459 lignes) — à confirmer via
  `make up && make test-php` ou la CI.

## 2026-07-04 — `9b8bb6f` fix(i18n): 404/reset-password/login-register traduits + check valeur == EN

- **`scripts/check-i18n-untranslated.js`** (`npm run i18n:check-untranslated`) :
  compare chaque valeur FR/ES/DE/IT à son équivalent EN pour repérer les
  traductions probablement jamais faites (copié-collé). Purement informatif
  (exit 0 systématique), averti en pre-commit uniquement si des `lang/*.json`
  sont stagés. Premier passage : 0 vraie traduction manquante sur ~327
  correspondances (toutes attendues par design — noms propres, opus, mots
  empruntés — voir CLAUDE.md §5).
- **`404.html` + `reset-password.html`** : intégralement traduits (étaient
  100% en dur en anglais). Nouvelle section `reset_password` (12 clés ×
  5 langues). `js/lang-selector.js` (nouveau, testé) extrait le widget de
  sélecteur de langue dupliqué inline sur `privacy.html`/`faq.html`/
  `profile.html`/etc. — utilisé sur les 2 nouvelles pages sans toucher aux
  pages existantes.
- **`js/auth.js`** : erreurs de login/register traduites (les clés
  `auth.error_*` existaient dans `lang/*.json` mais n'étaient jamais
  utilisées — le message brut du backend, toujours en anglais, s'affichait).
- Restent hors scope (notés dans le commit) : `admin/index.html` (aucun
  i18n, outil interne) et l'audit visuel des ~327 correspondances EN
  "attendues" n'a pas été repassé caractère par caractère.

## 2026-07-04 — `69501ce` chore(profile): supprime profile.js (code mort)

`profile/profile.js` n'était plus importé nulle part depuis la décomposition
de `profile-page.js` (voir commit suivant) — supprimé plutôt que gardé
"au cas où".

## 2026-07-04 — `4d6634e` Tests, sécurité/data et décomposition de profile-page.js

- **+66 tests Vitest, +4 suites PHPUnit** sur les zones sans couverture
  identifiées lors d'un audit de tests : `js/social-link.js`,
  `api/auth`+`api/admin` (logique pure), `classiqueMode/modeClassique.js`
  (grille de comparaison), `profile/badges/badgesManager.js`.
- **Extractions pour rendre la logique testable sans MySQL** :
  `api/lib/social_link.php` (XP/rang, pattern `api/lib/streak.php`),
  `api/lib/validation.php` + `api/lib/authz.php` + `api/lib/format.php`
  (depuis `register.php`/`reset-password.php`/`bootstrap.php`).
  `classiqueMode/modeClassique.js` : `compareAttribute()` extrait de
  `checkGuess()`. `profile/badges/badgesManager.js` :
  `toggleBadgeSelection`/`handleEventCodeSubmit` exportées.
- **Décomposition de `profile-page.js`** (devenu trop volumineux) : extrait
  `profile/share-card.js`, `profile/song-player.js`, `profile/titles-ui.js`,
  `profile/wallpapers-ui.js`, `profile/theme.js`. `profile/profile.js`
  (ancien monolithe pré-décomposition) devient mort — supprimé au commit
  suivant (`69501ce`).
- Tests PHP écrits et vérifiés par `php -l` mais non exécutés dans cette
  session (téléchargement de `phpunit.phar` bloqué par la policy réseau du
  sandbox) — à valider via `make test-php` ou la CI.

---

## 2026-07-05 — fix(classique): Give Up n'est plus compté comme une victoire

**Bug trouvé en écrivant un test E2E de partie complète** (pas un audit
ciblé) : en mode Classique, cliquer "Give Up" appelait
`checkGuess(target.nom, target, true)` pour révéler la réponse. Le bloc
`if (isWin)` de `checkGuess()` traite `isWin = correspondance || forceReveal`
comme une seule condition — sans distinguer une vraie victoire d'un
`forceReveal` — et loggait donc systématiquement `result: "win"` +
positionnait `statsAlreadyLogged = true` **avant** que le handler du bouton
Give Up n'ait la main pour logger son propre `result: "giveup"` (silencieusement
ignoré ensuite, puisque le flag était déjà à `true`). Conséquence réelle :
stats et badges (`hasWonFirstTry` notamment) faussés pour tout abandon de
partie en Classique.

Vérifié que les 5 autres modes n'ont **pas** ce bug : Emoji fait
`result = forceReveal ? "giveup" : "win"` directement ; Silhouette/AllOutAttack
(et par le même schéma, Personae/Music) séparent l'affichage de révélation du
log de session, avec le win-log explicitement gardé par `!force`.

**Fix** (`classiqueMode/modeClassique.js`, `checkGuess()`) : ajout de
`!forceReveal` à la garde du bloc qui logge la victoire + les flags de badges
(`if (wasFresh && !statsAlreadyLogged && !forceReveal)`), et au bloc de
confettis/`showChallengeButton`/`checkChallengeCompletion(…, true)` (qui
s'exécutaient aussi à tort sur un Give Up, en double avec les appels
équivalents — mais avec les bons arguments — du handler Give Up
lui-même). Comportement du vrai chemin victoire strictement inchangé
(`forceReveal` vaut toujours `false` sur un clic normal du bouton deviner).

Non vérifié en navigateur (Docker indisponible dans le sandbox où ce fix a
été fait) — logique relue attentivement + comparée aux 5 autres modes,
473/473 tests Vitest inchangés, `php -l`/`node --check` propres. À confirmer
manuellement (jouer une partie Classique, cliquer Give Up, vérifier
`user_stats`/`game_sessions` en base) avant release si possible.

---

## 2026-07-05 — fix(silhouette, aoa): triche possible en glissant l'image hors de sa zone

**Signalé par l'utilisateur** : en mode Silhouette, on pouvait cliquer-glisser l'image
silhouette hors de `.silhouette-box` (qui a `overflow: hidden`) pour révéler le personnage
à deviner. Cause : les `<img>` sont nativement `draggable` dans les navigateurs, et l'aperçu
de drag natif (la miniature qui suit le curseur) est généré à partir des pixels réels de
l'image — il n'applique pas le filtre CSS (`filter: brightness(0)`) qui crée l'effet
silhouette, et flotte au-dessus de la page sans être contraint par `overflow: hidden`.

Vérifié que le mode **All-Out Attack** a exactement la même vulnérabilité (`#aoaGif` utilise
aussi un filtre de flou progressif, cf. `allOutAttackMode/allOutAttack.css`) — corrigé aux
deux endroits. Les 4 autres modes n'affichent jamais d'image volontairement floutée/masquée
par CSS, donc pas concernés.

**Fix, 3 couches (redondantes exprès, robustesse cross-browser)** :
1. `draggable="false"` sur `<img id="silhouetteImage">` et `<img id="aoaGif">` — désactive le
   drag natif dans la quasi-totalité des navigateurs modernes (vérifié : `img.draggable === false`
   côté DOM après rendu, testé via Playwright/Chromium headless).
2. CSS `-webkit-user-drag: none; user-select: none;` sur les deux mêmes éléments.
3. `addEventListener("dragstart", e => e.preventDefault())` en JS (`modeSilhouette.js`,
   `modeAllOutAttack.js`) — filet de sécurité si les deux couches précédentes ne suffisent pas
   sur un navigateur particulier.

473/473 tests Vitest inchangés, `node --check`/ESLint propres. Vérifié via Playwright headless
(sans backend, juste le rendu statique) que `draggable` vaut bien `false` au niveau DOM sur les
deux images — pas de test E2E de bout en bout du drag lui-même (comportement natif du
navigateur, pas simulable de façon fiable en E2E).

---

## 2026-07-05 — fix: retours de review PR (victoryBox Classique + rate-limit E2E)

**Signalé par la review GitHub de la PR** (run E2E réel, pas une supposition) :

1. **`#victoryBox` invisible en mode Classique** (`game-flow.spec.js`, test Give Up) :
   `classiqueMode/classiqueMode.html` déclarait `<div id="victoryBox" style="display: none"></div>`
   **sans** `class="victory-box"`, contrairement aux 5 autres modes qui ont tous
   `class="victory-box"` (cf. `.victory-box` dans `css/global.css` : `padding: 20px 25px;
   border: 3px solid …` — c'est cette classe qui donne au conteneur sa taille/son style, pas
   l'id). Sans elle, la boîte est un `<div>` vide sans padding/bordure : hauteur 0, donc
   invisible pour Playwright (`toBeVisible()` exige un bounding box non nul) **que ce soit sur
   un vrai win ou un Give Up** — pas une régression du fix Give Up=Win de la veille, un bug
   structurel préexistant dans le HTML de ce mode, simplement révélé par le nouveau test E2E.
   **Fix** : ajout de `class="victory-box"` sur la div (`classiqueMode/classiqueMode.html`).

2. **`social-link.spec.js` en échec par épuisement du rate-limit d'inscription** :
   `POST /api/auth/register` est limité à 5 inscriptions / 15 min par IP
   (`api/auth/register.php`). Avec `admin.spec.js` (1 inscription) + `api.spec.js` (2, dont le
   nouveau bloc recover-streak) + `social-link.spec.js` (2, comptes A et B), le total tombe
   pile sur la limite — et `retries: 2` en CI + `test.describe.serial` (qui rejoue tout le
   bloc, donc son `beforeAll`, si un test du groupe échoue) peut ré-inscrire les mêmes comptes
   et dépasser le quota, avec un ordre non déterministe sous `fullyParallel: true`. Confirmé
   par la review : problème de marge de la suite de tests elle-même, pas une régression du
   code produit. **Fix** : le plafond reste `5` en production (`APP_ENV === 'production'`,
   sécurité inchangée) mais passe à `50` dans les autres environnements
   (`APP_ENV=local` en Docker/E2E, cf. `api/config.docker.php`) — assez de marge pour
   absorber des retries CI sans affaiblir la protection anti-abus en prod.

Ajout en bonus (suggestion de la review, pas un correctif) : upload de `test-results/` et
`playwright-report/` en artefact CI sur échec du job `e2e` (`.github/workflows/ci.yml`), pour
diagnostiquer plus vite la prochaine fois sans avoir à reproduire en local.

473/473 tests Vitest inchangés, `php -l` propre sur `register.php`. Non revérifié par un run
E2E réel dans ce sandbox (Docker indisponible) — les deux causes ont été confirmées par
lecture de code croisée avec le comportement documenté de Playwright/MariaDB plutôt que par
observation directe.

---

## 2026-07-05 — fix(e2e): POST /api/friends sans slash final perd son body (issue #10)

**Cause racine trouvée** après ouverture de l'issue #10 (bug latent noté hors scope de
la PR #9) : `tests-e2e/social-link.spec.js` appelait `a.ctx.post("/api/friends", …)`
**sans slash final**. `api/friends/.htaccess` ne route la racine du dossier
(`RewriteRule ^$ index.php`) que pour l'URL se terminant par `/` — sur `/api/friends`
sans slash, Apache (mod_dir, `DirectorySlash` par défaut ON) répond d'abord par un
`301` vers `/api/friends/` **avant** que la règle de réécriture du dossier ne s'applique.
Un client qui suit les redirections (Playwright `APIRequestContext` comme `fetch`)
convertit alors le `POST` en `GET` sur l'URL redirigée, perdant le body — la requête
retombe sur le handler `GET /api/friends` qui répond `200 { friends, pending_requests }`
au lieu de créer la demande. D'où le symptôme : `res.ok()` reste vrai (200 est un succès),
mais `body.status` ne vaut jamais `"pending"` puisque aucune demande n'a été créée.

Preuve que ce n'est pas un bug produit : `js/api.js:346` fait déjà
`post("/friends/", …)` **avec** le slash final (de même que `/messages/` pour la même
raison) — un choix déjà fait côté front, juste pas repris dans le test E2E qui n'avait
jamais pu être exécuté jusqu'au bout avant le fix du rate-limit d'inscription (voir
entrée du jour précédente).

**Fix** : ajout du slash final sur l'appel du test (`tests-e2e/social-link.spec.js`),
aligné sur la convention déjà en place dans `js/api.js`. Aucun changement côté
`api/friends/index.php` — le code serveur était correct. Piège documenté dans
`CLAUDE.md` § 7 pour éviter la récidive sur un futur test ou appel direct à ces routes.

Issue #10 fermée par ce commit. Non revérifié par un run E2E réel (Docker indisponible
dans ce sandbox) — cause confirmée par lecture croisée du comportement documenté
d'Apache `mod_dir`/`DirectorySlash` et de la gestion des redirections `fetch`/Playwright
sur les méthodes non-GET, plus la présence du même contournement déjà en place côté
front (`js/api.js`).

---

## 2026-07-05 — ⚠️ fix(api): PATCH /notifications dégradé en GET + nettoyage stubs .php/dossier

**Suite de l'investigation issue #10** : la review a précisé la cause exacte du bug
`/api/friends` — `api/.htaccess` teste `-d` (dossier) **avant** `.php -f`, donc une
requête sur une route-dossier sans slash final matche toujours le passe-plat "dossier
existant" avant de pouvoir atteindre un éventuel stub `.php` du même nom. Elle a aussi
révélé que **`api/friends.php` est un stub déjà présent dans le repo** (compat pour
d'anciennes versions d'`api.js` mises en cache par le service worker), mais rendu
inatteignable par cet ordre.

**En vérifiant ce point, découverte d'un vrai bug produit, distinct** : `api/notifications.php`
existe en doublon de `api/notifications/index.php`, avec une implémentation du `PATCH`
divergente et obsolète (no-op, ne renseigne jamais `seen_at` — contrairement à la
vraie version dans `notifications/index.php`). Or `js/api.js:377`
(`markSeen: () => apiCall("/notifications", …)`) appelle cette route **sans slash
final** — donc en production, ce `PATCH` subit la même dégradation silencieuse en `GET`
que `/api/friends` : le badge rouge "demandes d'ami" de la bottom nav ne se marque
vraisemblablement **jamais** comme vu.

**Fix (3 changements, comportement produit réellement modifié — d'où le `⚠️`)** :
1. `js/api.js` — slash final ajouté sur `markSeen()` (`/notifications/`), même
   convention que `/friends/` et `/messages/`. C'est le fix qui règle réellement le bug
   du badge.
2. `api/notifications.php` **supprimé** — stub mort (de toute façon inatteignable côté
   serveur, `-d` gagnant toujours), et surtout divergent/incorrect par rapport à
   `notifications/index.php`, qui reste la seule implémentation.
3. `api/.htaccess` — réordonné : test `.php -f` avant `-f OR -d`, pour que
   `api/friends.php` (stub légitime, conservé) redevienne atteignable comme prévu par
   son propre commentaire, sans changer le routage d'aucune autre route (vérifié :
   seules `friends.php`/`friends/` et l'ex-`notifications.php`/`notifications/`
   avaient une collision fichier/dossier dans `api/`).

Non revérifié par un run E2E réel (Docker indisponible dans ce sandbox) — le
raisonnement s'appuie sur une relecture attentive de `api/.htaccess` et de chaque
route concernée, plus la confirmation apportée par la review sur le run CI réel qui a
révélé le problème initial.

---

## 2026-07-05 — Anti-triche daily target (phase 1), god files, couverture E2E admin, a11y

Suite du menu d'améliorations issu de la revue de projet du 2026-07-04/05 (`AMELIORATIONS.md`,
`ROADMAP.md`). Un point du menu (durcissement des conditions de badges "à flags") a été
explicitement laissé de côté à la demande du dev.

### ⚠️ Anti-triche `api/sessions.php` — phase 1 (détection, pas de rejet)

L'investigation a révélé que le point ROADMAP était mal cadré : **aucune table
`daily_targets` n'existe** en BDD (ni schéma ni migrations), contrairement à ce
qu'affirmaient ROADMAP.md et ce fichier. Chacun des 6 modes calcule sa cible via un
algorithme seedé différent (`getDailyTarget()` dans `js/gameCore.js`, hash FNV-1a
32 bits sur `seedId|date|mode` modulo la taille du pool), avec en plus un repli
conditionnel sur le filtre opus actif pour AllOutAttack et Personae — donc pas une
simple lecture de table à ajouter.

- `scripts/export-daily-pools.js` — exporte les pools JS (source de vérité :
  `characters_clean.js`, `silhouetteCharacters.js`, `songs.js`, `personas_allOut.js`
  + `aoaCharacters.js`, `personaeCharacters.js`) vers `api/data/daily_pools.json`,
  lisible par PHP. `npm run pools:check`/`pools:build`, câblé en CI et dans le hook
  pre-commit (même pattern que `check-doc-numbers.js`).
- `api/lib/daily_target.php` — porte l'algorithme FNV-1a et les deux replis
  conditionnels (AllOutAttack, Personae) en PHP. Le hash n'opère que sur de l'ASCII
  (seed numérique, date ISO, nom de mode ASCII), donc `ord()` par octet est
  équivalent à `charCodeAt()` par unité UTF-16 côté JS — vérifié par comparaison
  croisée directe des deux implémentations sous Node/PHP sur des dizaines de
  combinaisons seed/date/mode/filtre, y compris les cas qui déclenchent réellement
  le repli filtré.
- `api/sessions.php` recalcule la cible attendue et logue un écart (`error_log`,
  niveau `warning`, source `anti_cheat`) **sans rejeter la requête**. Décision
  volontaire : impossible de garantir zéro faux positif sans testing en conditions
  réelles de prod, et un rejet à tort bloquerait des victoires légitimes pour tous
  les joueurs. Même logique que le critère "10 runs verts" avant de rendre le job
  E2E bloquant (`tests-e2e/README.md`). Le rejet strict (phase 2) est documenté
  dans ROADMAP.md comme prochaine étape, conditionnée à zéro anomalie observée.
- **Prérequis découvert en cours de route** : `AllOutAttack`/`Personae`
  n'envoyaient jamais leur filtre opus actif dans `active_filters` du body
  `POST /api/sessions` (toujours `[]`, alors que Classic le faisait déjà) — rendant
  la validation de leur repli filtré impossible côté serveur. Corrigé
  (`allOutAttackMode/modeAllOutAttack.js`, `personaeMode/modePersonae.js`) pour
  qu'ils envoient `activeOpusFilters`/`activeFilters` comme Classic.
- `tests/php/DailyTargetTest.php` — couvre le hash, les 6 modes, et les deux
  replis filtrés sur des cas dont le déclenchement réel a été vérifié manuellement.

### refactor(admin): `admin/admin.js` scindé en 8 modules ES6

1850 → ~1155 lignes. Comportement strictement inchangé (déplacement mécanique).
5 panneaux totalement autonomes (état/DOM propres, zéro couplage avec l'utilisateur
sélectionné) extraits dans leur propre fichier : `event-codes.js`, `error-logs.js`,
`audit-log.js`, `deletion-requests.js`, `rate-limits.js`. Utilitaires partagés dans
`admin-api.js` (client REST + toast + escHtml + getTypeLabel) et `catalogs.js`
(chargement badges/wallpapers/titres). La liste utilisateurs + les 7 onglets de
détail utilisateur restent dans `admin.js` : état fortement couplé
(`_selectedUser`/`_userDetail`/pending gifts), séparer aurait un risque de
régression plus élevé pour un gain plus faible — reporté plutôt que scindé à
l'aveugle (pas de Docker disponible pour vérifier en navigateur).

`admin.js` n'avait jusqu'ici **aucune** couverture Vitest. `tests/adminSmoke.test.js`
comble ce trou : import du graphe de 8 modules, bootstrap complet (auth → catalogues
→ liste utilisateurs), clic sur les 5 boutons de panneaux extraits — pensé pour
attraper la classe de bug la plus probable d'un découpage mécanique (export
manquant, variable renommée dans un seul des fichiers).

`profile/profile-page.js` (1194 lignes) n'a **pas** été re-découpé : en le relisant,
il a déjà 9 modules extraits d'un travail antérieur (badges/, wallpapers-ui.js,
titles-ui.js, song-player.js, share-card.js, theme.js, profile-format.js,
formatPlayTime.js, avatars_data.js) ; les lignes restantes sont la logique de
contrôleur de page, fortement couplée à un objet `profile` partagé et des
closures — un découpage supplémentaire aurait un risque réel pour un gain marginal.

### test(e2e): couverture des endpoints admin restants

`event_codes`, `error_logs`, `deletion_requests`, `social_links`, `user_badges`,
`user_titles`, `user_wallpapers`, `user_stats`, `user_friends` n'avaient jusqu'ici
aucun test (ni Vitest, ni E2E, ni PHPUnit — seuls `php -l`/PHPStan les vérifiaient).
`tests-e2e/admin-extended.spec.js` (24 tests) complète `admin.spec.js` : 403 pour un
non-admin sur chaque route, cycles créer/lister/modifier/supprimer pour les codes
événement et les dons badge/titre/wallpaper (catalogue lu dynamiquement via
`/api/titles`/`/api/wallpapers` plutôt que des IDs figés en dur), validations
400/404.

### ⚠️ fix(a11y): `prefers-reduced-motion` pour les boucles canvas JS

`css/global.css` neutralise déjà toutes les animations/transitions CSS pour
`prefers-reduced-motion: reduce`, mais deux effets tournent en JS pur via une
boucle `requestAnimationFrame` qu'une media query CSS ne peut jamais arrêter : le
bruit TV statique (`js/tv-friend-anim.js`) et les confettis dorés du don admin
(`js/divine-gift.js`). Les deux sautent maintenant leur boucle si
`matchMedia('(prefers-reduced-motion: reduce)').matches`.

Audit complémentaire sans changement de code (décisions de design à trancher
séparément, détaillées dans `AMELIORATIONS.md` §9) : `streak-recovery.js` est déjà
entièrement i18n (le point ROADMAP/AMELIORATIONS qui affirmait le contraire était
faux, corrigé) ; `--color-accent` (#e63946) est sous le seuil AA texte normal
(4.17:1 sur blanc) sans qu'une seule teinte de repli satisfasse proprement les deux
thèmes clair/sombre.

### Vérifications communes à ce lot

`npx vitest run` (475/475), `npm run lint` (0 erreur), `npm run pools:check`,
`npm run docs:check`, `php -l` sur tous les fichiers PHP touchés, et pour
`daily_target.php` une comparaison croisée directe Node/PHP (voir plus haut) —
seule vérification possible sans Docker/MariaDB dans ce sandbox. Les nouveaux
tests E2E (`admin-extended.spec.js`) et PHPUnit (`DailyTargetTest.php`) n'ont pas
pu être exécutés ici (nécessitent respectivement `make up` et un environnement
PHPUnit) — à confirmer via la CI réelle.

### Suite à la review de la PR #13

- `admin/admin-api.js::escHtml` corrigeait `String(str || "")` — un champ numérique valant
  légitimement 0 s'affichait vide au lieu de "0". Corrigé en `String(str ?? "")`, propagé
  automatiquement aux 8 modules admin qui l'importent.
- Pagination (`renderXPagination`) et bandeaux "Chargement…"/erreur, copiés-collés à l'identique
  dans `event-codes.js`/`error-logs.js`/`audit-log.js`/`deletion-requests.js`/`rate-limits.js`,
  factorisés en `renderPagination()`/`renderLoading()`/`renderError()` dans `admin-api.js`.
  Vérifié par `tests/adminSmoke.test.js` (clique déjà sur les 5 panneaux) + relecture.
- `tests/php/DailyTargetTest.php` ne cross-vérifiait la valeur de hash que pour 3 modes sur 6
  (Classic/Personae/Music) — Emoji/Silhouette/AllOutAttack n'avaient qu'un test de bornes.
  Ajouté les 3 valeurs manquantes (cross-check Node/PHP, même méthode).
- **Limitation documentée, pas corrigée** : pour AllOutAttack/Personae, `$activeFilters` est
  accepté tel que soumis par le client sans être corrélé à un état côté serveur — un client peut
  soumettre n'importe quel sous-ensemble de codes opus pour faire correspondre le recalcul
  serveur au nom qu'il veut faire valider. Sans conséquence en phase 1 (détection), mais à
  corriger (filtre stocké côté serveur) avant d'activer le rejet strict pour ces 2 modes
  spécifiquement — documenté dans `api/lib/daily_target.php` et `ROADMAP.md`.
- `js/tv-friend-anim.js` et `js/divine-gift.js` recopiaient le même check
  `matchMedia("(prefers-reduced-motion: reduce)")` — extrait en `prefersReducedMotion()`
  (`js/gameCore.js`), conforme à CLAUDE.md §8 (réutiliser gameCore.js pour ce type d'utilitaire).
- `CLAUDE.md` §9 pointait vers un `PersonaDLE_Update.md` qui n'existe pas pour la v2.0 (seulement
  pour l'archive v1.1) — corrigé pour refléter la pratique réelle : `DEV_CHANGELOG.md` (dev) +
  `PersonaDLE_Update.html` (joueur, page HTML bilingue), comme documenté en tête de ce fichier.
- Perf (`daily_pools.json` entièrement reparsé à chaque `POST /api/sessions` quel que soit le
  mode joué) : accepté tel quel vu la taille modeste du fichier (~40 Ko), commentaire ajouté
  plutôt qu'une restructuration en fichiers par mode — à revisiter si le roster grossit beaucoup.

---

## 2026-07-06 — Conditions badges/wallpapers en colonnes structurées

Suite du menu ROADMAP.md : `badges`/`wallpapers` n'avaient qu'un texte libre d'affichage
(`condition_en`/`unlock_condition`), la vérification serveur passant par un mapping
slug→logique en dur dans `api/badges/index.php`/`api/wallpapers/index.php` — fragile
(un nouveau badge ajouté sans mise à jour du switch passait toujours en "safe fallback
= true"). `titles` avait déjà résolu ce problème avec des colonnes structurées
(`condition_type`/`condition_mode`/`condition_value`) — ce lot applique le même schéma
aux deux autres tables.

- **`api/lib/condition_check.php`** (nouveau) — `personadle_verify_condition()` extrait
  de l'ancien `verifyTitleCondition()` (`api/titles/index.php`), généralisé et partagé
  par les 3 tables au lieu de 3 mappings divergents. 3 nouveaux `condition_type` :
  `mode_games` (parties jouées, pas victoires — ex. wallpaper `rise_dungeons`),
  `games_total` (parties tous modes), `social_link_min_rank` (généralise
  `social_link_rank_10` avec un seuil au lieu d'un rang exact).
- **`sql/migrations/021_structured_badge_wallpaper_conditions.sql`** + `bdd_mysql.sql`
  mis à jour directement (schéma + seed) : `ALTER TABLE` badges/wallpapers, backfill de
  toutes les valeurs existantes. 15/60 badges et 5/7 wallpapers ont une condition
  réellement structurable ; le reste (flags narratifs multi-persos, redeem de code
  événement, vérifié par un autre endpoint comme social-links/streak-recovery) reçoit
  `condition_type = 'manual'` — documente explicitement le choix au lieu de laisser
  `NULL` en silence.
- **Corrige au passage 2 vrais bugs de mapping**, découverts en cartographiant chaque
  badge vers son condition_type réel : `velvet_regular` ("jouer 50 jours uniques") et
  `best_bro` ("avoir 2+ amis") étaient dans la liste des badges "impossible à
  structurer, toujours autorisé" alors qu'ils sont structurellement identiques à
  `unique_days`/`friends_count`, déjà utilisés par `titles`. Ces deux badges sont
  maintenant réellement vérifiés côté serveur.
- `api/badges/index.php`/`api/wallpapers/index.php` réécrits pour lire les 3 colonnes
  et appeler la fonction partagée — les anciennes fonctions `verifyBadgeCondition()`
  (avec sa liste de bypass slug par slug) et `verifyWallpaperCondition()` supprimées.
- `tests/php/ConditionCheckTest.php` (21 tests, même pattern `DatabaseIntegrationTest.php`
  — vraie MariaDB, transaction annulée en tearDown) couvre chaque `condition_type`.

Non exécuté en sandbox (pas de Docker/MariaDB) — vérifié par relecture attentive +
comparaison structurelle avec `verifyTitleCondition()` (déjà tournée en CI réelle avant
cette PR) + un script Python de validation structurelle des lignes SQL modifiées
(nombre de champs par ligne INSERT = nombre de colonnes déclarées, sur les 60 lignes
badges et 7 lignes wallpapers). À confirmer via la CI (`make test-php`).

### Suivi de revue (PR #14)

- **Fail-closed wallpaper préservé** — `personadle_verify_condition()` est fail-open par
  design (un `condition_type` NULL/inconnu débloque toujours, pour ne jamais bloquer un
  futur ajout de titre/badge). L'ancien `verifyWallpaperCondition()` faisait l'inverse
  (`default: return false`). Déléguer wallpapers directement à la fonction partagée aurait
  silencieusement inversé ce choix pour tout wallpaper futur sans `condition_type`. Fix :
  garde explicite `if (empty($wallpaper['condition_type'])) return false;` dans
  `canUnlockWallpaper()` (`api/wallpapers/index.php`) **avant** la délégation.
- **`condition_value` NULL fail-closed** — `$condValue ?? 0` combiné à des comparaisons
  `>= $val` faisait qu'un badge/wallpaper avec `condition_type` défini mais
  `condition_value` NULL par erreur de saisie (colonne nullable) était toujours débloqué
  (`>= 0` toujours vrai), au lieu de refuser. Fix : liste `$valueRequiredTypes` vérifiée
  avant le `switch`, retourne `false` si un type qui a besoin d'une valeur numérique a
  `condition_value = NULL`. `social_link_min_rank` en est volontairement exclu (défaut à
  10 documenté séparément).
- **`classic_p1_wins`/`emoji_p2_wins` corrigés dans le docblock** — la revue affirmait ces
  deux alias inutilisés par le seed. Faux : `naoya_first_awakening` et
  `maya_always_be_positive` (`bdd_mysql.sql`) les utilisent réellement. Docblock mis à
  jour pour le documenter explicitement au lieu de supprimer du code fonctionnel.
- **`SUM`/`MAX` factorisés** — `personadle_aggregate_user_stat()` et
  `personadle_user_stat_for_mode()` extraits pour éliminer la duplication SQL entre les
  différents `condition_type` numériques (whitelist de colonnes/fonctions en défense en
  profondeur, `$column`/`$fn` ne sont jamais une entrée utilisateur).
- **`tests/php/BadgeWallpaperCatalogTest.php`** (nouveau, 5 tests) — répond aussi à la
  demande de couverture par badge individuel : `testEveryBadgeHasExpectedConditionColumns()`
  vérifie que les 60 lignes réelles de `badges` correspondent exactement au mapping attendu
  (catalogue complet, pas un échantillon), idem pour les 7 wallpapers non-défaut. Les 3
  tests restants copient le SELECT exact des 3 endpoints réels (`badges`/`wallpapers`/
  `titles`) pour fermer le trou identifié en revue : les tests précédents appelaient
  `personadle_verify_condition()` avec des littéraux, jamais via le vrai flux bout-en-bout,
  donc un décalage de nom de colonne entre le SELECT d'un endpoint et la fonction n'aurait
  pas été détecté.

### Suivi de revue, 2ᵉ passe (PR #14)

- **Vrai bug attrapé par la CI elle-même (commit `d603516`)** — `ConditionCheckTest::testSocialLinkMinRankDefaultsToRank10WhenValueIsNull`
  a échoué au premier push du suivi de revue (`2da76c01`) : la nouvelle garde
  `$valueRequiredTypes` (refus si `condition_value` NULL, ajoutée par ce même commit)
  incluait encore `social_link_min_rank` malgré le commentaire juste au-dessus affirmant
  l'inverse. Ce type a son propre défaut à 10 documenté dans le `switch`, donc la garde
  générique le court-circuitait avant d'y arriver — `social_link_min_rank` retournait
  toujours `false`, même à rang 10. Retiré de la liste dans `d603516` — reconfirmé vert
  par la CI dans la foulée.
- **Frontière exacte value-1/value ajoutée pour les 19 badges/wallpapers à seuil simple**
  (`BadgeWallpaperCatalogTest::testStructuredConditionsRespectExactThreshold`) + un test
  dédié pour `kamoshida_palace`/`all_modes_won` (5/6 modes refusé, 6/6 accordé). Répond au
  point le plus important d'une 2ᵉ passe de revue : aucun test existant ne prouvait qu'un
  seuil réel du catalogue (par opposition à une valeur inventée dans `ConditionCheckTest.php`,
  ou à la donnée en base vérifiée par `testEveryBadgeHasExpectedConditionColumns()`) était
  respecté à l'exécution — exactement la classe de bug qui vient de casser
  `social_link_min_rank` silencieusement.
- **`personadle_known_condition_types()`** (nouveau, `condition_check.php`) — liste
  exhaustive des 17 `condition_type` reconnus. `canUnlockWallpaper()`
  (`api/wallpapers/index.php`) comparait juste `!empty($condition_type)`, ce qui ne
  distingue pas un type reconnu (`manual`) d'une faute de frappe ou d'un type retiré du
  vocabulaire (l'ancien `social_link_rank_10`) — les deux tombaient sur le safe-fallback
  `true` partagé avec badges/titles, débloquant un wallpaper par erreur. Comparaison
  stricte à cette liste maintenant. `ConditionCheckTest::testKnownConditionTypesMatchesSwitchCases()`
  garde la liste synchronisée avec les vrais `case` du switch.
- **`tests/php/BadgeWallpaperCatalogTest.php` — test titres corrigé** : utilisait
  `WHERE slug = ?` alors que le vrai endpoint (`api/titles/index.php::POST /unlock`) fait
  `WHERE id = ?` après une résolution slug→id séparée. Passait par coïncidence (même
  ligne), sans jamais exercer la requête réellement utilisée par le check de condition.
  Résout maintenant l'id d'abord, comme le fait le vrai endpoint.
- **`sql/bdd_mysql.sql`** : commentaire de schéma sur `condition_type` mis à jour
  (retire `social_link_rank_10`, ajoute `mode_games`/`games_total`/`social_link_min_rank`).

### Suivi de revue, 4ᵉ passe (PR #14) — bug bloquant du titre Aigis corrigé

- **`titles.aigis_i_am_not_afraid` ne pouvait jamais se débloquer** — l'`INSERT INTO
  titles` n'incluait même pas la colonne `condition_mode` (NULL pour tous les titres,
  sans exception). Avec `condition_type='mode_wins'` et aucun mode résolu,
  `personadle_verify_condition()` refuse immédiatement (`return false`) sans jamais
  consulter les stats — bug confirmé identique sur `develop`, pas introduit par cette
  PR. Fix (confirmé par le mainteneur — la doc joueur `PersonaDLE_Update.html` annonce
  "Win 50 games in Classic Mode") : ajoute `condition_mode` à la liste de colonnes de
  l'`INSERT INTO titles` (`bdd_mysql.sql`), NULL pour les 10 autres titres, `'classic'`
  pour `aigis_i_am_not_afraid`. `sql/migrations/022_fix_aigis_title_condition.sql` pour
  propager le fix vers la prod Hostinger (déjà déployée avec le seed cassé).
- **`GET /api/titles` expose maintenant `condition_mode`** (`api/titles/index.php`) —
  absent du `SELECT` du `GET`, incohérent avec le `POST /unlock` du même fichier et avec
  `GET /api/badges`/`GET /api/wallpapers` (mis à jour par cette PR pour exposer les 3
  colonnes ensemble).
- **`BadgeWallpaperCatalogTest::testStructuredConditionsRespectExactThreshold()` remplacé
  par un mécanisme générique lisant le catalogue DIRECTEMENT en base** (badges +
  wallpapers + **titles**), plutôt qu'une liste de 19 slugs codée en dur — un futur
  badge/wallpaper/titre utilisant un `condition_type` déjà supporté est désormais couvert
  automatiquement dès son insertion en base, sans qu'un humain doive ajouter une ligne de
  test. Étend aussi la couverture aux types utilisés uniquement par `titles`
  (`badges_count`, `weekly_clean_modes`, `classic_p1_wins`, `emoji_p2_wins`) et à
  `perfect_wins` (supporté par `condition_check.php` mais non utilisé par le catalogue
  actuel — ajouté par anticipation, coût marginal nul).

---

## 2026-07-11 — redesign(ui): FAQ et Privacy — thème Velvet Room complet

Refonte visuelle complète de `pages/faq.html` et `pages/privacy.html` pour rejoindre l'esthétique Retro-Futurism du reste du jeu.

### FAQ

- **Fond** : `#0b0a1f` toujours sombre (Velvet Room), gradients radiaux animés (`fqBgPulse`), scanlines overlay
- **Titre** : Cinzel, `clamp(2.6rem…5rem)`, shimmer gradient animé (`titleShimmer` 6 s)
- **Barre de progression** : dégradé violet → rouge → or
- **Recherche** : input dark glass avec bordure violet/rouge neon au focus
- **Tabs de filtre** : pills neon couleur par catégorie (`game`=rouge, `gameplay`=rose, `account`=bleu, `community`=violet, `team`=or)
- **Headers catégorie** : dark glass, barre neon colorée à gauche (`::before`), glow ambiant par catégorie
- **Items FAQ** : dark glass, bordure neon colorée + glow quand `open`
- **Jack Frost** : 115 px, glow bleu-violet
- **Équipe** : cartes dark glass bordure or, hover lift + glow gold
- **Bouton Back** : déplacé à la FIN de la page (était au milieu — bug UX signalé par l'utilisateur)
- **`prefers-reduced-motion`** : toutes les animations désactivées

### Privacy

- **Fond** : même thème `#0b0a1f` avec gradients radiaux animés
- **Titre** : Cinzel, shimmer identique au FAQ
- **Shield hero** : emoji 🔐 avec animation `shieldPulse` violet→rouge
- **Intro card** : dark glass, bordure violet neon
- **Badges** : glassmorphism neon (vert/bleu/rouge/violet) en remplacement des pastilles blanches plates
- **Cartes de section** : dark glass + bordure gauche colorée par type (`--card-accent` CSS custom property) + glow hover par type (rouge/vert/bleu/violet)
- **Titres de section** : couleur neon par type de section
- **Listes** : `✕` rouge-pink pour "never do", `✓` vert neon pour "security"
- **Personnages Sae/Zenkichi** : glow violet ajouté au `filter: drop-shadow`
- **Bouton email** : style cohérent avec le bouton Back
- **Chip "last updated"** : fond violet subtle

---

## 2026-07-11 — fix(ui): victoryBox Classique vide + tooltip {{n}} non interpolé + redesign pages statiques

Trois correctifs isolés regroupés dans un lot UI/fix.

### victoryBox Classique (mode classique — barre blanche/verte vide à la victoire)

`classiqueMode/classiqueMode.html` avait un `<div id="victoryBox">` vide, contrairement à tous les autres modes qui contiennent `<img id="victoryPortrait">` + `<p id="winMessage">`. Symptôme : boîte verte/blanche vide animée à la victoire, aucun portrait ni message.

- **`classiqueMode/classiqueMode.html`** — ajout de `<img id="victoryPortrait">` + `<p id="winMessage" class="win-message">` dans `#victoryBox`
- **`classiqueMode/modeClassique.js`** — helper `fillVictoryBox(nom, isGiveup)` appelé aux 3 points : victoire, déjà-joué (restore), abandon
- **`lang/{en,fr,es,de,it}.json`** — ajout `modes.classic.correct` et `modes.classic.giveup_reveal` (clés de texte `{{name}}`)

### Tooltip amis `{{n}}` affiché brut

`js/social-link.js` : fonction `t(key, fallback)` locale ignorait silencieusement l'objet `vars` (3ème argument). Les appels `t('key', fallback, { n: X })` passaient `vars` mais la fonction interne ne le relayait pas à `window.i18n?.t?.(key, vars)`.

- **`js/social-link.js`** (ligne 23) — signature `t(key, fallback, vars)` + passage de `vars` à `window.i18n?.t?.(key, vars)`

### Redesign pages statiques (404, FAQ, Privacy)

Mise à niveau visuelle des pages statiques pour rejoindre l'esthétique Retro-Futurism du reste du jeu.

- **`pages/404.html`** — réécriture complète : thème Velvet Room (bg `#0c0b1a`, dégradé violet profond), grand "404" Cinzel avec glitch/chromatic aberration CSS (`::before` rouge / `::after` bleu), card glassmorphism gold-border, Igor GIF avec floating animation, diamonds pulsants, SVG arrow sur le bouton retour, corner brackets dorés, bottom nav, dark mode toggle, scanlines overlay, `prefers-reduced-motion`, easter egg ALIBABA préservé
- **`pages/faq.html`** — remplacement du `🔍` emoji dans le `innerHTML` dynamique (ligne 890) par un SVG inline magnifying glass ; back button : `display:inline-flex`, `cursor:pointer`, `text-decoration:none`, `:focus-visible` gold outline ; SVG arrow à la place de `← Back`
- **`pages/privacy.html`** — back button : `display:inline-flex`, `cursor:pointer`, `text-decoration:none`, `:focus-visible` gold outline ; SVG arrow à la place de `← Back`

### Détails techniques

- Le glitch 404 tourne à 6 s d'intervalle, déclenche à 88 % du cycle (glitch court, pause longue) — evite la fatigue visuelle
- Pas de `@import` Google Fonts en CSS — balise `<link>` dans le `<head>` pour ne pas bloquer le rendu
- `initLangSelector()` importé de `js/lang-selector.js` (pattern identique à `reset-password.html`, seul autre fichier dans `pages/` qui l'utilise)

---

## Comment utiliser ce fichier

- Un commit qui touche au code (pas juste de la doc/config triviale) →
  une entrée ici, avec les fichiers clés et le **pourquoi** des décisions non
  évidentes (pas juste la liste des fichiers modifiés, déjà visible dans le
  diff).
- Si le changement est aussi visible/parlant pour un joueur (nouvelle
  feature, fix d'un bug qu'il pouvait remarquer), ajouter une entrée courte,
  non technique, dans `PersonaDLE_Update.html` — jamais l'inverse (ne pas
  alléger ce fichier-ci pour "faire propre").
