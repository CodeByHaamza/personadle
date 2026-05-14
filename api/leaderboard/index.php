<?php
/**
 * GET /api/leaderboard — Classement des joueurs
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * PARAMÈTRES GET
 * ─────────────────────────────────────────────────────────────────────────────
 *   mode    : 'all' | 'classic' | 'emoji' | 'silhouette' | 'alloutattack'
 *             | 'personae' | 'music'   (défaut : 'all')
 *
 *   period  : 'day' | 'week' | 'month' | 'ever'   (défaut : 'ever')
 *
 *   metric  : 'wins'          → nombre de victoires
 *             'winrate'       → ratio victoires / parties (min 5 parties)
 *             'streak'        → meilleure série (streak_record)
 *             'perfect'       → victoires en 1 tentative
 *             'games'         → nombre total de parties (activité)
 *             (défaut : 'wins')
 *
 *   limit   : nombre de résultats (défaut 50, max 100)
 *   offset  : pagination (défaut 0)
 *
 * ACCÈS
 *   Public — pas de requireAuth(). L'utilisateur connecté reçoit en bonus
 *   son propre rang (champ my_rank dans la réponse).
 *
 * NOTES D'IMPLÉMENTATION
 * ─────────────────────────────────────────────────────────────────────────────
 *   Pour 'ever' : on lit directement user_stats (pas de cache).
 *   Pour day/week/month : on lit leaderboard_cache (alimenté par api/cron/leaderboard.php
 *   toutes les heures). Fallback sur game_sessions si le cache est vide (ex: premier démarrage).
 */

require_once __DIR__ . '/../bootstrap.php';

$pdo = pdo();

