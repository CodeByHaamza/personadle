<?php
/**
 * POST /api/auth/logout
 * ────────────────────────────────────────────────────────────────────────────
 * Détruit la session serveur et supprime le cookie de session.
 * Toujours 200 — même si l'utilisateur n'était pas connecté.
 *
 * Succès : 200 { message: "Logged out" }
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/remember_tokens.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

// Invalider le token remember_me en BDD avant de détruire la session,
// pour que le cookie fantôme ne permette pas de se reconnecter.
// Se déconnecter révoque le jeton « se souvenir de moi » de CET appareil
// seulement (migration 056) : les autres appareils du compte restent connectés.
$rawToken = $_COOKIE['remember_me'] ?? '';
if ($rawToken !== '') {
    try {
        personadle_remember_revoke(pdo(), $rawToken);
    } catch (PDOException $e) {
        error_log('[PersonaDLE logout] remember_me unavailable: ' . $e->getMessage());
    }
}

// Vider les données de session
$_SESSION = [];

// Supprimer le cookie de session côté client
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

// Supprimer le cookie remember_me
setcookie('remember_me', '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'domain'   => PERSONADLE_COOKIE_DOMAIN,
    'secure'   => APP_ENV === 'production',
    'httponly' => true,
    'samesite' => 'Lax',
]);

session_destroy();

jsonSuccess(['message' => 'Logged out']);
