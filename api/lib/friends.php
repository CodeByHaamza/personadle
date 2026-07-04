<?php
/**
 * api/lib/friends.php — Règles métier du système d'amis, PURES (sans base de données).
 *
 * Extraites de api/friends/index.php pour être testables unitairement (PHPUnit, sans MySQL).
 */

declare(strict_types=1);

/**
 * Valide le format d'un code ami (8 caractères alphanumériques majuscules).
 * Retourne un message d'erreur, ou null si valide.
 */
function personadle_validate_friend_code(string $code): ?string
{
    if (!preg_match('/^[A-Z0-9]{8}$/', $code)) {
        return 'Invalid friend code format (expected 8 alphanumeric chars)';
    }
    return null;
}

/**
 * Décide si une nouvelle demande d'ami doit être refusée, à partir du statut
 * d'une relation `friendships` déjà existante entre les deux utilisateurs.
 * Pure — ne fait aucun accès BDD, ne lit que le statut déjà fetché.
 *
 * @param string|null $existingStatus 'accepted' | 'pending' | 'blocked' | null (aucune relation)
 * @return array{message: string, http_status: int}|null Null si la demande peut être créée.
 */
function personadle_friend_request_denial(?string $existingStatus): ?array
{
    return match ($existingStatus) {
        'accepted' => ['message' => 'Already friends', 'http_status' => 409],
        'pending'  => ['message' => 'Request already sent or received', 'http_status' => 409],
        'blocked'  => ['message' => 'Cannot send request', 'http_status' => 403],
        default    => null,
    };
}
