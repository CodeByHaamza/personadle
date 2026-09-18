<?php
/**
 * GET   /api/admin/settings   → { maintenance: { enabled, message_fr, message_en, until } }
 * PATCH /api/admin/settings   → { maintenance: { enabled?, message_fr?, message_en?, until? } }
 *
 * Mode maintenance (migration 042, table site_settings) : quand il est activé,
 * bootstrap.php répond 503 à toute l'API sauf me/login/logout/admin/cron, et le
 * front affiche un écran « maintenance en cours » — sauf pour un admin connecté,
 * qui voit un bandeau lui rappelant de la lever. `until` est informatif (heure
 * Paris saisie, stockée en UTC).
 * Accès : requireAdmin().
 */

require_once __DIR__ . '/../bootstrap.php';

$adminId = requireAdmin();
$pdo     = pdo();
$method  = $_SERVER['REQUEST_METHOD'];

/** Lecture directe (sans le cache statique de personadle_site_setting). */
function readSetting(PDO $pdo, string $key): ?string
{
    $st = $pdo->prepare('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1');
    $st->execute([$key]);
    $v = $st->fetchColumn();
    return $v === false ? null : (string) $v;
}

function maintenanceSettings(PDO $pdo): array
{
    return [
        'enabled'    => readSetting($pdo, 'maintenance_enabled') === '1',
        'message_fr' => readSetting($pdo, 'maintenance_message_fr'),
        'message_en' => readSetting($pdo, 'maintenance_message_en'),
        'until'      => readSetting($pdo, 'maintenance_until'),
    ];
}

if ($method === 'GET') {
    jsonSuccess(['maintenance' => maintenanceSettings($pdo)]);
}

if ($method === 'PATCH') {
    $data = getJsonBody();
    $m    = is_array($data['maintenance'] ?? null) ? $data['maintenance'] : null;
    if ($m === null) jsonError('maintenance object required', 400);

    if (array_key_exists('enabled', $m)) {
        $enabled = (bool) $m['enabled'];
        personadle_set_site_setting($pdo, 'maintenance_enabled', $enabled ? '1' : '0', $adminId);
        personadle_log_admin_action($pdo, $adminId, $enabled ? 'maintenance.enable' : 'maintenance.disable', 'site', 'maintenance', []);
    }
    foreach (['message_fr', 'message_en'] as $k) {
        if (array_key_exists($k, $m)) {
            $v = trim((string) $m[$k]);
            if (mb_strlen($v) > 500) jsonError("$k too long (500 max)", 400);
            personadle_set_site_setting($pdo, "maintenance_$k", $v !== '' ? $v : null, $adminId);
        }
    }
    if (array_key_exists('until', $m)) {
        $v     = trim((string) $m['until']);
        $until = null;
        if ($v !== '') {
            $d = DateTime::createFromFormat('Y-m-d\TH:i', $v, new DateTimeZone('Europe/Paris'));
            if (!$d) jsonError('Invalid until (expected YYYY-MM-DDTHH:MM)', 400);
            $until = $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        }
        personadle_set_site_setting($pdo, 'maintenance_until', $until, $adminId);
    }

    jsonSuccess(['maintenance' => maintenanceSettings($pdo)]);
}

jsonError('Method Not Allowed', 405);
