# PersonaDLE — Explication de la base de données

> Pour chaque table : pourquoi elle existe, ce qu'elle contient, des exemples concrets avec de vrais personnages/joueurs du jeu, et les requêtes SQL les plus utiles.

---

## Vue d'ensemble — Qui parle à qui ?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USERS (centre de tout)                         │
│  id │ email │ pseudo │ password_hash │ friend_code │ lang │ is_deleted  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ 1 user
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
     PROFILES            USER_STATS           GAME_SESSIONS
  (apparence)        (compteurs par mode)   (historique parties)
  avatar, fond,       wins, streaks...       chaque partie jouée
  musique, badges                            avec date et résultat
          │
          ▼
  equipped_title_id ──────► TITLES
                             (Phantom Thief, Wild Card…)
          │
          ▼
    USER_TITLES (débloqués)


FRIENDSHIPS ◄──── SOCIAL_LINKS ──────────────────► SOCIAL_LINK_BADGES
(demandes)        (rang + XP entre 2 amis)          (badge True Confidant)
                       │
                       ▼
              SOCIAL_LINK_INTERACTIONS
              (log des actions XP)
              SOCIAL_LINK_RANKS
              (seuils des rangs 1-10)


BADGES_UNLOCKED        EVENT_CODES_REDEEMED
DAILY_TARGETS          LEADERBOARD_CACHE
DELETION_REQUESTS
```

---

## 1. `users` — Les comptes joueurs

**Pourquoi :** Table centrale. Tout part de là.

```
id │ email              │ pseudo     │ friend_code │ lang │ is_deleted
───┼────────────────────┼────────────┼─────────────┼──────┼───────────
1  │ hamza@example.com  │ HamzaK     │ XK4R2M9P    │ fr   │ false
2  │ leo@example.com    │ L2GENDAIRE │ MK9X2ZP1    │ fr   │ false
3  │ damien@example.com │ Corbover   │ ZL3YW8RQ    │ fr   │ false
```

**Champs importants :**

- `friend_code` : code court (8 caractères) que le joueur partage pour être ajouté en ami, sans révéler son email. Exemple : Hamza donne "XK4R2M9P" dans Discord, et ses amis l'entrent dans le jeu.
- `is_deleted` + `deleted_at` : quand un joueur demande la suppression RGPD, on ne supprime pas immédiatement — on marque `is_deleted = TRUE` et les données sont anonymisées. Hard delete à J+30.
- `lang` : détermine la langue de l'interface. Peut être changé depuis les paramètres et est sauvegardé en BDD (prioritaire sur localStorage).

**Requêtes types :**

```sql
-- Connexion: vérifier email + comparer hash en PHP
SELECT id, pseudo, password_hash FROM users
WHERE email = ? AND is_deleted = FALSE;
-- Puis: password_verify($inputPassword, $row['password_hash'])

-- Recherche par pseudo (pour ajouter un ami)
SELECT id, pseudo, friend_code FROM users
WHERE pseudo ILIKE '%ryuji%' AND is_deleted = FALSE
LIMIT 10;
-- MySQL: WHERE pseudo LIKE '%ryuji%' (pas ILIKE)

-- Recherche par code ami exact
SELECT id, pseudo FROM users
WHERE friend_code = 'XK4R2M9P' AND is_deleted = FALSE;
```

---

## 2. `profiles` — L'apparence du profil

**Pourquoi :** Séparer les données d'authentification (users) des données d'affichage. Plus propre et plus performant — on ne charge pas l'avatar de 50ko à chaque vérification de session.

```
user_id │ avatar_border_color │ wallpaper_id                    │ profile_music_id │ selected_badges
────────┼─────────────────────┼─────────────────────────────────┼──────────────────┼───────────────────────────────────────
1       │ #ff0000             │ P5_Phantom_Thieves_Wallpaper     │ last_surprise    │ ["ace_detective","phantom_coder","burn_my_dread","twin_blade"]
2       │ #ffd700             │ P4_Golden_Style                  │ reach_out_truth  │ ["velvet_master","cinema_explorer"]
```

**Champs importants :**

- `avatar_data` : image base64 générée par le canvas crop de `profile.js`. Même format que l'export JSON localStorage actuel — la migration est directe.
- `wallpaper_id` : slug du fichier dans `/profile/Wallpaper/`. Ex: `'P3_Tartarus_Wallpaper'` correspond à `/profile/Wallpaper/P3_Tartarus_Wallpaper.png`.
- `profile_music_id` : identifiant d'une musique dans la BDD songs. Jouée uniquement sur la page profil (style Dokkan Battle).
- `selected_badges` : tableau JSON de max 4 badge IDs — même format que `profile.selectedBadges` dans localStorage.
- `equipped_title_id` : FK vers `titles`. Un seul titre affiché sous le pseudo.

**Requête type — Charger un profil complet :**

```sql
SELECT
    u.pseudo,
    u.friend_code,
    p.avatar_data,
    p.avatar_border_color,
    p.wallpaper_id,
    p.profile_music_id,
    p.selected_badges,
    t.name_fr   AS title_fr,
    t.name_en   AS title_en,
    t.rarity    AS title_rarity
