-- =============================================================================
-- PersonaDLE — Schéma de base de données v1.2
-- Compatible PostgreSQL (notes MySQL/MariaDB indiquées en commentaires)
-- =============================================================================
-- Ordre de création respectant les dépendances (FK)
-- 1. users          → aucune dépendance
-- 2. profiles       → dépend de users, titles
-- 3. titles         → aucune dépendance
-- 4. user_titles    → dépend de users, titles
-- 5. user_stats     → dépend de users
-- 6. game_sessions  → dépend de users
-- 7. daily_targets  → aucune dépendance
-- 8. badges_unlocked       → dépend de users
-- 9. event_codes_redeemed  → dépend de users
-- 10. friendships          → dépend de users
-- 11. social_links         → dépend de users (via friendships)
-- 12. social_link_ranks    → aucune dépendance
-- 13. social_link_interactions → dépend de social_links, users
-- 14. leaderboard_cache    → dépend de users
-- 16. deletion_requests    → dépend de users (soft ref)
-- =============================================================================


-- =============================================================================
-- 1. USERS — Comptes utilisateurs
-- =============================================================================
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    -- MySQL: id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY

    email           VARCHAR(255)    NOT NULL UNIQUE,
    pseudo          VARCHAR(50)     NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,

    -- Code ami court (ex: "XK4R2M9P") — partageable pour ajouter des amis
    friend_code     CHAR(8)         NOT NULL UNIQUE,

    -- Langue préférée de l'interface
    lang            VARCHAR(5)      NOT NULL DEFAULT 'fr',
    -- Valeurs autorisées: 'fr', 'en', 'es', 'de', 'jp'

    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMP,

    -- RGPD: soft delete (données anonymisées immédiatement, suppression hard à J+30)
    is_deleted      BOOLEAN         NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_users_pseudo    ON users(pseudo);
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_code      ON users(friend_code);


-- =============================================================================
-- 2. TITLES — Titres / rangs débloquables
--    (définis avant profiles car profiles y fait référence)
-- =============================================================================
CREATE TABLE titles (
    id                  BIGSERIAL PRIMARY KEY,
    slug                VARCHAR(100)    NOT NULL UNIQUE,
    -- ex: 'phantom_thief', 'wild_card', 'velvet_apprentice'

    -- Traductions du nom
    name_fr             VARCHAR(100),
    name_en             VARCHAR(100),
    name_es             VARCHAR(100),
    name_de             VARCHAR(100),
    name_jp             VARCHAR(100),

    -- Traductions de la description (tooltip/modal)
    description_fr      TEXT,
    description_en      TEXT,
    description_es      TEXT,
    description_de      TEXT,
    description_jp      TEXT,

    -- Condition de déblocage
    condition_type      VARCHAR(50),
    -- Valeurs: 'wins_total', 'streak_record', 'mode_wins',
    --          'perfect_wins', 'social_link_rank_10', 'badges_count', 'manual'

    condition_mode      VARCHAR(30),
    -- NULL = global, sinon: 'classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'

    condition_value     INT,
    -- Ex: condition_type='wins_total', condition_value=50 → 50 victoires totales

    rarity              VARCHAR(20)     NOT NULL DEFAULT 'common'
    -- Valeurs: 'common', 'rare', 'epic', 'legendary'
);

