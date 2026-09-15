<?php
/**
 * GET    /api/admin/announcements              → toutes les annonces (actives d'abord)
 * POST   /api/admin/announcements              → { level, message_fr, message_en?, starts_at?, ends_at? }
 * PATCH  /api/admin/announcements/:id          → { is_active } (activer / désactiver)
 * DELETE /api/admin/announcements/:id
 *
 * Annonce globale = bandeau sur toutes les pages (livré par /api/auth/me,
 * rendu par js/site_notices.js), FR + EN, fenêtre de dates optionnelle.
 * Migration 042. Accès : requireAdmin().
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();
$pdo     = pdo();
$method  = $_SERVER['REQUEST_METHOD'];

$parts = requestPathSegments();
$id    = (int) ($parts[array_search('announcements', $parts) + 1] ?? 0);

$LEVELS = ['info', 'warning', 'maintenance'];

/** 'YYYY-MM-DDTHH:MM' (input datetime-local, heure Paris) → 'Y-m-d H:i:s' UTC, ou null. */
function parseParisDateTime(?string $v): ?string
{
    $v = trim((string) $v);
    if ($v === '') return null;
    $d = DateTime::createFromFormat('Y-m-d\TH:i', $v, new DateTimeZone('Europe/Paris'))
      ?: DateTime::createFromFormat('Y-m-d H:i:s', $v, new DateTimeZone('Europe/Paris'));
    if (!$d) jsonError('Invalid date (expected YYYY-MM-DDTHH:MM)', 400);
    return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

if ($method === 'GET') {
    $rows = $pdo->query(
        'SELECT a.id, a.level, a.message_fr, a.message_en, a.starts_at, a.ends_at, a.is_active, a.created_at,
                u.pseudo AS created_by_pseudo
         FROM announcements a LEFT JOIN users u ON u.id = a.created_by
         ORDER BY a.is_active DESC, a.created_at DESC LIMIT 100'
    )->fetchAll();
    jsonSuccess(['announcements' => $rows]);
}

if ($method === 'POST') {
    $data  = getJsonBody();
    $level = (string) ($data['level'] ?? 'info');
    $fr    = trim((string) ($data['message_fr'] ?? ''));
    $en    = trim((string) ($data['message_en'] ?? ''));
    if (!in_array($level, $LEVELS, true)) jsonError('Invalid level', 400);
    if ($fr === '') jsonError('message_fr required', 400);
    if (mb_strlen($fr) > 500 || mb_strlen($en) > 500) jsonError('Message too long (500 max)', 400);
    $starts = parseParisDateTime($data['starts_at'] ?? null);
    $ends   = parseParisDateTime($data['ends_at'] ?? null);
    if ($starts && $ends && $ends < $starts) jsonError('ends_at before starts_at', 400);

    $pdo->prepare(
        'INSERT INTO announcements (level, message_fr, message_en, starts_at, ends_at, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, 1, ?)'
    )->execute([$level, $fr, $en !== '' ? $en : null, $starts, $ends, $adminId]);
    $newId = (int) $pdo->lastInsertId();
    personadle_log_admin_action($pdo, $adminId, 'announcement.create', 'announcement', (string) $newId, ['level' => $level]);
    jsonSuccess(['id' => $newId], 201);
}

if ($id <= 0) jsonError('Invalid announcement id', 400);

$exists = $pdo->prepare('SELECT 1 FROM announcements WHERE id = ?');
$exists->execute([$id]);
if (!$exists->fetchColumn()) jsonError('Not found', 404);

if ($method === 'PATCH') {
    $data = getJsonBody();
    if (!array_key_exists('is_active', $data)) jsonError('is_active required', 400);
    $active = (bool) $data['is_active'];
    $pdo->prepare('UPDATE announcements SET is_active = ? WHERE id = ?')->execute([(int) $active, $id]);
    personadle_log_admin_action($pdo, $adminId, $active ? 'announcement.activate' : 'announcement.deactivate', 'announcement', (string) $id, []);
    jsonSuccess(['is_active' => $active]);
}

if ($method === 'DELETE') {
    $pdo->prepare('DELETE FROM announcements WHERE id = ?')->execute([$id]);
    personadle_log_admin_action($pdo, $adminId, 'announcement.delete', 'announcement', (string) $id, []);
    jsonSuccess(['deleted' => true]);
}

jsonError('Method Not Allowed', 405);
