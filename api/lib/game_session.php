<?php
/**
 * api/lib/game_session.php — Enregistrement d'une partie + mise à jour des stats/streaks.
 *
 * Contrairement à api/lib/streak.php (pur, sans base), ce fichier TOUCHE LA BASE —
 * extrait de api/sessions.php pour être testable en intégration (PHPUnit + MariaDB,
 * cf. tests/php/DatabaseIntegrationTest.php) sans dupliquer la logique dans les tests :
 * l'endpoint appelle exactement cette fonction.
 */

declare(strict_types=1);

require_once __DIR__ . '/streak.php';

/** Levée quand une session existe déjà pour (user, mode, date) — l'appelant mappe vers un 409. */
class PersonadleDuplicateSessionException extends RuntimeException
{
}

/**
 * Recalcule la streak par-mode depuis l'historique game_sessions : jours
 * consécutifs (Paris) se terminant à $playedDate dont le résultat est 'win'.
 * Utilisé lors d'un upgrade giveup→win : le giveup avait mis la streak à 0 et
 * on ne peut pas retrouver sa valeur d'avant sans rejouer l'historique.
 */
function personadle_recompute_mode_streak(PDO $pdo, int $userId, string $mode, string $playedDate): int
{
    $stmt = $pdo->prepare(
        'SELECT played_date, result FROM game_sessions
         WHERE user_id = ? AND mode = ? AND played_date <= ?
         ORDER BY played_date DESC LIMIT 400'
    );
    $stmt->execute([$userId, $mode, $playedDate]);

    $streak   = 0;
    $expected = new DateTime($playedDate, new DateTimeZone('Europe/Paris'));
    foreach ($stmt->fetchAll() as $row) {
        if ($row['played_date'] !== $expected->format('Y-m-d') || $row['result'] !== 'win') {
            break;
        }
        $streak++;
        $expected->modify('-1 day');
    }
    return $streak;
}

/**
 * Enregistre une partie terminée : insère la session, met à jour les stats du
 * mode (games/wins/giveups/streak/streak_record/perfect_wins/total_time_ms) et
 * la streak globale (tous modes confondus, frontière de journée Europe/Paris).
 *
 * L'appelant est responsable de la transaction (begin/commit/rollback) et de
 * la validation des paramètres (mode/played_date/result/attempts) — cette
 * fonction suppose des valeurs déjà validées.
 *
 * @param array<string,mixed> $filters Filtres actifs, encodés en JSON pour la colonne.
 * @return array{session_id:int, stats:array{mode:string, games:int, wins:int, giveups:int, streak:int, streak_record:int, perfect_wins:int, total_time_ms:int}, global_streak:int}
 * @throws PersonadleDuplicateSessionException Session déjà enregistrée pour ce (user, mode, date).
 */
function personadle_record_game_session(
    PDO $pdo,
    int $userId,
    string $mode,
    string $playedDate,
    string $targetName,
    string $result,
    int $attempts,
    int $timeMs,
    array $filters
): array {
    // 1. Insérer la session — la contrainte UNIQUE (user, mode, date) protège
    //    même en cas de requêtes concurrentes (pas de TOCTOU).
    try {
        $pdo->prepare('
            INSERT INTO game_sessions
                (user_id, mode, played_date, target_name, result, attempts, time_ms, active_filters)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $userId, $mode, $playedDate, $targetName, $result,
            $attempts, $timeMs, json_encode($filters),
        ]);
    } catch (PDOException $dup) {
        if ($dup->getCode() === '23000') {
            // Décision produit (2026-07-17, Hamza) : une victoire compte toujours,
            // même après un abandon le même jour. Si la ligne du jour est un
            // giveup et que le nouveau résultat est un win → upgrade au lieu de 409.
            // Tous les autres doublons (win→win, win→giveup, giveup→giveup)
            // restent rejetés en 409 comme avant.
            if ($result === 'win') {
                $upgraded = personadle_upgrade_giveup_to_win(
                    $pdo, $userId, $mode, $playedDate, $attempts, $timeMs
                );
                if ($upgraded !== null) {
                    return $upgraded;
                }
            }
            throw new PersonadleDuplicateSessionException(
                "Session already recorded for mode '$mode' on $playedDate"
            );
        }
        throw $dup;
    }
    $sessionId = (int) $pdo->lastInsertId();

    // 2. Lire les stats actuelles pour calculer la streak.
    //    Garde-fou : si la ligne (user, mode) n'existe pas (vieux compte, init
    //    partielle), on la crée à zéro — sinon l'UPDATE plus bas matcherait 0
    //    ligne et les stats du mode seraient silencieusement perdues.
    $pdo->prepare('INSERT IGNORE INTO user_stats (user_id, mode) VALUES (?, ?)')
        ->execute([$userId, $mode]);

    $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? AND mode = ? LIMIT 1');
    $stmt->execute([$userId, $mode]);
    $stats = $stmt->fetch();

    $isWin     = $result === 'win';
    $isPerfect = personadle_is_perfect($result, $attempts);

    $newStreak = personadle_compute_streak(
        $stats['last_played_at'] ?? null,
        $playedDate,
        $result,
        (int) $stats['streak']
    );
    $newRecord = max((int) $stats['streak_record'], $newStreak);

    $pdo->prepare('
        UPDATE user_stats SET
            games        = games + 1,
            wins         = wins + ?,
            giveups      = giveups + ?,
            streak       = ?,
            streak_record= ?,
            perfect_wins = perfect_wins + ?,
            total_time_ms= total_time_ms + ?,
            last_played_at = UTC_TIMESTAMP()
        WHERE user_id = ? AND mode = ?
    ')->execute([
        $isWin ? 1 : 0,
        $isWin ? 0 : 1,
        $newStreak,
        $newRecord,
        $isPerfect ? 1 : 0,
        $timeMs,
        $userId,
        $mode,
    ]);

    // 2b. Streak GLOBALE (tous modes) — autoritative, basée sur la date Paris du jour.
    //     Indépendante des streaks par-mode : compte les jours consécutifs joués.
    $g = $pdo->prepare('SELECT global_streak, global_streak_date FROM users WHERE id = ? LIMIT 1');
    $g->execute([$userId]);
    $grow = $g->fetch();
    $parisNow = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    $newGlobalStreak = personadle_global_streak(
        $grow['global_streak_date'] ?? null,
        $parisNow,
        (int) ($grow['global_streak'] ?? 0)
    );
    $pdo->prepare(
        'UPDATE users
         SET global_streak = ?, global_streak_record = GREATEST(global_streak_record, ?),
             global_streak_date = ?
         WHERE id = ?'
    )->execute([$newGlobalStreak, $newGlobalStreak, $parisNow, $userId]);

    // 3. Relire les stats mises à jour pour les renvoyer au client
    $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? AND mode = ?');
    $stmt->execute([$userId, $mode]);
    $updatedStats = $stmt->fetch();

    return [
        'session_id' => $sessionId,
        'stats'      => [
            'mode'          => $mode,
            'games'         => (int) $updatedStats['games'],
            'wins'          => (int) $updatedStats['wins'],
            'giveups'       => (int) $updatedStats['giveups'],
            'streak'        => (int) $updatedStats['streak'],
            'streak_record' => (int) $updatedStats['streak_record'],
            'perfect_wins'  => (int) $updatedStats['perfect_wins'],
            'total_time_ms' => (int) $updatedStats['total_time_ms'],
        ],
        'global_streak' => $newGlobalStreak,
    ];
}

