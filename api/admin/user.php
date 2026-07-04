<?php
/**
 * GET    /api/admin/users/:id  → profil complet d'un utilisateur
 * PATCH  /api/admin/users/:id  → modifier pseudo, email, lang, avatar_border_color, is_admin
 * DELETE /api/admin/users/:id  → hard delete immédiat (admin uniquement)
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/admin_validation.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire userId depuis l'URL (/api/admin/users/42) ────────────────────────
$path     = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
$parts    = explode('/', $path);
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users/:id — profil complet
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    // Utilisateur
    $stmt = $pdo->prepare(
        'SELECT id, email, pseudo, lang, friend_code, is_admin, is_banned, pseudo_locked, created_at, last_login_at
         FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1'
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) jsonError('User not found', 404);

    // Profil
    $stmt = $pdo->prepare(
        'SELECT avatar_data, avatar_border_color, wallpaper_id, equipped_title_id
         FROM profiles WHERE user_id = ? LIMIT 1'
    );
    $stmt->execute([$userId]);
    $profile = $stmt->fetch() ?: [];

    // Stats (tous modes)
    $stmt = $pdo->prepare(
        'SELECT mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms
         FROM user_stats WHERE user_id = ? ORDER BY mode'
    );
    $stmt->execute([$userId]);
    $stats = $stmt->fetchAll();

    // Badges débloqués (slugs)
    $stmt = $pdo->prepare(
        'SELECT badge_id FROM badges_unlocked WHERE user_id = ? ORDER BY unlocked_at'
    );
    $stmt->execute([$userId]);
    $badges = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Wallpapers débloqués (slugs)
    $stmt = $pdo->prepare(
        'SELECT wallpaper_id FROM user_wallpapers WHERE user_id = ? ORDER BY unlocked_at'
    );
    $stmt->execute([$userId]);
    $wallpapers = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Titres débloqués
    $stmt = $pdo->prepare(
        'SELECT t.id, t.slug, t.name_en, t.rarity, ut.unlocked_at
         FROM user_titles ut
         JOIN titles t ON t.id = ut.title_id
         WHERE ut.user_id = ?
         ORDER BY ut.unlocked_at'
    );
    $stmt->execute([$userId]);
    $titles = $stmt->fetchAll();

    // Amis
    $stmt = $pdo->prepare(
        'SELECT f.id AS friendship_id,
                CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS user_id,
                u.pseudo,
                p.avatar_data,
                f.status,
                f.created_at
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE (f.requester_id = ? OR f.addressee_id = ?)
           AND u.is_deleted = 0
         ORDER BY f.created_at DESC'
    );
    $stmt->execute([$userId, $userId, $userId, $userId]);
    $friends = $stmt->fetchAll();

    // Social Links
    $stmt = $pdo->prepare(
        'SELECT sl.id,
                sl.user_a_id,
                sl.user_b_id,
                CASE WHEN sl.user_a_id = ? THEN sl.user_b_id ELSE sl.user_a_id END AS other_user_id,
                u.pseudo,
                sl.`rank`,
                sl.xp,
                sl.last_interaction_at,
                (SELECT COUNT(*) FROM social_link_interactions sli WHERE sli.social_link_id = sl.id) AS interaction_count
         FROM social_links sl
         JOIN users u ON u.id = CASE WHEN sl.user_a_id = ? THEN sl.user_b_id ELSE sl.user_a_id END
         WHERE (sl.user_a_id = ? OR sl.user_b_id = ?)
           AND u.is_deleted = 0
         ORDER BY sl.`rank` DESC, sl.xp DESC'
    );
    $stmt->execute([$userId, $userId, $userId, $userId]);
    $socialLinks = $stmt->fetchAll();

    jsonSuccess([
        'user' => [
            'id'            => (int)  $user['id'],
            'pseudo'        =>        $user['pseudo'],
            'email'         =>        $user['email'],
            'lang'          =>        $user['lang'],
            'friend_code'   =>        $user['friend_code'],
            'is_admin'      => (bool) $user['is_admin'],
            'is_banned'     => (bool) ($user['is_banned']      ?? false),
            'pseudo_locked' => (bool) ($user['pseudo_locked']  ?? false),
            'created_at'    =>        $user['created_at'],
            'last_login_at' =>        $user['last_login_at'],
        ],
        'profile' => [
            'avatar_data'         => $profile['avatar_data']         ?? null,
            'avatar_border_color' => $profile['avatar_border_color'] ?? '#ffffff',
            'wallpaper_id'        => $profile['wallpaper_id']        ?? null,
            'equipped_title_id'   => $profile['equipped_title_id']   ?? null,
        ],
        'stats'        => $stats,
        'badges'       => $badges,
        'wallpapers'   => $wallpapers,
        'titles'       => array_map(fn($t) => [
            'id'          => (int) $t['id'],
            'slug'        => $t['slug'],
            'name_en'     => $t['name_en'],
            'rarity'      => $t['rarity'],
            'unlocked_at' => $t['unlocked_at'],
        ], $titles),
        'friends'      => array_map(fn($f) => [
            'friendship_id' => (int) $f['friendship_id'],
            'user_id'       => (int) $f['user_id'],
            'pseudo'        => $f['pseudo'],
            'avatar_data'   => $f['avatar_data'] ?? null,
            'status'        => $f['status'],
            'created_at'    => $f['created_at'],
        ], $friends),
        'social_links' => array_map(fn($sl) => [
            'id'                => (int)  $sl['id'],
            'user_a_id'         => (int)  $sl['user_a_id'],
            'user_b_id'         => (int)  $sl['user_b_id'],
            'other_user_id'     => (int)  $sl['other_user_id'],
            'pseudo'            =>        $sl['pseudo'],
            'rank'              => (int)  $sl['rank'],
            'xp'                => (int)  $sl['xp'],
            'last_interaction_at' =>      $sl['last_interaction_at'],
            'interaction_count' => (int)  $sl['interaction_count'],
        ], $socialLinks),
    ]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/admin/users/:id — modifier un utilisateur
// Champs acceptés : pseudo, email, lang, avatar_border_color, is_admin
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    $data = getJsonBody();

    // Vérifier que l'utilisateur existe
    $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([$userId]);
    if (!$stmt->fetch()) jsonError('User not found', 404);

    $userFields  = [];
    $userParams  = [];
    $profFields  = [];
    $profParams  = [];
    $auditEntries = [];

    // pseudo
    if (array_key_exists('pseudo', $data)) {
        $pseudo = trim((string) $data['pseudo']);
        if ($pseudoError = personadle_validate_admin_pseudo($pseudo)) {
            jsonError($pseudoError, 400);
        }
        $stmt = $pdo->prepare('SELECT id FROM users WHERE pseudo = ? AND id != ? LIMIT 1');
        $stmt->execute([$pseudo, $userId]);
        if ($stmt->fetch()) jsonError('Pseudo already taken', 409);
        $userFields[] = 'pseudo = ?';
        $userParams[] = $pseudo;
        $auditEntries[] = ['action' => 'user.update_pseudo', 'details' => ['new' => $pseudo]];
    }

    // email
    if (array_key_exists('email', $data)) {
        $email = trim((string) $data['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonError('Invalid email', 400);
        }
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
        $stmt->execute([$email, $userId]);
        if ($stmt->fetch()) jsonError('Email already taken', 409);
        $userFields[] = 'email = ?';
        $userParams[] = $email;
        $auditEntries[] = ['action' => 'user.update_email', 'details' => ['new' => $email]];
    }

    // lang
    if (array_key_exists('lang', $data)) {
        $lang = trim((string) $data['lang']);
        if (!in_array($lang, ['en', 'fr', 'es', 'de', 'it'], true)) {
            jsonError('Invalid lang (en|fr|es|de|it)', 400);
        }
        $userFields[] = 'lang = ?';
        $userParams[] = $lang;
        $auditEntries[] = ['action' => 'user.update_lang', 'details' => ['new' => $lang]];
    }

    // is_admin
    if (array_key_exists('is_admin', $data)) {
        $isAdmin = (bool) $data['is_admin'];
        $userFields[] = 'is_admin = ?';
        $userParams[] = (int) $isAdmin;
        $auditEntries[] = ['action' => $isAdmin ? 'user.grant_admin' : 'user.revoke_admin', 'details' => []];
    }

    // is_banned
    if (array_key_exists('is_banned', $data)) {
        $isBanned = (bool) $data['is_banned'];
        $userFields[] = 'is_banned = ?';
        $userParams[] = (int) $isBanned;
        $auditEntries[] = ['action' => $isBanned ? 'user.ban' : 'user.unban', 'details' => []];
    }

    // pseudo_locked
    if (array_key_exists('pseudo_locked', $data)) {
        $pseudoLocked = (bool) $data['pseudo_locked'];
        $userFields[] = 'pseudo_locked = ?';
        $userParams[] = (int) $pseudoLocked;
        $auditEntries[] = ['action' => 'user.set_pseudo_locked', 'details' => ['locked' => $pseudoLocked]];
    }

    // avatar_border_color (dans profiles)
    if (array_key_exists('avatar_border_color', $data)) {
        $color = trim((string) $data['avatar_border_color']);
        if ($colorError = personadle_validate_hex_color($color)) {
            jsonError(str_replace('color', 'avatar_border_color', $colorError), 400);
        }
        $profFields[] = 'avatar_border_color = ?';
        $profParams[] = $color;
        $auditEntries[] = ['action' => 'user.update_avatar_border_color', 'details' => ['new' => $color]];
    }

    // reset_avatar — efface avatar_data (remet l'avatar par défaut)
    if (!empty($data['reset_avatar'])) {
        $profFields[] = 'avatar_data = ?';
        $profParams[] = null;
        $auditEntries[] = ['action' => 'user.reset_avatar', 'details' => []];
    }

    if (empty($userFields) && empty($profFields)) {
        jsonError('No valid fields provided', 400);
    }

    $pdo->beginTransaction();
    try {
        if (!empty($userFields)) {
            $userParams[] = $userId;
            $pdo->prepare('UPDATE users SET ' . implode(', ', $userFields) . ' WHERE id = ?')
                ->execute($userParams);
        }
        if (!empty($profFields)) {
            $profParams[] = $userId;
            $pdo->prepare('UPDATE profiles SET ' . implode(', ', $profFields) . ', updated_at = NOW() WHERE user_id = ?')
                ->execute($profParams);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE admin user PATCH] ' . $e->getMessage());
        jsonError('Update failed', 500);
    }

    foreach ($auditEntries as $entry) {
        personadle_log_admin_action($pdo, $adminId, $entry['action'], 'user', (string) $userId, $entry['details']);
    }

    // Retourner l'utilisateur mis à jour
    $stmt = $pdo->prepare(
        'SELECT id, email, pseudo, lang, friend_code, is_admin, is_banned, pseudo_locked, created_at, last_login_at
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$userId]);
    $updated = $stmt->fetch();

    jsonSuccess([
        'user' => [
            'id'            => (int)  $updated['id'],
            'pseudo'        =>        $updated['pseudo'],
            'email'         =>        $updated['email'],
            'lang'          =>        $updated['lang'],
            'friend_code'   =>        $updated['friend_code'],
            'is_admin'      => (bool) $updated['is_admin'],
            'is_banned'     => (bool) ($updated['is_banned']     ?? false),
            'pseudo_locked' => (bool) ($updated['pseudo_locked'] ?? false),
            'created_at'    =>        $updated['created_at'],
            'last_login_at' =>        $updated['last_login_at'],
        ],
    ]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id — hard delete immédiat (admin)
// Différent du soft delete RGPD : suppression définitive en cascade
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    $stmt = $pdo->prepare('SELECT id, pseudo FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $target = $stmt->fetch();
    if (!$target) jsonError('User not found', 404);

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

    personadle_log_admin_action($pdo, $adminId, 'user.hard_delete', 'user', (string) $userId, [
        'pseudo' => $target['pseudo'],
    ]);

    jsonSuccess(['success' => true]);
}

jsonError('Method Not Allowed', 405);
