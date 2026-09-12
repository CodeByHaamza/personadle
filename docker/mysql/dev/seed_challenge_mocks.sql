-- =============================================================================
-- seed_challenge_mocks.sql — jeu de données de test pour la page Amis et les défis
-- =============================================================================
-- NE JAMAIS charger en production. À rejouer sur la base Docker, pour UN compte
-- existant (le tien), afin de voir d'un coup tous les états d'un défi dans
-- l'interface : à accepter, en cours, abandonné, battu, expiré, et côté
-- expéditeur : en attente, accepté par l'ami, battu, expiré. Plus des demandes
-- d'ami en attente, et sept Social Links au rang 10 (True Confidant).
--
-- Usage (depuis la racine du dépôt, stack démarrée) :
--   docker compose exec -T db mariadb -u root -prootpassword personadle_db \
--     -e "SET @code := 'GT2UJPML';" -e "source /dev/stdin" < docker/mysql/dev/seed_challenge_mocks.sql
-- ou plus simplement, en éditant le code ci-dessous :
--   docker compose exec -T db mariadb -u root -prootpassword personadle_db < docker/mysql/dev/seed_challenge_mocks.sql
--
-- Rejouable : les défis posés ici portent content = '[mock]' et sont supprimés
-- avant réinsertion ; amitiés et Social Links sont en INSERT IGNORE / UPDATE.
-- Les amis sont les comptes de 03_seed_dev.sql (mot de passe commun : test1234).
-- =============================================================================

-- Le client mariadb en ligne de commande ouvre la connexion en latin1 : sans
-- ça, le moindre emoji dans un message est refusé (Incorrect string value).
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @code := COALESCE(@code, 'GT2UJPML');
SET @me   := (SELECT id FROM users WHERE friend_code = @code LIMIT 1);

-- Garde-fou : un code inconnu doit échouer bruyamment, pas semer des NULL.
SET @check := IF(@me IS NULL, (SELECT CAST('friend_code inconnu — vérifier @code' AS SIGNED)), 0);

-- ── Comptes de seed utilisés ──────────────────────────────────────────────────
SET @ren    := (SELECT id FROM users WHERE pseudo = 'Ren'        LIMIT 1);
SET @makoto := (SELECT id FROM users WHERE pseudo = 'MakotoYuki' LIMIT 1);
SET @kotone := (SELECT id FROM users WHERE pseudo = 'Kotone'     LIMIT 1);
SET @yosuke := (SELECT id FROM users WHERE pseudo = 'Yosuke'     LIMIT 1);
SET @aigis  := (SELECT id FROM users WHERE pseudo = 'Aigis'      LIMIT 1);
SET @futaba := (SELECT id FROM users WHERE pseudo = 'Futaba'     LIMIT 1);
SET @naoto  := (SELECT id FROM users WHERE pseudo = 'Naoto'      LIMIT 1);
SET @yu     := (SELECT id FROM users WHERE pseudo = 'Yu'         LIMIT 1);
SET @wonder := (SELECT id FROM users WHERE pseudo = 'Wonder'     LIMIT 1);
SET @adachi := (SELECT id FROM users WHERE pseudo = 'Adachi'     LIMIT 1);
SET @akechi := (SELECT id FROM users WHERE pseudo = 'Akechi'     LIMIT 1);
SET @maya   := (SELECT id FROM users WHERE pseudo = 'Maya'       LIMIT 1);

SET @today := DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', 'Europe/Paris'));
SET @today := COALESCE(@today, CURDATE()); -- si les tables de fuseaux ne sont pas chargées

