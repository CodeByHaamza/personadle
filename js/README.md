<div align="center">

# ⚙️ Utilitaires partagés

> **Le cœur logique de tous les modes — dates DST-safe, confettis, filtres, sessions cloud.**

</div>

Ce dossier contient le **cœur logique commun** à tous les modes de jeu de Personadle.

## Fichier

| Fichier | Rôle |
|---------|------|
| `gameCore.js` | Module ES6 exportant toutes les fonctions réutilisées par les 6 modes |

---

## Architecture

Avant ce refactoring, chaque mode de jeu (Classique, Emoji, Silhouette…) contenait sa propre copie de fonctions identiques : confettis de victoire, reset quotidien, modal des règles, etc. `gameCore.js` centralise tout cela pour appliquer le principe **DRY** (_Don't Repeat Yourself_).

```
js/
└── gameCore.js          ← importé par les 6 fichiers de mode
```

Chaque mode importe uniquement ce dont il a besoin :
```js
import { normalize, showConfettiExplosion, revealNextLink } from "../js/gameCore.js";
```

---

## API exportée

### Gestion des dates (fuseau Paris, heure d'été incluse)

#### `parisDateKey(d?)`
Retourne la date du jour au format `"YYYY-MM-DD"` en heure de Paris.
Résistant au passage heure d'été / heure d'hiver grâce à `Intl.DateTimeFormat`.

```js
parisDateKey()                          // "2025-07-14"
parisDateKey(new Date("2025-01-01"))    // "2025-01-01"
```

#### `msUntilNextParisMidnight()`
Retourne le nombre de millisecondes jusqu'au prochain minuit parisien.
Utilisé pour programmer le reset automatique quotidien.

---

### Normalisation de texte

#### `normalize(str)`
Transforme une chaîne en minuscules, sans accents ni apostrophes typographiques.
Utilisé pour comparer la saisie du joueur au titre cible sans être sensible à la casse ou aux accents.

```js
normalize("Brûle, ma Peine !") // "brule, ma peine !"
normalize("Never More")        // "never more"
```

---

### Victoire & confettis

#### `showConfettiExplosion(opts?)`
Joue le son de victoire et lance une animation de confettis emoji.

| Option | Défaut | Description |
|--------|--------|-------------|
| `emojiList` | `["🎉","🎊","✨","💥","🌟"]` | Liste des emojis utilisés |
| `count` | `40` | Nombre de particules |
| `spreadFrom` | `"sides"` | `"sides"` = des bords gauche/droite, `"bottom"` = du bas |

- **`"sides"`** : utilisé par Classique, Emoji, Silhouette, AllOutAttack
- **`"bottom"`** : utilisé par Personae et Musique (plus de profondeur)

---

### Navigation entre modes

#### `revealNextLink({ nextHref, prevHref })`
Rend visible la barre de navigation entre les modes (boutons Précédent / Suivant) après une victoire ou un abandon.

---

### Modal des règles

#### `setupRulesModal()`
Câble le bouton `?` pour ouvrir / fermer la fenêtre modale d'explication des règles.

---

### Reset quotidien

#### `setupDailyReset(onReset)`
Programme un `setTimeout` qui déclenche `onReset` au prochain minuit parisien + 500 ms de marge.

#### `checkResetOnLoad(lastPlayedKey, statsModeKey, onReset)`
Vérifie au chargement de la page si un nouveau jour a commencé depuis la dernière visite.
Si oui : nettoie la clé de stats de la veille et appelle `onReset`.

---

### Filtres opus

#### `setupFilterButtons(storageKey, onFilterChange)`
Câble les boutons `.filter-btn` (P3, P4, P5…) :
- Bascule la classe `active` au clic
- Persiste le tableau des filtres actifs dans le `localStorage`
- Appelle `onFilterChange(nouveauxFiltres)`

---

### Mauvaise réponse

#### `showWrongMini(imageSrc, altText, wrongListEl, fallbackSrc?)`
Ajoute une mini-vignette portrait dans la liste des mauvaises réponses, avec une animation de tremblement (_shake_).

---

## Tests

Toutes les fonctions exportées sont couvertes par des tests unitaires dans [`tests/gameCore.test.js`](../tests/README.md).

```
npm test
```
