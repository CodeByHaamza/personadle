<?php
/**
 * api/cron/leaderboard.php — Recalcul du leaderboard_cache
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/leaderboard.php?key=<CRON_SECRET>
 *
 * Fréquence recommandée : toutes les heures.
 * Sécurité : clé secrète (hash_equals), aucune info sensible en réponse.
 *
 * Note : 'ever' est exclu — l'API lit directement user_stats (temps réel,
 * pas de cache). Seuls day/week/month sont alimentés ici.
 */

require_once __DIR__ . '/../bootstrap.php';

// ── Vérification clé secrète ──────────────────────────────────────────────────
$key = $_GET['key'] ?? '';
if (!defined('CRON_SECRET') || !hash_equals(CRON_SECRET, $key)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

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
 * 'streak' sur une période courte = nb de victoires (approximation identique
 * au fallback live dans buildPeriodLeaderboardLive).
 */
function _recalculate(PDO $pdo, string $mode, string $period, string $periodStart, string $metric): void
{
    $modeFilter = ($mode === 'all') ? '' : 'AND gs.mode = :mode';

    $scoreExpr = match ($metric) {
        'wins'    => "SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END)",
        'winrate' => "IF(COUNT(*) >= 5, ROUND(SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1), NULL)",
        'streak'  => "SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END)",
        'perfect' => "SUM(CASE WHEN gs.result = 'win' AND gs.attempts = 1 THEN 1 ELSE 0 END)",
        'games'   => 'COUNT(*)',
        default   => "SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END)",
    };

    $sql = "
        SELECT
            gs.user_id,
            ({$scoreExpr}) AS score
        FROM game_sessions gs
        JOIN users u ON u.id = gs.user_id AND u.is_deleted = 0
        WHERE gs.played_date >= :period_start
        {$modeFilter}
        GROUP BY gs.user_id
        HAVING score IS NOT NULL AND score > 0
        ORDER BY score DESC
        LIMIT 500
    ";

    $params = [':period_start' => $periodStart];
    if ($mode !== 'all') $params[':mode'] = $mode;

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
