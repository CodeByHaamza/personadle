-- =============================================================================
-- PersonaDLE — Schéma MySQL 8.0
-- =============================================================================
-- Adapté depuis bdd.sql (PostgreSQL) pour MySQL 8.0.
-- Changements principaux :
--   BIGSERIAL    → BIGINT UNSIGNED AUTO_INCREMENT
--   BOOLEAN      → TINYINT(1)
--   DEFAULT NOW()→ DEFAULT CURRENT_TIMESTAMP
--   Inline FK    → FOREIGN KEY (...) REFERENCES ...
--   TEXT (avatar)→ MEDIUMTEXT (base64 peut dépasser 64 Ko)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop dans l'ordre inverse des dépendances
DROP VIEW  IF EXISTS v_social_links;
DROP VIEW  IF EXISTS v_global_stats;
DROP VIEW  IF EXISTS v_friends;
DROP TABLE IF EXISTS deletion_requests;
DROP TABLE IF EXISTS leaderboard_cache;
DROP TABLE IF EXISTS social_link_interactions;
DROP TABLE IF EXISTS social_links;
DROP TABLE IF EXISTS social_link_ranks;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS event_codes_redeemed;
DROP TABLE IF EXISTS badges_unlocked;
DROP TABLE IF EXISTS badges;
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS user_titles;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS users;


