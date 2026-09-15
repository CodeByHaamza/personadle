-- =============================================================================
-- 042 — Modération avec messages, annonces, maintenance (2.2, décision Hamza du
--       2026-09-13 : « fais tout »)
-- =============================================================================
-- Jusqu'ici `users.is_banned` était un booléen nu : le joueur voyait « Account
-- banned » sans raison ni durée, et l'admin n'avait aucune trace du pourquoi hors
-- du journal d'audit. Ce lot ajoute :
--
--   users.ban_reason / ban_note / banned_at / banned_until
--       raison VISIBLE par le joueur (login), note INTERNE, date, et échéance
--       (NULL = définitif). Un ban échu est levé tout seul à la prochaine
--       connexion (api/lib/moderation.php).
--   users.reset_local_state_at
--       « reset ciblé » : l'admin demande au client de vider l'état local des
--       modes (parties corrompues) — le client compare avec son dernier accusé.
--   user_notices    avertissements / messages de l'équipe, vus une fois (read_at)
--   admin_notes     carnet interne par joueur, jamais exposé
--   announcements   annonce globale (info / warning / maintenance), FR + EN,
--                   fenêtre de dates optionnelle
--   site_settings   clé/valeur : maintenance_enabled, maintenance_message_fr/en,
--                   maintenance_until
--
-- ⚠️ Syntaxe MariaDB (`ADD COLUMN IF NOT EXISTS`), comme 031/032/037/040/041.
-- Idempotente : rejouable sans effet de bord.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ban_reason           VARCHAR(300) NULL AFTER is_banned,
    ADD COLUMN IF NOT EXISTS ban_note             TEXT         NULL AFTER ban_reason,
    ADD COLUMN IF NOT EXISTS banned_at            DATETIME     NULL AFTER ban_note,
    ADD COLUMN IF NOT EXISTS banned_until         DATETIME     NULL AFTER banned_at,
    ADD COLUMN IF NOT EXISTS reset_local_state_at DATETIME     NULL AFTER banned_until;

CREATE TABLE IF NOT EXISTS user_notices (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED NOT NULL,
    admin_id   BIGINT UNSIGNED NULL,
    type       VARCHAR(20)     NOT NULL DEFAULT 'warning',   -- 'warning' | 'info'
    message    TEXT            NOT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at    DATETIME        NULL,
    INDEX idx_user_notices_pending (user_id, read_at),
    CONSTRAINT fk_user_notices_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_notices_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_notes (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT UNSIGNED NOT NULL,
    admin_id   BIGINT UNSIGNED NULL,
    note       TEXT            NOT NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_notes_user (user_id, created_at),
    CONSTRAINT fk_admin_notes_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_notes_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    level      VARCHAR(20)     NOT NULL DEFAULT 'info',      -- 'info' | 'warning' | 'maintenance'
    message_fr TEXT            NOT NULL,
    message_en TEXT            NULL,                          -- NULL = message_fr partout
    starts_at  DATETIME        NULL,                          -- NULL = tout de suite
    ends_at    DATETIME        NULL,                          -- NULL = jusqu'à désactivation
    is_active  TINYINT(1)      NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_announcements_active (is_active, starts_at, ends_at),
    CONSTRAINT fk_announcements_admin FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
    setting_key   VARCHAR(60)     NOT NULL PRIMARY KEY,
    setting_value TEXT            NULL,
    updated_by    BIGINT UNSIGNED NULL,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_site_settings_admin FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
