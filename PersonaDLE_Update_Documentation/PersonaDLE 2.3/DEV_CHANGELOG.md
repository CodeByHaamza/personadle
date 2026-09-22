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
