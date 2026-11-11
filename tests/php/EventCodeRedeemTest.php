<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/event_codes.php';

/**
 * Échange d'un code événement (api/lib/event_codes.php) — 2.4, lot 9 : un code
 * accorde un badge, un titre (migration 057), ou les deux.
 *
 * Vraie base MariaDB (Docker), chaque test dans une transaction annulée en
 * tearDown, skip si la base est injoignable — même schéma que PasswordResetTest.
 */
final class EventCodeRedeemTest extends TestCase
{
    private const TODAY = '2026-11-11';

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
            $cols = self::$pdo->query("SHOW COLUMNS FROM event_codes LIKE 'title_slug'")->fetchAll();
            if (!$cols) {
                self::$skipReason = 'migration 057 non jouée sur cette base (event_codes.title_slug absente)';
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function makeUser(): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 8);
        self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang) VALUES (?, ?, ?, ?, ?)'
        )->execute(["phpunit_ec_{$rnd}@test.local", "phpunit_ec_{$rnd}", 'x', strtoupper($rnd), 'en']);
        return (int) self::$pdo->lastInsertId();
    }

    private function makeTitle(): string
    {
        $slug = 'phpunit_title_' . substr(md5(uniqid('', true)), 0, 8);
        self::$pdo->prepare(
            "INSERT INTO titles (slug, name_en, condition_type, rarity) VALUES (?, 'PHPUnit title', 'manual', 'common')"
        )->execute([$slug]);
        return $slug;
    }

    private function makeCode(?string $badge, ?string $title, array $o = []): string
    {
        $code = 'PHPUNIT' . strtoupper(substr(md5(uniqid('', true)), 0, 8));
        self::$pdo->prepare(
            'INSERT INTO event_codes (code, badge_id, title_slug, start_date, end_date, is_permanent, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $code,
            $badge,
            $title,
            $o['start'] ?? null,
            $o['end'] ?? null,
            $o['permanent'] ?? 1,
            $o['active'] ?? 1,
        ]);
        return $code;
    }

    private function hasBadge(int $uid, string $slug): bool
    {
        $s = self::$pdo->prepare('SELECT 1 FROM badges_unlocked WHERE user_id = ? AND badge_id = ?');
        $s->execute([$uid, $slug]);
        return (bool) $s->fetchColumn();
    }

    private function hasTitle(int $uid, string $slug): bool
    {
        $s = self::$pdo->prepare(
            'SELECT 1 FROM user_titles ut JOIN titles t ON t.id = ut.title_id WHERE ut.user_id = ? AND t.slug = ?'
        );
        $s->execute([$uid, $slug]);
        return (bool) $s->fetchColumn();
    }

    private function redemptions(int $uid): int
    {
        $s = self::$pdo->prepare('SELECT COUNT(*) FROM event_codes_redeemed WHERE user_id = ?');
        $s->execute([$uid]);
        return (int) $s->fetchColumn();
    }

    // ── Ce qu'un code accorde ────────────────────────────────────────────────

    public function testABadgeCodeGrantsTheBadge(): void
    {
        $uid  = $this->makeUser();
        $code = $this->makeCode('christmas_2025', null);

        $r = personadle_redeem_event_code(self::$pdo, $uid, strtolower($code), self::TODAY);

        $this->assertSame(200, $r['status']);
        $this->assertSame('christmas_2025', $r['badge_id']);
        $this->assertNull($r['title_slug']);
        $this->assertTrue($this->hasBadge($uid, 'christmas_2025'));
        $this->assertSame(1, $this->redemptions($uid));
    }

    public function testATitleOnlyCodeGrantsTheTitle(): void
    {
        $uid   = $this->makeUser();
        $title = $this->makeTitle();
        $code  = $this->makeCode(null, $title);

        $r = personadle_redeem_event_code(self::$pdo, $uid, $code, self::TODAY);

        $this->assertSame(200, $r['status']);
        $this->assertNull($r['badge_id']);
        $this->assertSame($title, $r['title_slug']);
        $this->assertTrue($this->hasTitle($uid, $title));
    }

    public function testACodeCanGrantBothAtOnce(): void
    {
        $uid   = $this->makeUser();
        $title = $this->makeTitle();
        $code  = $this->makeCode('christmas_2025', $title);

        $this->assertSame(200, personadle_redeem_event_code(self::$pdo, $uid, $code, self::TODAY)['status']);
        $this->assertTrue($this->hasBadge($uid, 'christmas_2025'));
        $this->assertTrue($this->hasTitle($uid, $title));
    }

    // ── Les refus ────────────────────────────────────────────────────────────

    public function testASecondRedeemIsRefused(): void
    {
        $uid  = $this->makeUser();
        $code = $this->makeCode('christmas_2025', null);
        personadle_redeem_event_code(self::$pdo, $uid, $code, self::TODAY);

        $this->assertSame(409, personadle_redeem_event_code(self::$pdo, $uid, $code, self::TODAY)['status']);
        $this->assertSame(1, $this->redemptions($uid));
    }

    public function testUnknownInactiveEmptyAndOutOfWindowCodes(): void
    {
        $uid = $this->makeUser();
        $this->assertSame(400, personadle_redeem_event_code(self::$pdo, $uid, '   ', self::TODAY)['status']);
        $this->assertSame(404, personadle_redeem_event_code(self::$pdo, $uid, 'NOPE_' . time(), self::TODAY)['status']);

        $inactive = $this->makeCode('christmas_2025', null, ['active' => 0]);
        $this->assertSame(404, personadle_redeem_event_code(self::$pdo, $uid, $inactive, self::TODAY)['status']);

        $dated = $this->makeCode('christmas_2025', null, ['permanent' => 0, 'start' => '2026-12-01', 'end' => '2026-12-31']);
        $this->assertSame(410, personadle_redeem_event_code(self::$pdo, $uid, $dated, self::TODAY)['status']);
        $this->assertSame(200, personadle_redeem_event_code(self::$pdo, $uid, $dated, '2026-12-31')['status'], 'dernier jour inclus');
    }

    public function testAMisconfiguredCodeNeverConsumesTheRedemption(): void
    {
        $uid = $this->makeUser();

        // Titre inexistant : le joueur ne doit pas perdre sa chance.
        $badTitle = $this->makeCode(null, 'phpunit_no_such_title');
        $this->assertSame(500, personadle_redeem_event_code(self::$pdo, $uid, $badTitle, self::TODAY)['status']);

        // Ni badge ni titre.
        $nothing = $this->makeCode(null, null);
        $this->assertSame(500, personadle_redeem_event_code(self::$pdo, $uid, $nothing, self::TODAY)['status']);

        $this->assertSame(0, $this->redemptions($uid));
    }

    // ── Les gardes de route ──────────────────────────────────────────────────

    public function testATitleWithACodeIsGatedAndOthersAreNot(): void
    {
        $title = $this->makeTitle();
        $this->assertFalse(personadle_title_is_code_gated(self::$pdo, $title));

        $this->makeCode(null, $title, ['active' => 0]);
        // Même inactif, le code réserve le titre : désactiver un code ne doit pas
        // ouvrir son titre à POST /api/titles/unlock.
        $this->assertTrue(personadle_title_is_code_gated(self::$pdo, $title));

        $this->assertTrue(personadle_badge_is_code_gated(self::$pdo, 'christmas_2025'));
        $this->assertFalse(personadle_badge_is_code_gated(self::$pdo, 'first_win'));
    }
}
