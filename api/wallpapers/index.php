<?php
/**
 * GET  /api/wallpapers        → catalog with is_unlocked for current user
 * POST /api/wallpapers/unlock { wallpaper_id: "kamoshida_palace" }
 */
require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = requestPathSegments();
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

    // Wallpapers non-défaut avec unlock_condition définie : la condition concrète
    // est validée par verifyWallpaperCondition() (appelée par l'endpoint /unlock).
    return false;
}

/**
 * Valide côté serveur la condition d'un wallpaper déblocable (anti-triche).
 *
 * Les conditions calculables depuis la BDD (stats, social links, amis) sont
 * re-vérifiées ; celles reposant sur des flags purement client (jour P4 consécutif,
 * défi relevé) sont acceptées sur déclaration du client — comme les badges à flags.
 *
 * @return bool true si la condition est remplie (unlock autorisé)
 */
function verifyWallpaperCondition(PDO $pdo, int $userId, string $wallpaperId): bool
{
    switch ($wallpaperId) {
        case 'kamoshida_palace': {
            // Au moins 1 victoire dans chacun des 6 modes
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT LOWER(mode)) FROM user_stats WHERE user_id = ? AND wins > 0'
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= 6;
        }
        case 'rise_dungeons': {
            // 30 parties en mode Music
            $s = $pdo->prepare(
                "SELECT COALESCE(SUM(games), 0) FROM user_stats WHERE user_id = ? AND LOWER(mode) = 'music'"
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= 30;
        }
        case 'mitsuo_dungeons': {
            // 75 parties tous modes
            $s = $pdo->prepare('SELECT COALESCE(SUM(games), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= 75;
        }
        case 'dark_shopping_district': {
            // Social Link rang >= 5
            $s = $pdo->prepare(
                'SELECT COALESCE(MAX(`rank`), 0) FROM social_links WHERE user_a_id = ? OR user_b_id = ?'
            );
            $s->execute([$userId, $userId]);
            return (int) $s->fetchColumn() >= 5;
        }
        case 'madarame_wallpaper': {
            // Au moins 1 ami accepté (la partie "avatar custom" reste côté client)
            $s = $pdo->prepare(
                "SELECT COUNT(*) FROM friendships
                 WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)"
            );
            $s->execute([$userId, $userId]);
            return (int) $s->fetchColumn() >= 1;
        }
        // Flags purement client (non re-vérifiables serveur) → confiance, comme les badges à flags
        case 'yukiko_dungeons':
        case 'kanji_dungeons':
            return true;
        default:
            return false; // wallpaper conditionnel inconnu → refus
    }
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

    // Wallpaper libre (défaut / sans condition) OU condition validée côté serveur
    if (!canUnlockWallpaper($wallpaper) && !verifyWallpaperCondition($pdo, $authId, $wallpaperId)) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO user_wallpapers (user_id, wallpaper_id) VALUES (?, ?)')
        ->execute([$authId, $wallpaperId]);

    jsonSuccess(['unlocked' => true, 'wallpaper_id' => $wallpaperId]);
}

jsonError('Unknown action', 404);
