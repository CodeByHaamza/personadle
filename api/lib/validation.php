<?php
/**
 * api/lib/validation.php — Validation d'inputs utilisateur, PURE (sans base de données).
 *
 * Extraite de api/auth/register.php et api/auth/reset-password.php pour être
 * testable unitairement (PHPUnit, sans MySQL) et éviter la duplication des règles
 * entre les deux endpoints.
 */

declare(strict_types=1);

/**
 * Valide un pseudo. Retourne un message d'erreur, ou null si valide.
 *
 * Règles : 3 à 50 caractères, lettres/chiffres/tirets/points/underscores uniquement.
 */
function personadle_validate_pseudo(string $pseudo): ?string
{
    if (strlen($pseudo) < 3 || strlen($pseudo) > 50) {
        return 'Username must be between 3 and 50 characters';
    }
    if (!preg_match('/^[\w\-\.]+$/u', $pseudo)) {
        return 'Username can only contain letters, numbers, hyphens, dots and underscores';
    }
    return null;
}

/**
 * Valide un mot de passe. Retourne un message d'erreur, ou null si valide.
 *
 * Règle : au moins 8 caractères (cf. bcrypt via password_hash côté appelant).
 */
function personadle_validate_password(string $password): ?string
{
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters';
    }
    return null;
}

/**
 * Normalise une langue vers une valeur supportée, sinon 'en' par défaut.
 *
 * @param array<int,string> $supported
 */
function personadle_normalize_lang(string $lang, array $supported = ['en', 'fr', 'es', 'de', 'it']): string
{
    return in_array($lang, $supported, true) ? $lang : 'en';
}
