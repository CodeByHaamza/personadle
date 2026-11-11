-- ════════════════════════════════════════════════════════════════════════════
-- 058 — La partie du jour se distingue des rejouées (2.4, lot 16)
--
-- Depuis la 032, chaque Rejouer ajoute une ligne à game_sessions, et
-- user_stats cumule tout. Le classement principal récompensait donc qui rejoue
-- le plus : des comptes à 600+ parties « depuis toujours » devant des joueurs
-- quotidiens. `is_daily = 1` marque la PREMIÈRE partie d'un joueur par mode, par
-- jour et par dimension (normal / Expert) — celle que tout le monde joue à
-- armes égales. Le classement principal ne compte plus qu'elle ; « toutes les
-- parties » reste une vue au choix.
--
-- Rattrapage : la première ligne (plus petit id) de chaque groupe
-- (user_id, mode, played_date, is_expert) devient la partie du jour.
-- Idempotente : `ADD COLUMN IF NOT EXISTS` (MariaDB, prod 11.8 / Docker 10.6),
-- index créé seulement s'il manque, UPDATE qui ne fait que poser des 1 déjà vrais.
-- Après l'avoir jouée : INSERT IGNORE INTO schema_migrations (version) VALUES ('058_game_sessions_is_daily');
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS is_daily TINYINT(1) NOT NULL DEFAULT 0 AFTER is_expert;

UPDATE game_sessions gs
JOIN (
    SELECT MIN(id) AS id
    FROM game_sessions
    GROUP BY user_id, mode, played_date, is_expert
) first_of_day ON first_of_day.id = gs.id
SET gs.is_daily = 1
WHERE gs.is_daily = 0;

CREATE INDEX IF NOT EXISTS idx_game_sessions_daily ON game_sessions (is_daily, played_date);
