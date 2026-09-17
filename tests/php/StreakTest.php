<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/streak.php';

/**
 * Tests de la logique de streak serveur (api/lib/streak.php).
 * Aucun accès base de données — fonction pure.
 */
final class StreakTest extends TestCase
{
    public function testGiveupResetsToZero(): void
    {
        $this->assertSame(0, personadle_compute_streak('2025-06-14 10:00:00', '2025-06-15', 'giveup', 5));
    }

    public function testFirstEverPlayIsOne(): void
    {
        $this->assertSame(1, personadle_compute_streak(null, '2025-06-15', 'win', 0));
        $this->assertSame(1, personadle_compute_streak('', '2025-06-15', 'win', 0));
    }

    public function testConsecutiveDayIncrements(): void
    {
        // Dernière partie le 14 (Paris), jouée le 15 → +1
        $this->assertSame(6, personadle_compute_streak('2025-06-14 10:00:00', '2025-06-15', 'win', 5));
    }

    public function testGapResetsToOne(): void
    {
        // Trou de 3 jours → repart à 1
        $this->assertSame(1, personadle_compute_streak('2025-06-12 10:00:00', '2025-06-15', 'win', 5));
    }

    public function testSameDayResetsToOne(): void
    {
        // Même jour (diff 0, ne devrait pas arriver grâce à la contrainte UNIQUE) → 1
        $this->assertSame(1, personadle_compute_streak('2025-06-15 08:00:00', '2025-06-15', 'win', 5));
    }

    public function testUtcToParisBoundaryCountsAsConsecutive(): void
    {
        // 2025-06-14 23:30 UTC = 2025-06-15 01:30 à Paris (CEST, UTC+2).
        // La dernière partie compte donc pour le 15 ; jouée le 16 → consécutive (+1).
        // Un calcul en UTC aurait vu le 14 → trou → reset (bug).
        $this->assertSame(6, personadle_compute_streak('2025-06-14 23:30:00', '2025-06-16', 'win', 5));
    }

    public function testPerfectDetection(): void
    {
        $this->assertTrue(personadle_is_perfect('win', 1));
        $this->assertFalse(personadle_is_perfect('win', 2));
        $this->assertFalse(personadle_is_perfect('giveup', 1));
    }

    // ── Streak GLOBALE (tous modes confondus) ────────────────────────────────

    public function testGlobalFirstPlayIsOne(): void
    {
        $this->assertSame(1, personadle_global_streak(null, '2025-06-15', 0));
        $this->assertSame(1, personadle_global_streak('', '2025-06-15', 0));
    }

    public function testGlobalConsecutiveDayIncrements(): void
    {
        // Joué hier (14) → aujourd'hui (15) : +1, peu importe le mode/résultat
        $this->assertSame(6, personadle_global_streak('2025-06-14', '2025-06-15', 5));
    }

    public function testGlobalSameDayUnchanged(): void
    {
        // Déjà joué aujourd'hui (autre mode) → la streak globale ne bouge pas
        $this->assertSame(5, personadle_global_streak('2025-06-15', '2025-06-15', 5));
    }

    public function testGlobalGapResetsToOne(): void
    {
        $this->assertSame(1, personadle_global_streak('2025-06-12', '2025-06-15', 5));
    }

    public function testGlobalCrossModeNeverCollapses(): void
    {
        // Cœur du fix : jouer un mode DIFFÉRENT chaque jour ne casse pas la streak
        // globale (alors que chaque streak par-mode resterait à 1).
        $s = 0;
        $s = personadle_global_streak(null, '2025-06-15', $s);        // J1 Classic → 1
        $s = personadle_global_streak('2025-06-15', '2025-06-16', $s); // J2 Emoji   → 2
        $s = personadle_global_streak('2025-06-16', '2025-06-17', $s); // J3 Music   → 3
        $this->assertSame(3, $s);
    }

    // ── Jour de JEU vs jour de réception (2.2) ───────────────────────────────

    public function testGlobalLateSyncOfYesterdayKeepsTheChain(): void
    {
        // Dernière journée comptée : le 13. Partie jouée le 14 à 23 h 50, hors
        // ligne, synchronisée le 15 à 0 h 10 avec played_date = 14. Avant : datée
        // du 15 → écart de 2 jours → streak remise à 1. Maintenant : le 14 suit
        // le 13, +1.
        $this->assertSame(6, personadle_global_streak('2025-06-13', '2025-06-14', 5));
        // Puis la partie du 15 : +1 encore.
        $this->assertSame(7, personadle_global_streak('2025-06-14', '2025-06-15', 6));
    }

    public function testGlobalYesterdaySessionArrivingAfterTodayIsInert(): void
    {
        // La journée du 15 est déjà comptée ; une session du 14 qui arrive ensuite
        // (file hors ligne vidée en retard) ne doit ni avancer ni remettre à 1.
        $this->assertSame(5, personadle_global_streak('2025-06-15', '2025-06-14', 5));
        // Et jamais 0, même si la valeur courante était incohérente.
        $this->assertSame(1, personadle_global_streak('2025-06-15', '2025-06-14', 0));
    }

