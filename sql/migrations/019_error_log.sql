-- Migration 019 — Table error_log (observabilité applicative).
-- Capture les erreurs backend (exceptions non catchées, erreurs fatales, et
-- les erreurs métier explicitement loguées via personadle_log_error()) pour
-- consultation dans le panel admin, au-delà des logs error_log() serveur
-- (non consultables sans accès SSH à l'hébergeur).
CREATE TABLE IF NOT EXISTS error_log (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    level      VARCHAR(20)     NOT NULL DEFAULT 'error',
    message    TEXT            NOT NULL,
    context    JSON            NULL,
    user_id    BIGINT UNSIGNED NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_error_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_error_log_created ON error_log(created_at DESC);
CREATE INDEX idx_error_log_level   ON error_log(level, created_at DESC);
