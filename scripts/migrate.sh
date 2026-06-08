#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/migrate.sh — Runner de migrations SQL PersonaDLE
#
# Usage :
#   bash scripts/migrate.sh              # dev local (MySQL 8.0)
#   bash scripts/migrate.sh --prod       # production Hostinger via SSH
#   bash scripts/migrate.sh --dry-run    # affiche les migrations à jouer sans les exécuter
#
# Requis en local : mysql client + api/config.php lisible par bash (ou variables d'env)
# Requis en prod  : ssh hostinger-personadle configuré dans ~/.ssh/config
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../sql/migrations" && pwd)"
TRACKER_TABLE="schema_migrations"
DRY_RUN=false
PROD=false

# ── Parse args ───────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --prod)    PROD=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# ── Couleurs ─────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[migrate]${NC} $1"; }
warn() { echo -e "${YELLOW}[migrate]${NC} $1"; }
err()  { echo -e "${RED}[migrate]${NC} $1" >&2; exit 1; }

# ── Connexion BDD ─────────────────────────────────────────────────────────────
if [ "$PROD" = true ]; then
  log "Cible : production Hostinger (SSH)"
  MYSQL_CMD="ssh hostinger-personadle mysql -u u870779941_Hamza -p\$(cat ~/.db_pass_hostinger) u870779941_personadle"
else
  log "Cible : dev local"
  # Lire les credentials depuis api/config.php (variable DB_*)
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  CONFIG="$SCRIPT_DIR/../api/config.php"
  if [ ! -f "$CONFIG" ]; then
    err "api/config.php introuvable. Copier config.example.php → config.php."
  fi
  DB_HOST=$(php -r "require '$CONFIG'; echo DB_HOST;")
  DB_PORT=$(php -r "require '$CONFIG'; echo DB_PORT;")
  DB_NAME=$(php -r "require '$CONFIG'; echo DB_NAME;")
  DB_USER=$(php -r "require '$CONFIG'; echo DB_USER;")
  DB_PASS=$(php -r "require '$CONFIG'; echo DB_PASS;")
  MYSQL_CMD="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME"
fi

# ── Créer la table de suivi si nécessaire ─────────────────────────────────────
if [ "$DRY_RUN" = false ]; then
  $MYSQL_CMD <<SQL
CREATE TABLE IF NOT EXISTS $TRACKER_TABLE (
  migration VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL
fi

# ── Lister les migrations disponibles ─────────────────────────────────────────
MIGRATIONS=()
while IFS= read -r -d '' file; do
  MIGRATIONS+=("$file")
done < <(find "$MIGRATIONS_DIR" -name "*.sql" -print0 | sort -z)

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  warn "Aucun fichier .sql trouvé dans $MIGRATIONS_DIR"
  exit 0
fi

APPLIED=0
SKIPPED=0

for migration_file in "${MIGRATIONS[@]}"; do
  migration_name=$(basename "$migration_file")

  # Vérifier si déjà appliquée
  if [ "$DRY_RUN" = false ]; then
    ALREADY_APPLIED=$($MYSQL_CMD -sN -e "SELECT COUNT(*) FROM $TRACKER_TABLE WHERE migration='$migration_name';" 2>/dev/null || echo "0")
    if [ "$ALREADY_APPLIED" -gt 0 ]; then
      warn "SKIP  $migration_name (déjà appliquée)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  if [ "$DRY_RUN" = true ]; then
    log "DRY   $migration_name"
    continue
  fi

  log "APPLY $migration_name..."
  if $MYSQL_CMD < "$migration_file"; then
    $MYSQL_CMD -e "INSERT IGNORE INTO $TRACKER_TABLE (migration) VALUES ('$migration_name');"
    log "  ✓ $migration_name appliquée"
    APPLIED=$((APPLIED + 1))
  else
    err "  ✗ Échec sur $migration_name — rollback manuel requis"
  fi
done

echo ""
log "Terminé : $APPLIED migration(s) appliquée(s), $SKIPPED ignorée(s)."
