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
 * condition_type supportés (les compteurs lus dans user_stats le sont AUSSI dans
 * user_stats_expert depuis le 2026-09-19 : une victoire Expert est une victoire —
 * seuls les types qui nomment une dimension s'y limitent) :
 *   wins_total           → SUM(wins) tous modes
 *   mode_wins            → wins dans condition_mode
 *   mode_games           → games (parties, pas victoires) dans condition_mode
 *   games_total          → SUM(games) tous modes
 *   streak_record        → max(record par mode, users.global_streak_record) — la série que le profil affiche
 *   perfect_wins         → SUM(perfect_wins) tous modes
 *   unique_days          → nb de jours uniques joués (COUNT DISTINCT played_date)
 *   giveups_total        → SUM(giveups) tous modes
 *   friends_count        → nb d'amis acceptés
 *   badges_count         → nb de badges débloqués
 *   titles_count         → nb de titres débloqués (une collection en appelle une autre)
 *   played_on_date       → a joué un jour d'anniversaire donné, condition_mode = 'MM-JJ'
 *                          (n'importe quelle année : c'est une date qui revient)
 *   played_in_period     → a joué entre deux dates 'MM-JJ:MM-JJ' (Golden Week), toute année,
 *                          période pouvant enjamber le Nouvel An
 *   played_on_all_dates  → a joué CHACUNE des dates 'MM-JJ,MM-JJ' (Promised Day), toute année
 *   played_on_easter     → a joué un dimanche ou lundi de Pâques, toute année (computus)
 *   social_link_min_rank → au moins un Social Link au rang >= condition_value
 *   all_modes_won        → au moins 1 victoire dans chacun des 6 modes
 *   weekly_clean_modes   → nb de modes où l'utilisateur a joué cette semaine (approx.)
 *   classic_p1_wins      → victoires en mode classic (alias de mode_wins classic) —
 *                          RÉELLEMENT UTILISÉ par le titre `naoya_first_awakening`
 *                          (bdd_mysql.sql), ne pas supprimer sans migrer cette ligne.
 *   emoji_p2_wins        → victoires en mode emoji (alias de mode_wins emoji) —
 *                          RÉELLEMENT UTILISÉ par le titre `maya_always_be_positive`
 *                          (bdd_mysql.sql), ne pas supprimer sans migrer cette ligne.
 *   mode_wins_under_attempts → condition_value victoires dans condition_mode en ≤4 essais chacune
 *                          (porte du Mode Expert Classique/Silhouette)
 *   mode_wins_single_day → condition_value victoires dans condition_mode sur UNE journée — la
 *                          meilleure journée du joueur, pas la journée en cours (porte Expert Émoji)
 *   mode_consecutive_perfects → série EN COURS de condition_value victoires parfaites (1 essai)
 *                          dans condition_mode, comptée en parties et non en jours
 *                          (porte Expert AOA/Personae/Music)
 *   expert_wins_total    → condition_value victoires EN EXPERT, tous modes confondus
 *                          (titre `shadows_converge`). À ne pas confondre avec
 *                          `wins_total`, qui lit user_stats — table que l'Expert
 *                          n'alimente pas.
 *   expert_modes_mastered → condition_value victoires EN EXPERT dans chacun des 6 modes
 *                          (badge `denial_of_self`)
 *   mode_expert_perfect_wins → condition_value victoires EN EXPERT au premier essai dans
 *                          condition_mode (badge `dont_waste_your_breath`)
 *   targets_found        → toutes les cibles d'un ENSEMBLE nommé (condition_mode = clé de
 *                          PERSONADLE_TARGET_SETS) gagnées, lu dans game_sessions —
 *                          badges Starlight Festival / Shujin Outlaws / Absolute
 *                          Authority, titre Go Beyond
 *   same_energy          → un ami de rang Social Link ≥ 5 porte Motoha Arai quand on
 *                          porte Chie, ou l'inverse (badge `same_energy`, accordé aux deux)
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
// PERSONADLE_MODES vient de validation.php : cette lib en dépend (all_modes_won),
// elle doit donc le charger elle-même. Sans ça elle ne marchait que si un autre
// fichier avait déjà inclus validation.php — vrai via bootstrap.php en prod, faux
// quand PHPUnit lance ce seul fichier de tests.
require_once __DIR__ . "/validation.php";

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
        'friends_count', 'badges_count', 'titles_count', 'weekly_clean_modes',
        'mode_wins_under_attempts', 'mode_wins_single_day', 'mode_consecutive_perfects',
        // targets_found et same_energy n'ont PAS de condition_value (ensemble nommé,
        // paire d'avatars) : ils ne doivent pas figurer ici, sinon NULL les refuse.
        'mode_expert_perfect_wins',
        'expert_modes_mastered', 'expert_wins_total',
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

        case 'streak_record': {
            // « Reach a N-day streak » : le joueur lit sa série GLOBALE (users.global_streak_record,
            // celle du profil, tous modes confondus). Ne comparer que le record par mode refusait
            // Raphael à qui a 30 jours de série globale mais 25 dans son meilleur mode.
            $g = $pdo->prepare('SELECT COALESCE(global_streak_record, 0) FROM users WHERE id = ?');
            $g->execute([$userId]);
            $global  = (int) $g->fetchColumn();
            $perMode = personadle_aggregate_user_stat($pdo, $userId, 'streak_record', 'MAX');
            return max($global, $perMode) >= $val;
        }

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

        case 'titles_count': {
            // Une collection en appelle une autre : le titre SEES se gagne en
            // rassemblant des titres, comme Thou Art I se gagne en badges.
            $s = $pdo->prepare('SELECT COUNT(*) FROM user_titles WHERE user_id = ?');
            $s->execute([$userId]);
            return (int) $s->fetchColumn() >= $val;
        }

        case 'played_on_date': {
            // Anniversaire : avoir joué un 24 juin, peu importe l'année.
            // condition_mode porte la date au format 'MM-JJ' (condition_value est un
            // INT, il ne peut pas la porter). Cumulatif comme toutes les autres
            // conditions : une fois la journée jouée, elle reste dans l'historique
            // (CLAUDE.md §7 — un accès gagné ne se reperd jamais).
            if (!is_string($condMode) || !preg_match('/^\d{2}-\d{2}$/', $condMode)) {
                return false;
            }
            // MONTH/DAY en entiers, pas DATE_FORMAT() comparé à une chaîne : sur la MariaDB
            // 11.8 de prod, la chaîne produite et le paramètre lié n'ont pas la même
            // collation → « Illegal mix of collations » → 500 sur GET /api/titles pour
            // TOUT LE MONDE dès que la réconciliation a joué cette condition (2.2.6).
            [$mm, $dd] = array_map('intval', explode('-', $condMode));
            $s = $pdo->prepare(
                'SELECT 1 FROM game_sessions
                 WHERE user_id = ? AND MONTH(played_date) = ? AND DAY(played_date) = ?
                 LIMIT 1'
            );
            $s->execute([$userId, $mm, $dd]);
            return (bool) $s->fetchColumn();
        }

        case 'played_in_period': {
            // Golden Week : avoir joué entre deux dates (MM-JJ:MM-JJ), n'importe quelle année.
            // La période peut enjamber le Nouvel An (12-24:01-02). Entiers uniquement en SQL
            // (pas de chaîne comparée — cf. played_on_date).
            if (!is_string($condMode) || !preg_match('/^\d{2}-\d{2}:\d{2}-\d{2}$/', $condMode)) {
                return false;
            }
            [$from, $to] = explode(':', $condMode);
            $f = (int) str_replace('-', '', $from); // 0429
            $t = (int) str_replace('-', '', $to);   // 0505
            $where = $f <= $t
                ? '(MONTH(played_date) * 100 + DAY(played_date)) BETWEEN ? AND ?'
                : '((MONTH(played_date) * 100 + DAY(played_date)) >= ? OR (MONTH(played_date) * 100 + DAY(played_date)) <= ?)';
            $s = $pdo->prepare("SELECT 1 FROM game_sessions WHERE user_id = ? AND $where LIMIT 1");
            $s->execute([$userId, $f, $t]);
            return (bool) $s->fetchColumn();
        }

        case 'played_on_all_dates': {
            // Promised Day : avoir joué CHACUNE des dates listées (MM-JJ,MM-JJ), n'importe
            // quelle année, pas forcément la même.
            if (!is_string($condMode) || !preg_match('/^\d{2}-\d{2}(,\d{2}-\d{2})*$/', $condMode)) {
                return false;
            }
            $s = $pdo->prepare(
                'SELECT 1 FROM game_sessions WHERE user_id = ? AND MONTH(played_date) = ? AND DAY(played_date) = ? LIMIT 1'
            );
            foreach (explode(',', $condMode) as $d) {
                [$mm, $dd] = array_map('intval', explode('-', $d));
                $s->execute([$userId, $mm, $dd]);
                if (!$s->fetchColumn()) return false;
            }
            return true;
        }

        case 'played_on_easter': {
            // Pâques bouge chaque année : dimanche OU lundi de Pâques (férié en France) de
            // n'importe quelle année où le joueur a joué — calcul de Meeus/Jones/Butcher,
            // aucune extension PHP requise.
            $y = $pdo->prepare('SELECT DISTINCT YEAR(played_date) FROM game_sessions WHERE user_id = ?');
            $y->execute([$userId]);
            $s = $pdo->prepare('SELECT 1 FROM game_sessions WHERE user_id = ? AND played_date IN (?, ?) LIMIT 1');
            foreach ($y->fetchAll(PDO::FETCH_COLUMN) as $year) {
                $sunday = personadle_easter_sunday((int) $year);
                $monday = (new DateTimeImmutable($sunday))->modify('+1 day')->format('Y-m-d');
                $s->execute([$userId, $sunday, $monday]);
                if ($s->fetchColumn()) return true;
            }
            return false;
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
            $modes = PERSONADLE_MODES;
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

        // Les 3 types ci-dessous délèguent à des fonctions de comptage réutilisables :
        // l'écran de déblocage du Mode Expert affiche la PROGRESSION (« 7 / 10 »), pas
        // seulement un booléen — cf. api/lib/expert_unlocks.php.
        case 'mode_wins_under_attempts':
            if (!$condMode) return false;
            return personadle_count_wins_under_attempts($pdo, $userId, $condMode) >= $val;

        case 'mode_wins_single_day':
            if (!$condMode) return false;
            return personadle_count_best_single_day_wins($pdo, $userId, $condMode) >= $val;

        case 'mode_consecutive_perfects':
            if (!$condMode) return false;
            return personadle_count_consecutive_perfects($pdo, $userId, $condMode) >= $val;

        case 'expert_wins_total':
            // Victoires EN EXPERT, tous modes confondus (titre `shadows_converge`).
            // Surtout pas `wins_total` : celui-ci lit `user_stats`, que le Mode
            // Expert n'alimente pas (cf. api/lib/game_session.php) — il compterait
            // donc uniquement les parties normales.
            return personadle_count_expert_wins($pdo, $userId) >= $val;

        case 'mode_expert_perfect_wins':
            // condition_value victoires EN EXPERT au premier essai dans le mode
            // condition_mode (badge Don't Waste Your Breath : Classique Expert ne
            // donne que la citation — gagner du premier coup, c'est n'avoir pas eu
            // besoin d'un mot de plus).
            if (!$condMode) return false;
            return personadle_count_expert_perfect_wins($pdo, $userId, $condMode) >= $val;

        case 'targets_found':
            // condition_mode nomme un ENSEMBLE de cibles à avoir trouvées (gagnées),
            // décrit dans PERSONADLE_TARGET_SETS — vérifié depuis game_sessions,
            // donc pas sur déclaration du client. Badges Starlight Festival, Shujin
            // Outlaws, Absolute Authority ; titre Go Beyond.
            if (!$condMode) return false;
            return personadle_target_set_met($pdo, $userId, $condMode);

        case 'same_energy':
            // Un ami de rang Social Link ≥ 5 porte Motoha Arai quand je porte Chie
            // (ou l'inverse) — voir personadle_same_energy_partners().
            return personadle_same_energy_partners($pdo, $userId) !== [];

        case 'avatar_pack_kotone':
            // Condition composite du pack d'avatars Kotone (migration 054).
            // Voir personadle_kotone_ritual_met() : la part « parties gagnées » est
            // l'ensemble `kotone_ritual`, complétée par deux conditions d'ÉTAT
            // COURANT — titre équipé et bordure rose portée.
            return personadle_kotone_ritual_met($pdo, $userId);

        case 'expert_modes_mastered':
            // condition_value victoires EN EXPERT dans chacun des 6 modes (badge Denial of Self).
            // Pas besoin de vérifier en plus que les 6 gates sont franchis : le serveur
            // (api/sessions.php) refuse d'enregistrer une session Expert tant que le mode
            // n'est pas débloqué, donc une victoire Expert prouve le déblocage.
            return personadle_count_mastered_expert_modes($pdo, $userId, $val) >= 6;

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
 * Liste exhaustive des condition_type reconnus par personadle_verify_condition() (voir
 * son docblock pour le détail de chacun) — y compris 'manual'/'joker_profile', qui sont
 * reconnus mais toujours vrais.
 *
 * Sert aux appelants qui ont besoin d'un fail-closed strict sur les types (ex:
 * wallpapers, revue PR #14) : `empty($condition_type)` seul ne distingue pas "type
 * reconnu mais non structurable" (`manual`) d'une faute de frappe ou d'un type retiré du
 * vocabulaire (ex: l'ancien `social_link_rank_10`) — les deux tombent silencieusement
 * dans le safe-fallback "true" de la fonction ci-dessus si on ne vérifie que la
 * non-vacuité. Comparer explicitement à cette liste ferme ce trou.
 */
function personadle_known_condition_types(): array
{
    return [
        'wins_total', 'mode_wins', 'mode_games', 'games_total', 'streak_record',
        'perfect_wins', 'unique_days', 'giveups_total', 'friends_count', 'badges_count',
        'titles_count', 'played_on_date', 'played_in_period', 'played_on_all_dates', 'played_on_easter',
        'social_link_min_rank', 'all_modes_won', 'weekly_clean_modes',
        'classic_p1_wins', 'emoji_p2_wins', 'joker_profile', 'manual',
        'mode_wins_under_attempts', 'mode_wins_single_day', 'mode_consecutive_perfects',
        'expert_modes_mastered', 'expert_wins_total',
        // Lot du 2026-09-18 (migration 046)
        'mode_expert_perfect_wins', 'targets_found', 'same_energy',
        // Lot du 2026-09-23 (migration 054) — pack d'avatars Kotone
        'avatar_pack_kotone',
    ];
}

/**
 * Vérification FAIL-CLOSED d'une condition de déblocage — le point d'entrée que
 * doivent utiliser tous les endpoints d'unlock (badges, titres, wallpapers).
 *
 * Différence avec personadle_verify_condition() : un `condition_type` absent,
 * vide, mal orthographié ou retiré du vocabulaire tombe ici sur `false`, alors
 * que la fonction générique le laisse passer par son `default: return true`.
 *
 * Ce safe-fallback permissif a sa raison d'être là où il est — il évite qu'un
 * badge ajouté demain, avec un type pas encore implémenté, soit inaccessible à
 * tout le monde. Mais sur le chemin d'un POST /unlock, il a l'effet exactement
 * inverse de celui qu'on veut : une faute de frappe dans une migration ouvre le
 * badge à n'importe quel compte authentifié. `api/wallpapers/index.php` fermait
 * déjà ce trou dans son coin (revue PR #14) ; badges et titles appelaient encore
 * la fonction permissive en direct. Ils appellent désormais tous les trois cette
 * fonction-ci, pour que le comportement soit le même partout et défini une fois.
 */
function personadle_condition_allows_unlock(PDO $pdo, int $userId, ?string $condType, ?string $condMode, ?int $condValue): bool
{
    if ($condType === null || $condType === ''
        || !in_array($condType, personadle_known_condition_types(), true)
    ) {
        return false;
    }

    return personadle_verify_condition($pdo, $userId, $condType, $condMode, $condValue);
}

/**
 * SUM ou MAX d'une colonne numérique sur tous les modes d'un joueur, **normal ET
 * Expert** (user_stats + user_stats_expert). Décision Hamza du 2026-09-19 : une
 * victoire Expert est une victoire — les conditions génériques (wins_total,
 * perfect_wins, mode_wins, streak_record…) comptent les deux dimensions. Avant la
 * 051 l'Expert n'avait pas de compteurs, donc 25 perfects en Expert ne donnaient
 * pas « Je ne suis pas une princesse ». Les conditions qui ne visent qu'une
 * dimension le disent dans leur type (expert_wins_total, mode_wins_under_attempts…).
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
    $s = $pdo->prepare(
        "SELECT COALESCE($fn(v), 0) FROM (
             SELECT $column AS v FROM user_stats        WHERE user_id = ?
             UNION ALL
             SELECT $column AS v FROM user_stats_expert WHERE user_id = ?
         ) AS both_dimensions"
    );
    $s->execute([$userId, $userId]);
    return (int) $s->fetchColumn();
}

/** Valeur d'une colonne numérique pour UN mode précis, normal + Expert additionnés. */
function personadle_user_stat_for_mode(PDO $pdo, int $userId, string $mode, string $column): int
{
    $allowedColumns = ['wins', 'games'];
    if (!in_array($column, $allowedColumns, true)) {
        throw new InvalidArgumentException("Colonne non autorisée: $column");
    }
    $s = $pdo->prepare(
        "SELECT COALESCE(SUM(v), 0) FROM (
             SELECT $column AS v FROM user_stats        WHERE user_id = ? AND mode = ?
             UNION ALL
             SELECT $column AS v FROM user_stats_expert WHERE user_id = ? AND mode = ?
         ) AS both_dimensions"
    );
    $s->execute([$userId, $mode, $userId, $mode]);
    return (int) $s->fetchColumn();
}

// ─────────────────────────────────────────────────────────────────────────────
// Compteurs du déblocage du Mode Expert
//
// Ils lisent `game_sessions` et non `user_stats` : cette dernière n'a qu'une ligne
// par (user_id, mode) et ne distingue ni le nombre d'essais, ni la date, ni Expert
// vs normal — les trois dimensions dont ces conditions ont besoin.
//
// Toutes excluent `is_expert = 1` : la condition mesure la maîtrise du mode NORMAL,
// c'est ce qui ouvre la porte de l'Expert.
// ─────────────────────────────────────────────────────────────────────────────

/** Seuil « victoire rapide » : gagner en 4 essais ou moins (= en moins de 5). */
const PERSONADLE_FAST_WIN_MAX_ATTEMPTS = 4;

/**
 * Nombre de victoires obtenues en <= PERSONADLE_FAST_WIN_MAX_ATTEMPTS essais.
 * Cumulatif sur toute la vie du compte (un déblocage ne se reperd jamais).
 */
function personadle_count_wins_under_attempts(PDO $pdo, int $userId, string $mode): int
{
    $s = $pdo->prepare(
        'SELECT COUNT(*) FROM game_sessions
         WHERE user_id = ? AND mode = ? AND result = ? AND is_expert = 0 AND attempts <= ?'
    );
    $s->execute([$userId, $mode, 'win', PERSONADLE_FAST_WIN_MAX_ATTEMPTS]);
    return (int) $s->fetchColumn();
}

/**
 * MEILLEURE journée du joueur : nombre de victoires du jour le plus prolifique.
 *
 * On regarde le maximum sur TOUTES les journées, pas la journée en cours — sinon
 * le joueur qui remplit la condition aujourd'hui la reperdrait demain à minuit,
 * alors qu'un déblocage doit être définitif.
 */
function personadle_count_best_single_day_wins(PDO $pdo, int $userId, string $mode): int
{
    $s = $pdo->prepare(
        'SELECT COALESCE(MAX(wins_that_day), 0) FROM (
             SELECT COUNT(*) AS wins_that_day
             FROM game_sessions
             WHERE user_id = ? AND mode = ? AND result = ? AND is_expert = 0
             GROUP BY played_date
         ) AS per_day'
    );
    $s->execute([$userId, $mode, 'win']);
    return (int) $s->fetchColumn();
}

