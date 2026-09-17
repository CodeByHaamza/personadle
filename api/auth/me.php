<?php
/**
 * GET /api/auth/me
 * ────────────────────────────────────────────────────────────────────────────
 * Retourne l'utilisateur connecté, ou null si aucune session active.
 * Appelé au chargement de chaque page pour restaurer l'état d'auth.
 *
 * Toujours 200 — le JS distingue connecté/non-connecté via user !== null.
 *
 * Succès connecté   : 200 { user: { id, email, pseudo, ... } }
 * Succès déconnecté : 200 { user: null }
 */

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$pdo = pdo();

/**
 * Retourne l'utilisateur + ses settings de profil.
 * On charge les settings ici pour éviter un second appel réseau au chargement de page.
 */
function meResponse(PDO $pdo, array $user): never
{
    $profileRow = fetchProfile($pdo, (int) $user['id']);
    $settings   = json_decode($profileRow['settings'] ?? 'null', true) ?? [];

    jsonSuccess(siteState($pdo) + [
        'user'     => formatUser($user, $profileRow),
        'settings' => $settings,
        'pusher'   => [
            'key'     => defined('PUSHER_KEY') ? PUSHER_KEY : null,
            'cluster' => defined('PUSHER_CLUSTER') ? PUSHER_CLUSTER : null,
        ],
        // Reset ciblé (migration 042) : le client vide son état local des modes
        // si cette date est plus récente que son dernier accusé.
        'reset_local_state_at' => $user['reset_local_state_at'] ?? null,
    ]);
}

/**
 * Ce que TOUTE page a besoin de savoir au chargement, connecté ou pas — livré
 * avec /me pour ne pas ajouter d'appel réseau : maintenance en cours (l'admin
 * la voit aussi, en bandeau, pour ne pas oublier de la lever) et annonces.
 */
function siteState(PDO $pdo): array
{
    return [
        'maintenance'   => personadle_maintenance_state($pdo),
        'announcements' => personadle_active_announcements($pdo),
    ];
}

// ── 1. Session PHP active (cas normal) ──────────────────────────────────────
if (!empty($_SESSION['user_id'])) {
    $stmt = $pdo->prepare('SELECT id, email, pseudo, lang, friend_code, created_at, last_login_at, is_admin, is_banned, ban_reason, banned_until, reset_local_state_at FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([(int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        // Session orpheline (compte supprimé entre-temps) — nettoyer
        session_destroy();
        jsonSuccess(siteState($pdo) + ['user' => null]);
    }

    $ban = personadle_ban_state($pdo, $user);
    if ($ban !== null) {
        session_destroy();
        jsonSuccess(siteState($pdo) + ['user' => null, 'banned' => $ban]);
    }

    meResponse($pdo, $user);
}

// ── 2. Pas de session — vérifier le cookie remember_me ──────────────────────
// Ce chemin est emprunté quand la session PHP a expiré (fichier supprimé par
// le GC de l'hébergeur) mais que le cookie remember_me est encore valide.
// On recrée la session PHP pour les requêtes suivantes.
//
// Enveloppé dans un try/catch : si les colonnes remember_me_* sont absentes
// (migration partielle), on retourne simplement user:null sans 500.
$rawToken = $_COOKIE['remember_me'] ?? '';

if ($rawToken === '') {
    jsonSuccess(siteState($pdo) + ['user' => null]);
}

try {
    $hashedToken = hash('sha256', $rawToken);

    $stmt = $pdo->prepare('
        SELECT id, email, pseudo, lang, friend_code, created_at, last_login_at, is_admin, is_banned,
               ban_reason, banned_until, reset_local_state_at FROM users
        WHERE remember_me_hash = ?
          AND remember_me_expires > NOW()
          AND is_deleted = 0
        LIMIT 1
    ');
    $stmt->execute([$hashedToken]);
    $user = $stmt->fetch();

    if (!$user) {
        // Token invalide ou expiré — supprimer le cookie fantôme
        setcookie('remember_me', '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'domain'   => PERSONADLE_COOKIE_DOMAIN,
            'secure'   => APP_ENV === 'production',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        jsonSuccess(siteState($pdo) + ['user' => null]);
    }

    $ban = personadle_ban_state($pdo, $user);
    if ($ban !== null) {
        setcookie('remember_me', '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'domain'   => PERSONADLE_COOKIE_DOMAIN,
            'secure'   => APP_ENV === 'production',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        jsonSuccess(siteState($pdo) + ['user' => null, 'banned' => $ban]);
    }

    // Token valide → recréer la session PHP + rotation du token (évite la réutilisation)
    // session_regenerate_id() évite qu'un ID de session pré-fixé par un attaquant
    // (avant même que le cookie remember_me soit relu) devienne authentifié.
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];

    $newRawToken    = bin2hex(random_bytes(32));
    $newHashedToken = hash('sha256', $newRawToken);
    $newExpires     = date('Y-m-d H:i:s', time() + 30 * 24 * 3600);

    $pdo->prepare('UPDATE users SET remember_me_hash = ?, remember_me_expires = ?, last_login_at = NOW() WHERE id = ?')
        ->execute([$newHashedToken, $newExpires, $user['id']]);

    setcookie('remember_me', $newRawToken, [
        'expires'  => time() + 30 * 24 * 3600,
        'path'     => '/',
        'domain'   => PERSONADLE_COOKIE_DOMAIN,
        'secure'   => APP_ENV === 'production',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    meResponse($pdo, $user);
} catch (PDOException $e) {
    // Colonnes remember_me manquantes — retour silencieux user:null
    error_log('[PersonaDLE me] remember_me unavailable: ' . $e->getMessage());
    jsonSuccess(siteState($pdo) + ['user' => null]);
}