// ── Paramètres ────────────────────────────────────────────────────────────────
$validModes   = ['all', 'classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
$validPeriods = ['day', 'week', 'month', 'ever'];
$validMetrics = ['wins', 'winrate', 'streak', 'perfect', 'games'];

$mode   = in_array($_GET['mode']   ?? '', $validModes,   true) ? $_GET['mode']   : 'all';
$period = in_array($_GET['period'] ?? '', $validPeriods, true) ? $_GET['period'] : 'ever';
$metric = in_array($_GET['metric'] ?? '', $validMetrics, true) ? $_GET['metric'] : 'wins';
$limit  = min(100, max(1, (int) ($_GET['limit']  ?? 50)));
$offset = max(0,          (int) ($_GET['offset'] ?? 0));

// Utilisateur connecté (pour son rang personnel)
$myId = (int) ($_SESSION['user_id'] ?? 0);

// Filtre amis (ignoré si non authentifié)
$friendsOnly = (bool) ($_GET['friends_only'] ?? 0) && $myId > 0;


// ═══════════════════════════════════════════════════════════════════════════════
// CAS : EVER — lecture directe sur user_stats (rapide, précis)
// ═══════════════════════════════════════════════════════════════════════════════
if ($period === 'ever') {
    buildEverLeaderboard($pdo, $mode, $metric, $limit, $offset, $myId, $friendsOnly);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAS : day / week / month — lecture depuis leaderboard_cache (cron horaire)
// Fallback sur game_sessions si le cache est vide.
// ═══════════════════════════════════════════════════════════════════════════════
buildPeriodLeaderboard($pdo, $mode, $period, $metric, $limit, $offset, $myId, $friendsOnly);


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la liste des IDs amis acceptés + $myId lui-même.
 * Résultat déjà casté en int — utilisable directement dans IN (...).
 */
function getFriendIds(PDO $pdo, int $myId): array
{
    // Positional params — MySQL PDO ne supporte pas les named params répétés.
    $stmt = $pdo->prepare("
        SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS fid
        FROM friendships
        WHERE (requester_id = ? OR addressee_id = ?)
          AND status = 'accepted'
    ");
    $stmt->execute([$myId, $myId, $myId]);
    $ids   = array_map('intval', array_column($stmt->fetchAll(), 'fid'));
    $ids[] = $myId;
    return array_unique($ids);
}

/**
 * Construit la clause SQL "AND u.id IN (...)" pour le filtre amis.
 * Retourne '' si $friendsOnly est false, ou __EMPTY__ si l'utilisateur n'a aucun ami.
 */
function buildFriendsClause(PDO $pdo, bool $friendsOnly, int $myId): string
{
    if (!$friendsOnly || !$myId) return '';
    $ids = getFriendIds($pdo, $myId);
    if (empty($ids)) return '__EMPTY__';
    return 'AND u.id IN (' . implode(',', $ids) . ')';
}

/**
 * Leaderboard "ever" depuis user_stats.
 * Agrège plusieurs modes si mode === 'all'.
 */
function buildEverLeaderboard(PDO $pdo, string $mode, string $metric, int $limit, int $offset, int $myId, bool $friendsOnly = false): never
{
    // Construction du SELECT selon la métrique
    switch ($metric) {
        case 'wins':
            $scoreExpr  = $mode === 'all' ? 'SUM(us.wins)'         : 'us.wins';
            $orderDir   = 'DESC';
            $minGames   = 0;
            break;
        case 'winrate':
            // ratio victoires / parties (on exclut les joueurs < 5 parties pour éviter 100% avec 1 partie)
            $scoreExpr  = $mode === 'all'
                ? 'IF(SUM(us.games) >= 5, ROUND(SUM(us.wins) / SUM(us.games) * 100, 1), NULL)'
                : 'IF(us.games >= 5, ROUND(us.wins / us.games * 100, 1), NULL)';
            $orderDir   = 'DESC';
            $minGames   = 5;
            break;
        case 'streak':
            $scoreExpr  = $mode === 'all' ? 'MAX(us.streak_record)' : 'us.streak_record';
            $orderDir   = 'DESC';
            $minGames   = 0;
            break;
        case 'perfect':
            $scoreExpr  = $mode === 'all' ? 'SUM(us.perfect_wins)'  : 'us.perfect_wins';
            $orderDir   = 'DESC';
            $minGames   = 0;
            break;
        case 'games':
            $scoreExpr  = $mode === 'all' ? 'SUM(us.games)'         : 'us.games';
            $orderDir   = 'DESC';
            $minGames   = 0;
            break;
        default:
            jsonError('Unknown metric', 400);
    }

    // Filtre mode
    $modeFilter = $mode === 'all' ? '' : 'AND us.mode = ' . $pdo->quote($mode);

    // Filtre amis
    $friendsFilter = buildFriendsClause($pdo, $friendsOnly, $myId);
    if ($friendsFilter === '__EMPTY__') {
        formatAndSend($pdo, [], $metric, $myId, $mode, 'ever', $limit, $offset, 0);
    }

    $sql = "
        SELECT
            u.id,
            u.pseudo,
            u.friend_code,
            p.avatar_data,
            p.avatar_border_color,
            p.selected_badges,
            ({$scoreExpr}) AS score,
            SUM(us.games)  AS total_games
        FROM users u
        JOIN user_stats us ON us.user_id = u.id
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.is_deleted = 0
        {$modeFilter}
        {$friendsFilter}
        GROUP BY u.id, u.pseudo, u.friend_code, p.avatar_data, p.avatar_border_color, p.selected_badges
        HAVING score IS NOT NULL AND score > 0
        ORDER BY score {$orderDir}, u.pseudo ASC
        LIMIT {$limit} OFFSET {$offset}
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll();

    // Count total matching rows (without LIMIT) for correct pagination
    $countSql = "
        SELECT COUNT(*) FROM (
            SELECT u.id, ({$scoreExpr}) AS score
            FROM users u
            JOIN user_stats us ON us.user_id = u.id
            WHERE u.is_deleted = 0
            {$modeFilter}
            {$friendsFilter}
            GROUP BY u.id
            HAVING score IS NOT NULL AND score > 0
        ) cnt
    ";
    $total = (int) $pdo->query($countSql)->fetchColumn();

    formatAndSend($pdo, $rows, $metric, $myId, $mode, 'ever', $limit, $offset, $total);
}


/**
 * Leaderboard day/week/month depuis leaderboard_cache (cron horaire).
 * Fallback transparent sur game_sessions si le cache est vide (premier démarrage
 * ou cron pas encore exécuté).
 */
function buildPeriodLeaderboard(PDO $pdo, string $mode, string $period, string $metric, int $limit, int $offset, int $myId, bool $friendsOnly = false): never
{
    // ── Tentative lecture depuis leaderboard_cache ────────────────────────────
    $cacheStmt = $pdo->prepare("
        SELECT lc.user_id, lc.score, lc.rank_position,
               u.pseudo, u.friend_code,
               p.avatar_data, p.avatar_border_color, p.selected_badges
        FROM leaderboard_cache lc
        JOIN users u ON u.id = lc.user_id AND u.is_deleted = 0
        LEFT JOIN profiles p ON p.user_id = lc.user_id
        WHERE lc.mode   = :mode
          AND lc.period = :period
          AND lc.metric = :metric
        ORDER BY lc.rank_position ASC
        LIMIT :lim OFFSET :off
    ");
    $cacheStmt->bindValue(':mode',   $mode,   PDO::PARAM_STR);
    $cacheStmt->bindValue(':period', $period, PDO::PARAM_STR);
    $cacheStmt->bindValue(':metric', $metric, PDO::PARAM_STR);
    $cacheStmt->bindValue(':lim',    $limit,  PDO::PARAM_INT);
    $cacheStmt->bindValue(':off',    $offset, PDO::PARAM_INT);
    $cacheStmt->execute();
    $cacheRows = $cacheStmt->fetchAll();

    if (!empty($cacheRows)) {
        // Filtre amis sur les résultats du cache (post-filtrage en PHP, cache pas conçu pour ça)
        if ($friendsOnly && $myId) {
            $friendIds = getFriendIds($pdo, $myId);
            $cacheRows = array_values(array_filter($cacheRows, fn($r) => in_array((int)$r['user_id'], $friendIds, true)));
        }
        $total = count($cacheRows);
        $cacheRows = array_slice($cacheRows, $offset, $limit);

        // Reformater pour correspondre à la structure attendue par formatAndSend
        $rows = array_map(function ($r) {
            return [
                'id'                  => $r['user_id'],
                'pseudo'              => $r['pseudo'],
                'friend_code'         => $r['friend_code'],
                'avatar_data'         => $r['avatar_data'],
                'avatar_border_color' => $r['avatar_border_color'],
                'selected_badges'     => $r['selected_badges'],
                'score'               => $r['score'],
                'total_games'         => null,  // non disponible depuis le cache
            ];
        }, $cacheRows);

        formatAndSend($pdo, $rows, $metric, $myId, $mode, $period, $limit, $offset, $total);
    }

    // ── Fallback : calcul live depuis game_sessions ───────────────────────────
    // (utilisé si le cron n'a pas encore tourné — ex: premier démarrage)
    buildPeriodLeaderboardLive($pdo, $mode, $period, $metric, $limit, $offset, $myId, $friendsOnly);
}

/**
 * Fallback : calcul leaderboard day/week/month directement sur game_sessions.
 * Utilisé quand leaderboard_cache est vide (cron pas encore exécuté).
 */
function buildPeriodLeaderboardLive(PDO $pdo, string $mode, string $period, string $metric, int $limit, int $offset, int $myId, bool $friendsOnly = false): never
{
    // Calcul de la date de début de la fenêtre (Paris time)
    $tz  = new DateTimeZone('Europe/Paris');
    $now = new DateTime('now', $tz);
    switch ($period) {
        case 'day':
            $startDate = $now->format('Y-m-d');
            break;
        case 'week':
            // Lundi de la semaine courante
            $now->modify('Monday this week');
            $startDate = $now->format('Y-m-d');
            break;
        case 'month':
            $startDate = $now->format('Y-m-01');
            break;
        default:
            jsonError('Unknown period', 400);
    }

    $modeFilter    = $mode === 'all' ? '' : 'AND gs.mode = ' . $pdo->quote($mode);
    $friendsFilter = buildFriendsClause($pdo, $friendsOnly, $myId);
    if ($friendsFilter === '__EMPTY__') {
        formatAndSend($pdo, [], $metric, $myId, $mode, $period, $limit, $offset, 0);
    }

    switch ($metric) {
        case 'wins':
            $scoreExpr = "SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END)";
            break;
        case 'winrate':
            $scoreExpr = "IF(COUNT(*) >= 5, ROUND(SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1), NULL)";
            break;
        case 'streak':
            // Sur une période courte : nombre de victoires (approximation)
            $scoreExpr = "SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END)";
            break;
        case 'perfect':
            $scoreExpr = "SUM(CASE WHEN gs.result = 'win' AND gs.attempts = 1 THEN 1 ELSE 0 END)";
            break;
        case 'games':
            $scoreExpr = 'COUNT(*)';
            break;
        default:
            jsonError('Unknown metric', 400);
    }

    $sql = "
        SELECT
            u.id,
            u.pseudo,
            u.friend_code,
            p.avatar_data,
            p.avatar_border_color,
            p.selected_badges,
            ({$scoreExpr}) AS score,
            COUNT(*)       AS total_games
        FROM game_sessions gs
        JOIN users u ON u.id = gs.user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE gs.played_date >= ?
          AND u.is_deleted = 0
          {$modeFilter}
          {$friendsFilter}
        GROUP BY u.id, u.pseudo, u.friend_code, p.avatar_data, p.avatar_border_color, p.selected_badges
        HAVING score IS NOT NULL AND score > 0
        ORDER BY score DESC, u.pseudo ASC
        LIMIT {$limit} OFFSET {$offset}
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$startDate]);
    $rows = $stmt->fetchAll();

    // Count total matching rows (without LIMIT) for correct pagination
    $countSql = "
        SELECT COUNT(*) FROM (
            SELECT u.id, ({$scoreExpr}) AS score
            FROM game_sessions gs
            JOIN users u ON u.id = gs.user_id
            WHERE gs.played_date >= ?
              AND u.is_deleted = 0
              {$modeFilter}
              {$friendsFilter}
            GROUP BY u.id
            HAVING score IS NOT NULL AND score > 0
        ) cnt
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute([$startDate]);
    $total = (int) $countStmt->fetchColumn();

    formatAndSend($pdo, $rows, $metric, $myId, $mode, $period, $limit, $offset, $total);
}


/**
 * Formate les résultats bruts, ajoute le rang, cherche la position perso.
 * $total = nombre total de lignes sans LIMIT (pour la pagination).
 */
function formatAndSend(PDO $pdo, array $rows, string $metric, int $myId, string $mode, string $period, int $limit, int $offset, int $total): never
{
    $entries = [];
    $myRank  = null;

    foreach ($rows as $i => $r) {
        $rank  = $offset + $i + 1;
        $score = $r['score'] !== null ? (float) $r['score'] : null;

        if ($myId && (int) $r['id'] === $myId) {
            // Return rank + score so the frontend can render "Your rank: #5 — 42 wins"
            $myRank = ['rank' => $rank, 'score' => $score];
        }

        $entry = [
            'rank'                => $rank,
            'user_id'             => (int) $r['id'],
            'pseudo'              => $r['pseudo'],
            'avatar_data'         => $r['avatar_data'],
            'avatar_border_color' => $r['avatar_border_color'] ?? '#ffffff',
            'selected_badges'     => json_decode($r['selected_badges'] ?? 'null') ?? [],
            'score'               => $score,
            'total_games'         => $r['total_games'] !== null ? (int) $r['total_games'] : null,
        ];
        // friend_code is only exposed to authenticated users (prevents scraping)
        if ($myId) {
            $entry['friend_code'] = $r['friend_code'];
        }
        $entries[] = $entry;
    }

    jsonSuccess([
        'mode'    => $mode,
        'period'  => $period,
        'metric'  => $metric,
        'entries' => $entries,
        'my_rank' => $myRank,
        'count'   => $total,    // total rows matching (not just current page)
        'offset'  => $offset,
        'limit'   => $limit,
    ]);
}
