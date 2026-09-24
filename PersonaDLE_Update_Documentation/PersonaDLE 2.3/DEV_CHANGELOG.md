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
| 6 | `feat/unlockable_avatars` | Avatars déblocables + pack Kotone |
| 7 | `feat/avatar_frames` | Contours de profil à motifs |
| 8 | `feat/social_link_xp_uncapped` | XP de Social Link sans plafond |
| 9 | `feat/leaderboard_friendship_tab` | Onglet Amitié du classement |
| 10 | `feat/badges_reorder_dnd` | Réordonnancement des badges au glisser-déposer |
| 11 | `feat/badge_inspect` | Inspection d'un badge sans l'équiper |
| 12 | `feat/admin_unlock_picker` | Sélection et retrait de déblocages côté admin |
| 13 | `feat/changelog_2_3_pink_ribbon` | Remplissage de la page Nouveautés |

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

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/develop

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
