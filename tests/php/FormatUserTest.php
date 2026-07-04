<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/format.php';

/**
 * Tests de formatUser() (api/lib/format.php) — utilisée par login, register,
 * admin/user.php, etc. pour construire la réponse JSON publique d'un utilisateur.
 * Garde-fou principal : ne JAMAIS exposer password_hash.
 */
final class FormatUserTest extends TestCase
{
    private function baseRow(array $overrides = []): array
    {
        return array_merge([
            'id'            => 42,
            'email'         => 'joker@velvet-room.test',
            'pseudo'        => 'Joker',
            'password_hash' => '$2y$10$superSecretHashThatMustNeverLeak',
            'lang'          => 'en',
            'friend_code'   => 'XK4R2M9P',
            'created_at'    => '2026-01-01 00:00:00',
            'last_login_at' => null,
        ], $overrides);
    }

    public function testNeverIncludesPasswordHash(): void
    {
        $result = formatUser($this->baseRow());
        $this->assertArrayNotHasKey('password_hash', $result);
    }

    public function testCastsIdToInt(): void
    {
        $result = formatUser($this->baseRow(['id' => '42']));
        $this->assertSame(42, $result['id']);
        $this->assertIsInt($result['id']);
    }

    public function testDefaultsAvatarBorderColorWhenProfileEmpty(): void
    {
        $result = formatUser($this->baseRow());
        $this->assertSame('#ffffff', $result['avatar_border_color']);
        $this->assertNull($result['avatar_data']);
    }

    public function testUsesProfileAvatarDataWhenProvided(): void
    {
        $result = formatUser($this->baseRow(), ['avatar_data' => 'data:image/png;base64,xyz', 'avatar_border_color' => '#ff0000']);
        $this->assertSame('data:image/png;base64,xyz', $result['avatar_data']);
        $this->assertSame('#ff0000', $result['avatar_border_color']);
    }

    public function testDefaultsIsAdminToFalseWhenMissing(): void
    {
        $result = formatUser($this->baseRow());
        $this->assertFalse($result['is_admin']);
    }

    public function testCastsIsAdminToBoolWhenPresent(): void
    {
        $result = formatUser($this->baseRow(['is_admin' => 1]));
        $this->assertTrue($result['is_admin']);
        $this->assertIsBool($result['is_admin']);
    }

    public function testDefaultsHasMigratedToFalseWhenMissing(): void
    {
        $result = formatUser($this->baseRow());
        $this->assertFalse($result['has_migrated']);
    }
}
