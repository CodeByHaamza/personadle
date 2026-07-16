-- ============================================================
-- PERSONADLE — Migrations consolidées 000→022
-- MariaDB 10.6+ (Hostinger) — idempotent (safe to re-run)
-- ============================================================
-- Lancer via SSH :
--   mysql -u u870779941_Hamza -p u870779941_personadle < sql/migration_hostinger_full.sql
-- ============================================================

-- ── m000 : Social foundation ──────────────────────────────────
ALTER TABLE profiles    ADD COLUMN IF NOT EXISTS settings  JSON      NULL AFTER equipped_title_id;
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS seen_at   TIMESTAMP NULL AFTER updated_at;

CREATE TABLE IF NOT EXISTS messages (
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

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id);

-- ── m001 : messages.challenge_filters ────────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS challenge_filters TEXT NULL AFTER challenge_date;

-- ── m002 : users.has_migrated ─────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_migrated TINYINT(1) NOT NULL DEFAULT 0 AFTER remember_me_expires;

-- ── m003 : index composite messages(sender, type, status) ────
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_id, type, status, created_at DESC);

-- ── m004 : leaderboard_cache.metric + clé unique mise à jour ─
ALTER TABLE leaderboard_cache ADD COLUMN IF NOT EXISTS metric VARCHAR(20) NOT NULL DEFAULT 'wins' AFTER period;
ALTER TABLE leaderboard_cache DROP   INDEX IF EXISTS uq_leaderboard;
ALTER TABLE leaderboard_cache ADD    UNIQUE KEY uq_leaderboard (user_id, mode, period, metric, period_start);

-- ── m005 : titles.image_path + titres calling cards ──────────
ALTER TABLE titles ADD COLUMN IF NOT EXISTS image_path VARCHAR(150) NULL AFTER rarity;

INSERT IGNORE INTO titles (slug, name_en, name_fr, name_es, name_de, name_it, condition_type, condition_value, rarity, image_path) VALUES
('thou_art_i',         'Thou Art I',             'Tu es Moi',                   'Tú Eres Yo',               'Du bist Ich',              'Tu Sei Io',              'wins_total',    200, 'epic',      'profile/titles/velvet_room_thou_art_i.webp'),
('looking_cool',       'Looking Cool, Joker',    'Tu assures, Joker',           'Qué estilo, Joker',        'Cool, Joker',              'Sei in gamba, Joker',    'wins_mode',     30,  'rare',      'profile/titles/joker_looking_cool.webp'),
('memento_mori',       'Memento Mori',           'Memento Mori',                'Memento Mori',             'Memento Mori',             'Memento Mori',           'streak_record', 14,  'epic',      'profile/titles/makoto_yuki_memento_mori.webp'),
('i_am_not_afraid',    'I Am Not Afraid',        "Je n'ai pas peur",            'No tengo miedo',           'Ich habe keine Angst',     'Non ho paura',           'wins_total',    100, 'rare',      'profile/titles/aigis_i_am_not_afraid.webp'),
('pancakes',           'Pancakes',               'Pancakes',                    'Pancakes',                 'Pancakes',                 'Pancakes',               'wins_mode',     20,  'common',    'profile/titles/akechi_pancakes.webp'),
('ride_the_wind',      'Ride the Wind',          'Chevauche le vent',           'Cabalga el viento',        'Reite den Wind',           'Cavalca il vento',       'streak_record', 7,   'common',    'profile/titles/yosuke_ride_the_wind.webp'),
('boring_isnt_it',     "Boring, Isn't It?",      "C'est ennuyeux, non ?",       '¿Aburrido, no?',           'Langweilig, oder?',        'Noioso, vero?',          'giveups_total', 10,  'rare',      'profile/titles/adachi_boring_isnt_it.webp'),
('i_remembered',       'I Remembered',           'Je me suis souvenu',          'Lo recordé',               'Ich erinnerte mich',       'Mi sono ricordato',      'wins_total',    50,  'rare',      'profile/titles/marie_i_remembered.webp'),
('reach_out',          'Reach Out to the Truth', 'Tends la main vers la vérité','Alcanza la verdad',        'Greif nach der Wahrheit',  'Raggiungi la verità',    'streak_record', 10,  'epic',      'profile/titles/yu_reach_out_to_the_truth.webp'),
('first_awakening',    'First Awakening',        'Premier Éveil',               'Primer Despertar',         'Erste Erweckung',          'Primo Risveglio',        'wins_total',    1,   'common',    'profile/titles/naoya_first_awakening.webp'),
('always_be_positive', 'Always Be Positive!',    'Reste toujours positif !',    '¡Siempre sé positivo!',   'Immer positiv bleiben!',   'Sii sempre positivo!',   'wins_total',    300, 'legendary', 'profile/titles/maya_always_be_positive.webp');

