<?php
/**
 * GET  /api/social-links/:linkId          → infos du Social Link (rang, xp, interactions today)
 * GET  /api/social-links/by-friend/:id    → retourne le link_id pour l'utilisateur + un ami
 * POST /api/social-links/:linkId/interact → enregistrer une interaction + XP
 *
 * Format body POST : { "action_type": "visit_profile" | "share_streak" | "share_score"
 *                                    | "play_same_day" | "compare_stats" | "challenge" }
 *
 * Règles :
 *   - Une action est possible max 1× par jour par couple d'amis (sauf play_same_day auto)
 *   - Si l'autre ami fait la même action dans la journée → is_mutual = 1 → XP doublé
 *   - La procédure add_social_link_xp() gère la montée de rang
 */

require_once __DIR__ . '/../bootstrap.php';

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

// XP par action (solo | mutuel si l'autre a fait la même action aujourd'hui)
const XP_TABLE = [
    'share_streak'  => ['solo' => 15, 'mutual' => 30],
    'share_score'   => ['solo' => 10, 'mutual' => 20],
    'visit_profile' => ['solo' =>  5, 'mutual' => 10],
    'play_same_day' => ['solo' => 20, 'mutual' => 20], // toujours mutuel
    'compare_stats' => ['solo' => 10, 'mutual' => 20],
    'challenge'     => ['solo' => 15, 'mutual' => 35],
];

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
        'is_badge_prompt'=> (bool) $n['is_badge_prompt'],
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
    $friendId = (int) ($parts[$slIdx + 2] ?? 0);
    if ($friendId <= 0) jsonError('Invalid friend id', 400);
    if ($friendId === $authId) jsonError('Cannot interact with yourself', 400);

    $data       = getJsonBody();
    $actionType = trim($data['action_type'] ?? '');
    if (!isset(XP_TABLE[$actionType])) jsonError('Invalid action_type', 400);

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

        $xpGained = $isMutual ? XP_TABLE[$actionType]['mutual'] : XP_TABLE[$actionType]['solo'];

        $pdo->prepare("
            INSERT INTO social_link_interactions (social_link_id, initiator_id, action_type, xp_gained, is_mutual)
            VALUES (?, ?, ?, ?, ?)
        ")->execute([$linkId, $authId, $actionType, $xpGained, $isMutual ? 1 : 0]);

        if ($isMutual && $actionType !== 'play_same_day') {
            $pdo->prepare("
                UPDATE social_link_interactions SET is_mutual = 1, xp_gained = ?
                WHERE social_link_id = ? AND initiator_id = ? AND action_type = ?
                  AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
            ")->execute([XP_TABLE[$actionType]['mutual'], $linkId, $friendId, $actionType, $today]);
            $bonusXp = XP_TABLE[$actionType]['mutual'] - XP_TABLE[$actionType]['solo'];
            if ($bonusXp > 0) addSocialLinkXp($pdo, $linkId, $bonusXp);
        }

        $result = addSocialLinkXp($pdo, $linkId, $xpGained);

        // Notifier l'autre joueur si le rang a monté (il verra l'animation au prochain poll)
        if ($result['ranked_up']) {
            $isBadgePrompt = $result['rank'] === 10 ? 1 : 0;
            $pdo->prepare("
                INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank, is_badge_prompt)
                VALUES (?, ?, ?, ?)
            ")->execute([$friendId, $authId, $result['rank'], $isBadgePrompt]);
            if ($isBadgePrompt) {
                $pdo->prepare("
                    INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank, is_badge_prompt)
                    VALUES (?, ?, ?, 1)
                ")->execute([$authId, $friendId, 10]);
            }
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

// ── GET /api/social-links/badge-status ───────────────────────────────────────
if ($method === 'GET' && $slIdx !== false && ($parts[$slIdx + 1] ?? '') === 'badge-status') {
    $friendId = (int) ($_GET['friend_id'] ?? 0);
    if ($friendId <= 0) jsonError('Missing friend_id', 400);

    $aId = min($authId, $friendId);
    $bId = max($authId, $friendId);
    $stmt = $pdo->prepare('SELECT id, `rank`, badge_generated FROM social_links WHERE user_a_id = ? AND user_b_id = ? LIMIT 1');
    $stmt->execute([$aId, $bId]);
    $link = $stmt->fetch();

    if (!$link || (int)$link['rank'] < 10) {
        jsonSuccess(['status' => 'none', 'your_config' => null, 'friend_submitted' => false, 'badge_data' => null]);
    }

    if ((int)$link['badge_generated'] === 1) {
        $stmt2 = $pdo->prepare('SELECT * FROM social_link_badges WHERE social_link_id = ? LIMIT 1');
        $stmt2->execute([$link['id']]);
        $badge = $stmt2->fetch();
        $isUserA = $aId === $authId;
        jsonSuccess([
            'status'          => 'complete',
            'your_config'     => null,
            'friend_submitted'=> true,
            'badge_data'      => $badge ? [
                'user_a_avatar' => $badge['user_a_avatar'],
                'user_b_avatar' => $badge['user_b_avatar'],
                'user_a_pseudo' => $badge['user_a_pseudo'],
                'user_b_pseudo' => $badge['user_b_pseudo'],
                'is_user_a'     => $isUserA,
            ] : null,
        ]);
    }

    $stmt3 = $pdo->prepare('SELECT * FROM social_link_badge_configs WHERE social_link_id = ?');
    $stmt3->execute([$link['id']]);
    $configs = $stmt3->fetchAll();
    $yourConfig      = null;
    $friendSubmitted = false;
    foreach ($configs as $cfg) {
        if ((int)$cfg['user_id'] === $authId) {
            $yourConfig = [
                'crop_x'     => (float)$cfg['crop_x'],
                'crop_y'     => (float)$cfg['crop_y'],
                'crop_scale' => (float)$cfg['crop_scale'],
                'ring_color' => $cfg['ring_color'],
                'bg_color'   => $cfg['bg_color'],
                'overlay'    => $cfg['overlay'],
                'submitted'  => $cfg['submitted_at'] !== null,
            ];
        } else {
            $friendSubmitted = $cfg['submitted_at'] !== null;
        }
    }

    $yourSubmitted = $yourConfig['submitted'] ?? false;
    if ($yourSubmitted && $friendSubmitted) {
        $status = 'complete';
    } elseif ($yourSubmitted) {
        $status = 'pending_theirs';
    } elseif ($friendSubmitted) {
        $status = 'pending_yours';
    } else {
        $status = 'pending_none';
    }

    jsonSuccess([
        'status'           => $status,
        'your_config'      => $yourConfig,
        'friend_submitted' => $friendSubmitted,
        'badge_data'       => null,
    ]);
}

// ── POST /api/social-links/badge-config ──────────────────────────────────────
if ($method === 'POST' && $slIdx !== false && ($parts[$slIdx + 1] ?? '') === 'badge-config') {
    $data     = getJsonBody();
    $friendId = (int) ($data['friend_id'] ?? 0);
    if ($friendId <= 0) jsonError('Missing friend_id', 400);

    $stmtF = $pdo->prepare("SELECT id FROM friendships WHERE status='accepted' AND ((requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)) LIMIT 1");
    $stmtF->execute([$authId, $friendId, $friendId, $authId]);
    if (!$stmtF->fetch()) jsonError('Not friends', 403);

    $aId = min($authId, $friendId);
    $bId = max($authId, $friendId);
    $stmt = $pdo->prepare('SELECT id, `rank`, badge_generated FROM social_links WHERE user_a_id = ? AND user_b_id = ? LIMIT 1');
    $stmt->execute([$aId, $bId]);
    $link = $stmt->fetch();
    if (!$link || (int)$link['rank'] < 10) jsonError('Social Link not at rank 10', 403);
    if ((int)$link['badge_generated'] === 1) jsonError('Badge already generated', 409);

    $linkId    = (int)$link['id'];
    $avatarData = $data['avatar_data'] ?? null;
    $cropX     = (float)($data['crop_x']     ?? 0);
    $cropY     = (float)($data['crop_y']     ?? 0);
    $cropScale = max(0.5, min(5.0, (float)($data['crop_scale'] ?? 1)));
    $ringColor = preg_match('/^#[0-9a-fA-F]{6}$/', $data['ring_color'] ?? '') ? $data['ring_color'] : '#f5c842';
    $bgColor   = preg_match('/^#[0-9a-fA-F]{6}$/', $data['bg_color']   ?? '') ? $data['bg_color']   : null;
    $overlay   = in_array($data['overlay'] ?? '', ['none','glow','shadow']) ? $data['overlay'] : 'none';
    $submit    = !empty($data['submit']);

    $bothSubmitted = false;
    $pdo->beginTransaction();
    try {
        $pdo->prepare("
            INSERT INTO social_link_badge_configs
                (social_link_id, user_id, avatar_data, crop_x, crop_y, crop_scale, ring_color, bg_color, overlay, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                avatar_data  = VALUES(avatar_data),
                crop_x       = VALUES(crop_x),
                crop_y       = VALUES(crop_y),
                crop_scale   = VALUES(crop_scale),
                ring_color   = VALUES(ring_color),
                bg_color     = VALUES(bg_color),
                overlay      = VALUES(overlay),
                submitted_at = VALUES(submitted_at),
                updated_at   = NOW()
        ")->execute([
            $linkId, $authId, $avatarData,
            $cropX, $cropY, $cropScale,
            $ringColor, $bgColor, $overlay,
            $submit ? date('Y-m-d H:i:s') : null,
        ]);

        if ($submit) {
            $stmt2 = $pdo->prepare('SELECT submitted_at FROM social_link_badge_configs WHERE social_link_id = ?');
            $stmt2->execute([$linkId]);
            $allConfigs = $stmt2->fetchAll();
            $bothSubmitted = count($allConfigs) === 2
                && array_reduce($allConfigs, fn($c, $r) => $c && $r['submitted_at'] !== null, true);
            if ($bothSubmitted) {
                $pdo->prepare('UPDATE social_links SET badge_generated = 1 WHERE id = ?')->execute([$linkId]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[badge-config] ' . $e->getMessage());
        jsonError('Failed to save badge config', 500);
    }

    jsonSuccess(['ok' => true, 'both_submitted' => $bothSubmitted]);
}

// ── POST /api/social-links/badge-final ───────────────────────────────────────
if ($method === 'POST' && $slIdx !== false && ($parts[$slIdx + 1] ?? '') === 'badge-final') {
    $data     = getJsonBody();
    $friendId = (int)($data['friend_id'] ?? 0);
    if ($friendId <= 0) jsonError('Missing friend_id', 400);

    $aId = min($authId, $friendId);
    $bId = max($authId, $friendId);
    $stmt = $pdo->prepare('
        SELECT sl.id, sl.badge_generated, sl.user_a_id,
               u_a.pseudo AS pseudo_a, u_b.pseudo AS pseudo_b
        FROM social_links sl
        JOIN users u_a ON u_a.id = sl.user_a_id
        JOIN users u_b ON u_b.id = sl.user_b_id
        WHERE sl.user_a_id = ? AND sl.user_b_id = ? LIMIT 1
    ');
    $stmt->execute([$aId, $bId]);
    $link = $stmt->fetch();
    if (!$link || (int)$link['badge_generated'] !== 1) jsonError('Badge not ready', 403);

    $stmt2 = $pdo->prepare('SELECT user_id, avatar_data FROM social_link_badge_configs WHERE social_link_id = ?');
    $stmt2->execute([$link['id']]);
    $configs = $stmt2->fetchAll();
    $aAvatar = null;
    $bAvatar = null;
    foreach ($configs as $c) {
        if ((int)$c['user_id'] === $aId) $aAvatar = $c['avatar_data'];
        else $bAvatar = $c['avatar_data'];
    }

    $pdo->prepare("
        INSERT INTO social_link_badges (social_link_id, user_a_avatar, user_b_avatar, user_a_pseudo, user_b_pseudo)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            user_a_avatar = VALUES(user_a_avatar),
            user_b_avatar = VALUES(user_b_avatar),
            generated_at  = NOW()
    ")->execute([$link['id'], $aAvatar, $bAvatar, $link['pseudo_a'], $link['pseudo_b']]);

    foreach ([$aId, $bId] as $uid) {
        $pdo->prepare("
            INSERT IGNORE INTO badges_unlocked (user_id, badge_id, unlocked_at)
            SELECT ?, id, NOW() FROM badges WHERE slug = 'true_confidant' LIMIT 1
        ")->execute([$uid]);
    }

    jsonSuccess(['ok' => true]);
}

// ── GET /api/social-links/:linkId/badge ──────────────────────────────────────
if ($method === 'GET' && $slIdx !== false
    && ctype_digit((string)($parts[$slIdx + 1] ?? ''))
    && ($parts[$slIdx + 2] ?? '') === 'badge'
) {
    $targetLinkId = (int)$parts[$slIdx + 1];
    $stmt = $pdo->prepare('SELECT id, user_a_id, user_b_id, badge_generated FROM social_links WHERE id = ? AND (user_a_id = ? OR user_b_id = ?) LIMIT 1');
    $stmt->execute([$targetLinkId, $authId, $authId]);
    $link = $stmt->fetch();
    if (!$link) jsonError('Not found', 404);

    $stmt2 = $pdo->prepare('SELECT user_id, avatar_data, crop_x, crop_y, crop_scale, ring_color, bg_color, overlay, submitted_at FROM social_link_badge_configs WHERE social_link_id = ?');
    $stmt2->execute([$targetLinkId]);
    $configs = $stmt2->fetchAll();

    jsonSuccess([
        'link_id'         => $targetLinkId,
        'badge_generated' => (bool)$link['badge_generated'],
        'is_user_a'       => (int)$link['user_a_id'] === $authId,
        'configs'         => array_map(fn($c) => [
            'user_id'    => (int)$c['user_id'],
            'is_me'      => (int)$c['user_id'] === $authId,
            'avatar_data'=> $c['avatar_data'],
            'crop_x'     => (float)$c['crop_x'],
            'crop_y'     => (float)$c['crop_y'],
            'crop_scale' => (float)$c['crop_scale'],
            'ring_color' => $c['ring_color'],
            'bg_color'   => $c['bg_color'],
            'overlay'    => $c['overlay'],
            'submitted'  => $c['submitted_at'] !== null,
        ], $configs),
    ]);
}

// ── Extraire linkId et éventuel sous-chemin /interact ───────────────────────
$linkId    = 0;
$subAction = '';
if ($slIdx !== false && isset($parts[$slIdx + 1]) && ctype_digit($parts[$slIdx + 1])) {
    $linkId    = (int) $parts[$slIdx + 1];
    $subAction = $parts[$slIdx + 2] ?? '';
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


// ═══════════════════════════════════════════════════════════════════
// POST /api/social-links/:linkId/interact
// ═══════════════════════════════════════════════════════════════════
if ($method === 'POST' && $subAction === 'interact') {
    $data       = getJsonBody();
    $actionType = trim($data['action_type'] ?? '');

    if (!isset(XP_TABLE[$actionType])) {
        jsonError('Invalid action_type', 400);
    }

    // Vérifier que l'utilisateur fait bien partie de ce Social Link
    $stmt = $pdo->prepare('SELECT user_a_id, user_b_id FROM social_links WHERE id = ? LIMIT 1');
    $stmt->execute([$linkId]);
    $link = $stmt->fetch();
    if (!$link || ((int)$link['user_a_id'] !== $authId && (int)$link['user_b_id'] !== $authId)) {
        jsonError('Social Link not found or access denied', 404);
    }

    $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

    // Anti-spam : vérifier si déjà fait aujourd'hui (toutes actions, y compris play_same_day)
    $stmtCheck = $pdo->prepare("
        SELECT id FROM social_link_interactions
        WHERE social_link_id = ?
          AND initiator_id   = ?
          AND action_type    = ?
          AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
        LIMIT 1
    ");
    $stmtCheck->execute([$linkId, $authId, $actionType, $today]);
    if ($stmtCheck->fetch()) {
        jsonError('Already performed this action today', 409);
    }

    // Vérifier si l'autre ami a fait la même action aujourd'hui → mutuel
    $otherId = ((int)$link['user_a_id'] === $authId) ? (int)$link['user_b_id'] : (int)$link['user_a_id'];
    $stmtOther = $pdo->prepare("
        SELECT id FROM social_link_interactions
        WHERE social_link_id = ?
          AND initiator_id   = ?
          AND action_type    = ?
          AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
        LIMIT 1
    ");
    $stmtOther->execute([$linkId, $otherId, $actionType, $today]);
    $isMutual = (bool) $stmtOther->fetch();

    // play_same_day est toujours mutuel
    if ($actionType === 'play_same_day') $isMutual = true;

    $xpGained = $isMutual ? XP_TABLE[$actionType]['mutual'] : XP_TABLE[$actionType]['solo'];

    $result = [];
    $pdo->beginTransaction();
    try {
        // Logger l'interaction
        $pdo->prepare("
            INSERT INTO social_link_interactions
                (social_link_id, initiator_id, action_type, xp_gained, is_mutual)
            VALUES (?, ?, ?, ?, ?)
        ")->execute([$linkId, $authId, $actionType, $xpGained, $isMutual ? 1 : 0]);

        // Si mutuel, mettre à jour l'interaction précédente de l'autre aussi
        if ($isMutual && $actionType !== 'play_same_day') {
            $pdo->prepare("
                UPDATE social_link_interactions
                SET is_mutual = 1, xp_gained = ?
                WHERE social_link_id = ?
                  AND initiator_id   = ?
                  AND action_type    = ?
                  AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
            ")->execute([XP_TABLE[$actionType]['mutual'], $linkId, $otherId, $actionType, $today]);

            // Ajouter l'XP bonus à l'autre (différence solo→mutual)
            $bonusXp = XP_TABLE[$actionType]['mutual'] - XP_TABLE[$actionType]['solo'];
            if ($bonusXp > 0) {
                addSocialLinkXp($pdo, $linkId, $bonusXp);
            }
        }

        // Ajouter l'XP du joueur courant et récupérer le résultat
        $result = addSocialLinkXp($pdo, $linkId, $xpGained);

        // Notifier l'autre joueur si le rang a monté (il verra l'animation au prochain poll)
        if ($result['ranked_up']) {
            $isBadgePrompt = $result['rank'] === 10 ? 1 : 0;
            $pdo->prepare("
                INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank, is_badge_prompt)
                VALUES (?, ?, ?, ?)
            ")->execute([$otherId, $authId, $result['rank'], $isBadgePrompt]);
            if ($isBadgePrompt) {
                $pdo->prepare("
                    INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank, is_badge_prompt)
                    VALUES (?, ?, ?, 1)
                ")->execute([$authId, $otherId, 10]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[SL interact] ' . $e->getMessage());
        jsonError('Interaction failed', 500);
    }

    jsonSuccess([
        'xp_gained' => $xpGained,
        'is_mutual' => $isMutual,
        'new_xp'    => (int) ($result['xp']       ?? 0),
        'new_rank'  => (int) ($result['rank']      ?? 1),
        'ranked_up' => (bool) ($result['ranked_up'] ?? false),
    ]);
}

jsonError('Method Not Allowed', 405);
