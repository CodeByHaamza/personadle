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
