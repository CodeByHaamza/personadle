<div align="center">

# 🗺️ ROADMAP — PersonaDLE

<img src="https://img.shields.io/badge/version-2.0-brightgreen?style=for-the-badge" alt="v2.0">
<img src="https://img.shields.io/badge/prochaine-pré--prod-orange?style=for-the-badge" alt="next">

> **Document vivant.** En haut : ce qui reste à faire (priorisé). En bas : l'historique de ce qui est livré.

</div>

**Légende** — Priorité : 🔴 tôt · 🟠 qualité · 🟢 produit · 🔐 sécurité · ❓ décision &nbsp;|&nbsp; Statut : 📋 planifié · 💡 idée · 🚧 en cours

---

## 🗄️ Migrations SQL à appliquer sur Hostinger (prod)

> `sql/bdd_mysql.sql` est la source de vérité pour Docker/local, mais **rien ne l'applique
> automatiquement sur Hostinger** — chaque migration doit être poussée à la main en prod
> (SSH + `mysql --delimiter='$$' < fichier.sql` si procédure stockée, sinon import normal,
> voir CLAUDE.md §7/§10). Cette liste évite d'en oublier une entre deux déploiements ;
> cocher une fois réellement appliquée en prod, pas juste mergée sur `develop`.

- [ ] `sql/migrations/022_fix_aigis_title_condition.sql` — corrige le titre
  `aigis_i_am_not_afraid`, qui ne pouvait jamais se débloquer en prod (`condition_mode`
  jamais seedé pour aucun titre). PR #14.

---

## 🚀 v2.1 — Prochaine version (périmètre décidé le 2026-07-06)

> La 2.0 part en prod sans attendre ces points — ils avancent en parallèle une fois livrée.
> Priorité pas encore fixée entre eux. Mis de côté pour l'instant, sans version cible :
> Mode Versus temps réel (chantier temps réel plus lourd) et notifications push PWA — restent
> en idée dans 🟢 Produit ci-dessous. Groupes d'amis : en réflexion, pas encore tranché.

- [ ] **Mode Expert** — variante à **une seule tentative**, mécanique différente par mode de jeu :
  - Classique : seule la citation (`quote`) est donnée, aucune autre catégorie affichée
  - Musique : 1 seconde de clip audio au lieu de la lecture complète
  - Personae : crop aléatoire zoomé du portrait au lieu du portrait entier
  - Émoji / Silhouette / All-Out-Attack : équivalent à définir par analogie au moment de
    l'implémentation (un seul indice minimal, pas de révélation progressive sur mauvaise réponse)
  - Condition de déblocage **différente par mode** (à trancher au cas par cas, pistes retenues :
    nombre de victoires en mode normal sur ce mode, streak minimum, ou badge dédié)
- [ ] **Historique de profil** : graphe de streak + calendrier des jours joués (`uniqueDaysSet` déjà en base).
- [ ] **Saison / ladder** avec reset périodique + récompenses.
- [ ] **Compendium des unlocks** — vue "archive" style Persona de tous les badges/titres/wallpapers
  débloqués avec leur date (réutilise `badges_unlocked`/`user_titles` déjà en base, pas de
  nouvelle donnée serveur nécessaire).
