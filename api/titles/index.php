<?php
/**
 * GET  /api/titles           → liste tous les titres avec image_path + is_unlocked pour l'utilisateur courant
 * POST /api/titles/unlock    { title_id: 3 }  → débloque un titre pour l'utilisateur
 */
require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$action = end($parts);

if ($method === 'GET') {
    $lang = $_GET['lang'] ?? 'en';
    $col  = in_array($lang, ['fr','es','de','it'], true) ? "name_{$lang}" : 'name_en';

    $stmt = $pdo->prepare(
        "SELECT t.id, t.slug, t.{$col} AS name, t.rarity,
                t.condition_type, t.condition_value,
                (SELECT COUNT(*) FROM user_titles ut WHERE ut.user_id = ? AND ut.title_id = t.id) AS is_unlocked
         FROM titles t ORDER BY t.id"
    );
    $stmt->execute([$authId]);
    jsonSuccess($stmt->fetchAll());
}

if ($method === 'POST' && $action === 'unlock') {
    $data    = json_decode(file_get_contents('php://input'), true) ?? [];
    $titleId = (int)($data['title_id'] ?? 0);
    if ($titleId <= 0) jsonError('Invalid title_id', 400);

    $check = $pdo->prepare('SELECT id FROM titles WHERE id = ? LIMIT 1');
    $check->execute([$titleId]);
    if (!$check->fetch()) jsonError('Title not found', 404);

    $pdo->prepare('INSERT IGNORE INTO user_titles (user_id, title_id) VALUES (?, ?)')
        ->execute([$authId, $titleId]);

    jsonSuccess(['unlocked' => true, 'title_id' => $titleId]);
}

jsonError('Method not allowed', 405);
