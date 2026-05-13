<?php
/**
 * GET    /api/admin/social-links         → liste paginée de tous les social links
 * GET    /api/admin/social-links/:id     → détail d'un social link
 * PATCH  /api/admin/social-links/:id     → modifier xp, rank
 * DELETE /api/admin/social-links/:id     → supprimer un social link (cascade)
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

$path   = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
$parts  = explode('/', $path);
$slIdx  = array_search('social-links', $parts);
$linkId = ($slIdx !== false && isset($parts[$slIdx + 1]) && ctype_digit($parts[$slIdx + 1]))
    ? (int) $parts[$slIdx + 1]
    : 0;

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/social-links — liste paginée
// Query params : ?page=1&limit=30&search=pseudo&rank=10
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET' && $linkId === 0) {
    $page   = max(1, (int) ($_GET['page']   ?? 1));
    $limit  = min(100, max(1, (int) ($_GET['limit']  ?? 30)));
    $offset = ($page - 1) * $limit;
    $search = trim($_GET['search'] ?? '');
    $rank   = isset($_GET['rank']) && ctype_digit($_GET['rank']) ? (int) $_GET['rank'] : null;

    $where  = [];
    $params = [];

    if ($search !== '') {
        $where[]  = '(ua.pseudo LIKE ? OR ub.pseudo LIKE ?)';
        $like     = '%' . $search . '%';
        $params[] = $like;
        $params[] = $like;
    }
    if ($rank !== null) {
        $where[]  = 'sl.`rank` = ?';
        $params[] = $rank;
    }

    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $pdo->prepare(
        "SELECT COUNT(*) FROM social_links sl
         JOIN users ua ON ua.id = sl.user_a_id
         JOIN users ub ON ub.id = sl.user_b_id
         $whereSQL"
    );
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $listStmt = $pdo->prepare(
        "SELECT sl.id, sl.user_a_id, sl.user_b_id, sl.`rank`, sl.xp,
                sl.last_interaction_at,
                ua.pseudo AS pseudo_a,
                ub.pseudo AS pseudo_b,
                (SELECT COUNT(*) FROM social_link_interactions sli WHERE sli.social_link_id = sl.id) AS interaction_count
         FROM social_links sl
         JOIN users ua ON ua.id = sl.user_a_id
         JOIN users ub ON ub.id = sl.user_b_id
         $whereSQL
         ORDER BY sl.`rank` DESC, sl.xp DESC
         LIMIT ? OFFSET ?"
    );
    $listStmt->execute([...$params, $limit, $offset]);
    $rows = $listStmt->fetchAll();

    jsonSuccess([
        'total' => $total,
        'page'  => $page,
        'limit' => $limit,
        'links' => array_map(fn($sl) => [
            'id'                  => (int)  $sl['id'],
            'user_a_id'           => (int)  $sl['user_a_id'],
            'user_b_id'           => (int)  $sl['user_b_id'],
            'pseudo_a'            =>        $sl['pseudo_a'],
            'pseudo_b'            =>        $sl['pseudo_b'],
            'rank'                => (int)  $sl['rank'],
            'xp'                  => (int)  $sl['xp'],
            'last_interaction_at' =>        $sl['last_interaction_at'],
            'interaction_count'   => (int)  $sl['interaction_count'],
        ], $rows),
    ]);
}

// À partir d'ici, un linkId valide est requis
if ($linkId <= 0) jsonError('Invalid social link id', 400);

// Charger le social link
$stmt = $pdo->prepare(
    'SELECT sl.id, sl.user_a_id, sl.user_b_id, sl.`rank`, sl.xp,
            sl.last_interaction_at,
            ua.pseudo AS pseudo_a,
            ub.pseudo AS pseudo_b,
            (SELECT COUNT(*) FROM social_link_interactions sli WHERE sli.social_link_id = sl.id) AS interaction_count
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
    // Récupérer les configs badge si elles existent
    $cfgStmt = $pdo->prepare(
        'SELECT slbc.user_id, u.pseudo, slbc.ring_color, slbc.overlay, slbc.submitted_at
         FROM social_link_badge_configs slbc
         JOIN users u ON u.id = slbc.user_id
         WHERE slbc.social_link_id = ?'
    );
    $cfgStmt->execute([$linkId]);
    $configs = $cfgStmt->fetchAll();

    jsonSuccess([
        'id'                  => (int)  $link['id'],
        'user_a_id'           => (int)  $link['user_a_id'],
        'user_b_id'           => (int)  $link['user_b_id'],
        'pseudo_a'            =>        $link['pseudo_a'],
        'pseudo_b'            =>        $link['pseudo_b'],
        'rank'                => (int)  $link['rank'],
        'xp'                  => (int)  $link['xp'],
        'last_interaction_at' =>        $link['last_interaction_at'],
        'interaction_count'   => (int)  $link['interaction_count'],
        'badge_configs'       => array_map(fn($c) => [
            'user_id'      => (int) $c['user_id'],
            'pseudo'       =>       $c['pseudo'],
            'ring_color'   =>       $c['ring_color'],
            'overlay'      =>       $c['overlay'],
            'submitted_at' =>       $c['submitted_at'],
        ], $configs),
    ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/social-links/:id — modifier xp, rank
// Body : { "xp": 500, "rank": 5 }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    $data   = getJsonBody();
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

    // Si le rang a augmenté → insérer des notifs pour les deux joueurs afin de déclencher l'animation rank-up côté client
    if (isset($rank) && $rank > (int) $link['rank']) {
        $isBadgePrompt = ($rank === 10) ? 1 : 0;
        $notifStmt = $pdo->prepare(
            'INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank, is_badge_prompt)
             VALUES (?, ?, ?, ?)'
        );
        $notifStmt->execute([(int) $link['user_a_id'], (int) $link['user_b_id'], $rank, $isBadgePrompt]);
        $notifStmt->execute([(int) $link['user_b_id'], (int) $link['user_a_id'], $rank, $isBadgePrompt]);
    }

    jsonSuccess(['success' => true]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/social-links/:id — supprimer définitivement le social link
// Supprime en cascade : configs badge, badge final, notifs, interactions
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    // Les FK avec ON DELETE CASCADE gèrent la plupart des tables liées.
    // Les notifs rank-up n'ont pas de FK sur social_links — nettoyage manuel.
    $pdo->prepare(
        'DELETE FROM social_link_rankup_notifs
         WHERE (recipient_id = ? AND partner_id = ?)
            OR (recipient_id = ? AND partner_id = ?)'
    )->execute([
        (int)$link['user_a_id'], (int)$link['user_b_id'],
        (int)$link['user_b_id'], (int)$link['user_a_id'],
    ]);

    $pdo->prepare('DELETE FROM social_links WHERE id = ?')->execute([$linkId]);

    jsonSuccess(['success' => true]);
}

jsonError('Method Not Allowed', 405);
