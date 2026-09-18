-- =============================================================================
-- 045 — Le classement gagne son axe Expert
-- =============================================================================
-- Jusqu'ici l'Expert était exclu du classement PARTOUT, et c'était cohérent :
--   - api/cron/leaderboard.php et api/leaderboard/index.php filtraient
--     `gs.is_expert = 0` ;
--   - api/lib/leaderboard_metrics.php faisait de même pour la série ;
--   - la période 'ever' lisait `user_stats`, que le Mode Expert n'alimente pas
--     (api/lib/game_session.php) — donc l'exclusion était vraie par construction,
--     sans filtre explicite.
-- Les commentaires en place l'assumaient : « classement Expert = dimension à
-- part, pas encore exposée ». Cette migration l'expose.
--
-- ── Pourquoi une colonne et non un `mode` de plus ────────────────────────────
-- Même raisonnement que `game_sessions.is_expert` (031) et
-- `messages.challenge_is_expert` (037) : l'Expert est une DIMENSION du mode, pas
-- un mode supplémentaire. Un `mode = 'classic_expert'` aurait dupliqué les 7
-- valeurs de mode, cassé le filtre par mode du front, et rendu le total 'all'
-- ambigu (all = normal + Expert mélangés ?).
--
-- ── Conséquence sur la clé unique ────────────────────────────────────────────
-- `uq_leaderboard` devient (user_id, mode, period, metric, period_start,
-- is_expert). Sans ça, le cron écraserait la ligne normale d'un joueur avec sa
-- ligne Expert à chaque passage : un seul des deux classements survivrait, et
-- lequel dépendrait de l'ordre d'exécution.
--
-- L'index de lecture est refait pour la même raison : l'endpoint filtre
-- désormais sur is_expert, et un index qui l'ignore force un tri sur des lignes
-- dont la moitié sera jetée.
--
-- Défaut 0 : toutes les lignes en cache aujourd'hui sont des lignes normales —
-- c'était le seul cas possible avant cette migration.
--
-- ⚠️ Syntaxe MariaDB (`ADD COLUMN IF NOT EXISTS`), comme 031/032/037.
-- MySQL 8.0 la refuse. La prod tourne en MariaDB 10.6.
--
-- Idempotente : rejouable sans effet de bord.
-- =============================================================================

ALTER TABLE leaderboard_cache
    ADD COLUMN IF NOT EXISTS is_expert TINYINT(1) NOT NULL DEFAULT 0
    AFTER metric;

-- La clé unique doit inclure la dimension. `DROP KEY` n'accepte pas
-- `IF EXISTS` sur toutes les versions : on passe par information_schema pour
-- rester rejouable.
SET @has_old := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE table_schema = DATABASE()
      AND table_name   = 'leaderboard_cache'
      AND index_name   = 'uq_leaderboard'
      AND column_name  = 'is_expert'
);

SET @sql := IF(@has_old = 0,
    'ALTER TABLE leaderboard_cache
        DROP KEY uq_leaderboard,
        ADD UNIQUE KEY uq_leaderboard (user_id, mode, period, metric, period_start, is_expert)',
    'SELECT "uq_leaderboard porte déjà is_expert" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index de lecture : même colonnes qu'avant, plus la dimension en tête de
-- sélectivité (l'endpoint filtre toujours dessus).
DROP INDEX IF EXISTS idx_leaderboard_ranking ON leaderboard_cache;
CREATE INDEX idx_leaderboard_ranking
    ON leaderboard_cache (mode, period, metric, is_expert, period_start, score DESC);
