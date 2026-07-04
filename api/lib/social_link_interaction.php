<?php
/**
 * api/lib/social_link_interaction.php — Enregistrement d'une interaction Social
 * Link entre deux amis + attribution d'XP (bonus mutuel, notification de rank-up).
 *
 * Contrairement à api/lib/social_link.php (pur, sans base), ce fichier TOUCHE LA
 * BASE — extrait de la route POST /api/social-links/by-friend/:id/interact pour
 * être testable en intégration (PHPUnit + MariaDB, cf. tests/php/DatabaseIntegrationTest.php)
 * sans dupliquer la logique dans les tests : l'endpoint appelle exactement ces fonctions.
 */

declare(strict_types=1);

require_once __DIR__ . '/social_link.php';

/** Levée quand l'action a déjà été effectuée aujourd'hui pour ce couple d'amis — mappée vers un 409. */
class PersonadleAlreadyInteractedException extends RuntimeException
{
}

/**
 * Équivalent PHP de la procédure stockée add_social_link_xp(). Ajoute de l'XP
 * au social link et monte le rang si nécessaire.
 * @return array{xp:int, rank:int, ranked_up:int}
 */
function personadle_sl_add_xp(PDO $pdo, int $linkId, int $xpAmount): array
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

/**
 * Trouve (ou crée) le Social Link entre deux utilisateurs, en ordre canonique
 * (user_a_id < user_b_id — cf. chk_sl_order en base).
 */
function personadle_sl_get_or_create_link(PDO $pdo, int $userA, int $userB): int
{
    $aId = min($userA, $userB);
    $bId = max($userA, $userB);

    $stmt = $pdo->prepare('SELECT id FROM social_links WHERE user_a_id = ? AND user_b_id = ? LIMIT 1');
    $stmt->execute([$aId, $bId]);
    $existing = $stmt->fetch();
    if ($existing) {
        return (int) $existing['id'];
    }

    $pdo->prepare('INSERT INTO social_links (user_a_id, user_b_id) VALUES (?, ?)')->execute([$aId, $bId]);
    return (int) $pdo->lastInsertId();
}

/**
 * Enregistre une interaction Social Link (action_type effectuée par $authId
 * envers $friendId) et attribue l'XP correspondant — avec bonus mutuel si
 * l'ami a fait la même action le même jour (frontière Europe/Paris), et
 * notification de montée de rang le cas échéant.
 *
 * L'appelant est responsable de : la transaction (begin/commit/rollback), le
 * garde-fou d'amitié (les deux users doivent être amis — vérifié en amont
 * dans l'endpoint, hors de cette fonction), et le rate-limiting.
 *
 * @return array{link_id:int, xp_gained:int, is_mutual:bool, new_xp:int, new_rank:int, ranked_up:bool}
 * @throws PersonadleAlreadyInteractedException Action déjà faite aujourd'hui pour ce couple.
 * @throws InvalidArgumentException $actionType inconnu (cf. PERSONADLE_SL_XP_TABLE).
 */
function personadle_perform_social_link_interaction(
    PDO $pdo,
    int $authId,
    int $friendId,
    string $actionType
): array {
    if (!isset(PERSONADLE_SL_XP_TABLE[$actionType])) {
        throw new InvalidArgumentException("Unknown social link action_type: {$actionType}");
    }

    $linkId = personadle_sl_get_or_create_link($pdo, $authId, $friendId);
    $today  = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

    // Anti-spam : 1 action par jour (toutes actions, y compris play_same_day)
    $stmtCheck = $pdo->prepare("
        SELECT id FROM social_link_interactions
        WHERE social_link_id = ? AND initiator_id = ? AND action_type = ?
          AND DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = ?
        LIMIT 1
    ");
    $stmtCheck->execute([$linkId, $authId, $actionType, $today]);
    if ($stmtCheck->fetch()) {
        throw new PersonadleAlreadyInteractedException('Already performed this action today');
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
        if ($bonusXp > 0) personadle_sl_add_xp($pdo, $linkId, $bonusXp);
    }

    $result = personadle_sl_add_xp($pdo, $linkId, $xpGained);

    // Notifier l'autre joueur si le rang a monté (il verra l'animation au prochain poll)
    if ($result['ranked_up']) {
        $pdo->prepare("
            INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank)
            VALUES (?, ?, ?)
        ")->execute([$friendId, $authId, $result['rank']]);
    }

    return [
        'link_id'   => $linkId,
        'xp_gained' => $xpGained,
        'is_mutual' => $isMutual,
        'new_xp'    => (int) $result['xp'],
        'new_rank'  => (int) $result['rank'],
        'ranked_up' => (bool) $result['ranked_up'],
    ];
}
