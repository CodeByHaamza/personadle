# Tests E2E (Playwright)

Tests end-to-end qui pilotent un vrai navigateur. **Optionnels** : non lancés par
`npm test` (Vitest, unitaire/intégration) ni par la CI par défaut.

## Installation (une fois)

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

## Lancer

```bash
npm run test:e2e
```

Le `webServer` de [playwright.config.js](../playwright.config.js) sert le site statique
sur `http://localhost:8080` (via `python3 -m http.server`).

## Pages nécessitant le backend

Les parcours qui touchent l'API (login, sync cloud, sessions…) ont besoin du backend
PHP. Lancer en parallèle :

```bash
php -S localhost:8000   # depuis la racine, avec api/config.php configuré
```

puis adapter `baseURL` ou les routes API dans les specs.

## Idées de scénarios à ajouter

- Parcours de jeu complet (deviner → victoire → stats mises à jour)
- Ouverture du menu de récupération Jack Frost + restauration
- Changement de langue (FR/EN/ES/DE/IT) et persistance
- Responsive (mobile viewport) sur les 6 modes
