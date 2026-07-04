<?php
/**
 * GET  /api/social-links/:linkId                    → infos du Social Link (rang, xp, interactions today)
 * GET  /api/social-links/by-friend/:id              → retourne le link_id pour l'utilisateur + un ami
 * GET  /api/social-links/rankup-notifs              → notifications de montée de rang non vues
 * POST /api/social-links/by-friend/:id/interact     → enregistrer une interaction + XP (1 round-trip)
 *
 * Format body POST : { "action_type": "visit_profile" | "share_streak" | "share_score"
 *                                    | "play_same_day" | "compare_stats" | "challenge" }
 *
 * Règles :
 *   - Une action est possible max 1× par jour par couple d'amis (sauf play_same_day auto)
 *   - Si l'autre ami fait la même action dans la journée → is_mutual = 1 → XP doublé
 *   - addSocialLinkXp() gère la montée de rang (équivalent PHP de add_social_link_xp())
 *
 * Note : l'ancienne route POST /:linkId/interact (sans garde-fou d'amitié) a été retirée —
 * plus aucun appelant côté client (js/api.js n'utilise que interactByFriend()).
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/social_link.php';

/**
 * Équivalent PHP de la procédure stockée add_social_link_xp().
 * Ajoute de l'XP au social link et monte le rang si nécessaire.
 * Retourne ['xp' => int, 'rank' => int, 'ranked_up' => bool].
 */
function addSocialLinkXp(PDO $pdo, int $linkId, int $xpAmount): array
{
    $stmt = $pdo->prepare('SELECT xp, `rank` FROM social_links WHERE id = ? LIMIT 1 FOR UPDATE');
    $stmt->execute([$linkId]);
    $sl = $stmt->fetch();

    $newXp = ($sl['xp'] ?? 0) + $xpAmount;

    $stmt = $pdo->prepare('SELECT MAX(`rank`) AS new_rank FROM social_link_ranks WHERE xp_required <= ?');
    $stmt->execute([$newXp]);
    $rankRow  = $stmt->fetch();
    $newRank  = max(1, (int) ($rankRow['new_rank'] ?? 1));
    $rankedUp = $newRank > (int) ($sl['rank'] ?? 1) ? 1 : 0;

    $pdo->prepare('UPDATE social_links SET xp = ?, `rank` = ?, last_interaction_at = NOW() WHERE id = ?')
        ->execute([$newXp, $newRank, $linkId]);

    return ['xp' => $newXp, 'rank' => $newRank, 'ranked_up' => $rankedUp];
}

// XP par action (solo | mutuel) — table + calcul extraits dans api/lib/social_link.php
// (testable en PHPUnit sans MySQL, cf. tests/php/SocialLinkTest.php).

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// Extraire les segments de l'URI
$parts = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));

// ── Cas spécial : GET /api/social-links/by-friend/:friendId ──────────────────
$slIdx = array_search('social-links', $parts);
if ($method === 'GET' && $slIdx !== false && ($parts[$slIdx + 1] ?? '') === 'by-friend') {
    $friendId = (int) ($parts[$slIdx + 2] ?? 0);
    if ($friendId <= 0) jsonError('Missing friend id', 400);

    // Équivalent PHP de get_or_create_social_link() — LEAST/GREATEST pour ordre canonique
    $aId = min($authId, $friendId);
    $bId = max($authId, $friendId);

    $stmt = $pdo->prepare('SELECT id FROM social_links WHERE user_a_id = ? AND user_b_id = ? LIMIT 1');
    $stmt->execute([$aId, $bId]);
    $existing = $stmt->fetch();

    if ($existing) {
        $linkId = (int) $existing['id'];
    } else {
        $pdo->prepare('INSERT INTO social_links (user_a_id, user_b_id) VALUES (?, ?)')->execute([$aId, $bId]);
        $linkId = (int) $pdo->lastInsertId();
    }

    jsonSuccess(['link_id' => $linkId]);
}

