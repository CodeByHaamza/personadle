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
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS social_link_rankup_notifs;
DROP TABLE IF EXISTS event_codes;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS user_wallpapers;
DROP TABLE IF EXISTS wallpapers;
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
    -- Réinitialisation de mot de passe : hash sha256 du token envoyé par email + expiration
    reset_token_hash     VARCHAR(64)      NULL,
    reset_token_expires  DATETIME         NULL,
    -- Vaut 1 après le premier import JSON (une seule migration autorisée par compte)
    has_migrated         TINYINT(1)       NOT NULL DEFAULT 0,
    -- Droits admin (utilisé par requireAdmin / login.php / formatUser).
    is_admin             TINYINT(1)       NOT NULL DEFAULT 0,
    -- Modération : compte banni / pseudo verrouillé (api/admin/, login.php).
    is_banned            TINYINT(1)       NOT NULL DEFAULT 0,
    pseudo_locked        TINYINT(1)       NOT NULL DEFAULT 0,
    -- Date de la dernière récupération de streak Jack Frost (cooldown 60j, migration 013).
    streak_recovered_at  DATETIME         DEFAULT NULL,
    -- Streak GLOBALE (jours consécutifs joués, tous modes confondus) — autoritative.
    global_streak        INT              NOT NULL DEFAULT 0,
    global_streak_record INT              NOT NULL DEFAULT 0,
    global_streak_date   DATE             DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_email           (email),
    UNIQUE KEY uq_pseudo          (pseudo),
    UNIQUE KEY uq_friend_code     (friend_code),
    INDEX      idx_remember_me    (remember_me_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Pas d'index séparé sur pseudo : uq_pseudo ci-dessus l'indexe déjà (UNIQUE KEY).


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
    -- Colonnes identiques (et vérification partagée) pour `badges`/`wallpapers` plus
    -- bas — voir api/lib/condition_check.php pour la liste exhaustive des valeurs.
    -- 'wins_total' | 'streak_record' | 'mode_wins' | 'perfect_wins' | 'mode_games'
    -- 'games_total' | 'social_link_min_rank' | 'badges_count' | 'unique_days' | 'friends_count'
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
INSERT INTO titles (slug, image_path, name_en, name_fr, name_es, name_de, name_it, condition_type, condition_mode, condition_value, rarity) VALUES
('velvet_room_thou_art_i',    'profile/titles/velvet_room_thou_art_i.webp',    'Thou Art I',             'Thou Art I',              'Thou Art I',            'Thou Art I',           'Thou Art I',          'badges_count',        NULL,      20,  'legendary'),
('joker_looking_cool',        'profile/titles/joker_looking_cool.webp',        'Looking Cool',           'Looking Cool',            'Looking Cool',          'Looking Cool',         'Looking Cool',        'joker_profile',       NULL,      0,   'legendary'),
('makoto_yuki_memento_mori',  'profile/titles/makoto_yuki_memento_mori.webp',  'Memento Mori',           'Memento Mori',            'Memento Mori',          'Memento Mori',         'Memento Mori',        'unique_days',         NULL,      100, 'epic'),
('aigis_i_am_not_afraid',     'profile/titles/aigis_i_am_not_afraid.webp',     'I Am Not Afraid',        'Je N''Ai Pas Peur',       'No Tengo Miedo',        'Ich Habe Keine Angst', 'Non Ho Paura',        'mode_wins',           'classic', 50,  'rare'),
('akechi_pancakes',           'profile/titles/akechi_pancakes.webp',           'Pancakes?',              'Pancakes ?',              '¿Panqueques?',          'Pfannkuchen?',         'Pancakes?',           'weekly_clean_modes',  NULL,      3,   'epic'),
('yosuke_ride_the_wind',      'profile/titles/yosuke_ride_the_wind.webp',      'Ride the Wind',          'Chevauche le Vent',       'Cabalga el Viento',     'Reite den Wind',       'Cavalca il Vento',    'friends_count',       NULL,      5,   'rare'),
('adachi_boring_isnt_it',     'profile/titles/adachi_boring_isnt_it.webp',     'Boring, Isn''t It?',     'Ennuyeux, N''est-ce Pas ?','¿Aburrido, Verdad?',   'Langweilig, Oder?',    'Noioso, Vero?',       'giveups_total',       NULL,      50,  'common'),
('marie_i_remembered',        'profile/titles/marie_i_remembered.webp',        'I Remembered',           'Je Me Suis Souvenu',      'Lo Recordé',            'Ich Erinnerte Mich',   'Mi Sono Ricordato',   'badges_count',        NULL,      15,  'rare'),
('yu_reach_out_to_the_truth', 'profile/titles/yu_reach_out_to_the_truth.webp', 'Reach Out to the Truth', 'Toucher la Vérité',       'Alcanza la Verdad',     'Greife nach der Wahrheit','Raggiungi la Verita','all_modes_won',     NULL,      1,   'epic'),
('naoya_first_awakening',     'profile/titles/naoya_first_awakening.webp',     'The First Awakening',    'Le Premier Éveil',        'El Primer Despertar',   'Das Erste Erwachen',   'Il Primo Risveglio',  'classic_p1_wins',     NULL,      15,  'rare'),
('maya_always_be_positive',   'profile/titles/maya_always_be_positive.webp',   'Always Be Positive',     'Toujours Positif',        'Siempre Positivo',      'Immer Positiv',        'Sempre Positivo',     'emoji_p2_wins',       NULL,      10,  'common');


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
    -- condition_type/mode/value : mêmes colonnes structurées que `titles` (voir plus
    -- bas) — condition_en reste du texte d'affichage UI, condition_type/value est ce
    -- que api/lib/condition_check.php vérifie réellement côté serveur.
    condition_type  VARCHAR(50)     NULL,
    condition_mode  VARCHAR(30)     NULL,
    condition_value INT             NULL,
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

-- Catalogue des codes événement (migration 011 ; api/admin/event_codes + redeem).
CREATE TABLE event_codes (
    code         VARCHAR(50)   NOT NULL,
    badge_id     VARCHAR(100)  NOT NULL,
    start_date   DATE          NULL,
    end_date     DATE          NULL,
    is_permanent TINYINT(1)    NOT NULL DEFAULT 0,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    description  VARCHAR(255)  NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (code),
    INDEX idx_event_codes_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate-limiting persistant (helper rateLimit() dans bootstrap.php).
-- Partagé entre instances, contrairement à sys_get_temp_dir().
CREATE TABLE rate_limits (
    rl_key       VARCHAR(191) NOT NULL,
    hits         INT          NOT NULL DEFAULT 0,
    window_start INT          NOT NULL,
    PRIMARY KEY (rl_key)
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
-- 16b. SOCIAL_LINK_RANKUP_NOTIFS — Notifs de rank-up pour les 2 joueurs
-- (migration sql/migrations/009 ; utilisé par api/social-links + api/admin/social_links)
-- =============================================================================
CREATE TABLE social_link_rankup_notifs (
    id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT UNSIGNED  NOT NULL,
    partner_id   BIGINT UNSIGNED  NOT NULL,
    new_rank     INT              NOT NULL,
    created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    seen_at      TIMESTAMP        NULL DEFAULT NULL,

    PRIMARY KEY (id),
    INDEX idx_recipient_unseen (recipient_id, seen_at),
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id)   REFERENCES users(id) ON DELETE CASCADE
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
    -- condition_type/mode/value : voir la table `badges` plus haut — même principe,
    -- unlock_condition reste du texte d'affichage UI.
    condition_type      VARCHAR(50)         NULL,
    condition_mode      VARCHAR(30)         NULL,
    condition_value     INT                 NULL,
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
    challenge_target  VARCHAR(200)    NULL,  -- cible aléatoire dédiée au défi (migration 023) ; NULL = cible du jour (anciens défis)
    status            VARCHAR(20)     NOT NULL DEFAULT 'unread',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_messages_receiver    ON messages(receiver_id, status, created_at DESC);
CREATE INDEX idx_messages_sender      ON messages(sender_id);
CREATE INDEX idx_messages_sender_type ON messages(sender_id, type, status, created_at DESC);


-- =============================================================================
-- 20. ERROR_LOG — Observabilité applicative (erreurs backend capturées)
-- =============================================================================
CREATE TABLE error_log (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    level      VARCHAR(20)     NOT NULL DEFAULT 'error',
    -- 'error' | 'warning' | 'info'
    message    TEXT            NOT NULL,
    context    JSON            NULL,
    -- Détails structurés : { "source": "...", "file": "...", "line": ..., "trace": "..." }
    user_id    BIGINT UNSIGNED NULL,
    -- Utilisateur authentifié au moment de l'erreur, si connu. NULL si anonyme
    -- ou inconnu — ON DELETE SET NULL pour ne jamais bloquer une suppression
    -- de compte à cause d'une ligne de log historique.
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_error_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_error_log_created ON error_log(created_at DESC);
CREATE INDEX idx_error_log_level   ON error_log(level, created_at DESC);


-- =============================================================================
-- 21. ADMIN_AUDIT_LOG — Traçabilité des actions admin (qui a fait quoi)
-- =============================================================================
CREATE TABLE admin_audit_log (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    admin_id    BIGINT UNSIGNED NULL,
    -- Admin ayant effectué l'action. NULL si son compte est supprimé depuis
    -- — ON DELETE SET NULL pour ne jamais bloquer une suppression de compte.
    action      VARCHAR(60)     NOT NULL,
    -- ex: 'user.ban', 'user.unban', 'user.grant_admin', 'user.delete',
    --     'badge.grant', 'badge.revoke', 'title.grant', 'title.revoke',
    --     'wallpaper.grant', 'wallpaper.revoke', 'event_code.create',
    --     'event_code.update', 'event_code.delete', 'social_link.update',
    --     'social_link.delete'
    target_type VARCHAR(40)     NOT NULL,
    -- ex: 'user', 'badge', 'title', 'wallpaper', 'event_code', 'social_link'
    target_id   VARCHAR(100)    NOT NULL,
    -- id numérique ou code/slug selon la cible, toujours stocké en texte
    details     JSON            NULL,
    -- Détails structurés de la mutation (avant/après, champs modifiés…)
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_audit_log_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_target  ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_admin_audit_log_admin   ON admin_audit_log(admin_id, created_at DESC);


-- =============================================================================
-- SEED CATALOGUES (badges, wallpapers, event_codes) — folded from migrations 007/011
-- =============================================================================
INSERT IGNORE INTO badges (slug, name_en, category, rarity, image_path, condition_en, condition_type, condition_mode, condition_value, is_secret) VALUES

-- ── Achievement badges ──────────────────────────────────────────────────────
('ace_detective',       'Ace Detective',              'achievement', 'rare',      'profile/badges/images/Badges_Ace_Detective.png',         'Win 10 games', 'wins_total', NULL, 10, 0),
('ace_defective',       'Ace Defective',              'achievement', 'common',    'profile/badges/images/Badges_Ace_Defective.png',         'Give up 10 times', 'giveups_total', NULL, 10, 0),
('shadow_slayer',       'Shadow Slayer',              'achievement', 'common',    'profile/badges/images/Badges_Shadow_Slayer.png',         'Win 5 games in Silhouette mode', 'mode_wins', 'silhouette', 5, 0),
('music_master',        'Music Master',               'achievement', 'rare',      'profile/badges/images/Badges_Music.png',                 'Win 20 games in Music mode', 'mode_wins', 'music', 20, 0),
('burn_my_dread',       'Memento Mori',               'achievement', 'rare',      'profile/badges/images/Badges_Burn_My_Dread_Silver.png',  'Find ''Burn My Dread'' in Music mode', 'manual', NULL, NULL, 0),
('into_the_fog',        'Unsolved Case',              'achievement', 'common',    'profile/badges/images/Badges_something_wrong.png',       'Turn your back on the truth in the final investigation', 'manual', NULL, NULL, 0),
('velvet_headache',     'Velvet Headache',            'achievement', 'rare',      'profile/badges/images/Badges_velvet_headache.png',       'Find Wonder (Velvet) and Caroline & Justine in All-Out Attack', 'manual', NULL, NULL, 0),
('first_win',           'First Victory',              'achievement', 'common',    'profile/badges/images/Badges_Fisrt_Win.png',             'Win your first game', 'wins_total', NULL, 1, 0),
('p1_p2_fan',           'Echoes of the Past',         'achievement', 'rare',      'profile/badges/images/Badges_P1_P2_Fan.png',             'Win 15 games in Classic mode', 'mode_wins', 'classic', 15, 0),
('velvet_master',       'Velvet Master',              'achievement', 'rare',      'profile/badges/images/Badges_Velvet_master.png',         'Win 10 games in Personae mode', 'mode_wins', 'personae', 10, 0),
('chinese_new_year',    'Chinese New Year Achievement','achievement','common',    'profile/badges/images/Chinesse_new_year.png',            'Find Wonder and Rin (CNY) in All-Out Attack', 'manual', NULL, NULL, 0),
('twin_blade',          'Twin Blade',                 'achievement', 'common',    'profile/badges/images/Badge_Twin_Blade.png',             'Find a Personae of Yosuke and Yusuke', 'manual', NULL, NULL, 0),
('persona_q_explorer',  'Cinema Explorer',            'achievement', 'rare',      'profile/badges/images/Badges_Persona_Q.webp',            'Find all 4 Persona Q exclusive characters in Silhouette mode', 'manual', NULL, NULL, 0),
('crimson_legacy',      'Crimson Legacy',             'achievement', 'epic',      'profile/badges/images/Badge_Picaro.png',                 'Find all 12 Picaro Personas', 'manual', NULL, NULL, 1),
('hippocampus_reload',  'Hippocampus Reload',         'achievement', 'rare',      'profile/badges/images/Badges_Zotomayo.webp',             'Find the ZUTOMAYO x P3R Mashup in Music mode', 'manual', NULL, NULL, 0),
('truth_duality',       'Truth & Duality',            'achievement', 'rare',      'profile/badges/images/Badges_Truth_Duality.png',         'Find both Crow and Black Mask in All-Out Attack mode', 'manual', NULL, NULL, 0),
('one_shot',            'Critical Strike',            'achievement', 'rare',      'profile/badges/images/Badge_One_Shot.webp',              'Guess correctly on the very first try', 'manual', NULL, NULL, 0),
('aoa_vision',          'Piercing the Fog',           'achievement', 'rare',      'profile/badges/images/Badge_Midnight_Vision.webp',       'Guess the All-Out Attack on the very first try', 'manual', NULL, NULL, 0),
('emoji_decoder',       'Emoji Decoder',              'achievement', 'common',    'profile/badges/images/Badge_Emoji_Decoder.webp',         'Win 10 games in Emoji mode', 'mode_wins', 'emoji', 10, 0),
('navigator',           'Eye of the Navigator',       'achievement', 'rare',      'profile/badges/images/Badge_Navigator.webp',             'Use the hint 50 times in Classic mode', 'manual', NULL, NULL, 0),
('velvet_regular',      'Velvet Regular',             'achievement', 'epic',      'profile/badges/images/Badge_Velvet_Regular.webp',        'Play on 50 unique days', 'unique_days', NULL, 50, 0),
('strega',              'Apostles of the Fall',       'achievement', 'rare',      'profile/badges/images/Badge_Strega.webp',                'Find Hypnos (Takaya), Moros (Jin) and Medea (Chidori) in Personae mode', 'manual', NULL, NULL, 0),
('twin_fist',           'Twin Fist',                  'achievement', 'rare',      'profile/badges/images/Badge_Twin_Fist.webp',             'Find Makoto Nijima''s and Akihiko''s personas + their All-Out Attacks', 'manual', NULL, NULL, 0),
('twin_spear',          'Twin Spear',                 'achievement', 'rare',      'profile/badges/images/Badge_Twin_Spear.webp',            'Find Kotone''s and Ken''s personas + their All-Out Attacks', 'manual', NULL, NULL, 0),
('tradition_modernite', 'Chronological Convergence',  'achievement', 'epic',      'profile/badges/images/Badge_Tradition_Modernite.webp',   'Find Naoto''s & Futaba''s personas + Secret Base & When Mother Was There', 'manual', NULL, NULL, 0),
('shapeshifter',        'The Formless Soul',          'achievement', 'epic',      'profile/badges/images/Badge_Shapshifter.webp',           'Guess the same character in 3 different modes (cumulative)', 'manual', NULL, NULL, 0),
('ideal_reality',       'Gentle Illusion',            'achievement', 'common',    'profile/badges/images/Badge_Ideal_Reality.webp',         'Give up when the target is ''Our Light'' in Music mode', 'manual', NULL, NULL, 0),
('for_real',            'For Real',                   'achievement', 'rare',      'profile/badges/images/Badges_for_real.png',              'Find Ryuji''s All-Out Attack in AOA mode and his persona in Personae mode', 'manual', NULL, NULL, 0),
('night_owl',           'Phantom of the Night',       'achievement', 'common',    'profile/badges/images/Badge_Night_Owl.webp',             'Play between midnight and 5 AM (Paris time)', 'manual', NULL, NULL, 0),
('nyx_hour',            'Nyx Hour',                   'achievement', 'rare',      'profile/badges/images/Badge_Nyx_Hour.webp',              'Play between midnight and 12:30 AM (Paris time)', 'manual', NULL, NULL, 0),
('stylist',             'Breathtaking Aesthetics',    'achievement', 'epic',      'profile/badges/images/Badge_stylist.webp',               'Customize your profile: avatar + UI color + profile music + equipped title', 'manual', NULL, NULL, 0),

-- ── Streak badges ────────────────────────────────────────────────────────────
('pyro_spark',          'The Ignition',               'streak',      'common',    'profile/badges/images/Badge_Pyro_Spark.webp',            'Reach a 7-day streak', 'streak_record', NULL, 7, 0),
('raphael',             'The Divine Blaze',           'streak',      'rare',      'profile/badges/images/Badge_Raphael.webp',               'Reach a 30-day streak', 'streak_record', NULL, 30, 0),
('surt',                'Ragnarök''s Dawn',           'streak',      'epic',      'profile/badges/images/Badge_Surt.webp',                  'Reach a 90-day streak', 'streak_record', NULL, 90, 0),
('lucifer',             'Crest of the Morning Star',  'streak',      'epic',      'profile/badges/images/Badge_Lucifer.webp',               'Reach a 120-day streak', 'streak_record', NULL, 120, 0),
('helel',               'The Eternal Zenith',         'streak',      'legendary', 'profile/badges/images/Badge_Helel.webp',                 'Reach a 365-day streak', 'streak_record', NULL, 365, 0),
('reborn_phoenix',      'Phoenix Reborn',             'streak',      'rare',      'profile/badges/images/Badge_Reborn_Phenix.webp',         'Restore your streak after losing it (grace period)', 'manual', NULL, NULL, 0),

-- ── Social badges ────────────────────────────────────────────────────────────
('take_the_pose',       'Take The Pose',              'social',      'common',    'profile/badges/images/Badges_Take_The_Pose.png',         'Share your profile with others', 'manual', NULL, NULL, 0),
('best_bro',            'Best Bro',                   'social',      'common',    'profile/badges/images/Badges_Best_bro.png',              'Have 2 or more friends', 'friends_count', NULL, 2, 0),
('data_mining',         'Data Mining',                'social',      'common',    'profile/badges/images/Badge_Data_Mining.webp',           'Visit 5 different user profiles', 'manual', NULL, NULL, 0),
('leblanc_meeting',     'Leblanc Meeting',            'social',      'rare',      'profile/badges/images/Badge_Leblanc_Meeting.webp',       '3 or more friends logged in the same day as you', 'manual', NULL, NULL, 0),

-- ── Event badges ─────────────────────────────────────────────────────────────
('rentree',             'Spring Awakening',           'event',       'common',    'profile/badges/images/Badges_Rentré.png',                'Log in on April 1st', 'manual', NULL, NULL, 0),
('sport',               'Athletic Spirit',            'event',       'common',    'profile/badges/images/Badges_Sport.png',                 'Redeem code SPORT between April 6th and May 1st, 2025', 'manual', NULL, NULL, 0),
('christmas_2025',      'Christmas 2025',             'event',       'common',    'profile/badges/images/Badges_Christmas_2025.png',        'Redeem code during Christmas 2025', 'manual', NULL, NULL, 0),
('new_years_2026',      'New Year''s 2026',           'event',       'common',    'profile/badges/images/Badges_New_Years_2026.png',        'Redeem code during New Year 2026', 'manual', NULL, NULL, 0),
('chinese_new_year_2026','Happy Chinese New Year 2026','event',      'common',    'profile/badges/images/Badges_Chiness_New_Year.webp',     'Type the Chinese New Year code during the 2026 celebration', 'manual', NULL, NULL, 0),
('valentine_2026',      'Valentine''s Day 2026',      'event',       'common',    'profile/badges/images/Badges_St_Valentin.png',           'Redeem code during Valentine''s 2026', 'manual', NULL, NULL, 0),
('easter_2026',         'Easter 2026',                'event',       'common',    'profile/badges/images/Badges_Paques.png',                'Redeem code during Easter 2026', 'manual', NULL, NULL, 0),
('golden_week',         'Golden Week',                'event',       'common',    'profile/badges/images/Badge_Golden_Week.webp',           'Log in between April 29 and May 5', 'manual', NULL, NULL, 0),
('tanabata',            'Tanabata',                   'event',       'common',    'profile/badges/images/Badge_Tanabata.webp',              'Log in on July 7th', 'manual', NULL, NULL, 0),
('promised_day',        'The Promised Day',           'event',       'rare',      'profile/badges/images/Badge_Promised_Day.webp',          'Play on December 31st AND January 1st', 'manual', NULL, NULL, 0),

-- ── Secret badges ────────────────────────────────────────────────────────────
('true_hacker',         'True Hacker',                'secret',      'rare',      'profile/badges/images/Badges_True_Hacker.png',           '???', 'manual', NULL, NULL, 1),
('tae_takemi',          'Tae Takemi Fan',             'secret',      'rare',      'profile/badges/images/Badges_Tae_Takemi.png',            '???', 'manual', NULL, NULL, 1),
('arati',               'Arati''s Blessing',          'secret',      'rare',      'profile/badges/images/Badges_Arati.png',                 '???', 'manual', NULL, NULL, 1),
('gyotre',              'Gyotre',                     'secret',      'rare',      'profile/badges/images/Badge_Gyotre.webp',                '???', 'manual', NULL, NULL, 1),
('dzulian',             'The First Contractor',       'secret',      'epic',      'profile/badges/images/Badge_Dzulian.png',                '???', 'manual', NULL, NULL, 1),
('chef',                'Master Chef',                'secret',      'rare',      'profile/badges/images/Badges_Chef.png',                  '???', 'manual', NULL, NULL, 1),
('github_contributor',  'Phantom Coder',              'secret',      'common',    'profile/badges/images/Badges_Github_Morgana.png',        '???', 'manual', NULL, NULL, 1),
('lobster',             'Artistic Lobster',           'secret',      'rare',      'profile/badges/images/Badges_Lobster.png',               '???', 'manual', NULL, NULL, 1),
('hifumi_archives',     'The Grandmaster''s Tome',    'secret',      'rare',      'profile/badges/images/Badge_Hifumi_Archives.webp',       '???', 'manual', NULL, NULL, 1),
('report',              'The Priestess''s Audit',     'secret',      'rare',      'profile/badges/images/Badge_Report.webp',                '???', 'manual', NULL, NULL, 1);

INSERT IGNORE INTO wallpapers (id, game, is_default, unlock_condition, condition_type, condition_mode, condition_value, name, image_path) VALUES
('kamoshida_palace',       'P5', 0, 'Play at least 1 game in each of the 6 modes',                     'all_modes_won',        NULL,     NULL, 'Kamoshida''s Palace',    'profile/Wallpaper/unlockable/kamoshida_palace.webp'),
('madarame_wallpaper',     'P5', 0, 'Set a custom avatar AND have at least 1 friend',                   'friends_count',        NULL,     1,    'Madarame''s Palace',     'profile/Wallpaper/unlockable/madarame_wallpaper.webp'),
('yukiko_dungeons',        'P4', 0, 'Play 3 consecutive days with P4 filter active',                    'manual',               NULL,     NULL, 'Yukiko''s Dungeons',     'profile/Wallpaper/unlockable/yukiko_dungeons.webp'),
('kanji_dungeons',         'P4', 0, 'Send a challenge to a friend and have them accept it',             'manual',               NULL,     NULL, 'Kanji''s Dungeons',      'profile/Wallpaper/unlockable/kanji_dungeons.webp'),
('rise_dungeons',          'P4', 0, 'Play 30 total games in Music mode',                               'mode_games',           'music',  30,   'Rise''s Dungeons',       'profile/Wallpaper/unlockable/rise_dungeons.webp'),
('mitsuo_dungeons',        'P4', 0, 'Complete 75 total games across all modes',                         'games_total',          NULL,     75,   'Mitsuo''s Dungeons',     'profile/Wallpaper/unlockable/mitsuo_dungeons.webp'),
('dark_shopping_district', 'P4', 0, 'Have a Social Link at rank 5 or higher',                          'social_link_min_rank', NULL,     5,    'Dark Shopping District', 'profile/Wallpaper/unlockable/dark_shopping_district.webp');

INSERT IGNORE INTO event_codes (code, badge_id, start_date, end_date, is_permanent, is_active, description) VALUES
  ('XMAS2025',    'christmas_2025',        '2025-12-01', '2025-12-31', 0, 0, 'Christmas 2025'),
  ('NEWYEAR2026', 'new_years_2026',        '2025-12-31', '2026-01-31', 0, 0, 'New Year 2026'),
  ('VALENTINE2026','valentine_2026',       '2026-02-14', '2026-03-01', 0, 0, 'Valentine 2026'),
  ('EASTER2026',  'easter_2026',           '2026-04-01', '2026-04-10', 0, 0, 'Easter 2026'),
  ('CHINESNY2026','chinese_new_year_2026', '2026-02-01', '2026-03-01', 0, 0, 'Chinese New Year 2026'),
  ('SPORT',       'sport',                 '2025-04-06', '2025-05-01', 0, 0, 'Sport 2025'),
  ('ALIBABA',     'true_hacker',           NULL, NULL, 1, 1, 'Secret — Hamza'),
  ('DEATHQUEEN',  'tae_takemi',            NULL, NULL, 1, 1, 'Secret — Tae Takemi'),
  ('ARATI',       'arati',                 NULL, NULL, 1, 1, 'Secret — Arati'),
  ('DZULIAN',     'dzulian',               NULL, NULL, 1, 1, 'Secret — Dzulian'),
  ('GOURMET',     'chef',                  NULL, NULL, 1, 1, 'Secret — Chef'),
  ('LOBSTER',     'lobster',               NULL, NULL, 1, 1, 'Secret — Lobster'),
  ('GYOTRE',      'gyotre',                NULL, NULL, 1, 1, 'Secret — Gyotre');


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
