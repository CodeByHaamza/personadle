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
| 3 | `feat/aoa_p5x_variants` | All-Out Attack Luce Night et Soy Pioneer |
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
