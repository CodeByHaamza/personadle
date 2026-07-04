<?php
/**
 * api/lib/authz.php — Décisions d'autorisation, PURES (sans base de données).
 *
 * Extraites de api/bootstrap.php (requireAuth/requireAdmin) pour être testables
 * unitairement : ces deux fonctions décident qui a accès à quoi sur TOUS les
 * endpoints authentifiés / le panel admin — une régression ici est critique.
 */

declare(strict_types=1);

/**
 * Décide si une ligne `users` autorise l'accès admin.
 * Pure — ne fait aucun accès BDD, ne lit que la ligne déjà fetchée.
 *
 * @param array<string, mixed>|null $row Ligne users (colonne is_admin), ou null si absente.
 */
function personadle_is_admin_row(?array $row): bool
{
    return $row !== null && !empty($row['is_admin']);
}

/**
 * Décide si une session doit être refusée à partir de la ligne `users` courante.
 * Pure — ne fait aucun accès BDD.
 *
 * @param array<string, mixed>|null $row Ligne users (is_deleted, is_banned), ou null si absente/supprimée.
 * @return string|null 'deleted' | 'banned' | null (session valide)
 */
function personadle_session_denial_reason(?array $row): ?string
{
    if ($row === null || !empty($row['is_deleted'])) {
        return 'deleted';
    }
    if (!empty($row['is_banned'])) {
        return 'banned';
    }
    return null;
}
