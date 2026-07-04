<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/social_link.php';

/**
 * Tests de la logique de Social Link (api/lib/social_link.php).
 * Aucun accès base de données — fonctions pures.
 */
final class SocialLinkTest extends TestCase
{
    // ── personadle_sl_xp_for_action ─────────────────────────────────────────

    public function testSoloXpMatchesSpecForEveryAction(): void
    {
        $this->assertSame(15, personadle_sl_xp_for_action('share_streak', false));
        $this->assertSame(10, personadle_sl_xp_for_action('share_score', false));
        $this->assertSame(5, personadle_sl_xp_for_action('visit_profile', false));
        $this->assertSame(20, personadle_sl_xp_for_action('play_same_day', false));
        $this->assertSame(10, personadle_sl_xp_for_action('compare_stats', false));
        $this->assertSame(15, personadle_sl_xp_for_action('challenge', false));
    }

    public function testMutualXpMatchesSpecForEveryAction(): void
    {
        $this->assertSame(30, personadle_sl_xp_for_action('share_streak', true));
        $this->assertSame(20, personadle_sl_xp_for_action('share_score', true));
        $this->assertSame(10, personadle_sl_xp_for_action('visit_profile', true));
        $this->assertSame(20, personadle_sl_xp_for_action('play_same_day', true));
        $this->assertSame(20, personadle_sl_xp_for_action('compare_stats', true));
        $this->assertSame(35, personadle_sl_xp_for_action('challenge', true));
    }

    public function testMutualXpIsAlwaysGreaterOrEqualToSolo(): void
    {
        foreach (array_keys(PERSONADLE_SL_XP_TABLE) as $action) {
            $solo   = personadle_sl_xp_for_action($action, false);
            $mutual = personadle_sl_xp_for_action($action, true);
            $this->assertGreaterThanOrEqual($solo, $mutual, "mutual < solo for {$action}");
        }
    }

    public function testUnknownActionTypeThrows(): void
    {
        $this->expectException(InvalidArgumentException::class);
        personadle_sl_xp_for_action('not_a_real_action', false);
    }

    // ── personadle_sl_rank_for_xp ────────────────────────────────────────────

    /** Seuils réels — doivent rester synchronisés avec sql/bdd_mysql.sql (social_link_ranks). */
    private function ranks(): array
    {
        return [
            1 => 0, 2 => 100, 3 => 250, 4 => 450, 5 => 700,
            6 => 1000, 7 => 1350, 8 => 1750, 9 => 2200, 10 => 2700,
        ];
    }

    public function testZeroXpIsRankOne(): void
    {
        $result = personadle_sl_rank_for_xp(0, $this->ranks());
        $this->assertSame(1, $result['rank']);
        $this->assertSame(0, $result['xp_current_rank']);
        $this->assertSame(100, $result['xp_next_rank']);
    }

    public function testXpJustBelowThresholdStaysAtLowerRank(): void
    {
        $result = personadle_sl_rank_for_xp(99, $this->ranks());
        $this->assertSame(1, $result['rank']);
    }

    public function testXpAtThresholdRanksUp(): void
    {
        $result = personadle_sl_rank_for_xp(100, $this->ranks());
        $this->assertSame(2, $result['rank']);
        $this->assertSame(100, $result['xp_current_rank']);
        $this->assertSame(250, $result['xp_next_rank']);
    }

    public function testExactRank10ThresholdIsMaxRank(): void
    {
        $result = personadle_sl_rank_for_xp(2700, $this->ranks());
        $this->assertSame(10, $result['rank']);
        $this->assertNull($result['xp_next_rank']);
    }

    public function testXpBeyondMaxRankStaysClampedAtMaxRank(): void
    {
        $result = personadle_sl_rank_for_xp(999999, $this->ranks());
        $this->assertSame(10, $result['rank']);
        $this->assertNull($result['xp_next_rank']);
    }

    public function testEmptyThresholdsThrows(): void
    {
        $this->expectException(InvalidArgumentException::class);
        personadle_sl_rank_for_xp(100, []);
    }

    public function testThresholdOrderInArrayDoesNotMatter(): void
    {
        // Table volontairement dans le désordre — la fonction doit ksort() en interne.
        $shuffled = [3 => 250, 1 => 0, 2 => 100];
        $result   = personadle_sl_rank_for_xp(150, $shuffled);
        $this->assertSame(2, $result['rank']);
    }
}
