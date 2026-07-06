<?php
/**
 * api/lib/condition_check.php — Vérification générique de condition de déblocage,
 * partagée par titles/badges/wallpapers (colonnes condition_type/condition_mode/
 * condition_value, toutes structurées de façon identique dans les 3 tables).
 *
 * Extrait de l'ancien verifyTitleCondition() (api/titles/index.php), qui était
 * la seule des 3 tables à avoir des colonnes structurées — badges/wallpapers
 * validaient via un mapping slug→logique en dur (fragile, cf. ROADMAP.md
 * "Conditions badges/wallpapers en colonnes structurées").
 *
 * condition_type supportés :
 *   wins_total           → SUM(wins) tous modes
 *   mode_wins            → wins dans condition_mode
 *   mode_games           → games (parties, pas victoires) dans condition_mode
 *   games_total          → SUM(games) tous modes
 *   streak_record        → MAX(streak_record) tous modes
 *   perfect_wins         → SUM(perfect_wins) tous modes
 *   unique_days          → nb de jours uniques joués (COUNT DISTINCT played_date)
 *   giveups_total        → SUM(giveups) tous modes
 *   friends_count        → nb d'amis acceptés
 *   badges_count         → nb de badges débloqués
 *   social_link_min_rank → au moins un Social Link au rang >= condition_value
 *   all_modes_won        → au moins 1 victoire dans chacun des 6 modes
 *   weekly_clean_modes   → nb de modes où l'utilisateur a joué cette semaine (approx.)
 *   classic_p1_wins      → victoires en mode classic (alias de mode_wins classic) —
 *                          RÉELLEMENT UTILISÉ par le titre `naoya_first_awakening`
 *                          (bdd_mysql.sql), ne pas supprimer sans migrer cette ligne.
 *   emoji_p2_wins        → victoires en mode emoji (alias de mode_wins emoji) —
 *                          RÉELLEMENT UTILISÉ par le titre `maya_always_be_positive`
 *                          (bdd_mysql.sql), ne pas supprimer sans migrer cette ligne.
 *   joker_profile        → condition manuelle — retourne true (vérifié en aval par admin)
 *   manual               → condition manuelle/flag client/redeem — retourne true
 *   NULL ou inconnu      → true (safe fallback)
 *
 * `social_link_rank_10` (rang exactement 10) a été retiré de ce vocabulaire — c'était
 * un prédicat strictement identique à `social_link_min_rank` + condition_value=10, et
 * aucune ligne de seed ne l'utilisait (contrairement à classic_p1_wins/emoji_p2_wins
 * ci-dessus). Si besoin de le réintroduire : condition_type='social_link_min_rank',
 * condition_value=10.
 *
 * @param PDO      $pdo      Instance PDO
 * @param int      $userId   ID de l'utilisateur authentifié
 * @param ?string  $condType Valeur de condition_type (colonne titles/badges/wallpapers)
 * @param ?string  $condMode Valeur de condition_mode ('classic', 'emoji'…) ou null
 * @param ?int     $condValue Valeur numérique de la condition
 * @return bool true si la condition est remplie (ou non structurée/inconnue — safe fallback)
 */
