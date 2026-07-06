<?php
/**
 * GET  /api/badges           → catalog with is_unlocked for current user
 * POST /api/badges/unlock    { badge_id: "ace_detective" }
 * POST /api/badges/redeem    { code: "PHANTOM2024" }
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/condition_check.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = requestPathSegments();
$action = end($parts);

// ── GET /api/badges — full catalog with per-user is_unlocked ─────────────────
if ($method === 'GET') {
    $lang = $_GET['lang'] ?? 'en';
    $col  = in_array($lang, ['fr','es','de','it'], true) ? "name_{$lang}" : 'name_en';

    // LEFT JOIN remplace la sous-requête corrélée N+1 (une requête au lieu de N)
    $stmt = $pdo->prepare(
        "SELECT b.slug, b.{$col} AS name, b.category, b.rarity,
                b.image_path, b.condition_en, b.is_secret,
                b.condition_type, b.condition_mode, b.condition_value,
                (bu.badge_id IS NOT NULL) AS is_unlocked
         FROM badges b
         LEFT JOIN badges_unlocked bu ON bu.badge_id = b.slug AND bu.user_id = ?
         ORDER BY FIELD(b.category,'achievement','streak','social','event','secret'), b.slug"
    );
    $stmt->execute([$authId]);
    jsonSuccess($stmt->fetchAll());
}

if ($method !== 'POST') jsonError('Method not allowed', 405);

$data = json_decode(file_get_contents('php://input'), true) ?? [];

// ── POST /api/badges/unlock ──────────────────────────────────────────────────
if ($action === 'unlock') {
    $badgeId = trim($data['badge_id'] ?? '');
    if (!$badgeId || strlen($badgeId) > 100) jsonError('Invalid badge_id', 400);

    $check = $pdo->prepare(
        'SELECT slug, condition_type, condition_mode, condition_value FROM badges WHERE slug = ? LIMIT 1'
    );
    $check->execute([$badgeId]);
    $badge = $check->fetch();
    if (!$badge) jsonError('Badge not found in catalog', 404);

    // Vérifie que la condition du badge est réellement remplie côté serveur
    if (!personadle_verify_condition(
        $pdo,
        $authId,
        $badge['condition_type'],
        $badge['condition_mode'] ?? null,
        isset($badge['condition_value']) ? (int) $badge['condition_value'] : null
    )) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
        ->execute([$authId, $badgeId]);

    jsonSuccess(['unlocked' => true, 'badge_id' => $badgeId]);
}

// ── POST /api/badges/redeem ──────────────────────────────────────────────────
if ($action === 'redeem') {
    $code = strtoupper(trim($data['code'] ?? ''));
    if (!$code || strlen($code) > 50) jsonError('Invalid code', 400);

    // Validate code exists, is active, and within date range
    $stmt = $pdo->prepare(
        'SELECT code, badge_id, is_permanent, start_date, end_date
         FROM event_codes
         WHERE code = ? AND is_active = 1
         LIMIT 1'
    );
    $stmt->execute([$code]);
    $ec = $stmt->fetch();
    if (!$ec) jsonError('Invalid or expired code', 404);

    // Date-limited codes: check window
    if (!$ec['is_permanent']) {
        $now = new DateTime('now', new DateTimeZone('Europe/Paris'));
        $today = $now->format('Y-m-d');
        if ($today < $ec['start_date'] || $today > $ec['end_date']) {
            jsonError('Code not active yet or already expired', 410);
        }
    }

    // Already redeemed?
    $stmt = $pdo->prepare('SELECT id FROM event_codes_redeemed WHERE user_id = ? AND code = ? LIMIT 1');
    $stmt->execute([$authId, $code]);
    if ($stmt->fetch()) jsonError('Code already redeemed', 409);

    $badgeId = $ec['badge_id'];

    $pdo->beginTransaction();
    try {
        // Record redemption
        $pdo->prepare('INSERT INTO event_codes_redeemed (user_id, code) VALUES (?, ?)')
            ->execute([$authId, $code]);
        // Unlock badge (if it exists in catalog)
        $check = $pdo->prepare('SELECT slug FROM badges WHERE slug = ? LIMIT 1');
        $check->execute([$badgeId]);
        if ($check->fetch()) {
            $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
                ->execute([$authId, $badgeId]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE badges redeem] ' . $e->getMessage());
        jsonError('Redeem failed', 500);
    }

    jsonSuccess(['redeemed' => true, 'code' => $code, 'badge_id' => $badgeId]);
}

jsonError('Unknown action', 404);
