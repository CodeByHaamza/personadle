<?php
/**
 * api/lib/remember_tokens.php — « Se souvenir de moi », un jeton PAR APPAREIL.
 *
 * Table `remember_tokens` (migration 056). Le navigateur garde le jeton brut dans
 * un cookie httpOnly ; la base n'en garde que le hash SHA-256.
 *
 * Pourquoi ce n'est plus une colonne de `users` : un jeton unique par compte était
 * écrasé à chaque connexion et roté à chaque restauration. Un deuxième appareil,
 * ou deux onglets restaurant au même moment, déconnectaient l'autre — en silence,
 * et le joueur jouait alors en invité avec une autre cible du jour (signalement
 * joueur 2026-11).
 *
 * Règles :
 *   - un jeton par connexion « se souvenir de moi », valable 30 jours ;
 *   - rotation seulement au-delà de 24 h, et l'ancien jeton reste valable
 *     2 minutes : deux onglets qui restaurent ensemble ne se cassent plus ;
 *   - se déconnecter révoque le jeton de CET appareil ; changer de mot de passe
 *     les révoque tous ;
 *   - au plus 10 appareils par compte, les plus anciens sautent.
 *
 * Toutes les dates sont calculées par la base (NOW() + INTERVAL ?) : le fuseau de
 * PHP et celui de MariaDB n'ont pas à être d'accord.
 */

const PERSONADLE_REMEMBER_TTL_DAYS          = 30;
const PERSONADLE_REMEMBER_ROTATE_AFTER_HOURS = 24;
const PERSONADLE_REMEMBER_GRACE_SECONDS     = 120;
const PERSONADLE_REMEMBER_MAX_PER_USER      = 10;

/** Hash stocké en base pour un jeton brut. */
function personadle_remember_hash(string $raw): string
{
    return hash('sha256', $raw);
}

/**
 * Crée un jeton pour un nouvel appareil et rend sa valeur brute (à poser dans le
 * cookie). Ne touche à aucun autre appareil du compte, sauf le plafond.
 */
function personadle_remember_issue(PDO $pdo, int $userId): string
{
    $raw = bin2hex(random_bytes(32));
    $pdo->prepare(
        'INSERT INTO remember_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, NOW() + INTERVAL ? DAY)'
    )->execute([$userId, personadle_remember_hash($raw), PERSONADLE_REMEMBER_TTL_DAYS]);

    personadle_remember_prune($pdo, $userId);
    return $raw;
}

/**
 * Jeton valide (non expiré, compte non supprimé) correspondant au cookie, ou null.
 *
 * @return array{token_id: int, user_id: int, age_hours: int}|null
 */
function personadle_remember_lookup(PDO $pdo, string $raw): ?array
{
    // 64 caractères hex attendus : tout le reste est rejeté sans requête.
    if ($raw === '' || strlen($raw) > 128) {
        return null;
    }

    $s = $pdo->prepare(
        'SELECT t.id AS token_id, t.user_id, TIMESTAMPDIFF(HOUR, t.created_at, NOW()) AS age_hours
         FROM remember_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > NOW() AND u.is_deleted = 0
         LIMIT 1'
    );
    $s->execute([personadle_remember_hash($raw)]);
    $row = $s->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }

    return [
        'token_id'  => (int) $row['token_id'],
        'user_id'   => (int) $row['user_id'],
        'age_hours' => (int) $row['age_hours'],
    ];
}

/**
 * Après une restauration réussie : renouvelle le jeton s'il a plus de 24 h et rend
 * le nouveau jeton brut à poser dans le cookie ; sinon null (cookie inchangé).
 *
 * L'ancien jeton n'est pas supprimé mais raccourci à 2 minutes : un second onglet
 * qui le présente dans la foulée est encore reconnu, au lieu d'être déconnecté.
 *
 * @param array{token_id: int, user_id: int, age_hours: int} $token
 */
function personadle_remember_rotate_if_due(PDO $pdo, array $token): ?string
{
    if ($token['age_hours'] < PERSONADLE_REMEMBER_ROTATE_AFTER_HOURS) {
        $pdo->prepare('UPDATE remember_tokens SET last_used_at = NOW() WHERE id = ?')
            ->execute([$token['token_id']]);
        return null;
    }

    $pdo->prepare(
        'UPDATE remember_tokens
         SET last_used_at = NOW(), expires_at = LEAST(expires_at, NOW() + INTERVAL ? SECOND)
         WHERE id = ?'
    )->execute([PERSONADLE_REMEMBER_GRACE_SECONDS, $token['token_id']]);

    return personadle_remember_issue($pdo, $token['user_id']);
}

/** Déconnexion de CET appareil : seul son jeton disparaît. */
function personadle_remember_revoke(PDO $pdo, string $raw): void
{
    if ($raw === '' || strlen($raw) > 128) {
        return;
    }
    $pdo->prepare('DELETE FROM remember_tokens WHERE token_hash = ?')
        ->execute([personadle_remember_hash($raw)]);
}

/** Tous les appareils du compte (changement de mot de passe). */
function personadle_remember_revoke_all(PDO $pdo, int $userId): void
{
    $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ?')->execute([$userId]);
}

/** Retire les jetons expirés du compte, puis garde les 10 plus récents. */
function personadle_remember_prune(PDO $pdo, int $userId): void
{
    $pdo->prepare('DELETE FROM remember_tokens WHERE user_id = ? AND expires_at <= NOW()')
        ->execute([$userId]);

    $s = $pdo->prepare('SELECT id FROM remember_tokens WHERE user_id = ? ORDER BY id DESC');
    $s->execute([$userId]);
    $surplus = array_slice($s->fetchAll(PDO::FETCH_COLUMN), PERSONADLE_REMEMBER_MAX_PER_USER);
    if ($surplus === []) {
        return;
    }

    $marks = implode(',', array_fill(0, count($surplus), '?'));
    $pdo->prepare("DELETE FROM remember_tokens WHERE id IN ($marks)")
        ->execute(array_map('intval', $surplus));
}