FROM users u
JOIN profiles p       ON p.user_id = u.id
LEFT JOIN titles t    ON t.id = p.equipped_title_id
WHERE u.pseudo = 'HamzaK' AND u.is_deleted = FALSE;
```

---

## 3. `titles` — Les titres / rangs

**Pourquoi :** Un titre est un texte affiché sous le pseudo sur le profil, débloquable selon des conditions. C'est une couche de progression supplémentaire en complément des badges.

```
slug              │ name_fr           │ name_en          │ condition_type  │ condition_value │ rarity
──────────────────┼───────────────────┼──────────────────┼─────────────────┼─────────────────┼──────────
phantom_thief     │ Voleur Fantôme    │ Phantom Thief    │ wins_total      │ 10              │ common
wild_card         │ Wild Card         │ Wild Card        │ wins_total      │ 50              │ rare
music_master      │ Maître Musique    │ Music Master     │ mode_wins       │ 20              │ rare
confidant         │ Confident         │ True Confidant   │ social_link_rank_10 │ 1           │ legendary
```

**Vérification côté PHP — débloquer automatiquement les titres :**

```php
// Après chaque partie gagnée, vérifier si de nouveaux titres sont débloqués
function checkAndUnlockTitles(PDO $pdo, int $userId): array {
    $newTitles = [];

    // Récupérer les stats globales du joueur
    $stmt = $pdo->prepare("SELECT SUM(wins) as total_wins FROM user_stats WHERE user_id = ?");
    $stmt->execute([$userId]);
    $stats = $stmt->fetch();

    // Récupérer les titres déjà débloqués
    $stmt = $pdo->prepare("SELECT title_id FROM user_titles WHERE user_id = ?");
    $stmt->execute([$userId]);
    $unlocked = array_column($stmt->fetchAll(), 'title_id');

    // Vérifier les titres basés sur wins_total
    $stmt = $pdo->prepare("
        SELECT id, slug, name_fr FROM titles
        WHERE condition_type = 'wins_total'
        AND condition_value <= ?
        AND id NOT IN (" . implode(',', array_fill(0, count($unlocked), '?')) . ")
    ");
    $params = array_merge([$stats['total_wins']], $unlocked);
    $stmt->execute($params);

    foreach ($stmt->fetchAll() as $title) {
        $insert = $pdo->prepare("INSERT INTO user_titles (user_id, title_id) VALUES (?, ?)");
        $insert->execute([$userId, $title['id']]);
        $newTitles[] = $title;
    }

    return $newTitles; // Retourné au frontend pour afficher une notification
}
```

---

## 4. `user_stats` — Statistiques par mode

**Pourquoi :** Une ligne par (joueur × mode). Permet les leaderboards par mode et les stats détaillées sur le profil.

```
user_id │ mode      │ wins │ giveups │ games │ streak │ streak_record │ perfect_wins
────────┼───────────┼──────┼─────────┼───────┼────────┼───────────────┼─────────────
1       │ classic   │  47  │   8     │  60   │   5    │     12        │     3
1       │ music     │  23  │   4     │  30   │   3    │      8        │     1
1       │ personae  │  15  │   2     │  18   │   0    │      6        │     0
2       │ classic   │  82  │   3     │  90   │  14    │     21        │    10
```

**Requête — Mettre à jour les stats après une partie :**

```sql
INSERT INTO user_stats (user_id, mode, wins, games, streak, streak_record, last_played_at, first_played_at)
VALUES (1, 'classic', 1, 1, 1, 1, NOW(), NOW())
ON CONFLICT (user_id, mode) DO UPDATE SET
    wins         = user_stats.wins + EXCLUDED.wins,
    games        = user_stats.games + 1,
    streak       = CASE WHEN :result = 'win' THEN user_stats.streak + 1 ELSE 0 END,
    streak_record = GREATEST(user_stats.streak_record,
                             CASE WHEN :result = 'win' THEN user_stats.streak + 1 ELSE user_stats.streak_record END),
    last_played_at = NOW();
-- MySQL: ON DUPLICATE KEY UPDATE ...
```

---

## 5. `game_sessions` — L'historique complet de chaque partie

**Pourquoi :** C'est la table la plus riche en données. Elle sert à :
1. La fonctionnalité **Replay** ("ce jour-là, tu as trouvé Ryuji en 4 essais")
2. Les **stats globales post-partie** ("X% des joueurs ont trouvé ce personnage aujourd'hui")
3. Des stats avancées futures ("ton pire mode sur les 30 derniers jours")

```
id │ user_id │ mode      │ played_date │ target_name         │ result │ attempts │ time_ms
───┼─────────┼───────────┼─────────────┼─────────────────────┼────────┼──────────┼────────
1  │    1    │ classic   │ 2026-03-30  │ Ryuji Sakamoto      │ win    │    4     │ 87000
2  │    2    │ classic   │ 2026-03-30  │ Ryuji Sakamoto      │ win    │    2     │ 43000
3  │    1    │ music     │ 2026-03-30  │ Last Surprise       │ giveup │    5     │ 210000
4  │    3    │ silhouette│ 2026-03-30  │ Aigis               │ win    │    1     │ 12000
```

**Requête — Stats globales post-partie (affiché à la fin de chaque game) :**

```sql
-- "X% des joueurs ont trouvé Ryuji Sakamoto aujourd'hui"
SELECT
    COUNT(*) FILTER (WHERE result = 'win')  AS winners,
    COUNT(*)                                 AS total_players,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE result = 'win') / NULLIF(COUNT(*), 0)
    , 1) AS win_rate_pct,
    ROUND(AVG(attempts) FILTER (WHERE result = 'win'), 1) AS avg_attempts_winners
