<?php
/**
 * POST   /api/admin/users/:id/wallpapers       → accorder un wallpaper
 * DELETE /api/admin/users/:id/wallpapers/:wid  → retirer un wallpaper
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire userId depuis l'URL ──────────────────────────────────────────────
$path     = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
$parts    = explode('/', $path);
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

// Vérifier que l'utilisateur existe
$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$userId]);
if (!$stmt->fetch()) jsonError('User not found', 404);


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/users/:id/wallpapers — accorder un wallpaper
// Body : { "wallpaper_id": "kamoshida_palace" }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $data        = getJsonBody();
    $wallpaperId = trim((string) ($data['wallpaper_id'] ?? ''));
    if (!$wallpaperId || strlen($wallpaperId) > 100) jsonError('Invalid or missing wallpaper_id', 400);

    // Vérifier que le wallpaper existe dans le catalogue
    $check = $pdo->prepare('SELECT id FROM wallpapers WHERE id = ? LIMIT 1');
    $check->execute([$wallpaperId]);
    if (!$check->fetch()) jsonError('Wallpaper not found in catalog', 404);

    // Vérifier si le wallpaper était déjà possédé
    $existing = $pdo->prepare('SELECT user_id FROM user_wallpapers WHERE user_id = ? AND wallpaper_id = ? LIMIT 1');
    $existing->execute([$userId, $wallpaperId]);
    $alreadyHad = (bool) $existing->fetch();

    if (!$alreadyHad) {
        $pdo->prepare('INSERT IGNORE INTO user_wallpapers (user_id, wallpaper_id) VALUES (?, ?)')
            ->execute([$userId, $wallpaperId]);
        personadle_log_admin_action($pdo, $adminId, 'wallpaper.grant', 'user', (string) $userId, ['wallpaper_id' => $wallpaperId]);
    }

    jsonSuccess(['success' => true, 'already_had' => $alreadyHad]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id/wallpapers/:wid — retirer un wallpaper
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    // Le wid est le dernier segment de l'URL (après "wallpapers")
    $wallIdx     = array_search('wallpapers', $parts);
    $wallpaperId = $wallIdx !== false ? ($parts[$wallIdx + 1] ?? '') : '';
    if (!$wallpaperId) jsonError('Missing wallpaper_id in URL', 400);

    $pdo->prepare('DELETE FROM user_wallpapers WHERE user_id = ? AND wallpaper_id = ?')
        ->execute([$userId, $wallpaperId]);

    personadle_log_admin_action($pdo, $adminId, 'wallpaper.revoke', 'user', (string) $userId, ['wallpaper_id' => $wallpaperId]);

    jsonSuccess(['success' => true]);
}

jsonError('Method Not Allowed', 405);
