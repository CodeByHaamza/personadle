<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/game_session.php';
require_once __DIR__ . '/../../api/lib/streak_recovery.php';
require_once __DIR__ . '/../../api/lib/social_link_interaction.php';
require_once __DIR__ . '/../../api/lib/error_log.php';
require_once __DIR__ . '/../../api/lib/admin_audit.php';
require_once __DIR__ . '/../../api/lib/deletion_requests.php';

/**
 * Tests d'INTÉGRATION sur la vraie base MariaDB (Docker).
 *
 * Vérifie les contraintes/comportements SQL critiques que les tests de logique
 * pure ne couvrent pas : unicité, CHECK, FK cascade, anti-doublon des sessions.
 *
 * - Se connecte au conteneur Docker (127.0.0.1:3307 par défaut, surchargeable
 *   par variables d'env DB_TEST_*).
 * - Chaque test tourne dans une TRANSACTION annulée en tearDown → aucune
 *   pollution de la base de dev.
 * - Si la base n'est pas joignable (pas de Docker, CI sans MySQL), tous les
 *   tests sont SKIPPÉS — la suite reste verte.
 *
 * Lancer :  make up  (DB en route)  puis  make test-php
 */
final class DatabaseIntegrationTest extends TestCase
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
            self::$pdo->rollBack(); // annule toute écriture du test
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private function makeUser(string $suffix = ''): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        $code = strtoupper(substr($rnd, 0, 8) . 'TST'); // 8+ chars, unique
        $stmt = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            "phpunit_{$rnd}{$suffix}@test.local",
            "phpunit_{$rnd}{$suffix}",
            'x',
            substr($code, 0, 8),
            'en',
        ]);
        return (int) self::$pdo->lastInsertId();
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    public function testGameSessionUniquePerUserModeDate(): void
    {
        $uid = $this->makeUser();
        $ins = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts)
             VALUES (?, "classic", "2026-01-01", "Joker", "win", 3)'
        );
        $ins->execute([$uid]);

        $this->expectException(PDOException::class);
        $ins->execute([$uid]); // même (user, mode, date) → doit violer l'unique
    }

    public function testUserEmailIsUnique(): void
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        $email = "dup_{$rnd}@test.local";
        $ins = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang) VALUES (?, ?, "x", ?, "en")'
        );
        $ins->execute([$email, "pa_{$rnd}", strtoupper(substr($rnd, 0, 6) . 'AA')]);

        $this->expectException(PDOException::class);
        $ins->execute([$email, "pb_{$rnd}", strtoupper(substr($rnd, 0, 6) . 'BB')]); // même email
    }

    public function testUserPseudoIsUnique(): void
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        $pseudo = "dup_pseudo_{$rnd}";
        $ins = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang) VALUES (?, ?, "x", ?, "en")'
        );
        $ins->execute(["a_{$rnd}@test.local", $pseudo, strtoupper(substr($rnd, 0, 6) . 'CC')]);

        $this->expectException(PDOException::class);
        $ins->execute(["b_{$rnd}@test.local", $pseudo, strtoupper(substr($rnd, 0, 6) . 'DD')]);
    }

    public function testSocialLinkRequiresOrderedUserIds(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        $hi = max($u1, $u2);
        $lo = min($u1, $u2);

        $this->expectException(PDOException::class); // chk_sl_order : user_a_id < user_b_id
        self::$pdo->prepare('INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp) VALUES (?, ?, 1, 0)')
            ->execute([$hi, $lo]); // ordre inversé → CHECK échoue
    }

    public function testSocialLinkRankIsBounded(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');

        $this->expectException(PDOException::class); // chk_sl_rank : 1..10
        self::$pdo->prepare('INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp) VALUES (?, ?, 11, 0)')
            ->execute([min($u1, $u2), max($u1, $u2)]);
    }

    public function testUsersTableHasColumnsUsedByCode(): void
    {
        // Garde-fou anti-dérive : bdd_mysql.sql (schéma Docker) doit contenir les
        // colonnes que le code utilise — sinon login.php & co plantent en Fatal error.
        $cols = self::$pdo->query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        )->fetchAll(PDO::FETCH_COLUMN);

        foreach ([
            'is_admin', 'is_banned', 'pseudo_locked', 'streak_recovered_at',
            'global_streak', 'global_streak_record', 'global_streak_date',
        ] as $required) {
            $this->assertContains($required, $cols, "Colonne users.$required manquante (schéma périmé ?)");
        }
    }

    public function testMessagesTableHasChallengeColumns(): void
    {
        // Garde-fou anti-dérive : api/messages/index.php écrit/relit ces colonnes
        // (challenge_target ajoutée par migration 023 — défi à cible dédiée).
        $cols = self::$pdo->query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages'"
        )->fetchAll(PDO::FETCH_COLUMN);

        foreach ([
            'challenge_mode', 'challenge_score', 'challenge_date',
            'challenge_filters', 'challenge_target',
        ] as $required) {
            $this->assertContains($required, $cols, "Colonne messages.$required manquante (schéma périmé ?)");
        }
    }

    public function testCriticalTablesExist(): void
    {
        // Contrat de schéma : toute table utilisée par le code doit exister dans
        // bdd_mysql.sql (chargé par Docker). Garde-fou contre la dérive Docker↔code
        // (cf. social_link_rankup_notifs qui manquait → notif rank-up cassée).
        $tables = self::$pdo->query(
            "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()"
        )->fetchAll(PDO::FETCH_COLUMN);

        $required = [
            'users', 'profiles', 'user_stats', 'game_sessions',
            'badges', 'badges_unlocked', 'titles', 'user_titles',
            'friendships', 'social_links', 'social_link_ranks',
            'social_link_interactions', 'social_link_rankup_notifs', 'leaderboard_cache',
            'messages', 'wallpapers', 'user_wallpapers', 'deletion_requests',
            'event_codes', 'event_codes_redeemed', 'rate_limits', 'error_log',
            'admin_audit_log',
        ];
        foreach ($required as $t) {
            $this->assertContains($t, $tables, "Table '$t' manquante (schéma Docker périmé ?)");
        }
    }

    public function testDeletingUserCascadesToStats(): void
    {
        $uid = $this->makeUser();
        self::$pdo->prepare('INSERT INTO user_stats (user_id, mode) VALUES (?, "classic")')->execute([$uid]);

        $count = fn() => (int) self::$pdo->query("SELECT COUNT(*) FROM user_stats WHERE user_id = $uid")->fetchColumn();
        $this->assertSame(1, $count());

        self::$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
        $this->assertSame(0, $count(), 'ON DELETE CASCADE doit purger user_stats');
    }

    /**
     * Complète testDeletingUserCascadesToStats() : le hard delete admin
     * (DELETE /api/admin/users/:id) doit purger TOUTES les tables liées, pas
     * seulement user_stats — sinon des lignes orphelines subsistent (badges_unlocked,
     * profiles) après suppression "définitive" d'un compte.
     */
    public function testDeletingUserCascadesToProfileAndBadges(): void
    {
        $uid = $this->makeUser();
        self::$pdo->prepare('INSERT INTO profiles (user_id) VALUES (?)')->execute([$uid]);
        self::$pdo->prepare(
            "INSERT INTO badges_unlocked (user_id, badge_id) VALUES (?, 'true_hacker')"
        )->execute([$uid]);

        $profileCount = fn() => (int) self::$pdo
            ->query("SELECT COUNT(*) FROM profiles WHERE user_id = $uid")->fetchColumn();
        $badgeCount = fn() => (int) self::$pdo
            ->query("SELECT COUNT(*) FROM badges_unlocked WHERE user_id = $uid")->fetchColumn();

        $this->assertSame(1, $profileCount());
        $this->assertSame(1, $badgeCount());

        self::$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);

        $this->assertSame(0, $profileCount(), 'ON DELETE CASCADE doit purger profiles');
        $this->assertSame(0, $badgeCount(), 'ON DELETE CASCADE doit purger badges_unlocked');
    }

    /**
     * Vérifie la requête de purge de api/cron/purge-rate-limits.php : les fenêtres
     * expirées depuis plus d'1h sont supprimées, les fenêtres récentes/actives
     * sont conservées (sans DB, rate_limits grossirait indéfiniment).
     */
    public function testRateLimitsPurgeDeletesOldWindowsOnly(): void
    {
        $rndOld    = 'phpunit_old_' . bin2hex(random_bytes(4));
        $rndRecent = 'phpunit_recent_' . bin2hex(random_bytes(4));

        $ins = self::$pdo->prepare(
            'INSERT INTO rate_limits (rl_key, hits, window_start) VALUES (?, 1, ?)'
        );
        $ins->execute([$rndOld, time() - 7200]);    // 2h — au-delà de la marge de purge
        $ins->execute([$rndRecent, time() - 60]);   // 1 min — fenêtre encore active

        $cutoff = time() - 3600; // même marge que le cron (1h)
        self::$pdo->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([$cutoff]);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE rl_key = ?');
        $stmt->execute([$rndOld]);
        $this->assertSame(0, (int) $stmt->fetchColumn(), 'la fenêtre expirée aurait dû être purgée');

        $stmt->execute([$rndRecent]);
        $this->assertSame(1, (int) $stmt->fetchColumn(), 'la fenêtre active ne doit pas être purgée');
    }

    // ── personadle_record_game_session() — api/lib/game_session.php ──────────
    // (endpoint : POST /api/sessions)

    private function makeUserStats(int $userId, string $mode, array $overrides = []): void
    {
        $defaults = [
            'wins' => 0, 'giveups' => 0, 'games' => 0,
            'streak' => 0, 'streak_record' => 0, 'perfect_wins' => 0,
            'total_time_ms' => 0, 'last_played_at' => null,
        ];
        $row = array_merge($defaults, $overrides);
        self::$pdo->prepare(
            'INSERT INTO user_stats
                (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms, last_played_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $userId, $mode, $row['wins'], $row['giveups'], $row['games'],
            $row['streak'], $row['streak_record'], $row['perfect_wins'],
            $row['total_time_ms'], $row['last_played_at'],
        ]);
    }

    public function testRecordGameSessionInsertsSessionAndUpdatesStats(): void
    {
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        $out = personadle_record_game_session(
            self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 1, 4200, ['opus' => ['P5']]
        );

        $this->assertGreaterThan(0, $out['session_id']);
        $this->assertSame(1, $out['stats']['games']);
        $this->assertSame(1, $out['stats']['wins']);
        $this->assertSame(0, $out['stats']['giveups']);
        $this->assertSame(1, $out['stats']['streak'], 'première partie jouée → streak = 1');
        $this->assertSame(1, $out['stats']['perfect_wins'], 'victoire en 1 essai = parfaite');
        $this->assertSame(1, $out['global_streak']);

        // Vérifie que la ligne game_sessions a bien été persistée avec les filtres encodés.
        $stmt = self::$pdo->prepare(
            'SELECT active_filters FROM game_sessions WHERE user_id = ? AND mode = ? AND played_date = ?'
        );
        $stmt->execute([$uid, 'classic', $today]);
        $this->assertSame(['opus' => ['P5']], json_decode($stmt->fetchColumn(), true));
    }

    public function testRecordGameSessionThrowsOnDuplicate(): void
    {
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 1, 1000, []);

        $this->expectException(PersonadleDuplicateSessionException::class);
        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 1, 1000, []);
    }

    // ── Upgrade giveup→win (décision produit 2026-07-17) ─────────────────────

    public function testWinAfterGiveupUpgradesSessionAndStats(): void
    {
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'giveup', 8, 5000, []);
        $out = personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 3, 2000, []);

        $this->assertTrue($out['upgraded'] ?? false, 'la victoire post-abandon doit être un upgrade, pas un 409');
        $this->assertSame(1, $out['stats']['games'], 'games inchangé — même journée de jeu');
        $this->assertSame(1, $out['stats']['wins']);
        $this->assertSame(0, $out['stats']['giveups'], 'le giveup du jour est annulé par la victoire');
        $this->assertSame(1, $out['stats']['streak'], 'streak recalculée depuis l\'historique');
        $this->assertSame(7000, $out['stats']['total_time_ms'], 'temps des deux tentatives cumulé');

        // La ligne du jour est bien passée en win.
        $stmt = self::$pdo->prepare(
            'SELECT result, attempts FROM game_sessions WHERE user_id = ? AND mode = ? AND played_date = ?'
        );
        $stmt->execute([$uid, 'classic', $today]);
        $row = $stmt->fetch();
        $this->assertSame('win', $row['result']);
        $this->assertSame(3, (int) $row['attempts']);
    }

    public function testWinAfterGiveupDoesNotCountAsPerfect(): void
    {
        // L'abandon a révélé la réponse : le win compte, pas le "perfect"
        // (victoire en 1 essai) — sinon farming gratuit de perfect_wins.
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'giveup', 8, 5000, []);
        $out = personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 1, 1000, []);

        $this->assertSame(0, $out['stats']['perfect_wins']);
    }

    public function testGiveupAfterWinStillRejected(): void
    {
        // L'upgrade ne marche que dans le sens giveup→win : un giveup (ou un win)
        // après un win reste un doublon 409.
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 2, 1000, []);

        $this->expectException(PersonadleDuplicateSessionException::class);
        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'giveup', 8, 1000, []);
    }

    public function testGiveupAfterGiveupStillRejected(): void
    {
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'giveup', 8, 1000, []);

        $this->expectException(PersonadleDuplicateSessionException::class);
        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'giveup', 8, 1000, []);
    }

    public function testWinAfterGiveupExtendsStreakFromHistory(): void
    {
        // Victoire hier + giveup aujourd'hui (streak cassée à 0), puis win
        // aujourd'hui → la streak recalculée depuis l'historique doit être 2
        // (hier win + aujourd'hui win), pas 1.
        $uid = $this->makeUser();
        $paris = new DateTimeZone('Europe/Paris');
        $today = (new DateTime('now', $paris))->format('Y-m-d');
        $yesterday = (new DateTime('yesterday', $paris))->format('Y-m-d');

        personadle_record_game_session(self::$pdo, $uid, 'classic', $yesterday, 'Morgana', 'win', 2, 1000, []);
        personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'giveup', 8, 1000, []);
        $out = personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 2, 1000, []);

        $this->assertSame(2, $out['stats']['streak']);
        $this->assertSame(2, $out['stats']['streak_record']);
    }

    public function testRecordGameSessionBootstrapsMissingStatsRow(): void
    {
        // Aucune ligne user_stats préexistante pour ce (user, mode) — le garde-fou
        // INSERT IGNORE de personadle_record_game_session() doit la créer.
        $uid   = $this->makeUser();
        $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM user_stats WHERE user_id = ? AND mode = ?');
        $stmt->execute([$uid, 'emoji']);
        $this->assertSame(0, (int) $stmt->fetchColumn());

        $out = personadle_record_game_session(self::$pdo, $uid, 'emoji', $today, 'Morgana', 'giveup', 0, 500, []);

        $this->assertSame(0, $out['stats']['wins']);
        $this->assertSame(1, $out['stats']['giveups']);
        $this->assertSame(0, $out['stats']['streak'], 'abandon → streak remise à 0');
    }

    public function testRecordGameSessionIncrementsStreakOnConsecutiveDay(): void
    {
        $uid = $this->makeUser();
        $paris = new DateTimeZone('Europe/Paris');
        $today = (new DateTime('now', $paris))->format('Y-m-d');
        $yesterday = (new DateTime('yesterday', $paris))->format('Y-m-d');
        $yesterdayUtc = (new DateTime($yesterday . ' 12:00:00', $paris))
            ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');

        $this->makeUserStats($uid, 'classic', ['streak' => 5, 'streak_record' => 5, 'last_played_at' => $yesterdayUtc]);

        $out = personadle_record_game_session(self::$pdo, $uid, 'classic', $today, 'Joker', 'win', 2, 1000, []);

        $this->assertSame(6, $out['stats']['streak']);
        $this->assertSame(6, $out['stats']['streak_record']);
    }

    // ── personadle_attempt_streak_recovery() — api/lib/streak_recovery.php ───
    // (endpoint : POST /api/user/recover-streak)

    public function testStreakRecoverySucceedsAndUpdatesStreakAndCooldown(): void
    {
        $uid = $this->makeUser();
        $this->makeUserStats($uid, 'classic', ['streak' => 1]);
        // 3 jours distincts joués → previous_streak=3 est dans la limite autorisée.
        $ins = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts) VALUES (?, "classic", ?, "Joker", "win", 2)'
        );
        foreach (['2026-01-01', '2026-01-02', '2026-01-03'] as $d) {
            $ins->execute([$uid, $d]);
        }

        $out = personadle_attempt_streak_recovery(self::$pdo, $uid, 3);

        $this->assertSame(1, $out['modes_updated']);

        $stmt = self::$pdo->prepare('SELECT streak, streak_record FROM user_stats WHERE user_id = ? AND mode = "classic"');
        $stmt->execute([$uid]);
        $row = $stmt->fetch();
        $this->assertSame(3, (int) $row['streak']);
        $this->assertSame(3, (int) $row['streak_record']);

        $stmt = self::$pdo->prepare('SELECT streak_recovered_at, global_streak FROM users WHERE id = ?');
        $stmt->execute([$uid]);
        $urow = $stmt->fetch();
        $this->assertNotNull($urow['streak_recovered_at'], 'le cooldown doit être enregistré');
        $this->assertSame(3, (int) $urow['global_streak']);
    }

    public function testStreakRecoveryRejectsWhenCooldownActive(): void
    {
        $uid = $this->makeUser();
        $recentRecovery = (new DateTime('-10 days'))->format('Y-m-d H:i:s'); // < 60j
        self::$pdo->prepare('UPDATE users SET streak_recovered_at = ? WHERE id = ?')
            ->execute([$recentRecovery, $uid]);

        try {
            personadle_attempt_streak_recovery(self::$pdo, $uid, 2);
            $this->fail('devait lever PersonadleStreakRecoveryException (cooldown actif)');
        } catch (PersonadleStreakRecoveryException $e) {
            $this->assertSame(429, $e->status);
        }
    }

    public function testStreakRecoveryAllowsAfterCooldownExpires(): void
    {
        $uid = $this->makeUser();
        $oldRecovery = (new DateTime('-61 days'))->format('Y-m-d H:i:s'); // > 60j
        self::$pdo->prepare('UPDATE users SET streak_recovered_at = ? WHERE id = ?')
            ->execute([$oldRecovery, $uid]);
        $this->makeUserStats($uid, 'classic', ['streak' => 0]);
        self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts) VALUES (?, "classic", "2026-01-01", "Joker", "win", 2)'
        )->execute([$uid]);

        $out = personadle_attempt_streak_recovery(self::$pdo, $uid, 1);
        $this->assertSame(1, $out['modes_updated']);
    }

    public function testStreakRecoveryRejectsWhenExceedingDaysPlayed(): void
    {
        $uid = $this->makeUser();
        // Un seul jour distinct joué → max autorisé = 1
        self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts) VALUES (?, "classic", "2026-01-01", "Joker", "win", 2)'
        )->execute([$uid]);

        try {
            personadle_attempt_streak_recovery(self::$pdo, $uid, 5);
            $this->fail('devait lever PersonadleStreakRecoveryException (anti-triche)');
        } catch (PersonadleStreakRecoveryException $e) {
            $this->assertSame(400, $e->status);
        }
    }

    public function testStreakRecoveryThrowsWhenUserNotFound(): void
    {
        try {
            personadle_attempt_streak_recovery(self::$pdo, 999999999, 3);
            $this->fail('devait lever PersonadleStreakRecoveryException (user introuvable)');
        } catch (PersonadleStreakRecoveryException $e) {
            $this->assertSame(404, $e->status);
        }
    }

    // ── personadle_perform_social_link_interaction() — api/lib/social_link_interaction.php ──
    // (endpoint : POST /api/social-links/by-friend/:id/interact)

    public function testSocialLinkGetOrCreateLinkIsIdempotentAndCanonical(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');

        $linkId1 = personadle_sl_get_or_create_link(self::$pdo, $u1, $u2);
        $linkId2 = personadle_sl_get_or_create_link(self::$pdo, $u2, $u1); // ordre inversé

        $this->assertSame($linkId1, $linkId2, 'même paire dans les deux sens → même lien, pas de doublon');
    }

    public function testSocialLinkInteractionAwardsSoloXp(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');

        $out = personadle_perform_social_link_interaction(self::$pdo, $u1, $u2, 'visit_profile');

        $this->assertSame(5, $out['xp_gained']); // solo
        $this->assertFalse($out['is_mutual']);
        $this->assertSame(5, $out['new_xp']);
        $this->assertSame(1, $out['new_rank']);
        $this->assertFalse($out['ranked_up']);
    }

    public function testSocialLinkInteractionAwardsMutualBonusWhenBothActSameDay(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');

        $first  = personadle_perform_social_link_interaction(self::$pdo, $u1, $u2, 'share_streak');
        $this->assertSame(15, $first['xp_gained']); // solo
        $this->assertFalse($first['is_mutual']);

        $second = personadle_perform_social_link_interaction(self::$pdo, $u2, $u1, 'share_streak');
        $this->assertSame(30, $second['xp_gained']); // mutuel
        $this->assertTrue($second['is_mutual']);

        // Total : 15 (solo initial de u1) relevé à 30 rétroactivement (+15) + 30 (u2) = 60
        $this->assertSame(60, $second['new_xp']);
    }

    public function testSocialLinkInteractionRejectsDuplicateSameDayAction(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');

        personadle_perform_social_link_interaction(self::$pdo, $u1, $u2, 'compare_stats');

        $this->expectException(PersonadleAlreadyInteractedException::class);
        personadle_perform_social_link_interaction(self::$pdo, $u1, $u2, 'compare_stats');
    }

    public function testSocialLinkInteractionTriggersRankUpNotification(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');
        $linkId = personadle_sl_get_or_create_link(self::$pdo, $u1, $u2);
        // Juste sous le seuil du rang 2 (100 xp) pour déclencher la montée de rang.
        self::$pdo->prepare('UPDATE social_links SET xp = 95, `rank` = 1 WHERE id = ?')->execute([$linkId]);

        $out = personadle_perform_social_link_interaction(self::$pdo, $u1, $u2, 'share_streak'); // +15 solo

        $this->assertSame(2, $out['new_rank']);
        $this->assertTrue($out['ranked_up']);

        $stmt = self::$pdo->prepare(
            'SELECT COUNT(*) FROM social_link_rankup_notifs WHERE recipient_id = ? AND partner_id = ? AND new_rank = 2'
        );
        $stmt->execute([$u2, $u1]);
        $this->assertSame(1, (int) $stmt->fetchColumn(), 'le partenaire doit être notifié de la montée de rang');
    }

    public function testSocialLinkInteractionRejectsUnknownActionType(): void
    {
        $u1 = $this->makeUser('a');
        $u2 = $this->makeUser('b');

        $this->expectException(InvalidArgumentException::class);
        personadle_perform_social_link_interaction(self::$pdo, $u1, $u2, 'not_a_real_action');
    }

    // ── personadle_log_error() — api/lib/error_log.php ────────────────────────
    // (observabilité prod — panel admin "🪵 Logs")

    public function testLogErrorPersistsToDatabase(): void
    {
        $uid = $this->makeUser();

        personadle_log_error(self::$pdo, 'error', 'Something broke', ['source' => 'phpunit'], $uid);

        $stmt = self::$pdo->prepare('SELECT level, message, context, user_id FROM error_log WHERE user_id = ?');
        $stmt->execute([$uid]);
        $row = $stmt->fetch();

        $this->assertNotFalse($row, 'la ligne error_log aurait dû être insérée');
        $this->assertSame('error', $row['level']);
        $this->assertSame('Something broke', $row['message']);
        $this->assertSame(['source' => 'phpunit'], json_decode($row['context'], true));
        $this->assertSame($uid, (int) $row['user_id']);
    }

    public function testLogErrorAllowsNullContextAndUser(): void
    {
        personadle_log_error(self::$pdo, 'warning', 'Anonymous warning');

        $stmt = self::$pdo->prepare('SELECT context, user_id FROM error_log WHERE message = ?');
        $stmt->execute(['Anonymous warning']);
        $row = $stmt->fetch();

        $this->assertNotFalse($row);
        $this->assertNull($row['context']);
        $this->assertNull($row['user_id']);
    }

    public function testLogErrorSetsUserIdToNullWhenUserIsDeleted(): void
    {
        // ON DELETE SET NULL : une ligne de log ne doit jamais bloquer/empêcher
        // la suppression d'un compte, ni pointer vers un user_id fantôme.
        $uid = $this->makeUser();
        personadle_log_error(self::$pdo, 'error', 'Will survive user deletion', [], $uid);

        self::$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);

        $stmt = self::$pdo->prepare('SELECT user_id FROM error_log WHERE message = ?');
        $stmt->execute(['Will survive user deletion']);
        $row = $stmt->fetch();

        $this->assertNotFalse($row, 'la ligne error_log doit survivre à la suppression du user');
        $this->assertNull($row['user_id']);
    }

    // ── personadle_log_admin_action() — api/lib/admin_audit.php ──────────────
    // (traçabilité admin — panel admin "📋 Audit")

    public function testLogAdminActionPersistsToDatabase(): void
    {
        $admin  = $this->makeUser('admin');
        $target = $this->makeUser('target');

        personadle_log_admin_action(self::$pdo, $admin, 'user.ban', 'user', (string) $target, ['reason' => 'spam']);

        $stmt = self::$pdo->prepare('SELECT admin_id, action, target_type, target_id, details FROM admin_audit_log WHERE admin_id = ?');
        $stmt->execute([$admin]);
        $row = $stmt->fetch();

        $this->assertNotFalse($row, 'la ligne admin_audit_log aurait dû être insérée');
        $this->assertSame($admin, (int) $row['admin_id']);
        $this->assertSame('user.ban', $row['action']);
        $this->assertSame('user', $row['target_type']);
        $this->assertSame((string) $target, $row['target_id']);
        $this->assertSame(['reason' => 'spam'], json_decode($row['details'], true));
    }

    public function testLogAdminActionAllowsNullDetails(): void
    {
        $admin = $this->makeUser('admin2');

        personadle_log_admin_action(self::$pdo, $admin, 'event_code.delete', 'event_code', 'SUMMER2026');

        $stmt = self::$pdo->prepare('SELECT details FROM admin_audit_log WHERE action = ?');
        $stmt->execute(['event_code.delete']);
        $row = $stmt->fetch();

        $this->assertNotFalse($row);
        $this->assertNull($row['details']);
    }

    public function testLogAdminActionSetsAdminIdToNullWhenAdminIsDeleted(): void
    {
        // ON DELETE SET NULL : une entrée d'audit ne doit jamais bloquer/empêcher
        // la suppression du compte admin, ni pointer vers un admin_id fantôme.
        $admin = $this->makeUser('admin3');
        personadle_log_admin_action(self::$pdo, $admin, 'user.grant_admin', 'user', '999');

        self::$pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$admin]);

        $stmt = self::$pdo->prepare('SELECT admin_id FROM admin_audit_log WHERE action = ?');
        $stmt->execute(['user.grant_admin']);
        $row = $stmt->fetch();

        $this->assertNotFalse($row, "l'entrée d'audit doit survivre à la suppression de l'admin");
        $this->assertNull($row['admin_id']);
    }

    // ── personadle_process_deletion_request() / personadle_process_due_deletion_requests()
    // — api/lib/deletion_requests.php (RGPD hard delete — panel admin "🗑️ RGPD")

    private function makeDeletionRequest(int $userId, ?string $requestedAt = null, ?string $processedAt = null): int
    {
        $stmt = self::$pdo->prepare(
            'INSERT INTO deletion_requests (user_id, requested_at, processed_at) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $requestedAt ?? date('Y-m-d H:i:s'), $processedAt]);
        return (int) self::$pdo->lastInsertId();
    }

    public function testProcessDeletionRequestHardDeletesUserAndMarksProcessed(): void
    {
        $uid = $this->makeUser();
        $reqId = $this->makeDeletionRequest($uid);

        personadle_process_deletion_request(self::$pdo, $reqId);

        $userStmt = self::$pdo->prepare('SELECT id FROM users WHERE id = ?');
        $userStmt->execute([$uid]);
        $this->assertFalse($userStmt->fetch(), 'le user aurait dû être hard-deleted');

        $reqStmt = self::$pdo->prepare('SELECT processed_at FROM deletion_requests WHERE id = ?');
        $reqStmt->execute([$reqId]);
        $row = $reqStmt->fetch();
        $this->assertNotFalse($row);
        $this->assertNotNull($row['processed_at'], 'la demande aurait dû être marquée traitée');
    }

    public function testProcessDeletionRequestRejectsAlreadyProcessed(): void
    {
        $uid   = $this->makeUser();
        $reqId = $this->makeDeletionRequest($uid, null, date('Y-m-d H:i:s'));

        $this->expectException(PersonadleDeletionRequestException::class);
        try {
            personadle_process_deletion_request(self::$pdo, $reqId);
        } catch (PersonadleDeletionRequestException $e) {
            $this->assertSame(404, $e->status);
            throw $e;
        }
    }

    public function testProcessDeletionRequestRejectsUnknownId(): void
    {
        $this->expectException(PersonadleDeletionRequestException::class);
        personadle_process_deletion_request(self::$pdo, 999999999);
    }

    public function testProcessDueDeletionRequestsOnlyProcessesRequestsOlderThanThreshold(): void
    {
        $uidOld = $this->makeUser('old');
        $uidNew = $this->makeUser('new');

        $oldTs = (new DateTime('-31 days'))->format('Y-m-d H:i:s');
        $newTs = (new DateTime('-5 days'))->format('Y-m-d H:i:s');

        $reqOld = $this->makeDeletionRequest($uidOld, $oldTs);
        $reqNew = $this->makeDeletionRequest($uidNew, $newTs);

        $result = personadle_process_due_deletion_requests(self::$pdo, 30);

        $this->assertSame(1, $result['deleted']);
        $this->assertSame(1, $result['pending']);
        $this->assertEmpty($result['errors']);

        $oldUserStmt = self::$pdo->prepare('SELECT id FROM users WHERE id = ?');
        $oldUserStmt->execute([$uidOld]);
        $this->assertFalse($oldUserStmt->fetch(), 'le compte échu (>30j) aurait dû être hard-deleted');

        $newUserStmt = self::$pdo->prepare('SELECT id FROM users WHERE id = ?');
        $newUserStmt->execute([$uidNew]);
        $this->assertNotFalse($newUserStmt->fetch(), 'le compte récent (<30j) ne doit pas être touché');

        $newReqStmt = self::$pdo->prepare('SELECT processed_at FROM deletion_requests WHERE id = ?');
        $newReqStmt->execute([$reqNew]);
        $this->assertNull($newReqStmt->fetch()['processed_at']);
    }
}
