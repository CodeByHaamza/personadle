<?php
/**
 * GET /api/user/compendium?code=ABCD1234   (ou ?id=42, ou rien = soi-même)
 * ────────────────────────────────────────────────────────────────────────────
 * Le Compendium : tout ce qu'un joueur a accompli, daté, prêt à être feuilleté
 * comme un carnet de collection (profile/compendium/). Décision produit du
 * 2026-09-12 : faits EXISTANTS seulement (aucun « succès » nouveau à définir),
 * PUBLIC comme le profil, texte d'ambiance généré côté client (i18n).
 *
 * Rien n'est inventé : chaque entrée vient d'une table qui porte déjà sa date.
 *   - badges      badges_unlocked.unlocked_at
 *   - titres      user_titles.unlocked_at (+ titles pour le nom / l'image)
 *   - fonds       user_wallpapers.unlocked_at (+ wallpapers)
 *   - liens       friendships.accepted_at, social_links.rank, et l'historique
 *                 des rang-ups via social_link_rankup_notifs (les rang-ups
 *                 antérieurs à cette table n'ont pas de date : le client
 *                 affiche « avant le compendium », il n'invente rien)
 *   - défis       messages type=challenge, statuts terminés, dans les 2 sens
 *   - exploits    game_sessions : première partie, première victoire et
 *                 première partie parfaite par mode (normal / Expert), totaux
 *
 * Sans paramètre, l'appelant doit être connecté (son propre compendium). Avec
 * code/id, aucune session n'est requise : c'est la même règle que public.php,
 * et la même exposition — pseudo, code ami, avatar. Les amis sont listés par
 * pseudo et code ami (pas d'e-mail, pas d'id de session).
 */

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonError('Method Not Allowed', 405);
}

$pdo  = pdo();
$code = trim($_GET['code'] ?? '');
$id   = trim($_GET['id']   ?? '');

if ($code !== '') {
    $stmt = $pdo->prepare(
        'SELECT id, pseudo, friend_code, created_at, global_streak_record
         FROM users WHERE friend_code = ? AND is_deleted = 0 LIMIT 1'
    );
    $stmt->execute([$code]);
} elseif ($id !== '' && ctype_digit($id)) {
    $stmt = $pdo->prepare(
        'SELECT id, pseudo, friend_code, created_at, global_streak_record
         FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1'
    );
    $stmt->execute([(int) $id]);
} else {
    $selfId = requireAuth();
    $stmt = $pdo->prepare(
        'SELECT id, pseudo, friend_code, created_at, global_streak_record
         FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1'
    );
    $stmt->execute([$selfId]);
}

$user = $stmt->fetch();
if (!$user) jsonError('User not found', 404);
$uid = (int) $user['id'];

// ── Badges ───────────────────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT badge_id, unlocked_at FROM badges_unlocked WHERE user_id = ? ORDER BY unlocked_at, id');
$stmt->execute([$uid]);
$badges = array_map(fn($r) => ['badge_id' => $r['badge_id'], 'unlocked_at' => $r['unlocked_at']], $stmt->fetchAll());

// ── Titres ───────────────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT t.slug, t.image_path, t.rarity, t.name_en, t.name_fr, t.name_es, t.name_de, t.name_it, ut.unlocked_at
     FROM user_titles ut JOIN titles t ON t.id = ut.title_id
     WHERE ut.user_id = ? ORDER BY ut.unlocked_at, ut.id'
);
$stmt->execute([$uid]);
$titles = array_map(fn($r) => [
    'slug'        => $r['slug'],
    'image_path'  => $r['image_path'],
    'rarity'      => $r['rarity'],
    'name'        => [
        'en' => $r['name_en'], 'fr' => $r['name_fr'], 'es' => $r['name_es'],
        'de' => $r['name_de'], 'it' => $r['name_it'],
    ],
    'unlocked_at' => $r['unlocked_at'],
], $stmt->fetchAll());

// ── Fonds d'écran ────────────────────────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT w.id, w.name, w.game, w.image_path, uw.unlocked_at
     FROM user_wallpapers uw JOIN wallpapers w ON w.id = uw.wallpaper_id
     WHERE uw.user_id = ? ORDER BY uw.unlocked_at, w.id'
);
$stmt->execute([$uid]);
$wallpapers = array_map(fn($r) => [
    'id'          => $r['id'],
    'name'        => $r['name'],
    'game'        => $r['game'],
    'image_path'  => $r['image_path'],
    'unlocked_at' => $r['unlocked_at'],
], $stmt->fetchAll());

