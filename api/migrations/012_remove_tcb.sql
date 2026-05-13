-- Migration 012 — Suppression True Confidant Badge
-- Note: This migration requires ALTER privileges.
-- Run as MySQL admin: mysql -u admin -p personadle_db < 012_remove_tcb.sql

-- Drop badge_generated column if it exists
ALTER TABLE social_links DROP COLUMN IF EXISTS badge_generated;

-- Drop social_link_badges table if it exists
DROP TABLE IF EXISTS social_link_badges;
