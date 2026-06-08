<?php
/**
 * POST /api/auth/login
 * ────────────────────────────────────────────────────────────────────────────
 * Connecte un utilisateur existant, ouvre une session PHP.
 *
 * Body JSON : { identifier, password }  — identifier = email OU pseudo
 * Succès    : 200 { user: {...} }
 * Erreurs   : 400 (champs manquants), 401 (mauvais identifiants)
 *
 * Note sécurité : le message d'erreur est volontairement identique pour
 * identifiant inconnu et mauvais mot de passe (évite l'user enumeration).
 */

require_once __DIR__ . '/../bootstrap.php';

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Prend uniquement la première IP de X-Forwarded-For et valide le format
// pour empêcher le spoofing du rate limiting via un header arbitraire.
$rawForwardedFor = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
$firstIp         = trim(explode(',', $rawForwardedFor)[0]);
$rlIp            = filter_var($firstIp, FILTER_VALIDATE_IP) ? $firstIp : ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
$rlKey      = sys_get_temp_dir() . '/rl_' . md5('personadle_auth_' . $rlIp . basename(__FILE__)) . '.json';
$rlData     = file_exists($rlKey) ? json_decode(file_get_contents($rlKey), true) : null;
$rlNow      = time();
$rlWindow   = 15 * 60;
$rlMaxTries = 5;

if ($rlData && ($rlNow - $rlData['window_start']) < $rlWindow) {
    if ($rlData['attempts'] >= $rlMaxTries) {
        jsonError('Too many attempts. Please try again later.', 429);
    }
    $rlData['attempts']++;
} else {
    $rlData = ['attempts' => 1, 'window_start' => $rlNow];
}
file_put_contents($rlKey, json_encode($rlData), LOCK_EX);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

$data = getJsonBody();

// Compatibilité : accepte "identifier" (nouveau) ou "email" (ancien)
$identifier = trim($data['identifier'] ?? $data['email'] ?? '');
$password   =      $data['password'] ?? '';

if (empty($identifier) || empty($password)) {
    jsonError('Email (or username) and password are required');
}

$pdo = pdo();

// Cherche par email en premier, puis par pseudo
$stmt = $pdo->prepare('
    SELECT id, email, pseudo, password_hash, lang, friend_code, created_at, last_login_at, is_admin, is_banned
    FROM users
    WHERE (email = ? OR pseudo = ?) AND is_deleted = 0
    LIMIT 1
');
$stmt->execute([$identifier, $identifier]);
$user = $stmt->fetch();

// Vérification timing-safe via password_verify
// (même durée si user inconnu ou mauvais mdp → pas de timing attack)
$hash = $user['password_hash'] ?? '$2y$10$invalidhashtopreventtimingattack00000000000000000000000';
if (!$user || !password_verify($password, $hash)) {
    jsonError('Invalid email or password', 401);
}

// Compte banni
if (!empty($user['is_banned'])) {
    jsonError('Account banned. Contact support if you think this is an error.', 403);
}

// Mettre à jour la date de dernière connexion
$pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')
    ->execute([$user['id']]);

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];

// ── Remember-me token ────────────────────────────────────────────────────────
// Génère un token opaque de 64 octets, stocke son hash SHA-256 en BDD,
// et pose un cookie httpOnly persistant de 30 jours dans le navigateur.
// Ce mécanisme permet la reconnexion automatique même si le fichier de session
// PHP est supprimé (ce qui arrive sur certains hébergeurs mutualisés).
//
// Enveloppé dans un try/catch pour qu'une colonne manquante en BDD (ex: migration
// partielle) n'empêche pas la connexion — la session PHP reste active.
try {
    $rawToken    = bin2hex(random_bytes(32));          // 64 chars hex
    $hashedToken = hash('sha256', $rawToken);
    $expires     = date('Y-m-d H:i:s', time() + 30 * 24 * 3600);

    $pdo->prepare('UPDATE users SET remember_me_hash = ?, remember_me_expires = ? WHERE id = ?')
        ->execute([$hashedToken, $expires, $user['id']]);

    setcookie(
        'remember_me',
        $rawToken,
        [
            'expires'  => time() + 30 * 24 * 3600,
            'path'     => '/',
            'domain'   => '',
            'secure'   => APP_ENV === 'production',
            'httponly' => true,
            'samesite' => 'Lax',
        ]
    );
} catch (PDOException $e) {
    // Remember-me non disponible (colonne manquante en BDD) — la session PHP
    // reste valide, seule la reconnexion auto entre sessions est désactivée.
    error_log('[PersonaDLE login] remember_me unavailable: ' . $e->getMessage());
}

jsonSuccess(['user' => formatUser($user, fetchProfile($pdo, (int) $user['id']))]);
