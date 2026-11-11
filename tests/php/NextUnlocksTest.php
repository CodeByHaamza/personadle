<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/next_unlocks.php';

/**
 * « Prochains déblocages » du profil (api/lib/next_unlocks.php) — 2.4, lot 11.
 *
 * Ce qui compte : le classement (le plus avancé d'abord), jamais de badge secret
 * ni de chose déjà obtenue, et une progression qui vient de la MÊME source que la
 * décision de déblocage (personadle_condition_progress) — le panneau ne doit
 * jamais annoncer « 10 / 10 » sur ce que l'unlock refuserait.
 */
final class NextUnlocksTest extends TestCase
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
            if (!self::$pdo->query("SHOW COLUMNS FROM event_codes LIKE 'title_slug'")->fetchAll()) {
                self::$skipReason = 'migration 057 non jouée sur cette base';
            }
        } catch (Throwable $e) {
            self::$skipReason = "DB injoignable ($host:$port) — lance `make up`";
        }
    }

    private function requireDb(): void
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
        )->execute(["phpunit_nu_{$rnd}@test.local", "phpunit_nu_{$rnd}", 'x', strtoupper($rnd), 'en']);
        return (int) self::$pdo->lastInsertId();
    }

    // ── Classement (pur) ─────────────────────────────────────────────────────

    public function testRanksByProgressThenByWhatIsLeft(): void
    {
        $items = [
            ['slug' => 'a', 'current' => 1, 'required' => 10],  // 10 %
            ['slug' => 'b', 'current' => 8, 'required' => 10],  // 80 %
            ['slug' => 'c', 'current' => 4, 'required' => 5],   // 80 %, reste 1
            ['slug' => 'd', 'current' => 0, 'required' => 3],
            ['slug' => 'done', 'current' => 5, 'required' => 5], // déjà rempli : écarté
            ['slug' => 'zero', 'current' => 0, 'required' => 0], // seuil absurde : écarté
        ];
        $ranked = array_column(personadle_rank_next_unlocks($items, 10), 'slug');
        $this->assertSame(['c', 'b', 'a', 'd'], $ranked);
        $this->assertSame(['c', 'b'], array_column(personadle_rank_next_unlocks($items, 2), 'slug'));
    }

    // ── Sur une vraie base ───────────────────────────────────────────────────

    public function testANewPlayerSeesOnlyNumericNonSecretThingsAndLockedExperts(): void
    {
        $this->requireDb();
        $uid   = $this->makeUser();
        $items = personadle_next_unlocks(self::$pdo, $uid, 'fr', 50);

        $this->assertNotEmpty($items);
        $secret = self::$pdo->query('SELECT slug FROM badges WHERE is_secret = 1')->fetchAll(PDO::FETCH_COLUMN);
        foreach ($items as $i) {
            $this->assertContains($i['kind'], ['badge', 'title', 'expert']);
            $this->assertLessThan($i['required'], $i['current'], "{$i['slug']} : déjà rempli, ne devrait pas figurer");
            if ($i['kind'] === 'badge') {
                $this->assertNotContains($i['slug'], $secret, 'un badge secret ne doit pas être dévoilé');
            }
            // Le joueur n'a aucun Mode Expert : rien qui demande d'y jouer.
            $this->assertNotContains($i['condition_type'], ['mode_expert_perfect_wins', 'expert_wins_total', 'expert_modes_mastered']);
        }
        $experts = array_filter($items, static fn ($i) => $i['kind'] === 'expert');
        $this->assertCount(6, $experts, 'les six quêtes Expert sont verrouillées pour un nouveau joueur');
    }

    public function testProgressFollowsTheStatsAndAgreesWithTheUnlockDecision(): void
    {
        $this->requireDb();
        $uid = $this->makeUser();
        self::$pdo->prepare(
            "INSERT INTO user_stats (user_id, mode, games, wins) VALUES (?, 'silhouette', 4, 4)"
        )->execute([$uid]);

        $bySlug = [];
        foreach (personadle_next_unlocks(self::$pdo, $uid, 'en', 100) as $i) {
            $bySlug[$i['kind'] . ':' . $i['slug']] = $i;
        }
        // shadow_slayer : 5 victoires Silhouette.
        $this->assertSame(4, $bySlug['badge:shadow_slayer']['current'] ?? null);
        $this->assertSame(5, $bySlug['badge:shadow_slayer']['required'] ?? null);

        // Même source que la décision : 4 / 5 → refusé ; 5 / 5 → accordé.
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', 'silhouette', 5));
        self::$pdo->prepare("UPDATE user_stats SET wins = 5 WHERE user_id = ? AND mode = 'silhouette'")->execute([$uid]);
        $this->assertTrue(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', 'silhouette', 5));
    }

    public function testAMisconfiguredConditionIsNeverMetAndNeverShown(): void
    {
        $this->requireDb();
        $uid = $this->makeUser();
        // mode_wins sans mode : invalide, donc jamais rempli, même avec un seuil 0.
        $this->assertFalse(personadle_verify_condition(self::$pdo, $uid, 'mode_wins', null, 0));
        $p = personadle_condition_progress(self::$pdo, $uid, 'mode_wins', null, 3);
        $this->assertNotNull($p);
        $this->assertFalse($p['valid']);
        // Conditions non chiffrées : pas de progression.
        $this->assertNull(personadle_condition_progress(self::$pdo, $uid, 'targets_found', 'wonder_go_beyond', null));
        $this->assertNull(personadle_condition_progress(self::$pdo, $uid, 'manual', null, null));
    }
}
