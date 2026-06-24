<div align="center">

# 🧪 Tests

> **242 tests JS + 7 tests PHP. Tous verts. Toujours.**

</div>

Ce dossier contient les tests automatisés de PersonaDLE, écrits avec **[Vitest](https://vitest.dev/)**
(JS) et **PHPUnit** (backend).

## Structure

```
tests/
├── gameCore.test.js              ← logique de jeu, dates, streaks, filtres, normalisation, modes…
├── backend.test.js               ← buildGameSession, savePendingSession, auth UI DOM
├── i18n.test.js                  ← résolution de clés, fallback, variables
├── profileStats.test.js          ← stats locales, streak (frontière Paris)
├── streakRecovery.test.js        ← menu Jack Frost, performRecovery (anti-revert)
├── streakFlow.integration.test.js← flux complet récup + sync cloud
├── validateCharacters.test.js    ← validateur de schéma des personnages
├── formatPlayTime.test.js        ← formatage du temps de jeu (i18n)
└── php/StreakTest.php            ← logique de streak serveur (PHPUnit, sans DB)
```

> Total : **242 tests Vitest** + **7 tests PHPUnit**.

---

## Lancer les tests

```bash
# Installer les dépendances (à faire une seule fois)
npm install

# Lancer tous les tests une seule fois
npm test

# Mode watch (relance automatiquement à chaque sauvegarde)
npm run test:watch
```

---

## Configuration

| Fichier            | Rôle                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`     | Définit les scripts `test` et `test:watch`, déclare Vitest comme dépendance                                                         |
| `vitest.config.js` | Configure l'environnement **jsdom** (simule `window`, `document`, `localStorage`) et les globals (`describe`, `it`, `expect`, `vi`) |

---

## Couverture — `gameCore.test.js` (172 tests)

| Fonction testée            | Cas | Ce qui est vérifié                                                       |
| -------------------------- | :-: | ------------------------------------------------------------------------ |
| `parisDateKey`             |  5  | Format YYYY-MM-DD, heure d'été, heure d'hiver, dates consécutives        |
| `msUntilNextParisMidnight` |  3  | Valeur positive, ≤ 24h, type number                                      |
| `normalize`                |  7  | Minuscules, accents, apostrophes typographiques, guillemets, espaces     |
| `showConfettiExplosion`    |  5  | Nombre d'éléments créés, suppression après 1s, Audio.play()              |
| `revealNextLink`           |  5  | Display flex, onclick wired, scroll après 1,5s                           |
| `setupRulesModal`          |  4  | Ouverture, fermeture ×, fermeture backdrop, no-op si absent              |
| `setupDailyReset`          |  3  | Timer retourné, pas d'appel immédiat, appel après 24h                    |
| `checkResetOnLoad`         |  5  | Reset si nouveau jour, pas de reset si même jour, nettoyage stats veille |
| `setupFilterButtons`       |  4  | Callback appelé, tableau des actifs, localStorage, toggle class          |
| `showWrongMini`            |  6  | Élément ajouté, src/alt, shake, multiple ajouts, fallback erreur         |
| Streaks & stats            | 22  | Calcul streak, streak record, perfect wins, giveups, playtime            |
| Filtres & normalisation    | 18  | FILTER_STORAGE_KEYS, migration filtres, cas edge DST                     |
| `buildGameSession`         | 12  | Structure payload, modes, filtres actifs, offline flag                   |
| Autres utilitaires         | 73  | getRandomIndex, LRU cache, date edge cases, i18n fallback…               |

**Total : 172 tests — 172 passants ✅**

---

## Couverture — `backend.test.js` (18 tests)

| Suite                | Cas | Ce qui est vérifié                                                                      |
| -------------------- | :-: | --------------------------------------------------------------------------------------- |
| `buildGameSession`   |  6  | Payload correct, mode normalisé, filtres sérialisés                                     |
| `savePendingSession` |  7  | Envoi API, fallback localStorage si offline, retry à la reconnexion, 409 silencieux     |
| Auth UI DOM          |  5  | Login, register, logout — événements `personadle:auth-login` / `personadle:auth-logout` |

**Total : 18 tests — 18 passants ✅**

---

## Grand total : 242 tests Vitest + 7 PHPUnit — tous passants ✅

> Les sections détaillées ci-dessus couvrent les deux suites historiques ; les 6 suites
> ajoutées depuis (i18n, profileStats, streak, validation, formatPlayTime, PHP) suivent
> la même philosophie. Lancer `npm test` pour le compte exact à jour.

---

## Philosophie des tests

- **Tests unitaires** : chaque fonction testée isolément, sans dépendance à l'état global.
- **jsdom** : simule un environnement navigateur (DOM, localStorage, window) sans ouvrir de vrai navigateur.
- **`vi.useFakeTimers()`** : permet de tester `setTimeout` instantanément sans attendre.
- **`vi.stubGlobal("Audio", ...)`** : évite les erreurs jsdom sur `new Audio().play()`.
- **`savePendingSession` est async fire-and-forget** côté appelant — les callers sont des event handlers non-async, c'est voulu. Les tests attendent explicitement la résolution de la Promise.

---

## Ajouter un test

1. Créer ou modifier un fichier dans `tests/`.
2. Utiliser les globals Vitest : `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`.
3. Pour les tests DOM : utiliser `document.body.innerHTML = "..."` pour injecter le HTML nécessaire.
4. Pour les tests `localStorage` : appeler `localStorage.clear()` dans `beforeEach`.
5. Tout nouvel utilitaire dans `js/gameCore.js` → ajouter les tests correspondants dans `gameCore.test.js`.
