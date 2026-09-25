<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/weekly_podium.php';

/**
 * Le récapitulatif hebdomadaire Discord : portraits, amitiés, mot d'accueil.
 *
 * Le portrait est la partie piégeuse. La plupart des joueurs ont un portrait
 * RECADRÉ, stocké en base64 dans `profiles.avatar_data` — Discord, lui, va
 * chercher l'image à une adresse et ne sait rien faire d'une data-URL. Mesuré en
 * production le 2026-09-26 : 43 profils sur 328 ont une adresse utilisable.
 *
 * Deux exigences en découlent, et ce fichier tient les deux :
 *   1. ne jamais fabriquer une URL qui n'en est pas une — ces valeurs viennent
 *      de la base, donc d'une saisie utilisateur passée par l'API ;
 *   2. rendre `null` proprement plutôt qu'une image cassée, pour que le message
 *      reste lisible quand personne n'a de portrait affichable.
 */
final class WeeklyDigestTest extends TestCase
{
    // ── Ce qui donne une URL ────────────────────────────────────────────────

    public function testCheminDeGalerieDevientUneUrlPublique(): void
    {
        self::assertSame(
            'https://www.personadle.net/img/avatar/Yuki.gif',
            personadle_weekly_avatar_url('../img/avatar/Yuki.gif', null)
        );
    }

    public function testAvatarDataSertDeRepliQuandAvatarSrcEstVide(): void
    {
        // `avatar_src` n'existe que depuis la 052 : les profils plus anciens
        // portent encore leur chemin dans `avatar_data`.
        self::assertSame(
            'https://www.personadle.net/img/avatar/Futaba.webp',
            personadle_weekly_avatar_url(null, '../img/avatar/Futaba.webp')
        );
    }

    public function testAvatarSrcEstPrioritaireSurAvatarData(): void
    {
        self::assertSame(
            'https://www.personadle.net/img/avatar/Ann.jpg',
            personadle_weekly_avatar_url('../img/avatar/Ann.jpg', 'data:image/png;base64,AAAA')
        );
    }

    /** Les extensions réellement présentes dans la galerie. */
    public function testToutesLesExtensionsDeLaGalerieSontAcceptees(): void
    {
        foreach (['gif', 'png', 'jpg', 'jpeg', 'webp', 'avif'] as $ext) {
            self::assertNotNull(
                personadle_weekly_avatar_url("../img/avatar/Test.$ext", null),
                "extension .$ext refusée à tort"
            );
        }
    }

    // ── Ce qui n'en donne pas ───────────────────────────────────────────────

    public function testPortraitRecadreNeDonneRien(): void
    {
        // Le cas majoritaire. Une data-URL passée en `thumbnail` ferait afficher
        // un encart cassé à Discord.
        self::assertNull(personadle_weekly_avatar_url(null, 'data:image/png;base64,iVBORw0KGgo='));
    }

    public function testValeursVidesOuAbsentes(): void
    {
        self::assertNull(personadle_weekly_avatar_url(null, null));
        self::assertNull(personadle_weekly_avatar_url('', ''));
        self::assertNull(personadle_weekly_avatar_url('   ', null));
    }

    public function testRemonteeDeDossierRefusee(): void
    {
        // Ces valeurs viennent de la base. Une chaîne fantaisiste ne doit pas
        // devenir une adresse qu'on demande à Discord d'aller chercher.
        self::assertNull(personadle_weekly_avatar_url('../img/avatar/../../etc/passwd', null));
        self::assertNull(personadle_weekly_avatar_url('../../../secret.png', null));
    }

    public function testUrlExterneRefusee(): void
    {
        self::assertNull(personadle_weekly_avatar_url('https://ailleurs.example/x.png', null));
        self::assertNull(personadle_weekly_avatar_url('//ailleurs.example/x.png', null));
    }

    public function testNomHorsListeBlancheRefuse(): void
    {
        self::assertNull(personadle_weekly_avatar_url('../img/avatar/avec espace.png', null));
        self::assertNull(personadle_weekly_avatar_url('../img/avatar/sans_extension', null));
        self::assertNull(personadle_weekly_avatar_url('../img/wallpaper/X.png', null));
    }

    // ── Les amitiés ─────────────────────────────────────────────────────────

    public function testLignesDAmitieAvecMedailles(): void
    {
        $lignes = personadle_weekly_bond_lines([
            ['a' => 'Hamza', 'b' => 'Colonel-Maskou', 'xp' => 4200, 'rank' => 10],
            ['a' => 'Sr.Toad', 'b' => 'Shadow', 'xp' => 1500, 'rank' => 7],
        ]);
        self::assertStringContainsString('🥇', $lignes);
        self::assertStringContainsString('🥈', $lignes);
        self::assertStringNotContainsString('🥉', $lignes, 'pas de 3e médaille pour 2 amitiés');
        self::assertStringContainsString('4 200 XP', $lignes, "l'XP est lisible, espace fin");
    }

    public function testPseudoDAmitieEstEchappe(): void
    {
        // Un pseudo en Markdown détournerait la mise en forme de l'embed.
        $lignes = personadle_weekly_bond_lines([
            ['a' => '**gras**', 'b' => '_italique_', 'xp' => 10, 'rank' => 1],
        ]);
        self::assertStringNotContainsString('**gras**', $lignes);
    }

    public function testJamaisPlusDeTroisAmities(): void
    {
        $quatre = array_fill(0, 4, ['a' => 'A', 'b' => 'B', 'xp' => 1, 'rank' => 1]);
        self::assertCount(3, explode("\n", personadle_weekly_bond_lines($quatre)));
    }

    public function testAucuneAmitieDonneUneChaineVide(): void
    {
        self::assertSame('', personadle_weekly_bond_lines([]));
    }

    // ── Le mot d'accueil ────────────────────────────────────────────────────

    public function testIntroTourneEtEstBilingue(): void
    {
        $i = personadle_weekly_intro(3);
        self::assertArrayHasKey('fr', $i);
        self::assertArrayHasKey('en', $i);
        self::assertNotSame('', trim($i['fr']));
        self::assertNotSame('', trim($i['en']));
    }

    public function testLaRotationDeriveDUneAnneeSurLAutre(): void
    {
        // Si le nombre de phrases divisait 52 sans reste, la même phrase
        // retomberait sur la même semaine chaque année — le rendez-vous
        // hebdomadaire deviendrait un calendrier fixe.
        $vues = [];
        for ($w = 0; $w < 60; $w++) $vues[] = personadle_weekly_intro($w)['fr'];
        $nb = count(array_unique($vues));
        self::assertGreaterThan(1, $nb);
        self::assertNotSame(0, 52 % $nb, "$nb phrases divisent 52 : la rotation se figerait");
    }

    public function testLIntroNeSortJamaisDuTableau(): void
    {
        foreach ([0, 1, 52, 53, 999] as $w) {
            self::assertIsArray(personadle_weekly_intro($w), "semaine $w");
        }
    }
}
