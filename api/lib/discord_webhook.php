<?php
/**
 * api/lib/discord_webhook.php — envoyer un message via un webhook Discord, sans
 * jamais laisser fuiter l'URL.
 *
 * Extrait du cron quotidien (api/cron/discord-daily.php) pour le cron hebdo du
 * top 3 : mêmes garde-fous, écrits une fois. Le quotidien garde encore sa copie
 * locale — il tourne en prod, on ne le retouche pas sans raison ; à rebrancher ici
 * à la prochaine modification.
 *
 * Trois règles :
 *  - l'URL est VALIDÉE avant tout appel (forme https://discord.com/api/webhooks/…),
 *    donc une config erronée ne peut pas faire poster ailleurs que chez Discord ;
 *  - « ?wait=true » : Discord répond 200 avec le message créé au lieu d'un 204
 *    muet — sinon un webhook révoqué serait indiscernable d'un envoi réussi ;
 *  - tout ce qui repart vers un log passe par personadle_discord_redact() :
 *    curl et Discord recopient parfois l'URL dans leurs messages d'erreur.
 */

declare(strict_types=1);

/** Vrai si `$url` a la forme d'un webhook Discord (id + token, sans query string). */
function personadle_discord_webhook_valid(string $url): bool
{
    return (bool) preg_match(
        '#^https://(?:canary\.|ptb\.)?discord(?:app)?\.com/api/(?:v\d+/)?webhooks/\d+/[\w-]+$#',
        $url
    );
}

/**
 * POST JSON sur le webhook. Ne lève rien : le cron décide quoi faire du résultat.
 *
 * @return array{code:int, error:string, body:string}
 */
function personadle_discord_post(string $webhook, array $payload): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($body === false) {
        return ['code' => 0, 'error' => 'json_encode failed', 'body' => ''];
    }

    // curl_init() sans argument : avec l'URL il peut renvoyer false, et
    // curl_setopt_array(false, …) est une TypeError fatale en PHP 8.
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $webhook . '?wait=true',
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $response = curl_exec($ch);
    $code     = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    return [
        'code'  => $code,
        'error' => $error,
        'body'  => is_string($response) ? $response : '',
    ];
}

/** Remplace l'URL du webhook, et son token seul, par des marqueurs. */
function personadle_discord_redact(string $webhook, string $s): string
{
    if ($s === '') return '';
    $s     = str_replace($webhook, '[webhook]', $s);
    $slash = strrpos($webhook, '/');
    if ($slash !== false) {
        $token = substr($webhook, $slash + 1);
        if ($token !== '') {
            $s = str_replace($token, '[token]', $s);
        }
    }
    return $s;
}

/**
 * Échappe un texte libre (pseudo) pour le markdown de Discord : `*_~|` et le
 * backtick deviendraient de la mise en forme. Les mentions sont neutralisées à
 * part, par `allowed_mentions` dans le payload.
 */
function personadle_discord_escape(string $s): string
{
    return preg_replace('/([\\\\*_~`|>])/', '\\\\$1', $s) ?? $s;
}
