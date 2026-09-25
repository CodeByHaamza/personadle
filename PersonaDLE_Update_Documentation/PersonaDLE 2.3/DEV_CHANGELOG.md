# Changelog technique — PersonaDLE v2.3

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE 2.3/PersonaDLE_Update.html` reste le changelog **joueur** —
> highlights uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur si elle
> est réellement visible/parlante côté joueur.
>
> Les entrées de la v2.2 (livrée) et des versions antérieures restent dans leurs
> dossiers respectifs — elles ne sont pas recopiées ici.

---

## Périmètre de la version

La 2.3 est **la mise à jour Kotone Shiomi** : son ajout dans P5X sert de fil rouge, et
la page Nouveautés porte sa palette (Pink Ribbon) à la place du rouge Phantom Thieves
de la 2.2.

Découpage en lots — une branche, une PR vers `develop` par ligne :

| Lot | Branche | Contenu |
|---|---|---|
| 0 | `chore/open-2-3` | Ouverture de la version (ce document) |
| 1 | `fix/classic_age_60_plus` | Tranche d'âge `60+` absente du barème de comparaison |
| 2 | `fix/settings_modal_save_visible` | Bouton « Sauvegarder » hors champ dans les paramètres |
| 3 | `feat/aoa_p5x_variants` | All-Out Attack Luce Notte et Soy Pioneer |
| 4 | `feat/avatars_gallery_p5x` | Nouveaux portraits de la galerie |
| 5 | `fix/classic_elisabeth_thanatos` | Elisabeth devient utilisatrice de persona |
| 6 | `feat/avatars_animated_tab` | Onglet « Animés » de la galerie + 6 portraits animés |
| ~~7~~ | ~~`feat/avatar_frames`~~ | ~~Contours de profil ornementés~~ — **abandonné** |
| 8 | `feat/social_link_xp_uncapped` | XP de Social Link sans plafond |
| 9 | `feat/leaderboard_friendship_tab` | Onglet Amitié du classement |
| 10 | `feat/badges_reorder_dnd` | Réordonnancement des badges au glisser-déposer |
| 11 | `feat/badge_inspect` | Inspection d'un badge sans l'équiper |
| 12 | `feat/admin_unlock_picker` | Sélection et retrait de déblocages côté admin |
| 13 | `feat/changelog_2_3_pink_ribbon` | Remplissage de la page Nouveautés |
| 14 | `feat/badges_pin_ux` | Badges épinglés : clic vers la fiche, aperçu du déplacement |
| 15 | `feat/aoa_kotone_p5x` | All-Out Attack de Kotone (P5X) et nouveau portrait |
| 16 | `fix/badge_modal_prod` | Le détail d'un badge reprend la modale de la production |

---

## 2026-09-25 — « Sun » et les graphiques d'allègement dans le changelog joueur

Deux manques signalés par Hamza sur la page 2.3 : la musique ajoutée au mode Musique n'y
figurait nulle part, et le travail d'optimisation n'y était pas montré.

### « Sun » n'était listé que côté dev

La piste avait son entrée dans ce fichier depuis le 2026-09-24, mais **pas** dans la page
joueur — alors que la règle (CLAUDE.md §9) veut que tout nouveau contenu y soit listé. Elle
a maintenant sa section, avec la précision qui compte pour le joueur : instrumentale, donc
jouable en Musique mais **pas** en Mode Expert, où l'on devine par les paroles.

### Trois graphiques, en CSS pur

Pas de bibliothèque de graphiques : ce serait ajouter des dizaines de kilo-octets de
JavaScript à une page dont le sujet est précisément le poids téléchargé. Les barres sont
dimensionnées par une variable CSS `--pct`.

| Mesure | 2.2 | 2.3 |
|---|---|---|
| Ouvrir sa page de profil | 125,6 Mo | **13,5 Mo** |
| Une partie d'All-Out Attack, au pire | 80,2 Mo | **3,2 Mo** |
| Toutes les animations du mode | 1 782 Mo | **397 Mo** |

Ce sont des relevés, pas des estimations : les deux premiers viennent du `transferSize` de
l'API Performance sur un écran de 390 px, le troisième d'un `ls` sur le dossier.

### Deux choses qui auraient cloché sans y regarder

- **Le chiffre est écrit à côté de sa barre, pas seulement dessiné.** Un graphique qui
  serait la seule source de la mesure ne dirait rien à un lecteur d'écran.
- **Les valeurs étaient hors des blocs de langue.** Un lecteur anglais aurait lu
  « 1 782 Mo » — virgule et unité françaises. Le script d'i18n bascule n'importe quel
  élément portant l'attribut, y compris un `span` : chaque valeur existe donc en deux
  versions, `1 782 Mo` et `1,782 MB`.

### Vérifications

Rendu dans un vrai navigateur en 1280 px et 390 px. Contrôlé que les barres ont une largeur
**réelle** et proportionnelle (706 px → 76 px pour 10,7 %, → 28 px pour 4 %, → 157 px pour
22,3 %) : une animation figée à zéro aurait donné trois cadres vides sans lever la moindre
erreur. Contrôlé aussi qu'une seule unité est visible à la fois — FR et EN ne s'empilent
pas. Aucune erreur console. L'animation des barres est neutralisée sous
`prefers-reduced-motion`.

---
## 2026-09-25 — Le détail d'un badge reprend la modale de la production

Retour Hamza : la 2.3 a ajouté des façons de consulter un badge (l'œil de l'atelier, le
clic sur un badge épinglé), mais elles ouvraient **une autre fenêtre** que celle qui tourne
en prod. C'est celle de la prod qui reste.

### Deux fenêtres pour la même information

La prod affiche déjà une `.badge-zoom-modal` — au déblocage d'un badge, sur le profil
public (`profile-view.js`) et sur la carte de partage (`share-card.js`). Le lot
`feat/badge_inspect` en avait dessiné une seconde (`.badge-inspect__*`), plus sobre. Selon
le chemin emprunté, le même badge s'affichait donc dans deux habillages différents.

Ce n'était pas un oubli mais une mauvaise décision : j'avais écrit une fiche neuve sans
regarder ce que la prod montrait déjà. Le défaut ne se voit qu'en comparant deux écrans —
exactement le genre de chose qu'une revue attrape et pas un test.

### Une seule implémentation

`ouvrirFiche()` produit désormais le balisage de prod, et `showBadgeZoom()`
(`badgesManager.js`) **passe par elle** au lieu d'avoir sa propre copie :

| Chemin | Avant | Après |
|---|---|---|
| Déblocage d'un badge | `showBadgeZoom()`, copie locale | `ouvrirFiche()` |
| Œil de l'atelier (2.3) | `.badge-inspect__card` | `ouvrirFiche()` |
| Clic sur un badge épinglé (2.3) | `.badge-inspect__card` | `ouvrirFiche()` |

`profile-view.js` et `share-card.js` gardent leur propre `showBadgeZoom` : elles tournent
sur d'autres pages, avec leurs propres listes de badges, et produisent **déjà** ce
balisage. Les unifier demanderait de leur faire importer `badgesManager`, ce qui coûte plus
que ça ne rapporte tant qu'elles ne divergent pas.

### Ce que le balisage de prod ne savait pas dire

La prod n'ouvrait cette modale qu'après un déblocage, donc **toujours sur un badge obtenu**.
L'œil rend consultable un badge verrouillé, état qu'aucune de ses lignes n'exprimait : sans
rien, un badge non gagné s'afficherait exactement comme un badge gagné.

Deux ajouts, aussi discrets que possible plutôt qu'une section de plus :

- `🔒` devant la condition ;
- `.badge-zoom-content img.is-locked` — l'image en niveaux de gris, comme sa carte dans la
  grille.

Le reste est identique : conteneur, croix, ordre image / titre / condition / description,
et la classe `.show` posée à la frame suivante pour l'animation d'entrée.

Ce qui est conservé du lot 2.3, parce que la prod n'en avait pas besoin et que ces chemins
si : `role="dialog"`, `aria-modal`, le focus posé sur la croix, la fermeture à Échap (qui
arrête sa propagation pour ne pas refermer AUSSI la modale des badges derrière), et la
croix activable au clavier.

`construireFiche()` ne bouge pas : un badge secret verrouillé continue de ne montrer ni son
nom ni sa condition. Sans cette règle, l'œil serait devenu un moyen commode de lire toutes
les réponses.

### Fichiers touchés

- `profile/badges/badge_inspect.js` — `ouvrirFiche()` rend le balisage de prod.
- `profile/badges/badgesManager.js` — `showBadgeZoom()` délègue ; sa copie de la modale
  disparaît.
- `profile/badges/badges.css` — les règles `.badge-inspect` / `.badge-inspect__*` sont
  retirées (≈ 70 lignes), remplacées par la seule `img.is-locked`. Le bouton œil
  (`.badge-inspect-btn`) reste : c'est un élément de la grille, pas de la modale.
- `tests/badgeInspect.test.js` — sélecteurs mis à jour, **2 cas ajoutés** : le balisage est
  bien celui de prod et plus aucune classe `badge-inspect__` n'existe ; le cadenas
  n'apparaît que sur un badge verrouillé.
- `tests-e2e/badge_inspect.spec.js`, `tests-e2e/badges_reorder.spec.js` — sélecteurs.

### Vérifications

- 8 scénarios E2E des deux fichiers verts, `npm test` à 1520.
- Rendu comparé à l'écran, en 1280 px et 390 px, dans les deux états : badge débloqué
  depuis la rangée épinglée, badge **verrouillé** depuis l'œil de l'atelier.
- Le test « emploie la modale de PRODUCTION » échoue si une fiche maison revient : il
  vérifie l'absence de toute classe `badge-inspect__`, pas seulement la présence de
  `.badge-zoom-modal`.

---
## 2026-09-25 — Une seule Kotone en All-Out Attack, rangée dans P3P

Décision de Hamza, qui revient sur celle de l'entrée précédente : l'ancienne animation
disparaît, la version *Persona 5: The Phantom X* devient **la** Kotone du mode, et elle
reste dans la catégorie **P3P**.

### Pourquoi c'était discutable, et pourquoi il a raison

L'entrée précédente en gardait deux, sur le modèle d'« Aigis ( P3FES ) ». La différence,
c'est qu'Aigis a deux apparences distinctes : la P3FES est reconnaissable. Kotone, non —
c'est le même personnage, le même uniforme, la même naginata, dans deux moteurs différents.
Deux entrées sous « Kotone Shiomi » et « Kotone Shiomi ( P5X ) », avec **le même portrait**
depuis que le portrait P5X a remplacé l'ancien partout, auraient surtout produit une paire
que rien ne distingue à l'œil au moment de répondre.

### Ce que ça change

| | Avant ce correctif | Après |
|---|---|---|
| Entrées | `Kotone Shiomi` (P3P) + `Kotone Shiomi ( P5X )` (P5X) | **`Kotone Shiomi`** (P3P) |
| `gif` | `Kotone` + `Kotone_P5X` | **`Kotone`** |
| Pool `alloutattack` | 78 | **77** |

### Les fichiers gardent le nom `Kotone`

Un personnage, un fichier — ici comme sur le CDN (demande de Hamza). Les trois assets du
lot précédent sont donc **renommés** et écrasent ceux de l'ancienne animation :

| Fichier | Avant | Après |
|---|---|---|
| `allOutAttack/Kotone.webp` | 67 Mo, 1920 × 1080 | **2,4 Mo**, 800 × 450 |
| `img/Kotone.webp` | rendu P3P pleine hauteur, 640 × 1947 | buste P5X, 640 × 680 |
| `img/Kotone_Battle.webp` | illustration P3P | render P5X à la naginata |

Les 67 Mo étaient le calibre des entrées P3, dix fois plus lourdes que celles de P5X
(cf. entrée précédente). Les anciennes versions restent dans l'historique git ; c'est
l'arbre de travail qui s'allège.

> ### ⚠️ Conséquence directe sur le déploiement
>
> `Kotone.webp` **existe déjà sur R2, avec l'ANCIENNE animation** (vérifié : 200). Le
> téléversement n'est donc pas un ajout mais un **écrasement**, et son oubli ne se voit
> pas : en production, le mode servirait l'ancienne vidéo, sans erreur ni image manquante.
>
> C'est le prix assumé du nom unique. Un nom neuf aurait donné une image qui ne charge
> pas — visible immédiatement — mais deux fichiers pour un personnage.
>
> À vérifier après téléversement : le poids servi par le CDN doit être de ~2,4 Mo, pas
> de 67 Mo.

### Détails

- `aoaCharacters.js` — l'entrée P3P garde `gif: "Kotone"`, le bloc de collaboration P5X
  est retiré.
- `portraitsMap.js` — la ligne suffixée saute, `"Kotone Shiomi"` pointe toujours sur
  `Kotone`.
- `personas_allOut.js` — le nom suffixé saute, donc n'est plus proposé à la saisie.
- `api/data/daily_pools.json` — régénéré, `alloutattack` 78 → **77**.
- `PersonaDLE_Update.html` — la section ne parle plus de trois *attaques* ajoutées mais de
  trois nouvelles **animations** : celle de Kotone en remplace une, les deux autres non. La
  carte porte le badge `P3P` (celui du filtre, comme les autres cartes) et non `P3P × P5X`.

### Inchangé

Le portrait P5X reste celui de Kotone dans tout le jeu, et les modes Classique, Émoji,
Silhouette et Personae ne sont pas concernés : ils ont leurs propres entrées Kotone, qui
n'ont jamais été dupliquées.

---
## 2026-09-25 — Les badges épinglés se consultent, et on voit où ils tombent

Deux retours de Hamza sur la rangée de badges de la page profil, tous deux sur le
même geste : **« si je clique sur un badge sélectionné, je devrais quand même voir
le détail »** et **« quand je déplace les badges c'est pas intuitif, je veux le badge
transparent là où il sera, ça fait trop vide »**.

### Cliquer un badge épinglé ouvre sa fiche

Le clic sur une case épinglée ne faisait **rien du tout** : `renderBadgesPreview()`
posait bien un `dataset.badgeId` sur l'image, mais aucun gestionnaire. Pour relire la
condition d'un de ses propres badges, il fallait rouvrir l'atelier, retrouver le badge
dans la grille et cliquer son œil.

Le rappel est branché dans `initBadgeReorder()` et nulle part ailleurs, parce que c'est
le seul endroit qui sait distinguer un **clic** d'un **glissement** : les deux
commencent par le même `pointerdown`, et seul le seuil de 6 px les sépare. Un
`click` posé à côté se déclencherait aussi à la fin d'un déplacement.

`badgesManager.js` gagne `ficheBadge(profile, id)`, partagé avec l'œil de la grille :
les deux chemins ouvrent désormais la **même** fiche (`ouvrirFiche()` de
`badge_inspect.js`) à partir de la même construction, au lieu de deux copies destinées
à diverger au premier champ ajouté. Ce helper compare les identifiants en chaîne — ils
arrivent du DOM (`dataset`) alors que `badgesList` les porte en nombre.

Entrée et Espace ouvrent la fiche au clavier, comme le clic.

### L'aperçu : le badge reste dans la rangée, à sa future place

La première version (lot 10) sortait le badge saisi du regard — opacité, léger
agrandissement — et faisait s'écarter la case survolée. Résultat : un trou, et une
intention à deviner.

Les cases se **réorganisent maintenant en direct** dans le DOM dès que le pointeur
passe sur un voisin. Le badge saisi reste affiché, estompé et cerclé de pointillés,
exactement là où il atterrira. La rangée montre à tout instant l'ordre qu'elle aura si
on relâche — plus de trou. Conséquence assumée : pendant le geste, l'ordre du DOM ne
correspond plus à `profile.selectedBadges` ; c'est le DOM qui fait foi au relâchement,
et un glissement annulé se répare par un simple rendu (d'où le `onOrdreChange` même
quand l'ordre n'a pas changé — sinon la rangée resterait dans son état d'aperçu).

### Deux pièges rencontrés, et pourquoi ils ne se voyaient pas

**1. Une case animée ment sur sa position.** Le décalage des voisins est animé par un
`transform` (technique FLIP : on mesure avant, on remet chaque case à son ancienne
place, on relâche à la frame suivante). Or `getBoundingClientRect()` **inclut** les
transformations : pendant la transition, une case répondait encore depuis son ancien
emplacement, le badge saisi « retombait » dessus, et la rangée oscillait d'un
mouvement de souris à l'autre.

Le code ne relit donc plus les positions à chaque mouvement : il relève les
**emplacements** une fois au début du geste et demande au DOM qui occupe le n-ième.
C'est aussi plus juste conceptuellement — pendant un glissement, ce sont les occupants
qui changent de place, pas les emplacements, dont ni le nombre ni la taille ne bougent.

**2. Déplacer l'élément saisi lui fait perdre le pointeur.** Réorganiser le DOM
déplace le badge saisi, ce qui **relâche implicitement la capture du pointeur**. Le
`pointerup` arrivait alors sur le badge survolé, et les écouteurs posés sur la case
saisie ne le voyaient jamais : glissement perdu, rien de sauvegardé, **aucune erreur**.
Les écouteurs `pointermove`/`pointerup`/`pointercancel` vont donc sur la fenêtre, et
la capture explicite disparaît (elle ne servait qu'à compenser ce que la fenêtre fait
déjà mieux).

Ces deux bugs ne se voyaient qu'à la **souris** : au doigt, la capture est implicite,
et le test tactile passait. Sans le test souris déjà présent, la régression partait en
production sur le geste le plus courant.

### Fichiers touchés

- `profile/badges/badges_reorder.js` — `onClic`, aperçu en direct, `emplacements()` /
  `emplacementSous()` en remplacement de `caseSous()`, `animerDecalages()` (FLIP),
  écoute au niveau fenêtre.
- `profile/badges/badgesManager.js` — `ficheBadge()` partagé, branchement du clic.
- `profile/badges/badges.css` — `.pin-slot--dragging` (transparence + pointillés) à la
  place du soulèvement, `.pinned-slots--dragging` estompe les voisins et neutralise la
  case « + » pour qu'elle ne passe pas pour une destination.
- `tests/badgesReorder.test.js` — 9 cas de plus (19 au total) : clic contre glissement,
  micro-tremblement sous le seuil, ✕ non capté, ordre du DOM **pendant** le geste,
  traversée de plusieurs cases, retour à la place de départ, badge unique, clavier.
- `tests-e2e/badges_reorder.spec.js` — 2 scénarios de plus : la fiche s'ouvre depuis la
  rangée sans rien modifier, et le badge est bien visible/estompé à sa future place
  **pointeur encore enfoncé**.

### Angles morts connus

- Les emplacements sont relevés au début du geste : un défilement de page à la molette
  **pendant** un glissement les périme. Le geste cesse alors de suivre jusqu'au
  relâchement, qui reste correct. `touch-action: none` empêche déjà le cas tactile.
- La case « + » est estompée mais pas une cible : déposer dessus revient à ne rien
  faire, ce qui est le comportement attendu, mais rien ne le dit explicitement.

---

## 2026-09-25 — Kotone Shiomi entre en All-Out Attack, et change de portrait partout

> **Révisé le jour même** — la décision « deux entrées » ci-dessous a été annulée par
> Hamza. Voir l'entrée « Une seule Kotone en All-Out Attack » plus haut. Le reste de
> cette entrée (encodage, portrait, carte du changelog) reste valable.

Elle est arrivée en jeu la veille : *Persona 5: The Phantom X* version 4.10 l'ajoute en
personnage **5 étoiles**, avec son propre All-Out Attack et le remix jazz de
« Wiping All Out ». C'est la mise à jour dont la 2.3 porte le nom, donc elle passe
**en tête** de la page Nouveautés, devant Luce Notte et Soy Pioneer.

### Une entrée de plus, pas un remplacement

L'animation existante (`Kotone.webp`, opus `P3P`) est son All-Out Attack **de Persona 3** :
naginata, décor bleu, style Reload. Celle du lot est une autre attaque, dans un autre jeu.
Les deux restent devinables séparément, comme tous les skins depuis `Wonder Summer`.

Reste le nom, qui est ce que le joueur tape. Contrairement aux Phantom Idols, **une unité
de collaboration n'a pas de nom de code** — vérifié avant d'en inventer un : la presse et
les guides ne la désignent que par « Kotone Shiomi » (le nom « Wiping All Out » est celui
du morceau, pas de l'unité). Son nom étant déjà pris par son entrée P3P, les deux sont
séparées par le suffixe d'opus, sur le modèle d'**« Aigis ( P3FES ) »** — même personnage,
autre jeu, autre attaque :

| Entrée | `gif` | Opus |
|---|---|---|
| `Kotone Shiomi` (existante) | `Kotone` | `P3P` |
| **`Kotone Shiomi ( P5X )`** | `Kotone_P5X` | `P5X` |

### Le nouveau portrait remplace l'ancien partout

Demande de Hamza : le portrait P5X devient celui de Kotone **dans tout le jeu**, pas
seulement sur sa nouvelle entrée. Il écrase donc les deux fichiers existants :

- `database/portraits/Kotone.webp` — mode Classique, Émoji et lignes d'essai du mode
  Silhouette (tous passent par `database/portraitsMap.js`, qui la mappe sur `Kotone`) ;
- `allOutAttackMode/database/img/Kotone.webp` — l'entrée P3P du mode All-Out Attack.

L'ancien était le rendu officiel P3P pleine hauteur (640 × 1947) ; le nouveau est un buste
(640 × 680). Les portraits n'ont **pas** de format imposé dans ce dépôt — ils vont de
832 × 652 à 1000 × 1451 — donc rien à recadrer. La silhouette (`Kotone_silhouette`) n'est
pas touchée : c'est une image dérivée, pas un portrait.

### Encodage de l'animation

Source : la vidéo de présentation 5 étoiles livrée par Hamza, 1920 × 1080, 60 fps, 6,1 s.

Réencodée sur le **calage des entrées P5X** (`Luce_Notte`, `Soy_Pioneer`) : 800 × 450,
20 fps, `libwebp` q=65 — et surtout pas sur celui des entrées P3, qui datent d'avant et
pèsent 70 à 80 Mo pièce en 1080p (`Kotone.webp` fait 67 Mo à lui seul).

| Fichier | Dimensions | Images | Poids |
|---|---|---|---|
| `Luce_Notte.webp` (2.3) | 800 × 450 | 132 | 4,9 Mo |
| `Soy_Pioneer.webp` (2.3) | 800 × 450 | 149 | 5,7 Mo |
| **`Kotone_P5X.webp`** | 800 × 450 | 107 | **2,4 Mo** |

Les 0,8 première seconde sont coupées : la vidéo source commence sur la boîte de dialogue
d'un boss (« Accept the consequence of your resistance! »), qui n'a rien à faire dans
l'image à deviner et aurait bouclé en plein milieu de l'attaque.

### Fichiers touchés

- `allOutAttackMode/database/allOutAttack/Kotone_P5X.webp` — l'animation. *(Renommée en
  `Kotone.webp` par l'entrée suivante, comme les deux fichiers ci-dessous.)*
- `allOutAttackMode/database/img/Kotone_P5X.webp` et `Kotone_P5X_Battle.webp` — le portrait
  et l'illustration de fin (`Kotone_p5x_render.webp` livré).
- `allOutAttackMode/database/img/Kotone.webp`, `database/portraits/Kotone.webp` —
  **remplacés** par le nouveau portrait.
- `aoaCharacters.js`, `portraitsMap.js`, `personas_allOut.js` — les trois tables. Les deux
  dernières sont celles dont l'oubli ne lève rien : sans `portraitsMap` pas de portrait,
  sans `personas_allOut` le personnage n'est jamais proposé à la saisie, donc injouable.
- `api/data/daily_pools.json` — régénéré : `alloutattack` 77 → **78**.
- `PersonaDLE 2.3/PersonaDLE_Update.html` — section AOA passée de deux à trois attaques,
  Kotone en première position, carte `.aoa-card-kotone` : rose de l'écran « THAT'S A
  WRAP! », brassard S.E.E.S. en bas de carte, papillons de Nyx en bleu (le seul froid de
  la carte, en contrepoint). Couleurs fixées dans les **deux** thèmes, comme Notte et
  Pioneer — le sujet de la carte est justement cet aplat rose saturé.

### Vérifications

- Autocomplétion du mode contrôlée dans un vrai navigateur : les deux Kotone sont
  proposées, chacune avec **son** portrait, aucune requête en échec.
- `tests/content_aoa_skins_2_3.test.js` (garde-fou général du lot 3) passe : les trois
  fichiers existent pour tout le roster, aucun nom ni `gif` en double, et l'animation est
  réellement animée — chunk `ANIM` présent, 107 images `ANMF`.
- Carte du changelog rendue à 1280 px et à 390 px, les trois images chargent.

### ⚠️ À faire avant la release

L'animation doit être **téléversée sur R2** (`allOutAttack/`). En production, le mode ne lit
pas le fichier du dépôt : `cdn()` bascule sur le CDN Cloudflare. *(Elle s'appelle
`Kotone.webp` depuis l'entrée suivante, qui écrase donc l'ancienne — voir l'avertissement
de déploiement qui s'y trouve.)*

Vérifié à l'instant sur le CDN — et `Luce_Notte.webp` **manque toujours** :

| Fichier | CDN |
|---|---|
| `Soy_Pioneer.webp` | 200 |
| `Kotone.webp` | 200 |
| `Luce_Notte.webp` | **404** |
| `Kotone.webp` (nouvelle animation) | à écraser |

---
## 2026-09-24 — L'entrée 2.3 du modal « Nouveautés »

Demande Hamza. C'est le seul endroit où un joueur découvre ce qui a changé sans
quitter l'accueil, et il ne renvoie vers la page complète qu'ensuite.

### Thème Pink Ribbon

`.pink-ribbon-theme`, sur le modèle des thèmes existants (`velvet-theme`,
`cny-theme`…) : le rose du ruban de Kotone (#c9184a → #7a0e3c), et **le bleu du
papillon de Nyx en liseré au survol** — seule note froide d'une palette
entièrement rose, et ce qui l'empêche d'être mièvre. Mode sombre inclus.

Même palette que `PersonaDLE 2.3/PersonaDLE_Update.html`, pour que le joueur qui
clique « Voir le changelog complet » reste dans le même univers.

### Contenu

Sept points, dans les **six langues** — ce que le joueur VOIT, pas la liste des
commits. Les correctifs d'outillage n'y sont pas ; en revanche la perte des
badges épinglés sur un second appareil y figure, parce qu'un joueur a pu la
subir sans comprendre.

Placée en TÊTE de l'accordéon, comme chaque version l'a été avant elle.

### Vérification

Rendu contrôlé en navigateur, **clair et sombre** : l'entrée s'ouvre, les
7 puces s'affichent, 12 blocs par langue (titre + date + contenu), structure
équilibrée (267 `div`).

---

## 2026-09-24 — Le classement des amitiés a son podium

Retour Hamza : « le top 3 est trop petit, on devait faire comme pour les autres
rankings ».

### J'avais tranché dans le mauvais sens

Le lot 9 n'avait **pas** de podium, délibérément — j'avais écrit qu'« un top 3 en
marches vient récompenser des individus, et ce classement n'en récompense
aucun ».

C'était un raisonnement sur le principe, pas sur ce que le joueur voit. À
l'écran, l'écart de traitement avec les autres classements saute aux yeux : deux
dimensions ont un podium, la troisième non, sans raison apparente. Et une amitié
au sommet mérite la même mise en avant qu'un joueur.

### Ce qui a été fait

`renderBondsPodium()` — même forme que le podium des joueurs (2 — 1 — 3, la
première marche plus haute, mêmes couleurs de médaille) mais **deux visages par
carte**, le lien au centre, les deux pseudos et l'XP.

Écrit à part de `renderPodium()` plutôt que paramétré, pour la même raison que
`renderBonds()` : une carte d'amitié n'a pas le même contenu, et fondre les deux
aurait demandé une branche à chaque ligne.

### Un défaut attrapé en capturant à 390 px

J'avais dimensionné les visages en **supposant** que les cartes passaient en
colonne sous 480 px. Elles n'y passent pas : le podium garde ses trois colonnes,
une carte fait alors ~95 px de contenu, et deux avatars de 50 px **débordaient
par-dessus ses bordures**.

Corrigé à 30 px (38 px sur la première marche), cœur et pseudos réduits en
proportion. Le test E2E mesure désormais les rectangles : aucun visage ne doit
sortir de sa carte. Invisible en test unitaire — jsdom ne calcule pas les tailles.

### Fichiers touchés

- `profile/leaderboard/leaderboard.js` — `renderBondsPodium()` + branchement
- `profile/leaderboard/leaderboard.css` — podium d'amitiés, desktop et mobile
- `tests-e2e/leaderboard_bonds.spec.js` — +2 cas : 3 marches et 6 visages, la
  première plus grande que la deuxième, et aucun débordement à 390 px

---

## 2026-09-24 — « Sun » (Persona 3 Portable) entre en mode Musique

Piste fournie par Hamza. Titre confirmé sur la source (« Persona 3 Portable:
Sun ») plutôt que déduit du nom de fichier : un titre approximatif serait une
mauvaise réponse dans un jeu de devinette.

### Instrumentale : jouable en Musique, PAS en Expert

`vocalist: ""`, comme *Aria Of The Soul*. Le mode Expert fait deviner une chanson
par ses **paroles** (`musicsMode/database/expert_lyrics.js`) : une piste sans
paroles y serait une cible impossible à trouver.

Rien à faire pour l'exclure — le pool Expert se dérive des paroles
(`songs.filter((s) => expertLyrics[s.titre])` dans `scripts/export-daily-pools.js`),
donc une chanson sans entrée dans `expert_lyrics.js` en sort d'elle-même.
Vérifié après régénération : `music` 99 → **100**, `music_expert` inchangé à
**78**.

C'est la règle déjà notée pour `expert_mode_content.md` : les instrumentales sont
des absences VOULUES du contenu Expert, pas des oublis.

### Vérification

Fichier servi en `audio/mpeg` (200, 812 Ko) et **décodé par le navigateur**
(34 s) — un mp3 corrompu passerait les tests unitaires sans broncher et ne se
verrait qu'en jouant.

### Angle mort repéré au passage — à traiter à part

`musicsMode/database/musicTitles.js` a **18 entrées de retard** sur `songs.js`
(Danger Zone, Soul Phrase, Time, Wait and See… et Sun). Sans conséquence pour le
joueur : `modeMusic.js` lit `songs.js` directement, et c'est lui qui alimente la
saisie.

Mais **deux tests** s'appuient dessus, dont un qui affirme littéralement
« est devinable (présente dans musicTitles.js) » — l'affirmation porte sur un
fichier que le jeu ne lit pas. Deux sources de vérité dont une dérive depuis
longtemps, et un test qui vérifie la mauvaise. À nettoyer dans son propre lot :
soit `musicTitles.js` disparaît, soit il est généré depuis `songs.js`.

### Fichiers touchés

- `musicsMode/database/music/song/Sun.mp3` — la piste
- `musicsMode/database/songs.js` — l'entrée, commentée sur le pourquoi du
  `vocalist` vide
- `api/data/daily_pools.json` — régénéré (`npm run pools:build`)

---

## 2026-09-24 — `musicTitles.js` supprimé : une seule liste de chansons

Repéré en ajoutant « Sun ».

### Le problème

`musicsMode/database/musicTitles.js` doublait la liste des chansons et avait fini
avec **18 entrées de retard** sur `songs.js` — Danger Zone, Soul Phrase, Time,
Wait and See, et d'autres livrées depuis longtemps.

Sans conséquence pour le joueur : `modeMusic.js` construit son autocomplétion
depuis `originalSongs` (c'est-à-dire `songs.js`), et n'a jamais lu l'autre
fichier. Personne ne pouvait donc voir la dérive.

Mais **deux tests** s'appuyaient dessus, dont un qui affirmait littéralement
« est devinable (présente dans musicTitles.js) ». L'affirmation portait sur un
fichier que le jeu ne lit pas : une chanson pouvait être « devinable » selon le
test et absente du jeu, ou l'inverse.

### Le correctif

Les deux tests consultent désormais `songs.js` — ce que le jeu lit réellement —
et `musicTitles.js` est supprimé. Rien d'autre ne l'importait (vérifié sur tout
le dépôt, `.js`, `.html`, `.json`, `.mjs`).

Deux garde-fous ajoutés dans `tests/contentP4AU.test.js` :

- **`songs.js` est la seule liste de chansons du dépôt** — le fichier ne doit pas
  réapparaître. Une liste parallèle finit toujours par diverger en silence.
- **Aucun titre en double** — le titre est la CLÉ : la réponse du joueur, l'entrée
  d'`expertLyrics`, le nom dans les ensembles de badges. Deux entrées de même
  titre rendraient le comportement dépendant de laquelle est trouvée en premier.

### Fichiers touchés

- `musicsMode/database/musicTitles.js` — **supprimé**
- `tests/contentP4AU.test.js` — cible corrigée, +2 garde-fous
- `tests/unlocks_wonder_shujin.test.js` — cible corrigée

---

## 2026-09-24 — Ouvrir son profil coûtait 125 Mo sur mobile

Mesuré en vérifiant le poids des portraits animés du lot 6 — qui, eux, ne
posaient aucun problème.

### Ce qui se passait

Sur un écran de 390 px, ouvrir `/profile/profile.html` transférait **125,6 Mo** :

| Dossier | Images | Transféré |
|---|---|---|
| `profile/badges/images` | 61 | **85,9 Mo** |
| `profile/Wallpaper/unlockable` | 7 | 28,5 Mo |
| `img/avatar` | 110 | 11,1 Mo |

La grille de la modale des badges est rendue dans le DOM **dès le chargement de
la page**, et son `<img>` n'avait pas `loading="lazy"` — contrairement à celui de
la rangée des badges épinglés, juste au-dessus dans le même fichier. Les 73
images partaient donc alors que la modale était **fermée**, et qu'elle ne serait
peut-être jamais ouverte.

Sur un forfait mobile, consulter son profil coûtait plus de 100 Mo. Invisible en
développement : le cache local et la fibre l'effacent complètement.

### Le correctif

`loading="lazy"` et `decoding="async"` sur la grille. **125,6 Mo → 13,5 Mo.**

Les badges se chargent à l'ouverture de la modale, au fur et à mesure du
défilement : 30 images pour le premier écran au lieu de 73 d'un coup.

`tests-e2e/profile_payload.spec.js` mesure ce que le **navigateur** dit avoir
transféré (`transferSize`) : zéro octet de badge tant que la modale est fermée,
et des images qui arrivent bien — non cassées — dès qu'on l'ouvre.

### Le vrai problème, lui, reste entier

Les badges sont des **PNG 2048×2048** affichés en 96 px. Cinq exemples :

```
Chinesse_new_year.png       2048x2048   7834 Ko
Badges_Best_bro.png         2048x2048   6682 Ko
Badges_velvet_headache.png  2048x2048   6667 Ko
```

Ré-encodés en WebP 256×256 (qualité 88), ces cinq fichiers passent de **33,7 Mo
à 173 Ko**, soit 99,5 % de moins, pour un rendu identique à l'écran — 256 px
couvre largement l'affichage en 96 px, écrans haute densité compris.

Ouvrir la modale des badges coûte encore 47,6 Mo pour 30 images.

**Non fait ici** : c'est un changement de 61 fichiers visuels, avec les
`image_path` en base à suivre, et ça se décide avant une release, pas pendant.
À traiter dans son propre lot.

### Fichiers touchés

- `profile/badges/badgesManager.js` — deux attributs sur la grille
- `tests-e2e/profile_payload.spec.js` — nouveau

---

## 2026-09-24 — Le badge d'un code événement se choisit dans une liste

La création d'un code événement demandait le **slug du badge dans un champ
libre**. Une faute de frappe ne se voit nulle part : le code est créé, il
apparaît actif dans le panneau, et il ne donnera jamais rien. Le joueur qui le
saisit reçoit « Code mal configuré — contacte un admin », et personne ne sait
pourquoi tant qu'on n'a pas relu la ligne en base.

C'est exactement le garde-fou que `api/badges/index.php` avait dû se donner : il
refuse la redemption **sans la consommer** quand le `badge_id` ne correspond à
rien. Autant empêcher l'erreur à la source.

### Ce qui change

Un bouton « Choisir… » ouvre la liste des 73 badges, avec image, nom, catégorie
et slug, et un filtre qui cherche dans les trois. Le catalogue est celui que
`admin/catalogs.js` charge déjà pour les onglets de détail utilisateur : rien de
nouveau à aller chercher.

Le champ reste affiché, en lecture seule, plutôt que remplacé par un `<select>` :
il montre le **slug exact** qui partira en base, ce qu'un admin doit pouvoir
relire. Et la création refuse désormais de partir sans badge choisi.

### Le piège de mise en page

Le bouton se retrouvait **sous** le champ de la colonne suivante, donc
inatteignable au clic — `min-width: auto` est la valeur par défaut d'un enfant de
flex : le champ refusait de descendre sous sa taille intrinsèque, la rangée
débordait de sa cellule de grille. `min-width: 0` règle le cas. Trouvé en
essayant le panneau pour de vrai ; aucun test unitaire ne l'aurait vu.

### Fichiers touchés

- `admin/badge_picker.js` — nouveau, `filtrerBadges()` + la modale
- `admin/event-codes.js` — bouton de choix, champ en lecture seule, garde-fou
- `admin/admin.css` — le sélecteur
- `tests/adminBadgePicker.test.js` — 9 cas sur le filtre (nom, slug, catégorie,
  sous-chaîne, ordre conservé, entrées incomplètes)

`admin/` reste hors périmètre i18n (outil interne, français, CLAUDE.md §5).

---

## 2026-09-24 — La page Nouveautés 2.3 est remplie

La palette **Pink Ribbon** était déjà en place (ouverture de la version) ; il
manquait le contenu des lots livrés depuis.

Trois sections ajoutées, toutes bilingues (`data-i18n-block`) :

- **🏅 Quatre badges et un titre** — chaque entrée avec son image, son nom et sa
  condition exacte, règle Hamza du 2026-09-19 : tout nouveau contenu est listé
  explicitement, pas de section « sans spoiler ». Le badge secret affiche
  « ??? — condition dévoilée sur le Discord à la sortie ».
- **🤝 Le classement des amitiés** — la troisième dimension du classement, et
  l'XP de Social Link qui ne se cache plus au rang 10.
- **🎖️ Vos badges, dans votre ordre** — réordonnancement et inspection, chacun
  présenté par le problème qu'il résout plutôt que par la fonctionnalité.

Deux correctifs ajoutés à la section Corrections, parce qu'ils sont visibles du
joueur : les fiches de lore qui donnaient la réponse, et surtout la perte des
badges épinglés sur un second appareil — celui-là, un joueur a pu le subir sans
comprendre.

### Un défaut trouvé en regardant la page

**Quatre images cassées** dans la grille des 146 portraits, déjà en ligne :
`baofu_p2_3`, `baofu_p2_4`, `akihiko_sanada_p3_3` et `koromaru_p3_3`. Ces
portraits ont été RÉIDENTIFIÉS après coup (les deux « Baofu » sont Zenkichi
Hasegawa, les deux médaillons sont Persona Q) : les fichiers ont été renommés et
déplacés dans la galerie, mais la page Nouveautés pointait encore les anciens
noms. Corrigé, avec les bons noms ET les bonnes légendes.

Deux styles de carte ajoutés au passage : `badge-card.rarity-legendary` — Memento
Vivere est le premier badge de cette rareté, seules les cartes de TITRE en
avaient un — et `badge-card.rarity-secret`.

### Vérification

Page ouverte dans un navigateur : **aucune image manquante**, 4 cartes de badge
et 1 carte de titre, les images de badge décodées, 24 blocs `fr` pour 24 blocs
`en`, structure équilibrée (76 `div`, 11 commentaires).

---

## 2026-09-24 — Réordonner ses badges épinglés

`profile.selectedBadges` est un tableau ORDONNÉ depuis toujours, et
`renderBadgesPreview()` le rend dans cet ordre. Le joueur n'avait simplement
aucun moyen d'en changer : l'ordre était celui dans lequel il avait épinglé, et
le corriger demandait de tout dépingler pour recommencer. Aucune migration n'a
donc été nécessaire — c'est le même champ.

### Pointer Events, pas glisser-déposer HTML5

L'API `dragstart`/`dragover`/`drop` **ne se déclenche pas au doigt** : sur mobile
elle ne fait rien du tout. Le jeu est très joué sur mobile — le dépôt a une suite
E2E entière à 390 px. Les Pointer Events couvrent souris, doigt et stylet avec le
même code, et le test tactile de ce lot est là précisément pour empêcher un
retour en arrière.

### Ce qui a demandé du soin

- **Le ✕ ne doit pas être avalé.** Un glissement ne démarre qu'après un seuil de
  6 px : en deçà, c'est un clic, et dépingler reste dépingler. Sans ce seuil, le
  ✕ serait devenu un jeu d'adresse.
- **Le navigateur rend les `<img>` déplaçables nativement.** Un appui sur l'image
  démarre son propre glisser, qui annule nos événements (`pointercancel`). Le
  réordonnancement marchait au clavier et pas à la souris, sans rien signaler.
  Neutralisé en CSS (`-webkit-user-drag`, `pointer-events: none` sur l'image) et
  par l'attribut `draggable="false"`.
- **Le clavier.** Les flèches gauche/droite déplacent le badge qui a le focus. Un
  réordonnancement au seul glissement aurait été inaccessible, alors que la
  rangée est atteignable en tabulation. Effet de bord utile : le `tabindex` rend
  aussi le ✕ atteignable au doigt via `:focus-within`.

### Le bug que ce lot a fait sortir

Le test E2E épinglait trois badges par l'API puis ouvrait la page — qui n'en
affichait aucun. Le serveur les avait, jusqu'à ce que la page les efface : c'est
ainsi qu'a été trouvé le bug de perte de données corrigé plus haut.

### Fichiers touchés

- `profile/badges/badges_reorder.js` — nouveau, `deplacerBadge()` + branchement
- `profile/badges/badgesManager.js` — branché après chaque rendu de la rangée
- `profile/badges/badges.css` — case déplaçable, cible, glisser natif neutralisé
- `tests/badgesReorder.test.js` — 10 cas sur `deplacerBadge()`, dont l'invariant
  « aucun badge perdu » vérifié sur TOUS les couples d'index, y compris hors bornes
- `tests-e2e/badges_reorder.spec.js` — souris, doigt, clavier, et le ✕ intact

### Deux pièges rencontrés dans les tests eux-mêmes

- `page.mouse` travaille en coordonnées de **fenêtre** : la rangée est sous la
  ligne de flottaison, le pointeur ne la touchait jamais. Le test accusait le code.
- Le contexte Playwright a besoin de `hasTouch: true`, sinon les événements
  tactiles ne partent pas du tout.

---

## 2026-09-24 — Ouvrir une page effaçait les choix de profil du serveur

### Le bug

`_syncLocalProfileToCloud()` (js/auth.js) poussait les champs de présentation —
avatar, couleur de bordure, wallpaper, musique, **badges épinglés**, titre équipé
— vers la base à **chaque chargement de page, sur toutes les pages**, et **avant
tout pull**.

Sur un appareil dont le profil local est vide, elle envoyait donc
`selected_badges: []`, `avatar_border_color: '#ffffff'` et le reste par défaut.
Le serveur perdait les choix du joueur.

Ce n'est pas un cas de laboratoire : c'est un **second appareil**, un navigateur
neuf, un cache vidé, une fenêtre privée. Reproduit en local — badges épinglés en
base, ouverture de la page profil sur un navigateur neuf, badges effacés en moins
de trois secondes, sans la moindre action du joueur.

Et c'est silencieux : aucune erreur, aucun signe. Le joueur constate juste, un
jour, que ses badges sont dépinglés.

### Comment il a été trouvé

Par accident, en écrivant le test E2E du réordonnancement des badges : le scénario
épinglait trois badges par l'API puis ouvrait la page, et la page ne les
affichait pas. Le serveur les avait bien — jusqu'à ce que la page les efface.

### Le correctif

La fonction lit désormais le profil du serveur **d'abord**, et ne propose que les
champs qu'il n'a pas encore, avec une vraie valeur en local. Le serveur gagne
toujours ; le local ne fait que combler les trous.

La raison d'être de cette fonction reste couverte : un joueur qui a personnalisé
son profil **avant** de créer son compte retrouve ses choix à la connexion. La
retirer purement et simplement aurait été jeter le bébé avec l'eau du bain.

Cas particulier assumé : `#ffffff` est la valeur par défaut du serveur, pas un
choix. Une couleur locale peut donc la remplacer — sans quoi la migration d'une
bordure ne marcherait jamais.

