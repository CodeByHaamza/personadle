<?php
/**
 * GET    /api/admin/event_codes          → liste tous les codes + stats usage
 * POST   /api/admin/event_codes          → créer un nouveau code
 * PATCH  /api/admin/event_codes/:code    → modifier (is_active, dates, description)
 * DELETE /api/admin/event_codes/:code    → supprimer un code
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/admin_validation.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// Extraire le code depuis l'URL si présent (/api/admin/event_codes/MYCODE)
$parts = requestPathSegments();
// parts: [..., 'admin', 'event_codes', 'MYCODE?']
$codeParam = strtoupper(trim(end($parts)));
$isCollection = ($codeParam === 'EVENT_CODES' || $codeParam === '');

// ── GET — liste + stats ──────────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $pdo->query(
        'SELECT ec.code, ec.badge_id, ec.start_date, ec.end_date,
                ec.is_permanent, ec.is_active, ec.description, ec.created_at,
                COUNT(ecr.id) AS redemption_count
         FROM event_codes ec
         LEFT JOIN event_codes_redeemed ecr ON ecr.code = ec.code
         GROUP BY ec.code
         ORDER BY ec.created_at DESC'
    );
    jsonSuccess($stmt->fetchAll());
}

// ── POST — créer un code ─────────────────────────────────────────────────────
if ($method === 'POST') {
    $data = getJsonBody();

    $code        = strtoupper(trim($data['code']        ?? ''));
    $badgeId     = trim($data['badge_id']               ?? '');
    $description = trim($data['description']            ?? '');
    $isPermanent = (int) (bool) ($data['is_permanent']  ?? false);
    $isActive    = (int) (bool) ($data['is_active']     ?? true);
    $startDate   = trim($data['start_date']             ?? '');
    $endDate     = trim($data['end_date']               ?? '');

    if ($codeError = personadle_validate_event_code($code)) {
        jsonError($codeError, 400);
    }
    if (!$badgeId || strlen($badgeId) > 100) jsonError('badge_id invalide', 400);

    $badgeCheck = $pdo->prepare('SELECT slug FROM badges WHERE slug = ? LIMIT 1');
    $badgeCheck->execute([$badgeId]);
    if (!$badgeCheck->fetch()) jsonError('Badge introuvable dans le catalogue (vérifie le slug exact)', 400);

    if (!$isPermanent && (!$startDate || !$endDate)) {
        jsonError('start_date et end_date requis pour un code non permanent', 400);
    }

    $check = $pdo->prepare('SELECT code FROM event_codes WHERE code = ? LIMIT 1');
    $check->execute([$code]);
    if ($check->fetch()) jsonError('Code déjà existant', 409);

    $pdo->prepare(
        'INSERT INTO event_codes (code, badge_id, start_date, end_date, is_permanent, is_active, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $code,
        $badgeId,
        $isPermanent ? null : ($startDate ?: null),
        $isPermanent ? null : ($endDate   ?: null),
        $isPermanent,
        $isActive,
        $description ?: null,
    ]);

    personadle_log_admin_action($pdo, $adminId, 'event_code.create', 'event_code', $code, [
        'badge_id' => $badgeId,
        'is_permanent' => (bool) $isPermanent,
        'is_active' => (bool) $isActive,
        'start_date' => $startDate ?: null,
        'end_date' => $endDate ?: null,
    ]);

    jsonSuccess(['created' => true, 'code' => $code]);
}

// ── PATCH — modifier un code ─────────────────────────────────────────────────
if ($method === 'PATCH') {
    if (!$codeParam || $isCollection) jsonError('Code requis dans l\'URL', 400);

    $stmt = $pdo->prepare('SELECT code FROM event_codes WHERE code = ? LIMIT 1');
    $stmt->execute([$codeParam]);
    if (!$stmt->fetch()) jsonError('Code introuvable', 404);

    $data    = getJsonBody();
    $fields  = [];
    $params  = [];
    $changed = [];

    if (array_key_exists('is_active', $data)) {
        $fields[] = 'is_active = ?';
        $params[] = (int) (bool) $data['is_active'];
        $changed['is_active'] = (bool) $data['is_active'];
    }
    if (array_key_exists('description', $data)) {
        $fields[] = 'description = ?';
        $params[] = trim($data['description']) ?: null;
        $changed['description'] = trim($data['description']) ?: null;
    }
    if (array_key_exists('start_date', $data)) {
        $fields[] = 'start_date = ?';
        $params[] = $data['start_date'] ?: null;
        $changed['start_date'] = $data['start_date'] ?: null;
    }
    if (array_key_exists('end_date', $data)) {
        $fields[] = 'end_date = ?';
        $params[] = $data['end_date'] ?: null;
        $changed['end_date'] = $data['end_date'] ?: null;
    }
    if (array_key_exists('is_permanent', $data)) {
        $fields[] = 'is_permanent = ?';
        $params[] = (int) (bool) $data['is_permanent'];
        $changed['is_permanent'] = (bool) $data['is_permanent'];
    }

    if (empty($fields)) jsonError('Aucun champ modifiable fourni', 400);

    $params[] = $codeParam;
    $pdo->prepare('UPDATE event_codes SET ' . implode(', ', $fields) . ' WHERE code = ?')
        ->execute($params);

    personadle_log_admin_action($pdo, $adminId, 'event_code.update', 'event_code', $codeParam, $changed);

    jsonSuccess(['updated' => true, 'code' => $codeParam]);
}

// ── DELETE — supprimer un code ───────────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$codeParam || $isCollection) jsonError('Code requis dans l\'URL', 400);

    $stmt = $pdo->prepare('SELECT code FROM event_codes WHERE code = ? LIMIT 1');
    $stmt->execute([$codeParam]);
    if (!$stmt->fetch()) jsonError('Code introuvable', 404);

    $pdo->prepare('DELETE FROM event_codes WHERE code = ?')->execute([$codeParam]);

    personadle_log_admin_action($pdo, $adminId, 'event_code.delete', 'event_code', $codeParam);

    jsonSuccess(['deleted' => true, 'code' => $codeParam]);
}

jsonError('Method Not Allowed', 405);
