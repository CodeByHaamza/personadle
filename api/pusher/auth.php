<?php
/**
 * POST /api/pusher/auth → autorise l'abonnement à un canal privé Pusher.
 * Appelé par pusher-js (client) avant tout abonnement à "private-user-{id}".
 *
 * ⚠️ Corps en application/x-www-form-urlencoded (transport par défaut de
 * pusher-js), PAS en JSON — ne pas utiliser getJsonBody() ici.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/pusher_auth.php';

$authId = requireAuth();

$channelName = trim($_POST['channel_name'] ?? '');
$socketId    = trim($_POST['socket_id'] ?? '');

if ($channelName === '' || $socketId === '') {
    jsonError('Missing channel_name or socket_id', 400);
}

if (!personadle_pusher_channel_matches_user($channelName, $authId)) {
    jsonError('Forbidden channel', 403);
}

if (!defined('PUSHER_KEY') || PUSHER_KEY === '' || !defined('PUSHER_SECRET') || PUSHER_SECRET === '') {
    jsonError('Pusher not configured', 503);
}

$signature = personadle_pusher_channel_auth_signature(PUSHER_SECRET, $socketId, $channelName);

jsonSuccess(['auth' => PUSHER_KEY . ':' . $signature]);
