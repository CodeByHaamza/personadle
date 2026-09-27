<?php
/**
 * api/lib/weekly_podium.php — le top 3 de la semaine, pour le cron Discord
 * (api/cron/discord_weekly.php). Séparé du cron pour être testable : le cron
 * exige CRON_SECRET, absent en local et en CI.
 */

declare(strict_types=1);

require_once __DIR__ . '/discord_webhook.php';

/**
 * Podium d'une dimension (normal ou Expert) : les 3 meilleurs par victoires
 * depuis `$from` (Y-m-d, lundi de la semaine — même fenêtre que period=week du
 * classement). Égalité → le moins de parties d'abord (plus efficace), puis
 * pseudo. Comptes supprimés exclus. Le littéral is_expert vient d'un bool,
 * jamais d'une entrée externe.
 *
 * @return list<array{pseudo:string, wins:int, games:int, avatar:?string}>
 */
function personadle_weekly_podium(PDO $pdo, string $from, bool $expert): array
{
    // Le profil est en LEFT JOIN : un compte tout neuf n'en a pas encore, et
    // doit rester classable — il apparaîtra simplement sans portrait.
    $stmt = $pdo->prepare(
        "SELECT u.pseudo,
                SUM(gs.result = 'win') AS wins,
                COUNT(*)               AS games,
                pr.avatar_src          AS av_src,
                pr.avatar_data         AS av_data
         FROM game_sessions gs
         JOIN users u ON u.id = gs.user_id
         LEFT JOIN profiles pr ON pr.user_id = u.id
         WHERE gs.played_date >= ?
           AND gs.is_expert = " . ($expert ? 1 : 0) . "
           AND u.is_deleted = 0
         GROUP BY u.id, u.pseudo, pr.avatar_src, pr.avatar_data
         HAVING wins > 0
         ORDER BY wins DESC, games ASC, u.pseudo ASC
         LIMIT 3"
    );
    $stmt->execute([$from]);
    return array_map(static fn(array $r): array => [
        'pseudo' => (string) $r['pseudo'],
        'wins'   => (int) $r['wins'],
        'games'  => (int) $r['games'],
        'avatar' => personadle_weekly_avatar_url($r['av_src'] ?? null, $r['av_data'] ?? null),
    ], $stmt->fetchAll());
}

/**
 * Lignes 🥇🥈🥉 d'un podium, prêtes pour un embed Discord (pseudos échappés).
 *
 * @param list<array{pseudo:string, wins:int, games:int}> $podium
 */
function personadle_weekly_lines(array $podium): string
{
    $medals = ['🥇', '🥈', '🥉'];
    $lines  = [];
    foreach (array_slice($podium, 0, 3) as $i => $p) {
        $lines[] = sprintf(
            '%s **%s** — %d victoire%s · %d partie%s',
            $medals[$i],
            personadle_discord_escape($p['pseudo']),
            $p['wins'], $p['wins'] > 1 ? 's' : '',
            $p['games'], $p['games'] > 1 ? 's' : ''
        );
    }
    return implode("\n", $lines);
}

/**
 * URL publique du portrait d'un joueur, ou null s'il n'y en a pas d'affichable.
 *
 * ── Pourquoi ce n'est pas toujours possible ─────────────────────────────────
 * Un portrait recadré est stocké en **base64** dans `profiles.avatar_data`
 * (`data:image/png;base64,…`). Discord, lui, va CHERCHER l'image à une adresse :
 * il ne sait rien faire d'une data-URL. Seuls les portraits choisis dans la
 * galerie sans recadrage laissent un chemin exploitable — dans `avatar_src`
 * (colonne ajoutée par la 052) ou, pour les plus anciens, directement dans
 * `avatar_data`.
 *
 * Mesuré en production le 2026-09-26 : **43 profils sur 328** ont une adresse
 * utilisable. Le portrait est donc un bonus, jamais la structure du message —
 * un podium doit rester lisible quand les trois joueurs n'en ont aucun.
 *
 * @param string|null $src  profiles.avatar_src
 * @param string|null $data profiles.avatar_data
 */
function personadle_weekly_avatar_url(?string $src, ?string $data): ?string
{
    foreach ([$src, $data] as $candidat) {
        $c = trim((string) $candidat);
        if ($c === '' || str_starts_with($c, 'data:')) continue;

        // Les chemins sont relatifs à `profile/` (« ../img/avatar/X.webp ») :
        // on les ramène à la racine du site.
        $c = preg_replace('#^\.\./#', '', $c);
        $c = ltrim($c, '/');

        // Liste blanche stricte : ces valeurs viennent de la base, donc d'une
        // saisie utilisateur passée par l'API. Une chaîne fantaisiste ne doit
        // pas devenir une URL qu'on demande à Discord d'aller chercher.
        if (!preg_match('#^img/avatar/[A-Za-z0-9_\-.]+\.(?:gif|png|jpe?g|webp|avif)$#i', $c)) continue;

        return 'https://www.personadle.net/' . $c;
    }
    return null;
}

