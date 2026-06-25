-- Migration 016 — Streak globale autoritative (jours consécutifs, tous modes).
-- Corrige l'effondrement du streak cross-mode (cloud-sync prenait le max par-mode).
-- MariaDB : IF NOT EXISTS supporté. MySQL 8.0 : retirer "IF NOT EXISTS".
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS global_streak        INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS global_streak_record INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS global_streak_date   DATE DEFAULT NULL;
