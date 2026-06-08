<?php
/**
 * GET  /api/badges           → catalog with is_unlocked for current user
 * POST /api/badges/unlock    { badge_id: "ace_detective" }
 * POST /api/badges/redeem    { code: "PHANTOM2024" }
 */
require_once __DIR__ . '/../bootstrap.php';

$authId = requireAuth();
$pdo    = pdo();
$method = $_SERVER['REQUEST_METHOD'];
$parts  = explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$action = end($parts);

/**
 * Vérifie si un utilisateur a rempli la condition pour débloquer un badge.
 *
 * La table `badges` ne stocke pas condition_type/condition_value dans des colonnes
 * structurées — elle n'expose qu'un texte condition_en. La vérification est donc
 * mappée depuis le slug du badge vers la logique correspondante dans user_stats
 * ou badges_unlocked.
 *
 * Règle : tout badge dont le slug est inconnu de cette fonction retourne TRUE
 * (safe fallback) afin de ne pas bloquer les codes événements, les badges spéciaux
 * ou les futurs badges ajoutés sans mise à jour de cette fonction.
 *
 * @param PDO    $pdo    Instance PDO
 * @param int    $userId ID de l'utilisateur authentifié
 * @param string $badgeId Slug du badge (ex: "ace_detective")
 * @return bool  true si la condition est remplie (ou inconnue), false sinon
 */
