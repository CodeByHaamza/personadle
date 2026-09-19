<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/validation.php';

/**
 * Tests des règles de validation d'inscription/reset (api/lib/validation.php).
 * Aucun accès base de données — fonctions pures.
 */
final class ValidationTest extends TestCase
{
    // ── personadle_validate_pseudo ──────────────────────────────────────────

    public function testAcceptsAValidPseudo(): void
    {
        $this->assertNull(personadle_validate_pseudo('Joker_42'));
    }

    public function testRejectsPseudoShorterThan3Chars(): void
    {
        $this->assertNotNull(personadle_validate_pseudo('ab'));
    }

    public function testAcceptsPseudoAtExactly3Chars(): void
    {
        $this->assertNull(personadle_validate_pseudo('abc'));
    }

    public function testAcceptsPseudoAtExactly50Chars(): void
    {
        $this->assertNull(personadle_validate_pseudo(str_repeat('a', 50)));
    }

    public function testRejectsPseudoLongerThan50Chars(): void
    {
        $this->assertNotNull(personadle_validate_pseudo(str_repeat('a', 51)));
    }

    public function testRejectsPseudoWithSpaces(): void
    {
        $this->assertNotNull(personadle_validate_pseudo('joker persona'));
    }

    public function testRejectsPseudoWithHtmlInjectionAttempt(): void
    {
        $this->assertNotNull(personadle_validate_pseudo('<script>alert(1)</script>'));
    }

    public function testAcceptsPseudoWithDotsHyphensUnderscores(): void
    {
        $this->assertNull(personadle_validate_pseudo('joker.the-thief_42'));
    }

    // ── personadle_validate_password ────────────────────────────────────────

    public function testRejectsPasswordShorterThan8Chars(): void
    {
        $this->assertNotNull(personadle_validate_password('short1'));
    }

    public function testAcceptsPasswordAtExactly8Chars(): void
    {
        $this->assertNull(personadle_validate_password('xj4k9wpz'));
    }

    public function testAcceptsLongPassword(): void
    {
        $this->assertNull(personadle_validate_password('a-very-long-passphrase-indeed'));
    }

    public function testRejectsCommonPasswordEvenIfLongEnough(): void
    {
        $this->assertNotNull(personadle_validate_password('12345678'));
        $this->assertNotNull(personadle_validate_password('password123'));
    }

    public function testRejectsCommonPasswordCaseInsensitively(): void
    {
        $this->assertNotNull(personadle_validate_password('PASSWORD1'));
    }

    // ── personadle_normalize_lang ────────────────────────────────────────────

    public function testKeepsASupportedLang(): void
    {
        $this->assertSame('fr', personadle_normalize_lang('fr'));
    }

    public function testFallsBackToEnglishForUnsupportedLang(): void
    {
        $this->assertSame('en', personadle_normalize_lang('jp'));
    }

    public function testFallsBackToEnglishForEmptyLang(): void
    {
        $this->assertSame('en', personadle_normalize_lang(''));
    }

    public function testKeepsPortuguese(): void
    {
        // `pt` manquait aux trois listes locales (register, PATCH profil, admin) :
        // un joueur en portugais était inscrit en `en` et voyait son PATCH profil
        // entier refusé en 400.
        $this->assertSame('pt', personadle_normalize_lang('pt'));
    }

    public function testSupportedLangsMatchTheLangFiles(): void
    {
        // Une langue = un fichier lang/*.json. La liste PHP ne doit ni en oublier
        // (le cas `pt`) ni en inventer.
        $files = array_map(
            static fn (string $f): string => basename($f, '.json'),
            glob(__DIR__ . '/../../lang/*.json') ?: []
        );
        sort($files);
        $langs = PERSONADLE_SUPPORTED_LANGS;
        sort($langs);
        $this->assertSame($files, $langs);
    }

    // ── personadle_validate_avatar ───────────────────────────────────────────
    // 2.2 : deux formes valides — le chemin d'un portrait de la galerie (seule
    // forme possible pour un GIF animé, refusée en 400 jusqu'ici) et son
    // recadrage encodé. Tout le reste est refusé ; côté client, il n'y a plus
    // d'import d'image du tout (décision Hamza du 2026-09-16, dérives).

    private function galleryDir(): string
    {
        $dir = sys_get_temp_dir() . '/personadle_avatars_' . getmypid();
        if (!is_dir($dir)) {
            mkdir($dir);
            touch($dir . '/Ren.gif');
            touch($dir . '/Eriko.png');
            touch($dir . '/Kanji.avif');
            touch($dir . '/Caroline&justine.png');
        }
        return $dir;
    }

    public function testAvatarNullMeansRemoveAndIsValid(): void
    {
        $this->assertNull(personadle_validate_avatar(null, $this->galleryDir()));
    }

    public function testAvatarAcceptsACroppedPortrait(): void
    {
        // Le recadrage d'un portrait sort du canvas en PNG/JPEG/WebP encodé.
        $this->assertNull(personadle_validate_avatar('data:image/png;base64,iVBORw0KGgo=', $this->galleryDir()));
        $this->assertNull(personadle_validate_avatar('data:image/jpeg;base64,/9j/4AAQ', $this->galleryDir()));
        $this->assertNull(personadle_validate_avatar('data:image/webp;base64,UklGR', $this->galleryDir()));
    }

