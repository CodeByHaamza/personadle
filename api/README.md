<div align="center">

# ⚙️ API

> **Backend REST PHP 8.3 — authentification, sessions, social, classements.**

</div>

---

## Structure

```
api/
├── bootstrap.php           ← PDO singleton, CORS, helpers JSON, requireAuth()
├── config.php              ← Identifiants BDD (gitignored)
├── config.example.php      ← Template à copier (local + Hostinger)
├── config.docker.php       ← Config pour Docker
├── sessions.php            ← POST /api/sessions
├── community-stats.php     ← GET /api/community-stats
├── .htaccess               ← Routing Apache
│
├── auth/                   ← Authentification
│   ├── register.php        ← POST /api/auth/register
│   ├── login.php           ← POST /api/auth/login
│   ├── logout.php          ← POST /api/auth/logout
│   └── me.php              ← GET /api/auth/me
│
├── user/                   ← Profil utilisateur
│   ├── index.php           ← GET / PATCH / DELETE /api/user/:id
│   ├── stats.php           ← GET /api/user/:id/stats
│   ├── migrate.php         ← POST /api/user/:id/migrate
│   ├── compare.php         ← GET /api/user/:id/compare?with=
│   ├── recover-streak.php  ← POST /api/user/:id/recover-streak
│   ├── list.php            ← GET /api/user/list (browse players)
│   ├── search.php          ← GET /api/user/search?q=
│   └── public.php          ← GET /api/user/:id/public
│
├── friends/                ← Système d'amis
│   └── index.php           ← GET / POST / PATCH / DELETE /api/friends
│
├── messages/               ← Messages & défis quotidiens
│   └── index.php           ← GET / POST / PATCH / DELETE /api/messages
│
├── social-links/           ← Social Link XP & rangs
│   └── index.php           ← GET / POST /api/social-links
│
├── leaderboard/            ← Classements
│   └── index.php           ← GET /api/leaderboard
│
├── badges/                 ← Catalogue badges
│   └── index.php           ← GET /api/badges + POST /api/badges/redeem
│
├── wallpapers/             ← Catalogue wallpapers
│   └── index.php           ← GET /api/wallpapers
│
├── titles/                 ← Titres joueur
│   └── index.php           ← GET /api/titles + POST /api/titles/unlock
│
├── notifications/          ← Notifications
│   └── index.php           ← GET /api/notifications
│
├── admin/                  ← Panneau d'administration (is_admin requis)
│   ├── users.php           ← GET /api/admin/users
│   ├── user.php            ← GET / PATCH /api/admin/user/:id
│   ├── user_stats.php      ← GET /api/admin/user/:id/stats
│   ├── user_badges.php     ← CRUD /api/admin/user/:id/badges
│   ├── user_titles.php     ← CRUD /api/admin/user/:id/titles
│   ├── user_wallpapers.php ← CRUD /api/admin/user/:id/wallpapers
│   ├── user_friends.php    ← GET /api/admin/user/:id/friends
│   ├── social_links.php    ← GET /api/admin/social-links
│   └── event_codes.php     ← CRUD /api/admin/event-codes
│
├── cron/                   ← Tâches planifiées (appelées par cron système)
│   ├── leaderboard.php     ← Recalcul périodique du leaderboard_cache
│   └── hard-delete.php     ← Suppression RGPD définitive (J+30)
│
└── migrations/             ← Migrations SQL incrémentales
    ├── 001_add_challenge_filters.sql
    ├── 002_add_has_migrated.sql
    ├── 003_add_messages_sender_type_index.sql
    ├── 004_leaderboard_cache_add_metric.sql
    ├── 005_titles_image_path_calling_cards.sql
    ├── 006_fix_title_slugs.sql
    ├── 007_badges_wallpapers_catalog.sql
    ├── 008_add_is_admin.sql
    ├── 009_social_link_rankup_notifs.sql
    ├── 011_event_codes_moderation.sql
    └── 012_remove_tcb.sql
```

---

## Endpoints

### Auth

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/auth/register` | Inscription — email + pseudo + mot de passe (bcrypt) |
| `POST` | `/api/auth/login` | Connexion — session PHP httpOnly |
| `POST` | `/api/auth/logout` | Déconnexion — destruction session |
| `GET`  | `/api/auth/me` | Profil courant (requiert session active) |

### Sessions & Stats communautaires

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/sessions` | Enregistrer une partie — calcule streaks, incrémente user_stats |
| `GET`  | `/api/community-stats` | % joueurs ayant trouvé le personnage du jour |

### Utilisateur

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET`    | `/api/user/:id` | Profil complet (soi-même) ou public restreint (tiers) |
| `PATCH`  | `/api/user/:id` | Modifier pseudo, avatar, wallpaper, musique, titre… |
| `DELETE` | `/api/user/:id` | Soft delete + anonymisation RGPD immédiate |
| `GET`    | `/api/user/:id/stats` | Stats par mode (wins, streak, perfect, games) |
| `POST`   | `/api/user/:id/migrate` | Importer localStorage → BDD (idempotent) |
| `GET`    | `/api/user/:id/compare?with=` | Comparaison stats + XP Social Link avec un ami |
| `POST`   | `/api/user/:id/recover-streak` | Restaurer une streak perdue (cooldown 2 mois) |
| `GET`    | `/api/user/list` | Liste paginée de tous les joueurs |
| `GET`    | `/api/user/search?q=` | Recherche par pseudo ou code ami |
| `GET`    | `/api/user/:id/public` | Profil public (pseudo, avatar, border, badges, titre) |

### Amis

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET`    | `/api/friends` | Liste d'amis avec statut online |
| `POST`   | `/api/friends` | Envoyer une demande d'ami |
| `PATCH`  | `/api/friends/:id` | Accepter ou refuser une demande |
| `DELETE` | `/api/friends/:id` | Supprimer un ami |

