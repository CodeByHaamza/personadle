-- =============================================================================
-- 038 — Badge « A Gentle Reprieve » (false_spring)
-- =============================================================================
-- Accompagne l'ajout de la musique « Memories of You » (P3R) au mode Music.
-- S'obtient en ABANDONNANT face à cette chanson — pendant exact de
-- `ideal_reality` (« Our Light »), et modelé sur lui.
--
-- Déjà seedé dans bdd_mysql.sql (dev/base vierge) ; cette migration l'insère
-- sur la prod déjà peuplée. INSERT IGNORE = idempotente, rejouable sans effet
-- de bord.
--
-- condition_type = 'manual', comme `ideal_reality` : le déclencheur est un flag
-- narratif observé côté client (`profile.gaveUpOnMemoriesOfYou`, posé dans
-- showVictory(force) de musicsMode/modeMusic.js), que le serveur n'a aucun
-- moyen de recalculer — il ne journalise pas QUELLE chanson a été abandonnée.
--
-- ⚠️ Angle mort assumé, hérité et partagé avec les ~45 autres badges 'manual' :
-- personadle_verify_condition() renvoie toujours true pour ce type, donc un
-- POST /api/badges/unlock forgé suffit à le décrocher. C'est le compromis en
-- place pour les badges à flag narratif ; le durcir demanderait de journaliser
-- la cible de chaque partie côté serveur, hors périmètre de la 2.1. Ne PAS
-- copier ce choix pour un badge dont la condition est réellement recalculable
-- (cf. l'avertissement de la migration 033 sur `denial_of_self`).
-- =============================================================================

INSERT IGNORE INTO badges
  (slug, name_en, category, rarity, image_path, condition_en, condition_type, condition_mode, condition_value, is_secret)
VALUES
  ('false_spring', 'A Gentle Reprieve', 'achievement', 'common',
   'profile/badges/images/Badge_False_Spring.webp',
   'Refuse the sacrifice and await the end at Ryoji''s side',
   'manual', NULL, NULL, 0);
