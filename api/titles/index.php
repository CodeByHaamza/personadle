<?php
/**
 * GET  /api/titles           → liste tous les titres avec image_path + is_unlocked pour l'utilisateur courant
 * POST /api/titles/unlock    { title_id: 3 }  → débloque un titre pour l'utilisateur
 */
require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = requestPathSegments();
$action = end($parts);

/**
 * Vérifie si un utilisateur a rempli la condition pour débloquer un titre.
 *
 * Les condition_type supportés (définis dans le schéma titles) :
 *   wins_total       → SUM(wins) tous modes
 *   mode_wins        → wins dans condition_mode
 *   streak_record    → MAX(streak_record) tous modes
 *   perfect_wins     → SUM(perfect_wins) tous modes
 *   unique_days      → nb de jours uniques joués (COUNT DISTINCT played_date)
 *   giveups_total    → SUM(giveups) tous modes
 *   friends_count    → nb d'amis acceptés
 *   badges_count     → nb de badges débloqués
 *   social_link_rank_10 → au moins un Social Link au rang 10
 *   all_modes_won    → au moins 1 victoire dans chacun des 6 modes
 *   weekly_clean_modes → nb de modes où l'utilisateur a joué cette semaine (approx.)
 *   classic_p1_wins  → victoires en mode classic (alias de mode_wins classic)
 *   emoji_p2_wins    → victoires en mode emoji (alias de mode_wins emoji)
 *   joker_profile    → condition manuelle — retourne true (vérifié en aval par admin)
 *   manual           → condition manuelle — retourne true (vérifié en aval par admin)
 *   NULL ou inconnu  → true (safe fallback)
 *
 * @param PDO    $pdo          Instance PDO
 * @param int    $userId       ID de l'utilisateur authentifié
 * @param string $condType     Valeur de condition_type dans la table titles
 * @param string $condMode     Valeur de condition_mode (ex: 'classic', 'emoji'…) ou ''
 * @param int    $condValue    Valeur numérique de la condition
 * @return bool  true si la condition est remplie, false sinon
 */
function verifyTitleCondition(PDO $pdo, int $userId, ?string $condType, ?string $condMode, ?int $condValue): bool
{
    // Pas de condition définie ou type inconnu → on laisse passer (safe fallback)
    if ($condType === null || $condType === '') {
        return true;
    }

    $val = $condValue ?? 0;

    switch ($condType) {

        case 'wins_total': {
            $s = $pdo->prepare('SELECT COALESCE(SUM(wins), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'mode_wins':
        case 'classic_p1_wins':
        case 'emoji_p2_wins': {
            // Résout le mode : condition_mode prioritaire, sinon slug du condition_type
            $mode = $condMode;
            if (!$mode) {
                $mode = match ($condType) {
                    'classic_p1_wins' => 'classic',
                    'emoji_p2_wins'   => 'emoji',
                    default           => '',
                };
            }
            if (!$mode) return false; // mode non résolu → condition invalide
            $s = $pdo->prepare('SELECT COALESCE(wins, 0) FROM user_stats WHERE user_id = ? AND mode = ?');
            $s->execute([$userId, $mode]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'streak_record': {
            $s = $pdo->prepare('SELECT COALESCE(MAX(streak_record), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'perfect_wins': {
            $s = $pdo->prepare('SELECT COALESCE(SUM(perfect_wins), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'unique_days': {
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT played_date) FROM game_sessions WHERE user_id = ?'
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'giveups_total': {
            $s = $pdo->prepare('SELECT COALESCE(SUM(giveups), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'friends_count': {
            $s = $pdo->prepare(
                'SELECT COUNT(*) FROM friendships
                 WHERE (requester_id = ? OR addressee_id = ?) AND status = ?'
            );
            $s->execute([$userId, $userId, 'accepted']);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'badges_count': {
            $s = $pdo->prepare('SELECT COUNT(*) FROM badges_unlocked WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'social_link_rank_10': {
            // Au moins un Social Link (avec n'importe quel ami) au rang 10
            $s = $pdo->prepare(
                'SELECT COUNT(*) FROM social_links
                 WHERE (user_a_id = ? OR user_b_id = ?) AND `rank` = 10'
            );
            $s->execute([$userId, $userId]);
            return (int) $s->fetchColumn() >= 1;
        }

        case 'all_modes_won': {
            // Au moins 1 victoire dans chacun des 6 modes reconnus
            $modes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT mode) FROM user_stats
                 WHERE user_id = ? AND wins >= 1 AND mode IN (?,?,?,?,?,?)'
            );
            $s->execute(array_merge([$userId], $modes));
            return (int) $s->fetchColumn() >= count($modes);
        }

        case 'weekly_clean_modes': {
            // Modes avec au moins une partie jouée dans les 7 derniers jours
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT mode) FROM game_sessions
                 WHERE user_id = ? AND played_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        // Conditions manuelles — vérifiées et accordées manuellement par l'admin
        case 'joker_profile':
        case 'manual':
            return true;

        default:
            // Type de condition inconnu → safe fallback (ne bloque pas les futurs titres)
            return true;
    }
}

if ($method === 'GET') {
    $lang = $_GET['lang'] ?? 'en';
    $col  = in_array($lang, ['fr','es','de','it'], true) ? "name_{$lang}" : 'name_en';

    $stmt = $pdo->prepare(
        "SELECT t.id, t.slug, t.image_path, t.{$col} AS name, t.rarity,
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
    if (!verifyTitleCondition(
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
