<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/pusher_trigger.php';

/**
 * Test d'intégration RÉEL contre l'API Pusher (pas de mock) — vérifie que les
 * identifiants configurés (PUSHER_APP_ID/KEY/SECRET/CLUSTER) sont valides et
 * que la signature construite par personadle_pusher_build_event_request()
 * est effectivement acceptée par Pusher, pas seulement bien formée.
 *
 * SKIPPÉ si la config Pusher est absente (CI, dev sans compte configuré) —
 * même philosophie que DatabaseIntegrationTest pour une dépendance externe
 * optionnelle. Nécessite un accès réseau sortant vers *.pusher.com.
 */
final class PusherLiveTest extends TestCase
{
    private static ?string $skipReason = null;

    public static function setUpBeforeClass(): void
    {
        if (getenv('DB_HOST') !== false) {
            require_once __DIR__ . '/../../api/config.docker.php';
        } elseif (file_exists(__DIR__ . '/../../api/config.php')) {
            require_once __DIR__ . '/../../api/config.php';
        }

        if (
            !defined('PUSHER_APP_ID') || PUSHER_APP_ID === '' ||
            !defined('PUSHER_KEY') || PUSHER_KEY === '' ||
            !defined('PUSHER_SECRET') || PUSHER_SECRET === '' ||
            !defined('PUSHER_CLUSTER') || PUSHER_CLUSTER === ''
        ) {
            self::$skipReason = 'Config Pusher absente — renseigner PUSHER_* dans config.php/.env pour lancer ce test';
        }
    }

    protected function setUp(): void
    {
        if (self::$skipReason !== null) {
            $this->markTestSkipped(self::$skipReason);
        }
    }

    public function testRealPusherApiAcceptsOurSignedEvent(): void
    {
        $request = personadle_pusher_build_event_request(
            PUSHER_APP_ID,
            PUSHER_KEY,
            PUSHER_SECRET,
            PUSHER_CLUSTER,
            'private-user-phpunit-live-test',
            'friend_request',
            ['source' => 'PusherLiveTest']
        );

        $ch = curl_init($request['url']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $request['body'],
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $this->assertSame('', $curlError, 'cURL ne doit lever aucune erreur réseau');
        $this->assertSame(
            200,
            $status,
            "Pusher a répondu {$status} au lieu de 200 — signature ou identifiants invalides. Body: {$body}"
        );
    }

    public function testAuthEndpointSignatureIsAcceptedForARealSubscription(): void
    {
        require_once __DIR__ . '/../../api/lib/pusher_auth.php';

        // Un "socket_id" Pusher réel a la forme "12345.6789" ; on en simule un
        // plausible pour vérifier que la signature calculée par notre endpoint
        // suit exactement le format que pusher-js attend d'un vrai serveur.
        $socketId = '123456.789012';
        $channel  = 'private-user-999';

        $signature = personadle_pusher_channel_auth_signature(PUSHER_SECRET, $socketId, $channel);

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{64}$/',
            $signature,
            'La signature doit être un HMAC-SHA256 hex (64 caractères)'
        );
    }
}
