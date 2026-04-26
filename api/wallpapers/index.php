<?php
/**
 * POST /api/wallpapers/unlock   { wallpaper_id: "joker_palace" }
 * → insère dans user_wallpapers (IGNORE si déjà présent)
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$authId = requireAuth();
$pdo    = pdo();
$data   = json_decode(file_get_contents('php://input'), true) ?? [];

$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$action = end($parts);

if ($action === 'unlock') {
    $wallpaperId = trim($data['wallpaper_id'] ?? '');
    if (!$wallpaperId || strlen($wallpaperId) > 100) jsonError('Invalid wallpaper_id', 400);

    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO user_wallpapers (user_id, wallpaper_id) VALUES (?, ?)'
    );
    $stmt->execute([$authId, $wallpaperId]);

    jsonSuccess(['unlocked' => true, 'wallpaper_id' => $wallpaperId]);
}

jsonError('Unknown action', 404);
