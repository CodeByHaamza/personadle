<?php
/**
 * GET    /api/admin/rate_limits          → liste paginée des compteurs actifs
 * DELETE /api/admin/rate_limits?key=...  → purger un compteur précis avant expiration
 *
 * Query params GET  : ?page=1&limit=30&search=login
 * Query params DELETE : ?key=login:1.2.3.4 (clé exacte, cf. rl_key en base)
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── DELETE /api/admin/rate_limits?key=... — purger un compteur précis ────────
if ($method === 'DELETE') {
    $key = trim($_GET['key'] ?? '');
    if ($key === '') jsonError('Missing key', 400);

    $stmt = $pdo->prepare('DELETE FROM rate_limits WHERE rl_key = ?');
    $stmt->execute([$key]);

    personadle_log_admin_action($pdo, $adminId, 'rate_limit.clear', 'rate_limit', $key);

    jsonSuccess(['deleted' => $stmt->rowCount() > 0]);
}

// ── GET /api/admin/rate_limits — liste paginée ────────────────────────────────
if ($method === 'GET') {
    $page   = max(1, (int) ($_GET['page']  ?? 1));
    $limit  = min(100, max(1, (int) ($_GET['limit'] ?? 30)));
    $offset = ($page - 1) * $limit;
    $search = trim($_GET['search'] ?? '');

    $where  = [];
    $params = [];
    if ($search !== '') {
        $where[]  = 'rl_key LIKE ?';
        $params[] = '%' . $search . '%';
    }
    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limits $whereSQL");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT rl_key, hits, window_start
        FROM rate_limits
        $whereSQL
        ORDER BY window_start DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([...$params, $limit, $offset]);
    $rows = $stmt->fetchAll();

    jsonSuccess([
        'data' => array_map(fn($r) => [
            'rl_key'       => $r['rl_key'],
            'hits'         => (int) $r['hits'],
            'window_start' => (int) $r['window_start'],
        ], $rows),
        'total' => $total,
        'page'  => $page,
        'limit' => $limit,
    ]);
}

jsonError('Method Not Allowed', 405);
