<div align="center">

# 🛡️ Admin Panel

<img src="https://img.shields.io/badge/accès-is__admin%20%3D%201-critical?style=for-the-badge" alt="is_admin">
<img src="https://img.shields.io/badge/garde-requireAdmin()-success?style=for-the-badge" alt="requireAdmin">

> **Interface de modération — utilisateurs, codes événement, statistiques, Social Links.**
> Accès verrouillé serveur : `requireAdmin()` sur chaque endpoint `api/admin/*`.

</div>

---

## Structure

```
admin/
├── index.html   ← Interface HTML (single-page, liste + détail 7 sous-onglets + 5 panneaux globaux)
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

Panneau gauche = liste des utilisateurs (toujours visible, recherche + pagination). Panneau
droit = détail d'un utilisateur sélectionné, avec 7 sous-onglets. 5 panneaux globaux sont
accessibles depuis le header, indépendamment de l'utilisateur sélectionné.

**Sous-onglets "User Detail" :**

| Sous-onglet     | Description                                                          |
| --------------- | --------------------------------------------------------------------- |
| 👤 **Profil**   | Champs du profil (pseudo, email, lang, avatar…) + modération (ban/unban, verrouillage pseudo, suppression) |
| 🏅 **Badges**   | Attribution ou révocation manuelle de badges                          |
| 🖼️ **Walls**    | Attribution ou révocation manuelle de fonds d'écran                   |
| 👑 **Titres**   | Attribution, équipement ou révocation manuelle de titres               |
| 📊 **Stats**    | Écrasement manuel des statistiques par mode                            |
| 👫 **Amis**     | Suppression forcée d'une amitié                                        |
| 🔗 **Social**   | Inspection des relations et rangs Social Link                          |

**Panneaux globaux (header) :**

| Panneau              | Description                                                          |
| --------------------- | --------------------------------------------------------------------- |
| 🎟️ **Codes**          | Créer/modifier/désactiver un code événement, voir les redemptions    |
| 🪵 **Logs**            | Consultation paginée des erreurs applicatives (`error_log`)           |
| 📋 **Audit**           | Journal des actions admin (ban, attribution badge/titre, etc.)        |
| 🗑️ **RGPD**            | Suivi des demandes de suppression + déclenchement manuel du hard delete |
| ⏱️ **Rate Limits**     | Consultation + purge manuelle des compteurs de rate-limiting          |

---

## Actions disponibles

| Action                  | Effet en BDD                                                           |
| ------------------------ | ---------------------------------------------------------------------- |
| Ban / Unban              | `users.is_banned = 1 / 0` — connexion bloquée immédiatement            |
| Lock / Unlock pseudo     | `users.pseudo_locked = 1 / 0` — le joueur ne peut plus modifier son pseudo |
| Delete account           | `DELETE FROM users` — suppression immédiate (hard delete direct, pas de soft-delete depuis l'admin) |
| Give/revoke badge        | `INSERT IGNORE` / `DELETE` sur `badges_unlocked`                       |
| Give/revoke wallpaper    | `INSERT IGNORE` / `DELETE` sur `user_wallpapers`                       |
| Give/equip/revoke title  | `INSERT` / `PATCH` / `DELETE` sur `user_titles`                        |
| Overwrite stats          | `PATCH` sur `user_stats` (par mode)                                    |
| Remove friendship        | `DELETE` sur `friendships`                                              |
| Create event code        | `INSERT INTO event_codes` (code, badge_id, start_date, end_date, is_permanent, is_active, description) |
| Edit/deactivate event code | `PATCH event_codes` (is_active, dates, description — pas de `quota` ni `expires_at`, ces colonnes n'existent pas) |

Toutes les actions admin (sauf lecture) sont tracées dans `admin_audit_log` via
`personadle_log_admin_action()`.

---

## Endpoints API admin

Tous dans `api/admin/`. Chaque fichier PHP nécessite sa propre `RewriteRule` dans `api/admin/.htaccess`.

```
GET                      /api/admin/users                     ← liste paginée
GET  PATCH  DELETE       /api/admin/users/:id                 ← détail, édition, suppression
PATCH                    /api/admin/users/:id/stats           ← écrasement stats par mode
POST        DELETE       /api/admin/users/:id/badges          ← pas de GET (inclus dans le détail user)
POST PATCH  DELETE       /api/admin/users/:id/titles          ← PATCH = équiper un titre
POST        DELETE       /api/admin/users/:id/wallpapers      ← pas de GET (inclus dans le détail user)
             DELETE      /api/admin/users/:id/friends         ← suppression forcée uniquement
GET                      /api/admin/social-links               ← liste
GET  PATCH  DELETE       /api/admin/social-links/:id          ← détail/édition/suppression
GET  POST PATCH DELETE   /api/admin/event_codes                ← underscore, pas de tiret
GET                      /api/admin/error_logs
GET                      /api/admin/audit_log
GET  POST                /api/admin/deletion_requests          ← POST = déclenchement manuel du hard delete
GET          DELETE      /api/admin/rate_limits
```

> ⚠️ Tout nouveau fichier PHP dans `api/admin/` doit avoir sa propre ligne dans `api/admin/.htaccess` — sinon 404 garanti.
> ⚠️ Les routes sont au **pluriel** (`/users/:id`, pas `/user/:id`) et `event_codes` s'écrit avec un **underscore**, pas un tiret.
