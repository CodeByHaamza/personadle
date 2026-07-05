<?php
/**
 * PATCH /api/admin/users/:id/stats
 *
 * Écrase les stats d'un utilisateur pour un mode donné (UPSERT).
 * Body : { "mode": "classic", "wins": 50, "giveups": 3, "games": 53,
 *          "streak": 10, "streak_record": 15, "perfect_wins": 5,
 *          "total_time_ms": 12345 }
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'PATCH') jsonError('Method Not Allowed', 405);

// ── Extraire userId depuis l'URL ──────────────────────────────────────────────
$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

// Vérifier que l'utilisateur existe
$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$userId]);
if (!$stmt->fetch()) jsonError('User not found', 404);

// ── Lire et valider le body ───────────────────────────────────────────────────
$data = getJsonBody();

$validModes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
$mode = trim((string) ($data['mode'] ?? ''));
if (!in_array($mode, $validModes, true)) {
    jsonError('Invalid mode. Valid values: ' . implode(', ', $validModes), 400);
}

$intFields = ['wins', 'giveups', 'games', 'streak', 'streak_record', 'perfect_wins'];
$values    = [];

foreach ($intFields as $field) {
    if (!array_key_exists($field, $data)) {
        jsonError("Missing required field: {$field}", 400);
    }
    $val = (int) $data[$field];
    if ($val < 0) jsonError("Field {$field} must be >= 0", 400);
    $values[$field] = $val;
}

// total_time_ms est optionnel — on garde la valeur existante si non fourni
if (array_key_exists('total_time_ms', $data)) {
    $val = (int) $data['total_time_ms'];
    if ($val < 0) jsonError("Field total_time_ms must be >= 0", 400);
    $values['total_time_ms'] = $val;
} else {
    $existing = $pdo->prepare('SELECT total_time_ms FROM user_stats WHERE user_id = ? AND mode = ? LIMIT 1');
    $existing->execute([$userId, $mode]);
    $row = $existing->fetch();
    $values['total_time_ms'] = $row ? (int) $row['total_time_ms'] : 0;
}

// ── UPSERT ────────────────────────────────────────────────────────────────────
$pdo->prepare(
    'INSERT INTO user_stats
        (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
        wins           = VALUES(wins),
        giveups        = VALUES(giveups),
        games          = VALUES(games),
        streak         = VALUES(streak),
        streak_record  = VALUES(streak_record),
        perfect_wins   = VALUES(perfect_wins),
        total_time_ms  = VALUES(total_time_ms)'
)->execute([
    $userId,
    $mode,
    $values['wins'],
    $values['giveups'],
    $values['games'],
    $values['streak'],
    $values['streak_record'],
    $values['perfect_wins'],
    $values['total_time_ms'],
]);

personadle_log_admin_action($pdo, $adminId, 'user_stats.overwrite', 'user', (string) $userId, [
    'mode' => $mode,
    ...$values,
]);

jsonSuccess(['success' => true]);
