<?php
/**
 * api/lib/event_calendar.php — les récompenses « du jour », lues dans le catalogue.
 *
 * Demande Hamza (2026-09-20) : que l'annonce quotidienne Discord dise elle-même quand
 * un badge ou un titre se gagne aujourd'hui (Saint-Valentin, Pâques, Tanabata, Golden
 * Week, Jour Promis, titre Tatsuya…) et donne le code à coller pour les événements à
 * code (Noël, Nouvel An, CNY…) — plus rien à écrire à la main.
 *
 * Deux sources, toutes deux déjà gérées dans l'admin :
 *   - les badges/titres à condition de DATE (played_on_date, played_in_period,
 *     played_on_all_dates, played_on_easter) → « joue aujourd'hui, c'est à toi » ;
 *   - la table event_codes : un code actif dont start_date = aujourd'hui est annoncé
 *     avec le code ; son dernier jour (end_date) est rappelé.
 * Créer un code dans l'admin avec une date de début suffit pour qu'il soit annoncé.
 */

declare(strict_types=1);

require_once __DIR__ . '/condition_check.php'; // personadle_easter_sunday()

/**
 * @return list<array{kind:'badge'|'title', slug:string, name_en:string, name_fr:string,
 *               how:'play'|'code', code:?string, phase:'today'|'first_day'|'last_day'|'ongoing'|'ends_today',
 *               until:?string}>
 */
function personadle_rewards_for_date(PDO $pdo, DateTimeImmutable $day): array
{
    $mmdd = $day->format('m-d');
    $ymd  = $day->format('Y-m-d');
    $year = (int) $day->format('Y');
    $names = personadle_reward_names();
    $out   = [];

    // ── Badges et titres à condition de date ────────────────────────────────
    $sql = "SELECT 'badge' AS kind, slug, name_en, condition_type, condition_mode FROM badges
            WHERE condition_type IN ('played_on_date','played_in_period','played_on_all_dates','played_on_easter')
            UNION ALL
            SELECT 'title', slug, name_en, condition_type, condition_mode FROM titles
            WHERE condition_type IN ('played_on_date','played_in_period','played_on_all_dates','played_on_easter')";
    foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $phase = null;
        $until = null;
        switch ($r['condition_type']) {
            case 'played_on_date':
                if ($r['condition_mode'] === $mmdd) $phase = 'today';
                break;
            case 'played_on_all_dates':
                if (in_array($mmdd, explode(',', (string) $r['condition_mode']), true)) $phase = 'today';
                break;
            case 'played_on_easter':
                $sunday = personadle_easter_sunday($year);
                $monday = (new DateTimeImmutable($sunday))->modify('+1 day')->format('Y-m-d');
                if ($ymd === $sunday) { $phase = 'first_day'; $until = $monday; }
                elseif ($ymd === $monday) { $phase = 'last_day'; }
                break;
            case 'played_in_period':
                [$from, $to] = explode(':', (string) $r['condition_mode']);
                $f = (int) str_replace('-', '', $from); $t = (int) str_replace('-', '', $to); $d = (int) str_replace('-', '', $mmdd);
                $in = $f <= $t ? ($d >= $f && $d <= $t) : ($d >= $f || $d <= $t);
                if ($in) {
                    $phase = $d === $f ? 'first_day' : ($d === $t ? 'last_day' : 'ongoing');
                    $until = $to;
                }
                break;
        }
        if ($phase === null) continue;
        $out[] = [
            'kind'    => $r['kind'],
            'slug'    => $r['slug'],
            'name_en' => $names[$r['kind']][$r['slug']]['en'] ?? (string) $r['name_en'],
            'name_fr' => $names[$r['kind']][$r['slug']]['fr'] ?? (string) $r['name_en'],
            'how'     => 'play',
            'code'    => null,
            'phase'   => $phase,
            'until'   => $until,
        ];
    }

    // ── Codes événement : annoncés le jour de leur début, rappelés le dernier jour ──
    $s = $pdo->prepare(
        'SELECT ec.code, ec.badge_id, ec.start_date, ec.end_date, b.name_en
         FROM event_codes ec JOIN badges b ON b.slug = ec.badge_id
         WHERE ec.is_active = 1 AND ec.is_permanent = 0
           AND (ec.start_date = ? OR ec.end_date = ?)'
    );
    $s->execute([$ymd, $ymd]);
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $c) {
        $out[] = [
            'kind'    => 'badge',
            'slug'    => $c['badge_id'],
            'name_en' => $names['badge'][$c['badge_id']]['en'] ?? (string) $c['name_en'],
            'name_fr' => $names['badge'][$c['badge_id']]['fr'] ?? (string) $c['name_en'],
            'how'     => 'code',
            'code'    => (string) $c['code'],
            'phase'   => $c['start_date'] === $ymd ? 'first_day' : 'ends_today',
            'until'   => $c['end_date'] ? (new DateTimeImmutable($c['end_date']))->format('m-d') : null,
        ];
    }
    return $out;
}

