<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/pusher_auth.php';

final class PusherAuthTest extends TestCase
{
    public function testChannelMatchesUserAcceptsOwnChannel(): void
    {
        $this->assertTrue(personadle_pusher_channel_matches_user('private-user-42', 42));
    }

    public function testChannelMatchesUserRejectsOtherUsersChannel(): void
    {
        $this->assertFalse(personadle_pusher_channel_matches_user('private-user-42', 7));
    }

    public function testChannelMatchesUserRejectsMalformedChannel(): void
    {
        $this->assertFalse(personadle_pusher_channel_matches_user('presence-user-42', 42));
        $this->assertFalse(personadle_pusher_channel_matches_user('private-user-42x', 42));
    }

    public function testAuthSignatureMatchesExpectedHmac(): void
    {
        $secret = 'testsecret';
        $expected = hash_hmac('sha256', 'socket123:private-user-42', $secret);

        $this->assertSame(
            $expected,
            personadle_pusher_channel_auth_signature($secret, 'socket123', 'private-user-42')
        );
    }

    public function testAuthSignatureChangesWithSocketId(): void
    {
        $secret = 'testsecret';
        $sigA = personadle_pusher_channel_auth_signature($secret, 'socket-a', 'private-user-42');
        $sigB = personadle_pusher_channel_auth_signature($secret, 'socket-b', 'private-user-42');

        $this->assertNotSame($sigA, $sigB);
    }
}
