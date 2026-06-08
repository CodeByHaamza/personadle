-- Migration 013 : Tracking server-side du cooldown de récupération de streak Jack Frost
-- Remplace le contrôle localStorage (contournable) par une contrainte BDD.

ALTER TABLE users
  ADD COLUMN streak_recovered_at DATETIME DEFAULT NULL
    COMMENT 'Dernière récupération Jack Frost — cooldown 60j enforced côté serveur';
