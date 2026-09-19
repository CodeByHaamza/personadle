<?php
/**
 * api/lib/weekly_podium.php — le top 3 de la semaine, pour le cron Discord
 * (api/cron/discord_weekly.php). Séparé du cron pour être testable : le cron
 * exige CRON_SECRET, absent en local et en CI.
 */

declare(strict_types=1);

require_once __DIR__ . '/discord_webhook.php';

/**
 * Podium d'une dimension (normal ou Expert) : les 3 meilleurs par victoires
 * depuis `$from` (Y-m-d, lundi de la semaine — même fenêtre que period=week du
 * classement). Égalité → le moins de parties d'abord (plus efficace), puis
 * pseudo. Comptes supprimés exclus. Le littéral is_expert vient d'un bool,
 * jamais d'une entrée externe.
 *
 * @return list<array{pseudo:string, wins:int, games:int}>
 */
function personadle_weekly_podium(PDO $pdo, string $from, bool $expert): array
{
    $stmt = $pdo->prepare(
        "SELECT u.pseudo,
                SUM(gs.result = 'win') AS wins,
                COUNT(*)               AS games
         FROM game_sessions gs
         JOIN users u ON u.id = gs.user_id
         WHERE gs.played_date >= ?
           AND gs.is_expert = " . ($expert ? 1 : 0) . "
           AND u.is_deleted = 0
         GROUP BY u.id, u.pseudo
         HAVING wins > 0
         ORDER BY wins DESC, games ASC, u.pseudo ASC
         LIMIT 3"
    );
    $stmt->execute([$from]);
    return array_map(static fn(array $r): array => [
        'pseudo' => (string) $r['pseudo'],
        'wins'   => (int) $r['wins'],
        'games'  => (int) $r['games'],
    ], $stmt->fetchAll());
}

/**
 * Lignes 🥇🥈🥉 d'un podium, prêtes pour un embed Discord (pseudos échappés).
 *
 * @param list<array{pseudo:string, wins:int, games:int}> $podium
 */
function personadle_weekly_lines(array $podium): string
{
    $medals = ['🥇', '🥈', '🥉'];
    $lines  = [];
    foreach (array_slice($podium, 0, 3) as $i => $p) {
        $lines[] = sprintf(
            '%s **%s** — %d victoire%s · %d partie%s',
            $medals[$i],
            personadle_discord_escape($p['pseudo']),
            $p['wins'], $p['wins'] > 1 ? 's' : '',
            $p['games'], $p['games'] > 1 ? 's' : ''
        );
    }
    return implode("\n", $lines);
}