/**
 * MEILLEURE série de victoires parfaites (1 seul essai) jamais atteinte.
 *
 * « Consécutif » se compte en parties, pas en jours : les journées sautées ne
 * cassent rien, seule une partie non parfaite (giveup, ou victoire en 2+ essais)
 * interrompt une série.
 *
 * ⚠️ On renvoie le MAXIMUM historique, pas la série en cours — corrigé le
 * 2026-09-01. Cette fonction ne sert qu'aux portes du Mode Expert (AOA, Personae,
 * Musique), et un déblocage doit être **définitif** : c'est le principe déjà
 * appliqué à `personadle_count_best_single_day_wins()` (MAX sur toutes les
 * journées, justement pour qu'on ne reperde pas l'accès à minuit) et à
 * `personadle_count_wins_under_attempts()` (cumulatif à vie).
 *
 * Avec l'ancienne version, qui renvoyait la série EN COURS, un joueur perdait son
 * Mode Expert dès la première partie normale non parfaite jouée après l'avoir
 * débloqué — quasi certain, puisqu'on débloque l'Expert pour continuer à jouer.
 * Pire : s'il était en pleine partie Expert au moment où sa série cassait,
 * `api/sessions.php` refusait sa session en 403 et la partie était perdue.
 *
 * Plus de `LIMIT` : borner le balayage à 200 lignes suffisait pour une série en
 * cours, mais tronquerait un maximum historique situé plus loin dans le passé.
 * La requête reste étroite (deux colonnes, filtrée sur user_id + mode).
 */