-- ── 1. Amitiés acceptées (les 7 True Confidants + 2 amis « ordinaires ») ─────
INSERT IGNORE INTO friendships (requester_id, addressee_id, status, created_at, accepted_at) VALUES
  (@ren,    @me, 'accepted', NOW() - INTERVAL 90 DAY, NOW() - INTERVAL 89 DAY),
  (@me, @makoto, 'accepted', NOW() - INTERVAL 80 DAY, NOW() - INTERVAL 80 DAY),
  (@kotone, @me, 'accepted', NOW() - INTERVAL 75 DAY, NOW() - INTERVAL 74 DAY),
  (@me, @yosuke, 'accepted', NOW() - INTERVAL 60 DAY, NOW() - INTERVAL 59 DAY),
  (@aigis,  @me, 'accepted', NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 45 DAY),
  (@me, @futaba, 'accepted', NOW() - INTERVAL 30 DAY, NOW() - INTERVAL 29 DAY),
  (@naoto,  @me, 'accepted', NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY),
  (@me,     @yu, 'accepted', NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY),
  (@wonder, @me, 'accepted', NOW() - INTERVAL 3 DAY,  NOW() - INTERVAL 2 DAY);

-- Demandes en attente : deux reçues (onglet Amis → pastille), une envoyée.
INSERT IGNORE INTO friendships (requester_id, addressee_id, status, created_at) VALUES
  (@adachi, @me, 'pending', NOW() - INTERVAL 1 DAY),
  (@akechi, @me, 'pending', NOW() - INTERVAL 2 HOUR),
  (@me,   @maya, 'pending', NOW() - INTERVAL 5 HOUR);

-- ── 2. Social Links au rang 10 avec les sept (user_a_id < user_b_id) ─────────
-- rang 10 = 2700 XP (social_link_ranks). Yu et Wonder restent à un rang moyen,
-- pour comparer le marqueur True Confidant à une jauge ordinaire.
INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp, created_at, last_interaction_at)
SELECT LEAST(@me, f), GREATEST(@me, f), 10, 2700, NOW() - INTERVAL 60 DAY, NOW() - INTERVAL 1 DAY
FROM (SELECT @ren f UNION ALL SELECT @makoto UNION ALL SELECT @kotone UNION ALL SELECT @yosuke
      UNION ALL SELECT @aigis UNION ALL SELECT @futaba UNION ALL SELECT @naoto) AS t
ON DUPLICATE KEY UPDATE `rank` = 10, xp = 2700;

INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp, created_at, last_interaction_at) VALUES
  (LEAST(@me, @yu),     GREATEST(@me, @yu),     4, 420, NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 1 DAY),
  (LEAST(@me, @wonder), GREATEST(@me, @wonder), 2, 130, NOW() - INTERVAL 3 DAY,  NOW())
ON DUPLICATE KEY UPDATE `rank` = VALUES(`rank`), xp = VALUES(xp);

-- ── 3. Défis — tous les états, dans les deux sens ────────────────────────────
DELETE FROM messages WHERE content = '[mock]' AND (sender_id = @me OR receiver_id = @me);

-- Reçus, à accepter (unread) — un par ami et par mode, cibles valides des pools.
INSERT INTO messages (sender_id, receiver_id, type, content, challenge_mode, challenge_score, challenge_date, challenge_filters, challenge_target, challenge_is_expert, status, created_at) VALUES
  (@ren,    @me, 'challenge', '[mock]', 'classic',    4, @today, '[]', 'Sho Minazuki',      0, 'unread', NOW() - INTERVAL 10 MINUTE),
  (@kotone, @me, 'challenge', '[mock]', 'emoji',      3, @today, '[]', 'Jin Shirato',       0, 'unread', NOW() - INTERVAL 25 MINUTE),
  (@aigis,  @me, 'challenge', '[mock]', 'silhouette', 2, @today, '[]', 'Tohru Adachi',      0, 'unread', NOW() - INTERVAL 1 HOUR),
  (@naoto,  @me, 'challenge', '[mock]', 'personae',   3, @today, '[]', 'Amaterasu',         0, 'unread', NOW() - INTERVAL 2 HOUR),
  (@wonder, @me, 'challenge', '[mock]', 'alloutattack', 4, @today, '[]', 'Aigis',           0, 'unread', NOW() - INTERVAL 3 HOUR),
  -- Expert (tu as débloqué Music Expert en local) : arrive sur ?expert=1
  (@futaba, @me, 'challenge', '[mock]', 'music',      3, @today, '[]', 'Pull the Trigger',  1, 'unread', NOW() - INTERVAL 40 MINUTE);

