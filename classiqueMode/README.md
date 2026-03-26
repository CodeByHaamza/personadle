# classiqueMode/ — Mode Classique

Le mode Classique est le **mode principal** de Personadle, directement inspiré de [Wordle](https://www.nytimes.com/games/wordle) et de ses dérivés comme Loldle. Le joueur doit deviner un personnage de la saga Persona en se basant sur des indices progressifs.

![Aperçu du mode Classique](../img/preview/preview_classic.png)

---

## Principe du jeu

1. Le joueur saisit un nom de personnage dans la barre de recherche.
2. Le jeu compare les attributs du personnage proposé avec ceux du personnage cible.
3. Un tableau de comparaison apparaît avec un code couleur :
   - 🟩 **Vert** : attribut identique
   - 🟨 **Jaune** : attribut partiellement correct (même saga, âge proche…)
   - 🟥 **Rouge** : attribut différent
4. Le joueur peut utiliser un **indice** (révèle un attribut) après un certain nombre d'essais.
5. Un bouton **Abandonner** se déverrouille après 5 mauvaises réponses.

![Écran de victoire](../img/preview/preview_classic_victory.png)

---

## Structure du dossier

```
classiqueMode/
├── classiqueMode.html   ← page HTML du mode
├── classique.css        ← styles spécifiques au mode
└── modeClassique.js     ← logique du jeu (module ES6)
```

---

## `classiqueMode.html`

Page principale du mode. Elle charge :
- `../css/global.css` — styles communs
- `./classique.css` — styles propres au mode
- `./modeClassique.js` via `<script type="module">`

Contient les éléments HTML :
- `#textbar` — champ de saisie avec autocomplete
- `#guessButton` — bouton Valider
- `#hintButton` — bouton Indice
- `#giveUpButton` — bouton Abandonner
- `#wrongGuessList` — liste des mauvaises réponses
- `#comparisonGrid` — tableau de comparaison des attributs
- `#victoryBox` — panneau de victoire
- `#rulesModal` — fenêtre modale des règles
- `#modeNavigationContainer` — navigation entre les modes

---

## `modeClassique.js`

Module ES6 principal du mode. Importe depuis `../js/gameCore.js` :
- `showConfettiExplosion` — animation de victoire
- `revealNextLink` — navigation vers le mode suivant
- `setupRulesModal` — câblage du modal
- `setupDailyReset` — reset automatique à minuit (Paris)
- `checkResetOnLoad` — détection d'un nouveau jour au chargement
- `setupFilterButtons` — gestion des filtres P3/P4/P5…
- `showWrongMini` — affichage des mauvaises réponses

### Logique spécifique au mode Classique

| Fonction | Description |
|----------|-------------|
| `checkGuess()` | Compare 7 attributs du personnage proposé au personnage cible et construit le tableau de couleurs |
| `filterCharacterPool()` | Filtre la liste des personnages selon les opus actifs |
| `convertAgeToValue()` | Convertit l'âge en valeur numérique pour la comparaison (flèche ↑/↓) |
| `initializeAutocomplete()` | Dropdown de recherche avec portraits en miniature |
| `enableHintButton()` | Active le bouton Indice après N essais |
| `enableGiveUpButton()` | Active le bouton Abandonner après N essais |
| `applyDarkModeStyles()` | Ajustements dark mode spécifiques à ce mode |

### Attributs comparés

| Attribut | Type de comparaison |
|----------|---------------------|
| Jeu (opus) | Exact / même saga |
| Arcane | Exact |
| Rôle | Exact |
| Âge | Exact / plus grand / plus petit (flèche) |
| Genre | Exact |
| Doublage japonais | Exact |
| DLC | Exact |

### Mode daltonien

Un mode daltonien est disponible : remplace les couleurs vert/rouge par des icônes ✓/✗ pour une meilleure accessibilité.

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `classicTarget` | Personnage cible (JSON) |
| `classicAttempts` | Nombre d'essais |
| `classicGameOver` | `"true"` si la partie est terminée |
| `filters_Classic` | Filtres opus actifs (JSON array) |
| `lastPlayedDate_Classic` | Date de la dernière partie |
