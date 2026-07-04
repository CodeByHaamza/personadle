<?php
/**
 * api/lib/authz.php — Décisions d'autorisation, PURES (sans base de données).
 *
 * Extraites de api/bootstrap.php (requireAuth/requireAdmin/requireCsrf) pour être
 * testables unitairement : ces 4 fonctions (is_admin_row, session_denial_reason,
 * csrf_required, csrf_valid) décident qui a accès à quoi sur TOUS les endpoints
 * authentifiés / le panel admin — une régression ici est critique.
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

/**
 * Décide si une méthode HTTP doit être protégée par le token CSRF (double-submit).
 * Pure — ne fait aucun accès BDD. GET/HEAD/OPTIONS sont en lecture seule et jamais
 * concernés par la falsification cross-site (aucun effet de bord côté serveur).
 */
function personadle_csrf_required(string $method): bool
{
    return !in_array(strtoupper($method), ['GET', 'HEAD', 'OPTIONS'], true);
}

/**
 * Compare en temps constant le token CSRF de session à celui envoyé par le client
 * (header X-CSRF-Token, copié depuis le cookie lisible `csrf_token` — pattern
 * double-submit). Pure — ne fait aucun accès BDD.
 *
 * @param string|null $sessionToken Token stocké côté serveur ($_SESSION['csrf_token'])
 * @param string|null $headerToken  Token reçu dans le header X-CSRF-Token
 */
function personadle_csrf_valid(?string $sessionToken, ?string $headerToken): bool
{
    if ($sessionToken === null || $sessionToken === '' || $headerToken === null || $headerToken === '') {
        return false;
    }
    return hash_equals($sessionToken, $headerToken);
}
