<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/leaderboard_metrics.php';

/**
 * Tests des formules de classement (api/lib/leaderboard_metrics.php).
 *
 * Ce que ce fichier protège, et pourquoi ça n'allait pas de soi :
 *
 *   1. **Le ratio doit récompenser le volume.** L'ancienne formule était un seuil
 *      brut (`IF(games >= 5, wins/games, NULL)`) : un joueur à 5/5 finissait devant
 *      un joueur à 200/210. La moyenne bayésienne corrige ça sans jamais donner de
 *      points pour le volume seul — jouer plus ne monte le ratio que si on gagne.
 *
 *   2. **Une série se compte en JOURS CONSÉCUTIFS.** Sur une période, l'ancien code
 *      renvoyait le nombre de victoires en guise de série : 20 parties dans la même
 *      journée affichaient « série : 20 ». La colonne annonçait une métrique et en
 *      montrait une autre.
 *
 *   3. **Le cron et l'endpoint partagent ces fonctions.** Ils recopiaient les mêmes
 *      expressions SQL des deux côtés, avec un commentaire pour tout garde-fou. Une
 *      divergence ne se serait vue qu'en comparant deux périodes entre elles.
 *
 * Même pattern que les autres tests d'intégration : vraie MariaDB, transaction
 * annulée en tearDown, skip propre si la base est absente.
 */
