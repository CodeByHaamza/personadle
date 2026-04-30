<?php
/**
 * DELETE /api/admin/users/:id/friends/:fid
 *
 * Supprime une relation d'amitié.
 * :fid = friendship_id (pas l'autre user_id).
 * Vérifie que l'amitié appartient bien à cet utilisateur.
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'DELETE') jsonError('Method Not Allowed', 405);

// ── Extraire userId et fid depuis l'URL ───────────────────────────────────────
$path     = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
$parts    = explode('/', $path);
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

$friendsIdx = array_search('friends', $parts);
$fid        = $friendsIdx !== false ? (int) ($parts[$friendsIdx + 1] ?? 0) : 0;
if ($fid <= 0) jsonError('Invalid friendship id in URL', 400);

// Vérifier que l'utilisateur existe
$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$userId]);
if (!$stmt->fetch()) jsonError('User not found', 404);

// Vérifier que l'amitié appartient bien à cet utilisateur
$stmt = $pdo->prepare(
    'SELECT id FROM friendships
     WHERE id = ? AND (requester_id = ? OR addressee_id = ?)
     LIMIT 1'
);
$stmt->execute([$fid, $userId, $userId]);
if (!$stmt->fetch()) jsonError('Friendship not found or does not belong to this user', 404);

// Supprimer l'amitié
$pdo->prepare(
    'DELETE FROM friendships
     WHERE id = ? AND (requester_id = ? OR addressee_id = ?)'
)->execute([$fid, $userId, $userId]);

jsonSuccess(['success' => true]);
