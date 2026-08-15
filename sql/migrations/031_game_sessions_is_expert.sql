-- 031 — Mode Expert : distinguer une partie Expert d'une partie normale.
--
-- CONTEXTE (v2.1, décision produit 2026-08-15 avec Hamza)
-- Le Mode Expert rejoue les mêmes 6 modes avec une mécanique plus dure (Music :
-- paroles révélées vers par vers au lieu de l'audio). Une victoire Expert doit
-- compter SÉPARÉMENT d'une victoire normale : stats propres, streak propre, et
-- 4e dimension du classement (cf. ROADMAP.md, item "Filtre Expert sur le
-- classement" — la colonne arrive ici plus tôt que prévu, le front en a besoin).
--
-- POURQUOI L'UNIQUE KEY DOIT CHANGER
-- `uq_session_per_day (user_id, mode, played_date)` n'autorise qu'UNE session par
-- (joueur, mode, jour). Avec Expert stocké en `mode = 'music'` + `is_expert = 1`,
-- jouer le mode normal PUIS l'Expert le même jour déclencherait le doublon 23000
-- sur la 2e partie — que api/sessions.php intercepte silencieusement (`continue`,
-- cf. CLAUDE.md §7 "savePendingSession 409"). Résultat : la partie Expert serait
-- perdue sans erreur visible. La contrainte doit inclure is_expert.
--
-- Les lignes existantes sont toutes des parties normales → DEFAULT 0 les couvre,
-- aucun backfill nécessaire, et l'unicité reste équivalente pour elles.
--
-- ⚠️ Syntaxe : `ADD COLUMN IF NOT EXISTS` est MariaDB (prod Hostinger). Sur MySQL
--    8.0 (dev local / CI), retirer les deux `IF NOT EXISTS` — cf. CLAUDE.md §7.

-- 1. Le drapeau. TINYINT(1) plutôt que BOOLEAN : même chose en MySQL/MariaDB, et
--    cohérent avec le reste du schéma.
ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS is_expert TINYINT(1) NOT NULL DEFAULT 0 AFTER mode;

-- 2. Refonte de l'anti-doublon pour autoriser 1 partie normale + 1 partie Expert
--    par mode et par jour. DROP puis ADD : MySQL n'a pas d'ALTER INDEX.
ALTER TABLE game_sessions
    DROP INDEX uq_session_per_day;

ALTER TABLE game_sessions
    ADD UNIQUE KEY uq_session_per_day (user_id, mode, played_date, is_expert);

-- 3. Index de lecture — le classement et les stats filtrent désormais sur is_expert.
CREATE INDEX idx_game_sessions_user_mode_expert
    ON game_sessions(user_id, mode, is_expert);
