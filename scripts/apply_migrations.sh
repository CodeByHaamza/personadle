#!/usr/bin/env bash
# scripts/apply_migrations.sh — Applique les migrations SQL non encore appliquées.
#
# À lancer sur le serveur, depuis la racine du repo (utilise api/config.php pour
# les identifiants BDD). Trace l'état dans la table `schema_migrations` (créée par
# la migration 026, qui doit avoir été appliquée une première fois).
#
#   php ...   # (026 appliquée manuellement une fois pour amorcer)
#   bash scripts/apply_migrations.sh
#
# Idempotent : ne rejoue que les fichiers sql/migrations/*.sql absents de
# schema_migrations, dans l'ordre. Fait un mysqldump de sécurité avant toute
# application. Utilise le client mysql (gère DELIMITER des procédures stockées).

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Identifiants depuis api/config.php ───────────────────────────────────────
DB_HOST=$(php -r "require 'api/config.php'; echo DB_HOST;")
DB_NAME=$(php -r "require 'api/config.php'; echo DB_NAME;")
DB_USER=$(php -r "require 'api/config.php'; echo DB_USER;")
DB_PASS=$(php -r "require 'api/config.php'; echo DB_PASS;")
mysql_do() { mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" "$@"; }

# ── Table de suivi (au cas où 026 pas encore passée) ─────────────────────────
mysql_do -e "CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;"

applied=$(mysql_do -N -e "SELECT version FROM schema_migrations;")

pending=()
for f in sql/migrations/*.sql; do
  ver=$(basename "$f" .sql)
  grep -qxF "$ver" <<< "$applied" || pending+=("$f")
done

if [ ${#pending[@]} -eq 0 ]; then
  echo "✅ Aucune migration en attente — la base est à jour."
  exit 0
fi

echo "▶ ${#pending[@]} migration(s) en attente : $(printf '%s ' "${pending[@]##*/}")"

# ── Backup de sécurité avant d'appliquer quoi que ce soit ────────────────────
BK="$HOME/db_backup_before_apply_$(date +%F_%H%M%S).sql"
mysqldump -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" --routines --triggers "$DB_NAME" > "$BK"
[ -s "$BK" ] || { echo "❌ Backup vide — abandon."; exit 1; }
echo "✅ Backup : $BK ($(du -h "$BK" | cut -f1))"

# ── Application dans l'ordre ─────────────────────────────────────────────────
for f in "${pending[@]}"; do
  ver=$(basename "$f" .sql)
  echo "▶ Application de $ver ..."
  if mysql_do < "$f"; then
    mysql_do -e "INSERT IGNORE INTO schema_migrations (version) VALUES ('$ver');"
    echo "  ✅ $ver appliquée et enregistrée"
  else
    echo "  ❌ Échec sur $ver — arrêt (backup : $BK)."
    exit 1
  fi
done

echo "✅ Toutes les migrations sont appliquées."
