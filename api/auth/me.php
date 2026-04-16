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
    $stmt = $pdo->prepare('SELECT settings FROM profiles WHERE user_id = ? LIMIT 1');
    $stmt->execute([(int) $user['id']]);
    $profileRow = $stmt->fetch();
    $settings   = json_decode($profileRow['settings'] ?? 'null', true) ?? [];

    jsonSuccess([
        'user'     => formatUser($user),
        'settings' => $settings,
    ]);
}

// ── 1. Session PHP active (cas normal) ──────────────────────────────────────
if (!empty($_SESSION['user_id'])) {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([(int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        // Session orpheline (compte supprimé entre-temps) — nettoyer
        session_destroy();
        jsonSuccess(['user' => null]);
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
    jsonSuccess(['user' => null]);
}

try {
    $hashedToken = hash('sha256', $rawToken);

    $stmt = $pdo->prepare('
        SELECT * FROM users
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
            'secure'   => APP_ENV === 'production',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        jsonSuccess(['user' => null]);
    }

    // Token valide → recréer la session PHP + rotation du token (évite la réutilisation)
    $_SESSION['user_id'] = (int) $user['id'];

    $newRawToken    = bin2hex(random_bytes(32));
    $newHashedToken = hash('sha256', $newRawToken);
    $newExpires     = date('Y-m-d H:i:s', time() + 30 * 24 * 3600);

    $pdo->prepare('UPDATE users SET remember_me_hash = ?, remember_me_expires = ?, last_login_at = NOW() WHERE id = ?')
        ->execute([$newHashedToken, $newExpires, $user['id']]);

    setcookie('remember_me', $newRawToken, [
        'expires'  => time() + 30 * 24 * 3600,
        'path'     => '/',
        'domain'   => '',
        'secure'   => APP_ENV === 'production',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    meResponse($pdo, $user);
} catch (PDOException $e) {
    // Colonnes remember_me manquantes — retour silencieux user:null
    error_log('[PersonaDLE me] remember_me unavailable: ' . $e->getMessage());
    jsonSuccess(['user' => null]);
}
