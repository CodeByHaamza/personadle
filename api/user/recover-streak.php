<?php
/**
 * POST /api/user/recover-streak
 * { previous_streak: 9 }
 *
 * Restaure la streak de Jack Frost : met à jour user_stats.streak
 * pour tous les modes de l'utilisateur connecté.
 * Limite d'utilisation non vérifiée ici — c'est le client (localStorage)
 * qui gère le cooldown de 60 jours.
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$authId = requireAuth();
$pdo    = pdo();
$data   = json_decode(file_get_contents('php://input'), true) ?? [];

$previousStreak = (int) ($data['previous_streak'] ?? 0);
if ($previousStreak < 2 || $previousStreak > 9999) {
    jsonError('Invalid previous_streak', 400);
}

// Mettre à jour tous les modes où streak < previousStreak
// On ne descend jamais le streak (on ne touche pas les modes au-dessus)
$stmt = $pdo->prepare(
    'UPDATE user_stats
     SET streak = ?, streak_record = GREATEST(streak_record, ?)
     WHERE user_id = ? AND streak < ?'
);
$stmt->execute([$previousStreak, $previousStreak, $authId, $previousStreak]);

$rowsUpdated = $stmt->rowCount();

jsonSuccess(['recovered' => true, 'streak' => $previousStreak, 'modes_updated' => $rowsUpdated]);
