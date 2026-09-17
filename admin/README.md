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
├── index.html      ← Interface HTML (single-page, liste + détail 10 sous-onglets + 9 panneaux globaux)
├── admin.css       ← Styles du panneau (tableaux, pills, actions)
├── admin.js        ← Logique (fetch API admin, rendu dynamique, formulaires)
├── challenges.js   ← Sous-onglet ⚔ Défis (relance / annulation / suppression)
├── streak.js       ← Sous-onglet 🔥 Streak (streak globale + cooldown Jack Frost)
├── moderation.js   ← Sous-onglet 🛡️ Modération (ban motivé, messages, notes, reset ciblé)
├── activity.js     ← Panneau 📈 Activité
└── site_panels.js  ← Panneaux 📣 Annonces, 🔧 Maintenance, 🛡️ Anti-triche
```

---

## Accès

Réservé aux utilisateurs avec `is_admin = 1` en base de données.
L'API vérifie le flag sur chaque requête `api/admin/*` via `requireAdmin()`.

Route : `/admin/` (protégé côté serveur, redirection si non-admin)

---

## Onglets

Panneau gauche = liste des utilisateurs (toujours visible, recherche + pagination). Panneau
droit = détail d'un utilisateur sélectionné, avec 10 sous-onglets. 9 panneaux globaux sont
accessibles depuis le header, indépendamment de l'utilisateur sélectionné. La liste se trie
(inscription, dernière connexion, parties, pseudo) et s'exporte en CSV (`;`, Excel FR).

**Sous-onglets "User Detail" :**

| Sous-onglet     | Description                                                          |
| --------------- | --------------------------------------------------------------------- |
| 👤 **Profil**   | Champs du profil (pseudo, email, lang, avatar…), verrouillage pseudo, suppression — le ban vit dans 🛡️ Modération |
| 🏅 **Badges**   | Attribution ou révocation manuelle de badges                          |
| 🖼️ **Walls**    | Attribution ou révocation manuelle de fonds d'écran                   |
| 👑 **Titres**   | Attribution, équipement ou révocation manuelle de titres               |
| 📊 **Stats**    | Écrasement manuel des statistiques par mode                            |
| 🔥 **Streak**   | Streak globale (correction à la hausse **comme à la baisse**), restauration Jack Frost illimitée, effacement du cooldown 60 j |
| ⚔ **Défis**    | 100 derniers défis d'un joueur : relancer, annuler, supprimer — la sortie de secours d'un défi bloqué `accepted` |
| 👫 **Amis**     | Suppression forcée d'une amitié                                        |
| 🔗 **Social**   | Inspection des relations et rangs Social Link                          |
| 🛡️ **Modération** | Ban avec **raison vue par le joueur**, durée (24 h → définitif, levé seul à l'échéance) et note interne ; messages de l'équipe (vus une fois, accusé tracé) ; carnet de notes ; profil public ; reset ciblé de l'état local des modes |

**Panneaux globaux (header) :**

| Panneau              | Description                                                          |
| --------------------- | --------------------------------------------------------------------- |
| 🎟️ **Codes**          | Créer/modifier/désactiver un code événement, voir les redemptions    |
| 🪵 **Logs**            | Consultation paginée des erreurs applicatives (`error_log`)           |
| 📋 **Audit**           | Journal des actions admin (ban, attribution badge/titre, etc.)        |
| 🗑️ **RGPD**            | Suivi des demandes de suppression + déclenchement manuel du hard delete |
| ⏱️ **Rate Limits**     | Consultation + purge manuelle des compteurs de rate-limiting          |
| 📈 **Activité**        | Joueurs actifs, parties et comptes par jour, ventilation par mode, heures de jeu (7/30/90 j) |
| 📣 **Annonces**        | Bandeau sur toutes les pages (FR + EN, niveau, fenêtre de dates), fermable et mémorisé côté joueur |
| 🔧 **Maintenance**     | Fermer le site aux joueurs (écran plein + API en 503) — l'admin connecté continue de naviguer, un bandeau lui rappelle de rouvrir. Ne se lève **pas** seule à l'heure de retour prévue |
| 🛡️ **Anti-triche**     | Écarts de cible du jour (`error_log`, « Daily target mismatch ») groupés par joueur sur 7/30/90 j, lien direct vers sa Modération |

---

## Actions disponibles

| Action                  | Effet en BDD                                                           |
| ------------------------ | ---------------------------------------------------------------------- |
| Ban / Unban              | `users.is_banned = 1 / 0` + `ban_reason`, `ban_note`, `banned_at`, `banned_until` — connexion bloquée immédiatement, la session du joueur est détruite à son prochain `/me` ; un ban à durée est levé en base à l'échéance par `personadle_ban_state()` |
| Message de l'équipe      | `INSERT INTO user_notices` — le joueur le voit en bandeau au prochain chargement, `read_at` posé à l'accusé |
| Note interne             | `INSERT` / `DELETE` sur `admin_notes` — jamais exposé au joueur          |
| Reset état local         | `users.reset_local_state_at = NOW()` — son navigateur vide la partie en cours de chaque mode une fois, stats intactes |
| Annonce                  | CRUD `announcements` — livrée par `GET /api/auth/me`                   |
| Maintenance              | `site_settings.maintenance_*` — `personadle_maintenance_gate()` répond 503 aux non-admins |
| Lock / Unlock pseudo     | `users.pseudo_locked = 1 / 0` — le joueur ne peut plus modifier son pseudo |
| Delete account           | `DELETE FROM users` — suppression immédiate (hard delete direct, pas de soft-delete depuis l'admin) |
| Give/revoke badge        | `INSERT IGNORE` / `DELETE` sur `badges_unlocked`                       |
| Give/revoke wallpaper    | `INSERT IGNORE` / `DELETE` sur `user_wallpapers`                       |
| Give/equip/revoke title  | `INSERT` / `PATCH` / `DELETE` sur `user_titles`                        |
| Overwrite stats          | `PATCH` sur `user_stats` (par mode)                                    |
| Relancer / annuler un défi | `PATCH messages.status` → `unread` (reproposé) ou `read` (clos sans le compter comme manqué) |
| Supprimer un défi        | `DELETE FROM messages` — ⚠️ la ligne est **partagée**, elle disparaît aussi chez l'autre joueur |
| Corriger la streak       | `PATCH users.global_streak / global_streak_record / global_streak_date` — seul chemin qui autorise une **baisse** |
| Restaurer la streak      | `UPDATE user_stats` + `users` sans cooldown ni plafond « jours joués » ; ne consomme pas le Jack Frost du joueur |
| Effacer le cooldown      | `users.streak_recovered_at = NULL` — le joueur peut réutiliser Jack Frost immédiatement |
| Remove friendship        | `DELETE` sur `friendships`                                              |
| Create event code        | `INSERT INTO event_codes` (code, badge_id, start_date, end_date, is_permanent, is_active, description) |
| Edit/deactivate event code | `PATCH event_codes` (is_active, dates, description — pas de `quota` ni `expires_at`, ces colonnes n'existent pas) |

Toutes les actions admin (sauf lecture) sont tracées dans `admin_audit_log` via
`personadle_log_admin_action()`.

---

## Endpoints API admin

Tous dans `api/admin/`. Chaque fichier PHP nécessite sa propre `RewriteRule` dans `api/admin/.htaccess`.

```
GET                      /api/admin/users                     ← liste paginée, ?sort=created|last_login|games|pseudo, ?export=csv
GET  PATCH  DELETE       /api/admin/users/:id                 ← détail (+ notes, notices), édition (is_banned + ban_reason/ban_note/ban_hours, reset_local_state), suppression
PATCH                    /api/admin/users/:id/stats           ← écrasement stats par mode
GET  PATCH               /api/admin/users/:id/streak          ← PATCH { action: set | recover | reset_cooldown }
GET                      /api/admin/users/:id/challenges      ← 100 derniers défis (les deux sens)
     PATCH  DELETE       /api/admin/users/:id/challenges/:msgId ← PATCH { status } — forcer l'état d'un défi
POST        DELETE       /api/admin/users/:id/badges          ← pas de GET (inclus dans le détail user)
POST PATCH  DELETE       /api/admin/users/:id/titles          ← PATCH = équiper un titre
POST        DELETE       /api/admin/users/:id/wallpapers      ← pas de GET (inclus dans le détail user)
             DELETE      /api/admin/users/:id/friends         ← suppression forcée uniquement
GET  POST   DELETE       /api/admin/users/:id/notes[/:noteId]  ← carnet interne
GET  POST                /api/admin/users/:id/notices         ← messages de l'équipe (POST { type, message })
GET                      /api/admin/social-links               ← liste
GET  PATCH  DELETE       /api/admin/social-links/:id          ← détail/édition/suppression
GET  POST PATCH DELETE   /api/admin/event_codes                ← underscore, pas de tiret
GET                      /api/admin/error_logs
GET                      /api/admin/audit_log
GET  POST                /api/admin/deletion_requests          ← POST = déclenchement manuel du hard delete
GET          DELETE      /api/admin/rate_limits
GET                      /api/admin/activity                   ← ?days=7..180
GET  POST PATCH DELETE   /api/admin/announcements[/:id]        ← bandeau global
GET  PATCH               /api/admin/settings                   ← PATCH { maintenance: { enabled, message_fr, message_en, until } }
GET                      /api/admin/anticheat                  ← ?days=7..365, écarts de cible groupés par joueur
```

> ⚠️ Tout nouveau fichier PHP dans `api/admin/` doit avoir sa propre ligne dans `api/admin/.htaccess` — sinon 404 garanti.
> ⚠️ Les routes sont au **pluriel** (`/users/:id`, pas `/user/:id`) et `event_codes` s'écrit avec un **underscore**, pas un tiret.
