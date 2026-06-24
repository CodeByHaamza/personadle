-- Migration 004: add metric column and update unique key on leaderboard_cache
ALTER TABLE leaderboard_cache
    ADD COLUMN IF NOT EXISTS metric VARCHAR(20) NOT NULL DEFAULT 'wins' AFTER period,
    DROP INDEX IF EXISTS uq_leaderboard,
    ADD UNIQUE KEY uq_leaderboard (user_id, mode, period, metric, period_start);
