<?php
/**
 * API Amis — PersonaDLE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * GET    /api/friends              → liste des amis + demandes en attente
 * POST   /api/friends              → envoyer une demande d'ami (body: { friend_code })
 * PATCH  /api/friends/:id          → accepter/refuser une demande (body: { action: 'accept'|'decline' })
 * DELETE /api/friends/:id          → supprimer un ami ou retirer une demande
 *
 * ACCÈS
 *   Tous les endpoints nécessitent d'être connecté (requireAuth()).
 *
 * RÈGLES MÉTIER
 * ─────────────────────────────────────────────────────────────────────────────
 *   - Un utilisateur ne peut pas s'ajouter lui-même
 *   - Une demande déjà envoyée ou acceptée ne peut pas être dupliquée
 *   - Les demandes bloquées sont silencieuses côté demandeur
 *   - La relation est asymétrique dans la BDD (requester_id → addressee_id)
 *     mais symétrique pour l'affichage : on cherche dans les deux sens
 */

require_once __DIR__ . '/../bootstrap.php';

// Extraire l'éventuel :id depuis l'URL (/api/friends/42)
$parts        = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$friendshipId = 0;
foreach ($parts as $i => $part) {
    if ($part === 'friends' && isset($parts[$i + 1]) && ctype_digit($parts[$i + 1])) {
        $friendshipId = (int) $parts[$i + 1];
        break;
    }
}

