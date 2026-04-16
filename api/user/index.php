<?php
/**
 * GET  /api/user/:id  → retourne le profil complet d'un utilisateur
 * PATCH /api/user/:id → met à jour le profil (avatar, wallpaper, badges, pseudo)
 * DELETE /api/user/:id → soft-delete RGPD (is_deleted = 1, hard delete J+30)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCÈS
 *   - GET   : accessible connecté (ses propres données).
 *             Post-v2.0 : profil public via friend_code (champ limité).
 *   - PATCH : uniquement soi-même.
 *   - DELETE: uniquement soi-même.
 *
 * PATCH — champs acceptés
 * ─────────────────────────────────────────────────────────────────────────────
 *   pseudo            VARCHAR(50) — lettre, chiffre, tiret, point, underscore
 *   lang              'en'|'fr'|'es'|'de'|'it'
 *   avatar_data       string (base64 PNG/JPEG) ou null
 *   avatar_border_color  '#RRGGBB'
 *   wallpaper_id      string slug ou null
 *   profile_music_id  string slug ou null
 *   selected_badges   array (max 4 IDs)
 *   equipped_title_id int ou null
 *
 * On utilise un système de champs explicitement whitelistés pour éviter
 * toute injection de colonnes arbitraires via PATCH.
 */

require_once __DIR__ . '/../bootstrap.php';

// ── Extraire l'userId depuis l'URL (/api/user/42 ou /api/user/42/stats) ───────
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$userId = 0;
foreach ($parts as $i => $part) {
    if ($part === 'user' && isset($parts[$i + 1]) && ctype_digit($parts[$i + 1])) {
        $userId = (int) $parts[$i + 1];
        break;
    }
}
if ($userId <= 0) {
    jsonError('Invalid user id', 400);
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo    = pdo();


// ═════════════════════════════════════════════════════════════════════════════
// GET /api/user/:id
// ═════════════════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    $authId = requireAuth();

    // Pour l'instant : lecture de son propre profil seulement.
    // Post-v2.0 : profil public d'un ami accessible avec champs restreints.
    if ($userId !== $authId) {
        jsonError('Forbidden', 403);
    }

    // Récupérer l'utilisateur
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) jsonError('User not found', 404);

    // Récupérer le profil
    $stmt = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    $profile = $stmt->fetch() ?: [];

    // Récupérer les stats (tous modes)
    $stmt = $pdo->prepare('SELECT * FROM user_stats WHERE user_id = ? ORDER BY mode');
    $stmt->execute([$userId]);
    $stats = $stmt->fetchAll();

    // Récupérer les badges débloqués
    $stmt = $pdo->prepare('SELECT badge_id, unlocked_at FROM badges_unlocked WHERE user_id = ? ORDER BY unlocked_at');
    $stmt->execute([$userId]);
    $badges = $stmt->fetchAll();

    jsonSuccess([
        'user'    => formatUser($user),
        'profile' => [
            'avatar_data'        => $profile['avatar_data']        ?? null,
            'avatar_border_color'=> $profile['avatar_border_color'] ?? '#ffffff',
            'wallpaper_id'       => $profile['wallpaper_id']        ?? null,
            'profile_music_id'   => $profile['profile_music_id']    ?? null,
            'selected_badges'    => json_decode($profile['selected_badges'] ?? 'null') ?? [],
            'equipped_title_id'  => $profile['equipped_title_id']   ?? null,
            'settings'           => json_decode($profile['settings']  ?? 'null', true) ?? [],
        ],
        'stats'   => $stats,
        'badges'  => array_map(fn($b) => [
            'badge_id'    => $b['badge_id'],
            'unlocked_at' => $b['unlocked_at'],
        ], $badges),
    ]);
}


// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/user/:id
// ═════════════════════════════════════════════════════════════════════════════
if ($method === 'PATCH') {
    $authId = requireAuth();

    if ($userId !== $authId) {
        jsonError('Forbidden', 403);
    }

    $data = getJsonBody();

    // ── Whitelist des mises à jour users ──────────────────────────────────────
    // On construit dynamiquement la requête UPDATE uniquement avec les champs
    // fournis ET autorisés. Ça évite de mettre à jour des champs non demandés.
    $userFields    = [];
    $userParams    = [];
    $profileFields = [];
    $profileParams = [];

    // pseudo
    if (array_key_exists('pseudo', $data)) {
        $pseudo = trim($data['pseudo']);
        if (strlen($pseudo) < 3 || strlen($pseudo) > 50) {
            jsonError('Username must be 3–50 characters');
        }
        if (!preg_match('/^[\w\-\.]+$/u', $pseudo)) {
            jsonError('Username contains invalid characters');
        }
        // Vérifier l'unicité (exclu l'utilisateur lui-même)
        $stmt = $pdo->prepare('SELECT id FROM users WHERE pseudo = ? AND id != ? LIMIT 1');
        $stmt->execute([$pseudo, $userId]);
        if ($stmt->fetch()) jsonError('Username already taken', 409);

        $userFields[]  = 'pseudo = ?';
        $userParams[]  = $pseudo;
    }

    // lang
    if (array_key_exists('lang', $data)) {
        $lang = trim($data['lang']);
        if (!in_array($lang, ['en', 'fr', 'es', 'de', 'it'], true)) {
            jsonError('Invalid lang');
        }
        $userFields[] = 'lang = ?';
        $userParams[] = $lang;
    }

    // avatar_data (base64 ou null — on ne valide pas le contenu, juste la taille)
    if (array_key_exists('avatar_data', $data)) {
        $avatar = $data['avatar_data'];
        if ($avatar !== null && strlen($avatar) > 2_000_000) {
            jsonError('Avatar too large (max 2 MB base64)');
        }
        $profileFields[] = 'avatar_data = ?';
        $profileParams[] = $avatar;
    }

    // avatar_border_color
    if (array_key_exists('avatar_border_color', $data)) {
        $color = trim($data['avatar_border_color']);
        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
            jsonError('Invalid avatar_border_color (expected #RRGGBB)');
        }
        $profileFields[] = 'avatar_border_color = ?';
        $profileParams[] = $color;
    }

    // wallpaper_id
    if (array_key_exists('wallpaper_id', $data)) {
        $profileFields[] = 'wallpaper_id = ?';
        $profileParams[] = $data['wallpaper_id'] ? substr($data['wallpaper_id'], 0, 100) : null;
    }

    // profile_music_id
    if (array_key_exists('profile_music_id', $data)) {
        $profileFields[] = 'profile_music_id = ?';
        $profileParams[] = $data['profile_music_id'] ? substr($data['profile_music_id'], 0, 100) : null;
    }

    // selected_badges (max 4 IDs)
    if (array_key_exists('selected_badges', $data)) {
        $sel = array_values(array_slice((array) $data['selected_badges'], 0, 4));
        $profileFields[] = 'selected_badges = ?';
        $profileParams[] = json_encode($sel);
    }

    // equipped_title_id
    if (array_key_exists('equipped_title_id', $data)) {
        $titleId = $data['equipped_title_id'] ? (int) $data['equipped_title_id'] : null;
        $profileFields[] = 'equipped_title_id = ?';
        $profileParams[] = $titleId;
    }

    // settings (JSON objet — stocker tel quel après validation minimale)
    if (array_key_exists('settings', $data)) {
        $settings = $data['settings'];
        if ($settings !== null && !is_array($settings)) {
            jsonError('settings must be a JSON object or null');
        }
        $profileFields[] = 'settings = ?';
        $profileParams[] = $settings !== null ? json_encode($settings) : null;
    }

    // Appliquer les mises à jour
    $pdo->beginTransaction();
    try {
        if (!empty($userFields)) {
            $userParams[] = $userId;
            $pdo->prepare('UPDATE users SET ' . implode(', ', $userFields) . ' WHERE id = ?')
                ->execute($userParams);
        }
        if (!empty($profileFields)) {
            $profileParams[] = $userId;
            $pdo->prepare('UPDATE profiles SET ' . implode(', ', $profileFields) . ', updated_at = NOW() WHERE user_id = ?')
                ->execute($profileParams);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE user PATCH] ' . $e->getMessage());
        jsonError('Update failed', 500);
    }

    jsonSuccess(['updated' => true]);
}


// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/user/:id — Soft delete RGPD
// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 : is_deleted = 1 + anonymisation immédiate (email, pseudo)
// Étape 2 : hard delete différé J+30 (à implémenter via cron)
// ═════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    $authId = requireAuth();

    if ($userId !== $authId) {
        jsonError('Forbidden', 403);
    }

    $pdo->beginTransaction();
    try {
        // Anonymiser immédiatement les données personnelles
        $pdo->prepare('
            UPDATE users SET
                is_deleted = 1,
                deleted_at = NOW(),
                email      = CONCAT("deleted_", id, "@personadle.net"),
                pseudo     = CONCAT("DeletedUser_", id),
                password_hash = "deleted"
            WHERE id = ?
        ')->execute([$userId]);

        // Logger la demande pour le hard delete J+30
        $pdo->prepare('
            INSERT INTO deletion_requests (user_id) VALUES (?)
        ')->execute([$userId]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE user DELETE] ' . $e->getMessage());
        jsonError('Deletion failed', 500);
    }

    // Détruire la session
    session_destroy();

    jsonSuccess(['deleted' => true]);
}

// Méthode non supportée
jsonError('Method Not Allowed', 405);
