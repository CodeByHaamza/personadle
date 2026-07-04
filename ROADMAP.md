<div align="center">

# 🗺️ ROADMAP — PersonaDLE

<img src="https://img.shields.io/badge/version-2.0-brightgreen?style=for-the-badge" alt="v2.0">
<img src="https://img.shields.io/badge/prochaine-pré--prod-orange?style=for-the-badge" alt="next">

> **Document vivant.** En haut : ce qui reste à faire (priorisé). En bas : l'historique de ce qui est livré.

</div>

**Légende** — Priorité : 🔴 tôt · 🟠 qualité · 🟢 produit · 🔐 sécurité · ❓ décision &nbsp;|&nbsp; Statut : 📋 planifié · 💡 idée · 🚧 en cours

---

## 🎯 Prochaines étapes

### 🔴 À prévoir assez tôt

- [ ] **Pipeline de contenu** (P4 Revival, P6, Metaphor, SMT) — voir détail juste en dessous.
- [ ] **Conditions badges/wallpapers en colonnes structurées**
  Aujourd'hui texte libre → validation serveur par mapping slug→logique (fragile).
  → Migration `condition_type` / `condition_value` = anti-triche **générique**.
- [ ] **Stratégie assets AOA** (~1,8 Go dans git) — Git LFS **ou** CDN-only + fetch au 1er lancement.
  _(Script `scripts/purge_git_history.sh` prêt pour récupérer l'historique.)_

#### 🎮 Détail — Pipeline de contenu par sortie de jeu

Deux cas différents, qui touchent des fichiers différents :

**A. Nouveau jeu de la licence (roster inédit)** — ex. Persona 6, Metaphor: ReFantazio, SMT.
Ajouter un personnage = toucher, dans cet ordre :

- [ ] `database/characters_clean.js` — fiche perso (nom, genre, âge, persona, arcane, opus…)
- [ ] `database/personas.js` — ajouter le nom à la liste d'autocomplétion (Classic)
- [ ] `database/quotes.js` — citation(s) du perso
- [ ] `database/portraits/*.webp` + `database/portraitsMap.js` — portrait + mapping nom→fichier
- [ ] `allOutAttackMode/database/aoaCharacters.js` + `personas_allOut.js` + `portraitsMap.js` + GIFs — équivalent AOA
- [ ] `silhouetteMode/database/`, `personaeMode/database/`, `musicsMode/database/` — mêmes ajouts côté silhouette/personae/musique si le perso a un thème musical propre
- [ ] `emojiMode` — séquence d'emojis pour le nouveau perso
- [ ] `profile/avatars_data.js` + `img/avatar/` — nouveaux avatars de profil (PDP) groupés par jeu
- [ ] `musicsMode/database/songs.js` + `musicTitles.js` + fichiers audio — OST du nouveau jeu
- [ ] **Filtres opus** — ajouter le nouveau code opus (ex. `"P6"`) au tableau `ALL_OPUS` de **chaque** mode (`classiqueMode`, `emojiMode`, `silhouetteMode`, `personaeMode`, `musicsMode`, `allOutAttackMode`) pour qu'il apparaisse dans le panneau de filtres
- [ ] `npm run data:check` (`scripts/validate_characters.js`) — doit passer sans erreur sur le nouveau roster

**B. Remaster/Revival d'un jeu déjà supporté (assets seulement)** — ex. Persona 4 Revival
(remplace P4/P4G comme Persona 3 Reload a remplacé les artworks P3 d'origine).

- [ ] Remplacer les portraits (`database/portraits/*.webp`) par le nouvel artwork officiel
- [ ] Remplacer les GIFs AOA correspondants si Atlus republie des animations
- [ ] Vérifier si le nouvel opus doit être **distinct** dans les filtres (`P4R` séparé de `P4`/`P4G`)
      ou **fusionné** (même roster, juste un artwork mis à jour) — décision à prendre au cas par cas
- [ ] Pas de changement sur `personas.js`/`quotes.js` si les personnages restent les mêmes

→ Formaliser ça en **checklist réutilisable** (voire un script `scripts/add_character.js` qui
scaffolde les entrées dans tous les fichiers concernés) plutôt que de le refaire de mémoire
à chaque sortie.

**Jeux à surveiller** (photo dès qu'une date/du contenu officiel est confirmé) :

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
- [ ] **Couverture PHP** : tests d'intégration par endpoint critique (`sessions`, `social-links/interact`, `recover-streak`) — 🚧 _code écrit (logique extraite dans `api/lib/game_session.php`/`streak_recovery.php`/`social_link_interaction.php`, endpoints réduits à de fins wrappers, tests ajoutés à `tests/php/DatabaseIntegrationTest.php`), mais non exécuté en sandbox (pas de MariaDB/Docker, `phpunit.phar` bloqué par le proxy réseau). À confirmer via `make up && make test-php` ou la CI._
- [x] **Check i18n « valeur == EN »** — ✅ _livré (`scripts/check-i18n-untranslated.js`, `npm run i18n:check-untranslated`, avertissement pre-commit sur `lang/*.json` staged). Premier passage : 0 vraie traduction manquante, uniquement des correspondances attendues (noms, opus, lore, placeholders — voir §5 de CLAUDE.md)._
- [x] **Observabilité prod** — ✅ _livré, option self-hosted choisie (pas de dépendance externe) : table `error_log` (migration 019) + `personadle_log_error()` (`api/lib/error_log.php`) + panel admin "🪵 Logs" (recherche, filtre par niveau, pagination). Câblé dans les 3 endpoints critiques traités ci-dessus (sessions, recover-streak, social-links interact) ; le reste des `error_log()` existants dans le codebase n'a volontairement pas été balayé (portée bien plus large, décision distincte). Pas de handler d'exception global ajouté à bootstrap.php — changerait le comportement de TOUTE l'API sans pouvoir être vérifié en sandbox, jugé trop risqué pour ce lot._
- [ ] **Panel admin — contrôle étendu** (audit trail, RGPD, rate limits) — 🚧 _code écrit, non exécuté en sandbox (même limitation que la couverture PHP ci-dessus). Livré : table `admin_audit_log` (migration 020) + `personadle_log_admin_action()` câblé sur toutes les mutations admin (ban/unban, grant/revoke admin, badges/titres/wallpapers, event codes, social links, hard delete) + panel "📋 Audit" ; visibilité + déclenchement manuel anticipé des `deletion_requests` RGPD (logique extraite de `api/cron/hard-delete.php` vers `api/lib/deletion_requests.php`, réutilisée par le cron et l'admin) + panel "🗑️ RGPD" ; visibilité + purge manuelle des `rate_limits` + panel "⏱️ Rate Limits". Vérifié en Playwright (3 panels, exclusivité mutuelle, 0 erreur page) + `php -l` sur tous les fichiers touchés. Tests PHPUnit ajoutés (`DatabaseIntegrationTest.php`) mais non exécutés — à confirmer via `make up && make test-php`. News in-game (actuellement HTML statique sans BDD) volontairement laissée hors scope — portée trop différente pour ce lot._

### 🟢 Produit (idées)

- [ ] **Mode Versus / défi temps réel** entre amis.
- [ ] **Historique de profil** : graphe de streak + calendrier des jours joués (on a déjà `uniqueDaysSet`).
- [ ] **Saison / ladder** avec reset périodique + récompenses.
- [ ] 💡 **Mode Expert / New Game+** — moins d'essais autorisés ou moins d'indices affichés,
  avec un badge dédié à la clé. Rejoue de la valeur pour les joueurs qui maîtrisent déjà le jeu.
- [ ] 💡 **Compendium des unlocks** — vue "archive" style Persona de tous les badges/titres/
  wallpapers débloqués avec leur date. Réutilise `badges_unlocked`/`user_titles` déjà en base,
  pas de nouvelle donnée serveur nécessaire.
- [ ] 💡 **Groupes d'amis** (au-delà du 1-à-1) — petits groupes ("table du Velvet Room") avec
  leaderboard privé. Étend `friendships`/`leaderboard` au-delà des paires Social Link
  (implique une nouvelle table de groupe + permissions à définir).
- [ ] **Notifications push (PWA)** — rappel quotidien (levier de rétention « daily »).

### 🔐 Sécurité / compte

- [x] **Reset de mot de passe par email** — ✅ _livré (request-reset / reset-password, token hashé 1h, page dédiée)._
- [ ] **Vérification d'email à l'inscription** (confirmer l'adresse avant activation complète).

### ❓ Décisions de design à trancher

- [ ] **Abandon casse-t-il le streak ?** Aujourd'hui **non** (streak global = jours _joués_). Beaucoup de daily games cassent au give-up.
- [ ] **Durcir l'anti-triche des badges à flags ?** Crus sur parole — OK fan-game, à durcir si leaderboard « propre » (lié aux conditions structurées).

---

<details>
<summary><b>✅ Déjà livré — historique (v1 → v2.0) — cliquer pour déplier</b></summary>

> Synthèse : backend PHP/MariaDB complet (auth, sessions, social, leaderboard, admin, RGPD),
> profil personnalisable (avatars groupés, musique, couleurs, badges, titres, wallpapers),
> Social Link rangs 1-10, défis, streak globale + Jack Frost, FAQ, i18n 5 langues,
> **260 tests JS · 20 PHPUnit · 7 E2E · PHPStan niveau 5 · CI/CD GitHub Actions**.

### Backend & Infrastructure

| #   | Fonctionnalité                                 | Notes                                                                            |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| B1  | Schéma BDD (21 tables, MySQL/MariaDB)          | `sql/bdd_mysql.sql` = source de vérité + migrations `sql/migrations/` (000→018)   |
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
| S2  | Social Link rangs 1-10, XP, mutuel ×2, anti-spam      | Procédure SQL, **tooltip** d'explication (ex-boutons)                  |
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
| Q1  | Tests : 260 Vitest · 20 PHPUnit · 7 E2E       | `npm test` · `make test-php` · `npm run test:e2e`                             |
| Q2  | i18n EN/FR/ES/DE/IT (~920 clés)               | `npm run i18n:check`                                                          |
| Q3  | PHPStan niveau 5 + ESLint + Prettier          | Dans la CI                                                                     |
| Q4  | Seuils de couverture en CI                    | `npm run test:coverage` (~77 %)                                              |
| Q5  | Docker Compose (DB + PHP + phpMyAdmin + seed) | `make up` — 19 faux joueurs                                                   |
| Q6  | Service Worker offline-first, BASE_URL auto   | network-first JS/CSS                                                          |
| Q7  | CI sur push/PR · **CD auto sur merge main**   | `.github/workflows/` (ci.yml + cd.yml)                                        |

</details>