Si le serveur est injoignable, **rien n'est poussé** : pousser à l'aveugle est
exactement ce qui causait le problème.

### Fichiers touchés

- `js/auth.js` — `_syncLocalProfileToCloud()` réécrite, `_valeurUtile()`
- `tests-e2e/profile_no_overwrite.spec.js` — nouveau, les deux côtés : le serveur
  n'est plus écrasé, et la migration d'un profil local marche toujours

---

## 2026-09-24 — Consulter la fiche d'un badge sans l'épingler

Dans la grille, un clic sur un badge l'ÉPINGLE ou le DÉPINGLE. Le seul moyen d'en
lire la condition et la description était la bulle d'info **au survol** — et le
survol n'existe pas au doigt.

Sur mobile, un joueur qui voulait simplement savoir à quoi correspond un badge
n'avait donc qu'une option : le toucher, donc modifier ses badges épinglés pour
lire une phrase. Un œil sur chaque carte ouvre la fiche, et ne touche à rien.

### Ce qu'une fiche montre, et surtout ce qu'elle ne montre pas

Un badge **secret encore verrouillé** n'affiche ni son nom, ni sa condition, ni sa
description — « ??? » partout. Sans ça, l'œil serait devenu un moyen commode de
lire toutes les réponses, soit l'inverse exact de ce que « secret » veut dire.

