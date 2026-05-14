-- Migration 002 — Ajoute has_migrated à la table users
-- Exécuter une seule fois sur les bases existantes (v2.0 déjà déployées).
-- Les nouvelles installations passent directement par bdd_mysql.sql.

ALTER TABLE users
    ADD COLUMN has_migrated TINYINT(1) NOT NULL DEFAULT 0
    AFTER remember_me_expires;
