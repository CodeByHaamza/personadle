<?php
/**
 * GET   /api/notices/          → mes messages de l'équipe non lus (migration 042)
 * PATCH /api/notices/:id       → accusé de lecture (read_at)
 *
 * Le bandeau (js/site_notices.js) les montre une fois ; l'accusé évite qu'ils
 * reviennent. Accès : requireAuth().
 */

require_once __DIR__ . '/../bootstrap.php';

$uid    = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $st = $pdo->prepare(
        'SELECT id, type, message, created_at FROM user_notices
         WHERE user_id = ? AND read_at IS NULL ORDER BY created_at ASC LIMIT 5'
    );
    $st->execute([$uid]);
    jsonSuccess(['notices' => array_map(static fn($n) => [
        'id' => (int) $n['id'], 'type' => $n['type'], 'message' => $n['message'], 'created_at' => $n['created_at'],
    ], $st->fetchAll())]);
}

if ($method === 'PATCH') {
    $parts = requestPathSegments();
    $id    = (int) ($parts[array_search('notices', $parts) + 1] ?? 0);
    if ($id <= 0) jsonError('Invalid notice id', 400);
    $st = $pdo->prepare('UPDATE user_notices SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL');
    $st->execute([$id, $uid]);
    jsonSuccess(['read' => $st->rowCount() > 0]);
}

jsonError('Method Not Allowed', 405);
