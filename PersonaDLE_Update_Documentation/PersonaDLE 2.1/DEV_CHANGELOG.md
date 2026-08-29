# Changelog technique — PersonaDLE v2.1

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE 2.1/PersonaDLE_Update.html` reste le changelog **joueur** —
> highlights uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur si elle
> est réellement visible/parlante côté joueur.
>
> Les entrées antérieures à la v2.1 (v2.0 et ses correctifs post-lancement) sont restées
> dans `PersonaDLE 2.0/DEV_CHANGELOG.md` — elles n'ont pas été recopiées ici.

---

## 2026-08-26 — feat(expert): cadenas qui explose au déblocage + déblocage manuel par un admin

Deux demandes, **une seule mécanique** : le front compare l'état de déblocage en cache à
celui renvoyé par le serveur. Un mode qui passe de `false` à `true` déclenche l'animation —
que le joueur ait franchi le seuil en jouant ou qu'un admin le lui ait accordé. Le module
d'animation ne sait rien de la différence, et n'a pas à la connaître.

### Déblocage manuel (migration 035)

Nouvelle table `expert_unlocks_granted (user_id, mode, granted_by, granted_at)`.

**Pourquoi une table plutôt que de fausses parties dans `game_sessions`** : celles-ci
compteraient dans les stats, les classements et les badges `mode_wins`/`games_total`. Un geste
d'admin ne doit rien fabriquer qui ressemble à du jeu réel. Même forme que `badges_unlocked`.

Le don est un **OU** avec la condition calculée, jamais un remplacement :

- `personadle_expert_progress()` renvoie désormais `granted`, et n'interroge la table que si la
  condition n'est pas déjà remplie — inutile de payer une requête pour le cas courant.
- La progression affichée n'est **pas** gonflée : un accès offert montre « 0/15 », pas un faux
  « 15/15 ». La barre mesure ce que le joueur a joué.
- Retirer le don ne reprend pas un accès gagné entre-temps. L'endpoint renvoie
  `still_unlocked` pour que l'admin ne croie pas avoir refermé un mode qui reste ouvert.

`api/admin/user_expert.php` (GET/POST/DELETE) + sa `RewriteRule` dans `api/admin/.htaccess`
(CLAUDE.md §4). Les modes sont validés contre `personadle_expert_conditions()`, source unique —
un 7e mode n'aura rien à changer dans l'endpoint. Actions journalisées (`expert.grant`,
`expert.revoke`) via `personadle_log_admin_action()`.

Onglet **⚡ Expert** dans le panneau admin, avec trois états distincts — *Gagné en jouant*
(non retirable), *Accordé* (retirable), *Verrouillé*. Actions immédiates plutôt que la file
`pendingGifts` des badges : la sémantique diffère, et une file laisserait croire qu'on peut
refermer un mode mérité.

### L'animation

`js/expert-unlock-anim.js` + `css/expert-unlock.css`. Cadenas SVG **inline** — une image
externe qui n'arrive pas laisserait un trou au milieu de l'annonce. L'anse se détache et part
en rotation, le corps se fend, 14 éclats partent en étoile (angle et distance tirés en JS,
trajectoire décrite en CSS), onde de choc, puis le texte monte.

- **Un seul overlay quel que soit le nombre de modes** : enchaîner six animations ferait de
  l'annonce une punition. Les noms sont listés.
- **Import dynamique** depuis `gameCore.js` : le module lit `modeLabel()` d'ici, un import
  statique fermerait le cycle (CLAUDE.md §4). Le module n'est donc pas même téléchargé tant
  qu'il n'y a rien à annoncer, et un échec de chargement ne casse pas la partie.
- `prefers-reduced-motion` : le cadenas s'ouvre quand même (sinon l'annonce n'a plus de sujet)
  mais sans tremblement ni éclats. Doublé d'un garde-fou `@media` au cas où `matchMedia` serait
  indisponible.
- Animations préfixées `eu*` — `shake`/`burst` sont bien trop communs pour une feuille chargée
  à côté des 6 modes.

### Le garde-fou qui compte

`diffNewlyUnlocked(prev, next)` ne renvoie **rien** quand `prev` est absent. Sans ça, une
première visite, un cache vidé ou une navigation privée feraient paraître neufs les 6 modes, et
le joueur se prendrait six animations pour des accès qu'il avait depuis longtemps. Rater une
animation est bénin ; en inventer une ne l'est pas.

`consumeNewlyUnlockedExpertModes()` vide la liste à la lecture : l'appel à `fetchExpertStatus()`
est dédoublonné, mais pas ses lecteurs.

### Tests

- `tests/php/ExpertUnlocksTest.php` : +6 méthodes (28 au total) — le don ouvre sans partie
  jouée, ne gonfle pas la progression, reste cloisonné par mode et par compte, un accès gagné
  n'est pas étiqueté « offert », retirer le don ne reprend pas un accès mérité, et la contrainte
  UNIQUE rend l'endpoint idempotent.
- `tests/expertUnlock.test.js` : +8 (28 au total) — les deux sens du diff, l'absence d'état
  précédent, un mode apparu entre deux visites, plusieurs modes d'un coup, et la consommation
  unique.
- Validé de bout en bout sur la stack Docker : les 6 modes forcés à « verrouillé » en cache,
  seul celui réellement débloqué côté serveur est annoncé.

### Angles morts connus

- **Aucun test E2E de l'animation** — elle dépend d'une transition d'état entre deux
  chargements, coûteuse à monter en Playwright. Vérifiée à la main via un script de reproduction.
- L'annonce se déclenche au **prochain chargement d'une page de mode**, pas à l'instant où la
  partie franchit le seuil : `fetchExpertStatus()` n'est appelé qu'au câblage du bouton. Un
  joueur qui débloque puis quitte sans changer de page verra l'animation à sa visite suivante.

## 2026-08-26 — fix(seo): l'aperçu des liens partagés pointait vers un domaine inexistant

Remonté par un joueur sur Discord, capture à l'appui : un lien `personadle.net` collé dans
Discord s'affiche en **lien bleu nu**, sans logo ni description, là où d'autres jeux du même
genre (cémantix) rendent une carte complète.

### Cause

Les balises Open Graph de `index.html` pointaient vers **`personadle.com`** — un domaine qui
**ne résout pas du tout** (vérifié : `curl` renvoie `000`, pas même une erreur HTTP). Le site
est sur `.net` depuis toujours.

| URL | Code |
| --- | --- |
| `https://www.personadle.com/img/New_Logo_PersonaDLE.png` | **000** (DNS mort) |
| `https://www.personadle.net/img/New_Logo_PersonaDLE.png` | 200 |

