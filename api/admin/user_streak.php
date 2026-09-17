<?php
/**
 * GET   /api/admin/users/:id/streak → état complet de la streak d'un joueur
 * PATCH /api/admin/users/:id/streak → la corriger, la restaurer, ou rendre
 *                                      sa récupération Jack Frost disponible
 *
 * Body PATCH, selon `action` :
 *   { "action": "set", "global_streak": n, "global_streak_record": n,
 *     "global_streak_date": "YYYY-MM-DD"|null }
 *       → écrit les valeurs telles quelles (y compris à la BAISSE : c'est le
 *         seul chemin qui le permet, cf. "recover" ci-dessous).
 *   { "action": "recover", "streak": n }
 *       → même geste que Jack Frost, mais SANS le cooldown de 60 jours ni le
 *         plafond « jours réellement joués » : ces gardes protègent d'un joueur
 *         qui s'auto-attribue une streak, pas d'un admin qui répare un compte.
 *         Ne consomme pas la récupération du joueur (streak_recovered_at
 *         inchangé) et ne fait jamais régresser une streak de mode.
 *   { "action": "reset_cooldown" }
 *       → efface streak_recovered_at : le joueur peut de nouveau utiliser
 *         Jack Frost depuis le jeu, immédiatement.
 *
 * Accès : admin uniquement (requireAdmin()).
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/streak_recovery.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts, true);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

$stmt = $pdo->prepare(
    'SELECT id, global_streak, global_streak_record, global_streak_date, streak_recovered_at
     FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1'
);
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) jsonError('User not found', 404);


// ═══════════════════════════════════════════════════════════════════
// GET — état de la streak
// ═══════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    // Jours DISTINCTS réellement joués : c'est le plafond que le jeu applique à
    // une récupération (api/lib/streak_recovery.php). Affiché pour que l'admin
    // voie tout de suite si une streak demandée est plausible.
    $stmt = $pdo->prepare('SELECT COUNT(DISTINCT played_date) FROM game_sessions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $daysPlayed = (int) ($stmt->fetchColumn() ?: 0);

    $stmt = $pdo->prepare('SELECT mode, streak, streak_record FROM user_stats WHERE user_id = ? ORDER BY mode');
    $stmt->execute([$userId]);
    $modes = array_map(fn($r) => [
        'mode'          => $r['mode'],
        'streak'        => (int) $r['streak'],
        'streak_record' => (int) $r['streak_record'],
    ], $stmt->fetchAll());

    // Jours restants avant que Jack Frost redevienne disponible côté joueur.
    $cooldownDaysLeft = 0;
    if ($user['streak_recovered_at'] !== null) {
        $daysSince = (time() - strtotime($user['streak_recovered_at'])) / 86400;
        if ($daysSince < 60) $cooldownDaysLeft = (int) ceil(60 - $daysSince);
    }

    jsonSuccess([
        'global_streak'         => (int) $user['global_streak'],
        'global_streak_record'  => (int) $user['global_streak_record'],
        'global_streak_date'    => $user['global_streak_date'],
        'streak_recovered_at'   => $user['streak_recovered_at'],
        'cooldown_days_left'    => $cooldownDaysLeft,
        'days_played'           => $daysPlayed,
        'modes'                 => $modes,
    ]);
}


// ═══════════════════════════════════════════════════════════════════
// PATCH — corriger / restaurer / débloquer
// ═══════════════════════════════════════════════════════════════════
if ($method !== 'PATCH') jsonError('Method Not Allowed', 405);

$data   = getJsonBody();
$action = trim((string) ($data['action'] ?? ''));

if ($action === 'reset_cooldown') {
    $pdo->prepare('UPDATE users SET streak_recovered_at = NULL WHERE id = ?')->execute([$userId]);

    personadle_log_admin_action($pdo, $adminId, 'streak.reset_cooldown', 'user', (string) $userId, [
        'previous_recovered_at' => $user['streak_recovered_at'],
    ]);

    jsonSuccess(['success' => true, 'cooldown_days_left' => 0]);
}

if ($action === 'recover') {
    $streak = (int) ($data['streak'] ?? 0);
    if ($streak < 1 || $streak > 9999) jsonError('Field streak must be between 1 and 9999', 400);

    // Transaction : personadle_apply_streak_recovery() écrit dans user_stats ET
    // dans users. Une écriture réussie sur l'une et pas sur l'autre laisserait
    // une streak globale sans correspondance par mode.
    $pdo->beginTransaction();
    try {
        $result = personadle_apply_streak_recovery($pdo, $userId, $streak, false);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        personadle_log_error($pdo, 'error', $e->getMessage(), ['source' => 'admin-streak'], $adminId);
        jsonError('Failed to recover streak', 500);
    }

    personadle_log_admin_action($pdo, $adminId, 'streak.recover', 'user', (string) $userId, [
        'streak'        => $streak,
        'modes_updated' => $result['modes_updated'],
    ]);

    jsonSuccess(['success' => true, 'streak' => $streak, 'modes_updated' => $result['modes_updated']]);
}

if ($action === 'set') {
    $streak = (int) ($data['global_streak'] ?? 0);
    $record = (int) ($data['global_streak_record'] ?? 0);
    if ($streak < 0 || $streak > 9999) jsonError('Field global_streak must be between 0 and 9999', 400);
    if ($record < 0 || $record > 9999) jsonError('Field global_streak_record must be between 0 and 9999', 400);

    // `global_streak_date` est la frontière de journée (heure de Paris) qui dit
    // si la streak est encore « vivante ». La laisser incohérente avec la
    // valeur écrite ferait repartir le compteur au prochain calcul côté client.
    $date = $data['global_streak_date'] ?? null;
    if ($date !== null && $date !== '') {
        $date = trim((string) $date);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            jsonError('Field global_streak_date must be YYYY-MM-DD or null', 400);
        }
    } else {
        $date = null;
    }

    // Écriture directe, sans GREATEST : c'est le seul chemin qui autorise une
    // BAISSE. `recover` ne peut, par construction, que remonter — corriger une
    // streak gonflée à tort demandait donc son propre geste.
    $pdo->prepare(
        'UPDATE users
         SET global_streak = ?, global_streak_record = ?, global_streak_date = ?
         WHERE id = ?'
    )->execute([$streak, $record, $date, $userId]);

    personadle_log_admin_action($pdo, $adminId, 'streak.set', 'user', (string) $userId, [
        'global_streak'        => $streak,
        'global_streak_record' => $record,
        'global_streak_date'   => $date,
    ]);

    jsonSuccess([
        'success'              => true,
        'global_streak'        => $streak,
        'global_streak_record' => $record,
        'global_streak_date'   => $date,
    ]);
}

jsonError('Invalid action. Valid values: set, recover, reset_cooldown', 400);
