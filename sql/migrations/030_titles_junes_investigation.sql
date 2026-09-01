-- 030 — Titres 2.1 "investigation_team" et "junes" (thème P4).
--
-- Déjà seedés dans bdd_mysql.sql (dev/fresh). Cette migration les insère sur la
-- prod déjà peuplée. INSERT IGNORE = idempotent.
--
-- Conditions proxy (décision produit : simplifier les conditions "collection"
-- d'origine, non exprimables dans le système de condition_type actuel) :
--   investigation_team → mode_wins personae 8   (8 victoires en mode Personae)
--   junes              → mode_wins music 15      (15 victoires en mode Music)
-- mode_wins + condition_mode sont déjà gérés côté serveur (api/lib/condition_check.php).

INSERT IGNORE INTO titles
    (slug, image_path, name_en, name_fr, name_es, name_de, name_it, condition_type, condition_mode, condition_value, rarity)
VALUES
    ('investigation_team', 'profile/titles/investigation_team.webp', 'Investigation Team', 'Investigation Team', 'Investigation Team', 'Investigation Team', 'Investigation Team', 'mode_wins', 'personae', 8, 'epic'),
    ('junes', 'profile/titles/junes.webp', 'Junes', 'Junes', 'Junes', 'Junes', 'Junes', 'mode_wins', 'music', 15, 'rare');