Discord récupérait donc bien le `og:title` (d'où le titre bleu visible sur la capture), mais
échouait sur l'image et n'avait aucune description à afficher. Le `<link rel="canonical">`
était faux de la même façon — il désignait aux moteurs de recherche une URL canonique
inexistante, ce qui est nettement plus grave que l'aperçu Discord.

**Pourquoi ça a tenu si longtemps sans être vu** : un aperçu de lien cassé est invisible
depuis le site. Rien dans la CI, les tests ou la navigation normale ne le traverse — il ne se
manifeste qu'au moment où quelqu'un partage l'URL ailleurs.

### Correctif

- Domaine corrigé sur le `canonical` et l'`og:image`.
- Balises manquantes ajoutées : `og:type`, `og:site_name`, `og:url`, `og:description`,
  `og:image:type`, `og:image:alt`, `og:locale`. Sans `og:description`, la carte reste vide
  même quand l'image charge.
- `og:image:width` / `height` renseignés aux dimensions réelles (2769×1054, relevées dans
  l'en-tête IHDR du PNG). Sans elles, Discord doit télécharger l'image pour les déduire et
  rend souvent une vignette au premier partage.
- `twitter:card = summary_large_image` + les balises `twitter:*` : Discord les lit aussi, et
  c'est ce qui donne la bannière pleine largeur au lieu d'une vignette. Le logo est en 2,6:1,
  format fait pour ça.
- `theme-color` = `#e63946`, la couleur de la barre latérale de l'embed. Reprise de
  `css/global.css` (14 occurrences) plutôt que choisie au jugé.
- Commentaire d'avertissement laissé dans le `<head>` : toute URL absolue ajoutée là doit
  rester sur `.net`.

### Angle mort connu

**Seul `index.html` porte des balises OG.** Les 6 pages de mode (`classiqueMode.html`,
`musics.html`…) n'en ont aucune : un lien partagé vers un mode précis n'aura toujours aucun
aperçu. Non traité ici — c'est la page d'accueil qui circule, et les pages de mode
mériteraient chacune leur propre `og:title`/`description`, pas une copie de celles-ci.

## 2026-08-26 — feat(content): 3 musiques + Chord Summer en All-Out Attack

Lot de contenu fourni par Hamza : trois chansons et un skin P5X de plus.

### Musiques

| Titre | Opus | Fichier | Pochette |
| --- | --- | --- | --- |
| Wait and See | PQ2 | `Wait_and_See.mp3` | `PQ2.webp` |
| Heartful Cry | P3FES | `Heartful_Cry.mp3` | `P3FES.webp` |
| Kimi no Tonari | P2IS | `Kimi_no_Tonari.mp3` | `P2IS.webp` |

Fichiers renommés en `snake_case` depuis les originaux téléchargés (`Wait and See (2).mp3`,
`Heartful Cry (P3R ver (mp3cut.net).mp3`, `Next To You (Kimi no Tonari) - … (mp3cut.net).mp3`)
et déposés dans `musicsMode/database/music/song/`. Ce sont les **versions découpées** qui ont
été retenues, pas les originales complètes : c'est le format déjà en place (les 92 pistes
existantes vont de 370 Ko à 3,4 Mo).

`P3FES.webp` est bien la pochette utilisée par « Don't » et « Disconnected » — vérifié dans
`songs.js` plutôt que déduit, `P3FES_song.webp` existe aussi et n'est pas celle-là.

Pool quotidien : `music` 92 → **95**.

### Chord Summer (P5X)

- `aoaCharacters.js` — `{ nom: "Chord Summer ( Ayaka Sakai )", gif: "Chord_Summer" }`, placé
  dans la section « P5X — Skins Summer » existante, à côté de Marian et Puppet.
- `personas_allOut.js` (pool d'autocomplétion) et `portraitsMap.js` — mêmes conventions que
  `Closer Summer`, qui sert de modèle pour toute la famille des skins Summer.
- `database/img/Chord_Summer.webp` (portrait) et `Chord_Summer_Battle.webp` (victoire).
- `database/allOutAttack/Chord_Summer.webp` — animation convertie depuis le `.mp4` fourni.

Pool quotidien : `alloutattack` 71 → **72**. Aucun pool Expert séparé pour AOA — l'Expert
rejoue le pool normal avec flou figé + N&B, le skin y entre donc automatiquement.

#### Conversion de l'animation

Le modèle a été **relevé sur les fichiers existants** plutôt que deviné, en parsant les
chunks `VP8X`/`ANMF` : `Chord.webp` et `Closer_Summer.webp` font tous deux 800×450, ~142
frames, 4,3 s, ~33 fps, 5,1–5,6 Mo. Commande retenue :

```bash
ffmpeg -i Chord_Summer.mp4 -map 0:v:0 \
  -vf "fps=33,scale=800:450:flags=lanczos" \
  -c:v libwebp_anim -lossless 0 -q:v 72 -compression_level 6 -loop 0 -an -f webp \
  allOutAttackMode/database/allOutAttack/Chord_Summer.webp
```

Deux pièges rencontrés, notés ici parce qu'ils reviendront au prochain skin :

- **Le compteur de ffmpeg ment sur ce muxer.** Il affiche `frame= 1` et un `time=` négatif
  aberrant, alors que le fichier produit contient bien toutes les frames. Ne pas conclure à
  l'échec sur cette sortie — vérifier le fichier (compter les chunks `ANMF`).
- **`-fps_mode passthrough` casse l'animation** (une seule frame réellement encodée). À ne
  pas ajouter « par précaution ».

Résultat : 800×450, 193 frames, 8,36 s, 4,0 Mo.

### Reste à faire sur ce lot

- [ ] **Paroles Expert de « Wait and See » et « Kimi no Tonari »** — à coller par Hamza dans
      `expert_mode_content.md` (section `== Music ==`, sous l'en-tête d'opus correspondant),
      puis `npm run lyrics:build && npm run pools:build`. Ce `.md` est la source de vérité
      curée à la main : `expert_lyrics.js` en est **généré**, ne jamais l'éditer directement
      (docblock du fichier). Tant que ce n'est pas fait, `music_expert` reste à 73 et les deux
      titres ne sortent qu'en Music normal. « Heartful Cry » n'a pas de paroles fournies et
      restera hors du pool Expert, comme les instrumentales.
- [x] **Upload de `Chord_Summer.webp` (animation) sur le R2 Cloudflare**, sous-dossier
      `allOutAttack/` — fait par Hamza le 2026-08-26. En local le mode lit
      `./database/allOutAttack/`, mais en production il lit le CDN (`cdn()` dans
      `modeAllOutAttack.js`, bascule sur le hostname) : sans cet upload le skin se serait
      affiché cassé en prod alors qu'il marche en local.
- [x] **Champ `lien`** (URL YouTube d'écoute, affichée en fin de partie) — renseigné pour les
      3 entrées le 2026-08-26, liens fournis par Hamza. Paramètres `?si=` de partage retirés :
      ils n'apportent rien et alourdissent le dataset.
- [ ] **`vocalist` vide sur « Heartful Cry »** — aucune info fournie. 13 entrées sont déjà dans
      ce cas, le champ est toléré.
- [ ] **Durée de l'animation** : 8,36 s contre ~4,3 s pour toutes les autres AOA. Le `.mp4`
      source est plus long que les clips habituels. À arbitrer — si le rendu traîne en jeu,
      retrimmer la source et reconvertir.

## 2026-08-26 — test(expert): couverture automatisée de la porte d'entrée + `make test-php` réparé

Les deux derniers points ouverts du lot « porte d'entrée du Mode Expert » (`TODO.md` §1) :
le gate serveur et sa redirection étaient vérifiés **à la main via curl**, pas automatisés.
CLAUDE.md §13 l'exige pour toute condition de déblocage — un seuil qui dérive ou un
`is_expert = 0` oublié dans une requête ouvrirait les 6 modes sans qu'aucun test ne rougisse.

En les écrivant, un trou plus large est apparu : **`make test-php` n'exécutait pas les tests
qu'il prétendait lancer**.

### `make test-php` sortait vert avec la moitié des tests jamais exécutés

Les tests d'intégration (`ConditionCheckTest`, `DatabaseIntegrationTest`, `StreakTest`,
`FriendsTest`…) se connectent à `DB_TEST_HOST:DB_TEST_PORT`, avec pour défaut
`127.0.0.1:3307` — les coordonnées **vues depuis l'hôte**. La cible `test-php` lance PHPUnit
**dans le conteneur php**, où la base est `db:3306` et où `127.0.0.1:3307` ne répond pas.
Chaque test se marquait alors `skipped` via son `markTestSkipped()` de garde, et la cible
sortait `OK`.

Mesure avant/après :

| | Tests | Assertions | Skipped |
| --- | --- | --- | --- |
| Avant | 215 | 483 | **106** |
| Après | 215 | 966 | 0 |

La CI ne voyait rien : le job `lint-php` passe explicitement `DB_TEST_HOST`/`PORT`/`USER`/`PASS`
(`.github/workflows/ci.yml`), et fait tourner PHP sur le runner, pas dans le conteneur. D'où
une situation exactement à l'envers de ce qu'on veut — **le local plus permissif que la CI**.
C'est la cause racine du fait que le gate Expert n'ait jamais été couvert : les tests
d'intégration existants ne tournaient tout simplement pas sur un poste de dev.

Correctif : variable `PHPUNIT_DB_ENV` dans le `Makefile`, passée en `-e` à `docker compose
exec`. Valeurs en dur volontairement — l'en-tête du fichier interdit toute syntaxe shell
POSIX (`$${VAR:-defaut}`) pour que `make` fonctionne aussi sous `cmd.exe`.

### `tests/php/ExpertUnlocksTest.php` — 22 méthodes, 50 assertions

Même pattern que `ConditionCheckTest` : vraie MariaDB, transaction annulée en `tearDown`,
skip propre si la base est absente. `ConditionCheckTest` ne vérifiait jusqu'ici que la
**présence** des nouveaux `condition_type` dans `personadle_known_condition_types()` — leur
comportement n'était couvert nulle part.

- `mode_wins_under_attempts` — borne à 4 essais incluse, abandons exclus, parties Expert
  exclues, isolation par mode et par compte. Un test verrouille la constante
  `PERSONADLE_FAST_WIN_MAX_ATTEMPTS` elle-même : le front affiche cette règle au joueur.
- `mode_wins_single_day` — c'est la **meilleure journée de la vie du compte** qui compte, pas
  la journée en cours (sinon le déblocage se reperdrait à minuit) ; `COALESCE(MAX(…), 0)`
  couvert par un compte sans aucune partie.
- `mode_consecutive_perfects` — série cassée par une victoire en 2 essais et par un abandon
  en 1 essai, **non** cassée par des journées sautées (la série se compte en parties), et
  départage à l'`id DESC` pour plusieurs parties le même jour.
- `personadle_expert_progress()` — déblocage au seuil **exact**, fail-closed sur un compte
  neuf pour les 6 modes, isolation Classique ⇏ Silhouette (même type, même seuil), mode
  inconnu ouvert plutôt que bloqué pour toujours, et absence de tout libellé dans la réponse
  (il serait en anglais pour les 6 langues).

### `tests-e2e/expert-gate.spec.js` — 7 tests

Les 6 specs `expert-*.spec.js` partent d'un compte pré-débloqué et testent le *gameplay* ;
aucune ne couvrait ce qui arrive à quelqu'un qui n'a pas le droit d'être là. Un test jsdom ne
peut pas le faire non plus — `tests/expertUnlock.test.js` doit remplacer `expertNavigate.go`,
jsdom n'implémentant pas la navigation.

- Visiteur anonyme : `?expert=1` tapé à la main renvoie au mode normal ; bouton `expert-locked`
  avec `aria-disabled` et **sans `href`** (un clic droit « copier le lien » ne doit pas donner
  une porte d'entrée) ; infobulle reliée par `aria-describedby` ; deux chargements successifs
  n'ouvrent pas le mode (le cache `localStorage` du statut ne doit pas devenir une dérobade).
- **Contre-preuve** : le compte débloqué en Classique reste bien sur `?expert=1`. Sans elle,
  un gate qui redirigerait tout le monde ferait passer les tests anonymes.
- Isolation par mode côté front : ce même compte est redirigé sur Silhouette Expert.

### Fichiers touchés

- `tests/php/ExpertUnlocksTest.php` (nouveau)
- `tests-e2e/expert-gate.spec.js` (nouveau)
- `Makefile` — `PHPUNIT_DB_ENV`, passée à la cible `test-php`
- `scripts/check-doc-numbers.js` — point de synchronisation pour `TODO.md`, dont la ligne
  « Vérifié le … » citait des chiffres en dur sans jamais être recalculée (elle annonçait
  encore 778 tests / 102 E2E, réels 801 et 109)
- `TODO.md` — §1 soldée ; retrait de l'affirmation périmée « le changelog joueur ne contient
  aucune entrée Expert », comblée par la PR #71
- Chiffres de doc resynchronisés par `npm run docs:fix` (193 → 215 PHPUnit, 102 → 109 E2E)

### Angles morts connus

- La correspondance des seuils entre `api/lib/expert_unlocks.php` et
  `tests-e2e/helpers/expert-unlock.js` reste **recopiée à la main** des deux côtés. Aucun test
  ne compare les deux tables : changer un seuil en PHP sans toucher le helper ferait échouer
  les specs Expert de façon opaque (déblocage incomplet → 403), pas avec un message clair.
- `make test-php` cible la base de **développement**, pas une base jetable : les tests
  s'appuient sur `ROLLBACK`, ce qui suffit tant qu'aucun test ne fait de DDL.

## 2026-08-25 — feat(expert): porte d'entrée des 6 Modes Expert + badge Denial of Self

Les 6 Modes Expert étaient ouverts à tout le monde (bouton ⚡ visible et cliquable par
n'importe qui). C'était le point bloquant n°1 de `TODO.md` avant la release : une fois la
v2.1 en prod, restreindre un accès déjà donné se lit comme un retrait, pas comme une
progression. Ce lot ferme la porte pendant que la fenêtre est encore ouverte.

**Conditions retenues** (une par mode, arbitrées avec Hamza le 2026-08-25) :

| Mode | Condition |
|---|---|
| Classique, Silhouette | 10 victoires en 4 essais ou moins chacune |
| Émoji | 10 victoires sur une seule journée |
| All-Out Attack, Personae, Musique | 15 victoires parfaites (1 essai) d'affilée |

### Détails techniques

- **`api/lib/expert_unlocks.php` (nouveau)** — source **unique** des 6 seuils, lue à la fois
  par le gate de `api/sessions.php` et par `/api/user/expert-status`. Les deux les
  déclaraient séparément dans un premier jet : c'est exactement la duplication qui fait
  diverger la règle appliquée de la règle affichée.
- **`api/lib/condition_check.php`** — 4 nouveaux `condition_type` :
  `mode_wins_under_attempts`, `mode_wins_single_day`, `mode_consecutive_perfects`, et
  `expert_modes_mastered` (badge). Ils lisent `game_sessions` et non `user_stats`, qui n'a
  qu'une ligne par (user, mode) et ne connaît ni le nombre d'essais, ni la date, ni Expert
  vs normal. La logique de comptage est sortie en fonctions réutilisables
  (`personadle_count_*`) parce que l'infobulle affiche la **progression** (« 7 / 10 »), pas
  seulement un booléen.
- **`api/sessions.php`** — refuse `is_expert = 1` en 403 si le mode n'est pas débloqué. Le
  mode vit dans l'URL : un gate purement client se contourne en tapant `?expert=1`.
- **`api/user/expert_status.php` (nouveau)** + sa `RewriteRule` dans `api/user/.htaccess`
  (sans elle : 404, cf. CLAUDE.md §7). Renvoie `{unlocked, condition_type, required,
  current}` par mode — **aucun libellé** : le texte serait anglais pour les 6 langues.
- **`js/gameCore.js`** — `expertContext()` expose désormais `modeKey`, la clé backend
  normalisée. `statsKey`/`hashMode` valent `"Classic"`/`"ClassicExpert"` : les envoyer à
  l'API n'aurait matché aucun mode et le bouton serait resté déverrouillé en silence.
  `setupExpertToggle()` reste synchrone et pose le verrou après réponse du backend.
- **Migration `033_badge_denial_of_self.sql`** + seed `bdd_mysql.sql` + `badgesData.js` +
  i18n 6 langues. `condition_type = 'expert_modes_mastered'`, valeur 10.
- **`tests/expertUnlock.test.js`** — 11 tests : normalisation de la clé de mode, libellé de
  condition par type, verrouillage/déverrouillage du bouton, non-verrouillage du bouton de
  retour depuis une page Expert, et mise en cache de la réponse.

### Décisions à noter

- **Les 6 conditions ne sont PAS en base.** Ce sont des conditions d'accès, pas des
  récompenses : les mettre dans `badges` les ferait apparaître dans la collection du joueur,
  et `category` n'accepte de toute façon que
  `'achievement'|'streak'|'event'|'secret'|'social'`. Seul `denial_of_self`, vraie
  récompense, est en base.
- **`mode_wins_single_day` regarde la MEILLEURE journée**, pas la journée en cours — sinon
  le joueur qui remplit la condition aujourd'hui la reperdrait demain à minuit.
- **`denial_of_self` n'est pas en `condition_type = 'manual'`.** `manual` renvoie toujours
  `true` dans `personadle_verify_condition()` : le badge aurait été décrochable par un simple
  `POST /api/badges/unlock`.

### Récompenses du lot

- **Badge `denial_of_self`** (migration 033, epic) — 10 victoires Expert dans **chacun** des
  6 modes. Récompense la polyvalence.
- **Titre `shadows_converge`** (migration 034, legendary) — 50 victoires Expert **au total**,
  peu importe la répartition. Récompense le volume : un joueur qui n'aime que deux modes
  décroche le titre sans jamais obtenir le badge. `condition_type = 'expert_wins_total'`,
  à ne pas confondre avec `wins_total` qui lit `user_stats` — table que l'Expert n'alimente
  pas, et qui aurait donc compté les parties normales.
- Image nommée `shadows_converge.webp` en minuscules, et non `Shadow_Converge.webp` :
  `titles-ui.js` résout le chemin en `titles/${slug}.webp`, et Hostinger tourne sous Linux
  (casse significative) — l'écart aurait marché en local et donné un 404 en prod.
- Nom non traduit dans les 5 langues : c'est un titre-visuel, le texte est peint dans
  l'image (même règle que `junes` ou `joker_looking_cool`).

### Vérifications réellement exécutées (stack Docker)

Le PHP de ce lot a été exercé, pas seulement relu :

| Scénario | Résultat |
|---|---|
| `/api/user/expert-status` anonyme | 401 (route résolue, PHP parse) |
| 9 victoires ≤4 essais + 3 victoires lentes | `current = 9` — le filtre exclut bien les lentes |
| 10ᵉ victoire rapide | débloqué au seuil exact ; Émoji reste fermé (isolation par mode) |
| Session Expert sur mode verrouillé | 403 |
| Session Expert après déblocage | 201 |
| 49 puis 50 victoires Expert | titre refusé, puis accordé au seuil exact |
| Contrôle négatif (`memento_mori`) | 403 « Condition not met » |
| Migrations 033 et 034 rejouées ×2 | idempotentes, une seule ligne chacune |

### Angles morts connus

- **Le verrou client est optimiste** : hors ligne, backend en erreur ou visiteur non
  connecté, le bouton reste cliquable. Ce n'est pas un trou — `api/sessions.php` refuse la
  session de toute façon — mais un visiteur **non connecté** peut donc jouer en Expert sans
  rien débloquer (ses parties ne sont de toute façon jamais enregistrées). À trancher : faut-il
  exiger un compte pour l'Expert ?
- **L'infobulle ne se retraduit pas au changement de langue à chaud** : le libellé du bouton
  suit `data-i18n`, mais le `title` (qui porte les chiffres) est posé une fois.
- **`personadle_count_consecutive_perfects()` sature à 200 parties** — sans effet sur le
  déblocage (le plus haut seuil est 15), seulement sur l'affichage d'une série très longue.
- **Défis en Mode Expert** toujours neutralisés (`TODO.md` §4) : à faire après ce lot, comme
  prévu — proposer un défi sur un mode non débloqué n'aurait pas de sens.

## 2026-08-21 — fix(review): correctifs de la revue de la PR #69

Revue complète de la PR #69 (`develop...feat/v2.1-expert-modes`, 118 fichiers). Les 725
tests, le lint, `pools:check`, `i18n:check`, `docs:check` et `data:check` étaient verts —
et trois régressions fonctionnelles passaient quand même, toutes silencieuses.

### Bloquants

**Les stats Expert du profil ne s'affichaient jamais.** `renderExpertStats()`
(`profile/profile-page.js`) lisait `localStorage["user"]`, une clé que **rien n'écrit dans
le dépôt**. `userId` valait toujours `null`, la fonction sortait avant l'appel API. Tout
l'aval était donc du code mort : `expert_by_mode`, `personadle_expert_stats_by_mode()`, le
CSS `.expert-stat-row`, les trois clés i18n et le conteneur HTML. Corrigé en
`window._currentUser?.id ?? localStorage.getItem("playerUserId")` — la clé réellement
écrite par `updateAuthUI()`.

**La partie quotidienne d'Émoji n'était plus enregistrée à partir du 2e jour.** Le garde
`isGameLogged()` compare `gameLogged_<scope>` à `gameId_<scope>` ; seul `startGame()` les
réarme, et Émoji ne l'appelait que depuis le bouton Rejouer. Au changement de jour, les deux
clés valaient encore celles de la veille → `isGameLogged()` restait vrai → `savePendingSession`
était sauté, sans erreur ni log.

**Une variante Expert consommait le reset quotidien de sa variante normale.** Tout l'état de
partie est scopé par `EXPERT.key(...)`, mais pas `lastPlayedDate_*` — sauf en Silhouette et
Music. Ouvrir `?expert=1` un nouveau jour écrivait la date du jour et ne resettait que les
clés Expert : la page normale se croyait à jour, restituait la partie terminée de la veille
et ne tirait jamais la cible du jour. Idem en sens inverse.

Les trois sont la même famille de bug : du **câblage**, pas de la logique. `startGame()` /
`isGameLogged()` avaient 11 tests unitaires impeccables qui ne disaient rien de qui les
appelle ni quand.

**Correction de fond plutôt que trois rustines** : `startGame()` a été déplacé dans
`checkResetOnLoad()` (`js/gameCore.js`), seul point commun aux 6 modes. Laissé aux callbacks,
il devait être répété dans 2 chemins × 6 modes — 12 occasions de l'oublier, une l'avait déjà
été. Les 6 modes passent désormais `EXPERT.key("lastPlayedDate_X")` et `STATS_SCOPE`.
`statsAlreadyLogged` (Classique, Silhouette) a été supprimé : cette copie capturée au
chargement du module ne voyait pas le réarmement, `isGameLogged()` est lu à chaque usage.

### Classement — décision produit tranchée, calcul inchangé

La revue avait signalé que la migration 032 supprime `uq_session_per_day`, seul plafond
d'insertion de sessions, et proposé de compter des jours distincts au classement.

**Écarté (Hamza, 2026-08-21) : le classement doit compter des PARTIES.** « Toutes les
parties comptent » vaut aussi pour lui — 100 victoires réellement jouées dans la journée
valent 100. Compter des jours distincts pénaliserait le joueur assidu, c'est-à-dire
exactement celui que le classement récompense. Les tris par ratio et par streak (TODO.md)
apporteront les autres angles de lecture.

`SUM(win)` / `COUNT(*)` restent donc **inchangés** dans `api/cron/leaderboard.php` et
`api/leaderboard/index.php` ; seul un commentaire y consigne la décision, pour éviter qu'une
prochaine revue repropose la même chose.

Reste **distinct et non traité** : l'anti-triche ne vérifie la cible attendue que sur la
*première* session du jour (`$hasSessionToday`, `api/sessions.php`), parce qu'un replay tire
une cible aléatoire côté client et qu'un écart y est donc normal. Les sessions suivantes sont
acceptées sans contrôle de `target_name`, `attempts` ni `time_ms`. Ce n'est pas le sujet
ci-dessus — jouer 100 parties est légitime, en injecter 100 par appel direct à l'API ne l'est
pas — et ça reste ouvert (cf. angles morts).

### Rate limit des sessions — le vrai plafond, recalibré

`rateLimit('sessions:' . $userId, 15, 15 * 60)` (`api/sessions.php`) datait du monde où
`uq_session_per_day` bornait le jeu à 6 sessions par jour, une par mode : 15 était alors dix
fois au-dessus du besoin. La migration 032 lève cette contrainte — **ce rate limit devient
donc le plafond effectif du jeu**, et il coupe à la 16e partie d'affilée.

Rien n'est perdu (les sessions partent en file `pendingSessions`), mais elles n'arrivent en
base qu'au rechargement de page suivant, une fois la fenêtre rouverte. Entre-temps :
`user_stats` ne bouge pas, donc pas de mise à jour du profil, pas de présence au classement,
pas de badge de volume — alors que le joueur a bien joué. Et comme `pullProfileFromCloud()`
écrase le local par le backend (source de vérité), le compteur affiché **reculait**.

Ça touche de plein fouet le profil de joueur réel de PersonaDLE : des sessions longues,
beaucoup de parties dans la même soirée pour chasser badges et trophées, plutôt que de la
régularité quotidienne. Porté à **90 / 15 min** = 6 parties/minute soutenues, là où la partie
la plus rapide du jeu (replay Émoji ou AOA dont on connaît la réponse) prend ~10-15 s. Aucun
joueur réel ne l'atteint ; un bot reste borné. La valeur doit aussi absorber un rattrapage :
`syncPending()` rejoue toute la file d'un coup, une requête par session.

**Vérifié de bout en bout** sur base jetable au schéma post-PR, 50 victoires classique le même
jour passées par le vrai `personadle_record_game_session()` :

| Point | Résultat |
|---|---|
| `user_stats` | `games=50`, `wins=50`, `streak=1`, 38 min cumulées |
| Classement `ever` (lit `user_stats`) | score **50** |
| Classement `day` (lit `game_sessions`) | score **50** |
| Badges `mode_wins ≥ 50`, `mode_games ≥ 30`, `games_total ≥ 25` | débloqués |
| Badge `unique_days ≥ 2` | non débloqué — normal, c'est une condition de régularité |
| Lignes `game_sessions` | 50 |

À savoir : les classements `day` / `week` / `month` passent par `leaderboard_cache`, alimenté
par un cron **horaire** — jusqu'à 1 h de latence. Seul `ever` est immédiat (lecture directe de
`user_stats`).

### Robustesse

- `crypto.randomUUID()` n'existe qu'en contexte sécurisé et depuis Safari 15.4 : sur
  `http://<ip-du-LAN>` ou un vieil iPhone, `startGame()` levait et cassait le chargement du
  mode. Repli hexa dans `newId()` — rien ici n'exige d'unicité cryptographique.
- `syncPending()` (`js/api.js`) pose et **persiste** une clé d'idempotence sur les sessions
  mises en file avant la 032 : sans elle, un timeout sur une requête que le serveur avait
  traitée les insérait deux fois.
- `initAuth()` : `window._authResolved` remis dans un `finally`. `_fetchMeWithRetry()` ne
  lève jamais, mais `updateAuthUI()` touche au DOM ; une exception d'affichage bloquait
  toutes les pages qui attendent le drapeau.
- `isTransportError()` classe le **429** en transport : le rate limit ne dit rien de la
  validité de la session, le traiter en réponse autoritaire déconnectait un joueur connecté.
- Plafond `attempts` en Expert : 40 → 200. En Classique Expert le joueur n'a aucun retour
  sur 180 candidats ; dépasser 40 essais y est normal, et `syncPending()` jette
  silencieusement toute session refusée en 400 — la partie était perdue sans un mot.
- `expertPool()` (Personae) ne retombe plus sur le pool complet quand les fiches de lore
  manquent : il tirait dans 173 entrées là où le serveur en attend 159, donc une cible
  différente, une partie sans indice et un `anti_cheat` à chaque enregistrement. La page
  bascule sur le mode normal si le chargement échoue.
- `_seedNewOpus()` (`js/filterMenu.js`) : le drapeau `<clé>_seeded` est désormais posé aussi
  pour un joueur sans filtres enregistrés. Sans ça son premier décochage de PTS (ou de P1 en
  Personae) était annulé au chargement suivant — le bug « impossible à décocher » subsistait,
  une fois au lieu de toujours.
- `maskTerms()` : l'apostrophe est une frontière de mot. « Io » n'était pas masqué dans
  « Io's transformation », et la fiche donnait la réponse dès la première ligne.
- Personae Expert : `personaImg.alt` ne porte plus le nom de la persona (la réponse en clair
  dans le DOM) et `src` est retiré au lieu d'être vidé — `src=""` déclenche une requête vers
  l'URL du document sur certains moteurs.
- `client_session_id` : validation resserrée en groupes hexadécimaux séparés par des tirets.
  `[0-9a-fA-F-]{8,36}` acceptait `--------`.

### Dette supprimée

`musicsMode/modeMusic.js` réimplémentait à la main la détection d'URL Expert, les clés et le
lien de bascule, là où les 5 autres modes utilisent `expertContext()` / `setupExpertToggle()`.
Deux copies de la même logique, dont une seule aurait reçu le prochain correctif. Music passe
sur la plomberie partagée (−25 lignes).

### Migrations

`031` et `032` gagnent `IF EXISTS` / `IF NOT EXISTS` sur leurs `DROP INDEX` / `ADD UNIQUE KEY`
et l'ordre obligatoire est écrit en tête de la 032 (sa colonne est déclarée `AFTER is_expert`,
que la 031 crée). `ALTER TABLE` n'étant pas transactionnel, un échec à mi-parcours laissait
la table à moitié migrée.

**Elles ont été rejouées pour de vrai** contre une base vierge au schéma *pré-migration*
(`git show develop:sql/bdd_mysql.sql`), puis une seconde fois pour vérifier l'idempotence :
schéma final identique à `sql/bdd_mysql.sql`, 15 colonnes d'index, rejeu sans erreur. C'est
la vérification qu'exige la DoD (CLAUDE.md §13) et que la CI ne peut pas faire : elle charge
`bdd_mysql.sql`, qui contient déjà le schéma d'arrivée, donc aucun environnement ne rejoue
jamais `sql/migrations/*`.

### Tests — la vraie leçon

`tests/expertWiring.test.js` (nouveau, 45 tests). Les trois bloquants ci-dessus étaient tous
invisibles aux tests de primitives. Ce fichier teste deux choses qu'un test unitaire ne peut
pas voir :

1. **Le contrat de vie** — « nouveau jour ⇒ la partie est réarmée », sur la fonction que les
   6 modes partagent.
2. **Les invariants de câblage** — chaque mode appelle bien ce contrat, avec une clé scopée
   Expert, sans copie périmée, et en passant l'identité de partie comme clé d'idempotence.
   Vérifiés en lisant les sources (commentaires retirés, sinon l'invariant se satisfait d'une
   mention en prose). C'est le seul moyen de couvrir six fichiers de mode sans monter six DOM
   complets — et ça protège le 7e mode que personne n'a encore écrit.

Contre-vérifié : ces invariants relèvent **12 violations** sur le code d'avant les correctifs,
0 après. Un test qui ne peut pas échouer ne prouve rien.

Régressions ciblées ajoutées par ailleurs : repli sans `crypto.randomUUID` et clé
d'idempotence sans lui (`gameCore.test.js`), 429 en transport (`authTransport.test.js`),
seeding d'un joueur neuf (`filterMenu.test.js`), apostrophe dans `maskTerms`
(`expertContent.test.js`), clé d'idempotence rétro-active de la file (`backend.test.js`).

Un test existant a été remplacé : « removes the previous day's stats key » nettoyait
`statsLogged_<mode>_<date>`, une clé que plus personne n'écrit depuis que la portée
d'enregistrement est la partie et non la journée. Il passait au vert en vérifiant un vestige
pendant que le vrai drapeau restait armé — précisément le trou par lequel le bug Émoji est
passé.

**725 → 778 tests, 37 → 38 suites.**

### Angles morts restants

- L'anti-triche ne couvre que la 1re session du jour par (mode, is_expert). Un client qui
  poste directement sur `/api/sessions` peut donc enregistrer des parties inventées
  (`target_name`, `attempts`, `time_ms` arbitraires) jusqu'au rate limit — 15 req / 15 min,
  soit ~1440/jour. Le classement comptant les parties par choix produit, c'est ce chemin-là
  qu'il faudra fermer si l'abus se présente : validation de `target_name` contre le pool du
  mode, ou vérification de la cible sur toutes les sessions non-replay.
- Aucun test PHPUnit ne couvre le calcul du score du classement.
- La CI ne rejoue toujours pas `sql/migrations/*` : elle charge `bdd_mysql.sql`. Un job de
  replay demanderait de rendre les migrations compatibles MySQL 8.0 (`ADD COLUMN IF NOT
  EXISTS` est MariaDB), donc de les réécrire en procédure stockée. Non fait.
- Le rate limit de `sessions.php` (15 req / 15 min) reste le seul plafond d'insertion de
  lignes `game_sessions` : la table est gonflable par script.

## 2026-08-20 — test(e2e): « 50 parties comptent pour 50 parties », prouvé de bout en bout

`tests-e2e/sessions-same-day.spec.js` — dernier point ouvert de la refonte des stats. Les
tests unitaires ne couvraient que la garde client (`startGame`/`isGameLogged`) ; rien ne
vérifiait que le serveur enregistre réellement la 2e partie du jour.

Quatre contrôles : trois parties le même jour dans le même mode toutes en 201 (et pas un
409 « déjà joué aujourd'hui »), stats cumulées à 3 parties / 2 victoires / 1 abandon avec
la **streak restée à 1**, rejeu d'un `client_session_id` déjà enregistré refusé en 409, et
partie Expert absente de `by_mode` mais présente dans `expert_by_mode`.

Ce dernier point est ce qui **prouve** le correctif d'`api/sessions.php` du même jour :
avec l'appel à 9 arguments, `is_expert` valait toujours 0 et la partie Expert serait
apparue dans les stats normales.

### Détail à connaître pour écrire d'autres tests de session

`uq_session_client_id` est unique **globalement**, pas par utilisateur. Des UUID écrits en
dur rejouent donc le run précédent et récoltent un 409 sans rapport avec ce qui est testé —
d'où `crypto.randomUUID()` à chaque exécution, même avec un compte neuf.

---

## 2026-08-20 — docs+ui: dossier de doc v2.1 et bandeau sombre du modal Nouveautés

Deux points laissés ouverts la veille, tranchés par Hamza.

### 1. Le changelog dev vit désormais dans le dossier de sa version

Ce fichier est neuf : `PersonaDLE 2.1/DEV_CHANGELOG.md`. Les **44 entrées v2.1** (Mode
Expert des 6 modes, contenu 2.1 — Trinity Souls, Persona 1, NPC, musiques, badge, titres —
et la refonte des stats) ont été **déplacées** depuis `PersonaDLE 2.0/DEV_CHANGELOG.md`,
qui ne garde que la v2.0 et ses correctifs post-lancement (59 entrées) et porte un pointeur
vers ici. Aucune entrée n'a été perdue ni réécrite : 44 + 59 = les 103 d'avant.

`CLAUDE.md` §9 et `CONTRIBUTING.md` pointent maintenant sur le dossier de la version **en
cours**, avec la marche à suivre à l'ouverture d'une v2.2 — c'est ce point de synchronisation
qui manquait, et qui avait laissé les entrées 2.1 s'accumuler dans le dossier de la 2.0.

### 2. Bandeau du modal « Nouveautés » en sombre

`index.html` — `.news-modal-bar` passe du blanc à un dégradé noir/rouge avec halo qui
respire, titre blanc en capitales à ombre rouge, croix de fermeture éclaircie (`#666` était
illisible sur fond sombre), bordure `#b3001b`. Le bandeau étant **commun à toutes les
versions listées**, tout le haut de la modale change de ton — arbitré par Hamza.

⚠️ Piège rencontré : `.news-modal-content h2 { color: #333 }` gagnait sur `.news-modal-bar
h2` (même spécificité, déclaré plus bas) — le titre restait gris foncé sur fond noir alors
que l'ombre rouge, elle, s'appliquait. La règle a été resserrée en `.news-modal-body h2`,
qui ne peut plus attraper le titre du bandeau. Le dark mode n'a plus qu'à aligner la
bordure : le bandeau est sombre dans les deux thèmes.

Vérifié en clair et en sombre : titre `rgb(255,255,255)` sur une seule ligne, 725 tests
Vitest verts, E2E smoke et game-flow verts.

---

## 2026-08-20 — docs: changelog joueur v2.1 (page dédiée, pas une reprise de la 2.0)

`PersonaDLE_Update_Documentation/PersonaDLE 2.1/PersonaDLE_Update.html` — nouvelle page,
même patron que la 2.0 (head, thème clair/sombre, blocs `data-i18n-block` FR/EN, barre de
progression, retour en haut), **contenu 2.1 uniquement** : le Mode Expert dans les 6 modes,
Persona 1 dans Personae, Trinity Souls et les nouveaux personnages, « toutes tes parties
comptent », confort de jeu et corrections notables. La 2.0 n'est ni recopiée ni réécrite,
elle reste à sa place et la page 2.1 y renvoie.

`index.html` — entrée `version-item` v2.1 en tête du modal Nouveautés, dans les 6 langues,
avec son bouton « Voir le Changelog complet » vers la nouvelle page.

Contenu illustré (2e passe) — la page ne se contente plus de listes : galerie des **20
personas de Persona 1** (`.p1-grid`, image + persona + manieur), bandeau du logo Trinity
Souls, fiches `char-card` du trio Kanzato avec leurs personas et des 4 nouveaux personnages
secondaires, carte `aoa-card` 3 colonnes pour **Panther Starlight** (portrait / GIF All-Out
Attack / artwork de combat, même gabarit que la carte Miku de la 2.0), et liste
`music-group` des **7 nouvelles musiques** avec pochettes et interprètes. Tous les assets
sont ceux du dépôt, aucun n'a été dupliqué dans le dossier de doc. 39 images, 0 cassée,
vérifié en FR et en EN.

`css/index.css` — **thème `expert-theme`** pour cette entrée, au lieu de réutiliser le
`v2-theme` de la 2.0 (bleu nuit + orange, orbes qui montent, avatar Sophia). La 2.1 est une
mise à jour de difficulté, elle est donc noire et rouge sang : bandeau presque noir, halo
rouge qui pulse, quatre **entailles** diagonales qui traversent le bandeau en boucle décalée,
titre en capitales avec ombre rouge, masque de Joker à la place de Sophia, bouton noir/rouge
à arête dure (`expert-btn`). Aucun asset ajouté — tout est en CSS et le masque existait déjà
dans `img/`. `prefers-reduced-motion` fige les entailles et le halo. `index.css?v=5`.

Note de diff : `npx prettier --write` a reformaté ~40 lignes de texte 2.0 déjà présentes
(retours à la ligne uniquement, vérifié fragment par fragment — aucun contenu modifié).

Vérifié en navigateur : bascule FR/EN correcte (30 blocs affichés d'un côté, 0 de l'autre),
aucune erreur JS, accordéon du modal ouvert sur la 2.1 avec ses 5 puces et son lien.

### À trancher

`DEV_CHANGELOG.md` (celui-ci) vit toujours dans le dossier `PersonaDLE 2.0/` alors qu'il
reçoit les entrées 2.1 depuis le début de la branche, et CLAUDE.md §9 pointe dessus. Soit
on l'y laisse (un seul changelog dev continu, le numéro de dossier ne veut alors rien dire),
soit on ouvre `PersonaDLE 2.1/DEV_CHANGELOG.md` au merge et on met à jour CLAUDE.md §9.
Décision de Hamza — rien n'a été déplacé sans son accord.

---

## 2026-08-20 — feat(data): Persona 1 dans le mode Personae (normal + Expert)

Le mode Personae ne connaissait que P2 → P5X et Trinity Souls : **P1 n'existait ni dans
`ALL_OPUS`, ni comme bouton de filtre**. Le lot d'assets de Léo (`new data/personae/`,
17 dessins + `lore.txt`) le rend jouable, avec sa fiche de lore dans les 6 langues pour
que chaque entrée soit aussi tirable en Expert.

### Contenu ajouté

- **20 entrées** dans `personaeMode/database/personaeCharacters.js` — 9 personnages,
  persona de départ et persona ultime, Naoya Todou en ayant trois :
  Naoya (Seimen Kongou, Amon-Ra, Vishnu) · Maki Sonomura (Maso, Verdandi) ·
  Masao Inaba (Ogun, Susano-o) · Kei Nanjo (Aizen Myouou, Yamaoka) ·
  Hidehiko Uesugi (Nemhain, Tyr) · Yukino Mayuzumi (Vesta, Durga) ·
  Yuka Ayase (Houri, Freyr) · Reiji Kido (Bres, Mot) ·
  Eriko Kirishima (Nike, Armaiti, Gabriel).
- **19 fiches de lore × 6 langues** (`personaeMode/database/expert_lore/*.json`), écrites
  à partir du `lore.txt` de Léo et ramenées au format maison (un paragraphe, 50–140 mots,
  `mask` couvrant toutes les graphies citées : `Shoumen Kongou`, `Verðandi`, `Mazu`,
  `Yngvi-Freyr`, `Mavet`…).
- 9 manieurs dans `persona.js` (autocomplétion) et `portraitsMapPersonae.js`.
- `ALL_OPUS` + bouton de filtre P1 dans `personaeMode/personae.html`.
- Images copiées dans `personaeMode/database/img/`, avec deux renommages :
  `Vinshu.webp` → `Vishnu.webp` (faute de frappe) et `Neamhain.webp` → `Nemhain.webp`
  (`characters_clean.js` écrit déjà « Nemhain », le champ `image` doit refléter le nom
  de la persona).

### Décisions

- **`Susano-o` : deuxième entrée, pas de fusion.** Yosuke Hanamura en a déjà une
  (P4G, `image: "Susano-o"`) ; celle de Masao a un dessin propre (`Inaba_Susano-o`),
  donc deux entrées — cas 2 de la règle en tête de `personaeCharacters.js` (identique à
  Hermes Junpei/Jun). **Une seule fiche de lore** couvre les deux : `expertWielders()`
  accepte désormais Yosuke ET Masao pour ce texte, le dieu shinto décrit étant le même.
  Aucune fiche `Susano-o` n'a donc été ajoutée, elle existait déjà.
- **`Yamaoka` n'est pas un mythe** — c'est Yamaoka Tesshu, sabreur et calligraphe du
  XIXe. Léo l'avait laissé sans texte (« pas d'histoire ») ; sans fiche, l'entrée serait
  injouable en Expert et le test de complétude du roster échouerait. Fiche écrite à
  partir de sa biographie, avec `Tesshu` dans le `mask` (le nom complet donnerait la
  réponse).
- **`DEFAULT_ON_NEW` scopé par mode** (`js/filterMenu.js`). P1 doit s'activer d'office
  pour les joueurs qui ont déjà des filtres Personae sauvegardés, mais **pas** dans
  Classique / Émoji / Silhouette, où P1 existe depuis toujours et a pu être décoché
  volontairement. La constante est donc devenue une table `{ _tous: [...],
  <storageKey>: [...] }`.

### Dessins plus petits que le cadre — correctif CSS

`personaeMode/personae.css` : `#personaImage` passe de `max-width/max-height: 90%` à
`width/height: 90%` avec le même `object-fit: contain`. Avec `max-` seul, un dessin plus
petit que le cadre s'affichait à sa **taille naturelle** : `Freyr` est fourni en 112×98 et
apparaissait comme une vignette perdue au milieu de la boîte, là où tous les autres la
remplissent. `contain` conserve le ratio, donc les grands dessins rendent exactement comme
avant — ils étaient déjà contraints par le cadre. Corrige aussi `Verdandi` (217×274) et
`Mot` (304×433), et tout futur asset sous-dimensionné. `personae.css?v=9`.

⚠️ `Freyr` reste un sprite de 112×98 : agrandi, il est nécessairement pixelisé. Un dessin
en pleine résolution serait à demander à Léo.

### Second envoi — Eriko Kirishima (même jour)

Les 3 dessins manquants sont arrivés dans la foulée : **Nike, Armaiti et Gabriel**,
soit trois personas comme Naoya Todou. Le roster Persona 1 du mode est donc complet,
9 personnages sur 9, **20 personas**. Les 3 fiches de lore sont écrites dans les 6
langues (`Armaiti` masque aussi `Spenta Armaiti`). Aucune collision de nom avec le
reste du dataset — `Nike`, `Armaiti` et `Gabriel` n'existaient nulle part ailleurs.

Vérifié : 724 tests Vitest verts (dont les 61 de `expertContent`, en 6 langues),
E2E `expert-personae` 6/6, `pools:check` vert, les 20 images servies en 200 par la
stack locale.

---

## 2026-08-20 — feat(expert): Mode Silhouette Expert (le flash) + 3 régressions attrapées au passage

Dernier mode Expert manquant, donc le point qui bloquait la fermeture de la branche.
La mécanique retenue n'est PAS le plan initial du TODO (dézoom figé + point de zoom
tiré au hasard sur un contour) : ce plan avait un angle mort connu — un point aléatoire
peut tomber en plein aplat noir et ne rien montrer, ce qui obligeait à pré-repérer des
ancrages par personnage (184 entrées à annoter à la main). Le flash contourne le
problème entièrement : on montre la silhouette **entière**, mais très peu de temps.

