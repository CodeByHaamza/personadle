<?php
/**
 * api/lib/client_errors.php — Erreurs JavaScript remontées par les navigateurs.
 *
 * Jusqu'ici, un bug côté joueur n'existait que s'il était signalé : « titres en
 * 500 pendant 30 min » (2.2.6), « bouton Rejouer disparu » (2.3.3) sont arrivés
 * par des joueurs. js/error_reporter.js envoie désormais les erreurs non
 * rattrapées vers api/client_errors.php, qui les range dans `error_log`
 * (source `client`, consultable dans l'admin) et prévient Discord la première
 * fois qu'une erreur donnée apparaît.
 *
 * Fonctions pures (testées sans base : tests/php/ClientErrorsTest.php), sauf
 * personadle_client_error_is_new(), qui s'appuie sur la table rate_limits.
 */

declare(strict_types=1);

/** Longueurs maximales conservées — le corps vient d'un client non fiable. */
const PERSONADLE_CLIENT_ERROR_LIMITS = [
    'message' => 300,
    'source'  => 200,
    'stack'   => 1500,
    'page'    => 200,
    'ua'      => 200,
];

/** Retire caractères de contrôle et espaces superflus, puis tronque. */
function personadle_client_error_clean(mixed $value, int $max): string
{
    $s = is_scalar($value) ? (string) $value : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    $s = trim($s);
    return mb_substr($s, 0, $max);
}

/**
 * Normalise le corps reçu. Null si l'erreur ne vaut pas d'être gardée.
 *
 * Écartées : message vide, bruit connu (extensions du navigateur, « Script
 * error. » des scripts tiers sans CORS, boucle ResizeObserver bénigne).
 *
 * @param array<string,mixed> $body
 * @return array{message:string, source:string, line:int, col:int, stack:string, page:string, ua:string, kind:string}|null
 */
function personadle_client_error_normalize(array $body): ?array
{
    $L = PERSONADLE_CLIENT_ERROR_LIMITS;
    $out = [
        'message' => personadle_client_error_clean($body['message'] ?? '', $L['message']),
        'source'  => personadle_client_error_clean($body['source'] ?? '', $L['source']),
        'line'    => max(0, (int) ($body['line'] ?? 0)),
        'col'     => max(0, (int) ($body['col'] ?? 0)),
        'stack'   => personadle_client_error_clean($body['stack'] ?? '', $L['stack']),
        'page'    => personadle_client_error_clean($body['page'] ?? '', $L['page']),
        'ua'      => personadle_client_error_clean($body['ua'] ?? '', $L['ua']),
        'kind'    => ($body['kind'] ?? '') === 'rejection' ? 'rejection' : 'error',
    ];

    if ($out['message'] === '') return null;
    if (preg_match('/^Script error\.?$/i', $out['message'])) return null;
    if (str_contains($out['message'], 'ResizeObserver loop')) return null;
    // Réseau coupé (joueur hors ligne) : pas un bug du jeu.
    if (preg_match('/Failed to fetch|NetworkError when attempting|Load failed|network error/i', $out['message'])) return null;
    $haystack = $out['source'] . "\n" . $out['stack'];
    if (preg_match('#(chrome|moz|safari(-web)?)-extension://#i', $haystack)) return null;

    return $out;
}

/**
 * Empreinte d'une erreur : même message + même endroit = même bug, quel que
 * soit le joueur. Les nombres sont neutralisés (identifiants, positions qui
 * varient d'un appel à l'autre), pas les noms de fichiers.
 */
function personadle_client_error_fingerprint(array $e): string
{
    $firstFrame = strtok($e['stack'] !== '' ? $e['stack'] : $e['source'], "\n") ?: '';
    $firstFrame = preg_replace('/\?v=[\w]+/', '', $firstFrame) ?? $firstFrame;
    $msg = preg_replace('/\d+/', 'N', $e['message']) ?? $e['message'];
    return substr(sha1($msg . '|' . $firstFrame), 0, 16);
}

/**
 * Vrai la première fois qu'une empreinte est vue dans la fenêtre : on l'écrit en
 * base et on alerte une fois, pas à chaque joueur qui la rencontre.
 * S'appuie sur rate_limits (même upsert que rateLimit()) ; en cas d'échec de la
 * base, répond vrai — mieux vaut un doublon qu'une erreur perdue.
 */
function personadle_client_error_is_new(PDO $pdo, string $fingerprint, int $windowSec = 3600): bool
{
    $key = 'client-error-fp:' . $fingerprint;
    $now = time();
    $cutoff = $now - $windowSec;
    try {
        $pdo->prepare(
            'INSERT INTO rate_limits (rl_key, hits, window_start) VALUES (?, 1, ?)
             ON DUPLICATE KEY UPDATE
                hits         = IF(window_start < ?, 1, hits + 1),
                window_start = IF(window_start < ?, ?, window_start)'
        )->execute([$key, $now, $cutoff, $cutoff, $now]);
        $stmt = $pdo->prepare('SELECT hits FROM rate_limits WHERE rl_key = ?');
        $stmt->execute([$key]);
        return (int) $stmt->fetchColumn() === 1;
    } catch (Throwable $e) {
        return true;
    }
}

/** Message Discord d'une nouvelle erreur — court, sans donnée personnelle. */
function personadle_client_error_discord_payload(array $e, string $fingerprint): array
{
    $where = $e['source'] !== '' ? $e['source'] . ($e['line'] ? ':' . $e['line'] : '') : 'inconnu';
    $frame = strtok($e['stack'], "\n") ?: '';
    $text = "🐞 **Nouvelle erreur JS** (`{$fingerprint}`)\n"
        . '> ' . str_replace(['`', '@'], ["'", '＠'], $e['message']) . "\n"
        . "Page : `{$e['page']}` · Fichier : `{$where}`"
        . ($frame !== '' ? "\n```\n" . str_replace('`', "'", $frame) . "\n```" : '');
    return [
        'content'          => mb_substr($text, 0, 1900),
        'allowed_mentions' => ['parse' => []], // jamais de ping depuis un texte client
    ];
}
