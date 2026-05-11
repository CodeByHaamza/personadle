<?php
/**
 * POST /api/sessions
 * ────────────────────────────────────────────────────────────────────────────
 * Enregistre une partie terminée et met à jour user_stats.
 *
 * Body JSON : {
 *   mode, played_date, target_name, result, attempts, time_ms, active_filters
 * }
 * Succès : 201 { session_id, stats }
 * Erreurs : 400 (validation), 401 (non connecté), 409 (partie déjà enregistrée)
 */

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

$userId = requireAuth();
$data   = getJsonBody();

// ── Validation ────────────────────────────────────────────────────────────────
$validModes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];

$mode        = strtolower(trim($data['mode']        ?? ''));
$playedDate  =            trim($data['played_date'] ?? '');
$targetName  =            trim($data['target_name'] ?? '');
$result      = strtolower(trim($data['result']      ?? ''));
$attempts    = (int)           ($data['attempts']   ?? 0);
$timeMs      = (int)           ($data['time_ms']    ?? 0);
$filters     =                  $data['active_filters'] ?? [];

if (!in_array($mode, $validModes, true)) {
    jsonError("Invalid mode. Expected one of: " . implode(', ', $validModes));
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $playedDate)) {
    jsonError('Invalid played_date format. Expected YYYY-MM-DD');
}
if (empty($targetName)) {
    jsonError('target_name is required');
}
if (!in_array($result, ['win', 'giveup'], true)) {
    jsonError("Invalid result. Expected 'win' or 'giveup'");
}
if ($attempts < 0 || $attempts > 20) {
    jsonError('Invalid attempts value');
}
if (!is_array($filters)) {
    $filters = [];
}

$pdo = pdo();

// ── Anti-doublon : une seule session par (user, mode, date) ──────────────────
$stmt = $pdo->prepare('
    SELECT id FROM game_sessions
    WHERE user_id = ? AND mode = ? AND played_date = ?
    LIMIT 1
');
$stmt->execute([$userId, $mode, $playedDate]);
if ($stmt->fetch()) {
    jsonError("Session already recorded for mode '$mode' on $playedDate", 409);
}

$pdo->beginTransaction();
try {
    // 1. Insérer la session
    $pdo->prepare('
        INSERT INTO game_sessions
            (user_id, mode, played_date, target_name, result, attempts, time_ms, active_filters)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $userId,
        $mode,
        $playedDate,
        $targetName,
        $result,
        $attempts,
        $timeMs,
        json_encode($filters),
    ]);
    $sessionId = (int) $pdo->lastInsertId();

    // 2. Lire les stats actuelles pour calculer la streak
    $stmt = $pdo->prepare('
        SELECT * FROM user_stats WHERE user_id = ? AND mode = ? LIMIT 1
    ');
    $stmt->execute([$userId, $mode]);
    $stats = $stmt->fetch();

    // Calcul de la streak :
    // - Victoire consécutive (hier → aujourd'hui) → streak + 1
    // - Victoire après saut de jours → streak reset à 1
    // - Abandon → streak reset à 0
    // - Partie parfaite (victoire en 1 essai) → perfect_wins + 1
    $isWin     = $result === 'win';
    $isPerfect = $isWin && $attempts === 1;

    $lastPlayed = $stats['last_played_at'] ?? null;
    if ($lastPlayed) {
        $lastDate = (new DateTime($lastPlayed, new DateTimeZone('UTC')))
            ->setTimezone(new DateTimeZone('Europe/Paris'))
            ->format('Y-m-d');
        $playedDt    = new DateTime($playedDate, new DateTimeZone('Europe/Paris'));
        $lastDt      = new DateTime($lastDate,   new DateTimeZone('Europe/Paris'));
        $daysDiff    = (int) $lastDt->diff($playedDt)->format('%r%a');
        $consecutive = $daysDiff === 1;
    } else {
        $consecutive = false; // première partie jamais jouée dans ce mode
    }

    $newStreak = $isWin ? ($consecutive ? $stats['streak'] + 1 : 1) : 0;
    $newRecord = max($stats['streak_record'], $newStreak);

    $pdo->prepare('
        UPDATE user_stats SET
            games        = games + 1,
            wins         = wins + ?,
            giveups      = giveups + ?,
            streak       = ?,
            streak_record= ?,
            perfect_wins = perfect_wins + ?,
            total_time_ms= total_time_ms + ?,
            last_played_at = NOW()
        WHERE user_id = ? AND mode = ?
    ')->execute([
        $isWin ? 1 : 0,
        $isWin ? 0 : 1,
        $newStreak,
        $newRecord,
        $isPerfect ? 1 : 0,
        $timeMs,
        $userId,
        $mode,
    ]);

    // 3. Relire les stats mises à jour pour les renvoyer au client
    $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? AND mode = ?');
    $stmt->execute([$userId, $mode]);
    $updatedStats = $stmt->fetch();

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[PersonaDLE sessions] ' . $e->getMessage());
    jsonError('Failed to save session', 500);
}

jsonSuccess([
    'session_id' => $sessionId,
    'stats'      => [
        'mode'          => $mode,
        'games'         => (int) $updatedStats['games'],
        'wins'          => (int) $updatedStats['wins'],
        'giveups'       => (int) $updatedStats['giveups'],
        'streak'        => (int) $updatedStats['streak'],
        'streak_record' => (int) $updatedStats['streak_record'],
        'perfect_wins'  => (int) $updatedStats['perfect_wins'],
        'total_time_ms' => (int) $updatedStats['total_time_ms'],
    ],
], 201);
