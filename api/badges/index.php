<?php
/**
 * POST /api/badges/unlock   { badge_id: "ace_detective" }
 * → insère dans badges_unlocked (IGNORE si déjà présent)
 *
 * POST /api/badges/redeem   { code: "PHANTOM2024" }
 * → rachète un code événement
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$authId = requireAuth();
$pdo    = pdo();
$data   = json_decode(file_get_contents('php://input'), true) ?? [];

$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$action = end($parts);

if ($action === 'unlock') {
    $badgeId = trim($data['badge_id'] ?? '');
    if (!$badgeId || strlen($badgeId) > 100) jsonError('Invalid badge_id', 400);

    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)'
    );
    $stmt->execute([$authId, $badgeId]);

    jsonSuccess(['unlocked' => true, 'badge_id' => $badgeId]);
}

if ($action === 'redeem') {
    $code = strtoupper(trim($data['code'] ?? ''));
    if (!$code || strlen($code) > 50) jsonError('Invalid code', 400);

    // Vérifier que le code existe et n'a pas déjà été utilisé par cet user
    $stmt = $pdo->prepare('SELECT id FROM event_codes WHERE code = ? LIMIT 1');
    $stmt->execute([$code]);
    $eventCode = $stmt->fetch();
    if (!$eventCode) jsonError('Invalid or expired code', 404);

    $stmt = $pdo->prepare('SELECT id FROM event_codes_redeemed WHERE user_id = ? AND code = ? LIMIT 1');
    $stmt->execute([$authId, $code]);
    if ($stmt->fetch()) jsonError('Code already redeemed', 409);

    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO event_codes_redeemed (user_id, code) VALUES (?, ?)')
            ->execute([$authId, $code]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE badges redeem] ' . $e->getMessage());
        jsonError('Redeem failed', 500);
    }

    jsonSuccess(['redeemed' => true, 'code' => $code]);
}

jsonError('Unknown action', 404);
