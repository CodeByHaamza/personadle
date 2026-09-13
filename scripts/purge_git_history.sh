#!/usr/bin/env bash
# =============================================================================
# purge_git_history.sh — Purge les anciens .gif All-Out Attack de l'historique git
# =============================================================================
#
# ⚠️⚠️  DESTRUCTIF — RÉÉCRIT TOUTE L'HISTOIRE GIT  ⚠️⚠️
#   - Force-push obligatoire après → TOUS les clones existants deviennent obsolètes
#     (chaque collaborateur devra re-cloner, Hostinger devra `git reset --hard`).
#   - À NE LANCER QUE volontairement, jamais en CI/hook, jamais avec une PR ouverte.
#   - Procédure complète et checklist : TODO.md § « Dépôt git — purge des anciens .gif ».
#
# Ce qu'il fait (mesuré le 2026-09-13) :
#   .git pèse 3,8 Go. Les 74 .webp d'All-Out Attack (1,82 Go, 79 blobs) sont VOULUS dans
#   le dépôt — jouer 100 % en local est la philosophie du projet — et ne sont pas touchés.
#   Ce qui ne sert plus : les 62 anciens .gif du même dossier, remplacés par les .webp,
#   plus suivis par aucun commit récent mais toujours dans l'historique = 1,28 Go.
#   Ce script retire UNIQUEMENT ces chemins (allOutAttackMode/database/allOutAttack/*.gif)
#   de tout l'historique. Résultat attendu : .git ≈ 3,8 Go → ≈ 2,5 Go.
#
#   ⚠️ L'ancienne version de ce script purgeait « tout blob > 5 Mo » puis ré-ajoutait
#   les AOA : elle aurait aussi effacé les badges (profile/badges/images, PNG de 6-8 Mo)
#   et les wallpapers (profile/Wallpaper, 6 Mo) de l'arbre de travail. Ciblage par
#   chemin désormais, rien d'autre ne bouge.
#
# Pré-requis : pip install git-filter-repo
# =============================================================================
set -euo pipefail

GIF_GLOB="allOutAttackMode/database/allOutAttack/*.gif"

command -v git-filter-repo >/dev/null || { echo "❌ git-filter-repo manquant : pip install git-filter-repo"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "❌ working tree non propre — commit/stash d'abord."; exit 1; }
[ "$(git ls-files "$GIF_GLOB" | wc -l)" -eq 0 ] || { echo "❌ des .gif AOA sont encore suivis — ce script ne purge que des fichiers déjà retirés de l'arbre."; exit 1; }

echo "📏 Avant : .git = $(du -sh .git | cut -f1)"
echo "⚠️  Ceci va RÉÉCRIRE TOUTE l'histoire git et nécessitera un force-push."
read -rp "Tape 'PURGE' pour continuer : " confirm
[ "$confirm" = "PURGE" ] || { echo "Annulé."; exit 0; }

# 1. Backup miroir (à garder hors ligne un mois)
BACKUP="../personadle-backup-$(date +%Y%m%d-%H%M%S).git"
echo "💾 Backup miroir → $BACKUP"
git clone --mirror . "$BACKUP"

# 2. Purge des seuls .gif AOA, de tout l'historique
echo "🔪 Purge de $GIF_GLOB de l'historique…"
git filter-repo --invert-paths --path-glob "$GIF_GLOB" --force

# 3. Compactage
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Terminé. Après : .git = $(du -sh .git | cut -f1)"
echo ""
echo "➡️  ÉTAPES MANUELLES RESTANTES (TODO.md § purge) :"
echo "   1. Vérifier : npm test · make up · npm run test:e2e · git log --oneline | wc -l inchangé."
echo "   2. Ré-ajouter le remote si filter-repo l'a retiré :"
echo "      git remote add origin https://github.com/CodeByHaamza/personadle.git"
echo "   3. Force-push (désactiver d'abord la protection de main si besoin) :"
echo "      git push origin --force --all && git push origin --force --tags"
echo "   4. Hostinger (SSH) : git fetch origin && git reset --hard origin/main"
echo "   5. Prévenir Léo et Damien : re-cloner, les anciens clones ne pullent plus."
