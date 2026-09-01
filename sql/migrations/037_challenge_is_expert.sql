-- =============================================================================
-- 037 — Défis en Mode Expert
-- =============================================================================
-- Jusqu'ici l'Expert n'émettait aucun défi et n'en jouait aucun : plusieurs
-- gardes côté client (js/gameCore.js, js/challenge-result.js) le neutralisaient
-- explicitement. La raison était structurelle, pas frileuse — `activeChallenge`
-- (localStorage) n'est PAS cloisonné par Expert, donc sans cette colonne :
--   - un défi créé en mode normal s'imposait comme cible en Expert ;
--   - et une victoire en Expert validait le défi normal, avec un barème qui
--     n'a rien à voir (l'Expert donne un seul indice, les essais ne se
--     comparent pas à ceux du mode normal).
--
-- Cette colonne est ce qui manquait pour lever ces gardes proprement.
--
-- ── Pourquoi une colonne et non un type de message séparé ────────────────────
-- Même raisonnement que `game_sessions.is_expert` (migration 031) : l'Expert est
-- une DIMENSION du mode, pas un mode de plus. Un `type = 'challenge_expert'`
-- aurait dupliqué toute la logique de défi (création, acceptation, statuts,
-- barème) pour une seule différence de règle.
--
-- ── Conséquence sur l'anti-doublon ───────────────────────────────────────────
-- Le garde « un seul défi par jour entre deux amis » (api/messages/index.php)
-- inclut désormais cette colonne : un joueur peut proposer le même jour un défi
-- normal ET un défi Expert au même ami. Ce sont deux jeux différents, avec deux
-- cibles et deux barèmes ; les confondre interdirait arbitrairement le second.
-- La règle « un seul défi vivant par expéditeur » est cloisonnée de la même
-- façon, pour la même raison.
--
-- Défaut 0 : tous les défis existants sont des défis normaux — c'était le seul
-- cas possible avant cette migration.
--
-- ⚠️ Syntaxe MariaDB (`ADD COLUMN IF NOT EXISTS`), comme les migrations 031/032.
-- MySQL 8.0 la refuse. La prod tourne en MariaDB 10.6.
--
-- Idempotente : rejouable sans effet de bord.
-- =============================================================================

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS challenge_is_expert TINYINT(1) NOT NULL DEFAULT 0
    AFTER challenge_target;

-- L'anti-doublon interroge (paire, date, statut, expert) à chaque envoi de défi.
-- Sans cet index, la vérification devient un scan complet dès que `messages`
-- grossit — et elle est sur le chemin critique de l'envoi.
CREATE INDEX IF NOT EXISTS idx_messages_challenge_dedup
    ON messages (sender_id, receiver_id, challenge_date, challenge_is_expert, status);
