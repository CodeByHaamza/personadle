<?php
/**
 * api/cron/purge-rate-limits.php — Purge des fenêtres de rate-limit expirées
 *
 * Appelé par cron Hostinger :
 *   GET https://personadle.net/api/cron/purge-rate-limits.php
 *   Header: X-Cron-Key: <CRON_SECRET>
 *
 * Fréquence recommandée : une fois par jour (ex: 04h00 heure de Paris).
 * Sécurité : même clé secrète que hard-delete.php/leaderboard.php.
 *
 * La table rate_limits (clé = rl_key, ex: "login:1.2.3.4") n'a jamais de
 * DELETE ailleurs dans le code — sans purge elle grossit indéfiniment avec
 * le nombre d'IP/utilisateurs distincts. La plus longue fenêtre utilisée par
 * rateLimit() est 15 min : une marge de 1h après la fin de la fenêtre est
 * largement suffisante pour ne jamais supprimer une ligne encore active.
 */

require_once __DIR__ . '/../bootstrap.php';

requireCronSecret();

$pdo   = pdo();
$start = microtime(true);
$paris = new DateTimeZone('Europe/Paris');

// Marge de 1h après la fin de la fenêtre la plus longue (15 min) utilisée par rateLimit().
$cutoff = time() - 3600;

$stmt = $pdo->prepare('DELETE FROM rate_limits WHERE window_start < ?');
$stmt->execute([$cutoff]);
$purged = $stmt->rowCount();

$elapsed = round((microtime(true) - $start) * 1000);
jsonSuccess([
    'purged'     => $purged,
    'elapsed_ms' => $elapsed,
    'ran_at'     => (new DateTime('now', $paris))->format('Y-m-d H:i:s'),
]);
