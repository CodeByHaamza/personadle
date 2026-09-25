-- ════════════════════════════════════════════════════════════════════════════
-- 055 — Badge secret « Café Leblanc »
--
-- Le pendant Ko-fi de `github_contributor` : le lien de l'accueil pose un
-- drapeau dans le profil local, le client propose alors le déblocage, et le
-- serveur l'accorde parce que le badge est `manual`.
--
-- Pourquoi `manual` et pas une condition vérifiable : Ko-fi ne dit rien au jeu
-- de ce qui se passe chez lui. On ne peut donc PAS récompenser un don — seule
-- la visite est observable, et c'est elle qui est récompensée. Le texte du badge
-- le dit ainsi, pour ne pas laisser croire qu'un paiement a été constaté.
--
-- Rareté `common`, comme `github_contributor` : c'est le même geste, un clic.
--
-- Idempotente : `INSERT IGNORE`, rejouable sans effet de bord.
-- ════════════════════════════════════════════════════════════════════════════

INSERT IGNORE INTO badges
    (slug, name_en, category, rarity, image_path, condition_en, condition_type, condition_mode, condition_value, is_secret)
VALUES
    ('cafe_leblanc', 'Café Leblanc', 'secret', 'common',
     'profile/badges/images/Badge_Cafe_Leblanc.webp',
     '???',
     'manual', NULL, NULL, 1);
