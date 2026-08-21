-- 032 — Toutes les parties comptent, la streak seule reste journalière.
--
-- CONTEXTE (décision produit 2026-08-15, Hamza)
-- Jusqu'ici `uq_session_per_day (user_id, mode, played_date, is_expert)` n'autorisait
-- qu'UNE session par joueur, par mode et par jour : les replays n'étaient pas
-- enregistrés. Un joueur qui enchaîne 50 victoires dans la soirée n'en voyait
-- qu'une dans ses stats, ce qui a été remonté comme un bug de sauvegarde.
--
-- Nouvelle règle : chaque partie terminée compte dans les stats et le score.
-- Seule la STREAK reste journalière — elle mesure la régularité, pas le volume,
-- et se calcule désormais sur les jours distincts (cf. personadle_recompute_mode_streak).
--
-- POURQUOI UNE CLÉ D'IDEMPOTENCE
-- La contrainte d'unicité servait aussi, accidentellement, de garde-fou contre les
-- doubles insertions : `savePendingSession()` (js/gameCore.js) met les sessions en
-- file dans localStorage quand le réseau tombe, puis les rejoue. Un timeout côté
-- client sur une requête que le serveur a bien traitée aurait, sans contrainte,
-- inséré la partie deux fois. `client_session_id` est un UUID généré par le client
-- au moment de bâtir la session : il rend le rejeu inoffensif sans plafonner le
-- nombre de parties par jour.
--
-- NULL autorisé : les lignes antérieures à cette migration n'en ont pas, et une
-- colonne UNIQUE accepte plusieurs NULL en MySQL comme en MariaDB.
--
-- ⚠️ ORDRE OBLIGATOIRE : la 031 doit être jouée AVANT (la colonne ci-dessous est
--    déclarée `AFTER is_expert`, que la 031 crée).
-- ⚠️ BACKUP avant application — cette migration SUPPRIME une contrainte d'unicité.
--    Elle n'efface aucune donnée, mais le retour arrière exigerait de dédoublonner
--    à la main les parties enregistrées entre-temps.
-- ⚠️ Syntaxe : `ADD COLUMN IF NOT EXISTS` est MariaDB (prod Hostinger). Sur MySQL
--    8.0 (dev local / CI), retirer la clause — cf. CLAUDE.md §7.

-- 1. Clé d'idempotence, en remplacement du rôle anti-doublon de l'unique key.
ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS client_session_id CHAR(36) NULL AFTER is_expert;

ALTER TABLE game_sessions
    ADD UNIQUE KEY IF NOT EXISTS uq_session_client_id (client_session_id);

-- 2. Libération du plafond d'une partie par jour.
-- IF EXISTS : la 031 a pu ne pas être jouée (ou l'avoir déjà droppé). Sans la
-- clause, la migration casse ici en laissant la colonne et l'unique key de
-- l'étape 1 déjà appliquées — ALTER TABLE n'est pas transactionnel.
ALTER TABLE game_sessions
    DROP INDEX IF EXISTS uq_session_per_day;

-- 3. Le même quadruplet reste l'axe de lecture principal (streak, stats du jour,
--    anti-triche) : on garde l'index, simplement non unique.
CREATE INDEX IF NOT EXISTS idx_session_per_day
    ON game_sessions(user_id, mode, played_date, is_expert);
