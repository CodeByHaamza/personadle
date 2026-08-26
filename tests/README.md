<div align="center">

# 🧪 Tests & Qualité

<img src="https://img.shields.io/badge/Vitest-781%20passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest">
<img src="https://img.shields.io/badge/PHPUnit-logic%20%2B%20DB-3776AB?style=for-the-badge&logo=php&logoColor=white" alt="PHPUnit">
<img src="https://img.shields.io/badge/Playwright-13%20E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright">
<img src="https://img.shields.io/badge/PHPStan-niveau%205-1A1A1A?style=for-the-badge" alt="PHPStan">

> **Tous verts. Toujours.** Du test unitaire pur jusqu'au smoke E2E sur la stack Docker complète.

</div>

---

## 🔺 La pyramide de tests

```
                 ╱╲
                ╱  ╲      Playwright E2E — 102 tests (stack Docker réelle)
               ╱────╲     smoke (5) + API badges/streak (2) + Social Link ami→XP→rang (6)
              ╱      ╲
             ╱────────╲   PHPUnit — 193 méthodes (12 fichiers, dont intégration vraie MariaDB)
            ╱          ╲  contraintes SQL, FK cascade, contrat de schéma, streak/social/auth
           ╱────────────╲
          ╱              ╲ Vitest — 781 tests unitaires (jsdom, 38 fichiers)
         ╱────────────────╲ logique de jeu, streak, i18n, validation, sync
      ──────────────────────
```

Plus, en garde-fou statique : **PHPStan niveau 5** (analyse PHP) · **ESLint + Prettier** (JS) ·
**seuils de couverture** (échec CI si < 70 % lignes).

---

## 📁 Suites Vitest (`tests/`)

| Suite                            | Tests | Ce qu'elle couvre                                              |
| -------------------------------- | :---: | -------------------------------------------------------------- |
| `gameCore.test.js`               |  133  | dates Paris, streaks, filtres, normalisation des modes, reset  |
| `profileStats.test.js`           |  27   | stats locales, streak globale (frontière Paris, pas UTC)       |
| `social-link.test.js`           |  22   | jauge/rank-up Social Link, flamme, effet True Confidant (rang 10) |
| `validateCharacters.test.js`     |  22   | validateur de schéma des personnages (opus, arcane, âges)      |
| `backend.test.js`                |  20   | `buildGameSession`, `savePendingSession`, auth UI DOM, `syncPending` |
| `i18n.test.js`                   |  20   | résolution de clés, fallback, variables `{{var}}`              |
| `badgesManager.test.js`          |  19   | unlock, sélection (limite 4), codes événement, partage        |
| `friends.test.js`                |  18   | HTML escape, avatar path, `isOnline`/`formatLastSeen`          |
| `streakRecovery.test.js`         |  18   | menu Jack Frost, `performRecovery` (anti-revert)               |
| `modeComparisons.test.js`        |  17   | grille de comparaison Classic (âge, tableaux, booléens)        |
| `profilePage.test.js`            |  15   | couleurs hex, tiers de streak, temps de lecture, avatar        |
| `titlesUi.test.js`               |  15   | sélection/équipement des titres                                |
| `shareCard.test.js`              |  12   | export PNG de la carte de profil (html2canvas)                 |
| `wallpapersUi.test.js`           |  12   | sélection des fonds d'écran, sync backend                      |
| `modal.test.js`                  |  13   | ARIA, focus initial/restauré, trap Tab/Shift+Tab                |
| `auth.test.js`                   |  11   | `resolveLoginError`/`resolveRegisterError`                     |
| `formatPlayTime.test.js`         |  11   | formatage du temps de jeu (i18n)                               |
| `theme.test.js`                  |  10   | thèmes de couleur du profil                                     |
| `badgesConditions.test.js`       |   8   | conditions de déblocage de chaque badge (`badgesData.js`)      |
| `autocomplete.test.js`           |   8   | fermeture/suppression d'entrées d'autocomplétion                |
| `songPlayer.test.js`             |   7   | lecteur de musique de profil                                    |
| `langSelector.test.js`           |   5   | sélecteur de langue                                              |
| `profileFormat.test.js`          |   4   | formatage des données de profil                                 |
| `streakFlow.integration.test.js` |   2   | flux complet récupération + sync cloud                         |
| **Total**                        |**781**|                                                                |

