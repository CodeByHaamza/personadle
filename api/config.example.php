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

// ── Proxys de confiance (rate limiting) ──────────────────────────────────────
// Laisser VIDE tant que le site répond en direct (Apache/LiteSpeed) : l'IP
// utilisée comme clé de rate limiting est alors REMOTE_ADDR, non falsifiable.
//
// À renseigner UNIQUEMENT si un CDN / reverse-proxy est placé devant le site
// (Hostinger CDN, Cloudflare en mode proxy…). Sans ça, REMOTE_ADDR vaut l'IP du
// proxy pour tout le monde → un seul seau partagé → 5 connexions / 15 min pour
// le site ENTIER. Avec la liste renseignée, X-Forwarded-For n'est déroulé que
// s'il vient réellement d'un de ces proxys (cf. api/lib/client_ip.php).
//
// Symptôme à surveiller : des 429 « Too many attempts » sur /api/auth/login
// alors que le joueur n'a fait qu'un seul essai.
//
// Format : IPs exactes et/ou CIDR, IPv4 et IPv6.
//   define('TRUSTED_PROXIES', ['203.0.113.7', '198.51.100.0/24', '2001:db8::/32']);
define('TRUSTED_PROXIES', []);

// ── Discord ──────────────────────────────────────────────────────────────────
// Webhook Discord "Morgana" du salon #🎲┃daily-personadle.
// Récupérable dans Discord : Modifier le salon → Intégrations → Webhooks.
// SECRET : quiconque possède cette URL peut poster sous ce nom.
define('DISCORD_DAILY_WEBHOOK', '');

// ── Pusher (notifications temps réel) ────────────────────────────────────────
// Créer une app sur https://dashboard.pusher.com (Channels), copier ses
// identifiants ici. Laisser vide en local si vous ne testez pas le temps réel :
// personadle_pusher_trigger() devient alors un no-op silencieux (fallback
// polling toujours actif côté client).
define('PUSHER_APP_ID', '');
define('PUSHER_KEY', '');
define('PUSHER_SECRET', '');
define('PUSHER_CLUSTER', '');

// ID du rôle mentionné dans l'annonce quotidienne Discord.
// Constante absente ou vide => aucun ping.
// ⚠️ Ne pas y mettre le rôle Membres : un ping tous les jours sur un
// rendez-vous de routine fait couper le salon. Rôle opt-in « 🔔 Daily ».
define('DISCORD_DAILY_MENTION_ROLE', '1550573338336698521');

// Top 3 de la semaine (api/cron/discord_weekly.php, dimanche 20:00 Paris).
// Webhook du salon classement ; vide ou absent => celui du quotidien est utilisé.
// Le rôle mentionné est optionnel — même règle que le quotidien : opt-in seulement.
define('DISCORD_WEEKLY_WEBHOOK', '');
define('DISCORD_WEEKLY_MENTION_ROLE', '');
