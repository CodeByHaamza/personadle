-- =============================================================================
-- PersonaDLE — Données de test (seed)
-- =============================================================================
-- Génère 14 joueurs fictifs avec des stats, sessions et amitiés variées.
-- À exécuter APRÈS bdd_mysql.sql (schéma) sur la base personadle_db.
--
-- Usage :
--   mysql -h 127.0.0.1 -u personadle_usr -p'Pers0naDLE_dev!' personadle_db < sql/seed_test_data.sql
--
-- Notes :
--   - Les password_hash sont des bcrypt de "testpassword123"
--   - Les avatars proviennent de img/avatar/ (sélection profil)
--   - Les sessions couvrent les 31 derniers jours (today = CURDATE() - n)
--   - "Hamza" (user_id=1) est le compte de dev — peut être désactivé en prod
--   - IDs 1-4  : équipe Persona DLE (Hamza, L2GENDAIRE, Corbover, Dzulian)
--   - IDs 5-6  : joueurs fictifs supplémentaires (AkiraWild, RyujiXBro)
--   - IDs 7-9  : personnages P5 (FutabaSakura, GoroAkechi, NaotoShiro)
--   - IDs 10-12: personnages P5/P3 (KitagawaArt, MorganaCat, VelvetMaster)
--   - IDs 13-14: personnages P3 (MakotoYuki, KotoneShiomi)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Nettoyage des données de test (ne touche PAS au schéma ni aux titles)
DELETE FROM social_link_interactions;
DELETE FROM social_links;
DELETE FROM friendships;
DELETE FROM badges_unlocked;
DELETE FROM game_sessions;
DELETE FROM user_stats;
DELETE FROM profiles;
DELETE FROM users WHERE id BETWEEN 1 AND 14;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- 1. UTILISATEURS
-- =============================================================================
-- password = "testpassword123" bcrypt ($2y$12$...)
INSERT INTO users (id, email, pseudo, password_hash, friend_code, lang, created_at) VALUES
(1,  'hamza@personadle.net',    'Hamza',        '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'HAMZA001', 'fr', NOW() - INTERVAL 180 DAY),
(2,  'leo@personadle.net',      'L2GENDAIRE',   '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'LEO00002', 'fr', NOW() - INTERVAL 160 DAY),
(3,  'damien@personadle.net',   'Corbover',     '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'CORB0003', 'fr', NOW() - INTERVAL 120 DAY),
(4,  'dzulian@personadle.net',  'Dzulian',      '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'DZUL0004', 'fr', NOW() - INTERVAL 90  DAY),
(5,  'akira@personadle.net',    'AkiraWild',    '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'AKIR0005', 'en', NOW() - INTERVAL 75  DAY),
(6,  'ryuji@personadle.net',    'RyujiXBro',   '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'RYUJ0006', 'en', NOW() - INTERVAL 60  DAY),
(7,  'futaba@personadle.net',   'FutabaSakura', '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'FUTA0007', 'fr', NOW() - INTERVAL 45  DAY),
(8,  'akechi@personadle.net',   'GoroAkechi',   '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'CROW0008', 'fr', NOW() - INTERVAL 30  DAY),
(9,  'naoto@personadle.net',    'NaotoShiro',   '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'NDET0009', 'en', NOW() - INTERVAL 20  DAY),
(10, 'yusuke@personadle.net',   'KitagawaArt',  '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'YUSK0010', 'en', NOW() - INTERVAL 10  DAY),
(11, 'morgana@personadle.net',  'MorganaCat',   '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'MORG0011', 'fr', NOW() - INTERVAL 5   DAY),
(12, 'igor@personadle.net',     'VelvetMaster', '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'IGOR0012', 'en', NOW() - INTERVAL 3   DAY),
(13, 'makoto.yuki@personadle.net', 'MakotoYuki',   '$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'HERO0013', 'en', NOW() - INTERVAL 55  DAY),
(14, 'kotone.shiomi@personadle.net','KotoneShiomi','$2y$12$K8LHGnCwMqRTkb7L2v0jUuJkS1MlVQlB5DxVxGDkL.6B0m0CTPRdq', 'WILD0014', 'fr', NOW() - INTERVAL 40  DAY);


-- =============================================================================
-- 2. PROFILS
-- =============================================================================
INSERT INTO profiles (user_id, avatar_data, avatar_border_color, wallpaper_id, profile_music_id, equipped_title_id, selected_badges) VALUES
-- Hamza (lead dev) : Joker rouge, wallpaper All-Out Attack
(1,  '../img/avatar/Joker.jpg',          '#e63946', 'all_out',           'Last_Surprise.mp3',                      2, '["first_win","streak_7","classic_10","streak_3"]'),
-- L2GENDAIRE : Yu Narukami bleu marine, Velvet Room
(2,  '../img/avatar/Yu.jpg',             '#1B3A8A', 'velvet_room',       'Rivers_In_the_Desert.mp3',               1, '["first_win","classic_10","streak_3","streak_7"]'),
-- Corbover (front-end) : Ryuji bleu canard, Dark Hour
(3,  '../img/avatar/Ryuji.png',          '#1E5F74', 'dark_hour',         NULL,                                     2, NULL),
-- Dzulian (classic trilogy) : Tatsuya doré, Midnight Channel
(4,  '../img/avatar/Tatsuya.jpg',        '#EAB308', 'midnight_channel',  NULL,                                     1, NULL),
-- AkiraWild : Ren rouge, All-Out Attack
(5,  '../img/avatar/Ren.gif',            '#e63946', 'all_out',           'Last_Surprise.mp3',                      3, '["first_win","streak_7","classic_10","streak_3"]'),
-- RyujiXBro : Ryuji rouge
(6,  '../img/avatar/Ryuji.jpg',          '#e63946', NULL,                NULL,                                     1, NULL),
-- FutabaSakura : avatar profil Futaba, vert oracle, "The Days When My Mother Was There"
(7,  '../img/avatar/Futaba.webp',        '#22C55E', 'dark_hour',         'The_Days_When_My_Mother_Was_There.mp3',  NULL, '["first_win","streak_7","classic_50","github_contributor"]'),
-- GoroAkechi : avatar profil Akechi, beige Crow, "No More What Ifs", Ace Detective
(8,  '../img/avatar/Akechi.jpg',         '#D4B896', NULL,                'No_More_What_Ifs.mp3',                   5, '["first_win","streak_7","ace_detective","truth_duality"]'),
-- NaotoShirogane : avatar profil Naoto, bleu marine, "Secret Base", Ace Detective
(9,  '../img/avatar/Naoto.jpg',          '#1E3A5F', NULL,                'Secret_Base.mp3',                        5, '["ace_detective","streak_7","first_win","streak_3"]'),
-- KitagawaArt : Yusuke bleu marine, Velvet Room
(10, '../img/avatar/Yusuke.jpg',         '#1B3A8A', 'velvet_room',       NULL,                                     1, NULL),
-- MorganaCat : Morgana gris sombre
(11, '../img/avatar/Morgana.jpg',        '#555555', NULL,                NULL,                                     1, NULL),
-- VelvetMaster : Elisabeth Velvet Room, "Aria of the Soul"
(12, '../img/avatar/Elisabeth.jpeg',     '#1B3A8A', 'velvet_room',       'Aria_Of_The_Soul.mp3',                   4, NULL),
-- MakotoYuki (P3 hero) : avatar profil Yuki, cyan, "Mass Destruction"
(13, '../img/avatar/Yuki.jpeg',          '#00BCD4', 'dark_hour',         'Mass_Destruction.mp3',                   2, '["first_win","streak_7","classic_10","streak_3"]'),
-- KotoneShiomi (P3P heroine) : avatar profil Kotone, rose, "Wiping All Out"
(14, '../img/avatar/kotone_pdp.jpg',     '#EC4899', NULL,                'Wiping_All_Out.mp3',                     3, '["first_win","streak_7","music_10","perfect_5"]');


-- =============================================================================
-- 3. STATS PAR JOUEUR / PAR MODE
--    user_stats = table agrégée (mise à jour à chaque session)
--    Modes : classic, emoji, silhouette, alloutattack, personae, music
-- =============================================================================

-- Hamza — joueur dominant
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(1, 'classic',      85, 5,  90,  12, 15, 20, 2700000),
(1, 'emoji',        60, 8,  68,  8,  10, 12, 2040000),
(1, 'silhouette',   45, 10, 55,  5,  8,  8,  1650000),
(1, 'alloutattack', 30, 3,  33,  6,  7,  5,  990000),
(1, 'personae',     25, 5,  30,  4,  6,  4,  900000),
(1, 'music',        40, 4,  44,  7,  9,  10, 1320000);

-- L2GENDAIRE
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(2, 'classic',      70, 8,  78,  9,  12, 15, 2340000),
(2, 'emoji',        40, 12, 52,  5,  7,  8,  1560000),
(2, 'silhouette',   55, 6,  61,  11, 14, 12, 1830000),
(2, 'alloutattack', 20, 5,  25,  3,  5,  3,  750000),
(2, 'personae',     35, 4,  39,  7,  9,  6,  1170000),
(2, 'music',        30, 6,  36,  4,  6,  5,  1080000);

-- Corbover
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(3, 'classic',      50, 10, 60,  6,  8,  10, 1800000),
(3, 'emoji',        35, 5,  40,  7,  9,  7,  1200000),
(3, 'silhouette',   25, 8,  33,  4,  6,  4,  990000),
(3, 'alloutattack', 15, 4,  19,  3,  4,  2,  570000),
(3, 'personae',     20, 6,  26,  5,  7,  3,  780000),
(3, 'music',        45, 3,  48,  10, 12, 11, 1440000);

-- Dzulian
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(4, 'classic',      90, 3,  93,  14, 18, 22, 2790000),
(4, 'emoji',        55, 7,  62,  10, 13, 14, 1860000),
(4, 'silhouette',   40, 8,  48,  6,  8,  7,  1440000),
(4, 'alloutattack', 25, 4,  29,  5,  7,  4,  870000),
(4, 'personae',     60, 2,  62,  15, 20, 18, 1860000),
(4, 'music',        35, 5,  40,  7,  10, 8,  1200000);

-- AkiraWild
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(5, 'classic',      120, 2,  122, 20, 25, 35, 3660000),
(5, 'emoji',        80,  5,  85,  15, 18, 22, 2550000),
(5, 'silhouette',   65,  7,  72,  12, 16, 14, 2160000),
(5, 'alloutattack', 45,  3,  48,  8,  11, 9,  1440000),
(5, 'personae',     55,  4,  59,  10, 14, 12, 1770000),
(5, 'music',        70,  3,  73,  14, 17, 18, 2190000);

-- RyujiXBro
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(6, 'classic',      30, 15, 45, 4,  6,  5,  1350000),
(6, 'emoji',        20, 10, 30, 3,  5,  3,  900000),
(6, 'silhouette',   15, 8,  23, 2,  4,  2,  690000),
(6, 'alloutattack', 10, 5,  15, 1,  3,  1,  450000),
(6, 'personae',     12, 7,  19, 2,  3,  1,  570000),
(6, 'music',        25, 6,  31, 4,  5,  4,  930000);

-- FutabaSakura — stats au max, meilleure joueuse après AkiraWild
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(7, 'classic',      180, 2,  182, 30, 40, 60, 5460000),
(7, 'emoji',        150, 1,  151, 28, 35, 50, 4530000),
(7, 'silhouette',   120, 3,  123, 22, 30, 40, 3690000),
(7, 'alloutattack', 100, 2,  102, 18, 25, 30, 3060000),
(7, 'personae',     130, 1,  131, 25, 32, 45, 3930000),
(7, 'music',        160, 1,  161, 29, 38, 55, 4830000);

-- GoroAkechi — excellent en classic et alloutattack, style "Crow"
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(8, 'classic',      95, 4,  99,  16, 20, 25, 2970000),
(8, 'emoji',        45, 8,  53,  7,  9,  9,  1590000),
(8, 'silhouette',   60, 5,  65,  12, 15, 15, 1950000),
(8, 'alloutattack', 80, 3,  83,  15, 19, 22, 2490000),
(8, 'personae',     70, 4,  74,  13, 17, 18, 2220000),
(8, 'music',        50, 5,  55,  9,  12, 12, 1650000);

-- NaotoShirogane — meilleure en personae, streaks élevés (détective)
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(9, 'classic',      85, 3,  88,  15, 18, 22, 2640000),
(9, 'emoji',        55, 5,  60,  10, 13, 14, 1800000),
(9, 'silhouette',   70, 3,  73,  14, 17, 20, 2190000),
(9, 'alloutattack', 40, 5,  45,  7,  10, 9,  1350000),
(9, 'personae',     110, 1, 111, 22, 28, 38, 3330000),
(9, 'music',        45, 4,  49,  8,  11, 10, 1470000);

-- KitagawaArt
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(10, 'classic',      10, 5, 15, 1, 2, 1, 450000),
(10, 'emoji',        6,  3, 9,  0, 2, 0, 270000),
(10, 'silhouette',   4,  3, 7,  0, 1, 0, 210000),
(10, 'alloutattack', 3,  2, 5,  0, 1, 0, 150000),
(10, 'personae',     5,  3, 8,  0, 1, 0, 240000),
(10, 'music',        8,  2, 10, 1, 2, 1, 300000);

-- MorganaCat (nouveaux joueurs)
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(11, 'classic',      3, 2, 5, 1, 1, 0, 150000),
(11, 'emoji',        2, 1, 3, 0, 1, 0, 90000);

-- VelvetMaster
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(12, 'classic',      1, 1, 2, 0, 1, 0, 60000);

-- MakotoYuki — solide sur tous les modes, P3 hero
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(13, 'classic',      75, 6,  81,  12, 16, 18, 2430000),
(13, 'emoji',        50, 8,  58,  9,  11, 11, 1740000),
(13, 'silhouette',   55, 5,  60,  11, 14, 14, 1800000),
(13, 'alloutattack', 35, 4,  39,  7,  9,  7,  1170000),
(13, 'personae',     45, 5,  50,  9,  12, 10, 1500000),
(13, 'music',        60, 4,  64,  12, 15, 15, 1920000);

-- KotoneMinako — excellente en musique et emoji, style "Wild Card féminin"
INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms) VALUES
(14, 'classic',      100, 5, 105, 18, 22, 28, 3150000),
(14, 'emoji',        90,  3, 93,  17, 21, 25, 2790000),
(14, 'silhouette',   70,  6, 76,  13, 17, 18, 2280000),
(14, 'alloutattack', 55,  4, 59,  10, 14, 14, 1770000),
(14, 'personae',     80,  3, 83,  15, 19, 22, 2490000),
(14, 'music',        110, 2, 112, 20, 25, 35, 3360000);


-- =============================================================================
-- 4. SESSIONS DE JEU (30 derniers jours)
--    Seulement quelques joueurs actifs sur la période récente
-- =============================================================================

-- AkiraWild — 25 sessions sur 30 jours (très actif)
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(5, 'classic',      CURDATE() - INTERVAL 0  DAY, 'Ryuji Sakamoto',     'win',    2, 120000),
(5, 'emoji',        CURDATE() - INTERVAL 0  DAY, 'Morgana',            'win',    1, 60000),
(5, 'classic',      CURDATE() - INTERVAL 1  DAY, 'Ann Takamaki',       'win',    3, 180000),
(5, 'music',        CURDATE() - INTERVAL 1  DAY, 'Last Surprise',      'win',    2, 90000),
(5, 'classic',      CURDATE() - INTERVAL 2  DAY, 'Yusuke Kitagawa',    'win',    2, 120000),
(5, 'classic',      CURDATE() - INTERVAL 3  DAY, 'Makoto Niijima',     'win',    1, 60000),
(5, 'emoji',        CURDATE() - INTERVAL 3  DAY, 'Futaba Sakura',      'win',    2, 90000),
(5, 'classic',      CURDATE() - INTERVAL 4  DAY, 'Haru Okumura',       'win',    3, 150000),
(5, 'classic',      CURDATE() - INTERVAL 5  DAY, 'Akechi Goro',        'win',    4, 210000),
(5, 'silhouette',   CURDATE() - INTERVAL 5  DAY, 'Ryuji Sakamoto',     'win',    2, 90000),
(5, 'classic',      CURDATE() - INTERVAL 6  DAY, 'Kasumi Yoshizawa',   'win',    2, 120000),
(5, 'classic',      CURDATE() - INTERVAL 7  DAY, 'Zenkichi Hasegawa',  'win',    3, 150000),
(5, 'music',        CURDATE() - INTERVAL 7  DAY, 'Rivers in the Desert','win',   1, 45000),
(5, 'classic',      CURDATE() - INTERVAL 8  DAY, 'Persona 5 Hero',     'win',    2, 90000),
(5, 'classic',      CURDATE() - INTERVAL 9  DAY, 'Koromaru',           'giveup', 7, 420000),
(5, 'classic',      CURDATE() - INTERVAL 10 DAY, 'Shinjiro Aragaki',   'win',    3, 180000),
(5, 'classic',      CURDATE() - INTERVAL 14 DAY, 'Minato Arisato',     'win',    2, 120000),
(5, 'classic',      CURDATE() - INTERVAL 15 DAY, 'Yu Narukami',        'win',    1, 60000),
(5, 'classic',      CURDATE() - INTERVAL 16 DAY, 'Chie Satonaka',      'win',    2, 120000),
(5, 'classic',      CURDATE() - INTERVAL 21 DAY, 'Naoto Shirogane',    'win',    3, 150000),
(5, 'classic',      CURDATE() - INTERVAL 28 DAY, 'Kanji Tatsumi',      'win',    2, 90000);

-- Hamza — sessions récentes (quelques jours)
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(1, 'classic',      CURDATE() - INTERVAL 0  DAY, 'Ryuji Sakamoto',     'win',    3, 180000),
(1, 'emoji',        CURDATE() - INTERVAL 0  DAY, 'Morgana',            'win',    2, 90000),
(1, 'classic',      CURDATE() - INTERVAL 1  DAY, 'Ann Takamaki',       'win',    4, 240000),
(1, 'music',        CURDATE() - INTERVAL 1  DAY, 'Last Surprise',      'win',    1, 45000),
(1, 'classic',      CURDATE() - INTERVAL 2  DAY, 'Yusuke Kitagawa',    'win',    2, 120000),
(1, 'classic',      CURDATE() - INTERVAL 3  DAY, 'Makoto Niijima',     'win',    2, 120000),
(1, 'classic',      CURDATE() - INTERVAL 7  DAY, 'Haru Okumura',       'win',    3, 180000),
(1, 'classic',      CURDATE() - INTERVAL 14 DAY, 'Akechi Goro',        'giveup', 7, 420000);

-- Dzulian — très bon sur classic et personae
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(4, 'classic',      CURDATE() - INTERVAL 0  DAY, 'Ryuji Sakamoto',     'win',    1, 45000),
(4, 'personae',     CURDATE() - INTERVAL 0  DAY, 'Izanagi',            'win',    1, 30000),
(4, 'classic',      CURDATE() - INTERVAL 1  DAY, 'Ann Takamaki',       'win',    2, 90000),
(4, 'classic',      CURDATE() - INTERVAL 2  DAY, 'Yusuke Kitagawa',    'win',    1, 60000),
(4, 'classic',      CURDATE() - INTERVAL 3  DAY, 'Makoto Niijima',     'win',    2, 90000),
(4, 'classic',      CURDATE() - INTERVAL 4  DAY, 'Futaba Sakura',      'win',    1, 45000),
(4, 'classic',      CURDATE() - INTERVAL 5  DAY, 'Haru Okumura',       'win',    3, 150000),
(4, 'classic',      CURDATE() - INTERVAL 6  DAY, 'Akechi Goro',        'win',    2, 90000),
(4, 'classic',      CURDATE() - INTERVAL 7  DAY, 'Kasumi Yoshizawa',   'win',    1, 60000);

-- FutabaSakura — sessions récentes (très active, souvent 1er essai)
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(7, 'classic',      CURDATE() - INTERVAL 0  DAY, 'Ryuji Sakamoto',     'win', 1, 45000),
(7, 'music',        CURDATE() - INTERVAL 0  DAY, 'The Days When My Mother Was There', 'win', 1, 30000),
(7, 'personae',     CURDATE() - INTERVAL 0  DAY, 'Necronomicon',       'win', 1, 25000),
(7, 'classic',      CURDATE() - INTERVAL 1  DAY, 'Ann Takamaki',       'win', 1, 40000),
(7, 'emoji',        CURDATE() - INTERVAL 1  DAY, 'Futaba Sakura',      'win', 1, 20000),
(7, 'classic',      CURDATE() - INTERVAL 2  DAY, 'Yusuke Kitagawa',    'win', 2, 90000),
(7, 'classic',      CURDATE() - INTERVAL 3  DAY, 'Makoto Niijima',     'win', 1, 45000),
(7, 'classic',      CURDATE() - INTERVAL 7  DAY, 'Minato Arisato',     'win', 1, 40000);

-- GoroAkechi — actif, bon en alloutattack et classic
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(8, 'classic',      CURDATE() - INTERVAL 0  DAY, 'Ryuji Sakamoto',     'win', 2, 90000),
(8, 'alloutattack', CURDATE() - INTERVAL 0  DAY, 'Akechi Goro',        'win', 1, 30000),
(8, 'classic',      CURDATE() - INTERVAL 1  DAY, 'Ann Takamaki',       'win', 2, 90000),
(8, 'classic',      CURDATE() - INTERVAL 2  DAY, 'Yusuke Kitagawa',    'win', 3, 150000),
(8, 'music',        CURDATE() - INTERVAL 2  DAY, 'No More What Ifs',   'win', 1, 35000),
(8, 'classic',      CURDATE() - INTERVAL 3  DAY, 'Makoto Niijima',     'win', 2, 90000),
(8, 'classic',      CURDATE() - INTERVAL 7  DAY, 'Kasumi Yoshizawa',   'win', 3, 150000);

-- NaotoShirogane — meilleure en personae, streaks élevés
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(9, 'classic',      CURDATE() - INTERVAL 0  DAY, 'Ryuji Sakamoto',     'win', 2, 90000),
(9, 'personae',     CURDATE() - INTERVAL 0  DAY, 'Sukuna-Hikona',      'win', 1, 25000),
(9, 'silhouette',   CURDATE() - INTERVAL 0  DAY, 'Naoto Shirogane',    'win', 1, 30000),
(9, 'classic',      CURDATE() - INTERVAL 1  DAY, 'Chie Satonaka',      'win', 2, 90000),
(9, 'personae',     CURDATE() - INTERVAL 1  DAY, 'Kanzeon',            'win', 1, 20000),
(9, 'classic',      CURDATE() - INTERVAL 2  DAY, 'Kanji Tatsumi',      'win', 3, 150000),
(9, 'music',        CURDATE() - INTERVAL 2  DAY, 'Secret Base',        'win', 1, 30000),
(9, 'classic',      CURDATE() - INTERVAL 7  DAY, 'Naoto Shirogane',    'win', 1, 45000);

-- MakotoYuki — sessions récentes
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(13, 'classic',    CURDATE() - INTERVAL 0 DAY, 'Ryuji Sakamoto',  'win', 2, 90000),
(13, 'silhouette', CURDATE() - INTERVAL 0 DAY, 'Makoto Niijima',  'win', 1, 35000),
(13, 'music',      CURDATE() - INTERVAL 0 DAY, 'Mass Destruction','win', 1, 25000),
(13, 'classic',    CURDATE() - INTERVAL 1 DAY, 'Ann Takamaki',    'win', 2, 90000),
(13, 'emoji',      CURDATE() - INTERVAL 1 DAY, 'Futaba Sakura',   'win', 2, 70000),
(13, 'classic',    CURDATE() - INTERVAL 2 DAY, 'Yusuke Kitagawa', 'win', 3, 150000),
(13, 'classic',    CURDATE() - INTERVAL 7 DAY, 'Minato Arisato',  'win', 2, 90000);

-- KotoneMinako — sessions récentes, dominante en musique
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(14, 'music',      CURDATE() - INTERVAL 0 DAY, 'Wiping All Out',  'win', 1, 20000),
(14, 'classic',    CURDATE() - INTERVAL 0 DAY, 'Ryuji Sakamoto',  'win', 1, 50000),
(14, 'emoji',      CURDATE() - INTERVAL 0 DAY, 'Kotone',          'win', 1, 18000),
(14, 'music',      CURDATE() - INTERVAL 1 DAY, 'Mass Destruction','win', 1, 22000),
(14, 'classic',    CURDATE() - INTERVAL 1 DAY, 'Ann Takamaki',    'win', 2, 80000),
(14, 'personae',   CURDATE() - INTERVAL 2 DAY, 'Orpheus',         'win', 1, 30000),
(14, 'classic',    CURDATE() - INTERVAL 3 DAY, 'Makoto Niijima',  'win', 1, 45000),
(14, 'classic',    CURDATE() - INTERVAL 7 DAY, 'Yu Narukami',     'win', 2, 90000);

-- Joueurs récents — quelques sessions
INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) VALUES
(9,  'classic', CURDATE() - INTERVAL 0 DAY, 'Ryuji Sakamoto', 'win',    4, 240000),
(10, 'classic', CURDATE() - INTERVAL 0 DAY, 'Ann Takamaki',   'giveup', 7, 420000),
(11, 'classic', CURDATE() - INTERVAL 0 DAY, 'Ryuji Sakamoto', 'win',    5, 300000),
(12, 'classic', CURDATE() - INTERVAL 0 DAY, 'Ann Takamaki',   'win',    3, 180000);


-- =============================================================================
-- 5. AMITIÉS (réseau de test)
-- =============================================================================
-- Status : 'accepted' | 'pending' | 'blocked'
-- requester_id envoie la demande à addressee_id

INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES
-- Équipe principale — tous amis entre eux
(1, 2, 'accepted', NOW() - INTERVAL 150 DAY),
(1, 3, 'accepted', NOW() - INTERVAL 100 DAY),
(1, 4, 'accepted', NOW() - INTERVAL 80  DAY),
(2, 3, 'accepted', NOW() - INTERVAL 90  DAY),
(2, 4, 'accepted', NOW() - INTERVAL 70  DAY),
(3, 4, 'accepted', NOW() - INTERVAL 60  DAY),

-- AkiraWild ami avec l'équipe
(5, 1, 'accepted', NOW() - INTERVAL 50  DAY),
(5, 2, 'accepted', NOW() - INTERVAL 45  DAY),
(5, 4, 'accepted', NOW() - INTERVAL 40  DAY),

-- FutabaSakura — amie avec l'équipe et AkiraWild
(7, 1, 'accepted', NOW() - INTERVAL 35  DAY),
(7, 5, 'accepted', NOW() - INTERVAL 30  DAY),
(7, 8, 'accepted', NOW() - INTERVAL 25  DAY),  -- Futaba ↔ Akechi
(7, 9, 'accepted', NOW() - INTERVAL 20  DAY),  -- Futaba ↔ Naoto

-- Demandes en attente (non encore acceptées)
(6,  1, 'pending', NOW() - INTERVAL 5  DAY),  -- RyujiXBro → Hamza
(8,  1, 'pending', NOW() - INTERVAL 3  DAY),  -- GoroAkechi → Hamza
(9,  5, 'pending', NOW() - INTERVAL 2  DAY),  -- NaotoShiro → AkiraWild
(10, 7, 'pending', NOW() - INTERVAL 1  DAY),  -- KitagawaArt → FutabaSakura

-- Relation Hamza ↔ AkiraWild (déjà acceptée ci-dessus via (5,1))
-- Hamza envoie à quelqu'un de nouveau
(1, 11, 'accepted', NOW() - INTERVAL 2  DAY),  -- Hamza → MorganaCat
-- MakotoNiijima — amie avec l'équipe et Futaba
(13, 1, 'accepted', NOW() - INTERVAL 50 DAY),  -- Makoto ↔ Hamza
(13, 7, 'accepted', NOW() - INTERVAL 40 DAY),  -- Makoto ↔ Futaba
(13,14, 'accepted', NOW() - INTERVAL 35 DAY),  -- Makoto ↔ Kotone
-- KotoneMinako — amie avec AkiraWild et Hamza
(14, 1, 'accepted', NOW() - INTERVAL 38 DAY),  -- Kotone ↔ Hamza
(14, 5, 'accepted', NOW() - INTERVAL 32 DAY);  -- Kotone ↔ AkiraWild


-- =============================================================================
-- 6. BADGES DÉBLOQUÉS
-- =============================================================================
-- Les badge_id correspondent aux IDs de la table badges (définis côté frontend)
-- Quelques exemples illustratifs

INSERT INTO badges_unlocked (user_id, badge_id, unlocked_at) VALUES
-- Hamza
(1, 'first_win',         NOW() - INTERVAL 175 DAY),
(1, 'streak_3',          NOW() - INTERVAL 150 DAY),
(1, 'streak_7',          NOW() - INTERVAL 120 DAY),
(1, 'classic_10',        NOW() - INTERVAL 100 DAY),

-- L2GENDAIRE
(2, 'first_win',         NOW() - INTERVAL 155 DAY),
(2, 'streak_3',          NOW() - INTERVAL 130 DAY),
(2, 'classic_10',        NOW() - INTERVAL 110 DAY),

-- AkiraWild (le meilleur)
(5, 'first_win',         NOW() - INTERVAL 70 DAY),
(5, 'streak_3',          NOW() - INTERVAL 60 DAY),
(5, 'streak_7',          NOW() - INTERVAL 50 DAY),
(5, 'classic_10',        NOW() - INTERVAL 40 DAY),
(5, 'classic_50',        NOW() - INTERVAL 20 DAY),
(5, 'perfect_5',         NOW() - INTERVAL 10 DAY),

-- Dzulian
(4, 'first_win',         NOW() - INTERVAL 85 DAY),
(4, 'streak_7',          NOW() - INTERVAL 50 DAY),
(4, 'personae_10',       NOW() - INTERVAL 30 DAY),

-- FutabaSakura — True Hacker + Phantom Coder (github)
(7, 'first_win',         NOW() - INTERVAL 44 DAY),
(7, 'streak_3',          NOW() - INTERVAL 40 DAY),
(7, 'streak_7',          NOW() - INTERVAL 35 DAY),
(7, 'classic_10',        NOW() - INTERVAL 30 DAY),
(7, 'classic_50',        NOW() - INTERVAL 15 DAY),
(7, 'music_10',          NOW() - INTERVAL 10 DAY),
(7, 'true_hacker',       NOW() - INTERVAL 5  DAY),
(7, 'github_contributor',NOW() - INTERVAL 3  DAY);

-- GoroAkechi — Ace Detective + Truth & Duality
INSERT INTO badges_unlocked (user_id, badge_id, unlocked_at) VALUES
(8, 'first_win',         NOW() - INTERVAL 29 DAY),
(8, 'streak_3',          NOW() - INTERVAL 20 DAY),
(8, 'streak_7',          NOW() - INTERVAL 10 DAY),
(8, 'ace_detective',     NOW() - INTERVAL 5  DAY),
(8, 'truth_duality',     NOW() - INTERVAL 2  DAY);

-- NaotoShirogane — Ace Detective (détective)
INSERT INTO badges_unlocked (user_id, badge_id, unlocked_at) VALUES
(9, 'first_win',         NOW() - INTERVAL 19 DAY),
(9, 'streak_3',          NOW() - INTERVAL 12 DAY),
(9, 'streak_7',          NOW() - INTERVAL 6  DAY),
(9, 'ace_detective',     NOW() - INTERVAL 2  DAY);

-- MakotoYuki — Phantom Thief + streak badges
INSERT INTO badges_unlocked (user_id, badge_id, unlocked_at) VALUES
(13, 'first_win',        NOW() - INTERVAL 54 DAY),
(13, 'streak_3',         NOW() - INTERVAL 45 DAY),
(13, 'streak_7',         NOW() - INTERVAL 30 DAY),
(13, 'classic_10',       NOW() - INTERVAL 20 DAY);

-- KotoneShiomi — Wild Card, music master
INSERT INTO badges_unlocked (user_id, badge_id, unlocked_at) VALUES
(14, 'first_win',        NOW() - INTERVAL 39 DAY),
(14, 'streak_3',         NOW() - INTERVAL 30 DAY),
(14, 'streak_7',         NOW() - INTERVAL 20 DAY),
(14, 'classic_10',       NOW() - INTERVAL 12 DAY),
(14, 'music_10',         NOW() - INTERVAL 5  DAY),
(14, 'perfect_5',        NOW() - INTERVAL 2  DAY);


-- =============================================================================
-- VÉRIFICATION RAPIDE
-- =============================================================================
SELECT 'users'        AS tbl, COUNT(*) AS n FROM users        WHERE id BETWEEN 1 AND 14
UNION ALL
SELECT 'profiles',    COUNT(*) FROM profiles      WHERE user_id BETWEEN 1 AND 14
UNION ALL
SELECT 'user_stats',  COUNT(*) FROM user_stats    WHERE user_id BETWEEN 1 AND 14
UNION ALL
SELECT 'sessions',    COUNT(*) FROM game_sessions WHERE user_id BETWEEN 1 AND 14
UNION ALL
SELECT 'friendships', COUNT(*) FROM friendships   WHERE requester_id BETWEEN 1 AND 14 OR addressee_id BETWEEN 1 AND 14
UNION ALL
SELECT 'badges',      COUNT(*) FROM badges_unlocked WHERE user_id BETWEEN 1 AND 14;
