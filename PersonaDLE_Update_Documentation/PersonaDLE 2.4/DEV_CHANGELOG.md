# Changelog technique — PersonaDLE v2.4

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE 2.4/PersonaDLE_Update.html` reste le changelog **joueur** —
> highlights uniquement, langage non technique. Toute modification notable est ajoutée
> ici, et seulement reportée dans le HTML joueur si elle est visible par un joueur.
>
> Les entrées de la v2.3 (livrée, 2.3.4 le 2026-11-09) restent dans `PersonaDLE 2.3/`.

---

## Périmètre de la version

La 2.4 est la mise à jour **« mobile, partage, Discord »**, ouverte le 2026-11-11. Son
périmètre vient de l'audit du 2026-11-09 (signalement joueur, mesures du Discord, captures
mobile de la prod), validé point par point par Hamza.

Découpage en lots — une branche, une PR vers `develop` par ligne :

| Lot | Branche | Contenu |
|---|---|---|
| 0 | `chore/ouvrir_2_4` | Ouverture de la version (ce document) |
| 1 | `feat/pwa_polices` (#233) | Application installable, polices auto-hébergées |
| 2 | `feat/serie_gelee_assets_agents` (#230) | Série gelée et Jack Frost au profil, `?v=` et `CACHE_VERSION` par empreinte |
| 3 | `feat/nav_mobile` (#231) | Navigation mobile : jouer sans défiler, bouton Jouer, accueil et profil compacts |
| 4 | `feat/partage_resultat` (#232) | « Partager mon résultat », façon Wordle, dans les six modes |
| 5 | `feat/remontee_erreurs_js` (#234) | Les erreurs JS des joueurs remontent dans l'admin et sur Discord |
| 6 | Dependabot (#240, #242) | Dépendances de dev (jsdom 31) |
| 7 | `fix/profil_debordement_mobile` | Le profil déborde de 12–14 px à 390/480 px (alerte `prod_smoke` chaque nuit depuis le 2026-10-12) |
| 8 | `feat/discord_fin_de_partie` | Discord au bon moment : journée 6/6 (menu Jouer), profil, modale recentrée — **fait** ; la carte de fin de partie et le compteur de membres ont été **retirés** à la demande de Hamza |
| 9 | `feat/codes_evenement_discord` | Codes événement exclusifs au Discord (badge ou titre) — **fait**, migration 057 |
| 10 | `feat/partage_journee` | Partage « journée complète » des six modes — **fait** |
| 11 | `feat/prochains_deblocages` | Profil : quêtes Expert et badges les plus proches — **fait** |
| 12 | `feat/filtre_en_cours_de_partie` | Étape B anti-triche : changer de filtre en cours de partie = abandon, avec avertissement — **fait** |
| 13 | `feat/accueil_explications` | Slogan à jour, profil invité qui explique le compte, textes anglais restants — **fait** ; les légendes sous chaque mode ont été **retirées** à la demande de Hamza |
| 14 | `feat/nav_ordinateur` | Ordinateur : un seul ⚙ par mode — **fait** ; la navigation en haut et les boutons rangés sous le titre ont été **retirés** à la demande de Hamza (voir « Retours de Hamza ») |
| 15 | `feat/podium_classement` | Podium animé, évolution ▲▼, « ta place » toujours visible — **fait** |
| 16 | `feat/classement_quotidien` | Classement principal sur les parties du jour ; comptes hors norme repérés dans l'admin — **fait**, migration 058 |
| 17 | `docs/readme_anime` | README à la manière de Persona GRUB Themes : bannière et citations animées, bandeaux de section — **fait** |
| 18 | `chore/menage_depot` | Fichiers inutiles retirés, trois documents de planification fusionnés, identifiant Hostinger retiré des fichiers suivis — **fait** |

Depuis le lot 8, les lots sont des **commits successifs d'une seule branche,
`feat/v2_4_suite`** (partie du lot 7), avec une seule PR vers `develop` : Hamza teste
l'ensemble en local puis en préprod avant toute fusion (décision du 2026-11-11). Les noms
de branche du tableau restent ceux des commits.

Hors dépôt du jeu (`personadle-discord`) : Aigis (livré le 2026-11-09), sauvegardes hors
site, préprod accessible par Tailscale, page de statut publique.

### Décisions ouvertes

- **Thème visuel de la 2.4** (palette de la page joueur et du bandeau d'accueil) : pas encore
  choisi — la page joueur reprend pour l'instant la palette de la 2.3.
- **« Puzzle commun du jour »** (une cible identique pour tous) : idée validée sur le
  principe, à cadrer avant d'en faire un lot — reportée à la 2.5 avec la salle à part
  (Archives de Velvet, Cognition) et l'OAuth Discord.

---

## 2026-11-11 — Retirés à la demande de Hamza : la carte Discord après victoire, les légendes de l'accueil

Après avoir regardé la série : « le README ok, … et quand on gagne partage Discord : non,
j'aime pas ; et le Almost there j'aime bien ». Précisé ensuite : retirer **la carte
Discord de fin de partie** (lot 8) et **les légendes de l'accueil** (lot 13), garder le
reste.

- **Carte « Poste ta grille sur Discord »** (et sa version 6/6) : retirée avec tout ce
  qui ne servait qu'à elle. Cela comprend `js/discord_nudge.js`, le proxy
  `/api/discord_counts` (+ `api/lib/discord_counts.php`), `api.discord.counts`, les
  styles `.discord-nudge*`, la section i18n `discord` et leurs tests (JS et PHPUnit).
  Rien n'est perdu : tout reste dans l'historique git si l'idée revient. **Gardés** du
  lot 8 :
  - PersonaDLE en premier dans la modale Discord de l'accueil ;
  - le lien Discord de la feuille « Jouer » à 6/6 ;
  - le lien sous le partage du profil ;
  - la carte « Code événement », qui renvoie au Discord (lot 9).
- Le bloc `#endgameExtras` (sous la barre de fin de partie) reste, pour le seul bouton
  « Partager mon résultat » / « Partager ma journée ».
- **Légendes de l'accueil** : la phrase en bas de chaque bannière, et sa copie sous
  chaque mode dans la feuille « Jouer », sont retirées, avec leurs clés
  `index.mode_caption_*` et `tests/home_captions.test.js`. **Gardés** du lot 13 :
  - le slogan « de Persona 1 à Persona 5X » ;
  - la pastille ✓ visible sur toutes les bannières (correctif de `z-index`) ;
  - le profil invité ;
  - les traductions manquantes.

---

## 2026-11-11 — Retours de Hamza sur les lots 8, 11 et 14

Trois demandes, après un premier coup d'œil à la série :

> « le truc nouveauté et reset remets-les dans leur ancien emplacement (en desktop au
> moins), comme la nav barre à remettre en bas ; le truc partagez résultat et grille
> Discord rendent mal car il déplace les boutons menant au mode suivant ; pour les trucs
> presque là, mets la vraie image du badge »

### 1. Ordinateur : navigation en bas, « Nouveautés » et « Reset » flottants (retour sur le lot 14)

- La barre de navigation reste **en bas** à toutes les tailles. Le bloc `≥ 1 025 px` de
  `css/bottomNav.css` est retiré, et avec lui ce qui n'existait que pour la barre du
  haut : `scroll-padding-top`, la feuille « Jouer » qui descendait, et le décalage de
  « ma place » dans le classement.
- « Nouveautés » et « Reset » retrouvent leurs positions fixes d'origine au-dessus de
  480 px (`.home-quick-actions { display: contents }`). Sur téléphone, ils restent
  rangés sous le titre, comme depuis le lot 3.
- **Gardé** du lot 14 :
  - l'entonnoir du bouton FILTRES (un seul ⚙ par page) ;
  - le `z-index: auto` des deux boutons dans la rangée téléphone. Sans lui, ils passent
    au-dessus de la feuille « Jouer », défaut qui existait depuis le lot 3.

### 2. « Partager » et la carte Discord sous la barre de fin de partie (lots 4, 8, 10)

La barre de fin de partie est une rangée flex « précédent / défi / suivant » en
`space-between`. Le bouton « Partager mon résultat » (lot 4) y était **inséré en tête** :
il décalait « mode précédent » vers le milieu et la rangée changeait d'allure selon le
mode. La carte Discord (lot 8) avait de son côté une marge négative pour s'en
rapprocher.

Désormais, un bloc `#endgameExtras` est posé **sous** la barre et reçoit le bouton
Partager (ou « Partager ma journée » à 6/6) puis la carte Discord. Il est créé par
`endgameSlot()` (`js/share_result.js`), partagé par les deux modules, et se cache avec la
barre quand une nouvelle partie démarre (un seul `MutationObserver`, au lieu de celui que
portait la carte). La barre ne contient plus que ses propres boutons.
`tests/share_result.test.js` vérifie que rien d'autre n'y entre.

### 3. « Presque là » : la vraie image du badge (retour sur le lot 11)

Les originaux pèsent jusqu'à 7,7 Mo pièce (115 Mo pour 74 badges), pour un affichage en
44 px. Les montrer tels quels coûtait ~7 Mo à chaque visite du profil, et faisait échouer
`profile_payload.spec.js`. La carte montre donc **la même image, réduite** :
- `scripts/badge_thumbs.py` génère `profile/badges/thumbs/<nom_en_snake_case>.webp`
  (128 px, webp q82) : **115 Mo → 616 Ko**, ~8 Ko par badge ;
- `badgeThumbPath()` (`profile/next_unlocks_ui.js`) applique la même règle de nom. Un
  test vérifie que chaque image de `profile/badges/images/` a sa miniature. Il faut
  relancer le script après l'ajout d'un badge, et le test le rappelle ;
- si une miniature manque, la pastille 🏅 la remplace plutôt qu'une image cassée ;
- titres et quêtes Expert gardent leur pastille (🎖️, ⚡).

Ces miniatures pourront servir ailleurs : la collection des badges charge toujours les
originaux, alors que leur poids est le premier coût mobile du site (ROADMAP, « Repris
des audits »).

---

## 2026-11-11 — Lot 18 : ménage du dépôt

### Fichiers retirés ou rangés

