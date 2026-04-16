# PersonaDLE — Roadmap

> Fonctionnalités planifiées, en cours ou terminées.  
> Mettre à jour au fil du développement.

---

## Légende

| Icône | Statut |
|-------|--------|
| ✅ | Terminé |
| 🚧 | En cours |
| 📋 | Planifié |
| 💡 | Idée à valider |

---

## Backend & Infrastructure

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| B1 | Schéma BDD 19 tables (MySQL/MariaDB) | ✅ | `sql/bdd_mysql.sql` — wallpapers + messages + procédures SQL |
| B2 | API auth — register, login, logout, me | ✅ | Sessions PHP httpOnly |
| B3 | API sessions — POST /api/sessions + streaks | ✅ | Calcul streak côté serveur |
| B4 | API user — GET/PATCH/DELETE + stats + migrate | ✅ | Migration localStorage→BDD |
| B5 | Sync offline-first (`savePendingSession`) | ✅ | Fallback localStorage si offline |
| B6 | RGPD — soft delete + anonymisation | ✅ | `is_deleted`, `deletion_requests` |
| B7 | API amis — GET/POST/PATCH/DELETE | ✅ | `api/friends/index.php` |
| B8 | API leaderboard — par mode/période/métrique | ✅ | `api/leaderboard/index.php` |
| B9 | Déploiement MariaDB chez Hostinger | 📋 | — |
| B10 | Cron `daily_targets` — personnage du jour serveur | 📋 | Remplace RNG client |
| B11 | Cron `leaderboard_cache` — recalcul périodique | 📋 | Optimise les requêtes classement |
| B12 | RGPD — hard delete J+30 (cron) | 📋 | — |

---

## Système d'Amis

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| A1 | Envoi / acceptation / refus de demande d'ami | ✅ | Via friend_code |
| A2 | Liste d'amis avec dots online/offline | ✅ | `last_login_at` < 30min |
| A3 | Recherche de joueurs | ✅ | Par pseudo, paginée |
| A4 | Add by friend code (inline) | ✅ | Sans rechargement de page |
| A5 | Suppression d'ami | ✅ | DELETE /api/friends/:id |
| A6 | Social Link — XP + rangs 1-10 | ✅ | XP, jauge, toast rang-up, flamme |
| A7 | Interactions mutuelles (2× XP) | ✅ | Anti-spam, procédure SQL |
| A8 | True Confidant Badge (rang 10) | 📋 | Badge avatars fusionnés |
| A9 | Comparaison stats côte à côte | 📋 | Sur la page Friends |
| A10 | Défis entre amis | ✅ | Bandeau + bouton post-victoire 6 modes |

---

## Leaderboard

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| L1 | Classement global + par mode | ✅ | 7 modes |
| L2 | Périodes : ever / month / week / day | ✅ | Requêtes directes user_stats |
| L3 | Métriques : wins / winrate / streak / perfect / games | ✅ | — |
| L4 | Bandeau "Mon classement" | ✅ | `my_rank` dans réponse API |
| L5 | Filter note (chips actifs) | ✅ | — |
| L6 | Pagination 50 par page | ✅ | — |
| L7 | Classement entre amis uniquement | 📋 | Filtrer sur ses amis |
| L8 | Cron cache (optimisation J+) | 📋 | Table `leaderboard_cache` |

---

## Profil & Personnalisation

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| P1 | Profil local (avatar, badges, stats) | ✅ | localStorage |
| P2 | Migration localStorage → cloud | ✅ | `migrate.php`, idempotent |
| P3 | Page profil publique | 📋 | Accessible via `?view=FRIENDCODE` |
| P4 | Titres / rangs joueur | 📋 | Voir CLAUDE.md §5.10 |
| P5 | Badges → backend (anti-triche) | 📋 | Unlock vérifié côté serveur |
| P6 | Wallpapers → backend | 📋 | Même logique que badges |
| P7 | Musique de profil | 📋 | Jouée sur la page profil |
| P8 | Page Admin — modération & stats globales | 📋 | Voir section Admin ci-dessous |

---

## Administration

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| AD1 | Dashboard admin (`/admin`) | 📋 | Accès restreint (rôle admin) |
| AD2 | Statistiques globales (DAU, parties/jour, taux victoire) | 📋 | Agrégats depuis `game_sessions` |
| AD3 | Gestion des comptes (recherche, soft-delete manuel) | 📋 | — |
| AD4 | Gestion des codes événement | 📋 | CRUD `event_codes` + stats usage |
| AD5 | Annonce / bannière in-game | 📋 | Pour patch notes ou événements |
| AD6 | Modération des pseudos | 📋 | Blocage / renommage forcé |

---

## Nouveau Contenu

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| C1 | Personnages P5X (nouveaux) | 💡 | À valider selon sortie du jeu |
| C2 | Nouveaux opus P1 / P2 EP | 💡 | Données manquantes |
| C3 | Mode Quotes — deviner le perso depuis une réplique | 💡 | `database/quotes.js` déjà structuré |
| C4 | Mode Daily Challenge — limite de tentatives globale | 💡 | Classement distinct |
| C5 | Nouvelles musiques P5X / P3R | 📋 | À sourcer |
| C6 | Portraits manquants (Amenosagiri, Nyx…) | 🚧 | Fichiers présents, mapping à faire |
| C7 | Traductions JP | 📋 | Post-v2.0, relecture native requise |

---

## Qualité & DevEx

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| Q1 | 120 tests unitaires Vitest (tous passants) | ✅ | `npm test` |
| Q2 | i18n complet EN/FR/ES/DE/IT (545 clés) | ✅ | `npm run i18n:check` |
| Q3 | Service Worker — JS/CSS network-first (plus de Ctrl+Shift+R) | ✅ | SW v16 |
| Q4 | Offline-first (fallback gracieux) | ✅ | SW v16 |
| Q5 | BASE_URL API auto-détecté (Apache local + Docker) | ✅ | Détection `pathname.startsWith('/personadle/')` |
| Q6 | Audit responsive complet | 📋 | 360px → 1440px |
| Q7 | Tests E2E (Playwright ou Cypress) | 💡 | Post-v2.0 |
| Q8 | CI/CD (GitHub Actions → Hostinger) | 📋 | Deploy automatique sur push `main` |
