<div align="center">

# 🛡️ Admin Panel

> **Interface de modération — utilisateurs, codes événement, statistiques, Social Links.**

</div>

---

## Structure

```
admin/
├── index.html   ← Interface HTML (single-page, 7 onglets)
├── admin.css    ← Styles du panneau (tableaux, pills, actions)
└── admin.js     ← Logique (fetch API admin, rendu dynamique, formulaires)
```

---

## Accès

Réservé aux utilisateurs avec `is_admin = 1` en base de données.
L'API vérifie le flag sur chaque requête `api/admin/*` via `requireAdmin()`.

Route : `/admin/` (protégé côté serveur, redirection si non-admin)

---

## Onglets

| Onglet              | Description                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| 📊 **Dashboard**    | Stats globales — comptes actifs, parties du jour, activité récente           |
| 👥 **Users**        | Liste paginée avec recherche, filtre bannis / normaux                        |
| 👤 **User Detail**  | Profil complet — stats, badges, titres, wallpapers, amis d'un utilisateur    |
| 🎖️ **Badges**       | Attribution ou révocation manuelle de badges                                 |
| 🎟️ **Event Codes**  | Créer un code, fixer un quota et une date d'expiration, voir les redemptions |
| 🔒 **Modération**   | Bannir / débannir un compte, verrouiller / déverrouiller un pseudo           |
| 🔗 **Social Links** | Inspection des relations et rangs entre joueurs                              |

---

## Actions disponibles

| Action            | Effet en BDD                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| Ban               | `users.is_banned = 1` — connexion bloquée immédiatement                |
| Unban             | `users.is_banned = 0`                                                  |
| Lock pseudo       | `users.pseudo_locked = 1` — le joueur ne peut plus modifier son pseudo |
| Give badge        | `INSERT IGNORE INTO badges_unlocked`                                   |
| Give wallpaper    | Insert dans la table d'ownership wallpapers                            |
| Give title        | `INSERT INTO user_titles`                                              |
| Create event code | Insert dans `event_codes` (code, badge_id, quota, expires_at)          |
| Expire event code | `UPDATE event_codes SET expires_at = NOW()`                            |

---

## Endpoints API admin

Tous dans `api/admin/`. Chaque fichier PHP nécessite sa propre `RewriteRule` dans `api/admin/.htaccess`.

```
GET         /api/admin/users                  ← liste paginée
GET  PATCH  /api/admin/user/:id               ← détail + ban/lock
GET         /api/admin/user/:id/stats
GET POST DELETE  /api/admin/user/:id/badges
GET POST DELETE  /api/admin/user/:id/titles
GET POST DELETE  /api/admin/user/:id/wallpapers
GET         /api/admin/user/:id/friends
GET         /api/admin/social-links
GET POST PATCH DELETE  /api/admin/event-codes
```

> ⚠️ Tout nouveau fichier PHP dans `api/admin/` doit avoir sa propre ligne dans `api/admin/.htaccess` — sinon 404 garanti.