final class LeaderboardMetricsTest extends TestCase
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

    private function makeUser(string $suffix): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
             VALUES (?, ?, ?, ?, ?)'
        )->execute([
            "phpunit_lb_{$rnd}{$suffix}@test.local",
            "lb_{$rnd}{$suffix}",
            'x',
            strtoupper(substr($rnd . 'LB', 0, 8)),
            'en',
        ]);
        return (int) self::$pdo->lastInsertId();
    }

    /** Enregistre $count parties le jour J-$daysAgo, dont $wins victoires. */
    private function sessions(int $userId, int $count, int $wins, int $daysAgo = 0): void
    {
        $ins = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, is_expert, played_date, target_name, result, attempts)
             VALUES (?, "classic", 0, DATE_SUB(CURRENT_DATE, INTERVAL ? DAY), "X", ?, 1)'
        );
        for ($i = 0; $i < $count; $i++) {
            $ins->execute([$userId, $daysAgo, $i < $wins ? 'win' : 'giveup']);
        }
    }

    /** Évalue une expression SQL de ratio pour un couple (victoires, parties) donné. */
    private function ratio(int $wins, int $games, float $prior = 0.5): float
    {
        $expr = personadle_ratio_expr((string) $wins, (string) $games, $prior);
        return (float) self::$pdo->query("SELECT {$expr}")->fetchColumn();
    }

    // ── Ratio lissé ───────────────────────────────────────────────────────────

    public function testSmallSampleIsPulledTowardTheAverage(): void
    {
        // Le cas qui motivait tout : 1 victoire sur 1 partie valait 100 %.
        $this->assertSame(100.0, round(1 / 1 * 100, 1), 'le ratio brut valait bien 100 %');
        $this->assertLessThan(60.0, $this->ratio(1, 1), 'le ratio lissé doit rester proche de la moyenne');
    }

    public function testHighVolumeBeatsAPerfectButTinySample(): void
    {
        // Le classement doit désormais placer le joueur régulier devant.
        $petit = $this->ratio(1, 1);      // 100 % brut
        $gros  = $this->ratio(190, 200);  // 95 % brut
        $this->assertGreaterThan($petit, $gros);
    }

    public function testMoreGamesConvergesTowardTheTrueRate(): void
    {
        // Même taux réel (90 %), volumes croissants : le score doit s'en approcher.
        $r10   = $this->ratio(9, 10);
        $r100  = $this->ratio(90, 100);
        $r1000 = $this->ratio(900, 1000);

        $this->assertLessThan($r100, $r10);
        $this->assertLessThan($r1000, $r100);
        $this->assertEqualsWithDelta(90.0, $r1000, 1.0, 'à fort volume, le lissage devient négligeable');
    }

    public function testVolumeAloneNeverRaisesTheRatio(): void
    {
        // Garde-fou anti-contresens : « pousser au volume » ne doit pas vouloir
        // dire « récompenser le volume ». Jouer plus en perdant fait BAISSER le
        // ratio — sinon la métrique récompenserait le fait de jouer, pas de gagner.
        $avant = $this->ratio(10, 20);
        $apres = $this->ratio(10, 100); // 80 parties de plus, aucune victoire
        $this->assertLessThan($avant, $apres);
    }

    public function testRatioStaysWithinPercentBounds(): void
    {
        // `leaderboard_cache.score` est un DECIMAL(8,1) : un débordement tronquerait.
        $this->assertGreaterThanOrEqual(0.0, $this->ratio(0, 500));
        $this->assertLessThanOrEqual(100.0, $this->ratio(500, 500));
    }

    public function testRatioExpressionIsLocaleProof(): void
    {
        // Le prior est injecté dans du SQL : un séparateur décimal « , » (locale
        // FR) produirait une requête invalide. %F garantit le point.
        $expr = personadle_ratio_expr('1', '1', 0.123456);
        $this->assertStringContainsString('0.123456', $expr);
        $this->assertStringNotContainsString(',5', $expr);
    }

    // ── Moyenne du site (le « m » de la formule) ───────────────────────────────

    public function testPriorFallsBackWhenThereIsNoData(): void
    {
        // Base neuve : sans repli, la formule diviserait par zéro et le classement
        // entier disparaîtrait. On interroge un mode qui n'existe pas.
        $this->assertSame(0.5, personadle_leaderboard_prior(self::$pdo, 'mode_inexistant'));
    }

    public function testPriorIsClampedAwayFromZeroAndOne(): void
    {
        // Un taux à 0 ou 1 rendrait le lissage inopérant dans un sens ou l'autre.
        $p = personadle_leaderboard_prior(self::$pdo, 'all');
        $this->assertGreaterThanOrEqual(0.01, $p);
        $this->assertLessThanOrEqual(0.99, $p);
    }

    // ── Expressions par métrique ──────────────────────────────────────────────

    public function testEverStreakUsesTheGlobalRecordForAllModes(): void
    {
        // La streak du joueur est GLOBALE (CLAUDE.md §7). `MAX(us.streak_record)`
        // renvoyait le meilleur record d'UN mode — toujours ≤ la vraie série, et
        // incohérent avec ce que le joueur lit sur son profil.
        $expr = personadle_ever_score_expr('streak', 'all', 0.5);
        $this->assertStringContainsString('global_streak_record', $expr);

        // Par mode en revanche, c'est bien le record de ce mode qui fait foi.
        $this->assertSame('us.streak_record', personadle_ever_score_expr('streak', 'classic', 0.5));
    }

    public function testPeriodStreakHasNoAggregateExpression(): void
    {
        // null = « cette métrique a sa propre requête ». C'est ce qui empêche de
        // retomber dans l'ancien piège : renvoyer une agrégation quelconque
        // (le nombre de victoires) en la faisant passer pour une série.
        $this->assertNull(personadle_period_score_expr('streak', 0.5));
    }

    public function testUnknownMetricIsRejectedByBothBuilders(): void
    {
        $this->assertNull(personadle_period_score_expr('metrique_inventee', 0.5));
        $this->assertNull(personadle_ever_score_expr('metrique_inventee', 'all', 0.5));
    }

    // ── Vraie série : jours consécutifs ───────────────────────────────────────

    /** Exécute la requête de série de production et renvoie le score d'un joueur. */
    private function streakOf(int $userId): ?int
    {
        $sql  = personadle_period_streak_scores_sql('', '', '?');
        $stmt = self::$pdo->prepare($sql);
        $stmt->execute([(new DateTime('-60 days'))->format('Y-m-d')]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if ((int) $r['user_id'] === $userId) return (int) $r['score'];
        }
        return null;
    }

    public function testStreakCountsConsecutiveDays(): void
    {
        $uid = $this->makeUser('a');
        foreach ([4, 3, 2, 1, 0] as $d) $this->sessions($uid, 1, 1, $d);
        $this->assertSame(5, $this->streakOf($uid));
    }

    public function testManyGamesInOneDayAreStillASingleDay(): void
    {
        // LE bug corrigé : 20 parties le même jour affichaient « série : 20 ».
        // Depuis la migration 032 plusieurs parties par jour sont enregistrées,
        // donc sans dédoublonnage des dates chacune comptait pour une journée.
        $uid = $this->makeUser('b');
        $this->sessions($uid, 20, 20, 0);
        $this->assertSame(1, $this->streakOf($uid));
    }

    public function testStreakKeepsTheLongestRunNotTheLatest(): void
    {
        // 3 jours, un trou, puis 2 jours → la série est 3, pas 2 ni 5.
        $uid = $this->makeUser('c');
        foreach ([6, 5, 4] as $d) $this->sessions($uid, 1, 1, $d);
        foreach ([1, 0] as $d) $this->sessions($uid, 1, 1, $d);
        $this->assertSame(3, $this->streakOf($uid));
    }

    public function testStreakCountsDaysPlayedNotDaysWon(): void
    {
        // Une série mesure la RÉGULARITÉ : le joueur qui revient chaque jour et
        // perd garde sa série. Le ratio est là pour juger la réussite.
        $uid = $this->makeUser('d');
        foreach ([2, 1, 0] as $d) $this->sessions($uid, 1, 0, $d); // 3 abandons
        $this->assertSame(3, $this->streakOf($uid));
    }

    public function testExpertGamesDoNotFeedTheNormalStreak(): void
    {
        // Le classement Expert est une dimension à part (ROADMAP v2.1).
        $uid = $this->makeUser('e');
        $this->sessions($uid, 1, 1, 0);
        self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, is_expert, played_date, target_name, result, attempts)
             VALUES (?, "classic", 1, DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY), "X", "win", 1)'
        )->execute([$uid]);

        // Sans l'exclusion Expert, la veille compterait et la série vaudrait 2.
        $this->assertSame(1, $this->streakOf($uid));
    }
}
