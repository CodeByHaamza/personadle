<?php
/**
 * GET    /api/admin/users/:id/expert         → état des 6 Modes Expert du joueur
 * POST   /api/admin/users/:id/expert         → accorder un mode  { "mode": "music" }
 * DELETE /api/admin/users/:id/expert/:mode   → retirer le don
 *
 * Accès : admin uniquement (requireAdmin()).
 *
 * « Retirer » ne retire QUE le don : un joueur qui a rempli la condition en
 * jouant garde son accès, et le GET le montre (`earned` vs `granted`). Un admin
 * ne peut pas fermer un mode gagné — ce serait reprendre au joueur ce qu'il a
 * obtenu, et rien dans l'interface ne le laisse entendre.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/expert_unlocks.php';

$adminId = requireAdmin();

$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];

// ── Extraire userId depuis l'URL ─────────────────────────────────────────────
$parts    = requestPathSegments();
$adminIdx = array_search('admin', $parts);
$userId   = (int) ($parts[$adminIdx + 2] ?? 0);
if ($userId <= 0) jsonError('Invalid user id', 400);

$stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
$stmt->execute([$userId]);
if (!$stmt->fetch()) jsonError('User not found', 404);

/**
 * Valide un mode contre la source unique (api/lib/expert_unlocks.php) plutôt que
 * contre une liste recopiée ici : un 7e mode n'aura rien à changer dans ce
 * fichier, et un mode inexistant ne peut pas être inséré en base.
 */
function personadle_valid_expert_mode(string $mode): bool
{
    return isset(personadle_expert_conditions()[$mode]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/users/:id/expert — état des 6 modes
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'GET') {
    $out = [];
    foreach (array_keys(personadle_expert_conditions()) as $mode) {
        $p = personadle_expert_progress($pdo, $userId, $mode);
        $out[$mode] = [
            'unlocked'       => $p['unlocked'],
            // Distinguer les deux chemins : l'admin doit voir d'un coup d'œil si
            // un accès vient du jeu ou d'un don, sinon il ne sait pas ce qu'un
            // retrait va réellement faire.
            'earned'         => $p['unlocked'] && !$p['granted'],
            'granted'        => $p['granted'],
            'condition_type' => $p['condition_type'],
            'required'       => $p['required'],
            'current'        => $p['current'],
        ];
    }
    jsonSuccess(['expert_status' => $out]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/admin/users/:id/expert — accorder un mode
// Body : { "mode": "music" }
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'POST') {
    $data = getJsonBody();
    $mode = trim((string) ($data['mode'] ?? ''));
    if (!personadle_valid_expert_mode($mode)) jsonError('Unknown expert mode', 400);

    // La contrainte UNIQUE (user_id, mode) rend l'opération idempotente sans
    // lecture préalable — INSERT IGNORE absorbe le second appel.
    $ins = $pdo->prepare(
        'INSERT IGNORE INTO expert_unlocks_granted (user_id, mode, granted_by) VALUES (?, ?, ?)'
    );
    $ins->execute([$userId, $mode, $adminId]);
    $created = $ins->rowCount() > 0;

    if ($created) {
        personadle_log_admin_action(
            $pdo,
            $adminId,
            'expert.grant',
            'user',
            (string) $userId,
            ['mode' => $mode]
        );
    }

    jsonSuccess(['success' => true, 'already_had' => !$created]);
}


// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/users/:id/expert/:mode — retirer le don
// ═══════════════════════════════════════════════════════════════════════════════
if ($method === 'DELETE') {
    $expertIdx = array_search('expert', $parts);
    $mode      = $expertIdx !== false ? ($parts[$expertIdx + 1] ?? '') : '';
    if (!personadle_valid_expert_mode($mode)) jsonError('Unknown expert mode', 400);

    $del = $pdo->prepare('DELETE FROM expert_unlocks_granted WHERE user_id = ? AND mode = ?');
    $del->execute([$userId, $mode]);

    if ($del->rowCount() > 0) {
        personadle_log_admin_action(
            $pdo,
            $adminId,
            'expert.revoke',
            'user',
            (string) $userId,
            ['mode' => $mode]
        );
    }

    // `still_unlocked` : le joueur peut avoir gagné l'accès entre-temps. Le dire
    // explicitement évite que l'admin croie avoir fermé un mode qui reste ouvert.
    jsonSuccess([
        'success'        => true,
        'still_unlocked' => personadle_is_expert_unlocked($pdo, $userId, $mode),
    ]);
}

jsonError('Method Not Allowed', 405);
