<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * Un badge protégé par un code événement ne doit s'obtenir QUE par /redeem.
 *
 * ── Le trou ──────────────────────────────────────────────────────────────────
 * 13 badges du catalogue ont une ligne dans `event_codes` : les badges
 * saisonniers (Noël, Saint-Valentin, Nouvel An chinois…) et les badges secrets
 * communautaires (`dzulian`, `chef`, `lobster`…). Leur condition réelle, c'est
 * « connaître le code », et seul `POST /api/badges/redeem` sait la vérifier — il
 * valide le code, sa fenêtre de validité, et consomme la redemption.
 *
 * Mais en base ils portent `condition_type = 'manual'`, ce qui vaut « accordé
 * sans vérification » pour `personadle_verify_condition()`. Donc
 * `POST /api/badges/unlock` avec le slug les accordait aussi — sans le code. Et
 * le slug n'est pas un secret : `GET /api/badges` renvoie le catalogue complet à
 * tout utilisateur authentifié.
 *
 * Autrement dit : le code protégeait une porte, à côté d'une fenêtre ouverte.
 *
 * ── Pourquoi le garde vit dans l'endpoint et pas dans condition_check.php ────
 * Ce n'est pas une question de CONDITION mais de ROUTE. `condition_check.php`
 * répond « cet utilisateur remplit-il la condition ? » ; ici la réponse dépend
 * d'un secret que l'utilisateur fournit, pas d'un état en base. Mettre ça dans la
 * lib obligerait à lui faire connaître `event_codes`, une table qui ne la
 * regarde pas.
 *
 * ── Ce que ce fichier vérifie ────────────────────────────────────────────────
 * Deux moitiés, et la seconde compte autant que la première : fermer une route
 * ne doit pas casser les joueurs légitimes.
 */
final class EventCodeBadgeGateTest extends TestCase
{
    private static ?PDO $pdo = null;
    private static ?string $skipReason = null;
    private static string $endpointSrc = '';

    public static function setUpBeforeClass(): void
    {
        self::$endpointSrc = file_get_contents(__DIR__ . '/../../api/badges/index.php');

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

    private function requireDb(): void
    {
        if (self::$skipReason !== null) {
            $this->markTestSkipped(self::$skipReason);
        }
    }

    /** Rejoue la décision de l'endpoint : ce badge est-il réservé à /redeem ? */
    private function isCodeGated(string $slug): bool
    {
        $stmt = self::$pdo->prepare('SELECT 1 FROM event_codes WHERE badge_id = ? LIMIT 1');
        $stmt->execute([$slug]);
        return (bool) $stmt->fetchColumn();
    }

    // ── 1. La route est bien fermée ──────────────────────────────────────────

    public function testUnlockEndpointRefusesEveryCodeGatedBadge(): void
    {
        $this->requireDb();

        $gated = self::$pdo->query(
            'SELECT DISTINCT b.slug FROM badges b JOIN event_codes ec ON ec.badge_id = b.slug ORDER BY b.slug'
        )->fetchAll(PDO::FETCH_COLUMN);

        $this->assertNotEmpty($gated, 'aucun badge adossé à un code — le seed a changé ?');

        foreach ($gated as $slug) {
            $this->assertTrue(
                $this->isCodeGated($slug),
                "$slug a un code événement : /unlock doit le refuser"
            );
        }
    }

    public function testTheGuardRunsBeforeTheConditionCheck(): void
    {
        $this->requireDb();

        // Ces badges sont `manual`, donc la vérification de condition les
        // accorderait. C'est précisément pour ça que le garde de route doit
        // passer AVANT elle dans le fichier : s'il passait après, il ne servirait
        // à rien (la condition aurait déjà répondu oui et l'endpoint aurait
        // inséré la ligne).
        $posGuard = strpos(self::$endpointSrc, 'FROM event_codes WHERE badge_id');
        $posCond  = strpos(self::$endpointSrc, 'personadle_condition_allows_unlock');

        $this->assertNotFalse($posGuard, 'le garde des codes événement a disparu de api/badges/index.php');
        $this->assertNotFalse($posCond, 'la vérification de condition a disparu de api/badges/index.php');
        $this->assertLessThan(
            $posCond,
            $posGuard,
            'le garde des codes doit précéder la vérification de condition'
        );
    }

    public function testGatedBadgesAreExactlyTheOnesWithACode(): void
    {
        $this->requireDb();

        // Le garde se lit depuis `event_codes`, pas depuis une liste de slugs en
        // dur : un badge saisonnier ajouté demain par l'admin est protégé dès la
        // création de son code, sans toucher au PHP. Ce test verrouille ce lien.
        $withCode = self::$pdo->query(
            'SELECT COUNT(DISTINCT badge_id) FROM event_codes WHERE badge_id IN (SELECT slug FROM badges)'
        )->fetchColumn();

        $this->assertGreaterThanOrEqual(1, (int) $withCode);
        $this->assertStringNotContainsString(
            "'christmas_2025'",
            self::$endpointSrc,
            'le garde ne doit pas coder de slug en dur — il interroge event_codes'
        );
    }

    // ── 2. Les joueurs légitimes ne sont pas cassés ──────────────────────────

    public function testBadgesWithoutACodeAreUntouched(): void
    {
        $this->requireDb();

        // Le gros du catalogue n'a pas de code : ces badges doivent continuer à
        // passer par /unlock exactement comme avant.
        foreach (['first_win', 'ace_detective', 'data_mining', 'denial_of_self'] as $slug) {
            $this->assertFalse(
                $this->isCodeGated($slug),
                "$slug n'a pas de code événement : /unlock ne doit pas le refuser"
            );
        }
    }

    public function testRedeemRemainsTheWayInAndStillGrantsTheBadge(): void
    {
        $this->requireDb();

        // Le chemin légitime doit rester intact : c'est /redeem qui écrit dans
        // badges_unlocked, dans une transaction avec event_codes_redeemed.
        $this->assertStringContainsString(
            'INSERT IGNORE INTO badges_unlocked',
            self::$endpointSrc,
            '/redeem doit toujours accorder le badge'
        );
        $this->assertStringContainsString(
            'INSERT INTO event_codes_redeemed',
            self::$endpointSrc,
            '/redeem doit toujours consommer la redemption'
        );
    }

    public function testEveryCodeStillPointsToARealBadge(): void
    {
        $this->requireDb();

        // Si un code pointait vers un slug inexistant, /redeem répondrait 500 et
        // /unlock refuserait désormais aussi : le badge deviendrait inatteignable
        // par les deux routes. L'endpoint a déjà un garde-fou pour ça (il refuse
        // sans consommer la redemption), mais autant le détecter ici.
        $orphans = self::$pdo->query(
            'SELECT ec.code, ec.badge_id FROM event_codes ec
             LEFT JOIN badges b ON b.slug = ec.badge_id
             WHERE b.slug IS NULL'
        )->fetchAll(PDO::FETCH_ASSOC);

        $this->assertSame(
            [],
            $orphans,
            'code(s) pointant vers un badge inexistant : ' . json_encode($orphans)
        );
    }
}
