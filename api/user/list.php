<?php
/**
 * GET /api/user/list?q=&limit=30&offset=0
 *
 * Retourne tous les utilisateurs actifs pour la page "Browse Players".
 *   - Si ?q= (≥2 chars) : filtre par pseudo (LIKE) ou friend_code (exact)
 *   - Si connecté : inclut le statut de friendship pour chaque joueur
 *     et trie les amis en premier
 *   - Exclut l'utilisateur connecté de sa propre liste
 *
 * ACCÈS : Public (pas de requireAuth)
 *
 * RÉPONSE
 *   { users: [...], total: N }
 *   Chaque user : { id, pseudo, friend_code, lang, avatar_data,
 *                   avatar_border_color, selected_badges,
 *                   friendship_status, friendship_direction }
 *   friendship_status   : null | 'pending' | 'accepted'
 *   friendship_direction: null | 'sent' | 'received'  (si pending)
 */

require_once __DIR__ . '/../bootstrap.php';

$q      = trim($_GET['q'] ?? '');
$limit  = min((int)($_GET['limit']  ?? 30), 50);
$offset = max((int)($_GET['offset'] ?? 0),  0);
$pdo    = pdo();
$myId   = (int)($_SESSION['user_id'] ?? 0);

// Construire la clause LIKE (ou match exact friend_code)
$isFriendCode = strlen($q) === 8 && (bool)preg_match('/^[A-Z0-9]{8}$/i', $q);
$likeVal      = (strlen($q) >= 2 && !$isFriendCode) ? '%' . $q . '%' : '%';

if ($myId) {
    // ── Connecté : inclure le statut de friendship ────────────────────────────
    if ($isFriendCode) {
        $where = 'u.friend_code = ? AND u.is_deleted = 0 AND u.id != ?';
        $params = [$q, $myId];
    } else {
        $where = 'u.pseudo LIKE ? AND u.is_deleted = 0 AND u.id != ?';
        $params = [$likeVal, $myId];
    }

    // Note : $myId apparaît deux fois dans le JOIN ON (requester et addressee)
    $stmt = $pdo->prepare("
        SELECT u.id, u.pseudo, u.friend_code, u.lang, u.last_login_at,
               p.avatar_data, p.avatar_border_color, p.selected_badges,
               f.id             AS friendship_id,
               f.status         AS friendship_status,
               f.requester_id   AS friendship_requester
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN friendships f ON (
          (f.requester_id = ? AND f.addressee_id = u.id)
          OR
          (f.addressee_id = ? AND f.requester_id = u.id)
        )
        WHERE {$where}
        ORDER BY
          CASE WHEN f.status = 'accepted' THEN 0
               WHEN f.status = 'pending'  THEN 1
               ELSE 2 END,
          u.pseudo ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([$myId, $myId, ...$params, $limit, $offset]);

    // Count pour pagination
    $cStmt = $pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$where}");
    $cStmt->execute($params);

} else {
    // ── Non connecté : pas de friendship info ─────────────────────────────────
    if ($isFriendCode) {
        $where  = 'u.friend_code = ? AND u.is_deleted = 0';
        $params = [$q];
    } else {
        $where  = 'u.pseudo LIKE ? AND u.is_deleted = 0';
        $params = [$likeVal];
    }

    $stmt = $pdo->prepare("
        SELECT u.id, u.pseudo, u.friend_code, u.lang, u.last_login_at,
               p.avatar_data, p.avatar_border_color, p.selected_badges,
               NULL AS friendship_status,
               NULL AS friendship_requester
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE {$where}
        ORDER BY u.pseudo ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([...$params, $limit, $offset]);

    $cStmt = $pdo->prepare("SELECT COUNT(*) FROM users u WHERE {$where}");
    $cStmt->execute($params);
}

$rows  = $stmt->fetchAll();
$total = (int)$cStmt->fetchColumn();

$formatted = array_map(function ($r) use ($myId) {
    $status    = $r['friendship_status'];
    $direction = null;
    if ($status === 'pending') {
        $direction = ((int)$r['friendship_requester'] === $myId) ? 'sent' : 'received';
    }
    return [
        'id'                   => (int)$r['id'],
        'pseudo'               => $r['pseudo'],
        'friend_code'          => $r['friend_code'],
        'lang'                 => $r['lang'],
        'avatar_data'          => $r['avatar_data'],
        'avatar_border_color'  => $r['avatar_border_color'] ?? '#ffffff',
        'selected_badges'      => json_decode($r['selected_badges'] ?? 'null') ?? [],
        'last_seen_at'         => $r['last_login_at'],
        'friendship_id'        => isset($r['friendship_id']) ? (int)$r['friendship_id'] : null,
        'friendship_status'    => $status,
        'friendship_direction' => $direction,
    ];
}, $rows);

jsonSuccess(['users' => $formatted, 'total' => $total]);