function personadle_count_consecutive_perfects(PDO $pdo, int $userId, string $mode): int
{
    $s = $pdo->prepare(
        'SELECT attempts, result FROM game_sessions
         WHERE user_id = ? AND mode = ? AND is_expert = 0
         ORDER BY played_date ASC, id ASC'
    );
    $s->execute([$userId, $mode]);

    $best = 0;
    $run  = 0;
    foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if ((int) $row['attempts'] === 1 && $row['result'] === 'win') {
            $run++;
            if ($run > $best) {
                $best = $run;
            }
        } else {
            $run = 0; // série interrompue — mais le maximum déjà atteint reste acquis
        }
    }
    return $best;
}

/**
 * Total de victoires EN EXPERT, tous modes confondus. Sert au titre
 * `shadows_converge`. Lu depuis `game_sessions` et non `user_stats`, que le Mode
 * Expert n'alimente pas.
 */
function personadle_count_expert_wins(PDO $pdo, int $userId): int
{
    // user_stats_expert (051) plutôt que game_sessions : c'est la table que l'admin
    // corrige — un titre Expert doit suivre ce que l'admin a posé, comme les titres
    // normaux suivent user_stats. Reprise de l'historique faite par la 051.
    $s = $pdo->prepare('SELECT COALESCE(SUM(wins), 0) FROM user_stats_expert WHERE user_id = ?');
    $s->execute([$userId]);
    return (int) $s->fetchColumn();
}

