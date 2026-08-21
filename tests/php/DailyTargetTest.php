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
