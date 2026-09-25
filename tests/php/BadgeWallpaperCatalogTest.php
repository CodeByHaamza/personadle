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
 *  1. Vérifie que CHAQUE ligne réellement seedée (64 badges, 7 wallpapers) a bien
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
            'denial_of_self'  => ['expert_modes_mastered', null, 10],
            // Lot du 2026-09-16 (migration 044)
            'song_of_orpheus' => ['expert_wins_total', null, 25],
            // Lot du 2026-09-18 (migration 046) — aucun 'manual' : tous vérifiés
            // depuis game_sessions (targets_found, mode_expert_perfect_wins) ou
            // depuis friendships/social_links/profiles (same_energy).
            'starlight_festival'     => ['targets_found', 'starlight_trio', null],
            'shujin_outlaws'         => ['targets_found', 'shujin_outlaws', null],
            'absolute_authority'     => ['targets_found', 'absolute_authority', null],
            'dont_waste_your_breath' => ['mode_expert_perfect_wins', 'classic', 5],
            'same_energy'            => ['same_energy', null, null],
            // Badges de dates (migration 053) : n'importe quelle année, vérifiés depuis game_sessions
            'valentine_2026' => ['played_on_date', '02-14', null],
            'tanabata'       => ['played_on_date', '07-07', null],
            'golden_week'    => ['played_in_period', '04-29:05-05', null],
            'promised_day'   => ['played_on_all_dates', '12-31,01-01', null],
            // Lot du 2026-09-23 (migration 054) — contenu 2.3
            'birds_different_feather' => ['targets_found', 'birds_different_feather', null],
            'memento_vivere_mori'     => ['targets_found', 'memento_vivere_mori', null],
            // Défis relevés : lu dans `challenge_wins`, table en ajout seul (cf.
            // migration 054). `messages` ne convenait pas — le joueur peut les
            // supprimer, et le badge se reperdrait.
            'chord_progression'       => ['mode_challenge_wins', 'music', 10],
            // Secret : accordé UNIQUEMENT par /redeem (code dévoilé à la sortie).
            'her_own_orpheus'         => ['manual', null, null],
            'easter_2026'    => ['played_on_easter', null, null],
        ];

        // Le reste du catalogue (46 badges) est 'manual' — flags narratifs, redeem
        // de code événement, ou vérifié par un autre endpoint. Liste exhaustive des
        // 64 slugs seedés (sql/bdd_mysql.sql) pour détecter un slug ajouté/retiré.
        $manual = [
            'burn_my_dread', 'into_the_fog', 'velvet_headache', 'chinese_new_year', 'twin_blade',
            'persona_q_explorer', 'crimson_legacy', 'hippocampus_reload', 'truth_duality', 'one_shot',
            'aoa_vision', 'navigator', 'strega', 'twin_fist', 'twin_spear', 'tradition_modernite',
            'shapeshifter', 'ideal_reality', 'false_spring', 'for_real', 'night_owl', 'nyx_hour',
            'stylist',
            'reborn_phoenix', 'take_the_pose', 'data_mining', 'leblanc_meeting',
            'rentree', 'sport', 'christmas_2025', 'new_years_2026', 'chinese_new_year_2026',
            'true_hacker', 'tae_takemi', 'arati', 'gyotre', 'dzulian', 'chef', 'github_contributor',
            // Lot du 2026-09-25 : pendant Ko-fi de github_contributor, même régime `manual`.
            'cafe_leblanc',
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
        $this->assertCount(74, $expected, 'Le catalogue de référence de ce test doit lister les 74 badges');

        $rows = self::$pdo->query(
            'SELECT slug, condition_type, condition_mode, condition_value FROM badges'
        )->fetchAll(PDO::FETCH_ASSOC);
        $this->assertCount(74, $rows, 'La table badges doit contenir exactement 74 lignes (seed bdd_mysql.sql)');

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

    // ── 1bis. Catalogue des TITRES, ligne par ligne ──────────────────────────
    //
    // Les badges et les wallpapers avaient leur mapping exhaustif depuis la
    // migration 021 ; les titres, non — ils n'étaient couverts que par le
    // balayage de seuil générique, qui vérifie la LOGIQUE mais pas la DONNÉE.
    // Une valeur changée par erreur dans bdd_mysql.sql (un 25 devenu 250) y
    // passait donc inaperçue : le balayage l'aurait testée à 249/250 et trouvée
    // « correcte », puisqu'il lit le seuil dans la base au lieu de l'attendre.

    /** @return array<string, array{0: ?string, 1: ?string, 2: ?int}> */
    private static function expectedTitleConditions(): array
    {
        return [
            'velvet_room_thou_art_i'      => ['badges_count', null, 20],
            'joker_looking_cool'          => ['joker_profile', null, 0],
            'makoto_yuki_memento_mori'    => ['unique_days', null, 100],
            'aigis_i_am_not_afraid'       => ['mode_wins', 'classic', 50],
            'akechi_pancakes'             => ['weekly_clean_modes', null, 3],
            'yosuke_ride_the_wind'        => ['friends_count', null, 5],
            'adachi_boring_isnt_it'       => ['giveups_total', null, 50],
            'marie_i_remembered'          => ['badges_count', null, 15],
            // all_modes_won ignore condition_value : le 1 est décoratif, il ne
            // doit surtout pas être lu comme un seuil.
            'yu_reach_out_to_the_truth'   => ['all_modes_won', null, 1],
            'investigation_team'          => ['mode_wins', 'personae', 8],
            'junes'                       => ['mode_wins', 'music', 15],
            'naoya_first_awakening'       => ['classic_p1_wins', null, 15],
            'maya_always_be_positive'     => ['emoji_p2_wins', null, 10],
            'shadows_converge'            => ['expert_wins_total', null, 50],
            'sees'                        => ['titles_count', null, 8],
            'aigis_metis_same_soul'       => ['social_link_min_rank', null, 10],
            'kotone_not_a_princess'       => ['perfect_wins', null, 25],
            'naoto_case_never_closed'     => ['mode_wins', 'silhouette', 25],
            'shinjiro_no_pity'            => ['mode_wins_under_attempts', 'classic', 25],
            'take_your_heart'             => ['mode_wins', 'alloutattack', 40],
            // condition_mode porte la date 'MM-JJ' (24 juin) ; condition_value est
            // un INT, il ne peut pas la porter — d'où le null.
            'tatsuya_dont_burn_out'       => ['played_on_date', '06-24', null],
            // Lot du 2026-09-18 (migration 046)
            'wonder_go_beyond'            => ['targets_found', 'wonder_go_beyond', null],
            // Lot du 2026-09-23 (migration 054)
            'tatsuya_maya_deja_vu'        => ['targets_found', 'p2_deja_vu', null],
        ];
    }

    public function testEveryTitleHasExpectedConditionColumns(): void
    {
        $expected = self::expectedTitleConditions();

        $rows = self::$pdo->query(
            'SELECT slug, condition_type, condition_mode, condition_value FROM titles'
        )->fetchAll(PDO::FETCH_ASSOC);

        $this->assertCount(
            count($expected),
            $rows,
            'La table titles doit contenir exactement ' . count($expected)
            . ' lignes (seed bdd_mysql.sql) — un titre ajouté/retiré demande de mettre '
            . 'à jour expectedTitleConditions()'
        );

        $bySlug = [];
        foreach ($rows as $r) {
            $bySlug[$r['slug']] = [
                $r['condition_type'],
                $r['condition_mode'],
                $r['condition_value'] === null ? null : (int) $r['condition_value'],
            ];
        }

        foreach ($expected as $slug => $expectedRow) {
            $this->assertArrayHasKey($slug, $bySlug, "Titre '$slug' absent de la table titles");
            $this->assertSame(
                $expectedRow,
                $bySlug[$slug],
                "Titre '$slug' : condition_type/mode/value diffèrent de la référence du test"
            );
        }

        $this->assertSame(
            [],
            array_values(array_diff(array_keys($bySlug), array_keys($expected))),
            'Titre(s) présent(s) en base mais absent(s) de la référence du test'
        );
    }

    public function testEveryTitleConditionTypeIsInTheVocabulary(): void
    {
        // Sans ça, le fail-closed des endpoints d'unlock (revue 2026-09-18) rendrait
        // le titre indébloquable en silence — c'est exactement ce qui pendait au nez
        // de `sees` et `tatsuya_dont_burn_out`.
        $known = personadle_known_condition_types();

        foreach (self::expectedTitleConditions() as $slug => [$type, , ]) {
            $this->assertContains(
                $type,
                $known,
                "Titre '$slug' : condition_type '$type' hors du vocabulaire reconnu"
            );
        }
    }

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
        'titles_count', 'social_link_min_rank', 'weekly_clean_modes',
        'classic_p1_wins', 'emoji_p2_wins',
        // Types Expert — ajoutés après coup. Ils étaient testés unitairement
        // (ExpertUnlocksTest pour les 3 portes, ConditionCheckTest pour les 2
        // agrégats) mais AUCUN ne passait par la frontière value-1 / value sur la
        // ligne de catalogue qui l'utilise réellement. Trois lignes en dépendent :
        // le badge `denial_of_self` (expert_modes_mastered), le badge
        // `song_of_orpheus` et le titre `shadows_converge` (expert_wins_total),
        // et le titre en `mode_wins_under_attempts`.
        'expert_wins_total', 'expert_modes_mastered',
        'mode_wins_under_attempts', 'mode_wins_single_day', 'mode_consecutive_perfects',
        // Badge dont_waste_your_breath (046) : victoires Expert au premier essai.
        'mode_expert_perfect_wins',
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

    /**
     * Le garde-fou structurel du 2026-09-19 : pour CHAQUE titre et badge du catalogue à
     * seuil numérique, semer exactement le seuil et vérifier que le serveur l'ACCORDE de
     * lui-même (GET /api/titles, GET /api/badges → unlock_reconcile.php) — sans qu'aucun
     * client n'appelle POST /unlock. C'est ce qui manquait : Kotone (perfect_wins),
     * Shadows Converge (expert_wins_total), SEES (titles_count), Same Soul
     * (social_link_min_rank) étaient vérifiables côté serveur mais jamais demandés, et
     * ~290 titres / ~100 badges dus dormaient en prod. Un futur condition_type ajouté au
     * catalogue est couvert dès son insertion : s'il n'est pas accordé au seuil, ce test
     * casse.
     */
    public function testEveryStructuredTitleAndBadgeIsGrantedByServerReconciliationAtThreshold(): void
    {
        require_once __DIR__ . '/../../api/lib/unlock_reconcile.php';
        $rows = array_filter($this->structuredThresholdRows(), static fn($r) => !str_starts_with($r[0], 'wallpapers:'));
        $this->assertGreaterThanOrEqual(20, count($rows));

        foreach ($rows as [$label, $type, $mode, $value]) {
            [$table, $slug] = explode(':', $label, 2);
            $uid = $this->makeUser();
            self::$pdo->beginTransaction();
            try {
                $this->setConditionStat($uid, $type, $mode, $value - 1);
                $before = $table === 'titles'
                    ? personadle_reconcile_titles(self::$pdo, $uid)
                    : personadle_reconcile_badges(self::$pdo, $uid);
                $this->assertNotContains($slug, $before, "$label : sous le seuil, la réconciliation ne doit rien accorder");

                $this->setConditionStat($uid, $type, $mode, $value);
                $granted = $table === 'titles'
                    ? personadle_reconcile_titles(self::$pdo, $uid)
                    : personadle_reconcile_badges(self::$pdo, $uid);
                $this->assertContains($slug, $granted, "$label ($type=$value) : le serveur doit l'accorder sans POST /unlock");

                // Ce que le joueur voit ensuite : is_unlocked = 1 dans la liste.
                $has = $table === 'titles'
                    ? self::$pdo->prepare('SELECT COUNT(*) FROM user_titles ut JOIN titles t ON t.id = ut.title_id WHERE ut.user_id = ? AND t.slug = ?')
                    : self::$pdo->prepare('SELECT COUNT(*) FROM badges_unlocked WHERE user_id = ? AND badge_id = ?');
                $has->execute([$uid, $slug]);
                $this->assertSame(1, (int) $has->fetchColumn(), "$label : présent en base après réconciliation");
            } finally {
                self::$pdo->rollBack();
            }
        }
    }

    /**
     * Les conditions SANS seuil numérique du catalogue (date, ensemble de cibles, six
     * modes) doivent aussi être accordées par la réconciliation — c'est `played_on_date`
     * qui a mis GET /api/titles en 500 pour tous le 2026-09-19 : jamais jouée avant la
     * réconciliation, donc jamais testée sur le chemin réel. Ici chaque entrée non
     * numérique du catalogue est semée puis réconciliée.
     */
    public function testNonNumericCatalogConditionsAreGrantedByServerReconciliation(): void
    {
        require_once __DIR__ . '/../../api/lib/unlock_reconcile.php';
        $rows = [];
        foreach (['badges' => 'slug', 'titles' => 'slug'] as $table => $idCol) {
            $stmt = self::$pdo->query(
                "SELECT $idCol AS slug, condition_type, condition_mode FROM $table
                 WHERE condition_type IN ('played_on_date', 'played_in_period', 'played_on_all_dates', 'played_on_easter', 'targets_found', 'all_modes_won')"
            );
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) $rows[] = [$table, $r['slug'], $r['condition_type'], $r['condition_mode']];
        }
        $this->assertGreaterThanOrEqual(5, count($rows), 'Tatsuya, Go Beyond, les trois badges targets_found, Reach Out to the Truth…');

        $sess = self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, is_expert, client_session_id, played_date, target_name, result, attempts)
             VALUES (?, ?, ?, ?, ?, ?, ?, 2)'
        );
        foreach ($rows as [$table, $slug, $type, $mode]) {
            $uid = $this->makeUser();
            self::$pdo->beginTransaction();
            try {
                $reconcile = fn() => $table === 'titles'
                    ? personadle_reconcile_titles(self::$pdo, $uid)
                    : personadle_reconcile_badges(self::$pdo, $uid);
                $this->assertNotContains($slug, $reconcile(), "$table:$slug : rien à accorder à un compte vierge");

                switch ($type) {
                    case 'played_on_date':
                        [$mm, $dd] = explode('-', (string) $mode);
                        $sess->execute([$uid, 'classic', 0, self::uuid(), "2025-$mm-$dd", 'x', 'giveup']);
                        break;
                    case 'played_in_period':
                        // Une seule journée dans la fenêtre suffit — le dernier jour, une autre année.
                        [, $to] = explode(':', (string) $mode);
                        $sess->execute([$uid, 'music', 0, self::uuid(), "2024-$to", 'x', 'win']);
                        break;
                    case 'played_on_all_dates':
                        // Chaque date, pas forcément la même année.
                        foreach (explode(',', (string) $mode) as $i => $d) {
                            $sess->execute([$uid, 'emoji', 0, self::uuid(), (2023 + $i) . "-$d", 'x', 'win']);
                        }
                        break;
                    case 'played_on_easter':
                        // Lundi de Pâques 2025 (le 21 avril) : accepté comme le dimanche.
                        $sess->execute([$uid, 'classic', 0, self::uuid(), '2025-04-21', 'x', 'win']);
                        break;
                    case 'all_modes_won':
                        foreach (PERSONADLE_MODES as $m) {
                            self::$pdo->prepare('INSERT INTO user_stats (user_id, mode, wins) VALUES (?, ?, 1)')->execute([$uid, $m]);
                        }
                        break;
                    case 'mode_challenge_wins':
                        // Table en AJOUT SEUL : on y insère directement, il n'y a
                        // pas de « partie » à simuler. `message_id` distinct à
                        // chaque ligne, sinon la clé unique les confond.
                        $cw = self::$pdo->prepare(
                            'INSERT INTO challenge_wins (user_id, mode, is_expert, message_id) VALUES (?, ?, 0, ?)'
                        );
                        for ($i = 0; $i < (int) $value; $i++) {
                            $cw->execute([$uid, $mode, 900000 + $i]);
                        }
                        break;
                    case 'targets_found':
                        $this->assertArrayHasKey($mode, PERSONADLE_TARGET_SETS, "$slug : ensemble « $mode » inconnu");
                        $day = 0;
                        foreach (PERSONADLE_TARGET_SETS[$mode] as [$gmode, $expert, $targets]) {
                            foreach ((array) ($expert === null ? [0] : [$expert]) as $isExpert) {
                                foreach ($targets as $target) {
                                    $date = (new DateTime('2025-01-01'))->modify('+' . ($day++) . ' day')->format('Y-m-d');
                                    $sess->execute([$uid, $gmode, $isExpert, self::uuid(), $date, $target, 'win']);
                                }
                            }
                        }
                        break;
                }
                $this->assertContains($slug, $reconcile(), "$table:$slug ($type) : accordé par la réconciliation une fois la condition remplie");
            } finally {
                self::$pdo->rollBack();
            }
        }
    }

    public function testDeclarativeConditionsAreNeverGrantedByReconciliation(): void
    {
        require_once __DIR__ . '/../../api/lib/unlock_reconcile.php';
        $uid = $this->makeUser();
        self::$pdo->beginTransaction();
        try {
            $titles = personadle_reconcile_titles(self::$pdo, $uid);
            $badges = personadle_reconcile_badges(self::$pdo, $uid);
            $declTitles = self::$pdo->query("SELECT slug FROM titles WHERE condition_type IN ('manual','joker_profile')")->fetchAll(PDO::FETCH_COLUMN);
            $declBadges = self::$pdo->query("SELECT slug FROM badges WHERE condition_type IN ('manual','joker_profile')")->fetchAll(PDO::FETCH_COLUMN);
            $this->assertNotEmpty($declBadges, 'le catalogue a des badges manuels (codes événement…)');
            $this->assertSame([], array_intersect($titles, $declTitles), 'aucun titre déclaratif accordé d\'office');
            $this->assertSame([], array_intersect($badges, $declBadges), 'aucun badge déclaratif (code événement) accordé d\'office');
        } finally {
            self::$pdo->rollBack();
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
            case 'titles_count':
                $this->setTitlesCount($userId, $value);
                break;
            case 'expert_wins_total':
                $this->setExpertWins($userId, 'classic', $value);
                break;
            case 'expert_modes_mastered':
                // $value victoires Expert dans CHACUN des 6 modes. À $value-1 la
                // condition doit échouer : c'est bien le seuil par mode qui est
                // testé, pas le nombre de modes.
                $this->setExpertWinsEveryMode($userId, $value);
                break;
            case 'mode_wins_under_attempts':
                $this->setFastWins($userId, (string) $mode, $value);
                break;
            case 'mode_wins_single_day':
                $this->setSingleDayWins($userId, (string) $mode, $value);
                break;
            case 'mode_consecutive_perfects':
                $this->setConsecutivePerfects($userId, (string) $mode, $value);
                break;
            case 'mode_expert_perfect_wins':
                $this->setExpertPerfectWins($userId, (string) $mode, $value);
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

    /**
     * `user_titles.title_id` PORTE une FK vers `titles(id)` — contrairement à
     * `badges_unlocked.badge_id`, qui est une colonne libre. Des ids synthétiques
     * y sont donc rejetés en 1452 ; il faut de vrais titres du catalogue.
     */
    private function setTitlesCount(int $userId, int $count): void
    {
        self::$pdo->prepare('DELETE FROM user_titles WHERE user_id = ?')->execute([$userId]);
        $ids = self::$pdo->query('SELECT id FROM titles ORDER BY id')->fetchAll(PDO::FETCH_COLUMN);
        $this->assertGreaterThanOrEqual(
            $count,
            count($ids),
            "titles_count=$count demandé mais seulement " . count($ids) . ' titres au catalogue'
        );
        $stmt = self::$pdo->prepare('INSERT INTO user_titles (user_id, title_id) VALUES (?, ?)');
        for ($i = 0; $i < $count; $i++) {
            $stmt->execute([$userId, (int) $ids[$i]]);
        }
    }

    // ── Helpers Expert ────────────────────────────────────────────────────────
    // Tous écrivent dans `game_sessions` avec is_expert = 1 (ou 0 pour les portes,
    // qui mesurent la maîtrise du mode NORMAL). `user_stats` n'aiderait pas : elle
    // n'a qu'une ligne par (user, mode) et ne distingue ni les essais, ni la date,
    // ni Expert vs normal — les trois dimensions dont ces conditions ont besoin.
    // Chaque partie a son propre client_session_id : la clé est UNIQUE, et un NULL
    // répété passerait en MySQL mais rendrait les lignes indistinguables au débogage.

    private function insertSession(
        int $userId,
        string $mode,
        string $result,
        int $attempts,
        int $isExpert,
        int $daysAgo = 0
    ): void {
        self::$pdo->prepare(
            'INSERT INTO game_sessions
                 (user_id, mode, is_expert, client_session_id, played_date, target_name, result, attempts)
             VALUES (?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), "x", ?, ?)'
        )->execute([$userId, $mode, $isExpert, self::uuid(), $daysAgo, $result, $attempts]);
    }

    private static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }

    private function clearSessions(int $userId): void
    {
        self::$pdo->prepare('DELETE FROM game_sessions WHERE user_id = ?')->execute([$userId]);
        self::$pdo->prepare('DELETE FROM user_stats_expert WHERE user_id = ?')->execute([$userId]);
    }

    /**
     * Compteurs Expert (user_stats_expert, 051) — c'est cette table, éditable par
     * l'admin, que lisent expert_wins_total et expert_modes_mastered depuis le
     * 2026-09-19 (plus game_sessions). Les helpers ci-dessous posent les deux.
     */
    private function bumpExpertStats(int $userId, string $mode, int $wins): void
    {
        self::$pdo->prepare(
            'INSERT INTO user_stats_expert (user_id, mode, wins, games) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE wins = wins + VALUES(wins), games = games + VALUES(games)'
        )->execute([$userId, $mode, $wins, $wins]);
    }

    /**
     * $count victoires EN EXPERT au premier essai dans un mode, plus une victoire
     * Expert en 2 essais et une victoire NORMALE en 1 essai : ni l'une ni l'autre
     * ne doit compter (mode_expert_perfect_wins = Expert ET attempts = 1).
     */
    private function setExpertPerfectWins(int $userId, string $mode, int $count): void
    {
        $this->clearSessions($userId);
        for ($i = 0; $i < $count; $i++) {
            $this->insertSession($userId, $mode, 'win', 1, 1, $i);
        }
        $this->insertSession($userId, $mode, 'win', 2, 1, 40); // Expert mais 2 essais
        $this->insertSession($userId, $mode, 'win', 1, 0, 41); // 1 essai mais normal
    }

    /** $wins victoires EN EXPERT dans un mode (expert_wins_total agrège tous modes). */
    private function setExpertWins(int $userId, string $mode, int $wins): void
    {
        $this->clearSessions($userId);
        for ($i = 0; $i < $wins; $i++) {
            $this->insertSession($userId, $mode, 'win', 2, 1, $i);
        }
        $this->bumpExpertStats($userId, $mode, $wins);
    }

    /** $winsPerMode victoires EN EXPERT dans CHACUN des 6 modes. */
    private function setExpertWinsEveryMode(int $userId, int $winsPerMode): void
    {
        $this->clearSessions($userId);
        $day = 0;
        foreach (PERSONADLE_MODES as $mode) {
            for ($i = 0; $i < $winsPerMode; $i++) {
                $this->insertSession($userId, $mode, 'win', 2, 1, $day++);
            }
            $this->bumpExpertStats($userId, $mode, $winsPerMode);
        }
    }

    /** $count victoires en <= 4 essais dans le mode NORMAL (porte Expert Classique/Silhouette). */
    private function setFastWins(int $userId, string $mode, int $count): void
    {
        $this->clearSessions($userId);
        for ($i = 0; $i < $count; $i++) {
            $this->insertSession($userId, $mode, 'win', PERSONADLE_FAST_WIN_MAX_ATTEMPTS, 0, $i);
        }
    }

    /** $count victoires le MÊME jour dans le mode normal (porte Expert Émoji). */
    private function setSingleDayWins(int $userId, string $mode, int $count): void
    {
        $this->clearSessions($userId);
        for ($i = 0; $i < $count; $i++) {
            $this->insertSession($userId, $mode, 'win', 3, 0, 5); // toutes le même jour
        }
    }

    /** Série de $count victoires parfaites consécutives (porte Expert AOA/Personae/Music). */
    private function setConsecutivePerfects(int $userId, string $mode, int $count): void
    {
        $this->clearSessions($userId);
        for ($i = 0; $i < $count; $i++) {
            $this->insertSession($userId, $mode, 'win', 1, 0, $count - $i);
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
