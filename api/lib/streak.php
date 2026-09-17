<?php
/**
 * api/lib/streak.php — Logique de streak PURE (sans base de données).
 *
 * Extraite de api/sessions.php pour être réutilisable ET testable unitairement
 * (PHPUnit, sans MySQL). Toute la frontière de journée est calée sur Europe/Paris.
 */

declare(strict_types=1);

/**
 * Calcule la nouvelle streak après une partie terminée.
 *
 * Règles :
 *   - Abandon                         → 0
 *   - Première partie (jamais jouée)  → 1
 *   - Victoire le lendemain (Paris)   → streak + 1
 *   - Victoire après un trou de jours → 1
 *
 * @param string|null $lastPlayedAtUtc Dernier last_played_at en UTC (format MySQL) ou null.
 * @param string      $playedDateParis Date jouée "Y-m-d" en heure de Paris.
 * @param string      $result          'win' | 'giveup'.
 * @param int         $currentStreak   Streak actuelle avant cette partie.
 * @return int Nouvelle streak.
 */
function personadle_compute_streak(
    ?string $lastPlayedAtUtc,
    string $playedDateParis,
    string $result,
    int $currentStreak
): int {
    if ($result !== 'win') {
        return 0;
    }
    if ($lastPlayedAtUtc === null || $lastPlayedAtUtc === '') {
        return 1;
    }

    $lastDateParis = (new DateTime($lastPlayedAtUtc, new DateTimeZone('UTC')))
        ->setTimezone(new DateTimeZone('Europe/Paris'))
        ->format('Y-m-d');

    $playedDt = new DateTime($playedDateParis, new DateTimeZone('Europe/Paris'));
    $lastDt   = new DateTime($lastDateParis,   new DateTimeZone('Europe/Paris'));
    $daysDiff = (int) $lastDt->diff($playedDt)->format('%r%a');

    return $daysDiff === 1 ? $currentStreak + 1 : 1;
}

/**
 * Une partie « parfaite » = victoire en un seul essai.
 */
function personadle_is_perfect(string $result, int $attempts): bool
{
    return $result === 'win' && $attempts === 1;
}

/**
 * Streak GLOBALE (tous modes confondus) après une partie.
 *
 * Contrairement à la streak par-mode, la streak globale compte les JOURS
 * consécutifs où le joueur a joué au moins une partie (quel que soit le mode
 * et le résultat — c'est un streak d'assiduité, comme côté client). Toute la
 * frontière de journée est en heure de Paris.
 *
 * Le jour comptabilisé est le jour de JEU de la partie (`played_date`, validé par
 * api/sessions.php à aujourd'hui ou hier), pas le jour où elle arrive au serveur.
 * Une partie jouée à 23 h 50 et synchronisée à 0 h 10 (file hors ligne) était
 * datée du lendemain : la journée de la veille manquait, et si la précédente
 * était l'avant-veille, la streak repartait à 1 alors que le joueur avait joué
 * tous les jours — la streak par mode, elle, lisait déjà `played_date`.
 *
 * Une partie datée d'AVANT la dernière journée comptée (la session de la veille
 * qui arrive après celle du jour) ne change rien : sa journée est déjà comptée
 * ou déjà passée, on ne recule jamais.
 *
 * @param string|null $lastDateParis  global_streak_date précédente ("Y-m-d") ou null.
 * @param string      $playedDateParis Jour de jeu "Y-m-d" en heure de Paris.
 * @param int         $currentStreak  Streak globale actuelle.
 * @return int Nouvelle streak globale.
 */
function personadle_global_streak(
    ?string $lastDateParis,
    string $playedDateParis,
    int $currentStreak
): int {
    if ($lastDateParis === null || $lastDateParis === '') {
        return 1;
    }
    if ($playedDateParis <= $lastDateParis) {
        return max(1, $currentStreak); // journée déjà comptée (ou antérieure) → inchangé
    }

    $played = new DateTime($playedDateParis, new DateTimeZone('Europe/Paris'));
    $last   = new DateTime($lastDateParis, new DateTimeZone('Europe/Paris'));
    $daysDiff = (int) $last->diff($played)->format('%r%a');

    return $daysDiff === 1 ? $currentStreak + 1 : 1;
}
