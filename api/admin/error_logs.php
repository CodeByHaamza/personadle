<?php
/**
 * GET /api/admin/error_logs → liste paginée des erreurs backend capturées.
 *
 * Query params : ?page=1&limit=30&level=error&search=texte
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$pdo = pdo();

$page   = max(1, (int) ($_GET['page']  ?? 1));
$limit  = min(100, max(1, (int) ($_GET['limit'] ?? 30)));
$offset = ($page - 1) * $limit;
$level  = trim($_GET['level']  ?? '');
$search = trim($_GET['search'] ?? '');

$where  = [];
$params = [];

if (in_array($level, ['error', 'warning', 'info'], true)) {
    $where[]  = 'el.level = ?';
    $params[] = $level;
}
if ($search !== '') {
    $where[]  = 'el.message LIKE ?';
    $params[] = '%' . $search . '%';
}
$whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$countStmt = $pdo->prepare("SELECT COUNT(*) FROM error_log el $whereSQL");
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT el.id, el.level, el.message, el.context, el.created_at,
           u.id AS user_id, u.pseudo AS user_pseudo
    FROM error_log el
    LEFT JOIN users u ON u.id = el.user_id
    $whereSQL
    ORDER BY el.created_at DESC
    LIMIT ? OFFSET ?
");
$stmt->execute([...$params, $limit, $offset]);
$rows = $stmt->fetchAll();

jsonSuccess([
    'data'  => array_map(fn($r) => [
        'id'          => (int) $r['id'],
        'level'       => $r['level'],
        'message'     => $r['message'],
        'context'     => $r['context'] ? json_decode($r['context'], true) : null,
        'user_id'     => $r['user_id'] ? (int) $r['user_id'] : null,
        'user_pseudo' => $r['user_pseudo'],
        'created_at'  => $r['created_at'],
    ], $rows),
    'total'  => $total,
    'page'   => $page,
    'limit'  => $limit,
]);