### Silhouette Expert

- **`silhouetteMode/modeSilhouette.js`** — `expertContext({ prefix: "silhouetteExpert",
  statsKey: "silhouette", hashMode: "Silhouette" })`, comme les 5 autres modes. Toutes
  les clés localStorage passent par `EXPERT.key()` ; `getDailyTarget()` utilise
  `EXPERT.hashMode` (`"SilhouetteExpert"`), chaîne déjà attendue par
  `api/lib/daily_target.php` (case `silhouette_expert`, migration 031) — aucun pool à
  ajouter, l'Expert rejoue le roster normal.
- **Mécanique** : l'image reste à `opacity: 0` en permanence. Le bouton `#flashButton`
  la révèle pendant `flashDurationMs(attempts)` = **120 ms + 60 ms par essai**.
  Économie : **1 crédit au départ** (sans lui la première tentative est à l'aveugle
  totale), **+1 par erreur**, **-1 par flash**. Crédits persistés
  (`silhouetteExpert_silhouetteFlashes`) — sans ça un F5 par essai rendait la partie
  gratuite.
- **Pourquoi un bouton et pas un flash automatique au guess** : le flash automatique se
  serait joué pendant que le joueur tape. Il faut pouvoir se préparer à regarder.
- **Pas de dézoom en Expert** (`INITIAL_ZOOM = 1`) : le dézoom progressif n'a aucun sens
  sur une image jamais affichée durablement.
