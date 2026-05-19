<?php
/**
 * GET /api/user/search?q=hamza   → recherche par pseudo (LIKE) ou friend_code (exact)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPORTEMENT
 *   - Si q fait exactement 8 chars (format friend_code XXXXXXXX) : recherche exacte
 *   - Sinon : LIKE '%q%' sur le pseudo (insensible à la casse, max 20 résultats)
 *   - Exclut les comptes supprimés (is_deleted = 1)
 *   - Exclut l'utilisateur connecté de sa propre recherche (évite de se proposer en ami)
 *
 * CHAMPS RETOURNÉS (subset — pas d'email, pas de hash)
 *   id, pseudo, friend_code, avatar_data, avatar_border_color, selected_badges
 *
 * ACCÈS
 *   - Public : pas de requireAuth() — on peut rechercher sans être connecté
 */

require_once __DIR__ . '/../bootstrap.php';

$q = trim($_GET['q'] ?? '');
if (strlen($q) < 2) {
    jsonError('Query too short (min 2 characters)', 400);
}

$pdo = pdo();

// Exclure l'utilisateur connecté si une session existe
$excludeId = (int) ($_SESSION['user_id'] ?? 0);

// Détection friend_code : exactement 8 caractères alphanumériques
$isFriendCode = (bool) preg_match('/^[A-Z0-9]{8}$/', strtoupper($q));

if ($isFriendCode) {
    // Recherche exacte par code ami
    $stmt = $pdo->prepare(
        'SELECT u.id, u.pseudo, u.friend_code, u.lang,
                p.avatar_data, p.avatar_border_color, p.selected_badges
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.friend_code = ? AND u.is_deleted = 0 AND u.id != ?
         LIMIT 1'
    );
    $stmt->execute([strtoupper($q), $excludeId]);
} else {
    // Recherche partielle par pseudo (insensible à la casse via LIKE)
    $stmt = $pdo->prepare(
        'SELECT u.id, u.pseudo, u.friend_code, u.lang,
                p.avatar_data, p.avatar_border_color, p.selected_badges
         FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE u.pseudo LIKE ? AND u.is_deleted = 0 AND u.id != ?
         ORDER BY u.pseudo
         LIMIT 20'
    );
    $stmt->execute(['%' . $q . '%', $excludeId]);
}

$results = $stmt->fetchAll();

// Formater + décoder selected_badges (JSON stocké en TEXT)
$formatted = array_map(fn($r) => [
    'id'                  => (int) $r['id'],
    'pseudo'              => $r['pseudo'],
    'friend_code'         => $r['friend_code'],
    'lang'                => $r['lang'],
    'avatar_data'         => $r['avatar_data'],
    'avatar_border_color' => $r['avatar_border_color'] ?? '#ffffff',
    'selected_badges'     => json_decode($r['selected_badges'] ?? 'null') ?? [],
], $results);

jsonSuccess(['results' => $formatted, 'count' => count($formatted)]);
