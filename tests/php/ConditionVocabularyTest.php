<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/condition_check.php';

/**
 * Cohérence du VOCABULAIRE des conditions de déblocage — sans base de données.
 *
 * Volontairement sans PDO, contrairement à ConditionCheckTest et
 * BadgeWallpaperCatalogTest : ces deux-là se `markTestSkipped()` quand MySQL est
 * injoignable, donc en local sans `make up` ils ne disent rien. Les invariants
 * vérifiés ici sont purement structurels (source PHP + seed SQL), ils doivent
 * tourner partout, tout le temps.
 *
 * Ce qu'ils protègent
 * ───────────────────
 * `personadle_verify_condition()` a deux comportements pour un type inconnu :
 *   - appelée en direct, elle RETOURNE TRUE (`default:`, safe fallback assumé —
 *     un badge ajouté demain avec un type pas encore implémenté ne doit pas être
 *     inaccessible à tout le monde) ;
 *   - à travers `personadle_condition_allows_unlock()`, elle REFUSE (fail-closed,
 *     utilisé par les 3 endpoints d'unlock : une faute de frappe en migration ne
 *     doit pas ouvrir un badge à n'importe quel compte authentifié).
 *
 * Ce double comportement repose entièrement sur `personadle_known_condition_types()`
 * étant le reflet EXACT des `case` du switch. Cette liste avait silencieusement
 * divergé : `titles_count` et `played_on_date` étaient gérés par le switch mais
 * absents de la liste. Tant que seuls les wallpapers s'en servaient, ça ne se
 * voyait pas — aucun wallpaper n'utilise ces deux types. Le jour où le
 * fail-closed a été étendu aux titres, les titres `sees` (titles_count) et
 * `tatsuya_dont_burn_out` (played_on_date) seraient devenus indébloquables pour
 * toujours, sans message d'erreur exploitable : un 403 « Condition not met » sur
 * un joueur qui remplit pourtant la condition.
 */
final class ConditionVocabularyTest extends TestCase
{
    private static string $libSource = '';

    public static function setUpBeforeClass(): void
    {
        self::$libSource = file_get_contents(__DIR__ . '/../../api/lib/condition_check.php');
    }

    /** Les `case 'x':` du switch de personadle_verify_condition(). */
    private static function handledTypes(): array
    {
        $src   = self::$libSource;
        $start = strpos($src, 'function personadle_verify_condition');
        $end   = strpos($src, 'function personadle_known_condition_types');
        self::assertNotFalse($start, 'personadle_verify_condition introuvable');
        self::assertNotFalse($end, 'personadle_known_condition_types introuvable');

        preg_match_all("/case\s+'([a-z_0-9]+)'/", substr($src, $start, $end - $start), $m);
        $types = array_values(array_unique($m[1]));
        sort($types);
        return $types;
    }

