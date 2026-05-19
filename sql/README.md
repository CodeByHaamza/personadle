<div align="center">

# 🗄️ SQL

> **Schéma MariaDB 10.6+ — 20 tables, migrations, seeds et procédures.**

</div>

---

## Fichiers

| Fichier | Rôle |
|---------|------|
| `bdd_mysql.sql` | Schéma MySQL 8.0 (développement local) |
| `bdd_mariadb.sql` | Schéma MariaDB 10.6+ (production Hostinger) |
| `bdd.sql` | Schéma unifié (dernière version — référence) |
| `hostinger_full.sql` | Dump complet Hostinger (tables + seeds + procédures) |
| `hostinger_procedure.sql` | Procédure stockée `gain_social_link_xp` (CLI MariaDB uniquement) |
| `sync_local_to_hostinger.sql` | Synchronisation dev → prod (ALTER différentiels) |
| `seed_test_data.sql` | Données de test (utilisateurs, sessions, amis, Social Links) |
| `explication.md` | Description détaillée de chaque table avec exemples |
| `migrations/001_social_foundation.sql` | Migration fondation Social Link |

---

## Tables

| Table | Description |
|-------|-------------|
| `users` | Comptes (email, pseudo, friend_code, is_banned, pseudo_locked) |
| `profiles` | Personnalisation (avatar, wallpaper, titre équipé, badges épinglés, musique profil) |
| `user_stats` | Stats par mode (wins, giveups, streak, streak_record, perfect, total_time_ms) |
| `game_sessions` | Historique des parties (mode, date, résultat, tentatives, filtres actifs) |
| `badges` | Catalogue des 60 badges (slug, catégorie, rareté, condition) |
| `badges_unlocked` | Badges débloqués par utilisateur (avec timestamp) |
| `titles` | Catalogue titres (slug, nom × 4 langues, rareté, condition_type / mode / value) |
| `user_titles` | Titres débloqués par utilisateur |
| `event_codes` | Codes événement (badge cible, quota, date expiration) |
| `event_codes_redeemed` | Historique des codes échangés |
| `wallpapers` | Catalogue wallpapers débloquables |
| `friendships` | Relations d'amis (requester_id, addressee_id, status: pending / accepted / blocked) |
| `social_links` | Lien Social Link entre deux amis (XP cumulé, rang 1-10) |
| `social_link_ranks` | Définition des 10 rangs (Stranger → True Confidant, XP requis × 4 langues) |
| `social_link_interactions` | Log des interactions XP (anti-spam, is_mutual, xp_gained) |
| `social_link_rankup_notifs` | Notifications de rank-up envoyées aux deux joueurs |
| `leaderboard_cache` | Cache classements recalculé par cron (mode × période × métrique × user) |
| `messages` | Messages et défis entre amis (type: message / challenge / result) |
| `deletion_requests` | Log RGPD — soft delete immédiat, hard delete planifié J+30 |

---

## Rangs Social Link

| Rang | Nom | XP cumulés |
|------|-----|-----------|
| 1 | Stranger | 0 |
| 2 | Acquaintance | 100 |
| 3 | Companion | 250 |
| 4 | Ally | 450 |
| 5 | Confidant | 700 |
| 6 | Trusted Ally | 1 000 |
| 7 | True Ally | 1 350 |
| 8 | Bond | 1 750 |
| 9 | Unbreakable Bond | 2 200 |
| 10 | True Confidant | 2 700 |

---

## Procédure stockée

`gain_social_link_xp` gère la logique XP + détection mutuel + rank-up automatique.

```sql
-- Appel direct
CALL gain_social_link_xp(user_a_id, user_b_id, action_type, @new_rank, @ranked_up);
```

La procédure est dans `hostinger_procedure.sql` avec le label `proc_body:` requis par MariaDB.

---

## Différences MySQL / MariaDB

| Point | MySQL 8.0 (local) | MariaDB 10.6+ (prod) |
|-------|--------------------|----------------------|
| `ADD COLUMN IF NOT EXISTS` | ❌ Non supporté | ✅ Extension MariaDB |
| `RANK()` window function | Nécessite `` `rank` `` | Idem |
| Procédures stockées | `DELIMITER //` OK en CLI | `DELIMITER //` CLI **seulement** (pas phpMyAdmin) |
| Label procédure `LEAVE` | Standard SQL | Nécessite `proc_body: BEGIN … LEAVE proc_body` |

> **Règle absolue** : toujours entourer `rank` de backticks dans toutes les requêtes — c'est un mot réservé MySQL 8.0.

---

## Import en production

```bash
# Connexion SSH
ssh hostinger-personadle

# Schéma complet
mysql -u u870779941_Hamza -p u870779941_personadle < sql/bdd_mariadb.sql

# Procédure stockée (DELIMITER obligatoire — ne pas passer par phpMyAdmin)
mysql -u u870779941_Hamza -p u870779941_personadle --delimiter='$$' < sql/hostinger_procedure.sql
```

---

## Documentation complète

→ [`explication.md`](explication.md) — description de chaque table avec exemples de données et notes d'architecture.