    public function testAvatarRejectsNonImageDataUrls(): void
    {
        foreach ([
            'data:image/svg+xml;base64,PHN2Zz4=', // SVG = script potentiel
            'data:text/html,<script>alert(1)</script>',
            'javascript:alert(1)',
        ] as $bad) {
            $this->assertSame(
                'Invalid avatar format',
                personadle_validate_avatar($bad, $this->galleryDir()),
                $bad
            );
        }
    }

    public function testAvatarEmptyStringIsTreatedAsNoAvatar(): void
    {
        $this->assertNull(personadle_validate_avatar('', $this->galleryDir()));
    }

    public function testAvatarAcceptsAnExistingGalleryPortrait(): void
    {
        $this->assertNull(personadle_validate_avatar('../img/avatar/Ren.gif', $this->galleryDir()));
        $this->assertNull(personadle_validate_avatar('../img/avatar/Eriko.png', $this->galleryDir()));
    }

    public function testAvatarAcceptsAnAvifGalleryPortrait(): void
    {
        // Kanji.avif est dans la galerie depuis la 2.0 : refusé ici, il restait
        // local et disparaissait au prochain pull cloud (sorti par
        // tests/avatars_gallery.test.js le 2026-09-17).
        $this->assertNull(personadle_validate_avatar('../img/avatar/Kanji.avif', $this->galleryDir()));
    }

    public function testAvatarRejectsAGalleryNameWithCharactersOutsideTheWhitelist(): void
    {
        // Le fichier EXISTE, mais « & » n'est pas dans la liste blanche du nom :
        // c'est pour ça que Caroline&justine.png a été renommée caroline_justine.png.
        $this->assertSame('Invalid avatar format', personadle_validate_avatar('../img/avatar/Caroline&justine.png', $this->galleryDir()));
    }

    public function testAvatarRejectsAGalleryPortraitThatDoesNotExist(): void
    {
        $this->assertSame('Unknown gallery avatar', personadle_validate_avatar('../img/avatar/Nope.gif', $this->galleryDir()));
    }

    // ── personadle_validate_avatar_src (052) ─────────────────────────────────
    // Le portrait galerie d'ORIGINE d'un recadrage : un chemin existant ou rien —
    // jamais une image inline, ce champ dit « qui » est porté, il ne stocke rien.

    public function testAvatarSrcAcceptsNothingOrAnExistingGalleryPortrait(): void
    {
        $this->assertNull(personadle_validate_avatar_src(null, $this->galleryDir()));
        $this->assertNull(personadle_validate_avatar_src('', $this->galleryDir()));
        $this->assertNull(personadle_validate_avatar_src('../img/avatar/Eriko.png', $this->galleryDir()));
        $this->assertNull(personadle_validate_avatar_src('../img/avatar/Kanji.avif', $this->galleryDir()));
    }

    public function testAvatarSrcRejectsInlineImagesAndUnknownPortraits(): void
    {
        $this->assertSame(
            'Invalid avatar_src (gallery path expected)',
            personadle_validate_avatar_src('data:image/png;base64,iVBORw0KGgo=', $this->galleryDir())
        );
        $this->assertSame('Unknown gallery avatar', personadle_validate_avatar_src('../img/avatar/Nope.gif', $this->galleryDir()));
        $this->assertSame('Invalid avatar format', personadle_validate_avatar_src('../img/avatar/../config.php', $this->galleryDir()));
    }

    public function testIsGalleryAvatarTellsAPathFromAnInlineImage(): void
    {
        $this->assertTrue(personadle_is_gallery_avatar('../img/avatar/Eriko.png'));
        $this->assertFalse(personadle_is_gallery_avatar('data:image/png;base64,iVBORw0KGgo='));
        $this->assertFalse(personadle_is_gallery_avatar(null));
        $this->assertFalse(personadle_is_gallery_avatar(''));
    }

    public function testAvatarRejectsAnyOtherPathOrTraversal(): void
    {
        foreach ([
            '../img/avatar/../../api/bootstrap.php',
            '../img/avatar/Ren.gif/../x.gif',
            '/img/avatar/Ren.gif',
            './img/avatar/Ren.gif',
            'https://evil.example/x.gif',
            '../img/avatar/Ren.svg',
            'Ren.gif',
        ] as $bad) {
            $this->assertSame('Invalid avatar format', personadle_validate_avatar($bad, $this->galleryDir()), $bad);
        }
    }

    public function testAvatarRejectsOversizedPayloads(): void
    {
        $huge = 'data:image/png;base64,' . str_repeat('A', 2_000_001);
        $this->assertSame('Avatar too large (max 2 MB base64)', personadle_validate_avatar($huge, $this->galleryDir()));
    }

    public function testAvatarDefaultGalleryIsTheRealOne(): void
    {
        // Sans dossier explicite : la vraie galerie du dépôt (img/avatar/) — le GIF existe
        $this->assertNull(personadle_validate_avatar('../img/avatar/Ren.gif'));
        $this->assertSame('Unknown gallery avatar', personadle_validate_avatar('../img/avatar/DoesNotExist.gif'));
    }
}