    // ── Journées qui ne font pas 24 h — passages d'heure Europe/Paris ────────
    //
    // Le client s'est trompé ici (profile/profileStats.js, « hier » = now − 24 h,
    // corrigé par shiftDateKey). Le serveur passe par DateTime::diff, dont
    // `%a` a longtemps valu 0 entre deux minuits séparés de 23 h sur les
    // vieux PHP. Ces tests figent le comportement attendu quelle que soit la
    // version PHP de l'hébergeur.

    public function testSpringForwardDayStillCountsAsOneDay(): void
    {
        // Dimanche 29 mars 2026 : 02:00 CET → 03:00 CEST, journée de 23 h.
        // Dernière partie dimanche 12:00 Paris (10:00 UTC), rejoue lundi 30.
        $this->assertSame(5, personadle_compute_streak('2026-03-29 10:00:00', '2026-03-30', 'win', 4));
        $this->assertSame(5, personadle_global_streak('2026-03-29', '2026-03-30', 4));
    }

    public function testSpringForwardLastPlayedJustAfterMidnightParis(): void
    {
        // Dernière partie dimanche 29 mars 00:30 CET = samedi 28 mars 23:30 UTC —
        // c'est bien DIMANCHE en heure de Paris, donc lundi 30 suit.
        $this->assertSame(5, personadle_compute_streak('2026-03-28 23:30:00', '2026-03-30', 'win', 4));
    }

    public function testSpringForwardSkippedSundayBreaks(): void
    {
        // Dernière partie samedi 28 mars 23:30 Paris (22:30 UTC), rejoue lundi 30 :
        // le dimanche de 23 h a été sauté → 1, pas 5.
        $this->assertSame(1, personadle_compute_streak('2026-03-28 22:30:00', '2026-03-30', 'win', 4));
        $this->assertSame(1, personadle_global_streak('2026-03-28', '2026-03-30', 4));
    }

    public function testFallBackDayStillCountsAsOneDay(): void
    {
        // Dimanche 25 octobre 2026 : 03:00 CEST → 02:00 CET, journée de 25 h.
        $this->assertSame(5, personadle_compute_streak('2026-10-25 10:00:00', '2026-10-26', 'win', 4));
        $this->assertSame(5, personadle_global_streak('2026-10-25', '2026-10-26', 4));
        // Samedi 24 → dimanche 25 (le jour long) : +1 aussi.
        $this->assertSame(5, personadle_compute_streak('2026-10-24 16:00:00', '2026-10-25', 'win', 4));
    }

    public function testFallBackRepeatedHourIsStillSunday(): void
    {
        // 02:30 « la deuxième fois » (CET) = 01:30 UTC dimanche 25 → toujours
        // dimanche en heure de Paris ; rejouer le 25 = même jour → remise à 1
        // (règle par mode : une seule victoire compte par jour, cf.
        // testSameDayResetsToOne).
        $this->assertSame(1, personadle_compute_streak('2026-10-25 01:30:00', '2026-10-25', 'win', 4));
        // …et lundi 26 suit bien.
        $this->assertSame(5, personadle_compute_streak('2026-10-25 01:30:00', '2026-10-26', 'win', 4));
    }

    public function testYearBoundaryAndLeapDay(): void
    {
        // 31 décembre 23:50 Paris = 22:50 UTC → 1er janvier suit.
        $this->assertSame(31, personadle_compute_streak('2026-12-31 22:50:00', '2027-01-01', 'win', 30));
        $this->assertSame(31, personadle_global_streak('2026-12-31', '2027-01-01', 30));
        // 28 → 29 février 2028 (bissextile) → 1er mars : trois jours consécutifs.
        $this->assertSame(2, personadle_global_streak('2028-02-28', '2028-02-29', 1));
        $this->assertSame(3, personadle_global_streak('2028-02-29', '2028-03-01', 2));
        // 28 février → 1er mars en année non bissextile : consécutifs.
        $this->assertSame(2, personadle_global_streak('2027-02-28', '2027-03-01', 1));
    }

    public function testUtcMidnightIsNotParisMidnight(): void
    {
        // Été : 22:30 UTC le 10 juillet = 00:30 Paris le 11. Une partie datée du 11
        // (côté Paris) après une dernière partie datée « 2026-07-10 22:30 UTC »
        // est le MÊME jour Paris → 1, pas +1.
        $this->assertSame(1, personadle_compute_streak('2026-07-10 22:30:00', '2026-07-11', 'win', 3));
        // La même dernière partie suivie d'une victoire le 12 → lendemain → +1.
        $this->assertSame(4, personadle_compute_streak('2026-07-10 22:30:00', '2026-07-12', 'win', 3));
        // Hiver : 23:30 UTC le 10 janvier = 00:30 Paris le 11 → idem.
        $this->assertSame(1, personadle_compute_streak('2026-01-10 23:30:00', '2026-01-11', 'win', 3));
        $this->assertSame(4, personadle_compute_streak('2026-01-10 23:30:00', '2026-01-12', 'win', 3));
    }
}
