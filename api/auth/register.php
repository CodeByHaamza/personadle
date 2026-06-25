<?php
/**
 * POST /api/auth/register
 * ────────────────────────────────────────────────────────────────────────────
 * Crée un nouveau compte utilisateur.
 *
 * Body JSON : { email, pseudo, password, lang? }
 * Succès    : 201 { user: {...} }
 * Erreurs   : 400 (validation), 409 (email/pseudo déjà pris), 500 (serveur)
 */

require_once __DIR__ . '/../bootstrap.php';

// ── Rate limiting ─────────────────────────────────────────────────────────────
$rawForwardedFor = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
$firstIp         = trim(explode(',', $rawForwardedFor)[0]);
$rlIp            = filter_var($firstIp, FILTER_VALIDATE_IP) ? $firstIp : ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
rateLimit('register:' . $rlIp, 5, 15 * 60); // 5 inscriptions / 15 min

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

$data = getJsonBody();

// ── Validation ────────────────────────────────────────────────────────────────
$email    = trim($data['email']    ?? '');
$pseudo   = trim($data['pseudo']   ?? '');
$password =      $data['password'] ?? '';
$lang     = trim($data['lang']     ?? 'en');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonError('Invalid email address');
}
if (strlen($pseudo) < 3 || strlen($pseudo) > 50) {
    jsonError('Username must be between 3 and 50 characters');
}
if (!preg_match('/^[\w\-\.]+$/u', $pseudo)) {
    jsonError('Username can only contain letters, numbers, hyphens, dots and underscores');
}
if (strlen($password) < 8) {
    jsonError('Password must be at least 8 characters');
}
if (!in_array($lang, ['en', 'fr', 'es', 'de', 'it'], true)) {
    $lang = 'en';
}

$pdo = pdo();

// ── Unicité email + pseudo ───────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    jsonError('This email is already registered', 409);
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE pseudo = ? LIMIT 1');
$stmt->execute([$pseudo]);
if ($stmt->fetch()) {
    jsonError('This username is already taken', 409);
}

// ── Création du compte ───────────────────────────────────────────────────────
$passwordHash = password_hash($password, PASSWORD_BCRYPT);
$friendCode   = generateFriendCode();

$pdo->beginTransaction();
try {
    // 1. Utilisateur
    $pdo->prepare('
        INSERT INTO users (email, pseudo, password_hash, friend_code, lang)
        VALUES (?, ?, ?, ?, ?)
    ')->execute([$email, $pseudo, $passwordHash, $friendCode, $lang]);
    $userId = (int) $pdo->lastInsertId();

    // 2. Profil vide (valeurs par défaut)
    $pdo->prepare('INSERT INTO profiles (user_id) VALUES (?)')->execute([$userId]);

    // 3. Stats initialisées à zéro pour chaque mode
    $stmtStats = $pdo->prepare('INSERT INTO user_stats (user_id, mode) VALUES (?, ?)');
    foreach (['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'] as $mode) {
        $stmtStats->execute([$userId, $mode]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[PersonaDLE register] ' . $e->getMessage());
    jsonError('Registration failed — please try again', 500);
}

// ── Ouvrir la session ────────────────────────────────────────────────────────
session_regenerate_id(true);
$_SESSION['user_id'] = $userId;

jsonSuccess([
    'user' => [
        'id'                  => $userId,
        'email'               => $email,
        'pseudo'              => $pseudo,
        'lang'                => $lang,
        'friend_code'         => $friendCode,
        'created_at'          => date('Y-m-d H:i:s'),
        'last_login_at'       => null,
        'avatar_data'         => null,
        'avatar_border_color' => '#ffffff',
    ],
], 201);
