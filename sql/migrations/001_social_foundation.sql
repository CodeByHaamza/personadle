-- Migration 001 — Social Foundation
-- Appliquer : mysql -u hamza -penfants3 personadle < sql/migrations/001_social_foundation.sql

-- 1. Colonne settings JSON dans profiles
ALTER TABLE profiles
    ADD COLUMN settings JSON NULL AFTER equipped_title_id;

-- 2. Colonne seen_at dans friendships (date de première vue par l'addressee)
ALTER TABLE friendships
    ADD COLUMN seen_at TIMESTAMP NULL AFTER accepted_at;

-- 3. Table messages (utilisée aussi par Plan 3 - Challenges)
CREATE TABLE IF NOT EXISTS messages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id       BIGINT UNSIGNED NOT NULL,
    receiver_id     BIGINT UNSIGNED NOT NULL,
    type            VARCHAR(20)     NOT NULL DEFAULT 'message',
    -- 'message' | 'challenge'
    content         TEXT            NULL,
    challenge_mode  VARCHAR(30)     NULL,
    challenge_score INT             NULL,
    challenge_date  DATE            NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'unread',
    -- 'unread' | 'read' | 'accepted' | 'beaten' | 'expired'
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_sender
        FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_receiver
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_messages_receiver
    ON messages(receiver_id, status, created_at DESC);
CREATE INDEX idx_messages_sender
    ON messages(sender_id);
