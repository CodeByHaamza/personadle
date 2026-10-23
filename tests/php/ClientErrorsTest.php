<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/client_errors.php';

/**
 * Erreurs JavaScript remontées par les navigateurs (api/lib/client_errors.php).
 * Fonctions pures : le corps vient d'un client non fiable, il est tronqué,
 * nettoyé, filtré, et une même erreur n'est signalée qu'une fois.
 */
final class ClientErrorsTest extends TestCase
{
    private function body(array $over = []): array
    {
        return $over + [
            'message' => "TypeError: Cannot read properties of null (reading 'style')",
            'source'  => 'https://personadle.net/js/gameCore.js?v=ab12cd34',
            'line'    => 912,
            'col'     => 7,
            'stack'   => "TypeError: …\n    at revealNextLink (https://personadle.net/js/gameCore.js?v=ab12cd34:912:7)",
            'page'    => '/classiqueMode/classiqueMode.html',
            'ua'      => 'Mozilla/5.0',
        ];
    }

    public function testKeepsARealError(): void
    {
        $e = personadle_client_error_normalize($this->body());
        $this->assertNotNull($e);
        $this->assertSame(912, $e['line']);
        $this->assertSame('error', $e['kind']);
    }

    public function testTruncatesEveryFieldAndStripsControlCharacters(): void
    {
        $e = personadle_client_error_normalize($this->body([
            'message' => str_repeat('x', 5000) . "\x00\x07",
            'stack'   => str_repeat('y', 9000),
            'ua'      => str_repeat('z', 900),
        ]));
        $this->assertSame(300, mb_strlen($e['message']));
        $this->assertSame(1500, mb_strlen($e['stack']));
        $this->assertSame(200, mb_strlen($e['ua']));
        $this->assertStringNotContainsString("\x00", $e['message']);
    }

    public function testRejectsNonScalarFieldsWithoutCrashing(): void
    {
        $e = personadle_client_error_normalize($this->body(['source' => ['a' => 1], 'line' => 'abc']));
        $this->assertSame('', $e['source']);
        $this->assertSame(0, $e['line']);
    }

    public function testDropsKnownNoise(): void
    {
        $this->assertNull(personadle_client_error_normalize($this->body(['message' => ''])));
        $this->assertNull(personadle_client_error_normalize($this->body(['message' => 'Script error.'])));
        $this->assertNull(personadle_client_error_normalize($this->body(['message' => 'ResizeObserver loop completed with undelivered notifications.'])));
        $this->assertNull(personadle_client_error_normalize($this->body(['message' => 'TypeError: Failed to fetch'])));
        $this->assertNull(personadle_client_error_normalize($this->body(['stack' => 'at x (chrome-extension://abcdef/content.js:1:1)'])));
    }

    public function testSameBugSameFingerprintAcrossPlayersAndDeploys(): void
    {
        $a = personadle_client_error_normalize($this->body());
        // Autre joueur, autre build (?v= différent), même bug.
        $b = personadle_client_error_normalize($this->body([
            'stack' => "TypeError: …\n    at revealNextLink (https://personadle.net/js/gameCore.js?v=ffff0000:912:7)",
            'ua'    => 'Other browser',
        ]));
        $this->assertSame(personadle_client_error_fingerprint($a), personadle_client_error_fingerprint($b));
    }

    public function testDifferentBugDifferentFingerprint(): void
    {
        $a = personadle_client_error_normalize($this->body());
        $b = personadle_client_error_normalize($this->body(['message' => 'ReferenceError: foo is not defined']));
        $this->assertNotSame(personadle_client_error_fingerprint($a), personadle_client_error_fingerprint($b));
    }

    public function testDiscordPayloadNeverPings(): void
    {
        $e = personadle_client_error_normalize($this->body(['message' => '@everyone `boom`']));
        $p = personadle_client_error_discord_payload($e, 'abc123');
        $this->assertSame(['parse' => []], $p['allowed_mentions']);
        $this->assertStringNotContainsString('@everyone', $p['content']);
        $this->assertLessThanOrEqual(1900, mb_strlen($p['content']));
    }
}
