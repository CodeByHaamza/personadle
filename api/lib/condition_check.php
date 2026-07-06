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
 *   social_link_rank_10  → au moins un Social Link au rang exactement 10
 *   social_link_min_rank → au moins un Social Link au rang >= condition_value
 *   all_modes_won        → au moins 1 victoire dans chacun des 6 modes
 *   weekly_clean_modes   → nb de modes où l'utilisateur a joué cette semaine (approx.)
 *   classic_p1_wins      → victoires en mode classic (alias de mode_wins classic)
 *   emoji_p2_wins        → victoires en mode emoji (alias de mode_wins emoji)
 *   joker_profile        → condition manuelle — retourne true (vérifié en aval par admin)
 *   manual               → condition manuelle/flag client/redeem — retourne true
 *   NULL ou inconnu      → true (safe fallback)
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

    $val = $condValue ?? 0;

    switch ($condType) {

        case 'wins_total': {
            $s = $pdo->prepare('SELECT COALESCE(SUM(wins), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

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
            $s = $pdo->prepare('SELECT COALESCE(wins, 0) FROM user_stats WHERE user_id = ? AND mode = ?');
            $s->execute([$userId, $mode]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'mode_games': {
            // Nombre de PARTIES (games), pas de victoires — ex: wallpaper rise_dungeons
            // ("30 total games in Music mode", peu importe le résultat).
            if (!$condMode) return false;
            $s = $pdo->prepare('SELECT COALESCE(games, 0) FROM user_stats WHERE user_id = ? AND mode = ?');
            $s->execute([$userId, $condMode]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'games_total': {
            // Nombre de parties tous modes confondus — ex: wallpaper mitsuo_dungeons.
            $s = $pdo->prepare('SELECT COALESCE(SUM(games), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'streak_record': {
            $s = $pdo->prepare('SELECT COALESCE(MAX(streak_record), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'perfect_wins': {
            $s = $pdo->prepare('SELECT COALESCE(SUM(perfect_wins), 0) FROM user_stats WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'unique_days': {
            $s = $pdo->prepare(
                'SELECT COUNT(DISTINCT played_date) FROM game_sessions WHERE user_id = ?'
            );
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'giveups_total': {
            $s = $pdo->prepare('SELECT COALESCE(SUM(giveups), 0) FROM user_stats WHERE user_id = ?');
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

        case 'social_link_rank_10': {
            // Au moins un Social Link (avec n'importe quel ami) au rang 10 pile.
            $s = $pdo->prepare(
                'SELECT COUNT(*) FROM social_links
                 WHERE (user_a_id = ? OR user_b_id = ?) AND `rank` = 10'
            );
            $s->execute([$userId, $userId]);
            return (int) $s->fetchColumn() >= 1;
        }

        case 'social_link_min_rank': {
            // Généralisation : au moins un Social Link au rang >= condition_value
            // (ex: wallpaper dark_shopping_district, rang >= 5).
            $s = $pdo->prepare(
                'SELECT COALESCE(MAX(`rank`), 0) FROM social_links
                 WHERE user_a_id = ? OR user_b_id = ?'
            );
            $s->execute([$userId, $userId]);
            return (int) $s->fetchColumn() >= $val;
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
