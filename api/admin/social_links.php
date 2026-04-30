<?php
/**
 * GET   /api/admin/social-links/:id  → détail d'un social link
 * PATCH /api/admin/social-links/:id  → modifier xp et/ou rank
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire l'id du social link depuis l'URL ─────────────────────────────────
$path     = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
$parts    = explode('/', $path);
$slIdx    = array_search('social-links', $parts);
$linkId   = $slIdx !== false ? (int) ($parts[$slIdx + 1] ?? 0) : 0;
if ($linkId <= 0) jsonError('Invalid social link id', 400);

// Récupérer le social link avec les pseudos des deux utilisateurs
$stmt = $pdo->prepare(
    'SELECT sl.id, sl.user_a_id, sl.user_b_id, sl.rank, sl.xp,
            ua.pseudo AS user_a_pseudo,
            ub.pseudo AS user_b_pseudo
     FROM social_links sl
     JOIN users ua ON ua.id = sl.user_a_id
     JOIN users ub ON ub.id = sl.user_b_id
     WHERE sl.id = ?
     LIMIT 1'
);
$stmt->execute([$linkId]);
$link = $stmt->fetch();
if (!$link) jsonError('Social link not found', 404);


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/social-links/:id
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    jsonSuccess([
        'id'            => (int) $link['id'],
        'user_a_id'     => (int) $link['user_a_id'],
        'user_b_id'     => (int) $link['user_b_id'],
        'rank'          => (int) $link['rank'],
        'xp'            => (int) $link['xp'],
        'user_a_pseudo' =>       $link['user_a_pseudo'],
        'user_b_pseudo' =>       $link['user_b_pseudo'],
    ]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/social-links/:id — modifier xp et/ou rank
// Body : { "xp": 500, "rank": 5 } (les deux optionnels)
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    $data = getJsonBody();

    $fields = [];
    $params = [];

    if (array_key_exists('xp', $data)) {
        $xp = (int) $data['xp'];
        if ($xp < 0) jsonError('xp must be >= 0', 400);
        $fields[] = 'xp = ?';
        $params[] = $xp;
    }

    if (array_key_exists('rank', $data)) {
        $rank = (int) $data['rank'];
        if ($rank < 1 || $rank > 10) jsonError('rank must be between 1 and 10', 400);
        $fields[] = '`rank` = ?';
        $params[] = $rank;
    }

    if (empty($fields)) jsonError('No valid fields provided (xp, rank)', 400);

    $params[] = $linkId;
    $pdo->prepare('UPDATE social_links SET ' . implode(', ', $fields) . ' WHERE id = ?')
        ->execute($params);

    jsonSuccess(['success' => true]);
}

jsonError('Method Not Allowed', 405);