Un badge verrouillé mais **non secret**, lui, montre sa condition : c'est tout
l'intérêt de la fiche, savoir ce qu'il reste à faire. Son image est grisée — la
fiche dit quoi faire, elle ne donne pas le visuel comme s'il était déjà gagné.

### Le piège

L'œil vit SUR la carte, qui porte un `onclick` qui épingle. Il arrête donc la
propagation de `click` **et** de `pointerdown`. Deux tests tiennent les deux
bouts : l'œil n'épingle jamais, et un clic sur la carte épingle toujours — le
second existe pour que le correctif du premier ne neutralise pas le comportement
normal.

Autre détail : le bouton reste **visible en permanence sans pointeur fin**
(`@media (hover: none)`). Une opacité 0 par défaut l'aurait rendu introuvable
exactement dans le cas d'usage qui a motivé le lot.

### Fichiers touchés

- `profile/badges/badge_inspect.js` — nouveau, `construireFiche()` + panneau
- `profile/badges/badgesManager.js` — branché après les clics de carte
- `profile/badges/badges.css` — l'œil et la fiche
- `lang/*.json` — 3 clés × 6 langues
- `tests/badgeInspect.test.js` — 16 cas, dont le secret verrouillé et
  l'échappement du contenu
- `tests-e2e/badge_inspect.spec.js` — l'œil n'épingle pas, la carte épingle
  toujours, Échap ferme la fiche sans fermer la modale derrière

