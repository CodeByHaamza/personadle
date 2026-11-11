<?php

declare(strict_types=1);

/**
 * api/lib/discord_counts.php — Membres et présents du serveur Discord PersonaDLE.
 *
 * Source : l'endpoint PUBLIC d'invitation de Discord
 * (`GET /api/v10/invites/<code>?with_counts=true`), qui donne
 * `approximate_member_count` et `approximate_presence_count` sans jeton, et sans
 * qu'il faille activer le widget du serveur (désactivé aujourd'hui → 403).
 *
 * Pourquoi un proxy plutôt qu'un appel direct depuis le navigateur :
 *  - l'IP des joueurs ne part pas chez Discord tant qu'ils ne cliquent pas ;
 *  - la CSP du site (connect-src) n'a pas à s'ouvrir à discord.com ;
 *  - un cache de 10 min : Discord est appelé quelques fois par heure, pas à
 *    chaque fin de partie.
 *
 * Le cache vit dans sys_get_temp_dir(), pas dans le dépôt : un fichier non suivi
 * dans le webroot salirait le `git status` dont dépend le déploiement auto.
 * Les chiffres sont publics ; on les relit quand même comme des entiers bornés,
 * parce que /tmp n'est pas un endroit de confiance.
 */

const PERSONADLE_DISCORD_INVITE      = 'wpMdGGDp3y';
const PERSONADLE_DISCORD_COUNTS_TTL  = 600;   // secondes
const PERSONADLE_DISCORD_RETRY_AFTER = 60;    // après un échec, attendre avant de rappeler
const PERSONADLE_DISCORD_STALE_MAX   = 86400; // un vieux chiffre sert encore un jour
const PERSONADLE_DISCORD_COUNT_MAX   = 10_000_000;

/** Fichier de cache par défaut. */
function personadle_discord_counts_cache_file(): string
{
    return rtrim(sys_get_temp_dir(), '/\\') . '/personadle_discord_counts.json';
}

/** Entier plausible, ou null. */
function personadle_discord_count(mixed $v): ?int
{
    return is_int($v) && $v >= 0 && $v <= PERSONADLE_DISCORD_COUNT_MAX ? $v : null;
}

/**
 * Extrait les compteurs de la réponse de Discord.
 *
 * @return array{members:int, online:int}|null
 */
function personadle_discord_parse_counts(string $body): ?array
{
    $d = json_decode($body, true);
    if (!is_array($d)) {
        return null;
    }
    $members = personadle_discord_count($d['approximate_member_count'] ?? null);
    $online  = personadle_discord_count($d['approximate_presence_count'] ?? null);
    if ($members === null || $online === null) {
        return null;
    }
    return ['members' => $members, 'online' => min($online, $members)];
}

/**
 * Appel réseau réel. Ne lève rien : renvoie '' en cas d'échec.
 */
function personadle_discord_fetch_invite(string $code): string
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => 'https://discord.com/api/v10/invites/' . rawurlencode($code) . '?with_counts=true',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        CURLOPT_USERAGENT      => 'PersonaDLE (+https://personadle.net)',
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($code === 200 && is_string($body)) ? $body : '';
}

/**
 * Lit le cache.
 *  - `fetched_at` : date des chiffres (null = jamais obtenus) ;
 *  - `checked_at` : dernier appel à Discord, réussi ou non — après un échec, on
 *    attend RETRY_AFTER avant de rappeler.
 *
 * @return array{fetched_at:?int, checked_at:int, members:?int, online:?int}|null
 */
function personadle_discord_read_cache(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    $c   = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($c) || !is_int($c['checked_at'] ?? null)) {
        return null;
    }
    $fetchedAt = is_int($c['fetched_at'] ?? null) ? $c['fetched_at'] : null;
    $members   = personadle_discord_count($c['members'] ?? null);
    $online    = personadle_discord_count($c['online'] ?? null);
    if ($fetchedAt === null || $members === null || $online === null) {
        $fetchedAt = $members = $online = null;
    }
    return ['fetched_at' => $fetchedAt, 'checked_at' => $c['checked_at'], 'members' => $members, 'online' => $online];
}

/** @param array{fetched_at:?int, checked_at:int, members:?int, online:?int} $entry */
function personadle_discord_write_cache(string $file, array $entry): void
{
    @file_put_contents($file, (string) json_encode($entry), LOCK_EX);
}

/**
 * Compteurs à servir, ou null si on n'en a aucun de fiable.
 *
 * @param string|null   $file  fichier de cache (tests : un fichier temporaire)
 * @param callable|null $fetch fn(string $code): string — corps JSON, '' si échec
 * @param int|null      $now   horloge (tests)
 * @return array{members:int, online:int}|null
 */
function personadle_discord_counts(?string $file = null, ?callable $fetch = null, ?int $now = null): ?array
{
    $file  ??= personadle_discord_counts_cache_file();
    $fetch ??= 'personadle_discord_fetch_invite';
    $now   ??= time();

    $cached = personadle_discord_read_cache($file);
    $age    = ($cached['fetched_at'] ?? null) !== null ? $now - $cached['fetched_at'] : null;
    $known  = $age !== null ? ['members' => $cached['members'], 'online' => $cached['online']] : null;

    if ($age !== null && $age < PERSONADLE_DISCORD_COUNTS_TTL) {
        return $known;
    }
    // Un vieux chiffre (moins d'un jour) vaut mieux que rien si Discord ne répond pas.
    $stale = ($age !== null && $age < PERSONADLE_DISCORD_STALE_MAX) ? $known : null;

    if ($cached !== null && $now - $cached['checked_at'] < PERSONADLE_DISCORD_RETRY_AFTER) {
        return $stale; // échec récent : ne pas marteler Discord
    }

    $fresh = personadle_discord_parse_counts((string) $fetch(PERSONADLE_DISCORD_INVITE));
    if ($fresh !== null) {
        personadle_discord_write_cache($file, ['fetched_at' => $now, 'checked_at' => $now] + $fresh);
        return $fresh;
    }

    // Échec : on note l'essai, et les chiffres gardent leur date réelle — sinon un
    // chiffre périmé survivrait indéfiniment à force d'être réécrit.
    personadle_discord_write_cache($file, [
        'fetched_at' => $cached['fetched_at'] ?? null,
        'checked_at' => $now,
        'members'    => $cached['members'] ?? null,
        'online'     => $cached['online'] ?? null,
    ]);
    return $stale;
}
