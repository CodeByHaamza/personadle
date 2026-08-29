<?php
/**
 * api/cron/leaderboard.php — Recalcul du leaderboard_cache
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/leaderboard.php
 *   Header: X-Cron-Key: <CRON_SECRET>
 *
 * Fréquence recommandée : toutes les heures.
 * Sécurité : clé secrète en header (hash_equals), aucune info sensible en réponse.
 *
 * Note : 'ever' est exclu — l'API lit directement user_stats (temps réel,
 * pas de cache). Seuls day/week/month sont alimentés ici.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/leaderboard_metrics.php';

requireCronSecret();

$pdo   = pdo();
$start = microtime(true);
$paris = new DateTimeZone('Europe/Paris');
$now   = new DateTime('now', $paris);

$modes = ['all', 'classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];

// 'ever' exclu : l'API le calcule live depuis user_stats, jamais depuis le cache.
$periods = [
    'day'   => (clone $now)->setTime(0, 0, 0)->format('Y-m-d'),
    'week'  => (clone $now)->modify('monday this week')->setTime(0, 0, 0)->format('Y-m-d'),
    'month' => (clone $now)->modify('first day of this month')->setTime(0, 0, 0)->format('Y-m-d'),
];

$metrics = ['wins', 'winrate', 'streak', 'perfect', 'games'];

$processed = 0;
$errors    = [];

$cleanStmt = $pdo->prepare("
    DELETE FROM leaderboard_cache
    WHERE mode = ? AND period = ? AND period_start != ?
");

foreach ($modes as $mode) {
    foreach ($periods as $period => $periodStart) {
        // Purger les entrées des périodes précédentes (ex: semaine passée).
        // L'API ne filtre pas sur period_start — sans ce nettoyage, d'anciens
        // rangs s'accumulent et faussent les résultats.
        try {
            $cleanStmt->execute([$mode, $period, $periodStart . ' 00:00:00']);
        } catch (Throwable $e) {
            $errors[] = "cleanup $mode/$period: " . $e->getMessage();
        }

        foreach ($metrics as $metric) {
            try {
                _recalculate($pdo, $mode, $period, $periodStart, $metric);
                $processed++;
            } catch (Throwable $e) {
                $errors[] = "$mode/$period/$metric: " . $e->getMessage();
            }
        }
    }
}

$elapsed = round((microtime(true) - $start) * 1000);
jsonSuccess([
    'processed'  => $processed,
    'errors'     => $errors,
    'elapsed_ms' => $elapsed,
    'ran_at'     => $now->format('Y-m-d H:i:s'),
]);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recalcule et met à jour leaderboard_cache pour un combo (mode, period, metric).
 *
 * Utilise game_sessions filtré par period_start — les scores reflètent
 * l'activité réelle de la période (jour/semaine/mois en cours), pas les
 * totaux cumulatifs de user_stats.
 *
 * 'streak' calcule la vraie série de jours consécutifs (méthode des îlots,
 * api/lib/leaderboard_metrics.php) — identique au fallback live de
 * buildPeriodLeaderboardLive, puisque les deux appellent la même fonction.
 */
function _recalculate(PDO $pdo, string $mode, string $period, string $periodStart, string $metric): void
{
    $modeFilter = ($mode === 'all') ? '' : 'AND gs.mode = :mode';

    // ── Le classement compte des PARTIES, volontairement ─────────────────────
    // Décision produit (Hamza) : « toutes les parties comptent » vaut aussi pour le
    // classement. 100 victoires jouées dans la journée valent 100 — compter des
    // jours distincts pénaliserait le joueur assidu, qui est précisément celui que
    // le classement doit récompenser. Les axes ratio et série donnent les autres
    // angles de lecture, chacun avec sa propre règle.
    //
    // Les formules vivent dans api/lib/leaderboard_metrics.php, partagées avec
    // api/leaderboard/index.php. Elles étaient auparavant recopiées ici, avec pour
    // seul garde-fou un commentaire « doit rester identique à ». Une divergence
    // ne se serait vue qu'en comparant deux périodes entre elles — jamais sur un
    // écran isolé, puisque ce cron alimente le cache que l'endpoint relit.
    $params = [':period_start' => $periodStart];
    if ($mode !== 'all') $params[':mode'] = $mode;

    if ($metric === 'streak') {
        // La série n'est pas une agrégation : elle a sa propre requête.
        $sql = personadle_period_streak_scores_sql($modeFilter, '', ':period_start')
            . ' ORDER BY score DESC LIMIT 500';
    } else {
        $prior     = personadle_leaderboard_prior($pdo, $mode);
        $scoreExpr = personadle_period_score_expr($metric, $prior);
        if ($scoreExpr === null) return; // métrique inconnue : rien à recalculer

        // Seuil de participation : le lissage bayésien donnerait la moyenne du
        // site à un joueur sans partie. Cf. api/leaderboard/index.php.
        $participation = $metric === 'winrate' ? 'AND COUNT(*) >= 1' : '';

        $sql = "
            SELECT
                gs.user_id,
                ({$scoreExpr}) AS score
            FROM game_sessions gs
            JOIN users u ON u.id = gs.user_id AND u.is_deleted = 0
            WHERE gs.played_date >= :period_start
              -- is_expert = 0 : le classement Expert est une dimension à part (ROADMAP
              -- v2.1), pas encore exposée. Sans ça les parties Expert gonfleraient le
              -- classement du mode normal.
              AND gs.is_expert = 0
            {$modeFilter}
            GROUP BY gs.user_id
            HAVING score IS NOT NULL AND score > 0 {$participation}
            ORDER BY score DESC
            LIMIT 500
        ";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $periodStartDt = $periodStart . ' 00:00:00';

    $upsert = $pdo->prepare("
        INSERT INTO leaderboard_cache
            (user_id, mode, period, metric, score, rank_position, period_start, updated_at)
        VALUES
            (:user_id, :mode, :period, :metric, :score, :rank, :period_start, NOW())
        ON DUPLICATE KEY UPDATE
            score         = VALUES(score),
            rank_position = VALUES(rank_position),
            updated_at    = NOW()
    ");

    foreach ($rows as $i => $row) {
        $upsert->execute([
            ':user_id'      => $row['user_id'],
            ':mode'         => $mode,
            ':period'       => $period,
            ':metric'       => $metric,
            ':score'        => $row['score'],
            ':rank'         => $i + 1,
            ':period_start' => $periodStartDt,
        ]);
    }
}
