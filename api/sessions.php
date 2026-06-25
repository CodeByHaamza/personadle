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
require_once __DIR__ . '/lib/streak.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

$userId = requireAuth();

// ── Rate limiting : 15 requêtes / 15 min par utilisateur ─────────────────────
// Protège contre les bots qui posteraient des sessions en boucle.
// La contrainte UNIQUE per (user, mode, date) protège l'intégrité, mais ce
// rate limit coupe les appels répétitifs avant même d'atteindre la BDD.
rateLimit('sessions:' . $userId, 15, 15 * 60, 'Too many session submissions. Please wait a few minutes.');
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
// Valider que played_date est aujourd'hui ou hier en heure de Paris
// (évite les injections de sessions sur des dates passées arbitraires)
$parisNow       = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
$parisYesterday = (new DateTime('yesterday', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
if ($playedDate !== $parisNow && $playedDate !== $parisYesterday) {
    jsonError('played_date must be today or yesterday (Europe/Paris timezone)', 400);
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
// La contrainte UNIQUE uq_session_per_day en BDD garantit l'unicité même en
// cas de requêtes simultanées (plus de TOCTOU). On intercepte PDOException.
$pdo->beginTransaction();
try {
    // 1. Insérer la session
    try {
        $pdo->prepare('
            INSERT INTO game_sessions
                (user_id, mode, played_date, target_name, result, attempts, time_ms, active_filters)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $userId, $mode, $playedDate, $targetName, $result,
            $attempts, $timeMs, json_encode($filters),
        ]);
    } catch (PDOException $dup) {
        $pdo->rollBack();
        if ($dup->getCode() === '23000') {
            jsonError("Session already recorded for mode '$mode' on $playedDate", 409);
        }
        throw $dup;
    }
    $sessionId = (int) $pdo->lastInsertId();

    // 2. Lire les stats actuelles pour calculer la streak
    $stmt = $pdo->prepare('
        SELECT * FROM user_stats WHERE user_id = ? AND mode = ? LIMIT 1
    ');
    $stmt->execute([$userId, $mode]);
    $stats = $stmt->fetch();

    // Calcul de la streak — logique pure, testée dans tests/php/StreakTest.php.
    // (frontière de journée en heure de Paris, partie parfaite = victoire en 1 essai)
    $isWin     = $result === 'win';
    $isPerfect = personadle_is_perfect($result, $attempts);

    $newStreak = personadle_compute_streak(
        $stats['last_played_at'] ?? null,
        $playedDate,
        $result,
        (int) $stats['streak']
    );
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
            last_played_at = UTC_TIMESTAMP()
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
