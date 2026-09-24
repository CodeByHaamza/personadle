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
 *   expert  : 0 | 1 — dimension du classement (défaut 0 = mode normal)
 *             L'Expert est une DIMENSION du mode, pas un mode de plus : on classe
 *             « Classique Expert » comme on classe « Classique », avec son propre
 *             lissage (les taux de victoire n'ont rien à voir). Les deux ne se
 *             mélangent jamais.
 *             ⚠️ metric=streak n'existe pas en Expert — voir
 *             personadle_ever_expert_score_expr(). Le classement revient vide.
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
 *
 *   Pour 'ever' + expert=1 : on lit game_sessions et NON user_stats — cette table
 *   n'agrège pas l'Expert (api/lib/game_session.php), elle ne renverrait que des
 *   zéros. C'est la seule raison pour laquelle ce cas a son propre chemin.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/leaderboard_metrics.php';

$pdo = pdo();

// ── Paramètres ────────────────────────────────────────────────────────────────
$validModes   = ['all', ...PERSONADLE_MODES];
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

// Dimension Expert. Normalisée en bool ICI et transmise comme tel : plus bas, la
// valeur est interpolée en littéral 0/1 dans du SQL, jamais liée en paramètre.
// Un bool ne peut rien injecter ; une chaîne venue de $_GET, si.
$expertOnly = ($_GET['expert'] ?? '0') === '1';

// ═══════════════════════════════════════════════════════════════════════════════
// CAS : LIENS SOCIAUX — on ne classe plus des JOUEURS mais des PAIRES
// ═══════════════════════════════════════════════════════════════════════════════
// Une troisième dimension à côté de Normal et Expert, et la seule qui change la
// NATURE de la ligne : ici un rang décrit une amitié, pas une performance. Les
// filtres mode / période / métrique n'ont donc aucun sens et sont ignorés — le
// front masque leurs groupes quand cette dimension est choisie.
if (($_GET['view'] ?? '') === 'bonds') {
    buildBondsLeaderboard($pdo, $limit, $offset, $myId, $friendsOnly);
}


// ═══════════════════════════════════════════════════════════════════════════════
// CAS : EVER — lecture directe sur user_stats (rapide, précis)
// ═══════════════════════════════════════════════════════════════════════════════
if ($period === 'ever') {
    // user_stats n'agrège pas l'Expert : ce cas a son propre chemin, sur game_sessions.
    if ($expertOnly) {
        buildEverExpertLeaderboard($pdo, $mode, $metric, $limit, $offset, $myId, $friendsOnly);
    }
    buildEverLeaderboard($pdo, $mode, $metric, $limit, $offset, $myId, $friendsOnly);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAS : day / week / month — lecture depuis leaderboard_cache (cron horaire)
// Fallback sur game_sessions si le cache est vide.
// ═══════════════════════════════════════════════════════════════════════════════
buildPeriodLeaderboard($pdo, $mode, $period, $metric, $limit, $offset, $myId, $friendsOnly, $expertOnly);


/**
 * Classement des LIENS SOCIAUX : les amitiés les plus fortes du site, par XP.
 *
 * ── Pourquoi l'XP et pas le rang ────────────────────────────────────────────
 * Le rang s'arrête à 10 (2 700 XP) et beaucoup de paires actives y sont. Les
 * départager par le rang seul donnerait des dizaines d'ex æquo. L'XP, elle, n'a
 * jamais été plafonnée côté serveur — c'est elle qui raconte la suite, et c'est
 * précisément ce que la jauge affiche depuis la 2.3.
 *
 * ── Ce qui est exposé ───────────────────────────────────────────────────────
 * Pseudo et avatar des deux joueurs : exactement ce qu'un profil public montre
 * déjà. Pas de code ami (il sert à ajouter quelqu'un, il n'a rien à faire dans
 * une liste publique), pas d'e-mail, pas d'identifiant de session.
 *
 * Un compte supprimé fait disparaître le lien du classement (jointures strictes
 * sur `is_deleted = 0`) : le lien n'a plus deux côtés, il n'est plus une amitié.
 */
function buildBondsLeaderboard(PDO $pdo, int $limit, int $offset, int $myId, bool $friendsOnly): never
{
    // `friends_only` garde son sens : « seulement les liens qui me concernent ».
    // Sans authentification il est déjà neutralisé plus haut.
    $filtreMoi = $friendsOnly ? 'AND (sl.user_a_id = :moi1 OR sl.user_b_id = :moi2)' : '';

    // Les profils sont en LEFT JOIN : un joueur sans profil (compte tout neuf)
    // reste visible, avec l'avatar par défaut. Les users, eux, sont en jointure
    // stricte sur `is_deleted = 0` — un lien qui n'a plus ses deux côtés n'est
    // plus une amitié et sort du classement.
    $sqlBase = "
        FROM social_links sl
        JOIN users ua ON ua.id = sl.user_a_id AND ua.is_deleted = 0
        JOIN users ub ON ub.id = sl.user_b_id AND ub.is_deleted = 0
        LEFT JOIN profiles pa ON pa.user_id = sl.user_a_id
        LEFT JOIN profiles pb ON pb.user_id = sl.user_b_id
        WHERE sl.xp > 0 {$filtreMoi}
    ";

    $params = $friendsOnly ? ['moi1' => $myId, 'moi2' => $myId] : [];

    $stmtTotal = $pdo->prepare("SELECT COUNT(*) {$sqlBase}");
    $stmtTotal->execute($params);
    $total = (int) $stmtTotal->fetchColumn();

    // `rank` est un mot réservé MySQL 8.0 — backticks obligatoires (CLAUDE.md §7).
    // LIMIT/OFFSET interpolés : ce sont des entiers déjà bornés plus haut
    // (min/max), jamais des chaînes venues de $_GET.
    $stmt = $pdo->prepare("
        SELECT sl.id, sl.xp, sl.`rank`,
               ua.id AS a_id, ua.pseudo AS a_pseudo,
               pa.avatar_data AS a_avatar, pa.avatar_border_color AS a_border,
               ub.id AS b_id, ub.pseudo AS b_pseudo,
               pb.avatar_data AS b_avatar, pb.avatar_border_color AS b_border
        {$sqlBase}
        ORDER BY sl.xp DESC, sl.id ASC
        LIMIT {$limit} OFFSET {$offset}
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $entries = [];
    $myRank  = null;
    foreach ($rows as $i => $r) {
        $rang = $offset + $i + 1;
        if ($myId && ($myRank === null)
            && ((int) $r['a_id'] === $myId || (int) $r['b_id'] === $myId)) {
            // Le MEILLEUR lien du joueur, pas le dernier rencontré : les lignes
            // arrivent déjà triées par XP décroissante.
            $myRank = ['rank' => $rang, 'score' => (int) $r['xp']];
        }
        $entries[] = [
            'rank'      => $rang,
            'link_id'   => (int) $r['id'],
            'xp'        => (int) $r['xp'],
            'sl_rank'   => (int) $r['rank'],
            'a' => [
                'user_id'             => (int) $r['a_id'],
                'pseudo'              => $r['a_pseudo'],
                'avatar_data'         => $r['a_avatar'],
                'avatar_border_color' => $r['a_border'] ?? '#ffffff',
            ],
            'b' => [
                'user_id'             => (int) $r['b_id'],
                'pseudo'              => $r['b_pseudo'],
                'avatar_data'         => $r['b_avatar'],
                'avatar_border_color' => $r['b_border'] ?? '#ffffff',
            ],
        ];
    }

    jsonSuccess([
        'view'    => 'bonds',
        'entries' => $entries,
        'my_rank' => $myRank,
        'total'   => $total,
        'limit'   => $limit,
        'offset'  => $offset,
    ]);
}

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
    // Formules centralisées dans api/lib/leaderboard_metrics.php — partagées avec
    // le cron, qui alimente le cache lu pour les autres périodes.
    $prior     = personadle_leaderboard_prior($pdo, $mode);
    $scoreExpr = personadle_ever_score_expr($metric, $mode, $prior);
    if ($scoreExpr === null) jsonError('Unknown metric', 400);
    $orderDir = 'DESC';

    // Seuil de PARTICIPATION, à ne pas confondre avec le lissage.
    // Le ratio bayésien attribue la moyenne du site à qui n'a rien joué : sans ce
    // garde-fou, un compte à 0 partie apparaîtrait en milieu de classement avec
    // ~50 %. Le lissage règle l'ordre entre joueurs, pas le droit d'y figurer.
    // Une seule partie suffit : c'est la formule, pas un seuil arbitraire, qui
    // empêche désormais un 1/1 de finir premier (cf. leaderboard_metrics.php).
    $gamesExpr    = $mode === 'all' ? 'SUM(us.games)' : 'us.games';
    $participation = $metric === 'winrate' ? "AND ({$gamesExpr}) >= 1" : '';

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
        HAVING score IS NOT NULL AND score > 0 {$participation}
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
            HAVING score IS NOT NULL AND score > 0 {$participation}
        ) cnt
    ";
    $total = (int) $pdo->query($countSql)->fetchColumn();

    formatAndSend($pdo, $rows, $metric, $myId, $mode, 'ever', $limit, $offset, $total);
}


/**
 * Leaderboard "ever" EXPERT, depuis game_sessions.
 *
 * Jumeau de buildEverLeaderboard(), mais sur une autre table — et c'est toute la
 * raison de son existence : `user_stats` n'agrège pas les parties Expert
 * (api/lib/game_session.php, décision de la migration 031). L'y chercher
 * renverrait un classement vide pour tout le monde.
 *
 * Le lissage est calculé sur la population EXPERT ($expertOnly = true) : le taux
 * de victoire moyen y est bien plus bas qu'en mode normal, et emprunter la
 * moyenne du mode normal tirerait tous les joueurs Expert vers un repère qui
 * n'est pas le leur.
 */
function buildEverExpertLeaderboard(PDO $pdo, string $mode, string $metric, int $limit, int $offset, int $myId, bool $friendsOnly = false): never
{
    $prior     = personadle_leaderboard_prior($pdo, $mode, true);
    $scoreExpr = personadle_ever_expert_score_expr($metric, $prior);

    // `streak` renvoie null ici volontairement (cf. leaderboard_metrics.php) : une
    // série de jours consécutifs ne veut rien dire pour un mode qu'on n'ouvre pas
    // tous les jours. On renvoie un classement VIDE plutôt qu'une erreur — le
    // front laisse la métrique sélectionnable, et un 400 ressemblerait à une
    // panne alors que c'est une absence assumée.
    if ($scoreExpr === null) {
        formatAndSend($pdo, [], $metric, $myId, $mode, 'ever', $limit, $offset, 0, true);
    }

    $modeFilter    = $mode === 'all' ? '' : 'AND gs.mode = ' . $pdo->quote($mode);
    $participation = $metric === 'winrate' ? 'AND COUNT(*) >= 1' : '';

    $friendsFilter = buildFriendsClause($pdo, $friendsOnly, $myId);
    if ($friendsFilter === '__EMPTY__') {
        formatAndSend($pdo, [], $metric, $myId, $mode, 'ever', $limit, $offset, 0, true);
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
        WHERE u.is_deleted = 0
          AND gs.is_expert = 1
        {$modeFilter}
        {$friendsFilter}
        GROUP BY u.id, u.pseudo, u.friend_code, p.avatar_data, p.avatar_border_color, p.selected_badges
        HAVING score IS NOT NULL AND score > 0 {$participation}
        ORDER BY score DESC, u.pseudo ASC
        LIMIT {$limit} OFFSET {$offset}
    ";
    $rows = $pdo->query($sql)->fetchAll();

    $countSql = "
        SELECT COUNT(*) FROM (
            SELECT u.id, ({$scoreExpr}) AS score
            FROM game_sessions gs
            JOIN users u ON u.id = gs.user_id
            WHERE u.is_deleted = 0
              AND gs.is_expert = 1
            {$modeFilter}
            {$friendsFilter}
            GROUP BY u.id
            HAVING score IS NOT NULL AND score > 0 {$participation}
        ) cnt
    ";
    $total = (int) $pdo->query($countSql)->fetchColumn();

    formatAndSend($pdo, $rows, $metric, $myId, $mode, 'ever', $limit, $offset, $total, true);
}


/**
 * Leaderboard day/week/month depuis leaderboard_cache (cron horaire).
 * Fallback transparent sur game_sessions si le cache est vide (premier démarrage
 * ou cron pas encore exécuté).
 */
function buildPeriodLeaderboard(PDO $pdo, string $mode, string $period, string $metric, int $limit, int $offset, int $myId, bool $friendsOnly = false, bool $expertOnly = false): never
{
    // `streak` n'existe pas en Expert, par période comme « depuis toujours »
    // (cf. personadle_ever_expert_score_expr). Le cron n'écrit jamais cette
    // combinaison en cache, donc sans cette garde l'appel tombait TOUJOURS sur
    // le repli live, qui calculait bel et bien une série Expert et renvoyait des
    // entrées — pendant que le front affichait « pas de classement série en
    // Expert » au-dessus d'une liste pleine. Même réponse partout : vide.
    if ($expertOnly && $metric === 'streak') {
        formatAndSend($pdo, [], $metric, $myId, $mode, $period, $limit, $offset, 0, true);
    }

    // ── Tentative lecture depuis leaderboard_cache ────────────────────────────
    // `is_expert` fait partie de la clé de lecture comme il fait partie de
    // `uq_leaderboard` (migration 045) : sans lui, le classement Expert et le
    // classement normal se mélangeraient dans la même page de résultats.
    $cacheStmt = $pdo->prepare("
        SELECT lc.user_id, lc.score, lc.rank_position,
               u.pseudo, u.friend_code,
               p.avatar_data, p.avatar_border_color, p.selected_badges
        FROM leaderboard_cache lc
        JOIN users u ON u.id = lc.user_id AND u.is_deleted = 0
        LEFT JOIN profiles p ON p.user_id = lc.user_id
        WHERE lc.mode      = :mode
          AND lc.period    = :period
          AND lc.metric    = :metric
          AND lc.is_expert = :expert
        ORDER BY lc.rank_position ASC
        LIMIT :lim OFFSET :off
    ");
    $cacheStmt->bindValue(':mode',   $mode,   PDO::PARAM_STR);
    $cacheStmt->bindValue(':period', $period, PDO::PARAM_STR);
    $cacheStmt->bindValue(':metric', $metric, PDO::PARAM_STR);
    $cacheStmt->bindValue(':expert', $expertOnly ? 1 : 0, PDO::PARAM_INT);
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

        formatAndSend($pdo, $rows, $metric, $myId, $mode, $period, $limit, $offset, $total, $expertOnly);
    }

    // ── Fallback : calcul live depuis game_sessions ───────────────────────────
    // (utilisé si le cron n'a pas encore tourné — ex: premier démarrage)
    buildPeriodLeaderboardLive($pdo, $mode, $period, $metric, $limit, $offset, $myId, $friendsOnly, $expertOnly);
}

/**
 * Fallback : calcul leaderboard day/week/month directement sur game_sessions.
 * Utilisé quand leaderboard_cache est vide (cron pas encore exécuté).
 */
function buildPeriodLeaderboardLive(PDO $pdo, string $mode, string $period, string $metric, int $limit, int $offset, int $myId, bool $friendsOnly = false, bool $expertOnly = false): never
{
    // Littéral 0/1 issu d'un bool, jamais d'une chaîne de $_GET — cf. la
    // normalisation en tête de fichier.
    $expertFilter = 'AND gs.is_expert = ' . ($expertOnly ? 1 : 0);
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
        formatAndSend($pdo, [], $metric, $myId, $mode, $period, $limit, $offset, 0, $expertOnly);
    }

    // ── Série : requête à part, pas une simple agrégation ─────────────────────
    // Une série se mesure en JOURS CONSÉCUTIFS, ce qu'aucun SUM() ne sait faire.
    // L'ancien code renvoyait ici le nombre de victoires, assumé « approximation »
    // en commentaire : un joueur avec 20 victoires dans la même journée affichait
    // « série : 20 » alors qu'il avait joué un seul jour. C'était faux, pas
    // approximatif — la colonne annonçait une métrique et en montrait une autre.
    if ($metric === 'streak') {
        $sql       = personadle_period_streak_sql($modeFilter, $friendsFilter, $expertOnly);
        $pagedStmt = $pdo->prepare($sql . " LIMIT {$limit} OFFSET {$offset}");
        $pagedStmt->execute([$startDate]);
        $rows = $pagedStmt->fetchAll();

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM ({$sql}) AS s");
        $countStmt->execute([$startDate]);
        $total = (int) $countStmt->fetchColumn();

        formatAndSend($pdo, $rows, $metric, $myId, $mode, $period, $limit, $offset, $total, $expertOnly);
    }

    // Compte des PARTIES, pas des jours — décision produit écrite dans
    // api/cron/leaderboard.php. Les formules elles-mêmes vivent désormais dans
    // api/lib/leaderboard_metrics.php, partagées avec le cron : elles devaient
    // « rester identiques » des deux côtés, elles sont maintenant les mêmes.
    $prior     = personadle_leaderboard_prior($pdo, $mode, $expertOnly);
    $scoreExpr = personadle_period_score_expr($metric, $prior);
    if ($scoreExpr === null) jsonError('Unknown metric', 400);

    // Cf. buildEverLeaderboard : le lissage classe, il n'autorise pas à figurer.
    $participation = $metric === 'winrate' ? 'AND COUNT(*) >= 1' : '';

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
          {$expertFilter}
          {$modeFilter}
          {$friendsFilter}
        GROUP BY u.id, u.pseudo, u.friend_code, p.avatar_data, p.avatar_border_color, p.selected_badges
        HAVING score IS NOT NULL AND score > 0 {$participation}
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
              {$expertFilter}
              {$modeFilter}
              {$friendsFilter}
            GROUP BY u.id
            HAVING score IS NOT NULL AND score > 0 {$participation}
        ) cnt
    ";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute([$startDate]);
    $total = (int) $countStmt->fetchColumn();

    formatAndSend($pdo, $rows, $metric, $myId, $mode, $period, $limit, $offset, $total, $expertOnly);
}


/**
 * Formate les résultats bruts, ajoute le rang, cherche la position perso.
 * $total = nombre total de lignes sans LIMIT (pour la pagination).
 */
function formatAndSend(PDO $pdo, array $rows, string $metric, int $myId, string $mode, string $period, int $limit, int $offset, int $total, bool $expertOnly = false): never
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
        // Renvoyée telle qu'elle a été COMPRISE, pas telle qu'elle a été demandée :
        // le front s'en sert pour vérifier qu'il affiche bien ce qu'il croit, au
        // lieu d'un classement normal silencieusement servi à la place.
        'expert'  => $expertOnly,
        'entries' => $entries,
        'my_rank' => $myRank,
        'count'   => $total,    // total rows matching (not just current page)
        'offset'  => $offset,
        'limit'   => $limit,
    ]);
}