-- =============================================================================
-- 1. USERS
-- =============================================================================
CREATE TABLE users (
    id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    email                VARCHAR(255)     NOT NULL,
    pseudo               VARCHAR(50)      NOT NULL,
    password_hash        VARCHAR(255)     NOT NULL,
    friend_code          CHAR(8)          NOT NULL,
    lang                 VARCHAR(5)       NOT NULL DEFAULT 'en',
    created_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at        TIMESTAMP        NULL,
    is_deleted           TINYINT(1)       NOT NULL DEFAULT 0,
    deleted_at           TIMESTAMP        NULL,
    -- Remember-me token (SHA-256 hash of the raw token stored in the browser cookie).
    -- Allows automatic re-login across browser restarts without relying solely on
    -- PHP session files, which shared hosts may garbage-collect aggressively.
    remember_me_hash     VARCHAR(64)      NULL,
    remember_me_expires  DATETIME         NULL,
    -- Vaut 1 après le premier import JSON (une seule migration autorisée par compte)
    has_migrated         TINYINT(1)       NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_email           (email),
    UNIQUE KEY uq_pseudo          (pseudo),
    UNIQUE KEY uq_friend_code     (friend_code),
    INDEX      idx_remember_me    (remember_me_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_pseudo ON users(pseudo);


-- =============================================================================
-- 2. TITLES — Titres/rangs débloquables
--    Créé avant profiles (profiles y fait référence via equipped_title_id)
-- =============================================================================
CREATE TABLE titles (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(100)     NOT NULL,
    image_path      VARCHAR(150)     NULL,       -- chemin du banner visuel 16:4

    name_en         VARCHAR(100),
    name_fr         VARCHAR(100),
    name_es         VARCHAR(100),
    name_de         VARCHAR(100),
    name_it         VARCHAR(100),
    name_jp         VARCHAR(100),

    description_en  TEXT,
    description_fr  TEXT,
    description_es  TEXT,
    description_de  TEXT,
    description_it  TEXT,
    description_jp  TEXT,

    condition_type  VARCHAR(50),
    -- 'wins_total' | 'streak_record' | 'mode_wins' | 'perfect_wins'
    -- 'social_link_rank_10' | 'badges_count' | 'unique_days' | 'friends_count'
    -- 'giveups_total' | 'all_modes_won' | 'leaderboard_top' | 'weekly_clean_modes'
    -- 'classic_p1_wins' | 'emoji_p2_wins' | 'joker_profile' | 'manual'

    condition_mode  VARCHAR(30),
    -- NULL = global, sinon: 'classic' | 'emoji' | 'silhouette' | 'alloutattack' | 'personae' | 'music'

    condition_value INT,
    rarity          VARCHAR(20)      NOT NULL DEFAULT 'common',
    -- 'common' | 'rare' | 'epic' | 'legendary'

    PRIMARY KEY (id),
    UNIQUE KEY uq_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed : 11 titres visuels (calling cards)
INSERT INTO titles (slug, image_path, name_en, name_fr, name_es, name_de, name_it, condition_type, condition_value, rarity) VALUES
('velvet_room_thou_art_i',    'profile/titles/velvet_room_thou_art_i.webp',    'Thou Art I',             'Thou Art I',              'Thou Art I',            'Thou Art I',           'Thou Art I',          'badges_count',        20,  'legendary'),
('joker_looking_cool',        'profile/titles/joker_looking_cool.webp',        'Looking Cool',           'Looking Cool',            'Looking Cool',          'Looking Cool',         'Looking Cool',        'joker_profile',       0,   'legendary'),
('makoto_yuki_memento_mori',  'profile/titles/makoto_yuki_memento_mori.webp',  'Memento Mori',           'Memento Mori',            'Memento Mori',          'Memento Mori',         'Memento Mori',        'unique_days',         100, 'epic'),
('aigis_i_am_not_afraid',     'profile/titles/aigis_i_am_not_afraid.webp',     'I Am Not Afraid',        'Je N''Ai Pas Peur',       'No Tengo Miedo',        'Ich Habe Keine Angst', 'Non Ho Paura',        'mode_wins',           50,  'rare'),
('akechi_pancakes',           'profile/titles/akechi_pancakes.webp',           'Pancakes?',              'Pancakes ?',              '¿Panqueques?',          'Pfannkuchen?',         'Pancakes?',           'weekly_clean_modes',  3,   'epic'),
('yosuke_ride_the_wind',      'profile/titles/yosuke_ride_the_wind.webp',      'Ride the Wind',          'Chevauche le Vent',       'Cabalga el Viento',     'Reite den Wind',       'Cavalca il Vento',    'friends_count',       5,   'rare'),
('adachi_boring_isnt_it',     'profile/titles/adachi_boring_isnt_it.webp',     'Boring, Isn''t It?',     'Ennuyeux, N''est-ce Pas ?','¿Aburrido, Verdad?',   'Langweilig, Oder?',    'Noioso, Vero?',       'giveups_total',       50,  'common'),
('marie_i_remembered',        'profile/titles/marie_i_remembered.webp',        'I Remembered',           'Je Me Suis Souvenu',      'Lo Recordé',            'Ich Erinnerte Mich',   'Mi Sono Ricordato',   'badges_count',        15,  'rare'),
('yu_reach_out_to_the_truth', 'profile/titles/yu_reach_out_to_the_truth.webp', 'Reach Out to the Truth', 'Toucher la Vérité',       'Alcanza la Verdad',     'Greife nach der Wahrheit','Raggiungi la Verita','all_modes_won',     1,   'epic'),
('naoya_first_awakening',     'profile/titles/naoya_first_awakening.webp',     'The First Awakening',    'Le Premier Éveil',        'El Primer Despertar',   'Das Erste Erwachen',   'Il Primo Risveglio',  'classic_p1_wins',     15,  'rare'),
('maya_always_be_positive',   'profile/titles/maya_always_be_positive.webp',   'Always Be Positive',     'Toujours Positif',        'Siempre Positivo',      'Immer Positiv',        'Sempre Positivo',     'emoji_p2_wins',       10,  'common');


-- =============================================================================
-- 3. PROFILES
-- =============================================================================
CREATE TABLE profiles (
    user_id             BIGINT UNSIGNED  NOT NULL,
    avatar_data         MEDIUMTEXT,                       -- base64 (canvas crop)
    avatar_border_color VARCHAR(7)       NOT NULL DEFAULT '#ffffff',
    wallpaper_id        VARCHAR(100),
    profile_music_id    VARCHAR(100),
    selected_badges     JSON,                             -- max 4 badge IDs
    equipped_title_id   BIGINT UNSIGNED  NULL,
    settings            JSON             NULL,
    updated_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id)           REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (equipped_title_id) REFERENCES titles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 4. USER_TITLES — Titres débloqués par utilisateur
-- =============================================================================
CREATE TABLE user_titles (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED  NOT NULL,
    title_id    BIGINT UNSIGNED  NOT NULL,
    unlocked_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_user_title (user_id, title_id),
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_titles_user ON user_titles(user_id);


-- =============================================================================
-- 5. USER_STATS — Statistiques par mode et par joueur
-- =============================================================================
CREATE TABLE user_stats (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,
    -- 'classic' | 'emoji' | 'silhouette' | 'alloutattack' | 'personae' | 'music'

    wins            INT              NOT NULL DEFAULT 0,
    giveups         INT              NOT NULL DEFAULT 0,
    games           INT              NOT NULL DEFAULT 0,
    streak          INT              NOT NULL DEFAULT 0,
    streak_record   INT              NOT NULL DEFAULT 0,
    perfect_wins    INT              NOT NULL DEFAULT 0,
    total_time_ms   BIGINT           NOT NULL DEFAULT 0,
    last_played_at  TIMESTAMP        NULL,
    first_played_at TIMESTAMP        NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_user_mode (user_id, mode),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_stats_user ON user_stats(user_id);
CREATE INDEX idx_user_stats_mode ON user_stats(mode, wins DESC);


-- =============================================================================
-- 6. GAME_SESSIONS — Historique de chaque partie jouée
-- =============================================================================
CREATE TABLE game_sessions (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,
    played_date     DATE             NOT NULL,   -- date Paris (Europe/Paris)
    target_name     VARCHAR(200)     NOT NULL,
    result          VARCHAR(10)      NOT NULL,   -- 'win' | 'giveup'
    attempts        INT              NOT NULL,
    time_ms         INT,
    active_filters  JSON,                        -- ["P3","P5","P5R"]
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    -- Anti-doublon : une seule session par (user, mode, jour Paris).
    -- Cf. migration 014 + sessions.php (interception PDOException 23000).
    UNIQUE KEY uq_session_per_day (user_id, mode, played_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_game_sessions_user_mode ON game_sessions(user_id, mode);
CREATE INDEX idx_game_sessions_date      ON game_sessions(played_date);
CREATE INDEX idx_game_sessions_target    ON game_sessions(mode, played_date, target_name);


-- =============================================================================
-- 7. BADGES — Catalogue des badges (source de vérité)
-- =============================================================================
CREATE TABLE badges (
    slug            VARCHAR(100)    NOT NULL PRIMARY KEY,
    name_en         VARCHAR(200)    NOT NULL,
    name_fr         VARCHAR(200)    NOT NULL DEFAULT '',
    name_es         VARCHAR(200)    NOT NULL DEFAULT '',
    name_de         VARCHAR(200)    NOT NULL DEFAULT '',
    name_it         VARCHAR(200)    NOT NULL DEFAULT '',
    category        ENUM('achievement','streak','event','secret','social') NOT NULL DEFAULT 'achievement',
    rarity          ENUM('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
    image_path      VARCHAR(255)    NOT NULL DEFAULT '',
    condition_en    VARCHAR(500)    NOT NULL DEFAULT '',
    is_secret       TINYINT(1)      NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. BADGES_UNLOCKED
-- =============================================================================
CREATE TABLE badges_unlocked (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED  NOT NULL,
    badge_id    VARCHAR(100)     NOT NULL,   -- correspond aux IDs dans badgesData.js
    unlocked_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_user_badge (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_badges_user ON badges_unlocked(user_id);


-- =============================================================================
-- 9. EVENT_CODES_REDEEMED
-- =============================================================================
CREATE TABLE event_codes_redeemed (
    id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED  NOT NULL,
    code        VARCHAR(50)      NOT NULL,
    redeemed_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_user_code (user_id, code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 10. FRIENDSHIPS
-- =============================================================================
CREATE TABLE friendships (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    requester_id    BIGINT UNSIGNED  NOT NULL,
    addressee_id    BIGINT UNSIGNED  NOT NULL,
    status          VARCHAR(15)      NOT NULL DEFAULT 'pending',
    -- 'pending' | 'accepted' | 'blocked'
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at     TIMESTAMP        NULL,
    seen_at         TIMESTAMP        NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_friendship (requester_id, addressee_id),
    CONSTRAINT chk_not_self CHECK (requester_id != addressee_id),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id, status);


-- =============================================================================
-- 11. SOCIAL_LINK_RANKS — Seuils XP et noms des rangs
-- =============================================================================
CREATE TABLE social_link_ranks (
    `rank`      INT         NOT NULL,
    name_en     VARCHAR(50),
    name_fr     VARCHAR(50),
    name_es     VARCHAR(50),
    name_de     VARCHAR(50),
    name_it     VARCHAR(50),
    name_jp     VARCHAR(50),
    xp_required INT         NOT NULL,
    reward_en   TEXT,

    PRIMARY KEY (`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO social_link_ranks (`rank`, name_en, name_fr, name_es, name_de, name_it, xp_required, reward_en) VALUES
(1,  'Stranger',           'Inconnu',            'Desconocido',         'Unbekannter',          'Sconosciuto',         0,    'Friendship begins'),
(2,  'Acquaintance',       'Connaissance',        'Conocido',            'Bekannter',            'Conoscente',          100,  'Can compare stats'),
(3,  'Companion',          'Compagnon',           'Compañero',           'Gefährte',             'Compagno',            250,  'Can share daily scores'),
(4,  'Ally',               'Allié',               'Aliado',              'Verbündeter',          'Alleato',             450,  'Can send challenges'),
(5,  'Confidant',          'Confident',           'Confidente',          'Vertrauter',           'Confidente',          700,  'Shared streak counter unlocked'),
(6,  'Trusted Ally',       'Allié Fidèle',        'Aliado de Confianza', 'Treuer Verbündeter',   'Alleato Fidato',      1000, 'Profile visits give bonus XP'),
(7,  'True Ally',          'Vrai Allié',          'Verdadero Aliado',    'Wahrer Verbündeter',   'Vero Alleato',        1350, 'Streak sharing gives double XP'),
(8,  'Bond',               'Lien',                'Vínculo',             'Verbindung',           'Legame',              1750, 'Special profile frame unlocked'),
(9,  'Unbreakable Bond',   'Lien Indestructible', 'Vínculo Inquebrantable','Unzerbrechliche Verbindung','Legame Indistruttibile',2200,'Almost there…'),
(10, 'True Confidant',     'True Confidant',      'Verdadero Confidente','Wahrer Vertrauter',    'Vero Confidente',     2700, 'True Confidant badge generated with both avatars');


-- =============================================================================
-- 12. SOCIAL_LINKS — Rang Social Link entre deux amis (symétrique)
--     Convention: user_a_id = MIN(id_a, id_b) — garantit l'unicité
-- =============================================================================
CREATE TABLE social_links (
    id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_a_id           BIGINT UNSIGNED  NOT NULL,   -- toujours < user_b_id
    user_b_id           BIGINT UNSIGNED  NOT NULL,
    `rank`              INT              NOT NULL DEFAULT 1,
    xp                  INT              NOT NULL DEFAULT 0,
    created_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_interaction_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_social_link (user_a_id, user_b_id),
    CONSTRAINT chk_sl_order   CHECK (user_a_id < user_b_id),
    CONSTRAINT chk_sl_rank    CHECK (`rank` >= 1 AND `rank` <= 10),
    FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_social_links_a ON social_links(user_a_id);
CREATE INDEX idx_social_links_b ON social_links(user_b_id);


-- =============================================================================
-- 13. SOCIAL_LINK_INTERACTIONS — Log des actions XP
-- =============================================================================
CREATE TABLE social_link_interactions (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    social_link_id  BIGINT UNSIGNED  NOT NULL,
    initiator_id    BIGINT UNSIGNED  NOT NULL,
    action_type     VARCHAR(50)      NOT NULL,
    -- 'share_streak' | 'share_score' | 'visit_profile'
    -- 'play_same_day' | 'compare_stats' | 'send_challenge'
    xp_gained       INT              NOT NULL,
    is_mutual       TINYINT(1)       NOT NULL DEFAULT 0,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    FOREIGN KEY (social_link_id) REFERENCES social_links(id) ON DELETE CASCADE,
    FOREIGN KEY (initiator_id)   REFERENCES users(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sli_social_link ON social_link_interactions(social_link_id);
CREATE INDEX idx_sli_date        ON social_link_interactions(created_at);
CREATE INDEX idx_sli_initiator   ON social_link_interactions(initiator_id);


-- =============================================================================
-- 14. (removed: SOCIAL_LINK_BADGES — Badge True Confidant replaced by rank10-effect)
-- =============================================================================
-- CREATE TABLE social_link_badges was here; removed in migration 012_remove_tcb


-- =============================================================================
-- 15. LEADERBOARD_CACHE — Classements précalculés (recalcul périodique)
-- =============================================================================
CREATE TABLE leaderboard_cache (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,   -- 'all' ou nom de mode
    period          VARCHAR(15)      NOT NULL,   -- 'day' | 'week' | 'month' | 'ever'
    metric          VARCHAR(20)      NOT NULL DEFAULT 'wins',  -- 'wins' | 'winrate' | 'streak' | 'perfect' | 'games'
    period_start    DATETIME,                    -- '2000-01-01 00:00:00' pour 'ever'
    score           DECIMAL(8,1)     NOT NULL,
    rank_position   INT,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_leaderboard (user_id, mode, period, metric, period_start),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_leaderboard_ranking ON leaderboard_cache(mode, period, metric, period_start, score DESC);


-- =============================================================================
-- 16. DELETION_REQUESTS — Log RGPD
-- =============================================================================
CREATE TABLE deletion_requests (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    -- Pas de FK : l'utilisateur peut déjà être supprimé (log de traçabilité)
    requested_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP        NULL,
    deletion_type   VARCHAR(20)      NOT NULL DEFAULT 'full',

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- VUES
-- =============================================================================

-- Amis d'un utilisateur (dans les deux sens)
CREATE VIEW v_friends AS
    SELECT f.id, f.requester_id AS user_id, f.addressee_id AS friend_id, f.status, f.accepted_at
    FROM friendships f WHERE f.status = 'accepted'
    UNION ALL
    SELECT f.id, f.addressee_id AS user_id, f.requester_id AS friend_id, f.status, f.accepted_at
    FROM friendships f WHERE f.status = 'accepted';

-- Stats globales (tous modes) par joueur
CREATE VIEW v_global_stats AS
    SELECT user_id,
           SUM(wins)          AS total_wins,
           SUM(giveups)       AS total_giveups,
           SUM(games)         AS total_games,
           MAX(streak_record) AS best_streak,
           SUM(perfect_wins)  AS total_perfect_wins,
           SUM(total_time_ms) AS total_time_ms
    FROM user_stats
    GROUP BY user_id;

-- Social Links d'un utilisateur (dans les deux sens)
CREATE VIEW v_social_links AS
    SELECT sl.id, sl.user_a_id AS user_id, sl.user_b_id AS friend_id,
           sl.`rank`, sl.xp, sl.created_at, sl.last_interaction_at
    FROM social_links sl
    UNION ALL
    SELECT sl.id, sl.user_b_id AS user_id, sl.user_a_id AS friend_id,
           sl.`rank`, sl.xp, sl.created_at, sl.last_interaction_at
    FROM social_links sl;


-- =============================================================================
-- 17. WALLPAPERS — Catalogue des fonds d'écran
-- =============================================================================
-- Les fichiers image restent des assets statiques.
-- Cette table référence uniquement les IDs et leurs conditions de déblocage.
CREATE TABLE wallpapers (
    id                  VARCHAR(64)         NOT NULL PRIMARY KEY,
    name                VARCHAR(200)        NOT NULL DEFAULT '',
    game                VARCHAR(16),
    is_default          TINYINT(1)          NOT NULL DEFAULT 0,
    unlock_condition    VARCHAR(255)        NULL,
    image_path          VARCHAR(255)        NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 18. USER_WALLPAPERS — Wallpapers débloqués par utilisateur
-- =============================================================================
-- Ne contient QUE les wallpapers débloqués (pas les defaults).
-- Côté API : wallpapers disponibles = is_default=1 + user_wallpapers de l'user
CREATE TABLE user_wallpapers (
    user_id             BIGINT UNSIGNED     NOT NULL,
    wallpaper_id        VARCHAR(64)         NOT NULL,
    unlocked_at         TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, wallpaper_id),
    CONSTRAINT fk_uw_user      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_uw_wallpaper FOREIGN KEY (wallpaper_id) REFERENCES wallpapers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 19. MESSAGES — Messages et défis entre amis
-- =============================================================================
CREATE TABLE messages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id       BIGINT UNSIGNED NOT NULL,
    receiver_id     BIGINT UNSIGNED NOT NULL,
    type            VARCHAR(20)     NOT NULL DEFAULT 'message',
    content         TEXT            NULL,
    challenge_mode    VARCHAR(30)     NULL,
    challenge_score   INT             NULL,
    challenge_date    DATE            NULL,
    challenge_filters TEXT            NULL,
    status            VARCHAR(20)     NOT NULL DEFAULT 'unread',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_messages_receiver    ON messages(receiver_id, status, created_at DESC);
CREATE INDEX idx_messages_sender      ON messages(sender_id);
CREATE INDEX idx_messages_sender_type ON messages(sender_id, type, status, created_at DESC);


-- =============================================================================
-- FONCTIONS / PROCÉDURES STOCKÉES
-- =============================================================================

DELIMITER //

-- Fonction : obtenir ou créer le social_link entre deux utilisateurs
-- Convention : user_a_id = LEAST(id1, id2), user_b_id = GREATEST(id1, id2)
CREATE FUNCTION get_or_create_social_link(id1 BIGINT UNSIGNED, id2 BIGINT UNSIGNED)
RETURNS BIGINT UNSIGNED
DETERMINISTIC
MODIFIES SQL DATA
BEGIN
    DECLARE a_id    BIGINT UNSIGNED;
    DECLARE b_id    BIGINT UNSIGNED;
    DECLARE link_id BIGINT UNSIGNED DEFAULT NULL;

    SET a_id = LEAST(id1, id2);
    SET b_id = GREATEST(id1, id2);

    SELECT id INTO link_id
    FROM social_links
    WHERE user_a_id = a_id AND user_b_id = b_id
    LIMIT 1;

    IF link_id IS NULL THEN
        INSERT INTO social_links (user_a_id, user_b_id) VALUES (a_id, b_id);
        SET link_id = LAST_INSERT_ID();
    END IF;

    RETURN link_id;
END //


-- Procédure : ajouter de l'XP et mettre à jour le rang si nécessaire
-- Utilisation : CALL add_social_link_xp(link_id, xp_amount, @new_xp, @new_rank, @ranked_up);
CREATE PROCEDURE add_social_link_xp(
    IN  p_link_id    BIGINT UNSIGNED,
    IN  p_xp_amount  INT,
    OUT p_new_xp     INT,
    OUT p_new_rank   INT,
    OUT p_ranked_up  TINYINT(1)
)
BEGIN
    DECLARE v_current_xp   INT;
    DECLARE v_current_rank INT;
    DECLARE v_updated_xp   INT;
    DECLARE v_updated_rank INT;

    SELECT xp, `rank` INTO v_current_xp, v_current_rank
    FROM social_links WHERE id = p_link_id;

    SET v_updated_xp = v_current_xp + p_xp_amount;

    SELECT MAX(r.`rank`) INTO v_updated_rank
    FROM social_link_ranks r
    WHERE r.xp_required <= v_updated_xp;

    IF v_updated_rank IS NULL THEN SET v_updated_rank = 1; END IF;

    SET p_ranked_up = IF(v_updated_rank > v_current_rank, 1, 0);

    UPDATE social_links
    SET xp = v_updated_xp,
        `rank` = v_updated_rank,
        last_interaction_at = NOW()
    WHERE id = p_link_id;

    SET p_new_xp   = v_updated_xp;
    SET p_new_rank = v_updated_rank;
END //

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;
