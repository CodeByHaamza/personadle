<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/expert_unlocks.php';

/**
 * Tests d'intégration pour api/lib/expert_unlocks.php et les trois fonctions de
 * comptage qu'il pilote dans condition_check.php — la porte d'entrée des 6 Modes
 * Expert.
 *
 * Pourquoi ce fichier existe : jusqu'ici ConditionCheckTest ne vérifiait que la
 * PRÉSENCE de `mode_wins_under_attempts`, `mode_wins_single_day` et
 * `mode_consecutive_perfects` dans personadle_known_condition_types(). Leur
 * comportement de comptage — et le seuil qu'elles gardent — n'était validé qu'à la
 * main via curl (CLAUDE.md §13). Un seuil qui dérive ou un `is_expert = 0` oublié
 * ouvrirait le Mode Expert à tout le monde sans qu'aucun test ne rougisse.
 *
 * Même pattern que ConditionCheckTest.php : vraie base MariaDB (Docker), chaque
 * test dans une transaction annulée en tearDown, skip si base injoignable.
 */
final class ExpertUnlocksTest extends TestCase
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
        $stmt = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            "phpunit_eu_{$rnd}{$suffix}@test.local",
            "phpunit_eu_{$rnd}{$suffix}",
            'x',
            strtoupper(substr($rnd . 'EU', 0, 8)),
            'en',
        ]);
        return (int) self::$pdo->lastInsertId();
    }

    /**
     * Enregistre une partie. `played_date` est un décalage en jours par rapport à
     * aujourd'hui (0 = aujourd'hui), pour que les tests ne dépendent pas de la date
     * réelle d'exécution.
     */
    private function session(
        int $userId,
        string $mode,
        int $attempts,
        string $result = 'win',
        int $daysAgo = 0,
        int $isExpert = 0
    ): void {
        $date = (new DateTime("-{$daysAgo} days"))->format('Y-m-d');
        self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, is_expert, played_date, target_name, result, attempts)
             VALUES (?, ?, ?, ?, "Joker", ?, ?)'
        )->execute([$userId, $mode, $isExpert, $date, $result, $attempts]);
    }

    // ── mode_wins_under_attempts (Classique, Silhouette — 10 victoires en ≤ 4) ────

    public function testWinsUnderAttemptsCountsOnlyFastWins(): void
    {
        $uid = $this->makeUser();
        $this->session($uid, 'classic', 1);   // ✓
        $this->session($uid, 'classic', 4);   // ✓ borne incluse
        $this->session($uid, 'classic', 5);   // ✗ un essai de trop
        $this->assertSame(2, personadle_count_wins_under_attempts(self::$pdo, $uid, 'classic'));
    }

    public function testWinsUnderAttemptsIgnoresGiveups(): void
    {
        // Un abandon en 2 essais n'est pas une victoire rapide — c'est un abandon.
        $uid = $this->makeUser();
        $this->session($uid, 'classic', 2, 'win');
        $this->session($uid, 'classic', 2, 'giveup');
        $this->assertSame(1, personadle_count_wins_under_attempts(self::$pdo, $uid, 'classic'));
    }

    public function testWinsUnderAttemptsExcludesExpertGames(): void
    {
        // Le cœur du gate : la condition mesure la maîtrise du mode NORMAL. Compter
        // les parties Expert rendrait la porte auto-débloquante une fois franchie.
        $uid = $this->makeUser();
        $this->session($uid, 'classic', 1, 'win', 0, 1); // Expert — ne compte pas
        $this->session($uid, 'classic', 1, 'win', 0, 0);
        $this->assertSame(1, personadle_count_wins_under_attempts(self::$pdo, $uid, 'classic'));
    }

    public function testWinsUnderAttemptsIsolatesModes(): void
    {
        $uid = $this->makeUser();
        $this->session($uid, 'classic', 1);
        $this->session($uid, 'silhouette', 1);
        $this->assertSame(1, personadle_count_wins_under_attempts(self::$pdo, $uid, 'classic'));
        $this->assertSame(1, personadle_count_wins_under_attempts(self::$pdo, $uid, 'silhouette'));
        $this->assertSame(0, personadle_count_wins_under_attempts(self::$pdo, $uid, 'music'));
    }

    public function testWinsUnderAttemptsIsolatesUsers(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        $this->session($u1, 'classic', 1);
        $this->assertSame(0, personadle_count_wins_under_attempts(self::$pdo, $u2, 'classic'));
    }

    public function testFastWinThresholdIsFourAttempts(): void
    {
        // Verrouille le seuil documenté (« 4 essais ou moins ») contre une dérive
        // silencieuse : le front affiche cette règle au joueur dans l'infobulle.
        $this->assertSame(4, PERSONADLE_FAST_WIN_MAX_ATTEMPTS);
    }

    // ── mode_wins_single_day (Émoji — 10 victoires sur une seule journée) ─────────

    public function testBestSingleDayWinsTakesTheBestDayNotToday(): void
    {
        // Un déblocage est définitif : la meilleure journée de la vie du compte
        // compte, pas la journée en cours — sinon le joueur reperdrait l'accès
        // au Mode Expert à minuit.
        $uid = $this->makeUser();
        for ($i = 0; $i < 3; $i++) {
            $this->session($uid, 'emoji', 1, 'win', 10); // vieille journée à 3 victoires
        }
        $this->session($uid, 'emoji', 1, 'win', 0);      // aujourd'hui : 1 seule
        $this->assertSame(3, personadle_count_best_single_day_wins(self::$pdo, $uid, 'emoji'));
    }

    public function testBestSingleDayWinsIgnoresGiveupsAndExpert(): void
    {
        $uid = $this->makeUser();
        $this->session($uid, 'emoji', 1, 'win', 0);
        $this->session($uid, 'emoji', 3, 'giveup', 0);   // pas une victoire
        $this->session($uid, 'emoji', 1, 'win', 0, 1);   // Expert
        $this->assertSame(1, personadle_count_best_single_day_wins(self::$pdo, $uid, 'emoji'));
    }

    public function testBestSingleDayWinsCountsEveryGameNotOnePerDay(): void
    {
        // Depuis la migration 032 plusieurs parties du même jour sont enregistrées :
        // la condition Émoji n'aurait aucun sens sinon (10 en une journée serait
        // impossible avec l'ancien plafond d'une session par jour).
        $uid = $this->makeUser();
        for ($i = 0; $i < 10; $i++) {
            $this->session($uid, 'emoji', 2, 'win', 0);
        }
        $this->assertSame(10, personadle_count_best_single_day_wins(self::$pdo, $uid, 'emoji'));
    }

    public function testBestSingleDayWinsIsZeroWithoutAnyGame(): void
    {
        // COALESCE(MAX(...), 0) : aucune ligne ne doit pas renvoyer NULL.
        $uid = $this->makeUser();
        $this->assertSame(0, personadle_count_best_single_day_wins(self::$pdo, $uid, 'emoji'));
    }

    // ── mode_consecutive_perfects (AOA, Personae, Musique — 15 parfaites d'affilée) ─

    public function testConsecutivePerfectsCountsCurrentStreak(): void
    {
        $uid = $this->makeUser();
        $this->session($uid, 'music', 1, 'win', 3);
        $this->session($uid, 'music', 1, 'win', 2);
        $this->session($uid, 'music', 1, 'win', 1);
        $this->assertSame(3, personadle_count_consecutive_perfects(self::$pdo, $uid, 'music'));
    }

    public function testConsecutivePerfectsBreaksOnImperfectWin(): void
    {
        // Une victoire en 2 essais casse la série : « parfaite » = 1 seul essai.
        $uid = $this->makeUser();
        $this->session($uid, 'music', 1, 'win', 4);
        $this->session($uid, 'music', 2, 'win', 3); // casse ici
        $this->session($uid, 'music', 1, 'win', 2);
        $this->session($uid, 'music', 1, 'win', 1);
        $this->assertSame(2, personadle_count_consecutive_perfects(self::$pdo, $uid, 'music'));
    }

    public function testConsecutivePerfectsBreaksOnGiveup(): void
    {
        $uid = $this->makeUser();
        $this->session($uid, 'music', 1, 'win', 3);
        $this->session($uid, 'music', 1, 'giveup', 2); // 1 essai mais abandon
        $this->session($uid, 'music', 1, 'win', 1);
        $this->assertSame(1, personadle_count_consecutive_perfects(self::$pdo, $uid, 'music'));
    }

    public function testConsecutivePerfectsSurvivesSkippedDays(): void
    {
        // « Consécutif » se compte en PARTIES, pas en jours : ne pas jouer pendant
        // un mois ne casse pas la série. C'est la streak qui mesure la régularité.
        $uid = $this->makeUser();
        $this->session($uid, 'personae', 1, 'win', 90);
        $this->session($uid, 'personae', 1, 'win', 0);
        $this->assertSame(2, personadle_count_consecutive_perfects(self::$pdo, $uid, 'personae'));
    }

    public function testConsecutivePerfectsIgnoresExpertGames(): void
    {
        // Une partie Expert au milieu ne doit ni compter, ni casser la série du
        // mode normal : elle est simplement invisible pour cette condition.
        $uid = $this->makeUser();
        $this->session($uid, 'personae', 1, 'win', 2, 0);
        $this->session($uid, 'personae', 5, 'giveup', 1, 1); // Expert, ignorée
        $this->session($uid, 'personae', 1, 'win', 0, 0);
        $this->assertSame(2, personadle_count_consecutive_perfects(self::$pdo, $uid, 'personae'));
    }

    public function testConsecutivePerfectsOrdersWithinTheSameDay(): void
    {
        // Plusieurs parties le même jour : le départage se fait sur `id DESC`, donc
        // sur l'ordre d'insertion. Une partie ratée jouée en DERNIER doit remettre
        // le compteur à zéro, même si des parfaites la précèdent le même jour.
        $uid = $this->makeUser();
        $this->session($uid, 'alloutattack', 1, 'win', 0);
        $this->session($uid, 'alloutattack', 1, 'win', 0);
        $this->session($uid, 'alloutattack', 3, 'win', 0); // la plus récente
        $this->assertSame(0, personadle_count_consecutive_perfects(self::$pdo, $uid, 'alloutattack'));
    }

    // ── personadle_expert_conditions / progress / is_unlocked ─────────────────────

    public function testTheSixModesEachHaveAKnownCondition(): void
    {
        // Un mode absent de cette table serait ouvert à tous (fallback 'none' de
        // personadle_expert_progress), et un type inconnu renverrait toujours 0 —
        // porte fermée pour toujours. Les deux dérives sont silencieuses.
        $conditions = personadle_expert_conditions();
        $known = personadle_known_condition_types();

        $this->assertSame(
            ['classic', 'silhouette', 'emoji', 'alloutattack', 'personae', 'music'],
            array_keys($conditions)
        );
        foreach ($conditions as $mode => $cond) {
            $this->assertContains($cond['type'], $known, "condition_type inconnu pour '$mode'");
            $this->assertGreaterThan(0, $cond['value'], "seuil nul ou négatif pour '$mode'");
        }
    }

    public function testProgressUnlocksAtTheExactThreshold(): void
    {
        $uid = $this->makeUser();
        $required = personadle_expert_conditions()['classic']['value'];

        for ($i = 0; $i < $required - 1; $i++) {
            $this->session($uid, 'classic', 2);
        }
        $p = personadle_expert_progress(self::$pdo, $uid, 'classic');
        $this->assertFalse($p['unlocked'], 'un cran sous le seuil doit rester verrouillé');
        $this->assertSame($required - 1, $p['current']);
        $this->assertSame($required, $p['required']);
        $this->assertSame('mode_wins_under_attempts', $p['condition_type']);

        $this->session($uid, 'classic', 2); // la partie qui franchit le seuil
        $this->assertTrue(personadle_expert_progress(self::$pdo, $uid, 'classic')['unlocked']);
    }

    public function testProgressIsFailClosedForAFreshAccount(): void
    {
        // Un compte neuf n'a accès à aucun des 6 modes Expert.
        $uid = $this->makeUser();
        foreach (array_keys(personadle_expert_conditions()) as $mode) {
            $this->assertFalse(
                personadle_is_expert_unlocked(self::$pdo, $uid, $mode),
                "le mode '$mode' ne doit pas être ouvert par défaut"
            );
        }
    }

    public function testProgressIsolatesModesFromEachOther(): void
    {
        // Débloquer Classique ne doit pas ouvrir Silhouette, qui partage pourtant
        // le même condition_type et le même seuil.
        $uid = $this->makeUser();
        for ($i = 0; $i < personadle_expert_conditions()['classic']['value']; $i++) {
            $this->session($uid, 'classic', 1);
        }
        $this->assertTrue(personadle_is_expert_unlocked(self::$pdo, $uid, 'classic'));
        $this->assertFalse(personadle_is_expert_unlocked(self::$pdo, $uid, 'silhouette'));
    }

    public function testUnknownModeIsOpenRatherThanLockedForever(): void
    {
        // Choix assumé (docblock de expert_unlocks.php) : un 7e mode livré sans
        // porte doit être jouable, pas bloqué sans recours.
        $uid = $this->makeUser();
        $p = personadle_expert_progress(self::$pdo, $uid, 'un_mode_qui_nexiste_pas');
        $this->assertTrue($p['unlocked']);
        $this->assertSame('none', $p['condition_type']);
    }

    public function testProgressNeverLeaksALabel(): void
    {
        // Le serveur ne renvoie que des types et des nombres : tout libellé rendu
        // ici serait en anglais pour les 6 langues du jeu.
        $uid = $this->makeUser();
        $p = personadle_expert_progress(self::$pdo, $uid, 'music');
        $this->assertSame(
            ['unlocked', 'condition_type', 'required', 'current', 'granted'],
            array_keys($p)
        );
        $this->assertIsBool($p['unlocked']);
        $this->assertIsBool($p['granted']);
        $this->assertIsInt($p['required']);
        $this->assertIsInt($p['current']);
    }

    // ── Déblocage manuel par un admin (migration 035) ─────────────────────────

    private function grant(int $userId, string $mode, ?int $adminId = null): void
    {
        self::$pdo->prepare(
            'INSERT INTO expert_unlocks_granted (user_id, mode, granted_by) VALUES (?, ?, ?)'
        )->execute([$userId, $mode, $adminId]);
    }

    public function testGrantUnlocksAModeWithoutAnyGame(): void
    {
        $uid = $this->makeUser();
        $this->assertFalse(personadle_is_expert_unlocked(self::$pdo, $uid, 'music'));

        $this->grant($uid, 'music');
        $this->assertTrue(personadle_is_expert_unlocked(self::$pdo, $uid, 'music'));
    }

    public function testGrantDoesNotInflateTheDisplayedProgress(): void
    {
        // Le joueur doit voir « 0/15 » et un accès ouvert, pas un faux « 15/15 » :
        // la progression mesure ce qu'il a joué, le don est un autre chemin.
        $uid = $this->makeUser();
        $this->grant($uid, 'music');

        $p = personadle_expert_progress(self::$pdo, $uid, 'music');
        $this->assertTrue($p['unlocked']);
        $this->assertTrue($p['granted']);
        $this->assertSame(0, $p['current']);
        $this->assertGreaterThan(0, $p['required']);
    }

    public function testGrantIsScopedToOneModeAndOneUser(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        $this->grant($u1, 'music');

        $this->assertTrue(personadle_is_expert_unlocked(self::$pdo, $u1, 'music'));
        $this->assertFalse(personadle_is_expert_unlocked(self::$pdo, $u1, 'personae'));
        $this->assertFalse(personadle_is_expert_unlocked(self::$pdo, $u2, 'music'));
    }

    public function testEarnedUnlockIsNotReportedAsGranted(): void
    {
        // `granted` sert au front à masquer la barre de progression : un joueur
        // qui a gagné son accès ne doit pas être étiqueté « offert ».
        $uid = $this->makeUser();
        for ($i = 0; $i < personadle_expert_conditions()['classic']['value']; $i++) {
            $this->session($uid, 'classic', 1);
        }
        $p = personadle_expert_progress(self::$pdo, $uid, 'classic');
        $this->assertTrue($p['unlocked']);
        $this->assertFalse($p['granted']);
    }

    public function testRevokingAGrantDoesNotRemoveAnEarnedUnlock(): void
    {
        // Le don est un OU, pas un remplacement : retirer la ligne ne doit pas
        // reprendre un accès que le joueur a gagné par ailleurs.
        $uid = $this->makeUser();
        $this->grant($uid, 'classic');
        for ($i = 0; $i < personadle_expert_conditions()['classic']['value']; $i++) {
            $this->session($uid, 'classic', 1);
        }
        self::$pdo->prepare('DELETE FROM expert_unlocks_granted WHERE user_id = ? AND mode = ?')
            ->execute([$uid, 'classic']);

        $this->assertTrue(personadle_is_expert_unlocked(self::$pdo, $uid, 'classic'));
    }

    public function testGrantingTwiceIsRejectedByTheUniqueKey(): void
    {
        // C'est cette contrainte qui rend l'endpoint admin idempotent : il peut
        // se contenter d'un INSERT IGNORE sans lire d'abord.
        $uid = $this->makeUser();
        $this->grant($uid, 'music');

        $this->expectException(PDOException::class);
        $this->grant($uid, 'music');
    }
}
