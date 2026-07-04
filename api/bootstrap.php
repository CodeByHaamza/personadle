<?php
/**
 * api/bootstrap.php — Fondations de l'API PersonaDLE
 * ────────────────────────────────────────────────────────────────────────────
 * Inclus en premier dans chaque endpoint.
 *
 * Responsabilités :
 *   - Chargement de config.php (credentials BDD, APP_ENV)
 *   - Headers CORS + Content-Type JSON
 *   - Session PHP sécurisée (HttpOnly, SameSite=Lax, Secure en prod)
 *   - Connexion PDO singleton (MySQL 8.0, utf8mb4)
 *   - Helpers : pdo(), jsonSuccess(), jsonError(), requireAuth(), requireAdmin(),
 *               requireCsrf(), requireCronSecret(), getJsonBody(), rateLimit(),
 *               generateFriendCode(), fetchProfile(), requestPathSegments()
 *   (formatUser() vit dans api/lib/format.php, chargé via require_once par ce fichier)
 */

declare(strict_types=1);

// Logique pure (sans BDD) — testable en PHPUnit indépendamment de ce bootstrap.
require_once __DIR__ . '/lib/authz.php';
require_once __DIR__ . '/lib/format.php';
require_once __DIR__ . '/lib/error_log.php';
require_once __DIR__ . '/lib/admin_audit.php';
require_once __DIR__ . '/lib/deletion_requests.php';

// Garantir que PHP utilise UTC pour date/time, cohérent avec UTC_TIMESTAMP() MySQL
date_default_timezone_set('UTC');

// Priorité à l'environnement Docker (DB_HOST injecté par Docker Compose) : sinon
// un api/config.php local (Apache, DB_HOST=127.0.0.1) masquerait config.docker.php
// à l'intérieur du conteneur (le code est bind-mounté) → "Database unavailable".
// Hors conteneur (pas de DB_HOST), on charge config.php (dev Apache / prod Hostinger).
if (getenv('DB_HOST') !== false) {
    require_once __DIR__ . '/config.docker.php';
} elseif (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    http_response_code(503);
    echo json_encode(['error' => 'No database configuration found. Copy config.example.php to config.php.']);
    exit;
}

// ── Affichage des erreurs ────────────────────────────────────────────────────
// En PROD : ne JAMAIS afficher les erreurs (fuite de chemins, requêtes SQL,
// noms de colonnes…). On les journalise à la place. En local : affichage pour
// faciliter le debug.
if (APP_ENV === 'production') {
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
} else {
    ini_set('display_errors', '1');
}
error_reporting(E_ALL);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Origines autorisées : local dev (Apache port 80, Live Server port 5500)
// + production. On renvoie l'origine exacte si elle est whitelistée
// pour que credentials: 'include' fonctionne (wildcard * interdit avec cookies).
$allowedOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:80',
    'http://127.0.0.1:80',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'http://localhost:5500',     // Live Server VSCode
    'http://127.0.0.1:5500',
    'http://localhost:5173',     // Vite dev server
    'http://127.0.0.1:5173',
    'https://personadle.net',
    'https://www.personadle.net',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, X-CSRF-Token');
header('Content-Type: application/json; charset=utf-8');

