<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/outliers.php';

/**
 * Comptes hors norme (api/lib/outliers.php) — 2.4, lot 16. La décision est pure :
 * on vérifie chaque signal à son seuil, et qu'un joueur ordinaire n'en lève aucun.
 */
final class OutliersTest extends TestCase
{
    private const NORMAL = ['total' => 90, 'daily' => 60, 'daily_wins' => 50, 'daily_perfect' => 8, 'wins' => 70, 'fast_wins' => 5];

    public function testAnOrdinaryPlayerRaisesNothing(): void
    {
        $this->assertSame([], personadle_outlier_flags(self::NORMAL));
    }

    public function testReplayFarmingNeedsBothRatioAndVolume(): void
    {
        $this->assertSame(['replay_farming'], personadle_outlier_flags(['total' => 60, 'daily' => 15] + self::NORMAL));
        $this->assertSame([], personadle_outlier_flags(['total' => 59, 'daily' => 5, 'daily_wins' => 4, 'daily_perfect' => 0] + self::NORMAL), 'pas assez de parties');
        $this->assertSame([], personadle_outlier_flags(['total' => 120, 'daily' => 31, 'daily_wins' => 20] + self::NORMAL), 'moins de 4 parties par partie du jour');
    }

    public function testPerfectRateOnDailyGames(): void
    {
        $this->assertContains('perfect_rate', personadle_outlier_flags(['daily' => 20, 'daily_wins' => 15, 'daily_perfect' => 12] + self::NORMAL));
        $this->assertNotContains('perfect_rate', personadle_outlier_flags(['daily' => 20, 'daily_wins' => 15, 'daily_perfect' => 11] + self::NORMAL));
        $this->assertNotContains('perfect_rate', personadle_outlier_flags(['daily' => 19, 'daily_wins' => 19, 'daily_perfect' => 19] + self::NORMAL), 'trop peu de parties du jour');
    }

    public function testNearlyNeverGivingUp(): void
    {
        $this->assertContains('win_rate', personadle_outlier_flags(['daily' => 50, 'daily_wins' => 49] + self::NORMAL));
        $this->assertNotContains('win_rate', personadle_outlier_flags(['daily' => 50, 'daily_wins' => 48] + self::NORMAL));
    }

    public function testLightningWins(): void
    {
        $this->assertContains('fast_wins', personadle_outlier_flags(['wins' => 20, 'fast_wins' => 10] + self::NORMAL));
        $this->assertNotContains('fast_wins', personadle_outlier_flags(['wins' => 19, 'fast_wins' => 19] + self::NORMAL), 'trop peu de victoires');
    }

    public function testNoDivisionByZero(): void
    {
        $this->assertSame([], personadle_outlier_flags(['total' => 0, 'daily' => 0, 'daily_wins' => 0, 'daily_perfect' => 0, 'wins' => 0, 'fast_wins' => 0]));
    }
}
