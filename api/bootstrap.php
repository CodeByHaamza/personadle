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
 *   - Helpers : jsonSuccess(), jsonError(), requireAuth(),
 *               getJsonBody(), generateFriendCode(), formatUser()
 */

declare(strict_types=1);

// Charge config.php si présent (dev local / prod), sinon config.docker.php
// (variables d'environnement injectées par Docker Compose).
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} elseif (getenv('DB_HOST') !== false) {
    require_once __DIR__ . '/config.docker.php';
} else {
    http_response_code(503);
    echo json_encode(['error' => 'No database configuration found. Copy config.example.php to config.php.']);
    exit;
}

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
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Content-Type: application/json; charset=utf-8');

// Preflight OPTIONS → répondre immédiatement sans logique applicative
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
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
    $uid = (int) $_SESSION['user_id'];

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

/**
 * Formate une ligne users en objet public (sans password_hash).
 *
 * @param  array<string, mixed> $row Ligne fetchée depuis la table users
 * @return array<string, mixed>
 */
function formatUser(array $row, array $profile = []): array
{
    return [
        'id'                  => (int)  $row['id'],
        'email'               =>        $row['email'],
        'pseudo'              =>        $row['pseudo'],
        'lang'                =>        $row['lang'],
        'friend_code'         =>        $row['friend_code'],
        'created_at'          =>        $row['created_at'],
        'last_login_at'       =>        $row['last_login_at'],
        'avatar_data'         =>        $profile['avatar_data']         ?? null,
        'avatar_border_color' =>        $profile['avatar_border_color'] ?? '#ffffff',
        'has_migrated'        => (bool) ($row['has_migrated']           ?? false),
    ];
}

/** Fetches the profiles row for a user and returns it (empty array if none). */
function fetchProfile(PDO $pdo, int $userId): array
{
    $s = $pdo->prepare('SELECT user_id, avatar_data, avatar_border_color, wallpaper_id, profile_music_id, selected_badges, equipped_title_id, theme_id, settings FROM profiles WHERE user_id = ? LIMIT 1');
    $s->execute([$userId]);
    return $s->fetch(PDO::FETCH_ASSOC) ?: [];
}