/**
 * Noms EN/FR depuis lang/*.json (les badges n'ont que name_en en base ; les titres ont
 * leurs colonnes mais lang/ reste la référence côté joueur).
 *
 * @return array{badge: array<string, array{en:string, fr:string}>, title: array<string, array{en:string, fr:string}>}
 */
function personadle_reward_names(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = ['badge' => [], 'title' => []];
    foreach (['en', 'fr'] as $lang) {
        $file = __DIR__ . "/../../lang/{$lang}.json";
        if (!is_file($file)) continue;
        $json = json_decode((string) file_get_contents($file), true);
        foreach (($json['badges'] ?? []) as $slug => $b) {
            if (isset($b['name'])) $cache['badge'][$slug][$lang] = (string) $b['name'];
        }
        foreach (($json['titles'] ?? []) as $slug => $t) {
            if (isset($t['name'])) $cache['title'][$slug][$lang] = (string) $t['name'];
        }
    }
    return $cache;
}

/**
 * Le bloc « 🎁 Récompense du jour » de l'annonce Discord (FR puis EN), ou '' s'il n'y a rien.
 *
 * @param list<array<string,mixed>> $rewards sortie de personadle_rewards_for_date()
 */
function personadle_rewards_announcement(array $rewards): string
{
    if ($rewards === []) return '';
    $fr = []; $en = [];
    foreach ($rewards as $r) {
        $what = $r['kind'] === 'title' ? 'le titre' : 'le badge';
        $whatEn = $r['kind'] === 'title' ? 'the title' : 'the badge';
        $nf = '**' . $r['name_fr'] . '**'; $ne = '**' . $r['name_en'] . '**';
        if ($r['how'] === 'code') {
            $code = '`' . $r['code'] . '`';
            if ($r['phase'] === 'first_day') {
                $tail = $r['until'] ? " (jusqu'au " . personadle_fr_date($r['until']) . ')' : '';
                $tailEn = $r['until'] ? ' (until ' . personadle_en_date($r['until']) . ')' : '';
                $fr[] = "🎟️ $what $nf — entre le code $code dans ton profil$tail.";
                $en[] = "🎟️ $whatEn $ne — enter the code $code on your profile$tailEn.";
            } else {
                $fr[] = "⏳ Dernier jour pour $what $nf — code $code.";
                $en[] = "⏳ Last day for $whatEn $ne — code $code.";
            }
            continue;
        }
        switch ($r['phase']) {
            case 'first_day':
                $fr[] = "🎁 $what $nf — une partie d'ici le " . personadle_fr_date($r['until']) . ' suffit.';
                $en[] = "🎁 $whatEn $ne — one game by " . personadle_en_date($r['until']) . ' is enough.';
                break;
            case 'last_day':
                $fr[] = "⏳ Dernier jour pour $what $nf — joue aujourd'hui.";
                $en[] = "⏳ Last day for $whatEn $ne — play today.";
                break;
            case 'ongoing':
                $fr[] = "🎁 $what $nf se gagne encore aujourd'hui (jusqu'au " . personadle_fr_date($r['until']) . ').';
                $en[] = "🎁 $whatEn $ne can still be earned today (until " . personadle_en_date($r['until']) . ').';
                break;
            default:
                $fr[] = "🎁 Aujourd'hui seulement : joue et $what $nf est à toi.";
                $en[] = "🎁 Today only: play and $whatEn $ne is yours.";
        }
    }
    return "🇫🇷 " . implode("\n", $fr) . "\n🇬🇧 " . implode("\n", $en);
}

/** '05-05' → '5 mai' */
function personadle_fr_date(?string $mmdd): string
{
    if (!$mmdd) return '';
    $mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    [$m, $d] = array_map('intval', explode('-', $mmdd));
    return ($d === 1 ? '1er' : (string) $d) . ' ' . ($mois[$m - 1] ?? $mmdd);
}

/** '05-05' → 'May 5' */
function personadle_en_date(?string $mmdd): string
{
    if (!$mmdd) return '';
    $months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    [$m, $d] = array_map('intval', explode('-', $mmdd));
    return ($months[$m - 1] ?? $mmdd) . ' ' . $d;
}
