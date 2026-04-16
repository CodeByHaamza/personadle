<?php
/**
 * GET   /api/notifications → { friend_requests: N }  (unseen pending requests)
 * PATCH /api/notifications → marquer toutes les demandes en attente comme vues
 */

require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS cnt
        FROM friendships
        WHERE addressee_id = ?
          AND status = 'pending'
          AND seen_at IS NULL
    ");
    $stmt->execute([$authId]);
    $cnt = (int) $stmt->fetchColumn();

    jsonSuccess(['friend_requests' => $cnt]);
}

if ($method === 'PATCH') {
    $pdo->prepare("
        UPDATE friendships
        SET seen_at = NOW()
        WHERE addressee_id = ?
          AND status = 'pending'
          AND seen_at IS NULL
    ")->execute([$authId]);

    jsonSuccess(['ok' => true]);
}

jsonError('Method Not Allowed', 405);
