<?php

declare(strict_types=1);

/**
 * api/lib/event_codes.php — Échange d'un code événement.
 *
 * Extrait de api/badges/index.php (2.4, lot 9) quand un code a pu accorder un
 * TITRE en plus d'un badge (migration 057) : la logique devenait trop longue pour
 * rester dans l'endpoint, et elle méritait des tests sur une vraie base.
 *
 * Un code porte un badge (`badge_id`), un titre (`title_slug`), ou les deux.
 * Le titre est ce qui coûte le moins à créer pour un événement Discord : un nom
 * et une bannière, pas d'illustration de badge.
 *
 * ⚠️ Un code « exclusif au Discord » n'a de valeur que s'il n'est écrit nulle part
 * ailleurs. Il se crée dans l'admin (api/admin/event_codes.php), donc dans la base
 * de prod, et JAMAIS dans un fichier suivi : le dépôt est public.
 * tests/event_codes_not_in_repo.test.js refuse tout code dans une migration à
 * partir de la 057.
 */

/**
 * Ce badge ne s'obtient-il que par un code ? (garde de POST /api/badges/unlock)
 */
function personadle_badge_is_code_gated(PDO $pdo, string $badgeSlug): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM event_codes WHERE badge_id = ? LIMIT 1');
    $stmt->execute([$badgeSlug]);
    return (bool) $stmt->fetchColumn();
}

/**
 * Ce titre ne s'obtient-il que par un code ? (garde de POST /api/titles/unlock)
 *
 * Même trou que les badges avant leur garde : un titre de code porte
 * `condition_type = 'manual'`, que la vérification de condition laisse passer.
 * Sans ce garde, POST /api/titles/unlock avec le slug suffirait — et le slug est
 * public (GET /api/titles liste tout le catalogue).
 */
function personadle_title_is_code_gated(PDO $pdo, string $titleSlug): bool
{
    $stmt = $pdo->prepare('SELECT 1 FROM event_codes WHERE title_slug = ? LIMIT 1');
    $stmt->execute([$titleSlug]);
    return (bool) $stmt->fetchColumn();
}

/**
 * Échange un code pour un joueur.
 *
 * Ne lève rien : renvoie un statut HTTP et, en cas de succès, ce qui a été accordé.
 * La redemption n'est jamais consommée si la récompense est introuvable (code créé
 * avant un correctif de slug, ou modifié en SQL direct) : sinon le joueur
 * perdrait sa chance une fois le catalogue corrigé.
 *
 * @param string $today jour de Paris, AAAA-MM-JJ (fenêtre des codes datés)
 * @return array{status:int, error?:string, code?:string, badge_id?:?string, title_slug?:?string}
 */
function personadle_redeem_event_code(PDO $pdo, int $userId, string $rawCode, string $today): array
{
    $code = strtoupper(trim($rawCode));
    if ($code === '' || strlen($code) > 50) {
        return ['status' => 400, 'error' => 'Invalid code'];
    }

    $stmt = $pdo->prepare(
        'SELECT code, badge_id, title_slug, is_permanent, start_date, end_date
         FROM event_codes
         WHERE code = ? AND is_active = 1
         LIMIT 1'
    );
    $stmt->execute([$code]);
    $ec = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$ec) {
        return ['status' => 404, 'error' => 'Invalid or expired code'];
    }

    if (!(int) $ec['is_permanent']) {
        $start = (string) ($ec['start_date'] ?? '');
        $end   = (string) ($ec['end_date'] ?? '');
        if ($start === '' || $end === '' || $today < $start || $today > $end) {
            return ['status' => 410, 'error' => 'Code not active yet or already expired'];
        }
    }

    $stmt = $pdo->prepare('SELECT 1 FROM event_codes_redeemed WHERE user_id = ? AND code = ? LIMIT 1');
    $stmt->execute([$userId, $code]);
    if ($stmt->fetchColumn()) {
        return ['status' => 409, 'error' => 'Code already redeemed'];
    }

    $badgeId   = ($ec['badge_id'] ?? '') !== '' ? (string) $ec['badge_id'] : null;
    $titleSlug = ($ec['title_slug'] ?? '') !== '' ? (string) $ec['title_slug'] : null;
    $misconfigured = ['status' => 500, 'error' => 'Code mal configuré — contacte un admin'];

    if ($badgeId === null && $titleSlug === null) {
        error_log("[PersonaDLE event code] code {$code} grants nothing");
        return $misconfigured;
    }
    if ($badgeId !== null) {
        $check = $pdo->prepare('SELECT 1 FROM badges WHERE slug = ? LIMIT 1');
        $check->execute([$badgeId]);
        if (!$check->fetchColumn()) {
            error_log("[PersonaDLE event code] code {$code} references unknown badge_id {$badgeId}");
            return $misconfigured;
        }
    }
    $titleId = null;
    if ($titleSlug !== null) {
        $check = $pdo->prepare('SELECT id FROM titles WHERE slug = ? LIMIT 1');
        $check->execute([$titleSlug]);
        $titleId = $check->fetchColumn();
        if ($titleId === false) {
            error_log("[PersonaDLE event code] code {$code} references unknown title_slug {$titleSlug}");
            return $misconfigured;
        }
    }

    // Transaction à soi seulement si l'appelant n'en a pas ouverte une (les tests
    // tournent dans une transaction annulée en tearDown).
    $own = !$pdo->inTransaction();
    try {
        if ($own) {
            $pdo->beginTransaction();
        }
        $pdo->prepare('INSERT INTO event_codes_redeemed (user_id, code) VALUES (?, ?)')
            ->execute([$userId, $code]);
        if ($badgeId !== null) {
            $pdo->prepare('INSERT IGNORE INTO badges_unlocked (user_id, badge_id) VALUES (?, ?)')
                ->execute([$userId, $badgeId]);
        }
        if ($titleId !== null) {
            $pdo->prepare('INSERT IGNORE INTO user_titles (user_id, title_id) VALUES (?, ?)')
                ->execute([$userId, (int) $titleId]);
        }
        if ($own) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($own) {
            try {
                $pdo->rollBack();
            } catch (Throwable) {
                // Plus de transaction ouverte (échec du commit lui-même) : rien à annuler.
            }
        }
        error_log('[PersonaDLE event code redeem] ' . $e->getMessage());
        return ['status' => 500, 'error' => 'Redeem failed'];
    }

    return ['status' => 200, 'code' => $code, 'badge_id' => $badgeId, 'title_slug' => $titleSlug];
}
