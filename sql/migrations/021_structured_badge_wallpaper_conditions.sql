-- Migration 021 — Conditions badges/wallpapers en colonnes structurées
--
-- Jusqu'ici seule la table `titles` avait condition_type/condition_mode/condition_value
-- structurées ; `badges`/`wallpapers` n'exposaient qu'un texte libre (condition_en /
-- unlock_condition), et la vérification serveur passait par un mapping slug→logique
-- en dur dans api/badges/index.php et api/wallpapers/index.php — fragile (un nouveau
-- badge ajouté sans mise à jour du switch passait toujours en "safe fallback = true").
--
-- Cette migration ajoute les mêmes colonnes que `titles` aux deux tables, backfill les
-- valeurs pour le catalogue existant, et api/lib/condition_check.php factorise
-- désormais la logique de vérification (extraite de l'ancien verifyTitleCondition())
-- entre titles/badges/wallpapers — un seul endroit à mettre à jour pour un nouveau
-- condition_type, au lieu de trois mappings divergents.
--
-- Nouveaux condition_type par rapport au vocabulaire déjà utilisé par `titles` :
--   mode_games          → nombre de PARTIES (pas de victoires) dans condition_mode
--   games_total         → nombre de parties tous modes confondus
--   social_link_min_rank → au moins un Social Link au rang >= condition_value
--                          (généralise social_link_rank_10, qui reste exact-rang-10)
--
-- Les badges/wallpapers dont la condition réelle dépend de flags purement client
-- (narration, combinaison de personnages trouvés, redeem de code événement…) restent
-- non re-vérifiables côté serveur sans persister ces flags en BDD — hors scope de
-- cette migration (cf. ROADMAP.md ❓ "Durcir l'anti-triche des badges à flags").
-- Ils reçoivent condition_type = 'manual', qui documente explicitement ce choix au
-- lieu de laisser condition_type NULL (safe fallback silencieux).

-- =============================================================================
-- 1. BADGES — ajout des colonnes structurées
-- =============================================================================

ALTER TABLE badges
    ADD COLUMN condition_type  VARCHAR(50) NULL AFTER condition_en,
    ADD COLUMN condition_mode  VARCHAR(30) NULL AFTER condition_type,
    ADD COLUMN condition_value INT         NULL AFTER condition_mode;

-- ── Achievement — victoires totales / par mode / give-ups ────────────────────
UPDATE badges SET condition_type = 'wins_total',    condition_value = 1   WHERE slug = 'first_win';
UPDATE badges SET condition_type = 'wins_total',    condition_value = 10  WHERE slug = 'ace_detective';
UPDATE badges SET condition_type = 'giveups_total', condition_value = 10  WHERE slug = 'ace_defective';
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'silhouette', condition_value = 5  WHERE slug = 'shadow_slayer';
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'music',      condition_value = 20 WHERE slug = 'music_master';
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'classic',    condition_value = 15 WHERE slug = 'p1_p2_fan';
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'personae',   condition_value = 10 WHERE slug = 'velvet_master';
UPDATE badges SET condition_type = 'mode_wins', condition_mode = 'emoji',      condition_value = 10 WHERE slug = 'emoji_decoder';

-- ── Streak ────────────────────────────────────────────────────────────────────
UPDATE badges SET condition_type = 'streak_record', condition_value = 7   WHERE slug = 'pyro_spark';
UPDATE badges SET condition_type = 'streak_record', condition_value = 30  WHERE slug = 'raphael';
UPDATE badges SET condition_type = 'streak_record', condition_value = 90  WHERE slug = 'surt';
UPDATE badges SET condition_type = 'streak_record', condition_value = 120 WHERE slug = 'lucifer';
UPDATE badges SET condition_type = 'streak_record', condition_value = 365 WHERE slug = 'helel';

-- ── Conditions déjà structurellement calculables mais jusqu'ici bypassées
--    par erreur de mapping (safe fallback = true systématique) — corrigées ici,
--    c'est tout l'intérêt de cette migration ────────────────────────────────
UPDATE badges SET condition_type = 'unique_days',   condition_value = 50 WHERE slug = 'velvet_regular';
UPDATE badges SET condition_type = 'friends_count', condition_value = 2  WHERE slug = 'best_bro';

-- ── Le reste : conditions à flags narratifs/multi-persos, redeem de code
--    événement, ou vérifiées par un autre endpoint (social-links, streak-recovery,
--    calling-card) — non re-vérifiables depuis les tables stats existantes.
--    condition_type = 'manual' documente explicitement ce choix. ─────────────
UPDATE badges SET condition_type = 'manual' WHERE condition_type IS NULL;

-- =============================================================================
-- 2. WALLPAPERS — ajout des colonnes structurées
-- =============================================================================

ALTER TABLE wallpapers
    ADD COLUMN condition_type  VARCHAR(50) NULL AFTER unlock_condition,
    ADD COLUMN condition_mode  VARCHAR(30) NULL AFTER condition_type,
    ADD COLUMN condition_value INT         NULL AFTER condition_mode;

UPDATE wallpapers SET condition_type = 'all_modes_won'                                          WHERE id = 'kamoshida_palace';
UPDATE wallpapers SET condition_type = 'mode_games', condition_mode = 'music', condition_value = 30 WHERE id = 'rise_dungeons';
UPDATE wallpapers SET condition_type = 'games_total', condition_value = 75                       WHERE id = 'mitsuo_dungeons';
UPDATE wallpapers SET condition_type = 'social_link_min_rank', condition_value = 5                WHERE id = 'dark_shopping_district';
UPDATE wallpapers SET condition_type = 'friends_count', condition_value = 1                       WHERE id = 'madarame_wallpaper';
-- "Set a custom avatar AND have >= 1 friend" : seule la partie amis est
-- re-vérifiable côté serveur (l'avatar custom reste déclaratif client) — déjà
-- le comportement de l'ancien verifyWallpaperCondition(), juste structuré ici.

-- yukiko_dungeons ("3 jours consécutifs avec filtre P4 actif") et kanji_dungeons
-- ("défi envoyé et accepté par un ami") : flags purement client, non
-- re-vérifiables depuis les tables existantes → manual, comme pour les badges.
UPDATE wallpapers SET condition_type = 'manual' WHERE is_default = 0 AND condition_type IS NULL;
