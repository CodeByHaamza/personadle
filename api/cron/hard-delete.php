<?php
/**
 * api/cron/hard-delete.php — RGPD hard delete J+30
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/hard-delete.php
 *   Header: X-Cron-Key: <CRON_SECRET>
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
require_once __DIR__ . '/../lib/deletion_requests.php';

requireCronSecret();

$pdo   = pdo();
$start = microtime(true);
$paris = new DateTimeZone('Europe/Paris');

// Transaction unique pour tout le lot : si le process crashe avant le commit
// final, rien n'est supprimé (pas de suppression partielle non traçée).
$pdo->beginTransaction();
try {
    $result = personadle_process_due_deletion_requests($pdo, 30);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    personadle_log_error($pdo, 'error', $e->getMessage(), ['source' => 'cron-hard-delete']);
    jsonError('Hard delete batch failed', 500);
}
$elapsed = round((microtime(true) - $start) * 1000);

jsonSuccess([
    'deleted'    => $result['deleted'],
    'pending'    => $result['pending'],
    'errors'     => $result['errors'],
    'elapsed_ms' => $elapsed,
    'ran_at'     => (new DateTime('now', $paris))->format('Y-m-d H:i:s'),
]);
