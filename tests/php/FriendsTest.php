<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/friends.php';

/**
 * Tests des règles métier du système d'amis (api/lib/friends.php).
 * Aucun accès base de données — fonctions pures.
 */
final class FriendsTest extends TestCase
{
    // ── personadle_validate_friend_code ─────────────────────────────────────

    public function testAcceptsAValidFriendCode(): void
    {
        $this->assertNull(personadle_validate_friend_code('XK4R2M9P'));
    }

    public function testRejectsCodeShorterThan8Chars(): void
    {
        $this->assertNotNull(personadle_validate_friend_code('XK4R2M9'));
    }

    public function testRejectsCodeLongerThan8Chars(): void
    {
        $this->assertNotNull(personadle_validate_friend_code('XK4R2M9PP'));
    }

    public function testRejectsLowercaseCode(): void
    {
        $this->assertNotNull(personadle_validate_friend_code('xk4r2m9p'));
    }

    public function testRejectsCodeWithPunctuation(): void
    {
        $this->assertNotNull(personadle_validate_friend_code('XK4R-M9P'));
    }

    // ── personadle_friend_request_denial ────────────────────────────────────

    public function testAllowsRequestWhenNoExistingRelation(): void
    {
        $this->assertNull(personadle_friend_request_denial(null));
    }

    public function testDeniesWhenAlreadyFriends(): void
    {
        $result = personadle_friend_request_denial('accepted');
        $this->assertSame('Already friends', $result['message']);
        $this->assertSame(409, $result['http_status']);
    }

    public function testDeniesWhenRequestAlreadyPending(): void
    {
        $result = personadle_friend_request_denial('pending');
        $this->assertSame('Request already sent or received', $result['message']);
        $this->assertSame(409, $result['http_status']);
    }

    public function testDeniesWhenBlocked(): void
    {
        $result = personadle_friend_request_denial('blocked');
        $this->assertSame('Cannot send request', $result['message']);
        $this->assertSame(403, $result['http_status']);
    }
}
