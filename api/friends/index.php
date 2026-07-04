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
require_once __DIR__ . '/../lib/friends.php';

// Extraire l'éventuel :id depuis l'URL (/api/friends/42)
$parts        = requestPathSegments();
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
    // ── Étape 1 : récupérer amis + demandes (sans social_links pour robustesse)
    // NOTE: PDO with ATTR_EMULATE_PREPARES=false does not allow reusing named params.
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
            p.selected_badges
        FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = :me3 THEN f.addressee_id ELSE f.requester_id END
        LEFT JOIN profiles p ON p.user_id = u.id
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
            // Social link defaults — enrichis par l'étape 2 si disponible
            'social_link_id'               => null,
            'social_link_rank'             => 1,
            'social_link_xp'               => 0,
            'social_link_last_interaction' => null,
        ];

        if ($r['status'] === 'accepted') {
            $friends[] = $entry;
        } else {
            $pending[] = $entry;
        }
    }

    // ── Étape 2 : enrichir avec social_links (optionnel — ne plante pas si absent)
    if (!empty($friends)) {
        $friendIds = array_column($friends, 'friend_id');
        try {
            $placeholders = implode(',', array_fill(0, count($friendIds), '?'));
            $slStmt = $pdo->prepare("
                SELECT
                    sl.id,
                    sl.user_a_id,
                    sl.user_b_id,
                    sl.`rank`,
                    sl.xp,
                    sl.last_interaction_at
                FROM social_links sl
                WHERE (sl.user_a_id = ? AND sl.user_b_id IN ($placeholders))
                   OR (sl.user_b_id = ? AND sl.user_a_id IN ($placeholders))
            ");
            $params = array_merge([$authId], $friendIds, [$authId], $friendIds);
            $slStmt->execute($params);
            $slRows = $slStmt->fetchAll();

            // Indexer par friend_id pour lookup O(1)
            $slByFriend = [];
            foreach ($slRows as $sl) {
                $friendId = ($sl['user_a_id'] === $authId) ? $sl['user_b_id'] : $sl['user_a_id'];
                $slByFriend[(int) $friendId] = $sl;
            }

            foreach ($friends as &$f) {
                $sl = $slByFriend[$f['friend_id']] ?? null;
                if ($sl) {
                    $f['social_link_id']               = (int) $sl['id'];
                    $f['social_link_rank']             = (int) $sl['rank'];
                    $f['social_link_xp']               = (int) $sl['xp'];
                    $f['social_link_last_interaction'] = $sl['last_interaction_at'];
                }
            }
            unset($f);
        } catch (PDOException $e) {
            // social_links table indisponible — on retourne quand même la liste sans XP
            error_log('[Friends GET] social_links enrichment failed: ' . $e->getMessage());
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
    rateLimit('friends-add:' . $authId, 10, 15 * 60);

    $data       = getJsonBody();
    $friendCode = strtoupper(trim($data['friend_code'] ?? ''));

    if ($codeError = personadle_validate_friend_code($friendCode)) {
        jsonError($codeError);
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

    if ($denial = personadle_friend_request_denial($existing['status'] ?? null)) {
        jsonError($denial['message'], $denial['http_status']);
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
        // Récupérer le demandeur avant de supprimer (pour lui notifier)
        $reqRow = $pdo->prepare('SELECT requester_id FROM friendships WHERE id = ? LIMIT 1');
        $reqRow->execute([$friendshipId]);
        $reqData = $reqRow->fetch();

        // Supprimer la demande
        $pdo->prepare('DELETE FROM friendships WHERE id = ?')->execute([$friendshipId]);

        // Notifier le demandeur via un message système
        if ($reqData && (int) $reqData['requester_id'] !== $authId) {
            try {
                $pdo->prepare(
                    "INSERT INTO messages (sender_id, receiver_id, type, content, status, created_at)
                     VALUES (?, ?, 'friend_declined', '', 'unread', NOW())"
                )->execute([$authId, (int) $reqData['requester_id']]);
            } catch (PDOException $e) {
                // Non-bloquant — ne pas faire échouer la réponse
                error_log('[Friends PATCH] decline message insert failed: ' . $e->getMessage());
            }
        }

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
