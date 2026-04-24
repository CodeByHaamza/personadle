<?php
/**
 * api/cron/leaderboard.php — Recalcul du leaderboard_cache
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/leaderboard.php?key=<CRON_SECRET>
 *
 * Fréquence recommandée : toutes les heures.
 * Sécurité : clé secrète (hash_equals), aucune info sensible en réponse.
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

$periods = [
    'day'   => (clone $now)->setTime(0, 0, 0)->format('Y-m-d H:i:s'),
    'week'  => (clone $now)->modify('monday this week')->setTime(0, 0, 0)->format('Y-m-d H:i:s'),
    'month' => (clone $now)->modify('first day of this month')->setTime(0, 0, 0)->format('Y-m-d H:i:s'),
    'ever'  => '2000-01-01 00:00:00',
];

$metrics = ['wins', 'winrate', 'streak', 'perfect', 'games'];

$processed = 0;
$errors    = [];

foreach ($modes as $mode) {
    foreach ($periods as $period => $periodStart) {
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

function _recalculate(PDO $pdo, string $mode, string $period, string $periodStart, string $metric): void {
    $modeFilter = ($mode === 'all') ? '' : 'AND us.mode = :mode';

    $orderBy = match ($metric) {
        'wins'    => 'total_wins DESC',
        'winrate' => 'winrate DESC',
        'streak'  => 'best_streak DESC',
        'perfect' => 'total_perfect DESC',
        'games'   => 'total_games DESC',
        default   => 'total_wins DESC',
    };

    $sql = "
        SELECT
            us.user_id,
            SUM(us.wins)          AS total_wins,
            SUM(us.games)         AS total_games,
            SUM(us.perfect_wins)  AS total_perfect,
            MAX(us.streak_record) AS best_streak,
            CASE
                WHEN SUM(us.games) > 0
                THEN ROUND(SUM(us.wins) / SUM(us.games) * 100, 1)
                ELSE 0
            END AS winrate
        FROM user_stats us
        JOIN users u ON u.id = us.user_id AND u.is_deleted = 0
        WHERE 1=1 $modeFilter
        GROUP BY us.user_id
        HAVING total_games > 0
        ORDER BY $orderBy
        LIMIT 500
    ";

    $params = [];
    if ($mode !== 'all') $params[':mode'] = $mode;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $scoreField = match ($metric) {
        'wins'    => 'total_wins',
        'winrate' => 'winrate',
        'streak'  => 'best_streak',
        'perfect' => 'total_perfect',
        'games'   => 'total_games',
        default   => 'total_wins',
    };

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
            ':score'        => $row[$scoreField],
            ':rank'         => $i + 1,
            ':period_start' => $periodStart,
        ]);
    }
}
