-- ─────────────────────────────────────────────────────────────────────────────
-- 047 — leaderboard_cache.score : INT en prod, DECIMAL(8,1) dans la référence
--
-- Constaté le 2026-09-18 pendant la release 2.2, en diffant information_schema
-- de la prod contre sql/bdd_mysql.sql : la table de prod (archive du 2026-05-06)
-- déclare `score int(11)`, la référence `DECIMAL(8,1)`. Or la métrique
-- « winrate » (api/lib/leaderboard_metrics.php, personadle_ratio_expr) produit un
-- pourcentage arrondi à une décimale : stocké en INT, 73.4 devient 73, et deux
-- joueurs à 73.4 et 73.1 se retrouvent à égalité dans le classement mis en cache
-- (day/week/month). Aucune ligne n'est perdue à l'élargissement ; les métriques
-- entières (wins, perfect, games, streak) ne bougent pas.
--
-- Idempotente : MODIFY vers la définition déjà en place est un no-op (Docker, CI).
-- Le cache était vide en prod au moment de jouer la migration (cron horaire
-- jamais passé) — la 048 éventuelle n'a donc rien à recalculer, le prochain
-- passage du cron remplit la table avec le bon type.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE leaderboard_cache
    MODIFY COLUMN score DECIMAL(8,1) NOT NULL;

-- ── Contrôle (à lancer à la main après application) ─────────────────────────
-- SHOW COLUMNS FROM leaderboard_cache LIKE 'score';   → decimal(8,1), NO
