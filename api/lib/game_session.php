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
 * Avance la streak GLOBALE (tous modes confondus) d'un cran si le joueur n'a pas
 * déjà joué aujourd'hui, frontière de journée Europe/Paris. Extrait de
 * personadle_record_game_session() parce que le Mode Expert en a besoin sans
 * passer par l'agrégation user_stats : une journée où le joueur n'a fait que de
 * l'Expert reste une journée jouée.
 *
 * @return int La nouvelle valeur de global_streak.
 */
function personadle_bump_global_streak(PDO $pdo, int $userId): int
{
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

    return $newGlobalStreak;
}


/**
 * Statistiques Mode Expert d'un joueur, calculées **directement depuis
 * game_sessions** — `user_stats` n'agrège pas l'Expert (cf.
 * personadle_record_game_session), et rien ne justifie encore d'y ajouter une
 * dimension pour un affichage unique.
 *
 * Volume : une ligne par (mode, jour) et par joueur, donc quelques centaines au
 * pire — un GROUP BY direct est largement suffisant.
 * ponytail: agrégation à la volée, à matérialiser si la page profil devient lente
 *
 * @return list<array{mode:string, games:int, wins:int, giveups:int, streak:int, best_attempts:int|null, total_time_ms:int, last_played_date:?string}>
 */
function personadle_expert_stats_by_mode(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT mode,
                COUNT(*)                                          AS games,
                SUM(result = 'win')                               AS wins,
                SUM(result = 'giveup')                            AS giveups,
                MIN(CASE WHEN result = 'win' THEN attempts END)   AS best_attempts,
                COALESCE(SUM(time_ms), 0)                         AS total_time_ms,
                MAX(played_date)                                  AS last_played_date
         FROM game_sessions
         WHERE user_id = ? AND is_expert = 1
         GROUP BY mode
         ORDER BY mode"
    );
    $stmt->execute([$userId]);

    $today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $out[] = [
            'mode'             => $row['mode'],
            'games'            => (int) $row['games'],
            'wins'             => (int) $row['wins'],
            'giveups'          => (int) $row['giveups'],
            // Streak Expert du mode, recalculée depuis l'historique — il n'existe
            // aucun compteur persisté pour l'Expert.
            'streak'           => personadle_recompute_mode_streak($pdo, $userId, $row['mode'], $today, true),
            'best_attempts'    => $row['best_attempts'] === null ? null : (int) $row['best_attempts'],
            'total_time_ms'    => (int) $row['total_time_ms'],
            'last_played_date' => $row['last_played_date'],
        ];
    }
    return $out;
}

/**
 * Recalcule la streak par-mode depuis l'historique game_sessions : jours
 * consécutifs (Paris) se terminant à $playedDate comportant au moins une victoire.
 *
 * Depuis la migration 032 c'est la SEULE source de vérité de la streak. Le calcul
 * incrémental d'avant (personadle_compute_streak, à partir de last_played_at)
 * supposait une partie par jour : avec plusieurs parties quotidiennes il remettait
 * la streak à 1 au deuxième replay du jour, et à 0 au premier abandon. Recalculer
 * depuis l'historique borné est correct dans tous les cas et sans état à corrompre.
 *
 * Le scope `is_expert` sépare les deux : par défaut on calcule la streak du mode
 * NORMAL (une victoire Expert ne doit pas la prolonger, décision 2026-08-15).
 * Passer `true` donne la streak Expert du mode — c'est ainsi que api/user/stats.php
 * la calcule, `user_stats` n'agrégeant pas l'Expert.
 */
