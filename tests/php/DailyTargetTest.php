<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/daily_target.php';

/**
 * Tests du portage PHP de l'algorithme de tirage quotidien seedé
 * (js/gameCore.js::getDailyTarget()) — api/lib/daily_target.php.
 *
 * Les cas ci-dessous ont été validés en comparant directement la sortie de
 * cette classe avec celle de getDailyTarget() exécuté sous Node avec les
 * mêmes seed/date/mode/pool (cross-check manuel, voir la PR qui a introduit
 * ce fichier pour la méthode). Toute modification de l'algorithme FNV-1a doit
 * réussir la même vérification croisée avant merge.
 */
final class DailyTargetTest extends TestCase
{
    // ── personadle_fnv1a_index ──────────────────────────────────────────────

    public function testFnv1aIndexIsDeterministic(): void
    {
        $a = personadle_fnv1a_index('42', '2026-07-05', 'Classic', 177);
        $b = personadle_fnv1a_index('42', '2026-07-05', 'Classic', 177);
        $this->assertSame($a, $b);
    }

    public function testFnv1aIndexChangesWithSeed(): void
    {
        $a = personadle_fnv1a_index('1', '2026-07-05', 'Classic', 177);
        $b = personadle_fnv1a_index('2', '2026-07-05', 'Classic', 177);
        $this->assertNotSame($a, $b);
    }

    public function testFnv1aIndexChangesWithDate(): void
    {
        $a = personadle_fnv1a_index('42', '2026-07-05', 'Classic', 177);
        $b = personadle_fnv1a_index('42', '2026-07-06', 'Classic', 177);
        $this->assertNotSame($a, $b);
    }

    public function testFnv1aIndexChangesWithMode(): void
    {
        $a = personadle_fnv1a_index('42', '2026-07-05', 'Classic', 177);
        $b = personadle_fnv1a_index('42', '2026-07-05', 'Emoji', 177);
        $this->assertNotSame($a, $b);
    }

    public function testFnv1aIndexMatchesJsReferenceValues(): void
    {
        // Cross-checked contre getDailyTarget(pool10, mode, date, seed) en Node,
        // avec pool = ['a'..'j'] (10 éléments) — voir docstring de la classe.
        $this->assertSame(9, personadle_fnv1a_index('42', '2026-07-05', 'Classic', 10)); // 'j'
        $this->assertSame(8, personadle_fnv1a_index('1', '2026-07-05', 'Classic', 10)); // 'i'
        $this->assertSame(5, personadle_fnv1a_index('12345', '2026-01-01', 'Personae', 10)); // 'f'
        $this->assertSame(7, personadle_fnv1a_index('999999', '2026-12-31', 'Music', 10)); // 'h'
        // Revue PR #13 : seuls Classic/Personae/Music avaient une valeur de hash cross-vérifiée
        // ci-dessus — Emoji/Silhouette/AllOutAttack n'avaient qu'un test de bornes plus bas
        // (testFnv1aIndexAlwaysWithinPoolBounds), qui ne peut pas détecter une dérive de
        // l'algorithme entre js/gameCore.js et ce portage PHP. Complété ici avec les 3 modes
        // manquants pour qu'un changement de getDailyTarget() non répercuté ici casse la CI
        // au lieu de remplir error_log de faux positifs silencieusement.
        $this->assertSame(2, personadle_fnv1a_index('7', '2026-03-14', 'Emoji', 10)); // 'c'
        $this->assertSame(3, personadle_fnv1a_index('99', '2026-11-20', 'Silhouette', 10)); // 'd'
        $this->assertSame(7, personadle_fnv1a_index('555', '2026-05-01', 'AllOutAttack', 10)); // 'h'
    }

    public function testFnv1aIndexAlwaysWithinPoolBounds(): void
    {
        for ($i = 0; $i < 50; $i++) {
            $idx = personadle_fnv1a_index((string) $i, '2026-07-05', 'Silhouette', 152);
            $this->assertGreaterThanOrEqual(0, $idx);
            $this->assertLessThan(152, $idx);
        }
    }

    // ── personadle_pick_from_pool ────────────────────────────────────────────

    public function testPickFromPoolReturnsNullForEmptyPool(): void
    {
        $this->assertNull(personadle_pick_from_pool([], 'Classic', '2026-07-05', '1'));
    }

    public function testPickFromPoolReturnsAnElementOfThePool(): void
    {
        $pool = ['Naoya Todou', 'Yosuke Hanamura', 'Yusuke Kitagawa'];
        $pick = personadle_pick_from_pool($pool, 'Classic', '2026-07-05', '1');
        $this->assertContains($pick, $pool);
    }

    // ── personadle_compute_daily_target ──────────────────────────────────────

