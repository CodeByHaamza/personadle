-- ─────────────────────────────────────────────────────────────────────────────
-- 046 — Cinq badges + le titre « Go Beyond » (visuels fournis par Hamza, 2026-09-18)
--
-- Badges : Starlight Festival, Shujin Outlaws, Absolute Authority, Don't Waste
-- Your Breath, Same Energy. Titre : Go Beyond (tout Wonder, P5X).
--
-- Trois conditions nouvelles, ajoutées à api/lib/condition_check.php dans le même
-- lot — TOUTES vérifiables côté serveur (aucun 'manual' dans ce lot) :
--   • targets_found            → un ENSEMBLE nommé de cibles gagnées, lu dans
--                                game_sessions (condition_mode = clé de
--                                PERSONADLE_TARGET_SETS : starlight_trio,
--                                shujin_outlaws, absolute_authority, wonder_go_beyond)
--   • mode_expert_perfect_wins → victoires EN EXPERT au premier essai dans un mode
--   • same_energy              → un ami de rang Social Link ≥ 5 porte Motoha Arai
--                                quand on porte Chie (ou l'inverse) ; accordé aux
--                                DEUX d'un coup par api/badges/index.php
--
-- La table badges ne porte ni description ni condition traduite : les textes
-- vivent dans profile/badges/badgesData.js et lang/*.json (badges.<slug>.*).
-- Le titre porte ses noms et descriptions ici (5 langues), comme la 044.
--
-- Rejouable : INSERT IGNORE sur la clé unique `slug` (badges) et `slug` (titles).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT IGNORE INTO badges
  (slug, image_path, name_en, name_fr, name_es, name_de, name_it,
   condition_en, category, rarity, is_secret,
   condition_type, condition_mode, condition_value)
VALUES
  ('starlight_festival',
   'profile/badges/images/Badge_Starlight_Festival.webp',
   'Starlight Festival', 'Festival Starlight', 'Festival Starlight', 'Starlight-Festival', 'Festival Starlight',
   'Find Joker, Panther and Mona in their Starlight outfits in All-Out Attack',
   'achievement', 'rare', 0,
   'targets_found', 'starlight_trio', NULL),

  ('shujin_outlaws',
   'profile/badges/images/Badge_Shujin_Outlaws.webp',
   'Shujin Outlaws', 'Hors-la-loi de Shujin', 'Forajidos de Shujin', 'Shujin-Gesetzlose', 'Fuorilegge di Shujin',
   'Find Wonder''s Shujin All-Out Attack, then Ren and Wonder in Silhouette mode',
   'achievement', 'rare', 0,
   'targets_found', 'shujin_outlaws', NULL),

  ('absolute_authority',
   'profile/badges/images/Badge_Absolute_Authority.webp',
   'Absolute Authority', 'Autorité absolue', 'Autoridad absoluta', 'Absolute Autorität', 'Autorità assoluta',
   'Find Mitsuru Kirijo and Makoto Niijima in Classic mode',
   'achievement', 'rare', 0,
   'targets_found', 'absolute_authority', NULL),

  ('dont_waste_your_breath',
   'profile/badges/images/Badge_Dont_Waste_Your_Breath.webp',
   'Don''t Waste Your Breath', 'Garde ta salive', 'No gastes saliva', 'Spar dir deine Worte', 'Non sprecare il fiato',
   'Win 5 Classic Expert games on the very first guess',
   'achievement', 'epic', 0,
   'mode_expert_perfect_wins', 'classic', 5),

  ('same_energy',
   'profile/badges/images/Badge_Same_Energy.webp',
   'Same Energy', 'Même énergie', 'La misma energía', 'Dieselbe Energie', 'Stessa energia',
   'Reach Social Link rank 5 with a friend while one of you wears Motoha Arai and the other Chie Satonaka',
   'social', 'epic', 0,
   'same_energy', NULL, NULL);

-- ── Titre ────────────────────────────────────────────────────────────────────
-- « Go Beyond » est le cri de ralliement de Persona 5: The Phantom X — gardé en
-- VO dans toutes les langues, comme « Thou Art I » et « Take Your Heart ».
INSERT IGNORE INTO titles
  (slug, image_path, name_en, name_fr, name_es, name_de, name_it,
   description_en, description_fr, description_es, description_de, description_it,
   condition_type, condition_mode, condition_value, rarity)
VALUES
  ('wonder_go_beyond',
   'profile/titles/wonder_go_beyond.webp',
   'Go Beyond', 'Go Beyond', 'Go Beyond', 'Go Beyond', 'Go Beyond',
   'Everything Wonder: his five All-Out Attacks, himself in Classic and Emoji, Jánošík in Personae (normal and Expert), and every P5X song in Music (normal and Expert). Nothing left to find.',
   'Tout Wonder : ses cinq All-Out Attack, lui en Classique et en Émoji, Jánošík en Personae (normal et Expert), et toutes les musiques de P5X en Music (normal et Expert). Plus rien à trouver.',
   'Todo Wonder: sus cinco All-Out Attack, él mismo en Clásico y Emoji, Jánošík en Personae (normal y Experto), y todas las canciones de P5X en Music (normal y Experto). Ya no queda nada por encontrar.',
   'Alles über Wonder: seine fünf All-Out Attacks, er selbst in Klassik und Emoji, Jánošík in Personae (normal und Experte), und jeder P5X-Song in Music (normal und Experte). Nichts bleibt zu finden.',
   'Tutto Wonder: i suoi cinque All-Out Attack, lui in Classico ed Emoji, Jánošík in Personae (normale ed Esperto), e ogni canzone di P5X in Music (normale ed Esperto). Niente più da trovare.',
   'targets_found', 'wonder_go_beyond', NULL, 'legendary');
