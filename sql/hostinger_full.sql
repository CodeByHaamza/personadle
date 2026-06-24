-- ⚠️ DÉPRÉCIÉ — NE PAS UTILISER COMME SOURCE DE SCHÉMA.
-- La source unique du schéma est sql/bdd_mysql.sql (chargé par Docker, reflète la prod).
-- Ce dump est conservé à titre d'archive historique uniquement et peut être périmé
-- (ex. social_links.current_rank n'existe plus). Voir sql/migrations/README.md.
-- =============================================================================
-- =============================================================================
-- PersonaDLE — Installation complète Hostinger (fresh install)
-- =============================================================================
-- Ce fichier combine le schéma de base (bdd_mysql.sql) + toutes les données
-- manquantes (badges, wallpapers, is_admin, social_link_rankup_notifs).
--
-- À importer UNE SEULE FOIS via PhpMyAdmin sur la base de données Hostinger.
-- Ne jamais importer bdd_mysql.sql séparément si ce fichier a déjà été importé.
--
-- Généré le 2026-05-06.
-- =============================================================================

-- =============================================================================
-- PARTIE 1 — Schéma complet (identique à sql/bdd_mysql.sql)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop dans l'ordre inverse des dépendances
DROP VIEW  IF EXISTS v_social_links;
DROP VIEW  IF EXISTS v_global_stats;
DROP VIEW  IF EXISTS v_friends;
DROP TABLE IF EXISTS deletion_requests;
DROP TABLE IF EXISTS leaderboard_cache;
DROP TABLE IF EXISTS social_link_rankup_notifs;
DROP TABLE IF EXISTS social_link_interactions;
DROP TABLE IF EXISTS social_links;
DROP TABLE IF EXISTS social_link_ranks;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS event_codes_redeemed;
DROP TABLE IF EXISTS badges_unlocked;
DROP TABLE IF EXISTS badges;
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS user_wallpapers;
DROP TABLE IF EXISTS wallpapers;
DROP TABLE IF EXISTS user_titles;
DROP TABLE IF EXISTS titles;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS users;

-- =============================================================================
-- 1. TITLES — Titres / rangs joueur
-- =============================================================================
CREATE TABLE titles (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    slug            VARCHAR(100)     NOT NULL UNIQUE,
    name_en         VARCHAR(200)     NOT NULL,
    name_fr         VARCHAR(200)     NOT NULL DEFAULT '',
    name_es         VARCHAR(200)     NOT NULL DEFAULT '',
    name_de         VARCHAR(200)     NOT NULL DEFAULT '',
    name_it         VARCHAR(200)     NOT NULL DEFAULT '',
    condition_type  VARCHAR(50)      NOT NULL DEFAULT 'wins_total',
    condition_value INT              NOT NULL DEFAULT 0,
    rarity          ENUM('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
    image_path      VARCHAR(150)     NULL,

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed : titres visuels (calling cards)
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
-- 2. USERS
-- =============================================================================
CREATE TABLE users (
    id                   BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    email                VARCHAR(255)     NOT NULL UNIQUE,
    pseudo               VARCHAR(50)      NOT NULL UNIQUE,
    password_hash        VARCHAR(255)     NOT NULL,
    friend_code          VARCHAR(8)       NOT NULL UNIQUE,
    lang                 VARCHAR(5)       NOT NULL DEFAULT 'en',
    created_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at        TIMESTAMP        NULL,
    is_deleted           TINYINT(1)       NOT NULL DEFAULT 0,
    deleted_at           TIMESTAMP        NULL,
    is_admin             TINYINT(1)       NOT NULL DEFAULT 0,
    has_migrated         TINYINT(1)       NOT NULL DEFAULT 0,
    remember_me_hash     VARCHAR(64)      NULL,
    remember_me_expires  TIMESTAMP        NULL,

    PRIMARY KEY (id),
    INDEX idx_users_email  (email),
    INDEX idx_users_pseudo (pseudo),
    INDEX idx_users_code   (friend_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 3. PROFILES
-- =============================================================================
CREATE TABLE profiles (
    user_id             BIGINT UNSIGNED  NOT NULL,
    avatar_data         MEDIUMTEXT,
    avatar_border_color VARCHAR(7)       NOT NULL DEFAULT '#ffffff',
    wallpaper_id        VARCHAR(100),
    profile_music_id    VARCHAR(100),
    selected_badges     JSON,
    equipped_title_id   BIGINT UNSIGNED  NULL,
    settings            JSON             NULL,
    updated_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id)           REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (equipped_title_id) REFERENCES titles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 4. USER_STATS
-- =============================================================================
CREATE TABLE user_stats (
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,
    wins            INT              NOT NULL DEFAULT 0,
    giveups         INT              NOT NULL DEFAULT 0,
    games           INT              NOT NULL DEFAULT 0,
    streak          INT              NOT NULL DEFAULT 0,
    streak_record   INT              NOT NULL DEFAULT 0,
    perfect_wins    INT              NOT NULL DEFAULT 0,
    total_time_ms   BIGINT           NOT NULL DEFAULT 0,
    last_played_at  TIMESTAMP        NULL,
    first_played_at TIMESTAMP        NULL,

    PRIMARY KEY (user_id, mode),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 5. USER_TITLES
-- =============================================================================
CREATE TABLE user_titles (
    user_id     BIGINT UNSIGNED  NOT NULL,
    title_id    BIGINT UNSIGNED  NOT NULL,
    unlocked_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, title_id),
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 6. GAME_SESSIONS
-- =============================================================================
CREATE TABLE game_sessions (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,
    played_date     DATE             NOT NULL,
    target_name     VARCHAR(200)     NOT NULL,
    result          ENUM('win','loss','giveup') NOT NULL,
    attempts        INT              NOT NULL DEFAULT 0,
    time_ms         INT              NOT NULL DEFAULT 0,
    active_filters  JSON             NULL,
    perfect_win     TINYINT(1)       NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    UNIQUE KEY uq_session (user_id, mode, played_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_game_sessions_user_mode ON game_sessions(user_id, mode);
CREATE INDEX idx_game_sessions_date      ON game_sessions(played_date);
CREATE INDEX idx_game_sessions_target    ON game_sessions(mode, played_date, target_name);

-- =============================================================================
-- 7. BADGES — Catalogue (source de vérité)
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
-- 8. BADGES_UNLOCKED
-- =============================================================================
CREATE TABLE badges_unlocked (
    user_id     BIGINT UNSIGNED  NOT NULL,
    badge_id    VARCHAR(100)     NOT NULL,
    unlocked_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 9. EVENT_CODES_REDEEMED
-- =============================================================================
CREATE TABLE event_codes_redeemed (
    user_id     BIGINT UNSIGNED  NOT NULL,
    code        VARCHAR(50)      NOT NULL,
    redeemed_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 10. FRIENDSHIPS
-- =============================================================================
CREATE TABLE friendships (
    id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    requester_id BIGINT UNSIGNED  NOT NULL,
    addressee_id BIGINT UNSIGNED  NOT NULL,
    status       ENUM('pending','accepted','blocked') NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_friendship (requester_id, addressee_id),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 11. SOCIAL_LINK_RANKS — Seed des rangs 1-10
-- =============================================================================
CREATE TABLE social_link_ranks (
    `rank`      INT          NOT NULL PRIMARY KEY,
    name_en     VARCHAR(50)  NOT NULL,
    name_fr     VARCHAR(50)  NOT NULL DEFAULT '',
    name_es     VARCHAR(50)  NOT NULL DEFAULT '',
    name_de     VARCHAR(50)  NOT NULL DEFAULT '',
    name_it     VARCHAR(50)  NOT NULL DEFAULT '',
    xp_required INT          NOT NULL DEFAULT 0,
    reward_en   VARCHAR(200) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO social_link_ranks (`rank`, name_en, name_fr, name_es, name_de, name_it, xp_required, reward_en) VALUES
(1,  'Stranger',          'Inconnu',           'Desconocido',     'Fremder',           'Sconosciuto',     0,    NULL),
(2,  'Acquaintance',      'Connaissance',       'Conocido',        'Bekannter',         'Conoscente',      100,  NULL),
(3,  'Companion',         'Compagnon',          'Compañero',       'Gefährte',          'Compagno',        250,  NULL),
(4,  'Ally',              'Allié',              'Aliado',          'Verbündeter',       'Alleato',         450,  NULL),
(5,  'Confidant',         'Confident',          'Confidente',      'Vertrauter',        'Confidente',      700,  NULL),
(6,  'Trusted Ally',      'Allié de Confiance', 'Aliado de Confianza','Vertrauensalliierter','Alleato Fidato',1000,NULL),
(7,  'True Ally',         'Allié Véritable',    'Aliado Verdadero','Wahrer Verbündeter','Vero Alleato',    1350, NULL),
(8,  'Bond',              'Lien',               'Vínculo',         'Band',              'Legame',          1750, NULL),
(9,  'Unbreakable Bond',  'Lien Indéfectible',  'Vínculo Inquebrantable','Unzerbrechliches Band','Legame Indissolubile',2200,NULL),
(10, 'True Confidant',    'Vrai Confident',     'Verdadero Confidente','Wahrer Vertrauter','Vero Confidente',2700,'True Confidant Badge');

-- =============================================================================
-- 12. SOCIAL_LINKS
-- =============================================================================
CREATE TABLE social_links (
    id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_a_id           BIGINT UNSIGNED  NOT NULL,
    user_b_id           BIGINT UNSIGNED  NOT NULL,
    current_rank        INT              NOT NULL DEFAULT 1,
    xp                  INT              NOT NULL DEFAULT 0,
    last_interaction    TIMESTAMP        NULL,
    rank_updated_at     TIMESTAMP        NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_social_link (user_a_id, user_b_id),
    FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 13. SOCIAL_LINK_INTERACTIONS
-- =============================================================================
CREATE TABLE social_link_interactions (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    social_link_id  BIGINT UNSIGNED  NOT NULL,
    initiator_id    BIGINT UNSIGNED  NOT NULL,
    action_type     VARCHAR(50)      NOT NULL,
    xp_gained       INT              NOT NULL DEFAULT 0,
    is_mutual       TINYINT(1)       NOT NULL DEFAULT 0,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    FOREIGN KEY (social_link_id) REFERENCES social_links(id) ON DELETE CASCADE,
    FOREIGN KEY (initiator_id)   REFERENCES users(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 14. (removed: SOCIAL_LINK_BADGES — replaced by rank10-effect, see migration 012_remove_tcb)
-- =============================================================================

-- =============================================================================
-- 15. SOCIAL_LINK_RANKUP_NOTIFS — Notifications rang-up pour le partenaire
-- =============================================================================
CREATE TABLE social_link_rankup_notifs (
    id           INT              NOT NULL AUTO_INCREMENT,
    recipient_id INT              NOT NULL,
    partner_id   INT              NOT NULL,
    new_rank     INT              NOT NULL,
    created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    seen_at      TIMESTAMP        NULL DEFAULT NULL,

    PRIMARY KEY (id),
    INDEX idx_recipient_unseen (recipient_id, seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- 16. LEADERBOARD_CACHE
-- =============================================================================
CREATE TABLE leaderboard_cache (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    mode            VARCHAR(30)      NOT NULL,
    period          VARCHAR(15)      NOT NULL,
    metric          VARCHAR(20)      NOT NULL DEFAULT 'wins',
    score           INT              NOT NULL DEFAULT 0,
    rank_position   INT,
    period_start    DATETIME,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_leaderboard (user_id, mode, period, metric, period_start),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_leaderboard_ranking ON leaderboard_cache(mode, period, metric, period_start, score DESC);

-- =============================================================================
-- 17. MESSAGES
-- =============================================================================
CREATE TABLE messages (
    id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    sender_id           BIGINT UNSIGNED  NOT NULL,
    receiver_id         BIGINT UNSIGNED  NOT NULL,
    type                VARCHAR(30)      NOT NULL DEFAULT 'message',
    content             TEXT             NULL,
    status              VARCHAR(20)      NOT NULL DEFAULT 'pending',
    challenge_mode      VARCHAR(30)      NULL,
    challenge_date      DATE             NULL,
    challenge_filters   TEXT             NULL,
    created_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_messages_receiver   ON messages(receiver_id, status, created_at DESC);
CREATE INDEX idx_messages_sender_type ON messages(sender_id, type, status, created_at DESC);

-- =============================================================================
-- 18. WALLPAPERS — Catalogue
-- =============================================================================
CREATE TABLE wallpapers (
    id                  VARCHAR(64)         NOT NULL PRIMARY KEY,
    name                VARCHAR(200)        NOT NULL DEFAULT '',
    game                VARCHAR(16),
    is_default          TINYINT(1)          NOT NULL DEFAULT 0,
    unlock_condition    VARCHAR(255)        NULL,
    image_path          VARCHAR(255)        NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 19. USER_WALLPAPERS
-- =============================================================================
CREATE TABLE user_wallpapers (
    user_id             BIGINT UNSIGNED     NOT NULL,
    wallpaper_id        VARCHAR(64)         NOT NULL,
    unlocked_at         TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, wallpaper_id),
    CONSTRAINT fk_uw_user      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
    CONSTRAINT fk_uw_wallpaper FOREIGN KEY (wallpaper_id) REFERENCES wallpapers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 20. DELETION_REQUESTS — Log RGPD
-- =============================================================================
CREATE TABLE deletion_requests (
    id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED  NOT NULL,
    requested_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP        NULL,
    deletion_type   VARCHAR(20)      NOT NULL DEFAULT 'full',

    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- VUES
-- =============================================================================

CREATE OR REPLACE VIEW v_friends AS
    SELECT
        f.id,
        f.requester_id AS user_a_id,
        f.addressee_id AS user_b_id,
        f.status,
        f.created_at,
        f.updated_at
    FROM friendships f
    WHERE f.status = 'accepted';

CREATE OR REPLACE VIEW v_global_stats AS
    SELECT
        u.id         AS user_id,
        u.pseudo,
        SUM(s.wins)  AS total_wins,
        SUM(s.games) AS total_games,
        MAX(s.streak_record) AS best_streak
    FROM users u
    JOIN user_stats s ON s.user_id = u.id
    WHERE u.is_deleted = 0
    GROUP BY u.id, u.pseudo;

-- v_social_links : vue symétrique (user_a toujours le plus petit id)
CREATE OR REPLACE VIEW v_social_links AS
    SELECT
        sl.id,
        LEAST(sl.user_a_id, sl.user_b_id)    AS user_a_id,
        GREATEST(sl.user_a_id, sl.user_b_id) AS user_b_id,
        sl.current_rank,
        sl.xp,
        sl.last_interaction,
        sl.rank_updated_at
    FROM social_links sl;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- ⚠️ PROCÉDURE STOCKÉE — importer séparément via hostinger_procedure.sql
-- =============================================================================

-- =============================================================================
-- PARTIE 2 — Seeds manquants (badges, wallpapers)
-- =============================================================================

-- Seed 60 badges
INSERT IGNORE INTO badges (slug, name_en, category, rarity, image_path, condition_en, is_secret) VALUES
('ace_detective',       'Ace Detective',              'achievement', 'rare',      'profile/badges/images/Badges_Ace_Detective.png',         'Win 10 games',                                                             0),
('ace_defective',       'Ace Defective',              'achievement', 'common',    'profile/badges/images/Badges_Ace_Defective.png',         'Give up 10 times',                                                         0),
('shadow_slayer',       'Shadow Slayer',              'achievement', 'common',    'profile/badges/images/Badges_Shadow_Slayer.png',         'Win 5 games in Silhouette mode',                                            0),
('music_master',        'Music Master',               'achievement', 'rare',      'profile/badges/images/Badges_Music.png',                 'Win 20 games in Music mode',                                               0),
('burn_my_dread',       'Memento Mori',               'achievement', 'rare',      'profile/badges/images/Badges_Burn_My_Dread_Silver.png',  'Find ''Burn My Dread'' in Music mode',                                     0),
('into_the_fog',        'Unsolved Case',              'achievement', 'common',    'profile/badges/images/Badges_something_wrong.png',       'Turn your back on the truth in the final investigation',                   0),
('velvet_headache',     'Velvet Headache',            'achievement', 'rare',      'profile/badges/images/Badges_velvet_headache.png',       'Find Wonder (Velvet) and Caroline & Justine in All-Out Attack',            0),
('first_win',           'First Victory',              'achievement', 'common',    'profile/badges/images/Badges_Fisrt_Win.png',             'Win your first game',                                                      0),
('p1_p2_fan',           'Echoes of the Past',         'achievement', 'rare',      'profile/badges/images/Badges_P1_P2_Fan.png',             'Win 15 games in Classic mode',                                             0),
('velvet_master',       'Velvet Master',              'achievement', 'rare',      'profile/badges/images/Badges_Velvet_master.png',         'Win 10 games in Personae mode',                                            0),
('chinese_new_year',    'Chinese New Year Achievement','achievement','common',    'profile/badges/images/Chinesse_new_year.png',            'Find Wonder and Rin (CNY) in All-Out Attack',                              0),
('twin_blade',          'Twin Blade',                 'achievement', 'common',    'profile/badges/images/Badge_Twin_Blade.png',             'Find a Personae of Yosuke and Yusuke',                                     0),
('persona_q_explorer',  'Cinema Explorer',            'achievement', 'rare',      'profile/badges/images/Badges_Persona_Q.webp',            'Find all 4 Persona Q exclusive characters in Silhouette mode',             0),
('crimson_legacy',      'Crimson Legacy',             'achievement', 'epic',      'profile/badges/images/Badge_Picaro.png',                 'Find all 12 Picaro Personas',                                              1),
('hippocampus_reload',  'Hippocampus Reload',         'achievement', 'rare',      'profile/badges/images/Badges_Zotomayo.webp',             'Find the ZUTOMAYO x P3R Mashup in Music mode',                            0),
('truth_duality',       'Truth & Duality',            'achievement', 'rare',      'profile/badges/images/Badges_Truth_Duality.png',         'Find both Crow and Black Mask in All-Out Attack mode',                     0),
('one_shot',            'Critical Strike',            'achievement', 'rare',      'profile/badges/images/Badge_One_Shot.webp',              'Guess correctly on the very first try',                                    0),
('aoa_vision',          'Piercing the Fog',           'achievement', 'rare',      'profile/badges/images/Badge_Midnight_Vision.webp',       'Guess the All-Out Attack on the very first try',                           0),
('emoji_decoder',       'Emoji Decoder',              'achievement', 'common',    'profile/badges/images/Badge_Emoji_Decoder.webp',         'Win 10 games in Emoji mode',                                               0),
('navigator',           'Eye of the Navigator',       'achievement', 'rare',      'profile/badges/images/Badge_Navigator.webp',             'Use the hint 50 times in Classic mode',                                    0),
('velvet_regular',      'Velvet Regular',             'achievement', 'epic',      'profile/badges/images/Badge_Velvet_Regular.webp',        'Play on 50 unique days',                                                   0),
('strega',              'Apostles of the Fall',       'achievement', 'rare',      'profile/badges/images/Badge_Strega.webp',                'Find Hypnos, Moros and Medea in Personae mode',                            0),
('twin_fist',           'Twin Fist',                  'achievement', 'rare',      'profile/badges/images/Badge_Twin_Fist.webp',             'Find Makoto Nijima''s and Akihiko''s personas + their All-Out Attacks',    0),
('twin_spear',          'Twin Spear',                 'achievement', 'rare',      'profile/badges/images/Badge_Twin_Spear.webp',            'Find Kotone''s and Ken''s personas + their All-Out Attacks',               0),
('tradition_modernite', 'Chronological Convergence',  'achievement', 'epic',      'profile/badges/images/Badge_Tradition_Modernite.webp',   'Find Naoto''s & Futaba''s personas + Secret Base & When Mother Was There', 0),
('shapeshifter',        'The Formless Soul',          'achievement', 'epic',      'profile/badges/images/Badge_Shapshifter.webp',           'Guess the same character in 3 different modes (cumulative)',               0),
('ideal_reality',       'Gentle Illusion',            'achievement', 'common',    'profile/badges/images/Badge_Ideal_Reality.webp',         'Give up when the target is ''Our Light'' in Music mode',                  0),
('for_real',            'For Real',                   'achievement', 'rare',      'profile/badges/images/Badges_for_real.png',              'Find Ryuji''s AOA and his persona in Personae mode',                       0),
('night_owl',           'Phantom of the Night',       'achievement', 'common',    'profile/badges/images/Badge_Night_Owl.webp',             'Play between midnight and 5 AM (Paris time)',                              0),
('nyx_hour',            'Nyx Hour',                   'achievement', 'rare',      'profile/badges/images/Badge_Nyx_Hour.webp',              'Play between midnight and 12:30 AM (Paris time)',                          0),
('stylist',             'Breathtaking Aesthetics',    'achievement', 'epic',      'profile/badges/images/Badge_stylist.webp',               'Customize your profile: avatar + UI color + profile music + equipped title',0),
('pyro_spark',          'The Ignition',               'streak',      'common',    'profile/badges/images/Badge_Pyro_Spark.webp',            'Reach a 7-day streak',                                                     0),
('raphael',             'The Divine Blaze',           'streak',      'rare',      'profile/badges/images/Badge_Raphael.webp',               'Reach a 30-day streak',                                                    0),
('surt',                'Ragnarök''s Dawn',           'streak',      'epic',      'profile/badges/images/Badge_Surt.webp',                  'Reach a 90-day streak',                                                    0),
('lucifer',             'Crest of the Morning Star',  'streak',      'epic',      'profile/badges/images/Badge_Lucifer.webp',               'Reach a 120-day streak',                                                   0),
('helel',               'The Eternal Zenith',         'streak',      'legendary', 'profile/badges/images/Badge_Helel.webp',                 'Reach a 365-day streak',                                                   0),
('reborn_phoenix',      'Phoenix Reborn',             'streak',      'rare',      'profile/badges/images/Badge_Reborn_Phenix.webp',         'Restore your streak after losing it (grace period)',                       0),
('take_the_pose',       'Take The Pose',              'social',      'common',    'profile/badges/images/Badges_Take_The_Pose.png',         'Share your profile with others',                                           0),
('best_bro',            'Best Bro',                   'social',      'common',    'profile/badges/images/Badges_Best_bro.png',              'Have 2 or more friends',                                                   0),
('data_mining',         'Data Mining',                'social',      'common',    'profile/badges/images/Badge_Data_Mining.webp',           'Visit 5 different user profiles',                                          0),
('leblanc_meeting',     'Leblanc Meeting',            'social',      'rare',      'profile/badges/images/Badge_Leblanc_Meeting.webp',       '3 or more friends logged in the same day as you',                          0),
('rentree',             'Spring Awakening',           'event',       'common',    'profile/badges/images/Badges_Rentré.png',                'Log in on April 1st',                                                      0),
('sport',               'Athletic Spirit',            'event',       'common',    'profile/badges/images/Badges_Sport.png',                 'Redeem code SPORT between April 6th and May 1st, 2025',                    0),
('christmas_2025',      'Christmas 2025',             'event',       'common',    'profile/badges/images/Badges_Christmas_2025.png',        'Redeem code during Christmas 2025',                                        0),
('new_years_2026',      'New Year''s 2026',           'event',       'common',    'profile/badges/images/Badges_New_Years_2026.png',        'Redeem code during New Year 2026',                                         0),
('chinese_new_year_2026','Happy Chinese New Year 2026','event',      'common',    'profile/badges/images/Badges_Chiness_New_Year.webp',     'Type the Chinese New Year code during the 2026 celebration',               0),
('valentine_2026',      'Valentine''s Day 2026',      'event',       'common',    'profile/badges/images/Badges_St_Valentin.png',           'Redeem code during Valentine''s 2026',                                     0),
('easter_2026',         'Easter 2026',                'event',       'common',    'profile/badges/images/Badges_Paques.png',                'Redeem code during Easter 2026',                                           0),
('golden_week',         'Golden Week',                'event',       'common',    'profile/badges/images/Badge_Golden_Week.webp',           'Log in between April 29 and May 5',                                        0),
('tanabata',            'Tanabata',                   'event',       'common',    'profile/badges/images/Badge_Tanabata.webp',              'Log in on July 7th',                                                       0),
('promised_day',        'The Promised Day',           'event',       'rare',      'profile/badges/images/Badge_Promised_Day.webp',          'Play on December 31st AND January 1st',                                    0),
('true_hacker',         'True Hacker',                'secret',      'rare',      'profile/badges/images/Badges_True_Hacker.png',           '???',                                                                      1),
('tae_takemi',          'Tae Takemi Fan',             'secret',      'rare',      'profile/badges/images/Badges_Tae_Takemi.png',            '???',                                                                      1),
('arati',               'Arati''s Blessing',          'secret',      'rare',      'profile/badges/images/Badges_Arati.png',                 '???',                                                                      1),
('dzulian',             'The First Contractor',       'secret',      'epic',      'profile/badges/images/Badge_Dzulian.png',                '???',                                                                      1),
('chef',                'Master Chef',                'secret',      'rare',      'profile/badges/images/Badges_Chef.png',                  '???',                                                                      1),
('github_contributor',  'Phantom Coder',              'secret',      'common',    'profile/badges/images/Badges_Github_Morgana.png',        '???',                                                                      1),
('lobster',             'Artistic Lobster',           'secret',      'rare',      'profile/badges/images/Badges_Lobster.png',               '???',                                                                      1),
('hifumi_archives',     'The Grandmaster''s Tome',    'secret',      'rare',      'profile/badges/images/Badge_Hifumi_Archives.webp',       '???',                                                                      1),
('report',              'The Priestess''s Audit',     'secret',      'rare',      'profile/badges/images/Badge_Report.webp',                '???',                                                                      1);

-- Seed 7 wallpapers débloquables
INSERT IGNORE INTO wallpapers (id, game, is_default, unlock_condition, name, image_path) VALUES
('kamoshida_palace',       'P5', 0, 'Play at least 1 game in each of the 6 modes',                     'Kamoshida''s Palace',    'profile/Wallpaper/unlockable/kamoshida_palace.webp'),
('madarame_wallpaper',     'P5', 0, 'Set a custom avatar AND have at least 1 friend',                   'Madarame''s Palace',     'profile/Wallpaper/unlockable/madarame_wallpaper.webp'),
('yukiko_dungeons',        'P4', 0, 'Play 3 consecutive days with P4 filter active',                    'Yukiko''s Dungeons',     'profile/Wallpaper/unlockable/yukiko_dungeons.webp'),
('kanji_dungeons',         'P4', 0, 'Send a challenge to a friend and have them accept it',             'Kanji''s Dungeons',      'profile/Wallpaper/unlockable/kanji_dungeons.webp'),
('rise_dungeons',          'P4', 0, 'Play 30 total games in Music mode',                               'Rise''s Dungeons',       'profile/Wallpaper/unlockable/rise_dungeons.webp'),
('mitsuo_dungeons',        'P4', 0, 'Complete 75 total games across all modes',                         'Mitsuo''s Dungeons',     'profile/Wallpaper/unlockable/mitsuo_dungeons.webp'),
('dark_shopping_district', 'P4', 0, 'Have a Social Link at rank 5 or higher',                          'Dark Shopping District', 'profile/Wallpaper/unlockable/dark_shopping_district.webp');

-- =============================================================================
-- PARTIE 3 — Compte admin
-- =============================================================================
-- ⚠ À exécuter APRÈS avoir créé ton compte via l'interface (inscription normale).
-- Remplace 'TonPseudo' par le pseudo exact de ton compte admin.
-- UPDATE users SET is_admin = 1 WHERE pseudo = 'TonPseudo';