    public function testComputeDailyTargetReturnsNullForUnknownMode(): void
    {
        $this->assertNull(personadle_compute_daily_target('unknown_mode', '2026-07-05', '1', []));
    }

    public function testComputeDailyTargetIsStableForTheSameInputs(): void
    {
        $a = personadle_compute_daily_target('classic', '2026-07-05', '42', []);
        $b = personadle_compute_daily_target('classic', '2026-07-05', '42', []);
        $this->assertSame($a, $b);
        $this->assertIsString($a);
    }

    public function testComputeDailyTargetDiffersPerPlayer(): void
    {
        $a = personadle_compute_daily_target('classic', '2026-07-05', '1', []);
        $b = personadle_compute_daily_target('classic', '2026-07-05', '2', []);
        // Pas garanti à 100% mathématiquement (collision possible) mais vrai en
        // pratique sur un pool de 177 éléments — sert de garde-fou anti-régression
        // si quelqu'un remplace le hash par un algorithme non seedé par joueur.
        $this->assertNotSame($a, $b);
    }

    public function testComputeDailyTargetForPersonaeReturnsAUserString(): void
    {
        $target = personadle_compute_daily_target('personae', '2026-07-05', '42', []);
        $this->assertIsString($target);
    }

    public function testComputeDailyTargetForAllOutAttackFallsBackToFilteredPoolWhenDailyIsExcluded(): void
    {
        $unfiltered = personadle_compute_daily_target('alloutattack', '2026-07-05', '42', []);
        $this->assertIsString($unfiltered);

        // Filtre très restrictif : si la cible non filtrée n'appartient pas à P3,
        // le calcul doit retomber sur un pick filtré appartenant bien à P3.
        $filtered = personadle_compute_daily_target('alloutattack', '2026-07-05', '42', ['P3']);
        $this->assertIsString($filtered);

        $pools = personadle_load_daily_pools();
        $opusByName = $pools['alloutattack']['opusByName'] ?? [];
        $this->assertContains('P3', $opusByName[$filtered] ?? []);
    }

    public function testComputeDailyTargetForPersonaeFallsBackToFilteredPoolWhenDailyIsExcluded(): void
    {
        // "P4" (pas "P1" — Personae n'a pas de filtre P1, cf. ALL_OPUS dans
        // modePersonae.js) : seed/date choisis pour déclencher réellement le
        // fallback (la cible non filtrée n'est pas un persona P4). Recalculé le
        // 2026-08-13 (contenu 2.1 : plusieurs entrées du pool personae ont reçu
        // l'opus P4AU, ce qui a décalé le tirage seedé — l'ancien couple
        // date/seed ne déclenchait plus le fallback avec le nouveau contenu).
        $unfiltered = personadle_compute_daily_target('personae', '2026-08-01', '1', []);
        $filtered = personadle_compute_daily_target('personae', '2026-08-01', '1', ['P4']);
        $this->assertNotSame($unfiltered, $filtered, 'Ce cas de test doit déclencher le fallback filtré');

        // Au moins UNE entrée du pool doit partager ce `user` et appartenir à P4 —
        // le fallback (comme le pick sans filtre) est comparé sur `persona`, pas
        // `user` (un perso peut avoir plusieurs personas dans des opus différents),
        // donc on ne peut pas supposer que la première entrée trouvée pour ce
        // `user` est la bonne.
        $pools = personadle_load_daily_pools();
        $entries = $pools['personae']['pool'] ?? [];
        $hasMatchingP4Entry = false;
        foreach ($entries as $e) {
            if ($e['user'] === $filtered && in_array('P4', $e['opus'] ?? [], true)) {
                $hasMatchingP4Entry = true;
                break;
            }
        }
        $this->assertTrue($hasMatchingP4Entry, "Aucune entrée P4 du pool Personae ne correspond à \"$filtered\"");
    }

    // ── Repli filtré des quatre modes à pool de noms (2.2) ──────────────────
    //
    // Avant : Classic/Emoji/Silhouette/Music tiraient hors filtres — un joueur
    // « P5 uniquement » pouvait recevoir un personnage P3 que l'autocomplétion ne
    // proposait jamais. Le client (getDailyTargetWithin) et ce fichier re-tirent
    // désormais dans le pool filtré ; parité JS ↔ PHP vérifiée sur 1296 cas au
    // moment du changement (0 écart, 775 re-tirages effectifs).

