-- Migration 009: Social Link rank-up notifications for the partner
-- Quand un Social Link monte en rang, l'autre joueur reçoit une notification
-- afin que l'animation showSocialLinkRankUp lui soit aussi affichée au prochain poll.
CREATE TABLE IF NOT EXISTS social_link_rankup_notifs (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    recipient_id INT NOT NULL,
    partner_id   INT NOT NULL,
    new_rank     INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seen_at      TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_recipient_unseen (recipient_id, seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