/**
 * Nombre de modes (sur 6) où le joueur a au moins $winsPerMode victoires EN EXPERT.
 * Sert au badge `denial_of_self`.
 */
function personadle_count_mastered_expert_modes(PDO $pdo, int $userId, int $winsPerMode): int
{
    if ($winsPerMode < 1) return 0;
    // Même source que personadle_count_expert_wins() : user_stats_expert, éditable.
    $s = $pdo->prepare('SELECT COUNT(*) FROM user_stats_expert WHERE user_id = ? AND wins >= ?');
    $s->execute([$userId, $winsPerMode]);
    return (int) $s->fetchColumn();
}

/**
 * Victoires EN EXPERT au premier essai dans un mode (badge Don't Waste Your Breath).
 * `attempts` vaut 1 sur une victoire du premier coup : les modes incrémentent
 * AVANT de tester la victoire (cf. personadle_is_perfect, api/lib/streak.php).
 */
function personadle_count_expert_perfect_wins(PDO $pdo, int $userId, string $mode): int
{
    $s = $pdo->prepare(
        'SELECT COUNT(*) FROM game_sessions
         WHERE user_id = ? AND mode = ? AND is_expert = 1 AND result = ? AND attempts = 1'
    );
    $s->execute([$userId, $mode, 'win']);
    return (int) $s->fetchColumn();
}

