-- Migration 003 : index composite messages(sender_id, type, status, created_at)
-- Améliore les requêtes challenge results pour l'expéditeur
CREATE INDEX IF NOT EXISTS idx_messages_sender_type
    ON messages(sender_id, type, status, created_at DESC);
