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
 * @param string|null $lastDateParis  global_streak_date précédente ("Y-m-d") ou null.
 * @param string      $todayParis     Date du jour "Y-m-d" en heure de Paris.
 * @param int         $currentStreak  Streak globale actuelle.
 * @return int Nouvelle streak globale.
 */
function personadle_global_streak(
    ?string $lastDateParis,
    string $todayParis,
    int $currentStreak
): int {
    if ($lastDateParis === null || $lastDateParis === '') {
        return 1;
    }
    if ($lastDateParis === $todayParis) {
        return max(1, $currentStreak); // déjà joué aujourd'hui → inchangé
    }

    $today = new DateTime($todayParis, new DateTimeZone('Europe/Paris'));
    $last  = new DateTime($lastDateParis, new DateTimeZone('Europe/Paris'));
    $daysDiff = (int) $last->diff($today)->format('%r%a');

    return $daysDiff === 1 ? $currentStreak + 1 : 1;
}
