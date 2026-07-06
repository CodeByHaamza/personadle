<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/condition_check.php';

/**
 * Tests d'intégration pour le catalogue badges/wallpapers migré vers des colonnes
 * structurées (sql/migrations/021_structured_badge_wallpaper_conditions.sql).
 *
 * Deux angles distincts de ConditionCheckTest.php (qui teste la LOGIQUE générique
 * avec des valeurs arbitraires) :
 *
 *  1. Vérifie que CHAQUE ligne réellement seedée (60 badges, 7 wallpapers) a bien
 *     le condition_type/mode/value attendu — si un futur `npm run` ou une migration
 *     manuelle modifie une valeur par erreur, ce test le détecte immédiatement,
 *     badge par badge / wallpaper par wallpaper (pas juste "la fonction marche").
 *  2. Exécute le EXACT SELECT utilisé par api/badges/index.php, api/wallpapers/index.php
 *     et api/titles/index.php (copié depuis ces fichiers), pas juste condition_check.php
 *     appelé directement avec des littéraux — un décalage de nom de colonne entre le
 *     SELECT d'un endpoint et ce que personadle_verify_condition() attend serait
 *     détecté ici (revue PR #14).
 */
final class BadgeWallpaperCatalogTest extends TestCase
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
    }

    private function makeUser(string $suffix = ''): int
    {
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        $code = strtoupper(substr($rnd, 0, 8) . 'TST');
        $stmt = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            "phpunit_cat_{$rnd}{$suffix}@test.local",
            "phpunit_cat_{$rnd}{$suffix}",
            'x',
            substr($code, 0, 8),
            'en',
        ]);
        return (int) self::$pdo->lastInsertId();
    }

    // ── 1. Catalogue complet : un condition_type/mode/value attendu par badge ────

    /**
     * Mapping attendu — reflet exact de sql/migrations/021_structured_badge_wallpaper_conditions.sql.
     * Toute divergence ici avec la vraie base signale soit une régression de la
     * migration, soit ce test lui-même à mettre à jour si le mapping change
     * délibérément (auquel cas mettre aussi à jour la migration/bdd_mysql.sql).
     *
     * @return array<string, array{0: ?string, 1: ?string, 2: ?int}>
     */
    private static function expectedBadgeConditions(): array
    {
        $structured = [
            'first_win'       => ['wins_total', null, 1],
            'ace_detective'   => ['wins_total', null, 10],
            'ace_defective'   => ['giveups_total', null, 10],
            'shadow_slayer'   => ['mode_wins', 'silhouette', 5],
            'music_master'    => ['mode_wins', 'music', 20],
            'p1_p2_fan'       => ['mode_wins', 'classic', 15],
            'velvet_master'   => ['mode_wins', 'personae', 10],
            'emoji_decoder'   => ['mode_wins', 'emoji', 10],
            'pyro_spark'      => ['streak_record', null, 7],
            'raphael'         => ['streak_record', null, 30],
            'surt'            => ['streak_record', null, 90],
            'lucifer'         => ['streak_record', null, 120],
            'helel'           => ['streak_record', null, 365],
            'velvet_regular'  => ['unique_days', null, 50],
            'best_bro'        => ['friends_count', null, 2],
        ];

        // Le reste du catalogue (45 badges) est 'manual' — flags narratifs, redeem
        // de code événement, ou vérifié par un autre endpoint. Liste exhaustive des
        // 60 slugs seedés (sql/bdd_mysql.sql) pour détecter un slug ajouté/retiré.
        $manual = [
            'burn_my_dread', 'into_the_fog', 'velvet_headache', 'chinese_new_year', 'twin_blade',
            'persona_q_explorer', 'crimson_legacy', 'hippocampus_reload', 'truth_duality', 'one_shot',
            'aoa_vision', 'navigator', 'strega', 'twin_fist', 'twin_spear', 'tradition_modernite',
            'shapeshifter', 'ideal_reality', 'for_real', 'night_owl', 'nyx_hour', 'stylist',
            'reborn_phoenix', 'take_the_pose', 'data_mining', 'leblanc_meeting',
            'rentree', 'sport', 'christmas_2025', 'new_years_2026', 'chinese_new_year_2026',
            'valentine_2026', 'easter_2026', 'golden_week', 'tanabata', 'promised_day',
            'true_hacker', 'tae_takemi', 'arati', 'dzulian', 'chef', 'github_contributor',
            'lobster', 'hifumi_archives', 'report',
        ];

        $expected = $structured;
        foreach ($manual as $slug) {
            $expected[$slug] = ['manual', null, null];
        }
        return $expected;
    }

    public function testEveryBadgeHasExpectedConditionColumns(): void
    {
        $expected = self::expectedBadgeConditions();
        $this->assertCount(60, $expected, 'Le catalogue de référence de ce test doit lister les 60 badges');

        $rows = self::$pdo->query(
            'SELECT slug, condition_type, condition_mode, condition_value FROM badges'
        )->fetchAll(PDO::FETCH_ASSOC);
        $this->assertCount(60, $rows, 'La table badges doit contenir exactement 60 lignes (seed bdd_mysql.sql)');

        $bySlug = [];
        foreach ($rows as $r) {
            $bySlug[$r['slug']] = [
                $r['condition_type'],
                $r['condition_mode'],
                $r['condition_value'] === null ? null : (int) $r['condition_value'],
            ];
        }

        foreach ($expected as $slug => $expectedRow) {
            $this->assertArrayHasKey($slug, $bySlug, "Badge '$slug' absent de la table badges");
            $this->assertSame(
                $expectedRow,
                $bySlug[$slug],
                "Badge '$slug' : condition_type/mode/value inattendus"
            );
        }
    }

    public function testEveryWallpaperHasExpectedConditionColumns(): void
    {
        $expected = [
            'kamoshida_palace'       => ['all_modes_won', null, null],
            'madarame_wallpaper'     => ['friends_count', null, 1],
            'yukiko_dungeons'        => ['manual', null, null],
            'kanji_dungeons'         => ['manual', null, null],
            'rise_dungeons'          => ['mode_games', 'music', 30],
            'mitsuo_dungeons'        => ['games_total', null, 75],
            'dark_shopping_district' => ['social_link_min_rank', null, 5],
        ];

        $rows = self::$pdo->query(
            'SELECT id, condition_type, condition_mode, condition_value FROM wallpapers WHERE is_default = 0'
        )->fetchAll(PDO::FETCH_ASSOC);
        $this->assertCount(7, $rows, 'La table wallpapers doit contenir 7 wallpapers non-défaut (seed bdd_mysql.sql)');

        $byId = [];
        foreach ($rows as $r) {
            $byId[$r['id']] = [
                $r['condition_type'],
                $r['condition_mode'],
                $r['condition_value'] === null ? null : (int) $r['condition_value'],
            ];
        }

        foreach ($expected as $id => $expectedRow) {
            $this->assertArrayHasKey($id, $byId, "Wallpaper '$id' absent de la table wallpapers");
            $this->assertSame($expectedRow, $byId[$id], "Wallpaper '$id' : condition_type/mode/value inattendus");
        }
    }

    // ── 2. Flux bout-en-bout : même SELECT que les 3 endpoints réels ─────────────

    public function testBadgeEndpointSelectColumnsMatchConditionChecker(): void
    {
        $uid = $this->makeUser();
        self::$pdo->beginTransaction();
        try {
            self::$pdo->prepare('INSERT INTO user_stats (user_id, mode, wins) VALUES (?, "classic", 15)')
                ->execute([$uid]);

            // Copié depuis api/badges/index.php::POST /unlock — même requête, même colonnes.
            $check = self::$pdo->prepare(
                'SELECT slug, condition_type, condition_mode, condition_value FROM badges WHERE slug = ? LIMIT 1'
            );
            $check->execute(['p1_p2_fan']);
            $badge = $check->fetch(PDO::FETCH_ASSOC);
            $this->assertNotFalse($badge, "Le badge 'p1_p2_fan' doit exister dans le catalogue seedé");

            $this->assertTrue(personadle_verify_condition(
                self::$pdo,
                $uid,
                $badge['condition_type'],
                $badge['condition_mode'] ?? null,
                isset($badge['condition_value']) ? (int) $badge['condition_value'] : null
            ));
        } finally {
            self::$pdo->rollBack();
        }
    }

    public function testWallpaperEndpointSelectColumnsMatchConditionChecker(): void
    {
        $uid = $this->makeUser();
        self::$pdo->beginTransaction();
        try {
            self::$pdo->prepare('INSERT INTO user_stats (user_id, mode, games) VALUES (?, "music", 30)')
                ->execute([$uid]);

            // Copié depuis api/wallpapers/index.php::POST /unlock.
            $check = self::$pdo->prepare(
                'SELECT id, is_default, condition_type, condition_mode, condition_value
                 FROM wallpapers WHERE id = ? LIMIT 1'
            );
            $check->execute(['rise_dungeons']);
            $wallpaper = $check->fetch(PDO::FETCH_ASSOC);
            $this->assertNotFalse($wallpaper, "Le wallpaper 'rise_dungeons' doit exister dans le catalogue seedé");

            $this->assertTrue(personadle_verify_condition(
                self::$pdo,
                $uid,
                $wallpaper['condition_type'] ?? null,
                $wallpaper['condition_mode'] ?? null,
                isset($wallpaper['condition_value']) ? (int) $wallpaper['condition_value'] : null
            ));
        } finally {
            self::$pdo->rollBack();
        }
    }

    public function testTitleEndpointSelectColumnsMatchConditionChecker(): void
    {
        $uid = $this->makeUser();
        self::$pdo->beginTransaction();
        try {
            self::$pdo->prepare('INSERT INTO user_stats (user_id, mode, wins) VALUES (?, "classic", 20)')
                ->execute([$uid]);

            // Copié depuis api/titles/index.php::POST /unlock.
            $check = self::$pdo->prepare(
                'SELECT id, condition_type, condition_mode, condition_value FROM titles WHERE slug = ? LIMIT 1'
            );
            $check->execute(['naoya_first_awakening']); // condition_type = classic_p1_wins, value 15
            $title = $check->fetch(PDO::FETCH_ASSOC);
            $this->assertNotFalse($title, "Le titre 'naoya_first_awakening' doit exister dans le catalogue seedé");

            $this->assertTrue(personadle_verify_condition(
                self::$pdo,
                $uid,
                $title['condition_type'],
                $title['condition_mode'] ?? null,
                isset($title['condition_value']) ? (int) $title['condition_value'] : null
            ));
        } finally {
            self::$pdo->rollBack();
        }
    }
}
