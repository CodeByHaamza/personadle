-- 023 — Cible aléatoire dédiée aux défis (décision produit 2026-07-17, Hamza).
--
-- Avant : un défi = « bats mon score sur le puzzle du jour » (challenge_mode/
-- date/filters, pas de cible propre). Si le destinataire avait déjà joué le
-- mode ce jour-là, il retombait sur une cible qu'il connaissait déjà.
-- Après : l'expéditeur tire une cible aléatoire (différente de la cible du
-- jour) dans le pool filtré du mode, stockée ici et jouée par le destinataire.
--
-- NULL = ancien défi (pré-migration) → le client retombe sur la cible du jour,
-- comportement d'avant (compat ascendante, pas de backfill nécessaire).
--
-- ⚠️ Syntaxe MariaDB (IF NOT EXISTS) — pour MySQL 8.0 local, retirer la clause.

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS challenge_target VARCHAR(200) NULL AFTER challenge_filters;
