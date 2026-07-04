<?php
/**
 * api/lib/deletion_requests.php — Hard delete RGPD (J+30) : logique partagée
 * entre le cron quotidien (api/cron/hard-delete.php) et le déclenchement
 * manuel depuis le panel admin (api/admin/deletion_requests.php).
 *
 * Prend $pdo en paramètre (jamais la fonction globale pdo()) pour rester
 * testable en PHPUnit — même convention que error_log.php/game_session.php.
 * La transaction est gérée par l'appelant, pas par ces fonctions elles-mêmes.
 */

declare(strict_types=1);

class PersonadleDeletionRequestException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}

/**
 * Traite une deletion_request précise : hard delete immédiat de l'utilisateur
 * (CASCADE InnoDB nettoie les tables liées) puis marque la demande comme
 * traitée. Utilisé aussi bien par le cron (requêtes échues) que par un admin
 * qui déclenche la suppression avant l'échéance des 30 jours.
 *
 * L'appelant est responsable de la transaction (begin/commit/rollback) — même
 * convention que game_session.php/streak_recovery.php/social_link_interaction.php —
 * pour que le SELECT ... FOR UPDATE lock dans la même transaction que l'appelant.
 *
 * @throws PersonadleDeletionRequestException si la demande n'existe pas ou est déjà traitée.
 */
function personadle_process_deletion_request(PDO $pdo, int $requestId): void
{
    $stmt = $pdo->prepare(
        'SELECT user_id FROM deletion_requests WHERE id = ? AND processed_at IS NULL LIMIT 1 FOR UPDATE'
    );
    $stmt->execute([$requestId]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new PersonadleDeletionRequestException('Deletion request not found or already processed', 404);
    }

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([(int) $row['user_id']]);
    $pdo->prepare('UPDATE deletion_requests SET processed_at = NOW() WHERE id = ?')->execute([$requestId]);
}

/**
 * Traite toutes les deletion_requests échues (requested_at < NOW() - $daysThreshold jours).
 * Appelé par le cron quotidien, à l'intérieur d'une transaction unique gérée par
 * l'appelant. L'échec d'une demande (catch interne) n'empêche pas le traitement
 * des autres — si le process crashe avant le commit final, tout est annulé
 * (aucune suppression partielle non traçée), ce qui est plus sûr qu'un commit
 * par ligne en cas de crash mi-parcours.
 *
 * @return array{deleted:int,pending:int,errors:string[]}
 */
function personadle_process_due_deletion_requests(PDO $pdo, int $daysThreshold = 30): array
{
    // $daysThreshold est un int typé (jamais une valeur brute venant d'une requête HTTP) —
    // l'interpoler directement évite le placeholder "INTERVAL ? DAY", non éprouvé ailleurs
    // dans ce codebase et connu pour poser problème sur certaines versions de MySQL/MariaDB.
    $stmt = $pdo->prepare(
        "SELECT id FROM deletion_requests
         WHERE processed_at IS NULL
           AND requested_at < DATE_SUB(NOW(), INTERVAL $daysThreshold DAY)"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $deleted = 0;
    $errors  = [];

    foreach ($rows as $row) {
        $requestId = (int) $row['id'];
        try {
            personadle_process_deletion_request($pdo, $requestId);
            $deleted++;
        } catch (Throwable $e) {
            $errors[] = "request_id=$requestId: " . $e->getMessage();
            error_log("[PersonaDLE hard-delete] request_id=$requestId: " . $e->getMessage());
        }
    }

    return [
        'deleted' => $deleted,
        'pending' => count($rows),
        'errors'  => $errors,
    ];
}