// ── GET /api/social-links/rankup-notifs ─────────────────────────────────────
if ($method === 'GET' && $slIdx !== false && ($parts[$slIdx + 1] ?? '') === 'rankup-notifs') {
    $lang = preg_replace('/[^a-z]/', '', strtolower($_GET['lang'] ?? 'en'));
    if (!in_array($lang, ['en','fr','es','de','it'])) $lang = 'en';

    $stmt = $pdo->prepare("
        SELECT rn.id, rn.new_rank,
               u.id AS partner_id, u.pseudo AS partner_pseudo,
               p.avatar_data AS partner_avatar,
               slr.name_{$lang} AS rank_name,
               slr.name_en, slr.name_fr, slr.name_es, slr.name_de, slr.name_it
        FROM social_link_rankup_notifs rn
        JOIN users u ON u.id = rn.partner_id AND u.is_deleted = 0
        LEFT JOIN profiles p ON p.user_id = rn.partner_id
        JOIN social_link_ranks slr ON slr.`rank` = rn.new_rank
        WHERE rn.recipient_id = ? AND rn.seen_at IS NULL
        ORDER BY rn.created_at DESC
        LIMIT 10
    ");
    $stmt->execute([$authId]);
    $notifs = $stmt->fetchAll();

    // Marquer toutes comme vues
    $pdo->prepare("UPDATE social_link_rankup_notifs SET seen_at = NOW() WHERE recipient_id = ? AND seen_at IS NULL")
        ->execute([$authId]);

    jsonSuccess(['notifs' => array_map(fn($n) => [
        'id'             => (int) $n['id'],
        'new_rank'       => (int) $n['new_rank'],
        'partner_id'     => (int) $n['partner_id'],
        'partner_pseudo' => $n['partner_pseudo'],
        'partner_avatar' => $n['partner_avatar'],
        'rank_names'     => [
            'en' => $n['name_en'],
            'fr' => $n['name_fr'],
            'es' => $n['name_es'],
            'de' => $n['name_de'],
            'it' => $n['name_it'],
        ],
    ], $notifs)]);
}

// ── POST /api/social-links/by-friend/:friendId/interact ──────────────────────
if ($method === 'POST' && $slIdx !== false
    && ($parts[$slIdx + 1] ?? '') === 'by-friend'
    && isset($parts[$slIdx + 2])
    && ($parts[$slIdx + 3] ?? '') === 'interact'
) {
    rateLimit('sl-interact:' . $authId, 30, 15 * 60);

    $friendId = (int) ($parts[$slIdx + 2] ?? 0);
    if ($friendId <= 0) jsonError('Invalid friend id', 400);
    if ($friendId === $authId) jsonError('Cannot interact with yourself', 400);

    $data       = getJsonBody();
    $actionType = trim($data['action_type'] ?? '');
    if (!isset(PERSONADLE_SL_XP_TABLE[$actionType])) jsonError('Invalid action_type', 400);

    // Friendship guard : vérifier que les deux utilisateurs sont amis
    $stmtFriend = $pdo->prepare(
        "SELECT id FROM friendships
         WHERE status = 'accepted'
           AND ((requester_id = ? AND addressee_id = ?)
             OR (requester_id = ? AND addressee_id = ?))
         LIMIT 1"
    );
    $stmtFriend->execute([$authId, $friendId, $friendId, $authId]);
    if (!$stmtFriend->fetch()) jsonError('Not friends', 403);

    $result = [];
    $pdo->beginTransaction();
    try {
        // get_or_create via ordre canonique
        $aId = min($authId, $friendId);
        $bId = max($authId, $friendId);
        $stmt = $pdo->prepare('SELECT id FROM social_links WHERE user_a_id = ? AND user_b_id = ? LIMIT 1');
        $stmt->execute([$aId, $bId]);
        $existing = $stmt->fetch();
        if ($existing) {
            $linkId = (int) $existing['id'];
        } else {
            $pdo->prepare('INSERT INTO social_links (user_a_id, user_b_id) VALUES (?, ?)')->execute([$aId, $bId]);
            $linkId = (int) $pdo->lastInsertId();
        }

        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        // Anti-spam : 1 action par jour (toutes actions, y compris play_same_day)
        $stmtCheck = $pdo->prepare("
            SELECT id FROM social_link_interactions
            WHERE social_link_id = ? AND initiator_id = ? AND action_type = ?
              AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
            LIMIT 1
        ");
        $stmtCheck->execute([$linkId, $authId, $actionType, $today]);
        if ($stmtCheck->fetch()) {
            $pdo->rollBack();
            jsonError('Already performed this action today', 409);
        }

        // Vérifier si l'autre a déjà fait la même action aujourd'hui → mutuel
        $stmtOther = $pdo->prepare("
            SELECT id FROM social_link_interactions
            WHERE social_link_id = ? AND initiator_id = ? AND action_type = ?
              AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
            LIMIT 1
        ");
        $stmtOther->execute([$linkId, $friendId, $actionType, $today]);
        $isMutual = $actionType === 'play_same_day' ? true : (bool) $stmtOther->fetch();

        $xpGained = personadle_sl_xp_for_action($actionType, $isMutual);

        $pdo->prepare("
            INSERT INTO social_link_interactions (social_link_id, initiator_id, action_type, xp_gained, is_mutual)
            VALUES (?, ?, ?, ?, ?)
        ")->execute([$linkId, $authId, $actionType, $xpGained, $isMutual ? 1 : 0]);

        if ($isMutual && $actionType !== 'play_same_day') {
            $pdo->prepare("
                UPDATE social_link_interactions SET is_mutual = 1, xp_gained = ?
                WHERE social_link_id = ? AND initiator_id = ? AND action_type = ?
                  AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
            ")->execute([PERSONADLE_SL_XP_TABLE[$actionType]['mutual'], $linkId, $friendId, $actionType, $today]);
            $bonusXp = PERSONADLE_SL_XP_TABLE[$actionType]['mutual'] - PERSONADLE_SL_XP_TABLE[$actionType]['solo'];
            if ($bonusXp > 0) addSocialLinkXp($pdo, $linkId, $bonusXp);
        }

        $result = addSocialLinkXp($pdo, $linkId, $xpGained);

        // Notifier l'autre joueur si le rang a monté (il verra l'animation au prochain poll)
        if ($result['ranked_up']) {
            $pdo->prepare("
                INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank)
                VALUES (?, ?, ?)
            ")->execute([$friendId, $authId, $result['rank']]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[SL by-friend interact] ' . $e->getMessage());
        jsonError('Interaction failed', 500);
    }

    jsonSuccess([
        'link_id'   => $linkId,
        'xp_gained' => $xpGained,
        'is_mutual' => $isMutual,
        'new_xp'    => (int) ($result['xp']       ?? 0),
        'new_rank'  => (int) ($result['rank']      ?? 1),
        'ranked_up' => (bool) ($result['ranked_up'] ?? false),
    ]);
}

// ── Extraire linkId (GET /:linkId — seule route restante sous cette forme) ──
$linkId = 0;
if ($slIdx !== false && isset($parts[$slIdx + 1]) && ctype_digit($parts[$slIdx + 1])) {
    $linkId = (int) $parts[$slIdx + 1];
}
if ($linkId <= 0) jsonError('Missing or invalid link id', 400);


// ═══════════════════════════════════════════════════════════════════
// GET /api/social-links/:linkId
// ═══════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    $stmt = $pdo->prepare("
        SELECT sl.*,
               slr.name_en, slr.name_fr, slr.name_es, slr.name_de, slr.name_it,
               slr.xp_required  AS xp_current_rank,
               slr_next.xp_required AS xp_next_rank
        FROM social_links sl
        JOIN social_link_ranks slr
             ON slr.`rank` = sl.`rank`
        LEFT JOIN social_link_ranks slr_next
             ON slr_next.`rank` = sl.`rank` + 1
        WHERE sl.id = ?
          AND (sl.user_a_id = ? OR sl.user_b_id = ?)
    ");
    $stmt->execute([$linkId, $authId, $authId]);
    $link = $stmt->fetch();
    if (!$link) jsonError('Social Link not found or access denied', 404);

    // Interactions du jour (Paris)
    $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    $stmt2 = $pdo->prepare("
        SELECT action_type, initiator_id, is_mutual
        FROM social_link_interactions
        WHERE social_link_id = ?
          AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
    ");
    $stmt2->execute([$linkId, $today]);
    $todayInteractions = $stmt2->fetchAll();

    jsonSuccess([
        'id'              => (int) $link['id'],
        'rank'            => (int) $link['rank'],
        'xp'              => (int) $link['xp'],
        'xp_current_rank' => (int) $link['xp_current_rank'],
        'xp_next_rank'    => $link['xp_next_rank'] ? (int) $link['xp_next_rank'] : null,
        'rank_names'      => [
            'en' => $link['name_en'],
            'fr' => $link['name_fr'],
            'es' => $link['name_es'],
            'de' => $link['name_de'],
            'it' => $link['name_it'],
        ],
        'last_interaction_at' => $link['last_interaction_at'],
        'today_interactions'  => array_map(fn($i) => [
            'action_type'  => $i['action_type'],
            'initiator_id' => (int) $i['initiator_id'],
            'is_mutual'    => (bool) $i['is_mutual'],
        ], $todayInteractions),
    ]);
}

jsonError('Method Not Allowed', 405);
