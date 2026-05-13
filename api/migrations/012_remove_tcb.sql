-- Migration 012 — Suppression True Confidant Badge
-- Compatible MySQL 8.0 + MariaDB 10.6+
-- DROP TABLE IF EXISTS fonctionne partout.
-- Pour DROP COLUMN, on utilise un prepared statement conditionnel (MySQL 8.0 n'a pas IF EXISTS sur ALTER TABLE).

DROP TABLE IF EXISTS social_link_badges;

SET @col_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'social_links'
      AND COLUMN_NAME  = 'badge_generated'
);
SET @sql = IF(@col_exists > 0,
    'ALTER TABLE social_links DROP COLUMN badge_generated',
    'SELECT "badge_generated column does not exist, skipping"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