/**
 * Ensembles de cibles à avoir GAGNÉES pour le type `targets_found`, par clé
 * (= condition_mode). Chaque exigence : [mode, is_expert (null = indifférent),
 * liste de target_name EXACTS tels qu'enregistrés par api/sessions.php,
 * nombre minimum de cibles DISTINCTES de la liste à avoir gagnées].
 *
 * Les noms sont ceux des datasets JS (aoaCharacters.js, characters_clean.js,
 * personaeCharacters.js → `user`, songs.js → `titre`) : le client les écrit tels
 * quels dans `target_name`. Une cible renommée dans un dataset doit l'être ici
 * aussi — tests/php/DatabaseIntegrationTest.php (contre api/data/daily_pools.json) et
 * tests/unlocks_wonder_shujin.test.js (contre les datasets) vérifient qu'elles existent
 * encore côté données.
 *
 * Le miroir client (profile.characterModeMap) donne le retour immédiat ; c'est
 * ICI que l'unlock est tranché.
 */
const PERSONADLE_TARGET_SETS = [
    // Badge Starlight Festival : les trois skins Starlight en All-Out Attack.
    'starlight_trio' => [
        ['alloutattack', null, [
            'Joker Starlight ( Ren Amamiya )',
            'Panther Starlight ( Ann Takamaki )',
            'Mona Starlight ( Morgana )',
        ], 3],
    ],
    // Badge Shujin Outlaws : l'All-Out Attack de Wonder en uniforme Shujin, et les
    // deux élèves de Shujin (Ren, Wonder) reconnus à leur silhouette.
    'shujin_outlaws' => [
        ['alloutattack', null, ['Wonder Shujin ( Nagisa Kamishiro )'], 1],
        ['silhouette',   null, ['Ren Amamiya', 'Nagisa Kamishiro'], 2],
    ],
    // Badge Absolute Authority : les deux présidentes du conseil des élèves,
    // trouvées en Classique.
    'absolute_authority' => [
        ['classic', null, ['Mitsuru Kirijo', 'Makoto Niijima'], 2],
    ],
    // Titre Go Beyond : tout Wonder. Ses cinq All-Out Attack, lui en Classique et
    // en Émoji, sa persona (Jánošík — target_name = le personnage) en Personae
    // normal ET Expert, et toutes les musiques de P5X en Music normal (9) ET en
    // Expert (les 8 qui ont des paroles). Légendaire, et grindable : le filtre
    // d'opus P5X seul + Rejouer suffit à faire tourner les 9 chansons.
    'wonder_go_beyond' => [
        ['alloutattack', null, [
            'Wonder ( Nagisa Kamishiro )',
            'Wonder Chinese New Year ( Nagisa Kamishiro )',
            'Wonder Velvet ( Nagisa Kamishiro )',
            'Wonder Summer ( Nagisa Kamishiro )',
            'Wonder Shujin ( Nagisa Kamishiro )',
        ], 5],
        ['classic',  null, ['Nagisa Kamishiro'], 1],
        ['emoji',    null, ['Nagisa Kamishiro'], 1],
        ['personae', 0,    ['Nagisa Kamishiro'], 1],
        ['personae', 1,    ['Nagisa Kamishiro'], 1],
        ['music', 0, [
            'Ambitions and Visions', 'Arial Of The Soul', 'Fatal Desire', 'Last Strike',
            'Seize the Light', 'Shadow Loop', 'Wake Up Your Hero', 'Wonder Light', 'Show Stealer',
        ], 9],
        ['music', 1, [
            'Ambitions and Visions', 'Fatal Desire', 'Last Strike', 'Seize the Light',
            'Shadow Loop', 'Wake Up Your Hero', 'Wonder Light', 'Show Stealer',
        ], 8],
    ],
    // Pack d'avatars Kotone (migration 054) — la part VÉRIFIABLE DEPUIS LES PARTIES.
    // Les deux conditions d'état courant (titre équipé, bordure rose portée) ne sont
    // pas ici : elles se lisent dans `profiles`, pas dans `game_sessions`, et sont
    // vérifiées par `avatar_pack_kotone` juste après cet ensemble.
    //
    // ⚠️ Les cinq musiques sont FIGÉES nommément, et non calculées comme « tout ce
    // qui porte l'opus P3P ». Hamza prévoit d'ajouter des musiques P5X remakées pour
    // P3 : un ensemble calculé durcirait rétroactivement le pack pour qui ne l'a pas
    // encore débloqué, ce que la règle de monotonie interdit (CLAUDE.md §7).
    //
    // ⚠️ En mode Personae, `target_name` est le PERSONNAGE et non la persona
    // (modePersonae.js enregistre `target.user[0]`). « Kotone Shiomi » couvre donc
    // ses deux personas exclusives — Orpheus ( Female ) et Orpheus Picaro ( Female ).
    // Orpheus Telos et Thanatos, qu'elle partage, s'enregistrent sous « Makoto Yuki »
    // et ne comptent pas : la donnée ne permet pas de viser une persona précise.
    'kotone_ritual' => [
        ['alloutattack', 0, ['Kotone Shiomi'], 1],
        ['alloutattack', 1, ['Kotone Shiomi'], 1],
        ['personae',     0, ['Kotone Shiomi'], 1],
        ['personae',     1, ['Kotone Shiomi'], 1],
        ['silhouette',   0, ['Kotone Shiomi', 'Theodore'], 2],
        ['music', 0, [
            'A Way of Life', 'Danger Zone', 'Soul Phrase', 'Time', 'Wiping All Out',
        ], 5],
        ['music', 1, [
            'A Way of Life', 'Danger Zone', 'Soul Phrase', 'Time', 'Wiping All Out',
        ], 5],
    ],
];

