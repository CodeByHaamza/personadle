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
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/password_reset.php';

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
if ($passwordError = personadle_validate_password($password)) jsonError($passwordError, 400);

$pdo  = pdo();
$user = personadle_find_user_by_reset_token($pdo, $token);

if (!$user) jsonError('Invalid or expired reset link', 400);

$newHash = password_hash($password, PASSWORD_BCRYPT);
personadle_apply_new_password($pdo, $user['id'], $newHash);

jsonSuccess(['message' => 'Password updated. You can now log in.']);
