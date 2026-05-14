<?php
/**
 * GET  /api/notifications  → { friend_requests: N }
 * PATCH /api/notifications → no-op (prévu pour marquer comme vus)
 *
 * Retourne le nombre de demandes d'ami reçues et non encore acceptées.
 * Utilisé par la bottom nav pour afficher le badge rouge sur l'icône Friends.
 */

require_once __DIR__ . '/bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS cnt
        FROM friendships
        WHERE addressee_id = ?
          AND status = 'pending'
    ");
    $stmt->execute([$authId]);
    $cnt = (int) $stmt->fetchColumn();
    jsonSuccess(['friend_requests' => $cnt]);
}

if ($method === 'PATCH') {
    // Prévu pour marquer les demandes comme vues — no-op pour l'instant,
    // la page Friends les affiche directement.
    jsonSuccess(['ok' => true]);
}

jsonError('Method Not Allowed', 405);
