-- 022_fix_aigis_title_condition.sql
--
-- Le titre 'aigis_i_am_not_afraid' était seedé avec condition_type='mode_wins' mais
-- aucun condition_mode (l'INSERT INTO titles d'origine n'incluait pas cette colonne —
-- elle était NULL pour tous les titres). personadle_verify_condition() (api/lib/
-- condition_check.php) refuse immédiatement 'mode_wins' sans mode résolu, sans jamais
-- consulter les stats — ce titre ne pouvait donc structurellement jamais se débloquer.
--
-- Confirmé par le mainteneur (revue PR #14) : la doc joueur (PersonaDLE_Update.html)
-- annonce "Win 50 games in Classic Mode" — condition_mode='classic' est donc la valeur
-- manquante, pas un changement de condition_type.
UPDATE titles
SET condition_mode = 'classic'
WHERE slug = 'aigis_i_am_not_afraid';
