-- Migration 012 — Suppression True Confidant Badge
ALTER TABLE social_links DROP COLUMN IF EXISTS badge_generated;
DROP TABLE IF EXISTS social_link_badges;