### Messages & Défis

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET`    | `/api/messages` | Liste des messages et défis reçus |
| `POST`   | `/api/messages` | Envoyer un défi quotidien (mode + filtres) |
| `PATCH`  | `/api/messages/:id` | Marquer comme lu / résolu |
| `DELETE` | `/api/messages/:id` | Supprimer un message |

### Social Link

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET`  | `/api/social-links` | Tous les Social Links de l'utilisateur courant |
| `GET`  | `/api/social-links?friend_id=` | Social Link avec un ami spécifique |
| `POST` | `/api/social-links/interact` | Gagner de l'XP (action type, mutuel ×2) |

### Leaderboard

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/leaderboard` | Classement filtré, ma position incluse |

Paramètres : `mode` · `period` (alltime / month / week / today) · `metric` (wins / win_rate / streak / perfect / games) · `scope` (global / friends) · `page`

Réponse : `{ rows: [...], my_rank: { rank, score } }`

### Badges, Wallpapers, Titres

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET`  | `/api/badges` | Catalogue complet (60 badges) + déblocages utilisateur |
| `POST` | `/api/badges/redeem` | Echanger un code événement → débloquer un badge |
| `GET`  | `/api/wallpapers` | Catalogue wallpapers disponibles |
| `GET`  | `/api/titles` | Catalogue titres |
| `POST` | `/api/titles/unlock` | Débloquer un titre (conditions vérifiées côté serveur) |

### Admin *(is_admin = 1 requis)*

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET`         | `/api/admin/users` | Liste paginée avec stats et statut |
| `GET / PATCH` | `/api/admin/user/:id` | Voir / modifier un compte (ban, pseudo_locked) |
| `GET`         | `/api/admin/user/:id/stats` | Stats détaillées par mode |
| `*`           | `/api/admin/user/:id/badges` | Attribution / révocation de badges |
| `*`           | `/api/admin/user/:id/titles` | Attribution / révocation de titres |
| `*`           | `/api/admin/user/:id/wallpapers` | Attribution / révocation de wallpapers |
| `GET`         | `/api/admin/user/:id/friends` | Liste des amis d'un utilisateur |
| `GET`         | `/api/admin/social-links` | Vue d'ensemble des Social Links |
| `*`           | `/api/admin/event-codes` | CRUD codes événement (créer, expirer, stats redemption) |

---

## Bootstrap

`bootstrap.php` est inclus en tête de chaque endpoint. Il fournit :

```php
$pdo = getPdo();          // PDO singleton — exception si connexion impossible

requireAuth();            // arrête avec HTTP 401 si pas de session valide
$user = getCurrentUser(); // retourne l'array utilisateur depuis $_SESSION

jsonSuccess($data, 201);  // {"data": ...}  + code HTTP
jsonError('message', 400);// {"error": "..."} + code HTTP
```

Sécurité activée automatiquement :

- **CORS** : whitelist d'origines exactes (pas de wildcard quand `credentials: include`)
- **Headers** : `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`
- **Rate limiting** : par IP — `X-RateLimit-Remaining` + `Retry-After` sur 429

---

## Configuration

Copier `config.example.php` → `config.php` et renseigner :

```php
define('DB_HOST',  'localhost');
define('DB_NAME',  'personadle');
define('DB_USER',  'personadle_user');
define('DB_PASS',  'your_password');
define('ALLOWED_ORIGINS', ['http://localhost', 'https://personadle.net']);
define('ADMIN_SECRET', 'your_cron_secret');
```

---

## Migrations

Les migrations sont des fichiers SQL numérotés dans `migrations/`. Elles sont **incrémentales**.

> ⚠️ Pour les procédures stockées MariaDB : ne pas utiliser phpMyAdmin. Utiliser le CLI :
> ```bash
> mysql -u user -p db --delimiter='$$' < migrations/xxx.sql
> ```
> phpMyAdmin ne gère pas `DELIMITER` et échoue silencieusement.

---

## Cron

| Script | Fréquence recommandée | Rôle |
|--------|-----------------------|------|
| `cron/leaderboard.php` | Toutes les heures | Recalcul `leaderboard_cache` (mode × période × métrique) |
| `cron/hard-delete.php` | Quotidien à 3h | Suppression définitive comptes RGPD après J+30 |

Appel sécurisé par `ADMIN_SECRET` dans le header ou en paramètre GET.

---

## Règles importantes

- **PDO obligatoire** — toutes les requêtes via prepared statements, jamais de concaténation SQL
- **Chaque nouveau fichier PHP** dans `api/admin/` ou `api/user/` nécessite une ligne `RewriteRule` dans le `.htaccess` du sous-dossier — sinon 404 immédiat
- **`:param` PDO répété** — MySQL PDO ne supporte pas le même paramètre nommé deux fois dans un `prepare()`. Utiliser `?` positionnels et `execute([$val, $val])`
- **`rank`** est un mot réservé MySQL 8 — toujours entourer de backticks : `` `rank` ``
