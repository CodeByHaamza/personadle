<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/pusher_trigger.php';

final class PusherTriggerTest extends TestCase
{
    private const APP_ID  = '123456';
    private const KEY     = 'testkey';
    private const SECRET  = 'testsecret';
    private const CLUSTER = 'eu';

    public function testBodyContainsEventNameChannelAndJsonEncodedData(): void
    {
        $req = personadle_pusher_build_event_request(
            self::APP_ID, self::KEY, self::SECRET, self::CLUSTER,
            'private-user-42', 'friend_request', ['count_delta' => 1]
        );

        $decoded = json_decode($req['body'], true);
        $this->assertSame('friend_request', $decoded['name']);
        $this->assertSame(['private-user-42'], $decoded['channels']);
        $this->assertSame(['count_delta' => 1], json_decode($decoded['data'], true));
    }

    public function testUrlContainsSignedAuthParams(): void
    {
        $req = personadle_pusher_build_event_request(
            self::APP_ID, self::KEY, self::SECRET, self::CLUSTER,
            'private-user-42', 'friend_request', []
        );

        $this->assertStringStartsWith(
            'https://api-eu.pusher.com/apps/123456/events?',
            $req['url']
        );
        $this->assertMatchesRegularExpression('/auth_key=testkey/', $req['url']);
        $this->assertMatchesRegularExpression('/auth_version=1\.0/', $req['url']);
        $this->assertMatchesRegularExpression('/body_md5=' . md5($req['body']) . '/', $req['url']);
        $this->assertMatchesRegularExpression('/auth_signature=[0-9a-f]{64}$/', $req['url']);
    }

    public function testSignatureChangesWhenSecretChanges(): void
    {
        $reqA = personadle_pusher_build_event_request(
            self::APP_ID, self::KEY, 'secret-a', self::CLUSTER, 'private-user-1', 'evt', []
        );
        $reqB = personadle_pusher_build_event_request(
            self::APP_ID, self::KEY, 'secret-b', self::CLUSTER, 'private-user-1', 'evt', []
        );

        $this->assertNotSame($reqA['url'], $reqB['url']);
    }

    public function testTriggerIsNoOpWithoutConfig(): void
    {
        // PUSHER_APP_ID etc. ne sont pas définies dans l'environnement de test —
        // ne doit lever aucune exception ni tenter d'appel réseau.
        $this->expectNotToPerformAssertions();
        personadle_pusher_trigger('private-user-1', 'friend_request', []);
    }
}
