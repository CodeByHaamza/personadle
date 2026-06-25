#!/usr/bin/env bash
# =============================================================================
# purge_git_history.sh — Récupère le poids de l'historique git (.git ≈ 3,6 Go)
# =============================================================================
#
# ⚠️⚠️  DESTRUCTIF — RÉÉCRIT TOUTE L'HISTOIRE GIT  ⚠️⚠️
#   - Force-push obligatoire après → TOUS les clones existants deviennent obsolètes
#     (chaque collaborateur devra re-cloner). À COORDONNER avec l'équipe.
#   - À NE LANCER QUE volontairement, jamais en CI/hook.
#
# Ce qu'il fait :
#   Le .git pèse ~3,6 Go alors que les AOA actuels ne font que ~1,8 Go : le reste
#   (~1,8 Go) = anciennes versions de webp + vieux .gif supprimés, encore dans
#   l'historique. Ce script purge ces gros blobs de TOUT l'historique, PUIS
#   ré-ajoute les AOA actuels en un seul commit propre (offline préservé).
#   Résultat attendu : .git ~3,6 Go → ~1,9 Go.
#
# Pré-requis : pip install git-filter-repo
# =============================================================================
set -euo pipefail

AOA_DIR="allOutAttackMode/database/allOutAttack"
THRESHOLD="5M"   # purge les blobs plus gros que ça de l'historique

command -v git-filter-repo >/dev/null || { echo "❌ git-filter-repo manquant : pip install git-filter-repo"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "❌ working tree non propre — commit/stash d'abord."; exit 1; }

echo "⚠️  Ceci va RÉÉCRIRE TOUTE l'histoire git et nécessitera un force-push."
read -rp "Tape 'PURGE' pour continuer : " confirm
[ "$confirm" = "PURGE" ] || { echo "Annulé."; exit 0; }

# 1. Backups
BACKUP="../personadle-backup-$(date +%Y%m%d-%H%M%S).git"
echo "💾 Backup miroir → $BACKUP"
git clone --mirror . "$BACKUP"
echo "💾 Backup des AOA actuels → /tmp/aoa_keep"
rm -rf /tmp/aoa_keep && cp -r "$AOA_DIR" /tmp/aoa_keep

# 2. Purge des gros blobs de tout l'historique (AOA inclus — on les remettra ensuite)
echo "🔪 Purge des blobs > $THRESHOLD de l'historique…"
git filter-repo --strip-blobs-bigger-than "$THRESHOLD" --force

# 3. Ré-ajout des AOA actuels en un commit propre (offline préservé)
echo "♻️  Ré-injection des AOA actuels…"
mkdir -p "$AOA_DIR"
cp -r /tmp/aoa_keep/. "$AOA_DIR/"
git add "$AOA_DIR"
git commit -m "chore(aoa): ré-ajout des animations AOA (historique purgé)"

echo ""
echo "✅ Terminé. .git : $(du -sh .git | cut -f1)"
echo ""
echo "➡️  ÉTAPES MANUELLES RESTANTES (à faire en conscience) :"
echo "   1. Vérifier que tout est OK (make check, make up, git log)."
echo "   2. Ré-ajouter le remote si filter-repo l'a retiré :"
echo "      git remote add origin git@github.com:HamzaKarrouchi/personadle.git"
echo "   3. Force-push (DÉSACTIVER d'abord la protection de main si besoin) :"
echo "      git push origin --force --all && git push origin --force --tags"
echo "   4. Prévenir l'équipe : tout le monde doit RE-CLONER (les vieux clones cassent)."
