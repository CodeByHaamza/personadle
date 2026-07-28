-- 028_reconcile_user_stats_from_sessions.sql
--
-- Backfill ponctuel : recalcule games/wins/giveups/perfect_wins/total_time_ms de
-- user_stats à partir de game_sessions (source de vérité brute, jamais affectée
-- par le bug ci-dessous — les sessions y sont toujours insérées, seul l'agrégat
-- pouvait se perdre).
--
-- Root cause corrigée en code (api/user/migrate.php, cf. DEV_CHANGELOG.md
-- 2026-07-28) : la migration des sessions localStorage → compte cloud (à
-- l'inscription) faisait un UPDATE user_stats SANS garantir d'abord que la
-- ligne (user_id, mode) existe. Sur un compte neuf, l'UPDATE matchait 0 ligne
-- (PDO ne lève rien) → games/wins/giveups/perfect_wins/total_time_ms restaient
-- à zéro pour CE mode précis, alors que game_sessions recevait bien les
-- lignes. Symptôme concret repéré en prod : un joueur avec 100+ victoires
-- réelles en mode Music (son mode le plus joué) affichait "Emoji" en mode
-- préféré et n'apparaissait pas dans le classement Music — sa ligne
-- user_stats(mode='music') était restée à zéro (ou absente).
--
-- Le fix en code empêche que ça se reproduise pour les futures migrations,
-- mais ne corrige PAS rétroactivement les comptes déjà affectés (angle mort
-- documenté dans DEV_CHANGELOG.md) — c'est l'objet de cette migration.
--
-- Volontairement PAS touché : streak / streak_record / last_played_at /
-- first_played_at. Ce sont des champs dérivés de la consécutivité jour par
-- jour des parties (personadle_compute_streak(), api/lib/game_session.php),
-- pas de simples agrégats — les recalculer naïvement depuis game_sessions
-- écraserait des streaks en cours légitimes. Ils continuent de s'incrémenter
-- normalement à la prochaine partie réelle de l'utilisateur.
--
-- Idempotent : peut être rejouée sans risque (recalcule toujours les mêmes
-- sommes depuis game_sessions, qui n'est jamais modifiée par ce script).
INSERT INTO user_stats (user_id, mode, games, wins, giveups, perfect_wins, total_time_ms)
SELECT
    gs.user_id,
    gs.mode,
    COUNT(*)                                                              AS games,
    SUM(CASE WHEN gs.result = 'win'                       THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN gs.result = 'giveup'                    THEN 1 ELSE 0 END) AS giveups,
    SUM(CASE WHEN gs.result = 'win' AND gs.attempts = 1   THEN 1 ELSE 0 END) AS perfect_wins,
    COALESCE(SUM(gs.time_ms), 0)                                          AS total_time_ms
FROM game_sessions gs
GROUP BY gs.user_id, gs.mode
ON DUPLICATE KEY UPDATE
    games         = VALUES(games),
    wins          = VALUES(wins),
    giveups       = VALUES(giveups),
    perfect_wins  = VALUES(perfect_wins),
    total_time_ms = VALUES(total_time_ms);
