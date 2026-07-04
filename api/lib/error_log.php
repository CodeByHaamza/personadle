<?php
/**
 * api/lib/error_log.php — Observabilité applicative : capture des erreurs
 * backend dans la table `error_log`, consultable depuis le panel admin
 * (au-delà des logs error_log() serveur, non consultables sans SSH).
 *
 * Écrit TOUJOURS aussi via la fonction native error_log() (comportement
 * historique préservé) — l'écriture en base est un ajout, jamais un
 * remplacement. Best-effort : un échec d'écriture en base ne doit jamais
 * faire planter la requête qui a déclenché le log.
 */

declare(strict_types=1);

/**
 * Log une erreur applicative en base + via error_log() natif.
 *
 * Prend $pdo en paramètre (plutôt que d'appeler la fonction globale pdo() de
 * bootstrap.php) pour rester testable en PHPUnit sans charger tout le
 * bootstrap — même convention que game_session.php/streak_recovery.php.
 *
 * @param string $level   'error' | 'warning' | 'info'
 * @param string $message Message court, sans stack trace (voir $context pour le détail).
 * @param array<string,mixed> $context Détails structurés (source, file, line, trace…).
 *   Encodé en JSON — doit rester raisonnablement petit (pas de dump de $_SERVER entier).
 * @param int|null $userId Utilisateur authentifié au moment de l'erreur, si connu.
 */
function personadle_log_error(
    PDO $pdo,
    string $level,
    string $message,
    array $context = [],
    ?int $userId = null
): void {
    // Comportement historique préservé — grep-able dans les logs serveur.
    error_log('[' . strtoupper($level) . '] ' . $message);

    // Best-effort : la persistance en base ne doit jamais faire échouer
    // l'appelant (ex: si la table n'existe pas encore sur un vieil environnement,
    // ou si la connexion DB est justement ce qui a planté).
    try {
        $pdo->prepare(
            'INSERT INTO error_log (level, message, context, user_id) VALUES (?, ?, ?, ?)'
        )->execute([
            $level,
            $message,
            empty($context) ? null : json_encode($context),
            $userId,
        ]);
    } catch (Throwable $e) {
        error_log('[error_log] Failed to persist error to DB: ' . $e->getMessage());
    }
}
