# tests/ — Suite de tests unitaires

Ce dossier contient les tests automatisés de Personadle, écrits avec **[Vitest](https://vitest.dev/)**.

## Structure

```
tests/
└── gameCore.test.js   ← tests de toutes les fonctions exportées par js/gameCore.js
```

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

| Fichier | Rôle |
|---------|------|
| `package.json` | Définit les scripts `test` et `test:watch`, déclare Vitest comme dépendance |
| `vitest.config.js` | Configure l'environnement **jsdom** (simule `window`, `document`, `localStorage`) et les globals (`describe`, `it`, `expect`, `vi`) |

---

## Couverture de `gameCore.test.js`

| Fonction testée | Nombre de cas | Ce qui est vérifié |
|-----------------|:-------------:|--------------------|
| `parisDateKey` | 5 | Format YYYY-MM-DD, heure d'été, heure d'hiver, dates consécutives |
| `msUntilNextParisMidnight` | 3 | Valeur positive, ≤ 24h, type number |
| `normalize` | 7 | Minuscules, accents, apostrophes typographiques, guillemets, espaces, cas réels |
| `showConfettiExplosion` | 5 | Nombre d'éléments créés, suppression après 1s, valeur par défaut, Audio.play() |
| `revealNextLink` | 5 | Display flex, onclick wired, visibilité bouton prev, scroll après 1,5s |
| `setupRulesModal` | 4 | Ouverture, fermeture ×, fermeture backdrop, no-op si absent |
| `setupDailyReset` | 3 | Timer retourné, pas d'appel immédiat, appel après 24h |
| `checkResetOnLoad` | 5 | Reset si nouveau jour, pas de reset si même jour, nettoyage stats veille |
| `setupFilterButtons` | 4 | Callback appelé, tableau des actifs, localStorage, toggle class |
| `showWrongMini` | 6 | Élément ajouté, src/alt, shake après 50ms, multiple ajouts, fallback erreur, no-op si null |

**Total : 47 tests — 47 passants ✅**

---

## Philosophie des tests

- **Tests unitaires** : chaque fonction est testée isolément, sans dépendance à l'état global.
- **jsdom** : simule un environnement navigateur (DOM, localStorage, window) sans ouvrir de vrai navigateur.
- **`vi.useFakeTimers()`** : permet de tester `setTimeout` instantanément sans attendre.
- **`vi.stubGlobal("Audio", ...)`** : évite les erreurs jsdom sur `new Audio().play()`.

---

## Ajouter un test

1. Créer ou modifier un fichier dans `tests/`.
2. Utiliser les globals Vitest : `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`.
3. Pour les tests DOM : utiliser `document.body.innerHTML = "..."` pour injecter le HTML nécessaire.
4. Pour les tests `localStorage` : appeler `localStorage.clear()` dans `beforeEach`.
