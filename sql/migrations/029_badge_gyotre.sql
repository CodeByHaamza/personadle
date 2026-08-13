-- 029 — Badge secret "gyotre" (easter-egg, code permanent GYOTRE).
--
-- Déjà seedé dans bdd_mysql.sql (dev/fresh). Cette migration l'insère sur la
-- prod déjà peuplée. INSERT IGNORE = idempotent.
--
-- Débloqué par le code événement GYOTRE (comme arati/dzulian) ; vérification
-- serveur = condition_type 'manual' (déblocage par redeem, cf. api/badges).

INSERT IGNORE INTO badges
    (slug, name_en, category, rarity, image_path, condition_en, condition_type, condition_mode, condition_value, is_secret)
VALUES
    ('gyotre', 'Gyotre', 'secret', 'rare', 'profile/badges/images/Badge_Gyotre.webp', '???', 'manual', NULL, NULL, 1);

INSERT IGNORE INTO event_codes
    (code, badge_id, start_date, end_date, is_permanent, is_active, description)
VALUES
    ('GYOTRE', 'gyotre', NULL, NULL, 1, 1, 'Secret — Gyotre');
