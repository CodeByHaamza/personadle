<?php
/**
 * api/lib/moderation.php — Ban avec message et échéance, maintenance, annonces
 * (migration 042). Chargé par bootstrap.php.
 *
 *   personadle_ban_state($pdo, $userRow)   → null si pas banni (ban échu levé
 *                                             au passage), sinon ['reason','until']
 *   personadle_site_setting($pdo, $key)    → valeur d'un réglage (site_settings)
 *   personadle_maintenance_state($pdo)     → null ou ['message_fr','message_en','until']
 *   personadle_active_announcements($pdo)  → annonces actives dans leur fenêtre
 *
 * Toutes ces lectures sont tolérantes : sur une base d'avant la migration 042,
 * elles répondent « rien » plutôt que de casser le login ou le chargement de page.
 */

/**
 * État de ban d'un utilisateur, ou null. Un ban à échéance dépassée est LEVÉ ici
 * (is_banned = 0, champs vidés) : le joueur retrouve son compte tout seul, sans
 * attendre l'admin.
 *
 * @param array<string,mixed> $user ligne users avec au moins id, is_banned,
 *        et si possible ban_reason / banned_until
 * @return array{reason:?string, until:?string}|null
 */
function personadle_ban_state(PDO $pdo, array $user): ?array
{
    if (empty($user['is_banned'])) return null;
    $until = $user['banned_until'] ?? null;
    if ($until !== null && $until !== '' && strtotime((string) $until) !== false && strtotime((string) $until) <= time()) {
        try {
            $pdo->prepare('UPDATE users SET is_banned = 0, ban_reason = NULL, banned_at = NULL, banned_until = NULL WHERE id = ?')
                ->execute([(int) $user['id']]);
        } catch (Throwable) {
            // colonnes absentes (base d'avant 042) : on ne lève rien, on ne casse rien
        }
        return null;
    }
    return [
        'reason' => isset($user['ban_reason']) && $user['ban_reason'] !== '' ? (string) $user['ban_reason'] : null,
        'until'  => $until !== null && $until !== '' ? (string) $until : null,
    ];
}

/** Valeur d'un réglage du site, null si absent (ou table absente). */
function personadle_site_setting(PDO $pdo, string $key): ?string
{
    static $cache = [];
    if (array_key_exists($key, $cache)) return $cache[$key];
    try {
        $st = $pdo->prepare('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1');
        $st->execute([$key]);
        $v = $st->fetchColumn();
        $cache[$key] = $v === false ? null : (string) $v;
    } catch (Throwable) {
        $cache[$key] = null;
    }
    return $cache[$key];
}

/** Écrit un réglage (upsert). */
function personadle_set_site_setting(PDO $pdo, string $key, ?string $value, ?int $adminId): void
{
    $pdo->prepare(
        'INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)'
    )->execute([$key, $value, $adminId]);
}

/**
 * Maintenance en cours ? null sinon. `until` est informatif (affiché au joueur) —
 * la maintenance ne se lève pas toute seule à l'échéance, c'est l'admin qui décide.
 *
 * @return array{message_fr:?string, message_en:?string, until:?string}|null
 */
function personadle_maintenance_state(PDO $pdo): ?array
{
    if (personadle_site_setting($pdo, 'maintenance_enabled') !== '1') return null;
    return [
        'message_fr' => personadle_site_setting($pdo, 'maintenance_message_fr'),
        'message_en' => personadle_site_setting($pdo, 'maintenance_message_en'),
        'until'      => personadle_site_setting($pdo, 'maintenance_until'),
    ];
}

/**
 * Annonces actives maintenant (is_active, et dans la fenêtre starts_at/ends_at).
 * @return list<array{id:int, level:string, message_fr:string, message_en:?string, ends_at:?string}>
 */
function personadle_active_announcements(PDO $pdo): array
{
    try {
        $st = $pdo->query(
            "SELECT id, level, message_fr, message_en, ends_at FROM announcements
             WHERE is_active = 1
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND (ends_at IS NULL OR ends_at >= NOW())
             ORDER BY FIELD(level, 'maintenance', 'warning', 'info'), created_at DESC
             LIMIT 5"
        );
        return array_map(static fn(array $r) => [
            'id'         => (int) $r['id'],
            'level'      => (string) $r['level'],
            'message_fr' => (string) $r['message_fr'],
            'message_en' => $r['message_en'] !== null ? (string) $r['message_en'] : null,
            'ends_at'    => $r['ends_at'] !== null ? (string) $r['ends_at'] : null,
        ], $st->fetchAll());
    } catch (Throwable) {
        return [];
    }
}

/**
 * Garde de maintenance, appelée par bootstrap.php sur chaque requête API : quand
 * la maintenance est activée, tout ce qui n'est pas nécessaire pour la constater
 * ou la lever répond 503 — sauf pour un admin connecté, qui doit pouvoir
 * continuer à administrer (et à tester) pendant que le site est fermé.
 */
function personadle_maintenance_gate(PDO $pdo): void
{
    $state = personadle_maintenance_state($pdo);
    if ($state === null) return;

    // Jamais pour les crons (CLI) : ils tournent pendant la maintenance.
    if (PHP_SAPI === 'cli') return;
    $path = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
    // Toujours ouverts : constater la maintenance (me), se connecter / déconnecter
    // (l'admin), tout l'admin, et les crons appelés en HTTP.
    if (preg_match('#/api/(auth/(me|login|logout)\.php|admin/|cron/)#', $path)) return;

    if (!empty($_SESSION['user_id'])) {
        // Admin ? vérifié en base, mis en cache 60 s dans la session
        $now = time();
        if (!isset($_SESSION['maint_admin_checked_at']) || $now - (int) $_SESSION['maint_admin_checked_at'] > 60) {
            $st = $pdo->prepare('SELECT is_admin FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
            $st->execute([(int) $_SESSION['user_id']]);
            $_SESSION['maint_is_admin'] = (bool) ($st->fetchColumn() ?: false);
            $_SESSION['maint_admin_checked_at'] = $now;
        }
        if (!empty($_SESSION['maint_is_admin'])) return;
    }

    http_response_code(503);
    header('Retry-After: 600');
    echo json_encode([
        'error'       => 'maintenance',
        'message_fr'  => $state['message_fr'],
        'message_en'  => $state['message_en'],
        'until'       => $state['until'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
