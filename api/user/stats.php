<?php
/**
 * GET /api/user/:id/stats
 * ────────────────────────────────────────────────────────────────────────────
 * Retourne les statistiques de jeu d'un utilisateur, tous modes confondus.
 *
 * Accès : connecté (ses propres stats uniquement pour l'instant)
 * Succès : 200 { stats: { by_mode: [...], global: {...} } }
 */

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$authId = requireAuth();

// Extraire :id depuis l'URL — /api/user/42/stats
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
// ex: ['personadle', 'api', 'user', '42', 'stats']
$userId = 0;
foreach ($parts as $i => $part) {
    if ($part === 'user' && isset($parts[$i + 1])) {
        $userId = (int) $parts[$i + 1];
        break;
    }
}

if ($userId <= 0) {
    jsonError('Invalid user id', 400);
}

// Pour l'instant : on ne permet de consulter que ses propres stats
// (les stats publiques d'un ami seront gérées plus tard)
if ($userId !== $authId) {
    jsonError('Forbidden', 403);
}

$pdo  = pdo();
$stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? ORDER BY mode');
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

// Agréger les stats globales (tous modes confondus)
$global = [
    'total_games'        => 0,
    'total_wins'         => 0,
    'total_giveups'      => 0,
    'best_streak'        => 0,
    'total_perfect_wins' => 0,
    'total_time_ms'      => 0,
];

$byMode = [];
foreach ($rows as $row) {
    $byMode[] = [
        'mode'          => $row['mode'],
        'games'         => (int) $row['games'],
        'wins'          => (int) $row['wins'],
        'giveups'       => (int) $row['giveups'],
        'streak'        => (int) $row['streak'],
        'streak_record' => (int) $row['streak_record'],
        'perfect_wins'  => (int) $row['perfect_wins'],
        'total_time_ms' => (int) $row['total_time_ms'],
        'last_played_at'=> $row['last_played_at'],
    ];

    $global['total_games']        += (int) $row['games'];
    $global['total_wins']         += (int) $row['wins'];
    $global['total_giveups']      += (int) $row['giveups'];
    $global['best_streak']         = max($global['best_streak'], (int) $row['streak_record']);
    $global['total_perfect_wins'] += (int) $row['perfect_wins'];
    $global['total_time_ms']      += (int) $row['total_time_ms'];
}

jsonSuccess([
    'stats' => [
        'by_mode' => $byMode,
        'global'  => $global,
    ],
]);
