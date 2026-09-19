<?php
/**
 * GET  /api/badges           → catalog with is_unlocked for current user
 * POST /api/badges/unlock    { badge_id: "ace_detective" }
 * POST /api/badges/redeem    { code: "PHANTOM2024" }
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/condition_check.php';
require_once __DIR__ . '/../lib/unlock_reconcile.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = requestPathSegments();
$action = end($parts);

// ── GET /api/badges — full catalog with per-user is_unlocked ─────────────────
if ($method === 'GET') {
    // Réconciliation serveur (unlock_reconcile.php) : tout badge dont la condition
    // est remplie est accordé ici, que le client sache ou non l'évaluer.
    personadle_reconcile_badges($pdo, $authId);

    $lang = $_GET['lang'] ?? 'en';
    $col  = in_array($lang, ['fr','es','de','it'], true) ? "name_{$lang}" : 'name_en';

    // LEFT JOIN remplace la sous-requête corrélée N+1 (une requête au lieu de N)
    //
    // Revue PR #14 : condition_type/mode/value exposés à tout utilisateur authentifié
    // (décision assumée, pas un effet de bord du SELECT étendu) — même contrat que
    // GET /api/titles, qui exposait déjà condition_type/condition_value avant cette PR.
    // Ça révèle les seuils exacts de déblocage (ex: "50 jours uniques"), acceptable pour
    // un fan-game sans enjeu compétitif fort ; les conditions sensibles (`manual`, badges
    // secrets à réponse "???") ne fuient rien de plus que ce que condition_en dit déjà.
    $stmt = $pdo->prepare(
        "SELECT b.slug, b.{$col} AS name, b.category, b.rarity,
                b.image_path, b.condition_en, b.is_secret,
                b.condition_type, b.condition_mode, b.condition_value,
                (bu.badge_id IS NOT NULL) AS is_unlocked
         FROM badges b
         LEFT JOIN badges_unlocked bu ON bu.badge_id = b.slug AND bu.user_id = ?
         ORDER BY FIELD(b.category,'achievement','streak','social','event','secret'), b.slug"
    );
    $stmt->execute([$authId]);
    jsonSuccess($stmt->fetchAll());
}

if ($method !== 'POST') jsonError('Method not allowed', 405);

$data = json_decode(file_get_contents('php://input'), true) ?? [];

// ── POST /api/badges/unlock ──────────────────────────────────────────────────
if ($action === 'unlock') {
    $badgeId = trim($data['badge_id'] ?? '');
    if (!$badgeId || strlen($badgeId) > 100) jsonError('Invalid badge_id', 400);

    $check = $pdo->prepare(
        'SELECT slug, condition_type, condition_mode, condition_value FROM badges WHERE slug = ? LIMIT 1'
    );
    $check->execute([$badgeId]);
    $badge = $check->fetch();
    if (!$badge) jsonError('Badge not found in catalog', 404);

    // ── Un badge adossé à un code événement ne s'obtient QUE par /redeem ──────
    //
    // Les 13 badges de `event_codes` (Noël, Saint-Valentin, badges secrets
    // communautaires…) sont protégés par un code secret, mais ils portent
    // `condition_type = 'manual'` — ce qui, sur cette route, valait « accordé sans
    // vérification ». Le code ne servait donc à rien : un POST /api/badges/unlock
    // avec le slug suffisait, et le slug est public (GET /api/badges le liste).
    //
    // Le contournement est fermé ici plutôt que dans condition_check.php parce que
    // ce n'est pas une question de CONDITION mais de ROUTE : la condition de ces
    // badges, c'est « connaître le code », et seul /redeem sait la vérifier (il
    // valide le code, sa fenêtre de validité, et consomme la redemption).
    //
    // Aucun effet sur un joueur légitime : `handleEventCodeSubmit()` est
    // serveur-d'abord (le badge n'entre dans le profil local qu'une fois
    // /redeem revenu OK), donc le backend le connaît toujours avant le local et
    // la synchro n'a jamais à le repousser par cette route.
    $codeGated = $pdo->prepare('SELECT 1 FROM event_codes WHERE badge_id = ? LIMIT 1');
    $codeGated->execute([$badgeId]);
    if ($codeGated->fetchColumn()) {
        jsonError('This badge can only be unlocked with its event code', 403);
    }

    // Vérifie que la condition du badge est réellement remplie côté serveur.
    //
    // personadle_condition_allows_unlock() et non personadle_verify_condition() :
    // cette dernière laisse passer un condition_type inconnu (son `default:
    // return true`, safe fallback voulu pour ne pas rendre inaccessible un badge
    // ajouté demain avec un type pas encore implémenté). Sur le chemin d'un
    // POST /unlock, ce fallback fait l'inverse de ce qu'on veut : une faute de
    // frappe dans une migration ouvrirait le badge à n'importe quel compte
    // authentifié. Les wallpapers fermaient déjà ce trou de leur côté (revue
    // PR #14) ; les trois endpoints partagent désormais la même porte.
    if (!personadle_condition_allows_unlock(
        $pdo,
        $authId,
        $badge['condition_type'],
        $badge['condition_mode'] ?? null,
        isset($badge['condition_value']) ? (int) $badge['condition_value'] : null
    )) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
        ->execute([$authId, $badgeId]);

    // Same Energy se débloque pour les DEUX d'un coup (décision Hamza) : la paire
    // vient d'être vérifiée pour le demandeur, elle vaut symétriquement pour
    // chaque partenaire. Son client la verra au prochain sync (backend → local,
    // avec l'animation). INSERT IGNORE : déjà acquis = rien.
    if ($badge['condition_type'] === 'same_energy') {
        $grant = $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)');
        foreach (personadle_same_energy_partners($pdo, $authId) as $partnerId) {
            $grant->execute([$partnerId, $badgeId]);
        }
    }

    jsonSuccess(['unlocked' => true, 'badge_id' => $badgeId]);
}

// ── POST /api/badges/redeem ──────────────────────────────────────────────────
if ($action === 'redeem') {
    $code = strtoupper(trim($data['code'] ?? ''));
    if (!$code || strlen($code) > 50) jsonError('Invalid code', 400);

    // Validate code exists, is active, and within date range
    $stmt = $pdo->prepare(
        'SELECT code, badge_id, is_permanent, start_date, end_date
         FROM event_codes
         WHERE code = ? AND is_active = 1
         LIMIT 1'
    );
    $stmt->execute([$code]);
    $ec = $stmt->fetch();
    if (!$ec) jsonError('Invalid or expired code', 404);

    // Date-limited codes: check window
    if (!$ec['is_permanent']) {
        $now = new DateTime('now', new DateTimeZone('Europe/Paris'));
        $today = $now->format('Y-m-d');
        if ($today < $ec['start_date'] || $today > $ec['end_date']) {
            jsonError('Code not active yet or already expired', 410);
        }
    }

    // Already redeemed?
    $stmt = $pdo->prepare('SELECT id FROM event_codes_redeemed WHERE user_id = ? AND code = ? LIMIT 1');
    $stmt->execute([$authId, $code]);
    if ($stmt->fetch()) jsonError('Code already redeemed', 409);

    $badgeId = $ec['badge_id'];

    // Garde-fou : un code créé avant la validation admin (ou modifié en SQL direct)
    // peut encore pointer vers un badge_id inexistant — ne jamais consommer la
    // redemption dans ce cas, sinon le joueur perd sa chance une fois le slug corrigé.
    $badgeCheck = $pdo->prepare('SELECT slug FROM badges WHERE slug = ? LIMIT 1');
    $badgeCheck->execute([$badgeId]);
    if (!$badgeCheck->fetch()) {
        error_log("[PersonaDLE badges redeem] code {$code} references unknown badge_id {$badgeId}");
        jsonError('Code mal configuré — contacte un admin', 500);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO event_codes_redeemed (user_id, code) VALUES (?, ?)')
            ->execute([$authId, $code]);
        $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
            ->execute([$authId, $badgeId]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE badges redeem] ' . $e->getMessage());
        jsonError('Redeem failed', 500);
    }

    jsonSuccess(['redeemed' => true, 'code' => $code, 'badge_id' => $badgeId]);
}

jsonError('Unknown action', 404);