- **`nom`** (vide) et **`iddée_demander.txt`** (deux lignes d'idées) sont supprimés. Leurs
  idées sont reprises dans `ROADMAP.md` (« Nouveaux personnages », « Cémantix &
  Pédantix »). Les règles `.htaccess` qui les refusent restent : défense en profondeur si
  quelqu'un les recrée, et `tests/htaccess_fichiers_internes.test.js` les vérifie toujours.
  `version-all.sh` avait déjà disparu.
- **`expert_mode_content.md` → `docs/`** : la source curée à la main des paroles Expert
  n'avait rien à faire à la racine. `scripts/export_expert_lyrics.js` suit le nouveau chemin,
  et `npm run lyrics:build` régénère à l'identique (78 chansons, 1 133 vers) : seule la ligne
  d'en-tête change.

### Trois documents de planification, deux vivants

- **`AMELIORATIONS.md` → `docs/archive/audits_2026.md`** (`git mv`, historique gardé).
  C'étaient des **audits datés** (2026-07 → 2026-10-20), sans case à cocher. On les garde
  pour leur raisonnement, mais ce n'est pas une liste de travail. Un en-tête dit
  désormais où est la suite.
- **Ce qui restait ouvert** est repris dans `ROADMAP.md`, § « Repris des audits » :
  - la marche 2 de l'anti-triche ;
  - le poids des images du profil ;
  - les 186 Ko d'`index.html` ;
  - Cémantix et Pédantix ;
  - le rappel « série qui va geler » ;
  - les archives des jours passés ;
  - la statistique du jour ;
  - les nouveaux personnages ;
  - un renvoi aux idées par mode « à trancher ».
- **`TODO.md` reste l'opérationnel** (bloquant release), référencé par `CLAUDE.md`,
  `DEPLOY.md` et `scripts/check-doc-numbers.js`. Le fondre dans `ROADMAP.md` aurait cassé
  ces renvois pour rien. Résultat : `ROADMAP.md` pour les idées et versions, `TODO.md` pour
  ce qui bloque une sortie.
- Les six renvois vers l'ancien chemin sont mis à jour : `ci.yml`, `.htaccess`,
  `ROADMAP.md`, `pages/README.md`, `scripts/validate_incoming.js`.
- `ROADMAP.md` annonçait encore « purger l'historique git (3,9 Go) » : c'est fait, voir
  ci-dessous.

### Identifiant Hostinger retiré des fichiers suivis

L'identifiant du compte (préfixe des noms d'utilisateur et de base de prod) apparaissait
dans 6 fichiers suivis :
- `scripts/migrate.sh` lit maintenant `HOSTINGER_DB_USER` / `HOSTINGER_DB_NAME` dans
  l'environnement, avec un message clair s'ils manquent. Leurs valeurs sont dans
  `personadle-discord/ops/COMMANDES.md`, le dépôt privé ;
- les exemples de commandes (`sql/README.md`, `TODO.md`, plan de test 2.1, en-tête de
  `sql/migration_hostinger_full.sql`) utilisent `<utilisateur_bdd>` / `<base_prod>` ;
- l'instantané `sql/hostinger_current_schema.sql` (DEFINER des vues) passe à `db_user`.

⚠️ L'historique git le contient toujours. Ça ne change rien au risque réel : ce n'est
pas un secret, aucun mot de passe n'a jamais été commité, mais ça cesse de l'afficher.
Le dépôt privé `CLAUDE.md` le garde.

### Pour mémoire : la purge de l'historique (2026-11-09)

Elle avait été faite pendant la 2.3.4 sans être racontée ici.
- **Une seule passe** `git filter-repo`, depuis un miroir d'origin : anciens `.gif` (les
  animations All-Out Attack d'avant le réencodage webp), signatures d'outils dans les
  messages et corps de PR, auteurs remappés.
- `.git` passe de **4,0 Go à 1,2 Go**.
- Hostinger a été recloné, la préprod et le clone local resynchronisés. Les corps des 83
  PR ont été nettoyés.
- Une sauvegarde du dépôt d'avant (4,0 Go) est gardée un mois hors du dépôt.
- À faire par Hamza : décocher « Allow force pushes » sur `main`, et prévenir les
  contributeurs de recloner.

---

## 2026-11-11 — Lot 17 : un README dans le style Persona

Le README de PersonaDLE était une page de projet ordinaire, alors que celui de Persona GRUB
Themes, le projet frère de Hamza, a sa propre identité visuelle. La demande de Hamza : « le
style joli README Persona, comme mon projet de thème GRUB ». Une première version imitait
un menu de démarrage GRUB, ce qui était un contresens ; elle a été retirée avant commit.

### Ce qui change

- **En-tête** :
  - bannière animée « PERSONADLE » en lettres découpées, avec « THE DAILY GUESSING GAME »
    dans son cadre et la ligne « Persona 1 to 5X · six modes · six languages · a new
    target every day » ;
  - citations qui s'écrivent (« I am thou, thou art I… », « Who is it going to be
    today? »…) ;
  - badges sombres (`labelColor=0D0D0D`, rouge `E60012`), une phrase d'accroche, la
    capture de l'accueil, puis la navigation en gras.
- **Séparateurs animés** rouge et noir à la place des `---`.
- **Bandeaux de section** sous « Six modes » (« Normal + Expert »), « Features » (« 6
  languages ») et « Community » (« Discord »).
- Une ligne précise que le classement principal compte la partie du jour de chaque mode
  (lot 16).

### Comment c'est fait

`scripts/readme_assets.py` reprend la méthode de `tools/readme_assets.py` du dépôt GRUB :
- le texte est converti en **tracés** (fontTools), donc rendu identique sans aucune
  police chez le lecteur ;
- animations CSS / SMIL sans script. GitHub sert ces SVG comme des images, où les
  animations tournent et les scripts non ;
- `prefers-reduced-motion` coupe toutes les animations.

Les polices viennent **du site lui-même** (`font/google/*.woff2`, OFL : Inter, Cinzel,
Montserrat, Oswald, Abril Fatface, Playfair Display), instanciées à la bonne graisse.
Rien à installer d'autre que les dépendances de dev, fontTools et brotli. Le script
d'origine visait des polices Linux absentes ici.

Poids : bannière 110 Ko, citations 175 Ko, bandeaux 31 à 39 Ko, séparateur 1 Ko.
Special Elite (machine à écrire) a été écartée pour les citations : ses contours
« usés » donnaient un SVG de près de 1 Mo. Aucun GIF : l'historique en a été purgé en
2026-11.

Pour regénérer : `python scripts/readme_assets.py` (sortie dans `img/readme/`).

---

## 2026-11-11 — Lot 16 : le classement compte les parties du jour ; l'admin repère les comptes hors norme

Depuis la 032, chaque Rejouer ajoute une ligne à `game_sessions`, et `user_stats` cumule
tout. Le classement « depuis toujours » récompensait donc qui rejoue le plus. En base
locale, les comptes de démo y affichent 600+ parties, pour 24 jours de jeu.

### Ce qui change

- **La partie du jour** (migration 058, `game_sessions.is_daily`) est la première partie
  d'un joueur par mode, par jour et par dimension (normal / Expert). Elle est posée à
  l'enregistrement (`personadle_record_game_session()`, lecture juste avant l'insertion)
  et rattrapée sur tout l'historique par la migration. `api/user/migrate.php` importe
  toujours une partie du jour : il n'importe que s'il n'y en a pas déjà une.
- **Le classement a deux vues** (`?scope=daily|all`) :
  - « Parties du jour » : seules ces parties comptent, et un Rejouer ne fait pas monter.
  - « Toutes les parties » : la règle d'avant.

  Un nouveau groupe de filtres « Parties comptées » permet de choisir, et la note sous
  les filtres dit en une phrase ce que la vue compte.
- **Vue par défaut : une seule constante**, `PERSONADLE_LEADERBOARD_DEFAULT_SCOPE` (ici
  `'daily'`). **À trancher par Hamza** : le cron rappelait sa décision « toutes les
  parties comptent ; 100 victoires dans la journée valent 100 ». La liste validée le
  2026-11-09 dit « classement principal sur les parties du jour ». Les deux restent
  possibles, et basculer tient en une ligne.
- **Comptes hors norme** (admin, panneau 🛡️ Anti-triche) : ce sont des **signaux**, pas
  des preuves ni des sanctions, calculés sur les parties normales de la période.
  - 🔁 Rejeu en masse : au moins 4 parties par partie du jour, et au moins 60 parties.
  - 🎯 Premier coup trop fréquent : au moins 60 % des parties du jour. La cible est
    tirée par joueur, la deviner d'emblée aussi souvent suppose de la connaître.
  - 🏆 Presque jamais d'abandon : au moins 98 % de victoires, sur au moins 30 parties
    du jour.
  - ⚡ Victoires éclair : au moins la moitié des victoires en moins de 4 s.

  Seuils en constantes, décision pure (`personadle_outlier_flags()`), lien « Voir le
  joueur ».

### Détails techniques

- **Depuis toujours, parties du jour** : `user_stats` mélange tout, donc on relit
  `game_sessions` (`is_expert = 0 AND is_daily = 1`) avec les formules de l'Expert.
  `buildEverExpertLeaderboard()` prend `$expert` et `$dailyOnly`. Exception : la
  **série** se mesure en jours, elle est identique dans les deux vues et reste sur
  `user_stats`.
- **Périodes** : le cron ne met plus en cache que la vue « parties du jour »
  (`AND gs.is_daily = 1`). La vue « toutes les parties » par période est calculée en
  direct : elle est bornée par la période, donc légère.
- La réponse renvoie `scope`, et le front affiche **la vue servie** : la pastille active
  suit la réponse, défaut du serveur compris. Les flèches ▲▼ (lot 15) gardent une
  référence par vue, `counts` inclus.
- Tests :
  - `tests/php/IsDailyTest.php` : Rejouer = 0, autre mode = 1, l'Expert a sa propre
    partie du jour, le lendemain = 1 ;
  - `tests/php/OutliersTest.php` (6) : chaque signal à son seuil, un joueur ordinaire
    n'en lève aucun, pas de division par zéro ;
  - PHPUnit complet : 452 tests.

### Vérifié (pile Docker)

- Migration 058 jouée deux fois sur la base locale : 579 groupes donnent 579 parties du
  jour, et la seconde passe ne change rien.
- Cron relancé. Classement « depuis toujours / parties » : en vue du jour, tête à 24
  parties ; en vue « toutes », 678. La semaine en « toutes » est servie en direct.
