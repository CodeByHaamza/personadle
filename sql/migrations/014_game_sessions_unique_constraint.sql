-- Migration 014 : Contrainte UNIQUE sur game_sessions pour prévenir le double-enregistrement concurrent
-- Remplace le SELECT préalable fragile (TOCTOU) dans sessions.php.

ALTER TABLE game_sessions
  ADD UNIQUE KEY uq_session_per_day (user_id, mode, played_date);

-- Index composite pour les requêtes de vérification et de leaderboard
ALTER TABLE game_sessions
  ADD INDEX idx_gs_user_mode_date (user_id, mode, played_date);
