<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/condition_check.php';

/**
 * Tests d'intégration pour le catalogue badges/wallpapers migré vers des colonnes
 * structurées (sql/migrations/021_structured_badge_wallpaper_conditions.sql).
 *
 * Trois angles distincts de ConditionCheckTest.php (qui teste la LOGIQUE générique
 * avec des valeurs arbitraires) :
 *
 *  1. Vérifie que CHAQUE ligne réellement seedée (61 badges, 7 wallpapers) a bien
 *     le condition_type/mode/value attendu — si un futur `npm run` ou une migration
 *     manuelle modifie une valeur par erreur, ce test le détecte immédiatement,
 *     badge par badge / wallpaper par wallpaper (pas juste "la fonction marche").
 *  2. Exécute le EXACT SELECT utilisé par api/badges/index.php, api/wallpapers/index.php
 *     et api/titles/index.php (copié depuis ces fichiers, y compris la résolution
 *     slug→id de /api/titles/unlock), pas juste condition_check.php appelé directement
 *     avec des littéraux — un décalage de nom/clé de colonne entre la requête réelle
 *     d'un endpoint et ce que personadle_verify_condition() attend serait détecté ici
 *     (revue PR #14).
 *  3. Prouve que CHAQUE seuil réel du catalogue (pas une valeur inventée) est respecté
 *     à l'exacte frontière : value-1 refusé, value accordé — pour les 3 tables
 *     (badges, wallpapers, ET titles). Angle absent des deux premiers (qui vérifient
 *     soit la donnée en base, soit la logique générique) — ajouté après qu'une revue
 *     ultérieure de cette PR a noté qu'aucun test n'aurait détecté une régression de
 *     comportement sur un seuil réel spécifique. Lit le catalogue DIRECTEMENT en base
 *     (pas une liste de slugs codée en dur) : un futur badge/wallpaper/titre utilisant
 *     un condition_type déjà supporté est couvert automatiquement dès son insertion.
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
        // 61 slugs seedés (sql/bdd_mysql.sql) pour détecter un slug ajouté/retiré.
        $manual = [
            'burn_my_dread', 'into_the_fog', 'velvet_headache', 'chinese_new_year', 'twin_blade',
            'persona_q_explorer', 'crimson_legacy', 'hippocampus_reload', 'truth_duality', 'one_shot',
            'aoa_vision', 'navigator', 'strega', 'twin_fist', 'twin_spear', 'tradition_modernite',
            'shapeshifter', 'ideal_reality', 'for_real', 'night_owl', 'nyx_hour', 'stylist',
            'reborn_phoenix', 'take_the_pose', 'data_mining', 'leblanc_meeting',
            'rentree', 'sport', 'christmas_2025', 'new_years_2026', 'chinese_new_year_2026',
            'valentine_2026', 'easter_2026', 'golden_week', 'tanabata', 'promised_day',
            'true_hacker', 'tae_takemi', 'arati', 'gyotre', 'dzulian', 'chef', 'github_contributor',
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
        $this->assertCount(61, $expected, 'Le catalogue de référence de ce test doit lister les 61 badges');

        $rows = self::$pdo->query(
            'SELECT slug, condition_type, condition_mode, condition_value FROM badges'
        )->fetchAll(PDO::FETCH_ASSOC);
        $this->assertCount(61, $rows, 'La table badges doit contenir exactement 61 lignes (seed bdd_mysql.sql)');

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

            // Le vrai endpoint (api/titles/index.php::POST /unlock) résout title_slug en id
            // via une requête séparée (WHERE slug = ?), PUIS fait le check par id (WHERE id = ?)
            // — copier seulement la 1ère requête ici passait par coïncidence (slug et id
            // pointent sur la même ligne) sans jamais exercer le WHERE id = ? réellement
            // utilisé par le check de condition (revue PR #14).
            $resolve = self::$pdo->prepare('SELECT id FROM titles WHERE slug = ? LIMIT 1');
            $resolve->execute(['naoya_first_awakening']); // condition_type = classic_p1_wins, value 15
            $titleId = (int) $resolve->fetchColumn();
            $this->assertGreaterThan(0, $titleId, "Le titre 'naoya_first_awakening' doit exister dans le catalogue seedé");

            // Copié depuis api/titles/index.php::POST /unlock — même requête, même colonnes.
            $check = self::$pdo->prepare(
                'SELECT id, condition_type, condition_mode, condition_value FROM titles WHERE id = ? LIMIT 1'
            );
            $check->execute([$titleId]);
            $title = $check->fetch(PDO::FETCH_ASSOC);
            $this->assertNotFalse($title);

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

    // ── 3. Frontière exacte : value-1 refusé, value accordé (revue PR #14) ──────

    /**
     * Types de condition à seuil numérique simple : condition_value est directement
     * comparé (>=) à une statistique. Exclut 'all_modes_won' (ET logique sur 6 modes,
     * pas un seuil — voir testAllModesWonRequiresAllSixModes()) et 'manual'/'joker_profile'
     * (aucune statistique vérifiable).
     */
    private const NUMERIC_THRESHOLD_TYPES = [
        'wins_total', 'mode_wins', 'mode_games', 'games_total', 'streak_record',
        'perfect_wins', 'unique_days', 'giveups_total', 'friends_count', 'badges_count',
        'social_link_min_rank', 'weekly_clean_modes', 'classic_p1_wins', 'emoji_p2_wins',
    ];

    /**
     * Lit DIRECTEMENT en base (pas une liste codée en dur) chaque ligne badges/
     * wallpapers/titles dont le condition_type est un seuil numérique simple. Suite à
     * une revue de la revue précédente : une liste de 19 slugs en dur ne couvre pas un
     * futur badge ajouté avec un condition_type déjà supporté — ici, tout nouveau badge/
     * wallpaper/titre utilisant un condition_type de NUMERIC_THRESHOLD_TYPES est
     * automatiquement couvert dès son insertion en base, sans qu'un humain doive ajouter
     * une ligne. Seul un TOUT NOUVEAU condition_type (jamais vu) demande d'étendre
     * setConditionStat() + NUMERIC_THRESHOLD_TYPES — pas par badge.
     *
     * @return array<int, array{0: string, 1: string, 2: ?string, 3: int}> [label, type, mode, value]
     */
    private function structuredThresholdRows(): array
    {
        $placeholders = implode(',', array_fill(0, count(self::NUMERIC_THRESHOLD_TYPES), '?'));
        $rows = [];
        foreach (['badges' => 'slug', 'wallpapers' => 'id', 'titles' => 'slug'] as $table => $idCol) {
            // $table/$idCol : littéraux fixes de la boucle ci-dessus, jamais une entrée
            // utilisateur — même pattern que personadle_aggregate_user_stat().
            $stmt = self::$pdo->prepare(
                "SELECT $idCol AS identifier, condition_type, condition_mode, condition_value
                 FROM $table WHERE condition_type IN ($placeholders) AND condition_value IS NOT NULL"
            );
            $stmt->execute(self::NUMERIC_THRESHOLD_TYPES);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $rows[] = [
                    "$table:{$r['identifier']}",
                    $r['condition_type'],
                    $r['condition_mode'],
                    (int) $r['condition_value'],
                ];
            }
        }
        return $rows;
    }

    public function testStructuredConditionsRespectExactThresholdAcrossCatalog(): void
    {
        $rows = $this->structuredThresholdRows();
        $this->assertGreaterThanOrEqual(
            15,
            count($rows),
            'Le catalogue doit contenir au moins les seuils numériques connus (badges+wallpapers+titres)'
        );

        foreach ($rows as [$label, $type, $mode, $value]) {
            $uid = $this->makeUser();
            self::$pdo->beginTransaction();
            try {
                $this->setConditionStat($uid, $type, $mode, $value - 1);
                $this->assertFalse(
                    personadle_verify_condition(self::$pdo, $uid, $type, $mode, $value),
                    "$label ($type" . ($mode ? "/$mode" : '') . '=' . ($value - 1)
                        . ") devrait être refusé juste sous le seuil $value"
                );

                $this->setConditionStat($uid, $type, $mode, $value);
                $this->assertTrue(
                    personadle_verify_condition(self::$pdo, $uid, $type, $mode, $value),
                    "$label ($type" . ($mode ? "/$mode" : '') . "=$value) devrait être accordé exactement au seuil"
                );
            } finally {
                self::$pdo->rollBack();
            }
        }
    }

    public function testAllModesWonRequiresAllSixModes(): void
    {
        // Logique générique — couvre à la fois kamoshida_palace (wallpaper) et
        // yu_reach_out_to_the_truth (titre), les deux seuls usages de 'all_modes_won'
        // dans le catalogue seedé ; le comportement de personadle_verify_condition() ne
        // dépend pas de la table appelante.
        $uid = $this->makeUser();
        self::$pdo->beginTransaction();
        try {
            $modes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];

            foreach (array_slice($modes, 0, 5) as $mode) {
                self::$pdo->prepare('INSERT INTO user_stats (user_id, mode, wins) VALUES (?, ?, 1)')
                    ->execute([$uid, $mode]);
            }
            $this->assertFalse(
                personadle_verify_condition(self::$pdo, $uid, 'all_modes_won', null, null),
                '5 modes gagnés sur 6 devrait être refusé'
            );

            self::$pdo->prepare('INSERT INTO user_stats (user_id, mode, wins) VALUES (?, ?, 1)')
                ->execute([$uid, $modes[5]]);
            $this->assertTrue(
                personadle_verify_condition(self::$pdo, $uid, 'all_modes_won', null, null),
                '6 modes gagnés sur 6 devrait être accordé'
            );
        } finally {
            self::$pdo->rollBack();
        }
    }

    /** Pose une statistique utilisateur au niveau $value pour un condition_type/mode donné. */
    private function setConditionStat(int $userId, string $type, ?string $mode, int $value): void
    {
        switch ($type) {
            case 'wins_total':
                $this->upsertStat($userId, 'classic', 'wins', $value);
                break;
            case 'classic_p1_wins':
                $this->upsertStat($userId, 'classic', 'wins', $value);
                break;
            case 'emoji_p2_wins':
                $this->upsertStat($userId, 'emoji', 'wins', $value);
                break;
            case 'giveups_total':
                $this->upsertStat($userId, 'classic', 'giveups', $value);
                break;
            case 'mode_wins':
                $this->upsertStat($userId, (string) $mode, 'wins', $value);
                break;
            case 'mode_games':
                $this->upsertStat($userId, (string) $mode, 'games', $value);
                break;
            case 'games_total':
                $this->upsertStat($userId, 'classic', 'games', $value);
                break;
            case 'streak_record':
                $this->upsertStat($userId, 'classic', 'streak_record', $value);
                break;
            case 'perfect_wins':
                $this->upsertStat($userId, 'classic', 'perfect_wins', $value);
                break;
            case 'unique_days':
                $this->setUniqueDays($userId, $value);
                break;
            case 'friends_count':
                $this->setFriendsCount($userId, $value);
                break;
            case 'badges_count':
                $this->setBadgesCount($userId, $value);
                break;
            case 'social_link_min_rank':
                $this->setSocialLinkRank($userId, $value);
                break;
            case 'weekly_clean_modes':
                $this->setWeeklyCleanModes($userId, $value);
                break;
            default:
                throw new InvalidArgumentException("Type non géré par ce test: $type");
        }
    }

    private function upsertStat(int $userId, string $mode, string $column, int $value): void
    {
        $allowed = ['wins', 'giveups', 'games', 'streak_record', 'perfect_wins'];
        if (!in_array($column, $allowed, true)) {
            throw new InvalidArgumentException("Colonne non autorisée: $column");
        }
        self::$pdo->prepare(
            "INSERT INTO user_stats (user_id, mode, $column) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE $column = VALUES($column)"
        )->execute([$userId, $mode, $value]);
    }

    private function setUniqueDays(int $userId, int $days): void
    {
        self::$pdo->prepare('DELETE FROM game_sessions WHERE user_id = ?')->execute([$userId]);
        if ($days <= 0) {
            return;
        }
        $stmt = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts)
             VALUES (?, "classic", DATE_SUB(CURDATE(), INTERVAL ? DAY), "x", "win", 1)'
        );
        for ($i = 0; $i < $days; $i++) {
            $stmt->execute([$userId, $i]);
        }
    }

    private function setFriendsCount(int $userId, int $count): void
    {
        self::$pdo->prepare('DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?')
            ->execute([$userId, $userId]);
        for ($i = 0; $i < $count; $i++) {
            $friendId = $this->makeUser("_fr{$i}");
            self::$pdo->prepare(
                'INSERT INTO friendships (requester_id, addressee_id, status, accepted_at)
                 VALUES (?, ?, "accepted", NOW())'
            )->execute([$userId, $friendId]);
        }
    }

    private function setSocialLinkRank(int $userId, int $rank): void
    {
        self::$pdo->prepare('DELETE FROM social_links WHERE user_a_id = ? OR user_b_id = ?')
            ->execute([$userId, $userId]);
        if ($rank <= 0) {
            return;
        }
        $partnerId = $this->makeUser('_partner');
        [$lo, $hi] = $userId < $partnerId ? [$userId, $partnerId] : [$partnerId, $userId];
        self::$pdo->prepare(
            'INSERT INTO social_links (user_a_id, user_b_id, `rank`, xp) VALUES (?, ?, ?, 500)'
        )->execute([$lo, $hi, $rank]);
    }

    /** badge_id n'a pas de FK vers badges.slug (colonne libre, cf. bdd_mysql.sql) — des slugs synthétiques suffisent. */
    private function setBadgesCount(int $userId, int $count): void
    {
        self::$pdo->prepare('DELETE FROM badges_unlocked WHERE user_id = ?')->execute([$userId]);
        $stmt = self::$pdo->prepare('INSERT INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)');
        for ($i = 0; $i < $count; $i++) {
            $stmt->execute([$userId, "phpunit_synthetic_badge_{$i}"]);
        }
    }

    private function setWeeklyCleanModes(int $userId, int $count): void
    {
        $modes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
        if ($count > count($modes)) {
            throw new InvalidArgumentException('weekly_clean_modes ne peut pas dépasser 6 (nb de modes réels)');
        }
        self::$pdo->prepare('DELETE FROM game_sessions WHERE user_id = ?')->execute([$userId]);
        $stmt = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts)
             VALUES (?, ?, CURDATE(), "x", "win", 1)'
        );
        foreach (array_slice($modes, 0, $count) as $mode) {
            $stmt->execute([$userId, $mode]);
        }
    }
}
