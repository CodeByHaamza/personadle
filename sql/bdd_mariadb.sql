-- =============================================================================
-- PersonaDLE — Schéma de base de données v2.0
-- Compatible MariaDB 10.6+ (InnoDB, utf8mb4, JSON natif)
-- =============================================================================
-- Différences clés vs PostgreSQL :
--   • BIGSERIAL     → BIGINT UNSIGNED NOT NULL AUTO_INCREMENT
--   • DEFAULT NOW() → DEFAULT CURRENT_TIMESTAMP
--   • BOOLEAN       → TINYINT(1)  (0 = false, 1 = true)
--   • JSON          → JSON  (natif depuis MariaDB 10.2)
--   • Fonctions PL/pgSQL → fonctions/procédures MariaDB (DELIMITER //)
--   • Toutes les tables → ENGINE=InnoDB CHARSET=utf8mb4
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;   -- désactivé pendant la création des tables


-- =============================================================================
-- 1. USERS — Comptes utilisateurs
-- =============================================================================
CREATE TABLE users (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255)        NOT NULL UNIQUE,
    pseudo          VARCHAR(50)         NOT NULL UNIQUE,
    password_hash   VARCHAR(255)        NOT NULL,
    friend_code     CHAR(8)             NOT NULL UNIQUE,
    lang            VARCHAR(5)          NOT NULL DEFAULT 'fr',
    created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP           NULL,
    is_deleted          TINYINT(1)          NOT NULL DEFAULT 0,
    deleted_at          TIMESTAMP           NULL,
    remember_me_hash    VARCHAR(64)         NULL,
    remember_me_expires DATETIME            NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_pseudo    ON users(pseudo);
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_code      ON users(friend_code);
CREATE INDEX idx_remember_me     ON users(remember_me_hash);


-- =============================================================================
-- 2. TITLES — Titres / rangs débloquables
-- =============================================================================
CREATE TABLE titles (
    id                  BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug                VARCHAR(100)        NOT NULL UNIQUE,
    name_fr             VARCHAR(100),
    name_en             VARCHAR(100),
    name_es             VARCHAR(100),
    name_de             VARCHAR(100),
    name_jp             VARCHAR(100),
    description_fr      TEXT,
    description_en      TEXT,
    description_es      TEXT,
    description_de      TEXT,
    description_jp      TEXT,
    condition_type      VARCHAR(50),
    condition_mode      VARCHAR(30),
    condition_value     INT,
    rarity              VARCHAR(20)         NOT NULL DEFAULT 'common'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO titles (slug, name_fr, name_en, name_es, name_de, name_jp, condition_type, condition_value, rarity) VALUES
('first_steps',        'Premiers Pas',      'First Steps',       'Primeros Pasos',   'Erste Schritte',    '第一歩',          'wins_total',          1,   'common'),
('phantom_thief',      'Voleur Fantôme',    'Phantom Thief',     'Ladrón Fantasma',  'Phantom Dieb',      '怪盗',            'wins_total',          10,  'common'),
('wild_card',          'Wild Card',         'Wild Card',         'Comodín',          'Wildcard',          'ワイルド',        'wins_total',          50,  'rare'),
('velvet_apprentice',  'Apprenti Velours',  'Velvet Apprentice', 'Aprendiz Velvet',  'Samt-Lehrling',     'ベルベットの弟子','wins_total',          100, 'rare'),
('ace_detective',      'As Détective',      'Ace Detective',     'Detective As',     'Meisterdetektiv',   'エース探偵',      'streak_record',       7,   'epic'),
('true_wild_card',     'Vrai Wild Card',    'True Wild Card',    'Comodín Verdadero','Wahre Wildcard',    '真のワイルド',    'wins_total',          200, 'legendary'),
('music_master',       'Maître Musique',    'Music Master',      'Maestro Musical',  'Musikmeister',      '音楽の達人',      'mode_wins',           20,  'rare'),
('silhouette_pro',     'Pro Silhouette',    'Silhouette Pro',    'Pro Silueta',      'Silhouetten-Profi', 'シルエット職人',  'mode_wins',           15,  'rare'),
('confidant',          'Confident',         'True Confidant',    'Confidente',       'Vertrauter',        '本当の仲間',      'social_link_rank_10', 1,  'legendary'),
('perfectionist',      'Perfectionniste',   'Perfectionist',     'Perfeccionista',   'Perfektionist',     '完璧主義者',      'perfect_wins',        10,  'epic');


-- =============================================================================
-- 3. PROFILES — Données d'affichage du profil
-- =============================================================================
CREATE TABLE profiles (
    user_id             BIGINT UNSIGNED     NOT NULL PRIMARY KEY,
    avatar_data         LONGTEXT,
    avatar_border_color VARCHAR(7)          NOT NULL DEFAULT '#ffffff',
    wallpaper_id        VARCHAR(100),
    profile_music_id    VARCHAR(100),
    selected_badges     JSON,
    equipped_title_id   BIGINT UNSIGNED     NULL,
    settings            JSON                NULL,
    updated_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user
        FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_profiles_title
        FOREIGN KEY (equipped_title_id) REFERENCES titles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 4. USER_TITLES — Titres débloqués par utilisateur
-- =============================================================================
CREATE TABLE user_titles (
    id          BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT UNSIGNED     NOT NULL,
    title_id    BIGINT UNSIGNED     NOT NULL,
    unlocked_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_title (user_id, title_id),
    CONSTRAINT fk_ut_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_ut_title FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_titles_user ON user_titles(user_id);


-- =============================================================================
-- 5. USER_STATS — Statistiques par mode et par joueur
-- =============================================================================
CREATE TABLE user_stats (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED     NOT NULL,
    mode            VARCHAR(30)         NOT NULL,
    wins            INT                 NOT NULL DEFAULT 0,
    giveups         INT                 NOT NULL DEFAULT 0,
    games           INT                 NOT NULL DEFAULT 0,
    streak          INT                 NOT NULL DEFAULT 0,
    streak_record   INT                 NOT NULL DEFAULT 0,
    perfect_wins    INT                 NOT NULL DEFAULT 0,
    total_time_ms   BIGINT              NOT NULL DEFAULT 0,
    last_played_at  TIMESTAMP           NULL,
    first_played_at TIMESTAMP           NULL,
    UNIQUE KEY uq_stats_user_mode (user_id, mode),
    CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_stats_user ON user_stats(user_id);
CREATE INDEX idx_user_stats_mode ON user_stats(mode, wins DESC);


-- =============================================================================
-- 6. GAME_SESSIONS — Historique de chaque partie
-- =============================================================================
CREATE TABLE game_sessions (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED     NOT NULL,
    mode            VARCHAR(30)         NOT NULL,
    played_date     DATE                NOT NULL,
    target_name     VARCHAR(200)        NOT NULL,
    result          VARCHAR(10)         NOT NULL,  -- 'win' | 'giveup'
    attempts        INT                 NOT NULL,
    time_ms         INT                 NULL,
    active_filters  JSON,
    created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_game_sessions_user_mode ON game_sessions(user_id, mode);
CREATE INDEX idx_game_sessions_date      ON game_sessions(played_date);
CREATE INDEX idx_game_sessions_target    ON game_sessions(mode, played_date, target_name);


-- =============================================================================
-- 7. DAILY_TARGETS — Cible du jour par mode (générée côté serveur)
-- =============================================================================
-- Cible personnalisée par joueur (seed déterministe user_id + date)
-- Lazy generation : créée au premier appel du joueur ce jour-là
CREATE TABLE daily_targets (
    user_id         BIGINT UNSIGNED     NOT NULL,
    mode            VARCHAR(30)         NOT NULL,
    target_date     DATE                NOT NULL,
    target_name     VARCHAR(200)        NOT NULL,
    target_data     JSON,
    created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, mode, target_date),
    CONSTRAINT fk_dt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 8. BADGES_UNLOCKED — Badges débloqués
-- =============================================================================
CREATE TABLE badges_unlocked (
    id          BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT UNSIGNED     NOT NULL,
    badge_id    VARCHAR(100)        NOT NULL,
    unlocked_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_badge_user (user_id, badge_id),
    CONSTRAINT fk_badges_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_badges_user ON badges_unlocked(user_id);


-- =============================================================================
-- 9. EVENT_CODES_REDEEMED — Codes événement utilisés
-- =============================================================================
CREATE TABLE event_codes_redeemed (
    id          BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT UNSIGNED     NOT NULL,
    code        VARCHAR(50)         NOT NULL,
    redeemed_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_code_user (user_id, code),
    CONSTRAINT fk_codes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 10. FRIENDSHIPS — Relations d'amitié
-- =============================================================================
CREATE TABLE friendships (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    requester_id    BIGINT UNSIGNED     NOT NULL,
    addressee_id    BIGINT UNSIGNED     NOT NULL,
    status          VARCHAR(15)         NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at     TIMESTAMP           NULL,
    seen_at         TIMESTAMP           NULL,
    UNIQUE KEY uq_friendship (requester_id, addressee_id),
    CONSTRAINT chk_no_self_friend CHECK (requester_id <> addressee_id),
    CONSTRAINT fk_fr_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fr_addressee FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id, status);


-- =============================================================================
-- 11. SOCIAL_LINKS — Rang Social Link entre deux amis
--     Convention : user_a_id = MIN(id), user_b_id = MAX(id)
-- =============================================================================
CREATE TABLE social_links (
    id                  BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_a_id           BIGINT UNSIGNED     NOT NULL,
    user_b_id           BIGINT UNSIGNED     NOT NULL,
    rank                INT                 NOT NULL DEFAULT 1,
    xp                  INT                 NOT NULL DEFAULT 0,
    created_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_interaction_at TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
                                            ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_social_link (user_a_id, user_b_id),
    CONSTRAINT chk_sl_order CHECK (user_a_id < user_b_id),
    CONSTRAINT chk_sl_rank  CHECK (rank >= 1 AND rank <= 10),
    CONSTRAINT fk_sl_a FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sl_b FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_social_links_a ON social_links(user_a_id);
CREATE INDEX idx_social_links_b ON social_links(user_b_id);


-- =============================================================================
-- 12. SOCIAL_LINK_RANKS — Seuils XP et noms des rangs
-- =============================================================================
CREATE TABLE social_link_ranks (
    rank            INT                 NOT NULL PRIMARY KEY,
    name_fr         VARCHAR(50),
    name_en         VARCHAR(50),
    name_es         VARCHAR(50),
    name_de         VARCHAR(50),
    name_jp         VARCHAR(50),
    xp_required     INT                 NOT NULL,
    reward_en       TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO social_link_ranks (rank, name_fr, name_en, name_es, name_de, name_jp, xp_required, reward_en) VALUES
(1,  'Inconnu',            'Stranger',            'Desconocido',          'Unbekannter',               '見知らぬ人',     0,    'Friendship begins'),
(2,  'Connaissance',       'Acquaintance',         'Conocido',             'Bekannter',                 '知り合い',       100,  'Can compare stats'),
(3,  'Compagnon',          'Companion',            'Compañero',            'Gefährte',                  '仲間',           250,  'Can share daily scores'),
(4,  'Allié',              'Ally',                 'Aliado',               'Verbündeter',               '味方',           450,  'Can send challenges'),
(5,  'Confident',          'Confidant',            'Confidente',           'Vertrauter',                '信頼できる人',   700,  'Shared streak counter unlocked'),
(6,  'Allié Fidèle',       'Trusted Ally',         'Aliado de Confianza',  'Treuer Verbündeter',        '信頼できる仲間', 1000, 'Profile visits give bonus XP'),
(7,  'Vrai Allié',         'True Ally',            'Verdadero Aliado',     'Wahrer Verbündeter',        '真の味方',       1350, 'Streak sharing gives double XP'),
(8,  'Lien',               'Bond',                 'Vínculo',              'Verbindung',                '絆',             1750, 'Special profile frame unlocked'),
(9,  'Lien Indestructible','Unbreakable Bond',      'Vínculo Inquebrantable','Unzerbrechliche Verbindung','揺るぎない絆',  2200, 'Almost there…'),
(10, 'True Confidant',     'True Confidant',        'Verdadero Confidente', 'Wahrer Vertrauter',         '真の協力者',     2700, 'True Confidant badge generated');


-- =============================================================================
-- 13. SOCIAL_LINK_INTERACTIONS — Log XP
-- =============================================================================
CREATE TABLE social_link_interactions (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    social_link_id  BIGINT UNSIGNED     NOT NULL,
    initiator_id    BIGINT UNSIGNED     NOT NULL,
    action_type     VARCHAR(50)         NOT NULL,
    xp_gained       INT                 NOT NULL,
    is_mutual       TINYINT(1)          NOT NULL DEFAULT 0,
    created_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sli_link      FOREIGN KEY (social_link_id) REFERENCES social_links(id) ON DELETE CASCADE,
    CONSTRAINT fk_sli_initiator FOREIGN KEY (initiator_id)   REFERENCES users(id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sli_social_link ON social_link_interactions(social_link_id);
CREATE INDEX idx_sli_date        ON social_link_interactions(created_at);
CREATE INDEX idx_sli_initiator   ON social_link_interactions(initiator_id);


-- =============================================================================
-- 14. (removed: SOCIAL_LINK_BADGES — replaced by rank10-effect, see migration 012_remove_tcb)
-- =============================================================================

-- =============================================================================
-- 15. LEADERBOARD_CACHE — Cache classements
-- =============================================================================
CREATE TABLE leaderboard_cache (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED     NOT NULL,
    mode            VARCHAR(30)         NOT NULL,
    period          VARCHAR(15)         NOT NULL,
    period_start    DATE                NULL,
    score           INT                 NOT NULL,
    rank_position   INT,
    updated_at      TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_leaderboard (user_id, mode, period, period_start),
    CONSTRAINT fk_lb_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_leaderboard_ranking ON leaderboard_cache(mode, period, period_start, score DESC);


-- =============================================================================
-- 16. DELETION_REQUESTS — Log RGPD
-- =============================================================================
CREATE TABLE deletion_requests (
    id              BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED     NOT NULL,
    requested_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP           NULL,
    deletion_type   VARCHAR(20)         NOT NULL DEFAULT 'full'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- VUES UTILES
-- =============================================================================

-- Vue : liste des amis (dans les deux sens)
CREATE OR REPLACE VIEW v_friends AS
SELECT f.id, f.requester_id AS user_id, f.addressee_id AS friend_id, f.status, f.accepted_at
FROM friendships f WHERE f.status = 'accepted'
UNION ALL
SELECT f.id, f.addressee_id AS user_id, f.requester_id AS friend_id, f.status, f.accepted_at
FROM friendships f WHERE f.status = 'accepted';

-- Vue : stats globales par joueur (tous modes)
CREATE OR REPLACE VIEW v_global_stats AS
SELECT
    user_id,
    SUM(wins)          AS total_wins,
    SUM(giveups)       AS total_giveups,
    SUM(games)         AS total_games,
    MAX(streak_record) AS best_streak,
    SUM(perfect_wins)  AS total_perfect_wins,
    SUM(total_time_ms) AS total_time_ms
FROM user_stats
GROUP BY user_id;

-- Vue : Social Links dans les deux sens
CREATE OR REPLACE VIEW v_social_links AS
SELECT sl.id, sl.user_a_id AS user_id, sl.user_b_id AS friend_id,
       sl.rank, sl.xp, sl.created_at, sl.last_interaction_at
FROM social_links sl
UNION ALL
SELECT sl.id, sl.user_b_id AS user_id, sl.user_a_id AS friend_id,
       sl.rank, sl.xp, sl.created_at, sl.last_interaction_at
FROM social_links sl;


-- =============================================================================
-- FONCTIONS / PROCÉDURES STOCKÉES (MariaDB)
-- =============================================================================

DELIMITER //

-- Fonction : obtenir ou créer le social_link entre deux utilisateurs
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

    SELECT xp, rank INTO v_current_xp, v_current_rank
    FROM social_links WHERE id = p_link_id;

    SET v_updated_xp = v_current_xp + p_xp_amount;

    SELECT MAX(r.rank) INTO v_updated_rank
    FROM social_link_ranks r
    WHERE r.xp_required <= v_updated_xp;

    IF v_updated_rank IS NULL THEN SET v_updated_rank = 1; END IF;

    SET p_ranked_up = IF(v_updated_rank > v_current_rank, 1, 0);

    UPDATE social_links
    SET xp = v_updated_xp,
        rank = v_updated_rank,
        last_interaction_at = NOW()
    WHERE id = p_link_id;

    SET p_new_xp   = v_updated_xp;
    SET p_new_rank = v_updated_rank;
END //

DELIMITER ;

-- =============================================================================
-- 17. WALLPAPERS — Catalogue des fonds d'écran
-- =============================================================================
-- Les fichiers image restent des assets statiques.
-- Cette table référence uniquement les IDs et leurs conditions de déblocage.
CREATE TABLE wallpapers (
    id                  VARCHAR(64)         NOT NULL PRIMARY KEY,   -- ex: "p5_velvet_room"
    game                VARCHAR(16),                                -- P1, P3, P4, P5, PQ…
    is_default          BOOLEAN             NOT NULL DEFAULT FALSE, -- TRUE = disponible sans déblocage
    unlock_condition    VARCHAR(255)        NULL                    -- NULL si is_default = TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 18. USER_WALLPAPERS — Wallpapers débloqués par utilisateur
-- =============================================================================
-- Ne contient QUE les wallpapers débloqués (pas les defaults).
-- Côté API : wallpapers disponibles = is_default=TRUE + user_wallpapers de l'user
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
    challenge_mode  VARCHAR(30)     NULL,
    challenge_score INT             NULL,
    challenge_date  DATE            NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'unread',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_messages_receiver ON messages(receiver_id, status, created_at DESC);
CREATE INDEX idx_messages_sender   ON messages(sender_id);

SET FOREIGN_KEY_CHECKS = 1;
-- =============================================================================
-- FIN DU SCHÉMA — PersonaDLE v2.0 — MariaDB 10.6+
-- =============================================================================
