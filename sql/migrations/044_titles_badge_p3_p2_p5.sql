-- ─────────────────────────────────────────────────────────────────────────────
-- 044 — Sept nouveaux titres + un badge (visuels fournis par Hamza, 2026-09-16)
--
-- Titres : S.E.E.S., Aigis & Metis, Kotone, Naoto, Shinjiro, Phantom Thieves,
-- Tatsuya. Badge : Katabasis (ex-« Tartarus Conqueror » sur le visuel — renommé,
-- le dessin montre les deux Orphée et Messiah, pas Tartarus : c'est la descente
-- d'Orphée aux Enfers, pas la tour).
--
-- Deux conditions nouvelles, ajoutées à api/lib/condition_check.php dans le même
-- lot :
--   • titles_count    → nombre de titres possédés (S.E.E.S. rassemble la troupe)
--   • played_on_date  → avoir joué un jour d'anniversaire (condition_mode 'MM-JJ')
--
-- Rejouable : INSERT IGNORE sur la clé unique `slug` (titles) et `slug` (badges).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Titres ───────────────────────────────────────────────────────────────────
INSERT IGNORE INTO titles
  (slug, image_path, name_en, name_fr, name_es, name_de, name_it,
   description_en, description_fr, description_es, description_de, description_it,
   condition_type, condition_mode, condition_value, rarity)
VALUES
  ('sees',
   'profile/titles/sees.webp',
   'S.E.E.S.', 'S.E.E.S.', 'S.E.E.S.', 'S.E.E.S.', 'S.E.E.S.',
   'A squad is not one person. Gather eight calling cards and the armband is yours.',
   'Une escouade, ce n''est pas une personne. Rassemble huit titres et le brassard est à toi.',
   'Un escuadrón no es una sola persona. Reúne ocho títulos y el brazalete es tuyo.',
   'Ein Trupp ist nicht eine Person. Sammle acht Titel, und die Armbinde gehört dir.',
   'Una squadra non è una persona sola. Raccogli otto titoli e la fascia è tua.',
   'titles_count', NULL, 8, 'epic'),

  ('aigis_metis_same_soul',
   'profile/titles/aigis_metis_same_soul.webp',
   'We Share the Same Soul', 'Nous partageons la même âme', 'Compartimos la misma alma',
   'Wir teilen dieselbe Seele', 'Condividiamo la stessa anima',
   'Take one bond all the way to rank 10. Two machines learned what that costs.',
   'Mène un lien social jusqu''au rang 10. Deux machines ont appris ce que ça coûte.',
   'Lleva un vínculo hasta el rango 10. Dos máquinas aprendieron lo que cuesta.',
   'Bring eine Bindung bis Rang 10. Zwei Maschinen haben gelernt, was das kostet.',
   'Porta un legame fino al rango 10. Due macchine hanno imparato quanto costa.',
   'social_link_min_rank', NULL, 10, 'epic'),

  ('kotone_not_a_princess',
   'profile/titles/kotone_not_a_princess.webp',
   'I Am Not a Princess', 'Je ne suis pas une princesse', 'No soy una princesa',
   'Ich bin keine Prinzessin', 'Non sono una principessa',
   'Win 25 games without a single wrong guess. Nobody is rescuing you — you do the rescuing.',
   'Gagne 25 parties sans une seule erreur. Personne ne vient te sauver : c''est toi qui sauves.',
   'Gana 25 partidas sin un solo fallo. Nadie viene a salvarte: tú salvas.',
   'Gewinne 25 Runden ohne einen einzigen Fehlversuch. Niemand rettet dich — du rettest.',
   'Vinci 25 partite senza un solo errore. Nessuno viene a salvarti: salvi tu.',
   'perfect_wins', NULL, 25, 'rare'),

  ('naoto_case_never_closed',
   'profile/titles/naoto_case_never_closed.webp',
   'The Case Is Never Closed', 'L''affaire n''est jamais close', 'El caso nunca se cierra',
   'Der Fall ist nie abgeschlossen', 'Il caso non è mai chiuso',
   'Identify 25 silhouettes. A detective does not stop at the first confession.',
   'Identifie 25 silhouettes. Un détective ne s''arrête pas aux premiers aveux.',
   'Identifica 25 siluetas. Un detective no se detiene en la primera confesión.',
   'Erkenne 25 Silhouetten. Ein Detektiv hört nicht beim ersten Geständnis auf.',
   'Identifica 25 sagome. Un detective non si ferma alla prima confessione.',
   'mode_wins', 'silhouette', 25, 'rare'),

  ('shinjiro_no_pity',
   'profile/titles/shinjiro_no_pity.webp',
   'Don''t Need Your Pity', 'J''ai pas besoin de ta pitié', 'No necesito tu lástima',
   'Spar dir dein Mitleid', 'Non mi serve la tua pietà',
   'Land 25 quick wins in Classic. No hints, no help, no pity.',
   'Décroche 25 victoires rapides en Classique. Pas d''indice, pas d''aide, pas de pitié.',
   'Consigue 25 victorias rápidas en Clásico. Sin pistas, sin ayuda, sin lástima.',
   'Hol dir 25 schnelle Siege im Klassik-Modus. Keine Hinweise, keine Hilfe, kein Mitleid.',
   'Ottieni 25 vittorie rapide in Classico. Niente indizi, niente aiuto, niente pietà.',
   'mode_wins_under_attempts', 'classic', 25, 'epic'),

  ('take_your_heart',
   'profile/titles/take_your_heart.webp',
   'Take Your Heart', 'Je prends ton cœur', 'Te robaré el corazón',
   'Ich nehme dein Herz', 'Ti rubo il cuore',
   'Win 40 All-Out Attack rounds. The calling card is only the beginning.',
   'Gagne 40 parties en All-Out Attack. La carte de visite n''est qu''un début.',
   'Gana 40 partidas de All-Out Attack. La tarjeta de presentación es solo el principio.',
   'Gewinne 40 All-Out-Attack-Runden. Die Visitenkarte ist erst der Anfang.',
   'Vinci 40 partite in All-Out Attack. Il biglietto da visita è solo l''inizio.',
   'mode_wins', 'alloutattack', 40, 'legendary'),

  ('tatsuya_dont_burn_out',
   'profile/titles/tatsuya_dont_burn_out.webp',
   'Some Things Don''t Burn Out', 'Certaines choses ne s''éteignent pas',
   'Algunas cosas no se apagan', 'Manches erlischt nie', 'Certe cose non si spengono',
   'Play on 24 June, any year — the day Innocent Sin came out. A flame kept alight since 1999.',
   'Joue un 24 juin, n''importe quelle année — le jour de la sortie d''Innocent Sin. Une flamme entretenue depuis 1999.',
   'Juega un 24 de junio, cualquier año: el día en que salió Innocent Sin. Una llama encendida desde 1999.',
   'Spiel an einem 24. Juni, egal welches Jahr — dem Erscheinungstag von Innocent Sin. Eine Flamme, die seit 1999 brennt.',
   'Gioca un 24 giugno, in qualsiasi anno — il giorno di uscita di Innocent Sin. Una fiamma accesa dal 1999.',
   'played_on_date', '06-24', NULL, 'legendary');

-- ── Badge ────────────────────────────────────────────────────────────────────
-- Katabasis : la descente d'Orphée aux Enfers. Le visuel montre les deux Orphée
-- (Makoto et Kotone) et Messiah — c'est la descente ET le retour, pas la tour.
-- La table badges ne porte ni description ni condition traduite : les textes
-- vivent dans profile/badges/badgesData.js et lang/*.json (badges.katabasis.*).
INSERT IGNORE INTO badges
  (slug, image_path, name_en, name_fr, name_es, name_de, name_it,
   condition_en, category, rarity, is_secret,
   condition_type, condition_mode, condition_value)
VALUES
  ('katabasis',
   'profile/badges/images/Badge_Katabasis.webp',
   'Katabasis', 'Katabasis', 'Katabasis', 'Katabasis', 'Katabasis',
   'Win 25 games in Expert Mode',
   'achievement', 'epic', 0,
   'expert_wins_total', NULL, 25);
