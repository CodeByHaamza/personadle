-- Migration 005: Add image_path to titles + seed calling card titles
-- Run as DB admin (requires ALTER privilege)
-- Date: 2026-04-26

-- Add visual banner path to titles table
ALTER TABLE titles ADD COLUMN image_path VARCHAR(150) NULL AFTER rarity;

-- Update existing text titles with no image
-- (they remain as text-based titles, image_path stays NULL)

-- Insert calling card titles (if not already present)
INSERT IGNORE INTO titles (slug, name_en, name_fr, name_es, name_de, name_it, condition_type, condition_value, rarity, image_path) VALUES
('thou_art_i',          'Thou Art I',              'Tu es Moi',                   'Tú Eres Yo',                   'Du bist Ich',                   'Tu Sei Io',                 'wins_total',    200,  'epic',      'profile/titles/velvet_room_thou_art_i.webp'),
('looking_cool',        'Looking Cool, Joker',     'Tu assures, Joker',           'Qué estilo, Joker',            'Cool, Joker',                   'Sei in gamba, Joker',       'wins_mode',     30,   'rare',      'profile/titles/joker_looking_cool.webp'),
('memento_mori',        'Memento Mori',            'Memento Mori',                'Memento Mori',                 'Memento Mori',                  'Memento Mori',              'streak_record', 14,   'epic',      'profile/titles/makoto_yuki_memento_mori.webp'),
('i_am_not_afraid',     'I Am Not Afraid',         'Je n''ai pas peur',           'No tengo miedo',               'Ich habe keine Angst',          'Non ho paura',              'wins_total',    100,  'rare',      'profile/titles/aigis_i_am_not_afraid.webp'),
('pancakes',            'Pancakes',                'Pancakes',                    'Pancakes',                     'Pancakes',                      'Pancakes',                  'wins_mode',     20,   'common',    'profile/titles/akechi_pancakes.webp'),
('ride_the_wind',       'Ride the Wind',           'Chevauche le vent',           'Cabalga el viento',            'Reite den Wind',                'Cavalca il vento',          'streak_record', 7,    'common',    'profile/titles/yosuke_ride_the_wind.webp'),
('boring_isnt_it',      'Boring, Isn''t It?',      'C''est ennuyeux, non ?',      '¿Aburrido, no?',               'Langweilig, oder?',             'Noioso, vero?',             'giveups_total', 10,   'rare',      'profile/titles/adachi_boring_isnt_it.webp'),
('i_remembered',        'I Remembered',            'Je me suis souvenu',          'Lo recordé',                   'Ich erinnerte mich',            'Mi sono ricordato',         'wins_total',    50,   'rare',      'profile/titles/marie_i_remembered.webp'),
('reach_out',           'Reach Out to the Truth',  'Tends la main vers la vérité','Alcanza la verdad',            'Greif nach der Wahrheit',       'Raggiungi la verità',       'streak_record', 10,   'epic',      'profile/titles/yu_reach_out_to_the_truth.webp'),
('first_awakening',     'First Awakening',         'Premier Éveil',               'Primer Despertar',             'Erste Erweckung',               'Primo Risveglio',           'wins_total',    1,    'common',    'profile/titles/naoya_first_awakening.webp'),
('always_be_positive',  'Always Be Positive!',     'Reste toujours positif !',    '¡Siempre sé positivo!',        'Immer positiv bleiben!',        'Sii sempre positivo!',      'wins_total',    300,  'legendary', 'profile/titles/maya_always_be_positive.webp');
