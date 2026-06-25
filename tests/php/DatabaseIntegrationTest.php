<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

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

        foreach (['is_admin', 'is_banned', 'pseudo_locked', 'streak_recovered_at'] as $required) {
            $this->assertContains($required, $cols, "Colonne users.$required manquante (schéma périmé ?)");
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
            'event_codes', 'event_codes_redeemed', 'rate_limits',
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
}
