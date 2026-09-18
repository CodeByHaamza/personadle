<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/client_ip.php';

/**
 * Tests de la résolution d'IP client (api/lib/client_ip.php) — la clé de
 * rate limiting de login, register, request-reset, reset-password et
 * user/search. Aucun accès base de données.
 *
 * Régression couverte : jusqu'au 2026-09-09, ces 5 endpoints prenaient la
 * première entrée de X-Forwarded-For dès qu'elle avait un format d'IP valide.
 * Le header étant fourni par le client, il suffisait de le faire varier pour
 * repartir d'un compteur neuf à chaque requête — bruteforce de mot de passe,
 * bruteforce de token de reset et énumération de pseudos redevenaient illimités.
 * Le premier test ci-dessous est celui qui doit rester rouge si quelqu'un
 * refait confiance au header sans passer par TRUSTED_PROXIES.
 */
final class ClientIpTest extends TestCase
{
    // ── Sans proxy de confiance : X-Forwarded-For est ignoré ────────────────

    public function testIgnoresSpoofedForwardedForWhenNoTrustedProxy(): void
    {
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '198.51.100.9',
            'HTTP_X_FORWARDED_FOR' => '1.2.3.4',
        ]);

        $this->assertSame('198.51.100.9', $ip);
    }

    public function testSpoofedForwardedForCannotVaryTheRateLimitKey(): void
    {
        $keys = [];
        foreach (['1.2.3.4', '5.6.7.8', '9.10.11.12'] as $spoof) {
            $keys[] = personadle_client_ip([
                'REMOTE_ADDR'          => '198.51.100.9',
                'HTTP_X_FORWARDED_FOR' => $spoof,
            ]);
        }

        // Une seule et même clé : le compteur ne se réinitialise pas.
        $this->assertCount(1, array_unique($keys));
    }

    public function testUsesRemoteAddrWhenNoForwardedForHeader(): void
    {
        $this->assertSame('198.51.100.9', personadle_client_ip(['REMOTE_ADDR' => '198.51.100.9']));
    }

    public function testReturnsUnknownWhenRemoteAddrIsMissing(): void
    {
        $this->assertSame('unknown', personadle_client_ip([]));
    }

    public function testReturnsUnknownWhenRemoteAddrIsGarbage(): void
    {
        $this->assertSame('unknown', personadle_client_ip(['REMOTE_ADDR' => 'not-an-ip']));
    }

    public function testIgnoresForwardedForWhenRemoteAddrIsNotTheDeclaredProxy(): void
    {
        // Le proxy est déclaré, mais la requête ne vient pas de lui.
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.200',
            'HTTP_X_FORWARDED_FOR' => '1.2.3.4',
        ], ['203.0.113.7']);

        $this->assertSame('203.0.113.200', $ip);
    }

    // ── Derrière un proxy de confiance : dernier hop non approuvé ───────────

    public function testUsesForwardedForWhenRemoteAddrIsATrustedProxy(): void
    {
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.7',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.9',
        ], ['203.0.113.7']);

        $this->assertSame('198.51.100.9', $ip);
    }

    public function testTakesTheRightmostHopSoAPrependedFakeIsIgnored(): void
    {
        // Le client envoie « 1.2.3.4 », le proxy AJOUTE l'IP réelle derrière.
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.7',
            'HTTP_X_FORWARDED_FOR' => '1.2.3.4, 198.51.100.9',
        ], ['203.0.113.7']);

        $this->assertSame('198.51.100.9', $ip);
    }

    public function testSkipsChainedTrustedProxies(): void
    {
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.7',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.9, 203.0.113.8',
        ], ['203.0.113.7', '203.0.113.8']);

        $this->assertSame('198.51.100.9', $ip);
    }

    public function testFallsBackToProxyWhenChainIsCorrupted(): void
    {
        // Chaîne salie volontairement : on ne devine pas, on partage le seau du
        // proxy plutôt que de retenir une valeur choisie par le client.
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.7',
            'HTTP_X_FORWARDED_FOR' => 'nope, <script>',
        ], ['203.0.113.7']);

        $this->assertSame('203.0.113.7', $ip);
    }

    public function testFallsBackToProxyWhenChainIsEmpty(): void
    {
        $ip = personadle_client_ip(['REMOTE_ADDR' => '203.0.113.7'], ['203.0.113.7']);

        $this->assertSame('203.0.113.7', $ip);
    }

    public function testAcceptsSpacesAroundChainEntries(): void
    {
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.7',
            'HTTP_X_FORWARDED_FOR' => '  1.2.3.4 ,   198.51.100.9  ',
        ], ['203.0.113.7']);

        $this->assertSame('198.51.100.9', $ip);
    }

    public function testTrustsAProxyDeclaredByCidrRange(): void
    {
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '203.0.113.42',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.9',
        ], ['203.0.113.0/24']);

        $this->assertSame('198.51.100.9', $ip);
    }

    public function testTrustsAnIpv6ProxyDeclaredByCidrRange(): void
    {
        $ip = personadle_client_ip([
            'REMOTE_ADDR'          => '2001:db8::1234',
            'HTTP_X_FORWARDED_FOR' => '198.51.100.9',
        ], ['2001:db8::/32']);

        $this->assertSame('198.51.100.9', $ip);
    }

    // ── personadle_normalize_trusted_proxies ────────────────────────────────
    // config.php est édité à la main sur le serveur (jamais versionné) : la
    // constante peut y arriver sous n'importe quelle forme.

    public function testNormalizesAPlainStringIntoAList(): void
    {
        $this->assertSame(['203.0.113.7'], personadle_normalize_trusted_proxies('203.0.113.7'));
    }

    public function testNormalizeDropsEmptyEntriesAndTrims(): void
    {
        $this->assertSame(
            ['203.0.113.7', '198.51.100.0/24'],
            personadle_normalize_trusted_proxies(['  203.0.113.7 ', '', '   ', '198.51.100.0/24'])
        );
    }

    public function testNormalizeIgnoresNonStringEntries(): void
    {
        $this->assertSame(['203.0.113.7'], personadle_normalize_trusted_proxies([42, null, '203.0.113.7', ['x']]));
    }

    public function testNormalizeReturnsEmptyListForUnusableValues(): void
    {
        $this->assertSame([], personadle_normalize_trusted_proxies(null));
        $this->assertSame([], personadle_normalize_trusted_proxies(true));
        $this->assertSame([], personadle_normalize_trusted_proxies(42));
        $this->assertSame([], personadle_normalize_trusted_proxies([]));
    }

    // ── personadle_ip_in_range ──────────────────────────────────────────────

    public function testCidrMatchesInsideTheRange(): void
    {
        $this->assertTrue(personadle_ip_in_range('192.168.1.42', '192.168.1.0/24'));
    }

    public function testCidrRejectsOutsideTheRange(): void
    {
        $this->assertFalse(personadle_ip_in_range('192.168.2.42', '192.168.1.0/24'));
    }

    public function testCidrHandlesANonByteAlignedPrefix(): void
    {
        $this->assertTrue(personadle_ip_in_range('10.0.3.5', '10.0.0.0/22'));
        $this->assertFalse(personadle_ip_in_range('10.0.4.5', '10.0.0.0/22'));
    }

    public function testSlashZeroMatchesEverythingOfTheSameFamily(): void
    {
        $this->assertTrue(personadle_ip_in_range('8.8.8.8', '0.0.0.0/0'));
        $this->assertFalse(personadle_ip_in_range('2001:db8::1', '0.0.0.0/0'));
    }

    public function testSlashThirtyTwoMatchesOnlyTheExactAddress(): void
    {
        $this->assertTrue(personadle_ip_in_range('203.0.113.7', '203.0.113.7/32'));
        $this->assertFalse(personadle_ip_in_range('203.0.113.8', '203.0.113.7/32'));
    }

    public function testExactIpMatch(): void
    {
        $this->assertTrue(personadle_ip_in_range('203.0.113.7', '203.0.113.7'));
        $this->assertFalse(personadle_ip_in_range('203.0.113.8', '203.0.113.7'));
    }

    public function testDoesNotMixIpv4AndIpv6Families(): void
    {
        $this->assertFalse(personadle_ip_in_range('192.168.1.1', '::/0'));
        $this->assertFalse(personadle_ip_in_range('::1', '192.168.0.0/16'));
    }

    public function testRejectsAMalformedRange(): void
    {
        $this->assertFalse(personadle_ip_in_range('192.168.1.1', ''));
        $this->assertFalse(personadle_ip_in_range('192.168.1.1', '192.168.1.0/abc'));
        $this->assertFalse(personadle_ip_in_range('192.168.1.1', '192.168.1.0/33'));
        $this->assertFalse(personadle_ip_in_range('192.168.1.1', 'not-an-ip/24'));
    }
}
