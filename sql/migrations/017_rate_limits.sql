-- Migration 017 — Table de rate-limiting persistant (helper rateLimit() bootstrap.php).
-- Partagée entre instances, contrairement à sys_get_temp_dir().
-- MariaDB & MySQL 8.0 : CREATE TABLE IF NOT EXISTS supporté.
CREATE TABLE IF NOT EXISTS rate_limits (
    rl_key       VARCHAR(191) NOT NULL,
    hits         INT          NOT NULL DEFAULT 0,
    window_start INT          NOT NULL,
    PRIMARY KEY (rl_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
