<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/game_session.php';

/**
 * La partie du jour (migration 058, 2.4 lot 16) : la première partie d'un joueur
 * par mode, jour et dimension porte is_daily = 1, les Rejouer 0. Le classement
 * principal ne compte qu'elle. Vraie base, transaction annulée en tearDown.
 */
final class IsDailyTest extends TestCase
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
        try {
            self::$pdo = new PDO(
                "mysql:host=$host;port=$port;dbname=" . (getenv('DB_TEST_NAME') ?: 'personadle_db') . ';charset=utf8mb4',
                getenv('DB_TEST_USER') ?: 'root',
                getenv('DB_TEST_PASS') ?: 'rootpassword',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]
            );
            if (!self::$pdo->query("SHOW COLUMNS FROM game_sessions LIKE 'is_daily'")->fetchAll()) {
                self::$skipReason = 'migration 058 non jouée sur cette base';
            }
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

    private function makeUser(): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 8);
        self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang) VALUES (?, ?, ?, ?, ?)'
        )->execute(["phpunit_daily_{$rnd}@test.local", "phpunit_daily_{$rnd}", 'x', strtoupper($rnd), 'en']);
        return (int) self::$pdo->lastInsertId();
    }

    private function record(int $uid, string $mode, string $date, bool $expert = false): int
    {
        $r = personadle_record_game_session(
            self::$pdo, $uid, $mode, $date, 'Target', 'win', 2, 1000, [], $expert,
            sprintf('%08x-%04x-%04x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffff), random_int(0, 0xffffffffffff))
        );
        $s = self::$pdo->prepare('SELECT is_daily FROM game_sessions WHERE id = ?');
        $s->execute([$r['session_id']]);
        return (int) $s->fetchColumn();
    }

    public function testOnlyTheFirstGameOfTheDayIsTheDailyOne(): void
    {
        $uid = $this->makeUser();
        $this->assertSame(1, $this->record($uid, 'classic', '2026-11-10'));
        $this->assertSame(0, $this->record($uid, 'classic', '2026-11-10'), 'Rejouer');
        $this->assertSame(1, $this->record($uid, 'emoji', '2026-11-10'), 'autre mode');
        $this->assertSame(1, $this->record($uid, 'classic', '2026-11-10', true), 'Expert : sa propre partie du jour');
        $this->assertSame(0, $this->record($uid, 'classic', '2026-11-10', true));
        $this->assertSame(1, $this->record($uid, 'classic', '2026-11-11'), 'lendemain');
    }
}
