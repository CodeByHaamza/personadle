-- Migration 018 — Réinitialisation de mot de passe (token par email).
-- Le token brut est envoyé par email ; seul son hash sha256 est stocké, avec expiration.
-- MariaDB : IF NOT EXISTS supporté. MySQL 8.0 : retirer "IF NOT EXISTS".
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash    VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME    NULL;