    /**
     * Les condition_type réellement seedés, par table, depuis sql/bdd_mysql.sql.
     *
     * Découpage par COLONNE et non par motif : une première version capturait
     * « littéral, littéral-ou-NULL, entier-ou-NULL », ce qui attrapait aussi
     * (`id`, `game`, `is_default`) dans le seed des wallpapers et faisait passer
     * sept identifiants de fonds d'écran pour des condition_type. La position de
     * la colonne est la seule lecture fiable.
     */
    private static function seededTypes(): array
    {
        $sql   = file_get_contents(__DIR__ . '/../../sql/bdd_mysql.sql');
        $found = [];

        foreach (['badges', 'wallpapers', 'titles'] as $table) {
            $ok = preg_match(
                '/INSERT (?:IGNORE )?INTO ' . $table . '\s*\(([^)]*)\)\s*VALUES(.*?);\s*\n/s',
                $sql,
                $m
            );
            self::assertSame(1, $ok, "seed de la table $table introuvable dans bdd_mysql.sql");

            $cols = array_map(fn($c) => trim($c, " `\t\r\n"), explode(',', $m[1]));
            $idx  = array_search('condition_type', $cols, true);
            self::assertNotFalse($idx, "$table n'a pas de colonne condition_type");

            // Les commentaires de fin de ligne (« -- migration 044 ») vivent DANS le
            // corps du VALUES, entre deux lignes. Sans ce nettoyage préalable ils
            // sont recollés à la ligne suivante et la décalent d'une colonne.
            $body = preg_replace('/--[^\n]*/', '', $m[2]);
            $rows = self::splitRows($body);
            self::assertNotEmpty($rows, "aucune ligne lue dans le seed de $table");

            foreach ($rows as $row) {
                $fields = self::splitFields($row);
                self::assertCount(
                    count($cols),
                    $fields,
                    "$table : ligne mal découpée (" . count($fields) . ' champs pour '
                    . count($cols) . " colonnes) — " . substr($row, 0, 60)
                );
                $raw = trim($fields[$idx]);
                if (strcasecmp($raw, 'NULL') === 0) continue;
                $found[$table][trim($raw, "'")] = true;
            }
        }
        return array_map(fn($set) => array_keys($set), $found);
    }

    /** Découpe le corps d'un VALUES en lignes, en ignorant les parenthèses des chaînes. */
    private static function splitRows(string $body): array
    {
        $rows = [];
        $depth = 0;
        $cur = '';
        $inStr = false;
        $len = strlen($body);

        for ($i = 0; $i < $len; $i++) {
            $ch = $body[$i];
            if ($inStr) {
                // SQL échappe l'apostrophe en la doublant ('' dans « Don''t »).
                if ($ch === "'" && ($body[$i + 1] ?? '') === "'") {
                    $cur .= "''";
                    $i++;
                    continue;
                }
                if ($ch === "'") $inStr = false;
                $cur .= $ch;
                continue;
            }
            if ($ch === "'") { $inStr = true; $cur .= $ch; continue; }
            if ($ch === '(') {
                $depth++;
                if ($depth === 1) { $cur = ''; continue; }
            }
            if ($ch === ')') {
                $depth--;
                if ($depth === 0) { $rows[] = $cur; $cur = ''; continue; }
            }
            if ($depth > 0) $cur .= $ch;
        }
        return $rows;
    }

    /** Découpe une ligne en champs, en ignorant les virgules à l'intérieur des chaînes. */
    private static function splitFields(string $row): array
    {
        $out = [];
        $cur = '';
        $inStr = false;
        $len = strlen($row);

        for ($i = 0; $i < $len; $i++) {
            $ch = $row[$i];
            if ($inStr) {
                if ($ch === "'" && ($row[$i + 1] ?? '') === "'") { $cur .= "''"; $i++; continue; }
                if ($ch === "'") $inStr = false;
                $cur .= $ch;
                continue;
            }
            if ($ch === "'") { $inStr = true; $cur .= $ch; continue; }
            if ($ch === ',') { $out[] = trim($cur); $cur = ''; continue; }
            $cur .= $ch;
        }
        $out[] = trim($cur);
        return $out;
    }

