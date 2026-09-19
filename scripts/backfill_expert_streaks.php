<?php
/**
 * scripts/backfill_expert_streaks.php — pose streak et streak_record dans
 * user_stats_expert depuis l'historique game_sessions (à lancer UNE fois, juste
 * après la migration 051 ; rejouable sans effet de bord : il écrase par les mêmes
 * valeurs recalculées).
 *
 * La 051 reprend les compteurs en SQL (games, wins, giveups, perfect_wins,
 * total_time_ms) mais laisse streak/streak_record à 0 : « jours Paris consécutifs
 * avec au moins une victoire » ne se calcule pas raisonnablement en SQL pur, et
 * l'API le faisait déjà en PHP (personadle_recompute_mode_streak).
 *
 * À lancer sur le serveur (utilise api/config.php) depuis la racine du repo :
 *     php scripts/backfill_expert_streaks.php
 */

declare(strict_types=1);

$root = dirname(__DIR__);
require $root . '/api/config.php';
require $root . '/api/lib/game_session.php';

// En local, api/config.php vise 127.0.0.1 (accès depuis l'hôte) : depuis le
// conteneur php, passer DB_HOST=db (docker exec -e DB_HOST=db …), comme
// config.docker.php le fait pour l'application.
$host = getenv('DB_HOST') ?: DB_HOST;
$port = getenv('DB_PORT') ?: DB_PORT;
$pdo = new PDO(
    "mysql:host={$host};port={$port};dbname=" . DB_NAME . ';charset=utf8mb4',
    getenv('DB_USER') ?: DB_USER, getenv('DB_PASS') ?: DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$rows = $pdo->query(
    "SELECT e.user_id, e.mode, MAX(gs.played_date) AS last_day
     FROM user_stats_expert e
     JOIN game_sessions gs ON gs.user_id = e.user_id AND gs.mode = e.mode AND gs.is_expert = 1
     GROUP BY e.user_id, e.mode"
)->fetchAll(PDO::FETCH_ASSOC);

$upd = $pdo->prepare('UPDATE user_stats_expert SET streak = ?, streak_record = ? WHERE user_id = ? AND mode = ?');
$n = 0;
foreach ($rows as $r) {
    // La streak « courante » est celle qui se termine au dernier jour joué en Expert :
    // si ce jour est ancien, elle vaudra 0 au prochain recalcul (même règle qu'en normal).
    $streak = personadle_recompute_mode_streak($pdo, (int) $r['user_id'], $r['mode'], $r['last_day'], true);
    $record = personadle_expert_streak_record($pdo, (int) $r['user_id'], $r['mode']);
    $upd->execute([$streak, max($record, $streak), (int) $r['user_id'], $r['mode']]);
    $n++;
}
echo "✅ {$n} ligne(s) user_stats_expert : streak et streak_record recalculés.\n";
