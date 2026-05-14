-- =============================================================================
-- Migration 011 — Event codes table + user moderation columns
-- =============================================================================

-- ── 1. event_codes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_codes (
    code         VARCHAR(50)   NOT NULL,
    badge_id     VARCHAR(100)  NOT NULL,
    start_date   DATE          NULL,
    end_date     DATE          NULL,
    is_permanent TINYINT(1)    NOT NULL DEFAULT 0,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    description  VARCHAR(255)  NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (code),
    INDEX idx_event_codes_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed codes existants (INSERT IGNORE = idempotent)
INSERT IGNORE INTO event_codes (code, badge_id, start_date, end_date, is_permanent, is_active, description) VALUES
  ('XMAS2025',    'christmas_2025',        '2025-12-01', '2025-12-31', 0, 0, 'Christmas 2025'),
  ('NEWYEAR2026', 'new_years_2026',        '2025-12-31', '2026-01-31', 0, 0, 'New Year 2026'),
  ('VALENTINE2026','valentine_2026',       '2026-02-14', '2026-03-01', 0, 0, 'Valentine 2026'),
  ('EASTER2026',  'easter_2026',           '2026-04-01', '2026-04-10', 0, 0, 'Easter 2026'),
  ('CHINESNY2026','chinese_new_year_2026', '2026-02-01', '2026-03-01', 0, 0, 'Chinese New Year 2026'),
  ('SPORT',       'sport',                 '2025-04-06', '2025-05-01', 0, 0, 'Sport 2025'),
  ('ALIBABA',     'true_hacker',           NULL, NULL, 1, 1, 'Secret — Hamza'),
  ('DEATHQUEEN',  'tae_takemi',            NULL, NULL, 1, 1, 'Secret — Tae Takemi'),
  ('ARATI',       'arati',                 NULL, NULL, 1, 1, 'Secret — Arati'),
  ('DZULIAN',     'dzulian',               NULL, NULL, 1, 1, 'Secret — Dzulian'),
  ('GOURMET',     'chef',                  NULL, NULL, 1, 1, 'Secret — Chef'),
  ('LOBSTER',     'lobster',               NULL, NULL, 1, 1, 'Secret — Lobster');

-- ── 2. User moderation columns ────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN is_banned     TINYINT(1) NOT NULL DEFAULT 0 AFTER is_deleted,
  ADD COLUMN pseudo_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER is_banned;
