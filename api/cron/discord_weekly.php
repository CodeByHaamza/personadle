<?php
/**
 * api/cron/discord_weekly.php — Top 3 de la semaine sur Discord
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/discord_weekly.php
 *   Header: X-Cron-Key: <CRON_SECRET>
 *
 * Fréquence : le dimanche à 20:00 (Paris) — idée Hamza du 2026-09-19 : « dans un
 * salon on affiche le top 3 de ladite semaine ». La semaine est celle du
 * classement (lundi → aujourd'hui, même fenêtre que period=week dans
 * api/leaderboard/index.php), donc les parties jouées entre 20 h et minuit le
 * dimanche ne sont pas dedans : c'est le prix d'un rendez-vous à une heure où
 * les gens sont là, plutôt qu'à 00:05 quand le salon dort.
 *
 * Deux podiums : victoires en mode normal (tous modes) et, s'il y a eu des parties,
 * victoires en Mode Expert. Égalité de victoires → le moins de parties d'abord
 * (plus efficace), puis pseudo. Une semaine sans aucune victoire ne poste rien.
 *
 * Voix : Margaret — c'est elle qui tient les registres du Velvet Room.
 *
 * Config (api/config.php, gitignoré) :
 *   DISCORD_WEEKLY_WEBHOOK       webhook du salon classement ; à défaut, celui
 *                                du quotidien (DISCORD_DAILY_WEBHOOK) est utilisé
 *   DISCORD_WEEKLY_MENTION_ROLE  optionnel — id du rôle opt-in à pinger (jamais
 *                                Membres : cf. le quotidien)
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/discord_webhook.php';
require_once __DIR__ . '/../lib/weekly_podium.php';
require_once __DIR__ . '/../lib/error_log.php';

requireCronSecret();

$start = microtime(true);

$webhook = defined('DISCORD_WEEKLY_WEBHOOK') && DISCORD_WEEKLY_WEBHOOK !== ''
    ? (string) DISCORD_WEEKLY_WEBHOOK
    : (defined('DISCORD_DAILY_WEBHOOK') ? (string) DISCORD_DAILY_WEBHOOK : '');
if ($webhook === '') {
    jsonError('DISCORD_WEEKLY_WEBHOOK (or DISCORD_DAILY_WEBHOOK) missing from config.php', 500);
}
if (!personadle_discord_webhook_valid($webhook)) {
    jsonError('DISCORD_WEEKLY_WEBHOOK malformed', 500);
}

const SITE_WEEKLY = 'https://www.personadle.net/';
const LEADERBOARD_URL = 'https://www.personadle.net/profile/leaderboard/leaderboard.html';

$paris  = new DateTimeZone('Europe/Paris');
$now    = new DateTime('now', $paris);
$monday = (clone $now)->modify('Monday this week');
$sunday = (clone $monday)->modify('+6 days');
$from   = $monday->format('Y-m-d');

$pdo = pdo();

$normal = personadle_weekly_podium($pdo, $from, false);
$expert = personadle_weekly_podium($pdo, $from, true);

if ($normal === [] && $expert === []) {
    jsonSuccess([
        'success' => true,
        'data'    => ['posted' => false, 'reason' => 'no wins this week', 'from' => $from],
    ]);
}

$fields = [];
if ($normal !== []) {
    $fields[] = ['name' => '🏆 Victoires de la semaine', 'value' => personadle_weekly_lines($normal), 'inline' => false];
}
if ($expert !== []) {
    $fields[] = ['name' => '⚡ Mode Expert', 'value' => personadle_weekly_lines($expert), 'inline' => false];
}

$periode = sprintf('du %s au %s', $monday->format('d/m'), $sunday->format('d/m'));
$corps   = "Le registre de la semaine est clos. Voici ceux dont les noms y figurent en tête.\n"
    . "*The week's record is closed. These are the names written at the top.*\n\n"
    . '[Classement complet / Full leaderboard](' . LEADERBOARD_URL . '?period=week)';

$avatar  = SITE_WEEKLY . 'img/avatar/margaret.jpg';
$mention = defined('DISCORD_WEEKLY_MENTION_ROLE')
    ? preg_replace('/\D/', '', (string) DISCORD_WEEKLY_MENTION_ROLE)
    : '';

$payload = [
    'username'   => 'Margaret',
    'avatar_url' => $avatar,
    'embeds'     => [[
        'title'       => '📖 Top 3 de la semaine — ' . $periode,
        'description' => $corps,
        'color'       => 0xB03A2E,
        'thumbnail'   => ['url' => $avatar],
        'fields'      => $fields,
        'footer'      => ['text' => 'PersonaDLE — semaine ' . $monday->format('W')],
    ]],
    'allowed_mentions' => ['parse' => [], 'roles' => $mention !== '' ? [$mention] : []],
];
if ($mention !== '') {
    $payload['content'] = '<@&' . $mention . '>';
}

$r = personadle_discord_post($webhook, $payload);

// curl_exec() renvoie false sur échec réseau (code 0) ; Discord renvoie 401/404
// sur webhook révoqué et 429 sur rate limit. Le détail part en log, caviardé.
if ($r['error'] !== '' || $r['code'] < 200 || $r['code'] >= 300) {
    personadle_log_error($pdo, 'error', 'Discord weekly top 3 failed (HTTP ' . $r['code'] . ')', [
        'source' => 'cron-discord-weekly',
        'curl'   => personadle_discord_redact($webhook, $r['error']),
        'body'   => personadle_discord_redact($webhook, substr($r['body'], 0, 300)),
    ]);
    jsonError('Discord webhook call failed (HTTP ' . $r['code'] . ')', 502);
}

jsonSuccess([
    'success' => true,
    'data'    => [
        'posted'     => true,
        'from'       => $from,
        'to'         => $sunday->format('Y-m-d'),
        'normal'     => $normal,
        'expert'     => $expert,
        'mention'    => $mention !== '' ? $mention : null,
        'status'     => $r['code'],
        'elapsed_ms' => round((microtime(true) - $start) * 1000),
        'ran_at'     => $now->format('Y-m-d H:i:s'),
    ],
]);
