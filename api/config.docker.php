<?php
/**
 * api/config.docker.php — Configuration pour l'environnement Docker
 * ──────────────────────────────────────────────────────────────────
 * Lit les credentials depuis les variables d'environnement injectées
 * par docker-compose.yml. Ne jamais committer de mots de passe ici.
 *
 * Utilisé automatiquement quand APP_ENV=local ET que les variables
 * DB_HOST / DB_USER / DB_PASSWORD sont présentes dans l'environnement.
 *
 * Pour activer : créer un symlink ou renommer en config.php dans le container.
 * Le Dockerfile copie ce fichier au bon endroit via le bind-mount.
 */

define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', (int)(getenv('DB_PORT') ?: 3306));
define('DB_NAME', getenv('DB_NAME')  ?: 'personadle_db');
define('DB_USER', getenv('DB_USER')  ?: 'personadle_usr');
define('DB_PASS', getenv('DB_PASSWORD') ?: 'devpassword');

define('APP_ENV', getenv('APP_ENV') ?: 'local');
