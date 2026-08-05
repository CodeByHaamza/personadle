#!/usr/bin/env bash
# scripts/smoke_test.sh — Smoke test post-déploiement de la prod.
#
# Vérifie que les endpoints clés répondent correctement après un déploiement.
# Né de l'incident du 2026-07-24 (déploiement backend v2.0 → plusieurs 500 de
# schéma découverts à la main). Ce test les aurait attrapés automatiquement.
#
# Usage : bash scripts/smoke_test.sh [BASE_URL]   (défaut : https://personadle.net)
# Exit 0 si tout passe, 1 sinon (utilisé par .github/workflows/smoke.yml).

set -uo pipefail
BASE="${1:-https://personadle.net}"
fail=0

# check <description> <url> <code_http_attendu>
check() {
  local code
  code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 25 "$2")
  if [ "$code" = "$3" ]; then
    echo "✅ $1 → $code"
  else
    echo "❌ $1 → attendu $3, reçu $code  ($2)"
    fail=1
  fi
}

# check_json <description> <url> <chaîne_attendue_dans_le_corps>
check_json() {
  local body
  body=$(curl -s --max-time 25 "$2")
  if echo "$body" | grep -q "$3"; then
    echo "✅ $1 → contient '$3'"
  else
    echo "❌ $1 → '$3' absent (reçu : ${body:0:140})"
    fail=1
  fi
}

echo "── Smoke test : $BASE ──"
check      "Page d'accueil"             "$BASE/"                   200
check      "API auth/me répond"         "$BASE/api/auth/me"        200
check_json "API auth/me = JSON valide"  "$BASE/api/auth/me"        '"user"'
# Catalogues : nécessitent une auth → 401 en déconnecté = route vivante + auth OK
# (un 500 de schéma remonterait ici au lieu du 401, donc ça reste un bon garde-fou).
check      "API badges (route+auth)"     "$BASE/api/badges"     401
check      "API wallpapers (route+auth)" "$BASE/api/wallpapers" 401
check      "API titles (route+auth)"     "$BASE/api/titles"     401
check      "Durcissement /sql/ bloqué"  "$BASE/sql/bdd_mysql.sql"  403

if [ "$fail" -eq 0 ]; then
  echo "── ✅ Smoke test OK ──"
  exit 0
else
  echo "── ❌ Smoke test ÉCHOUÉ (voir ci-dessus) ──"
  exit 1
fi
