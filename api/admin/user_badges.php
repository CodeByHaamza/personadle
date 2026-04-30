<?php
/**
 * POST   /api/admin/users/:id/badges        → accorder un badge
 * DELETE /api/admin/users/:id/badges/:slug  → retirer un badge
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire userId et slug depuis l'URL ──────────────────────────────────────
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
// POST /api/admin/users/:id/badges — accorder un badge
// Body : { "slug": "ace_detective" }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $data = getJsonBody();
    $slug = trim((string) ($data['slug'] ?? ''));
    if (!$slug || strlen($slug) > 100) jsonError('Invalid or missing slug', 400);

    // Vérifier que le badge existe dans le catalogue
    $check = $pdo->prepare('SELECT slug FROM badges WHERE slug = ? LIMIT 1');
    $check->execute([$slug]);
    if (!$check->fetch()) jsonError('Badge not found in catalog', 404);

    // Vérifier si le badge était déjà possédé
    $existing = $pdo->prepare('SELECT id FROM badges_unlocked WHERE user_id = ? AND badge_id = ? LIMIT 1');
    $existing->execute([$userId, $slug]);
    $alreadyHad = (bool) $existing->fetch();

    if (!$alreadyHad) {
        $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
            ->execute([$userId, $slug]);
    }

    jsonSuccess(['success' => true, 'already_had' => $alreadyHad]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id/badges/:slug — retirer un badge
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    // Le slug est le dernier segment de l'URL (après "badges")
    $badgesIdx = array_search('badges', $parts);
    $slug      = $badgesIdx !== false ? ($parts[$badgesIdx + 1] ?? '') : '';
    if (!$slug) jsonError('Missing badge slug in URL', 400);

    $pdo->prepare('DELETE FROM badges_unlocked WHERE user_id = ? AND badge_id = ?')
        ->execute([$userId, $slug]);

    jsonSuccess(['success' => true]);
}

jsonError('Method Not Allowed', 405);
