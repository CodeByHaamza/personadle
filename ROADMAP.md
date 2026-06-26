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

- [ ] **Pipeline de contenu** (P4 Revival, P6, Metaphor, SMT)
  Ajouter un perso = toucher `characters_clean.js` + `personas.js` + `quotes.js` + portraits + AOA + emojis.
  → Formaliser un **checklist / script** d'ajout (le validateur `npm run data:check` est la base).
- [ ] **Conditions badges/wallpapers en colonnes structurées**
  Aujourd'hui texte libre → validation serveur par mapping slug→logique (fragile).
  → Migration `condition_type` / `condition_value` = anti-triche **générique**.
- [ ] **Stratégie assets AOA** (~1,8 Go dans git) — Git LFS **ou** CDN-only + fetch au 1er lancement.
  _(Script `scripts/purge_git_history.sh` prêt pour récupérer l'historique.)_

### 🟠 Qualité / robustesse

- [ ] **Responsive + a11y** des nouvelles modales (avatar, musique, couleurs) : focus trap + Escape + test mobile.
- [ ] **Couverture PHP** : tests d'intégration par endpoint critique (`sessions`, `social-links/interact`, `recover-streak`).
- [ ] **Check i18n « valeur == EN »** : repérer les clés non traduites (au-delà de la simple présence).
- [ ] **Observabilité prod** : au-delà d'`error_log` — Sentry-like ou table `error_log` + page admin.

### 🟢 Produit (idées)

- [ ] **Mode Versus / défi temps réel** entre amis.
- [ ] **Historique de profil** : graphe de streak + calendrier des jours joués (on a déjà `uniqueDaysSet`).
- [ ] **Saison / ladder** avec reset périodique + récompenses.
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
