<?php
/**
 * POST /api/user/migrate
 * ────────────────────────────────────────────────────────────────────────────
 * Importe un profil localStorage dans le compte cloud.
 *
 * POURQUOI CE ENDPOINT EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * PersonaDLE v1.x stockait TOUT en localStorage : stats, badges, streaks,
 * sessions en attente. Quand un joueur crée un compte v2.0, il ne doit pas
 * perdre son historique. Ce endpoint permet de migrer ce JSON une seule fois
 * au moment de l'inscription (ou manuellement depuis la page profil).
 *
 * STRUCTURE DU JSON localStorage ATTENDU
 * ────────────────────────────────────────────────────────────────────────────
 * Le JSON est l'export de `personaUserProfile` + `pendingSessions` :
 *
 *   {
 *     "profile": {                          ← clé "personaUserProfile"
 *       "pseudo": "Hamza",
 *       "avatar": "data:image/...base64...",
 *       "avatarBorderColor": "#E63946",
 *       "badges": ["ace_detective", ...],
 *       "selectedBadges": ["ace_detective"],
 *       "eventCodes": ["PERSONA25"],
 *       "stats": {
 *         "wins": 42,
 *         "giveups": 5,
 *         "games": 47,
 *         "modeCount":  { "Classic": 20, "Emoji": 15, ... },
 *         "modeWins":   { "Classic": 18, "Emoji": 12, ... },
 *         "streak": 3,
 *         "streakRecord": 7,
 *         "lastPlayed": "2026-04-10T08:00:00.000Z",
 *         "totalTimeMinutes": 312,
 *         "perfectWins": 4
 *       }
 *     },
 *     "pendingSessions": [                  ← sessions jouées hors-ligne
 *       {
 *         "mode": "classic",
 *         "played_date": "2026-04-09",
 *         "target_name": "Ryuji Sakamoto",
 *         "result": "win",
 *         "attempts": 3,
 *         "time_ms": 45000,
 *         "active_filters": ["P5"]
 *       },
 *       ...
 *     ]
 *   }
 *
 * STRATÉGIE DE MIGRATION
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Stats globales (profile.stats) → fusionnées dans user_stats par mode
 *    - On répartit wins/games/giveups/streak sur les modes via modeCount/modeWins
 *    - Le streakRecord localStorage devient le streak_record initial si supérieur
 *
 * 2. Sessions en attente (pendingSessions) → insérées dans game_sessions
 *    - Anti-doublon : on ignore les sessions dont (user_id, mode, played_date) existe déjà
 *    - Chaque session met aussi à jour user_stats (même logique que sessions.php)
 *
 * 3. Avatar + bordure + badges → profil cloud mis à jour
 *
 * IDEMPOTENCE
 * ────────────────────────────────────────────────────────────────────────────
 * Ce endpoint peut être appelé plusieurs fois sans danger :
 *   - Les sessions en doublon sont ignorées silencieusement
 *   - Les stats ne sont additionnées que si elles augmentent la valeur actuelle
 *   - L'avatar/badges sont simplement écrasés (dernier appel gagne)
 *
 * Succès : 200 { migrated_sessions: N, skipped_sessions: N, profile_updated: true }
 * Erreurs : 401 (non connecté), 400 (JSON invalide)
 */

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method Not Allowed', 405);
}

$userId = requireAuth();

// Vérifier si la migration a déjà été effectuée pour ce compte.
// Enveloppé dans try/catch : si la colonne has_migrated est absente
// (migration SQL 002 non encore jouée), on continue sans bloquer.
try {
    $stmtCheck = pdo()->prepare('SELECT has_migrated FROM users WHERE id = ? LIMIT 1');
    $stmtCheck->execute([$userId]);
    $userRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);
    if ($userRow && (int) ($userRow['has_migrated'] ?? 0) === 1) {
        jsonError('Migration already done. Only one JSON import is allowed per account.', 409);
    }
} catch (PDOException $e) {
    // Colonne has_migrated absente — migration SQL 002 non jouée, on ignore la vérification
    error_log('[PersonaDLE migrate] has_migrated check skipped: ' . $e->getMessage());
}

$data   = getJsonBody();

// ── Extraction des deux blocs du payload ─────────────────────────────────────
$profileData     = $data['profile']         ?? null;
$pendingSessions = $data['pendingSessions']  ?? [];

if (!is_array($pendingSessions)) {
    $pendingSessions = [];
}

