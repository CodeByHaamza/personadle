-- ════════════════════════════════════════════════════════════════════════════
-- 057 — Un code événement peut accorder un TITRE (2.4, lot 9)
--
-- Jusqu'ici un code donnait un badge, et seulement un badge (`badge_id NOT NULL`).
-- Pour les codes exclusifs au Discord, le titre est la récompense la moins chère
-- à produire (un nom et une bannière, pas d'illustration de badge). Un code porte
-- désormais un badge, un titre, ou les deux — au moins l'un des deux, vérifié par
-- l'admin (api/admin/event_codes.php) et par l'échange (api/lib/event_codes.php).
--
-- `title_slug` et non `title_id` : même choix que `badge_id` (un slug), lisible
-- dans l'admin et stable d'une base à l'autre — les id de `titles` diffèrent
-- entre la prod et Docker.
--
-- ⚠️ Aucun CODE ici, ni dans aucune migration à partir de celle-ci : le dépôt est
-- public, un code écrit dans un fichier suivi n'est plus exclusif à personne.
-- Les codes se créent dans l'admin (tests/event_codes_not_in_repo.test.js).
--
-- Idempotente : `MODIFY` est rejouable, `ADD COLUMN IF NOT EXISTS` (MariaDB,
-- comme la prod 11.8 et l'image Docker 10.6).
-- Après l'avoir jouée : INSERT IGNORE INTO schema_migrations (version) VALUES ('057_event_code_titles');
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE event_codes MODIFY COLUMN badge_id VARCHAR(100) NULL;

ALTER TABLE event_codes ADD COLUMN IF NOT EXISTS title_slug VARCHAR(100) NULL AFTER badge_id;
