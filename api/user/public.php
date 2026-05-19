<?php
/**
 * GET /api/user/public?code=XK4R2M9P   → profil public par friend_code
 * GET /api/user/public?pseudo=Hamza     → profil public par pseudo (exact)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ACCÈS
 *   - Public : pas de requireAuth() — tout le monde peut consulter un profil
 *   - Champs exposés : subset limité (pas email, pas password_hash)
 *
 * CHAMPS RETOURNÉS
 * ─────────────────────────────────────────────────────────────────────────────
 *   user:    id, pseudo, friend_code, lang, created_at
 *   profile: avatar_data, avatar_border_color, wallpaper_id,
 *            profile_music_id, selected_badges, equipped_title_id
 *   stats:   tableau by_mode[] + agrégats globaux
 *   badges:  liste des badge_id débloqués
 *   title:   titre équipé (slug + nom traduit) ou null
 */

require_once __DIR__ . '/../bootstrap.php';

$pdo = pdo();

// ── Résoudre l'identifiant ────────────────────────────────────────────────────
$code   = trim($_GET['code']   ?? '');
$pseudo = trim($_GET['pseudo'] ?? '');

if ($code !== '') {
    $stmt = $pdo->prepare(
        'SELECT id, pseudo, friend_code, lang, created_at
         FROM users
         WHERE friend_code = ? AND is_deleted = 0
         LIMIT 1'
    );
    $stmt->execute([$code]);
} elseif ($pseudo !== '') {
    $stmt = $pdo->prepare(
        'SELECT id, pseudo, friend_code, lang, created_at
         FROM users
         WHERE pseudo = ? AND is_deleted = 0
         LIMIT 1'
    );
    $stmt->execute([$pseudo]);
} else {
    jsonError('Missing parameter: code or pseudo', 400);
}

$user = $stmt->fetch();
if (!$user) {
    jsonError('User not found', 404);
}

$userId = (int) $user['id'];

// ── Profil ────────────────────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
$stmt->execute([$userId]);
$profile = $stmt->fetch() ?: [];

// ── Stats ─────────────────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms
     FROM user_stats
     WHERE user_id = ?
     ORDER BY mode'
);
$stmt->execute([$userId]);
$byMode = $stmt->fetchAll();

// Agrégats globaux (calculés ici, pas en SQL pour rester lisible)
$totalWins     = 0;
$totalGames    = 0;
$totalTimeMs   = 0;
$bestStreak    = 0;
$totalPerfect  = 0;
foreach ($byMode as $m) {
    $totalWins    += $m['wins'];
    $totalGames   += $m['games'];
    $totalTimeMs  += $m['total_time_ms'];
    $totalPerfect += $m['perfect_wins'];
    if ($m['streak_record'] > $bestStreak) $bestStreak = $m['streak_record'];
}

// ── Badges ────────────────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT badge_id, unlocked_at FROM badges_unlocked WHERE user_id = ? ORDER BY unlocked_at'
);
$stmt->execute([$userId]);
$badges = $stmt->fetchAll();

// ── Première partie jouée ──────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT MIN(played_date) AS first_game_date FROM game_sessions WHERE user_id = ?');
$stmt->execute([$userId]);
$firstGameRow  = $stmt->fetch();
$firstGameDate = $firstGameRow['first_game_date'] ?? null;

// ── Wallpapers débloqués ──────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT wallpaper_id FROM user_wallpapers WHERE user_id = ?');
$stmt->execute([$userId]);
$unlockedWallpapers = $stmt->fetchAll(PDO::FETCH_COLUMN);

// ── Titre équipé ──────────────────────────────────────────────────────────────
$equippedTitle = null;
$equippedTitleId = $profile['equipped_title_id'] ?? null;
if ($equippedTitleId) {
    $lang = $user['lang'] ?: 'en';
    $col  = in_array($lang, ['fr', 'es', 'de', 'it'], true) ? "name_{$lang}" : 'name_en';
    $stmt = $pdo->prepare("SELECT slug, image_path, {$col} AS name, rarity FROM titles WHERE id = ? LIMIT 1");
    $stmt->execute([$equippedTitleId]);
    $titleRow = $stmt->fetch();
    if ($titleRow) {
        $equippedTitle = [
            'id'         => $equippedTitleId,
            'slug'       => $titleRow['slug'],
            'name'       => $titleRow['name'],
            'rarity'     => $titleRow['rarity'],
            'image_path' => $titleRow['image_path'] ?: null,
        ];
    }
}

// ── Réponse ───────────────────────────────────────────────────────────────────
jsonSuccess([
    'user' => [
        'id'              => $userId,
        'pseudo'          => $user['pseudo'],
        'friend_code'     => $user['friend_code'],
        'lang'            => $user['lang'],
        'created_at'      => $user['created_at'],
        'first_game_date' => $firstGameDate,
    ],
    'profile' => [
        'avatar_data'         => $profile['avatar_data']         ?? null,
        'avatar_border_color' => $profile['avatar_border_color']  ?? '#ffffff',
        'wallpaper_id'        => $profile['wallpaper_id']         ?? null,
        'profile_music_id'    => $profile['profile_music_id']     ?? null,
        'selected_badges'     => json_decode($profile['selected_badges'] ?? 'null') ?? [],
        'equipped_title_id'   => $profile['equipped_title_id']    ?? null,
    ],
    'stats' => [
        'by_mode'        => $byMode,
        'total_wins'     => $totalWins,
        'total_games'    => $totalGames,
        'total_time_ms'  => $totalTimeMs,
        'best_streak'    => $bestStreak,
        'total_perfect'  => $totalPerfect,
    ],
    'badges'              => array_map(fn($b) => [
        'badge_id'    => $b['badge_id'],
        'unlocked_at' => $b['unlocked_at'],
    ], $badges),
    'unlocked_wallpapers' => $unlockedWallpapers,
    'equipped_title' => $equippedTitle,
]);
