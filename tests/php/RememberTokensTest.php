<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/remember_tokens.php';

/**
 * « Se souvenir de moi » — un jeton PAR APPAREIL (migration 056).
 *
 * Signalement joueur 2026-11 : des déconnexions « automatiques ». Il n'existait
 * qu'un seul jeton par compte (`users.remember_me_hash`), écrasé à chaque connexion
 * et roté à chaque restauration de session : un deuxième appareil, ou deux onglets
 * qui restauraient en même temps, invalidaient le jeton de l'autre. Le joueur se
 * retrouvait invité sans le savoir — avec une autre cible du jour.
 */
final class RememberTokensTest extends TestCase
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
            return;
        }

        // La migration elle-même : rejouable, elle doit passer sur une base qui
        // l'a déjà (CI, chargée depuis bdd_mysql.sql) comme sur une base d'avant.
        self::$pdo->exec((string) file_get_contents(__DIR__ . '/../../sql/migrations/056_remember_tokens.sql'));
    }

    protected function setUp(): void
    {
        if (self::$skipReason !== null) {
            $this->markTestSkipped(self::$skipReason);
        }
    }

    private function makeUser(): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang) VALUES (?, ?, ?, ?, ?)'
        )->execute(["phpunit_rt_{$rnd}@test.local", "phpunit_rt_{$rnd}", 'x', strtoupper(substr($rnd . 'RT', 0, 8)), 'en']);
        return (int) self::$pdo->lastInsertId();
    }

    private function userOf(string $raw): ?int
    {
        $t = personadle_remember_lookup(self::$pdo, $raw);
        return $t === null ? null : (int) $t['user_id'];
    }

    private function ageToken(string $raw, int $hours): void
    {
        self::$pdo->prepare('UPDATE remember_tokens SET created_at = NOW() - INTERVAL ? HOUR WHERE token_hash = ?')
            ->execute([$hours, personadle_remember_hash($raw)]);
    }

    public function testTwoDevicesKeepTheirOwnToken(): void
    {
        // Le cœur du bug : se connecter sur le téléphone déconnectait le PC.
        $uid = $this->makeUser();
        $pc    = personadle_remember_issue(self::$pdo, $uid);
        $phone = personadle_remember_issue(self::$pdo, $uid);

        $this->assertSame($uid, $this->userOf($pc), 'le jeton du PC doit survivre à la connexion du téléphone');
        $this->assertSame($uid, $this->userOf($phone));
    }

    public function testAFreshTokenIsNotRotated(): void
    {
        // Pas de rotation à chaque restauration : c'est elle qui faisait se
        // déconnecter mutuellement deux onglets ouverts en même temps.
        $uid = $this->makeUser();
        $raw = personadle_remember_issue(self::$pdo, $uid);

        $this->assertNull(personadle_remember_rotate_if_due(self::$pdo, personadle_remember_lookup(self::$pdo, $raw)));
        $this->assertSame($uid, $this->userOf($raw));
    }

    public function testAnOldTokenIsRotatedButStaysValidDuringTheGraceWindow(): void
    {
        $uid = $this->makeUser();
        $old = personadle_remember_issue(self::$pdo, $uid);
        $this->ageToken($old, 48);

        $new = personadle_remember_rotate_if_due(self::$pdo, personadle_remember_lookup(self::$pdo, $old));

        $this->assertIsString($new);
        $this->assertNotSame($old, $new);
        $this->assertSame($uid, $this->userOf($new));
        // Un second onglet qui présente encore l'ancien jeton dans la foulée ne doit
        // pas être déconnecté.
        $this->assertSame($uid, $this->userOf($old), "l'ancien jeton reste valable le temps de la fenêtre de grâce");

        $s = self::$pdo->prepare(
            'SELECT TIMESTAMPDIFF(SECOND, NOW(), expires_at) FROM remember_tokens WHERE token_hash = ?'
        );
        $s->execute([personadle_remember_hash($old)]);
        $this->assertLessThanOrEqual(PERSONADLE_REMEMBER_GRACE_SECONDS, (int) $s->fetchColumn());
    }

    public function testRevokeOnlyLogsOutThisDevice(): void
    {
        $uid = $this->makeUser();
        $pc    = personadle_remember_issue(self::$pdo, $uid);
        $phone = personadle_remember_issue(self::$pdo, $uid);

        personadle_remember_revoke(self::$pdo, $pc);

        $this->assertNull($this->userOf($pc));
        $this->assertSame($uid, $this->userOf($phone), 'se déconnecter du PC ne déconnecte pas le téléphone');
    }

    public function testRevokeAllLogsOutEveryDevice(): void
    {
        $uid = $this->makeUser();
        $pc    = personadle_remember_issue(self::$pdo, $uid);
        $phone = personadle_remember_issue(self::$pdo, $uid);

        personadle_remember_revoke_all(self::$pdo, $uid);

        $this->assertNull($this->userOf($pc));
        $this->assertNull($this->userOf($phone));
    }

    public function testExpiredTokenIsRejected(): void
    {
        $uid = $this->makeUser();
        $raw = personadle_remember_issue(self::$pdo, $uid);
        self::$pdo->prepare('UPDATE remember_tokens SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE token_hash = ?')
            ->execute([personadle_remember_hash($raw)]);

        $this->assertNull($this->userOf($raw));
    }

    public function testDeletedAccountTokenIsRejected(): void
    {
        $uid = $this->makeUser();
        $raw = personadle_remember_issue(self::$pdo, $uid);
        self::$pdo->prepare('UPDATE users SET is_deleted = 1 WHERE id = ?')->execute([$uid]);

        $this->assertNull($this->userOf($raw));
    }

    public function testUnknownOrMalformedTokenIsRejected(): void
    {
        $this->assertNull(personadle_remember_lookup(self::$pdo, ''));
        $this->assertNull(personadle_remember_lookup(self::$pdo, str_repeat('z', 5000)));
        $this->assertNull(personadle_remember_lookup(self::$pdo, bin2hex(random_bytes(32))));
    }

    public function testDevicesAreCappedPerAccount(): void
    {
        // Un jeton par connexion « se souvenir de moi » : sans plafond, un compte
        // partagé ou un script de connexion remplirait la table.
        $uid = $this->makeUser();
        $tokens = [];
        for ($i = 0; $i < PERSONADLE_REMEMBER_MAX_PER_USER + 3; $i++) {
            $tokens[] = personadle_remember_issue(self::$pdo, $uid);
        }

        $s = self::$pdo->prepare('SELECT COUNT(*) FROM remember_tokens WHERE user_id = ?');
        $s->execute([$uid]);
        $this->assertSame(PERSONADLE_REMEMBER_MAX_PER_USER, (int) $s->fetchColumn());
        $this->assertSame($uid, $this->userOf(end($tokens)), 'le plus récent est gardé');
        $this->assertNull($this->userOf($tokens[0]), 'le plus ancien saute');
    }

    public function testMigrationCarriesOverTheLegacyToken(): void
    {
        // Au déploiement, les joueurs connectés via l'ancien jeton unique ne doivent
        // pas être déconnectés : la migration le recopie dans la nouvelle table.
        $uid = $this->makeUser();
        $raw = bin2hex(random_bytes(32));
        self::$pdo->prepare(
            'UPDATE users SET remember_me_hash = ?, remember_me_expires = NOW() + INTERVAL 10 DAY WHERE id = ?'
        )->execute([hash('sha256', $raw), $uid]);

        self::$pdo->exec((string) file_get_contents(__DIR__ . '/../../sql/migrations/056_remember_tokens.sql'));

        $this->assertSame($uid, $this->userOf($raw));
    }
}
