<?php
/**
 * GET  /api/admin/deletion_requests             → liste paginée des demandes RGPD
 * POST /api/admin/deletion_requests/:id/process → déclencher le hard delete avant l'échéance J+30
 *
 * Le soft-delete (anonymisation immédiate) a déjà eu lieu côté client au moment
 * de la demande (api/user/index.php DELETE) — il n'y a donc rien à "annuler" ici,
 * seulement une visibilité sur les demandes en attente/traitées et la possibilité
 * de forcer le hard delete plus tôt que le cron J+30 (api/cron/hard-delete.php).
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

$parts = requestPathSegments();
$drIdx = array_search('deletion_requests', $parts);

// ── POST /api/admin/deletion_requests/:id/process — hard delete anticipé ─────
if ($method === 'POST' && $drIdx !== false
    && ctype_digit($parts[$drIdx + 1] ?? '')
    && ($parts[$drIdx + 2] ?? '') === 'process'
) {
    $requestId = (int) $parts[$drIdx + 1];

    $pdo->beginTransaction();
    try {
        personadle_process_deletion_request($pdo, $requestId);
        $pdo->commit();
    } catch (PersonadleDeletionRequestException $e) {
        $pdo->rollBack();
        jsonError($e->getMessage(), $e->status);
    } catch (Throwable $e) {
        $pdo->rollBack();
        personadle_log_error($pdo, 'error', $e->getMessage(), [
            'source' => 'admin-deletion-requests-process',
            'request_id' => $requestId,
        ], $adminId);
        jsonError('Failed to process deletion request', 500);
    }

    personadle_log_admin_action($pdo, $adminId, 'deletion_request.process_early', 'deletion_request', (string) $requestId);

    jsonSuccess(['processed' => true]);
}

// ── GET /api/admin/deletion_requests — liste paginée ──────────────────────────
if ($method === 'GET') {
    $page   = max(1, (int) ($_GET['page']  ?? 1));
    $limit  = min(100, max(1, (int) ($_GET['limit'] ?? 30)));
    $offset = ($page - 1) * $limit;
    $status = trim($_GET['status'] ?? ''); // 'pending' | 'processed' | ''

    $where  = [];
    $params = [];
    if ($status === 'pending') {
        $where[] = 'dr.processed_at IS NULL';
    } elseif ($status === 'processed') {
        $where[] = 'dr.processed_at IS NOT NULL';
    }
    $whereSQL = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM deletion_requests dr $whereSQL");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT dr.id, dr.user_id, dr.requested_at, dr.processed_at, dr.deletion_type,
               u.pseudo AS user_pseudo
        FROM deletion_requests dr
        LEFT JOIN users u ON u.id = dr.user_id
        $whereSQL
        ORDER BY dr.requested_at DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute([...$params, $limit, $offset]);
    $rows = $stmt->fetchAll();

    jsonSuccess([
        'data' => array_map(fn($r) => [
            'id'             => (int) $r['id'],
            'user_id'        => (int) $r['user_id'],
            'user_pseudo'    => $r['user_pseudo'],
            'requested_at'   => $r['requested_at'],
            'processed_at'   => $r['processed_at'],
            'deletion_type'  => $r['deletion_type'],
        ], $rows),
        'total' => $total,
        'page'  => $page,
        'limit' => $limit,
    ]);
}

jsonError('Method Not Allowed', 405);