function personadle_verify_condition(PDO $pdo, int $userId, ?string $condType, ?string $condMode, ?int $condValue): bool
{
    // Pas de condition définie ou type inconnu → on laisse passer (safe fallback,
    // ne bloque jamais un titre/badge/wallpaper futur ajouté sans mise à jour ici)
    if ($condType === null || $condType === '') {
        return true;
    }

    // Types qui comparent condition_value à une statistique numérique : un
    // condition_value NULL par erreur de saisie (colonne nullable, rien ne
    // l'empêche) doit refuser l'unlock, pas être traité comme un seuil 0
    // (= toujours vrai). Exclus volontairement : 'social_link_min_rank' a sa
    // propre valeur par défaut documentée (voir plus bas), et
    // all_modes_won/manual/joker_profile n'utilisent pas condition_value.
    $valueRequiredTypes = [
        'wins_total', 'mode_wins', 'classic_p1_wins', 'emoji_p2_wins', 'mode_games',
        'games_total', 'streak_record', 'perfect_wins', 'unique_days', 'giveups_total',
        'friends_count', 'badges_count', 'social_link_min_rank', 'weekly_clean_modes',
    ];
    if (in_array($condType, $valueRequiredTypes, true) && $condValue === null) {
        return false;
    }
    $val = $condValue ?? 0;

    switch ($condType) {

        case 'wins_total':
            return personadle_aggregate_user_stat($pdo, $userId, 'wins', 'SUM') >= $val;

        case 'mode_wins':
        case 'classic_p1_wins':
        case 'emoji_p2_wins': {
            $mode = $condMode;
            if (!$mode) {
                $mode = match ($condType) {
                    'classic_p1_wins' => 'classic',
                    'emoji_p2_wins'   => 'emoji',
                    default           => '',
                };
            }
            if (!$mode) return false; // mode non résolu → condition invalide
            return personadle_user_stat_for_mode($pdo, $userId, $mode, 'wins') >= $val;
        }

        case 'mode_games': {
            // Nombre de PARTIES (games), pas de victoires — ex: wallpaper rise_dungeons
            // ("30 total games in Music mode", peu importe le résultat).
            if (!$condMode) return false;
            return personadle_user_stat_for_mode($pdo, $userId, $condMode, 'games') >= $val;
        }

        case 'games_total':
            return personadle_aggregate_user_stat($pdo, $userId, 'games', 'SUM') >= $val;

        case 'streak_record':
            return personadle_aggregate_user_stat($pdo, $userId, 'streak_record', 'MAX') >= $val;

        case 'perfect_wins':
            return personadle_aggregate_user_stat($pdo, $userId, 'perfect_wins', 'SUM') >= $val;

        case 'giveups_total':
            return personadle_aggregate_user_stat($pdo, $userId, 'giveups', 'SUM') >= $val;

        case 'unique_days': {
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT played_date) FROM game_sessions WHERE user_id = ?'
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'friends_count': {
            $s = $pdo->prepare(
                'SELECT COUNT(*) FROM friendships
                 WHERE (requester_id = ? OR addressee_id = ?) AND status = ?'
            );
            $s->execute([$userId, $userId, 'accepted']);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'badges_count': {
            $s = $pdo->prepare('SELECT COUNT(*) FROM badges_unlocked WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'social_link_min_rank': {
            // Au moins un Social Link au rang >= condition_value (défaut 10 = rang
            // maximum si non précisé, pour rester équivalent à l'ancien
            // 'social_link_rank_10' sans dupliquer la requête — voir docblock).
            $threshold = $condValue ?? 10;
            $s = $pdo->prepare(
                'SELECT COALESCE(MAX(`rank`), 0) FROM social_links
                 WHERE user_a_id = ? OR user_b_id = ?'
            );
            $s->execute([$userId, $userId]);
            return (int) $s->fetchColumn() >= $threshold;
        }

        case 'all_modes_won': {
            // Au moins 1 victoire dans chacun des 6 modes reconnus
            $modes = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT mode) FROM user_stats
                 WHERE user_id = ? AND wins >= 1 AND mode IN (?,?,?,?,?,?)'
            );
            $s->execute(array_merge([$userId], $modes));
            return (int) $s->fetchColumn() >= count($modes);
        }

        case 'weekly_clean_modes': {
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT mode) FROM game_sessions
                 WHERE user_id = ? AND played_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        // Conditions manuelles — flags/narratif client, redeem via code événement,
        // ou vérifiées par un autre endpoint (ex: social-links pour true_confidant,
        // streak-recovery pour reborn_phoenix). Accordées sur déclaration/ailleurs,
        // pas re-vérifiables depuis les tables stats — vérifié et accordées manuellement.
        case 'joker_profile':
        case 'manual':
            return true;

        default:
            // Type de condition inconnu → safe fallback (ne bloque pas les futurs ajouts)
            return true;
    }
}

/**
 * SUM ou MAX d'une colonne numérique de user_stats sur tous les modes d'un joueur.
 * $column est toujours un littéral fixe passé par les appelants de ce fichier
 * (jamais une entrée utilisateur) — la whitelist ci-dessous est une protection en
 * profondeur, pas une nécessité fonctionnelle actuelle.
 */
function personadle_aggregate_user_stat(PDO $pdo, int $userId, string $column, string $fn): int
{
    $allowedColumns = ['wins', 'giveups', 'games', 'perfect_wins', 'streak_record'];
    $allowedFns     = ['SUM', 'MAX'];
    if (!in_array($column, $allowedColumns, true) || !in_array($fn, $allowedFns, true)) {
        throw new InvalidArgumentException("Colonne/fonction non autorisée: $fn($column)");
    }
    $s = $pdo->prepare("SELECT COALESCE($fn($column), 0) FROM user_stats WHERE user_id = ?");
    $s->execute([$userId]);
    return (int) $s->fetchColumn();
}

/** Valeur d'une colonne numérique de user_stats pour UN mode précis (pas d'agrégation). */
function personadle_user_stat_for_mode(PDO $pdo, int $userId, string $mode, string $column): int
{
    $allowedColumns = ['wins', 'games'];
    if (!in_array($column, $allowedColumns, true)) {
        throw new InvalidArgumentException("Colonne non autorisée: $column");
    }
    $s = $pdo->prepare("SELECT COALESCE($column, 0) FROM user_stats WHERE user_id = ? AND mode = ?");
    $s->execute([$userId, $mode]);
    return (int) $s->fetchColumn();
}
