-- Migration 008 — Add is_admin column to users
ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER is_deleted;
UPDATE users SET is_admin = 1 WHERE pseudo = 'admin';