- `opacity` et non `visibility` pour le masquage : `visibility` sert déjà au chargement
  d'image (`pickCharacter`), les deux se marchaient dessus.
- **Gating Expert** identique aux autres modes : pas d'`updateProfileStats()`, pas de
  `showCommunityStats()`, pas de `checkUnlocksAfterGame()`, pas de compteur
  `silhouetteWins` ; la session part bien au backend avec `is_expert: true`.
- **`silhouetteMode/silhouette.html`** — `#expertToggle`, `#rulesExpert`, `#flashButton` ;
  `#rulesText` renommé `#rulesNormal` (nom attendu par `setupExpertToggle()`).
- **i18n** — `modes.silhouette.expert_*` (10 clés) dans les 6 langues.
- **`tests-e2e/expert-silhouette.spec.js`** — 8 tests : bascule, cloisonnement des deux
  parties, image invisible au repos, flash payant qui se referme seul, crédit rechargé
  par erreur, persistance au rechargement, abandon qui logge `is_expert`.

### Régression 1 — la grille du mode Classique NORMAL avait disparu

`classiqueMode/modeClassique.js`. Le commit 77f6ded (2026-08-19) a supprimé **tout le
chemin de rendu de la grille** (`.guess-row`, les 7 `.guess-cell`, l'animation `flip`,
`removeFromAutocomplete`) au lieu de le déplacer dans la branche `else`. Résultat : en
mode normal, une tentative n'affichait plus que la ligne d'en-têtes — cliquer semblait
« ne rien faire ». Code restauré depuis `77f6ded^`, sans le `const isWin` en double
qui avait motivé ce refactor.

**Angle mort corrigé** : aucun test E2E ne couvrait le rendu de la grille en mode
**normal** (seule son *absence* en Expert était testée), d'où une suppression complète
sans une seule ligne rouge. `tests-e2e/expert-classic.spec.js` a désormais le test
miroir « une tentative affiche l'en-tête ET des cellules colorées ».

### Régression 2 — l'opus PTS était impossible à décocher

`js/filterMenu.js`. `DEFAULT_ON_NEW = ["PTS"]` était réinjecté à **chaque** chargement
tant que la liste sauvegardée n'était pas vide : décocher PTS le faisait revenir au
rechargement suivant. Le seeding est désormais mémorisé une fois pour toutes par mode
dans `<storageKey>_seeded` (`_seedNewOpus()`), et n'est jamais appliqué à une liste
vide (« tout décoché » est un choix du joueur). Couvert par `tests/filterMenu.test.js`.

### Régression 3 — `api/sessions.php` n'a jamais transmis `is_expert` ni `client_session_id`

Les deux valeurs étaient lues et validées en haut du fichier, puis **jamais passées** à
`personadle_record_game_session()` (appel à 9 arguments sur 11). Conséquences : toute
partie Expert s'enregistrait `is_expert = 0` et gonflait les stats du mode normal — alors
que `api/lib/game_session.php` contient tout le branchement pour l'éviter — et la clé
d'idempotence de la migration 032 n'était jamais écrite (colonne NULL), donc un rejeu de
la file `pendingSessions` insérait un doublon au lieu d'un 409. Commentaire anti-doublon
du fichier remis à jour au passage (il décrivait encore `uq_session_per_day`).

### Défis neutralisés en Expert — garde déplacée dans le partagé

`js/gameCore.js` (`getActiveChallengeTarget()`, `showChallengeButton()`) et
`js/challenge-result.js` (`checkChallengeCompletion()`) refusent maintenant l'Expert
directement. C'est la même décision que les 3 gardes `!EXPERT.isExpert` posées dans
Personae le 2026-08-19, mais au seul endroit par lequel les 6 modes passent — sinon
chaque nouveau mode Expert devait re-poser les mêmes gardes à la main (Silhouette
aurait été le premier à les oublier). À retirer quand `messages.challenge_is_expert`
existera (TODO §5).

### Confort de dev — le service worker ne s'intercale plus sur localhost

`sw.js` : sortie immédiate du handler `fetch` sur `localhost`/`127.0.0.1`. Aucun intérêt
hors ligne en dev, et c'est ce qui obligeait au « Ctrl+Shift+R / navigation privée » à
chaque modification. La prod garde ses stratégies inchangées. `CACHE_VERSION` → `v94`.

### Angle mort connu

Les crédits de flash vivent en localStorage, comme tout l'état de partie côté client :
un joueur peut s'en octroyer autant qu'il veut depuis la console. Même surface que
`silhouetteTarget` (qui donne directement la réponse) — rien de nouveau, et hors de
portée d'un correctif client.

Vérifié : 724 tests Vitest verts, E2E `expert-silhouette` 8/8, `expert-classic` 9/9,
`expert-emoji`, `expert-personae`, `game-flow` verts, `npm run lint` sans erreur,
`pools:check` et `i18n:check` verts.

---

## 2026-08-19 — fix(ui): bouton Expert aligné dans les 5 modes + deux flakes E2E

### Détails techniques

