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
 *   settings          object JSON (préférences diverses)
 *
 * On utilise un système de champs explicitement whitelistés pour éviter
 * toute injection de colonnes arbitraires via PATCH.
 */

require_once __DIR__ . '/../bootstrap.php';

// ── Extraire l'userId depuis l'URL (/api/user/42 ou /api/user/42/stats) ───────
$parts  = requestPathSegments();
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

    // Autre utilisateur → profil public restreint (pseudo + avatar seulement)
    if ($userId !== $authId) {
        $stmt = $pdo->prepare(
            'SELECT u.pseudo, u.friend_code, p.avatar_data, p.avatar_border_color
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.id = ? AND u.is_deleted = 0
             LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('User not found', 404);
        jsonSuccess([
            'pseudo'              => $row['pseudo'],
            'friend_code'         => $row['friend_code'],
            'avatar_data'         => $row['avatar_data'],
            'avatar_border_color' => $row['avatar_border_color'] ?? '#ffffff',
        ]);
    }

    // Récupérer l'utilisateur
    $stmt = $pdo->prepare('SELECT id, email, pseudo, lang, friend_code, created_at, last_login_at, global_streak, global_streak_record, streak_recovered_at FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) jsonError('User not found', 404);

    // Récupérer le profil
    $stmt = $pdo->prepare('SELECT user_id, avatar_data, avatar_border_color, wallpaper_id, profile_music_id, selected_badges, equipped_title_id, settings FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    $profile = $stmt->fetch() ?: [];

    // Récupérer les stats (tous modes)
    $stmt = $pdo->prepare('SELECT mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms FROM user_stats WHERE user_id = ? ORDER BY mode');
    $stmt->execute([$userId]);
    $stats = $stmt->fetchAll();

    // Récupérer les badges débloqués
    $stmt = $pdo->prepare('SELECT badge_id, unlocked_at FROM badges_unlocked WHERE user_id = ? ORDER BY unlocked_at');
    $stmt->execute([$userId]);
    $badges = $stmt->fetchAll();

    // Récupérer les wallpapers débloqués
    $stmt = $pdo->prepare('SELECT wallpaper_id FROM user_wallpapers WHERE user_id = ?');
    $stmt->execute([$userId]);
    $unlockedWallpapers = $stmt->fetchAll(PDO::FETCH_COLUMN);

    // Récupérer les titres débloqués
    $stmt = $pdo->prepare('SELECT t.slug, ut.unlocked_at FROM user_titles ut JOIN titles t ON t.id = ut.title_id WHERE ut.user_id = ? ORDER BY ut.unlocked_at');
    $stmt->execute([$userId]);
    $unlockedTitles = $stmt->fetchAll();

    // Résoudre le slug du titre équipé (évite un aller-retour supplémentaire côté JS)
    $equippedTitleSlug = null;
    if (!empty($profile['equipped_title_id'])) {
        $s = $pdo->prepare('SELECT slug FROM titles WHERE id = ? LIMIT 1');
        $s->execute([$profile['equipped_title_id']]);
        $equippedTitleSlug = $s->fetchColumn() ?: null;
    }

    jsonSuccess([
        'user'    => formatUser($user),
        'profile' => [
            'avatar_data'         => $profile['avatar_data']        ?? null,
            'avatar_border_color' => $profile['avatar_border_color'] ?? '#ffffff',
            'wallpaper_id'        => $profile['wallpaper_id']        ?? null,
            'profile_music_id'    => $profile['profile_music_id']    ?? null,
            'selected_badges'     => json_decode($profile['selected_badges'] ?? 'null') ?? [],
            'equipped_title_id'   => $profile['equipped_title_id']   ?? null,
            'equipped_title_slug' => $equippedTitleSlug,
            'settings'            => json_decode($profile['settings']  ?? 'null', true) ?? [],
        ],
        'stats'   => $stats,
        'global_streak'        => (int) ($user['global_streak'] ?? 0),
        'global_streak_record' => (int) ($user['global_streak_record'] ?? 0),
        // Dernière récupération de streak (Jack Frost), ou null si jamais utilisée.
        //
        // Exposé pour que le client cesse de deviner. Le cooldown de 60 jours est
        // appliqué ICI (api/lib/streak_recovery.php), mais cette date n'était jamais
        // envoyée : `canRecover()` ne pouvait s'appuyer que sur le localStorage, et
        // renvoyait donc « disponible » sur un autre appareil, après un cache vidé
        // ou en navigation privée. Le joueur voyait Jack Frost, cliquait, et se
        // faisait refuser par le serveur.
        'streak_recovered_at'  => $user['streak_recovered_at'] ?? null,
        'badges'  => array_map(fn($b) => [
            'badge_id'    => $b['badge_id'],
            'unlocked_at' => $b['unlocked_at'],
        ], $badges),
        'unlocked_wallpapers' => $unlockedWallpapers,
        'unlocked_titles'     => array_map(fn($t) => [
            'slug'        => $t['slug'],
            'unlocked_at' => $t['unlocked_at'],
        ], $unlockedTitles),
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
        // Vérifier le verrou pseudo (défini par un admin)
        $lockCheck = $pdo->prepare('SELECT pseudo_locked FROM users WHERE id = ? LIMIT 1');
        $lockCheck->execute([$userId]);
        $lockRow = $lockCheck->fetch();
        if (!empty($lockRow['pseudo_locked'])) {
            jsonError('Username is locked and cannot be changed.', 403);
        }
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

    // avatar_data (base64 PNG/JPEG/WebP ou null — taille + préfixe validés)
    if (array_key_exists('avatar_data', $data)) {
        $avatar = $data['avatar_data'];
        if ($avatar !== null && strlen($avatar) > 2_000_000) {
            jsonError('Avatar too large (max 2 MB base64)');
        }
        if ($avatar !== null && !preg_match('/^data:image\/(jpeg|png|webp);base64,/', $avatar)) {
            jsonError('Invalid avatar format', 400);
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
    // Deux types de valeurs :
    //   - Thème UI  : slug parmi UI_THEME_SLUGS ou préfixe "custom:" → pas de vérif ownership
    //   - Wallpaper : slug de la table wallpapers → doit être débloqué dans user_wallpapers
    if (array_key_exists('wallpaper_id', $data)) {
        $wid = $data['wallpaper_id'] ? substr(trim($data['wallpaper_id']), 0, 100) : null;
        if ($wid !== null) {
            $uiThemeSlugs = ['all_out','velvet_room','dark_hour','pink_ribbon',
                             'midnight_channel','demon_palace','eternal_punishment','golden_labyrinth'];
            $isUiTheme = in_array($wid, $uiThemeSlugs, true) || str_starts_with($wid, 'custom:');
            if (!$isUiTheme) {
                $owns = $pdo->prepare('SELECT 1 FROM user_wallpapers WHERE user_id = ? AND wallpaper_id = ? LIMIT 1');
                $owns->execute([$userId, $wid]);
                if (!$owns->fetch()) jsonError('Wallpaper not unlocked', 403);
            }
        }
        $profileFields[] = 'wallpaper_id = ?';
        $profileParams[] = $wid;
    }

    // profile_music_id
    if (array_key_exists('profile_music_id', $data)) {
        $profileFields[] = 'profile_music_id = ?';
        $profileParams[] = $data['profile_music_id'] ? substr($data['profile_music_id'], 0, 100) : null;
    }

    // selected_badges (max 4 IDs, doivent être réellement débloqués)
    if (array_key_exists('selected_badges', $data)) {
        $sel = array_values(array_slice((array) $data['selected_badges'], 0, 4));
        foreach ($sel as $bid) {
            if (!is_string($bid) || !preg_match('/^[a-z0-9_\-]{1,100}$/', $bid)) {
                jsonError('Invalid badge id in selected_badges', 400);
            }
            $owns = $pdo->prepare('SELECT 1 FROM badges_unlocked WHERE user_id = ? AND badge_id = ? LIMIT 1');
            $owns->execute([$userId, $bid]);
            if (!$owns->fetch()) jsonError('Badge not unlocked', 403);
        }
        $profileFields[] = 'selected_badges = ?';
        $profileParams[] = json_encode($sel);
    }

    // equipped_title_id
    if (array_key_exists('equipped_title_id', $data)) {
        $titleId = $data['equipped_title_id'] ? (int) $data['equipped_title_id'] : null;
        if ($titleId !== null) {
            $owns = $pdo->prepare('SELECT 1 FROM user_titles WHERE user_id = ? AND title_id = ? LIMIT 1');
            $owns->execute([$userId, $titleId]);
            if (!$owns->fetch()) jsonError('Title not unlocked', 403);
        }
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
