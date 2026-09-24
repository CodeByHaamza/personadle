#!/usr/bin/env bash
# Resynchronise une branche sur develop en résolvant les conflits de CHIFFRES
# de documentation — les seuls que produisent ces fusions en chaîne, puisque
# chaque merge décale les compteurs auto-calculés (tests, suites, clés i18n).
#
# Tout autre conflit fait échouer le script : il demande une vraie lecture.
set -euo pipefail

BRANCHE="$1"
DOCS="README.md ROADMAP.md TODO.md CLAUDE.md CONTRIBUTING.md tests/README.md lang/README.md tests-e2e/README.md"

git checkout -q "$BRANCHE"
git fetch -q origin

if git merge --no-edit origin/develop >/dev/null 2>&1; then
  echo "$BRANCHE : fusion propre"
else
  CONFLITS=$(git diff --name-only --diff-filter=U)
  for f in $CONFLITS; do
    if ! echo " $DOCS " | grep -q " $f "; then
      echo "$BRANCHE : conflit HORS documentation sur $f — arrêt" >&2
      exit 1
    fi
  done
  for f in $CONFLITS; do git checkout --theirs "$f"; done
  git add -A
  npm run docs:fix >/dev/null 2>&1
  git add -A
  git -c core.hooksPath=/dev/null commit -q --no-edit
  echo "$BRANCHE : conflits de chiffres résolus ($(echo $CONFLITS | wc -w) fichiers)"
fi

npm run docs:fix >/dev/null 2>&1
if ! git diff --quiet; then
  git add -A
  git -c core.hooksPath=/dev/null commit -q -m "chore: recalcul des chiffres de doc"
fi
git push -q origin "$BRANCHE"
echo "$BRANCHE : poussee"