- **`emojiMode/emojiMode.html`, `allOutAttackMode/allOutAttack.html`** — le bouton Expert
  passe **sous le panneau de filtres**, comme dans Classique, Music et Personae. Il était
  sous l'historique des erreurs (Émoji) et sous le bandeau titre (AOA), donc relégué en bas
  de page. Les 5 modes ont désormais la même position.
- **`tests-e2e/expert-aoa.spec.js`** — budget porté à 90 s pour ce fichier seul.
  `attendreAoa()` peut attendre 15 s (GIF sur CDN externe) et `guessWrong()` jusqu'à 15 s par
  essai : un test qui enchaîne un chargement et 4 erreurs dépassait **structurellement** les
  30 s par défaut dès que les workers se partagent la machine. Ce n'était pas un aléa de
  charge — les deux tests passaient seuls et échouaient en parallèle.
- **`tests-e2e/expert-emoji.spec.js`** — les noms devinés sont filtrés sur la cible du jour.
  En dur, l'un d'eux finissait par **être** la cible selon la date : la partie était gagnée
  avant la 5e erreur, `#textbar` se retrouvait désactivé, et le test échouait pour une raison
  sans rapport avec ce qu'il vérifie.

Vérifié : 89 tests E2E verts, 721 tests Vitest verts.

---

## 2026-08-19 — fix(expert): leurre Émoji re-tiré à chaque partie + bouton Personae replacé

### Détails techniques

- **`emojiMode/emojiMode.js`** — le leurre et sa position étaient seedés sur la **date** :
  figés toute la journée, donc dix Replay d'affilée montraient le même émoji intrus au même
  endroit (« c'est toujours le premier »). La graine devient l'**identifiant de la partie**
  (`currentGameId`, gameCore.js) : stable tant que la partie dure — sinon le joueur repérerait
  l'intrus en rafraîchissant — mais re-tiré à chaque Replay. Deux parties sur le même
  personnage n'ont donc ni le même leurre ni la même position.
- **`js/gameCore.js`** — `currentGameId(scope)` exporté (crée l'identifiant à la volée s'il
  manque) ; `markGameLogged()` s'appuie dessus au lieu de dupliquer la création.
- **`database/characters_clean.js`** — `Kei Nanjo` portait `"1"` (U+0031, un chiffre nu) au
  lieu de `"1️⃣"` : le keycap avait perdu ses `U+FE0F U+20E3`. Le mode normal affichait donc
  un « 1 » brut comme premier indice, et le mode Expert pouvait le tirer comme leurre.
  Repéré en vérifiant la distribution du pool de leurres, pas signalé par `data:check`.
- **`personaeMode/personae.html`** — le bouton Expert passe sous le panneau de filtres, comme
  dans Classique et Music, au lieu d'être sous le bandeau titre où il se retrouvait en bas.
- **`tests/gameCore.test.js`** — 2 tests sur `currentGameId` (721 tests).

`emojiMode.js` en `?v=6`, `personae.css` en `?v=8`, `sw.js` en `v92`.

---

## 2026-08-19 — feat(ui): invocation de la persona et paroles à la machine à écrire

Deux animations demandées en test : la révélation manquait de moment, et les paroles
Expert apparaissaient d'un bloc alors que le mode imite un lecteur de streaming.

### Détails techniques

- **`personaeMode/personae.css`** — `personaSummon` (halo + rebond du cadre) et
  `personaSummonImg` (flou + surbrillance qui se résorbent). Portées par `.persona-box`
  et non par l'image : le halo doit envelopper le cadre.
- **`personaeMode/modePersonae.js`** — `setPersonaBoxVisible()` retire puis repose la classe
  `summoning` après un reflow forcé. Sans ça, deux révélations d'affilée (rejouer, regagner)
  ne rejoueraient pas l'animation, la classe étant déjà présente.
- **`#victoryBox img`** rejoue `personaSummonImg` **sans JS** : la victory-box passe de
  `display:none` à visible, ce qui redéclenche l'animation à chaque affichage. Le portrait
  s'invoque donc aussi en mode normal, où l'image de persona est visible dès le départ et
  n'offrait aucun moment de révélation.
- **`musicsMode/modeMusic.js`** — `taperVers()` écrit le vers caractère par caractère
  (28 ms). Seul le vers **qui vient d'être gagné** est tapé : `dernierVersTape` évite de
  retaper un vers déjà lu lors d'un re-rendu de la même partie (changement de filtre,
  révélation finale), ce qui passerait pour un bug plutôt que pour un effet. Le timer est
  annulé si un re-rendu survient en pleine frappe.
- **`musicsMode/music.css`** — le curseur est un `::after` clignotant, jamais un caractère
  du texte : une frappe interrompue laisserait sinon un curseur collé au vers.
- Les deux animations respectent `prefers-reduced-motion: reduce`.

`personae.css`/`modePersonae.js` en `?v=7`, `music.css` en `?v=6`, `modeMusic.js` en `?v=5`,
`sw.js` en `v91`.

---

## 2026-08-19 — feat(stats): toutes les parties comptent — câblage client des 6 modes

Le serveur enregistrait déjà chaque partie depuis la migration 032, mais le client gardait
la garde `statsLogged_<Mode>_<date>` : le joueur ne voyait aucun changement. Ce lot ferme
le point 1 du TODO.

### Détails techniques

- **`js/gameCore.js`** — `startGame()` / `isGameLogged()` / `markGameLogged()`. La garde
  passe de « une partie enregistrée **par jour** » à « **cette** partie a-t-elle déjà été
  enregistrée », scopée sur un identifiant régénéré à chaque tirage. Retirer la garde sans
  rien mettre à la place aurait rejoué l'enregistrement à chaque F5 : la restauration de
  session appelle `showVictory()`, qui contient le bloc de log.
- **`buildGameSession()`** accepte `clientSessionId`. Les modes y passent l'identifiant rendu
  par `markGameLogged()` : il est donc **stable pour toute la partie**, et un doublon après
  perte du flag local (autre onglet, nettoyage navigateur) est refusé côté base par la
  contrainte `client_session_id` au lieu de dépendre du seul client.
- **Les 6 modes** (`modeClassique`, `emojiMode`, `modeMusic`, `modeSilhouette`,
  `modeAllOutAttack`, `modePersonae`) : `todayKey` supprimé, garde et log remplacés,
  `startGame()` appelé au Replay/reset. L'exclusion des parties de défi (`isChallengePlay()`)
  est conservée telle quelle dans chaque mode — sinon un défi compterait deux fois.
- **`updateProfileStats()` n'avait rien à changer** : il accumule déjà (`stats.games + 1`) et
  sa streak n'avance que quand la date Paris change. Le client et le serveur restent donc
  d'accord au prochain `pullProfileFromCloud()`.
- **`tests/gameCore.test.js`** — 10 tests sur la nouvelle garde : survie au rechargement,
  réarmement au tirage suivant, identifiants distincts, portées indépendantes entre modes et
  entre normal/Expert, et reprise de l'identifiant par `buildGameSession()`. 719 tests.

Reste au point 1 : un test E2E « deux parties le même jour apparaissent toutes les deux ».

---

## 2026-08-19 — fix(expert): fiche Personae isolée + circuit défi neutralisé

Suite des retours de test sur Personae Expert.

### Détails techniques

- **`personaeMode/personae.html`** — `#expertLoreBox` sort de `.persona-box` et devient sa
  **sœur**. Neutraliser le cadre carré au CSS ne suffisait pas : la fiche restait un enfant
  du conteneur image et en héritait la mise en page. En Expert `.persona-box` est masquée en
  entier (`personae.css`), la fiche est donc seule à l'écran.
- **`personaeMode/modePersonae.js`** — `setPersonaBoxVisible()` : le cadre image réapparaît
  à la révélation (`showVictory`) et est remasqué au tirage suivant. Les deux seuls sites qui
  touchaient déjà `personaImg.src` portent l'appel, pas de troisième état à maintenir.
- **`personaeMode/modePersonae.js`** — circuit défi neutralisé sur la page Expert. La clé
  `activeChallenge` n'est pas scopée par mode (`challenge_is_expert` reste au TODO), donc un
  défi créé en mode **normal** s'imposait comme cible en Expert — y compris une variante
  Picaro, sans fiche, donc une partie sans indice. Trois conséquences corrigées d'un coup :
  la cible de défi est ignorée en Expert, `checkChallengeCompletion()` n'y valide plus le défi
  normal sur une victoire Expert, et `isChallengePlay()` ne bloque plus l'enregistrement de la
  session quotidienne Expert.

`personae.css`/`modePersonae.js` en `?v=6`, `sw.js` en `v90`.

---

## 2026-08-19 — feat(expert): lore Personae en portugais + Replay sans fiche corrigé

Sixième et dernière langue des fiches Personae Expert, et deux correctifs signalés en jeu.

### Détails techniques

- **`personaeMode/database/expert_lore/pt.json`** — 137 fiches traduites depuis `en.json`
  (72–114 mots, moyenne 91). Tableaux `mask` écrits pour le portugais : `Apolo`, `Cérbero`,
  `Hécate`, `Plutão`, `Cinderela`/`Gata Borralheira`/`cinza`, `Caim`, `Estige`, `Papisa
  Joana`/`Inês`, `Minotauro`, `hortelã` (Minthe). Les 6 langues sont désormais complètes.
- **`tests/expertContent.test.js`** — `pt` câblé dans `LANGS`/`LORE` (709 tests).
- **`personaeMode/modePersonae.js`** — `getFilteredCharacters()` applique maintenant
  `expertPool()`. Le tirage du jour filtrait bien sur les personas ayant une fiche, mais le
  **Replay** tirait au hasard dans `filteredCharacters` non filtré : on pouvait tomber sur une
  persona sans lore, donc une partie sans le moindre indice. Un seul point de filtrage couvre
  maintenant tous les appelants (tirage, Replay, leurres de défi) — même classe de bug que le
  Replay de Classique Expert.
- **`personaeMode/personae.css`** — en Expert, on neutralise aussi `.persona-box` (le cadre
  carré 500×500 « Velvet Room ») en plus de masquer `#personaImage` : le cadre n'encadrait
  plus rien et comprimait la fiche dans un carré. Il ne reste que la zone de texte.
  `?v=5` sur `personae.css` et `modePersonae.js`.

---

## 2026-08-19 — feat(expert): fiches de lore Personae en italien + image cassée corrigée

Cinquième langue des fiches Personae Expert (`it.json`, 137 fiches, 72–107 mots, moyenne 90),
et correction d'un artefact visuel signalé en jeu.

### Détails techniques

- **`personaeMode/database/expert_lore/it.json`** — traduction complète depuis `en.json`
  (source de vérité). Les tableaux `mask` sont **écrits pour l'italien**, jamais recopiés de
  l'anglais : `maskTerms()` ne normalise pas les diacritiques, donc une forme localisée
  oubliée resterait en clair pendant toute la partie et donnerait la réponse. Cas notables :
  `Apollo`/`Apollon`, `Cerbero`, `Ecate`, `Cenerentola`/`cenere`, `Caino`, `Ade`/`Plutone`,
  `Ermes`/`Mercurio`, `Tersicore`, `Stige`, `Minotauro`, `Papessa Giovanna`/`Agnese`,
  `Guglielmo` (Captain Kidd / William), `Grande Saggio Uguale al Cielo` (Seiten Taisei).
- **`tests/expertContent.test.js`** — `it` ajouté à `LANGS` et à `LORE` : les 5 langues
  passent désormais les mêmes invariants (même jeu de clés, texte jouable, aucun masque
  pré-appliqué dans le texte brut, aucune fuite du nom après masquage, chaque fiche se nomme).
