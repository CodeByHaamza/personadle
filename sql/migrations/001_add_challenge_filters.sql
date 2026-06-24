-- Migration 001 — add challenge_filters column to messages table
-- Run as a DB admin user (not personadle_usr which has no ALTER privilege):
--   mysql -u <admin> -p personadle_db < api/migrations/001_add_challenge_filters.sql

ALTER TABLE messages
    ADD COLUMN challenge_filters TEXT NULL AFTER challenge_date;