-- Seed: titres de base
INSERT INTO titles (slug, name_fr, name_en, name_es, name_de, name_jp, condition_type, condition_value, rarity) VALUES
('first_steps',        'Premiers Pas',      'First Steps',       'Primeros Pasos',   'Erste Schritte',    '第一歩',       'wins_total',        1,   'common'),
('phantom_thief',      'Voleur Fantôme',    'Phantom Thief',     'Ladrón Fantasma',  'Phantom Dieb',      '怪盗',         'wins_total',        10,  'common'),
('wild_card',          'Wild Card',         'Wild Card',         'Comodín',          'Wildcard',          'ワイルド',     'wins_total',        50,  'rare'),
('velvet_apprentice',  'Apprenti Velours',  'Velvet Apprentice', 'Aprendiz Velvet',  'Samt-Lehrling',     'ベルベットの弟子', 'wins_total',     100, 'rare'),
('ace_detective',      'As Détective',      'Ace Detective',     'Detective As',     'Meisterdetektiv',   'エース探偵',   'streak_record',     7,   'epic'),
('true_wild_card',     'Vrai Wild Card',    'True Wild Card',    'Comodín Verdadero','Wahre Wildcard',    '真のワイルド', 'wins_total',        200, 'legendary'),
('music_master',       'Maître Musique',    'Music Master',      'Maestro Musical',  'Musikmeister',      '音楽の達人',   'mode_wins',         20,  'rare'),
('silhouette_pro',     'Pro Silhouette',    'Silhouette Pro',    'Pro Silueta',      'Silhouetten-Profi', 'シルエット職人', 'mode_wins',        15,  'rare'),
('confidant',          'Confident',         'True Confidant',    'Confidente',       'Vertrauter',        '本当の仲間',   'social_link_rank_10', 1, 'legendary'),
('perfectionist',      'Perfectionniste',   'Perfectionist',     'Perfeccionista',   'Perfektionist',     '完璧主義者',   'perfect_wins',      10,  'epic');


-- =============================================================================
-- 3. PROFILES — Données d'affichage du profil
-- =============================================================================
CREATE TABLE profiles (
    user_id             BIGINT          NOT NULL PRIMARY KEY
                                        REFERENCES users(id) ON DELETE CASCADE,

    -- Avatar: base64 (crop canvas) ou chemin fichier
    avatar_data         TEXT,

    -- Couleur de la bordure de l'avatar (hex #RRGGBB)
    avatar_border_color VARCHAR(7)      NOT NULL DEFAULT '#ffffff',

    -- Fond d'écran sélectionné (slug correspondant au nom de fichier dans /profile/Wallpaper/)
    wallpaper_id        VARCHAR(100),
    -- ex: 'P5_Phantom_Thieves_Wallpaper', 'P3_Tartarus_Wallpaper'

    -- Musique de profil (slug correspondant à un titre dans la BDD musiques)
    profile_music_id    VARCHAR(100),
    -- ex: 'last_surprise', 'burn_my_dread', 'life_will_change'

    -- Badges affichés sur le profil (max 4) — stocké en JSON
    selected_badges     JSON,
    -- ex: ["ace_detective", "phantom_coder", "burn_my_dread", "twin_blade"]

    -- Titre équipé
    equipped_title_id   BIGINT          REFERENCES titles(id) ON DELETE SET NULL,

    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 4. USER_TITLES — Titres débloqués par utilisateur
-- =============================================================================
CREATE TABLE user_titles (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id    BIGINT      NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP   NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, title_id)
);

CREATE INDEX idx_user_titles_user ON user_titles(user_id);


-- =============================================================================
-- 5. USER_STATS — Statistiques par mode et par joueur
-- =============================================================================
CREATE TABLE user_stats (
    id                  BIGSERIAL   PRIMARY KEY,
    user_id             BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    mode                VARCHAR(30) NOT NULL,
    -- Valeurs: 'classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'

    wins                INT         NOT NULL DEFAULT 0,
    giveups             INT         NOT NULL DEFAULT 0,
    games               INT         NOT NULL DEFAULT 0,
    streak              INT         NOT NULL DEFAULT 0,
    streak_record       INT         NOT NULL DEFAULT 0,
    perfect_wins        INT         NOT NULL DEFAULT 0,   -- victoires en 1 essai
    total_time_ms       BIGINT      NOT NULL DEFAULT 0,

    last_played_at      TIMESTAMP,
    first_played_at     TIMESTAMP,

    UNIQUE(user_id, mode)
);

CREATE INDEX idx_user_stats_user ON user_stats(user_id);
CREATE INDEX idx_user_stats_mode ON user_stats(mode, wins DESC);


