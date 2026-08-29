# =============================================================================
# PersonaDLE — Makefile
# Raccourcis pour le dev quotidien : tests, qualité, base de données, serveur.
# Lancer `make` (ou `make help`) pour la liste des cibles.
# =============================================================================

# Pas de SHELL forcé (ex: /bin/bash) : toutes les cibles n'utilisent que des
# commandes npm/php/docker/node — aucune syntaxe shell POSIX (test, wget, rm,
# grep|sort|awk…) — donc `make` fonctionne avec le shell par défaut de chaque
# plateforme (sh sur Linux/Mac, cmd.exe sur Windows natif sans Git Bash/WSL).
.DEFAULT_GOAL := help

PHPUNIT_PHAR := phpunit.phar
PHPUNIT_URL  := https://phar.phpunit.de/phpunit-11.phar
DC           := docker compose

# Coordonnées de la base VUES DEPUIS LE CONTENEUR php. Les tests d'intégration
# (ConditionCheckTest, DatabaseIntegrationTest, ExpertUnlocksTest, StreakTest…)
# retombent sinon sur leur défaut host-side 127.0.0.1:3307, injoignable depuis le
# conteneur : ils se marquaient alors « skipped » et `make test-php` sortait vert
# avec 106 tests sur 215 jamais exécutés. La CI, elle, passe déjà ces variables
# (job lint-php de .github/workflows/ci.yml) — d'où un local plus permissif que
# la CI, exactement l'inverse de ce qu'on veut.
#
# Valeurs en dur volontairement : ce fichier ne doit contenir aucune syntaxe
# shell POSIX (cf. en-tête), donc pas de `$${VAR:-defaut}`. Ce sont les défauts
# de docker-compose.yml — les surcharger revient à passer les variables à la main.
PHPUNIT_DB_ENV := -e DB_TEST_HOST=db -e DB_TEST_PORT=3306 -e DB_TEST_NAME=personadle_db -e DB_TEST_USER=root -e DB_TEST_PASS=rootpassword

# ---------------------------------------------------------------------------
# Aide (cible par défaut)
# ---------------------------------------------------------------------------
.PHONY: help
help: ## Affiche cette aide
	@node scripts/make_help.js

# ---------------------------------------------------------------------------
# Installation
# ---------------------------------------------------------------------------
.PHONY: install
install: ## Installe les dépendances npm + active les git hooks
	npm ci
	npm run setup-hooks

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
.PHONY: test
test: ## Lance les tests JS (Vitest, une fois)
	npm test

.PHONY: test-watch
test-watch: ## Lance Vitest en mode watch
	npm run test:watch

.PHONY: coverage
coverage: ## Tests JS avec rapport de couverture
	npm run test:coverage

.PHONY: $(PHPUNIT_PHAR)
$(PHPUNIT_PHAR): ## Télécharge phpunit.phar s'il est absent
	@node scripts/download_phpunit.js $(PHPUNIT_PHAR) $(PHPUNIT_URL)

.PHONY: test-php
test-php: $(PHPUNIT_PHAR) ## Lance les tests backend (PHPUnit, via Docker — `make up` requis)
	$(DC) exec -T $(PHPUNIT_DB_ENV) php php $(PHPUNIT_PHAR)

.PHONY: test-all
test-all: test test-php ## Lance tous les tests (JS + PHP)

# ---------------------------------------------------------------------------
# Qualité
# ---------------------------------------------------------------------------
.PHONY: lint
lint: ## ESLint sur le code JS
	npm run lint

.PHONY: format
format: ## Formate le code (Prettier, écriture)
	npm run format

.PHONY: format-check
format-check: ## Vérifie le formatage (Prettier, lecture seule)
	npm run format:check

.PHONY: i18n
i18n: ## Vérifie la cohérence des clés i18n
	npm run i18n:check

.PHONY: data
data: ## Valide le schéma des données personnages
	npm run data:check

.PHONY: check
check: lint data i18n test test-php ## Tout vérifier (comme la CI) : lint + data + i18n + tests JS + PHP
	@echo "✅ Toutes les vérifications sont passées."

# ---------------------------------------------------------------------------
# Base de données + serveur (Docker)
# ---------------------------------------------------------------------------
.PHONY: up
up: ## Démarre la stack Docker (site:8080, BDD:3307, phpMyAdmin:8081)
	$(DC) up -d
	@echo "→ Site       : http://localhost:8080"
	@echo "→ phpMyAdmin : http://localhost:8081"

.PHONY: down
down: ## Arrête la stack Docker
	$(DC) down

.PHONY: restart
restart: down up ## Redémarre la stack Docker

.PHONY: logs
logs: ## Affiche les logs Docker (suivi)
	$(DC) logs -f

.PHONY: db-shell
db-shell: ## Ouvre un shell MariaDB dans le conteneur
	$(DC) exec db mariadb -u root -p personadle_db

.PHONY: db-import
db-import: ## (Ré)importe le schéma SQL dans le conteneur
	$(DC) exec -T db mariadb -u root -p personadle_db < sql/bdd_mysql.sql

# ---------------------------------------------------------------------------
# Nettoyage
# ---------------------------------------------------------------------------
.PHONY: clean
clean: ## Supprime les artefacts de test/CI locaux
	node scripts/clean_artifacts.js $(PHPUNIT_PHAR) .phpunit.cache coverage
