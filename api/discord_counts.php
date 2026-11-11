<?php
/**
 * GET /api/discord_counts — Membres et présents du serveur Discord PersonaDLE
 * ─────────────────────────────────────────────────────────────────────
 *
 * RÉPONSE
 *   { members: int|null, online: int|null }
 *   null = Discord n'a pas répondu et aucun chiffre récent n'est en cache :
 *   le client n'affiche alors simplement pas de compteur.
 *
 * ACCÈS
 *   Public, lecture seule. Mis en cache 10 min côté serveur
 *   (api/lib/discord_counts.php) et 5 min côté navigateur.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/discord_counts.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    jsonError('Method not allowed', 405);
}

$counts = personadle_discord_counts();

header('Cache-Control: public, max-age=300');
jsonSuccess([
    'members' => $counts['members'] ?? null,
    'online'  => $counts['online'] ?? null,
]);
