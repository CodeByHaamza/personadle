<?php
/**
 * api/lib/social_link_xp_grant.php — Attribution d'XP Social Link via la
 * procédure stockée `add_social_link_xp`, avec détection et notification du
 * rank-up.
 *
 * Corrige un bug pré-existant : les deux appels `CALL add_social_link_xp(...)`
 * de api/messages/index.php (XP défi/défi relevé) ne relisaient jamais les OUT
 * params — un rank-up déclenché par un défi ne notifiait donc jamais personne,
 * contrairement au chemin api/lib/social_link_interaction.php (interactions
 * quotidiennes), qui lui insère dans social_link_rankup_notifs.
 */

declare(strict_types=1);

/**
 * @return array{ranked_up:bool, new_rank:?int}
 */
function personadle_grant_social_link_xp_via_procedure(
    PDO $pdo,
    int $linkId,
    int $xpAmount,
    int $recipientId,
    int $partnerId
): array {
    $pdo->prepare('CALL add_social_link_xp(?, ?, @x, @r, @u)')->execute([$linkId, $xpAmount]);
    $out = $pdo->query('SELECT @r AS new_rank, @u AS ranked_up')->fetch();

    $rankedUp = $out && (int) $out['ranked_up'] === 1;
    if (!$rankedUp) {
        return ['ranked_up' => false, 'new_rank' => null];
    }

    $newRank = (int) $out['new_rank'];
    $pdo->prepare("
        INSERT INTO social_link_rankup_notifs (recipient_id, partner_id, new_rank)
        VALUES (?, ?, ?)
    ")->execute([$recipientId, $partnerId, $newRank]);

    return ['ranked_up' => true, 'new_rank' => $newRank];
}
