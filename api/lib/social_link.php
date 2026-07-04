<?php
/**
 * api/lib/social_link.php — Logique de calcul XP/rang du Social Link, PURE (sans base de données).
 *
 * Extraite de api/social-links/index.php pour être testable unitairement (PHPUnit, sans MySQL),
 * suivant le même principe que api/lib/streak.php.
 */

declare(strict_types=1);

/**
 * XP par action (solo | mutuel si l'autre a fait la même action aujourd'hui).
 * Source de vérité pour le calcul — cf. CLAUDE.md §5.9 "Actions qui génèrent de l'XP".
 */
const PERSONADLE_SL_XP_TABLE = [
    'share_streak'  => ['solo' => 15, 'mutual' => 30],
    'share_score'   => ['solo' => 10, 'mutual' => 20],
    'visit_profile' => ['solo' =>  5, 'mutual' => 10],
    'play_same_day' => ['solo' => 20, 'mutual' => 20], // toujours mutuel
    'compare_stats' => ['solo' => 10, 'mutual' => 20],
    'challenge'     => ['solo' => 15, 'mutual' => 35],
];

/**
 * Calcule l'XP gagné pour une action donnée.
 *
 * @param string $actionType Une clé de PERSONADLE_SL_XP_TABLE.
 * @param bool   $isMutual   True si l'autre ami a fait la même action le même jour.
 * @return int XP gagné.
 * @throws InvalidArgumentException Si $actionType est inconnu.
 */
function personadle_sl_xp_for_action(string $actionType, bool $isMutual): int
{
    if (!isset(PERSONADLE_SL_XP_TABLE[$actionType])) {
        throw new InvalidArgumentException("Unknown social link action_type: {$actionType}");
    }

    return $isMutual
        ? PERSONADLE_SL_XP_TABLE[$actionType]['mutual']
        : PERSONADLE_SL_XP_TABLE[$actionType]['solo'];
}

/**
 * Détermine le rang atteint pour un total d'XP donné, à partir d'une table de seuils.
 *
 * Pure — ne lit jamais la table `social_link_ranks` elle-même : l'appelant lui fournit
 * les seuils (généralement lus en base). Garde-fou testable sans dépendre de MySQL.
 *
 * @param int $xp Total d'XP cumulé.
 * @param array<int,int> $thresholds Map rang => xp_required (ex: [1=>0, 2=>100, ...]).
 * @return array{rank:int, xp_current_rank:int, xp_next_rank:?int}
 */
function personadle_sl_rank_for_xp(int $xp, array $thresholds): array
{
    if (empty($thresholds)) {
        throw new InvalidArgumentException('thresholds must not be empty');
    }

    ksort($thresholds);

    $rank           = 1;
    $xpCurrentRank  = 0;
    foreach ($thresholds as $r => $required) {
        if ($required <= $xp) {
            $rank          = $r;
            $xpCurrentRank = $required;
        } else {
            break;
        }
    }

    $maxRank  = max(array_keys($thresholds));
    $xpNextRank = null;
    if ($rank < $maxRank && isset($thresholds[$rank + 1])) {
        $xpNextRank = $thresholds[$rank + 1];
    }

    return [
        'rank'            => $rank,
        'xp_current_rank' => $xpCurrentRank,
        'xp_next_rank'    => $xpNextRank,
    ];
}
