-- Migration 007 — Badges catalog table + wallpapers catalog populated
--
-- 1. Creates `badges` catalog table (mirrors `titles` pattern)
--    - Stores all badge definitions from badgesData.js as DB source of truth
--    - Enables GET /api/badges with is_unlocked per user
--    - Enables server-side validation of badge_id on unlock
-- 2. Adds `name` and `image_path` columns to `wallpapers` table
-- 3. Seeds the 7 unlockable wallpapers (table existed but had 0 rows;
--    the FK on user_wallpapers.wallpaper_id was silently rejecting all unlocks)

-- =============================================================================
-- 1. BADGES CATALOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS badges (
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
-- 2. SEED ALL BADGES (INSERT IGNORE — idempotent)
-- =============================================================================

INSERT IGNORE INTO badges (slug, name_en, category, rarity, image_path, condition_en, is_secret) VALUES

-- ── Achievement badges ──────────────────────────────────────────────────────
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
('strega',              'Apostles of the Fall',       'achievement', 'rare',      'profile/badges/images/Badge_Strega.webp',                'Find Hypnos (Takaya), Moros (Jin) and Medea (Chidori) in Personae mode',   0),
('twin_fist',           'Twin Fist',                  'achievement', 'rare',      'profile/badges/images/Badge_Twin_Fist.webp',             'Find Makoto Nijima''s and Akihiko''s personas + their All-Out Attacks',    0),
('twin_spear',          'Twin Spear',                 'achievement', 'rare',      'profile/badges/images/Badge_Twin_Spear.webp',            'Find Kotone''s and Ken''s personas + their All-Out Attacks',               0),
('tradition_modernite', 'Chronological Convergence',  'achievement', 'epic',      'profile/badges/images/Badge_Tradition_Modernite.webp',   'Find Naoto''s & Futaba''s personas + Secret Base & When Mother Was There', 0),
('shapeshifter',        'The Formless Soul',          'achievement', 'epic',      'profile/badges/images/Badge_Shapshifter.webp',           'Guess the same character in 3 different modes (cumulative)',               0),
('ideal_reality',       'Gentle Illusion',            'achievement', 'common',    'profile/badges/images/Badge_Ideal_Reality.webp',         'Give up when the target is ''Our Light'' in Music mode',                  0),
('for_real',            'For Real',                   'achievement', 'rare',      'profile/badges/images/Badges_for_real.png',              'Find Ryuji''s All-Out Attack in AOA mode and his persona in Personae mode', 0),
('night_owl',           'Phantom of the Night',       'achievement', 'common',    'profile/badges/images/Badge_Night_Owl.webp',             'Play between midnight and 5 AM (Paris time)',                              0),
('nyx_hour',            'Nyx Hour',                   'achievement', 'rare',      'profile/badges/images/Badge_Nyx_Hour.webp',              'Play between midnight and 12:30 AM (Paris time)',                          0),
('stylist',             'Breathtaking Aesthetics',    'achievement', 'epic',      'profile/badges/images/Badge_stylist.webp',               'Customize your profile: avatar + UI color + profile music + equipped title',0),

-- ── Streak badges ────────────────────────────────────────────────────────────
('pyro_spark',          'The Ignition',               'streak',      'common',    'profile/badges/images/Badge_Pyro_Spark.webp',            'Reach a 7-day streak',                                                     0),
('raphael',             'The Divine Blaze',           'streak',      'rare',      'profile/badges/images/Badge_Raphael.webp',               'Reach a 30-day streak',                                                    0),
('surt',                'Ragnarök''s Dawn',           'streak',      'epic',      'profile/badges/images/Badge_Surt.webp',                  'Reach a 90-day streak',                                                    0),
('lucifer',             'Crest of the Morning Star',  'streak',      'epic',      'profile/badges/images/Badge_Lucifer.webp',               'Reach a 120-day streak',                                                   0),
('helel',               'The Eternal Zenith',         'streak',      'legendary', 'profile/badges/images/Badge_Helel.webp',                 'Reach a 365-day streak',                                                   0),
('reborn_phoenix',      'Phoenix Reborn',             'streak',      'rare',      'profile/badges/images/Badge_Reborn_Phenix.webp',         'Restore your streak after losing it (grace period)',                       0),

-- ── Social badges ────────────────────────────────────────────────────────────
('take_the_pose',       'Take The Pose',              'social',      'common',    'profile/badges/images/Badges_Take_The_Pose.png',         'Share your profile with others',                                           0),
('best_bro',            'Best Bro',                   'social',      'common',    'profile/badges/images/Badges_Best_bro.png',              'Have 2 or more friends',                                                   0),
('data_mining',         'Data Mining',                'social',      'common',    'profile/badges/images/Badge_Data_Mining.webp',           'Visit 5 different user profiles',                                          0),
('leblanc_meeting',     'Leblanc Meeting',            'social',      'rare',      'profile/badges/images/Badge_Leblanc_Meeting.webp',       '3 or more friends logged in the same day as you',                          0),

-- ── Event badges ─────────────────────────────────────────────────────────────
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

-- ── Secret badges ────────────────────────────────────────────────────────────
('true_hacker',         'True Hacker',                'secret',      'rare',      'profile/badges/images/Badges_True_Hacker.png',           '???',                                                                      1),
('tae_takemi',          'Tae Takemi Fan',             'secret',      'rare',      'profile/badges/images/Badges_Tae_Takemi.png',            '???',                                                                      1),
('arati',               'Arati''s Blessing',          'secret',      'rare',      'profile/badges/images/Badges_Arati.png',                 '???',                                                                      1),
('dzulian',             'The First Contractor',       'secret',      'epic',      'profile/badges/images/Badge_Dzulian.png',                '???',                                                                      1),
('chef',                'Master Chef',                'secret',      'rare',      'profile/badges/images/Badges_Chef.png',                  '???',                                                                      1),
('github_contributor',  'Phantom Coder',              'secret',      'common',    'profile/badges/images/Badges_Github_Morgana.png',        '???',                                                                      1),
('lobster',             'Artistic Lobster',           'secret',      'rare',      'profile/badges/images/Badges_Lobster.png',               '???',                                                                      1),
('hifumi_archives',     'The Grandmaster''s Tome',    'secret',      'rare',      'profile/badges/images/Badge_Hifumi_Archives.webp',       '???',                                                                      1),
('report',              'The Priestess''s Audit',     'secret',      'rare',      'profile/badges/images/Badge_Report.webp',                '???',                                                                      1);

-- =============================================================================
-- 3. WALLPAPERS TABLE — add missing columns then seed 7 unlockable wallpapers
-- =============================================================================

ALTER TABLE wallpapers
    ADD COLUMN name        VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN image_path  VARCHAR(255) NOT NULL DEFAULT '';

INSERT IGNORE INTO wallpapers (id, game, is_default, unlock_condition, name, image_path) VALUES
('kamoshida_palace',       'P5', 0, 'Play at least 1 game in each of the 6 modes',                     'Kamoshida''s Palace',    'profile/Wallpaper/unlockable/kamoshida_palace.webp'),
('madarame_wallpaper',     'P5', 0, 'Set a custom avatar AND have at least 1 friend',                   'Madarame''s Palace',     'profile/Wallpaper/unlockable/madarame_wallpaper.webp'),
('yukiko_dungeons',        'P4', 0, 'Play 3 consecutive days with P4 filter active',                    'Yukiko''s Dungeons',     'profile/Wallpaper/unlockable/yukiko_dungeons.webp'),
('kanji_dungeons',         'P4', 0, 'Send a challenge to a friend and have them accept it',             'Kanji''s Dungeons',      'profile/Wallpaper/unlockable/kanji_dungeons.webp'),
('rise_dungeons',          'P4', 0, 'Play 30 total games in Music mode',                               'Rise''s Dungeons',       'profile/Wallpaper/unlockable/rise_dungeons.webp'),
('mitsuo_dungeons',        'P4', 0, 'Complete 75 total games across all modes',                         'Mitsuo''s Dungeons',     'profile/Wallpaper/unlockable/mitsuo_dungeons.webp'),
('dark_shopping_district', 'P4', 0, 'Have a Social Link at rank 5 or higher',                          'Dark Shopping District', 'profile/Wallpaper/unlockable/dark_shopping_district.webp');
