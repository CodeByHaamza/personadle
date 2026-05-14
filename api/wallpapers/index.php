<?php
/**
 * GET  /api/wallpapers        → catalog with is_unlocked for current user
 * POST /api/wallpapers/unlock { wallpaper_id: "kamoshida_palace" }
 */
require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$action = end($parts);

/**
 * Vérifie si un utilisateur peut débloquer un wallpaper.
 *
 * La table `wallpapers` n'a pas de colonnes condition_type/condition_value structurées.
 * La colonne `unlock_condition` est du texte libre (pour affichage UI uniquement).
 * La colonne `is_default` indique si le wallpaper est disponible sans condition.
 *
 * Règles :
 *   - is_default = 1 : accessible à tous les utilisateurs authentifiés → toujours true
 *   - is_default = 0 et unlock_condition IS NULL : disponible sans condition → true
 *   - is_default = 0 et unlock_condition définie : nécessite une condition que seul
 *     le backend peut valider. La vérification précise (stats, badges…) dépend du
 *     texte libre de unlock_condition qui n'est pas parseable de façon fiable.
 *     Dans ce cas on retourne false et l'unlock doit passer par un endpoint dédié
 *     (ex: migration, admin grant) qui sait quelle condition vérifier.
 *
 * @param array $wallpaper  Ligne issue de la table wallpapers (is_default, unlock_condition)
 * @return bool  true si l'unlock est autorisé, false sinon
 */
function canUnlockWallpaper(array $wallpaper): bool
{
    // Wallpapers par défaut : disponibles pour tous sans condition
    if ((int)$wallpaper['is_default'] === 1) {
        return true;
    }

    // Wallpapers non-défaut sans condition déclarée : autorisés
    if (empty($wallpaper['unlock_condition'])) {
        return true;
    }

    // Wallpapers non-défaut avec unlock_condition définie : bloqués via /unlock
    // Ces wallpapers sont accordés via migration, admin, ou un endpoint spécialisé
    // qui vérifie la condition concrète (stats, badges, événements…).
    return false;
}

// ── GET /api/wallpapers — full catalog with per-user is_unlocked ─────────────
if ($method === 'GET') {
    $stmt = $pdo->prepare(
        "SELECT w.id, w.name, w.game, w.is_default, w.unlock_condition, w.image_path,
                (SELECT COUNT(*) FROM user_wallpapers uw
                 WHERE uw.user_id = ? AND uw.wallpaper_id = w.id) AS is_unlocked
         FROM wallpapers w
         ORDER BY w.game, w.id"
    );
    $stmt->execute([$authId]);
    jsonSuccess($stmt->fetchAll());
}

if ($method !== 'POST') jsonError('Method not allowed', 405);

$data = json_decode(file_get_contents('php://input'), true) ?? [];

// ── POST /api/wallpapers/unlock ──────────────────────────────────────────────
if ($action === 'unlock') {
    $wallpaperId = trim($data['wallpaper_id'] ?? '');
    if (!$wallpaperId || strlen($wallpaperId) > 64) jsonError('Invalid wallpaper_id', 400);

    // Récupère le wallpaper ET ses colonnes de condition en une seule requête
    $check = $pdo->prepare(
        'SELECT id, is_default, unlock_condition FROM wallpapers WHERE id = ? LIMIT 1'
    );
    $check->execute([$wallpaperId]);
    $wallpaper = $check->fetch();
    if (!$wallpaper) jsonError('Wallpaper not found in catalog', 404);

    // Vérifie que l'unlock est autorisé pour cet utilisateur
    if (!canUnlockWallpaper($wallpaper)) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO user_wallpapers (user_id, wallpaper_id) VALUES (?, ?)')
        ->execute([$authId, $wallpaperId]);

    jsonSuccess(['unlocked' => true, 'wallpaper_id' => $wallpaperId]);
}

jsonError('Unknown action', 404);
