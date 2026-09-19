<?php
/**
 * api/lib/unlock_reconcile.php — le serveur accorde lui-même ce qui est dû.
 *
 * Jusqu'ici le modèle était « le client tente, le serveur tranche » : un titre ou un
 * badge n'était accordé que si le client appelait POST /unlock, et le client ne le
 * faisait que quand SA copie de la condition disait oui. Or plusieurs types n'ont
 * jamais eu d'évaluation côté client (perfect_wins, titles_count,
 * social_link_min_rank, expert_wins_total — ce dernier renvoyait `false` exprès).
 * Résultat, vu en prod le 2026-09-19 : Colonel-Maskou, 363 perfects, 135 victoires
 * Expert, 13 titres, rang 10 — et ni Kotone, ni Shadows Converge, ni SEES, ni Same
 * Soul. Personne ne frappait à la porte.
 *
 * Ici, à chaque lecture de la liste (GET /api/titles, GET /api/badges — donc à chaque
 * chargement du profil), on parcourt ce que le joueur n'a pas encore et on accorde
 * tout ce dont la condition est remplie, avec la MÊME porte fail-closed que les
 * POST /unlock (personadle_condition_allows_unlock). Le client n'a plus besoin de
 * connaître les conditions : il peut continuer à tenter pour le retour immédiat,
 * mais ce n'est plus lui qui décide de ce qui existe.
 *
 * Hors périmètre, volontairement : `manual` et `joker_profile` (conditions
 * déclaratives — drapeau client, code événement, endpoint dédié) — la fonction
 * générique les laisse passer, les accorder ici les donnerait à tout le monde.
 */

declare(strict_types=1);

require_once __DIR__ . '/condition_check.php';

/** Types qu'on n'accorde JAMAIS d'office : ils se gagnent par une déclaration ailleurs. */
const PERSONADLE_DECLARATIVE_CONDITION_TYPES = ['manual', 'joker_profile'];

/**
 * Accorde au joueur les titres dont la condition est remplie et qu'il n'a pas.
 *
 * @return list<string> slugs accordés à cet appel
 */
function personadle_reconcile_titles(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT t.id, t.slug, t.condition_type, t.condition_mode, t.condition_value
         FROM titles t
         WHERE t.condition_type IS NOT NULL AND t.condition_type <> \'\'
           AND NOT EXISTS (SELECT 1 FROM user_titles ut WHERE ut.user_id = ? AND ut.title_id = t.id)'
    );
    $stmt->execute([$userId]);
    $grant   = $pdo->prepare('INSERT IGNORE INTO user_titles (user_id, title_id) VALUES (?, ?)');
    $granted = [];
    foreach ($stmt->fetchAll() as $t) {
        if (in_array($t['condition_type'], PERSONADLE_DECLARATIVE_CONDITION_TYPES, true)) {
            continue;
        }
        if (!personadle_condition_allows_unlock(
            $pdo, $userId, $t['condition_type'], $t['condition_mode'] ?? null,
            isset($t['condition_value']) ? (int) $t['condition_value'] : null
        )) {
            continue;
        }
        $grant->execute([$userId, (int) $t['id']]);
        if ($grant->rowCount() > 0) {
            $granted[] = (string) $t['slug'];
        }
    }
    return $granted;
}

/**
 * Même chose pour les badges. `same_energy` est accordé aux deux partenaires d'un
 * coup, comme le fait POST /api/badges/unlock (décision Hamza : « en même temps »).
 *
 * @return list<string> slugs accordés à cet appel
 */
function personadle_reconcile_badges(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare(
        'SELECT b.slug, b.condition_type, b.condition_mode, b.condition_value
         FROM badges b
         WHERE b.condition_type IS NOT NULL AND b.condition_type <> \'\'
           AND NOT EXISTS (SELECT 1 FROM badges_unlocked bu WHERE bu.user_id = ? AND bu.badge_id = b.slug)'
    );
    $stmt->execute([$userId]);
    $grant   = $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)');
    $granted = [];
    foreach ($stmt->fetchAll() as $b) {
        if (in_array($b['condition_type'], PERSONADLE_DECLARATIVE_CONDITION_TYPES, true)) {
            continue;
        }
        if (!personadle_condition_allows_unlock(
            $pdo, $userId, $b['condition_type'], $b['condition_mode'] ?? null,
            isset($b['condition_value']) ? (int) $b['condition_value'] : null
        )) {
            continue;
        }
        $grant->execute([$userId, (string) $b['slug']]);
        if ($grant->rowCount() > 0) {
            $granted[] = (string) $b['slug'];
        }
        if ($b['condition_type'] === 'same_energy') {
            foreach (personadle_same_energy_partners($pdo, $userId) as $partnerId) {
                $grant->execute([$partnerId, (string) $b['slug']]);
            }
        }
    }
    return $granted;
}