/**
 * Upgrade la session giveup du jour en win (décision produit 2026-07-17).
 *
 * Retourne le même shape que personadle_record_game_session (avec 'upgraded' =>
 * true en plus), ou null si la ligne existante n'est pas un giveup (l'appelant
 * retombe alors sur le 409 habituel).
 *
 * Choix assumés (documentés aussi dans DEV_CHANGELOG.md) :
 *   - `games` inchangé (c'est la même journée de jeu, pas une partie de plus) ;
 *   - `wins` +1 / `giveups` −1 ;
 *   - `total_time_ms` += le temps de la nouvelle tentative (temps réellement passé) ;
 *   - `perfect_wins` PAS incrémenté : l'abandon a révélé la réponse, une
 *     « victoire parfaite » après coup serait du farming gratuit — le win compte,
 *     pas le perfect (anti-abus minimal sans pénaliser la récompense) ;
 *   - streak recalculée depuis l'historique game_sessions (le giveup l'avait mise
 *     à 0 et sa valeur d'avant n'est pas récupérable autrement).
 */
function personadle_upgrade_giveup_to_win(
    PDO $pdo,
    int $userId,
    string $mode,
    string $playedDate,
    int $attempts,
    int $timeMs
): ?array {
    $stmt = $pdo->prepare(
        'SELECT id, result FROM game_sessions
         WHERE user_id = ? AND mode = ? AND played_date = ? LIMIT 1'
    );
    $stmt->execute([$userId, $mode, $playedDate]);
    $existing = $stmt->fetch();
    if (!$existing || $existing['result'] !== 'giveup') {
        return null;
    }

    $pdo->prepare(
        'UPDATE game_sessions SET result = "win", attempts = ?, time_ms = time_ms + ? WHERE id = ?'
    )->execute([$attempts, $timeMs, (int) $existing['id']]);

    // Stats du mode : bascule giveup→win + streak recalculée depuis l'historique.
    $newStreak = personadle_recompute_mode_streak($pdo, $userId, $mode, $playedDate);
    $pdo->prepare('
        UPDATE user_stats SET
            wins          = wins + 1,
            giveups       = GREATEST(giveups - 1, 0),
            streak        = ?,
            streak_record = GREATEST(streak_record, ?),
            total_time_ms = total_time_ms + ?,
            last_played_at = UTC_TIMESTAMP()
        WHERE user_id = ? AND mode = ?
    ')->execute([$newStreak, $newStreak, $timeMs, $userId, $mode]);

    $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? AND mode = ?');
    $stmt->execute([$userId, $mode]);
    $updatedStats = $stmt->fetch();

    $g = $pdo->prepare('SELECT global_streak FROM users WHERE id = ? LIMIT 1');
    $g->execute([$userId]);

    return [
        'session_id' => (int) $existing['id'],
        'upgraded'   => true,
        'stats'      => [
            'mode'          => $mode,
            'games'         => (int) $updatedStats['games'],
            'wins'          => (int) $updatedStats['wins'],
            'giveups'       => (int) $updatedStats['giveups'],
            'streak'        => (int) $updatedStats['streak'],
            'streak_record' => (int) $updatedStats['streak_record'],
            'perfect_wins'  => (int) $updatedStats['perfect_wins'],
            'total_time_ms' => (int) $updatedStats['total_time_ms'],
        ],
        'global_streak' => (int) ($g->fetch()['global_streak'] ?? 0),
    ];
}
