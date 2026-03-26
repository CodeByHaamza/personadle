# personaeMode/ — Mode Personae

Le mode Personae propose de **deviner une Persona** (l'esprit invoqué par les protagonistes) plutôt qu'un personnage humain. Le joueur voit l'image de la Persona et doit la reconnaître.

![Aperçu du mode Personae](../img/preview/preview_personae.png)

---

## Principe du jeu

1. L'image d'une Persona est affichée (artwork officiel).
2. Le joueur saisit le nom de la Persona dans la barre de recherche.
3. Pas de tableau de comparaison — la mécanique est proche du mode Silhouette mais sans le masquage.
4. Après 3 mauvaises réponses, le bouton **Abandonner** se déverrouille.
5. Les **Personas Picaro** (variantes noires exclusives aux jeux crossover) sont incluses.

---

## Structure du dossier

```
personaeMode/
├── personae.html              ← page HTML du mode
├── personae.css               ← styles spécifiques
├── modePersonae.js            ← logique du jeu (module ES6)
└── database/
    ├── personaeCharacters.js    ← liste des Personas disponibles
    ├── persona.js               ← données complètes des Personas
    ├── portraitsMapPersonae.js  ← correspondance nom → image
    └── img/                     ← artworks des Personas
```

---

## `modePersonae.js`

Importe depuis `../js/gameCore.js` :
- `showConfettiExplosion` — avec `{ count: 30, spreadFrom: "bottom" }` (style montée du bas)
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`
- `setupFilterButtons`
- `showWrongMini`

> **Confettis style "bottom"** : contrairement aux autres modes, les confettis montent du bas de l'écran en positions aléatoires, évoquant une invocation de Persona.

### Filtres disponibles

Les filtres permettent de limiter le pool de Personas par jeu d'origine. Les **Personas Picaro** sont un filtre séparé car elles n'appartiennent à aucun opus principal.

### Anti-répétition avec token

`pickCharacter()` utilise un **token de génération** (`_pickToken`) pour éviter les race conditions : si un nouveau personnage est sélectionné pendant le chargement d'un précédent (via filtre par exemple), le résultat obsolète est ignoré.

### Badges

| Badge | Condition |
|-------|-----------|
| Twin Blade | Deviner la Persona "Kaguya Picaro" |
| Crimson Legacy | Deviner une Persona liée à un opus spécifique |

### Fonctions spécifiques

| Fonction | Description |
|----------|-------------|
| `getFilteredCharacters()` | Retourne les Personas selon les filtres actifs |
| `pickCharacter()` | Sélectionne aléatoirement une Persona avec anti-répétition (derniers 5) |
| `initializeAutocomplete()` | Dropdown avec flag `_guessed` pour masquer les déjà proposées |
| `showVictory()` | Victoire avec badges, stats, confettis montants |
| `showWrong()` | Affiche la vignette de la mauvaise Persona |
| `handleGuess()` | Vérifie la saisie |
| `giveUp()` | Abandonne et révèle la bonne réponse |
| `resetGame()` | Remet à zéro et choisit une nouvelle Persona |
| `applyDarkModeStyles()` | Ajustements dark mode |

### Debug

```js
// Dans la console du navigateur :
debugAllPersonae()   // Vérifie que toutes les Personas ont une image valide
```

---

## `database/` (local)

| Fichier | Contenu |
|---------|---------|
| `personaeCharacters.js` | Tableau des Personas jouables dans ce mode |
| `persona.js` | Données complètes (arcane, opus, variante Picaro…) |
| `portraitsMapPersonae.js` | Correspondance nom → chemin vers l'artwork |
| `img/` | Artworks des Personas (WebP optimisé) |

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `personaeTarget` | Persona cible (JSON) |
| `personaeAttempts` | Nombre d'essais |
| `personaeGameOver` | `"true"` si partie terminée |
| `personaeActiveFilters` | Filtres opus actifs |
| `lastPlayedDate_Personae` | Date de la dernière partie |
