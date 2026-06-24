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
}