function personadle_recompute_mode_streak(
    PDO $pdo,
    int $userId,
    string $mode,
    string $playedDate,
    bool $isExpert = false
): int {
    // GROUP BY played_date : depuis la migration 032, un jour peut porter plusieurs
    // parties. Le jour compte comme gagné si AU MOINS une d'entre elles est une
    // victoire — sans quoi un replay perdu après une victoire casserait la streak
    // d'une journée pourtant gagnée.
    $stmt = $pdo->prepare(
        "SELECT played_date, MAX(result = 'win') AS won FROM game_sessions
         WHERE user_id = ? AND mode = ? AND played_date <= ? AND is_expert = ?
         GROUP BY played_date
         ORDER BY played_date DESC LIMIT 400"
    );
    $stmt->execute([$userId, $mode, $playedDate, $isExpert ? 1 : 0]);

    $streak   = 0;
    $expected = new DateTime($playedDate, new DateTimeZone('Europe/Paris'));
    foreach ($stmt->fetchAll() as $row) {
        if ($row['played_date'] !== $expected->format('Y-m-d') || !(int) $row['won']) {
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
 * MODE EXPERT (`$isExpert`) — la partie est enregistrée dans game_sessions avec
 * is_expert = 1, mais **n'agrège PAS dans user_stats** : cette table est un cache
 * par (user, mode) lu par 15 fichiers API, et rien n'affiche encore de stats Expert.
 * L'y injecter maintenant demanderait d'auditer tous ces lecteurs pour un affichage
 * qui n'existe pas. Quand l'UI Expert arrivera, elle lira game_sessions (où tout est
 * déjà) ou recevra sa propre migration à ce moment-là.
 * La streak GLOBALE, elle, est bien mise à jour : elle compte les jours joués, et un
 * jour où le joueur n'a fait que de l'Expert reste un jour joué — l'exclure casserait
 * sa streak alors qu'il a joué.
 * ponytail: agrégation Expert différée, à faire quand une UI la lit vraiment
 *
 * @param array<string,mixed> $filters Filtres actifs, encodés en JSON pour la colonne.
 * @param bool $isExpert Partie jouée en Mode Expert (migration 031).
 * @return array{session_id:int, stats:array{mode:string, games:int, wins:int, giveups:int, streak:int, streak_record:int, perfect_wins:int, total_time_ms:int}, global_streak:int}
 * @throws PersonadleDuplicateSessionException Session déjà enregistrée pour ce (user, mode, date, is_expert).
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
    array $filters,
    bool $isExpert = false,
    string $clientSessionId = ''
): array {
    // 1. Insérer la session — la contrainte UNIQUE (user, mode, date, is_expert)
    //    protège même en cas de requêtes concurrentes (pas de TOCTOU).
    try {
        $pdo->prepare('
            INSERT INTO game_sessions
                (user_id, mode, is_expert, client_session_id, played_date, target_name, result, attempts, time_ms, active_filters)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $userId, $mode, $isExpert ? 1 : 0, $clientSessionId !== '' ? $clientSessionId : null,
            $playedDate, $targetName, $result,
            $attempts, $timeMs, json_encode($filters),
        ]);
    } catch (PDOException $dup) {
        if ($dup->getCode() === '23000') {
            // Depuis la migration 032 il n'y a plus de plafond d'une partie par jour :
            // le seul doublon possible est le REJEU d'un client_session_id déjà
            // enregistré — typiquement savePendingSession() qui rejoue une file
            // localStorage après un timeout sur une requête que le serveur avait
            // pourtant traitée. C'est exactement ce que la clé d'idempotence doit
            // absorber : on renvoie 409, que le client traite comme « déjà pris en
            // compte » et retire de sa file.
            //
            // L'ancien upgrade giveup→win a disparu avec la contrainte : une victoire
            // après un abandon le même jour est désormais simplement une ligne de
            // plus, et la streak la voit via le MAX(result='win') par jour.
            throw new PersonadleDuplicateSessionException(
                "Session already recorded (client_session_id: $clientSessionId)"
            );
        }
        throw $dup;
    }
    $sessionId = (int) $pdo->lastInsertId();

    // 2. Expert : on saute toute l'agrégation par mode (voir docbloc). On passe
    //    directement à la streak globale, puis on renvoie les stats du mode
    //    INCHANGÉES — le client doit voir que sa streak Music n'a pas bougé.
    if ($isExpert) {
        $globalStreak = personadle_bump_global_streak($pdo, $userId);
        $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? AND mode = ? LIMIT 1');
        $stmt->execute([$userId, $mode]);
        $unchanged = $stmt->fetch() ?: [];
        return [
            'session_id'    => $sessionId,
            'is_expert'     => true,
            'stats'         => [
                'mode'          => $mode,
                'games'         => (int) ($unchanged['games'] ?? 0),
                'wins'          => (int) ($unchanged['wins'] ?? 0),
                'giveups'       => (int) ($unchanged['giveups'] ?? 0),
                'streak'        => (int) ($unchanged['streak'] ?? 0),
                'streak_record' => (int) ($unchanged['streak_record'] ?? 0),
                'perfect_wins'  => (int) ($unchanged['perfect_wins'] ?? 0),
                'total_time_ms' => (int) ($unchanged['total_time_ms'] ?? 0),
            ],
            'global_streak' => $globalStreak,
        ];
    }

    // 3. Lire les stats actuelles pour calculer la streak.
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

    // Recalcul depuis l'historique, jamais incrémental : avec plusieurs parties par
    // jour, un compteur incrémental repartirait à 1 au deuxième replay et tomberait
    // à 0 au premier abandon d'une journée pourtant gagnée.
    $newStreak = personadle_recompute_mode_streak($pdo, $userId, $mode, $playedDate, $isExpert);
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
    $newGlobalStreak = personadle_bump_global_streak($pdo, $userId);

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

