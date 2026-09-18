<?php
/**
 * GET    /api/admin/users/:id/notes          → carnet interne de l'admin sur ce joueur
 * POST   /api/admin/users/:id/notes {note}   → ajoute une note
 * DELETE /api/admin/users/:id/notes/:nid     → supprime une note
 *
 * Jamais exposé au joueur (migration 042). Accès : requireAdmin().
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();
$pdo     = pdo();
$method  = $_SERVER['REQUEST_METHOD'];

$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
$noteId   = (int) ($parts[$adminIdx + 4] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

$chk = $pdo->prepare('SELECT 1 FROM users WHERE id = ? AND is_deleted = 0');
$chk->execute([$userId]);
if (!$chk->fetchColumn()) jsonError('User not found', 404);

if ($method === 'GET') {
    $st = $pdo->prepare(
        'SELECT n.id, n.note, n.created_at, a.pseudo AS admin_pseudo
         FROM admin_notes n LEFT JOIN users a ON a.id = n.admin_id
         WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 200'
    );
    $st->execute([$userId]);
    jsonSuccess(['notes' => $st->fetchAll()]);
}

if ($method === 'POST') {
    $data = getJsonBody();
    $note = trim((string) ($data['note'] ?? ''));
    if ($note === '') jsonError('Empty note', 400);
    if (mb_strlen($note) > 2000) jsonError('Note too long (2000 max)', 400);
    $pdo->prepare('INSERT INTO admin_notes (user_id, admin_id, note) VALUES (?, ?, ?)')->execute([$userId, $adminId, $note]);
    $id = (int) $pdo->lastInsertId();
    personadle_log_admin_action($pdo, $adminId, 'user.note_add', 'user', (string) $userId, ['note_id' => $id]);
    jsonSuccess(['id' => $id], 201);
}

if ($method === 'DELETE') {
    if ($noteId <= 0) jsonError('Invalid note id', 400);
    $st = $pdo->prepare('DELETE FROM admin_notes WHERE id = ? AND user_id = ?');
    $st->execute([$noteId, $userId]);
    if ($st->rowCount() === 0) jsonError('Note not found', 404);
    personadle_log_admin_action($pdo, $adminId, 'user.note_delete', 'user', (string) $userId, ['note_id' => $noteId]);
    jsonSuccess(['deleted' => true]);
}

jsonError('Method Not Allowed', 405);
