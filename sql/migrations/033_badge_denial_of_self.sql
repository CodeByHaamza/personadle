-- =============================================================================
-- 033 — Badge « Denial of Self » (maîtrise des 6 Modes Expert)
-- =============================================================================
-- Accompagne la porte d'entrée du Mode Expert (api/lib/expert_unlocks.php).
--
-- Les 6 conditions de déblocage des modes ne sont PAS en base : ce sont des
-- conditions d'accès, pas des récompenses, et les stocker dans `badges` les
-- ferait apparaître dans la collection du joueur (la colonne `category`
-- n'accepte de toute façon que 'achievement'|'streak'|'event'|'secret'|'social').
-- Elles vivent dans api/lib/expert_unlocks.php, lu à la fois par le gate de
-- api/sessions.php et par /api/user/expert-status.
--
-- Ce badge-ci en revanche est une vraie récompense, donc bien en base.
-- condition_type = 'expert_modes_mastered' (ajouté à api/lib/condition_check.php) :
-- 10 victoires EN EXPERT dans chacun des 6 modes. Surtout PAS 'manual', qui
-- renvoie toujours true dans personadle_verify_condition() — n'importe qui
-- pourrait alors décrocher le badge en appelant POST /api/badges/unlock.
--
-- Idempotente (INSERT IGNORE) : rejouable sans effet de bord.
-- =============================================================================

INSERT IGNORE INTO badges
  (slug, name_en, category, rarity, image_path, condition_en, condition_type, condition_mode, condition_value, is_secret)
VALUES
  ('denial_of_self', 'Denial of Self', 'achievement', 'epic',
   'profile/badges/images/Badge_Denial_Of_Self.webp',
   'Win 10 Expert games in each of the 6 modes',
   'expert_modes_mastered', NULL, 10, 0);
