<?php
/**
 * api/lib/pusher_trigger.php — Déclenchement d'événements Pusher Channels côté
 * serveur (cURL brut, pas de SDK — le projet n'a pas de composer.json).
 *
 * personadle_pusher_trigger() ne doit JAMAIS faire échouer l'appelant : un push
 * raté (config absente, réseau down, Pusher indisponible) est loggué et avalé.
 * Le fallback polling côté client (js/notifications.js) couvre ce cas.
 */

declare(strict_types=1);

/**
 * Construit l'URL signée et le corps JSON attendus par l'API REST Pusher
 * (POST /apps/{app_id}/events). Pure — aucun accès réseau — pour rester
 * testable sans mock cURL.
 *
 * @return array{url:string, body:string}
 */
function personadle_pusher_build_event_request(
    string $appId,
    string $key,
    string $secret,
    string $cluster,
    string $channel,
    string $event,
    array $data
): array {
    $body = json_encode([
        'name'     => $event,
        'channels' => [$channel],
        'data'     => json_encode($data, JSON_UNESCAPED_UNICODE),
    ], JSON_UNESCAPED_UNICODE);

    $path = "/apps/{$appId}/events";

    $params = [
        'auth_key'       => $key,
        'auth_timestamp' => (string) time(),
        'auth_version'   => '1.0',
        'body_md5'       => md5($body),
    ];
    ksort($params);
    $queryString = http_build_query($params);

    $signature = hash_hmac('sha256', "POST\n{$path}\n{$queryString}", $secret);

    return [
        'url'  => "https://api-{$cluster}.pusher.com{$path}?{$queryString}&auth_signature={$signature}",
        'body' => $body,
    ];
}

/**
 * Publie un événement sur un canal Pusher. No-op silencieux si la config
 * Pusher (PUSHER_APP_ID/KEY/SECRET/CLUSTER) est absente ou incomplète — permet
 * de développer sans compte Pusher configuré.
 */
function personadle_pusher_trigger(string $channel, string $event, array $data): void
{
    if (
        !defined('PUSHER_APP_ID') || PUSHER_APP_ID === '' ||
        !defined('PUSHER_KEY') || PUSHER_KEY === '' ||
        !defined('PUSHER_SECRET') || PUSHER_SECRET === '' ||
        !defined('PUSHER_CLUSTER') || PUSHER_CLUSTER === ''
    ) {
        return;
    }

    try {
        $request = personadle_pusher_build_event_request(
            PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER, $channel, $event, $data
        );

        $ch = curl_init($request['url']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $request['body'],
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 2,
            CURLOPT_CONNECTTIMEOUT => 2,
        ]);
        curl_exec($ch);
        curl_close($ch);
    } catch (Throwable $e) {
        error_log('[Pusher] trigger failed: ' . $e->getMessage());
    }
}
