-- 025 — Reconciliation des colonnes prod manquantes UTILISÉES par le code (suite 024).
--
-- CONTEXTE : la base prod Hostinger (issue de l'archive hostinger_full.sql du
-- 2026-05-06 + migrations 001-023) a d'autres colonnes absentes que le code
-- déployé référence → 500. Audit complet réalisé le 2026-07-24 :
-- diff `information_schema` (prod) vs `bdd_mysql.sql` (source), CROISÉ avec
-- l'usage réel dans api/*.php. Seules 4 colonnes sont à la fois MANQUANTES en
-- prod ET utilisées par le code — les seules à corriger :
--
--   badges_unlocked.id        SELECT id ...            api/admin/user_badges.php
--   event_codes_redeemed.id   SELECT id ...            api/badges/index.php
--   friendships.accepted_at   UPDATE ... accepted_at   api/friends/index.php
--   messages.challenge_score  INSERT/SELECT ...        api/messages/index.php
--
-- Dérive cosmétique NON touchée (colonnes absentes mais jamais lues par le code) :
--   titles.description_* / titles.name_jp / social_link_ranks.name_jp /
--   user_stats.id / user_titles.id / game_sessions.created_at.
--   Les ajouter serait du zèle risqué sans bénéfice fonctionnel.
--
-- ⚠️ mysqldump AVANT (fait des ALTER). Appliquer via le client mysql en SSH.
--    ADD COLUMN IF NOT EXISTS + ADD UNIQUE KEY IF NOT EXISTS → ré-exécutable
--    sans casse (MariaDB).

-- 1. badges_unlocked.id  (l'endpoint "donner un badge" fait SELECT id ...)
--    id AUTO_INCREMENT ajouté SANS toucher la PK composite existante
--    (user_id, badge_id) : AUTO_INCREMENT est autorisé sur la 1re colonne d'une
--    UNIQUE KEY, pas besoin que ce soit la PRIMARY KEY.
ALTER TABLE badges_unlocked
    ADD COLUMN IF NOT EXISTS id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD UNIQUE KEY IF NOT EXISTS uq_badges_unlocked_id (id);

-- 2. event_codes_redeemed.id  (api/badges/index.php : SELECT id ...)
ALTER TABLE event_codes_redeemed
    ADD COLUMN IF NOT EXISTS id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD UNIQUE KEY IF NOT EXISTS uq_event_codes_redeemed_id (id);

-- 3. friendships.accepted_at  (api/friends/index.php : UPDATE ... accepted_at = NOW())
ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP NULL AFTER status;

-- 4. messages.challenge_score  (api/messages/index.php : INSERT/SELECT challenge_score)
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS challenge_score INT NULL AFTER challenge_mode;
