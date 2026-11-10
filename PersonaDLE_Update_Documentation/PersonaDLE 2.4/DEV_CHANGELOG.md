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
| 8 | `feat/discord_fin_de_partie` | Discord au bon moment : fin de partie, journée 6/6, profil, menu Jouer ; membres en ligne ; modale recentrée |
| 9 | `feat/codes_evenement_discord` | Codes événement exclusifs au Discord (badge ou titre) |
| 10 | `feat/partage_journee` | Partage « journée complète » des six modes |
| 11 | `feat/prochains_deblocages` | Profil : quêtes Expert et badges les plus proches |
| 12 | `feat/filtre_en_cours_de_partie` | Étape B anti-triche : changer de filtre en cours de partie = abandon, avec avertissement |
| 13 | `feat/accueil_explications` | Une ligne sous chaque mode, slogan à jour, profil invité qui explique le compte, textes anglais restants |
| 14 | `feat/nav_ordinateur` | Ordinateur : navigation en haut, pastilles qui ne masquent plus les bannières, un seul ⚙ par mode |
| 15 | `feat/podium_classement` | Podium animé, évolution ▲▼, « ta place » toujours visible |
| 16 | `feat/classement_quotidien` | Classement principal sur les parties du jour ; comptes hors norme repérés dans l'admin |
| 17 | `docs/readme_anime` | README façon thème GRUB : bannière et citation animées, démo des six modes |
| 18 | `chore/menage_depot` | Fichiers inutiles retirés, trois documents de planification fusionnés, identifiant Hostinger retiré des fichiers suivis |

Hors dépôt du jeu (`personadle-discord`) : Aigis (livré le 2026-11-09), sauvegardes hors
site, préprod accessible par Tailscale, page de statut publique.

### Décisions ouvertes

- **Thème visuel de la 2.4** (palette de la page joueur et du bandeau d'accueil) : pas encore
  choisi — la page joueur reprend pour l'instant la palette de la 2.3.
- **« Puzzle commun du jour »** (une cible identique pour tous) : idée validée sur le
  principe, à cadrer avant d'en faire un lot — reportée à la 2.5 avec la salle à part
  (Archives de Velvet, Cognition) et l'OAuth Discord.

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
