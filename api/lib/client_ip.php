<?php

declare(strict_types=1);

/**
 * api/lib/client_ip.php — Résolution de l'IP client (clé de rate limiting)
 * ────────────────────────────────────────────────────────────────────────────
 * Logique pure (aucune BDD, aucune superglobale lue directement) : testable en
 * PHPUnit, cf. tests/php/ClientIpTest.php. Le point d'entrée réel est
 * getClientIp() dans api/bootstrap.php, qui ne fait que passer $_SERVER ici.
 *
 * RÈGLE : ne JAMAIS faire confiance à X-Forwarded-For par défaut.
 * Ce header est envoyé par le client. Valider son FORMAT ne valide pas sa
 * PROVENANCE : un attaquant met « X-Forwarded-For: 1.2.3.<compteur> » et obtient
 * une clé rate_limits neuve à chaque requête — le throttling anti-bruteforce de
 * login/reset/register/search ne limite alors plus rien du tout.
 *
 * Le header n'est lu QUE si REMOTE_ADDR est lui-même un proxy déclaré de
 * confiance (TRUSTED_PROXIES dans api/config.php, vide par défaut). Dans ce cas
 * la chaîne est parcourue de DROITE à GAUCHE : chaque proxy traversé ajoute son
 * pair à la fin, donc le dernier hop non-approuvé est le seul non falsifiable —
 * tout ce que le client a écrit lui-même se retrouve à gauche.
 */

/**
 * IP client à utiliser comme clé de rate limiting.
 *
 * @param array<string,mixed> $server         $_SERVER (ou son équivalent en test)
 * @param list<string>        $trustedProxies IPs/CIDR des proxys de confiance (vide = aucun)
 * @return string IP validée, ou 'unknown' si REMOTE_ADDR est absent/illisible
 *                (clé commune volontaire : mieux vaut un seau partagé qu'aucune limite)
 */
function personadle_client_ip(array $server, array $trustedProxies = []): string
{
    $remote = (string) ($server['REMOTE_ADDR'] ?? '');

    if (!filter_var($remote, FILTER_VALIDATE_IP)) {
        return 'unknown';
    }

    // Cas nominal (Apache/LiteSpeed en direct) : REMOTE_ADDR est le client.
    if ($trustedProxies === [] || !personadle_ip_in_any_range($remote, $trustedProxies)) {
        return $remote;
    }

    // REMOTE_ADDR est un proxy approuvé → dernier hop non approuvé de la chaîne.
    $chain = array_map('trim', explode(',', (string) ($server['HTTP_X_FORWARDED_FOR'] ?? '')));

    for ($i = count($chain) - 1; $i >= 0; $i--) {
        $hop = $chain[$i];

        // Chaîne vide, tronquée ou salie : on ne devine pas, on retombe sur le
        // proxy (seau partagé) plutôt que sur une valeur choisie par le client.
        if (!filter_var($hop, FILTER_VALIDATE_IP)) {
            return $remote;
        }

        if (!personadle_ip_in_any_range($hop, $trustedProxies)) {
            return $hop;
        }
    }

    return $remote;
}

/**
 * Normalise la valeur brute de la constante TRUSTED_PROXIES.
 *
 * api/config.php est édité à la main sur le serveur et n'est pas versionné :
 * la constante peut y être absente, écrite en chaîne simple (« 203.0.113.7 »)
 * ou remplie de valeurs vides. On tolère tout ça plutôt que de laisser un
 * TypeError transformer /api/auth/login en 500.
 *
 * @param  mixed $trustedProxies Valeur de TRUSTED_PROXIES telle que définie
 * @return list<string>
 */
function personadle_normalize_trusted_proxies($trustedProxies): array
{
    if (is_string($trustedProxies)) {
        $trustedProxies = [$trustedProxies];
    }

    if (!is_array($trustedProxies)) {
        return [];
    }

    $normalized = [];
    foreach ($trustedProxies as $proxy) {
        if (!is_string($proxy)) {
            continue;
        }

        $proxy = trim($proxy);
        if ($proxy !== '') {
            $normalized[] = $proxy;
        }
    }

    return $normalized;
}

/**
 * @param list<string> $ranges IPs exactes ou notations CIDR
 */
function personadle_ip_in_any_range(string $ip, array $ranges): bool
{
    foreach ($ranges as $range) {
        if (personadle_ip_in_range($ip, (string) $range)) {
            return true;
        }
    }

    return false;
}

/**
 * Test d'appartenance à une IP exacte ou à un CIDR (IPv4 et IPv6).
 *
 * Comparaison sur la forme binaire (inet_pton) : « 1.2.3.4 » et « 1.02.3.4 »
 * ne doivent pas diverger, et une IPv4 (4 octets) n'appartient jamais à un
 * range IPv6 (16 octets) — les familles ne sont pas mélangées, y compris pour
 * la forme mappée « ::ffff:1.2.3.4 » qui doit alors être déclarée telle quelle.
 */
function personadle_ip_in_range(string $ip, string $range): bool
{
    $range = trim($range);
    if ($range === '') {
        return false;
    }

    $ipBin = @inet_pton($ip);
    if ($ipBin === false) {
        return false;
    }

    if (!str_contains($range, '/')) {
        $rangeBin = @inet_pton($range);
        return $rangeBin !== false && $rangeBin === $ipBin;
    }

    [$subnet, $bits] = explode('/', $range, 2);

    $subnetBin = @inet_pton($subnet);
    if ($subnetBin === false || !ctype_digit($bits) || strlen($subnetBin) !== strlen($ipBin)) {
        return false;
    }

    $bits    = (int) $bits;
    $maxBits = strlen($ipBin) * 8;
    if ($bits > $maxBits) {
        return false;
    }

    $fullBytes = intdiv($bits, 8);
    if ($fullBytes > 0 && strncmp($ipBin, $subnetBin, $fullBytes) !== 0) {
        return false;
    }

    $remainingBits = $bits % 8;
    if ($remainingBits === 0) {
        return true;
    }

    $mask = chr((0xFF << (8 - $remainingBits)) & 0xFF);

    return ($ipBin[$fullBytes] & $mask) === ($subnetBin[$fullBytes] & $mask);
}
