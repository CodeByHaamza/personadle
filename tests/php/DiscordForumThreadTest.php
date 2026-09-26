<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../api/lib/discord_webhook.php';

/**
 * Poster d'un rendez-vous dans un salon forum.
 *
 * Le type du salon est une dépendance INVISIBLE du cron : un webhook ne peut pas
 * poster dans un forum sans `thread_name`, ni dans un salon texte avec — Discord
 * renvoie 400 dans les deux cas. Le jour où `🎲┃daily-personadle` est converti en
 * forum, un cron qui l'ignore s'arrête net et rien ne le dit sauf le log.
 *
 * D'où un repli automatique dans les deux sens, et ces tests : c'est exactement
 * le genre de logique qu'on n'exerce jamais à la main, parce qu'il faudrait
 * convertir un vrai salon Discord pour la voir passer.
 */
final class DiscordForumThreadTest extends TestCase
{
    /** Poster factice : enregistre les payloads et rend les codes demandés. */
    private function poster(array $codes, array &$vus): callable
    {
        return static function (string $webhook, array $payload) use (&$codes, &$vus): array {
            $vus[] = $payload;
            $code = array_shift($codes) ?? 200;
            return ['code' => $code, 'error' => '', 'body' => ''];
        };
    }

    // ── Le nom du fil ───────────────────────────────────────────────────────

    public function testLeNomDuFilCommenceParLaDate(): void
    {
        // La date d'abord : dans un forum on cherche le jour, pas le personnage.
        $n = personadle_discord_thread_name(new DateTimeImmutable('2026-09-26'), 'Yukari Takeba');
        self::assertSame('🎲 26/09/2026 — Yukari Takeba', $n);
    }

    public function testLeNomDuFilTientDansLaLimiteDeDiscord(): void
    {
        // 100 caractères : au-delà Discord refuse la requête entière.
        $n = personadle_discord_thread_name(new DateTimeImmutable('2026-09-26'), str_repeat('Makoto ', 40));
        self::assertLessThanOrEqual(100, mb_strlen($n));
    }

    public function testUneVoixVideNeLaissePasDeTiretOrphelin(): void
    {
        self::assertSame('🎲 26/09/2026', personadle_discord_thread_name(new DateTimeImmutable('2026-09-26'), '   '));
    }

    // ── Salon texte (l'état actuel) ─────────────────────────────────────────

    public function testSalonTexteUnSeulAppelSansFil(): void
    {
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '🎲 fil', false, $this->poster([200], $vus));
        self::assertSame(200, $r['code']);
        self::assertCount(1, $vus, 'le cas courant ne doit coûter qu\'un appel');
        self::assertArrayNotHasKey('thread_name', $vus[0]);
        self::assertArrayNotHasKey('repli', $r);
    }

    // ── Salon forum ─────────────────────────────────────────────────────────

    public function testForumAnnonceUnSeulAppelAvecFil(): void
    {
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '🎲 fil', true, $this->poster([200], $vus));
        self::assertSame(200, $r['code']);
        self::assertCount(1, $vus);
        self::assertSame('🎲 fil', $vus[0]['thread_name']);
    }

    public function testSalonConvertiEnForumSansPrevenirLeCron(): void
    {
        // Le scénario qui casserait tout : la constante dit « salon texte », le
        // salon est devenu un forum. Premier appel 400, second avec le fil → passe.
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '🎲 fil', false, $this->poster([400, 200], $vus));
        self::assertSame(200, $r['code']);
        self::assertCount(2, $vus);
        self::assertArrayNotHasKey('thread_name', $vus[0]);
        self::assertSame('🎲 fil', $vus[1]['thread_name']);
        self::assertArrayHasKey('repli', $r, 'le repli doit être signalé pour que la constante soit corrigée');
        self::assertStringContainsString('DISCORD_DAILY_FORUM', $r['repli']);
    }

    public function testForumReconvertiEnSalonTexte(): void
    {
        // Le sens inverse compte autant : on peut défaire une conversion.
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '🎲 fil', true, $this->poster([400, 200], $vus));
        self::assertSame(200, $r['code']);
        self::assertCount(2, $vus);
        self::assertSame('🎲 fil', $vus[0]['thread_name']);
        self::assertArrayNotHasKey('thread_name', $vus[1]);
        self::assertArrayHasKey('repli', $r);
    }

    // ── Ce qui ne doit PAS être avalé ───────────────────────────────────────

    public function testUnWebhookRevoqueNEstPasReessaye(): void
    {
        // 401/404 ne sont pas un problème de type de salon : réessayer ne sert
        // qu'à doubler l'échec et à brouiller le log.
        foreach ([401, 404, 429, 500] as $code) {
            $vus = [];
            $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '🎲 fil', false, $this->poster([$code], $vus));
            self::assertSame($code, $r['code']);
            self::assertCount(1, $vus, "HTTP $code ne doit pas déclencher de second appel");
        }
    }

    public function testDeuxCentQuatreEstUnSucces(): void
    {
        // Sans ?wait=true Discord répond 204. Le helper ne doit pas y voir un échec.
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '🎲 fil', false, $this->poster([204], $vus));
        self::assertSame(204, $r['code']);
        self::assertCount(1, $vus);
    }

    public function testDoubleEchecRemonteLeSecondCode(): void
    {
        // Un 400 pour une autre raison (embed malformé) : réessayé une fois,
        // échoue encore, et c'est bien un échec qui remonte — pas un faux succès.
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['embeds' => []], '🎲 fil', false, $this->poster([400, 400], $vus));
        self::assertSame(400, $r['code']);
        self::assertCount(2, $vus);
        self::assertArrayNotHasKey('repli', $r, 'pas de repli à signaler quand rien n\'est passé');
    }

    public function testSansNomDeFilAucunChoixNEstFait(): void
    {
        $vus = [];
        $r = personadle_discord_post_thread('https://x', ['content' => 'a'], '', true, $this->poster([200], $vus));
        self::assertSame(200, $r['code']);
        self::assertCount(1, $vus);
        self::assertArrayNotHasKey('thread_name', $vus[0]);
    }

    public function testUnThreadNameDejaPresentEstEcrase(): void
    {
        // Le payload du cron ne doit pas pouvoir contredire le nom calculé.
        $vus = [];
        personadle_discord_post_thread('https://x', ['thread_name' => 'vieux'], '🎲 neuf', true, $this->poster([200], $vus));
        self::assertSame('🎲 neuf', $vus[0]['thread_name']);
    }
}