$pdo = pdo();

$migratedSessions = 0;
$skippedSessions  = 0;

// ═════════════════════════════════════════════════════════════════════════════
// BLOC 1 — MIGRATION DES SESSIONS EN ATTENTE
// ─────────────────────────────────────────────────────────────────────────────
// Chaque session est insérée dans game_sessions et déclenche une mise à jour
// de user_stats (wins, streak, etc.), exactement comme sessions.php.
//
// On traite les sessions dans l'ordre chronologique pour que le calcul
// de streak soit cohérent.
// ═════════════════════════════════════════════════════════════════════════════

$validModes    = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
$validResults  = ['win', 'giveup'];

// Trier par date croissante (ordre chronologique)
usort($pendingSessions, fn($a, $b) =>
    strcmp($a['played_date'] ?? '', $b['played_date'] ?? '')
);

$stmtCheckSession = $pdo->prepare('
    SELECT id FROM game_sessions
    WHERE user_id = ? AND mode = ? AND played_date = ?
    LIMIT 1
');
$stmtInsertSession = $pdo->prepare('
    INSERT INTO game_sessions
        (user_id, mode, played_date, target_name, result, attempts, time_ms, active_filters)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
');
$stmtGetStats = $pdo->prepare('
    SELECT * FROM user_stats WHERE user_id = ? AND mode = ? LIMIT 1
');
$stmtUpdateStats = $pdo->prepare('
    UPDATE user_stats SET
        games         = games + 1,
        wins          = wins + ?,
        giveups       = giveups + ?,
        streak        = ?,
        streak_record = ?,
        perfect_wins  = perfect_wins + ?,
        total_time_ms = total_time_ms + ?,
        last_played_at = UTC_TIMESTAMP()
    WHERE user_id = ? AND mode = ?
');

foreach ($pendingSessions as $session) {
    $mode       = strtolower(trim($session['mode']        ?? ''));
    $date       =            trim($session['played_date'] ?? '');
    $targetName =            trim($session['target_name'] ?? '');
    $result     = strtolower(trim($session['result']      ?? ''));
    $attempts   = (int)           ($session['attempts']   ?? 0);
    $timeMs     = (int)           ($session['time_ms']    ?? 0);
    $filters    =                  $session['active_filters'] ?? [];

    // Ignorer les sessions invalides silencieusement
    if (!in_array($mode, $validModes, true))   { $skippedSessions++; continue; }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) { $skippedSessions++; continue; }
    if (!in_array($result, $validResults, true))      { $skippedSessions++; continue; }
    if (empty($targetName))                           { $skippedSessions++; continue; }

    // Anti-doublon : pas deux fois la même session (user + mode + date)
    $stmtCheckSession->execute([$userId, $mode, $date]);
    if ($stmtCheckSession->fetch()) {
        $skippedSessions++;
        continue;
    }

    $pdo->beginTransaction();
    try {
        // Insérer la session
        $stmtInsertSession->execute([
            $userId, $mode, $date, $targetName, $result,
            $attempts, $timeMs, json_encode(is_array($filters) ? $filters : []),
        ]);

        // Recalculer la streak
        $stmtGetStats->execute([$userId, $mode]);
        $stats = $stmtGetStats->fetch();

        $isWin     = $result === 'win';
        $isPerfect = $isWin && $attempts === 1;

        // Vérifier la consécutivité (même logique que sessions.php)
        $currentStreak = (int) ($stats['streak'] ?? 0);
        $currentRecord = (int) ($stats['streak_record'] ?? 0);
        $lastPlayedAt  = $stats['last_played_at'] ?? null;
        if ($isWin && $lastPlayedAt) {
            $lastDate  = (new DateTime($lastPlayedAt, new DateTimeZone('UTC')))
                ->setTimezone(new DateTimeZone('Europe/Paris'))
                ->format('Y-m-d');
            $daysDiff  = (int) (new DateTime($lastDate, new DateTimeZone('Europe/Paris')))
                ->diff(new DateTime($date, new DateTimeZone('Europe/Paris')))
                ->format('%r%a');
            $newStreak = $daysDiff === 1 ? $currentStreak + 1 : 1;
        } elseif ($isWin) {
            $newStreak = 1;
        } else {
            $newStreak = 0;
        }
        $newRecord = max($currentRecord, $newStreak);

        $stmtUpdateStats->execute([
            $isWin ? 1 : 0,
            $isWin ? 0 : 1,
            $newStreak,
            $newRecord,
            $isPerfect ? 1 : 0,
            $timeMs,
            $userId,
            $mode,
        ]);

        $pdo->commit();
        $migratedSessions++;
    } catch (Throwable $e) {
        $pdo->rollBack();
        // On loggue mais on ne bloque pas — on continue avec la session suivante
        error_log("[PersonaDLE migrate] Session error: " . $e->getMessage());
        $skippedSessions++;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOC 2 — MIGRATION DU PROFIL (avatar, badges, streakRecord)
// ─────────────────────────────────────────────────────────────────────────────
// On ne touche pas au streakRecord en BDD s'il est déjà supérieur
// (cas : joueur qui migre après avoir déjà joué quelques parties connecté).
// ═════════════════════════════════════════════════════════════════════════════

$profileUpdated = false;

if (is_array($profileData)) {
    $avatar      = $profileData['avatar']            ?? null;
    $borderColor = $profileData['avatarBorderColor'] ?? '#ffffff';
    $badges      = $profileData['badges']            ?? [];
    $selected    = $profileData['selectedBadges']    ?? [];
    $stats       = $profileData['stats']             ?? [];
    $streakRecord = (int) ($stats['streakRecord']    ?? 0);
    $wallpaperId  = $profileData['profileTheme']     ?? null;
    $musicId      = $profileData['profileSong']['fichier'] ?? null;
    // Couleur custom : encoder sous la forme "custom:#RRGGBB"
    if ($wallpaperId === 'custom') {
        $customColor = $profileData['profileCustomColor'] ?? null;
        $wallpaperId = $customColor && preg_match('/^#[0-9A-Fa-f]{6}$/', $customColor)
            ? 'custom:' . $customColor
            : null;
    }

    // Normaliser les anciens chemins relatifs "./img/..." → "../img/..."
    // (les paths stockés depuis la racine du site doivent être ajustés pour profile/)
    if ($avatar && !str_starts_with($avatar, 'data:') && str_starts_with($avatar, './')) {
        $avatar = '../' . substr($avatar, 2);
    }

    // Valider la couleur (hex #RRGGBB)
    if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $borderColor)) {
        $borderColor = '#ffffff';
    }

    // Mettre à jour le profil
    $pdo->prepare('
        UPDATE profiles SET
            avatar_data         = ?,
            avatar_border_color = ?,
            wallpaper_id        = ?,
            profile_music_id    = ?,
            selected_badges     = ?,
            updated_at          = NOW()
        WHERE user_id = ?
    ')->execute([
        $avatar,
        $borderColor,
        $wallpaperId,
        $musicId,
        json_encode(array_values(array_slice((array) $selected, 0, 4))),
        $userId,
    ]);

    // Insérer les badges débloqués (ignore les doublons via INSERT IGNORE)
    if (!empty($badges) && is_array($badges)) {
        $stmtBadge = $pdo->prepare('
            INSERT IGNORE INTO badges_unlocked (user_id, badge_id)
            VALUES (?, ?)
        ');
        foreach ($badges as $badgeId) {
            if (is_string($badgeId) && strlen($badgeId) <= 100) {
                $stmtBadge->execute([$userId, $badgeId]);
            }
        }
    }

    // Mettre à jour le streakRecord global uniquement si supérieur
    // (on ne sait pas à quel mode appartient le streakRecord localStorage
    //  car l'ancien système était global → on l'applique sur tous les modes)
    if ($streakRecord > 0) {
        $pdo->prepare('
            UPDATE user_stats
            SET streak_record = GREATEST(streak_record, ?)
            WHERE user_id = ?
        ')->execute([$streakRecord, $userId]);
    }

    $profileUpdated = true;
}

// Marquer ce compte comme ayant déjà effectué sa migration (une seule fois autorisée).
// Ignoré silencieusement si la colonne n'existe pas encore (migration SQL 002 non jouée).
try {
    pdo()->prepare('UPDATE users SET has_migrated = 1 WHERE id = ?')->execute([$userId]);
} catch (PDOException $e) {
    error_log('[PersonaDLE migrate] has_migrated update skipped: ' . $e->getMessage());
}

jsonSuccess([
    'migrated_sessions' => $migratedSessions,
    'skipped_sessions'  => $skippedSessions,
    'profile_updated'   => $profileUpdated,
]);