-- ── m006 : fix title slugs (character-prefixed format) ────────
UPDATE titles SET slug = 'velvet_room_thou_art_i'   WHERE id = 11;
UPDATE titles SET slug = 'joker_looking_cool'        WHERE id = 12;
UPDATE titles SET slug = 'makoto_yuki_memento_mori'  WHERE id = 13;
UPDATE titles SET slug = 'aigis_i_am_not_afraid'     WHERE id = 14;
UPDATE titles SET slug = 'akechi_pancakes'            WHERE id = 15;
UPDATE titles SET slug = 'yosuke_ride_the_wind'      WHERE id = 16;
UPDATE titles SET slug = 'adachi_boring_isnt_it'     WHERE id = 17;
UPDATE titles SET slug = 'marie_i_remembered'        WHERE id = 18;
UPDATE titles SET slug = 'yu_reach_out_to_the_truth' WHERE id = 19;
UPDATE titles SET slug = 'naoya_first_awakening'     WHERE id = 20;
UPDATE titles SET slug = 'maya_always_be_positive'   WHERE id = 21;

-- ── m007 : table badges + wallpapers.name / image_path ───────
CREATE TABLE IF NOT EXISTS badges (
    slug         VARCHAR(100) NOT NULL PRIMARY KEY,
    name_en      VARCHAR(200) NOT NULL,
    name_fr      VARCHAR(200) NOT NULL DEFAULT '',
    name_es      VARCHAR(200) NOT NULL DEFAULT '',
    name_de      VARCHAR(200) NOT NULL DEFAULT '',
    name_it      VARCHAR(200) NOT NULL DEFAULT '',
    category     ENUM('achievement','streak','event','secret','social') NOT NULL DEFAULT 'achievement',
    rarity       ENUM('common','rare','epic','legendary')               NOT NULL DEFAULT 'common',
    image_path   VARCHAR(255) NOT NULL DEFAULT '',
    condition_en VARCHAR(500) NOT NULL DEFAULT '',
    is_secret    TINYINT(1)   NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO badges (slug, name_en, category, rarity, image_path, condition_en, is_secret) VALUES
('ace_detective',        'Ace Detective',                'achievement', 'rare',      'profile/badges/images/Badges_Ace_Detective.png',         'Win 10 games', 0),
('ace_defective',        'Ace Defective',                'achievement', 'common',    'profile/badges/images/Badges_Ace_Defective.png',         'Give up 10 times', 0),
('shadow_slayer',        'Shadow Slayer',                'achievement', 'common',    'profile/badges/images/Badges_Shadow_Slayer.png',         'Win 5 games in Silhouette mode', 0),
('music_master',         'Music Master',                 'achievement', 'rare',      'profile/badges/images/Badges_Music.png',                 'Win 20 games in Music mode', 0),
('burn_my_dread',        'Memento Mori',                 'achievement', 'rare',      'profile/badges/images/Badges_Burn_My_Dread_Silver.png',  "Find 'Burn My Dread' in Music mode", 0),
('into_the_fog',         'Unsolved Case',                'achievement', 'common',    'profile/badges/images/Badges_something_wrong.png',       'Turn your back on the truth in the final investigation', 0),
('velvet_headache',      'Velvet Headache',              'achievement', 'rare',      'profile/badges/images/Badges_velvet_headache.png',       'Find Wonder (Velvet) and Caroline & Justine in All-Out Attack', 0),
('first_win',            'First Victory',                'achievement', 'common',    'profile/badges/images/Badges_Fisrt_Win.png',             'Win your first game', 0),
('p1_p2_fan',            'Echoes of the Past',           'achievement', 'rare',      'profile/badges/images/Badges_P1_P2_Fan.png',             'Win 15 games in Classic mode', 0),
('velvet_master',        'Velvet Master',                'achievement', 'rare',      'profile/badges/images/Badges_Velvet_master.png',         'Win 10 games in Personae mode', 0),
('chinese_new_year',     'Chinese New Year Achievement', 'achievement', 'common',    'profile/badges/images/Chinesse_new_year.png',            'Find Wonder and Rin (CNY) in All-Out Attack', 0),
('twin_blade',           'Twin Blade',                   'achievement', 'common',    'profile/badges/images/Badge_Twin_Blade.png',             'Find a Personae of Yosuke and Yusuke', 0),
('persona_q_explorer',   'Cinema Explorer',              'achievement', 'rare',      'profile/badges/images/Badges_Persona_Q.webp',            'Find all 4 Persona Q exclusive characters in Silhouette mode', 0),
('crimson_legacy',       'Crimson Legacy',               'achievement', 'epic',      'profile/badges/images/Badge_Picaro.png',                 'Find all 12 Picaro Personas', 1),
('hippocampus_reload',   'Hippocampus Reload',           'achievement', 'rare',      'profile/badges/images/Badges_Zotomayo.webp',             'Find the ZUTOMAYO x P3R Mashup in Music mode', 0),
('truth_duality',        'Truth & Duality',              'achievement', 'rare',      'profile/badges/images/Badges_Truth_Duality.png',         'Find both Crow and Black Mask in All-Out Attack mode', 0),
('one_shot',             'Critical Strike',              'achievement', 'rare',      'profile/badges/images/Badge_One_Shot.webp',              'Guess correctly on the very first try', 0),
('aoa_vision',           'Piercing the Fog',             'achievement', 'rare',      'profile/badges/images/Badge_Midnight_Vision.webp',       'Guess the All-Out Attack on the very first try', 0),
('emoji_decoder',        'Emoji Decoder',                'achievement', 'common',    'profile/badges/images/Badge_Emoji_Decoder.webp',         'Win 10 games in Emoji mode', 0),
('navigator',            'Eye of the Navigator',         'achievement', 'rare',      'profile/badges/images/Badge_Navigator.webp',             'Use the hint 50 times in Classic mode', 0),
('velvet_regular',       'Velvet Regular',               'achievement', 'epic',      'profile/badges/images/Badge_Velvet_Regular.webp',        'Play on 50 unique days', 0),
('strega',               'Apostles of the Fall',         'achievement', 'rare',      'profile/badges/images/Badge_Strega.webp',                'Find Hypnos (Takaya), Moros (Jin) and Medea (Chidori) in Personae mode', 0),
('twin_fist',            'Twin Fist',                    'achievement', 'rare',      'profile/badges/images/Badge_Twin_Fist.webp',             "Find Makoto Nijima's and Akihiko's personas + their All-Out Attacks", 0),
('twin_spear',           'Twin Spear',                   'achievement', 'rare',      'profile/badges/images/Badge_Twin_Spear.webp',            "Find Kotone's and Ken's personas + their All-Out Attacks", 0),
('tradition_modernite',  'Chronological Convergence',    'achievement', 'epic',      'profile/badges/images/Badge_Tradition_Modernite.webp',   "Find Naoto's & Futaba's personas + Secret Base & When Mother Was There", 0),
('shapeshifter',         'The Formless Soul',            'achievement', 'epic',      'profile/badges/images/Badge_Shapshifter.webp',           'Guess the same character in 3 different modes (cumulative)', 0),
('ideal_reality',        'Gentle Illusion',              'achievement', 'common',    'profile/badges/images/Badge_Ideal_Reality.webp',         "Give up when the target is 'Our Light' in Music mode", 0),
('for_real',             'For Real',                     'achievement', 'rare',      'profile/badges/images/Badges_for_real.png',              "Find Ryuji's All-Out Attack in AOA mode and his persona in Personae mode", 0),
('night_owl',            'Phantom of the Night',         'achievement', 'common',    'profile/badges/images/Badge_Night_Owl.webp',             'Play between midnight and 5 AM (Paris time)', 0),
('nyx_hour',             'Nyx Hour',                     'achievement', 'rare',      'profile/badges/images/Badge_Nyx_Hour.webp',              'Play between midnight and 12:30 AM (Paris time)', 0),
('stylist',              'Breathtaking Aesthetics',      'achievement', 'epic',      'profile/badges/images/Badge_stylist.webp',               'Customize your profile: avatar + UI color + profile music + equipped title', 0),
('pyro_spark',           'The Ignition',                 'streak',      'common',    'profile/badges/images/Badge_Pyro_Spark.webp',            'Reach a 7-day streak', 0),
('raphael',              'The Divine Blaze',             'streak',      'rare',      'profile/badges/images/Badge_Raphael.webp',               'Reach a 30-day streak', 0),
('surt',                 "Ragnarök's Dawn",              'streak',      'epic',      'profile/badges/images/Badge_Surt.webp',                  'Reach a 90-day streak', 0),
('lucifer',              'Crest of the Morning Star',    'streak',      'epic',      'profile/badges/images/Badge_Lucifer.webp',               'Reach a 120-day streak', 0),
('helel',                'The Eternal Zenith',           'streak',      'legendary', 'profile/badges/images/Badge_Helel.webp',                 'Reach a 365-day streak', 0),
('reborn_phoenix',       'Phoenix Reborn',               'streak',      'rare',      'profile/badges/images/Badge_Reborn_Phenix.webp',         'Restore your streak after losing it (grace period)', 0),
('take_the_pose',        'Take The Pose',                'social',      'common',    'profile/badges/images/Badges_Take_The_Pose.png',         'Share your profile with others', 0),
('best_bro',             'Best Bro',                     'social',      'common',    'profile/badges/images/Badges_Best_bro.png',              'Have 2 or more friends', 0),
('data_mining',          'Data Mining',                  'social',      'common',    'profile/badges/images/Badge_Data_Mining.webp',           'Visit 5 different user profiles', 0),
('leblanc_meeting',      'Leblanc Meeting',              'social',      'rare',      'profile/badges/images/Badge_Leblanc_Meeting.webp',       '3 or more friends logged in the same day as you', 0),
('rentree',              'Spring Awakening',             'event',       'common',    'profile/badges/images/Badges_Rentré.png',                'Log in on April 1st', 0),
('sport',                'Athletic Spirit',              'event',       'common',    'profile/badges/images/Badges_Sport.png',                 'Redeem code SPORT between April 6th and May 1st, 2025', 0),
('christmas_2025',       'Christmas 2025',               'event',       'common',    'profile/badges/images/Badges_Christmas_2025.png',        'Redeem code during Christmas 2025', 0),
('new_years_2026',       "New Year's 2026",              'event',       'common',    'profile/badges/images/Badges_New_Years_2026.png',        'Redeem code during New Year 2026', 0),
('chinese_new_year_2026','Happy Chinese New Year 2026',  'event',       'common',    'profile/badges/images/Badges_Chiness_New_Year.webp',     'Type the Chinese New Year code during the 2026 celebration', 0),
('valentine_2026',       "Valentine's Day 2026",         'event',       'common',    'profile/badges/images/Badges_St_Valentin.png',           "Redeem code during Valentine's 2026", 0),
('easter_2026',          'Easter 2026',                  'event',       'common',    'profile/badges/images/Badges_Paques.png',                'Redeem code during Easter 2026', 0),
('golden_week',          'Golden Week',                  'event',       'common',    'profile/badges/images/Badge_Golden_Week.webp',           'Log in between April 29 and May 5', 0),
('tanabata',             'Tanabata',                     'event',       'common',    'profile/badges/images/Badge_Tanabata.webp',              'Log in on July 7th', 0),
('promised_day',         'The Promised Day',             'event',       'rare',      'profile/badges/images/Badge_Promised_Day.webp',          'Play on December 31st AND January 1st', 0),
('true_hacker',          'True Hacker',                  'secret',      'rare',      'profile/badges/images/Badges_True_Hacker.png',           '???', 1),
('tae_takemi',           'Tae Takemi Fan',               'secret',      'rare',      'profile/badges/images/Badges_Tae_Takemi.png',            '???', 1),
('arati',                "Arati's Blessing",             'secret',      'rare',      'profile/badges/images/Badges_Arati.png',                 '???', 1),
('dzulian',              'The First Contractor',         'secret',      'epic',      'profile/badges/images/Badge_Dzulian.png',                '???', 1),
('chef',                 'Master Chef',                  'secret',      'rare',      'profile/badges/images/Badges_Chef.png',                  '???', 1),
('github_contributor',   'Phantom Coder',                'secret',      'common',    'profile/badges/images/Badges_Github_Morgana.png',        '???', 1),
('lobster',              'Artistic Lobster',             'secret',      'rare',      'profile/badges/images/Badges_Lobster.png',               '???', 1),
('hifumi_archives',      "The Grandmaster's Tome",       'secret',      'rare',      'profile/badges/images/Badge_Hifumi_Archives.webp',       '???', 1),
('report',               "The Priestess's Audit",        'secret',      'rare',      'profile/badges/images/Badge_Report.webp',                '???', 1);

ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS name       VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS image_path VARCHAR(255) NOT NULL DEFAULT '';

INSERT IGNORE INTO wallpapers (id, game, is_default, unlock_condition, name, image_path) VALUES
('kamoshida_palace',       'P5', 0, 'Play at least 1 game in each of the 6 modes',                   "Kamoshida's Palace",    'profile/Wallpaper/unlockable/kamoshida_palace.webp'),
('madarame_wallpaper',     'P5', 0, 'Set a custom avatar AND have at least 1 friend',                 "Madarame's Palace",     'profile/Wallpaper/unlockable/madarame_wallpaper.webp'),
('yukiko_dungeons',        'P4', 0, 'Play 3 consecutive days with P4 filter active',                  "Yukiko's Dungeons",     'profile/Wallpaper/unlockable/yukiko_dungeons.webp'),
('kanji_dungeons',         'P4', 0, 'Send a challenge to a friend and have them accept it',           "Kanji's Dungeons",      'profile/Wallpaper/unlockable/kanji_dungeons.webp'),
('rise_dungeons',          'P4', 0, 'Play 30 total games in Music mode',                              "Rise's Dungeons",       'profile/Wallpaper/unlockable/rise_dungeons.webp'),
('mitsuo_dungeons',        'P4', 0, 'Complete 75 total games across all modes',                       "Mitsuo's Dungeons",     'profile/Wallpaper/unlockable/mitsuo_dungeons.webp'),
('dark_shopping_district', 'P4', 0, 'Have a Social Link at rank 5 or higher',                        'Dark Shopping District','profile/Wallpaper/unlockable/dark_shopping_district.webp');

-- ── m008 : users.is_admin ─────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin     TINYINT(1) NOT NULL DEFAULT 0 AFTER is_deleted;
UPDATE users SET is_admin = 1 WHERE pseudo = 'admin' AND is_admin = 0;

-- ── m009 : social_link_rankup_notifs ─────────────────────────
CREATE TABLE IF NOT EXISTS social_link_rankup_notifs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    recipient_id INT NOT NULL,
    partner_id   INT NOT NULL,
    new_rank     INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seen_at      TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_recipient_unseen (recipient_id, seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── m011 : event_codes + colonnes modération users ───────────
CREATE TABLE IF NOT EXISTS event_codes (
    code         VARCHAR(50)  NOT NULL,
    badge_id     VARCHAR(100) NOT NULL,
    start_date   DATE         NULL,
    end_date     DATE         NULL,
    is_permanent TINYINT(1)   NOT NULL DEFAULT 0,
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    description  VARCHAR(255) NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code),
    INDEX idx_event_codes_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO event_codes (code, badge_id, start_date, end_date, is_permanent, is_active, description) VALUES
  ('XMAS2025',     'christmas_2025',        '2025-12-01', '2025-12-31', 0, 0, 'Christmas 2025'),
  ('NEWYEAR2026',  'new_years_2026',        '2025-12-31', '2026-01-31', 0, 0, 'New Year 2026'),
  ('VALENTINE2026','valentine_2026',        '2026-02-14', '2026-03-01', 0, 0, 'Valentine 2026'),
  ('EASTER2026',   'easter_2026',           '2026-04-01', '2026-04-10', 0, 0, 'Easter 2026'),
  ('CHINESNY2026', 'chinese_new_year_2026', '2026-02-01', '2026-03-01', 0, 0, 'Chinese New Year 2026'),
  ('SPORT',        'sport',                 '2025-04-06', '2025-05-01', 0, 0, 'Sport 2025'),
  ('ALIBABA',      'true_hacker',            NULL, NULL, 1, 1, 'Secret — Hamza'),
  ('DEATHQUEEN',   'tae_takemi',             NULL, NULL, 1, 1, 'Secret — Tae Takemi'),
  ('ARATI',        'arati',                  NULL, NULL, 1, 1, 'Secret — Arati'),
  ('DZULIAN',      'dzulian',                NULL, NULL, 1, 1, 'Secret — Dzulian'),
  ('GOURMET',      'chef',                   NULL, NULL, 1, 1, 'Secret — Chef'),
  ('LOBSTER',      'lobster',                NULL, NULL, 1, 1, 'Secret — Lobster');

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned     TINYINT(1) NOT NULL DEFAULT 0 AFTER is_deleted;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pseudo_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER is_banned;

-- ── m012 : supprimer social_link_badges + colonne badge_generated
-- ⚠️ Destructif — s'assurer d'un dump (mysqldump) préalable si la table
-- contient encore des données avant de lancer ce script en prod.
DROP TABLE IF EXISTS social_link_badges;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE()
                     AND TABLE_NAME   = 'social_links'
                     AND COLUMN_NAME  = 'badge_generated');
SET @sql = IF(@col_exists > 0,
    'ALTER TABLE social_links DROP COLUMN badge_generated',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── m013 : users.streak_recovered_at ─────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_recovered_at DATETIME DEFAULT NULL;

-- ── m014 : game_sessions UNIQUE KEY + index composite ────────
ALTER TABLE game_sessions DROP   INDEX IF EXISTS uq_session_per_day;
ALTER TABLE game_sessions ADD    UNIQUE KEY  uq_session_per_day     (user_id, mode, played_date);
ALTER TABLE game_sessions DROP   INDEX IF EXISTS idx_gs_user_mode_date;
ALTER TABLE game_sessions ADD    INDEX        idx_gs_user_mode_date  (user_id, mode, played_date);

-- ── m015 : nettoyage index redondant + FK rankup notifs ──────
ALTER TABLE users DROP INDEX IF EXISTS idx_users_pseudo;
CREATE INDEX IF NOT EXISTS idx_sli_composite ON social_link_interactions(social_link_id, initiator_id, action_type);

-- recipient_id/partner_id ont été créés en INT (m009) mais users.id est BIGINT UNSIGNED :
-- on élargit avant d'ajouter les FK (MODIFY COLUMN est sans risque à rejouer, no-op si déjà au bon type).
ALTER TABLE social_link_rankup_notifs
  MODIFY COLUMN recipient_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN partner_id   BIGINT UNSIGNED NOT NULL;
ALTER TABLE social_link_rankup_notifs ADD COLUMN IF NOT EXISTS is_badge_prompt TINYINT(1) NOT NULL DEFAULT 0;

-- ADD CONSTRAINT IF NOT EXISTS n'est pas fiable pour les FK sur MariaDB 11.8 :
-- vérification via INFORMATION_SCHEMA avant ajout, comme pour m012 (badge_generated).
SET @fk_recipient_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                             WHERE TABLE_SCHEMA = DATABASE()
                               AND TABLE_NAME = 'social_link_rankup_notifs'
                               AND CONSTRAINT_NAME = 'fk_slrn_recipient');
SET @sql = IF(@fk_recipient_exists = 0,
    'ALTER TABLE social_link_rankup_notifs ADD CONSTRAINT fk_slrn_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_partner_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                           WHERE TABLE_SCHEMA = DATABASE()
                             AND TABLE_NAME = 'social_link_rankup_notifs'
                             AND CONSTRAINT_NAME = 'fk_slrn_partner');
SET @sql = IF(@fk_partner_exists = 0,
    'ALTER TABLE social_link_rankup_notifs ADD CONSTRAINT fk_slrn_partner FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── m016 : global_streak (IF NOT EXISTS — MariaDB OK) ────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS global_streak        INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS global_streak_record INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS global_streak_date   DATE DEFAULT NULL;

-- ── m017 : rate_limits ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
    rl_key       VARCHAR(191) NOT NULL,
    hits         INT          NOT NULL DEFAULT 0,
    window_start INT          NOT NULL,
    PRIMARY KEY (rl_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── m018 : password reset token ───────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash    VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS reset_token_expires DATETIME    NULL;

-- ── m019 : error_log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS error_log (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    level      VARCHAR(20)     NOT NULL DEFAULT 'error',
    message    TEXT            NOT NULL,
    context    JSON            NULL,
    user_id    BIGINT UNSIGNED NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_error_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_level   ON error_log(level, created_at DESC);

-- ── m020 : admin_audit_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    admin_id    BIGINT UNSIGNED NULL,
    action      VARCHAR(60)     NOT NULL,
    target_type VARCHAR(40)     NOT NULL,
    target_id   VARCHAR(100)    NOT NULL,
    details     JSON            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_audit_log_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target  ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin   ON admin_audit_log(admin_id, created_at DESC);

-- ── m021 : conditions structurées sur badges + wallpapers ────
ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS condition_type  VARCHAR(50) NULL AFTER condition_en,
  ADD COLUMN IF NOT EXISTS condition_mode  VARCHAR(30) NULL AFTER condition_type,
  ADD COLUMN IF NOT EXISTS condition_value INT         NULL AFTER condition_mode;

UPDATE badges SET condition_type = 'wins_total',    condition_value = 1   WHERE slug = 'first_win'      AND condition_type IS NULL;
UPDATE badges SET condition_type = 'wins_total',    condition_value = 10  WHERE slug = 'ace_detective'   AND condition_type IS NULL;
UPDATE badges SET condition_type = 'giveups_total', condition_value = 10  WHERE slug = 'ace_defective'   AND condition_type IS NULL;
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'silhouette', condition_value = 5  WHERE slug = 'shadow_slayer'  AND condition_type IS NULL;
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'music',      condition_value = 20 WHERE slug = 'music_master'   AND condition_type IS NULL;
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'classic',    condition_value = 15 WHERE slug = 'p1_p2_fan'      AND condition_type IS NULL;
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'personae',   condition_value = 10 WHERE slug = 'velvet_master'  AND condition_type IS NULL;
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'emoji',      condition_value = 10 WHERE slug = 'emoji_decoder'  AND condition_type IS NULL;
UPDATE badges SET condition_type = 'streak_record', condition_value = 7   WHERE slug = 'pyro_spark'    AND condition_type IS NULL;
UPDATE badges SET condition_type = 'streak_record', condition_value = 30  WHERE slug = 'raphael'        AND condition_type IS NULL;
UPDATE badges SET condition_type = 'streak_record', condition_value = 90  WHERE slug = 'surt'           AND condition_type IS NULL;
UPDATE badges SET condition_type = 'streak_record', condition_value = 120 WHERE slug = 'lucifer'        AND condition_type IS NULL;
UPDATE badges SET condition_type = 'streak_record', condition_value = 365 WHERE slug = 'helel'          AND condition_type IS NULL;
UPDATE badges SET condition_type = 'unique_days',   condition_value = 50  WHERE slug = 'velvet_regular' AND condition_type IS NULL;
UPDATE badges SET condition_type = 'friends_count', condition_value = 2   WHERE slug = 'best_bro'       AND condition_type IS NULL;
UPDATE badges SET condition_type = 'manual' WHERE condition_type IS NULL;

ALTER TABLE wallpapers
  ADD COLUMN IF NOT EXISTS condition_type  VARCHAR(50) NULL AFTER unlock_condition,
  ADD COLUMN IF NOT EXISTS condition_mode  VARCHAR(30) NULL AFTER condition_type,
  ADD COLUMN IF NOT EXISTS condition_value INT         NULL AFTER condition_mode;

UPDATE wallpapers SET condition_type = 'all_modes_won'                                                        WHERE id = 'kamoshida_palace'       AND condition_type IS NULL;
UPDATE wallpapers SET condition_type = 'mode_games', condition_mode = 'music', condition_value = 30           WHERE id = 'rise_dungeons'          AND condition_type IS NULL;
UPDATE wallpapers SET condition_type = 'games_total', condition_value = 75                                    WHERE id = 'mitsuo_dungeons'        AND condition_type IS NULL;
UPDATE wallpapers SET condition_type = 'social_link_min_rank', condition_value = 5                            WHERE id = 'dark_shopping_district' AND condition_type IS NULL;
UPDATE wallpapers SET condition_type = 'friends_count', condition_value = 1                                   WHERE id = 'madarame_wallpaper'     AND condition_type IS NULL;
UPDATE wallpapers SET condition_type = 'manual' WHERE is_default = 0 AND condition_type IS NULL;

-- ── m022 : fix aigis title — condition_mode manquant ─────────
UPDATE titles SET condition_mode = 'classic' WHERE slug = 'aigis_i_am_not_afraid';

-- ============================================================
-- FIN — vérification rapide
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='badges')           AS badges_ok,
  (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='event_codes')      AS event_codes_ok,
  (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='rate_limits')      AS rate_limits_ok,
  (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='error_log')        AS error_log_ok,
  (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='admin_audit_log')  AS admin_audit_log_ok,
  (SELECT COUNT(*) FROM information_schema.COLUMNS  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='global_streak')       AS global_streak_ok,
  (SELECT COUNT(*) FROM information_schema.COLUMNS  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='reset_token_hash')    AS reset_token_ok,
  (SELECT COUNT(*) FROM information_schema.COLUMNS  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='badges' AND COLUMN_NAME='condition_type')     AS badge_conditions_ok,
  (SELECT condition_mode FROM titles WHERE slug='aigis_i_am_not_afraid' LIMIT 1)                                                                AS aigis_mode,
  (SELECT COUNT(*) FROM information_schema.TABLES   WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='social_link_badges')                          AS slb_should_be_0\G
