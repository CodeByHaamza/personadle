<?php
/**
 * api/lib/password_reset.php — Réinitialisation de mot de passe par email.
 *
 * Extrait de api/auth/request-reset.php / reset-password.php pour être
 * testable en intégration (PHPUnit + MariaDB, cf. tests/php/PasswordResetTest.php)
 * sans dupliquer la logique dans les tests : les endpoints appellent exactement
 * ces fonctions (même pattern que api/lib/streak_recovery.php).
 */

declare(strict_types=1);

/**
 * Génère un token de reset (32 octets aléatoires), stocke son HASH (sha256,
 * jamais le token en clair) avec une expiration d'1h pour l'utilisateur donné.
 *
 * @return string Le token EN CLAIR — à envoyer par email, jamais persisté tel quel.
 */
function personadle_create_password_reset_token(PDO $pdo, int $userId): string
{
    $token   = bin2hex(random_bytes(32));
    $hash    = hash('sha256', $token);
    $expires = date('Y-m-d H:i:s', time() + 3600);

    $pdo->prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?')
        ->execute([$hash, $expires, $userId]);

    return $token;
}

/**
 * Retrouve l'utilisateur associé à un token de reset valide : hash correspondant,
 * pas expiré, compte pas supprimé. Retourne null si invalide/expiré/absent —
 * l'appelant ne doit jamais distinguer ces 3 cas (anti-énumération).
 *
 * @return array{id:int}|null
 */
function personadle_find_user_by_reset_token(PDO $pdo, string $token): ?array
{
    $hash = hash('sha256', $token);
    $stmt = $pdo->prepare(
        'SELECT id FROM users
         WHERE reset_token_hash = ? AND reset_token_expires > UTC_TIMESTAMP() AND is_deleted = 0
         LIMIT 1'
    );
    $stmt->execute([$hash]);
    $row = $stmt->fetch();
    return $row ? ['id' => (int) $row['id']] : null;
}

/**
 * Applique un nouveau mot de passe (déjà hashé par l'appelant) et invalide le
 * token de reset ET le remember-me existant — sécurité : un token de reset
 * utilisé ne doit plus jamais fonctionner, et toute session "remember me"
 * antérieure au changement de mot de passe doit être révoquée.
 */
function personadle_apply_new_password(PDO $pdo, int $userId, string $newPasswordHash): void
{
    $pdo->prepare(
        'UPDATE users
         SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL,
             remember_me_hash = NULL, remember_me_expires = NULL
         WHERE id = ?'
    )->execute([$newPasswordHash, $userId]);
}
