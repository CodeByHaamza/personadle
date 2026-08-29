<?php
/**
 * GET    /api/messages          → liste mes messages (reçus + envoyés)
 * POST   /api/messages          → envoyer un message ou un défi
 * PATCH  /api/messages/:id      → changer le statut (read/accepted/beaten)
 * DELETE /api/messages/:id      → supprimer un message
 *
 * Body POST challenge : {
 *   receiver_id:     number,
 *   type:            'challenge',
 *   challenge_mode:  'classic'|'emoji'|…,
 *   challenge_score: number,        // score à battre
 *   challenge_date:  'YYYY-MM-DD'   // jour de la cible
 * }
 *
 * Body POST message : {
 *   receiver_id: number,
 *   type:        'message',
 *   content:     string (max 500 chars)
 * }
 */

require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

$parts = requestPathSegments();
$msgId = 0;
foreach ($parts as $i => $part) {
    if ($part === 'messages' && isset($parts[$i + 1]) && ctype_digit($parts[$i + 1])) {
        $msgId = (int) $parts[$i + 1];
        break;
    }
}


// ═══════════════════════════════════════════════════════════════════
// GET /api/messages
// ═══════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    $type   = trim($_GET['type']   ?? '');
    $status = trim($_GET['status'] ?? '');
    $limit  = min((int) ($_GET['limit']  ?? 20), 50);
    $offset = (int) ($_GET['offset'] ?? 0);

    $where  = ['(m.sender_id = :uid1 OR m.receiver_id = :uid2)'];
    $params = [':uid1' => $authId, ':uid2' => $authId];

    if (in_array($type, ['message', 'challenge'], true)) {
        $where[]         = 'm.type = :type';
        $params[':type'] = $type;
    }
    if (in_array($status, ['unread', 'read', 'accepted', 'beaten', 'expired'], true)) {
        $where[]           = 'm.status = :status';
        $params[':status'] = $status;
    }

    $whereStr = implode(' AND ', $where);
    $stmt = $pdo->prepare("
        SELECT m.*,
               s.pseudo AS sender_pseudo,   sp.avatar_data AS sender_avatar,
               r.pseudo AS receiver_pseudo, rp.avatar_data AS receiver_avatar
        FROM messages m
        JOIN  users s ON s.id = m.sender_id
        JOIN  users r ON r.id = m.receiver_id
        LEFT JOIN profiles sp ON sp.user_id = m.sender_id
        LEFT JOIN profiles rp ON rp.user_id = m.receiver_id
        WHERE $whereStr
          AND s.is_deleted = 0
          AND r.is_deleted = 0
        ORDER BY m.created_at DESC
        LIMIT :lim OFFSET :off
    ");
    foreach ($params as $k => $v) { $stmt->bindValue($k, $v); }
    $stmt->bindValue(':lim',  $limit,  PDO::PARAM_INT);
    $stmt->bindValue(':off',  $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $msgs = array_map(fn($m) => [
        'id'              => (int) $m['id'],
        'sender_id'       => (int) $m['sender_id'],
        'receiver_id'     => (int) $m['receiver_id'],
        'type'            => $m['type'],
        'content'         => $m['content'],
        'challenge_mode'    => $m['challenge_mode'],
        'challenge_score'   => $m['challenge_score'] ? (int) $m['challenge_score'] : null,
        'challenge_date'    => $m['challenge_date'],
        'challenge_filters' => isset($m['challenge_filters']) ? $m['challenge_filters'] : null,
        'challenge_target'  => isset($m['challenge_target']) ? $m['challenge_target'] : null,
        // Sans ce champ le client ne peut pas savoir vers quelle page envoyer le
        // joueur (`?expert=1`), ni quel barème appliquer à l'arrivée.
        'challenge_is_expert' => !empty($m['challenge_is_expert']),
        'status'            => $m['status'],
        'created_at'      => $m['created_at'],
        'sender'   => ['pseudo' => $m['sender_pseudo'],   'avatar' => $m['sender_avatar']],
        'receiver' => ['pseudo' => $m['receiver_pseudo'], 'avatar' => $m['receiver_avatar']],
    ], $rows);

    jsonSuccess(['messages' => $msgs, 'count' => count($msgs)]);
}


// ═══════════════════════════════════════════════════════════════════
// POST /api/messages
// ═══════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    rateLimit('messages-send:' . $authId, 20, 15 * 60);

    $data       = getJsonBody();
    $receiverId = (int) ($data['receiver_id'] ?? 0);
    $type       = trim($data['type'] ?? 'message');

    if ($receiverId <= 0)        jsonError('Missing receiver_id', 400);
    if ($receiverId === $authId) jsonError('Cannot message yourself', 400);
    if (!in_array($type, ['message', 'challenge'], true)) jsonError('Invalid type', 400);

    // Vérifier que les deux sont amis
    $stmtFriend = $pdo->prepare("
        SELECT id FROM friendships
        WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
          AND status = 'accepted'
        LIMIT 1
    ");
    $stmtFriend->execute([$authId, $receiverId, $receiverId, $authId]);
    if (!$stmtFriend->fetch()) jsonError('Not friends', 403);

    // Id de la ligne créée, relevé JUSTE APRÈS son INSERT et pas en fin de
    // fonction : `lastInsertId()` retombe à 0 dès qu'un UPDATE passe sur la même
    // connexion (vérifié sur MariaDB 10.6), et le bloc « défi » ci-dessous en
    // exécute un. Le lire trop tard renverrait `{"id": 0}` au client.
    $newId = 0;

    if ($type === 'message') {
        $content = substr(trim($data['content'] ?? ''), 0, 500);
        if (!$content) jsonError('Message content is required');

        $pdo->prepare("
            INSERT INTO messages (sender_id, receiver_id, type, content, status)
            VALUES (?, ?, 'message', ?, 'unread')
        ")->execute([$authId, $receiverId, $content]);
        $newId = (int) $pdo->lastInsertId();
    }

    if ($type === 'challenge') {
        $validModes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
        $mode = trim($data['challenge_mode'] ?? '');
        if (!in_array($mode, $validModes, true)) jsonError('Invalid challenge_mode', 400);
        $score = (int) ($data['challenge_score'] ?? 0);
        $date  = trim($data['challenge_date'] ?? '');

        if (!$mode || $score <= 0) jsonError('challenge_mode and challenge_score required');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $date = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');
        }

        // Défi en Mode Expert (migration 037). L'Expert est une DIMENSION du défi :
        // cible tirée dans le pool Expert, barème propre, et un défi Expert ne se
        // compare qu'à un défi Expert.
        $isExpert = !empty($data['challenge_is_expert']) ? 1 : 0;

        // Un seul défi actif par jour entre deux amis, POUR UNE DIMENSION DONNÉE.
        // `challenge_is_expert` fait partie de la clé : proposer le même jour un
        // défi normal ET un défi Expert au même ami est légitime — deux cibles,
        // deux barèmes, deux jeux. Les confondre interdirait le second sans raison.
        $stmtExisting = $pdo->prepare("
            SELECT id FROM messages
            WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
              AND type = 'challenge'
              AND challenge_date = ?
              AND challenge_is_expert = ?
              AND status IN ('unread', 'accepted')
            LIMIT 1
        ");
        $stmtExisting->execute([$authId, $receiverId, $receiverId, $authId, $date, $isExpert]);
        if ($stmtExisting->fetch()) jsonError('A challenge already exists today for this friend', 409);

        // challenge_filters is optional — gracefully ignored if column doesn't exist yet
        $rawFilters  = trim($data['challenge_filters'] ?? '');
        $filtersJson = $rawFilters ? $rawFilters : null;

        // challenge_target (migration 023) : cible aléatoire dédiée au défi,
        // tirée côté expéditeur. NULL = compat anciens clients → cible du jour.
        $rawTarget = substr(trim($data['challenge_target'] ?? ''), 0, 200);
        $target    = $rawTarget !== '' ? $rawTarget : null;

        try {
            $pdo->prepare("
                INSERT INTO messages
                    (sender_id, receiver_id, type, challenge_mode, challenge_score, challenge_date, challenge_filters, challenge_target, challenge_is_expert, status)
                VALUES (?, ?, 'challenge', ?, ?, ?, ?, ?, ?, 'unread')
            ")->execute([$authId, $receiverId, $mode, $score, $date, $filtersJson, $target, $isExpert]);
        } catch (PDOException $e) {
            // Fallback if challenge_filters/challenge_target columns don't exist yet (migrations not run)
            $pdo->prepare("
                INSERT INTO messages
                    (sender_id, receiver_id, type, challenge_mode, challenge_score, challenge_date, status)
                VALUES (?, ?, 'challenge', ?, ?, ?, 'unread')
            ")->execute([$authId, $receiverId, $mode, $score, $date]);
        }

        // ── Un seul défi vivant par expéditeur ────────────────────────────────
        // Le nouveau défi remplace ceux que ce MÊME expéditeur avait envoyés à ce
        // MÊME destinataire sans qu'ils soient relevés. Sans ça, un ami qui
        // propose un défi chaque jour accumule une pile que le destinataire ne
        // rattrapera jamais — c'est exactement l'empilement que la migration 036
        // a dû nettoyer à la main.
        //
        // Deux bornes volontaires :
        //   - `status = 'unread'` UNIQUEMENT. Un défi déjà `accepted` est un
        //     engagement pris : seul le joueur peut en sortir, via le bouton
        //     « abandonner » (js/challenge-banner.js). Le lui retirer dans son
        //     dos annulerait une partie peut-être déjà en cours.
        //   - direction fixée (`sender_id = expéditeur`) : les défis que le
        //     destinataire a envoyés DANS L'AUTRE SENS ne sont pas concernés, pas
        //     plus que ceux d'un autre ami. Chaque ami a sa propre place.
        //   - dimension fixée (`challenge_is_expert`) : un défi Expert ne remplace
        //     pas un défi normal en attente, et réciproquement. Ce sont deux jeux
        //     différents — le joueur garde une place vivante dans chacun.
        //
        // Placé APRÈS l'insertion : si celle-ci échoue, on n'aura fermé aucun
        // défi précédent pour rien. `id <> ?` exclut la ligne qu'on vient de créer.
        //
        // `read` et non `expired` : le destinataire ne l'a pas tenté et manqué,
        // il a simplement été devancé par un défi plus récent (même raisonnement
        // que l'abandon et que la migration 036).
        $newId = (int) $pdo->lastInsertId();
        $pdo->prepare("
            UPDATE messages
            SET status = 'read'
            WHERE type = 'challenge'
              AND status = 'unread'
              AND sender_id = ?
              AND receiver_id = ?
              AND challenge_is_expert = ?
              AND id <> ?
        ")->execute([$authId, $receiverId, $isExpert, $newId]);

        // XP Social Link : action 'challenge' (15 XP solo)
        try {
            $stmt = $pdo->prepare('SELECT get_or_create_social_link(?, ?) AS link_id');
            $stmt->execute([min($authId, $receiverId), max($authId, $receiverId)]);
            $linkId = (int) $stmt->fetchColumn();
            if ($linkId) {
                $pdo->prepare('CALL add_social_link_xp(?, 15, @x, @r, @u)')->execute([$linkId]);
            }
        } catch (Throwable) { /* silencieux */ }
    }

    jsonSuccess(['id' => $newId, 'created' => true], 201);
}


// ═══════════════════════════════════════════════════════════════════
// PATCH /api/messages/:id — changer le statut
// ═══════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    if ($msgId <= 0) jsonError('Missing message id', 400);

    $data   = getJsonBody();
    $status = trim($data['status'] ?? '');

    $allowed = ['read', 'accepted', 'beaten', 'expired'];
    if (!in_array($status, $allowed, true)) jsonError('Invalid status');

    // 'beaten' : seul le receiver peut marquer le défi comme relevé
    if ($status === 'beaten') {
        $stmt = $pdo->prepare(
            'SELECT * FROM messages WHERE id = ? AND receiver_id = ? LIMIT 1'
        );
        $stmt->execute([$msgId, $authId]);
    } else {
        $stmt = $pdo->prepare(
            'SELECT * FROM messages WHERE id = ? AND (receiver_id = ? OR sender_id = ?) LIMIT 1'
        );
        $stmt->execute([$msgId, $authId, $authId]);
    }
    $msg = $stmt->fetch();
    if (!$msg) jsonError('Message not found or unauthorized', 404);

    // 'beaten' : seulement si le statut était 'accepted'
    if ($status === 'beaten' && $msg['status'] !== 'accepted') {
        jsonError('Can only mark as beaten if status was accepted');
    }

    $pdo->prepare('UPDATE messages SET status = ? WHERE id = ?')->execute([$status, $msgId]);

    // Si 'beaten' → XP Social Link mutuel (35 XP)
    if ($status === 'beaten') {
        try {
            $stmt = $pdo->prepare('SELECT get_or_create_social_link(?, ?) AS link_id');
            $stmt->execute([
                min((int)$msg['sender_id'], (int)$msg['receiver_id']),
                max((int)$msg['sender_id'], (int)$msg['receiver_id'])
            ]);
            $linkId = (int) $stmt->fetchColumn();
            if ($linkId) {
                $pdo->prepare('CALL add_social_link_xp(?, 35, @x, @r, @u)')->execute([$linkId]);
            }
        } catch (Throwable) { /* silencieux */ }
    }

    jsonSuccess(['updated' => true, 'status' => $status]);
}


// ═══════════════════════════════════════════════════════════════════
// DELETE /api/messages/:id
// ═══════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    if ($msgId <= 0) jsonError('Missing message id', 400);

    $stmt = $pdo->prepare(
        'SELECT id FROM messages WHERE id = ? AND (sender_id = ? OR receiver_id = ?) LIMIT 1'
    );
    $stmt->execute([$msgId, $authId, $authId]);
    if (!$stmt->fetch()) jsonError('Message not found or unauthorized', 404);

    $pdo->prepare('DELETE FROM messages WHERE id = ?')->execute([$msgId]);
    jsonSuccess(['deleted' => true]);
}

jsonError('Method Not Allowed', 405);