    /** Retire commentaires de bloc et de ligne d'une source PHP (analyse de code seul). */
    private static function stripComments(string $php): string
    {
        $out = '';
        foreach (token_get_all($php) as $tok) {
            if (is_array($tok) && in_array($tok[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $out .= is_array($tok) ? $tok[1] : $tok;
        }
        return $out;
    }

    public function testKnownTypesListMatchesTheSwitchExactly(): void
    {
        $handled = self::handledTypes();
        $known   = personadle_known_condition_types();
        sort($known);

        $missing = array_values(array_diff($handled, $known));
        $extra   = array_values(array_diff($known, $handled));

        $this->assertSame(
            [],
            $missing,
            "Types gérés par le switch mais absents de personadle_known_condition_types() : "
            . implode(', ', $missing)
            . ". Le fail-closed des endpoints d'unlock les REFUSERAIT, alors que la logique "
            . "sait les évaluer — un déblocage légitime répondrait 403 pour toujours."
        );

        $this->assertSame(
            [],
            $extra,
            "Types déclarés « connus » mais qu'aucun case du switch ne gère : "
            . implode(', ', $extra)
            . ". Ils tomberaient dans le `default: return true` — donc accordés sans "
            . "vérification, tout en ayant passé la garde fail-closed."
        );
    }

    public function testEverySeededConditionTypeIsInTheVocabulary(): void
    {
        $known = personadle_known_condition_types();

        foreach (self::seededTypes() as $table => $types) {
            $this->assertNotEmpty($types, "aucun condition_type détecté dans le seed de $table");
            foreach ($types as $type) {
                $this->assertContains(
                    $type,
                    $known,
                    "$table : le condition_type '$type' est seedé mais absent du vocabulaire. "
                    . "Chaque ligne qui l'utilise est indébloquable (403) depuis le fail-closed."
                );
            }
        }
    }

    public function testTheTwoTypesThatHadDriftedAreCoveredBothWays(): void
    {
        // Régression nommée : ces deux-là sont ceux qui manquaient. Le test
        // générique ci-dessus suffirait, mais il ne dirait pas POURQUOI la liste
        // compte — et `sees` / `tatsuya_dont_burn_out` sont les titres qui en
        // dépendent.
        foreach (['titles_count', 'played_on_date'] as $type) {
            $this->assertContains($type, personadle_known_condition_types(), "$type hors vocabulaire");
            $this->assertContains($type, self::handledTypes(), "$type non géré par le switch");
        }
    }

    public function testFailClosedRefusesWhatTheGenericCheckWouldAllow(): void
    {
        // Le contraste qui justifie l'existence des deux fonctions. Aucun accès
        // base : ces trois cas sont tranchés avant toute requête.
        $pdo = $this->createStub(PDO::class);

        foreach ([null, '', 'not_a_real_type', 'social_link_rank_10'] as $bogus) {
            $this->assertFalse(
                personadle_condition_allows_unlock($pdo, 1, $bogus, null, null),
                sprintf("condition_type %s doit être refusé par le fail-closed", var_export($bogus, true))
            );
        }
    }

    public function testFailClosedStillLetsManualThrough(): void
    {
        // 'manual' est reconnu ET toujours vrai : le fail-closed ferme le trou des
        // types INCONNUS, il ne change rien aux conditions déclaratives assumées.
        $pdo = $this->createStub(PDO::class);

        $this->assertTrue(personadle_condition_allows_unlock($pdo, 1, 'manual', null, null));
        $this->assertTrue(personadle_condition_allows_unlock($pdo, 1, 'joker_profile', null, null));
    }

    public function testThreeUnlockEndpointsShareTheSameDoor(): void
    {
        // Le trou d'origine : wallpapers était fail-closed dans son coin, badges et
        // titles appelaient la fonction permissive en direct. Trois copies d'une
        // même règle = deux qui dérivent. Ce test garde le point de convergence.
        foreach (['badges', 'titles', 'wallpapers'] as $endpoint) {
            $src = file_get_contents(__DIR__ . "/../../api/$endpoint/index.php");

            $this->assertStringContainsString(
                'personadle_condition_allows_unlock',
                $src,
                "api/$endpoint/index.php doit passer par la porte fail-closed"
            );

            // Sur le CODE seul : les trois fichiers expliquent en commentaire
            // pourquoi ils n'appellent plus personadle_verify_condition() en
            // direct, et une recherche de texte brut retomberait sur ces
            // explications. C'est l'appel qui compte, pas la mention.
            $this->assertStringNotContainsString(
                'personadle_verify_condition(',
                self::stripComments($src),
                "api/$endpoint/index.php appelle encore la fonction permissive en direct : "
                . "un condition_type inconnu y serait accordé au lieu d'être refusé."
            );
        }
    }
}
