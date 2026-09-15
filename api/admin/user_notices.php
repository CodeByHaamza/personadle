<?php
/**
 * POST /api/admin/users/:id/notices {type, message} → envoie un avertissement /
 *      message de l'équipe, que le joueur verra UNE fois à son prochain chargement
 *      de page (bandeau, js/site_notices.js), puis accusé (read_at).
 * GET  /api/admin/users/:id/notices                  → historique
 *
 * type : 'warning' (⚠️, avant un ban) ou 'info' (message neutre). Migration 042.
 * Accès : requireAdmin().
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();
$pdo     = pdo();
$method  = $_SERVER['REQUEST_METHOD'];

$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

$chk = $pdo->prepare('SELECT 1 FROM users WHERE id = ? AND is_deleted = 0');
$chk->execute([$userId]);
if (!$chk->fetchColumn()) jsonError('User not found', 404);

if ($method === 'GET') {
    $st = $pdo->prepare(
        'SELECT n.id, n.type, n.message, n.created_at, n.read_at, a.pseudo AS admin_pseudo
         FROM user_notices n LEFT JOIN users a ON a.id = n.admin_id
         WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 100'
    );
    $st->execute([$userId]);
    jsonSuccess(['notices' => $st->fetchAll()]);
}

if ($method === 'POST') {
    $data    = getJsonBody();
    $type    = (string) ($data['type'] ?? 'warning');
    $message = trim((string) ($data['message'] ?? ''));
    if (!in_array($type, ['warning', 'info'], true)) jsonError('Invalid type', 400);
    if ($message === '') jsonError('Empty message', 400);
    if (mb_strlen($message) > 1000) jsonError('Message too long (1000 max)', 400);
    $pdo->prepare('INSERT INTO user_notices (user_id, admin_id, type, message) VALUES (?, ?, ?, ?)')
        ->execute([$userId, $adminId, $type, $message]);
    $id = (int) $pdo->lastInsertId();
    personadle_log_admin_action($pdo, $adminId, 'user.notice_send', 'user', (string) $userId, ['notice_id' => $id, 'type' => $type]);
    jsonSuccess(['id' => $id], 201);
}

jsonError('Method Not Allowed', 405);
