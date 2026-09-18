-- ─────────────────────────────────────────────────────────────────────────────
-- 048 — Les colonnes « cosmétiques » de la 025 ne le sont plus : user_titles.id
--       casse le Compendium en prod
--
-- Constaté le 2026-09-18, trente minutes après la mise en prod de la 2.2 :
-- « Le Compendium est indisponible pour le moment » pour tout le monde.
-- api/user/compendium.php (nouveau en 2.2) trie les titres par
-- `ORDER BY ut.unlocked_at, ut.id` — et `user_titles` en prod (archive du
-- 2026-05-06) n'a pas de colonne `id` : clé primaire composite (user_id,
-- title_id), comme `badges_unlocked` avant la 025. → 1054 Unknown column,
-- 500, page vide.
--
-- La 025 avait laissé quatre colonnes de sql/bdd_mysql.sql absentes en prod
-- parce qu'aucun code ne les lisait : titles.description_*/name_jp (rattrapé
-- par la 044), user_titles.id (ici), user_stats.id, game_sessions.created_at,
-- social_link_ranks.name_jp. Deux fois en une journée, l'écart est devenu
-- fonctionnel : on aligne les quatre restantes d'un coup pour que la référence
-- et la prod aient enfin les mêmes colonnes, et que le code puisse être écrit
-- contre bdd_mysql.sql sans arrière-pensée.
--
-- Même technique que la 025 pour les `id` : AUTO_INCREMENT ajouté SANS toucher
-- la clé primaire composite existante (AUTO_INCREMENT est autorisé sur la
-- première colonne d'une UNIQUE KEY). Les lignes existantes sont numérotées
-- automatiquement. Tables petites (400 user_titles, 1 782 user_stats,
-- 10 330 game_sessions) : rebuild en moins d'une seconde.
--
-- Idempotente (IF NOT EXISTS partout) ; no-op sur une base importée de
-- bdd_mysql.sql (Docker, CI) où ces colonnes existent déjà.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. user_titles.id — celle qui casse le Compendium
ALTER TABLE user_titles
    ADD COLUMN IF NOT EXISTS id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD UNIQUE KEY IF NOT EXISTS uq_user_titles_id (id);

-- 2. user_stats.id
ALTER TABLE user_stats
    ADD COLUMN IF NOT EXISTS id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD UNIQUE KEY IF NOT EXISTS uq_user_stats_id (id);

-- 3. game_sessions.created_at — les lignes existantes prennent l'instant de la
--    migration (pas leur vraie date de création, qui est played_at) ; aucun
--    code ne lit cette colonne, c'est la référence qu'on rejoint.
ALTER TABLE game_sessions
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 4. social_link_ranks.name_jp
ALTER TABLE social_link_ranks
    ADD COLUMN IF NOT EXISTS name_jp VARCHAR(50) NULL AFTER name_it;

-- ── Contrôle (à lancer à la main après application) ─────────────────────────
-- SELECT COUNT(*) FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE()
--    AND ((TABLE_NAME='user_titles' AND COLUMN_NAME='id')
--      OR (TABLE_NAME='user_stats' AND COLUMN_NAME='id')
--      OR (TABLE_NAME='game_sessions' AND COLUMN_NAME='created_at')
--      OR (TABLE_NAME='social_link_ranks' AND COLUMN_NAME='name_jp'));   → 4
-- curl -s -o /dev/null -w '%{http_code}' 'https://personadle.net/api/user/compendium?id=156'  → 200
