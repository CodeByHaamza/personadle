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
| B1 | Schéma BDD 20 tables (MySQL/MariaDB) | ✅ | `sql/bdd_mysql.sql` + migrations 001→009 |
| B2 | API auth — register, login, logout, me | ✅ | Sessions PHP httpOnly, `is_admin` dans réponse |
| B3 | API sessions — POST /api/sessions + streaks | ✅ | Calcul streak côté serveur |
| B4 | API user — GET/PATCH/DELETE + stats + migrate | ✅ | Migration localStorage→BDD |
| B5 | Sync offline-first (`savePendingSession`) | ✅ | Fallback localStorage si offline |
| B6 | RGPD — soft delete + anonymisation | ✅ | `is_deleted`, `deletion_requests` |
| B7 | API amis — GET/POST/PATCH/DELETE | ✅ | `api/friends/index.php` |
| B8 | API leaderboard — par mode/période/métrique | ✅ | `api/leaderboard/index.php` |
| B9 | Déploiement MariaDB chez Hostinger | ✅ | 20 tables + seeds + procédure `gain_social_link_xp` importés via SSH MariaDB CLI |
| B10 | Cloud sync source-of-truth (`cloud-sync.js`) | ✅ | `pullProfileFromCloud()` — backend écrase tout le localStorage |
| B11 | Cron `leaderboard_cache` — recalcul périodique | ✅ | `api/cron/leaderboard.php` — scores depuis `game_sessions` filtrés par période |
| B12 | RGPD — hard delete J+30 (cron côté serveur) | ✅ | `api/cron/hard-delete.php` — DELETE CASCADE + log `processed_at` |
| B13 | API streak recovery (`recover-streak.php`) | ✅ | `POST /api/user/recover-streak` |
| B14 | API Social Link rang-up notifs | ✅ | Table `social_link_rankup_notifs` (migration 009), `GET /api/social-links/rankup-notifs` |
| B15 | API Admin — gestion comptes, badges, stats | ✅ | `api/admin/` — users, user_badges, user_wallpapers, user_titles, user_stats, social_links |
| B16 | CI/CD GitHub Actions | 📋 | Voir Q8 + Q9 dans section Qualité & DevEx |

---

## Système d'Amis

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| A1 | Envoi / acceptation / refus de demande d'ami | ✅ | Via friend_code |
| A2 | Liste d'amis avec dots online/offline | ✅ | `last_login_at` < 30min |
| A3 | Recherche de joueurs (pseudo/code) | ✅ | Paginée |
| A4 | Add by friend code (inline, sans rechargement) | ✅ | — |
| A5 | Suppression d'ami | ✅ | DELETE /api/friends/:id |
| A6 | Social Link — XP + rangs 1-10 | ✅ | XP, jauge, flamme, toast rang-up |
| A7 | Interactions mutuelles (2× XP), anti-spam | ✅ | Procédure SQL |
| A8 | Effet rang 10 — True Confidant | ✅ | Badge canvas supprimé — remplacé par halo doré + icône ✦ + animation burst/typewriter sur profil et liste amis (`css/rank10-effect.css`, `js/social-link.js`) |
| A9 | Comparaison stats côte à côte | ✅ | Overlay radar + phrases Persona i18n (`database/compare-phrases.js`) |
| A10 | Défis entre amis (6 modes, filtres, anti-doublon) | ✅ | Bandeau + bouton post-victoire, give-up = défaite |
| A11 | Sélecteur style animation demandes d'amis | ✅ | 🃏 Calling Card / 📺 P4 TV / 🔫 P3 Evoker |
| A12 | Animation TV Persona 4 — demandes d'amis | ✅ | CSS pur, CRT noise canvas, burst avatar, idle glow |
| A13 | Streak recovery — menu Jack Frost | ✅ | Cooldown 2 mois, sync BDD, badge `reborn_phoenix` |
| A14 | Animation Evoker Persona 3 — demandes d'amis | ✅ | `js/p3-evoker-anim.js` + `css/p3-evoker-anim.css` |
| A15 | Social Link rank-up animation pour les 2 joueurs | ✅ | Backend notifs + polling `notifications.js`, guard `seen_at` |

---

