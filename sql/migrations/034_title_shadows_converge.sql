-- =============================================================================
-- 034 — Titre « Shadows Converge » (maîtrise globale du Mode Expert)
-- =============================================================================
-- Complète le lot « porte d'entrée du Mode Expert » (migration 033 pour le badge
-- `denial_of_self`, api/lib/expert_unlocks.php pour les 6 portes).
--
-- Récompense de volume, là où `denial_of_self` récompense la polyvalence :
--   - denial_of_self  → 10 victoires Expert dans CHACUN des 6 modes
--   - shadows_converge → 50 victoires Expert au TOTAL, peu importe la répartition
-- Un joueur qui n'aime que deux modes atteint le titre sans jamais avoir le badge.
--
-- condition_type = 'expert_wins_total' (ajouté à api/lib/condition_check.php).
-- Surtout PAS 'wins_total' : celui-ci lit `user_stats`, table que le Mode Expert
-- n'alimente pas (cf. api/lib/game_session.php) — il compterait donc uniquement
-- les parties normales et le titre tomberait bien avant 50 parties Expert.
--
-- Le nom n'est pas traduit : c'est un titre-visuel, le texte est peint dans
-- l'image (même règle que `junes`, `investigation_team` ou `joker_looking_cool`).
--
-- Idempotente (INSERT IGNORE sur slug UNIQUE) : rejouable sans effet de bord.
-- =============================================================================

INSERT IGNORE INTO titles
  (slug, image_path, name_en, name_fr, name_es, name_de, name_it, condition_type, condition_mode, condition_value, rarity)
VALUES
  ('shadows_converge', 'profile/titles/shadows_converge.webp',
   'Shadows Converge', 'Shadows Converge', 'Shadows Converge', 'Shadows Converge', 'Shadows Converge',
   'expert_wins_total', NULL, 50, 'legendary');