- Bascule dans la page : `scope=all` envoyé seulement sur clic, la note suit.
- Admin : `/api/admin/outliers` remonte les comptes E2E aux victoires de moins de 4 s,
  ce qui est attendu sur des données de test.

### Trouvé en route (commit à part, `fix(profil,nav)`)

La suite E2E complète a levé deux défauts des lots 11 et 14 :
- la carte « Presque là » chargeait les images de badges et de titres, jusqu'à 7,7 Mo
  pièce. Elle montre désormais une pastille, et passe **sous** la carte Badges, où son
  arrivée ne fait plus sauter la rangée épinglée ;
- sur ordinateur, un défilement vers un élément le laissait sous la barre du haut, qui
  interceptait ses clics. `scroll-padding-top: 72px`.

Les autres échecs de la suite en parallèle sont des 503 de la fenêtre de maintenance
(`moderation.spec.js`) et des `ECONNRESET` d'Apache local saturé. Rejoués seuls, ces
fichiers passent.

### À jouer en prod (release)

`058_game_sessions_is_daily.sql` **avant** le `git pull` : sans la colonne, chaque
enregistrement de partie tomberait en 500. Le rattrapage parcourt tout `game_sessions` :
le mesurer d'abord sur la copie du serveur maison. Puis relancer une fois le cron du
classement.

### Angles morts

- En « parties du jour », « depuis toujours » ne compte que ce que le serveur a
  enregistré. Les statistiques d'avant le backend, importées dans `user_stats` sans
  sessions, n'y figurent pas.
- Deux premières parties du même mode envoyées au même instant seraient toutes deux « du
  jour ». Le client envoie ses parties une à une, donc c'est en pratique impossible.

---

## 2026-11-11 — Lot 15 : le classement bouge, et ta place ne se perd plus

### Ce qui change pour le joueur

- **Podium animé** : les trois marches montent l'une après l'autre (3ᵉ, 2ᵉ, puis le 1ᵉʳ,
  dont la médaille finit par un petit rebond). Désactivé si le système demande moins
  d'animations.
- **▲▼ depuis ta dernière visite**, à côté de chaque pseudo et dans « ta place ».
- **« Ta place » toujours visible** :
  - le bandeau reste épinglé en haut de la liste pendant qu'on fait défiler, sous la
    barre de navigation sur ordinateur ;
  - il s'affiche **même quand tu n'es pas dans la page affichée**. Avant, il
    n'apparaissait que pour le top 50, c'est-à-dire pour ceux qui n'en avaient pas
    besoin ;
  - si ta ligne est sur la page, toucher le bandeau t'y ramène et la fait briller.

### Ce qui ne marchait pas

