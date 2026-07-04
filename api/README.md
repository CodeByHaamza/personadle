<div align="center">

# ⚙️ API REST

<img src="https://img.shields.io/badge/PHP-8.3-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP 8.3">
<img src="https://img.shields.io/badge/MariaDB-10.6%2B-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB">
<img src="https://img.shields.io/badge/Auth-bcrypt%20%2B%20sessions-success?style=for-the-badge" alt="Auth">
<img src="https://img.shields.io/badge/PDO-prepared%20only-blue?style=for-the-badge" alt="PDO">

> **Backend REST PHP 8.3 — authentification, sessions, social, classements.**
> Pas de JWT : sessions PHP `httpOnly`. Zéro concaténation SQL : PDO partout.

</div>

---

## 🔄 Flux d'une requête

```
  Navigateur                Apache (.htaccess)            Endpoint PHP
  ──────────                ──────────────────            ────────────
  fetch('/api/…',     ──▶   RewriteRule → fichier   ──▶   require bootstrap.php
   credentials:                                              │ CORS (origines exactes)
   'include')                                                │ PDO singleton
                                                             │ session_start (httpOnly)
                                                             │ requireAuth() → 401/403
                                                             ▼
                                                          requête PDO préparée
                                                             │
       JSON  ◀──────────────────────────────────────  jsonSuccess() / jsonError()
     {data}|{error}                                       + bon code HTTP
```

---

## Structure

```
api/
├── bootstrap.php           ← PDO singleton, CORS, helpers JSON, requireAuth(), requireCsrf(), requireCronSecret()
├── config.php              ← Identifiants BDD (gitignored)
├── config.example.php      ← Template à copier (local + Hostinger)
├── config.docker.php       ← Config pour Docker
├── sessions.php            ← POST /api/sessions
├── community-stats.php     ← GET /api/community-stats
├── .htaccess               ← Routing Apache
│
├── lib/                    ← Logique pure/testable sans BDD, extraite des endpoints
│   ├── admin_audit.php, admin_validation.php, authz.php, deletion_requests.php
│   ├── error_log.php, format.php, friends.php, game_session.php
│   ├── social_link.php, social_link_interaction.php, streak.php
│   ├── streak_recovery.php, validation.php
│
├── auth/                   ← Authentification
│   ├── register.php        ← POST /api/auth/register
│   ├── login.php           ← POST /api/auth/login
│   ├── logout.php          ← POST /api/auth/logout
│   ├── me.php               ← GET /api/auth/me
│   ├── request-reset.php   ← POST /api/auth/request-reset (rate-limité)
│   └── reset-password.php  ← POST /api/auth/reset-password (rate-limité)
│
├── user/                   ← Profil utilisateur
│   ├── index.php           ← GET / PATCH / DELETE /api/user/:id
│   ├── stats.php           ← GET /api/user/:id/stats
│   ├── migrate.php         ← POST /api/user/migrate
│   ├── compare.php         ← GET /api/user/compare?friend_id=
│   ├── recover-streak.php  ← POST /api/user/recover-streak
│   ├── list.php            ← GET /api/user/list (browse players)
│   ├── search.php          ← GET /api/user/search?q=
│   └── public.php          ← GET /api/user/public?code=|pseudo=|id=
│
├── friends/                ← Système d'amis
│   └── index.php           ← GET / POST / PATCH / DELETE /api/friends
│
├── messages/               ← Messages & défis quotidiens
│   └── index.php           ← GET / POST / PATCH / DELETE /api/messages
│
├── social-links/           ← Social Link XP & rangs
│   └── index.php           ← GET /api/social-links/:linkId, GET /by-friend/:id, GET /rankup-notifs, POST /by-friend/:id/interact
│
├── leaderboard/            ← Classements
│   └── index.php           ← GET /api/leaderboard
│
├── badges/                 ← Catalogue badges
│   └── index.php           ← GET /api/badges + POST /api/badges/unlock + POST /api/badges/redeem
│
├── wallpapers/             ← Catalogue wallpapers
│   └── index.php           ← GET /api/wallpapers
│
├── titles/                 ← Titres joueur
│   └── index.php           ← GET /api/titles + POST /api/titles/unlock
│
├── notifications/          ← Notifications
│   └── index.php           ← GET / PATCH /api/notifications
│
├── admin/                  ← Panneau d'administration (is_admin requis) — routes au PLURIEL
│   ├── users.php           ← GET /api/admin/users
│   ├── user.php            ← GET / PATCH / DELETE /api/admin/users/:id
│   ├── user_stats.php      ← PATCH /api/admin/users/:id/stats
│   ├── user_badges.php     ← POST / DELETE /api/admin/users/:id/badges
│   ├── user_titles.php     ← POST / PATCH / DELETE /api/admin/users/:id/titles
│   ├── user_wallpapers.php ← POST / DELETE /api/admin/users/:id/wallpapers
│   ├── user_friends.php    ← DELETE /api/admin/users/:id/friends
│   ├── social_links.php    ← GET / PATCH / DELETE /api/admin/social-links[/:id]
│   ├── event_codes.php     ← CRUD /api/admin/event_codes (underscore, pas de tiret)
│   ├── error_logs.php      ← GET /api/admin/error_logs
│   ├── audit_log.php       ← GET /api/admin/audit_log
│   ├── deletion_requests.php ← GET / POST /api/admin/deletion_requests (POST = déclenchement manuel du hard delete)
│   └── rate_limits.php     ← GET / DELETE /api/admin/rate_limits
│
└── cron/                   ← Tâches planifiées (auth par header X-Cron-Key, pas en query string)
    ├── leaderboard.php     ← Recalcul périodique du leaderboard_cache
    ├── hard-delete.php     ← Suppression RGPD définitive (J+30)
    └── purge-rate-limits.php ← Purge des fenêtres de rate-limit expirées
```

