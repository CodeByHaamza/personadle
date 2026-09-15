<?php
/**
 * GET /api/admin/activity?days=30
 *
 * Tableau de bord « Activité » (2.2, décision Hamza du 2026-09-13) : ce que le
 * jeu fait vraiment, jour par jour et mode par mode — jusqu'ici toutes ces
 * données dormaient dans game_sessions sans aucune vue dessus.
 *
 * Réponse :
 *   {
 *     days: 30,
 *     totals: { players, active_7d, active_30d, games_30d, new_accounts_30d, anti_cheat_30d },
 *     daily:  [ { date, active_players, games, wins, new_accounts } … ]   (jours sans activité inclus)
 *     modes:  [ { mode, games, wins, win_rate, avg_attempts, expert_games, expert_share } … ]
 *     hours:  [ { hour, games } … ]  (heure Paris, sur la période)
 *   }
 *
 * Seuls les comptes sont comptés (les invités ne postent pas de session).
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

$days = (int) ($_GET['days'] ?? 30);
if ($days < 7)   $days = 7;
if ($days > 180) $days = 180;

$pdo   = pdo();
$paris = new DateTimeZone('Europe/Paris');
$today = new DateTime('now', $paris);
$from  = (clone $today)->modify('-' . ($days - 1) . ' days')->format('Y-m-d');
// Borne basse des TIMESTAMP (stockés en UTC) : minuit Paris du premier jour, converti.
$fromTs = (clone $today)->modify('-' . ($days - 1) . ' days')->setTime(0, 0)
    ->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');

// ── Totaux ──────────────────────────────────────────────────────────────────
$players = (int) $pdo->query('SELECT COUNT(*) FROM users WHERE is_deleted = 0')->fetchColumn();

$st = $pdo->prepare('SELECT COUNT(DISTINCT user_id) FROM game_sessions WHERE played_date >= ?');
$st->execute([(clone $today)->modify('-6 days')->format('Y-m-d')]);
$active7 = (int) $st->fetchColumn();
$st->execute([$from]);
$active30 = (int) $st->fetchColumn();

$st = $pdo->prepare('SELECT COUNT(*) FROM game_sessions WHERE played_date >= ?');
$st->execute([$from]);
$games30 = (int) $st->fetchColumn();

$st = $pdo->prepare('SELECT COUNT(*) FROM users WHERE created_at >= ? AND is_deleted = 0');
$st->execute([$fromTs]);
$newAccounts30 = (int) $st->fetchColumn();

// Écarts anti-triche loggés sur la période (api/sessions.php, phase 1 = détection)
$antiCheat30 = 0;
try {
    $st = $pdo->prepare("SELECT COUNT(*) FROM error_log WHERE created_at >= ? AND message = 'Daily target mismatch'");
    $st->execute([$fromTs]);
    $antiCheat30 = (int) $st->fetchColumn();
} catch (Throwable) {
    // table absente sur une base minimale : le compteur reste à 0
}

// ── Par jour ────────────────────────────────────────────────────────────────
$st = $pdo->prepare(
    "SELECT played_date AS d, COUNT(DISTINCT user_id) AS active_players, COUNT(*) AS games,
            SUM(result = 'win') AS wins
     FROM game_sessions WHERE played_date >= ?
     GROUP BY played_date"
);
$st->execute([$from]);
$byDay = [];
foreach ($st->fetchAll() as $r) $byDay[$r['d']] = $r;

// Les TIMESTAMP sont stockés en UTC ; la frontière de journée est celle du jeu
// (Europe/Paris, DST compris). CONVERT_TZ dépend des tables de fuseaux du serveur
// SQL — absentes sur un hébergement mutualisé — donc le regroupement se fait en PHP.
$utc = new DateTimeZone('UTC');
$st = $pdo->prepare('SELECT created_at FROM users WHERE created_at >= ? AND is_deleted = 0 LIMIT 100000');
$st->execute([$fromTs]);
$newByDay = [];
foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $ts) {
    $d = (new DateTime($ts, $utc))->setTimezone($paris)->format('Y-m-d');
    $newByDay[$d] = ($newByDay[$d] ?? 0) + 1;
}

$daily = [];
for ($i = $days - 1; $i >= 0; $i--) {
    $d = (clone $today)->modify("-$i days")->format('Y-m-d');
    $row = $byDay[$d] ?? null;
    $daily[] = [
        'date'           => $d,
        'active_players' => (int) ($row['active_players'] ?? 0),
        'games'          => (int) ($row['games'] ?? 0),
        'wins'           => (int) ($row['wins'] ?? 0),
        'new_accounts'   => $newByDay[$d] ?? 0,
    ];
}

// ── Par mode ────────────────────────────────────────────────────────────────
$st = $pdo->prepare(
    "SELECT mode, COUNT(*) AS games, SUM(result = 'win') AS wins,
            AVG(CASE WHEN result = 'win' THEN attempts END) AS avg_attempts,
            SUM(is_expert = 1) AS expert_games
     FROM game_sessions WHERE played_date >= ?
     GROUP BY mode"
);
$st->execute([$from]);
$byMode = [];
foreach ($st->fetchAll() as $r) $byMode[$r['mode']] = $r;

$modes = [];
foreach (PERSONADLE_MODES as $m) {
    $r = $byMode[$m] ?? null;
    $g = (int) ($r['games'] ?? 0);
    $w = (int) ($r['wins'] ?? 0);
    $e = (int) ($r['expert_games'] ?? 0);
    $modes[] = [
        'mode'         => $m,
        'games'        => $g,
        'wins'         => $w,
        'win_rate'     => $g > 0 ? round($w * 100 / $g, 1) : null,
        'avg_attempts' => $r !== null && $r['avg_attempts'] !== null ? round((float) $r['avg_attempts'], 2) : null,
        'expert_games' => $e,
        'expert_share' => $g > 0 ? round($e * 100 / $g, 1) : null,
    ];
}

// ── Par heure (Paris) ───────────────────────────────────────────────────────
$st = $pdo->prepare('SELECT created_at FROM game_sessions WHERE played_date >= ? LIMIT 200000');
$st->execute([$from]);
$byHour = array_fill(0, 24, 0);
foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $ts) {
    $h = (int) (new DateTime($ts, $utc))->setTimezone($paris)->format('G');
    $byHour[$h]++;
}
$hours = [];
foreach ($byHour as $h => $n) $hours[] = ['hour' => $h, 'games' => $n];

jsonSuccess([
    'days'   => $days,
    'totals' => [
        'players'          => $players,
        'active_7d'        => $active7,
        'active_30d'       => $active30,
        'games_30d'        => $games30,
        'new_accounts_30d' => $newAccounts30,
        'anti_cheat_30d'   => $antiCheat30,
    ],
    'daily'  => $daily,
    'modes'  => $modes,
    'hours'  => $hours,
]);