- **`personaeMode/personae.css` + `personae.html`** — en Expert, `#personaImage` reste dans le
  DOM avec `src=""` (l'image EST la réponse). Un `<img>` sans `src` affiche l'icône « image
  cassée » **et garde sa place**, ce qui décalait la fiche de lore : règle
  `body.expert-mode #personaImage { display: none }`, une seule règle qui couvre les trois
  sites d'affectation de `src` (tirage, révélation, reset). `?v=4` sur la feuille de style.

État des traductions Personae Expert : EN · FR · ES · DE · IT ✅ — reste PT.

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

## 2026-08-15 — feat(expert): fiches Personae en allemand

Deuxième des quatre langues. **137 fiches**, même calibre que les trois précédentes.

### Détails techniques

- `personaeMode/database/expert_lore/de.json`. Comme pour l'espagnol, **aucun code à changer** :
  poser le fichier suffit, le mode charge déjà `expert_lore/<lang>.json`.
- Masques propres à l'allemand, là encore jamais recopiés : le texte dit « Apollon » et non
  « Apollo », « Kerberos »/« Zerberus », « Kallisto », « Polydeukes », « Hekate », « Kalliope »,
  « Aschenputtel », « Urmensch », « Kain ». Une forme absente du tableau resterait lisible en
  clair pendant toute la partie.
- Cas notables : `Caesar` masque « Kaiser » **et** « Zar » — en allemand le mot est encore le
  titre impérial courant, donc le laisser visible désignerait la persona immédiatement.
  `Cendrillon` et `Ella` masquent tous deux « Aschenputtel », étant deux fiches du même
  personnage pour la même manieuse.

Les 6 garde-fous du test tournent désormais sur **quatre** langues.

### Reste

IT et PT.

## 2026-08-15 — feat(expert): fiches Personae en espagnol

Première des quatre langues restantes. **137 fiches**, 75 à 113 mots (moyenne 94) — même
calibre que l'anglais et le français.

### Détails techniques

- `personaeMode/database/expert_lore/es.json`. Aucun code à changer : le mode charge déjà
  `expert_lore/<lang>.json` selon `window.i18n.getCurrentLang()`, avec repli sur l'anglais.
  Ajouter le fichier suffit à rendre le mode jouable en espagnol.
- **Les tableaux `mask` sont propres à l'espagnol**, pas recopiés de l'anglais. Le texte y
  emploie très souvent une autre forme du nom — « Apolo » et non « Apollo », « Tánatos »,
  « Radamantis », « Cerbero », « Astarté », « Cenicienta », « Ío ». `maskTerms()` ne normalise
  pas les diacritiques : une forme accentuée absente du tableau resterait visible en clair
  pendant toute la partie.
- Cas particuliers de masquage traités : `Caesar` masque aussi « Káiser » et « Zar » (le texte
  raconte la survivance du mot), `Messiah` masque « Cristo », `Cendrillon` et `Ella` se masquent
  mutuellement puisque ce sont deux fiches du même personnage pour la même manieuse.
- Les 6 garde-fous du test tournent désormais sur **trois** langues : couverture identique,
  longueur jouable, aucun masque pré-appliqué, aucune fuite du nom après masquage, chaque
  fiche se nomme, roster complet.

### Reste

DE, IT et PT — même volume, même méthode. L'anglais reste la source de vérité.

## 2026-08-15 — feat(expert): Mode Personae Expert (front + back)

Cinquième mode Expert. Le contenu attendait depuis trois lots : 137 fiches EN + FR, roster
complet, règle des manieurs déjà implémentée et testée.

### Mécanique

Le mode normal montre le dessin de la persona. L'Expert ne le montre **jamais** : il affiche le
texte mythologique de la figure, nom masqué, et le joueur en déduit le manieur. L'illustration
n'apparaît qu'à la révélation finale — ici l'image n'est pas un indice, **elle est la réponse**.

### Détails techniques

- Pool serveur `personae_expert` — **139 entrées sur 153**, seules celles ayant une fiche.
  Sans texte il n'y a aucun indice : la partie serait injouable. Les 14 variantes cosmétiques
  en sont exclues d'office puisqu'elles n'ont volontairement pas de fiche.
- `api/lib/daily_target.php` : `personae_expert` partage le corps du cas normal (même logique
  de filtre opus) avec un pool et une clé de hash distincts. Le repli filtré utilise désormais
  `$hashKey` et non la chaîne codée en dur — il visait sinon la cible du mode normal.
- **Réponses acceptées = tous les manieurs de la figure**, via `expertWielders()` :
  Orphée vaut pour Makoto, Kotone et Aigis. Rien dans le texte ne permet de les départager,
  refuser l'un d'eux serait perçu comme un bug. C'est la première utilisation en jeu de la
  règle posée trois lots plus tôt.
- Les fiches sont chargées **à la demande** depuis `expert_lore/<lang>.json`, avec repli sur
  l'anglais. Délibérément pas dans `lang/*.json`, chargé sur toutes les pages du site : 137
  fiches × 6 langues y pèseraient pour rien.
- Masquage à l'affichage par `maskTerms()` ; la révélation réaffiche le texte brut, sans
  seconde copie à maintenir.
- Seuil d'abandon à 5, comme les autres modes Expert. 8 clés i18n × 6 langues.

### Fiabilisation de toute la suite E2E

`serviceWorkers: "block"` dans `playwright.config.js`. Après un bump de `CACHE_VERSION`, le
service worker s'active et **les pages se rechargent seules** (écouteur `SW_UPDATED`), en plein
milieu d'un test : les assertions tombaient sur une page en pleine navigation, et l'échec se
déplaçait d'un test à l'autre à chaque exécution. Ce n'est pas le SW qu'on teste ici ; son
comportement hors-ligne mériterait sa propre suite.

Deux autres pièges corrigés dans le spec Personae, tous deux découverts en le voyant échouer :

- **Les « mauvaises » réponses écrites en dur finissaient par être justes.** Une fiche accepte
  toute la famille de manieurs ; le test calcule maintenant l'ensemble accepté depuis le
  dataset et pioche en dehors.
- **Le premier clic partait parfois dans le vide** (listeners branchés en fin d'init) et était
  perdu en silence. Le clic est réessayé jusqu'à ce que le compteur bouge — même correctif que
  pour AOA.

6 tests E2E Personae.

## 2026-08-15 — feat(expert): Mode Émoji Expert + bouton Abandonner resté grisé

### Émoji Expert — un émoji ment

Le mode normal révèle les émojis un par un, tous authentiques. L'Expert garde exactement la
même révélation progressive, mais **un seul** des émojis affichés est un leurre emprunté à un
autre personnage, à une position quelconque. Le joueur ne sait ni lequel ment, ni s'il l'a
déjà vu — c'est ce doute qui fait la difficulté. Montrer les mêmes émojis sans mentir aurait
juste été le mode normal avec moins d'essais.

- `displayedEmojis()` produit la liste affichée. **Le leurre et sa position sont
  déterministes** : tirés avec le même hash seedé que la cible du jour (`getDailyTarget`),
  donc stables pour un joueur et une date. Un tirage aléatoire à chaque rendu se serait
  re-roulé à chaque rechargement, et le joueur aurait identifié l'intrus par simple
  élimination — le mode aurait perdu tout son sens. Un test E2E recharge la page et compare.
- Le leurre est puisé chez les **autres** personnages, en excluant ceux que la cible possède
  déjà : un « leurre » qu'elle a réellement ne mentirait pas. La liste candidate est triée
  pour que l'index du hash reste stable.
- La longueur de la séquence ne change pas — un émoji est **remplacé**, pas ajouté.
- Fin de partie : le chemin de révélation utilise `target.emoji`, donc les vrais émojis
  reviennent d'eux-mêmes. Vérifié par un test.
- `ALL_EMOJI_CHARS` hissé au niveau module (il était local à l'init) : `displayedEmojis()` en
  a besoin pour puiser le leurre.
- Serveur : cas `emoji_expert` réutilisant le pool `emoji` avec la clé de hash `EmojiExpert`,
  et `emoji` ajouté à la liste des modes acceptant `is_expert`.
- 7 clés i18n × 6 langues. Seuil d'abandon à 5, comme les autres modes Expert.

### Bouton Abandonner resté grisé — régression de mon propre correctif

Signalement de Hamza en Personae : passé le seuil, le bouton restait grisé avec le curseur
« interdit », **tout en fonctionnant au clic**.

Cause : le correctif d'accessibilité de la veille avait converti les endroits qui
**verrouillent** le bouton (`setGiveUpEnabled(false)`) mais pas ceux qui le **déverrouillent**.
Music, Personae et Silhouette faisaient encore `giveUpBtn.disabled = false` — sans effet sur un
`<div>`, et surtout sans lever l'`aria-disabled` sur lequel le nouveau CSS s'appuie. Le verrou
visuel restait donc en place alors que le handler, lui, acceptait le clic.

Neuf sites convertis, plus cinq écritures de curseur devenues redondantes (le helper s'en
charge). Vérifié sur **les 6 modes** en navigateur : `aria-disabled` passe bien de `true` à
`false` au franchissement du seuil.

Détail relevé au passage : en Émoji, une réponse inventée n'incrémente pas le compteur
(`checkEmojiGuess` sort avant), contrairement aux autres modes. Ma première sonde utilisait de
faux noms et concluait à tort que le bouton restait bloqué.

### Tests

6 E2E Émoji. 29 tests E2E au total revérifiés sans régression, 689 Vitest, 193 PHPUnit.
`CACHE_VERSION` → `personadle-v87`.

## 2026-08-15 — fix(expert): bouton Rejouer inopérant en Classique Expert

Trois défauts cumulés, tous sur le chemin du replay.

- **La citation disparaissait sans jamais revenir.** `resetButton` fait
  `quoteHint.style.display = "none"`, et l'affichage de la citation n'était appelé qu'une fois
  à l'init. Or la citation est **l'unique indice** du mode : le replay était littéralement
  injouable. `showExpertQuote()` est hissée dans le scope d'init (au lieu du bloc
  `if (EXPERT.isExpert)`) pour que Rejouer puisse la rappeler après le nouveau tirage.
- **Les vignettes d'erreur restaient à l'écran.** Depuis le passage à `showWrongMini()`,
  l'historique vit dans `#wrongGuessList` — que `output.innerHTML = ""` ne touche pas.
- **Le nouveau tirage ignorait la restriction du mode.** Il piochait dans `characters`, pas
  dans `EXPERT_CHARACTERS` : un replay pouvait tomber sur l'un des 4 personnages sans
  citation, laissant le joueur sans le moindre indice. Le tirage quotidien, lui, respectait
  déjà la restriction — seul le replay l'oubliait.

### Test

Un 8ᵉ test E2E couvre le replay de bout en bout : citation présente après Rejouer, historique
vidé, cible différente, et **cible ayant bien une citation**.

Détail relevé en l'écrivant : une réponse inventée (`Zzz Not A Character`) sort de
`checkGuess()` avant tout rendu (`if (!guess) return`) et ne produit donc aucune vignette. Le
test utilise de vrais personnages — c'est ce que fait un joueur, et c'est le seul chemin qui
exerce réellement l'historique.

`CACHE_VERSION` → `personadle-v86`.

## 2026-08-15 — fix(expert): Classique Expert cassé + historique d'erreurs aligné sur Émoji

### Le mode ne se chargeait plus du tout

Un refactor laissé à moitié fait avait introduit une **double déclaration de `const isWin`**
dans `checkGuess()`. C'est une erreur de syntaxe : le module entier échouait au parsing, donc
ni l'Expert ni le mode normal ne fonctionnaient sur cette page. `checkGuess()` a été
reconstruit avec une seule déclaration, la grille de comparaison remise derrière sa garde
`if (!EXPERT.isExpert)`.

### Une victoire en Expert ne terminait pas la partie

Bug de fond, antérieur au précédent et attrapé par un test E2E. Le chemin Expert faisait un
`return` **avant** le bloc `if (isWin)` : une bonne réponse n'affichait ni boîte de victoire,
ni confettis, et **n'enregistrait aucune session**. Le mode ne sautait la grille que par
accident de structure.

L'Expert saute désormais la **grille**, pas la fin de partie : les deux chemins convergent sur
le même `if (isWin)`.

### Historique d'erreurs — composant partagé au lieu d'un composant inventé

Retour de Hamza : « l'historique des erreurs de classique expert est inventé et moche ».
Exact — j'avais créé des fiches `.expert-guess` alors que le jeu a déjà une liste d'erreurs.

`renderExpertGuess()` appelle maintenant `showWrongMini()` (`js/gameCore.js`), exactement comme
le mode Émoji : une vignette de portrait qui tremble, dans un `#wrongGuessList`. Une bonne
réponse n'y figure pas — elle termine la partie, la boîte de victoire prend le relais. Le CSS
`.expert-guess` (80 lignes) est supprimé.

### Cache — les `?v=` n'avaient jamais été bumpés

Hamza a dû faire Ctrl+Shift+R pour voir le texte corrigé. Les pages écoutent pourtant toutes
`SW_UPDATED` et se rechargent seules ; le maillon manquant était le **cache HTTP** : les
`?v=` de `global.css`, `classique.css`, `modeClassique.js`, `music.css` et les autres fichiers
modifiés cette session n'avaient pas bougé. Tous incrémentés sur les 14 pages concernées.

`CACHE_VERSION` → `personadle-v85`.

### Tests

7 E2E Classique, dont deux réécrits : l'absence de grille affirme désormais aussi que la boîte
de victoire s'affiche (c'est ce test qui a révélé le bug de victoire), et l'historique vérifie
les `.wrong-mini` partagées plutôt qu'un composant maison. 689 Vitest et les 8 game-flow
revérifiés — le mode normal n'a pas bougé.

## 2026-08-15 — feat(stats): toutes les parties comptent, la streak seule reste journalière

Signalement joueur : « j'ai gagné 50 fois en Music dans la soirée, rien n'a été sauvegardé ».
Ce n'était pas un bug mais le design — `uq_session_per_day` n'autorisait qu'une session par
joueur, mode et jour. Décision de Hamza : le design change.

### Migration 032

- **`uq_session_per_day` supprimée.** Chaque partie terminée est désormais enregistrée et
  comptée dans les stats.
- **`client_session_id` CHAR(36) UNIQUE** — clé d'idempotence générée par le client. La
  contrainte d'unicité servait aussi, accidentellement, de garde-fou anti-doublon :
  `savePendingSession()` met les sessions en file dans localStorage quand le réseau tombe,
  puis les rejoue. Sans elle, un timeout sur une requête que le serveur avait pourtant traitée
  aurait inséré la partie deux fois. L'UUID rend le rejeu inoffensif **sans** plafonner le
  nombre de parties par jour.
- L'index `(user_id, mode, played_date, is_expert)` est conservé, simplement non unique — il
  reste l'axe de lecture de la streak, des stats du jour et de l'anti-triche.
- Rejouée sur base vierge pré-migration : 3 parties le même jour acceptées, rejeu du même
  `client_session_id` rejeté en 1062.

### Streak — recalculée, plus jamais incrémentale

`personadle_compute_streak()` partait de `last_played_at` et supposait **une partie par jour**.
Avec plusieurs parties quotidiennes elle repartait à 1 au deuxième replay, et tombait à 0 au
premier abandon d'une journée pourtant gagnée.

`personadle_recompute_mode_streak()` devient la seule source de vérité : `GROUP BY played_date`
avec `MAX(result = 'win')` — **un jour compte comme gagné dès qu'une seule de ses parties
l'est**. Recalculer depuis un historique borné (400 jours) est correct dans tous les cas et
n'a aucun état à corrompre.

### Suppression de l'upgrade giveup→win

Ces 87 lignes n'existaient que pour contourner la contrainte d'unicité : une victoire après un
abandon le même jour devait muter la ligne existante. Elle est maintenant simplement une ligne
de plus, et la streak la voit via le `MAX` par jour. Code mort supprimé.

### Tests

8 tests PHPUnit affirmaient l'ancienne règle — remplacés par 5 qui affirment la nouvelle :
plusieurs parties comptées le même jour, rejeu du même `client_session_id` rejeté, streak
insensible au volume, un abandon qui ne casse pas une journée déjà gagnée, et une victoire
tardive qui répare une journée entamée par un abandon.

### Décidé, pas encore codé

Le classement va se mettre à récompenser le volume. Décision de Hamza : trois classements
distincts plutôt qu'un score unique — meilleure série, meilleur ratio (lissé pour qu'un joueur
à 1 partie / 1 victoire ne soit pas premier), meilleur score général et par mode. Détail et
méthodes de lissage notés dans `ROADMAP.md`.

### Reste à câbler

Le client n'envoie `client_session_id` que depuis `buildGameSession()` ; les 6 modes gardent
encore leur garde `!localStorage.getItem(todayKey)` qui empêche de loguer plus d'une partie
par jour. **Tant que cette garde est là, la migration ne change rien pour le joueur** — c'est
la prochaine étape.

## 2026-08-15 — fix(a11y): bouton Abandonner verrouillé sans aucun signal

Dette repérée en écrivant les tests E2E de Classique Expert, corrigée sur les 6 modes.

### Le problème

`#giveUpButton` est un `<div class="link-wrapper">` dans les six modes. `enableGiveUpButton()`
y écrivait `.disabled`, **qui n'existe que sur les contrôles de formulaire** : sur un div,
l'attribut ne bloque rien, ne se voit pas, et n'est pas exposé aux lecteurs d'écran. Le verrou
réel a toujours été dans le handler de chaque mode (`if (attempts < GIVE_UP_THRESHOLD) return`),
donc le comportement était correct — mais rien ne distinguait à l'écran un bouton cliquable
d'un bouton qui ignore le clic, et le test unitaire, écrit avec un `<button>`, ne prouvait rien
sur la production.

### Correctifs

