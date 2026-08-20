<?php
/**
 * POST /api/sessions
 * ────────────────────────────────────────────────────────────────────────────
 * Enregistre une partie terminée et met à jour user_stats.
 *
 * Body JSON : {
 *   mode, played_date, target_name, result, attempts, time_ms, active_filters
 * }
 * Succès : 201 { session_id, stats }
 * Erreurs : 400 (validation), 401 (non connecté), 409 (partie déjà enregistrée)
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/streak.php';
require_once __DIR__ . '/lib/game_session.php';
require_once __DIR__ . '/lib/daily_target.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

$userId = requireAuth();

// ── Rate limiting : 15 requêtes / 15 min par utilisateur ─────────────────────
// Protège contre les bots qui posteraient des sessions en boucle.
// La contrainte UNIQUE per (user, mode, date) protège l'intégrité, mais ce
// rate limit coupe les appels répétitifs avant même d'atteindre la BDD.
rateLimit('sessions:' . $userId, 15, 15 * 60, 'Too many session submissions. Please wait a few minutes.');
$data   = getJsonBody();

// ── Validation ────────────────────────────────────────────────────────────────
$validModes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];

$mode        = strtolower(trim($data['mode']        ?? ''));
$playedDate  =            trim($data['played_date'] ?? '');
$targetName  =            trim($data['target_name'] ?? '');
$result      = strtolower(trim($data['result']      ?? ''));
$attempts    = (int)           ($data['attempts']   ?? 0);
$timeMs      = (int)           ($data['time_ms']    ?? 0);
$filters     =                  $data['active_filters'] ?? [];
// Mode Expert (migration 031) — même `mode`, mécanique et cible différentes.
$isExpert    = filter_var($data['is_expert'] ?? false, FILTER_VALIDATE_BOOLEAN);
// Clé d'idempotence générée par le client (migration 032) : rejouer une session
// déjà enregistrée renvoie 409 au lieu de l'insérer une seconde fois.
$clientSessionId = trim((string) ($data['client_session_id'] ?? ''));
if ($clientSessionId !== '' && !preg_match('/^[0-9a-fA-F-]{8,36}$/', $clientSessionId)) {
    jsonError('Invalid client_session_id', 400);
}

if (!in_array($mode, $validModes, true)) {
    jsonError("Invalid mode. Expected one of: " . implode(', ', $validModes));
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $playedDate)) {
    jsonError('Invalid played_date format. Expected YYYY-MM-DD');
}
// Valider que played_date est aujourd'hui ou hier en heure de Paris
// (évite les injections de sessions sur des dates passées arbitraires)
$parisNow       = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
$parisYesterday = (new DateTime('yesterday', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
if ($playedDate !== $parisNow && $playedDate !== $parisYesterday) {
    jsonError('played_date must be today or yesterday (Europe/Paris timezone)', 400);
}
if (empty($targetName)) {
    jsonError('target_name is required');
}
if (!in_array($result, ['win', 'giveup'], true)) {
    jsonError("Invalid result. Expected 'win' or 'giveup'");
}
// Le Mode Expert révèle un vers par essai raté : une chanson de 30 vers autorise
// donc jusqu'à 30 essais, bien au-delà du plafond de 20 des modes normaux.
$maxAttempts = $isExpert ? 40 : 20;
if ($attempts < 0 || $attempts > $maxAttempts) {
    jsonError('Invalid attempts value');
}
// Modes disposant d'une variante Expert (pool + clé de hash dédiés dans
// api/lib/daily_target.php). Accepter is_expert sur un autre mode créerait des
// lignes que le recalcul anti-triche ne saurait pas rejouer.
$expertModes = ['music', 'classic', 'emoji', 'silhouette', 'alloutattack', 'personae'];
if ($isExpert && !in_array($mode, $expertModes, true)) {
    jsonError('Expert mode is not available for this mode', 400);
}
if (!is_array($filters)) {
    $filters = [];
}

$pdo = pdo();

// ── Anti-triche (phase 1 : détection uniquement) ─────────────────────────────
// Recalcule la cible quotidienne attendue côté serveur (même algorithme seedé
// que js/gameCore.js::getDailyTarget(), voir api/lib/daily_target.php) et logue
// un écart au lieu de le rejeter, le temps de vérifier en prod qu'il n'y a pas
// de faux positifs (mêmes 10 exécutions vertes avant de bloquer que le job E2E
// CI, cf. tests-e2e/README.md). getPlayerSeedId() (js/gameCore.js) utilise
// String(user.id) comme seed pour un compte connecté — identique à (string) $userId.
// Seule la PREMIÈRE session du jour doit matcher la cible quotidienne : les
// replays (bouton Replay après win/giveup) tirent volontairement une cible
// aléatoire côté client (resetGame(random)), donc un écart y est NORMAL — sans
// cette garde, chaque replay loggait un faux positif anti_cheat. Cf. décision
// produit 2026-07-17 (victoire en replay upgradée giveup→win, game_session.php).
// Le scope is_expert compte : une partie normale déjà enregistrée ne doit pas
// dispenser la partie Expert du jour de la vérification anti-triche (et inversement).
$hasSessionToday = (static function (PDO $pdo, int $userId, string $mode, string $playedDate, bool $isExpert): bool {
    $st = $pdo->prepare(
        'SELECT 1 FROM game_sessions
         WHERE user_id = ? AND mode = ? AND played_date = ? AND is_expert = ? LIMIT 1'
    );
    $st->execute([$userId, $mode, $playedDate, $isExpert ? 1 : 0]);
    return (bool) $st->fetchColumn();
})($pdo, $userId, $mode, $playedDate, $isExpert);

if (!$hasSessionToday) {
    // Clé de pool distincte en Expert : le tirage est indépendant du mode normal.
    $targetMode = $isExpert ? $mode . '_expert' : $mode;
    $expectedTarget = personadle_compute_daily_target($targetMode, $playedDate, (string) $userId, $filters);
    if ($expectedTarget !== null && strcasecmp($expectedTarget, $targetName) !== 0) {
        personadle_log_error($pdo, 'warning', 'Daily target mismatch', [
            'source'   => 'anti_cheat',
            'mode'     => $targetMode,
            'date'     => $playedDate,
            'result'   => $result,
            'expected' => $expectedTarget,
            'received' => $targetName,
            'filters'  => $filters,
        ], $userId);
    }
}

// ── Anti-doublon : idempotence par client_session_id (migration 032) ─────────
// Il n'y a plus de plafond d'une partie par jour : 50 parties dans la soirée font
// 50 lignes. Le seul doublon refusé est le REJEU d'un client_session_id déjà
// enregistré (file savePendingSession rejouée après un timeout). La contrainte
// UNIQUE uq_session_client_id garantit l'unicité même en requêtes simultanées ;
// personadle_record_game_session() la transforme en
// PersonadleDuplicateSessionException, rendue au client en 409.
$pdo->beginTransaction();
try {
    $sessionResult = personadle_record_game_session(
        $pdo, $userId, $mode, $playedDate, $targetName, $result, $attempts, $timeMs, $filters,
        $isExpert, $clientSessionId
    );
    $pdo->commit();
} catch (PersonadleDuplicateSessionException $dup) {
    $pdo->rollBack();
    jsonError($dup->getMessage(), 409);
} catch (Throwable $e) {
    $pdo->rollBack();
    personadle_log_error($pdo, 'error', $e->getMessage(), [
        'source' => 'sessions',
        'mode'   => $mode,
    ], $userId);
    jsonError('Failed to save session', 500);
}

jsonSuccess($sessionResult, 201);
