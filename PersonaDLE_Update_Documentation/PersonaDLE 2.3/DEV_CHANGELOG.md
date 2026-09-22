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
