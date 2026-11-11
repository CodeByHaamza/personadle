<?php

declare(strict_types=1);

require_once __DIR__ . '/condition_check.php';
require_once __DIR__ . '/expert_unlocks.php';

/**
 * api/lib/next_unlocks.php — Les déblocages les plus proches d'un joueur (2.4, lot 11).
 *
 * Le profil montrait ce qu'on a, jamais ce qui est presque là. Un joueur à 8 / 10
 * victoires Classique d'un titre ne le savait pas. Ce panneau liste :
 *  - les badges NON secrets et les titres pas encore obtenus dont la condition est
 *    CHIFFRÉE (un compteur contre un seuil) — via personadle_condition_progress(),
 *    la même source que la décision de déblocage : le panneau ne peut pas annoncer
 *    « 10 / 10 » sur un titre que l'unlock refuserait ;
 *  - les Modes Expert encore verrouillés — via personadle_expert_progress().
 *
 * Exclus : badges secrets (le panneau ne doit pas les dévoiler), conditions non
 * chiffrées (dates, ensembles de cibles, manuelles), et les badges/titres adossés à
 * un code événement (pas de progression : on a le code ou pas).
 */

/**
 * Classe les entrées : la plus avancée d'abord, puis celle à qui il manque le
 * moins. Pure (testée dans NextUnlocksTest.php).
 *
 * @param list<array{current:int, required:int}> $items
 * @return list<array{current:int, required:int}>
 */
function personadle_rank_next_unlocks(array $items, int $limit): array
{
    $items = array_values(array_filter(
        $items,
        static fn (array $i): bool => $i['required'] > 0 && $i['current'] < $i['required']
    ));
    usort($items, static function (array $a, array $b): int {
        $ra = $a['current'] / $a['required'];
        $rb = $b['current'] / $b['required'];
        if ($ra !== $rb) {
            return $rb <=> $ra;
        }
        return ($a['required'] - $a['current']) <=> ($b['required'] - $b['current']);
    });
    return array_slice($items, 0, max(0, $limit));
}

/**
 * @return list<array<string, mixed>>
 */
