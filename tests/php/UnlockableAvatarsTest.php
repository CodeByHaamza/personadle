<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/condition_check.php';
require_once __DIR__ . '/../../api/lib/unlock_reconcile.php';

/**
 * Tests du pack d'avatars déblocables (migration 054) et de sa condition
 * composite `avatar_pack_kotone`.
 *
 * Ce qui se joue ici et nulle part ailleurs : la condition mêle du CUMULATIF
 * (parties gagnées, lues dans game_sessions) et de l'ÉTAT COURANT (titre équipé,
 * bordure portée, lus dans profiles). C'est le seul déblocage du jeu construit
 * ainsi, et il ne respecte la règle « un accès gagné ne se reperd jamais »
 * (CLAUDE.md §7) que grâce à un point précis : la ligne posée dans `user_avatars`
 * n'est jamais retirée. Le dernier cas de ce fichier est là pour ça.
 *
 * Même pattern que ConditionCheckTest : vraie base MariaDB, transaction annulée
 * en tearDown, skip si la base est injoignable.
 */
final class UnlockableAvatarsTest extends TestCase
{
    private static ?PDO $pdo = null;
    private static ?string $skipReason = null;

    /** Les cinq musiques exclusives à P3P, figées nommément dans le target set. */
    private const CHANSONS_P3P = ['A Way of Life', 'Danger Zone', 'Soul Phrase', 'Time', 'Wiping All Out'];

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
                "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
                $user,
                $pass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
        } catch (Throwable $e) {
            self::$skipReason = 'base injoignable : ' . $e->getMessage();
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
        $rnd = substr(md5(uniqid('', true)), 0, 6);
        $stmt = self::$pdo->prepare(
            'INSERT INTO users (email, pseudo, password_hash, friend_code, lang) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            "phpunit_ua_{$rnd}@test.local",
            "phpunit_ua_{$rnd}",
            'x',
            strtoupper(substr($rnd, 0, 6) . 'UA'),
            'en',
        ]);
        $id = (int) self::$pdo->lastInsertId();
        self::$pdo->prepare('INSERT INTO profiles (user_id) VALUES (?)')->execute([$id]);
        return $id;
    }

    private function win(int $userId, string $mode, int $expert, string $target, string $date): void
    {
        self::$pdo->prepare(
            'INSERT INTO game_sessions (user_id, mode, is_expert, target_name, result, attempts, played_date)
             VALUES (?, ?, ?, ?, "win", 1, ?)'
        )->execute([$userId, $mode, $expert, $target, $date]);
    }

    /** Toutes les parties du rituel — la moitié CUMULATIVE de la condition. */
    private function jouerToutLeRituel(int $userId): void
    {
        $j = 1;
        $date = static function () use (&$j): string {
            return sprintf('2026-03-%02d', $j++);
        };
        $this->win($userId, 'alloutattack', 0, 'Kotone Shiomi', $date());
        $this->win($userId, 'alloutattack', 1, 'Kotone Shiomi', $date());
        $this->win($userId, 'personae', 0, 'Kotone Shiomi', $date());
        $this->win($userId, 'personae', 1, 'Kotone Shiomi', $date());
        $this->win($userId, 'silhouette', 0, 'Kotone Shiomi', $date());
        $this->win($userId, 'silhouette', 0, 'Theodore', $date());
        foreach (self::CHANSONS_P3P as $chanson) {
            $this->win($userId, 'music', 0, $chanson, $date());
            $this->win($userId, 'music', 1, $chanson, $date());
        }
    }

    /** Équipe le titre de Kotone et pose sa bordure rose — la moitié ÉTAT COURANT. */
    private function porterTitreEtBordure(int $userId): void
    {
        self::$pdo->prepare(
            'UPDATE profiles p JOIN titles t ON t.slug = ?
                SET p.equipped_title_id = t.id, p.avatar_border_color = ?
              WHERE p.user_id = ?'
        )->execute([PERSONADLE_KOTONE_TITLE_SLUG, PERSONADLE_KOTONE_BORDER, $userId]);
    }

    private function conditionRemplie(int $userId): bool
    {
        return personadle_verify_condition(self::$pdo, $userId, 'avatar_pack_kotone', null, null);
    }

    // ── La condition ────────────────────────────────────────────────────────

    public function testUnCompteViergeNeRemplitPasLaCondition(): void
    {
        $this->assertFalse($this->conditionRemplie($this->makeUser()));
    }

    public function testLesPartiesSeulesNeSuffisentPas(): void
    {
        // Tout le rituel joué, mais ni titre ni bordure : c'est précisément la
        // moitié qu'on pourrait oublier de vérifier.
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->assertFalse($this->conditionRemplie($u));
    }

    public function testLeTitreEtLaBordureSeulsNeSuffisentPas(): void
    {
        $u = $this->makeUser();
        $this->porterTitreEtBordure($u);
        $this->assertFalse($this->conditionRemplie($u));
    }

    public function testLeRituelCompletRemplitLaCondition(): void
    {
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        $this->assertTrue($this->conditionRemplie($u));
    }

    public function testUneAutreCouleurDeBordureNeSuffitPas(): void
    {
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        self::$pdo->prepare('UPDATE profiles SET avatar_border_color = ? WHERE user_id = ?')
            ->execute(['#3b82f6', $u]);
        $this->assertFalse($this->conditionRemplie($u));
    }

    public function testUnAutreTitreEquipeNeSuffitPas(): void
    {
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        self::$pdo->prepare(
            'UPDATE profiles p JOIN titles t ON t.slug <> ?
                SET p.equipped_title_id = t.id
              WHERE p.user_id = ? LIMIT 1'
        )->execute([PERSONADLE_KOTONE_TITLE_SLUG, $u]);
        $this->assertFalse($this->conditionRemplie($u));
    }

    public function testLaCasseDeLaCouleurNEmpecheRien(): void
    {
        // La couleur vient du client (pastille ou sélecteur libre) : rien ne
        // garantit sa casse, et un joueur ne devrait pas rater le pack pour ça.
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        self::$pdo->prepare('UPDATE profiles SET avatar_border_color = ? WHERE user_id = ?')
            ->execute([strtoupper(PERSONADLE_KOTONE_BORDER), $u]);
        $this->assertTrue($this->conditionRemplie($u));
    }

    public function testUneSeuleMusiqueP3PManquanteSuffitARefuser(): void
    {
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        self::$pdo->prepare(
            'DELETE FROM game_sessions WHERE user_id = ? AND mode = "music" AND is_expert = 1 AND target_name = ?'
        )->execute([$u, 'Time']);
        $this->assertFalse($this->conditionRemplie($u));
    }

    public function testTheodoreEnSilhouetteEstObligatoire(): void
    {
        // Le pack contient deux portraits de lui : l'oublier rendrait la moitié
        // du pack gratuite.
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        self::$pdo->prepare(
            'DELETE FROM game_sessions WHERE user_id = ? AND mode = "silhouette" AND target_name = "Theodore"'
        )->execute([$u]);
        $this->assertFalse($this->conditionRemplie($u));
    }

    // ── La réconciliation ───────────────────────────────────────────────────

    public function testLaReconciliationAccordeLesSixPortraitsDUnBloc(): void
    {
        $u = $this->makeUser();
        $this->assertSame([], personadle_reconcile_avatars(self::$pdo, $u), 'rien pour un compte vierge');

        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);

        $accordes = personadle_reconcile_avatars(self::$pdo, $u);
        sort($accordes);
        $this->assertSame([
            'kotone_butterfly', 'kotone_listening', 'kotone_orpheus',
            'kotone_pink_shot', 'theodore_elevator', 'theodore_look_back',
        ], $accordes);
    }

    public function testUneSecondePasseNAccordeRienDeNouveau(): void
    {
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        personadle_reconcile_avatars(self::$pdo, $u);
        $this->assertSame([], personadle_reconcile_avatars(self::$pdo, $u));
    }

    public function testLePackResteAcquisApresAvoirDesequipeLeTitre(): void
    {
        // LE cas qui justifie tout le reste. La condition redevient fausse — c'est
        // assumé, c'est un rituel — mais le déblocage, lui, ne se reprend pas.
        // Sans cette garantie, le pack violerait la règle « un accès gagné ne se
        // reperd jamais » (CLAUDE.md §7), vécue en 2.1 avec les Modes Expert qui
        // se reverrouillaient à la première partie ratée.
        $u = $this->makeUser();
        $this->jouerToutLeRituel($u);
        $this->porterTitreEtBordure($u);
        personadle_reconcile_avatars(self::$pdo, $u);

        self::$pdo->prepare(
            'UPDATE profiles SET equipped_title_id = NULL, avatar_border_color = "#111111" WHERE user_id = ?'
        )->execute([$u]);

        $this->assertFalse($this->conditionRemplie($u), 'la condition redevient fausse');

        $restants = (int) self::$pdo->query(
            'SELECT COUNT(*) FROM user_avatars WHERE user_id = ' . $u
        )->fetchColumn();
        $this->assertSame(6, $restants, 'les six portraits restent débloqués');

        // Et une nouvelle réconciliation n'en retire aucun.
        personadle_reconcile_avatars(self::$pdo, $u);
        $this->assertSame(6, (int) self::$pdo->query(
            'SELECT COUNT(*) FROM user_avatars WHERE user_id = ' . $u
        )->fetchColumn());
    }

    // ── Le catalogue ────────────────────────────────────────────────────────

    public function testLeVocabulaireConnaitLeTypeDeCondition(): void
    {
        // Un condition_type absent de cette liste tombe sur le refus fail-closed
        // de personadle_condition_allows_unlock() : le pack ne s'accorderait
        // jamais, sans erreur visible.
        $this->assertContains('avatar_pack_kotone', personadle_known_condition_types());
    }

    public function testToutesLesLignesDuCatalogueOntUnTypeConnu(): void
    {
        $types = self::$pdo->query('SELECT DISTINCT condition_type FROM avatars WHERE condition_type IS NOT NULL')
            ->fetchAll(PDO::FETCH_COLUMN);
        foreach ($types as $type) {
            $this->assertContains($type, personadle_known_condition_types(), "type inconnu : {$type}");
        }
    }

    public function testLesChansonsDuRituelSontFigeesEtNonCalculees(): void
    {
        // Hamza prévoit d'ajouter des musiques P5X remakées pour P3. Si l'ensemble
        // était calculé depuis l'opus, elles durciraient le pack rétroactivement
        // pour qui ne l'a pas encore — ce que la monotonie interdit.
        $set = PERSONADLE_TARGET_SETS['kotone_ritual'];
        $musiques = array_values(array_filter($set, static fn($e) => $e[0] === 'music'));
        $this->assertCount(2, $musiques, 'music normal + Expert');
        foreach ($musiques as [$mode, $expert, $noms, $minimum]) {
            $this->assertSame(self::CHANSONS_P3P, $noms);
            $this->assertSame(5, $minimum);
        }
    }
}
