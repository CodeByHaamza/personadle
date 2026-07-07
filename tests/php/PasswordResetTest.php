<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/password_reset.php';

/**
 * Tests d'intégration pour api/lib/password_reset.php — extrait de
 * api/auth/request-reset.php / reset-password.php (flux jusqu'ici à 0% de
 * couverture malgré une surface d'authentification sensible, cf. audit
 * sécurité/tests 2026-07-06).
 *
 * Même pattern que DatabaseIntegrationTest.php/ConditionCheckTest.php : vraie
 * base MariaDB (Docker), chaque test dans une transaction annulée en
 * tearDown, skip si base injoignable.
 */
final class PasswordResetTest extends TestCase
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

    // ── Helpers ──────────────────────────────────────────────────────────────
    private function makeUser(): int
    {
        $rnd  = substr(md5(uniqid('', true)), 0, 6);
        $code = strtoupper(substr($rnd, 0, 8) . 'PR');
        $stmt = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            "phpunit_pr_{$rnd}@test.local",
            "phpunit_pr_{$rnd}",
            'original-hash',
            substr($code, 0, 8),
            'en',
        ]);
        return (int) self::$pdo->lastInsertId();
    }

    // ── personadle_create_password_reset_token() ──────────────────────────────

    public function testCreateTokenReturnsHighEntropyValueAndStoresOnlyItsHash(): void
    {
        $uid   = $this->makeUser();
        $token = personadle_create_password_reset_token(self::$pdo, $uid);

        // bin2hex(random_bytes(32)) → 64 caractères hexadécimaux
        $this->assertSame(64, strlen($token));
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $token);

        $stmt = self::$pdo->prepare('SELECT reset_token_hash, reset_token_expires FROM users WHERE id = ?');
        $stmt->execute([$uid]);
        $row = $stmt->fetch();

        // Le token en clair ne doit JAMAIS être stocké tel quel — seul son hash sha256.
        $this->assertNotSame($token, $row['reset_token_hash']);
        $this->assertSame(hash('sha256', $token), $row['reset_token_hash']);
        $this->assertGreaterThan(time(), strtotime($row['reset_token_expires'] . ' UTC'));
    }

    public function testCreateTokenOverwritesAnyPreviousPendingToken(): void
    {
        $uid = $this->makeUser();
        $first = personadle_create_password_reset_token(self::$pdo, $uid);
        $second = personadle_create_password_reset_token(self::$pdo, $uid);

        // L'ancien token ne doit plus jamais matcher après une 2e demande.
        $this->assertNull(personadle_find_user_by_reset_token(self::$pdo, $first));
        $this->assertNotNull(personadle_find_user_by_reset_token(self::$pdo, $second));
    }

    // ── personadle_find_user_by_reset_token() ─────────────────────────────────

    public function testFindUserByValidToken(): void
    {
        $uid   = $this->makeUser();
        $token = personadle_create_password_reset_token(self::$pdo, $uid);

        $found = personadle_find_user_by_reset_token(self::$pdo, $token);

        $this->assertNotNull($found);
        $this->assertSame($uid, $found['id']);
    }

    public function testFindUserByUnknownTokenReturnsNull(): void
    {
        $this->assertNull(
            personadle_find_user_by_reset_token(self::$pdo, str_repeat('a', 64))
        );
    }

    public function testFindUserByExpiredTokenReturnsNull(): void
    {
        $uid   = $this->makeUser();
        $token = personadle_create_password_reset_token(self::$pdo, $uid);

        // Fait expirer manuellement le token (1h dans le passé) pour vérifier
        // que l'expiration est bien appliquée à l'exacte frontière.
        self::$pdo->prepare('UPDATE users SET reset_token_expires = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = ?')
            ->execute([$uid]);

        $this->assertNull(personadle_find_user_by_reset_token(self::$pdo, $token));
    }

    public function testFindUserByTokenExcludesDeletedAccounts(): void
    {
        $uid   = $this->makeUser();
        $token = personadle_create_password_reset_token(self::$pdo, $uid);

        self::$pdo->prepare('UPDATE users SET is_deleted = 1 WHERE id = ?')->execute([$uid]);

        $this->assertNull(personadle_find_user_by_reset_token(self::$pdo, $token));
    }

    // ── personadle_apply_new_password() ───────────────────────────────────────

    public function testApplyNewPasswordUpdatesHashAndClearsTokenAndRememberMe(): void
    {
        $uid   = $this->makeUser();
        $token = personadle_create_password_reset_token(self::$pdo, $uid);

        // Simule une session "remember me" active avant le reset.
        self::$pdo->prepare(
            'UPDATE users SET remember_me_hash = ?, remember_me_expires = UTC_TIMESTAMP() + INTERVAL 30 DAY WHERE id = ?'
        )->execute(['some-remember-me-hash', $uid]);

        $newHash = password_hash('N3w-Str0ng-Passw0rd!', PASSWORD_BCRYPT);
        personadle_apply_new_password(self::$pdo, $uid, $newHash);

        $stmt = self::$pdo->prepare(
            'SELECT password_hash, reset_token_hash, reset_token_expires, remember_me_hash, remember_me_expires
             FROM users WHERE id = ?'
        );
        $stmt->execute([$uid]);
        $row = $stmt->fetch();

        $this->assertSame($newHash, $row['password_hash']);
        $this->assertNull($row['reset_token_hash']);
        $this->assertNull($row['reset_token_expires']);
        $this->assertNull($row['remember_me_hash']);
        $this->assertNull($row['remember_me_expires']);

        // Le token utilisé pour arriver ici ne doit plus jamais fonctionner
        // (protège contre un lien de reset réutilisé/partagé par erreur).
        $this->assertNull(personadle_find_user_by_reset_token(self::$pdo, $token));
    }
}