$authId = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];
$pdo    = pdo();


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/friends — liste amis + demandes reçues + demandes envoyées
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    // Amis acceptés (relation dans les deux sens)
    // NOTE: PDO with ATTR_EMULATE_PREPARES=false (MySQL native prepares) does not allow
    // reusing the same named parameter. Each occurrence needs a unique name.
    $stmt = $pdo->prepare("
        SELECT
            f.id AS friendship_id,
            f.status,
            f.created_at,
            CASE WHEN f.requester_id = :me1 THEN f.addressee_id ELSE f.requester_id END AS friend_id,
            CASE WHEN f.requester_id = :me2 THEN 'sent' ELSE 'received' END             AS direction,
            u.pseudo,
            u.friend_code,
            u.last_login_at,
            p.avatar_data,
            p.avatar_border_color,
            p.selected_badges,
            sl.id                   AS social_link_id,
            sl.`rank`               AS social_link_rank,
            sl.xp                   AS social_link_xp,
            sl.last_interaction_at  AS social_link_last_interaction
        FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = :me3 THEN f.addressee_id ELSE f.requester_id END
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN social_links sl
               ON sl.user_a_id = LEAST(:me6, u.id)
              AND sl.user_b_id = GREATEST(:me7, u.id)
        WHERE (f.requester_id = :me4 OR f.addressee_id = :me5)
          AND f.status IN ('accepted', 'pending')
          AND u.is_deleted = 0
        ORDER BY f.status DESC, f.created_at DESC
    ");
    $stmt->execute([
        ':me1' => $authId,
        ':me2' => $authId,
        ':me3' => $authId,
        ':me4' => $authId,
        ':me5' => $authId,
        ':me6' => $authId,
        ':me7' => $authId,
    ]);
    $rows = $stmt->fetchAll();

    $friends  = [];
    $pending  = [];

    foreach ($rows as $r) {
        $entry = [
            'friendship_id'                => (int) $r['friendship_id'],
            'friend_id'                    => (int) $r['friend_id'],
            'pseudo'                       => $r['pseudo'],
            'friend_code'                  => $r['friend_code'],
            'avatar_data'                  => $r['avatar_data'],
            'avatar_border_color'          => $r['avatar_border_color'] ?? '#ffffff',
            'selected_badges'              => json_decode($r['selected_badges'] ?? 'null') ?? [],
            'last_seen_at'                 => $r['last_login_at'],
            'created_at'                   => $r['created_at'],
            'direction'                    => $r['direction'],
            'social_link_id'               => $r['social_link_id'] ? (int) $r['social_link_id'] : null,
            'social_link_rank'             => $r['social_link_rank'] ? (int) $r['social_link_rank'] : 1,
            'social_link_xp'               => $r['social_link_xp'] ? (int) $r['social_link_xp'] : 0,
            'social_link_last_interaction' => $r['social_link_last_interaction'],
        ];

        if ($r['status'] === 'accepted') {
            $friends[] = $entry;
        } else {
            $pending[] = $entry;
        }
    }

    jsonSuccess([
        'friends'          => $friends,
        'pending_requests' => $pending,
    ]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/friends — envoyer une demande d'ami
// Body: { "friend_code": "XK4R2M9P" }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $data       = getJsonBody();
    $friendCode = strtoupper(trim($data['friend_code'] ?? ''));

    if (!preg_match('/^[A-Z0-9]{8}$/', $friendCode)) {
        jsonError('Invalid friend code format (expected 8 alphanumeric chars)');
    }

    // Trouver l'utilisateur cible
    $stmt = $pdo->prepare('SELECT id FROM users WHERE friend_code = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([$friendCode]);
    $target = $stmt->fetch();

    if (!$target) jsonError('User not found', 404);

    $addresseeId = (int) $target['id'];

    if ($addresseeId === $authId) {
        jsonError('You cannot add yourself as a friend');
    }

    // Vérifier qu'une relation n'existe pas déjà (dans les deux sens)
    $stmt = $pdo->prepare("
        SELECT id, status FROM friendships
        WHERE (requester_id = ? AND addressee_id = ?)
           OR (requester_id = ? AND addressee_id = ?)
        LIMIT 1
    ");
    $stmt->execute([$authId, $addresseeId, $addresseeId, $authId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $status = $existing['status'];
        if ($status === 'accepted')  jsonError('Already friends', 409);
        if ($status === 'pending')   jsonError('Request already sent or received', 409);
        if ($status === 'blocked')   jsonError('Cannot send request', 403);
    }

    // Créer la demande
    $stmt = $pdo->prepare(
        'INSERT INTO friendships (requester_id, addressee_id, status, created_at)
         VALUES (?, ?, \'pending\', NOW())'
    );
    $stmt->execute([$authId, $addresseeId]);
    $friendshipId = (int) $pdo->lastInsertId();

    jsonSuccess(['friendship_id' => $friendshipId, 'status' => 'pending'], 201);
}


// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/friends/:id — accepter ou refuser une demande reçue
// Body: { "action": "accept" | "decline" }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    if ($friendshipId <= 0) jsonError('Missing friendship id', 400);

    $data   = getJsonBody();
    $action = trim($data['action'] ?? '');

    if (!in_array($action, ['accept', 'decline'], true)) {
        jsonError('Invalid action (expected accept or decline)');
    }

    // Vérifier que c'est bien une demande reçue par l'utilisateur connecté
    $stmt = $pdo->prepare(
        'SELECT id, status FROM friendships
         WHERE id = ? AND addressee_id = ? AND status = \'pending\'
         LIMIT 1'
    );
    $stmt->execute([$friendshipId, $authId]);
    $friendship = $stmt->fetch();

    if (!$friendship) jsonError('Pending request not found or not addressed to you', 404);

    if ($action === 'accept') {
        $pdo->prepare('UPDATE friendships SET status = \'accepted\', accepted_at = NOW() WHERE id = ?')
            ->execute([$friendshipId]);
        jsonSuccess(['friendship_id' => $friendshipId, 'status' => 'accepted']);
    } else {
        // Refuser = supprimer la demande proprement
        $pdo->prepare('DELETE FROM friendships WHERE id = ?')->execute([$friendshipId]);
        jsonSuccess(['friendship_id' => $friendshipId, 'status' => 'declined']);
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/friends/:id — supprimer un ami ou retirer une demande envoyée
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    if ($friendshipId <= 0) jsonError('Missing friendship id', 400);

    // L'utilisateur doit être l'un des deux membres de la relation
    $stmt = $pdo->prepare(
        'SELECT id FROM friendships
         WHERE id = ? AND (requester_id = ? OR addressee_id = ?)
         LIMIT 1'
    );
    $stmt->execute([$friendshipId, $authId, $authId]);

    if (!$stmt->fetch()) jsonError('Friendship not found or unauthorized', 404);

    $pdo->prepare('DELETE FROM friendships WHERE id = ?')->execute([$friendshipId]);

    jsonSuccess(['deleted' => true]);
}

jsonError('Method Not Allowed', 405);
