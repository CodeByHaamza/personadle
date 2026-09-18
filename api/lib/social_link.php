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
    // Défi en Mode Expert : les DEUX joueurs ont dû débloquer le mode (le serveur
    // refuse l'envoi sinon, cf. api/messages/index.php), et la partie y est plus
    // exigeante. L'écart reste volontairement modeste — l'XP Social Link mesure le
    // lien entre deux joueurs, pas la difficulté ; un gros bonus pousserait à ne
    // plus jouer que ça et déformerait ce que la jauge raconte.
    'challenge_expert' => ['solo' => 25, 'mutual' => 50],
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

/**
 * Bornes UTC d'une journée du JEU (Europe/Paris), pour filtrer une colonne
 * TIMESTAMP stockée en UTC.
 *
 * ── Pourquoi cette fonction existe ───────────────────────────────────────────
 * Les requêtes Social Link filtraient la journée avec
 * `DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = :jour`. `CONVERT_TZ`
 * vers un fuseau NOMMÉ exige les tables de fuseaux du serveur SQL
 * (`mysql.time_zone_name`), qui ne sont **pas peuplées par défaut** et sont
 * typiquement absentes d'un hébergement mutualisé — le dépôt le documentait déjà
 * dans `api/admin/activity.php`, qui contourne le problème en regroupant côté PHP.
 *
 * Quand ces tables manquent, `CONVERT_TZ` ne lève rien : il renvoie **NULL**. La
 * comparaison `DATE(NULL) = '2026-09-18'` vaut alors NULL, donc faux, et TOUTES
 * ces requêtes ne trouvent jamais rien. Conséquences constatées :
 *   - la garde anti-spam « 1 action par jour » ne se déclenche jamais : la même
 *     action répétée le même jour est acceptée indéfiniment. Mesuré : 180 appels
 *     de `share_streak` d'affilée suffisent à atteindre le rang 10 (2700 XP),
 *     ce qui accorde d'un coup le wallpaper `dark_shopping_district` (rang ≥ 5)
 *     et le titre `aigis_metis_same_soul` (rang ≥ 10) ;
 *   - le bonus mutuel ne se déclenche jamais : deux amis qui font la même action
 *     le même jour touchent le tarif solo, et la jauge progresse deux fois moins
 *     vite que ce que le produit annonce.
 *
 * Invisible en CI : l'image Docker MySQL, elle, embarque les tables de fuseaux.
 * Les tests passaient donc au vert sur un chemin que la prod n'emprunte pas —
 * exactement le cas signalé par CLAUDE.md §13 (« CI verte insuffisante si elle ne
 * peut pas exécuter le scénario concerné »).
 *
 * ── Pourquoi PHP plutôt que CONVERT_TZ avec un décalage fixe ────────────────
 * `'+02:00'` marcherait sans tables… jusqu'au changement d'heure. PHP connaît le
 * DST, lui, et `Europe/Paris` y est déjà la référence partout ailleurs
 * (`parisDateKey()` côté client, `api/sessions.php` côté serveur).
 *
 * Bénéfice secondaire : la comparaison porte désormais sur la colonne NUE
 * (`created_at >= ? AND created_at < ?`) au lieu d'une expression, donc un index
 * sur `created_at` redevient utilisable.
 *
 * @param  ?string $day Jour Paris au format 'Y-m-d'. Par défaut : aujourd'hui.
 * @return array{0: string, 1: string} [début inclus, fin exclue], en UTC 'Y-m-d H:i:s'.
 */
function personadle_paris_day_bounds_utc(?string $day = null): array
{
    $paris = new DateTimeZone('Europe/Paris');
    $utc   = new DateTimeZone('UTC');

    $day ??= (new DateTime('now', $paris))->format('Y-m-d');

    // Minuit à Paris ce jour-là, puis minuit le lendemain. Passer par
    // `modify('+1 day')` sur un objet EN heure de Paris — et non par +86400
    // secondes — est ce qui rend les deux journées de bascule DST correctes :
    // l'une dure 23 h, l'autre 25 h.
    $start = new DateTime($day . ' 00:00:00', $paris);
    $end   = (clone $start)->modify('+1 day');

    return [
        $start->setTimezone($utc)->format('Y-m-d H:i:s'),
        $end->setTimezone($utc)->format('Y-m-d H:i:s'),
    ];
}