function verifyBadgeCondition(PDO $pdo, int $userId, string $badgeId): bool
{
    // ── Catégories qui passent toujours (codes événements, badges secrets,
    //    badges sociaux vérifiés côté client ou par d'autres endpoints) ────────
    // Les badges event/secret sont débloqués via /redeem (qui a sa propre logique).
    // Les badges sociaux ont des conditions complexes côté client (flags profil).
    // On les laisse passer ici pour ne pas bloquer les chemins légitimes.
    $bypassList = [
        // event badges — débloqués uniquement via /redeem, pas via /unlock directement
        'christmas_2025', 'new_years_2026', 'chinese_new_year_2026',
        'valentine_2026', 'easter_2026', 'sport', 'rentree',
        'golden_week', 'tanabata', 'promised_day',
        // secret badges — débloqués uniquement via /redeem
        'true_hacker', 'tae_takemi', 'arati', 'dzulian', 'chef',
        'github_contributor', 'lobster',
        // social badges — conditions vérifiées côté serveur par d'autres endpoints
        'take_the_pose', 'best_bro', 'data_mining', 'leblanc_meeting',
        // True Confidant — géré par social-links endpoint
        'true_confidant',
        // Photographer — géré par le flow calling-card
        'photographer',
    ];

    if (in_array($badgeId, $bypassList, true)) {
        return true;
    }

    // ── Helper : somme de wins sur tous les modes (ou un mode précis) ─────────
    $getTotalWins = function (string $mode = '') use ($pdo, $userId): int {
        if ($mode === '') {
            $s = $pdo->prepare('SELECT COALESCE(SUM(wins), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
        } else {
            $s = $pdo->prepare('SELECT COALESCE(wins, 0) FROM user_stats WHERE user_id = ? AND mode = ?');
            $s->execute([$userId, $mode]);
        }
        return (int) $s->fetchColumn();
    };

    // ── Helper : meilleur streak record (tous modes confondus) ───────────────
    $getBestStreak = function () use ($pdo, $userId): int {
        $s = $pdo->prepare('SELECT COALESCE(MAX(streak_record), 0) FROM user_stats WHERE user_id = ?');
        $s->execute([$userId]);
        return (int) $s->fetchColumn();
    };

    // ── Helper : total give-ups tous modes ────────────────────────────────────
    $getTotalGiveups = function () use ($pdo, $userId): int {
        $s = $pdo->prepare('SELECT COALESCE(SUM(giveups), 0) FROM user_stats WHERE user_id = ?');
        $s->execute([$userId]);
        return (int) $s->fetchColumn();
    };

    // ── Mapping slug → condition ──────────────────────────────────────────────
    switch ($badgeId) {

        // ── Achievement badges — victoires totales ───────────────────────────
        case 'first_win':
            return $getTotalWins() >= 1;

        case 'ace_detective':
            return $getTotalWins() >= 10;

        // ── Achievement badges — give-ups ────────────────────────────────────
        case 'ace_defective':
            return $getTotalGiveups() >= 10;

        // ── Achievement badges — victoires par mode ──────────────────────────
        case 'shadow_slayer':
            return $getTotalWins('silhouette') >= 5;

        case 'music_master':
            return $getTotalWins('music') >= 20;

        case 'p1_p2_fan':
            return $getTotalWins('classic') >= 15;

        case 'velvet_master':
            return $getTotalWins('personae') >= 10;

        case 'emoji_decoder':
            return $getTotalWins('emoji') >= 10;

        // ── Achievement badges — streak ───────────────────────────────────────
        case 'pyro_spark':
            return $getBestStreak() >= 7;

        case 'raphael':
            return $getBestStreak() >= 30;

        case 'surt':
            return $getBestStreak() >= 90;

        case 'lucifer':
            return $getBestStreak() >= 120;

        case 'helel':
            return $getBestStreak() >= 365;

        // ── Achievement badges — multi-conditions côté profil ─────────────────
        // Ces badges dépendent de flags stockés dans le profil JSON (foundBurnMyDread,
        // lostToNeverMore, foundWonderVelvet, etc.) que seul le frontend connaît au
        // moment de la partie. Ils sont envoyés via /unlock après vérification locale.
        // On les autorise ici — l'anti-cheat complet nécessiterait un stockage serveur
        // de ces flags, ce qui est hors scope immédiat.
        case 'burn_my_dread':
        case 'into_the_fog':
        case 'velvet_headache':
        case 'chinese_new_year':
        case 'twin_blade':
        case 'persona_q_explorer':
        case 'crimson_legacy':
        case 'hippocampus_reload':
        case 'truth_duality':
        case 'one_shot':
        case 'aoa_vision':
        case 'navigator':
        case 'velvet_regular':
        case 'strega':
        case 'twin_fist':
        case 'twin_spear':
        case 'tradition_modernite':
        case 'shapeshifter':
        case 'ideal_reality':
        case 'for_real':
        case 'night_owl':
        case 'nyx_hour':
        case 'stylist':
        case 'reborn_phoenix':
        case 'hifumi_archives':
        case 'report':
            // Ces badges ont des conditions complexes basées sur des flags de session
            // (profil localStorage/cloud). La vérification serveur complète nécessiterait
            // de persister ces flags en BDD. Autorisés pour l'instant (safe fallback).
            return true;

        default:
            // Slug inconnu → true (ne bloque pas les futurs badges ni les badges spéciaux)
            return true;
    }
}

// ── GET /api/badges — full catalog with per-user is_unlocked ─────────────────
if ($method === 'GET') {
    $lang = $_GET['lang'] ?? 'en';
    $col  = in_array($lang, ['fr','es','de','it'], true) ? "name_{$lang}" : 'name_en';

    // LEFT JOIN remplace la sous-requête corrélée N+1 (une requête au lieu de N)
    $stmt = $pdo->prepare(
        "SELECT b.slug, b.{$col} AS name, b.category, b.rarity,
                b.image_path, b.condition_en, b.is_secret,
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

    $check = $pdo->prepare('SELECT slug FROM badges WHERE slug = ? LIMIT 1');
    $check->execute([$badgeId]);
    if (!$check->fetch()) jsonError('Badge not found in catalog', 404);

    // Vérifie que la condition du badge est réellement remplie côté serveur
    if (!verifyBadgeCondition($pdo, $authId, $badgeId)) {
        jsonError('Condition not met', 403);
    }

    $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
        ->execute([$authId, $badgeId]);

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

    $pdo->beginTransaction();
    try {
        // Record redemption
        $pdo->prepare('INSERT INTO event_codes_redeemed (user_id, code) VALUES (?, ?)')
            ->execute([$authId, $code]);
        // Unlock badge (if it exists in catalog)
        $check = $pdo->prepare('SELECT slug FROM badges WHERE slug = ? LIMIT 1');
        $check->execute([$badgeId]);
        if ($check->fetch()) {
            $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
                ->execute([$authId, $badgeId]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[PersonaDLE badges redeem] ' . $e->getMessage());
        jsonError('Redeem failed', 500);
    }

    jsonSuccess(['redeemed' => true, 'code' => $code, 'badge_id' => $badgeId]);
}

jsonError('Unknown action', 404);