/**
 * Les trois amitiés les plus fortes du site, par XP.
 *
 * Même tri que le classement public (api/leaderboard/index.php, vue `bonds`) : l'XP
 * et non le rang, qui plafonne à 10 et donnerait des dizaines d'ex æquo. Un
 * compte supprimé fait disparaître le lien — il n'a plus deux côtés.
 *
 * @return list<array{a:string, b:string, xp:int, rank:int, a_avatar:?string, b_avatar:?string}>
 */
function personadle_weekly_bonds(PDO $pdo): array
{
    $stmt = $pdo->query(
        "SELECT sl.xp, sl.`rank`,
                ua.pseudo AS a_pseudo, ub.pseudo AS b_pseudo,
                pa.avatar_src AS a_src, pa.avatar_data AS a_data,
                pb.avatar_src AS b_src, pb.avatar_data AS b_data
         FROM social_links sl
         JOIN users ua ON ua.id = sl.user_a_id AND ua.is_deleted = 0
         JOIN users ub ON ub.id = sl.user_b_id AND ub.is_deleted = 0
         LEFT JOIN profiles pa ON pa.user_id = sl.user_a_id
         LEFT JOIN profiles pb ON pb.user_id = sl.user_b_id
         WHERE sl.xp > 0
         ORDER BY sl.xp DESC, sl.id ASC
         LIMIT 3"
    );
    return array_map(static fn(array $r): array => [
        'a'        => (string) $r['a_pseudo'],
        'b'        => (string) $r['b_pseudo'],
        'xp'       => (int) $r['xp'],
        'rank'     => (int) $r['rank'],
        'a_avatar' => personadle_weekly_avatar_url($r['a_src'] ?? null, $r['a_data'] ?? null),
        'b_avatar' => personadle_weekly_avatar_url($r['b_src'] ?? null, $r['b_data'] ?? null),
    ], $stmt->fetchAll());
}

/**
 * Lignes 🥇🥈🥉 d'un podium d'amitiés.
 *
 * @param list<array{a:string, b:string, xp:int, rank:int}> $bonds
 */
function personadle_weekly_bond_lines(array $bonds): string
{
    $medals = ['🥇', '🥈', '🥉'];
    $lines  = [];
    foreach (array_slice($bonds, 0, 3) as $i => $b) {
        $lines[] = sprintf(
            '%s **%s** 💞 **%s** — rang %d · %s XP',
            $medals[$i],
            personadle_discord_escape($b['a']),
            personadle_discord_escape($b['b']),
            $b['rank'],
            number_format($b['xp'], 0, ',', ' ')
        );
    }
    return implode("\n", $lines);
}

/**
 * Le mot d'accueil de Margaret, qui change chaque semaine.
 *
 * ⚠️ Le nombre de phrases ne doit pas diviser 52 sans reste — sinon la même
 * phrase retombe sur la même semaine chaque année. 7 convient : 52 = 7×7 + 3,
 * donc la rotation dérive d'une année sur l'autre. (Le quotidien porte la même
 * contrainte pour ses voix, pour la même raison.)
 *
 * @param int $semaine numéro de semaine ISO
 * @return array{fr:string, en:string}
 */
function personadle_weekly_intro(int $semaine): array
{
    $phrases = [
        ['fr' => "Le registre de la semaine est clos. Voici ceux dont les noms y figurent en tête.",
         'en' => "The week's record is closed. These are the names written at the top."],
        ['fr' => "Une semaine de plus consignée. Certains y reviennent souvent — je le remarque.",
         'en' => "Another week set down. Some names return often — I do notice."],
        ['fr' => "J'ai relu les pages de cette semaine. Trois d'entre elles méritaient d'être lues à voix haute.",
         'en' => "I have reread this week's pages. Three of them deserved to be read aloud."],
        ['fr' => "Les contrats se mesurent à ce qu'on y met. Cette semaine, voici ce qui a été mis.",
         'en' => "A contract is measured by what one puts into it. Here is what was put in this week."],
        ['fr' => "Le temps passe, les registres restent. Voici ce que celui-ci retiendra de la semaine.",
         'en' => "Time passes; the records remain. Here is what this one will keep of the week."],
        ['fr' => "Ma sœur tient les clés, mon frère tient la porte. Moi, je tiens les comptes.",
         'en' => "My sister holds the keys, my brother holds the door. I hold the accounts."],
        ['fr' => "Rien ici n'est écrit à l'avance. Ces trois noms, vous les avez inscrits vous-mêmes.",
         'en' => "Nothing here is written in advance. You inscribed these three names yourselves."],
    ];
    return $phrases[$semaine % count($phrases)];
}
