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
| 8 | `feat/discord_fin_de_partie` | Discord au bon moment : fin de partie, journée 6/6, profil, menu Jouer ; membres en ligne ; modale recentrée — **fait** |
| 9 | `feat/codes_evenement_discord` | Codes événement exclusifs au Discord (badge ou titre) — **fait**, migration 057 |
| 10 | `feat/partage_journee` | Partage « journée complète » des six modes |
| 11 | `feat/prochains_deblocages` | Profil : quêtes Expert et badges les plus proches |
| 12 | `feat/filtre_en_cours_de_partie` | Étape B anti-triche : changer de filtre en cours de partie = abandon, avec avertissement |
| 13 | `feat/accueil_explications` | Une ligne sous chaque mode, slogan à jour, profil invité qui explique le compte, textes anglais restants |
| 14 | `feat/nav_ordinateur` | Ordinateur : navigation en haut, pastilles qui ne masquent plus les bannières, un seul ⚙ par mode |
| 15 | `feat/podium_classement` | Podium animé, évolution ▲▼, « ta place » toujours visible |
| 16 | `feat/classement_quotidien` | Classement principal sur les parties du jour ; comptes hors norme repérés dans l'admin |
| 17 | `docs/readme_anime` | README façon thème GRUB : bannière et citation animées, démo des six modes |
| 18 | `chore/menage_depot` | Fichiers inutiles retirés, trois documents de planification fusionnés, identifiant Hostinger retiré des fichiers suivis |

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