## Leaderboard

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| L1 | Classement global + par mode (7 modes) | ✅ | — |
| L2 | Périodes : ever / month / week / day | ✅ | Requêtes directes `user_stats` / `game_sessions` |
| L3 | Métriques : wins / winrate / streak / perfect / games | ✅ | — |
| L4 | Bandeau "Mon classement" | ✅ | `my_rank` dans réponse API |
| L5 | Chips filtres actifs | ✅ | — |
| L6 | Pagination 50 par page | ✅ | — |
| L7 | Classement entre amis uniquement | ✅ | Toggle Global / Friends, filtre SQL |
| L8 | Cron cache (optimisation perf) | ✅ | `api/cron/leaderboard.php` — voir B11 |

---

## Profil & Personnalisation

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| P1 | Page profil dédiée (avatar, badges, stats, thèmes) | ✅ | `profile/profile.html` + `profile-page.js` |
| P2 | Migration localStorage → cloud | ✅ | `migrate.php`, idempotent |
| P3 | Stats communautaires post-partie | ✅ | `showCommunityStats()` dans les 6 modes, `api/community-stats.php` |
| P4 | Social Link rank-up animation — tiers 1→10 | ✅ | Tier1/2/3/rank10, typewriter, phrases multilingues, avatars |
| P5 | Page de profil consultable (vue publique) | ✅ | `profile-view.js` — thème, musique, Add Friend, Compare, jauge SL |
| P6 | Titres / rangs joueur | ✅ | Catalogue BDD, `GET /api/titles`, unlock + équipement frontend (migration 006) |
| P7 | Badges → backend | ✅ | 60 badges, `GET /api/badges`, unlock validé contre catalogue (migration 007) |
| P8 | Wallpapers → backend | ✅ | 7 wallpapers, `GET /api/wallpapers`, FK fonctionnelle (migration 007) |
| P9 | Musique de profil | ✅ | Sélecteur + prévisualisation + lecture sur profil perso et public |
| P10 | Animation cadeaux admin (divine gift) | ✅ | `js/divine-gift.js` + `css/divine-gift.css`, déduplication `_announcedGiftIds` |
| P11 | Bouton Settings ⚙ intégré à la pill dark mode | ✅ | Plus de superposition sur la page profil |
| P12 | Page de profil partageable (image exportable) | ✅ | `html2canvas` → PNG, 8 thèmes + 25 wallpapers, Download / X / Discord / Email |

---

## Administration

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| AD1 | Dashboard admin (`/admin`) | ✅ | Layout 2 panneaux, accès restreint `is_admin` |
| AD2 | Statistiques globales (DAU, parties/jour, taux victoire) | ✅ | Agrégats depuis `game_sessions` + `users` |
| AD3 | Gestion des comptes (recherche, édition, soft-delete) | ✅ | `api/admin/users.php` + `user.php` |
| AD4 | Attribution badges / wallpapers / titres à un user | ✅ | Grille visuelle, clic → queue → FAB apply, toasts |
| AD5 | Édition stats manuelles (streak, wins…) | ✅ | `api/admin/user_stats.php` |
| AD6 | Gestion Social Links depuis admin | ✅ | `api/admin/social_links.php` |
| AD7 | Annonce / bannière in-game | ✅ | Modale News dans `index.html` — bannière v2.0 (thème Sophia, orbs animés, lien changelog) |
| AD8 | Gestion des codes événement (CRUD + stats usage) | ✅ | Table `event_codes` (migration 011), `api/admin/event_codes.php`, bouton 🎟️ Codes dans admin |
| AD9 | Modération des pseudos (bannissement + verrou pseudo) | ✅ | Colonnes `is_banned`/`pseudo_locked` (migration 011), section Modération dans tab Profil admin, login vérifie `is_banned`, API user vérifie `pseudo_locked` |

---

## Corrections & Qualité (session mai 2026)

