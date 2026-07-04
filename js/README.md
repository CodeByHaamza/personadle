<div align="center">

# 🧩 JavaScript

<img src="https://img.shields.io/badge/Vanilla%20JS-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS">
<img src="https://img.shields.io/badge/0-dépendances-success?style=for-the-badge" alt="Zéro dépendance">
<img src="https://img.shields.io/badge/modules-ES6-blue?style=for-the-badge" alt="ES6 modules">

> **Le cerveau du front : logique de jeu partagée, client REST, sync cloud, social & animations.**
> Aucun framework, aucune lib externe — juste des modules ES6.

</div>

---

## 🗺️ Carte des modules

### Cœur

| Fichier         | Rôle                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `gameCore.js`   | Utilitaires partagés par les 6 modes (dates Paris, normalisation, sessions)|
| `api.js`        | Client REST + bridge `window._personadleApi` (anti-import-circulaire)      |
| `i18n.js`       | Chargement des langues, `t('key', { vars })`, fallback                     |

### Auth & synchronisation

| Fichier             | Rôle                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `auth.js`           | Login / register / logout, modales (focus trap + Escape), état UI     |
| `cloud-sync.js`     | `pullProfileFromCloud()` — le **backend est la source de vérité**     |
| `streak-recovery.js`| Menu Jack Frost, `performRecovery()` (attend le backend, anti-revert) |

### Social, défis & notifications

| Fichier               | Rôle                                              |
| --------------------- | ------------------------------------------------- |
| `social-link.js`      | Rangs 1-10 (Stranger → True Confidant), XP, halo  |
| `challenge-banner.js` | Bannière de défi quotidien                        |
| `challenge-notif.js`  | Réception / acceptation d'un défi                 |
| `challenge-result.js` | Comparaison des résultats d'un défi               |
| `notifications.js`    | Cloche de notifications (défis, amis, rank-ups)   |
| `divine-gift.js`      | Animation de don d'objets par un admin            |

### Animations d'amitié

| Fichier             | Rôle                                          |
| ------------------- | --------------------------------------------- |
| `calling-card.js`   | Carte de visite façon Phantom Thieves         |
| `p3-evoker-anim.js` | Demande d'ami façon Evoker (Persona 3)        |
| `tv-friend-anim.js` | Demande d'ami façon TV (Persona 4)            |

### Interface

| Fichier             | Rôle                                          |
| ------------------- | --------------------------------------------- |
| `bottomNav.js`      | Barre de navigation inférieure                |
| `filterMenu.js`     | Menu de filtres opus (P3, P4, P5…), utilisé par les 6 modes |
| `settings-modal.js` | Modale de paramètres (langue, thème, a11y)    |
| `stats-compare.js`  | Comparaison de stats entre amis               |
| `autocomplete.js`   | Fermeture/suppression d'entrées de la liste d'autocomplétion |
| `lang-selector.js`  | Sélecteur de langue (dropdown drapeaux)        |
| `modal.js`          | Utilitaire générique de modale (focus trap, Escape, restauration du focus) — réutilisé par avatarCropModal/sharePreviewModal/songModal/titlesModal |

---

## ⭐ `gameCore.js` — l'API partagée

Centralise tout ce qui était dupliqué dans chaque mode (principe **DRY**). Chaque mode importe
seulement ce dont il a besoin :

```js
import { parisDateKey, normalize, modeLabel, buildGameSession } from "../js/gameCore.js";
```

| Fonction                          | Rôle                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `parisDateKey(d?)`                | Date `"YYYY-MM-DD"` en heure de Paris, **DST-safe** (`Intl.DateTimeFormat`)|
| `msUntilNextParisMidnight()`      | ms jusqu'au prochain minuit parisien (reset quotidien)                   |
| `normalize(str)`                  | minuscules, sans accents ni apostrophes typographiques (comparaison)     |
| `MODES` / `normalizeModeKey()` / `modeLabel()` | Vocabulaire **canonique** des modes (clé backend ↔ libellé)  |
| `buildGameSession(...)`           | Construit le payload d'une partie (mode normalisé, filtres, flag offline)|
| `savePendingSession(...)`         | Envoie la session à l'API, fallback `localStorage` si offline (409 silencieux)|
| `getDailyTarget(...)`             | Personnage cible du jour (déterministe par date Paris)                   |
| `showConfettiExplosion(opts?)`    | Son de victoire + confettis (`spreadFrom: "sides" \| "bottom"`)          |
| `revealNextLink(...)`             | Affiche la navigation Précédent / Suivant après une partie              |
| `setupRulesModal()`               | Câble le bouton `?` (ouverture/fermeture de la modale de règles)        |
| `setupDailyReset(onReset)`        | `setTimeout` jusqu'à minuit Paris → `onReset`                            |
| `checkResetOnLoad(...)`           | Détecte un nouveau jour au chargement, nettoie les stats de la veille    |
| `setupFilterButtons(...)`         | Boutons de filtres opus : toggle, persistance `localStorage`, callback — exporté mais non utilisé aujourd'hui, les 6 modes passent par `initFilterMenu()` (`filterMenu.js`) |
| `showWrongMini(...)`              | Mini-vignette portrait + animation _shake_ pour une mauvaise réponse     |
| `getPlayerSeedId()`               | ID stable par joueur (user_id ou UUID anonyme) pour `getDailyTarget()`   |
| `showCommunityStats(mode, target)`| Injecte "X% des joueurs ont trouvé ça aujourd'hui" dans l'écran de victoire |
| `FILTER_STORAGE_KEYS`             | Table des clés `localStorage` des filtres opus, par mode                 |
| `showChallengeButton(mode, score)`| Affiche le bouton "Défier un ami" après une partie                      |

> ⚠️ **Toujours** passer par `normalizeModeKey()` / `modeLabel()` pour le nom d'un mode, jamais
> de chaîne en dur. Pour la frontière de journée : `parisDateKey()`, jamais `toISOString()`.

---

## 🔗 Bridge anti-circulaire

`gameCore.js` ↔ `api.js` se référencent mutuellement. Pour éviter l'import circulaire ES6, `api.js`
expose `window._personadleApi` et `gameCore.js` l'utilise via ce pont plutôt qu'un `import` direct.

## 🧪 Tests

Les utilitaires de `gameCore.js` sont couverts dans [`tests/gameCore.test.js`](../tests/README.md)
(133 tests). **Tout nouvel utilitaire `gameCore.js` → tests obligatoires** (CLAUDE.md §8).

```bash
npm test
```
