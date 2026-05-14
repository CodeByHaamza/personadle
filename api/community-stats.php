<?php
/**
 * GET /api/community-stats — Statistiques communautaires post-partie
 * ─────────────────────────────────────────────────────────────────────
 *
 * PARAMÈTRES GET
 * ─────────────────────────────────────────────────────────────────────
 *   mode   : identifiant du mode (ex: 'classic', 'music', 'alloutattack')
 *   date   : date YYYY-MM-DD (Europe/Paris)
 *   target : nom exact du personnage / titre de musique ciblé
 *
 * RÉPONSE
 * ─────────────────────────────────────────────────────────────────────
 *   { total: int, wins: int, percent: int }
 *
 *   total   = nombre total de sessions enregistrées pour cette cible ce jour
 *   wins    = nombre de victoires
 *   percent = round(wins / total * 100)  — 0 si total = 0
 *
 * ACCÈS
 *   Public — aucune authentification requise.
 *   La requête est en lecture seule, pas de risque CSRF.
 */

require_once __DIR__ . '/bootstrap.php';

$pdo = pdo();

// ── Paramètres ────────────────────────────────────────────────────────────────
$mode   = trim($_GET['mode']   ?? '');
$date   = trim($_GET['date']   ?? '');
$target = trim($_GET['target'] ?? '');

if ($mode === '' || $date === '' || $target === '') {
    jsonError('Missing parameter: mode, date and target are required.', 400);
}

// Validation légère du format date (YYYY-MM-DD)
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    jsonError('Invalid date format. Expected YYYY-MM-DD.', 400);
}

// ── Requête ───────────────────────────────────────────────────────────────────
// LOWER() sur mode pour gérer les variantes de casse (Classic / classic / CLASSIC)
$stmt = $pdo->prepare("
    SELECT
        COUNT(*)                                              AS total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END)     AS wins
    FROM game_sessions
    WHERE LOWER(mode) = LOWER(?)
      AND played_date = ?
      AND target_name = ?
");
$stmt->execute([$mode, $date, $target]);
$row = $stmt->fetch();

$total   = (int) ($row['total'] ?? 0);
$wins    = (int) ($row['wins']  ?? 0);
$percent = $total > 0 ? (int) round($wins / $total * 100) : 0;

jsonSuccess([
    'total'   => $total,
    'wins'    => $wins,
    'percent' => $percent,
]);