    /** @return list<array{string, string, string}> [mode, clé du pool, clé de la table d'opus] */
    private static function filteredNameModes(): array
    {
        return [
            ['classic',           'classic',        'classic'],
            ['classic_expert',    'classic_expert', 'classic'],
            ['emoji',             'emoji',          'emoji'],
            ['emoji_expert',      'emoji',          'emoji'],
            ['silhouette',        'silhouette',     'silhouette'],
            ['silhouette_expert', 'silhouette',     'silhouette'],
            ['music',             'music',          'music'],
            ['music_expert',      'music_expert',   'music'],
            ['alloutattack',      'alloutattack',   'alloutattack'],
            ['alloutattack_expert', 'alloutattack', 'alloutattack'],
        ];
    }

    public function testEveryNamePoolCarriesAnOpusTable(): void
    {
        $pools = personadle_load_daily_pools();
        foreach (['classic', 'emoji', 'silhouette', 'music', 'alloutattack'] as $key) {
            $this->assertArrayHasKey('opusByName', $pools[$key], "$key sans table d'opus");
            foreach ($pools[$key]['pool'] as $name) {
                $this->assertArrayHasKey($name, $pools[$key]['opusByName'], "$key : « $name » sans opus");
                $this->assertNotEmpty($pools[$key]['opusByName'][$name], "$key : « $name » opus vide");
            }
        }
    }

    public function testFilteredModesAlwaysReturnATargetInsideTheActiveFilters(): void
    {
        $pools = personadle_load_daily_pools();
        $filters = [['P5'], ['P1'], ['P3', 'P3FES', 'P3P'], ['P4G'], ['P2IS', 'P2EP'], ['P5R'], ['PTS']];
        $fallbacks = 0;
        foreach (self::filteredNameModes() as [$mode, $poolKey, $opusKey]) {
            $opusByName = $pools[$opusKey]['opusByName'];
            foreach (['2026-09-17', '2026-03-29', '2026-12-31', '2027-02-28'] as $date) {
                foreach (['1', '42', '12345'] as $seed) {
                    $unfiltered = personadle_compute_daily_target($mode, $date, $seed, []);
                    foreach ($filters as $f) {
                        $filteredPool = array_values(array_filter(
                            $pools[$poolKey]['pool'],
                            fn ($n) => count(array_intersect($opusByName[$n] ?? [], $f)) > 0
                        ));
                        if ($filteredPool === []) continue; // filtre sans entrée pour ce mode
                        $got = personadle_compute_daily_target($mode, $date, $seed, $f);
                        $this->assertIsString($got, "$mode $date $seed");
                        $this->assertNotEmpty(
                            array_intersect($opusByName[$got] ?? [], $f),
                            "$mode $date $seed [" . implode(',', $f) . "] → « $got » hors filtres"
                        );
                        if ($got !== $unfiltered) $fallbacks++;
                    }
                }
            }
        }
        $this->assertGreaterThan(0, $fallbacks, 'au moins un re-tirage doit avoir été exercé');
    }

    public function testFilteredModesKeepTheFullCatalogueTargetWhenItIsInsideTheFilters(): void
    {
        $pools = personadle_load_daily_pools();
        foreach (self::filteredNameModes() as [$mode, $poolKey, $opusKey]) {
            $unfiltered = personadle_compute_daily_target($mode, '2026-09-17', '42', []);
            $opus = $pools[$opusKey]['opusByName'][$unfiltered];
            // Filtrer sur les opus DE la cible : elle doit rester la même.
            $this->assertSame($unfiltered, personadle_compute_daily_target($mode, '2026-09-17', '42', $opus), $mode);
        }
    }

    public function testAFilterThatEmptiesThePoolFallsBackToTheFullCatalogue(): void
    {
        foreach (self::filteredNameModes() as [$mode]) {
            $unfiltered = personadle_compute_daily_target($mode, '2026-09-17', '42', []);
            $this->assertSame($unfiltered, personadle_compute_daily_target($mode, '2026-09-17', '42', ['ZZZ']), $mode);
        }
    }

    public function testExpertVariantsStillDrawIndependentlyFromTheirNormalMode(): void
    {
        // Même filtre, même joueur, même jour : normal et Expert ne doivent pas
        // systématiquement tomber sur la même cible (sinon jouer le normal d'abord
        // révèle l'Expert). Sur 30 tirages, au moins un diffère.
        foreach ([['classic', 'classic_expert'], ['emoji', 'emoji_expert'], ['silhouette', 'silhouette_expert'], ['music', 'music_expert']] as [$normal, $expert]) {
            $differ = 0;
            for ($d = 1; $d <= 30; $d++) {
                $date = sprintf('2026-08-%02d', $d);
                if (personadle_compute_daily_target($normal, $date, '42', ['P5']) !== personadle_compute_daily_target($expert, $date, '42', ['P5'])) $differ++;
            }
            $this->assertGreaterThan(0, $differ, "$normal / $expert tirent toujours la même cible");
        }
    }

