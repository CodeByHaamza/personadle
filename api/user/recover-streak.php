<?php
/**
 * POST /api/user/recover-streak
 * { previous_streak: 9 }
 *
 * Restaure la streak Jack Frost.
 * Cooldown 60 jours enforced côté SERVEUR (colonne streak_recovered_at).
 * La valeur previous_streak est validée contre le vrai record en BDD.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/streak_recovery.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$authId = requireAuth();
$pdo    = pdo();
$data   = getJsonBody();

$previousStreak = (int) ($data['previous_streak'] ?? 0);
if ($previousStreak < 2 || $previousStreak > 9999) {
    jsonError('Invalid previous_streak', 400);
}

// ── Transaction + SELECT ... FOR UPDATE (dans personadle_attempt_streak_recovery) :
// deux requêtes concurrentes ne peuvent pas passer le cooldown en même temps
// (la 2e attend le verrou de ligne).
$pdo->beginTransaction();
try {
    $recovery = personadle_attempt_streak_recovery($pdo, $authId, $previousStreak);
    $pdo->commit();
} catch (PersonadleStreakRecoveryException $e) {
    $pdo->rollBack();
    jsonError($e->getMessage(), $e->status);
} catch (Throwable $e) {
    $pdo->rollBack();
    personadle_log_error($pdo, 'error', $e->getMessage(), ['source' => 'recover-streak'], $authId);
    jsonError('Failed to recover streak', 500);
}

jsonSuccess([
    'recovered'      => true,
    'streak'         => $previousStreak,
    'modes_updated'  => $recovery['modes_updated'],
]);
