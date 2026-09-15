<?php
/**
 * GET /api/sessions_today?mode=classic&expert=0
 *
 * ⚠️ Fichier plat, pas api/sessions/today.php : un dossier `sessions/` à côté de
 * `sessions.php` déclenche le 301 de mod_dir sur POST /api/sessions (méthode
 * dégradée en GET, 403 sur le listing) — piège documenté dans CLAUDE.md §7.
 *
 * « Comparer nos parties » (2.2) : la PREMIÈRE partie du jour de chacun de mes
 * amis sur ce mode — résultat, nombre d'essais et suite des essais (migration
 * 041) — pour la mettre à côté de la mienne dans la boîte de victoire.
 *
 * Règles :
 *   - il faut avoir soi-même FINI sa première partie du jour sur ce mode
 *     (même is_expert), sinon 403 `play_first` : la liste des essais des amis
 *     révèle la cible, on ne la donne qu'à qui l'a déjà trouvée ou abandonnée ;
 *   - amis acceptés seulement ; ceux qui n'ont pas encore joué sont listés avec
 *     `session: null` (savoir qui reste à jouer donne envie de le défier) ;
 *   - seule la première partie (MIN(id) par ami) compte — les replays, non.
 *
 * Réponse :
 *   { date, mode, is_expert, friends: [ { id, pseudo, avatar_data, avatar_border_color,
 *       session: null | { result, attempts, time_ms, guesses: string[]|null } } ] }
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/validation.php';

$authId = requireAuth();
rateLimit('sessions-today:' . $authId, 60, 15 * 60);

$mode     = strtolower(trim((string) ($_GET['mode'] ?? '')));
$isExpert = ((string) ($_GET['expert'] ?? '0')) === '1';
if (!in_array($mode, PERSONADLE_MODES, true)) jsonError('Invalid mode', 400);

$pdo   = pdo();
$today = (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d');

// ── Anti-spoiler : ma propre première partie du jour doit exister ────────────
$st = $pdo->prepare(
    'SELECT 1 FROM game_sessions
     WHERE user_id = ? AND mode = ? AND played_date = ? AND is_expert = ? LIMIT 1'
);
$st->execute([$authId, $mode, $today, $isExpert ? 1 : 0]);
if (!$st->fetchColumn()) jsonError('play_first', 403);

// ── Amis acceptés ────────────────────────────────────────────────────────────
$st = $pdo->prepare(
    "SELECT u.id, u.pseudo, p.avatar_data, p.avatar_border_color
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted' AND u.is_deleted = 0
     ORDER BY u.pseudo
     LIMIT 100"
);
$st->execute([$authId, $authId, $authId]);
$friends = $st->fetchAll();

$out = [];
if ($friends) {
    $ids = array_map(fn($f) => (int) $f['id'], $friends);
    $in  = implode(',', array_fill(0, count($ids), '?'));

    // Première partie du jour de chaque ami : la ligne de plus petit id.
    $st = $pdo->prepare(
        "SELECT s.user_id, s.result, s.attempts, s.time_ms, s.guesses
         FROM game_sessions s
         JOIN (
             SELECT user_id, MIN(id) AS first_id
             FROM game_sessions
             WHERE user_id IN ($in) AND mode = ? AND played_date = ? AND is_expert = ?
             GROUP BY user_id
         ) f ON f.first_id = s.id"
    );
    $st->execute([...$ids, $mode, $today, $isExpert ? 1 : 0]);
    $byUser = [];
    foreach ($st->fetchAll() as $r) $byUser[(int) $r['user_id']] = $r;

    foreach ($friends as $f) {
        $s = $byUser[(int) $f['id']] ?? null;
        $guesses = null;
        if ($s && $s['guesses'] !== null) {
            $decoded = json_decode((string) $s['guesses'], true);
            $guesses = is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : null;
        }
        $out[] = [
            'id'                  => (int) $f['id'],
            'pseudo'              => $f['pseudo'],
            'avatar_data'         => $f['avatar_data'],
            'avatar_border_color' => $f['avatar_border_color'] ?? '#ffffff',
            'session'             => $s === null ? null : [
                'result'   => $s['result'],
                'attempts' => (int) $s['attempts'],
                'time_ms'  => $s['time_ms'] !== null ? (int) $s['time_ms'] : null,
                'guesses'  => $guesses,
            ],
        ];
    }
}

jsonSuccess([
    'date'      => $today,
    'mode'      => $mode,
    'is_expert' => $isExpert,
    'friends'   => $out,
]);
