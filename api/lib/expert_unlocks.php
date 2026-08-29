<?php
/**
 * api/lib/expert_unlocks.php — Portes d'entrée du Mode Expert.
 *
 * SOURCE UNIQUE des 6 conditions de déblocage. Lue à la fois par :
 *   - api/sessions.php        → refuse d'enregistrer une session Expert non débloquée
 *   - api/user/expert_status.php → renseigne le front (bouton grisé + progression)
 *
 * Ne pas redéclarer ces seuils ailleurs : c'est précisément la duplication qui
 * ferait diverger le gate serveur de ce que le joueur lit à l'écran.
 *
 * Les conditions vivent ici, en PHP, et NON dans la table `badges` : ce sont des
 * conditions d'ACCÈS, pas des récompenses. Les mettre dans `badges` les ferait
 * apparaître dans la collection de badges du joueur (et `category` n'accepte de
 * toute façon que 'achievement'|'streak'|'event'|'secret'|'social').
 * Le seul vrai badge de ce lot, `denial_of_self`, est bien en base.
 */

require_once __DIR__ . '/condition_check.php';

/**
 * Les 6 portes, par mode. `type` est un condition_type de condition_check.php,
 * `value` le seuil à atteindre.
 *
 * @return array<string, array{type: string, value: int}>
 */
function personadle_expert_conditions(): array
{
    return [
        // Gagner vite prouve qu'on connaît le roster sans avoir besoin de la grille.
        'classic'      => ['type' => 'mode_wins_under_attempts',  'value' => 10],
        'silhouette'   => ['type' => 'mode_wins_under_attempts',  'value' => 10],
        // L'Émoji est déjà difficile de base : on demande du volume, pas de la précision.
        'emoji'        => ['type' => 'mode_wins_single_day',      'value' => 10],
        // Modes où la bonne réponse se reconnaît d'un coup d'œil : on exige la régularité.
        'alloutattack' => ['type' => 'mode_consecutive_perfects', 'value' => 15],
        'personae'     => ['type' => 'mode_consecutive_perfects', 'value' => 15],
        'music'        => ['type' => 'mode_consecutive_perfects', 'value' => 15],
    ];
}

/**
 * Le mode a-t-il été accordé manuellement à ce joueur par un admin ?
 *
 * Second chemin de déblocage, en OU avec la condition calculée (table
 * `expert_unlocks_granted`, migration 035). Volontairement séparé du comptage :
 * un déblocage offert ne doit pas gonfler la progression affichée — le joueur
 * verrait « 10/10 » sans avoir joué ces parties.
 */
function personadle_expert_is_granted(PDO $pdo, int $userId, string $mode): bool
{
    $s = $pdo->prepare(
        'SELECT 1 FROM expert_unlocks_granted WHERE user_id = ? AND mode = ? LIMIT 1'
    );
    $s->execute([$userId, $mode]);
    return (bool) $s->fetchColumn();
}

/**
 * Progression du joueur vers la porte d'un mode.
 *
 * Renvoie `current` (avancement réel) en plus de `unlocked`, pour que le front
 * puisse afficher « 7 / 10 » dans l'infobulle du bouton verrouillé. Le libellé
 * lui-même est construit côté client à partir de `condition_type` — le serveur
 * ne renvoie aucun texte, sinon il serait en anglais pour les 6 langues.
 *
 * `granted` distingue les deux chemins : le front peut ainsi ne pas afficher de
 * barre de progression pour un accès offert, où elle n'aurait aucun sens.
 *
 * @return array{unlocked: bool, condition_type: string, required: int, current: int, granted: bool}
 */
function personadle_expert_progress(PDO $pdo, int $userId, string $mode): array
{
    $conditions = personadle_expert_conditions();

    // Mode inconnu (7e mode ajouté sans porte) : ouvert, plutôt que bloqué pour toujours.
    if (!isset($conditions[$mode])) {
        return [
            'unlocked'       => true,
            'condition_type' => 'none',
            'required'       => 0,
            'current'        => 0,
            'granted'        => false,
        ];
    }

    $cond     = $conditions[$mode];
    $required = $cond['value'];

    $current = match ($cond['type']) {
        'mode_wins_under_attempts'  => personadle_count_wins_under_attempts($pdo, $userId, $mode),
        'mode_wins_single_day'      => personadle_count_best_single_day_wins($pdo, $userId, $mode),
        'mode_consecutive_perfects' => personadle_count_consecutive_perfects($pdo, $userId, $mode),
        default                     => 0,
    };

    $earned  = $current >= $required;
    // Court-circuit : on n'interroge la table de dons que si la condition n'est
    // pas déjà remplie — inutile de payer une requête pour un joueur qui a gagné
    // son accès, c'est-à-dire le cas courant.
    $granted = $earned ? false : personadle_expert_is_granted($pdo, $userId, $mode);

    return [
        'unlocked'       => $earned || $granted,
        'condition_type' => $cond['type'],
        'required'       => $required,
        'current'        => $current,
        'granted'        => $granted,
    ];
}

/** Raccourci booléen pour le gate de api/sessions.php. */
function personadle_is_expert_unlocked(PDO $pdo, int $userId, string $mode): bool
{
    return personadle_expert_progress($pdo, $userId, $mode)['unlocked'];
}
