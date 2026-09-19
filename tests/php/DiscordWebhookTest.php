<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/discord_webhook.php';
require_once __DIR__ . '/../../api/lib/weekly_podium.php';

/**
 * Garde-fous du webhook Discord (api/lib/discord_webhook.php) et mise en forme
 * du top 3 hebdo — fonctions pures, aucun réseau, aucune base.
 */
final class DiscordWebhookTest extends TestCase
{
    private const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abcDEF-ghi_JKL012345';

    public function testOnlyARealDiscordWebhookUrlIsAccepted(): void
    {
        $this->assertTrue(personadle_discord_webhook_valid(self::HOOK));
        $this->assertTrue(personadle_discord_webhook_valid('https://discordapp.com/api/v10/webhooks/1/t-o_k'));
        $this->assertTrue(personadle_discord_webhook_valid('https://ptb.discord.com/api/webhooks/1/tok'));
        // Une config erronée ne doit jamais faire poster ailleurs que chez Discord
        $this->assertFalse(personadle_discord_webhook_valid('https://evil.example/api/webhooks/1/tok'));
        $this->assertFalse(personadle_discord_webhook_valid('http://discord.com/api/webhooks/1/tok'), 'http en clair');
        $this->assertFalse(personadle_discord_webhook_valid(self::HOOK . '?wait=true'), 'pas de query string : le cron ajoute la sienne');
        $this->assertFalse(personadle_discord_webhook_valid(''));
    }

    public function testRedactHidesTheUrlAndTheTokenAlone(): void
    {
        $msg = 'curl: (22) ' . self::HOOK . ' returned 404 — token abcDEF-ghi_JKL012345 invalid';
        $out = personadle_discord_redact(self::HOOK, $msg);
        $this->assertStringNotContainsString('abcDEF-ghi_JKL012345', $out);
        $this->assertStringContainsString('[webhook]', $out);
        $this->assertStringContainsString('[token]', $out);
        $this->assertSame('', personadle_discord_redact(self::HOOK, ''));
    }

    public function testEscapeNeutralisesDiscordMarkdownInPseudos(): void
    {
        $this->assertSame('\\*\\*Joker\\*\\*', personadle_discord_escape('**Joker**'));
        $this->assertSame('a\\_b \\~c\\~ \\`d\\` \\|e\\| \\>f', personadle_discord_escape('a_b ~c~ `d` |e| >f'));
        $this->assertSame('Ren Amamiya', personadle_discord_escape('Ren Amamiya'));
    }

    public function testWeeklyLinesUseMedalsPluralsAndEscapedPseudos(): void
    {
        $lines = personadle_weekly_lines([
            ['pseudo' => 'Joker', 'wins' => 12, 'games' => 15],
            ['pseudo' => 'Mona_Cat', 'wins' => 1, 'games' => 1],
            ['pseudo' => 'x', 'wins' => 1, 'games' => 2],
            ['pseudo' => 'quatrième', 'wins' => 1, 'games' => 9], // jamais affiché
        ]);
        $this->assertSame(
            "🥇 **Joker** — 12 victoires · 15 parties\n"
            . "🥈 **Mona\\_Cat** — 1 victoire · 1 partie\n"
            . "🥉 **x** — 1 victoire · 2 parties",
            $lines
        );
        $this->assertSame('', personadle_weekly_lines([]));
    }
}
