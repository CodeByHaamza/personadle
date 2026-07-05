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
 * Mots de passe trop communs pour être acceptés même s'ils passent la longueur
 * minimale — liste volontairement courte (les pires du classement des mots de
 * passe les plus utilisés au monde), pas une liste de complexité. Suit la
 * recommandation NIST 800-63B : privilégier la longueur + un filtre anti-mots
 * de passe compromis/évidents, plutôt que d'imposer une composition
 * (majuscule/chiffre/symbole obligatoires) qui pousse vers des motifs
 * prévisibles (« Password1! ») sans gain réel de sécurité.
 */
const PERSONADLE_COMMON_PASSWORDS = [
    '12345678', '123456789', '1234567890', 'password', 'password1',
    'qwertyuiop', 'letmein123', '11111111', '00000000', 'iloveyou1',
    'admin1234', 'welcome123', 'abc123456', 'password123', 'qwerty123',
];

/**
 * Valide un mot de passe. Retourne un message d'erreur, ou null si valide.
 *
 * Règles : au moins 8 caractères (cf. bcrypt via password_hash côté appelant),
 * et absent de la liste des mots de passe les plus communs (comparaison
 * insensible à la casse).
 */
function personadle_validate_password(string $password): ?string
{
    if (strlen($password) < 8) {
        return 'Password must be at least 8 characters';
    }
    if (in_array(strtolower($password), PERSONADLE_COMMON_PASSWORDS, true)) {
        return 'This password is too common — please choose a less predictable one';
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