-- Reçu, en cours (accepted) : la Boîte propose « Reprendre » / « Abandonner ».
INSERT INTO messages (sender_id, receiver_id, type, content, challenge_mode, challenge_score, challenge_date, challenge_filters, challenge_target, challenge_is_expert, status, created_at) VALUES
  (@yosuke, @me, 'challenge', '[mock]', 'classic',    5, @today, '[]', 'Zenkichi Hasegawa', 0, 'accepted', NOW() - INTERVAL 4 HOUR);

-- Reçus, terminés : abandonné (read), battus, expirés — dans le passé.
INSERT INTO messages (sender_id, receiver_id, type, content, challenge_mode, challenge_score, challenge_date, challenge_filters, challenge_target, challenge_is_expert, status, created_at) VALUES
  (@makoto, @me, 'challenge', '[mock]', 'music',      3, @today - INTERVAL 1 DAY, '[]', 'Maze of Life',   0, 'read',    NOW() - INTERVAL 1 DAY),
  (@ren,    @me, 'challenge', '[mock]', 'emoji',      4, @today - INTERVAL 2 DAY, '[]', 'Naoya Todou',    0, 'beaten',  NOW() - INTERVAL 2 DAY),
  (@kotone, @me, 'challenge', '[mock]', 'silhouette', 3, @today - INTERVAL 3 DAY, '[]', 'Sojiro Sakura',  0, 'beaten',  NOW() - INTERVAL 3 DAY),
  (@aigis,  @me, 'challenge', '[mock]', 'classic',    2, @today - INTERVAL 4 DAY, '[]', 'Jin Shirato',    0, 'expired', NOW() - INTERVAL 4 DAY),
  (@yu,     @me, 'challenge', '[mock]', 'personae',   3, @today - INTERVAL 6 DAY, '[]', 'Agnes',          0, 'expired', NOW() - INTERVAL 6 DAY);

-- Envoyés par toi : en attente, accepté par l'ami, battu par lui, expiré.
INSERT INTO messages (sender_id, receiver_id, type, content, challenge_mode, challenge_score, challenge_date, challenge_filters, challenge_target, challenge_is_expert, status, created_at) VALUES
  (@me, @ren,    'challenge', '[mock]', 'emoji',      5, @today, '[]', 'Sho Minazuki',       0, 'unread',   NOW() - INTERVAL 30 MINUTE),
  (@me, @aigis,  'challenge', '[mock]', 'classic',    5, @today, '[]', 'Naoya Todou',        0, 'unread',   NOW() - INTERVAL 50 MINUTE),
  (@me, @kotone, 'challenge', '[mock]', 'music',      3, @today, '[]', 'A Lone Prayer',      0, 'accepted', NOW() - INTERVAL 2 HOUR),
  (@me, @futaba, 'challenge', '[mock]', 'silhouette', 4, @today - INTERVAL 1 DAY, '[]', 'Keisuke Hiraga', 0, 'beaten',   NOW() - INTERVAL 1 DAY),
  (@me, @naoto,  'challenge', '[mock]', 'classic',    3, @today - INTERVAL 5 DAY, '[]', 'Sho Minazuki',   0, 'expired',  NOW() - INTERVAL 5 DAY);

-- Deux messages ordinaires, pour la Boîte.
INSERT INTO messages (sender_id, receiver_id, type, content, status, created_at) VALUES
  (@futaba, @me, 'message', '[mock] gg pour la série de 65 🔥', 'unread', NOW() - INTERVAL 15 MINUTE),
  (@me, @yosuke, 'message', '[mock] je te bats demain', 'read', NOW() - INTERVAL 1 DAY);

SELECT
  (SELECT COUNT(*) FROM friendships WHERE (requester_id = @me OR addressee_id = @me) AND status = 'accepted') AS amis,
  (SELECT COUNT(*) FROM friendships WHERE addressee_id = @me AND status = 'pending') AS demandes_recues,
  (SELECT COUNT(*) FROM social_links WHERE (user_a_id = @me OR user_b_id = @me) AND `rank` = 10) AS true_confidants,
  (SELECT COUNT(*) FROM messages WHERE content LIKE '[mock]%' AND (sender_id = @me OR receiver_id = @me)) AS messages_mock;
