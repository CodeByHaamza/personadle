-- Migration 006 — Fix title slugs to match JS _titlesData slugs (character-prefixed format)
-- The DB originally used short slugs (e.g. "thou_art_i") but the JS and image filenames
-- use the full character-prefixed slugs (e.g. "velvet_room_thou_art_i").
-- This mismatch caused initTitlesSection() to never find a matching slug → is_unlocked always 0.

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
