<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/condition_check.php';

/**
 * Tests d'intégration pour api/lib/condition_check.php — la vérification générique
 * de condition (condition_type/condition_mode/condition_value) partagée par
 * titles/badges/wallpapers depuis leur migration en colonnes structurées.
 *
 * Même pattern que DatabaseIntegrationTest.php : vraie base MariaDB (Docker),
 * chaque test dans une transaction annulée en tearDown, skip si base injoignable.
 */
final class ConditionCheckTest extends TestCase
{
    private static ?PDO $pdo = null;
    private static ?string $skipReason = null;

    public static function setUpBeforeClass(): void
    {
        if (!extension_loaded('pdo_mysql')) {
            self::$skipReason = 'extension pdo_mysql absente';
            return;
        }
        $host = getenv('DB_TEST_HOST') ?: '127.0.0.1';
        $port = getenv('DB_TEST_PORT') ?: '3307';
        $name = getenv('DB_TEST_NAME') ?: 'personadle_db';
        $user = getenv('DB_TEST_USER') ?: 'root';
        $pass = getenv('DB_TEST_PASS') ?: 'rootpassword';

        try {
            self::$pdo = new PDO(
                "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
                $user,
                $pass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]
            );
        } catch (Throwable $e) {
            self::$skipReason = "DB injoignable ($host:$port) — lance `make up`";
        }
    }

    protected function setUp(): void
    {
        if (self::$skipReason !== null) {
            $this->markTestSkipped(self::$skipReason);
        }
        self::$pdo->beginTransaction();
    }

    protected function tearDown(): void
    {
        if (self::$pdo !== null && self::$pdo->inTransaction()) {
            self::$pdo->rollBack();
        }
    }

    private function makeUser(string $suffix = ''): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        $code = strtoupper(substr($rnd, 0, 8) . 'TST');
        $stmt = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            "phpunit_cc_{$rnd}{$suffix}@test.local",
            "phpunit_cc_{$rnd}{$suffix}",
            'x',
            substr($code, 0, 8),
            'en',
        ]);
        return (int) self::$pdo->lastInsertId();
    }

    private function setStats(int $userId, string $mode, array $fields): void
    {
        $defaults = ['wins' => 0, 'giveups' => 0, 'games' => 0, 'streak' => 0, 'streak_record' => 0, 'perfect_wins' => 0];
        $fields = array_merge($defaults, $fields);
        $stmt = self::$pdo->prepare(
            'INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId, $mode, $fields['wins'], $fields['giveups'], $fields['games'],
            $fields['streak'], $fields['streak_record'], $fields['perfect_wins'],
        ]);
    }

    // ── Fallback safe (pas de condition définie) ──────────────────────────────

    public function testNullConditionTypeReturnsTrue(): void
    {
        $uid = $this->makeUser();
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, null, null, null));
    }

    public function testUnknownConditionTypeReturnsTrue(): void
    {
        $uid = $this->makeUser();
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'not_a_real_type', null, null));
    }

    public function testManualAndJokerProfileReturnTrue(): void
    {
        $uid = $this->makeUser();
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'manual', null, null));
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'joker_profile', null, null));
    }

    /**
     * Revue PR #14 : condition_value NULL sur un type numérique doit refuser
     * l'unlock (fail-closed), pas être traité comme un seuil 0 (= toujours vrai).
     * Un joueur avec 0 victoire ne doit jamais débloquer un badge wins_total mal
     * configuré (condition_value oublié en base).
     */
    public function testNullConditionValueFailsClosedForNumericTypes(): void
    {
        $uid = $this->makeUser();
        foreach (['wins_total', 'mode_wins', 'mode_games', 'games_total', 'streak_record',
                  'perfect_wins', 'unique_days', 'giveups_total', 'friends_count', 'badges_count'] as $type) {
            $this->assertFalse(
                personadle_verify_condition(self::$pdo, $uid, $type, 'classic', null),
                "condition_value NULL doit refuser pour condition_type=$type"
            );
        }
    }

    // ── wins_total / giveups_total / streak_record / perfect_wins ─────────────

    public function testWinsTotalSumsAcrossModes(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'classic', ['wins' => 3]);
        $this->setStats($uid, 'emoji', ['wins' => 4]);
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'wins_total', null, 8));
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'wins_total', null, 7));
    }

    public function testGiveupsTotalSumsAcrossModes(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'classic', ['giveups' => 6]);
        $this->setStats($uid, 'emoji', ['giveups' => 5]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'giveups_total', null, 10));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'giveups_total', null, 12));
    }

    public function testStreakRecordUsesMaxAcrossModes(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'classic', ['streak_record' => 12]);
        $this->setStats($uid, 'emoji', ['streak_record' => 30]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'streak_record', null, 30));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'streak_record', null, 31));
    }

    public function testPerfectWinsSumsAcrossModes(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'classic', ['perfect_wins' => 2]);
        $this->setStats($uid, 'music', ['perfect_wins' => 3]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'perfect_wins', null, 5));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'perfect_wins', null, 6));
    }

    // ── mode_wins / mode_games / games_total ──────────────────────────────────

    public function testModeWinsChecksSpecificMode(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'silhouette', ['wins' => 5]);
        $this->setStats($uid, 'classic', ['wins' => 100]); // ne doit pas compter
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', 'silhouette', 5));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', 'silhouette', 6));
    }

    public function testModeWinsWithoutModeReturnsFalse(): void
    {
        $uid = $this->makeUser();
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', null, 5));
    }

    public function testModeGamesCountsGamesNotWins(): void
    {
        $uid = $this->makeUser();
        // 30 parties mais seulement 2 victoires — mode_games ne regarde que `games`
        $this->setStats($uid, 'music', ['games' => 30, 'wins' => 2]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'mode_games', 'music', 30));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', 'music', 30));
    }

    public function testGamesTotalSumsAcrossModes(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'classic', ['games' => 40]);
        $this->setStats($uid, 'emoji', ['games' => 35]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'games_total', null, 75));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'games_total', null, 76));
    }

    // ── classic_p1_wins / emoji_p2_wins (alias de mode_wins) ──────────────────

    public function testClassicP1WinsAlias(): void
    {
        $uid = $this->makeUser();
        $this->setStats($uid, 'classic', ['wins' => 15]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'classic_p1_wins', null, 15));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'classic_p1_wins', null, 16));
    }

    // ── unique_days ────────────────────────────────────────────────────────────

    public function testUniqueDaysCountsDistinctPlayedDates(): void
    {
        $uid = $this->makeUser();
        $ins = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts)
             VALUES (?, ?, ?, "Joker", "win", 1)'
        );
        $ins->execute([$uid, 'classic', '2026-01-01']);
        $ins->execute([$uid, 'emoji', '2026-01-01']); // même jour, mode différent — ne compte qu'une fois
        $ins->execute([$uid, 'music', '2026-01-02']);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'unique_days', null, 2));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'unique_days', null, 3));
    }

    // ── friends_count ──────────────────────────────────────────────────────────

    public function testFriendsCountOnlyCountsAccepted(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        $u3 = $this->makeUser('c');
        self::$pdo->prepare(
            'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, "accepted")'
        )->execute([$u1, $u2]);
        self::$pdo->prepare(
            'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, "pending")'
        )->execute([$u1, $u3]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $u1, 'friends_count', null, 1));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $u1, 'friends_count', null, 2));
    }

    // ── badges_count ───────────────────────────────────────────────────────────

    public function testBadgesCountCountsUnlockedBadges(): void
    {
        $uid = $this->makeUser();
        self::$pdo->prepare('INSERT INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
            ->execute([$uid, 'first_win']);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'badges_count', null, 1));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'badges_count', null, 2));
    }

    // ── social_link_min_rank (remplace l'ancien social_link_rank_10, retiré car
    //    strictement équivalent à social_link_min_rank + condition_value=10, et
    //    aucune donnée de seed ne l'utilisait — voir docblock de condition_check.php) ──

    public function testSocialLinkMinRankDefaultsToRank10WhenValueIsNull(): void
    {
        // condition_value NULL sur ce type précis => seuil implicite 10 (équivalent de
        // l'ancien social_link_rank_10), documenté explicitement dans condition_check.php.
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        [$lo, $hi] = $u1 < $u2 ? [$u1, $u2] : [$u2, $u1];
        self::$pdo->prepare(
            'INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp) VALUES (?, ?, 8, 500)'
        )->execute([$lo, $hi]);
        $this->assertFalse(personadle_verify_condition(self::$pdo, $u1, 'social_link_min_rank', null, null));

        self::$pdo->prepare('UPDATE social_links SET `rank` = 10 WHERE user_a_id = ? AND user_b_id = ?')
            ->execute([$lo, $hi]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $u1, 'social_link_min_rank', null, null));
    }

    public function testRemovedSocialLinkRank10TypeFallsBackToTrue(): void
    {
        // 'social_link_rank_10' n'est plus un condition_type reconnu (retiré, voir
        // docblock) — doit tomber dans le safe-fallback "type inconnu", pas planter.
        $uid = $this->makeUser();
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'social_link_rank_10', null, null));
    }

    public function testSocialLinkMinRankUsesThreshold(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        [$lo, $hi] = $u1 < $u2 ? [$u1, $u2] : [$u2, $u1];
        self::$pdo->prepare(
            'INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp) VALUES (?, ?, 5, 200)'
        )->execute([$lo, $hi]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $u1, 'social_link_min_rank', null, 5));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $u1, 'social_link_min_rank', null, 6));
    }

    // ── all_modes_won ──────────────────────────────────────────────────────────

    public function testAllModesWonRequiresAllSixModes(): void
    {
        $uid = $this->makeUser();
        foreach (['classic', 'emoji', 'silhouette', 'alloutattack', 'personae'] as $mode) {
            $this->setStats($uid, $mode, ['wins' => 1]);
        }
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'all_modes_won', null, null));
        $this->setStats($uid, 'music', ['wins' => 1]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'all_modes_won', null, null));
    }

    // ── weekly_clean_modes ─────────────────────────────────────────────────────

    public function testWeeklyCleanModesCountsRecentDistinctModes(): void
    {
        $uid = $this->makeUser();
        $today = (new DateTime())->format('Y-m-d');
        $old = (new DateTime('-30 days'))->format('Y-m-d');
        $ins = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts)
             VALUES (?, ?, ?, "Joker", "win", 1)'
        );
        $ins->execute([$uid, 'classic', $today]);
        $ins->execute([$uid, 'emoji', $today]);
        $ins->execute([$uid, 'music', $old]); // hors fenêtre 7 jours — ne doit pas compter
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'weekly_clean_modes', null, 2));
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'weekly_clean_modes', null, 3));
    }
}
