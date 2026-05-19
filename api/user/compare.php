<?php
/**
 * GET /api/user/compare?friend_id=X
 *
 * Stats comparison overlay between me and a friend.
 * Cooldown: 72h per pair (tracked in social_link_interactions with action compare_stats).
 * Awards Social Link XP: +10 solo, +20 mutual (friend also compared in 72h).
 *
 * Response:
 *   { me, friend, on_cooldown, cooldown_until, xp_gained }
 */

require_once __DIR__ . '/../bootstrap.php';

$authId   = requireAuth();
$pdo      = pdo();
$friendId = (int) ($_GET['friend_id'] ?? 0);

if ($friendId <= 0 || $friendId === $authId) jsonError('Invalid friend_id', 400);

// ── Friendship check ──────────────────────────────────────────────────────────
$stmtFriend = $pdo->prepare(
    "SELECT id FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
     LIMIT 1"
);
$stmtFriend->execute([$authId, $friendId, $friendId, $authId]);
if (!$stmtFriend->fetch()) jsonError('Not friends', 403);

// ── Get or create social link (canonical order: min/max) ─────────────────────
$aId = min($authId, $friendId);
$bId = max($authId, $friendId);

$stmtLink = $pdo->prepare('SELECT id FROM social_links WHERE user_a_id = ? AND user_b_id = ? LIMIT 1');
$stmtLink->execute([$aId, $bId]);
$existing = $stmtLink->fetch();
if ($existing) {
    $linkId = (int) $existing['id'];
} else {
    $pdo->prepare('INSERT INTO social_links (user_a_id, user_b_id) VALUES (?, ?)')->execute([$aId, $bId]);
    $linkId = (int) $pdo->lastInsertId();
}

// ── Cooldown check (72h) ──────────────────────────────────────────────────────
$cooldownHours = 72;
$stmtCd = $pdo->prepare(
    "SELECT created_at FROM social_link_interactions
     WHERE social_link_id = ?
       AND initiator_id = ?
       AND action_type = 'compare_stats'
     ORDER BY created_at DESC
     LIMIT 1"
);
$stmtCd->execute([$linkId, $authId]);
$lastUsed = $stmtCd->fetchColumn();

$onCooldown    = false;
$cooldownUntil = null;

if ($lastUsed) {
    $lastDt  = new DateTime($lastUsed, new DateTimeZone('UTC'));
    $now     = new DateTime('now', new DateTimeZone('UTC'));
    $diffSec = $now->getTimestamp() - $lastDt->getTimestamp();
    if ($diffSec < $cooldownHours * 3600) {
        $onCooldown    = true;
        $cooldownUntil = (clone $lastDt)->modify("+{$cooldownHours} hours")->format(DateTime::ATOM);
    }
}

// ── Load stats for both players ───────────────────────────────────────────────
function loadUserStats(PDO $pdo, int $userId): array {
    $stmtU = $pdo->prepare(
        'SELECT id, pseudo, friend_code FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1'
    );
    $stmtU->execute([$userId]);
    $user = $stmtU->fetch();
    if (!$user) return [];

    $stmtP = $pdo->prepare('SELECT avatar_data FROM profiles WHERE user_id = ?');
    $stmtP->execute([$userId]);
    $profile = $stmtP->fetch() ?: [];

    $stmtS = $pdo->prepare(
        'SELECT mode, wins, games, streak, streak_record, perfect_wins, total_time_ms
         FROM user_stats WHERE user_id = ? ORDER BY mode'
    );
    $stmtS->execute([$userId]);
    $byMode = $stmtS->fetchAll();

    $totalWins    = 0;
    $totalGames   = 0;
    $totalPerfect = 0;
    $bestStreak   = 0;
    foreach ($byMode as &$m) {
        $m['winrate']  = $m['games'] > 0 ? round($m['wins'] / $m['games'] * 100, 1) : 0;
        $totalWins    += (int) $m['wins'];
        $totalGames   += (int) $m['games'];
        $totalPerfect += (int) $m['perfect_wins'];
        if ((int) $m['streak_record'] > $bestStreak) $bestStreak = (int) $m['streak_record'];
    }
    unset($m);

    return [
        'id'            => (int) $user['id'],
        'pseudo'        => $user['pseudo'],
        'friend_code'   => $user['friend_code'],
        'avatar_data'   => $profile['avatar_data'] ?? null,
        'by_mode'       => $byMode,
        'total_wins'    => $totalWins,
        'total_games'   => $totalGames,
        'total_perfect' => $totalPerfect,
        'best_streak'   => $bestStreak,
    ];
}

$me     = loadUserStats($pdo, $authId);
$friend = loadUserStats($pdo, $friendId);

// ── Award XP (only if not on cooldown) ───────────────────────────────────────
$xpGained = 0;
if (!$onCooldown) {
    // Check mutuality BEFORE opening the transaction (read-only, no locking needed)
    $stmtMutual = $pdo->prepare(
        "SELECT id FROM social_link_interactions
         WHERE social_link_id = ?
           AND initiator_id = ?
           AND action_type = 'compare_stats'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
         LIMIT 1"
    );
    $stmtMutual->execute([$linkId, $friendId]);
    $isMutual = (bool) $stmtMutual->fetch();

    $xpGained = $isMutual ? 20 : 10;

    // All writes go inside a single transaction so INSERT + UPDATE are atomic.
    // FOR UPDATE now runs inside the transaction — the row lock is effective.
    // $cooldownUntil is only set on successful commit so the client can retry on failure.
    $pdo->beginTransaction();
    try {
        $stmtXp = $pdo->prepare('SELECT xp, `rank` FROM social_links WHERE id = ? LIMIT 1 FOR UPDATE');
        $stmtXp->execute([$linkId]);
        $sl    = $stmtXp->fetch();
        $newXp = ((int) ($sl['xp'] ?? 0)) + $xpGained;

        $stmtRank = $pdo->prepare(
            'SELECT MAX(`rank`) AS new_rank FROM social_link_ranks WHERE xp_required <= ?'
        );
        $stmtRank->execute([$newXp]);
        $newRank = max(1, (int) ($stmtRank->fetchColumn() ?: 1));

        $pdo->prepare(
            "INSERT INTO social_link_interactions
             (social_link_id, initiator_id, action_type, xp_gained, is_mutual)
             VALUES (?, ?, 'compare_stats', ?, ?)"
        )->execute([$linkId, $authId, $xpGained, $isMutual ? 1 : 0]);

        $oldRank = (int) ($sl['rank'] ?? 1);
        $pdo->prepare('UPDATE social_links SET xp = ?, `rank` = ?, last_interaction_at = NOW() WHERE id = ?')
            ->execute([$newXp, $newRank, $linkId]);

        $pdo->commit();

        $rankedUp = $newRank > $oldRank;
        // Only mark the cooldown after a successful commit — client can retry on failure
        $cooldownUntil = (new DateTime('now', new DateTimeZone('UTC')))
            ->modify("+{$cooldownHours} hours")
            ->format(DateTime::ATOM);
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[compare XP] ' . $e->getMessage());
        // Non-fatal: comparison data is still returned even if XP fails.
        // $cooldownUntil stays null so the client can retry.
        $xpGained = 0;
        $newRank  = 0;
        $rankedUp = false;
    }
}

jsonSuccess([
    'me'             => $me,
    'friend'         => $friend,
    'on_cooldown'    => $onCooldown,
    'cooldown_until' => $cooldownUntil,
    'xp_gained'      => $xpGained,
    'ranked_up'      => $rankedUp ?? false,
    'new_rank'       => $newRank  ?? 0,
]);