// Preflight OPTIONS → répondre immédiatement sans logique applicative
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Security headers ─────────────────────────────────────────────────────────
// Envoyés sur toutes les réponses (après CORS pour ne pas interférer).
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
// Réponses API = JSON pur : aucune sous-ressource ne doit jamais être chargée.
// `default-src 'none'` est donc sûr ici (≠ pages HTML, qui ont des scripts inline).
// `frame-ancestors 'none'` double X-Frame-Options pour les navigateurs récents.
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
header('X-Permitted-Cross-Domain-Policies: none');
// HSTS uniquement en prod (HTTPS) — force le navigateur à rester en HTTPS.
if (APP_ENV === 'production') {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

// ── Session sécurisée ────────────────────────────────────────────────────────
// Durée de vie : 30 jours (persistent login, comme tout site moderne).
// Le cookie survit aux fermetures de navigateur. La session expire côté serveur
// au bout de 30 jours d'inactivité (gc_maxlifetime).
$sessionLifetime = 30 * 24 * 3600; // 30 jours en secondes
ini_set('session.gc_maxlifetime', (string) $sessionLifetime);

session_set_cookie_params([
    'lifetime' => $sessionLifetime,
    'path'     => '/',
    'domain'   => '',
    'secure'   => APP_ENV === 'production',     // HTTPS uniquement en prod
    'httponly' => true,                         // inaccessible au JS côté client
    'samesite' => 'Lax',
]);
session_start();

// ── Token CSRF (double-submit cookie) ────────────────────────────────────────
// Émis dès la première requête (avant même le login) dans un cookie LISIBLE
// par JS — le front (js/api.js) le recopie dans le header X-CSRF-Token sur
// toute requête mutante. requireAuth() compare ce header au token de session
// (hash_equals) : un site tiers ne peut pas lire ce cookie (Same-Origin Policy)
// donc ne peut pas forger le header, même si SameSite=Lax était contourné.
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
setcookie('csrf_token', $_SESSION['csrf_token'], [
    'expires'  => time() + $sessionLifetime,
    'path'     => '/',
    'domain'   => '',
    'secure'   => APP_ENV === 'production',
    'httponly' => false, // doit être lisible par JS — c'est tout l'intérêt du double-submit
    'samesite' => 'Lax',
]);

// ── PDO singleton ────────────────────────────────────────────────────────────
/**
 * Retourne la connexion PDO (créée une seule fois par requête).
 * En cas d'échec, répond 503 sans exposer les détails de connexion.
 */
function pdo(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        DB_HOST, DB_PORT, DB_NAME
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        error_log('[PersonaDLE] DB connection failed: ' . $e->getMessage());
        jsonError('Database unavailable', 503);
    }

    return $pdo;
}

// ── Helpers JSON ─────────────────────────────────────────────────────────────

/**
 * Envoie une réponse JSON de succès et termine l'exécution.
 *
 * @param mixed $data   Données à sérialiser
 * @param int   $status Code HTTP (défaut 200)
 */
function jsonSuccess(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Envoie une réponse JSON d'erreur et termine l'exécution.
 *
 * @param string $message Message lisible
 * @param int    $status  Code HTTP (défaut 400)
 */
function jsonError(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Vérifie qu'une session utilisateur est active.
 * Termine avec 401 si non connecté.
 *
 * @return int user_id de la session
 */
function requireAuth(): int
{
    if (empty($_SESSION['user_id'])) {
        jsonError('Unauthorized — please log in', 401);
    }
    requireCsrf();
    $uid = (int) $_SESSION['user_id'];

    // Vérifier is_deleted (cached 5 min dans $_SESSION pour éviter une requête par hit)
    $now = time();
    if (empty($_SESSION['is_deleted_checked_at']) || ($now - (int)$_SESSION['is_deleted_checked_at']) > 300) {
        $chk = pdo()->prepare('SELECT is_deleted, is_banned FROM users WHERE id = ? LIMIT 1');
        $chk->execute([$uid]);
        $chkRow = $chk->fetch() ?: null;

        // Ban enforcé sur TOUS les endpoints authentifiés (pas seulement me.php) :
        // sinon un banni avec session active garderait l'accès jusqu'à expiration.
        $denial = personadle_session_denial_reason($chkRow);
        if ($denial === 'deleted') {
            session_destroy();
            jsonError('Account not found or deleted', 401);
        }
        if ($denial === 'banned') {
            session_destroy();
            jsonError('Account banned', 403);
        }
        $_SESSION['is_deleted_checked_at'] = $now;
    }

    // Update last_login_at at most once per 5 minutes per session (heartbeat)
    $now = time();
    if (empty($_SESSION['last_seen_ts']) || ($now - (int) $_SESSION['last_seen_ts']) > 300) {
        try {
            pdo()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$uid]);
            $_SESSION['last_seen_ts'] = $now;
        } catch (PDOException $e) {
            // non-blocking — never fail the request over this
        }
    }

    return $uid;
}

/**
 * Vérifie le token CSRF (double-submit cookie) pour les méthodes mutantes.
 * Termine avec 403 si le header X-CSRF-Token est absent ou ne correspond pas
 * au token de session. Portée volontairement limitée aux endpoints authentifiés
 * (appelée depuis requireAuth()) : login/register/reset-password restent
 * protégés par SameSite=Lax uniquement, décision documentée dans
 * PersonaDLE_Update_Documentation/PersonaDLE 2.0/DEV_CHANGELOG.md.
 */
function requireCsrf(): void
{
    if (!personadle_csrf_required($_SERVER['REQUEST_METHOD'] ?? 'GET')) {
        return;
    }
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
    if (!personadle_csrf_valid($_SESSION['csrf_token'] ?? null, $header)) {
        jsonError('Invalid or missing CSRF token', 403);
    }
}