- [ ] **Vérification d'email à l'inscription** (confirmer l'adresse avant activation complète) — détail dans 🔐 Sécurité/compte ci-dessous.
- [ ] **Stratégie assets AOA + Git LFS** — détail dans 🔴 À prévoir assez tôt ci-dessous.

---

## 🎯 Prochaines étapes

### 🔴 À prévoir assez tôt

- [x] **Conditions badges/wallpapers en colonnes structurées** — ✅ _livré (migration
  `sql/migrations/021_structured_badge_wallpaper_conditions.sql` + `bdd_mysql.sql` mis
  à jour). `badges`/`wallpapers` ont maintenant les mêmes colonnes structurées que
  `titles` (`condition_type`/`condition_mode`/`condition_value`), vérifiées par
  `api/lib/condition_check.php` — extrait de l'ancien `verifyTitleCondition()`
  (`api/titles/index.php`), **une seule** fonction générique désormais partagée par
  les 3 tables au lieu de 3 mappings slug→logique divergents (`api/badges/index.php`,
  `api/wallpapers/index.php` réécrits pour l'utiliser). 15/60 badges et 5/7 wallpapers
  ont une condition réellement structurable (le reste : flags narratifs multi-persos,
  redeem de code événement, ou vérifié par un autre endpoint — `condition_type='manual'`,
  documenté explicitement plutôt que laissé `NULL` en silence). Corrige au passage 2
  badges (`velvet_regular` 50 jours uniques, `best_bro` 2+ amis) qui étaient
  structurellement calculables mais bypassés par erreur de mapping (toujours `true`).
  3 nouveaux `condition_type` ajoutés au vocabulaire (`mode_games`, `games_total`,
  `social_link_min_rank`). `tests/php/ConditionCheckTest.php` (22 tests) +
  `tests/php/BadgeWallpaperCatalogTest.php` (7 tests, dont un qui prouve que chaque
  seuil réel du catalogue est respecté à l'exacte frontière value-1/value), même
  pattern que `DatabaseIntegrationTest.php` — confirmé vert par la CI réelle après
  un aller-retour (un bug de garde-fou sur `social_link_min_rank` a été attrapé et
  corrigé grâce à elle)._
- [ ] **Stratégie assets AOA** (~1,8 Go dans git) — 🎯 _cible 2.1._ Git LFS (**pas** CDN-only/sortir
  les assets du repo — option explicitement écartée, voir AMELIORATIONS.md §1 : casse la
  philosophie "un `git clone` suffit pour jouer", Git LFS reste compatible avec elle). Migration
  des binaires lourds (`.webp`/`.mp3`/`.mp4`) + `scripts/purge_git_history.sh` (prêt, destructif,
  à coordonner) pour purger le poids déjà accumulé + `.gitattributes` LFS. Réencodage AOA en
  parallèle (webp q70 : 37-81 Mo → 9-25 Mo par fichier, voir AMELIORATIONS.md §2).

## 📆 À venir — contenu conditionné à une sortie de jeu

> ⚠️ **Ce n'est pas une liste de tâches à faire maintenant.** Rien à faire tant qu'aucun des
> jeux ci-dessous n'a de date/contenu officiel confirmé — c'est la procédure de référence
> pour **le jour où** ça arrive (nouveau perso ajouté, ou remaster d'un jeu déjà supporté),
> pour ne pas avoir à la refaire de mémoire à ce moment-là. Aucune de ces étapes ne bloque
> la release 2.0 actuelle.

**Kotone Shiomi (P5X)** : roster de base + silhouette + persona (Orpheus) + All-Out-Attack
— teaser P5X confirmé. GIF AOA actuel = `allOutAttackMode/database/allOutAttack/Kotone.webp`
(fan-made P3P, à remplacer par l'animation officielle P5X une fois publiée).

![Kotone Shiomi — teaser P5X](img/kotone-p5x.webp)

**Kotone Shiomi (P3/P3P/PQ2) — GIF AOA actuel = fan-made, à remplacer une fois sorti sur P5X** :
portrait/silhouette/persona sont bien de l'artwork officiel (P3P), mais l'animation All-Out-Attack
(`allOutAttackMode/database/allOutAttack/Kotone.webp`) est un **fan-made imaginant un design
"P3 Reload FeMC"** — les jeux originaux (P3/P3P, 2009-2010) n'ont jamais eu de cinématique
All-Out-Attack (mécanique introduite dans des jeux plus récents), donc aucune animation
officielle n'existe pour elle à la source. **P5X va lui en donner une vraie** (même mécanisme que
Fuuka, dont le GIF AOA de ce projet vient de P5X plutôt que de P3 d'origine) — à remplacer une
fois ce contenu P5X publié, pas de date connue.

> ✅ **Incohérence d'opus corrigée (2026-07-06)** : confirmé qu'elle n'apparaît pas dans P3 Reload
> (uniquement P3P) — le tag `"P3R"` de `silhouetteCharacters.js` était bien une confusion avec le
> design du fan-art AOA ci-dessus. `aoaCharacters.js` (`["P3","P3P"]` → `["P3P"]`, PQ2 non
> applicable — absent du vocabulaire d'opus de ce mode) et `silhouetteCharacters.js`
> (`["P3","P3R"]` → `["P3P","PQ2"]`, PQ2 supporté ici) alignés sur `characters_clean.js`.
> `npm run data:check`/`pools:check` ✅ après régénération de `api/data/daily_pools.json`.

Deux cas différents, qui touchent des fichiers différents :

**A. Nouveau jeu de la licence (roster inédit)** — ex. Persona 6, Metaphor: ReFantazio, SMT.
Le jour où un personnage doit être ajouté, toucher dans cet ordre :

1. `database/characters_clean.js` — fiche perso (nom, genre, âge, persona, arcane, opus…)
2. Déposer les assets bruts (portrait, GIFs AOA, musique) dans `incoming/<type>/<persona-snake_case>.<ext>`
   (`type` ∈ `portrait`/`aoa`/`music`/`misc`) puis `npm run ingest:check`
   (`scripts/validate_incoming.js`) — valide le nommage snake_case et l'extension avant
   d'intégrer quoi que ce soit dans `database/`/`<mode>/database/`. Le script valide
   uniquement (pas de renommage/optimisation automatique) — à faire à la main avant dépôt.
3. `database/personas.js` — ajouter le nom à la liste d'autocomplétion (Classic)
4. `database/quotes.js` — citation(s) du perso
5. `database/portraits/*.webp` + `database/portraitsMap.js` — portrait + mapping nom→fichier
6. `allOutAttackMode/database/aoaCharacters.js` + `personas_allOut.js` + `portraitsMap.js` + GIFs — équivalent AOA
7. `silhouetteMode/database/`, `personaeMode/database/`, `musicsMode/database/` — mêmes ajouts côté silhouette/personae/musique si le perso a un thème musical propre
8. `emojiMode` — séquence d'emojis pour le nouveau perso
9. `profile/avatars_data.js` + `img/avatar/` — nouveaux avatars de profil (PDP) groupés par jeu
10. `musicsMode/database/songs.js` + `musicTitles.js` + fichiers audio — OST du nouveau jeu
11. **Filtres opus** — ajouter le nouveau code opus (ex. `"P6"`) au tableau `ALL_OPUS` de **chaque** mode (`classiqueMode`, `emojiMode`, `silhouetteMode`, `personaeMode`, `musicsMode`, `allOutAttackMode`) pour qu'il apparaisse dans le panneau de filtres
12. `npm run data:check` (`scripts/validate_characters.js`) — doit passer sans erreur sur le nouveau roster

**B. Remaster/Revival d'un jeu déjà supporté (assets seulement)** — ex. Persona 4 Revival
(remplace P4/P4G comme Persona 3 Reload a remplacé les artworks P3 d'origine).

1. Mêmes assets bruts déposés dans `incoming/<type>/...` + `npm run ingest:check` avant remplacement (voir cas A, étape 2)
2. Remplacer les portraits (`database/portraits/*.webp`) par le nouvel artwork officiel
3. Remplacer les GIFs AOA correspondants si Atlus republie des animations
4. Vérifier si le nouvel opus doit être **distinct** dans les filtres (`P4R` séparé de `P4`/`P4G`)
   ou **fusionné** (même roster, juste un artwork mis à jour) — décision à prendre au cas par cas
5. Pas de changement sur `personas.js`/`quotes.js` si les personnages restent les mêmes

→ Le jour où ça devient récurrent, envisager un script `scripts/add_character.js` qui
scaffolde les entrées dans tous les fichiers concernés plutôt que de suivre cette liste à la main.

**Jeux à surveiller** (aucune action tant que rien n'est officiellement annoncé) :

<table>
<tr>
<td width="50%" align="center">

<img src="docs/roadmap/persona-4-revival.jpg" width="280" alt="Persona 4 Revival"><br>
<b>Persona 4 Revival</b><br>
Remaster — cas B (remplacement d'assets P4/P4G)

</td>
<td width="50%" align="center">

<img src="docs/roadmap/persona-6.jpg" width="280" alt="Persona 6"><br>
<b>Persona 6</b><br>
Nouveau jeu — cas A (roster inédit)

</td>
</tr>
</table>

### 🟠 Qualité / robustesse

- [x] **Responsive + a11y** des nouvelles modales (avatar, musique, couleurs) — ✅ _livré (`js/modal.js`, focus trap + Escape + restauration du focus, réutilisé par avatarCropModal/sharePreviewModal/songModal/titlesModal). Vérifié en Playwright/Chromium (Tab/Shift+Tab cantonné, crop modal OK en viewport mobile 375px)._
- [x] **Couverture PHP** : tests d'intégration par endpoint critique (`sessions`, `social-links/interact`, `recover-streak`) — ✅ _livré (logique extraite dans `api/lib/game_session.php`/`streak_recovery.php`/`social_link_interaction.php`, endpoints réduits à de fins wrappers, tests dans `tests/php/DatabaseIntegrationTest.php`). Écrit dans un sandbox sans MariaDB/Docker, donc jamais exécuté par la session qui l'a écrit — mais **confirmé vert depuis par la vraie CI** (job "PHP Lint & Tests" → "Run PHPUnit (logic + DB integration)", run [28751031317](https://github.com/HamzaKarrouchi/personadle/actions/runs/28751031317), contre une vraie MariaDB)._
- [x] **Check i18n « valeur == EN »** — ✅ _livré (`scripts/check-i18n-untranslated.js`, `npm run i18n:check-untranslated`, avertissement pre-commit sur `lang/*.json` staged). Premier passage : 0 vraie traduction manquante, uniquement des correspondances attendues (noms, opus, lore, placeholders — voir §5 de CLAUDE.md)._
- [x] **Observabilité prod** — ✅ _livré, option self-hosted choisie (pas de dépendance externe) : table `error_log` (migration 019) + `personadle_log_error()` (`api/lib/error_log.php`) + panel admin "🪵 Logs" (recherche, filtre par niveau, pagination). Câblé dans les 3 endpoints critiques traités ci-dessus (sessions, recover-streak, social-links interact) ; le reste des `error_log()` existants dans le codebase n'a volontairement pas été balayé (portée bien plus large, décision distincte). Pas de handler d'exception global ajouté à bootstrap.php — changerait le comportement de TOUTE l'API sans pouvoir être vérifié en sandbox, jugé trop risqué pour ce lot._
- [x] **Panel admin — contrôle étendu** (audit trail, RGPD, rate limits) — ✅ _livré : table `admin_audit_log` (migration 020) + `personadle_log_admin_action()` câblé sur toutes les mutations admin (ban/unban, grant/revoke admin, badges/titres/wallpapers, event codes, social links, hard delete) + panel "📋 Audit" ; visibilité + déclenchement manuel anticipé des `deletion_requests` RGPD (logique extraite de `api/cron/hard-delete.php` vers `api/lib/deletion_requests.php`, réutilisée par le cron et l'admin) + panel "🗑️ RGPD" ; visibilité + purge manuelle des `rate_limits` + panel "⏱️ Rate Limits". **Confirmé vert par la vraie CI** : `tests-e2e/admin.spec.js` (users/audit_log/rate_limits) + `tests-e2e/admin-extended.spec.js` (event_codes/error_logs/deletion_requests/social_links/dons utilisateur, 24 tests, PR #13) tous exécutés avec succès contre un vrai stack Docker (job "E2E Playwright", run [28751031317](https://github.com/HamzaKarrouchi/personadle/actions/runs/28751031317)). News in-game (actuellement HTML statique sans BDD) volontairement laissée hors scope — portée trop différente pour ce lot._
- [x] **Dédupliquer l'autocomplete et le dark-mode inline entre les 6 modes** — ✅ _déjà résolu pour
  la partie réellement dupliquée : `js/autocomplete.js` extrait `closeAutocompleteList()`,
  `closeAllAutocompleteLists()` et `removeFromAutocomplete()` (identiques à 100% dans les 6 modes),
  et `applyDarkModeOverrides()` (`js/gameCore.js`) est la seule implémentation du dark-mode, chaque
  mode se contentant d'un court appel de config. `initializeAutocomplete()` elle-même reste
  volontairement propre à chaque mode (debounce, cache `_acCurrentArray`/`_acInitDone`, filtres
  opus actifs, chemins de portraits, handler de clic tous divergents entre les modes) — la
  réunifier sans pouvoir vérifier visuellement les 6 pages serait risqué pour un gain incertain._
  _Réaudité le 2026-07-05, relecture complète des 5 implémentations, même conclusion._

### 🟢 Produit (idées — sans version cible pour l'instant)

> **Mode Expert, historique de profil, saison/ladder, compendium des unlocks** : passés en
> 🚀 v2.1 ci-dessus (décision du 2026-07-06) — plus dans cette liste.

- [ ] **Mode Versus / défi temps réel** entre amis — écarté pour la 2.1 (chantier temps réel
  plus lourd que les autres points retenus), reste en idée.
- [ ] 💡 **Groupes d'amis** (au-delà du 1-à-1) — petits groupes ("table du Velvet Room") avec
  leaderboard privé. Étend `friendships`/`leaderboard` au-delà des paires Social Link
  (implique une nouvelle table de groupe + permissions à définir). **En réflexion**, pas
  encore de décision de version.
- [ ] **Notifications push (PWA)** — rappel quotidien (levier de rétention « daily ») — écarté
  pour la 2.1, reste en idée.

### 🔐 Sécurité / compte

- [x] **Reset de mot de passe par email** — ✅ _livré (request-reset / reset-password, token hashé 1h, page dédiée)._
- [ ] **Vérification d'email à l'inscription** (confirmer l'adresse avant activation complète) — 🎯 _cible 2.1._
- [x] **Anti-triche sur les résultats de partie** — 🚧 _phase 1 livrée (détection), phase 2
  (rejet strict) délibérément différée. Correction factuelle au passage : il n'existe **aucune**
  table `daily_targets` en BDD (ni dans `sql/bdd_mysql.sql`, ni dans les migrations) — l'ancienne
  formulation de ce point l'affirmait à tort. Chacun des 6 modes calcule sa cible via un algorithme
  seedé différent (`getDailyTarget()`, FNV-1a sur `seedId|date|mode`), avec un repli conditionnel
  sur le filtre opus actif pour AllOutAttack et Personae — pas une simple lecture de table._
  >
  > `scripts/export-daily-pools.js` exporte les pools JS (source de vérité) vers
  > `api/data/daily_pools.json` (vérifié en CI, `npm run pools:check`) ; `api/lib/daily_target.php`
  > porte l'algorithme FNV-1a et les deux replis conditionnels en PHP (vérifié par comparaison
  > croisée directe avec `getDailyTarget()` sous Node sur des dizaines de combinaisons
  > seed/date/mode/filtre) ; `api/sessions.php` recalcule la cible attendue et logue un écart
  > (`error_log`, source `anti_cheat`) **sans rejeter la requête** — le temps de confirmer en
  > prod l'absence de faux positifs, même principe que le critère "10 runs verts" avant de
  > rendre le job E2E bloquant (`tests-e2e/README.md`). Prérequis découvert et corrigé au passage :
  > `AllOutAttack`/`Personae` n'envoyaient jamais leur filtre opus actif dans `active_filters`
  > (toujours `[]`), rendant la validation de leur repli impossible — corrigé pour qu'ils
  > l'envoient comme le fait déjà Classique.
  >
  > **Phase 2 (rejet strict)** : à activer une fois confirmé en prod (logs `error_log` source
  > `anti_cheat`) que 0 faux positif ne s'est produit sur une période à définir. Distinct du
  > point ❓ ci-dessous (badges à flags) : celui-ci touche l'intégrité des sessions elles-mêmes,
  > donc le leaderboard en entier.
  >
  > ⚠️ **Limitation trouvée en review (PR #13)** : pour AllOutAttack/Personae, `$activeFilters`
  > est accepté tel que soumis par le client sans être corrélé à un état côté serveur (aucune
  > session ne mémorise le filtre opus réellement actif) — un client peut donc soumettre
  > n'importe quel sous-ensemble de codes opus pour faire correspondre le recalcul serveur au
  > nom qu'il veut faire valider, contrairement à Classic/Emoji/Silhouette/Music (pas de repli
  > filtré, donc pas contournables ainsi). À corriger (filtre stocké côté serveur, pas re-soumis
  > par le client) avant d'activer le rejet strict pour ces 2 modes spécifiquement — voir le
  > commentaire en tête de `api/lib/daily_target.php`.

### ❓ Décisions de design à trancher

- [ ] **Abandon casse-t-il le streak ?** Aujourd'hui **non** (streak global = jours _joués_). Beaucoup de daily games cassent au give-up.
- [ ] **Durcir l'anti-triche des badges à flags ?** Crus sur parole — OK fan-game, à durcir si leaderboard « propre » (lié aux conditions structurées).

---

<details>
<summary><b>✅ Déjà livré — historique (v1 → v2.0) — cliquer pour déplier</b></summary>

> Synthèse : backend PHP/MariaDB complet (auth, sessions, social, leaderboard, admin, RGPD),
> profil personnalisable (avatars groupés, musique, couleurs, badges, titres, wallpapers),
> Social Link rangs 1-10, défis, streak globale + Jack Frost, FAQ, i18n 5 langues,
> **514 tests JS · 181 PHPUnit · 54 E2E · PHPStan niveau 5 · CI/CD GitHub Actions**.

### Backend & Infrastructure

| #   | Fonctionnalité                                 | Notes                                                                            |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| B1  | Schéma BDD (23 tables, MySQL/MariaDB)          | `sql/bdd_mysql.sql` = source de vérité + migrations `sql/migrations/` (000→020)   |
| B2  | API auth — register / login / logout / me      | Sessions PHP httpOnly, remember-me hashé, **reset mot de passe** (email)          |
| B3  | API sessions + streak par-mode & **globale**   | Calcul serveur (`api/lib/streak.php`), frontière Paris, contrat de schéma testé   |
| B4  | API user — GET/PATCH/DELETE + stats + migrate  | Migration localStorage→BDD idempotente                                            |
| B5  | Sync offline-first (`savePendingSession`)      | Fallback localStorage si offline                                                  |
| B6  | RGPD — soft delete + anonymisation + hard J+30 | `is_deleted`, `deletion_requests`, cron `hard-delete.php`                         |
| B7  | API amis / leaderboard / social-links          | `api/friends`, `api/leaderboard`, `api/social-links` (XP, anti-spam, mutuel)      |
| B8  | Cloud sync source-of-truth (`cloud-sync.js`)   | `pullProfileFromCloud()` — backend écrase le localStorage                         |
| B9  | Rate-limiting SQL + validation serveur         | Table `rate_limits`, conditions wallpapers/badges validées (anti-triche)         |
| B10 | API Admin (comptes, badges, codes, modération) | `api/admin/` — ban enforcé sur tous les endpoints authentifiés                   |
| B11 | CI/CD GitHub Actions                           | CI (lint, data, i18n, coverage, PHPUnit DB, PHPStan) + **CD auto sur merge main** |

### Système d'Amis & Social Link

| #   | Fonctionnalité                                        | Notes                                                                 |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| S1  | Demandes d'ami (code/pseudo), liste, statut online    | Anti-self, anti-doublon, recherche paginée                            |
| S2  | Social Link rangs 1-10, XP, mutuel ×2, anti-spam      | Logique en PHP pur (`api/lib/social_link.php`, testable sans BDD), **tooltip** d'explication (ex-boutons) |
| S3  | Effet rang 10 — True Confidant                        | Halo doré + burst + typewriter (`css/rank10-effect.css`)              |
| S4  | Comparaison de stats + phrases Persona i18n           | Overlay radar (`database/compare-phrases.js`)                         |
| S5  | Défis quotidiens entre amis (6 modes)                 | Bandeau + post-victoire, give-up = défaite                            |
| S6  | Animations de demande (Calling Card / P4 TV / Evoker) | Choix dans les paramètres                                            |
| S7  | Streak recovery — Jack Frost                          | Cooldown 60j **enforced serveur** (verrou FOR UPDATE), anti-revert    |
| S8  | Rank-up notifié aux **2** joueurs                     | `social_link_rankup_notifs` + polling                                |

### Profil & Personnalisation

| #   | Fonctionnalité                                | Notes                                                                       |
| --- | --------------------------------------------- | --------------------------------------------------------------------------- |
| P1  | Page profil + vue publique (`?view=`/`?uid=`) | Consultable sans login                                                       |
| P2  | Avatars **groupés par jeu** + tags thème      | 168 avatars, en-têtes stylisés (`avatars_data.js`)                          |
| P3  | Musique de profil — **modal visuel** (covers) | Recherchable, groupé par jeu, fallback cover                                |
| P4  | Couleurs **unifiées** + aperçu live           | Bordure avatar + thème en pastilles, preview en direct                      |
| P5  | Badges (60+), titres, wallpapers → backend    | Unlock validé serveur (stats), sélection épinglée persistée + bouton Save   |
| P6  | Carte de profil exportable (PNG)              | `html2canvas`, 8 thèmes, partage X / Discord / Email                        |
| P7  | Cadeaux admin (divine gift), Settings ⚙       | Déduplication des annonces                                                  |

### Leaderboard · Admin · UX

| #   | Fonctionnalité                                  | Notes                                                          |
| --- | ----------------------------------------------- | -------------------------------------------------------------- |
| L1  | Classement mode × période × métrique × scope    | `my_rank` inclus, cron cache, amis-only                        |
| AD1 | Dashboard admin, modération, codes événement    | Accès `is_admin`, attribution badges/titres/wallpapers         |
| U1  | News in-game, page Confidentialité (RGPD)       | i18n 5 langues                                                 |
| U2  | **FAQ enrichie** (32 questions) + bouton report | Report → **GitHub issues** (templates), streak expliqué        |

### Qualité & DevEx

| #   | Élément                                       | Notes                                                                         |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Q1  | Tests : 514 Vitest · 181 PHPUnit · 54 E2E     | `npm test` · `make test-php` · `npm run test:e2e`                             |
| Q2  | i18n EN/FR/ES/DE/IT (978 clés)                | `npm run i18n:check`                                                          |
| Q3  | PHPStan niveau 5 + ESLint + Prettier          | Dans la CI                                                                     |
| Q4  | Seuils de couverture en CI                    | `npm run test:coverage` (~77 %)                                              |
| Q5  | Docker Compose (DB + PHP + phpMyAdmin + seed) | `make up` — 19 faux joueurs                                                   |
| Q6  | Service Worker offline-first, BASE_URL auto   | network-first JS/CSS                                                          |
| Q7  | CI sur push/PR · **CD auto sur merge main**   | `.github/workflows/` (ci.yml + cd.yml)                                        |

</details>