> Les migrations SQL incrémentales vivent dans `sql/migrations/` (pas `api/migrations/`, qui n'existe pas).

---

## Endpoints

### Auth

| Méthode | Endpoint             | Description                                          |
| ------- | -------------------- | ---------------------------------------------------- |
| `POST`  | `/api/auth/register` | Inscription — email + pseudo + mot de passe (bcrypt) |
| `POST`  | `/api/auth/login`    | Connexion — session PHP httpOnly                     |
| `POST`  | `/api/auth/logout`   | Déconnexion — destruction session                    |
| `GET`   | `/api/auth/me`       | Profil courant (requiert session active)             |
| `POST`  | `/api/auth/request-reset` | Demande de reset mot de passe (rate-limité, anti-énumération) |
| `POST`  | `/api/auth/reset-password` | Applique le nouveau mot de passe via le token reçu (rate-limité) |

### Sessions & Stats communautaires

| Méthode | Endpoint               | Description                                                     |
| ------- | ---------------------- | --------------------------------------------------------------- |
| `POST`  | `/api/sessions`        | Enregistrer une partie — calcule streaks, incrémente user_stats |
| `GET`   | `/api/community-stats` | % joueurs ayant trouvé le personnage du jour                    |

### Utilisateur

| Méthode  | Endpoint                       | Description                                           |
| -------- | ------------------------------ | ----------------------------------------------------- |
| `GET`    | `/api/user/:id`                | Profil complet (soi-même) ou public restreint (tiers) |
| `PATCH`  | `/api/user/:id`                | Modifier pseudo, avatar, wallpaper, musique, titre…   |
| `DELETE` | `/api/user/:id`                | Soft delete + anonymisation RGPD immédiate            |
| `GET`    | `/api/user/:id/stats`          | Stats par mode (wins, streak, perfect, games)         |
| `POST`   | `/api/user/migrate`            | Importer localStorage → BDD (idempotent)              |
| `GET`    | `/api/user/compare?friend_id=` | Comparaison stats + XP Social Link avec un ami (cooldown 72h) |
| `POST`   | `/api/user/recover-streak`     | Restaurer une streak perdue (cooldown 60 jours enforced serveur) |
| `GET`    | `/api/user/list`               | Liste paginée de tous les joueurs                     |
| `GET`    | `/api/user/search?q=`          | Recherche par pseudo ou code ami                      |
| `GET`    | `/api/user/public?code=\|pseudo=\|id=` | Profil public (pseudo, avatar, border, badges, titre) |

### Amis

| Méthode  | Endpoint           | Description                     |
| -------- | ------------------ | ------------------------------- |
| `GET`    | `/api/friends`     | Liste d'amis avec statut online |
| `POST`   | `/api/friends`     | Envoyer une demande d'ami       |
| `PATCH`  | `/api/friends/:id` | Accepter ou refuser une demande |
| `DELETE` | `/api/friends/:id` | Supprimer un ami                |

### Messages & Défis

| Méthode  | Endpoint            | Description                                |
| -------- | ------------------- | ------------------------------------------ |
| `GET`    | `/api/messages`     | Liste des messages et défis reçus          |
| `POST`   | `/api/messages`     | Envoyer un défi quotidien (mode + filtres) |
| `PATCH`  | `/api/messages/:id` | Marquer comme lu / résolu                  |
| `DELETE` | `/api/messages/:id` | Supprimer un message                       |

### Social Link

| Méthode | Endpoint                              | Description                                    |
| ------- | -------------------------------------- | ---------------------------------------------- |
| `GET`   | `/api/social-links/:linkId`            | Détail d'un Social Link par son id (numérique)  |
| `GET`   | `/api/social-links/by-friend/:friendId`| Récupère (ou crée) le Social Link avec un ami   |
| `GET`   | `/api/social-links/rankup-notifs`      | Notifications de montée de rang en attente      |
| `POST`  | `/api/social-links/by-friend/:friendId/interact` | Gagner de l'XP (action type, mutuel ×2) — l'ancienne route `POST /:linkId/interact` a été retirée |

### Leaderboard

| Méthode | Endpoint           | Description                            |
| ------- | ------------------ | -------------------------------------- |
| `GET`   | `/api/leaderboard` | Classement filtré, ma position incluse |

Paramètres : `mode` · `period` (`day` / `week` / `month` / `ever`) · `metric` (`wins` / `winrate` / `streak` / `perfect` / `games`) · `friends_only` (0/1) · `limit` · `offset`

Réponse : `{ mode, period, metric, entries: [...], my_rank, count, offset, limit }`

### Badges, Wallpapers, Titres

| Méthode | Endpoint             | Description                                            |
| ------- | -------------------- | ------------------------------------------------------ |
| `GET`   | `/api/badges`        | Catalogue complet (60 badges) + déblocages utilisateur |
| `POST`  | `/api/badges/unlock` | Persiste le déblocage d'un badge (conditions vérifiées côté client, fire-and-forget) |
| `POST`  | `/api/badges/redeem` | Echanger un code événement → débloquer un badge        |
| `GET`   | `/api/wallpapers`    | Catalogue wallpapers disponibles                       |
| `GET`   | `/api/titles`        | Catalogue titres                                       |
| `POST`  | `/api/titles/unlock` | Débloquer un titre (conditions vérifiées côté serveur) |

### Admin _(is_admin = 1 requis, routes au PLURIEL)_

| Méthode              | Endpoint                            | Description                                             |
| --------------------- | ------------------------------------ | ------------------------------------------------------- |
| `GET`                 | `/api/admin/users`                   | Liste paginée avec stats et statut                      |
| `GET / PATCH / DELETE`| `/api/admin/users/:id`               | Voir / modifier / supprimer un compte (ban, pseudo_locked) |
| `PATCH`               | `/api/admin/users/:id/stats`         | Écraser les stats par mode                              |
| `POST / DELETE`       | `/api/admin/users/:id/badges`        | Attribution / révocation de badges (pas de GET)         |
| `POST / PATCH / DELETE` | `/api/admin/users/:id/titles`      | Attribution / équipement / révocation de titres         |
| `POST / DELETE`       | `/api/admin/users/:id/wallpapers`    | Attribution / révocation de wallpapers (pas de GET)     |
| `DELETE`              | `/api/admin/users/:id/friends`       | Suppression forcée d'une amitié (uniquement)            |
| `GET / PATCH / DELETE`| `/api/admin/social-links[/:id]`      | Liste / détail / édition / suppression des Social Links |
| `GET/POST/PATCH/DELETE` | `/api/admin/event_codes`           | CRUD codes événement (underscore, pas de tiret)         |
| `GET`                 | `/api/admin/error_logs`              | Journal des erreurs applicatives (paginé)                |
| `GET`                 | `/api/admin/audit_log`               | Journal des actions admin (paginé)                       |
| `GET / POST`          | `/api/admin/deletion_requests`       | Suivi RGPD + déclenchement manuel du hard delete (POST)  |
| `GET / DELETE`        | `/api/admin/rate_limits`             | Consultation + purge manuelle des compteurs              |

---

## Bootstrap

`bootstrap.php` est inclus en tête de chaque endpoint. Il fournit :

```php
$pdo = pdo();             // PDO singleton — exception si connexion impossible

$uid = requireAuth();     // 401 si pas de session · 403 si compte banni · retourne l'id
$uid = requireAdmin();    // idem + exige is_admin = 1

jsonSuccess($data, 201);  // {"data": ...}  + code HTTP
jsonError('message', 400);// {"error": "..."} + code HTTP

rateLimit('login:'.$ip, 5, 900); // 429 au-delà du quota (table rate_limits)
```

Sécurité activée automatiquement :

- **CORS** : whitelist d'origines exactes (pas de wildcard quand `credentials: include`)
- **Headers** : `Content-Security-Policy`, `Strict-Transport-Security` (prod), `X-Frame-Options`, `X-Content-Type-Options`
- **Rate limiting** : table SQL `rate_limits` (helper `rateLimit()`, partagé entre instances) — login 5/15 min, register 5/15 min, sessions 15/15 min
- **Erreurs** : `display_errors` coupé en prod (`log_errors` seul) — pas de fuite de stack trace

---

## Configuration

Copier `config.example.php` → `config.php` et renseigner :

```php
define('DB_HOST',  'localhost');
define('DB_NAME',  'personadle');
define('DB_USER',  'personadle_user');
define('DB_PASS',  'your_password');
define('CRON_SECRET', 'your_cron_secret'); // vérifié via le header X-Cron-Key
```

> `ALLOWED_ORIGINS` n'est **pas** une constante de config — la liste des origines CORS
> autorisées est codée en dur directement dans `bootstrap.php`.

---

## Migrations

> 📌 **Source de vérité** : `sql/bdd_mysql.sql` (schéma complet) + `sql/migrations/` (incrémentales).
> Il n'existe **pas** de dossier `api/migrations/` — les migrations SQL vivent uniquement
> dans `sql/migrations/`.

Les migrations sont des fichiers SQL numérotés. Elles sont **incrémentales**.

> ⚠️ Pour les procédures stockées MariaDB : ne pas utiliser phpMyAdmin. Utiliser le CLI :
>
> ```bash
> mysql -u user -p db --delimiter='$$' < migrations/xxx.sql
> ```
>
> phpMyAdmin ne gère pas `DELIMITER` et échoue silencieusement.

---

## Cron

| Script                        | Fréquence recommandée | Rôle                                                     |
| ------------------------------ | --------------------- | -------------------------------------------------------- |
| `cron/leaderboard.php`        | Toutes les heures     | Recalcul `leaderboard_cache` (mode × période × métrique) |
| `cron/hard-delete.php`        | Quotidien à 3h        | Suppression définitive comptes RGPD après J+30           |
| `cron/purge-rate-limits.php`  | Quotidien à 4h        | Purge des fenêtres de rate-limit expirées                 |

Appel sécurisé par le header `X-Cron-Key` (comparé à `CRON_SECRET`, `hash_equals` timing-safe) —
**pas** de paramètre en query string (finirait en clair dans les logs d'accès).

---

## Règles importantes

- **PDO obligatoire** — toutes les requêtes via prepared statements, jamais de concaténation SQL
- **Chaque nouveau fichier PHP** dans `api/admin/` ou `api/user/` nécessite une ligne `RewriteRule` dans le `.htaccess` du sous-dossier — sinon 404 immédiat
- **`:param` PDO répété** — MySQL PDO ne supporte pas le même paramètre nommé deux fois dans un `prepare()`. Utiliser `?` positionnels et `execute([$val, $val])`
- **`rank`** est un mot réservé MySQL 8 — toujours entourer de backticks : `` `rank` ``
