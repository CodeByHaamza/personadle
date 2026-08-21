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

// ── Rate limiting : 90 requêtes / 15 min par utilisateur ─────────────────────
// RECALIBRÉ AVEC LA MIGRATION 032 — l'ancienne valeur (15 / 15 min) datait du
// monde où `uq_session_per_day` plafonnait le jeu à 6 sessions par jour, une par
// mode : 15 était alors dix fois au-dessus du besoin réel.
//
// Depuis que « toutes les parties comptent », c'est ce rate limit qui est devenu
// le plafond effectif, et il coupait à la 16e partie d'affilée. Les suivantes
// partaient en file `pendingSessions` (rien n'est perdu), mais elles n'arrivaient
// en base qu'au rechargement de page suivant, une fois la fenêtre rouverte. En
// attendant : stats du profil non mises à jour, absence du classement, et badges
// de volume non débloqués — alors que le joueur a bien joué ses parties. Pire,
// `pullProfileFromCloud()` écrase le local par le backend (source de vérité) :
// le compteur RECULAIT à l'écran.
//
// 90 / 15 min = 6 parties/minute soutenues. La partie la plus rapide du jeu (un
// replay Émoji ou AOA dont on connaît déjà la réponse) prend ~10-15 s : aucun
// joueur réel n'atteint ce plafond, y compris en enchaînant une soirée entière
// pour chasser les badges. Il reste largement assez bas pour couper un bot.
//
// Doit aussi absorber un rattrapage : au retour en ligne, `syncPending()`
// (js/api.js) rejoue toute la file d'un coup, une requête par session.
rateLimit('sessions:' . $userId, 90, 15 * 60, 'Too many session submissions. Please wait a few minutes.');
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
// Groupes hexadécimaux d'au moins 4 caractères séparés par des tirets : couvre
// l'UUID v4 (8-4-4-4-12) et le repli de newId() (js/gameCore.js), sans accepter
// une chaîne dégénérée comme "--------" que `[0-9a-fA-F-]{8,36}` laissait passer.
if ($clientSessionId !== ''
    && !preg_match('/^[0-9a-f]{4,}(-[0-9a-f]{4,})*$/i', $clientSessionId)) {
    jsonError('Invalid client_session_id', 400);
}
if (strlen($clientSessionId) > 36) {
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
//
// 200 et non 40 : en Classique Expert le joueur n'a AUCUN retour (ni grille, ni
// indice progressif) sur 180 candidats — dépasser 40 essais y est un scénario de
// jeu normal, pas un abus. Or `syncPending()` (js/api.js) jette silencieusement
// toute session refusée en 400 : la partie était perdue sans que rien ne le dise.
// La borne reste utile contre une valeur absurde, elle ne doit juste pas tomber
// sous la taille du plus grand pool (184).
$maxAttempts = $isExpert ? 200 : 20;
if ($attempts < 0 || $attempts > $maxAttempts) {
    jsonError('Invalid attempts value');
}
// Pas de garde « ce mode a-t-il une variante Expert ? » : les 6 modes de
// $validModes en ont un, donc la liste aurait été identique et le test toujours
// vrai — code mort, démontré par PHPStan (function.alreadyNarrowedType +
// booleanAnd.alwaysFalse sur la version 2.2.8).
//
// Si un 7e mode SANS variante Expert est ajouté un jour à $validModes, il faudra
// la rétablir ici. Le symptôme sans elle : personadle_compute_daily_target()
// n'aurait pas de `case '<mode>_expert'`, renverrait null, et la session serait
// enregistrée en is_expert = 1 sans aucune vérification anti-triche.
// tests/expertWiring.test.js verrouille la correspondance entre $validModes et
// les `case` de api/lib/daily_target.php — c'est ce test qui préviendra.
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
