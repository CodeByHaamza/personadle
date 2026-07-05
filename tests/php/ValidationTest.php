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
}