/** Clés d'ensembles connues (pour les tests et la validation d'une migration). */
function personadle_target_set_keys(): array
{
    return array_keys(PERSONADLE_TARGET_SETS);
}

/** Slug du titre à porter pour le pack Kotone. */
const PERSONADLE_KOTONE_TITLE_SLUG = 'kotone_not_a_princess';

/**
 * Bordure d'avatar à porter pour le pack Kotone.
 *
 * C'est la pastille rose de la palette de l'atelier (`BORDER_PRESETS`,
 * profile/profile-page.js) — celle qu'un joueur peut réellement cliquer. Viser
 * une teinte absente de la palette rendrait la condition atteignable seulement
 * par le sélecteur de couleur libre, ce que personne ne devinerait.
 */
const PERSONADLE_KOTONE_BORDER = '#ff6b9d';

/**
 * Le « rituel Kotone » est-il accompli À CET INSTANT ?
 *
 * Deux moitiés, et c'est la seconde qui fait la particularité du pack :
 *
 *   1. l'ensemble `kotone_ritual` — ce qui se lit dans `game_sessions`, donc
 *      cumulatif et définitivement acquis ;
 *   2. deux conditions d'ÉTAT COURANT lues dans `profiles` : porter son titre ET
 *      sa bordure rose, en même temps.
 *
 * La seconde moitié n'est pas monotone en elle-même — déséquiper le titre la rend
 * fausse. Ce qui rend l'ensemble conforme à la règle « un accès gagné ne se
 * reperd jamais » (CLAUDE.md §7), c'est que le déblocage est MATÉRIALISÉ par une
 * ligne dans `user_avatars` que rien ne supprime : une fois le rituel accompli au
 * moment d'une réconciliation, le pack reste acquis quoi que le joueur porte
 * ensuite. Décision Hamza du 2026-09-22, assumée comme un rituel.
 */