- **Le bandeau ne collait jamais.** Il était déjà en `position: sticky`, mais dans une
  carte en `overflow: hidden` : la carte devenait un conteneur de défilement immobile
  et le bandeau défilait avec la page. `overflow: clip` rogne toujours les coins, sans
  ce conteneur (même famille de piège qu'au lot 7). Sa teinte est désormais posée sur
  le fond de la carte : une teinte seule laissait voir les lignes passer dessous.
- **`my_rank` n'existait que sur la page renvoyée.** `formatAndSend()` reçoit une
  fonction « trouve-moi ». Elle rejoue la même requête **sans `LIMIT`** et s'arrête dès
  qu'elle trouve le joueur, et elle ne tourne que pour un joueur connecté absent de la
  page. Chacun des quatre chemins SQL (depuis toujours normal et Expert, période en
  direct, série en direct) garde sa requête sans `LIMIT` dans `$sql`, la page
  l'ajoutant au moment de l'exécution.
- **Pagination des classements jour / semaine / mois cassée (cache).** Le SQL appliquait
  déjà `LIMIT/OFFSET`, puis le PHP refaisait `array_slice($offset, $limit)` :
  - la **page 2 revenait toujours vide** ;
  - le total valait la taille de la page ;
  - le filtre amis ne voyait que le top 50.

  Le chemin du cache lit maintenant toute la vue (une ligne par joueur classé), puis
  filtre, compte, cherche « ta place » et pagine. Vérifié après avoir rempli le cache
  local avec le cron : page 2 = rangs 6 à 10, total 40, « ta place » au 40ᵉ.

### ▲▼ sans historique serveur

`leaderboard_cache` est recalculé chaque heure sans garder de passé, donc pas de migration
pour une première version. L'évolution se mesure dans le navigateur
(`profile/leaderboard/rank_delta.js`), contre les rangs que **ce** joueur a vus à sa
dernière visite :
- une référence par vue : dimension, mode, période, métrique et filtre amis ;
- pour les périodes bornées, une par jour, semaine ou mois, sinon le classement du jour
  se comparerait à celui de la veille ;
- la référence est gardée **12 h**, pour qu'un simple rechargement n'efface pas les
  flèches qu'on vient de voir ;
- elle n'est jamais remplacée depuis une page 2+, qui n'est qu'une vue partielle.

### Tests

- `tests/rank_delta.test.js` (7) : périodes, clés de vue, durée de vie, page partielle,
  pastilles.
- `tests-e2e/leaderboard_my_rank.spec.js` : avec une page d'une ligne, le second joueur
  reçoit quand même son rang, et ce rang est bien le sien.
- E2E classement / stats / API (28) et PHPUnit complet (445) verts.

### Angle mort

Les flèches dépendent du navigateur : un autre appareil ou un stockage vidé, et il n'y en a
plus jusqu'à la visite suivante. Une table d'historique côté serveur (un instantané par
jour) donnerait une évolution vraie pour tous ; à décider si la fonction plaît.

---

## 2026-11-11 — Lot 14 : sur ordinateur, la navigation passe en haut

La barre de navigation de la 2.4 (lot 3) a été pensée pour le téléphone. Sur un écran de
1 280 px, elle restait une barre d'appli collée en bas, là où on la cherche le moins.
Sur l'accueil, les boutons flottants « Nouveautés » et « Reset Quotidien » se posaient
sur les bannières Personae et Musique dès qu'on faisait défiler. Et chaque page de mode
avait deux ⚙ pour deux choses différentes : le bouton FILTRES et les Paramètres.

### Ce qui change

- **Ordinateur (≥ 1 025 px)** : la barre devient une pastille centrée en haut, entre le
  choix de langue et le mode sombre, avec icône et libellé côte à côte. La page garde
  64 px en haut pour elle. La feuille « Jouer » **descend** de la barre au lieu de
  monter du bas. Le téléphone et la tablette ne changent pas.
- **Accueil** : « Nouveautés » et « Reset Quotidien » sont rangés sous le titre **à toutes
  les tailles**. Jusqu'ici c'était le cas sur téléphone seulement : au-dessus de 480 px,
  la rangée était en `display: contents` et les boutons restaient flottants.
- **Un seul ⚙ par mode** : le bouton FILTRES prend un entonnoir (SVG en ligne), et
  l'engrenage reste aux Paramètres.

### Bug trouvé en route

Dans la rangée flex, « Nouveautés » et « Reset » passaient **au-dessus** de la feuille
« Jouer » et de son fond assombri. Un élément de rangée flex applique son `z-index` même
en `position: static`, et celui des boutons flottants valait 1000, contre 700 pour la
feuille. Le défaut existait déjà sur téléphone depuis la rangée du lot 3.
`z-index: auto` dans la rangée.

### Vérifié (pile Docker)

- Sept pages (accueil, Classique, Musique, profil, classement, amis, FAQ), à 1 280 et
  1 025 px :
  - la barre ne chevauche aucun élément fixe du haut ;
  - aucun débordement horizontal.
- Feuille « Jouer » sur ordinateur : elle descend sous la barre, couvre bien les
  boutons de l'accueil et se ferme avec Échap.
- E2E de mise en page, de fumée et mobile : 42/42.
- `tests/one_gear_per_mode.test.js` (6) : exactement un ⚙ par page de mode (celui des
  Paramètres), et l'entonnoir sur FILTRES.

### Angle mort

La pastille « N à jouer » est écartée du libellé par `:has()`. Les navigateurs récents le
gèrent ; un vieux navigateur garde l'ancien écart, et le chiffre mord un peu sur le mot.

---

## 2026-11-11 — Lot 13 : l'accueil dit ce qu'on fait, l'invité sait ce qu'un compte apporte

Pour qui découvre le site, rien n'expliquait les six modes : les bannières de l'accueil
sont des images. Le slogan disait encore « Persona 1 à Persona 5 ». Et un invité qui
ouvrait son profil voyait deux boutons « Connexion / Créer un compte », sans un mot
sur ce que le compte change.

### Ce qui change pour le joueur

- **Une ligne sur chaque bannière** (« Devine le personnage d'après sa silhouette »,
  « Trouve à qui appartient cette Persona »…), en bandeau en bas de l'image, en
  tablette et sur ordinateur. Sur téléphone, la bannière fait 170 px de large : le
  bandeau en cacherait la moitié. La même ligne passe donc sous le nom de chaque mode
  dans la **feuille « Jouer »**.
- **Slogan** : « Devinez le personnage Persona du jour, de Persona 1 à Persona 5X », dans
  les 6 langues.
- **Profil invité** : « Gratuit. Ta série, tes stats et tes badges te suivent sur tous tes
  appareils, et tu peux ajouter des amis, les défier et entrer au classement. », au-dessus
  des boutons de compte.
- **Textes anglais restants**, sur une page française :
  - « Guest » devient « Invité ».
  - « Enter username… » devient « Ton pseudo… » : la clé `profile.pseudo_placeholder`
    était référencée par le HTML mais n'existait dans aucune langue.
  - « Profile Song » et « ✕ Remove » sont traduits.
  - Les notifications « Title Unlocked! » et « Wallpaper Unlocked! » aussi (« Badge
    Unlocked! » l'était déjà).
- **« Première partie » d'un profil vierge** : la tuile affichait la date du jour pour qui
  n'avait jamais joué (`firstPlayed` est posé à la création du profil). Elle affiche
  « — » tant qu'aucune partie n'est jouée.

### Deux bugs trouvés en route

- **La pastille « ✓ Joué aujourd'hui » était cachée** sur cinq bannières sur six. Elle
  avait `z-index: 5` alors que les images d'Émoji, Shadows, Personae et Musique sont à
  10 et les couches d'All-Out Attack montent à 15. Elle ne se voyait que sur
  Classique. Elle passe à 21 et la légende à 20.
- **« Aucun » / « None » au hasard** dans le choix du mode favori, et « Guest » au lieu
  d'« Invité ». Ces deux éléments étaient rendus avant le chargement des traductions
  et jamais repris : selon l'ordre de chargement, le texte sortait en anglais.
  `_rerenderTranslated()` les ajoute à ce qu'on redessine sur `personadle:i18n-ready`.
  Vérifié sur 5 chargements : « Invité », « Aucun » à chaque fois.

### Débordement de la page Classique sur ordinateur (noté au lot 8)

À 1280 px, la page faisait 1 309 px de large : la bulle d'aide de la dernière colonne
(« Jeu »), centrée sur son en-tête, dépassait du bord droit. Même cachée
(`visibility: hidden`), elle comptait dans la largeur de la page. Ancrée à droite pour la
dernière colonne : 1280 et 1440 px n'ont plus de débordement, et à 1024 la rangée est
rognée par son conteneur sans faire défiler la page.

### Tests

`tests/home_captions.test.js` (3) vérifie trois choses :
- les six légendes sont dans leur bannière ;
- leurs clés existent dans les 6 langues ;
- la feuille « Jouer » les reprend.

---

## 2026-11-11 — Lot 12 : changer de filtre en cours de partie compte comme un abandon

L'angle mort laissé par la 2.3 (« étape B anti-triche ») : changer de filtre relance la
partie avec une nouvelle cible, et **la partie en cours disparaissait sans être
enregistrée**, dans les six modes. On pouvait esquiver une cible ratée (trois essais, un
filtre décoché, nouvelle cible) sans que l'abandon compte, ni dans les stats ni dans les
quêtes Expert « d'affilée ».

### Ce qui change pour le joueur

Au **premier** changement de filtre d'une partie entamée, un avertissement : « Changer de
filtre maintenant met fin à cette partie : elle comptera comme un abandon dans tes stats.
Changer quand même ? »
- **Annuler** : filtres et partie intacts.
- **Confirmer** : la partie est enregistrée en abandon et le toast dit quelle était la
  cible. Le changement s'applique ensuite et une nouvelle partie démarre, comme avant.

Rien ne change pour une partie pas commencée (0 essai), déjà finie ou déjà enregistrée,
ni pour une partie de défi : celle-ci n'est jamais enregistrée en quotidien, et ses
filtres sont posés par le défi.

### Détails techniques

- `js/filter_guard.js` : `createMidGameFilterGuard()` enregistre **la même session que
  le bouton Abandonner** (`buildGameSession` + `savePendingSession`, stats locales,
  `checkUnlocksAfterGame`). Le seuil d'essais du bouton n'est pas exigé, et la cible
  n'est pas révélée à l'écran, puisque la nouvelle partie démarre aussitôt.
- `js/filterMenu.js` : `setBeforeChange(fn)` sur l'objet renvoyé par `initFilterMenu()`.
  Le garde est consulté avant les trois chemins de changement (code seul, groupe, tout
  cocher), et `false` annule le clic. Il est passé après coup plutôt qu'en argument
  pour deux raisons :
  - il lit l'état du mode (essais, cible), qui n'existe pas encore quand le menu se
    construit ;
  - `filter_change_rearms_game.test.js` découpe le rappel de `initFilterMenu()` jusqu'à
    son `});`, et un 4e argument l'aurait affaibli sans bruit.
- Les six modes branchent le garde avec leurs propres noms (`target.nom`, `target.titre`,
  `target.user[0]`, AOA en chaîne ; `activeOpus`/`activeFilters`/`activeOpusFilters`).
- `confirm()` natif : synchrone, donc le clic peut être annulé avant d'être appliqué. Une
  modale maison demanderait de rendre le menu asynchrone.
- Tests : `tests/filter_guard.test.js` (10). Ils couvrent les cas « rien à faire »,
  Annuler, Confirmer, l'absence de second enregistrement, `setBeforeChange` dans le menu
  et le branchement dans les six modes.

### Vérifié (pile Docker)

- Classique, deux essais puis un clic sur un filtre :
  - Annuler : même cible, 0 session ;
  - Confirmer : 1 session `giveup`, 2 essais, la bonne cible, puis nouvelle partie ;
  - un second changement sur la partie neuve ne redemande rien.
- Les six modes, en normal et en Expert : un clic de filtre s'applique sans erreur de
  page. Le garde lit l'état du mode à chaque clic : un nom de variable faux y aurait
  bloqué les filtres.
- E2E existants (filtres, parties, Expert AOA/Musique/Personae, Rejouer, défis) :
  58/58. Playwright refuse les dialogues par défaut, donc un test qui changeait un filtre
  en pleine partie aurait cassé.

---

## 2026-11-11 — Lot 11 : « Presque là », ce qui est sur le point de se débloquer

Le profil montrait ce qu'on a, jamais ce qui est presque là. Un joueur à 8 / 10
victoires Silhouette d'un badge ne le savait pas, à moins d'ouvrir la collection et de
compter lui-même. Le bug Expert de la 2.3.4 (« la quête n'avance pas ») venait aussi de
là : la progression ne se voyait que dans une infobulle.

### Ce qui change pour le joueur

Une carte **« Presque là »** sur son profil (connecté), entre Statistiques et Badges :
- les six badges, titres et Modes Expert les plus avancés ;
- pour chacun : icône, nom, condition, barre de progression et « 4 / 5 ».

Jamais de badge secret, jamais ce qui est déjà obtenu. Les badges et titres qui
demandent de jouer en Expert sont écartés tant que le mode est verrouillé : la quête
qui l'ouvre est déjà dans la liste. Sur téléphone, la carte est repliable comme les
autres et reste ouverte par défaut.

### Une seule source pour la progression et le déblocage

`personadle_condition_progress()` (`api/lib/condition_check.php`) donne « actuel /
seuil » pour toutes les conditions **chiffrées** (22 types : victoires, parties,
séries, amis, badges, titres, Expert…). `personadle_verify_condition()` **l'appelle**
au lieu de garder son propre calcul. Deux calculs séparés finiraient par annoncer
« 10 / 10 » sur un titre que l'unlock refuse. Restent dans le `switch` de `verify` les
conditions non chiffrées : dates, Pâques, ensembles de cibles, Same Energy, manuelles.

C'est un recâblage de la fonction qui décide de **tous** les déblocages, d'où les
vérifications :
- la suite PHPUnit complète (445 tests, dont `BadgeWallpaperCatalogTest`, qui exige
  chaque entrée du catalogue accordée au seuil exact) passe sans changer un test ;
- `NextUnlocksTest` vérifie que la progression et la décision suivent la même stat (4 / 5
  refusé, 5 / 5 accordé) ;
- une condition chiffrée mal configurée (`mode_wins` sans mode) reste **jamais
  remplie**, comme avant. Elle renvoie `valid: false` et non `null`, sinon le
  `default: return true` du `switch` l'aurait accordée.

### Détails techniques

- `GET /api/user/next-unlocks?lang=` (`api/user/next_unlocks.php`, RewriteRule dans
  `api/user/.htaccess`). Il commence par la même réconciliation que `GET /api/titles` et
  `/api/badges` : ce qui est dû est accordé avant d'être listé.
- `api/lib/next_unlocks.php` :
  - `personadle_next_unlocks()` lit les badges non secrets et les titres non
    obtenus, en écartant ceux adossés à un code événement (pas de progression : on a
    le code ou pas), puis les quêtes Expert verrouillées ;
  - `personadle_rank_next_unlocks()` (pure) classe le plus avancé d'abord, puis ce à
    quoi il manque le moins.
  - Un `$memo` par requête évite de recompter : des dizaines d'entrées partagent quelques
    compteurs. Une condition qui plante est loguée et sautée, jamais propagée (§7).
- `profile/next_unlocks_ui.js` : libellés en i18n.
  - Badge : `badges.<slug>.name/condition`. La colonne `name_*` est souvent vide en
    base, les noms vivent dans `lang/`.
  - Titre : déjà traduit par l'API.
  - Quête Expert : `expertConditionLabel()`, comme l'infobulle du bouton Expert.
  - HTML échappé. La carte reste cachée pour un invité ou une API muette.
- La liste se rafraîchit après la synchro du profil et quand un code accorde un titre
  (`personadle:titles-changed`, lot 9).
- Tests : `tests/php/NextUnlocksTest.php` (4), `tests/next_unlocks_ui.test.js` (4).

### Vérifié à l'écran (pile Docker)

Compte neuf, une victoire Silhouette enregistrée :
- `first_win` est accordé et quitte la liste ;
- « Shadow Slayer 1 / 5 », « Pancakes? 1 / 3 » et la quête Expert Silhouette 1 / 10
  apparaissent ;
- à 1280 px clair et 390 px nuit, pas de débordement. Les noms illisibles en mode nuit
  ont été corrigés après capture.

---

## 2026-11-11 — Lot 10 : partager sa journée entière

« Partager mon résultat » (lot 4) ne parlait que de la partie qui venait de finir. Un
joueur qui fait ses six modes chaque jour veut montrer la journée, comme une grille Wordle :

```
PersonaDLE 📅 11/11 — 5/6
🔤 Classique ✅ 2
😄 Emoji 🎯 1
👤 Silhouette 🏳️
⚔️ All-Out Attack ✅ 2
✨ Personae ✅ 5
🎵 Musique ✅ 4
https://personadle.net
```

Le texte ne contient que des marques, aucune cible. Chaque joueur a d'ailleurs la sienne.

### Où le partager

- **À 6/6, le bouton de fin de partie partage la journée** (« 📅 Partager ma journée »),
  dans les six modes. Pas de second bouton : la barre de fin de partie
  (précédent / partager / défi / suivant) déborderait sur téléphone, et la journée
  contient déjà la partie qui vient de finir. Avant 6/6, rien ne change.
- **La carte Discord « 6/6 »** (lot 8) copie la journée : « Copier ma journée et ouvrir
  Discord ».
- **La feuille « Jouer »** de la barre du bas, à 6/6 : un bouton au-dessus du lien Discord.

### Détails techniques

- **Relevé du jour** `dailyResults` (`{ day, modes: { classic: { result, attempts } } }`),
  écrit par `recordDayResult()` depuis `buildGameSession()`, au même endroit que
  `lastGameResult`. Seule la **première** partie normale de chaque mode compte : un Replay
  ou une partie Expert n'est pas « la partie du jour ». Une partie armée la veille et
  finie après minuit appartient à la veille et n'efface pas la journée en cours.
- `recordDayResult()` vit dans `gameCore.js` et non dans `share_day.js` : gameCore
  l'appelle, et `share_day.js` importe gameCore (§7, imports circulaires).
  `share_day.js` prend `MODE_ICON` dans `daily_status.js` pour la même raison : le
  prendre dans `share_result.js` aurait bouclé.
- Un mode marqué joué (`dailyDone_*`) sans résultat retenu (joué avant cette version, ou
  sur un autre appareil) s'affiche « ✔️ », sans détail. Pas de remontée au serveur pour
  l'instant : le relevé est local, comme `lastGameResult`.
- Carte Discord : le libellé « 6/6 », long, revient à la ligne (`max-width: 210px`) au
  lieu d'écraser la colonne de texte. Défaut vu à la capture.
- Tests : `tests/share_day.test.js` (8), plus un cas chacun dans `discord_nudge.test.js` et
  `bottomNav.test.js`.

### Vérifié à l'écran (pile Docker)

Cinq modes pré-remplis, puis une vraie victoire en Classique à 1280 px :
- le bouton devient « Partager ma journée » ;
- la carte Discord passe en « 6/6 » ;
- le presse-papiers contient exactement le texte ci-dessus.

### Angle mort

Une journée jouée sur deux appareils n'a de détail que pour les modes joués sur celui-ci.
Les autres modes s'affichent « ✔️ ». Le serveur sait tout (`game_sessions`) : un
`GET /api/sessions/today` pourrait compléter le relevé, mais ça n'a pas paru nécessaire
pour une première version.

---

## 2026-11-11 — Lot 9 : des codes vraiment exclusifs au Discord, et qui peuvent donner un titre

Un code événement donnait un badge, et seulement un badge. Pour animer le Discord avec
des codes à lui, le badge coûte cher : il faut une illustration. Un **titre** coûte un nom
et une bannière. Et surtout, un code « exclusif » n'en était pas un : celui de la 2.3,
« dévoilé dans l'annonce Discord », est écrit en clair dans la migration 054, sur un
dépôt public.

### Ce qui change

- **Un code accorde un badge, un titre, ou les deux** (migration 057 :
  `event_codes.badge_id` devient NULL-able, `event_codes.title_slug` ajoutée).
- **Admin** : champ « Titre » (liste du catalogue) à côté du badge, colonne
  « Récompense ». Au moins l'un des deux est exigé, et chacun est vérifié contre son
  catalogue.
- **Profil** : la carte « Code événement » dit que les codes sont publiés sur le Discord,
  avec le lien. Un code « titre » affiche son propre message, et la liste des titres se
  recharge sans recharger la page (`personadle:titles-changed`).
- **Garde de route sur les titres** : un titre de code porte `condition_type = 'manual'`,
  que la vérification de condition laisse toujours passer. Sans garde,
  `POST /api/titles/unlock` avec le slug (public) l'aurait accordé sans code : c'est le
  trou déjà fermé pour les badges dans la 2.2. Le garde vaut **même si le code est
  désactivé**, pour que désactiver un code n'ouvre jamais son titre.
- **Plus jamais de code dans le dépôt** : `tests/event_codes_not_in_repo.test.js` refuse
  toute insertion dans `event_codes` dans une migration à partir de la 057. Les codes se
  créent dans l'admin, donc dans la base de prod seulement.

### Détails techniques

- `api/lib/event_codes.php` : l'échange sort de `api/badges/index.php` pour devenir
  testable : `personadle_redeem_event_code()` (statut HTTP + récompenses, ne lève rien),
  `personadle_badge_is_code_gated()`, `personadle_title_is_code_gated()`. La redemption
  n'est jamais consommée si la récompense est introuvable (titre ou badge mal saisi) :
  le joueur garde sa chance une fois le catalogue corrigé. La transaction n'est ouverte
  que si l'appelant n'en a pas déjà une : les tests tournent dans une transaction annulée.
- Le chemin reste `POST /api/badges/redeem`, que le client et les annonces connaissent
  déjà. La réponse gagne `title_slug`, et `badge_id` peut être `null`.
- `title_slug` et non `title_id` : même choix que `badge_id`, lisible dans l'admin et
  stable d'une base à l'autre (les id de `titles` diffèrent entre prod et Docker).
- Tests :
  - `tests/php/EventCodeRedeemTest.php`, 7 cas sur une vraie base : badge, titre, les
    deux, 409, 404/400/410 dont le dernier jour inclus, code mal configuré sans
    consommation, gardes ;
  - `EventCodeBadgeGateTest.php` suit l'extraction ;
  - E2E `admin-extended.spec.js` : l'admin crée un code « titre », `/titles/unlock` le
    refuse (403), l'échange l'accorde ;
  - `badgesManager.test.js` : un code « titre seul ».

### À jouer en prod (release)

`057_event_code_titles.sql` **avant** le `git pull`. Sans la colonne, l'échange et l'admin
des codes tombent en 500. Rejouée deux fois sur la base Docker : idempotente.

### Angle mort (décision Hamza)

Les codes encore actifs déjà écrits dans le dépôt (`bdd_mysql.sql`, migration 054) restent
lisibles sur GitHub, historique compris. Les retirer des fichiers n'y changerait rien. La
seule parade est de les désactiver dans l'admin et d'en créer de nouveaux là-bas. Noté
dans `TODO.md` § Bloquant release.

---

## 2026-11-11 — Lot 8 : le Discord, au moment où on a envie d'en parler

Mesure du 2026-11-09 : 68 membres, **2 arrivées en 30 jours**. Le seul chemin vers le
serveur était l'icône Discord en bas de l'accueil, qui ouvrait une modale où le serveur
partenaire passait en premier. Or le moment où un joueur a envie d'en parler, c'est juste
après une victoire, et plus encore après une journée 6/6.

### Ce qui change pour le joueur

- **Après une victoire**, sous la navigation de fin de partie : une carte « Bien joué !
  Poste ta grille sur Discord ». Son bouton copie le résultat (le même texte que
  « Partager mon résultat ») et ouvre le serveur. L'argument est vrai et rassurant :
  chaque joueur a sa propre cible, la grille ne divulgue rien.
- **Après la 6e victoire du jour** : la même carte, en version « 🏆 6/6 aujourd'hui ».
- **Compteur** : « 69 membres · 8 en ligne », sous des seuils (50 membres, 5 en ligne) au-dessous
  desquels il ne s'affiche pas. « 2 en ligne » ferait fuir.
- **Feuille « Jouer »** (barre du bas, téléphone) : à 6/6, un lien vers le serveur sous la
  liste des modes.
- **Profil** : la fenêtre de partage avait « Copier pour Discord » sans dire où coller ;
  un lien vers le serveur sous les quatre boutons.
- **Modale Discord de l'accueil** : PersonaDLE en premier (liseré, « ⭐ Officiel ·
  🌍 International »), le Grimoire du Cœur ensuite. Le texte « toujours actif » est
  retiré : la mesure dit le contraire (seul `#general` vit).
- Au passage : la pastille « N à jouer » de la barre du bas restait au chiffre du
  chargement (6 juste après une victoire). Elle se met à jour en fin de partie.

### Retenue (pour ne pas devenir une pub)

Une seule carte par jour, plus une pour le 6/6. Elle revient seulement quand c'est la
**même** partie qui se réaffiche (rechargement). Jamais après un abandon, jamais pendant un
défi : on repart de `readCurrentResult()`, qui exclut déjà ces cas. Le ✕ (« Masquer — je
suis déjà sur le serveur ») la fait taire pour de bon sur l'appareil.

### Détails techniques

- `api/discord_counts.php` + `api/lib/discord_counts.php` : proxy de l'endpoint **public**
  d'invitation de Discord (`/api/v10/invites/<code>?with_counts=true`), qui donne membres et
  présents **sans jeton et sans widget** (le widget du serveur est désactivé : 403). On passe
  par un proxy plutôt que par le navigateur pour trois raisons : l'IP des joueurs ne part
  pas chez Discord avant leur clic, la CSP (`connect-src`) reste fermée, et Discord n'est
  appelé que toutes les 10 min (cache). En cas de panne, le dernier chiffre sert encore
  un jour, avec 60 s entre deux essais. `fetched_at` (date des chiffres) et `checked_at`
  (dernier essai) sont séparés : sinon un chiffre périmé, réécrit à chaque échec,
  survivrait indéfiniment. Le cache vit dans `sys_get_temp_dir()` et non dans le webroot,
  dont le `git status` doit rester propre pour le déploiement auto.
  Les valeurs relues sont bornées, `/tmp` n'étant pas de confiance.
- `js/discord_nudge.js` : `pickNudgeVariant()` (pure), `countsLine()`,
  `fetchDiscordCounts()` (cache 5 min en `sessionStorage`) et `mountDiscordNudge()`, appelé
  par `revealNextLink()` comme le bouton Partager. La carte est posée **après**
  `#modeNavigationContainer`, pas dedans : la nav est une rangée flex
  prev/partage/défi/suivant qu'une carte casserait. Un `MutationObserver` sur le `style`
  de la nav la cache quand une nouvelle partie démarre (Replay, filtre, minuit).
- Le bouton est un `<a target="_blank">` et non `window.open()`, donc jamais bloqué comme
  popup. La copie démarre dans le clic, tant que la page a le focus.
- `currentShareText()` et `toast()` sortis de `js/share_result.js`, partagés par les deux
  boutons. `DISCORD_INVITE_URL` dans `gameCore.js`, partagé par la carte et la feuille
  « Jouer ».
- Logo blanc sur pastille Discord : le SVG des liens sociaux est noir (pas de `fill`) et
  disparaissait en mode nuit. Le filtre est sur l'`<img>` seule : posé sur la pastille, il
  inverserait aussi son fond.
- i18n : section `discord` (8 clés), `nav.play_discord`, `profile.share_open_server`, et
  `index.discord_personadle_tag/desc` réécrits, dans les 6 langues.
- Tests : `tests/discord_nudge.test.js` (14), `tests/php/DiscordCountsTest.php` (5),
  un cas de plus dans `tests/bottomNav.test.js`.

### Vérifié à l'écran (pile Docker)

Victoire réelle en Classique (390 px mobile et 1280 px, clair et nuit) :
- la carte est sous la navigation, avec le compteur réel (69 · 8) ;
- elle revient au rechargement ;
- elle reste atteignable au-dessus de la barre du bas ;
- aucun débordement à 390 px.

Modale et feuille « Jouer » à 6/6 contrôlées aussi.

### Angles morts

- À 1280 px, la page Classique fait 1 309 px de large **avant même ce lot** : une
  infobulle `.tooltip-text` déborde à droite. Noté pour le lot 13.
- Le lien d'invitation arrive sur `📜┃rules` (réglage de l'invitation côté Discord).
  Pour que « colle-le sur le serveur » soit évident, un fil « scores du jour » sous le
  quotidien serait le bon point de chute : à faire côté bot (`personadle-discord`).
- Compteur « approximatif » côté Discord : il peut retarder de quelques minutes.

---

## 2026-11-11 — Lot 7 : le profil ne déborde plus sur téléphone

Le test de fumée de la prod (serveur maison) signalait **chaque nuit depuis au moins le
2026-10-12** : « profil @390px — débordement horizontal +14px », « @480px +12px ». C'était
l'alerte récurrente du salon 🤖┃bot.

### La cause

Les cartes du profil entrent en glissant depuis la droite (`.animate-right`,
`translateX(28px)` → 0). À la première image, elles finissent à 403 px sur un écran de 390.
Sur mobile, le navigateur élargit alors la **zone de mise en page** (404 px) et la **garde**
après la fin de l'animation. La barre du bas, fixée de bord à bord (`left: 0; right: 0`),
suit cette largeur et la page défile de côté. Le moindre recalcul de mise en page fait
revenir la largeur à 390, d'où un bug difficile à voir à la main.

### Pourquoi les tests ne le voyaient pas

`tests-e2e/mobile_streak_usecases.spec.js` comparait `scrollWidth` à `window.innerWidth`.
Or avec ce bug, `innerWidth` gonfle lui aussi (404) : le test passait. Seul le test de fumée
du serveur maison, qui compare à la largeur fixe de l'écran, levait l'alerte.

### Le correctif

`.profile-container { overflow-x: clip; }` (`profile/profile-page.css`). `clip` et non
`hidden` : pas de conteneur de défilement, les éléments `sticky` continuent de fonctionner.
Volontairement local : un `overflow-x` sur `html` masquerait aussi les vrais débordements
que le test de fumée doit attraper. Les cartes ont une ombre très légère (opacité 0,05,
flou 12 px) : la coupe sur les bords du conteneur ne se voit pas.

`tests-e2e/profil_debordement_mobile.spec.js` : profil à 390 et 480 px en mode mobile,
comparé à la largeur **demandée**. Rouge avant le correctif (404 et 493 px), vert après.

---

## 2026-11-11 — Les hooks git ne plantent plus quand VS Code ouvre le dossier en « c:\ »

Après le reclonage du 2026-11-10, le pre-push a bloqué un push sain : 87 fichiers de tests
sur 90 en échec, tous avec « Cannot read properties of undefined (reading 'config') » au
premier `describe`. Cause : VS Code avait ouvert le dossier en `c:\…` (lettre de lecteur en
minuscule) tandis que git le voit en `C:/…`. Vitest charge alors deux exemplaires de
lui-même. Le même test passait depuis un PowerShell en `C:\`.

`.githooks/pre-commit` et `.githooks/pre-push` font désormais
`cd "$(git rev-parse --show-toplevel)"` juste après `set -e` : les tests tournent toujours
depuis la racine telle que git la donne. Vérifié depuis un terminal en `c:\` : le test
qui échouait passe.

---

## 2026-10-21 — Un écran large mais court ne défile plus pour jouer


Signalé par Hamza : un correctif d'affichage « pas besoin de défiler pour voir les
résultats de Classique » marchait **chez lui et pas chez les joueurs**, sur un vrai PC.

### La cause : tout le responsive ignorait la hauteur

Vérifié fichier par fichier : il n'existait **aucune** media query sur la hauteur dans
l'ensemble du CSS du projet. Tous les points de rupture portent sur la largeur — 480 /
768 / 1024 px, exactement ce que liste le §6 du CLAUDE.md.

Conséquence mesurée : **la barre de réponse se place à la même ordonnée quelle que soit
la hauteur de la fenêtre**, dans les six modes. `#imgHomePage` est le cas d'école :
`width: min(460px, 80vw)` + `height: auto`, donc sa hauteur suit la largeur disponible et
jamais la place verticale restante.

Relevé à **1536×864** — la résolution de bureau la plus répandue, et un écran que tous les
points de rupture en largeur considèrent comme large, donc confortable :

| Mode | Saisie à y= | Défilement pour l'atteindre |
|---|---|---|
| Silhouette | 1475 | **611 px** |
| Personae | 1309 | 445 px |
| All-Out Attack | 1285 | 421 px |
| Musique | 963 | 99 px |
| Émoji | 842 | tient, à 22 px près |
| Classique | 766 | tient, mais les résultats démarrent à 830 |

Sur un écran de 1080 px de haut la page tient **pile** ; sur tout écran plus court elle
défile. D'où « ça marche chez moi ». Et le correctif « Indice et Abandon côte à côte » de
la 2.3.2 traitait bien le même symptôme — mais sous `max-width: 900px`, donc jamais sur un
PC.

### Le correctif

Un bloc de compression du bandeau partagé, scopé **`min-width: 901px` ET
`max-height: 900px`** : large mais court.

- La borne 901 s'aligne sur le `max-width: 900px` de `classique.css`, donc les deux blocs
  ne se chevauchent **jamais** : le calibrage mobile, ajusté au pixel en 2.3.2, n'est pas
  touché.
- Là où la page tenait déjà (≥ 901 px de large et > 900 px de haut), **rien ne change**.
- Les valeurs sont en `clamp()` avec du `vh` plutôt qu'un nouveau palier en px dur, pour
  que la compression soit continue jusqu'aux petits portables (§6).

Postes comprimés — `css/global.css` §20 (nouvelle section) :

- **`#imgHomePage`** — 175 px de haut dès 1536 px de large. Borné par sa **hauteur**
  (`width: auto` conserve le ratio) au lieu de sa largeur, puisque c'est la hauteur qui
  manque. Effet de bord favorable : la hauteur de l'en-tête devient connue avant le
  chargement de l'image, donc plus de reflow vertical au moment où elle arrive.
- **`.emoji-hint-zone`** — bandeau de consigne des cinq autres modes : 30 px de padding
  **et** 30 px de marge, en haut comme en bas, soit 120 px qui ne portent aucune
  information.
- **`.expert-toggle-zone`** — ses seules marges verticales valaient 36 px.
- **`.hint-giveup-row`** — 166 px de haut, dont 24 px de padding vertical imposé à tout
  `.link-wrapper` par le §18 (cible tactile). On rogne le padding et on borne l'image par
  sa hauteur : même technique que le correctif mobile de la 2.3.2, en production depuis,
  donc les formes SVG décoratives suivent (elles sont en absolu dans `.link-wrapper`, qui
  reste en `fit-content`). La cible tactile reste au-dessus des 48 px du §7.

Et `classiqueMode/classique.css` pour **`.personadle-box`** (172 px : 60 px de padding
vertical, un `h1` de 62 px et sa marge), qui remplace `.emoji-hint-zone` dans ce mode et
échappait donc à la compression des cinq autres.

Le commentaire de la 2.3.2 jugeait que toucher à cette boîte et au logo serait « une
refonte, pas un correctif ». C'était exact **dans son contexte** : il s'agissait d'y
toucher pour tout le monde. Sous condition de hauteur, le compromis change — on ne dégrade
rien là où ça fonctionnait.

### Gain mesuré (1536×864)

| Mode | Avant | Après | Gain |
|---|---|---|---|
| **Classique** | saisie@766, 74 px de défilement | **saisie@617, 0 défilement** | −149 px |
| **Émoji** | saisie@842, 120 px | **saisie@717, 0 défilement** | −125 px |
| Musique | saisie@963, 241 px | saisie@837, 115 px | −126 px |
| Personae | saisie@1309, 589 px | saisie@1173, 453 px | −136 px |
| All-Out Attack | saisie@1285, 563 px | saisie@1159, 437 px | −126 px |
| Silhouette | saisie@1475, 755 px | saisie@1337, 617 px | −138 px |

**Classique et Émoji ne défilent plus du tout** à cette résolution, et Classique dispose de
247 px sous la barre de saisie — de quoi afficher deux lignes de résultat (100 px l'unité),
ce qui était la demande d'origine.

### Vérification

- Mesures prises au navigateur réel (Playwright) sur les **six** modes et trois
  résolutions, avant et après, pas une lecture du CSS.
- Vitest : **1548 passés** (86 suites).
- Accolades équilibrées sur les deux fichiers ; diff en **insertions pures** (133 lignes,
  0 suppression).
- `prettier --write` passé sur le bloc ajouté **avant** de l'insérer, pour ne pas embarquer
  le reformatage des parties préexistantes de `global.css` — le fichier était déjà non
  conforme sur `develop`, et la vérification prettier de la CI est explicitement non
  bloquante (`AMELIORATIONS.md §8`). Ce reformatage reste un chantier à part.

### Angles morts connus

- **Silhouette, All-Out Attack et Personae débordent encore** (617, 437 et 453 px à
  1536×864). Le reste vient de leur grande image, pas du bandeau partagé. Les dimensionner
  en `vh` touche la lisibilité du jeu lui-même — une silhouette plus petite change la
  difficulté — donc c'est une décision de conception, pas un sous-produit de ce lot.
- **Les captures de référence visuelles** (`E2E_VISUAL=1`, opt-in) sont à régénérer : les
  six modes changent d'apparence sous 900 px de haut. Elles ne tournent pas en CI, donc
  rien n'est cassé aujourd'hui.
- **Le groupe E2E du profil est instable**, indépendamment de ce lot. Quatre runs complets
  sur base vierge : **1, 2, 3 puis 5 échecs**, les deux runs à 1 et 5 étant tous deux
  *sans* la modification. Les échecs se concentrent sur `profile_atelier.spec.js` (186,
  242, 282, 459) et `profile_no_overwrite.spec.js` (42), et chacun **passe lancé seul** —
  écriture presse-papiers qui réclame le focus, clics sur une page encore en cours de
  rendu. Le job E2E est bloquant en CI depuis le 24 juillet 2026 : cette variance mérite
  son propre lot, sinon elle finira par bloquer une release sans raison.
- La suite E2E **n'est pas idempotente** entre deux exécutions sans `docker compose down -v`,
  et l'enchaîner trop vite déclenche le rate-limit du `globalSetup` (429, table
  `rate_limits`).
---

---

## 2026-10-20 — Application installable et polices sans Google

### PWA

Le service worker existait déjà, mais **aucun manifeste** : impossible d'« ajouter à
l'écran d'accueil » avec une vraie icône. Pour un jeu quotidien joué surtout sur téléphone,
c'est le levier de retour le plus direct.

- `manifest.webmanifest` (racine) : `standalone`, couleur `#e63946`, `start_url`
  `./index.html?source=pwa` (repérable plus tard dans les statistiques), raccourcis vers
  Classique, Émoji, Musique et le profil (appui long sur l'icône).
- `img/app_icons/` : 192, 512, 512 *maskable* (logo dans la zone sûre de 80 %) et
  `apple_touch_icon_180` pour iOS — générées depuis `New_Logo_PersonaDLE.png` sur fond noir
  à bande rouge P5. **Provisoires** : à remplacer par une icône dessinée (mêmes noms).
- `<link rel="manifest">`, `theme-color` et `apple-touch-icon` sur les 15 pages du jeu
  (pas l'admin ni les pages Nouveautés). `pages/404.html` en chemins absolus, comme le
  reste de cette page servie à n'importe quelle URL.
- `.htaccess` : `AddType application/manifest+json .webmanifest`.

### Polices auto-hébergées

Huit familles Google (Cinzel, Oswald, Playfair Display, Abril Fatface, Special Elite,
Inter, JetBrains Mono, Montserrat) venaient de `fonts.googleapis.com` : deux connexions
tierces bloquantes et un changement de police visible au chargement.

- `scripts/fetch_google_fonts.js` télécharge les woff2 (latin + latin-ext, fichiers
  variables : 18 fichiers, 592 Ko) dans `font/google/` et génère `css/fonts.css`. Une seule
  feuille pour toutes les pages : le navigateur ne télécharge que ce que la page utilise
  (vérifié : 0 requête Google, polices `loaded` sur l'accueil, le profil, la FAQ).
- Cache d'un an `immutable` déjà prévu par `.htaccess` pour `font/`.
- CSP : `fonts.googleapis.com` et `fonts.gstatic.com` retirés de `style-src`/`font-src`.
- Les pages Nouveautés 2.0 → 2.2 sont touchées **uniquement** sur leur lien de police :
  avec la CSP resserrée, elles seraient sinon retombées sur une police de repli.
- `tests/pwa_fonts.test.js` : aucun lien Google ne revient, chaque fichier de `fonts.css`
  existe, la CSP n'autorise plus Google, le manifeste et ses icônes sont valides et liés.

### Angles morts connus

- Pas de bouton « Installer l'app » dans l'interface : on s'appuie sur l'invite du
  navigateur (Chrome/Edge/Android) et sur « Partager → Sur l'écran d'accueil » (iOS).
- `sw.js` garde sa branche « Google Fonts → stale-while-revalidate », désormais inutile
  mais inoffensive : à retirer au prochain passage sur le service worker.

---

## 2026-10-20 — Les erreurs JavaScript des joueurs remontent toutes seules

Les derniers incidents de prod (titres en 500 en 2.2.6, bouton Rejouer disparu en 2.3.3)
sont arrivés par des joueurs. Aucun code ne captait les erreurs du navigateur.

### Client — `js/error_reporter.js`

- Écoute `error` et `unhandledrejection`, installé une fois par page depuis `js/api.js`
  (chargé partout). **Désactivé** sur `localhost` (la console suffit) et sous jsdom.
- Retenue : 5 envois max par page, chaque erreur une seule fois ; bruit écarté (extensions,
  « Script error. » de scripts tiers, boucle ResizeObserver, **réseau coupé** — un joueur
  hors ligne n'est pas un bug).
- Envoie message, fichier/ligne, pile (1 500 car.), **chemin** de la page (sans query
  string ni hash : `?view=` ou un jeton n'en sortent pas), navigateur. Ni saisie, ni
  localStorage, ni identité. `navigator.sendBeacon` : survit à la fermeture de la page.

### Serveur — `api/client_errors.php` + `api/lib/client_errors.php`

- Fichier plat à la racine d'`api/` (pas de dossier homonyme → pas de 301 sur le POST).
- Ouvert aux invités : **limité à 30 / 15 min par IP**, corps re-tronqué champ par champ,
  caractères de contrôle retirés, mêmes filtres de bruit que le client.
- **Empreinte** = message (chiffres neutralisés) + première ligne de pile (`?v=` retiré) :
  même bug chez 200 joueurs et sur deux déploiements = une empreinte. Une empreinte n'est
  écrite dans `error_log` (source `client`, niveau `warning`) et signalée qu'**une fois par
  heure** — via `rate_limits`, même upsert que `rateLimit()`, donc aucune migration.
- Alerte Discord optionnelle (`DISCORD_ERRORS_WEBHOOK`, salon privé) :
  `allowed_mentions: { parse: [] }`, `@` neutralisé — un texte client ne doit jamais pinger.
- Pas de CSRF : rien n'est modifié au nom de l'utilisateur, et `sendBeacon` ne pose pas
  d'en-tête. Réponse 204 dans tous les cas.

### Tests

- `tests/error_reporter.test.js` (bruit, déduplication, plafond, ne lève jamais, chemin
  sans query string) ; `tests/php/ClientErrorsTest.php` (troncature, valeurs non scalaires,
  bruit, empreintes, payload Discord sans mention) ; test d'intégration
  `testClientErrorFingerprintIsNewOncePerWindow` (rate_limits réel).
- PHPUnit n'a pas pu être téléchargé dans mon environnement (`phar.phpunit.de` bloqué) :
  `ClientErrorsTest` a tourné sur un exécuteur minimal local (7/7), le test d'intégration
  tournera en CI.

### Angles morts connus

- La table `error_log` n'a pas de rétention : si une erreur massive passait le filtre, elle
  s'y écrirait une fois par heure et par empreinte — borné, mais à surveiller les premiers
  jours dans l'admin.
- Les erreurs des pages sans `api.js` (FAQ, confidentialité) ne remontent pas.

---

## 2026-10-20 — Série gelée au profil, `?v=` par empreinte de contenu

Trois demandes de Hamza dans un même lot, chacune dans son commit.

### 1. La série cassée s'affiche gelée, avec Jack Frost à portée de clic

**Le bouton Jack Frost du profil ne s'affichait pour personne.** Il testait
`streak === 0`, valeur que le jeu n'écrit jamais après une première partie :

- tant que le joueur n'a pas rejoué, `stats.streak` (local) et `users.global_streak`
  (serveur) gardent l'**ancienne** valeur — le profil affichait « 15 🔥 » pour une série
  morte depuis trois jours ;
- dès qu'il rejoue, `profileStats.js` remet la série à **1** (pas 0) et pose la trace
  `streakRecovery.previousStreak`.

Désormais, `getRecoverableStreak()` (`profile/profile-format.js`, pure, testée) distingue :

- `frozen` — dernière partie avant hier (jours **Paris**, `shiftDateKey`) et série > 1 :
  la tuile passe en glace (🧊, libellé « Série gelée », chiffre conservé — c'est lui que
  Jack Frost rend) ;
- `broken` — le joueur a rejoué, la trace vaut plus que la série actuelle.

Dans les deux cas, sous les stats : le bouton « ❄️ Appeler Jack Frost — retour à N jours »
qui ouvre la pop-up existante, ou, si le cooldown de 60 jours court, « 🧊 Jack Frost se
repose — de retour dans N jours » (`recoveryCooldownDaysLeft()`, `js/streak-recovery.js`).

**Décisions :**

- **Connecté, rien avant le premier pull cloud** (`_statsFromCloud`). Le profil local peut
  dater d'un autre appareil : une série jouée hier ailleurs passerait pour gelée, et un clic
  brûlerait le crédit de 60 jours. L'invité, lui, n'a que son localStorage : affiché dès que
  l'auth est résolue (`_fullCloudSync` re-rend les stats pour lui).
- **`_applyRecoveryLocally()` pose `stats.lastPlayed` à maintenant.** Le serveur date déjà la
  série restaurée d'aujourd'hui (`global_streak_date`). Sans le même jour côté client, une
  série récupérée encore gelée était vue cassée par la partie suivante : remise à 1, nouvelle
  trace Jack Frost. Test d'intégration `performRecovery` → `updateProfileStats`.
- **Le profil écoute `personadle:streak-recovered`** et relit `stats` depuis le localStorage :
  sans ça, la tuile restait gelée après le clic, et le prochain `saveProfile()` réécrivait
  l'ancienne série par-dessus celle que Jack Frost venait de rendre.
- Clé `streak_recovery.profile_btn` réécrite dans les 6 langues (« 0 → N » était faux : la
  série vaut 1 ou l'ancienne valeur, jamais 0) ; ajout de `profile.stat_frozen_streak_label`
  et `streak_recovery.profile_cooldown`.

**Côté serveur : rien à changer.** `personadle_apply_streak_recovery()` fait déjà
`GREATEST(global_streak, ?)` et date d'aujourd'hui ; plafond « jours distincts joués » et
cooldown inchangés.

### 2. `?v=` = empreinte du contenu, posée à la release

`scripts/stamp_assets.js` (+ `npm run assets:stamp` / `assets:check` / `assets:refs`)
remplace `version-all.sh` (supprimé) et les `?v=1`…`?v=21` tenus à la main — la moitié des
balises n'en portait pas. Empreinte = sha256 du fichier, 8 caractères : elle ne change que
si le fichier change, là où un SHA de commit forcerait tout le monde à tout retélécharger à
chaque déploiement.

- **Jamais les specifiers d'`import`, et jamais un module d'entrée importé ailleurs.**
  `x.js?v=a` et `x.js` sont deux modules pour le navigateur : `../../js/api.js`, chargé en
  `<script type="module">` par compendium/friends/leaderboard et importé par tout le reste,
  aurait existé en deux instances (jeton CSRF, utilisateur courant). Le script détecte les
  imports (statiques, dynamiques, ré-exports, `<script type="module">` inline) dans le seul
  code servi — pas `tests/` : un test Vitest qui importe `friends.js` ne crée pas de doublon
  chez le joueur.
- **Tamponné à la release, pas à chaque commit** — sinon deux branches qui touchent
  `global.css` se disputent ~16 pages en conflit. CI : `assets:refs` sur toute PR (aucune
  page ne cite un fichier absent — vérifié : zéro aujourd'hui), `assets:check` seulement sur
  les PR vers `main`. Étape ajoutée à la checklist de `DEPLOY.md` et au guide du mainteneur.
- Les 16 pages sont tamponnées dans ce lot (point de départ).
- **`CACHE_VERSION` de `sw.js` calculé, plus bumpé.** Le même script y pose
  `personadle-<empreinte>`, où l'empreinte couvre chemin + blob git de chaque fichier servi
  en cache-first (images, sons, polices ; hors docs, tests, changelogs). Lue dans l'index
  git (`git ls-files -s`) plutôt qu'en relisant ≈ 1 Go de médias : il faut donc stager les
  médias avant de tamponner, ce que dit la checklist de `DEPLOY.md`. Le piège du §7
  (« Assets périmés après un déploiement ») passe de « penser à bumper » à « rien à faire ».
- **Repli hors ligne de `sw.js` : `ignoreSearch` en second essai.** Le précache stocke
  `global.css`, les pages demandent `global.css?v=…` : hors ligne, le repli de
  `networkFirstWithFallback` ne trouvait rien. Il tente maintenant l'URL exacte, puis la
  même sans query string. Le cache-first, lui, garde la correspondance exacte.

### 3. Outillage local

Le lot ajoutait aussi des fichiers d'outillage de développement local. Ils sont retirés du
dépôt public avec le guide du mainteneur (2026-11-10) : ce lot ne livre que les deux
premiers points.

### Angles morts connus

- Les dépendances d'un module d'entrée ne sont pas versionnées (limite assumée, documentée
  dans le script) : le `no-cache` du `.htaccess` les tient fraîches.
- `index.html` lance toujours la pop-up automatique **uniquement** après la trace
  (`checkStreakRecovery`) : une série gelée ne la déclenche pas à l'accueil — seulement le
  bouton du profil, comme demandé.

---

## 2026-10-20 — Navigation mobile : jouer sans défiler

Demande de Hamza (« pas intuitive, trop de scroll »), déjà signalée le 2026-09-25 pour
Classique et corrigée à moitié en 2.3.1. **Tout mesuré** (Chromium, 360×740 et 390×844) :

| Page | Avant | Après |
|---|---|---|
| Champ de réponse, 6 modes | 781 → 1 221 px, **toujours sous la barre du bas** (782 px) | visible au premier écran partout |
| Accueil, modes au premier écran | 2,5 sur 6 (le 3e masqué par News/Daily + la barre) | 6 sur 6 |
| Profil | 3,3 écrans | 2,6 écrans |

### Modes — `css/mobile_layout.css` (nouveau, ≤ 480 px)

- **La ligne Rejouer | champ | Valider s'ancre au-dessus de la barre du bas**
  (`position: sticky`) : visible quel que soit l'indice au-dessus (silhouette, animation
  AOA, lecteur Musique), sans réordonner le DOM des 6 modes. Classique nomme cette ligne
  `.input-row`, les 5 autres la posent en `<div>` stylé inline, premier enfant de
  `.input-wrapper` — d'où un sélecteur `:is(.input-row, div:first-child)` et des
  `!important` pour battre l'inline.
- Le fond est posé sur la **ligne**, pas sur le wrapper, pour qu'une ligne masquée en fin
  de partie ne laisse pas de bande vide ; `.hidden` reste prioritaire.
- L'autocomplétion s'ouvre **vers le haut** (vers le bas, elle passait sous la barre).
- En-tête compacté : logo à 56 vw, bascule Expert réduite, encart titre moitié moins
  haut, Indice/Abandon à 56 px. Rejouer/Valider : image de 34 px mais cible tactile
  ≥ 44 × 48 px (CLAUDE.md §7).
- Chargée **en dernier** dans le `<head>`, juste avant `</head>` — et pas à côté des
  autres `<link>`, dont les `?v=` bougent dans la PR des tampons d'assets : deux lignes
  voisines modifiées par deux branches = conflit garanti.

### Barre du bas — item « Jouer » (`js/bottomNav.js`, `js/daily_status.js`)

- 5e item (entre Accueil et Classement) qui ouvre une **feuille des 6 modes** avec leur
  état du jour (✓ Joué / À jouer) et le mode courant marqué, plus une pastille
  « N à jouer » sur l'icône. Échap ferme, le focus revient au bouton.
- **Libellés traduits** (`nav.*`, 6 langues) : ils étaient écrits en dur en anglais. Via
  `data-i18n`, que `setLang()` réapplique à tout le DOM — l'événement
  `personadle:i18n-ready` n'existe que sur le profil.
- ≤ 480 px : items en `flex: 1` pour que 5 (6 pour un admin) tiennent en 320 px.

**« Joué aujourd'hui » : la trace `dailyDone_<scope>`**, posée par `markGameLogged()`
(gameCore.js), datée du jour de JEU (`currentGameDay`). Elle survit au Replay, ce que
`gameLogged_*` ne fait pas (`startGame()` l'efface). Repli pour les parties d'avant la
trace : partie armée aujourd'hui et déjà enregistrée. Seule la dimension normale compte.
`MODE_STATS_SCOPE` recopie les portées réelles — **pas de règle commune** (« silhouette »
en minuscules, « AllOut ») : `tests/daily_status.test.js` relit les 6 fichiers de mode.

### Accueil — `js/home_mobile.js`

- Pastille ✓ sur les bannières des modes joués aujourd'hui (toutes tailles).
- ≤ 480 px : grille 2 colonnes, et News / Daily Reset rangés sous le titre
  (`#homeQuickActions`) au lieu de flotter sur les bannières. Le nœud est déplacé (ses
  écouteurs suivent) ; au-delà de 480 px la rangée est en `display: contents` et les deux
  boutons gardent leur position fixe d'origine.

### Profil — `profile/profile_mobile.js`

- Stats en 2 colonnes (la série et les tuiles « full » gardent la largeur, libellés
  autorisés à passer à la ligne).
- Badges, Code événement, Partage, Wallpapers **repliables** d'un tap sur le titre
  (clavier : Entrée/Espace, `aria-expanded`), choix retenu en localStorage. Repliés par
  défaut : Code événement, Partage, Wallpapers. Les stats ne se replient jamais.

### Tests

- `tests/daily_status.test.js`, `tests/home_profile_mobile.test.js`, feuille « Jouer »
  dans `tests/bottomNav.test.js`.
- **E2E `tests-e2e/mobile_input_visible.spec.js`** : pour les 6 modes en 360×740 et
  390×844, le champ est entre le haut de l'écran et la barre, sans défilement, sans
  débordement, et rien ne le recouvre (`elementFromPoint`) ; la feuille « Jouer » mène au
  mode choisi. Lancé en local contre un serveur statique avec
  `classic_mobile_layout.spec.js` (23/23) ; la suite complète tourne en CI.

### Angles morts connus

- Mesures et E2E faits **sans backend** (serveur statique) : un joueur connecté voit en
  plus les bandeaux de défi/notifications, à revérifier sur la préprod.
- Clavier virtuel ouvert : la ligne ancrée suit le bas du *layout viewport* ; sur iOS,
  le clavier peut la recouvrir partiellement pendant la frappe — à vérifier sur un vrai
  iPhone.
- La pastille ✓ ne s'allume qu'à partir de la première partie jouée avec cette version
  (ou d'une partie déjà en cours aujourd'hui, via le repli).

---

## 2026-10-20 — « Partager mon résultat », façon Wordle

Le premier canal d'acquisition d'un jeu « -dle » est la grille d'emojis collée dans un
groupe ; aucun des six modes n'en avait. Le texte ne révèle jamais la cible :

```
PersonaDLE 🔤 Classic — 20/10
🟥🟨🟥🟩🟥🟥🟨
🟩🟩🟩🟩🟩🟩🟩
✅ 2 essais
https://personadle.net
```

Classique partage sa vraie grille (lue dans `#output`, remise dans l'ordre de jeu — les
lignes y sont insérées de la plus récente à la plus ancienne). Les cinq autres modes,
sans grille d'attributs, partagent la suite ❌❌✅ ou 🏳️. Expert est signalé (⚡).
Téléphone : feuille de partage native (`navigator.share`) ; ailleurs : presse-papiers.

### Câblage — zéro appel ajouté dans les modes

Les six modes affichent leur fin de partie chacun à sa façon ; ils ont en commun deux
fonctions de `gameCore.js` :

- `buildGameSession()` écrit `lastGameResult` (portée, identifiant de partie, résultat,
  essais, Expert) — **en synchrone**, pour être là avant le montage du bouton ;
- `revealNextLink()`, appelé en fin de partie **et au rechargement** d'une partie finie,
  monte le bouton par `import("./share_result.js")` — dynamique, car `share_result.js`
  importe `gameCore.js` (un import statique ferait un cycle).

Le bouton n'apparaît que si le résultat retenu porte l'identifiant de la partie affichée
(`gameId_<scope>`) : une partie de défi (non enregistrée) ou un résultat d'hier n'en a
pas. Ni la cible ni les noms proposés ne sont stockés dans `lastGameResult`.

### Angles morts connus

- Une partie terminée **avant** cette version n'a pas de `lastGameResult` : pas de bouton
  jusqu'à la partie suivante.
- La grille de Classique est lue dans le DOM : si la présentation de `#output` change
  (classes `guess-row` / `guess-cell` / `correct|misplaced|wrong`), le test
  `readClassicGrid` le signalera.
- `MODE_ICON` existe aussi dans `js/daily_status.js` (PR navigation mobile) : à fusionner
  une fois les deux PR mergées.
