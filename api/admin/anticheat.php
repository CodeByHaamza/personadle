<?php
/**
 * GET /api/admin/anticheat?days=30
 *
 * Les écarts de cible du jour loggés par api/sessions.php (phase 1 = détection,
 * source `anti_cheat` dans error_log), groupés par joueur : combien, quand, et
 * les trois derniers (mode, attendu, reçu). Préalable à la marche 1 de
 * l'audit (passer en rejet) : on regarde d'abord qui déclenche, et pourquoi.
 * Accès : requireAdmin().
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();
$pdo  = pdo();
$days = max(1, min(365, (int) ($_GET['days'] ?? 30)));

$st = $pdo->prepare(
    "SELECT l.id, l.user_id, l.context, l.created_at, u.pseudo, u.is_banned
     FROM error_log l LEFT JOIN users u ON u.id = l.user_id
     WHERE l.message = 'Daily target mismatch'
       AND l.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     ORDER BY l.created_at DESC
     LIMIT 5000"
);
$st->execute([$days]);

$byUser = [];
$total  = 0;
foreach ($st->fetchAll() as $r) {
    $total++;
    $uid = (int) ($r['user_id'] ?? 0);
    if (!isset($byUser[$uid])) {
        $byUser[$uid] = [
            'user_id'   => $uid,
            'pseudo'    => $r['pseudo'] ?? null,
            'is_banned' => (bool) ($r['is_banned'] ?? false),
            'count'     => 0,
            'last_at'   => $r['created_at'],
            'samples'   => [],
        ];
    }
    $byUser[$uid]['count']++;
    if (count($byUser[$uid]['samples']) < 3) {
        $ctx = json_decode((string) ($r['context'] ?? ''), true) ?: [];
        $byUser[$uid]['samples'][] = [
            'at'       => $r['created_at'],
            'mode'     => $ctx['mode']     ?? null,
            'date'     => $ctx['date']     ?? null,
            'expected' => $ctx['expected'] ?? null,
            'received' => $ctx['received'] ?? null,
            'result'   => $ctx['result']   ?? null,
        ];
    }
}
$users = array_values($byUser);
usort($users, static fn($a, $b) => $b['count'] <=> $a['count']);

jsonSuccess(['days' => $days, 'total' => $total, 'users' => $users]);
