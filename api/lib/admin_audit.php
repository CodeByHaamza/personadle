<?php
/**
 * api/lib/admin_audit.php — Traçabilité des actions admin : journalise dans
 * `admin_audit_log` qui (admin_id) a fait quoi (action/target_type/target_id)
 * sur les endpoints admin mutants, consultable depuis le panel admin.
 *
 * Best-effort comme personadle_log_error() : un échec d'écriture ne doit
 * jamais faire échouer la mutation admin elle-même.
 */

declare(strict_types=1);

/**
 * Journalise une action admin en base.
 *
 * Prend $pdo en paramètre (plutôt que d'appeler la fonction globale pdo() de
 * bootstrap.php) pour rester testable en PHPUnit — même convention que
 * error_log.php/game_session.php/streak_recovery.php.
 *
 * @param int    $adminId    Admin ayant effectué l'action (requireAdmin()).
 * @param string $action     ex: 'user.ban', 'badge.grant', 'event_code.delete'.
 * @param string $targetType ex: 'user', 'badge', 'title', 'wallpaper', 'event_code', 'social_link'.
 * @param string $targetId   id numérique ou code/slug selon la cible, toujours en texte.
 * @param array<string,mixed> $details Détails structurés (avant/après, champs modifiés…).
 */
function personadle_log_admin_action(
    PDO $pdo,
    int $adminId,
    string $action,
    string $targetType,
    string $targetId,
    array $details = []
): void {
    try {
        $pdo->prepare(
            'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $adminId,
            $action,
            $targetType,
            $targetId,
            empty($details) ? null : json_encode($details),
        ]);
    } catch (Throwable $e) {
        error_log('[admin_audit] Failed to persist audit entry: ' . $e->getMessage());
    }
}
