<?php
/**
 * api/config.example.php — Template de configuration
 * ────────────────────────────────────────────────────
 * Copier ce fichier en config.php et remplir les valeurs réelles.
 * Ne JAMAIS committer config.php dans git.
 *
 * Local  : DB user = personadle_usr, créé par setup.sh
 * Hostinger : remplacer par les credentials du panel hPanel
 */

// ── Base de données ─────────────────────────────────────────────────────────
define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', 'personadle_db');
define('DB_USER', 'personadle_usr');
define('DB_PASS', 'CHANGE_THIS_PASSWORD');

// ── Environnement ────────────────────────────────────────────────────────────
// 'local' → cookies non-secure, CORS permissif
// 'production' → cookies secure (HTTPS), CORS strict
define('APP_ENV', 'local');

// ── Cron secret ──────────────────────────────────────────────────────────────
// Clé secrète pour les endpoints cron — générer avec:
//   php -r "echo bin2hex(random_bytes(24));"
define('CRON_SECRET', 'CHANGE_ME_generate_with_php_random_bytes');
