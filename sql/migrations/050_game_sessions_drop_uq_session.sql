-- ─────────────────────────────────────────────────────────────────────────────
-- 050 — game_sessions : la contrainte « une partie par jour » vivait encore en
--       prod sous un autre nom
--
-- Signalé le 2026-09-19 : « les joueurs ne débloquent pas le Mode Expert même en
-- remplissant les conditions ». En prod, AUCUN joueur n'a plus d'une session par
-- mode et par jour (10 377 sessions, max 1/jour partout). La porte Émoji
-- (« 10 victoires en une journée ») est donc inatteignable pour tout le monde,
-- les autres portes n'avancent que d'un cran par jour, et une partie Expert
-- jouée le même jour que la partie normale est perdue.
--
-- Cause : la migration 032 (« chaque partie compte ») supprimait
-- `uq_session_per_day (user_id, mode, played_date, is_expert)` — le nom de la
-- référence sql/bdd_mysql.sql. La table de prod (archive du 2026-05-06) porte
-- la même contrainte sous le nom **`uq_session` (user_id, mode, played_date)**,
-- sans is_expert. `DROP INDEX IF EXISTS uq_session_per_day` n'a rien trouvé,
-- rien dit, et la contrainte est restée. Chaque seconde partie du jour tombe en
-- erreur 23000, que api/lib/game_session.php traduit — depuis la 032, à raison
-- dans le monde de la référence — en 409 « déjà enregistrée » : le client la
-- jette en silence (savePendingSession). Depuis le 2026-09-01, chaque rejeu et
-- chaque partie Expert jouée après la normale ont été perdus sans un seul log.
--
-- Le diff information_schema prod ↔ référence fait pour la 048 ne comparait que
-- les COLONNES ; les index n'y étaient pas. Celui des UNIQUE ne montre que
-- celle-ci (hors tables propres à la prod).
--
-- Rejouable : DROP INDEX IF EXISTS. No-op sur la référence, qui ne l'a jamais eue.
-- Aucune ligne touchée ; backup game_sessions pris avant (1,7 Mo).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE game_sessions
    DROP INDEX IF EXISTS uq_session;

-- La clé d'idempotence de la 032 reste la seule contrainte d'unicité :
--   UNIQUE KEY uq_session_client_id (client_session_id)
-- et l'index de lecture non unique idx_session_per_day reste en place.

-- ── Contrôle (à lancer à la main après application) ─────────────────────────
-- SELECT INDEX_NAME, NON_UNIQUE FROM information_schema.STATISTICS
--  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND NON_UNIQUE = 0
--  GROUP BY INDEX_NAME, NON_UNIQUE;                → PRIMARY, uq_session_client_id seulement
