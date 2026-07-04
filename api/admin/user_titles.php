<?php
/**
 * POST   /api/admin/users/:id/titles        → accorder un titre
 * DELETE /api/admin/users/:id/titles/:tid   → retirer un titre
 * PATCH  /api/admin/users/:id/titles/equip  → équiper/déséquiper un titre
 *
 * Le dernier segment de l'URL distingue DELETE (numeric id) et PATCH ("equip").
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire userId et dernier segment depuis l'URL ───────────────────────────
$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

// Dernier segment après "titles"
$titlesIdx   = array_search('titles', $parts);
$lastSegment = $titlesIdx !== false ? ($parts[$titlesIdx + 1] ?? '') : '';

// Vérifier que l'utilisateur existe
$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$userId]);
if (!$stmt->fetch()) jsonError('User not found', 404);


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/users/:id/titles — accorder un titre
// Body : { "title_id": 42 }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $data    = getJsonBody();
    $titleId = isset($data['title_id']) ? (int) $data['title_id'] : 0;
    if ($titleId <= 0) jsonError('Invalid or missing title_id', 400);

    // Vérifier que le titre existe
    $check = $pdo->prepare('SELECT id FROM titles WHERE id = ? LIMIT 1');
    $check->execute([$titleId]);
    if (!$check->fetch()) jsonError('Title not found', 404);

    $pdo->prepare('INSERT IGNORE INTO user_titles (user_id, title_id) VALUES (?, ?)')
        ->execute([$userId, $titleId]);

    personadle_log_admin_action($pdo, $adminId, 'title.grant', 'user', (string) $userId, ['title_id' => $titleId]);

    jsonSuccess(['success' => true]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/users/:id/titles/equip — équiper un titre (ou null)
// Body : { "title_id": 42 } ou { "title_id": null }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    if ($lastSegment !== 'equip') {
        jsonError('PATCH is only supported on /titles/equip', 400);
    }

    $data    = getJsonBody();
    $titleId = array_key_exists('title_id', $data)
        ? ($data['title_id'] !== null ? (int) $data['title_id'] : null)
        : false;

    if ($titleId === false) jsonError('Missing title_id in body', 400);

    // Si un titre_id est fourni, vérifier qu'il existe
    if ($titleId !== null) {
        $check = $pdo->prepare('SELECT id FROM titles WHERE id = ? LIMIT 1');
        $check->execute([$titleId]);
        if (!$check->fetch()) jsonError('Title not found', 404);
    }

    $pdo->prepare('UPDATE profiles SET equipped_title_id = ? WHERE user_id = ?')
        ->execute([$titleId, $userId]);

    personadle_log_admin_action($pdo, $adminId, 'title.equip', 'user', (string) $userId, ['title_id' => $titleId]);

    jsonSuccess(['success' => true]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id/titles/:tid — retirer un titre
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    // Vérifier que ce n'est pas "equip" (route PATCH uniquement)
    if ($lastSegment === 'equip' || !ctype_digit($lastSegment) || (int) $lastSegment <= 0) {
        jsonError('Invalid title id in URL', 400);
    }
    $titleId = (int) $lastSegment;

    $pdo->prepare('DELETE FROM user_titles WHERE user_id = ? AND title_id = ?')
        ->execute([$userId, $titleId]);

    personadle_log_admin_action($pdo, $adminId, 'title.revoke', 'user', (string) $userId, ['title_id' => $titleId]);

    jsonSuccess(['success' => true]);
}

jsonError('Method Not Allowed', 405);