// ── Liens : amis acceptés, rang actuel, rang-ups datés ──────────────────────
$stmt = $pdo->prepare(
    'SELECT f.accepted_at,
            CASE WHEN f.requester_id = :me1 THEN f.addressee_id ELSE f.requester_id END AS friend_id
     FROM friendships f
     WHERE (f.requester_id = :me2 OR f.addressee_id = :me3) AND f.status = \'accepted\'
     ORDER BY f.accepted_at, f.id'
);
$stmt->execute(['me1' => $uid, 'me2' => $uid, 'me3' => $uid]);
$friendRows = $stmt->fetchAll();

$friends = [];
if ($friendRows) {
    $ids = array_map(fn($r) => (int) $r['friend_id'], $friendRows);
    $in  = implode(',', array_fill(0, count($ids), '?'));

    $q = $pdo->prepare("SELECT u.id, u.pseudo, u.friend_code, p.avatar_data, p.avatar_border_color
                        FROM users u LEFT JOIN profiles p ON p.user_id = u.id
                        WHERE u.id IN ($in) AND u.is_deleted = 0");
    $q->execute($ids);
    $byId = [];
    foreach ($q->fetchAll() as $r) $byId[(int) $r['id']] = $r;

    // Rang actuel de chaque lien (user_a_id < user_b_id).
    $q = $pdo->prepare("SELECT user_a_id, user_b_id, `rank`, xp FROM social_links
                        WHERE user_a_id = ? OR user_b_id = ?");
    $q->execute([$uid, $uid]);
    $rankByFriend = [];
    foreach ($q->fetchAll() as $r) {
        $other = (int) $r['user_a_id'] === $uid ? (int) $r['user_b_id'] : (int) $r['user_a_id'];
        $rankByFriend[$other] = ['rank' => (int) $r['rank'], 'xp' => (int) $r['xp']];
    }

    // Historique des rang-ups reçus par CE joueur (les deux côtés reçoivent une
    // notification à chaque passage de rang, cf. api/lib/social_link_interaction.php).
    $q = $pdo->prepare("SELECT partner_id, new_rank, created_at FROM social_link_rankup_notifs
                        WHERE recipient_id = ? ORDER BY created_at, id");
    $q->execute([$uid]);
    $rankUps = [];
    foreach ($q->fetchAll() as $r) {
        $rankUps[(int) $r['partner_id']][] = ['rank' => (int) $r['new_rank'], 'at' => $r['created_at']];
    }

    foreach ($friendRows as $r) {
        $fid = (int) $r['friend_id'];
        if (!isset($byId[$fid])) continue; // compte supprimé depuis
        $u = $byId[$fid];
        $friends[] = [
            'id'                  => $fid,
            'pseudo'              => $u['pseudo'],
            'friend_code'         => $u['friend_code'],
            'avatar_data'         => $u['avatar_data'],
            'avatar_border_color' => $u['avatar_border_color'] ?? '#ffffff',
            'accepted_at'         => $r['accepted_at'],
            'rank'                => $rankByFriend[$fid]['rank'] ?? 1,
            'xp'                  => $rankByFriend[$fid]['xp'] ?? 0,
            'rank_ups'            => $rankUps[$fid] ?? [],
        ];
    }
}

// ── Défis terminés, dans les deux sens ──────────────────────────────────────
$stmt = $pdo->prepare(
    "SELECT m.id, m.sender_id, m.receiver_id, m.challenge_mode, m.challenge_score, m.challenge_date,
            m.challenge_is_expert, m.status, m.created_at,
            s.pseudo AS sender_pseudo, r.pseudo AS receiver_pseudo
     FROM messages m
     JOIN users s ON s.id = m.sender_id
     JOIN users r ON r.id = m.receiver_id
     WHERE m.type = 'challenge'
       AND (m.sender_id = ? OR m.receiver_id = ?)
       AND m.status IN ('beaten', 'expired')
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT 300"
);
$stmt->execute([$uid, $uid]);
$challenges = array_map(function ($m) use ($uid) {
    $sent = (int) $m['sender_id'] === $uid;
    return [
        'id'        => (int) $m['id'],
        'direction' => $sent ? 'sent' : 'received',
        'partner'   => [
            'id'     => $sent ? (int) $m['receiver_id'] : (int) $m['sender_id'],
            'pseudo' => $sent ? $m['receiver_pseudo'] : $m['sender_pseudo'],
        ],
        'mode'      => $m['challenge_mode'],
        'is_expert' => !empty($m['challenge_is_expert']),
        'score'     => $m['challenge_score'] !== null ? (int) $m['challenge_score'] : null,
        'status'    => $m['status'],
        'date'      => $m['challenge_date'],
        'at'        => $m['created_at'],
    ];
}, $stmt->fetchAll());

// ── Exploits, dérivés des sessions ──────────────────────────────────────────
$stmt = $pdo->prepare(
    'SELECT COUNT(*) AS games, SUM(result = \'win\') AS wins, COUNT(DISTINCT played_date) AS days,
            MIN(played_date) AS first_game
     FROM game_sessions WHERE user_id = ?'
);
$stmt->execute([$uid]);
$agg = $stmt->fetch() ?: [];

// Première victoire par mode × dimension (la plus ancienne, puis la plus petite id).
$stmt = $pdo->prepare(
    'SELECT gs.mode, gs.is_expert, gs.played_date, gs.target_name, gs.attempts
     FROM game_sessions gs
     JOIN (
        SELECT mode, is_expert, MIN(played_date) AS d
        FROM game_sessions WHERE user_id = ? AND result = \'win\'
        GROUP BY mode, is_expert
     ) f ON f.mode = gs.mode AND f.is_expert = gs.is_expert AND f.d = gs.played_date
     WHERE gs.user_id = ? AND gs.result = \'win\'
     GROUP BY gs.mode, gs.is_expert
     ORDER BY gs.played_date, gs.mode'
);
$stmt->execute([$uid, $uid]);
$firstWins = array_map(fn($r) => [
    'mode'      => $r['mode'],
    'is_expert' => (bool) $r['is_expert'],
    'date'      => $r['played_date'],
    'target'    => $r['target_name'],
    'attempts'  => (int) $r['attempts'],
], $stmt->fetchAll());

// Première partie parfaite (victoire en 1 essai) par mode × dimension.
$stmt = $pdo->prepare(
    'SELECT gs.mode, gs.is_expert, gs.played_date, gs.target_name
     FROM game_sessions gs
     JOIN (
        SELECT mode, is_expert, MIN(played_date) AS d
        FROM game_sessions WHERE user_id = ? AND result = \'win\' AND attempts = 1
        GROUP BY mode, is_expert
     ) f ON f.mode = gs.mode AND f.is_expert = gs.is_expert AND f.d = gs.played_date
     WHERE gs.user_id = ? AND gs.result = \'win\' AND gs.attempts = 1
     GROUP BY gs.mode, gs.is_expert
     ORDER BY gs.played_date, gs.mode'
);
$stmt->execute([$uid, $uid]);
$firstPerfects = array_map(fn($r) => [
    'mode'      => $r['mode'],
    'is_expert' => (bool) $r['is_expert'],
    'date'      => $r['played_date'],
    'target'    => $r['target_name'],
], $stmt->fetchAll());

// Modes Expert : date de la première partie Expert jouée (la porte a donc été
// franchie ce jour-là ou avant). Un déblocage manuel par l'admin est daté lui.
$stmt = $pdo->prepare(
    'SELECT mode, MIN(played_date) AS first_played
     FROM game_sessions WHERE user_id = ? AND is_expert = 1 GROUP BY mode'
);
$stmt->execute([$uid]);
$expertModes = [];
foreach ($stmt->fetchAll() as $r) {
    $expertModes[$r['mode']] = ['mode' => $r['mode'], 'first_played' => $r['first_played'], 'granted_at' => null];
}
$stmt = $pdo->prepare('SELECT mode, granted_at FROM expert_unlocks_granted WHERE user_id = ?');
$stmt->execute([$uid]);
foreach ($stmt->fetchAll() as $r) {
    $expertModes[$r['mode']] = $expertModes[$r['mode']] ?? ['mode' => $r['mode'], 'first_played' => null, 'granted_at' => null];
    $expertModes[$r['mode']]['granted_at'] = $r['granted_at'];
}

jsonSuccess([
    'user' => [
        'id'          => $uid,
        'pseudo'      => $user['pseudo'],
        'friend_code' => $user['friend_code'],
        'created_at'  => $user['created_at'],
    ],
    'badges'     => $badges,
    'titles'     => $titles,
    'wallpapers' => $wallpapers,
    'friends'    => $friends,
    'challenges' => $challenges,
    'feats'      => [
        'first_game'     => $agg['first_game'] ?? null,
        'total_games'    => (int) ($agg['games'] ?? 0),
        'total_wins'     => (int) ($agg['wins'] ?? 0),
        'days_played'    => (int) ($agg['days'] ?? 0),
        'streak_record'  => (int) ($user['global_streak_record'] ?? 0),
        'first_wins'     => $firstWins,
        'first_perfects' => $firstPerfects,
        'expert_modes'   => array_values($expertModes),
    ],
]);