## 🐘 Suites PHP (`tests/php/`)

| Suite                          | Type        | Ce qu'elle couvre                                          |
| ------------------------------ | ----------- | ---------------------------------------------------------- |
| `StreakTest.php`               | logique     | `personadle_compute_streak` (UTC→Paris, abandon, perfect)  |
| `SocialLinkTest.php`           | logique     | XP par action (solo/mutuel), rang à partir de seuils        |
| `ValidationTest.php`           | logique     | pseudo/mot de passe/langue (register, reset-password)        |
| `AuthzTest.php`                | logique     | décisions admin + session (deleted/banned) — porte de `requireAuth`/`requireAdmin` |
| `FormatUserTest.php`           | logique     | `formatUser()` — jamais de fuite de `password_hash`          |
| `AdminValidationTest.php`      | logique     | pseudo/couleur/code événement/rang/xp du panel admin          |
| `FriendsTest.php`              | logique     | format code ami, refus de doublon/blocage de demande          |
| `DatabaseIntegrationTest.php`  | intégration | unicité, CHECK, FK cascade, **contrat de schéma** (35 tests)|

> **193 méthodes de test** au total sur ces 12 fichiers. Les tests d'intégration tournent dans
> une transaction annulée (`rollBack`) → zéro pollution. Si la DB n'est pas joignable, ils sont
> **skippés** (la suite reste verte).

## 🎭 E2E Playwright (`tests-e2e/`)

- `smoke.spec.js` — 5 parcours sur la stack Docker (DB seedée) : accueil, All-Out Attack,
  leaderboard (faux joueurs visibles), profil public sans login, **login complet via la modale**.
- `api.spec.js` — 2 tests via l'API : persistance des badges épinglés (PATCH → GET),
  streak globale cross-mode qui ne s'effondre pas.
- `social-link.spec.js` — 6 tests : parcours ami → interaction mutuelle → XP → montée de
  rang, garde-fou "Not friends", anti-spam (1 action/jour).

---

## 🚀 Lancer les tests

```bash
npm install              # une seule fois

npm test                 # Vitest (781)
npm run test:watch       # Vitest en mode watch
npm run test:coverage    # Vitest + seuils de couverture

make up                  # démarre la stack Docker (DB + seed)
make test-php            # PHPUnit (logique + intégration DB)
npm run test:e2e         # Playwright (nécessite la stack Docker)

make check               # lint + data-check + i18n-check (tout d'un coup)
```

> En CI (GitHub Actions), tout ça tourne à chaque push : lint → i18n → data → coverage →
> PHPUnit (avec MariaDB) → PHPStan.

---

## 🧠 Philosophie

- **Unitaire d'abord** : chaque fonction testée isolément, sans état global.
- **jsdom** simule le navigateur (DOM, `localStorage`, `window`) sans en ouvrir un vrai.
- **Faux timers** (`vi.useFakeTimers()`) pour tester `setTimeout` instantanément.
- **Logique pure extraite** (ex : `api/lib/streak.php`) → testable sans MySQL.
- **Contrat de schéma** : un test échoue si `bdd_mysql.sql` dérive du code (colonne/table
  utilisée mais absente) — le garde-fou anti-régression Docker↔code.

## ➕ Ajouter un test

1. Crée/modifie un fichier dans `tests/` (globals Vitest : `describe`, `it`, `expect`, `vi`).
2. Tests DOM → `document.body.innerHTML = "…"`. Tests `localStorage` → `localStorage.clear()` en `beforeEach`.
3. **Tout nouvel utilitaire dans `js/gameCore.js` → tests obligatoires** (cf. CLAUDE.md §8).