-- =============================================================================
-- 6. GAME_SESSIONS — Historique de chaque partie jouée
-- =============================================================================
CREATE TABLE game_sessions (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    mode            VARCHAR(30)     NOT NULL,
    played_date     DATE            NOT NULL,   -- date Paris (Europe/Paris)
    target_name     VARCHAR(200)    NOT NULL,   -- nom du personnage/musique du jour

    result          VARCHAR(10)     NOT NULL,
    -- Valeurs: 'win', 'giveup'

    attempts        INT             NOT NULL,
    time_ms         INT,                        -- durée de la partie en ms

    -- Filtres opus actifs pendant la partie (pour stats futures)
    active_filters  JSON,
    -- ex: ["P3", "P3R", "P5", "P5R"]

    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_sessions_user_mode ON game_sessions(user_id, mode);
CREATE INDEX idx_game_sessions_date      ON game_sessions(played_date);
CREATE INDEX idx_game_sessions_target    ON game_sessions(mode, played_date, target_name);
-- idx_game_sessions_target permet les stats globales post-partie efficacement


-- =============================================================================
-- 7. DAILY_TARGETS — Personnage/musique du jour par mode (généré côté serveur)
--    Permet: historique, stats globales, replay
-- =============================================================================
CREATE TABLE daily_targets (
    mode            VARCHAR(30)     NOT NULL,
    target_date     DATE            NOT NULL,
    target_name     VARCHAR(200)    NOT NULL,

    -- Snapshot complet de la cible (utile pour le replay et les stats historiques)
    target_data     JSON,

    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),

    PRIMARY KEY(mode, target_date)
);


-- =============================================================================
-- 8. BADGES_UNLOCKED — Badges débloqués par utilisateur
-- =============================================================================
CREATE TABLE badges_unlocked (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id    VARCHAR(100) NOT NULL,
    -- correspond aux IDs dans badgesData.js ex: 'ace_detective', 'burn_my_dread'
    unlocked_at TIMESTAMP   NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_badges_user ON badges_unlocked(user_id);


-- =============================================================================
-- 9. EVENT_CODES_REDEEMED — Codes événement déjà utilisés
-- =============================================================================
CREATE TABLE event_codes_redeemed (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        VARCHAR(50) NOT NULL,
    redeemed_at TIMESTAMP   NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, code)
);


