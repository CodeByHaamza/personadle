<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/discord_counts.php';

/**
 * Compteurs du serveur Discord (api/lib/discord_counts.php) : cache, repli sur
 * le dernier chiffre connu, et pas de martelage de Discord quand il ne répond
 * pas. Aucun réseau : l'appel est injecté, l'horloge aussi.
 */
final class DiscordCountsTest extends TestCase
{
    private const BODY = '{"code":"wpMdGGDp3y","approximate_member_count":69,"approximate_presence_count":6}';

    private string $file;
    private int $calls = 0;

    protected function setUp(): void
    {
        $this->file  = tempnam(sys_get_temp_dir(), 'pdc');
        $this->calls = 0;
        unlink($this->file);
    }

    protected function tearDown(): void
    {
        if (is_file($this->file)) {
            unlink($this->file);
        }
    }

    /** @return callable(string): string */
    private function fetcher(string $body): callable
    {
        return function (string $code) use ($body): string {
            $this->calls++;
            return $body;
        };
    }

    public function testParsesTheInviteCounts(): void
    {
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_parse_counts(self::BODY));
        $this->assertNull(personadle_discord_parse_counts(''));
        $this->assertNull(personadle_discord_parse_counts('{"message":"Unknown Invite","code":10006}'));
        $this->assertNull(personadle_discord_parse_counts('{"approximate_member_count":"69","approximate_presence_count":6}'), 'chaîne refusée');
        $this->assertNull(personadle_discord_parse_counts('{"approximate_member_count":-1,"approximate_presence_count":0}'));
        // Les deux chiffres sont « approximatifs » : jamais plus de présents que de membres.
        $this->assertSame(['members' => 5, 'online' => 5], personadle_discord_parse_counts('{"approximate_member_count":5,"approximate_presence_count":9}'));
    }

    public function testCachesForTenMinutes(): void
    {
        $t0 = 1_000_000;
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_counts($this->file, $this->fetcher(self::BODY), $t0));
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_counts($this->file, $this->fetcher('{}'), $t0 + 599));
        $this->assertSame(1, $this->calls, 'un seul appel pendant 10 min');

        $later = '{"approximate_member_count":70,"approximate_presence_count":8}';
        $this->assertSame(['members' => 70, 'online' => 8], personadle_discord_counts($this->file, $this->fetcher($later), $t0 + 600));
        $this->assertSame(2, $this->calls);
    }

    public function testKeepsTheLastKnownCountForADayWhenDiscordFails(): void
    {
        $t0 = 1_000_000;
        personadle_discord_counts($this->file, $this->fetcher(self::BODY), $t0);

        // Discord en panne : l'ancien chiffre est servi…
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_counts($this->file, $this->fetcher(''), $t0 + 700));
        // …mais sans rappeler Discord à chaque requête : une minute de répit.
        personadle_discord_counts($this->file, $this->fetcher(''), $t0 + 730);
        $this->assertSame(2, $this->calls);
        personadle_discord_counts($this->file, $this->fetcher(''), $t0 + 761);
        $this->assertSame(3, $this->calls);

        // Au-delà d'un jour, plus de chiffre du tout, même si l'échec se répète :
        // l'âge réel du chiffre ne doit pas être rajeuni par les échecs.
        $this->assertNull(personadle_discord_counts($this->file, $this->fetcher(''), $t0 + 86_400));
    }

    public function testNoCountAtAllWhenDiscordNeverAnswered(): void
    {
        $this->assertNull(personadle_discord_counts($this->file, $this->fetcher(''), 1_000));
        $this->assertNull(personadle_discord_counts($this->file, $this->fetcher(self::BODY), 1_030), 'échec récent : pas de nouvel appel');
        $this->assertSame(1, $this->calls);
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_counts($this->file, $this->fetcher(self::BODY), 1_061));
    }

    public function testAGarbledCacheFileIsIgnored(): void
    {
        file_put_contents($this->file, '{"fetched_at":1,"checked_at":1,"members":"<script>","online":6}');
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_counts($this->file, $this->fetcher(self::BODY), 2_000));
        file_put_contents($this->file, 'pas du json');
        $this->assertSame(['members' => 69, 'online' => 6], personadle_discord_counts($this->file, $this->fetcher(self::BODY), 3_000));
    }
}
