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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$authId = requireAuth();
$pdo    = pdo();
$data   = getJsonBody();

$previousStreak = (int) ($data['previous_streak'] ?? 0);
if ($previousStreak < 2 || $previousStreak > 9999) {
    jsonError('Invalid previous_streak', 400);
}

// ── Vérification cooldown côté serveur ───────────────────────────────────────
$stmt = $pdo->prepare('SELECT streak_recovered_at FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$authId]);
$row = $stmt->fetch();

if (!$row) jsonError('User not found', 404);

if ($row['streak_recovered_at'] !== null) {
    $daysSince = (time() - strtotime($row['streak_recovered_at'])) / 86400;
    if ($daysSince < 60) {
        $daysLeft = (int) ceil(60 - $daysSince);
        jsonError("Streak recovery on cooldown. Try again in $daysLeft day(s).", 429);
    }
}

// ── Validation anti-triche ───────────────────────────────────────────────────
// La streak côté client est GLOBALE (une partie dans n'importe quel mode = +1/jour),
// elle peut donc légitimement dépasser le streak_record d'un mode pris isolément.
// La seule borne supérieure infalsifiable et vérifiable côté serveur est le nombre
// de jours DISTINCTS réellement joués (table game_sessions). Une streak globale ne
// peut jamais excéder ce total.
$stmt = $pdo->prepare('SELECT COUNT(DISTINCT played_date) FROM game_sessions WHERE user_id = ?');
$stmt->execute([$authId]);
$daysPlayed = (int) ($stmt->fetchColumn() ?? 0);
$maxAllowed = max(1, $daysPlayed);

if ($previousStreak > $maxAllowed) {
    jsonError('Invalid previous_streak: exceeds total days played', 400);
}

// ── Mise à jour streak + enregistrement cooldown ─────────────────────────────
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare(
        'UPDATE user_stats
         SET streak = ?, streak_record = GREATEST(streak_record, ?)
         WHERE user_id = ? AND streak < ?'
    );
    $stmt->execute([$previousStreak, $previousStreak, $authId, $previousStreak]);
    $rowsUpdated = $stmt->rowCount();

    // Restaure aussi la streak GLOBALE autoritative (datée aujourd'hui, heure de Paris)
    // pour qu'elle reparte de previous_streak et ne soit pas écrasée à la prochaine sync.
    $parisToday = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    $pdo->prepare(
        'UPDATE users
         SET streak_recovered_at  = UTC_TIMESTAMP(),
             global_streak        = GREATEST(global_streak, ?),
             global_streak_record = GREATEST(global_streak_record, ?),
             global_streak_date   = ?
         WHERE id = ?'
    )->execute([$previousStreak, $previousStreak, $parisToday, $authId]);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[recover-streak] ' . $e->getMessage());
    jsonError('Failed to recover streak', 500);
}

jsonSuccess(['recovered' => true, 'streak' => $previousStreak, 'modes_updated' => $rowsUpdated]);
