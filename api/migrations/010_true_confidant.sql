-- =============================================================================
-- 010_true_confidant.sql — True Confidant Badge
-- Requires MariaDB 10.2+ or MySQL 8.0+ (ADD COLUMN IF NOT EXISTS = MariaDB ext.)
-- Run via SSH MariaDB CLI on Hostinger.
-- =============================================================================

-- 1. New table: per-player badge half configurations
CREATE TABLE IF NOT EXISTS social_link_badge_configs (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    social_link_id  BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    avatar_data     MEDIUMTEXT       DEFAULT NULL,
    crop_x          FLOAT            NOT NULL DEFAULT 0,
    crop_y          FLOAT            NOT NULL DEFAULT 0,
    crop_scale      FLOAT            NOT NULL DEFAULT 1,
    ring_color      VARCHAR(7)       NOT NULL DEFAULT '#f5c842',
    bg_color        VARCHAR(7)       DEFAULT NULL,
    overlay         VARCHAR(20)      NOT NULL DEFAULT 'none',
    submitted_at    TIMESTAMP        NULL DEFAULT NULL,
    created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_slbc (social_link_id, user_id),
    FOREIGN KEY (social_link_id) REFERENCES social_links(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add badge_prompt flag to rank-up notifs (MariaDB IF NOT EXISTS syntax)
ALTER TABLE social_link_rankup_notifs
    ADD COLUMN IF NOT EXISTS is_badge_prompt TINYINT(1) NOT NULL DEFAULT 0;
