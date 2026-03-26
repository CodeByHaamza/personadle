# silhouetteMode/ — Mode Silhouette

Le mode Silhouette affiche le **portrait d'un personnage en silhouette noire**. Chaque bonne réponse révèle progressivement l'image originale. Le joueur doit identifier le personnage avant que l'image ne soit entièrement révélée.

![Aperçu du mode Silhouette](../img/preview/preview_shadow.png)

---

## Principe du jeu

1. Un portrait de personnage est affiché entièrement masqué (silhouette noire).
2. À chaque mauvaise réponse, une partie de l'image est révélée (zoom out progressif).
3. Le joueur peut deviner à tout moment ; plus il attend, plus la révélation est grande.
4. Après un certain nombre d'essais, un bouton **Abandonner** se déverrouille.

---

## Structure du dossier

```
silhouetteMode/
├── silhouette.html            ← page HTML du mode
├── silhouette.css             ← styles spécifiques (filtres CSS silhouette, zoom)
├── modeSilhouette.js          ← logique du jeu (module ES6)
└── database/
    ├── silhouetteCharacters.js  ← liste des personnages disponibles dans ce mode
    ├── portraitsMapSilhouette.js ← correspondance nom → chemin portrait
    ├── persona.js               ← données personas pour le filtre PQ
    └── img/                     ← images des portraits (dossier local)
```

---

## `silhouette.html`

Éléments HTML notables :
- `#silhouetteContainer` — div contenant l'image avec `filter: brightness(0)` CSS
- `#textbar` — champ de saisie avec autocomplete
- `#guessButton` / `#giveUpButton` — actions principales
- `#wrongGuessList` — liste des mauvaises réponses
- `#victoryBox` — révélation finale avec portrait en couleur

---

## `silhouette.css`

Contient les styles spécifiques à l'effet silhouette :
- `filter: brightness(0)` sur l'image → silhouette noire complète
- `filter: brightness(1)` → révélation progressive via JavaScript
- Gestion du zoom avec `transform: scale()`
- Transition CSS douce entre les niveaux de révélation

---

## `modeSilhouette.js`

Importe depuis `../js/gameCore.js` :
- `showConfettiExplosion` (style `"sides"`)
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`
- `showWrongMini`

> **Note** : Ce mode utilise sa propre fonction `setupFilterButtons` locale (pas la version partagée), car ses filtres mutent directement le tableau `activeFilters` avec `push/filter`, contrairement à la version partagée qui reconstruit le tableau depuis le DOM.

### Fonctions spécifiques

| Fonction | Description |
|----------|-------------|
| `pickCharacter()` | Choisit aléatoirement un personnage avec un token anti-race (évite les changements simultanés) |
| `applyZoom(level)` | Ajuste le niveau de zoom et de luminosité de l'image selon le nombre d'essais |
| `showVictory()` | Révèle l'image en couleur, déclenche les confettis et vérifie le badge PQ |
| `showWrong()` | Affiche la vignette du mauvais personnage et réduit le zoom |
| `handleGuess()` | Vérifie la saisie et dispatche vers victoire ou mauvaise réponse |
| `giveUp()` | Révèle le personnage sans victoire |
| `resetGame()` | Remet à zéro l'état et choisit un nouveau personnage |
| `initializeAutocomplete()` | Dropdown avec filtre `_guessed` (personnages déjà proposés masqués) |

### Badge PQ

Le mode Silhouette vérifie si le personnage deviné est lié à **Persona Q** et débloque le badge correspondant dans le profil.

---

## `database/` (local)

Ce mode possède sa propre base de données locale séparée de la base globale `database/`, car les personnages disponibles sont un sous-ensemble avec des portraits spécifiques aux silhouettes.

| Fichier | Contenu |
|---------|---------|
| `silhouetteCharacters.js` | Tableau des personnages jouables en mode Silhouette |
| `portraitsMapSilhouette.js` | Correspondance nom → chemin vers le portrait |
| `persona.js` | Données des Personas (utilisées pour la vérification du badge PQ) |
| `img/` | Portraits spécifiques au mode Silhouette |

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `silhouetteTarget` | Personnage cible (JSON) |
| `silhouetteAttempts` | Nombre d'essais |
| `silhouetteGameOver` | `"true"` si partie terminée |
| `silhouetteActiveFilters` | Filtres opus actifs |
| `lastPlayedDate_Silhouette` | Date de la dernière partie |
