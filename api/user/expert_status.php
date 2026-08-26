<?php
/**
 * GET /api/user/expert-status
 * ────────────────────────────────────────────────────────────────────────────
 * État de déblocage des 6 Modes Expert pour l'utilisateur connecté.
 *
 * Accès : connecté
 * Succès : 200 { expert_status: { <mode>: { unlocked, condition_type, required, current } } }
 *
 * Le serveur ne renvoie AUCUN libellé : seulement `condition_type` et les deux
 * nombres. Le texte de l'infobulle (« 7 / 10 victoires en 4 essais ou moins »)
 * est construit côté client via i18n — sinon il serait en anglais pour les
 * 6 langues du site.
 *
 * Les seuils viennent de api/lib/expert_unlocks.php, la même source que le gate
 * de api/sessions.php : l'écran ne peut pas annoncer une règle différente de
 * celle réellement appliquée.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/expert_unlocks.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$userId = requireAuth();
$pdo    = pdo();

$status = [];
foreach (array_keys(personadle_expert_conditions()) as $mode) {
    $status[$mode] = personadle_expert_progress($pdo, $userId, $mode);
}

jsonSuccess(['expert_status' => $status]);