| # | Fix | Statut | Notes |
|---|-----|--------|-------|
| FQ1 | Badge Golden Week rejoué à chaque chargement | ✅ | `checkEventBadges` mutait localStorage mais pas le profil en mémoire → `saveProfile()` l'effaçait |
| FQ2 | `syncBadgesWithBackend` réanimait des badges connus après logout | ✅ | `_seenBadgeAnimIds` localStorage key (hors profil, survit aux resets) |
| FQ3 | Animation cadeau admin rejouée pour des items déjà possédés | ✅ | `_announcedGiftIds` dans `cloud-sync.js` |
| FQ4 | Social Link rank-up visible uniquement chez le déclencheur | ✅ | Backend `social_link_rankup_notifs` + polling bidirectionnel |
| FQ5 | Avatar ami absent dans l'animation rank-up | ✅ | `_normalizeSrc()` unifié + `profile.avatar_data` (pas `user.avatar_data`) |
| FQ6 | Badge `one_shot` jamais déclenché (Emoji/Silhouette/Personae/Music) | ✅ | `hasWonFirstTry` ajouté dans les 4 modes manquants — Classic l'avait déjà |
| FQ7 | Auto-replay absent sur changement de filtre (Classic + Emoji) | ✅ | Classic : `resetButton.click()` ; Emoji : `resetGame()` dans `onFilterChange` |
| FQ8 | Animation défi rejouée après changement de compte | ✅ | `localStorage.removeItem('_crInitDone')` dans `auth.js` au login et register |
| FQ9 | `default_avatar.png` 404 depuis `index.html` | ✅ | `_imgBase()` ajouté dans `challenge-result.js` — même pattern que les autres modules |
| FQ10 | Streak gelée à 0 sans accès au menu Jack Frost | ✅ | Clic sur `.stat-streak` quand `streak===0 && canRecover()` → `showStreakRecoveryMenu()` |

---

## Nouveau Contenu

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| C1 | Personnages P5X (nouveaux) | 💡 | À valider selon avancement du jeu |
| C2 | Nouveaux opus P1 / P2 EP | 💡 | Données manquantes |
| C3 | Mode Quotes — deviner le perso depuis une réplique | 💡 | `database/quotes.js` déjà structuré (EN uniquement) |
| C4 | Mode Daily Challenge — limite globale de tentatives | 💡 | Classement distinct |
| C5 | Nouvelles musiques P5X / P3R | 📋 | À sourcer et intégrer dans `musicsMode` |
| C6 | Portraits manquants (Amenosagiri, Nyx…) | ✅ | 168 mappings complets dans `portraitsMap.js` — tous les personnages couverts |

---

## UX & Pages Annexes

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| U1 | Section News / Patch Notes in-game | ✅ | Bannière v2.0 dans la modale News (`index.html`) — thème Sophia, orbs animés orange/blanc, lien changelog HTML |
| U2 | Page Confidentialité (`/privacy.html`) | ✅ | `privacy.html` + `privacy.css` + i18n 5 langues, lien footer + formulaire inscription |
| U3 | FAQ (accordion sur index ou page dédiée) | 💡 | — |
| U4 | Partage de score / streak sur réseaux sociaux | 💡 | Image canvas générée côté client |

---

## Qualité & DevEx

| # | Fonctionnalité | Statut | Notes |
|---|---------------|--------|-------|
| Q1 | Tests unitaires Vitest (190 tests passants) | ✅ | `npm test` |
| Q2 | i18n EN/FR/ES/DE/IT (760 clés + phrases compare) | ✅ | `npm run i18n:check` |
| Q3 | Service Worker — network-first JS/CSS | ✅ | SW v72, précache 40+ assets |
| Q4 | Offline-first (fallback gracieux) | ✅ | SW + `savePendingSession` |
| Q5 | BASE_URL API auto-détecté (Apache local + prod) | ✅ | `pathname.startsWith('/personadle/')` |
| Q6 | Audit responsive complet (360px → 1440px) | ✅ | Tous les modes + profil + leaderboard + friends + admin couverts (3 breakpoints chacun) |
| Q7 | Couverture de tests étendue (4 suites Vitest) | ✅ | `gameCore.test.js` (172) + `backend.test.js` (18) + `i18n.test.js` + `profileStats.test.js` — 190 tests passants |
| Q8 | CI — GitHub Actions | 📋 | **À faire plus tard** — pipeline sur chaque push : `npm test` (Vitest) + `npm run i18n:check` + `php -l` syntaxe PHP. Pas de prérequis git. |
| Q9 | CD — Deploy automatique → Hostinger | 📋 | **À faire plus tard, après Q8** — rsync via SSH ou `git pull` webhook. Prérequis : adopter workflow feature branches → `develop` → `main` = prod. Stocker clé SSH dans GitHub Secrets. |
