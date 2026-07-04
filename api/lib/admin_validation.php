<?php
/**
 * api/lib/admin_validation.php — Validations du panel admin, PURES (sans base de données).
 *
 * Extraites de api/admin/user.php, api/admin/event_codes.php et
 * api/admin/social_links.php pour être testables unitairement (PHPUnit, sans MySQL).
 *
 * Note : la règle de pseudo admin (2-30, ASCII) diffère intentionnellement de
 * personadle_validate_pseudo() (register — 3-50, unicode \w) — comportement existant
 * préservé tel quel, à l'identique de avant cette extraction.
 */

declare(strict_types=1);

/**
 * Valide un pseudo depuis le panel admin. Retourne un message d'erreur, ou null si valide.
 */
function personadle_validate_admin_pseudo(string $pseudo): ?string
{
    if (!preg_match('/^[a-zA-Z0-9_.\-]{2,30}$/', $pseudo)) {
        return 'Invalid pseudo (2–30 chars, letters/digits/_.-)';
    }
    return null;
}

/**
 * Valide une couleur hexadécimale #RRGGBB. Retourne un message d'erreur, ou null si valide.
 */
function personadle_validate_hex_color(string $color): ?string
{
    if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
        return 'Invalid color (expected #RRGGBB)';
    }
    return null;
}

/**
 * Valide un code événementiel (panel admin). Retourne un message d'erreur, ou null si valide.
 */
function personadle_validate_event_code(string $code): ?string
{
    if (!$code || strlen($code) > 50 || !preg_match('/^[A-Z0-9_]+$/', $code)) {
        return 'Code invalide (lettres majuscules, chiffres, underscore)';
    }
    return null;
}

/**
 * Valide un rang de Social Link (1 à 10 — cf. social_link_ranks). Retourne un message
 * d'erreur, ou null si valide.
 */
function personadle_validate_sl_rank(int $rank): ?string
{
    if ($rank < 1 || $rank > 10) {
        return 'rank must be between 1 and 10';
    }
    return null;
}

/**
 * Valide un montant d'XP de Social Link (doit être >= 0). Retourne un message
 * d'erreur, ou null si valide.
 */
function personadle_validate_sl_xp(int $xp): ?string
{
    if ($xp < 0) {
        return 'xp must be >= 0';
    }
    return null;
}
