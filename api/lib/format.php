<?php
/**
 * api/lib/format.php — Formatage de sortie API, PUR (sans base de données).
 *
 * Extraite de api/bootstrap.php pour être testable unitairement : garde-fou
 * anti-régression contre une fuite accidentelle de password_hash dans une
 * réponse JSON (login, register, admin/user, etc. appellent tous formatUser()).
 */

declare(strict_types=1);

/**
 * Formate une ligne users en objet public (sans password_hash).
 *
 * @param  array<string, mixed> $row     Ligne fetchée depuis la table users
 * @param  array<string, mixed> $profile Ligne fetchée depuis la table profiles (optionnelle)
 * @return array<string, mixed>
 */
function formatUser(array $row, array $profile = []): array
{
    return [
        'id'                  => (int)  $row['id'],
        'email'               =>        $row['email'],
        'pseudo'              =>        $row['pseudo'],
        'lang'                =>        $row['lang'],
        'friend_code'         =>        $row['friend_code'],
        'created_at'          =>        $row['created_at'],
        'last_login_at'       =>        $row['last_login_at'],
        'avatar_data'         =>        $profile['avatar_data']         ?? null,
        'avatar_border_color' =>        $profile['avatar_border_color'] ?? '#ffffff',
        'has_migrated'        => (bool) ($row['has_migrated']           ?? false),
        'is_admin'            => (bool) ($row['is_admin']               ?? false),
    ];
}
