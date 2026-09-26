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

/**
 * Nom du fil d'un rendez-vous quotidien, pour un salon **forum**.
 *
 * Date d'abord : dans un forum, on cherche le jour, pas le personnage — le nom
 * de la voix est déjà dans le message. Discord plafonne à 100 caractères et
 * refuse la requête au-delà, d'où la troncature ici plutôt qu'un 400 à 6 h du
 * matin.
 */
function personadle_discord_thread_name(DateTimeInterface $jour, string $voix): string
{
    $nom = '🎲 ' . $jour->format('d/m/Y');
    $voix = trim($voix);
    if ($voix !== '') {
        $nom .= ' — ' . $voix;
    }
    return mb_substr($nom, 0, 100);
}

/**
 * POST sur un webhook, que le salon soit un forum ou un salon texte.
 *
 * ── Pourquoi ce n'est pas un simple paramètre ───────────────────────────────
 * Un webhook ne peut PAS poster dans un salon forum **sans** `thread_name`, et
 * ne peut pas poster dans un salon texte **avec** : Discord renvoie 400 dans les
 * deux cas. Le type du salon est donc une dépendance invisible du cron — le jour
 * où `🎲┃daily-personadle` est converti en forum, un cron qui ne le sait pas
 * s'arrête net, et seul le log le dit.
 *
 * D'où le repli automatique, dans les deux sens : on essaie la forme attendue,
 * et si Discord répond 400 on réessaie l'autre **une fois**. Le salon peut être
 * converti (ou reconverti) sans toucher au code, et `$forumAttendu` ne sert plus
 * qu'à économiser un aller-retour dans le cas courant.
 *
 * Un 400 pour une autre raison (embed malformé) sera lui aussi réessayé une
 * fois, échouera de nouveau, et remontera — c'est le comportement voulu : deux
 * appels ratés valent mieux qu'un rendez-vous muet.
 *
 * @param callable|null $poster Point d'injection pour les tests ; par défaut
 *                              `personadle_discord_post`.
 * @return array{code:int, error:string, body:string, repli?:string}
 */
function personadle_discord_post_thread(
    string $webhook,
    array $payload,
    string $threadName,
    bool $forumAttendu = false,
    ?callable $poster = null
): array {
    $envoyer = $poster ?? 'personadle_discord_post';

    $avecFil = $payload;
    if ($threadName !== '') {
        $avecFil['thread_name'] = mb_substr($threadName, 0, 100);
    }
    $sansFil = $payload;
    unset($sansFil['thread_name']);

    // Sans nom de fil utilisable, il n'y a pas de choix à faire.
    if ($threadName === '') {
        return $envoyer($webhook, $sansFil);
    }

    [$premier, $second, $note] = $forumAttendu
        ? [$avecFil, $sansFil, "le salon n'est pas un forum : posté sans fil, retirer DISCORD_DAILY_FORUM"]
        : [$sansFil, $avecFil, 'le salon est un forum : posté dans un fil, activer DISCORD_DAILY_FORUM'];

    $r = $envoyer($webhook, $premier);
    if ((int) ($r['code'] ?? 0) !== 400) {
        return $r;
    }

    $r2 = $envoyer($webhook, $second);
    if ((int) ($r2['code'] ?? 0) >= 200 && (int) $r2['code'] < 300) {
        $r2['repli'] = $note;
    }
    return $r2;
}