function personadle_next_unlocks(PDO $pdo, int $userId, string $lang, int $limit = 6): array
{
    $sfxTitle = in_array($lang, ['fr', 'es', 'de', 'it', 'pt'], true) ? $lang : 'en';
    $sfxBadge = in_array($lang, ['fr', 'es', 'de', 'it'], true) ? $lang : 'en';
    $memo     = [];
    $items    = [];

    // État des Modes Expert, lu une fois : il sert aux quêtes Expert (plus bas) ET
    // à écarter les badges/titres qui demandent de jouer en Expert tant que le mode
    // est verrouillé — « 0 / 5 victoires Expert » ne dit rien à qui n'y a pas accès,
    // et la quête qui l'ouvre est déjà dans la liste.
    $expert = [];
    foreach (array_keys(personadle_expert_conditions()) as $mode) {
        $expert[$mode] = personadle_expert_progress($pdo, $userId, $mode);
    }
    $anyExpert = in_array(true, array_column($expert, 'unlocked'), true);
    $needsLockedExpert = static function (array $row) use ($expert, $anyExpert): bool {
        return match ($row['condition_type'] ?? null) {
            'mode_expert_perfect_wins'               => !($expert[$row['condition_mode'] ?? '']['unlocked'] ?? false),
            'expert_wins_total', 'expert_modes_mastered' => !$anyExpert,
            default                                  => false,
        };
    };

    // ── Badges non secrets, pas encore obtenus, sans code ─────────────────────
    $stmt = $pdo->prepare(
        "SELECT b.slug, b.name_{$sfxBadge} AS name, b.image_path, b.rarity, b.condition_en,
                b.condition_type, b.condition_mode, b.condition_value
         FROM badges b
         WHERE b.is_secret = 0
           AND NOT EXISTS (SELECT 1 FROM badges_unlocked bu WHERE bu.user_id = ? AND bu.badge_id = b.slug)
           AND NOT EXISTS (SELECT 1 FROM event_codes ec WHERE ec.badge_id = b.slug)"
    );
    $stmt->execute([$userId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $b) {
        if ($needsLockedExpert($b)) continue;
        $p = personadle_next_unlock_progress($pdo, $userId, $b, $memo);
        if ($p === null) continue;
        $items[] = [
            'kind'        => 'badge',
            'slug'        => $b['slug'],
            // Les noms de badges vivent surtout dans lang/*.json (badges.<slug>.name) :
            // la colonne est souvent vide, le client traduit et retombe sur celle-ci.
            'name'        => $b['name'] ?: null,
            'image'       => $b['image_path'],
            'rarity'      => $b['rarity'],
            'description' => $b['condition_en'],
        ] + $p;
    }

    // ── Titres pas encore obtenus, sans code ─────────────────────────────────
    $stmt = $pdo->prepare(
        "SELECT t.slug, COALESCE(t.name_{$sfxTitle}, t.name_en) AS name, t.image_path, t.rarity,
                COALESCE(t.description_{$sfxTitle}, t.description_en) AS description,
                t.condition_type, t.condition_mode, t.condition_value
         FROM titles t
         WHERE NOT EXISTS (SELECT 1 FROM user_titles ut WHERE ut.user_id = ? AND ut.title_id = t.id)
           AND NOT EXISTS (SELECT 1 FROM event_codes ec WHERE ec.title_slug = t.slug)"
    );
    $stmt->execute([$userId]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $t) {
        if ($needsLockedExpert($t)) continue;
        $p = personadle_next_unlock_progress($pdo, $userId, $t, $memo);
        if ($p === null) continue;
        $items[] = [
            'kind'        => 'title',
            'slug'        => $t['slug'],
            'name'        => $t['name'] ?: $t['slug'],
            'image'       => $t['image_path'] ?: "titles/{$t['slug']}.webp",
            'rarity'      => $t['rarity'],
            'description' => $t['description'],
        ] + $p;
    }

    // ── Modes Expert verrouillés ─────────────────────────────────────────────
    foreach ($expert as $mode => $e) {
        if ($e['unlocked']) continue;
        $items[] = [
            'kind'           => 'expert',
            'slug'           => $mode,
            'name'           => null, // libellé construit côté client (i18n)
            'image'          => null,
            'rarity'         => null,
            'description'    => null,
            'condition_type' => $e['condition_type'],
            'condition_mode' => $mode,
            'current'        => $e['current'],
            'required'       => $e['required'],
        ];
    }

    return personadle_rank_next_unlocks($items, $limit);
}

/**
 * Progression d'une entrée de catalogue, ou null si elle n'a pas sa place dans le
 * panneau (condition non chiffrée ou mal configurée).
 *
 * @param array<string, mixed> $row
 * @param array<string, int|false|null> $memo
 * @return array{condition_type:string, condition_mode:?string, current:int, required:int}|null
 */
function personadle_next_unlock_progress(PDO $pdo, int $userId, array $row, array &$memo): ?array
{
    $type  = $row['condition_type'] ?? null;
    $value = isset($row['condition_value']) ? (int) $row['condition_value'] : null;
    try {
        $p = personadle_condition_progress($pdo, $userId, $type, $row['condition_mode'] ?? null, $value, $memo);
    } catch (Throwable $e) {
        // Même règle que la réconciliation : une condition qui plante est sautée,
        // elle ne doit jamais faire tomber le profil en 500 (CLAUDE.md §7).
        error_log('[PersonaDLE next-unlocks] ' . ($row['slug'] ?? '?') . ': ' . $e->getMessage());
        return null;
    }
    if ($p === null || !$p['valid']) {
        return null;
    }
    return [
        'condition_type' => (string) $type,
        'condition_mode' => $row['condition_mode'] ?? null,
        'current'        => min($p['current'], $p['required']),
        'required'       => $p['required'],
    ];
}