-- =============================================================================
-- 10. FRIENDSHIPS — Demandes et relations d'amitié
-- =============================================================================
CREATE TABLE friendships (
    id              BIGSERIAL   PRIMARY KEY,
    requester_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status          VARCHAR(15) NOT NULL DEFAULT 'pending',
    -- Valeurs: 'pending', 'accepted', 'blocked'

    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    accepted_at     TIMESTAMP,

    UNIQUE(requester_id, addressee_id),
    CHECK(requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id, status);


-- =============================================================================
-- 11. SOCIAL_LINKS — Rang Social Link entre deux amis (symétrique)
--     Convention: user_a_id = MIN(id_a, id_b), user_b_id = MAX(id_a, id_b)
--     Garantit l'unicité sans doublon miroir
-- =============================================================================
CREATE TABLE social_links (
    id                  BIGSERIAL   PRIMARY KEY,

    user_a_id           BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id           BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- user_a_id < user_b_id TOUJOURS (voir CHECK ci-dessous)

    rank                INT         NOT NULL DEFAULT 1,
    xp                  INT         NOT NULL DEFAULT 0,

    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    last_interaction_at TIMESTAMP   NOT NULL DEFAULT NOW(),

    UNIQUE(user_a_id, user_b_id),
    CHECK(user_a_id < user_b_id),
    CHECK(rank >= 1 AND rank <= 10)
);

CREATE INDEX idx_social_links_a ON social_links(user_a_id);
CREATE INDEX idx_social_links_b ON social_links(user_b_id);


-- =============================================================================
-- 12. SOCIAL_LINK_RANKS — Seuils XP et noms des rangs
-- =============================================================================
CREATE TABLE social_link_ranks (
    rank            INT         PRIMARY KEY,

    -- Noms localisés du rang
    name_fr         VARCHAR(50),
    name_en         VARCHAR(50),
    name_es         VARCHAR(50),
    name_de         VARCHAR(50),
    name_jp         VARCHAR(50),

    -- XP cumulés nécessaires pour atteindre ce rang
    xp_required     INT         NOT NULL,

    -- Description de la récompense à ce rang
    reward_en       TEXT
);

-- Seed: les 10 rangs
INSERT INTO social_link_ranks (rank, name_fr, name_en, name_es, name_de, name_jp, xp_required, reward_en) VALUES
(1,  'Inconnu',           'Stranger',           'Desconocido',      'Unbekannter',       '見知らぬ人',   0,    'Friendship begins'),
(2,  'Connaissance',      'Acquaintance',        'Conocido',         'Bekannter',         '知り合い',     100,  'Can compare stats'),
(3,  'Compagnon',         'Companion',           'Compañero',        'Gefährte',          '仲間',         250,  'Can share daily scores'),
(4,  'Allié',             'Ally',                'Aliado',           'Verbündeter',       '味方',         450,  'Can send challenges'),
(5,  'Confident',         'Confidant',           'Confidente',       'Vertrauter',        '信頼できる人', 700,  'Shared streak counter unlocked'),
(6,  'Allié Fidèle',      'Trusted Ally',        'Aliado de Confianza','Treuer Verbündeter','信頼できる仲間',1000,'Profile visits give bonus XP'),
(7,  'Vrai Allié',        'True Ally',           'Verdadero Aliado', 'Wahrer Verbündeter','真の味方',    1350, 'Streak sharing gives double XP'),
(8,  'Lien',              'Bond',                'Vínculo',          'Verbindung',        '絆',           1750, 'Special profile frame unlocked'),
(9,  'Lien Indestructible','Unbreakable Bond',   'Vínculo Inquebrantable','Unzerbrechliche Verbindung','揺るぎない絆',2200,'Almost there…'),
(10, 'True Confidant',    'True Confidant',      'Verdadero Confidente','Wahrer Vertrauter','真の協力者',  2700, 'True Confidant badge generated with both avatars');


-- =============================================================================
-- 13. SOCIAL_LINK_INTERACTIONS — Log des actions qui génèrent de l'XP
-- =============================================================================
CREATE TABLE social_link_interactions (
    id              BIGSERIAL   PRIMARY KEY,
    social_link_id  BIGINT      NOT NULL REFERENCES social_links(id) ON DELETE CASCADE,
    initiator_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    action_type     VARCHAR(50) NOT NULL,
    -- Valeurs:
    --   'share_streak'    → partager sa streak (15 XP solo / 30 XP mutuel)
    --   'share_score'     → partager son score du jour (10 / 20)
    --   'visit_profile'   → visiter le profil de l'ami (5 / 10)
    --   'play_same_day'   → tous deux jouent le même jour (20, toujours mutuel)
    --   'compare_stats'   → comparer ses stats (10 / 20)
    --   'send_challenge'  → envoyer/relever un défi (15 / 35)

    xp_gained       INT         NOT NULL,
    is_mutual       BOOLEAN     NOT NULL DEFAULT FALSE,
    -- TRUE si l'action implique les deux joueurs → XP doublé

    created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sli_social_link ON social_link_interactions(social_link_id);
CREATE INDEX idx_sli_date        ON social_link_interactions(created_at);
CREATE INDEX idx_sli_initiator   ON social_link_interactions(initiator_id);


-- =============================================================================
-- 14. (removed: SOCIAL_LINK_BADGES — replaced by rank10-effect, see migration 012_remove_tcb)
-- =============================================================================

-- =============================================================================
-- 15. LEADERBOARD_CACHE — Cache des classements (recalculé périodiquement)
--     Évite de faire des COUNT/RANK lourds à chaque requête
-- =============================================================================
CREATE TABLE leaderboard_cache (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    mode            VARCHAR(30) NOT NULL,
    -- 'global' ou 'classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'

    period          VARCHAR(15) NOT NULL,
    -- 'all_time', 'monthly', 'weekly'

    period_start    DATE,
    -- NULL pour all_time, date du lundi pour weekly, 1er du mois pour monthly

    score           INT         NOT NULL,
    rank_position   INT,

    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, mode, period, period_start)
);

CREATE INDEX idx_leaderboard_ranking ON leaderboard_cache(mode, period, period_start, score DESC);


-- =============================================================================
-- 16. DELETION_REQUESTS — Log RGPD des demandes de suppression
-- =============================================================================
CREATE TABLE deletion_requests (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL,
    -- Pas de FK ici: l'utilisateur peut déjà être supprimé (log de traçabilité)

    requested_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMP,

    deletion_type   VARCHAR(20) NOT NULL DEFAULT 'full'
    -- 'full' = tout supprimer, 'data_only' = garder le compte anonymisé
);


-- =============================================================================
-- VUES UTILES
-- =============================================================================

-- Vue: liste des amis d'un utilisateur (dans les deux sens)
CREATE VIEW v_friends AS
SELECT
    f.id,
    f.requester_id  AS user_id,
    f.addressee_id  AS friend_id,
    f.status,
    f.accepted_at
FROM friendships f
WHERE f.status = 'accepted'

UNION ALL

SELECT
    f.id,
    f.addressee_id  AS user_id,
    f.requester_id  AS friend_id,
    f.status,
    f.accepted_at
FROM friendships f
WHERE f.status = 'accepted';


-- Vue: stats globales (tous modes confondus) par joueur
CREATE VIEW v_global_stats AS
SELECT
    user_id,
    SUM(wins)           AS total_wins,
    SUM(giveups)        AS total_giveups,
    SUM(games)          AS total_games,
    MAX(streak_record)  AS best_streak,
    SUM(perfect_wins)   AS total_perfect_wins,
    SUM(total_time_ms)  AS total_time_ms
FROM user_stats
GROUP BY user_id;


-- Vue: Social Link d'un utilisateur (dans les deux sens, avec rang et XP)
CREATE VIEW v_social_links AS
SELECT
    sl.id,
    sl.user_a_id    AS user_id,
    sl.user_b_id    AS friend_id,
    sl.rank,
    sl.xp,
    sl.created_at,
    sl.last_interaction_at
FROM social_links sl

UNION ALL

SELECT
    sl.id,
    sl.user_b_id    AS user_id,
    sl.user_a_id    AS friend_id,
    sl.rank,
    sl.xp,
    sl.created_at,
    sl.last_interaction_at
FROM social_links sl;


-- =============================================================================
-- FONCTIONS UTILITAIRES (PostgreSQL)
-- Pour MySQL, implémenter dans PHP/PDO
-- =============================================================================

-- Fonction: obtenir ou créer le social_link entre deux utilisateurs
-- Convention: user_a = MIN(id), user_b = MAX(id)
CREATE OR REPLACE FUNCTION get_or_create_social_link(id1 BIGINT, id2 BIGINT)
RETURNS BIGINT AS $$
DECLARE
    a_id BIGINT := LEAST(id1, id2);
    b_id BIGINT := GREATEST(id1, id2);
    link_id BIGINT;
BEGIN
    SELECT id INTO link_id FROM social_links WHERE user_a_id = a_id AND user_b_id = b_id;

    IF NOT FOUND THEN
        INSERT INTO social_links(user_a_id, user_b_id) VALUES (a_id, b_id)
        RETURNING id INTO link_id;
    END IF;

    RETURN link_id;
END;
$$ LANGUAGE plpgsql;


-- Fonction: ajouter de l'XP à un Social Link et mettre à jour le rang si nécessaire
CREATE OR REPLACE FUNCTION add_social_link_xp(link_id BIGINT, xp_amount INT)
RETURNS TABLE(new_xp INT, new_rank INT, ranked_up BOOLEAN) AS $$
DECLARE
    current_xp  INT;
    current_rank INT;
    updated_xp  INT;
    updated_rank INT;
    did_rank_up BOOLEAN := FALSE;
BEGIN
    SELECT xp, rank INTO current_xp, current_rank
    FROM social_links WHERE id = link_id;

    updated_xp := current_xp + xp_amount;

    -- Calculer le nouveau rang depuis les seuils
    SELECT MAX(r.rank) INTO updated_rank
    FROM social_link_ranks r
    WHERE r.xp_required <= updated_xp;

    updated_rank := COALESCE(updated_rank, 1);

    IF updated_rank > current_rank THEN
        did_rank_up := TRUE;
    END IF;

    UPDATE social_links
    SET xp = updated_xp,
        rank = updated_rank,
        last_interaction_at = NOW()
    WHERE id = link_id;

    RETURN QUERY SELECT updated_xp, updated_rank, did_rank_up;
END;
$$ LANGUAGE plpgsql;