FROM game_sessions
WHERE mode = 'classic'
  AND played_date = CURRENT_DATE
  AND target_name = 'Ryuji Sakamoto';

-- Résultat exemple:
-- winners: 847 | total_players: 1203 | win_rate_pct: 70.4 | avg_attempts_winners: 3.2
-- → Affiché: "70.4% des joueurs ont trouvé Ryuji aujourd'hui (moy: 3.2 essais)"
```

**Requête — Replay personnel (page historique) :**

```sql
SELECT
    gs.mode,
    gs.played_date,
    gs.target_name,
    gs.result,
    gs.attempts,
    gs.time_ms,
    dt.target_data  -- snapshot complet du personnage
FROM game_sessions gs
LEFT JOIN daily_targets dt ON dt.mode = gs.mode AND dt.target_date = gs.played_date
WHERE gs.user_id = 1
ORDER BY gs.played_date DESC
LIMIT 30;
```

---

## 6. `daily_targets` — Le personnage du jour (côté serveur)

**Pourquoi :** Même si on ne fait pas d'anti-triche, stocker le personnage du jour côté serveur permet :
- L'historique exact (quel perso chaque jour)
- Les stats globales sans avoir à recalculer
- Le replay feature

```
mode       │ target_date │ target_name    │ target_data (JSON)
───────────┼─────────────┼────────────────┼────────────────────────────────────────────
classic    │ 2026-03-30  │ Ryuji Sakamoto │ {"nom":"Ryuji","genre":"M","age":16,...}
music      │ 2026-03-30  │ Last Surprise  │ {"titre":"Last Surprise","opus":"P5",...}
silhouette │ 2026-03-30  │ Aigis          │ {"nom":"Aigis","image":"Aigis.webp",...}
```

**Génération du target du jour (PHP — script cron à minuit Paris) :**

```php
// Appelé chaque jour à 00:00 Europe/Paris via cron
function generateDailyTargets(PDO $pdo): void {
    $today = (new DateTimeImmutable('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    $modes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];

    foreach ($modes as $mode) {
        // Vérifier si déjà généré
        $check = $pdo->prepare("SELECT 1 FROM daily_targets WHERE mode = ? AND target_date = ?");
        $check->execute([$mode, $today]);
        if ($check->fetch()) continue;

        // Sélection basée sur seed déterministe (même logique que parisDateKey() côté client)
        $target = selectDailyTargetForMode($mode, $today);

        $stmt = $pdo->prepare("
            INSERT INTO daily_targets (mode, target_date, target_name, target_data)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$mode, $today, $target['nom'], json_encode($target)]);
    }
}
```

---

## 7. `friendships` — Demandes et relations d'amitié

**Pourquoi :** Gérer les états d'une relation (en attente → acceptée → bloquée). Séparé de `social_links` car une amitié peut exister sans Social Link (à l'acceptation, le Social Link est créé automatiquement).

```
id │ requester_id │ addressee_id │ status   │ created_at          │ accepted_at
───┼──────────────┼──────────────┼──────────┼─────────────────────┼────────────────────
1  │      1       │      2       │ accepted │ 2026-01-15 14:32:00 │ 2026-01-15 18:45:00
2  │      3       │      1       │ pending  │ 2026-03-28 09:12:00 │ NULL
3  │      2       │      3       │ accepted │ 2026-02-01 11:00:00 │ 2026-02-01 11:05:00
```

**Flow complet d'une demande d'ami :**

```
HamzaK entre le code "MK9X2ZP1"
    → lookup users WHERE friend_code = 'MK9X2ZP1'  → trouve L2GENDAIRE (id=2)
    → INSERT INTO friendships (requester_id=1, addressee_id=2, status='pending')
    → L2GENDAIRE voit une notif "HamzaK veut être ton ami"
    → L2GENDAIRE accepte
    → UPDATE friendships SET status='accepted', accepted_at=NOW() WHERE id=...
    → Automatiquement: INSERT INTO social_links (user_a_id=1, user_b_id=2)
       (user_a = MIN(1,2) = 1, user_b = MAX(1,2) = 2)
```

**Requête — Lister les amis d'un joueur avec leur Social Link :**

```sql
SELECT
    u.pseudo,
    u.id            AS friend_id,
    sl.rank         AS social_rank,
    sl.xp           AS social_xp,
    slr.name_fr     AS rank_name,
    sl.last_interaction_at
FROM v_friends vf                           -- vue symétrique
JOIN users u             ON u.id = vf.friend_id AND u.is_deleted = FALSE
LEFT JOIN social_links sl ON (
    (sl.user_a_id = LEAST(vf.user_id, vf.friend_id) AND
     sl.user_b_id = GREATEST(vf.user_id, vf.friend_id))
)
LEFT JOIN social_link_ranks slr ON slr.rank = sl.rank
WHERE vf.user_id = 1
ORDER BY sl.rank DESC, sl.xp DESC;
```

---

## 8. `social_links` — Le rang Social Link entre deux amis

**Pourquoi :** C'est la feature la plus originale du projet — un système de progression de relation inspiré directement des jeux Persona. Plus deux joueurs interagissent, plus leur rang monte. Au rang 10, un badge unique est généré avec les deux avatars.

**Convention d'unicité :**
`user_a_id` = TOUJOURS le plus petit des deux IDs. `user_b_id` = le plus grand.
Ainsi, HamzaK (id=1) et L2GENDAIRE (id=2) auront toujours `(user_a_id=1, user_b_id=2)` — jamais `(2, 1)`.

```
id │ user_a_id │ user_b_id │ rank │ xp   │ badge_generated │ last_interaction_at
───┼───────────┼───────────┼──────┼──────┼─────────────────┼────────────────────
1  │     1     │     2     │   7  │ 1420 │ false           │ 2026-03-29 22:14:00
2  │     1     │     3     │   3  │ 280  │ false           │ 2026-03-15 18:30:00
3  │     2     │     3     │   5  │ 710  │ false           │ 2026-03-27 20:00:00
```

**Lecture :**
- HamzaK et L2GENDAIRE sont au rang 7 "True Ally" (1420 XP, seuil suivant = 1750)
- HamzaK et Corbover au rang 3 "Companion" (280/450 XP pour rang 4)
- L2GENDAIRE et Corbover au rang 5 "Confidant"

**Requête — Ajouter de l'XP après une interaction :**

```sql
-- Exemple: HamzaK (id=1) partage son score à L2GENDAIRE (id=2)
-- Solo → 10 XP. Si L2GENDAIRE a aussi partagé aujourd'hui → 20 XP (mutuel)

-- 1. Obtenir l'ID du social link
SELECT id, rank, xp FROM social_links
WHERE user_a_id = LEAST(1, 2) AND user_b_id = GREATEST(1, 2);
-- → id=1, rank=7, xp=1420

-- 2. Logger l'interaction
INSERT INTO social_link_interactions
    (social_link_id, initiator_id, action_type, xp_gained, is_mutual)
VALUES (1, 1, 'share_score', 10, FALSE);

-- 3. Mettre à jour l'XP et le rang (via la fonction PostgreSQL)
SELECT * FROM add_social_link_xp(1, 10);
-- → new_xp=1430, new_rank=7, ranked_up=false
```

**Progression vers le rang 10 :**

```
HamzaK & L2GENDAIRE — actuellement 1420 XP / rang 7

Objectif rang 10 (True Confidant): 2700 XP → il manque 1280 XP

Si les deux jouent chaque jour (play_same_day = 20 XP/jour):
→ 1280 / 20 = 64 jours

Si en plus ils s'envoient leurs scores (share_score mutuel = 20 XP/j):
→ 1280 / 40 = 32 jours
```

---

## 9. `social_link_badges` — Le badge True Confidant

**Pourquoi :** Quand deux joueurs atteignent le rang 10, un badge unique est généré avec les avatars des deux joueurs côte à côte. Ce badge est stocké ici pour que les deux joueurs puissent l'afficher sur leur profil.

```
id │ social_link_id │ user_a_pseudo │ user_b_pseudo │ generated_at
───┼────────────────┼───────────────┼───────────────┼────────────────────
1  │       5        │ HamzaK        │ L2GENDAIRE    │ 2026-06-15 23:59:00
```

**Visuellement :**

```
┌──────────────────────────────────────────────────┐
│  ✦ TRUE CONFIDANT ✦                              │
│                                                   │
│   ┌──────┐              ┌──────┐                 │
│   │ 👤   │      ❤️       │  👤  │                 │
│   │HamzaK│              │L2GEN │                 │
│   └──────┘              └──────┘                 │
│                                                   │
│   "The bond between two Phantom Thieves"          │
└──────────────────────────────────────────────────┘
    → Badge affiché dans la collection des deux joueurs
    → Slug unique: "confidant_1_2" (lié au social_link_id)
```

**Génération PHP :**

```php
function generateTrueConfidantBadge(PDO $pdo, int $socialLinkId): void {
    // Vérifier que rang 10 est atteint et badge pas encore généré
    $stmt = $pdo->prepare("SELECT * FROM social_links WHERE id = ? AND rank = 10 AND badge_generated = FALSE");
    $stmt->execute([$socialLinkId]);
    $link = $stmt->fetch();
    if (!$link) return;

    // Récupérer les avatars et pseudos des deux joueurs
    $stmt = $pdo->prepare("
        SELECT u.pseudo, p.avatar_data
        FROM users u JOIN profiles p ON p.user_id = u.id
        WHERE u.id IN (?, ?)
    ");
    $stmt->execute([$link['user_a_id'], $link['user_b_id']]);
    $players = $stmt->fetchAll();

    // Insérer le badge
    $insert = $pdo->prepare("
        INSERT INTO social_link_badges
            (social_link_id, user_a_avatar, user_b_avatar, user_a_pseudo, user_b_pseudo)
        VALUES (?, ?, ?, ?, ?)
    ");
    $insert->execute([
        $socialLinkId,
        $players[0]['avatar_data'],
        $players[1]['avatar_data'],
        $players[0]['pseudo'],
        $players[1]['pseudo']
    ]);

    // Marquer comme généré
    $pdo->prepare("UPDATE social_links SET badge_generated = TRUE WHERE id = ?")->execute([$socialLinkId]);

    // Débloquer le badge dans badges_unlocked pour les deux joueurs
    $badgeId = 'confidant_' . $link['user_a_id'] . '_' . $link['user_b_id'];
    foreach ([$link['user_a_id'], $link['user_b_id']] as $uid) {
        $pdo->prepare("INSERT INTO badges_unlocked (user_id, badge_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
            ->execute([$uid, $badgeId]);
    }
}
```

---

## 10. `leaderboard_cache` — Cache des classements

**Pourquoi :** Calculer `RANK() OVER (ORDER BY wins DESC)` sur des milliers de joueurs à chaque requête est coûteux. On précalcule périodiquement (toutes les heures ou à minuit) et on stocke ici.

```
user_id │ mode      │ period   │ period_start │ score │ rank_position
────────┼───────────┼──────────┼──────────────┼───────┼──────────────
2       │ classic   │ all_time │ NULL         │  82   │     1
1       │ classic   │ all_time │ NULL         │  47   │     2
3       │ classic   │ all_time │ NULL         │  35   │     3
1       │ global    │ weekly   │ 2026-03-23   │  12   │     1
```

**Requête — Top 10 leaderboard Classic all_time :**

```sql
SELECT
    lc.rank_position,
    u.pseudo,
    p.avatar_data,
    p.avatar_border_color,
    p.selected_badges,
    t.name_en   AS title,
    lc.score
FROM leaderboard_cache lc
JOIN users u        ON u.id = lc.user_id AND u.is_deleted = FALSE
JOIN profiles p     ON p.user_id = u.id
LEFT JOIN titles t  ON t.id = p.equipped_title_id
WHERE lc.mode = 'classic'
  AND lc.period = 'all_time'
  AND lc.period_start IS NULL
ORDER BY lc.rank_position
LIMIT 10;
```

**Script PHP de recalcul (cron toutes les heures) :**

```php
function rebuildLeaderboard(PDO $pdo, string $mode, string $period): void {
    $weekStart  = date('Y-m-d', strtotime('last monday'));
    $monthStart = date('Y-m-01');

    $periodStart = match($period) {
        'weekly'  => $weekStart,
        'monthly' => $monthStart,
        default   => null,
    };

    // Calcul depuis game_sessions pour weekly/monthly
    // ou depuis user_stats pour all_time
    $sql = $period === 'all_time'
        ? "SELECT user_id, wins AS score FROM user_stats WHERE mode = :mode ORDER BY wins DESC"
        : "SELECT user_id, COUNT(*) AS score FROM game_sessions
           WHERE mode = :mode AND result = 'win' AND played_date >= :start
           GROUP BY user_id ORDER BY score DESC";

    // ... insérer dans leaderboard_cache avec RANK
}
```

---

## 11. `deletion_requests` + RGPD

**Pourquoi :** Obligation légale en Europe. Si un joueur demande la suppression de son compte, on doit être en mesure de tracer et confirmer la suppression.

**Flow complet :**

```
Joueur clique "Supprimer mon compte"
    │
    ▼
1. soft delete immédiat:
   UPDATE users SET is_deleted = TRUE, deleted_at = NOW(),
   email = 'deleted_' || id || '@anonymized.invalid',
   pseudo = 'Deleted_' || id
   WHERE id = :userId

2. anonymiser les données visibles:
   UPDATE profiles SET avatar_data = NULL WHERE user_id = :userId

3. logger la demande:
   INSERT INTO deletion_requests (user_id, deletion_type) VALUES (:userId, 'full')

4. Invalider la session → redirection vers index

5. Job cron quotidien (J+30):
   DELETE FROM users WHERE is_deleted = TRUE AND deleted_at < NOW() - INTERVAL '30 days'
   (cascade: supprime tout via ON DELETE CASCADE sur toutes les tables liées)
```

---

## 12. Migration localStorage → BDD

**Pourquoi :** Les joueurs existants ont leurs données dans `localStorage`. À la création de compte, on leur propose d'importer leur fichier JSON pour ne pas perdre leur progression.

**Format import (identique à l'export actuel de `profile.js`) :**

```json
{
  "pseudo": "HamzaK",
  "avatar": "data:image/png;base64,...",
  "avatarBorderColor": "#ff0000",
  "badges": ["ace_detective", "phantom_coder"],
  "selectedBadges": ["ace_detective", "phantom_coder"],
  "eventCodes": ["CHINESE2026", "DZULIAN"],
  "stats": {
    "wins": 47,
    "giveups": 8,
    "games": 60,
    "modeCount": { "Classic": 60, "Music": 30 },
    "streak": 5,
    "streakRecord": 12,
    "totalTimeMinutes": 380,
    "perfectWins": 3
  }
}
```

**Endpoint PHP — `POST /api/auth/migrate` :**

```php
function migrateLocalProfile(PDO $pdo, int $userId, array $importData): void {
    // 1. Profil
    $pdo->prepare("
        UPDATE profiles SET
            avatar_data = ?,
            avatar_border_color = ?,
            selected_badges = ?
        WHERE user_id = ?
    ")->execute([
        $importData['avatar'],
        $importData['avatarBorderColor'],
        json_encode($importData['selectedBadges']),
        $userId
    ]);

    // 2. Stats par mode
    foreach ($importData['stats']['modeCount'] as $mode => $games) {
        $mode = strtolower($mode); // 'Classic' → 'classic'
        $pdo->prepare("
            INSERT INTO user_stats (user_id, mode, games)
            VALUES (?, ?, ?)
            ON CONFLICT (user_id, mode) DO UPDATE SET games = EXCLUDED.games
        ")->execute([$userId, $mode, $games]);
    }

    // 3. Badges
    foreach ($importData['badges'] as $badgeId) {
        $pdo->prepare("
            INSERT INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)
            ON CONFLICT DO NOTHING
        ")->execute([$userId, $badgeId]);
    }

    // 4. Event codes
    foreach ($importData['eventCodes'] as $code) {
        $pdo->prepare("
            INSERT INTO event_codes_redeemed (user_id, code) VALUES (?, ?)
            ON CONFLICT DO NOTHING
        ")->execute([$userId, $code]);
    }
}
```

---

## Résumé des index importants

| Table | Index | Utilité |
|---|---|---|
| `users` | `email`, `pseudo`, `friend_code` | Connexion, recherche d'ami |
| `user_stats` | `(user_id, mode)` | Stats profil, leaderboard |
| `game_sessions` | `(user_id, mode)`, `played_date`, `(mode, date, target)` | Historique, stats globales |
| `social_links` | `user_a_id`, `user_b_id` | Récupération liens amis |
| `social_link_interactions` | `social_link_id`, `created_at` | Calcul XP, logs |
| `leaderboard_cache` | `(mode, period, score DESC)` | Affichage classement |
| `friendships` | `(requester_id, status)`, `(addressee_id, status)` | Liste amis, demandes en attente |

---

## Choix techniques — Pourquoi ces décisions ?

**PostgreSQL vs MySQL ?**
Les deux fonctionnent. PostgreSQL est recommandé si Hostinger propose un VPS (meilleur support JSON, fonctions PL/pgSQL, `ON CONFLICT`). Si Hostinger shared hosting → MySQL/MariaDB avec `ON DUPLICATE KEY UPDATE` à la place.

**Pas de table `messages` ?**
Délibéré — pas de messagerie directe en v1.2. Les interactions sociales passent par les actions de jeu (partage de score, défi), pas par du chat.

**`selected_badges` en JSON plutôt qu'une table séparée ?**
Max 4 badges, lu à chaque affichage de profil. JSON dans une colonne évite une jointure supplémentaire pour une donnée très simple. Si les besoins évoluent (badges equipables > 4, métadonnées), on migrera.

**`friend_code` plutôt que la recherche directe par pseudo ?**
Protection de la vie privée — un joueur ne peut pas être "trouvé" accidentellement par son pseudo exact. Il doit volontairement partager son code.
