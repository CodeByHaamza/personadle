<?php
/**
 * POST /api/auth/reset-password
 * { "token": "...", "password": "newpassword" }
 *
 * Termine la réinitialisation : vérifie le hash du token + son expiration,
 * applique le nouveau mot de passe (bcrypt), invalide le token et les sessions
 * "remember me" existantes (sécurité).
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

// Rate limiting par IP (anti-bruteforce de token)
$rawForwardedFor = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
$firstIp         = trim(explode(',', $rawForwardedFor)[0]);
$rlIp            = filter_var($firstIp, FILTER_VALIDATE_IP) ? $firstIp : ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
rateLimit('reset-confirm:' . $rlIp, 10, 15 * 60);

$data     = getJsonBody();
$token    = trim($data['token'] ?? '');
$password = (string) ($data['password'] ?? '');

if (strlen($token) < 32) jsonError('Invalid or expired reset link', 400);
if (strlen($password) < 8) jsonError('Password must be at least 8 characters', 400);

$pdo  = pdo();
$hash = hash('sha256', $token);

$stmt = $pdo->prepare(
    'SELECT id FROM users
     WHERE reset_token_hash = ? AND reset_token_expires > UTC_TIMESTAMP() AND is_deleted = 0
     LIMIT 1'
);
$stmt->execute([$hash]);
$user = $stmt->fetch();

if (!$user) jsonError('Invalid or expired reset link', 400);

$newHash = password_hash($password, PASSWORD_BCRYPT);

// Nouveau mot de passe + invalidation du token ET du remember-me (sécurité)
$pdo->prepare(
    'UPDATE users
     SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL,
         remember_me_hash = NULL, remember_me_expires = NULL
     WHERE id = ?'
)->execute([$newHash, (int) $user['id']]);

jsonSuccess(['message' => 'Password updated. You can now log in.']);
