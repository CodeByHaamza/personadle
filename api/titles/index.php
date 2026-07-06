<?php
/**
 * GET  /api/titles           → liste tous les titres avec image_path + is_unlocked pour l'utilisateur courant
 * POST /api/titles/unlock    { title_id: 3 }  → débloque un titre pour l'utilisateur
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/condition_check.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = requestPathSegments();
$action = end($parts);

if ($method === 'GET') {
    $lang = $_GET['lang'] ?? 'en';
    $col  = in_array($lang, ['fr','es','de','it'], true) ? "name_{$lang}" : 'name_en';

    $stmt = $pdo->prepare(
        "SELECT t.id, t.slug, t.image_path, t.{$col} AS name, t.rarity,
                t.condition_type, t.condition_mode, t.condition_value,
                (SELECT COUNT(*) FROM user_titles ut WHERE ut.user_id = ? AND ut.title_id = t.id) AS is_unlocked
         FROM titles t ORDER BY t.id"
    );
    $stmt->execute([$authId]);
    jsonSuccess($stmt->fetchAll());
}

if ($method === 'POST' && $action === 'unlock') {
    $data    = json_decode(file_get_contents('php://input'), true) ?? [];
    $titleId = (int)($data['title_id'] ?? 0);

    // Accepte aussi title_slug comme fallback (JS envoie le slug, plus fiable que l'id local)
    if ($titleId <= 0 && !empty($data['title_slug'])) {
        $s = $pdo->prepare('SELECT id FROM titles WHERE slug = ? LIMIT 1');
        $s->execute([trim($data['title_slug'])]);
        $titleId = (int)($s->fetchColumn() ?: 0);
    }

    if ($titleId <= 0) jsonError('Invalid title_id or title_slug', 400);

    // Récupère le titre ET ses colonnes de condition en une seule requête
    $check = $pdo->prepare(
        'SELECT id, condition_type, condition_mode, condition_value FROM titles WHERE id = ? LIMIT 1'
    );
    $check->execute([$titleId]);
    $title = $check->fetch();
    if (!$title) jsonError('Title not found', 404);

    // Vérifie que la condition est remplie côté serveur
    if (!personadle_verify_condition(
        $pdo,
        $authId,
        $title['condition_type'],
        $title['condition_mode'] ?? null,
        isset($title['condition_value']) ? (int)$title['condition_value'] : null
    )) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO user_titles (user_id, title_id) VALUES (?, ?)')
        ->execute([$authId, $titleId]);

    jsonSuccess(['unlocked' => true, 'title_id' => $titleId]);
}

jsonError('Method not allowed', 405);
