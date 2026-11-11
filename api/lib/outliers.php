<?php

declare(strict_types=1);

/**
 * api/lib/outliers.php — Comptes hors norme (2.4, lot 16).
 *
 * Des SIGNAUX statistiques sur les parties normales d'une période, pour que
 * l'admin regarde de plus près — jamais une sanction automatique. Chaque seuil
 * est une constante, et la décision est une fonction pure (testée dans
 * tests/php/OutliersTest.php) : on sait toujours POURQUOI un compte est remonté.
 *
 * - replay_farming : beaucoup de parties par partie du jour — monter au
 *   classement « toutes les parties » à force de Rejouer ;
 * - perfect_rate   : trop de victoires du premier coup sur les parties du jour —
 *   la cible du jour est tirée par joueur, la deviner d'emblée aussi souvent
 *   suppose de la connaître ;
 * - win_rate       : quasiment jamais un abandon sur un volume réel ;
 * - fast_wins      : la moitié des victoires en moins de 4 secondes.
 */

const PERSONADLE_OUTLIER_MIN_GAMES       = 20;   // en dessous, pas assez de parties pour juger
const PERSONADLE_OUTLIER_REPLAY_RATIO    = 4.0;  // parties par partie du jour
const PERSONADLE_OUTLIER_REPLAY_MIN      = 60;   // et au moins tant de parties
const PERSONADLE_OUTLIER_PERFECT_RATIO   = 0.6;  // victoires du 1er coup / parties du jour
const PERSONADLE_OUTLIER_PERFECT_MIN     = 20;
const PERSONADLE_OUTLIER_WIN_RATIO       = 0.98; // victoires / parties du jour
const PERSONADLE_OUTLIER_WIN_MIN         = 30;
const PERSONADLE_OUTLIER_FAST_MS         = 4000;
const PERSONADLE_OUTLIER_FAST_RATIO      = 0.5;  // victoires rapides / victoires
const PERSONADLE_OUTLIER_FAST_MIN        = 20;

/**
 * Signaux levés par un compte. Pure.
 *
 * @param array{total:int, daily:int, daily_wins:int, daily_perfect:int, wins:int, fast_wins:int} $r
 * @return list<string>
 */
function personadle_outlier_flags(array $r): array
{
    $flags = [];
    $daily = max(0, (int) $r['daily']);
    if ($r['total'] >= PERSONADLE_OUTLIER_REPLAY_MIN && $r['total'] / max(1, $daily) >= PERSONADLE_OUTLIER_REPLAY_RATIO) {
        $flags[] = 'replay_farming';
    }
    if ($daily >= PERSONADLE_OUTLIER_PERFECT_MIN && $r['daily_perfect'] / $daily >= PERSONADLE_OUTLIER_PERFECT_RATIO) {
        $flags[] = 'perfect_rate';
    }
    if ($daily >= PERSONADLE_OUTLIER_WIN_MIN && $r['daily_wins'] / $daily >= PERSONADLE_OUTLIER_WIN_RATIO) {
        $flags[] = 'win_rate';
    }
    if ($r['wins'] >= PERSONADLE_OUTLIER_FAST_MIN && $r['fast_wins'] / $r['wins'] >= PERSONADLE_OUTLIER_FAST_RATIO) {
        $flags[] = 'fast_wins';
    }
    return $flags;
}

/**
 * Comptes hors norme sur les `$days` derniers jours (parties normales).
 *
 * @return list<array<string, mixed>>
 */
function personadle_find_outliers(PDO $pdo, int $days): array
{
    $stmt = $pdo->prepare(
        'SELECT gs.user_id, u.pseudo, u.is_banned,
                COUNT(*)                                                         AS total,
                SUM(gs.is_daily = 1)                                             AS daily,
                SUM(gs.is_daily = 1 AND gs.result = \'win\')                     AS daily_wins,
                SUM(gs.is_daily = 1 AND gs.result = \'win\' AND gs.attempts = 1) AS daily_perfect,
                SUM(gs.result = \'win\')                                         AS wins,
                SUM(gs.result = \'win\' AND gs.time_ms IS NOT NULL AND gs.time_ms < ?) AS fast_wins
         FROM game_sessions gs
         JOIN users u ON u.id = gs.user_id AND u.is_deleted = 0
         WHERE gs.is_expert = 0
           AND gs.played_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY gs.user_id, u.pseudo, u.is_banned
         HAVING total >= ?'
    );
    $stmt->execute([PERSONADLE_OUTLIER_FAST_MS, $days, PERSONADLE_OUTLIER_MIN_GAMES]);

    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $r = [
            'total'         => (int) $row['total'],
            'daily'         => (int) $row['daily'],
            'daily_wins'    => (int) $row['daily_wins'],
            'daily_perfect' => (int) $row['daily_perfect'],
            'wins'          => (int) $row['wins'],
            'fast_wins'     => (int) $row['fast_wins'],
        ];
        $flags = personadle_outlier_flags($r);
        if ($flags === []) continue;
        $out[] = [
            'user_id'   => (int) $row['user_id'],
            'pseudo'    => $row['pseudo'],
            'is_banned' => (bool) $row['is_banned'],
            'flags'     => $flags,
        ] + $r;
    }
    usort($out, static fn ($a, $b) => [count($b['flags']), $b['total']] <=> [count($a['flags']), $a['total']]);
    return $out;
}
