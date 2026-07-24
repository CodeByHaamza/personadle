-- 026 — Suivi des migrations appliquées (table schema_migrations).
--
-- CONTEXTE : jusqu'ici, aucun moyen de savoir quelles migrations étaient
-- appliquées sur une base donnée. L'incident du 2026-07-24 (prod partiellement
-- migrée, cf. 024/025) a demandé de deviner colonne par colonne. Cette table
-- rend l'état déterministe et permet à scripts/apply_migrations.sh d'appliquer
-- uniquement les migrations en attente.
--
-- ⚠️ Migration D'AMORÇAGE : elle crée la table PUIS enregistre TOUTES les
--    migrations existantes (000→026) comme déjà appliquées — car sur la prod
--    elles le sont déjà (via 024/025 + l'historique). Après ça, les futures
--    migrations passent par scripts/apply_migrations.sh.
--    NB : cette table est un outil d'exploitation (prod) et n'est PAS dans
--    bdd_mysql.sql (dev/CI chargent le schéma consolidé, sans besoin de suivi).

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Amorçage : marque l'historique complet comme appliqué (INSERT IGNORE =
-- ré-exécutable sans erreur).
INSERT IGNORE INTO schema_migrations (version) VALUES
 ('000_social_foundation'),
 ('001_add_challenge_filters'),
 ('002_add_has_migrated'),
 ('003_add_messages_sender_type_index'),
 ('004_leaderboard_cache_add_metric'),
 ('005_titles_image_path_calling_cards'),
 ('006_fix_title_slugs'),
 ('007_badges_wallpapers_catalog'),
 ('008_add_is_admin'),
 ('009_social_link_rankup_notifs'),
 ('011_event_codes_moderation'),
 ('012_remove_tcb'),
 ('013_streak_recovery_tracking'),
 ('014_game_sessions_unique_constraint'),
 ('015_db_optimizations'),
 ('016_global_streak'),
 ('017_rate_limits'),
 ('018_password_reset'),
 ('019_error_log'),
 ('020_admin_audit_log'),
 ('021_structured_badge_wallpaper_conditions'),
 ('022_fix_aigis_title_condition'),
 ('023_challenge_target'),
 ('024_reconcile_social_links_prod_schema'),
 ('025_reconcile_prod_missing_columns'),
 ('026_schema_migrations_tracking');