function personadle_kotone_ritual_met(PDO $pdo, int $userId): bool
{
    if (!personadle_target_set_met($pdo, $userId, 'kotone_ritual')) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT t.slug AS title_slug, p.avatar_border_color
           FROM profiles p
           LEFT JOIN titles t ON t.id = p.equipped_title_id
          WHERE p.user_id = ?
          LIMIT 1'
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        return false;
    }

    if (($row['title_slug'] ?? '') !== PERSONADLE_KOTONE_TITLE_SLUG) {
        return false;
    }

    // Comparaison en minuscules : la couleur vient du client (pastille ou
    // sélecteur libre) et rien ne garantit sa casse.
    return strtolower(trim((string) ($row['avatar_border_color'] ?? '')))
        === PERSONADLE_KOTONE_BORDER;
}

/**
 * Toutes les exigences d'un ensemble PERSONADLE_TARGET_SETS sont-elles remplies ?
 * Une clé inconnue → false (fail-closed : une faute de frappe dans une migration
 * ne doit pas accorder le badge à tout le monde).
 */
function personadle_target_set_met(PDO $pdo, int $userId, string $setKey): bool
{
    $set = PERSONADLE_TARGET_SETS[$setKey] ?? null;
    if ($set === null) return false;
    foreach ($set as [$mode, $isExpert, $names, $minDistinct]) {
        if (personadle_count_distinct_targets_won($pdo, $userId, $mode, $isExpert, $names) < $minDistinct) {
            return false;
        }
    }
    return true;
}

/**
 * Nombre de cibles DISTINCTES de `$names` gagnées par le joueur dans `$mode`
 * (dimension `$isExpert` si non null). Une partie de défi n'est jamais
 * enregistrée en session (js/gameCore.js) : elle ne compte pas — voulu.
 *
 * @param list<string> $names
 */
