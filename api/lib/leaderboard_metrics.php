<?php
/**
 * api/lib/leaderboard_metrics.php — SOURCE UNIQUE des formules de classement.
 *
 * Pourquoi ce fichier existe : `api/leaderboard/index.php` et
 * `api/cron/leaderboard.php` calculaient les MÊMES expressions SQL chacun de leur
 * côté, avec un commentaire « doit rester identique à » pour tout garde-fou. Une
 * divergence y serait passée inaperçue longtemps : le cron alimente le cache lu
 * par l'endpoint, donc un écart ne se voit qu'en comparant deux périodes entre
 * elles — jamais sur un écran isolé.
 *
 * Les deux appellent désormais ces fonctions.
 */

/**
 * Nombre de parties fictives ajoutées à chaque joueur pour lisser le ratio.
 *
 * C'est le « C » de la moyenne bayésienne (wins + C·m) / (games + C). Concrètement :
 * chaque joueur démarre avec 20 parties imaginaires jouées au taux moyen du site.
 *   - 1 victoire sur 1 partie → tiré vers la moyenne, ne peut pas être premier ;
 *   - 200 parties → les 20 fictives ne pèsent presque plus, le vrai taux ressort.
 *
 * C'est ce qui « pousse à un grand nombre de parties » sans jamais récompenser le
 * volume pour lui-même : jouer plus ne monte le ratio que si on gagne.
 *
 * Choix de la moyenne bayésienne plutôt que la borne de Wilson (ROADMAP.md) :
 * un classement dont personne ne comprend le calcul est perçu comme truqué.
 */
const PERSONADLE_RATIO_PRIOR_GAMES = 20;

/**
 * Taux de victoire moyen du site (le « m » de la formule), entre 0 et 1.
 *
 * Calculé sur les données réelles et non figé en dur : le lissage suit la
 * population de joueurs au lieu de la supposer. Une valeur figée deviendrait
 * fausse dès que la difficulté ou le public change.
 *
 * Repli à 0.5 quand il n'y a pas encore de partie (base neuve) : sans repli, la
 * formule diviserait par zéro et le classement entier disparaîtrait.
 *
 * @param string $mode 'all' ou un mode précis — la moyenne d'un mode difficile
 *                     ne doit pas servir de référence à un mode facile.
 */
function personadle_leaderboard_prior(PDO $pdo, string $mode, bool $expertOnly = false): float
{
    $where  = ['1=1'];
    $params = [];
    if ($mode !== 'all') {
        $where[]  = 'mode = ?';
        $params[] = $mode;
    }
    $where[]  = 'is_expert = ?';
    $params[] = $expertOnly ? 1 : 0;

    $sql = 'SELECT AVG(CASE WHEN result = ? THEN 1 ELSE 0 END) FROM game_sessions WHERE '
        . implode(' AND ', $where);
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge(['win'], $params));

    $avg = $stmt->fetchColumn();
    if ($avg === null || $avg === false) return 0.5;

    $avg = (float) $avg;
    // Un taux à 0 ou 1 rendrait le lissage inopérant dans un sens ou dans l'autre.
    return max(0.01, min(0.99, $avg));
}

/**
 * Fragment SQL du ratio lissé, en POURCENTAGE (0–100, une décimale).
 *
 * Le pourcentage plutôt que la fraction : c'est ce que le front affiche déjà, et
 * `leaderboard_cache.score` est un DECIMAL(8,1) — une fraction y perdrait toute
 * sa précision au stockage.
 *
 * @param string $winsExpr  expression comptant les victoires
 * @param string $gamesExpr expression comptant les parties
 * @param float  $prior     taux moyen du site (personadle_leaderboard_prior)
 */
function personadle_ratio_expr(string $winsExpr, string $gamesExpr, float $prior): string
{
    $c = PERSONADLE_RATIO_PRIOR_GAMES;
    // %F force le point décimal quel que soit la locale — un « , » casserait le SQL.
    $m = sprintf('%.6F', $prior);

    return "ROUND((({$winsExpr}) + {$c} * {$m}) / (({$gamesExpr}) + {$c}) * 100, 1)";
}

/**
 * Expression de score pour une période (day/week/month), agrégée sur game_sessions.
 *
 * Renvoie null pour 'streak' : une série ne se calcule pas avec une simple
 * agrégation, il lui faut sa propre requête (personadle_period_streak_sql).
 * L'ancien code renvoyait le nombre de victoires en guise de série — un affichage
 * faux, assumé « approximation » en commentaire.
 */
function personadle_period_score_expr(string $metric, float $prior): ?string
{
    $wins = "SUM(CASE WHEN gs.result = 'win' THEN 1 ELSE 0 END)";

    return match ($metric) {
        'wins'    => $wins,
        'winrate' => personadle_ratio_expr($wins, 'COUNT(*)', $prior),
        'perfect' => "SUM(CASE WHEN gs.result = 'win' AND gs.attempts = 1 THEN 1 ELSE 0 END)",
        'games'   => 'COUNT(*)',
        'streak'  => null,
        default   => null,
    };
}