- `setGiveUpEnabled(enabled, id?)` pose `aria-disabled` et le curseur, en plus de `.disabled`
  (inoffensif, utile si le bouton devient un jour un vrai `<button>`). `enableGiveUpButton()`
  reste, en délégant.
- `.link-wrapper[aria-disabled="true"]` (`css/global.css`) : opacité réduite, curseur
  `not-allowed`, et neutralisation des effets de survol — jusqu'ici le bouton verrouillé
  s'animait exactement comme un bouton actif.
- Les 6 pages marquent le bouton `aria-disabled="true"` au départ, et les 6 modes appellent
  `setGiveUpEnabled()` au lieu d'écrire `.disabled` en direct (14 sites).
- `updateGiveUpCounter()` (AOA) écrivait encore `btn.disabled = attempts < GIVE_UP_THRESHOLD`
  — le remplacement automatique ne l'avait pas attrapé, la forme étant différente.
- Le test unitaire utilise désormais **le vrai balisage** (`<div class="link-wrapper">`) et
  couvre les deux sens du verrou. C'était le cœur du problème : l'ancien test passait tout en
  ne testant rien de ce qui tourne réellement.

### Fiabilisation des tests E2E AOA

Deux causes d'intermittence, sans rapport avec la dette mais découvertes en la corrigeant :

- `waitForLoadState("networkidle")` ne se déclenche pas de façon fiable sur AOA, qui charge
  ses GIFs depuis un CDN externe. Remplacé par l'attente d'un signal concret de la page.
- Les listeners AOA sont branchés **à la toute fin** du `DOMContentLoaded`, après le
  préchargement des images — donc bien après le rendu du compteur. Un premier clic pouvait
  partir dans le vide et était perdu en silence, faisant échouer le test plus loin sur une
  cause sans rapport. `guessWrong()` réessaie désormais jusqu'à ce que le compteur bouge.

`CACHE_VERSION` → `personadle-v84`.

## 2026-08-15 — feat(expert): fiches Personae P5X et Trinity Souls — roster complet

Dernier paquet de contenu Expert Personae. **137 fiches**, EN et FR : le roster est couvert
en entier.

### Détails techniques

- 32 fiches Persona 5 X + 3 Trinity Souls (Abel, Seth, Cain). 76 à 108 mots, moyenne 93.
- Les seules entrées sans fiche sont les **14 variantes cosmétiques** (`* Picaro`,
  `Orpheus Telos`, `Athena Picaros`, `Orpheus ( Female )`) — `expertWielders()` les rattache
  déjà à leur entrée de base, leur écrire une fiche identique rendrait la réponse ambiguë.
- Le roster P5X est massivement composé de nymphes, muses et néréides aux sources d'une à
  trois phrases (`Syke`, `Prosymna`, `Ampelos`, `Euterpe`, `Asterope`, `Erytheia`…). Elles ont
  été complétées avec le contexte mythologique qui les rend devinables — une fiche de 20 mots
  sur une nymphe mineure ne donne aucune prise au joueur.
- Sources longues taillées : `Mandrin` passait de 400 mots, `Rob Roy` de 300, `Ghino` de 350.
- Les hors-la-loi historiques de P5X (Jánošík, Rob Roy, Mandrin, Ghino, Awilda, Chiyome,
  Gentileschi) sont des personnes réelles ou semi-historiques, pas des figures mythologiques —
  le ton reste factuel, sans romancer ce que les sources ne disent pas.

### Nouveau garde-fou

`tests/expertContent.test.js` vérifie désormais que **tout le roster est couvert**, variantes
cosmétiques exclues. Ajouter une persona au dataset sans écrire sa fiche la rendrait injouable
en Expert — aucun texte à afficher — et le test échoue avant que ça arrive.

### Reste sur Personae

Les 4 langues manquantes (ES/DE/IT/PT) sur les 137 fiches, et le mode Personae Expert
lui-même, qui n'est pas encore codé.

## 2026-08-15 — feat(expert): Mode All-Out Attack Expert + artefacts Classique

### AOA Expert — flou figé et noir et blanc

Le mode normal fait baisser le flou de 3px par erreur : l'image finit par se lire. L'Expert le
fige au maximum (20px) **et** retire la couleur — c'est le noir et blanc qui rend le flou
maximal réellement difficile, la couleur des cheveux, de la tenue et la palette de l'opus
portant une grande part de l'identification.

- `gifFilter(revealed)` centralise la construction du filtre CSS. **Cinq endroits** le
  fabriquaient à la main (`handleGuess`, la victoire, l'abandon, le chargement d'image, la
  restauration de session) ; en ajouter un sixième pour l'Expert aurait garanti qu'un des cinq
  soit oublié et laisse passer une image nette.
- Pas de bouton de défi en Expert, même raison que Music : le destinataire le jouerait en mode
  normal, score incomparable.
- **Risque assumé** : 10 familles de skins recolorés (Wonder ×4, Closer ×3, Panther/Mona/Joker
  Starlight…) partagent silhouette et pose. En noir et blanc au flou maximal, elles seront
  vraisemblablement indistinguables. Signalé à Hamza, qui a tranché : on garde. À revoir si les
  joueurs le remontent.

### Artefacts du mode normal en Classique Expert

- **`.autocomplete-items:empty { display: none }`** (`css/global.css`) — la liste
  d'autocomplétion a un fond blanc et une bordure noire : vide, elle dessinait quand même sa
  boîte. Le correctif est à la racine et vaut pour **les 6 modes**, pas seulement l'Expert :
  l'artefact était visible partout tant qu'on n'avait rien tapé.
- `#hintCounter` masqué en Expert : il compte les indices utilisés, or le bouton Indice est
  masqué — il restait figé sur « (0 / 3) » pour toujours.

### Correction i18n

Les clés Expert AOA avaient d'abord été écrites dans un namespace `modes.aoa` inexistant. Le
namespace réel est `modes.alloutattack` ; fusionné, et le HTML réutilise `gameplay` (déjà
traduit) au lieu d'un `tips` qui n'existe pas dans ce mode.

### Tests

6 tests E2E AOA. Le principal vérifie que **le flou ne baisse jamais** après quatre erreurs, et
un test miroir confirme qu'en mode normal il tombe bien à 14px — sans ce second test, une
régression rendant l'Expert identique au normal passerait inaperçue. 7 tests Classique mis à
jour (artefacts masqués). `CACHE_VERSION` → `personadle-v83`.

### Reste

Silhouette Expert : dézoom figé, point de zoom tiré sur un contour.

## 2026-08-15 — fix(expert): refonte de l'affichage Classique Expert

Retour de Hamza après essai : le mode « ne marche pas du tout ». Le diagnostic était juste,
et la faute est une demi-mesure de ma part.

### Ce qui n'allait pas

J'avais gardé la **grille du mode normal** en la réduisant à deux colonnes : un en-tête de
catégories au-dessus d'une unique colonne « Nom ». Un tableau sert à aligner des valeurs
comparables ; en Expert il n'y a rien à comparer, donc rien à aligner. Le résultat gardait
tout le squelette visuel d'un mode de déduction sans en avoir la substance.

### Refonte

- `renderExpertGuess()` remplace entièrement le chemin de rendu en Expert : `checkGuess()`
  délègue et sort avant même de construire l'en-tête. Plus aucune `.category-row` ni
  `.guess-cell` en Expert — vérifié par le test, pas seulement caché en CSS.
- Une tentative = une **fiche autonome** : portrait rond, nom, verdict. Bordure gauche verte
  ou rouge, plus un symbole ✔/✖ — deux états seulement, autant les rendre lisibles sans
  distinguer les couleurs.
- **La plus récente en haut** (`insertBefore`) : le joueur relit une liste d'essais, il n'a
  pas à scroller pour retrouver son dernier coup.
- La citation reste le centre de l'écran, encadrée, en italique, le nom de la cible masqué
  jusqu'à la fin de partie.
- Le bouton Expert avait 10px sous lui et touchait le bandeau de consigne du mode : marge
  portée à 22px dans `css/global.css` (partagée par les 4 modes, vérifiée sur Classique et
  Music).

### Tests

7 tests E2E (un de plus) : l'absence totale de grille est désormais affirmée par
`.category-row` = 0 **et** `.guess-cell` = 0, et un nouveau test vérifie l'empilement
antichronologique des tentatives. Les 9 tests de Music Expert restent verts.

`CACHE_VERSION` → `personadle-v82`.

### Point ouvert

Hamza a demandé « give up au bout de N essais » sans préciser N — le message était tronqué.
Reste à 5 en attendant, aligné sur Music Expert.

## 2026-08-15 — feat(expert): Mode Classique Expert jouable

Deuxième mode Expert livré, premier à utiliser la plomberie partagée du lot précédent.
Une citation, et rien d'autre.

### Mécanique

Le mode normal compare sept attributs (nom, genre, âge, manieur, persona, arcane, opus) avec
un code couleur. L'Expert n'en montre **aucun** : la citation du personnage est affichée dès
le premier essai, et une réponse est juste ou fausse — rien entre les deux.

### Détails techniques

- `EXPERT = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" })`,
  puis `EXPERT.key("target")`, `EXPERT.key("attempts")`, `EXPERT.key("guessHistory")`. En mode
  normal ces clés restent `target` / `attempts` / `guessHistory` — les parties en cours des
  joueurs ne sont pas perdues par le câblage.
- **Les colonnes de comparaison ne sont pas cachées : elles ne sont pas construites.**
  `keysToCompare` tombe à `["nom"]` et l'en-tête n'a que deux cellules. Les masquer en CSS les
  aurait laissées lisibles dans l'inspecteur, ce qui viderait le mode de son intérêt. Un test
  E2E compte les `.guess-cell` pour verrouiller ça.
- **Le pool exclut les personnages sans citation** — 180 sur 184. Tirer quelqu'un sans réplique
  donnerait une partie sans le moindre indice. `EXPERT_CHARACTERS` doit rester aligné sur le
  pool `classic_expert` du serveur, ordre compris.
- Le nom de la cible est masqué **à l'affichage** dans sa propre citation (certaines se nomment
  elles-mêmes), et réapparaît en fin de partie via l'événement `personadle:classic-reveal` —
  `fillVictoryBox()` est déclarée hors du scope où vit la cible, un événement évite de faire
  remonter cet état d'un cran.
- Bouton Indice masqué en Expert : il n'aurait plus rien à révéler.
- Seuil d'abandon à 5 (contre 8 en normal), aligné sur Music Expert. Sans indice progressif,
  8 essais avant de pouvoir renoncer n'apportent que de la frustration.
- Ni `updateProfileStats()`, ni `checkUnlocksAfterGame()`, ni `showCommunityStats()` en Expert
  — même raison que pour Music : le serveur exclut déjà l'Expert de `user_stats`, les appeler
  ferait diverger le profil local au prochain `pullProfileFromCloud()`.
- 7 clés i18n × 6 langues. CSS Expert dans `classique.css` (grille à deux colonnes, citation
  promue en indice principal) ; le bouton et le halo restent dans `global.css`.

### Ce que l'E2E a fait remonter

`#giveUpButton` est un `<div class="link-wrapper">`, pas un `<button>` : `enableGiveUpButton()`
y pose `.disabled`, **ce qui n'a aucun effet sur un div**. Le verrou réel est dans le handler
(`if (attempts < GIVE_UP_THRESHOLD) return`), donc le comportement est correct — mais un test
écrit avec `toBeDisabled()` passerait à côté. Le test vérifie désormais le comportement :
cliquer avant 5 essais ne doit rien produire.

6 tests E2E, plus les 17 existants (Music Expert + game-flow) revérifiés sans régression.
`CACHE_VERSION` → `personadle-v81`.

### Reste

AOA Expert (flou figé + noir et blanc) et Silhouette Expert (dézoom figé sur un point de
contour). La plomberie et les pools serveur les attendent déjà.

## 2026-08-15 — feat(expert): plomberie partagée + pools serveur pour Classique, AOA et Silhouette

Préparation des trois modes Expert restants. Aucun front dans ce lot : la couche partagée et
la couche serveur d'abord, pour ne pas réécrire trois fois la même chose.

### Plomberie partagée (`js/gameCore.js`)

Music Expert avait câblé son cloisonnement à la main (préfixe localStorage, clé de stats, clé
de hash, bouton de bascule). Recopier ça dans trois modes de plus garantissait une divergence.

- `isExpertPage()` — lit `?expert=1`. L'état vit dans l'URL et non en localStorage : le mode
  reste partageable et bookmarkable, et une même URL ne peut pas afficher deux jeux différents
  selon un état caché.
- `expertContext({ prefix, statsKey, hashMode })` — renvoie `isExpert`, les clés de stats et de
  hash suffixées, et surtout `key(name)` qui traduit une clé localStorage du mode normal vers
  sa variante Expert. **En mode normal la clé historique est rendue telle quelle** : aucune
  partie en cours ne doit être perdue par ce câblage.
- `setupExpertToggle(ctx, page)` — bascule `body.expert-mode`, affiche le bon bloc de règles
  (`#rulesNormal` / `#rulesExpert`) et câble le lien `#expertToggle`.
- Les styles du bouton et du halo de page quittent `musicsMode/music.css` pour `css/global.css`
  — ils sont identiques pour les quatre modes. L'indice propre à chaque mode (paroles, flou,
  dézoom) reste dans son CSS.

### Couche serveur

- `classic_expert` — pool propre : **180 personnages sur 184**, seuls ceux ayant une citation,
  puisque la citation est le seul indice du mode.
- `silhouette_expert` et `alloutattack_expert` — **pas de pool dupliqué**. Le roster est
  identique au mode normal, seul l'indice change ; `api/lib/daily_target.php` réutilise donc
  `silhouette` et `alloutattack` avec une clé de hash suffixée, plutôt que de recopier 157 et
  71 entrées dans le JSON et de les laisser dériver.
- `api/sessions.php` : `is_expert` accepté sur `music`, `classic`, `silhouette`, `alloutattack`.
  Tout autre mode est refusé — une ligne que le recalcul anti-triche ne saurait pas rejouer ne
  doit pas exister.

### Test qui compte

`expertContext` est vérifié contre **les chaînes de hash codées en dur dans
`api/lib/daily_target.php`** (`ClassicExpert`, `SilhouetteExpert`, `AllOutAttackExpert`,
`MusicExpert`). Une divergence ferait viser deux cibles différentes au client et au serveur, et
chaque partie Expert partirait en `anti_cheat` sans que rien ne se voie côté joueur. Les 9
tests E2E de Music Expert restent verts après le déplacement du CSS.

### Reste à faire

Le front des trois modes : indice Expert (citation seule / flou figé + noir et blanc / dézoom
figé sur un point de contour), bouton, règles, i18n, tests. La plomberie les attend.

## 2026-08-15 — feat(expert): fiches Personae Persona 5 (EN + FR)

