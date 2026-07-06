<?php
/**
 * GET  /api/wallpapers        → catalog with is_unlocked for current user
 * POST /api/wallpapers/unlock { wallpaper_id: "kamoshida_palace" }
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/condition_check.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = requestPathSegments();
$action = end($parts);

/**
 * Vérifie si un utilisateur peut débloquer un wallpaper.
 *
 * - is_default = 1 : accessible à tous les utilisateurs authentifiés → toujours true
 * - is_default = 0 et condition_type NULL/vide/inconnu : REFUS (fail-closed). Contrairement
 *   à badges/titles, où condition_type NULL ou inconnu est un safe-fallback "true"
 *   volontaire (`personadle_verify_condition()`), wallpapers a toujours été fail-closed
 *   par conception (l'ancien verifyWallpaperCondition() faisait `default: return false`).
 *   Revue PR #14 : déléguer directement à personadle_verify_condition() aurait
 *   silencieusement inversé ce choix pour tout futur wallpaper ajouté sans condition_type
 *   — un wallpaper non-défaut doit explicitement dire 'manual' pour être débloqué sans
 *   vérification serveur, jamais l'omettre par oubli. Deuxième passe de revue : une
 *   simple vérification de non-vacuité ne suffisait pas — un condition_type mal
 *   orthographié ou retiré du vocabulaire (ex: l'ancien 'social_link_rank_10') est non
 *   vide mais tombe quand même sur le safe-fallback "true" partagé de
 *   personadle_verify_condition(). Comparer explicitement à la liste des types reconnus
 *   (`personadle_known_condition_types()`) ferme ce trou.
 * - is_default = 0 et condition_type reconnu ('manual' ou un type structuré) : vérifié
 *   par personadle_verify_condition().
 *
 * @param array $wallpaper  Ligne issue de la table wallpapers (is_default, condition_*)
 * @return bool  true si l'unlock est autorisé, false sinon
 */
function canUnlockWallpaper(PDO $pdo, int $userId, array $wallpaper): bool
{
    if ((int) $wallpaper['is_default'] === 1) {
        return true;
    }

    if (empty($wallpaper['condition_type'])
        || !in_array($wallpaper['condition_type'], personadle_known_condition_types(), true)
    ) {
        return false; // fail-closed : condition_type absent, vide ou inconnu du vocabulaire
    }

    return personadle_verify_condition(
        $pdo,
        $userId,
        $wallpaper['condition_type'] ?? null,
        $wallpaper['condition_mode'] ?? null,
        isset($wallpaper['condition_value']) ? (int) $wallpaper['condition_value'] : null
    );
}

// ── GET /api/wallpapers — full catalog with per-user is_unlocked ─────────────
// Revue PR #14 : condition_type/mode/value exposés à tout utilisateur authentifié
// (décision assumée — même contrat que GET /api/titles/GET /api/badges, voir leurs
// commentaires respectifs).
if ($method === 'GET') {
    $stmt = $pdo->prepare(
        "SELECT w.id, w.name, w.game, w.is_default, w.unlock_condition, w.image_path,
                w.condition_type, w.condition_mode, w.condition_value,
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
        'SELECT id, is_default, condition_type, condition_mode, condition_value
         FROM wallpapers WHERE id = ? LIMIT 1'
    );
    $check->execute([$wallpaperId]);
    $wallpaper = $check->fetch();
    if (!$wallpaper) jsonError('Wallpaper not found in catalog', 404);

    if (!canUnlockWallpaper($pdo, $authId, $wallpaper)) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO user_wallpapers (user_id, wallpaper_id) VALUES (?, ?)')
        ->execute([$authId, $wallpaperId]);

    jsonSuccess(['unlocked' => true, 'wallpaper_id' => $wallpaperId]);
}

jsonError('Unknown action', 404);
