<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/admin_validation.php';

/**
 * Tests des validations du panel admin (api/lib/admin_validation.php).
 * Aucun accès base de données — fonctions pures.
 */
final class AdminValidationTest extends TestCase
{
    // ── personadle_validate_admin_pseudo ────────────────────────────────────

    public function testAcceptsAValidAdminPseudo(): void
    {
        $this->assertNull(personadle_validate_admin_pseudo('Joker_42'));
    }

    public function testAcceptsPseudoAtExactly2Chars(): void
    {
        // Note : l'admin panel accepte 2 caractères min, contre 3 pour l'inscription
        // publique (personadle_validate_pseudo) — divergence existante, préservée telle quelle.
        $this->assertNull(personadle_validate_admin_pseudo('ab'));
    }

    public function testRejectsPseudoShorterThan2Chars(): void
    {
        $this->assertNotNull(personadle_validate_admin_pseudo('a'));
    }

    public function testAcceptsPseudoAtExactly30Chars(): void
    {
        $this->assertNull(personadle_validate_admin_pseudo(str_repeat('a', 30)));
    }

    public function testRejectsPseudoLongerThan30Chars(): void
    {
        $this->assertNotNull(personadle_validate_admin_pseudo(str_repeat('a', 31)));
    }

    public function testRejectsPseudoWithSpacesOrUnicode(): void
    {
        $this->assertNotNull(personadle_validate_admin_pseudo('joker persona'));
        $this->assertNotNull(personadle_validate_admin_pseudo('jökér'));
    }

    // ── personadle_validate_hex_color ───────────────────────────────────────

    public function testAcceptsAValidHexColor(): void
    {
        $this->assertNull(personadle_validate_hex_color('#ffffff'));
        $this->assertNull(personadle_validate_hex_color('#ABC123'));
    }

    public function testRejectsColorWithoutHash(): void
    {
        $this->assertNotNull(personadle_validate_hex_color('ffffff'));
    }

    public function testRejectsColorWithWrongLength(): void
    {
        $this->assertNotNull(personadle_validate_hex_color('#fff'));
        $this->assertNotNull(personadle_validate_hex_color('#ffffffff'));
    }

    public function testRejectsColorWithInvalidCharacters(): void
    {
        $this->assertNotNull(personadle_validate_hex_color('#gggggg'));
    }

    // ── personadle_validate_event_code ──────────────────────────────────────

    public function testAcceptsAValidEventCode(): void
    {
        $this->assertNull(personadle_validate_event_code('XMAS_2026'));
    }

    public function testRejectsEmptyCode(): void
    {
        $this->assertNotNull(personadle_validate_event_code(''));
    }

    public function testRejectsLowercaseCode(): void
    {
        $this->assertNotNull(personadle_validate_event_code('xmas2026'));
    }

    public function testRejectsCodeWithSpacesOrPunctuation(): void
    {
        $this->assertNotNull(personadle_validate_event_code('XMAS-2026'));
        $this->assertNotNull(personadle_validate_event_code('XMAS 2026'));
    }

    public function testRejectsCodeLongerThan50Chars(): void
    {
        $this->assertNotNull(personadle_validate_event_code(str_repeat('A', 51)));
    }

    // ── personadle_validate_sl_rank ──────────────────────────────────────────

    public function testAcceptsRankBoundaries1And10(): void
    {
        $this->assertNull(personadle_validate_sl_rank(1));
        $this->assertNull(personadle_validate_sl_rank(10));
    }

    public function testRejectsRankOutOfBounds(): void
    {
        $this->assertNotNull(personadle_validate_sl_rank(0));
        $this->assertNotNull(personadle_validate_sl_rank(11));
    }

    // ── personadle_validate_sl_xp ────────────────────────────────────────────

    public function testAcceptsZeroAndPositiveXp(): void
    {
        $this->assertNull(personadle_validate_sl_xp(0));
        $this->assertNull(personadle_validate_sl_xp(2700));
    }

    public function testRejectsNegativeXp(): void
    {
        $this->assertNotNull(personadle_validate_sl_xp(-1));
    }
}
