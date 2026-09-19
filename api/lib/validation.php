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
 * Langues servies par le site — une par fichier lang/*.json. Source unique côté
 * PHP : register (normalisation), PATCH /api/user/:id et le panel admin la
 * partagent. Le portugais manquait aux trois listes locales qu'ils gardaient
 * chacun : un joueur en `pt` voyait son PATCH profil entier refusé en 400
 * (« Invalid lang »), avatar et bordure compris, puisque le client envoie
 * toujours la langue avec le reste.
 */
const PERSONADLE_SUPPORTED_LANGS = ['en', 'fr', 'es', 'de', 'it', 'pt'];

/**
 * Les six modes de jeu, clés canoniques (même vocabulaire que MODES dans
 * js/gameCore.js). Source unique côté PHP depuis le 2026-09-13 : neuf fichiers
 * recopiaient la liste — un 7ᵉ mode aurait dû être ajouté neuf fois.
 */
const PERSONADLE_MODES = ['classic', 'emoji', 'silhouette', 'alloutattack', 'personae', 'music'];

/**
 * Normalise une langue vers une valeur supportée, sinon 'en' par défaut.
 *
 * @param array<int,string> $supported
 */
function personadle_normalize_lang(string $lang, array $supported = PERSONADLE_SUPPORTED_LANGS): string
{
    return in_array($lang, $supported, true) ? $lang : 'en';
}

/**
 * Valide un avatar de profil (`avatar_data`). Retourne un message d'erreur, ou
 * null si valide.
 *
 * Deux formes acceptées :
 *  - une référence à un portrait de la galerie du site (`../img/avatar/<nom>.<ext>`),
 *    la forme que tout le client résout déjà (amis, classement, calling cards,
 *    profil public, compendium) et la seule possible pour un GIF animé — le
 *    canvas lui ferait perdre son animation, et encodé il pèserait jusqu'à 1,7 Mo
 *    dans chaque liste d'amis. Jusqu'en 2.2 le serveur la refusait (400) : le
 *    choix d'un GIF n'était jamais enregistré et revenait au pull cloud suivant ;
 *  - une image encodée (`data:image/(jpeg|png|webp);base64,`) : le RECADRAGE d'un
 *    de ces portraits (certains sont mal cadrés par défaut).
 *
 * Décision Hamza du 2026-09-16 : **on ne téléverse plus sa propre image** — un
 * avatar est vu par les amis, le classement et les défis, et rien ne modère une
 * image libre. Le client n'offre donc plus d'import : la seule source est la
 * galerie, éventuellement recadrée. Angle mort assumé : un appel d'API fabriqué
 * à la main peut encore poster une image arbitraire, le serveur ne pouvant pas
 * distinguer le recadrage d'un portrait d'une autre image encodée. Fermer ça
 * demanderait de stocker le cadrage (zoom/offsets) au lieu des pixels, et de
 * refaire le rendu partout où un avatar s'affiche.
 *
 * Le fichier référencé doit exister dans `img/avatar/` : jamais un chemin libre,
 * pas de traversée (`..`), pas d'URL externe.
 *
 * @param string|null $avatar   valeur reçue (null = retirer l'avatar, valide)
 * @param string      $galleryDir  dossier des portraits
 */
function personadle_validate_avatar(?string $avatar, string $galleryDir = __DIR__ . '/../../img/avatar'): ?string
{
    if ($avatar === null || $avatar === '') {
        return null;
    }
    if (strlen($avatar) > 2_000_000) {
        return 'Avatar too large (max 2 MB base64)';
    }
    if (preg_match('/^data:image\/(jpeg|png|webp);base64,/', $avatar)) {
        return null;
    }
    // `avif` : Kanji.avif est dans la galerie depuis la 2.0 et était refusé ici —
    // choisi, il restait local et disparaissait au prochain pull cloud.
    if (preg_match('#^\.\./img/avatar/([A-Za-z0-9_\-]+\.(?:gif|png|jpe?g|webp|avif))$#', $avatar, $m)) {
        return is_file($galleryDir . '/' . $m[1]) ? null : 'Unknown gallery avatar';
    }
    return 'Invalid avatar format';
}

/**
 * Vrai si `$avatar` est un chemin de portrait de la galerie (`../img/avatar/<fichier>`),
 * par opposition à une image base64 recadrée ou téléversée.
 */
function personadle_is_gallery_avatar(?string $avatar): bool
{
    return is_string($avatar) && str_starts_with($avatar, '../img/avatar/');
}

/**
 * Valide `profiles.avatar_src` (migration 052) : le portrait de la galerie
 * d'ORIGINE, retenu même quand `avatar_data` est devenu un PNG recadré. Accepte
 * null/'' (aucun portrait connu) ou un chemin galerie existant — jamais une
 * image inline : ce champ dit « qui » le joueur porte, il ne stocke rien.
 *
 * @return string|null Message d'erreur, ou null si valide
 */
function personadle_validate_avatar_src(?string $src, string $galleryDir = __DIR__ . '/../../img/avatar'): ?string
{
    if ($src === null || $src === '') {
        return null;
    }
    if (!personadle_is_gallery_avatar($src)) {
        return 'Invalid avatar_src (gallery path expected)';
    }
    return personadle_validate_avatar($src, $galleryDir);
}
