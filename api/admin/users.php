<?php
/**
 * GET /api/admin/users?q=&page=1&limit=20
 *
 * Liste paginée de tous les utilisateurs non supprimés.
 * Recherche par pseudo, email ou friend_code via ?q=.
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$pdo = pdo();

// ── Tri (2.2) : created (défaut), last_login, pseudo ─────────────────────────
$SORTS = [
    'created'    => 'u.created_at DESC',
    'last_login' => 'u.last_login_at DESC',
    'pseudo'     => 'u.pseudo ASC',
];
$sortKey = (string) ($_GET['sort'] ?? 'created');
$orderBy = $SORTS[$sortKey] ?? $SORTS['created'];

// ── Export CSV (2.2) : ?export=csv — tous les comptes non supprimés ──────────
if (($_GET['export'] ?? '') === 'csv') {
    personadle_log_admin_action($pdo, $adminId, 'users.export_csv', 'user', '*', []);
    $rows = $pdo->query(
        'SELECT u.id, u.pseudo, u.email, u.lang, u.friend_code, u.is_admin, u.is_banned, u.created_at, u.last_login_at,
                (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id) AS games
         FROM users u WHERE u.is_deleted = 0 ORDER BY u.created_at DESC'
    )->fetchAll();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="personadle_users_' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'wb');
    fwrite($out, "\xEF\xBB\xBF"); // BOM : Excel lit l'UTF-8
    fputcsv($out, ['id', 'pseudo', 'email', 'lang', 'friend_code', 'is_admin', 'is_banned', 'created_at', 'last_login_at', 'games'], ';');
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['id'], $r['pseudo'], $r['email'], $r['lang'], $r['friend_code'],
            (int) $r['is_admin'], (int) $r['is_banned'], $r['created_at'], $r['last_login_at'], (int) $r['games'],
        ], ';');
    }
    fclose($out);
    exit;
}

// ── Pagination ────────────────────────────────────────────────────────────────
$page  = max(1, (int) ($_GET['page']  ?? 1));
$limit = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

// ── Recherche ─────────────────────────────────────────────────────────────────
$q = trim($_GET['q'] ?? '');

if ($q !== '') {
    $like = '%' . $q . '%';

    $countStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM users u
         WHERE u.is_deleted = 0
           AND (u.pseudo LIKE ? OR u.email LIKE ? OR u.friend_code LIKE ?)'
    );
    $countStmt->execute([$like, $like, $like]);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT u.id, u.pseudo, u.email, u.friend_code, u.lang,
                u.created_at, u.last_login_at, u.is_admin,
                p.avatar_data, p.avatar_border_color
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.is_deleted = 0
           AND (u.pseudo LIKE ? OR u.email LIKE ? OR u.friend_code LIKE ?)
         ORDER BY ' . $orderBy . '
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([$like, $like, $like, $limit, $offset]);
} else {
    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE is_deleted = 0');
    $countStmt->execute();
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT u.id, u.pseudo, u.email, u.friend_code, u.lang,
                u.created_at, u.last_login_at, u.is_admin,
                p.avatar_data, p.avatar_border_color
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.is_deleted = 0
         ORDER BY ' . $orderBy . '
         LIMIT ? OFFSET ?'
    );
    $stmt->execute([$limit, $offset]);
}

$rows = $stmt->fetchAll();

$users = array_map(fn($row) => [
    'id'                  => (int)  $row['id'],
    'pseudo'              =>        $row['pseudo'],
    'email'               =>        $row['email'],
    'friend_code'         =>        $row['friend_code'],
    'lang'                =>        $row['lang'],
    'created_at'          =>        $row['created_at'],
    'last_login_at'       =>        $row['last_login_at'],
    'is_admin'            => (bool) $row['is_admin'],
    'avatar_data'         =>        $row['avatar_data']         ?? null,
    'avatar_border_color' =>        $row['avatar_border_color'] ?? '#ffffff',
], $rows);

jsonSuccess([
    'users' => $users,
    'total' => $total,
    'page'  => $page,
    'limit' => $limit,
]);