/**
 * Expression de score pour 'ever', agrégée sur user_stats.
 *
 * `streak` + mode 'all' lit `users.global_streak_record` et NON `MAX(us.streak_record)` :
 * la streak du joueur est GLOBALE (CLAUDE.md §7 — une seule série, tous modes
 * confondus, calculée sur les jours distincts). Prendre le maximum des records
 * par mode affichait le meilleur d'un seul mode, systématiquement inférieur ou
 * égal à la vraie série, et incohérent avec ce que le joueur lit sur son profil.
 */
function personadle_ever_score_expr(string $metric, string $mode, float $prior): ?string
{
    $all = $mode === 'all';

    return match ($metric) {
        'wins'    => $all ? 'SUM(us.wins)' : 'us.wins',
        'winrate' => personadle_ratio_expr(
            $all ? 'SUM(us.wins)'  : 'us.wins',
            $all ? 'SUM(us.games)' : 'us.games',
            $prior
        ),
        'streak'  => $all ? 'MAX(u.global_streak_record)' : 'us.streak_record',
        'perfect' => $all ? 'SUM(us.perfect_wins)' : 'us.perfect_wins',
        'games'   => $all ? 'SUM(us.games)' : 'us.games',
        default   => null,
    };
}

/**
 * Requête « plus longue série de jours consécutifs » à l'intérieur d'une fenêtre.
 *
 * Méthode des îlots (gaps and islands) : pour chaque joueur, on numérote ses
 * journées jouées puis on soustrait ce numéro à la date. Des jours consécutifs
 * donnent tous la même valeur — donc un groupe — et la taille du plus grand
 * groupe est la plus longue série.
 *
 * Les journées sont DÉDOUBLONNÉES d'abord : depuis la migration 032 un joueur
 * peut enregistrer plusieurs parties le même jour, et sans `DISTINCT` chacune
 * compterait comme une journée de série.
 *
 * Renvoie du SQL avec deux placeholders positionnels attendus dans cet ordre :
 * la date de début de fenêtre, puis à nouveau la date de début (sous-requête du
 * COUNT). L'appelant fournit `$modeFilter` et `$friendsFilter` déjà construits.
 *
 * Nécessite les fonctions fenêtre — MariaDB 10.2+ / MySQL 8.0+. La prod tourne
 * en MariaDB 10.6.
 */
function personadle_period_streak_scores_sql(string $modeFilter, string $friendsFilter, string $dateParam = '?'): string
{
    // `u.` est requis par $friendsFilter, qui filtre sur u.id.
    return "
        SELECT
            jours.user_id,
            MAX(taille)        AS score,
            SUM(nb_parties)    AS total_games
        FROM (
            SELECT
                ilots.user_id,
                COUNT(*)           AS taille,
                SUM(ilots.parties) AS nb_parties
            FROM (
                SELECT
                    d.user_id,
                    d.parties,
                    -- Jours consécutifs → même valeur de `groupe`.
                    DATE_SUB(
                        d.played_date,
                        INTERVAL ROW_NUMBER() OVER (PARTITION BY d.user_id ORDER BY d.played_date) DAY
                    ) AS groupe
                FROM (
                    SELECT gs.user_id, gs.played_date, COUNT(*) AS parties
                    FROM game_sessions gs
                    JOIN users u ON u.id = gs.user_id
                    WHERE gs.played_date >= {$dateParam}
                      AND u.is_deleted = 0
                      AND gs.is_expert = 0
                      {$modeFilter}
                      {$friendsFilter}
                    GROUP BY gs.user_id, gs.played_date
                ) d
            ) ilots
            GROUP BY ilots.user_id, ilots.groupe
        ) jours
        GROUP BY jours.user_id
        HAVING score > 0
    ";
}

/**
 * Même série, mais enrichie du profil affiché par le classement.
 *
 * Séparée du calcul brut ci-dessus pour que le cron (qui ne stocke que
 * `user_id` + `score`) et l'endpoint (qui affiche pseudo, avatar, badges)
 * partagent exactement la même définition de « série ».
 */
function personadle_period_streak_sql(string $modeFilter, string $friendsFilter): string
{
    $core = personadle_period_streak_scores_sql($modeFilter, $friendsFilter);

    return "
        SELECT
            u.id,
            u.pseudo,
            u.friend_code,
            p.avatar_data,
            p.avatar_border_color,
            p.selected_badges,
            streaks.score,
            streaks.total_games
        FROM ({$core}) streaks
        JOIN users u ON u.id = streaks.user_id
        LEFT JOIN profiles p ON p.user_id = u.id
        ORDER BY streaks.score DESC, u.pseudo ASC
    ";
}
