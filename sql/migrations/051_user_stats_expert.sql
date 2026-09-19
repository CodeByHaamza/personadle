-- ─────────────────────────────────────────────────────────────────────────────
-- 051 — user_stats_expert : les stats du Mode Expert deviennent une table,
--       comme celles du mode normal — donc éditables depuis l'admin
--
-- Demande Hamza du 2026-09-19 : « dans l'admin je ne peux pas modifier mes
-- stats Expert ». Normal : elles n'existaient pas. user_stats n'agrège que le
-- mode normal, et l'Expert était recalculé à la volée depuis game_sessions
-- (personadle_expert_stats_by_mode) — rien à éditer.
--
-- Cette table est le pendant Expert de user_stats : mêmes colonnes, une ligne
-- par (joueur, mode), alimentée à chaque partie Expert par
-- personadle_record_game_session(), lue par GET /api/user/:id/stats
-- (expert_by_mode) et éditable via PATCH /api/admin/users/:id/stats
-- { is_expert: true }.
--
-- Table séparée plutôt qu'une dimension is_expert dans user_stats : une
-- vingtaine de lecteurs (badges wins_total, classement « ever », compare,
-- profils publics, admin…) lisent user_stats en supposant « mode normal » —
-- une dimension dans la même table les aurait tous forcés à filtrer.
--
-- Reprise de l'historique : les compteurs sont recalculés depuis game_sessions
-- (is_expert = 1). La streak courante et le record ne se calculent pas en SQL
-- pur (jours consécutifs, frontière Paris) : ils partent à 0 et
-- scripts/backfill_expert_streaks.php les pose juste après (voir README des
-- migrations). Idempotente : CREATE IF NOT EXISTS + INSERT … ON DUPLICATE KEY.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_stats_expert (
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,
    wins            INT              NOT NULL DEFAULT 0,
    giveups         INT              NOT NULL DEFAULT 0,
    games           INT              NOT NULL DEFAULT 0,
    streak          INT              NOT NULL DEFAULT 0,
    streak_record   INT              NOT NULL DEFAULT 0,
    perfect_wins    INT              NOT NULL DEFAULT 0,
    total_time_ms   BIGINT           NOT NULL DEFAULT 0,
    last_played_at  TIMESTAMP        NULL,
    first_played_at TIMESTAMP        NULL,

    PRIMARY KEY (user_id, mode),
    CONSTRAINT fk_user_stats_expert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reprise des compteurs depuis l'historique Expert (rejouable : écrase par les mêmes valeurs).
-- Les horodatages viennent de played_date (DATE Paris) : created_at n'a été posé en prod
-- que par la 048 et vaut la date de cette migration pour tout l'historique.
INSERT INTO user_stats_expert (user_id, mode, wins, giveups, games, perfect_wins, total_time_ms, last_played_at, first_played_at)
SELECT user_id,
       mode,
       SUM(result = 'win'),
       SUM(result = 'giveup'),
       COUNT(*),
       SUM(result = 'win' AND attempts = 1),
       COALESCE(SUM(time_ms), 0),
       TIMESTAMP(MAX(played_date)),
       TIMESTAMP(MIN(played_date))
FROM game_sessions
WHERE is_expert = 1
GROUP BY user_id, mode
ON DUPLICATE KEY UPDATE
    wins            = VALUES(wins),
    giveups         = VALUES(giveups),
    games           = VALUES(games),
    perfect_wins    = VALUES(perfect_wins),
    total_time_ms   = VALUES(total_time_ms),
    last_played_at  = VALUES(last_played_at),
    first_played_at = VALUES(first_played_at);

-- ── Ensuite, une fois : php scripts/backfill_expert_streaks.php  (streak + record)
-- ── Contrôle ────────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM user_stats_expert;
-- SELECT mode, SUM(games) FROM user_stats_expert GROUP BY mode;   ≈ game_sessions is_expert=1
