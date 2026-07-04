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
require_once __DIR__ . '/lib/game_session.php';

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
// cas de requêtes simultanées (plus de TOCTOU). personadle_record_game_session()
// intercepte la PDOException et la transforme en PersonadleDuplicateSessionException.
$pdo->beginTransaction();
try {
    $sessionResult = personadle_record_game_session(
        $pdo, $userId, $mode, $playedDate, $targetName, $result, $attempts, $timeMs, $filters
    );
    $pdo->commit();
} catch (PersonadleDuplicateSessionException $dup) {
    $pdo->rollBack();
    jsonError($dup->getMessage(), 409);
} catch (Throwable $e) {
    $pdo->rollBack();
    personadle_log_error($pdo, 'error', $e->getMessage(), [
        'source' => 'sessions',
        'mode'   => $mode,
    ], $userId);
    jsonError('Failed to save session', 500);
}

jsonSuccess($sessionResult, 201);