Troisième paquet : les personas de Persona 5 / Royal / Strikers / Tactica, en anglais et en
français. Total 102 fiches (P2 + P3 + P4 + P5).

### Détails techniques

- 35 fiches écrites. Le roster P5 en compte 36, mais `Prometheus` était **déjà couvert** par
  la fiche P2EP : la même figure mythologique, deux entrées du dataset (Baofu et Futaba
  Sakura), une seule fiche qui accepte les deux manieurs — c'est exactement ce que fait
  `expertWielders()`, et la première fois que la règle sert en production de contenu.
- `Freya` du `.md` source correspond à l'entrée `Vanadis` du dataset (Vanadís est un surnom de
  Freyja dans l'Edda en prose). La fiche est keyée sur le nom du dataset.
- **Références croisées masquées systématiquement quand le manieur est le même.** En P5 chaque
  personnage a deux ou trois personas, souvent des variantes du même récit : la fiche
  `Célestine` parle presque entièrement de Carmen, `Diego` de Zorro, `Gorokichi` de Goemon,
  `Agnes` de Johanna, `Al Azif` du Necronomicon, `Lucy` de Milady, `Hereward` de Robin Hood,
  `Ella` de Cendrillon, `Raoul` d'Arsène. Sans masquage, chacune de ces fiches donnait le
  manieur en une ligne. Les autres noms de personas restent en clair — indices légitimes.
- Sources longues taillées : `Astarte` passait de 700 mots, `Anat` de 550, `Seiten Taisei` de
  600. Sources d'une phrase complétées : `Hereward`, `Zorro`, `Ella`, `Arsène`.
- Quatre fiches ne se nommaient pas et ont été reprises (`Captain Kidd`, `Seiten Taisei`,
  `Goemon`, `Azathoth`) — le test « chaque fiche se nomme » les a toutes attrapées, l'une
  après l'autre.

Reste : P5X, puis Trinity Souls, toujours EN + FR. Les 4 langues restantes une fois le contenu
source validé.

## 2026-08-15 — feat(expert): fiches Personae Persona 4 (EN + FR)

Deuxième paquet de contenu Expert Personae : les 28 personas de Persona 4 / Golden / Arena
Ultimax, en anglais et en français. Total 67 fiches (P2 + P3 + P4).

### Détails techniques

- 28 fiches, 76 à 108 mots (moyenne 94) — même calibre que les paquets précédents.
- Les 7 variantes cosmétiques P4 (`Izanagi Picaro`, `Magatsu-Izanagi Picaro`, `Kaguya Picaro`,
  `Tsukuyomi Picaro`, `Ariadne Picaro`, `Asterios Picaro`, `Izanagi-no-Okami Picaro`) n'ont
  volontairement pas de fiche : `expertWielders()` les rattache déjà à l'entrée de base.
- Sources courtes complétées : `Izanagi-no-Okami`, `Jiraiya`, `Takehaya Susano-o`,
  `Sumeo-Okami`, `Yamato Sumeragi`, `Kamui-Moshiri`, `Kouzeon`, `Magatsu-Izanagi` faisaient
  1 à 3 phrases dans le `.md` source. Sources trop longues taillées : `Amaterasu` passait de
  380 mots, `Dairoku Tenmaou` de 300.
- **Épithètes ajoutées aux `mask`** : « Demon King of the Sixth Heaven » / « Roi-Démon du
  Sixième Ciel » identifient la persona aussi sûrement que son nom. Sans elles, la fiche
  `Dairoku Tenmaou` affichait l'identité en clair pendant toute la partie — le test « chaque
  fiche se nomme » l'a attrapé, ce qui est précisément son rôle.
- **Références croisées masquées quand le manieur est le même** : la fiche `Sumeo-Okami`
  masque `Amaterasu`, `Kouzeon` masque `Kanzeon`, `Takeji Zaiten` masque `Dairoku Tenmaou`.
  Ce sont des épithètes de la même persona pour le même personnage : les laisser visibles
  donnerait la réponse. Les autres noms de personas restent en clair — ce sont des indices
  légitimes.

Prochains paquets : P5, puis P5X, puis Trinity Souls, toujours EN + FR. Les 4 langues
restantes (ES/DE/IT/PT) seront faites en un lot une fois le contenu source validé.

## 2026-08-15 — fix(challenge): défis bloqués « en cours », 404 et bannière absente

Trois symptômes signalés par des joueurs — acceptation qui ne redirige pas, redirection vers
une 404, et redirection sans bannière de défi (gagner ou perdre ne changeait rien) — plus une
accumulation de défis bloqués en statut « accepted » qu'on ne pouvait ni jouer ni annuler.

### Root cause commune

**L'état était modifié avant qu'on sache si l'action pouvait aboutir.** Dans les deux points
d'acceptation (`js/challenge-notif.js` et `profile/friends/friends.js`), l'ordre était :

1. `updateStatus(id, "accepted")` — avec `.catch(() => {})`, donc un échec serveur passait inaperçu
2. purge de l'état du mode + application des filtres de l'expéditeur
3. écriture de `activeChallenge` en localStorage
4. **et seulement là** : recherche de la page cible, `MODE_PAGE[modeKey] ?? ""`

Si l'étape 4 ne trouvait rien, la fonction se contentait de fermer la popup. Le défi était
pourtant déjà « accepted » côté serveur et `activeChallenge` déjà écrit côté client : bloqué,
injouable, non annulable. Et si l'étape 1 échouait silencieusement, client et serveur
divergeaient dans l'autre sens — le joueur jouait un défi que le serveur croyait en attente.

### Pourquoi l'étape 4 échouait

`challenge-notif.js` dérivait la clé de mode avec un `.toLowerCase()` nu au lieu de
`normalizeModeKey()` (CLAUDE.md §8 : « le vocabulaire des modes passe **toujours** par
normalizeModeKey() »). Une graphie comme « All Out Attack » devenait « all out attack », clé
absente de `MODE_PAGE`, `MODE_STATE_KEYS` **et** `FILTER_STORAGE_KEYS` — les trois échouaient
en silence d'un coup, ce qui explique qu'on ait observé selon les cas une absence de
redirection, une absence de nettoyage d'état, ou une absence de bannière.

### Correctifs

- `normalizeModeKey()` utilisé dans les deux chemins d'acceptation, et la clé normalisée est
  celle stockée dans `activeChallenge.mode` — `getActiveChallengeTarget()` la compare déjà via
  `normalizeModeKey()`, les deux côtés parlent enfin la même langue.
- **Ordre inversé** : la page cible est résolue et validée **avant** toute écriture. Mode
  inconnu → message au joueur, aucun état touché, le défi reste acceptable plus tard.
- `updateStatus()` n'est plus avalé : un échec serveur interrompt l'acceptation au lieu de
  laisser le client croire que c'est parti.
- Absence de `window._personadleApi` traitée explicitement — sans API, le serveur ne saura
  jamais que le défi a été accepté.
- `friends.js` : la table des pages devient `MODE_PAGE_MAP` en constante de module, documentée
  (2 niveaux de remontée depuis `profile/friends/`, pas 1).
- 3 clés i18n × 6 langues (`challenge.unknown_mode`, `.offline`, `.accept_failed`).

`CACHE_VERSION` → `personadle-v80`.

### Angle mort connu

Les défis **déjà** bloqués en base ne sont pas réparés par ce correctif : il empêche d'en
créer de nouveaux. Un nettoyage (remise en `unread` des `accepted` sans partie associée) ou
un bouton « abandonner le défi en cours » reste à faire.

## 2026-08-15 — fix: déconnexion en boucle sur la page Amis + chargement infini en AOA

Deux bugs remontés par des joueurs, tous deux « réparés » par un Ctrl+Shift+R — signature
d'un état en mémoire ou en cache, pas d'une donnée corrompue.

### Bug 1 — « Connectez-vous » en boucle alors que la session est valide

**Root cause** : `apiCall()` (`js/api.js`) lève une `ApiError` sur **toute** réponse non-ok,
et `sw.js` transforme n'importe quelle panne réseau sur `/api/*` en **503 JSON synthétique**.
`initAuth()` attrapait les deux dans le même `catch` et concluait « anonyme ». Un simple blip
réseau ou un cold start PHP sur `GET /api/auth/me` suffisait donc à afficher « Connectez-vous »
à un joueur dont le cookie de session était parfaitement valide — et la course se rejouait à
chaque visite, d'où la boucle.

**Deuxième conséquence, plus sournoise** : `updateAuthUI(null)` fait
`localStorage.removeItem("playerUserId")`. Le seed de `getDailyTarget()` était donc effacé au
passage, et `getPlayerSeedId()` retombait sur `anonPlayerId` : **la cible du jour du joueur
changeait toute seule** après un blip réseau. Personne ne l'avait relié à ce bug.

- `isTransportError(err)` — 401/403 = réponse autoritaire ; 5xx, status absent ou `TypeError`
  de fetch = transport, on ne sait rien.
- `_fetchMeWithRetry()` — 3 tentatives espacées de 300 puis 900 ms, **uniquement** sur erreur
  de transport. Un 401 n'est jamais réessayé, c'est une réponse.
- `updateAuthUI(user, authoritative = true)` — ne purge `playerUserId` que sur une réponse
  autoritaire. Injoignable → UI anonyme faute de mieux, mais le seed est préservé.
- `window._authUnavailable` expose l'état ; `friends.js` bascule alors la carte « non
  connecté » en « serveur injoignable » avec un bouton **Réessayer** (rechargement) au lieu
  d'un lien vers la connexion — envoyer se reconnecter quelqu'un de déjà connecté ne réglait
  rien, c'est précisément ce qui bouclait.
- `initAuth()` n'a plus de `try/finally` : `_fetchMeWithRetry()` ne lève jamais, elle renvoie
  toujours un état.

### Bug 2 — chargement infini en All-Out Attack

**Root cause** : `smartPreload()` (`allOutAttackMode/modeAllOutAttack.js`) posait
`isPreloading = true` puis le remettait à `false` **en fin de fonction seulement**. Toute
exception laissait le drapeau bloqué, et chaque appel suivant sortait immédiatement — le mode
restait sur le placeholder jusqu'à un rechargement complet, qui réinitialise le module.

Pire : `await p` sur une image prioritaire n'avait **aucun timeout**, alors que `loadGif()`
juste en dessous en avait déjà un de 5 s. Une requête restée en suspens ne déclenche ni
`onload` ni `onerror` : la boucle attendait indéfiniment.

- `try/finally` autour de la boucle → le drapeau retombe quoi qu'il arrive.
- `Promise.race([p, _timeout(PRELOAD_TIMEOUT_MS)])` — 5 s, aligné sur `loadGif()`.
- `_timeout(ms)` remplace les `new Promise(r => setTimeout(r, ms))` dispersés.

### Tests

`tests/authTransport.test.js` — 8 tests : classification 401/403/500/503/TypeError, et les
trois cas de préservation du seed (connecté / anonyme autoritaire / injoignable).

`CACHE_VERSION` passé à `personadle-v79` pour que les clients récupèrent le nouveau JS sans
Ctrl+Shift+R — ce qui est précisément le problème qu'on corrige.

### Angle mort connu

Le scénario réel (503 du service worker sur un vrai réseau instable) n'est pas rejoué de bout
en bout : les tests couvrent la logique de décision, pas l'intégration SW + fetch. Reproduire
un blip réseau déterministe en E2E demanderait d'instrumenter le service worker.

## 2026-08-15 — feat(expert): règle des réponses acceptées en Personae Expert

Décision produit de Hamza, encodée plutôt que laissée en note de roadmap — c'est le genre de
règle qui dérive silencieusement si elle n'est écrite que en prose.

### La règle

En mode Personae, le joueur devine **le manieur**, pas le nom de la persona
(`personaeMode/database/persona.js`, la liste d'autocomplétion, contient des noms de
personnages). Or une fiche de lore décrit une figure mythologique, pas une entrée précise du
dataset, et la même figure est portée par plusieurs entrées :

- variantes cosmétiques d'un même personnage (`Orpheus Picaro`, `Thanatos Picaro`…), qui
  n'ont volontairement pas de fiche à elles ;
- homonymes réellement distincts — `Hermes` de Junpei Iori (P3) et celui de Jun Kurosu
  (P2IS) sont deux entrées séparées, deux dessins, mais un seul dieu grec (CLAUDE.md §4).

Une fiche accepte donc **tous les manieurs de toutes ces entrées**. Refuser l'un d'eux serait
perçu comme un bug : rien dans le texte affiché ne permet de les départager.

### Détails techniques

- `personaeMode/database/expert_lore/wielders.js` — `expertWielders(loreKey, personae)` et
  `expertLoreEntries()`. La famille est résolue par nom de base (`« Orpheus ( Male ) » →
  « Orpheus »`) plus les variantes suffixées. Le test de préfixe **exige un espace**
  (`base + " "`) pour ne jamais ramasser une persona simplement homographe au début.
- Vérifié sur les 39 fiches : 6 ont plusieurs manieurs ou variantes, **aucun faux positif**
  (`Hermes` ne ramasse pas `Trismegistus`). Résultats : Orphée → Makoto/Aigis/Kotone (5
  entrées), Hermès → Junpei/Jun, Prométhée → Futaba/Baofu, Thanatos → Makoto/Kotone/Elizabeth,
  Messiah → Makoto/Kotone, Athéna → Aigis.
- 4 tests dans `tests/expertContent.test.js`, dont un garde-fou « chaque fiche a au moins un
  manieur acceptable » : une fiche non résoluble serait injouable.

Le mode Personae Expert lui-même n'est pas encore écrit — cette règle est prête et verrouillée
pour quand il le sera.

## 2026-08-15 — feat(music): lecteur agrandi

Demande de Hamza : le lecteur audio était trop petit.

### Détails techniques

- `.audio-wrapper` passe de `width: fit-content` + `max-width: 480px` à
  `width: min(560px, 92vw)`. Largeur fixée plutôt que dépendante du contenu : le lecteur
  ne rétrécit plus selon la longueur du titre affiché, et il utilise **la même expression
  que le panneau de paroles Expert** — basculer d'un mode à l'autre ne fait donc plus
  sauter la mise en page.
- Le plafond tablette de 400px (`@media max-width: 768px`) datait du lecteur étroit et
  laissait la moitié de la largeur inutilisée : remplacé par `min(520px, 92vw)`.
- Éléments internes proportionnés pour que le lecteur élargi ne paraisse pas vide : bouton
  play 48 → 56px, barre de progression 6 → 8px, barres sonores 22 → 26px. La piste de
  volume reste volontairement plus fine (5px) — c'est un contrôle secondaire, pas la
  timeline.
- Mobile (< 480px) inchangé : l'override `width: 94%` s'applique toujours. Mesuré à 343px
  de large dans une fenêtre de 375, sans débordement.

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
