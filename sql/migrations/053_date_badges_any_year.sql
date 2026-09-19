-- ─────────────────────────────────────────────────────────────────────────────
-- 053 — Badges de dates : ils tombent n'importe quelle année, vérifiés par le serveur
--
-- Décision Hamza du 2026-09-19 : Pâques, Saint-Valentin, Tanabata, Golden Week et le
-- Jour Promis « devraient marcher peu importe l'année ». Jusqu'ici :
--   - Pâques / Saint-Valentin = codes événement d'UNE année (EASTER2026, VALENTINE2026),
--     nom et description datés ;
--   - Golden Week / Tanabata / Jour Promis = drapeaux posés par le client si l'on
--     VISITAIT le site à la bonne date (par appareil, perdus avec le cache).
-- Désormais tous lisent game_sessions côté serveur (condition_check.php) et sont
-- accordés à l'ouverture du profil (unlock_reconcile.php), pour toutes les années :
--   played_on_date       'MM-JJ'         → Saint-Valentin (02-14), Tanabata (07-07)
--   played_in_period     'MM-JJ:MM-JJ'   → Golden Week (04-29:05-05)
--   played_on_all_dates  'MM-JJ,MM-JJ'   → Jour Promis (12-31,01-01)
--   played_on_easter     (computus)      → Pâques, dimanche ou lundi
-- Slugs et images inchangés (valentine_2026 / easter_2026 restent des identifiants) ;
-- les noms perdent leur année. Idempotente (UPDATE par slug).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE badges SET condition_type = 'played_on_date', condition_mode = '02-14', condition_value = NULL,
    name_en = 'Valentine''s Day', name_fr = 'Saint-Valentin', name_es = 'San Valentín',
    name_de = 'Valentinstag', name_it = 'San Valentino',
    condition_en = 'Play on February 14th'
  WHERE slug = 'valentine_2026';

UPDATE badges SET condition_type = 'played_on_easter', condition_mode = NULL, condition_value = NULL,
    name_en = 'Easter', name_fr = 'Pâques', name_es = 'Pascua', name_de = 'Ostern', name_it = 'Pasqua',
    condition_en = 'Play on Easter Sunday or Monday'
  WHERE slug = 'easter_2026';

UPDATE badges SET condition_type = 'played_in_period', condition_mode = '04-29:05-05', condition_value = NULL,
    condition_en = 'Play between April 29 and May 5'
  WHERE slug = 'golden_week';

UPDATE badges SET condition_type = 'played_on_date', condition_mode = '07-07', condition_value = NULL,
    condition_en = 'Play on July 7th'
  WHERE slug = 'tanabata';

UPDATE badges SET condition_type = 'played_on_all_dates', condition_mode = '12-31,01-01', condition_value = NULL,
    condition_en = 'Play on December 31st AND January 1st'
  WHERE slug = 'promised_day';