---

## 2026-09-24 — Huit fiches de lore Expert donnaient la réponse

### Ce qui fuitait

La fiche anglaise de **Terpsichore**, en mode Personae Expert, se terminait par :

> « Her name survives in English as *terpsichorean*, meaning anything pertaining
> to dance. »

La réponse, à deux lettres près, en clair, dans le mode dont tout l'intérêt est
de ne pas la donner. Même défaut pour **Moros / « morose »** en cinq langues et
pour Terpsichore en français et en allemand : **huit fiches**.

`maskTerms()` (js/gameCore.js) masque des **mots entiers** — sa frontière de fin
est `(?=$|[^\w])`. Un mot dérivé du nom passe donc à travers : les lettres en
plus font échouer la frontière. À l'inverse, l'allemand « morös » était déjà
masqué, parce qu'il se replie exactement sur « moros » (foldText retire le
tréma) et reste un mot entier.

### Pourquoi ça a dormi si longtemps

Le test E2E `expert-personae.spec.js` ne regarde que **la cible du jour**. La
fuite n'était donc visible que le jour où le tirage tombait sur Terpsichore —
elle a attendu que la CI tombe dessus, le 2026-09-24, sur une branche qui n'avait
rien à voir (l'onglet « Animés »).

### Correctif

Les mots dérivés entrent dans la liste `mask` de leur fiche : `terpsichorean`
(en), `terpsichoréen` (fr), `terpsichoreisch` (de), `morose` (en/fr), `moroso`
(es/it/pt). La phrase reste lisible, le mot devient `▮▮▮`.

Non touchés, et volontairement : `terpsicoreo` (es), `tersicoreo` (it),
`terpsicoreano` (pt) ne contiennent pas littéralement le nom.

### Le test qui manquait

`tests/expertLoreMasking.test.js` audite les **936 fiches des six langues**, tous
les jours, masquage appliqué.

La règle demandait un peu de soin : une recherche de sous-chaîne nue produit des
faux positifs — « Nella » (it) contient « Ella », « inúmeros » (pt) contient
« Eros », et aucun des deux ne donne quoi que ce soit. Le critère retenu est
donc : **le nom fuit s'il apparaît à une position non précédée d'une lettre**.
C'est ce qui sépare un dérivé (`terpsichore|an`, le nom ouvre le mot) d'une
coïncidence de fin (`N|ella`).

Le même critère remplace la comparaison naïve du test E2E, qui aurait échoué les
jours où la cible s'appelle Ella ou Eros — un deuxième piège de calendrier, resté
invisible pour la même raison que le premier.

Trois garde-fous en plus : chaque fiche doit avoir au moins un terme à masquer,
le masquage doit laisser une trace visible quand il agit (sinon les deux premiers
tests passeraient au vert pour de mauvaises raisons), et la règle elle-même est
vérifiée sur les trois cas réels.

### Fichiers touchés

- `personaeMode/database/expert_lore/{en,fr,de,es,it,pt}.json` — 8 termes ajoutés
- `tests/expertLoreMasking.test.js` — nouveau, 5 cas
- `tests-e2e/expert-personae.spec.js` — critère aligné
## 2026-09-23 — L'XP de Social Link ne se cache plus au rang 10

### Ce qui était en cause

Le **serveur n'a jamais plafonné l'XP**. `add_social_link_xp` (procédure stockée) et
son équivalent PHP `personadle_sl_add_xp()` font tous deux `xp = xp + montant`, sans
borne ; seul le RANG s'arrête à 10, parce qu'il vaut
`MAX(rank WHERE xp_required <= xp)` et que la table `social_link_ranks` s'arrête à
2 700. Vérifié en base : un lien poussé à 7 700 XP reste au rang 10 sans rien perdre.

Le plafond était donc purement **visuel**. Une fois le rang 10 atteint,
`_renderGauge()` remplaçait le compteur par « ✨ MAX — True Confidant » et masquait le
bloc « comment gagner de l'XP ». Deux amitiés de 2 700 et de 50 000 XP s'affichaient à
l'identique, et le jeu disait à ceux qui jouent le plus ensemble qu'ils n'avaient plus
rien à gagner — alors que c'est cette XP qui départagera les amitiés dans le classement
Amitié (lot 9).

### Ce qui change

- Le total d'XP reste affiché au rang 10 : « ✨ MAX — True Confidant · 7 700 XP ».
- Une ligne dorée annonce l'XP gagnée **au-delà** du seuil : « +5 000 XP au-delà du
  rang 10 ». Absente tant qu'on vient juste d'atteindre le rang.
- Le mémo « comment gagner de l'XP » ne disparaît plus au rang 10.
- Les nombres passent par `toLocaleString()` : « 7 700 » et non « 7700 ». Le séparateur
  de milliers varie selon la langue, le coder en dur l'aurait faux dans cinq cas sur six.

Le rang reste borné à 1-10 : rien n'est touché côté serveur, aucune migration.

### Défaut de fond corrigé au passage

Le helper `t(cle, repli, vars)` de `js/social-link.js` interpolait `{{variable}}` dans
la **traduction** mais pas dans le **texte de repli**. Sans i18n chargé — ce qui arrive,
la jauge pouvant se rendre avant — ou avec une clé manquante dans une langue, le joueur
lisait littéralement « +{{xp}} XP au-delà du rang 10 ». `social.howto_done_today`
portait déjà ce défaut depuis la 2.1.

C'est le test qui l'a trouvé, pas la relecture : la première version du cas attendait
« 5000 » et a reçu « +{{xp}}XPbeyondrank10 ».

### Fichiers touchés

- `js/social-link.js` — `fmtXp()`, XP au-delà du seuil, mémo conservé, repli interpolé
- `css/social-link.css` — `.sl-xp-beyond` (or, comme les autres marqueurs de rang max)
- `lang/*.json` — `social.xp_beyond_max` × 6 langues
- `tests/social-link.test.js` — 6 cas : total affiché, ligne « au-delà » présente puis
  absente au seuil exact, mémo conservé, barre pleine et rang figé à 10, et le repli
  qui n'affiche jamais `{{`

---

## 2026-09-24 — Le classement gagne une dimension « Social Link »

Une troisième pastille à côté de Normal et Expert — et la seule qui change la
**nature** de la ligne : on n'y classe plus des joueurs mais des **amitiés**. Un
rang y décrit une relation, pas une performance.

### Pourquoi l'XP et pas le rang

Le rang s'arrête à 10 (2 700 XP) et beaucoup de paires actives y sont déjà : les
départager par le rang donnerait des dizaines d'ex æquo. L'XP, elle, n'a jamais
été plafonnée côté serveur — c'est le lot 8 qui l'a rendue visible, et c'est ici
qu'elle sert. Sur la base de dev, les rangs 2 à 5 sont tous au rang 10 et ne se
distinguent que par 30 XP d'écart.

### Ce qui est exposé, et ce qui ne l'est pas

Pseudo et avatar des deux joueurs — exactement ce qu'un profil public montre
déjà. **Pas de code ami** : il sert à ajouter quelqu'un, il n'a rien à faire dans
une liste publique (le classement normal ne le donne qu'aux utilisateurs
authentifiés, et c'est déjà une exception). Un test E2E le verrouille.

Les liens à **0 XP sont exclus** : sans ça le classement se remplirait de paires
qui viennent de s'ajouter et n'ont rien fait ensemble. Jointure stricte sur
`is_deleted = 0` des deux côtés — un lien qui n'a plus ses deux joueurs n'est
plus une amitié.

### Choix d'implémentation

- **`renderBonds()` est une fonction séparée**, pas `renderLeaderboard()`
  paramétré : la ligne n'a ni la même structure (deux avatars, deux pseudos, un
  lien au centre) ni le même sens. Fondre les deux en branches aurait rendu les
  deux illisibles.
- **Pas de podium.** Un top 3 en marches récompense des individus ; ce classement
  n'en récompense aucun.
- **Les filtres sans objet sont MASQUÉS**, pas grisés : un groupe grisé laisse
  croire qu'il s'appliquera peut-être.
- Le bandeau de filtres dit ce que le classement range au lieu de rappeler
  « tous les modes · tout temps · victoires », qui serait faux ici.

### Un défaut trouvé en vérifiant dans le navigateur

Les groupes de filtres restaient affichés alors que la classe `hidden` était bien
posée : **`.hidden` n'est pas une classe utilitaire globale** sur cette page —
seules `.modal.hidden` et `.lb-pagination.hidden` existaient. La classe était
appliquée et ne peignait rien. Une règle `.lb-filter-group.hidden` explicite
règle le cas. Invisible en test unitaire : jsdom ne calcule pas les styles.

### Fichiers touchés

- `api/leaderboard/index.php` — `buildBondsLeaderboard()`, branche `view=bonds`
- `js/api.js` — paramètre `view` optionnel
- `profile/leaderboard/leaderboard.js` — état `bonds`, `renderBonds()`, `fmtXp()`,
  bandeau dédié, masquage des filtres
- `profile/leaderboard/leaderboard.html` — la pastille
- `profile/leaderboard/leaderboard.css` — pastille rose, ligne d'amitié, mobile
- `lang/*.json` — 5 clés × 6 langues
- `tests-e2e/leaderboard_bonds.spec.js` — tri par XP, aucun code ami, lien à 0 XP
  exclu, paires affichées, filtres masqués puis rendus au retour sur Normal

---

## 2026-09-23 — Onglet « Animés » dans la galerie de portraits

Six portraits animés de Kotone Shiomi et Theodore entrent dans la galerie, et la
galerie gagne un filtre **Tous / Animés**.

### Ce qui a changé de direction

Ce lot était d'abord conçu comme des **portraits à débloquer** : un pack Kotone accordé
par un rituel (jouer les six modes avec elle pour cible, porter son titre), une table
`avatars`, une table `user_avatars`, un `condition_type` dédié et une réconciliation
serveur. Tout cela est retiré — décision Hamza du 2026-09-23 : l'idée elle-même n'est
pas bonne. Un portrait de profil n'est pas une récompense, c'est un moyen d'expression ;
en verrouiller une partie punit surtout le joueur qui arrive après.

Il ne reste donc **aucune logique de déblocage** : les six portraits sont dans
`img/avatar/` comme les 351 autres, disponibles dès la première connexion.

### Le filtre, et pourquoi il ne se lit pas dans l'extension

La galerie compte 357 portraits dont 19 qui bougent. Sans filtre, celui qui vient
chercher un portrait animé doit tout parcourir en guettant les pastilles.

Le point délicat est de savoir **lesquels bougent**. L'ancienne pastille « GIF » se
contentait de regarder si le nom finissait par `.gif` — faux des deux côtés : elle
ratait les six WebP animés de Kotone, et aurait étiqueté un `.gif` fixe. La galerie
contient par ailleurs une douzaine de `.webp` parfaitement immobiles.

`scripts/sort_avatars_data.mjs` relit donc les premiers kilo-octets de chaque fichier
et en déduit `ANIMATED_AVATARS`, exporté par `profile/avatars_data.js` :

- **WebP** — conteneur RIFF portant un chunk `ANIM`/`ANMF` ;
- **GIF** — l'extension d'application `NETSCAPE`, ou au moins deux blocs d'extension de
  contrôle graphique (donc deux images).

La liste est **générée**, jamais écrite à la main : un portrait animé importé demain y
entre tout seul au prochain `npm run avatars:sort`.

### Fichiers touchés

- `scripts/avatar_census.js` — les 6 fichiers rattachés à Kotone Shiomi et Theodore (P3)
- `scripts/sort_avatars_data.mjs` — `estAnime()` + émission de `ANIMATED_AVATARS`
- `profile/avatars_data.js` — régénéré (357 portraits, 19 animés)
- `profile/profile.html` — la barre de filtre dans le volet Avatar de l'atelier
- `profile/profile-page.js` — filtrage par groupe, pastille `ANIM` lue dans la liste
- `profile/profile-page.css` — les onglets de filtre (`min-height: 0`, cf. §7)
- `lang/*.json` — 3 clés × 6 langues
- `tests/avatars_gallery.test.js` — 4 cas : la liste doit être **exactement** l'ensemble
  des fichiers qui bougent sur le disque. La vérification relit les octets au lieu
  d'importer la fonction du générateur — sinon elle confirmerait seulement que le
  générateur est d'accord avec lui-même.
- `tests-e2e/avatars_animated_filter.spec.js` — un compte neuf les voit tous, le filtre
  réduit la grille, le WebP animé se décode, et le choix est bien persisté côté serveur

### Angle mort connu

Les six fichiers pèsent 1,8 Mo à eux seuls (les deux Theodore en font 1 Mo). Ils sont
chargés en `loading="lazy"` comme le reste de la galerie, donc seulement quand on
défile jusqu'à eux, mais l'onglet « Animés » les met tous les six au premier écran. À
surveiller si d'autres animés arrivent.

---

## 2026-09-24 — Quatre badges, un titre, et une table pour les défis relevés

Visuels fournis par Hamza. Conditions arrêtées avec lui le 2026-09-23.

| Slug | Condition | Rareté |
|---|---|---|
| `chord_progression` | 10 défis d'ami relevés en mode Musique | epic |
| `birds_different_feather` | Akechi + Kitazato en Silhouette, Crow + Messa en All-Out Attack | rare |
| `memento_vivere_mori` | Makoto et Kotone dans les 6 modes + leurs 4 thèmes | **legendary** |
| `her_own_orpheus` | secret — code `IAMNOTAPRINCESS`, dévoilé à l'annonce Discord | epic |
| `tatsuya_maya_deja_vu` *(titre)* | Tatsuya et Maya en Classique ET en Silhouette | epic |

`memento_vivere_mori` est le deuxième badge **legendary** du catalogue, après
`wonder_go_beyond` côté titres : c'est son pendant Persona 3.

### Pourquoi une table `challenge_wins`

Le badge Chord Progression compte des défis relevés. La donnée existe déjà dans
`messages` (`type='challenge'`, `status='beaten'`) — mais elle n'y est pas
**durable** : `DELETE /api/messages/:id` autorise un joueur à supprimer ses
messages. Compter les lignes vivantes ferait reperdre le badge à qui range sa
boîte de réception, ce que la règle de monotonie interdit (CLAUDE.md §7).

`game_sessions` ne pouvait pas servir non plus : aucune colonne n'y dit qu'une
partie venait d'un défi, et la session est enregistrée par un appel séparé de
celui qui marque le défi relevé.

D'où une table minuscule, **en ajout seul**, écrite dans `api/messages/index.php`
au moment exact où le serveur valide la transition `accepted → beaten`. C'est le
seul endroit où il *sait* : il y vérifie déjà que seul le destinataire peut
marquer un défi relevé, et depuis quel état. Rien n'est cru sur parole du client.
Sa clé unique `(user_id, message_id)` absorbe un PATCH rejoué par la file de
relance. Pas de clé étrangère vers `messages` : le message peut disparaître, le
fait reste acquis — une cascade réintroduirait le problème qu'on résout.

### Deux défauts trouvés PAR les tests

**1. `targetSetMet()` accordait les ensembles inconnus.** Le helper client
faisait `(TARGET_SETS[cle] || []).every(...)` — et `[].every()` vaut `true`. Un
badge dont l'ensemble n'était pas encore déclaré côté client se débloquait donc
tout seul, sur un profil vierge. Les deux nouveaux badges `targets_found` se sont
allumés immédiatement, et `badgesConditions.test.js` (« aucun badge ne se
débloque sur un profil VIERGE ») l'a signalé. Le helper est désormais fermé.

Un test l'affirmait pourtant explicitement (`unlocks_wonder_shujin.test.js`,
« aucune exigence → vrai côté client, le serveur refuse »). Deux tests se
contredisaient ; le principe anti-« always true » l'emporte, et pour une raison
concrète : côté joueur, l'ancien comportement voulait dire voir le badge
s'allumer en fin de partie puis disparaître au rechargement.

