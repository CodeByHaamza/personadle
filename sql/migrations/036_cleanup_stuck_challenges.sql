-- =============================================================================
-- 036 — Nettoyage des défis bloqués en statut « accepted »
-- =============================================================================
-- Répare l'existant que le correctif du 2026-08-15 ne pouvait pas atteindre :
-- il empêche d'en CRÉER de nouveaux (ordre des opérations inversé dans les deux
-- points d'acceptation), mais les lignes déjà coincées en base y sont restées.
--
-- Rappel du cycle de vie d'un défi (js/challenge-result.js) :
--   unread → accepted → beaten   (relevé : victoire dans le nombre d'essais)
--                     → expired  (tenté et manqué)
-- Un défi qui reste `accepted` n'a donc JAMAIS été mené au bout.
--
-- ── Écart n°1 avec TODO.md : `read` et non `unread` ──────────────────────────
-- Le TODO prévoyait de repasser ces lignes en `unread`. C'est le mauvais état :
-- `unread` les ferait ressurgir comme des notifications NEUVES, et le joueur
-- verrait apparaître des défis vieux de plusieurs semaines, pour une date de
-- jeu depuis longtemps passée. `expired` serait tout aussi faux — il signifie
-- « tenté et manqué », alors qu'aucune partie n'a eu lieu, et l'expéditeur
-- lirait une défaite qui n'a jamais existé.
-- `read` est le seul état honnête : vu, jamais joué, ne bloque plus rien. C'est
-- aussi l'état que pose le bouton « abandonner » (js/challenge-banner.js), donc
-- nettoyage et abandon laissent la base dans la même forme.
--
-- ── Écart n°2 : pas de test « sans partie associée » ─────────────────────────
-- Le TODO prévoyait d'épargner les défis ayant une partie associée. Vérifié :
-- ce test n'apporte aucune sécurité et laisse au contraire des lignes cassées.
-- `updateStatus()` est appelé en fire-and-forget côté client
-- (`.catch(() => {})`, js/challenge-result.js) : une coupure réseau au mauvais
-- moment laisse un défi RÉELLEMENT joué en `accepted`. Ces lignes-là ont bien
-- une partie associée — les exclure les condamnerait à rester bloquées.
-- Passé 7 jours, un défi est terminé dans les deux cas, et `read` est correct
-- pour les deux. La fenêtre de 7 jours suffit donc à protéger les défis
-- légitimement en cours, ce qui était le vrai but de la clause.
--
-- ⚠️ NON IDEMPOTENTE PAR NATURE, mais sans danger au rejeu : la seconde
-- exécution ne trouvera plus de lignes `accepted` de plus de 7 jours (elles
-- sont devenues `read`), donc elle ne touchera rien. Le seul risque serait de
-- la lancer sur une base où des défis récents seraient légitimement en cours —
-- d'où la borne de 7 jours, à ne pas retirer.
--
-- 💾 BACKUP RECOMMANDÉ avant exécution : ce script modifie des lignes
-- existantes et il n'existe pas de chemin de retour automatique.
--
-- Pour inspecter AVANT d'appliquer (à lancer seul, sans le UPDATE) :
--   SELECT id, sender_id, receiver_id, challenge_mode, challenge_date, status
--   FROM messages
--   WHERE type = 'challenge' AND status = 'accepted'
--     AND challenge_date < (CURRENT_DATE - INTERVAL 7 DAY);
-- =============================================================================

UPDATE messages
SET status = 'read'
WHERE type = 'challenge'
  AND status = 'accepted'
  -- Les défis sans `challenge_date` (aucun n'existe en principe) sont écartés
  -- par la comparaison : NULL < X vaut NULL, donc faux. C'est le comportement
  -- voulu — on ne touche pas à ce qu'on ne sait pas dater.
  AND challenge_date < (CURRENT_DATE - INTERVAL 7 DAY);
