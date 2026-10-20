<?php
/**
 * POST /api/client_errors — une erreur JavaScript non rattrapée, vue par un joueur.
 *
 * Fichier plat à la racine de api/ (comme sessions_today.php) : pas de dossier
 * homonyme, donc pas de 301 de mod_dir sur le POST (CLAUDE.md §7).
 *
 * Ouvert aux invités (une erreur ne choisit pas qui la rencontre), donc :
 *   - limité par IP (30 / 15 min) — c'est la seule protection d'un endpoint public ;
 *   - corps tronqué champ par champ (api/lib/client_errors.php) ;
 *   - stocké en `warning`, source `client`, consultable dans l'admin ;
 *   - une même erreur (même empreinte) n'est écrite et signalée sur Discord
 *     qu'une fois par heure, quel que soit le nombre de joueurs touchés.
 * Pas de CSRF : rien n'est modifié pour le compte de l'utilisateur, et
 * navigator.sendBeacon() ne sait pas poser d'en-tête.
 *
 * Réponse : 204 sans corps, y compris quand l'erreur est écartée (bruit connu,
 * doublon) — le client n'a rien à en faire.
 */

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/error_log.php';
require_once __DIR__ . '/lib/client_errors.php';
require_once __DIR__ . '/lib/discord_webhook.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

rateLimit('client-errors:' . getClientIp(), 30, 15 * 60);

$raw = file_get_contents('php://input', false, null, 0, 16384) ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) jsonError('Invalid JSON', 400);

$error = personadle_client_error_normalize($body);
if ($error === null) {
    http_response_code(204);
    exit;
}

$pdo = pdo();
$fingerprint = personadle_client_error_fingerprint($error);

if (personadle_client_error_is_new($pdo, $fingerprint)) {
    $userId = !empty($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
    personadle_log_error(
        $pdo,
        'warning',
        'Client JS: ' . $error['message'],
        ['source' => 'client', 'fingerprint' => $fingerprint] + $error,
        $userId
    );

    // Alerte Discord : optionnelle (constante absente ou vide = pas d'alerte).
    if (defined('DISCORD_ERRORS_WEBHOOK') && DISCORD_ERRORS_WEBHOOK !== ''
        && personadle_discord_webhook_valid(DISCORD_ERRORS_WEBHOOK)) {
        personadle_discord_post(
            DISCORD_ERRORS_WEBHOOK,
            personadle_client_error_discord_payload($error, $fingerprint)
        );
    }
}

http_response_code(204);