function personadle_count_distinct_targets_won(PDO $pdo, int $userId, string $mode, ?int $isExpert, array $names): int
{
    if ($names === []) return 0;
    $ph  = implode(',', array_fill(0, count($names), '?'));
    $sql = "SELECT COUNT(DISTINCT target_name) FROM game_sessions
            WHERE user_id = ? AND mode = ? AND result = 'win' AND target_name IN ($ph)";
    $args = array_merge([$userId, $mode], $names);
    if ($isExpert !== null) {
        $sql .= ' AND is_expert = ?';
        $args[] = $isExpert;
    }
    $s = $pdo->prepare($sql);
    $s->execute($args);
    return (int) $s->fetchColumn();
}

/**
 * Portraits de la galerie qui « portent » Motoha Arai et Chie Satonaka — badge
 * Same Energy. Noms de fichiers EXACTS de img/avatar/ (cf. profile/avatars_data.js) ;
 * miroir client dans profile/badges/badgesData.js (SAME_ENERGY_AVATARS).
 */
const PERSONADLE_SAME_ENERGY_AVATARS = [
    'arai' => ['Arai.png', 'Arai2.png'],
    'chie' => [
        'chie_satonaka_icon.jpg', 'Chie.jpg', 'Chie2.jpg', 'chiesatonaka_revivale.jpg',
        'chie_pq.jpg', 'meme_chie_shut_teddie.jpg',
    ],
];

/**
 * Amis avec qui le joueur forme la paire Same Energy : lien Social ≥ rang 5, et
 * l'un porte Motoha Arai pendant que l'autre porte Chie (dans un sens ou dans
 * l'autre). Renvoie leurs ids — vide si personne. Sert à vérifier la condition
 * (`same_energy`) ET à accorder le badge aux deux d'un coup (api/badges/index.php) :
 * le badge se débloque « en même temps » pour les deux (décision Hamza).
 *
 * @return list<int>
 */
function personadle_same_energy_partners(PDO $pdo, int $userId): array
{
    // « Qui porte-t-il ? » se lit dans avatar_src (portrait galerie d'origine,
    // migration 052) : un portrait recadré n'est plus qu'un PNG base64 dans
    // avatar_data. On ne remonte avatar_data que s'il est lui-même un chemin
    // galerie (profil d'avant la 052 jamais resauvé) — jamais les blobs.
    $stmt = $pdo->prepare(
        "SELECT f.requester_id, f.addressee_id,
                COALESCE(pm.avatar_src, IF(pm.avatar_data LIKE '../img/avatar/%', pm.avatar_data, NULL)) AS mine,
                COALESCE(pf.avatar_src, IF(pf.avatar_data LIKE '../img/avatar/%', pf.avatar_data, NULL)) AS theirs
         FROM friendships f
         JOIN social_links sl
           ON sl.user_a_id = LEAST(f.requester_id, f.addressee_id)
          AND sl.user_b_id = GREATEST(f.requester_id, f.addressee_id)
         LEFT JOIN profiles pm ON pm.user_id = ?
         LEFT JOIN profiles pf ON pf.user_id = IF(f.requester_id = ?, f.addressee_id, f.requester_id)
         WHERE f.status = ? AND (f.requester_id = ? OR f.addressee_id = ?) AND sl.`rank` >= 5"
    );
    $stmt->execute([$userId, $userId, 'accepted', $userId, $userId]);

    $wears = static function (?string $avatar, string $who): bool {
        if (!$avatar) return false;
        foreach (PERSONADLE_SAME_ENERGY_AVATARS[$who] as $file) {
            if (str_ends_with($avatar, '/' . $file)) return true;
        }
        return false;
    };

    $partners = [];
    foreach ($stmt->fetchAll() as $row) {
        $friendId = (int) ($row['requester_id'] == $userId ? $row['addressee_id'] : $row['requester_id']);
        $pair = ($wears($row['mine'], 'arai') && $wears($row['theirs'], 'chie'))
             || ($wears($row['mine'], 'chie') && $wears($row['theirs'], 'arai'));
        if ($pair) $partners[] = $friendId;
    }
    return array_values(array_unique($partners));
}

/**
 * Dimanche de Pâques (calendrier grégorien) — algorithme de Meeus/Jones/Butcher.
 * Sert au badge Pâques, qui doit tomber n'importe quelle année sans code événement.
 */
function personadle_easter_sunday(int $year): string
{
    $a = $year % 19;
    $b = intdiv($year, 100);
    $c = $year % 100;
    $d = intdiv($b, 4);
    $e = $b % 4;
    $f = intdiv($b + 8, 25);
    $g = intdiv($b - $f + 1, 3);
    $h = (19 * $a + $b - $d - $g + 15) % 30;
    $i = intdiv($c, 4);
    $k = $c % 4;
    $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
    $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $month = intdiv($h + $l - 7 * $m + 114, 31);
    $day   = (($h + $l - 7 * $m + 114) % 31) + 1;
    return sprintf('%04d-%02d-%02d', $year, $month, $day);
}
