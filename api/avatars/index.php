<?php
/**
 * GET /api/avatars → catalogue des portraits DÉBLOCABLES, avec `is_unlocked`
 *                    pour le joueur courant.
 *
 * Ne renvoie QUE les portraits déblocables : les ~350 portraits libres vivent
 * côté client (profile/avatars_data.js) et n'ont jamais eu besoin du serveur.
 *
 * Comme GET /api/titles et GET /api/badges, cette lecture RÉCONCILIE d'abord :
 * le serveur accorde lui-même ce qui est dû, plutôt que d'attendre que le client
 * pense à le demander. C'est la leçon du 2026-09-19 — ~290 titres et ~100 badges
 * dus dormaient en prod parce que personne ne frappait à la porte (voir
 * api/lib/unlock_reconcile.php).
 *
 * Pas de POST /unlock ici, volontairement : contrairement aux wallpapers, aucun
 * portrait déblocable ne s'obtient sur déclaration du client. Le seul chemin est
 * la réconciliation serveur, et ajouter une porte que personne n'utilise serait
 * une surface d'attaque gratuite.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/unlock_reconcile.php';

$authId = requireAuth();
$pdo    = pdo();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method not allowed', 405);
}

// La réconciliation ne doit jamais transformer la liste en 500 : si elle plante,
// on sert le catalogue tel qu'il est en base. Le joueur voit alors ses déblocages
// d'avant plutôt qu'une page cassée — même parti pris que pour les titres.
$granted = [];
try {
    $granted = personadle_reconcile_avatars($pdo, $authId);
} catch (Throwable $e) {
    try {
        personadle_log_error($pdo, 'error', 'Avatar reconciliation failed', [
            'source' => 'avatars-index', 'error' => $e->getMessage(),
        ], $authId);
    } catch (Throwable) {
        // le log est un bonus
    }
}

$stmt = $pdo->prepare(
    "SELECT a.id, a.name, a.game, a.image_path, a.is_animated, a.pack_id,
            a.unlock_condition, a.condition_type, a.condition_mode, a.condition_value,
            a.sort_order,
            (SELECT COUNT(*) FROM user_avatars ua
              WHERE ua.user_id = ? AND ua.avatar_id = a.id) AS is_unlocked
       FROM avatars a
      ORDER BY a.pack_id IS NULL, a.pack_id, a.sort_order, a.id"
);
$stmt->execute([$authId]);

$avatars = array_map(static function (array $row): array {
    $row['is_animated'] = (int) $row['is_animated'] === 1;
    $row['is_unlocked'] = (int) $row['is_unlocked'] > 0;
    $row['sort_order']  = (int) $row['sort_order'];
    $row['condition_value'] = $row['condition_value'] === null ? null : (int) $row['condition_value'];
    return $row;
}, $stmt->fetchAll());

// `granted` dit ce qui vient d'être accordé À CET APPEL : le client s'en sert
// pour annoncer le déblocage, sans avoir à comparer avec son état précédent.
jsonSuccess(['avatars' => $avatars, 'granted' => $granted]);
