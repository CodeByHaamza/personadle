<?php
/**
 * api/lib/streak_recovery.php — Récupération de streak (Jack Frost).
 *
 * Contrairement à api/lib/streak.php (pur, sans base), ce fichier TOUCHE LA
 * BASE — extrait de api/user/recover-streak.php pour être testable en
 * intégration (PHPUnit + MariaDB, cf. tests/php/DatabaseIntegrationTest.php)
 * sans dupliquer la logique dans les tests : l'endpoint appelle exactement
 * cette fonction.
 */

declare(strict_types=1);

/** Erreur métier lors d'une tentative de récupération — l'appelant mappe vers le status HTTP fourni. */
class PersonadleStreakRecoveryException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}

/**
 * Tente de restaurer la streak d'un utilisateur (Jack Frost).
 *
 * Enforce le cooldown de 60 jours côté serveur (verrou SELECT ... FOR UPDATE
 * sur la ligne users — deux requêtes concurrentes ne peuvent pas passer le
 * cooldown en même temps) et le plafond anti-triche : previous_streak ne peut
 * jamais excéder le nombre de jours DISTINCTS réellement joués (game_sessions),
 * seule borne infalsifiable et vérifiable côté serveur.
 *
 * L'appelant est responsable de la transaction (begin/commit/rollback) —
 * cette fonction s'appuie sur le verrou de ligne pour la sécurité de
 * concurrence, elle ne fait pas le begin/commit elle-même.
 *
 * @return array{modes_updated:int}
 * @throws PersonadleStreakRecoveryException User introuvable (404), cooldown actif (429),
 *   ou previous_streak invalide par rapport aux jours joués (400).
 */
function personadle_attempt_streak_recovery(PDO $pdo, int $userId, int $previousStreak): array
{
    $stmt = $pdo->prepare(
        'SELECT streak_recovered_at FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1 FOR UPDATE'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();

    if (!$row) {
        throw new PersonadleStreakRecoveryException('User not found', 404);
    }

    if ($row['streak_recovered_at'] !== null) {
        $daysSince = (time() - strtotime($row['streak_recovered_at'])) / 86400;
        if ($daysSince < 60) {
            $daysLeft = (int) ceil(60 - $daysSince);
            throw new PersonadleStreakRecoveryException(
                "Streak recovery on cooldown. Try again in $daysLeft day(s).",
                429
            );
        }
    }

    // Anti-triche : la streak côté client est GLOBALE (une partie dans n'importe
    // quel mode = +1/jour), elle peut donc légitimement dépasser le streak_record
    // d'un mode pris isolément. La seule borne supérieure vérifiable côté serveur
    // est le nombre de jours DISTINCTS réellement joués.
    $stmt = $pdo->prepare('SELECT COUNT(DISTINCT played_date) FROM game_sessions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $daysPlayed = (int) ($stmt->fetchColumn() ?? 0);
    $maxAllowed = max(1, $daysPlayed);

    if ($previousStreak > $maxAllowed) {
        throw new PersonadleStreakRecoveryException(
            'Invalid previous_streak: exceeds total days played',
            400
        );
    }

    return personadle_apply_streak_recovery($pdo, $userId, $previousStreak, true);
}

/**
 * ÉCRIT la streak restaurée — sans aucune vérification.
 *
 * Extrait de personadle_attempt_streak_recovery() pour que le panneau admin
 * puisse restaurer une streak SANS le cooldown de 60 jours ni le plafond
 * « jours réellement joués » : ces deux gardes protègent d'un joueur qui
 * s'auto-attribue une streak, pas d'un administrateur qui répare un compte.
 * Les dupliquer côté admin aurait fait deux écritures à tenir alignées ; c'est
 * la vérification qui reste propre à chaque appelant, pas l'écriture.
 *
 * @param bool $startCooldown true depuis le jeu (Jack Frost consomme sa
 *   récupération des 60 jours) ; false depuis l'admin — un geste de
 *   maintenance ne doit pas priver le joueur de SA récupération.
 * @return array{modes_updated:int}
 */
function personadle_apply_streak_recovery(
    PDO $pdo,
    int $userId,
    int $streak,
    bool $startCooldown
): array {
    // `WHERE streak < ?` : jamais de régression. Un mode dont la streak est déjà
    // supérieure a été joué depuis — l'écraser ferait PERDRE de la progression.
    $stmt = $pdo->prepare(
        'UPDATE user_stats
         SET streak = ?, streak_record = GREATEST(streak_record, ?)
         WHERE user_id = ? AND streak < ?'
    );
    $stmt->execute([$streak, $streak, $userId, $streak]);
    $rowsUpdated = $stmt->rowCount();

    // Restaure aussi la streak GLOBALE autoritative (datée aujourd'hui, heure de
    // Paris) pour qu'elle reparte de $streak et ne soit pas écrasée à la
    // prochaine sync.
    $parisToday = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
    $pdo->prepare(
        'UPDATE users
         SET streak_recovered_at  = ' . ($startCooldown ? 'UTC_TIMESTAMP()' : 'streak_recovered_at') . ',
             global_streak        = GREATEST(global_streak, ?),
             global_streak_record = GREATEST(global_streak_record, ?),
             global_streak_date   = ?
         WHERE id = ?'
    )->execute([$streak, $streak, $parisToday, $userId]);

    return ['modes_updated' => $rowsUpdated];
}
