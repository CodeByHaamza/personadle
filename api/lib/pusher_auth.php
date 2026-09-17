<?php
/**
 * api/lib/pusher_auth.php — Logique pure d'authentification des canaux Pusher
 * privés. Extrait de api/pusher/auth.php pour être testable sans session PHP.
 */

declare(strict_types=1);

/** Un utilisateur ne peut s'abonner qu'à son propre canal "private-user-{id}". */
function personadle_pusher_channel_matches_user(string $channelName, int $userId): bool
{
    return $channelName === "private-user-{$userId}";
}

/**
 * Signature attendue par pusher-js pour autoriser l'abonnement à un canal
 * privé (HMAC-SHA256 de "{socket_id}:{channel_name}" avec le secret d'app).
 */
function personadle_pusher_channel_auth_signature(string $secret, string $socketId, string $channelName): string
{
    return hash_hmac('sha256', "{$socketId}:{$channelName}", $secret);
}
