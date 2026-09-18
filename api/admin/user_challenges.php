<?php
/**
 * GET    /api/admin/users/:id/challenges         → défis de l'utilisateur (envoyés + reçus)
 * PATCH  /api/admin/users/:id/challenges/:msgId  → force le statut d'un défi
 * DELETE /api/admin/users/:id/challenges/:msgId  → supprime un défi
 *
 * Pourquoi cet outil existe : un défi vit dans DEUX états — la ligne `messages`
 * côté serveur, et une case `activeChallenge` dans le localStorage du joueur.
 * Quand les deux divergent (le client a perdu sa case, ou n'a jamais pu jouer la
 * cible), le défi reste `accepted` en base et le joueur n'a plus de prise dessus
 * depuis le jeu. Le bouton « Abandonner » de la page Amis couvre le cas normal ;
 * ceci couvre le reste, sans avoir à ouvrir phpMyAdmin.
 *
 * Body PATCH : { "status": "unread"|"read"|"accepted"|"beaten"|"expired" }
 *   - "unread"  → RELANCE : le défi redevient proposé au destinataire
 *   - "read"    → ANNULE : plus bloquant, sans faire croire à une partie perdue
 *   - "expired" → marque manuellement comme tenté et manqué
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire userId et msgId depuis l'URL ────────────────────────────────────
// /api/admin/users/:id/challenges[/:msgId]
$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts, true);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
$msgId    = (int) ($parts[$adminIdx + 4] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$userId]);
if (!$stmt->fetch()) jsonError('User not found', 404);


// ═══════════════════════════════════════════════════════════════════
// GET — liste des défis de l'utilisateur
// ═══════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    // Un même paramètre nommé ne peut pas être répété avec PDO/MySQL
    // (CLAUDE.md §7) : positionnels.
    $stmt = $pdo->prepare("
        SELECT m.id, m.sender_id, m.receiver_id, m.challenge_mode, m.challenge_score,
               m.challenge_date, m.challenge_target, m.challenge_is_expert,
               m.status, m.created_at,
               s.pseudo AS sender_pseudo,
               r.pseudo AS receiver_pseudo
        FROM messages m
        JOIN users s ON s.id = m.sender_id
        JOIN users r ON r.id = m.receiver_id
        WHERE m.type = 'challenge'
          AND (m.sender_id = ? OR m.receiver_id = ?)
        ORDER BY m.created_at DESC
        LIMIT 100
    ");
    $stmt->execute([$userId, $userId]);

    $challenges = array_map(fn($m) => [
        'id'                  => (int) $m['id'],
        'sender_id'           => (int) $m['sender_id'],
        'receiver_id'         => (int) $m['receiver_id'],
        'sender_pseudo'       => $m['sender_pseudo'],
        'receiver_pseudo'     => $m['receiver_pseudo'],
        // Sens vu depuis l'utilisateur consulté : c'est ce que l'admin lit.
        'direction'           => ((int) $m['sender_id'] === $userId) ? 'sent' : 'received',
        'challenge_mode'      => $m['challenge_mode'],
        'challenge_score'     => $m['challenge_score'] !== null ? (int) $m['challenge_score'] : null,
        'challenge_date'      => $m['challenge_date'],
        'challenge_target'    => $m['challenge_target'],
        'challenge_is_expert' => !empty($m['challenge_is_expert']),
        'status'              => $m['status'],
        'created_at'          => $m['created_at'],
    ], $stmt->fetchAll());

    jsonSuccess(['challenges' => $challenges, 'count' => count($challenges)]);
}


// ═══════════════════════════════════════════════════════════════════
// PATCH — forcer le statut d'un défi
// ═══════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    if ($msgId <= 0) jsonError('Missing challenge id', 400);

    $data   = getJsonBody();
    $status = trim((string) ($data['status'] ?? ''));

    $allowed = ['unread', 'read', 'accepted', 'beaten', 'expired'];
    if (!in_array($status, $allowed, true)) {
        jsonError('Invalid status. Valid values: ' . implode(', ', $allowed), 400);
    }

    // Borné à un défi qui concerne bien CET utilisateur : l'id vient de l'URL,
    // rien n'empêcherait sinon de piloter n'importe quelle ligne `messages`
    // depuis la fiche d'un joueur, y compris un message privé entre deux tiers.
    $stmt = $pdo->prepare("
        SELECT id, status FROM messages
        WHERE id = ? AND type = 'challenge' AND (sender_id = ? OR receiver_id = ?)
        LIMIT 1
    ");
    $stmt->execute([$msgId, $userId, $userId]);
    $msg = $stmt->fetch();
    if (!$msg) jsonError('Challenge not found for this user', 404);

    $pdo->prepare('UPDATE messages SET status = ? WHERE id = ?')->execute([$status, $msgId]);

    // Pas d'XP Social Link ici, contrairement au 'beaten' du jeu
    // (api/messages/index.php) : un statut posé à la main par un admin est une
    // réparation, pas une partie. En accorder récompenserait un défi jamais joué.
    personadle_log_admin_action($pdo, $adminId, 'challenge.set_status', 'message', (string) $msgId, [
        'user_id' => $userId,
        'from'    => $msg['status'],
        'to'      => $status,
    ]);

    jsonSuccess(['updated' => true, 'status' => $status]);
}


// ═══════════════════════════════════════════════════════════════════
// DELETE — supprimer un défi
// ═══════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    if ($msgId <= 0) jsonError('Missing challenge id', 400);

    $stmt = $pdo->prepare("
        SELECT id, status, challenge_mode FROM messages
        WHERE id = ? AND type = 'challenge' AND (sender_id = ? OR receiver_id = ?)
        LIMIT 1
    ");
    $stmt->execute([$msgId, $userId, $userId]);
    $msg = $stmt->fetch();
    if (!$msg) jsonError('Challenge not found for this user', 404);

    // La ligne est PARTAGÉE par les deux joueurs (pas un masquage par
    // utilisateur, cf. api/messages/index.php) : la supprimer la retire aussi
    // de la vue de l'ami. Préférer PATCH → 'read' quand il s'agit juste de
    // débloquer quelqu'un.
    $pdo->prepare('DELETE FROM messages WHERE id = ?')->execute([$msgId]);

    personadle_log_admin_action($pdo, $adminId, 'challenge.delete', 'message', (string) $msgId, [
        'user_id' => $userId,
        'status'  => $msg['status'],
        'mode'    => $msg['challenge_mode'],
    ]);

    jsonSuccess(['deleted' => true]);
}

jsonError('Method Not Allowed', 405);