    public function testMusicExpertFilteredTargetAlwaysHasLyrics(): void
    {
        $pools = personadle_load_daily_pools();
        for ($d = 1; $d <= 28; $d++) {
            $date = sprintf('2026-10-%02d', $d);
            foreach ([['P5'], ['P3', 'P3FES', 'P3P'], ['P4G']] as $f) {
                $got = personadle_compute_daily_target('music_expert', $date, '7', $f);
                $this->assertContains($got, $pools['music_expert']['pool'], "cible hors pool Expert le $date");
            }
        }
    }

    public function testPersonaeHomonymFromAnotherOpusDoesNotCountAsPresent(): void
    {
        // Prometheus est porté par Futaba (P5/P5R) ET Baofu (P2EP) — même nom,
        // deux entrées. Comparer par nom faisait passer celui de Futaba pour
        // « présent » chez un joueur « P2 uniquement » ; on compare par index.
        $pools = personadle_load_daily_pools();
        $entries = $pools['personae']['pool'];
        $p2 = array_values(array_filter($entries, fn ($e) => count(array_intersect($e['opus'], ['P2IS', 'P2EP'])) > 0));
        $this->assertNotEmpty(array_filter($p2, fn ($e) => $e['persona'] === 'Prometheus'), 'le jeu de données a changé : plus de Prometheus P2');
        $p2Users = array_map(fn ($e) => $e['user'], $p2);
        foreach (['2026-09-17', '2026-03-29', '2026-12-31', '2027-02-28', '2026-06-06', '2026-11-11'] as $date) {
            foreach (['1', '42', '12345', '777', '31337', '9f3c1a2b-anon'] as $seed) {
                $got = personadle_compute_daily_target('personae', $date, $seed, ['P2IS', 'P2EP']);
                $this->assertContains($got, $p2Users, "$date $seed → « $got » n'est pas un personnage P2");
            }
        }
    }

    // ── Mode Expert ─────────────────────────────────────────────────────────

    public function testMusicExpertPoolIsAStrictSubsetOfMusic(): void
    {
        $pools = personadle_load_daily_pools();
        $this->assertArrayHasKey('music_expert', $pools, 'pool music_expert absent — lancer npm run pools:build');

        $music  = $pools['music']['pool'];
        $expert = $pools['music_expert']['pool'];

        $this->assertNotEmpty($expert);
        $this->assertLessThan(count($music), count($expert), 'les instrumentales doivent être exclues');
        foreach ($expert as $titre) {
            $this->assertContains($titre, $music, "« $titre » n'existe pas dans le pool music");
        }
    }

    public function testMusicExpertPoolKeepsSourceOrder(): void
    {
        $pools = personadle_load_daily_pools();
        // L'ordre pilote l'index du tirage (hash % len) : un pool réordonné change
        // la cible de tout le monde. Il doit rester celui de songs.js.
        $filtered = array_values(array_filter(
            $pools['music']['pool'],
            static fn ($t) => in_array($t, $pools['music_expert']['pool'], true)
        ));
        $this->assertSame($filtered, $pools['music_expert']['pool']);
    }

    public function testMusicExpertDrawsADifferentTargetThanMusic(): void
    {
        // Le cœur de la décision produit : si les deux modes tiraient la même
        // chanson, jouer le normal (où l'audio est donné) offrirait l'Expert.
        $identiques = 0;
        for ($d = 1; $d <= 28; $d++) {
            $date = sprintf('2026-09-%02d', $d);
            $normal = personadle_compute_daily_target('music', $date, '42', []);
            $expert = personadle_compute_daily_target('music_expert', $date, '42', []);
            $this->assertNotNull($normal);
            $this->assertNotNull($expert);
            if ($normal === $expert) {
                $identiques++;
            }
        }
        // Une collision occasionnelle est normale (deux tirages indépendants sur des
        // pools qui se recouvrent) ; une égalité systématique voudrait dire que la
        // clé de hash n'a pas été différenciée.
        $this->assertLessThan(5, $identiques, 'les deux tirages semblent corrélés');
    }

    public function testMusicExpertTargetAlwaysHasLyrics(): void
    {
        $pools = personadle_load_daily_pools();
        for ($d = 1; $d <= 31; $d++) {
            $date = sprintf('2026-10-%02d', $d);
            $cible = personadle_compute_daily_target('music_expert', $date, '7', []);
            $this->assertContains($cible, $pools['music_expert']['pool'], "cible hors pool le $date");
        }
    }

    public function testUnknownModeStillReturnsNull(): void
    {
        $this->assertNull(personadle_compute_daily_target('music_expert_typo', '2026-09-01', '42', []));
    }
}
