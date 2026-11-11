<?php
/**
 * GET /api/user/next-unlocks?lang=fr
 * ────────────────────────────────────────────────────────────────────────────
 * Les déblocages les plus proches du joueur connecté (2.4, lot 11) : badges non
 * secrets, titres et Modes Expert, classés par avancement. Six au plus.
 *
 * Accès : connecté
 * Succès : 200 { items: [ { kind: 'badge'|'title'|'expert', slug, name, image,
 *                           rarity, description, condition_type, condition_mode,
 *                           current, required } ] }
 *
 * Ce qui est dû est d'abord accordé (même réconciliation que GET /api/titles et
 * /api/badges) : le panneau ne montre jamais « 10 / 10 » sur une chose encore
 * verrouillée. Logique dans api/lib/next_unlocks.php.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/unlock_reconcile.php';
require_once __DIR__ . '/../lib/next_unlocks.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$userId = requireAuth();
$pdo    = pdo();

personadle_reconcile_titles($pdo, $userId);
personadle_reconcile_badges($pdo, $userId);

$lang = (string) ($_GET['lang'] ?? 'en');
jsonSuccess(['items' => personadle_next_unlocks($pdo, $userId, $lang)]);
