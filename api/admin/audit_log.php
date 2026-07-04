<?php
/**
 * GET /api/admin/audit_log → liste paginée des actions admin journalisées.
 *
 * Query params : ?page=1&limit=30&action=user.ban&target_type=user&search=texte
 * `search` matche le pseudo de l'admin, l'action, ou le target_id.
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$pdo = pdo();

$page       = max(1, (int) ($_GET['page']  ?? 1));
$limit      = min(100, max(1, (int) ($_GET['limit'] ?? 30)));
$offset     = ($page - 1) * $limit;
$action     = trim($_GET['action']      ?? '');
$targetType = trim($_GET['target_type'] ?? '');
$search     = trim($_GET['search']      ?? '');

$where  = [];
$params = [];

if ($action !== '') {
    $where[]  = 'aal.action = ?';
    $params[] = $action;
}
if ($targetType !== '') {
    $where[]  = 'aal.target_type = ?';
    $params[] = $targetType;
}
if ($search !== '') {
    $where[]  = '(u.pseudo LIKE ? OR aal.action LIKE ? OR aal.target_id LIKE ?)';
    $like     = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}
$whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("
    SELECT COUNT(*) FROM admin_audit_log aal
    LEFT JOIN users u ON u.id = aal.admin_id
    $whereSQL
");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT aal.id, aal.action, aal.target_type, aal.target_id, aal.details, aal.created_at,
           u.id AS admin_id, u.pseudo AS admin_pseudo
    FROM admin_audit_log aal
    LEFT JOIN users u ON u.id = aal.admin_id
    $whereSQL
    ORDER BY aal.created_at DESC
    LIMIT ? OFFSET ?
");
$stmt->execute([...$params, $limit, $offset]);
$rows = $stmt->fetchAll();

jsonSuccess([
    'data'  => array_map(fn($r) => [
        'id'            => (int) $r['id'],
        'admin_id'      => $r['admin_id'] ? (int) $r['admin_id'] : null,
        'admin_pseudo'  => $r['admin_pseudo'],
        'action'        => $r['action'],
        'target_type'   => $r['target_type'],
        'target_id'     => $r['target_id'],
        'details'       => $r['details'] ? json_decode($r['details'], true) : null,
        'created_at'    => $r['created_at'],
    ], $rows),
    'total' => $total,
    'page'  => $page,
    'limit' => $limit,
]);