/**
 * Vérifie que l'utilisateur connecté est admin (is_admin = 1 en BDD).
 * Retourne 403 sinon.
 *
 * @return int user_id
 */
function requireAdmin(): int
{
    $uid = requireAuth();
    $stmt = pdo()->prepare('SELECT is_admin FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([$uid]);
    $row = $stmt->fetch() ?: null;
    if (!personadle_is_admin_row($row)) {
        jsonError('Forbidden — admin only', 403);
    }
    return $uid;
}

/**
 * Lit et désérialise le corps JSON de la requête.
 * Termine avec 400 si le JSON est invalide ou absent.
 *
 * @return array<string, mixed>
 */
function getJsonBody(): array
{
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);

    if (!is_array($data)) {
        jsonError('Invalid or missing JSON body');
    }
    return $data;
}

/**
 * Découpe le chemin de l'URL courante en segments (ex: "/api/friends/42" → ["api","friends","42"]).
 * Chaque endpoint qui route sur ses propres sous-chemins (badges, friends, messages,
 * social-links, titles, user, wallpapers…) part de ce même découpage.
 *
 * @return string[]
 */
function requestPathSegments(): array
{
    return explode('/', trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
}

/**
 * Rate-limiting persistant en BDD (table rate_limits) — partagé entre instances,
 * contrairement à sys_get_temp_dir() qui ne l'est pas. Termine en 429 si plus de
 * $max requêtes pour cette clé dans la fenêtre glissante de $windowSec secondes.
 *
 * @param string $key       Clé unique (ex: "login:1.2.3.4", "sessions:42")
 * @param int    $max       Nombre max de requêtes dans la fenêtre
 * @param int    $windowSec Durée de la fenêtre en secondes
 * @param string $message   Message renvoyé en cas de dépassement
 */
function rateLimit(string $key, int $max, int $windowSec, string $message = 'Too many attempts. Please try again later.'): void
{
    $pdo    = pdo();
    $now    = time();
    $cutoff = $now - $windowSec;

    // Upsert atomique : réinitialise la fenêtre si expirée, sinon incrémente.
    $pdo->prepare(
        'INSERT INTO rate_limits (rl_key, hits, window_start) VALUES (?, 1, ?)
         ON DUPLICATE KEY UPDATE
            hits         = IF(window_start < ?, 1, hits + 1),
            window_start = IF(window_start < ?, ?, window_start)'
    )->execute([$key, $now, $cutoff, $cutoff, $now]);

    $stmt = $pdo->prepare('SELECT hits FROM rate_limits WHERE rl_key = ?');
    $stmt->execute([$key]);
    if ((int) $stmt->fetchColumn() > $max) {
        jsonError($message, 429);
    }
}

/**
 * Vérifie le secret cron pour les endpoints api/cron/*.php, via le header
 * X-Cron-Key plutôt qu'un paramètre ?key= en query string : une query string
 * finit en clair dans les logs d'accès HTTP (serveur, proxy), pas un header.
 * Termine avec 403 si absent/invalide (comparaison hash_equals, timing-safe).
 */
function requireCronSecret(): void
{
    $key = $_SERVER['HTTP_X_CRON_KEY'] ?? '';
    if (!defined('CRON_SECRET') || !hash_equals(CRON_SECRET, $key)) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
}

/**
 * Génère un friend_code unique de 8 caractères (majuscules + chiffres).
 * Exclut O, 0, I, 1 pour éviter les confusions visuelles.
 * Boucle jusqu'à trouver un code non utilisé en base.
 *
 * @return string Ex: "XK4R2M9P"
 */
function generateFriendCode(): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $pdo   = pdo();
    $stmt  = $pdo->prepare('SELECT id FROM users WHERE friend_code = ? LIMIT 1');

    do {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $stmt->execute([$code]);
    } while ($stmt->fetch());

    return $code;
}

/** Fetches the profiles row for a user and returns it (empty array if none). */
function fetchProfile(PDO $pdo, int $userId): array
{
    $s = $pdo->prepare('SELECT user_id, avatar_data, avatar_border_color, wallpaper_id, profile_music_id, selected_badges, equipped_title_id, settings FROM profiles WHERE user_id = ? LIMIT 1');
    $s->execute([$userId]);
    return $s->fetch(PDO::FETCH_ASSOC) ?: [];
}
