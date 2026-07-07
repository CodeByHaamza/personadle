<div align="center">

# 🗄️ SQL

<img src="https://img.shields.io/badge/MariaDB-10.6%2B-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB">
<img src="https://img.shields.io/badge/MySQL-8.0%20compatible-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL">
<img src="https://img.shields.io/badge/23-tables-success?style=for-the-badge" alt="23 tables">

> **Schéma relationnel 23 tables.** `bdd_mysql.sql` = **source de vérité** (chargé par Docker,
> gardé par un test de contrat). Migrations incrémentales dans `migrations/`.

</div>

---

## 📂 Fichiers

| Fichier                       | Rôle                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| **`bdd_mysql.sql`**           | 🟢 **Source de vérité** — schéma complet + seeds catalogue. Chargé tel quel par Docker dans un vrai conteneur MariaDB 10.6 (`docker-compose.yml`), donc validé en continu contre MariaDB malgré son nom — **c'est aussi le fichier à importer en prod Hostinger**, voir `DEPLOY.md`. |
| ~~`bdd_mariadb.sql`~~         | ⚠️ **Déprécié (2026-07-08)** — n'a pas suivi les migrations depuis le 2026-07-04 : il manque 6 tables entières (`badges`, `error_log`, `event_codes`, `rate_limits`, `admin_audit_log`, `social_link_rankup_notifs`) et des colonnes critiques sur `users` (`is_admin`, `is_banned`, `reset_token_hash`...). Ne plus l'utiliser — importer `bdd_mysql.sql` à la place. |
| `hostinger_procedure.sql`     | Procédure stockée `gain_social_link_xp` (CLI MariaDB uniquement)       |
| `sync_local_to_hostinger.sql` | ALTER différentiels dev → prod                                         |
| `seed_test_data.sql`          | Données de test (users, profiles, sessions, amis, badges débloqués — pas de Social Links) |
| `explication.md`              | Description détaillée de chaque table (partielle — écrit avant plusieurs tables récentes) |
| `migrations/`                 | Migrations incrémentales numérotées (000→020) + `README.md`            |
| ~~`hostinger_full.sql`~~      | ⚠️ **Déprécié** — ancien dump, ne plus utiliser comme référence        |

> 🛡️ **Garde-fou** : `tests/php/DatabaseIntegrationTest.php` échoue si une table/colonne utilisée
> par le code manque dans `bdd_mysql.sql` → empêche la dérive Docker ↔ prod ↔ code.

---

## 🧱 Les 23 tables

| Domaine        | Tables                                                                               |
| -------------- | ------------------------------------------------------------------------------------ |
| Comptes        | `users` · `profiles` · `user_stats` · `game_sessions`                                |
| Récompenses    | `badges` · `badges_unlocked` · `titles` · `user_titles` · `wallpapers` · `user_wallpapers` |
| Événements     | `event_codes` · `event_codes_redeemed`                                               |
| Social         | `friendships` · `social_links` · `social_link_ranks` · `social_link_interactions` · `social_link_rankup_notifs` |
| Système        | `leaderboard_cache` · `messages` · `deletion_requests` · `rate_limits` · `error_log` · `admin_audit_log` |

---

## 💫 Rangs Social Link

| Rang | Nom              | XP cumulés | Rang | Nom              | XP cumulés |
| :--: | ---------------- | ---------: | :--: | ---------------- | ---------: |
|  1   | Stranger         |          0 |  6   | Trusted Ally     |      1 000 |
|  2   | Acquaintance     |        100 |  7   | True Ally        |      1 350 |
|  3   | Companion        |        250 |  8   | Bond             |      1 750 |
|  4   | Ally             |        450 |  9   | Unbreakable Bond |      2 200 |
|  5   | Confidant        |        700 | 10   | True Confidant   |      2 700 |

La procédure `gain_social_link_xp(user_a, user_b, action, @rank, @ranked_up)` gère XP + détection
mutuel + rank-up. Label `proc_body:` requis par MariaDB.

---

## ⚠️ Pièges MySQL ↔ MariaDB

| Point                          | MySQL 8.0 (local)         | MariaDB 10.6+ (prod)                         |
| ------------------------------ | ------------------------- | -------------------------------------------- |
| `ADD COLUMN IF NOT EXISTS`     | ❌ non supporté           | ✅ extension MariaDB                          |
| `rank` (mot réservé)           | `` `rank` `` obligatoire  | idem                                         |
| Procédures stockées            | `DELIMITER //` en CLI     | CLI **seulement** (jamais phpMyAdmin)        |
| `:param` PDO répété            | non supporté → `?` positionnels | idem                                   |

---

## 🚀 Import en production

> Guide complet (SSL, `config.php`, crons, checklist post-déploiement) : voir
> [`DEPLOY.md`](../DEPLOY.md) à la racine. Ci-dessous, l'équivalent en ligne de commande
> si tu as un accès SSH plutôt que phpMyAdmin.

```bash
ssh hostinger-personadle

# Schéma — bdd_mysql.sql, PAS bdd_mariadb.sql (déprécié, voir tableau ci-dessus)
mysql -u u870779941_Hamza -p u870779941_personadle < sql/bdd_mysql.sql

# Procédure stockée (DELIMITER obligatoire — pas via phpMyAdmin)
mysql -u u870779941_Hamza -p u870779941_personadle --delimiter='$$' < sql/hostinger_procedure.sql
```

→ Détail de chaque table : [`explication.md`](explication.md) · Migrations : [`migrations/README.md`](migrations/README.md)
