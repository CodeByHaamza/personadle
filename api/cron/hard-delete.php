<?php
/**
 * api/cron/hard-delete.php — RGPD hard delete J+30
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/hard-delete.php?key=<CRON_SECRET>
 *
 * Fréquence recommandée : une fois par jour (ex: 03h00 heure de Paris).
 * Sécurité : même clé secrète que leaderboard.php (CRON_SECRET dans config.php).
 *
 * Logique :
 *   1. Trouver les deletion_requests non traitées de plus de 30 jours.
 *   2. DELETE FROM users — le CASCADE InnoDB supprime automatiquement toutes
 *      les tables liées (profiles, user_stats, game_sessions, badges_unlocked,
 *      friendships, social_links, leaderboard_cache, messages, user_titles…).
 *   3. Marquer deletion_requests.processed_at = NOW() pour la traçabilité RGPD.
 *      L'entrée est conservée (sans FK, pas de cascade) — le user_id devient
 *      une référence orpheline non personnelle, ce qui est conforme au RGPD.
 */

require_once __DIR__ . '/../bootstrap.php';

// ── Vérification clé secrète ──────────────────────────────────────────────────
$key = $_GET['key'] ?? '';
if (!defined('CRON_SECRET') || !hash_equals(CRON_SECRET, $key)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$pdo   = pdo();
$start = microtime(true);
$paris = new DateTimeZone('Europe/Paris');

// ── Récupérer les comptes à supprimer ─────────────────────────────────────────
$pending = $pdo->query("
    SELECT id AS request_id, user_id
    FROM deletion_requests
    WHERE processed_at IS NULL
      AND requested_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
");
$rows = $pending->fetchAll();

$deleted = 0;
$errors  = [];

$deleteUser  = $pdo->prepare('DELETE FROM users WHERE id = ?');
$markDone    = $pdo->prepare('UPDATE deletion_requests SET processed_at = NOW() WHERE id = ?');

foreach ($rows as $row) {
    $requestId = (int) $row['request_id'];
    $userId    = (int) $row['user_id'];

    try {
        $pdo->beginTransaction();

        // Hard delete — CASCADE supprime toutes les données liées
        $deleteUser->execute([$userId]);

        // Log RGPD : marquer comme traité (l'entrée est conservée pour audit)
        $markDone->execute([$requestId]);

        $pdo->commit();
        $deleted++;
    } catch (Throwable $e) {
        $pdo->rollBack();
        $errors[] = "user_id=$userId: " . $e->getMessage();
        error_log("[PersonaDLE hard-delete] user_id=$userId: " . $e->getMessage());
    }
}

$elapsed = round((microtime(true) - $start) * 1000);
jsonSuccess([
    'deleted'    => $deleted,
    'pending'    => count($rows),
    'errors'     => $errors,
    'elapsed_ms' => $elapsed,
    'ran_at'     => (new DateTime('now', $paris))->format('Y-m-d H:i:s'),
]);
