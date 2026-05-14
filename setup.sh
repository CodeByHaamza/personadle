#!/usr/bin/env bash
# =============================================================================
# setup.sh — PersonaDLE Backend : installation locale (one-time)
# =============================================================================
# Usage : sudo bash setup.sh
#
# Ce script :
#   1. Crée la base de données MySQL et l'utilisateur applicatif
#   2. Importe le schéma (sql/bdd_mysql.sql)
#   3. Crée un symlink Apache : /var/www/html/personadle → ce dossier
#   4. Configure AllowOverride All + active mod_rewrite
#   5. Recharge Apache
#
# Après le setup :
#   Frontend  → http://localhost/personadle/
#   API       → http://localhost/personadle/api/auth/me
#   phpMyAdmin→ http://localhost/phpmyadmin/  (base: personadle_db)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Credentials de l'utilisateur applicatif (lus depuis api/config.php)
DB_NAME="personadle_db"
DB_USER="personadle_usr"
DB_PASS="Pers0naDLE_dev!"

SYMLINK="/var/www/html/personadle"
APACHE_CONF="/etc/apache2/conf-available/personadle.conf"
SCHEMA="${SCRIPT_DIR}/sql/bdd_mysql.sql"

# ── Couleurs ──────────────────────────────────────────────────────────────────
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${G}✓${NC}  $*"; }
warn() { echo -e "${Y}⚠${NC}  $*"; }
die()  { echo -e "${R}✗${NC}  $*"; exit 1; }

# ── Vérifications préalables ──────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Lancer avec sudo : sudo bash setup.sh"
[[ -f "$SCHEMA" ]] || die "Schéma introuvable : $SCHEMA"

echo ""
echo "┌────────────────────────────────────────────────────────┐"
echo "│   PersonaDLE — Setup Backend Local                     │"
echo "└────────────────────────────────────────────────────────┘"
echo ""

# ── Credentials MySQL admin ───────────────────────────────────────────────────
read -rp  "  Utilisateur MySQL admin (ex: hamza) : " MYSQL_ADMIN
read -rsp "  Mot de passe MySQL admin            : " MYSQL_PASS
echo ""

# Test de connexion
mysql -u"$MYSQL_ADMIN" -p"$MYSQL_PASS" -e "SELECT 1;" &>/dev/null \
  || die "Connexion MySQL échouée — vérifier les identifiants."
ok "Connexion MySQL OK"

# ── 1. Créer la BDD et l'utilisateur applicatif ───────────────────────────────
echo ""
echo "→ Création de la base de données et de l'utilisateur..."

mysql -u"$MYSQL_ADMIN" -p"$MYSQL_PASS" <<SQL
DROP DATABASE IF EXISTS \`${DB_NAME}\`;
CREATE DATABASE \`${DB_NAME}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Recréer l'utilisateur proprement (idempotent)
DROP USER IF EXISTS '${DB_USER}'@'127.0.0.1';
CREATE USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';

-- Privilèges limités au strict nécessaire (pas de DROP, pas de ALTER)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TEMPORARY TABLES
  ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';

FLUSH PRIVILEGES;
SQL

ok "Base '${DB_NAME}' et utilisateur '${DB_USER}' créés"

# ── 2. Importer le schéma ─────────────────────────────────────────────────────
echo ""
echo "→ Import du schéma MySQL..."

mysql -u"$MYSQL_ADMIN" -p"$MYSQL_PASS" "$DB_NAME" < "$SCHEMA"
ok "Schéma importé (tables + vues + seeds)"

# ── 3. Symlink Apache ─────────────────────────────────────────────────────────
echo ""
echo "→ Configuration Apache..."

# Supprimer l'ancien symlink si présent
if [[ -L "$SYMLINK" ]] || [[ -e "$SYMLINK" ]]; then
    warn "Suppression de l'entrée existante : $SYMLINK"
    rm -rf "$SYMLINK"
fi

ln -s "$SCRIPT_DIR" "$SYMLINK"
ok "Symlink : $SYMLINK → $SCRIPT_DIR"

# ── 4. Config AllowOverride ───────────────────────────────────────────────────
cat > "$APACHE_CONF" <<APACHE
# PersonaDLE — autorise les .htaccess dans le projet (chemin réel + chemin symlink)
<Directory "${SCRIPT_DIR}">
    AllowOverride All
    Require all granted
    Options -Indexes +FollowSymLinks
</Directory>

<Directory "${SYMLINK}">
    AllowOverride All
    Require all granted
    Options -Indexes +FollowSymLinks
</Directory>
APACHE

a2enconf personadle &>/dev/null && ok "Config Apache 'personadle' activée"
a2enmod  rewrite    &>/dev/null && ok "mod_rewrite activé"

# ── 5. Recharger Apache ───────────────────────────────────────────────────────
echo ""
echo "→ Rechargement d'Apache..."
systemctl reload apache2
ok "Apache rechargé"

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo "┌────────────────────────────────────────────────────────┐"
echo "│   ✅  Setup terminé !                                   │"
echo "├────────────────────────────────────────────────────────┤"
printf "│  %-52s │\n" "Frontend   → http://localhost/personadle/"
printf "│  %-52s │\n" "API test   → http://localhost/personadle/api/auth/me"
printf "│  %-52s │\n" "phpMyAdmin → http://localhost/phpmyadmin/"
printf "│  %-52s │\n" "             base : ${DB_NAME}"
echo "└────────────────────────────────────────────────────────┘"
echo ""
echo "  Pour tester l'API depuis le terminal :"
echo "  curl -s http://localhost/personadle/api/auth/me | python3 -m json.tool"
echo ""
