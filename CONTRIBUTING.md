# Contribuer à PersonaDLE

Guide d'onboarding rapide pour développer en local et garder le projet sain.

---

## 🚀 Démarrer en local (Docker)

```bash
make install        # deps npm + git hooks (une fois)
make up             # DB + PHP + phpMyAdmin (site http://localhost:8080)
```

- **Site** : http://localhost:8080 (ou le port de `APP_PORT`)
- **phpMyAdmin** : http://localhost:8081
- La BDD est **auto-seedée** au premier démarrage : schéma + **19 faux joueurs**
  thématiques Persona (générés par `scripts/gen_seed_dev.mjs`).
- **Login de test** : `ren@personadle.seed` … `wonder@personadle.seed` /
  mot de passe commun **`test1234`** (ou crée ton compte).

### Port 8080 déjà pris ?
Mets `APP_PORT=8090` dans un fichier **`.env`** à la racine (copié de
`.env.example`, gitignoré) — Docker Compose le lit automatiquement, plus besoin
de retaper la variable.

```bash
make down                 # arrêter
docker compose down -v    # reset complet (efface la BDD → re-seed au prochain up)
```

---

## ✅ Avant de committer

```bash
make check          # = CI : lint + data:check + i18n + tests JS + PHPUnit
```

Le hook de pre-commit lance déjà i18n + tests. Détail :

| Commande | Vérifie |
|---|---|
| `make test` / `npm test` | 725 tests JS (Vitest) |
| `make test-php` | 193 méthodes de test PHPUnit dans 12 fichiers (logique + intégration BDD). Tourne **dans le conteneur Docker** (`make up` requis) — pas besoin de PHP installé sur ta machine |
| `npm run lint` | ESLint |
| `npm run data:check` | schéma des données personnages |
| `npm run i18n:check` | cohérence des clés de traduction |

---

## 🗄️ Règle d'OR : le schéma

> **`sql/bdd_mysql.sql` est la SOURCE UNIQUE du schéma.** C'est lui que charge
> Docker et il doit refléter la prod.

Toute nouvelle **colonne / table / contrainte** doit être ajoutée à
`sql/bdd_mysql.sql` (en plus d'une éventuelle migration dans `sql/migrations/`).
Sinon Docker diverge du code → erreurs `Unknown column` (déjà vécu avec
`is_admin`, `uq_session_per_day`, `social_link_rankup_notifs`).

Le test `tests/php/DatabaseIntegrationTest.php` garde-fou cette cohérence en CI
(tables + colonnes critiques). Les fichiers de `sql/migrations/` sont des
**archives historiques**, pas la source.

---

## 🌿 Workflow Git

- **`develop`** = branche de travail (toutes les features).
- **`main`** = production (le déploiement Hostinger se fait **uniquement** depuis
  `main`, via `.github/workflows/cd.yml`, manuel).
- Flux : feature → `develop` → (PR) → `main`.

### Protéger `main` (à faire une fois, réglages GitHub)
Settings → Branches → Add rule sur `main` :
- ✅ Require a pull request before merging
- ✅ Require status checks to pass (sélectionner les jobs CI)
- ✅ Do not allow bypassing

Ou en CLI :
```bash
gh api -X PUT repos/HamzaKarrouchi/personadle/branches/main/protection \
  -F required_pull_request_reviews.required_approving_review_count=0 \
  -F required_status_checks.strict=true \
  -F enforce_admins=true -F restrictions=
```

### Messages de commit
Convention : `type(scope): description` (`feat`, `fix`, `test`, `docs`, `chore`).

### Séparer refactor mécanique et changement de comportement
> Retour de review PR #9 (2026-07-05) : une PR décrite comme "factorisation, comportement
> inchangé" contenait aussi une restriction CORS en prod et un nouveau rate-limit — deux vrais
> changements de comportement noyés dans un résumé qui annonçait un refactor sans risque. Un
> relecteur qui fait confiance à la description sans tout relire ligne à ligne passe à côté.

**Règle** : un changement de comportement (sécurité, rate-limit, politique CORS, validation,
etc.) — même petit, même bon — a **sa propre ligne dans le résumé de la PR**, idéalement **son
propre commit**, séparé des refactors mécaniques "comportement strictement inchangé". Ça permet
de relire/approuver les deux à des niveaux d'attention différents au lieu de tout mélanger sous
une étiquette "sans risque".

---

## 🎨 Conventions

- **Fichiers** : `snake_case` pour les nouveaux fichiers (stabilité cross-OS).
- **JS** : ES6+, réutiliser `js/gameCore.js` ; vocabulaire des modes via
  `normalizeModeKey()` / `modeLabel()`.
- **PHP** : PDO préparé **obligatoire** (jamais de concaténation SQL), bcrypt,
  codes HTTP corrects, `requireAuth()`/`requireAdmin()` sur les endpoints d'état.
- **i18n** : ajouter la clé dans `lang/en.json` (source de vérité) en premier.
- **Tout ajout/correction notable** → documenter dans deux fichiers distincts (voir CLAUDE.md §9),
  dans le dossier de la version **en cours** (aujourd'hui la 2.1) :
  `PersonaDLE_Update_Documentation/PersonaDLE 2.1/DEV_CHANGELOG.md` (changelog dev, détail par
  commit) et, seulement si le changement est visible pour un joueur,
  `PersonaDLE_Update_Documentation/PersonaDLE 2.1/PersonaDLE_Update.html` (changelog joueur,
  highlights). Le dossier `PersonaDLE 2.0/` ne reçoit plus que des correctifs de la 2.0 en
  prod. Il n'existe pas de `PersonaDLE_Update.md` pour la v2.0 ni la v2.1.

Voir `CLAUDE.md` pour les pièges critiques détaillés.
