<?php
/**
 * POST /api/auth/request-reset
 * { "email": "user@example.com" }
 *
 * Démarre une réinitialisation de mot de passe : génère un token, en stocke le
 * HASH (sha256) avec expiration (1h), et envoie le lien par email.
 *
 * Anti-énumération : renvoie TOUJOURS 200 (on ne révèle pas si l'email existe).
 * En dev (APP_ENV != production), le lien est aussi écrit dans error_log pour test.
 */
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

// Rate limiting par IP (anti-spam d'emails)
$rawForwardedFor = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
$firstIp         = trim(explode(',', $rawForwardedFor)[0]);
$rlIp            = filter_var($firstIp, FILTER_VALIDATE_IP) ? $firstIp : ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
rateLimit('reset-request:' . $rlIp, 3, 15 * 60); // 3 demandes / 15 min

$data  = getJsonBody();
$email = strtolower(trim($data['email'] ?? ''));

// Réponse générique commune (anti-énumération)
$genericOk = fn() => jsonSuccess(['message' => 'If that email exists, a reset link has been sent.']);

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $genericOk();
}

$pdo  = pdo();
$stmt = $pdo->prepare('SELECT id, pseudo FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    // Token brut (envoyé) + hash stocké + expiration 1h
    $token   = bin2hex(random_bytes(32));
    $hash    = hash('sha256', $token);
    $expires = date('Y-m-d H:i:s', time() + 3600);

    $pdo->prepare('UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?')
        ->execute([$hash, $expires, (int) $user['id']]);

    // Base du lien : prod = personadle.net, sinon l'Origin courant (dev local)
    $base = (APP_ENV === 'production')
        ? 'https://personadle.net'
        : ($_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:8080');
    $link = $base . '/pages/reset-password.html?token=' . $token;

    $subject = 'PersonaDLE — Reset your password';
    $body    = "Hi " . ($user['pseudo'] ?: 'there') . ",\n\n"
             . "We received a request to reset your PersonaDLE password.\n"
             . "Click the link below (valid for 1 hour):\n\n$link\n\n"
             . "If you didn't request this, you can safely ignore this email.\n\n— PersonaDLE";
    $headers = "From: no-reply@personadle.net\r\nContent-Type: text/plain; charset=UTF-8";

    if (APP_ENV === 'production') {
        @mail($email, $subject, $body, $headers);
    } else {
        // En dev : pas de SMTP → on logge le lien pour pouvoir tester le flux.
        error_log("[reset-request] DEV reset link for $email: $link");
    }
}

$genericOk();
