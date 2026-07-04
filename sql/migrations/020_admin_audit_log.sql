-- Migration 020 — Table admin_audit_log (traçabilité des actions admin).
-- Journalise qui (admin_id) a fait quoi (action/target_type/target_id/details)
-- sur les endpoints admin mutants (ban, grants, event codes, social links…),
-- pour consultation dans le panel admin.
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    admin_id    BIGINT UNSIGNED NULL,
    action      VARCHAR(60)     NOT NULL,
    target_type VARCHAR(40)     NOT NULL,
    target_id   VARCHAR(100)    NOT NULL,
    details     JSON            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_audit_log_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_target  ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_admin_audit_log_admin   ON admin_audit_log(admin_id, created_at DESC);