**2. Une apostrophe cassait le miroir client ↔ serveur.** `It's Going Down Now`
avait d'abord été écrit entre guillemets doubles en PHP. L'extracteur de
`unlocks_wonder_shujin.test.js` ne lit que les chaînes à apostrophes simples :
l'apostrophe non échappée lui faisait avaler tout le texte suivant, et les cibles
d'après passaient pour absentes. Écrite `'It's Going Down Now'`, tout rentre
dans l'ordre — et le commentaire sur place explique pourquoi.

### Nouveau garde-fou : les cibles doivent être TIRABLES

`ConditionVocabularyTest::testEveryTargetSetNameCanActuallyBeDrawn` confronte
chaque nom de `PERSONADLE_TARGET_SETS` à `api/data/daily_pools.json`.

Une faute de frappe dans un nom de cible ne casse rien de visible : le badge se
contente de n'être jamais accordé, à personne, pour toujours. Ni la
réconciliation ni le test de catalogue ne le verraient — ce dernier **sème** les
sessions avec les noms du set, donc il confirme seulement que le set est d'accord
avec lui-même. Ici on repart de ce que le jeu peut réellement tirer. Le test
couvre les cinq ensembles, les anciens compris (242 assertions).

Il refuse aussi un ensemble qui exigerait plus de cibles qu'il n'en nomme.

### Nouveau `condition_type` : `mode_challenge_wins`

`condition_value` défis relevés dans `condition_mode`. Comme tout nouveau type :
un `case` serveur, une entrée au vocabulaire, et un cas de semis dans
`BadgeWallpaperCatalogTest` — qui prouve que le badge est bien accordé par la
réconciliation au seuil exact (CLAUDE.md §7).

### Fichiers touchés

- `sql/migrations/054_badges_titles_2_3.sql` — table + 4 badges + 1 titre + code
- `sql/bdd_mysql.sql` — miroir (rejoué sur base vierge, puis 054 par-dessus : no-op)
- `api/lib/condition_check.php` — 3 ensembles, `mode_challenge_wins`, vocabulaire
- `api/messages/index.php` — écriture dans `challenge_wins` sur `beaten`
- `profile/badges/badgesData.js` — 4 entrées, 3 ensembles clients, helper fermé
- `profile/badges/images/` + `profile/titles/` — 5 visuels
- `lang/*.json` — 4 badges × nom/condition/description × 6 langues
- `tests/php/` — catalogue (73 badges, 23 titres), vocabulaire, semis du nouveau type
- `tests/` — parité, i18n, conditions, miroir client ↔ serveur

### Nom du badge secret

D'abord nommé « Soul Phrase », refusé par Hamza : c'est l'**opening de Persona 3
Portable**, pas un nom disponible. Renommé **« Her Own Orpheus »**, qui décrit ce
que montre l'image — Kotone avec SA version d'Orpheus, distincte de celle de
Makoto — et ne reprend le titre d'aucune chanson.

Contrairement à « Soul Phrase », ce nom se traduit : il sort donc de
`KEEP_ORIGINAL` dans `badgesI18n.test.js` et a ses six traductions.

Code du badge : **`IAMNOTAPRINCESS`** (choisi par Hamza).

---

## 2026-09-22 — Le bouton « Sauvegarder » des paramètres était hors champ, et le panneau ne défilait plus

Signalé par **Gypotre** : « quand on modifie nos paramètres depuis notre profil, on ne voit
pas le bouton sauvegarder ». En creusant, **deux** défauts distincts, dont le second est
plus grave que celui rapporté.

### Défaut 1 — le bouton sortait par le bas

`.sm-panel` est un conteneur défilant (`max-height: 88vh`) et `.sm-save` en était le dernier
enfant. **Sur la page profil uniquement**, la zone de danger est montée en plus — elle
dépend de `window._personadleDanger`, que seule cette page pose — ce qui allonge le panneau
au point de pousser le bouton sous la ligne de flottaison. D'où un bug invisible depuis
l'accueil, où la même modale tient à l'écran.

Correctif : `.sm-save` et `.sm-save-status` passent dans un `.sm-footer` **collant**
(`position: sticky; bottom: 0`), dernier enfant du panneau.

### Défaut 2 — le panneau ne défilait pas du tout

Trouvé en corrigeant le premier. Le bloc « Identité Persona 5 », en bas de
`css/settings-modal.css`, redéclare `.sm-panel { overflow: hidden }` — **même sélecteur,
même spécificité, déclaré après** le `overflow-y: auto` du bloc principal. Il gagnait donc.

Mesuré dans Chromium, profil connecté, fenêtre 1280 × 720 :

| Mesure | Avant | Après |
|---|---|---|
| `overflow-y` calculé | `hidden` | `auto` |
| Hauteur visible / contenu | 690 px / **1054 px** | idem |
| Contenu inatteignable | **364 px** | 0 |
| Bas de la zone de danger | **213 px sous** le bord du panneau | atteignable |

Sans barre de défilement ni molette ni tactile, **« Réinitialiser le profil » et
« Supprimer mon compte » étaient inaccessibles** sur une fenêtre de cette hauteur. Seul
`scrollTop` en JS passait encore — ce qui rendait le défaut invisible à tout test qui
défile par script plutôt qu'à la molette.

Correctif : `overflow: hidden` → `overflow-x: hidden`. Seul l'axe horizontal a besoin d'être
coupé, pour la diagonale décorative `::before` (top/right négatifs) ; verticalement, un
dépassement au-dessus du bord haut n'est de toute façon pas atteignable au défilement.

### Défaut 3 — le pied laissait une bande de 27 px

Constaté à la capture d'écran, puis mesuré. Un élément collant est borné par son **bloc
conteneur** — la content box du panneau —, pas par le bord du panneau : tant que `.sm-panel`
gardait `padding-bottom: 26px`, le pied s'arrêtait 27 px au-dessus du bord et le contenu
défilait visiblement dans cette bande. Une marge négative n'y change rien, la contrainte
étant le bloc conteneur. Le `padding-bottom` a donc été **déplacé du panneau vers le pied**.

### Défaut 4 — la classe `hidden` de l'indicateur n'existait pas

`_save()` pose et retire `hidden` sur `#smStatus` depuis toujours, mais **aucune règle ne la
définissait** : ni dans `settings-modal.css`, ni dans `global.css`, qui ne connaît que
`.modal.hidden` et `.sm-danger.hidden`. L'indicateur était donc toujours dans le flux, vide,
et une assertion « il est visible » ne prouvait rien. Dans un pied collant, cette bande coûte
de la hauteur utile à chaque ouverture. Ajout de `.sm-save-status.hidden { display: none }`
— le pied passe de 132 px à 85 px, soit ~47 px rendus au contenu.

### Détails techniques

- `js/settings-modal.js` — `.sm-footer` enveloppe le bouton et l'indicateur. Il doit rester
  le **dernier** enfant de `.sm-panel`, sinon il recouvrirait la zone de danger au lieu de
  flotter au-dessus du contenu qui défile.
- `css/settings-modal.css` — `.sm-footer` (collant, marges latérales négatives pour couvrir
  la largeur du scrollport, fond opaque, suivi en dark mode et dans la requête média 480 px),
  `padding-bottom` déplacé, `overflow-x`, `.sm-save-status.hidden`.
- `tests/settings_modal.test.js` — 2 cas de **structure** (le pied existe et contient les
  deux éléments ; il reste le dernier enfant, après la zone de danger). jsdom ne calcule
  aucune mise en page : ces cas ne prouvent rien sur la visibilité, et le commentaire le dit.
- `tests-e2e/settings_modal.spec.js` — **nouveau fichier**, 5 scénarios, c'est lui qui prouve
  le correctif : visible sans défiler depuis le profil (720 px, zone de danger vérifiée
  présente pour que le test garde son sens), reste visible après défilement dans les deux
  sens, mobile 390 × 844 avec clic réel qui enregistre, défilement **à la molette** jusqu'à
  la zone de danger, et le contre-cas depuis l'accueil. Plus une assertion géométrique :
  le bas du pied ne doit pas être à plus de 2 px du bas du panneau.

### Vérifications

- Les 5 scénarios E2E **échouent tous sur `develop`** (fix retiré par `git stash`) —
  `expect(locator).toBeInViewport() failed` sur chacun. Les 2 cas jsdom aussi.
- Rendu contrôlé en capture : diagonale P5 toujours clippée, coins arrondis intacts, bordure
  haute rouge en place, zone de danger atteignable à la molette.
- `npm run lint` ✅ · suites Vitest ✅ · E2E local ✅ (stack Docker).

### Angles morts connus

- Le bloc « Identité Persona 5 » redéclare `.sm-panel` et `.sm-title` en fin de fichier avec
  des `!important` — il reste un piège à cascade. Il n'est pas refondu ici : ce serait un
  autre lot, et le commentaire ajouté sur place explique au moins pourquoi `overflow` ne
  doit plus être touché.
- Le seuil de 720 px de hauteur est celui testé. Plus bas (fenêtre très courte, mobile en
  paysage), le pied reste collant mais la zone de contenu se réduit d'autant.
---
## 2026-09-22 — L'âge « 60+ » manquait au barème de comparaison du mode Classique

Signalé par Hamza, capture à l'appui : cible Bunkichi (`80+`), essai Mutatsu (`60+`)
affiché **en rouge**, alors que Shuji Ikutsuki (`21-40`) et Naoya Todou (`15-20`)
sortaient bien en orange avec une flèche vers le haut sur la même grille.

Le mode Classique a deux sources de vérité sur l'âge qui ne se parlaient pas :

- `VALID_AGES` (`scripts/validate_characters.js`) décide quelles tranches un personnage
  a le droit de porter — et contient `60+` depuis toujours ;
- le barème de `convertAgeToValue()` (`classiqueMode/modeClassique.js`) décide lesquelles
  savent se comparer — et ne l'avait **jamais** reçue.

Une tranche hors barème renvoie `-1`, et `compareAttribute()` traite `-1` comme « tranche
non reconnue » → `status: "wrong"`, donc rouge sans flèche. Mutatsu est le **seul**
personnage du jeu sur 184 à porter `60+` : le trou est resté invisible jusqu'à ce qu'une
partie tombe sur lui.

### Détails techniques

- `classiqueMode/modeClassique.js` — `"60+": 65` ajouté au barème (entre `40+` → 50 et
  `80+` → 85), et le commentaire de `convertAgeToValue()` dit désormais explicitement que
  ce barème doit couvrir toute tranche de `VALID_AGES` sauf `Unknown`.
- `tests/modeComparisons.test.js` — 3 cas ajoutés. Le scénario exact rapporté, mais
  surtout **deux garde-fous de classe** plutôt que le seul cas vécu :
  - `covers every canonical bracket the schema validator allows` importe `VALID_AGES` et
    échoue en nommant la tranche fautive dès qu'une tranche acceptée par le schéma n'est
    pas au barème ;
  - `keeps the brackets strictly ordered` vérifie que les valeurs sont strictement
    croissantes et sans doublon — une future tranche mal placée inverserait des flèches
    sans rien casser d'autre.

`Unknown` reste volontairement hors barème : une tranche non ordonnable ne peut pas
produire de flèche. L'égalité stricte la couvre déjà en amont (`value === targetVal`).

### Angles morts connus

- `convertAgeToValue()` est le **seul** barème d'âge du dépôt — vérifié par recherche sur
  tout le code JS, PHP, JSON et HTML. Il n'existe pas de miroir PHP côté anti-triche :
  `api/lib/daily_target.php` recalcule la cible du jour, pas la comparaison d'attributs.
- Les grilles déjà affichées chez un joueur ne sont pas recalculées : la correction vaut
  pour les parties suivantes.

---

## 2026-09-22 — Deux All-Out Attack P5X : Luce Notte et Soy Pioneer

Les deux tenues 5 étoiles livrées par Hamza dans `New Data.zip`. Chacune est une entrée
**à part**, la tenue de base restant devinable séparément — comme tous les skins depuis
`Wonder Summer`.

### Noms : « Notte » et « Pioneer », pas ceux des fichiers source

Les fichiers livrés se contredisaient. Vérifié avant d'écrire la donnée, parce que c'est
le nom que le joueur tape dans l'autocomplétion :

| Personnage | Dossier livré | Fichiers | Nom retenu | Source |
|---|---|---|---|---|
| Shoki Ikenami | `Luce Night` | `Luce_Notte_full_appearance`, `Shoki's_Notte_Mask` | **Luce Notte** | lufel.net → « Shoki·Notte » |
| Shun Kano | `Soy Pioneer` | `Shun's_Pioneer_Mask` **mais** `Soy_Frontier_full_appearance` | **Soy Pioneer** | lufel.net → « Shun·Pioneer » |

« Night » est une traduction de *Notte*, et « Frontier » un nom de datamine antérieur (le
wiki décrit encore la tenue sous ce nom) que l'un des fichiers porte encore. Un cas de test
interdit explicitement le retour en arrière sur ces deux noms.

### Assets

Trois fichiers par personnage, dont l'absence ne lève **rien** au build :

- `database/allOutAttack/<gif>.webp` — l'animation floutée à deviner ;
- `database/img/<gif>.webp` — le portrait masqué (autocomplétion, lignes d'essai) ;
- `database/img/<gif>_Battle.webp` — l'illustration révélée en fin de partie.

Les masques et illustrations viennent du zip tels quels. Les animations sont réencodées
depuis les mp4 de présentation, **calées sur les entrées de base** des deux mêmes
personnages (`Luce.webp`, `Soy.webp`) : 800 × 450, ~20 fps, `libwebp` q=65.

| Fichier | Dimensions | Images | Poids |
|---|---|---|---|
| `Luce.webp` (existant) | 800 × 450 | 126 | 4,8 Mo |
| `Soy.webp` (existant) | 800 × 450 | 153 | 4,7 Mo |
| `Luce_Notte.webp` | 800 × 450 | 132 | 4,9 Mo |
| `Soy_Pioneer.webp` | 800 × 450 | 149 | 5,7 Mo |

Soy Pioneer sort 1 Mo au-dessus de sa base à qualité égale (contenu plus détaillé). Baisser
sa qualité pour gagner ce méga aurait créé un écart de rendu entre deux fichiers voisins :
les deux restent bien sous le lot 2.2 (`Berry_Summer` 8,5 Mo, `Bui_Cosmic` 8,7 Mo), ce qui
suffit au regard du poids du dépôt (cf. ROADMAP).

### Détails techniques

- `allOutAttackMode/database/aoaCharacters.js` — section « Skins 2.3 », entrées ajoutées
  **en fin de liste** pour ne pas décaler les index existants.
- `allOutAttackMode/database/portraitsMap.js`, `personas_allOut.js` — les deux tables que
  l'oubli rend silencieux : sans `portraitsMap` pas de portrait, sans `personas_allOut` le
  personnage n'est jamais proposé à la saisie, donc injouable.
- `api/data/daily_pools.json` — régénéré (`npm run pools:build`) : `alloutattack` passe à 77
  entrées, les deux nouveaux noms y figurent avec leur opus.
- `tests/content_aoa_skins_2_3.test.js` — **nouveau**. L'essentiel est un garde-fou
  *général*, pas une vérification des deux seules entrées du lot : les trois fichiers
  existent pour **tout** le roster, chaque nom est dans `portraitsMap` en pointant sur son
  propre `gif`, aucun nom ni `gif` en double, et chaque animation est réellement animée
  (chunk `ANIM` du conteneur RIFF lu à la main, pour ne pas ajouter de décodeur d'image aux
  dépendances de test).
- `PersonaDLE 2.3/PersonaDLE_Update.html` — deux cartes thématiques `.aoa-card-notte` et
  `.aoa-card-pioneer`, sur le principe de `Wonder Shujin` en 2.2 : la carte emprunte la
  palette de l'attaque. Notte en nuit vénitienne (vitrail violet, or, cramoisi, perles du
  masque) ; Pioneer en plein jour western (trame de BD bleue, ceinturon de cuir clouté,
  étoiles de shérif). Les deux fixent leurs couleurs dans les **deux** thèmes : une carte
  Pioneer qui basculerait en sombre perdrait le blanc du costume, qui est le sujet.

### Vérifications

- Garde-fou d'assets testé **en retirant un fichier** : il échoue en nommant le fichier
  manquant, il ne se contente pas de passer.
- Les six assets servis en 200 `image/webp` par la stack Docker.
- Conduit dans le navigateur : les deux noms sortent à l'autocomplétion du mode, chacun avec
  son portrait effectivement chargé (`naturalWidth > 0`), zéro erreur d'image.
- Cartes du changelog rendues en capture, aucune image cassée, aucune requête en erreur.
- `npm test` ✅ · `npm run data:check` ✅ · `npm run pools:check` ✅ · `npm run lint` ✅.

### Angles morts connus

- Les animations portent les filigranes de la chaîne source (« Faz » + un identifiant en bas
  de cadre). **C'est le cas de tout le roster existant** — `Luce.webp` les porte déjà aux
  mêmes positions. Les retirer sur deux entrées sur plus de cent aurait créé l'incohérence,
  pas l'inverse ; un nettoyage se ferait sur l'ensemble ou pas du tout.
- Le mode masque la réponse par un flou CSS (`INITIAL_BLUR = 20`, `BLUR_STEP = 3`), pas en
  cuisant l'effet dans les pixels — le piège « un filtre CSS ne cache rien » de CLAUDE.md §7
  vaut donc ici aussi. Préexistant à ce lot, non traité : ce serait le pendant de
  `js/silhouette_mask.js` pour une image animée, soit un lot à soi seul.
- Ajouter deux entrées change le modulo du tirage quotidien : la cible du jour de
  `alloutattack` n'est plus la même qu'avant le lot. Inhérent à tout ajout de contenu.
---
## 2026-09-22 — 31 portraits de profil importés et rangés

Le dossier `NEW PFP` livré par Hamza. La galerie passe de **204 à 235** portraits.

### Renommage : les noms livrés ne pouvaient pas rester

Les fichiers arrivaient sous leur nom de téléchargement : emoji (`ᯓ𔘓`, `★☆`, `♡゙᷐ᩧ`),
espaces multiples, `(1)`/`(2)`, diacritiques combinants. Au-delà de la règle snake_case
(CLAUDE.md §4), ces noms **échouent à la liste blanche du serveur**
(`personadle_validate_avatar`, `api/lib/validation.php`, regex
`^[A-Za-z0-9_-]+\.(gif|png|jpe?g|webp|avif)$`). Un avatar refusé reste **local** : jamais
persisté sur le compte, écrasé au prochain `pullProfileFromCloud`, absent sur un autre
appareil — et sans le moindre message. C'est exactement le défaut que
`tests/avatars_gallery.test.js` documente depuis l'import de septembre.

Format retenu : `<personnage>_<opus>[_n].jpg`.

### Identification : à l'œil, pas au nom de fichier

Chaque portrait a été identifié **visuellement** (planche-contact numérotée) plutôt que
déduit du nom livré, qui est souvent approximatif. Ce qui a changé le classement :

- `#shokiikenami … (1).jpg` est Shoki dans sa tenue **Notte** (masque cramoisi et or), pas
  sa tenue de base → `shoki_ikenami_notte_p5x.jpg`, cohérent avec le lot All-Out Attack ;
- `sophia.jpg` est **Sophia de P5 Strikers** (le cœur sur la tête) — confirmé contre son
  entrée du dataset (`opus: ["P5S"]`, arcane Hope, persona Pithos) → groupe P5, que ce
  groupe couvre déjà (P5 / P5R / P5S) ;
- `summer_araka_sakai.jpg` → « araka » est une coquille pour **Ayaka** Sakai ;
- `Wonder And Joker Matching 1_2` : vérifié contre `img/avatar/Wonder.jpg` — mêmes cheveux
  roux, mêmes yeux rouges, c'est bien Wonder.

### Répartition

| Groupe | Nombre |
|---|---|
| P5X | 25 |
| P3 (Kotone Shiomi) | 4 |
| P4 (Rise Kujikawa) | 1 |
| P5 (Sophia) | 1 |

### Makoto Yuki puis Kotone Shiomi, en tête du groupe P3

Deux demandes de Hamza en cours de lot : regrouper **tous** les portraits de Kotone d'un
seul bloc — anciens et nouveaux mêlés, pas un tas par lot —, puis faire de même pour Makoto
Yuki et placer les deux protagonistes en **tête** du groupe P3, Makoto d'abord.

Le groupe s'ouvre donc sur les **5** portraits de Makoto Yuki (`makoto_yuki.jpg`,
`Yuki.gif`, `Yuki.jpeg`, `yuki.jpg`, `Yuki2.gif`) puis les **9** de Kotone
(`Kotone.jpeg`, `Kotone2.jpeg`, `Kotone3.jpeg`, `kotone_pdp.jpg`, `kotone_shiomi.jpg`
livrés en 2.0-2.2, plus les 4 de ce lot, crossover compris). Le reste du groupe suit,
inchangé. La galerie se parcourt à l'œil : un joueur cherche un personnage, pas le lot qui
a livré l'image.

Le réordonnancement passe par un script qui **réécrit** le bloc P3 puis compare l'avant et
l'après : il refuse d'écrire si un fichier a disparu ou est apparu. Un avatar retiré de la
liste devient injouable sans que rien ne le signale.

Deux exclusions, l'une et l'autre volontaires :

- **`kotone_pq.jpg` et `makoto_yuki_pq2.jpg` restent dans le groupe PQ.** Ce groupe est un
  roster **complet** en style Persona Q — chaque personnage y a son entrée, de
  `makoto_yuki_pq2` à `crow_pq2`. Les en sortir y ferait deux trous. Même raison pour
  `pfp_makoto.gif` et `Yuki_Zutomayo.jpeg`, qui restent dans SPECIAL (détournements et
  crossovers). À dire si tu préfères l'inverse.
- **`kotone_montagne_p5x.jpg` reste en P5X** : Kotone **Montagne** (Mont) est une autre
  personne que Kotone Shiomi, malgré le prénom commun. La regrouper serait une erreur de
  contenu, pas un rangement.

### Corrections d'identification et de classement (2026-09-23)

Quatre reprises signalées par Hamza en relisant la galerie — trois erreurs de ma part :

- **`baofu_p2_3/4` ne sont pas Baofu mais Zenkichi Hasegawa** (P5 Strikers). Les deux
  personnages ont les cheveux longs, des lunettes sans monture et une barbe de trois jours ;
  je les avais rattachés au mauvais. Renommés `zenkichi_hasegawa_p5s_2/3.jpg` et passés du
  groupe P2 au groupe P5. Baofu retombe à 2 portraits, Zenkichi monte à 3.
- **`akihiko_sanada_p3_3` et `koromaru_p3_3` sont des médaillons ronds de Persona Q.** Le
  groupe PQ se range par STYLE, pas par jeu d'origine du personnage (décision Hamza du
  2026-09-18) : ils y passent, renommés `akihiko_sanada_pq.jpg` et `koromaru_pq.jpg`.
- **Aigis devient protagoniste de P3**, juste après Kotone : elle est l'héroïne de P3FES
  « The Answer ». Elle quitte donc le cast principal.
- **Ordre des secondaires de P3** : Elisabeth, Theodore, Metis, Ryoji, Takaya, Jin, Chidori.

Le garde-fou du tri a d'ailleurs **refusé d'écrire** au premier essai, en signalant quatre
portraits « perdus » — c'étaient les renommages et les deux déplacements. La règle était trop
grossière : elle traitait toute sortie de groupe comme un oubli. Elle distingue désormais
trois mouvements, et n'en bloque qu'un :

| Mouvement | Traitement |
|---|---|
| Ajout dans un groupe | signalé |
| Sortie d'un groupe, réapparition dans un autre | signalé (déplacement légitime) |
| Sortie de la liste alors que le fichier est **toujours sur le disque** | **bloqué** — c'est l'oubli qui rend un portrait injouable en silence |

Une sortie accompagnée d'une disparition du disque est un renommage volontaire ; le test de
galerie vérifie de son côté qu'aucun orphelin ne traîne.

### Galerie réordonnée : protagoniste → cast principal → secondaires

Demande Hamza. Chaque groupe s'ouvre désormais sur son ou ses protagonistes, puis le cast
principal, puis les personnages secondaires, et **les portraits d'un même personnage se
suivent** — la galerie se parcourt à l'œil, on y cherche quelqu'un, pas le lot qui a livré
l'image.

Le blocage : `avatars_data.js` ne connaissait que des noms de fichiers. Rien n'y disait QUI
était sur l'image, et aucune heuristique sur le nom ne tient (`Yuki.gif`, `makoto_yuki.jpg`
et `pfp_makoto.gif` sont la même personne ; `Makoto.jpg` en est une autre). D'où
`scripts/avatar_census.js`, qui porte le roster de chaque jeu — personnage, rôle, fichiers —
et devient la source de l'ordre.

- `npm run avatars:census` — combien de portraits par personnage, du moins fourni au mieux
  fourni, plus la liste des personnages de cast principal qui n'en ont **aucun**.
- `npm run avatars:sort` — régénère `avatars_data.js` depuis ce roster. Le script compare
  l'avant et l'après groupe par groupe et **refuse d'écrire** si un portrait a disparu, est
  apparu, ou a changé de jeu.

Un portrait ajouté sans être inscrit au roster ressort en « NON RECENSÉ » : c'est voulu,
c'est le rappel qu'il lui manque son personnage.

**Exception : le groupe PQ ne se trie pas par rôle.** Son ordre est figé P3 → P4 → P5
(protagoniste d'abord dans chaque jeu), décision Hamza du 2026-09-18, et
`tests/avatars_gallery.test.js` le verrouille par un cas **exact**. Premier jet du tri :
ce test est passé au rouge en remontant Yu Narukami et Joker en tête du groupe. Le roster
porte donc un champ `section` qui signale un ordre figé, et le script ne retrie pas ces
groupes-là.

### État de la galerie après ce lot

235 portraits, 79 personnages recensés, 11 images SPECIAL (détournements et crossovers, sans
roster par conception).

| Groupe | Portraits | Personnages | Moyenne |
|---|---|---|---|
| P1 | 11 | 7 | 1,6 |
| P2 | 9 | 5 | 1,8 |
| P3 | 44 | 15 | 2,9 |
| P4 | 38 | 12 | 3,2 |
| P5 | 46 | 15 | 3,1 |
| P5X | 50 | 24 | 2,1 |
| PQ | 26 | 26 | 1,0 |

**20 personnages n'ont qu'un seul portrait**, dont cinq du cast principal : Eriko Kirishima
et Yukino Mayuzumi (P1), Lisa Silverman (P2), Sophia (P5), et Akihiko Sanada (1 seul en P3).
**31 personnages de cast principal n'en ont aucun** — la liste vit dans `ABSENTS`
(`scripts/avatar_census.js`), à raccourcir au fur et à mesure.

### Détails techniques

- `img/avatar/` — 31 fichiers ajoutés, copiés par un script qui **refuse de tourner** si le
  nombre de sources ne correspond pas au mapping, si deux destinations portent le même nom,
  ou si l'une écraserait un avatar existant. Écraser silencieusement un portrait de la 2.0
  aurait été invisible jusqu'à ce qu'un joueur le remarque.
- `profile/avatars_data.js` — les 31 entrées dans leurs groupes, avec le pourquoi du
  classement de Sophia et du crossover Kotone en commentaire sur place.
- `PersonaDLE 2.3/PersonaDLE_Update.html` — la grille complète des 31 vignettes avec leur
  personnage, groupée par jeu (règle « tout nouveau contenu est listé », CLAUDE.md §9). Le
  HTML est **généré** depuis une liste, pas tapé : 31 chemins à la main, ce sont 31 chances
  de faire une faute qui ne casse rien au build et laisse juste une case vide.

### Vérifications

- `tests/avatars_gallery.test.js` était **rouge avant** (31 orphelins nommés) et passe après
  — c'est lui qui couvre l'existence sur disque, l'absence d'orphelin, l'absence de doublon
  entre groupes, et la liste blanche serveur. Aucun test nouveau n'était nécessaire.
- Les 31 chemins de la grille du changelog vérifiés un par un contre `img/avatar/` : zéro
  manquant, zéro doublon.
- Conduit dans le navigateur : l'atelier du profil affiche **235** portraits, zéro image
  cassée, zéro 404 sur `/img/avatar/`, les nouveaux rendus dans leurs bons groupes.
- Grille du changelog rendue : 31 vignettes chargées, rangées alignées.

### Angles morts connus

- Les portraits **animés** de Kotone (dossier `Kotone PFP`) ne sont pas ici : ils forment le
  pack déblocable du lot 6. Seuls les portraits libres vivent dans `avatars_data.js`.
- Les fichiers restent des `.jpg` tels que livrés, sans réencodage — poids total ~3,1 Mo
  pour 31 fichiers, du même ordre que la galerie existante.

---

## 2026-09-22 — Elisabeth devient utilisatrice de persona en mode Classique

Demande Hamza. Les deux datasets se contredisaient : le mode **Personae** enregistre depuis
la 2.1 qu'Elisabeth manie **Thanatos** dans P4AU — entrée fusionnée avec Makoto Yuki et
Kotone Shiomi, cf. CLAUDE.md §4 « personas multi-wielders » — tandis que le mode
**Classique** la donnait encore en `personaUser: false`, `persona: "NONE"`.

C'est le Classique qui perdait : c'est lui que le joueur voit dans sa grille de comparaison,
et il affirmait le contraire de ce que le jeu enregistre ailleurs.

### Ce qui ne change pas

`arcane` reste `["NONE"]` et `age` reste `"Unknown"` — décision Hamza, seuls `personaUser` et
`persona` bougent. **Theodore n'est pas touché** : il n'apparaît pas dans P4AU et ne manie
aucune persona. C'est la moitié du lot qu'il serait le plus facile de « corriger » par
symétrie un jour, d'où un cas de test qui le dit explicitement.

### Détails techniques

- `database/characters_clean.js` — `personaUser: true`, `persona: "Thanatos"`, avec le
  pourquoi en commentaire sur place plutôt que seulement ici.
- `tests/content_velvet_persona_users.test.js` — **nouveau**. Quatre cas : Elisabeth manie
  Thanatos ; le mode Personae la compte bien parmi les manieurs de cette entrée (si elle en
  disparaissait, le Classique affirmerait seul quelque chose que plus rien ne soutient) ;
  Theodore reste non-utilisateur ; ni l'un ni l'autre ne gagne d'arcane ou d'âge.

### Pourquoi pas un invariant général

L'idée d'exiger que tout `personaUser: true` du Classique ait une entrée correspondante en
mode Personae a été mesurée avant d'être écartée : **19 personnages** seraient en faute
aujourd'hui (Ryoji Mochizuki, Izanami, les Shadows de boss — Kamoshida/Asmodeus,
Madarame/Azazel, Shido/Samael…). Ce sont des exclusions **légitimes** — un Shadow de boss
n'a pas à être devinable en mode Personae. Un tel test serait rouge à tort dès sa création.

### Angles morts connus

- Le tirage quotidien n'est pas affecté : `personaUser`/`persona` n'entrent pas dans
  `api/data/daily_pools.json`, seuls les noms et opus y figurent (`npm run pools:check` ✅).
- Les grilles déjà affichées chez un joueur ne sont pas recalculées.

---

## 2026-09-22 — Ouverture de la v2.3

Création du dossier de version, comme le veut CLAUDE.md §9 : c'est ce point de
synchronisation qui avait manqué à la 2.1, dont les entrées s'étaient accumulées dans
le dossier de la 2.0 jusqu'au 2026-08-20.

### Détails techniques

- `PersonaDLE_Update_Documentation/PersonaDLE 2.3/DEV_CHANGELOG.md` — ce fichier.
- `PersonaDLE_Update_Documentation/PersonaDLE 2.3/PersonaDLE_Update.html` — squelette
  du changelog joueur, généré depuis celui de la 2.2 : mêmes composants (bandeau de
  progression, bouton retour, cartes All-Out Attack, révélation au scroll), palette
  **Pink Ribbon**. Le rouge `#e63946` devient `#e8447e` partout, et cinq tokens
  `--kotone-*` sont posés sur `:root` (+ leur redéfinition `.darkmode`) pour que le
  thème de la prochaine version ne soit qu'un remplacement de ces lignes plutôt qu'une
  chasse aux littérales. Le frontmatter porte un ruban animé (`.kotone-ribbon`),
  décoratif donc `aria-hidden`, et neutralisé sous `prefers-reduced-motion`.
- `.gitignore` — bloc de liste blanche pour `PersonaDLE 2.3`, sur le modèle exact des
  blocs 2.0 → 2.2. Sans lui, les deux fichiers ci-dessus sont ignorés **en silence** :
  le dossier parent est exclu par `PersonaDLE_Update_Documentation/*`.
- `CLAUDE.md` §9 — la version en cours de développement passe de 2.2 à 2.3.

### Hygiène de branches faite au passage

- PR #172 (`docs/discord-daily-morning-social-link-2-3`) mergée sur `develop` : le cron
  Discord quotidien passe à 06:00 UTC et la piste « Social Link sans plafond » entre au
  ROADMAP. Elle traînait ouverte depuis le 2026-09-21 et portait déjà du travail 2.3.
- `hotfix/titles-500-played-on-date` supprimée : zéro commit d'avance sur `develop`,
  donc déjà intégrée (elle avait été livrée en 2.2.6).
- `develop` contient l'intégralité de `main` (v2.2.8) — vérifié par `git rev-list`.

### Angles morts connus

- Les PR Dependabot #170 (prettier 3.9.6 → 3.9.8) et #171 (jsdom 29.1.1 → 30.1.0)
  restent ouvertes. La montée majeure de jsdom touche l'environnement de test de
  l'intégralité des suites Vitest : à traiter dans son propre lot, pas en passant.
- La page Nouveautés n'a pas encore son entrée `version-item` dans le modal de
  `index.html` — c'est volontaire, elle s'ajoute **à la sortie** de la version.
