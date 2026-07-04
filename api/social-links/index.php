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
 *   - personadle_sl_add_xp() gère la montée de rang (équivalent PHP de add_social_link_xp())
 *
 * Note : l'ancienne route POST /:linkId/interact (sans garde-fou d'amitié) a été retirée —
 * plus aucun appelant côté client (js/api.js n'utilise que interactByFriend()).
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/social_link.php';
require_once __DIR__ . '/../lib/social_link_interaction.php';

// XP par action (solo | mutuel) — table + calcul extraits dans api/lib/social_link.php
// (testable en PHPUnit sans MySQL, cf. tests/php/SocialLinkTest.php). L'orchestration
// DB de l'interaction (POST .../interact plus bas) vit dans social_link_interaction.php
// (testable en intégration, cf. tests/php/DatabaseIntegrationTest.php).

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// Extraire les segments de l'URI
$parts = requestPathSegments();

// ── Cas spécial : GET /api/social-links/by-friend/:friendId ──────────────────
$slIdx = array_search('social-links', $parts);
if ($method === 'GET' && $slIdx !== false && ($parts[$slIdx + 1] ?? '') === 'by-friend') {
    $friendId = (int) ($parts[$slIdx + 2] ?? 0);
    if ($friendId <= 0) jsonError('Missing friend id', 400);

    $linkId = personadle_sl_get_or_create_link($pdo, $authId, $friendId);

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

    $pdo->beginTransaction();
    try {
        $interaction = personadle_perform_social_link_interaction($pdo, $authId, $friendId, $actionType);
        $pdo->commit();
    } catch (PersonadleAlreadyInteractedException $e) {
        $pdo->rollBack();
        jsonError($e->getMessage(), 409);
    } catch (Throwable $e) {
        $pdo->rollBack();
        personadle_log_error($pdo, 'error', $e->getMessage(), [
            'source'    => 'social-links-interact',
            'friend_id' => $friendId,
        ], $authId);
        jsonError('Interaction failed', 500);
    }

    jsonSuccess($interaction);
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
