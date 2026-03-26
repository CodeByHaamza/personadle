# emojiMode/ — Mode Emoji

Le mode Emoji propose de **deviner un personnage de Persona à partir d'une série d'emojis** le décrivant. C'est un mode créatif qui teste la connaissance approfondie des personnages de la saga.

![Aperçu du mode Emoji](../img/preview/preview_emoji.png)

---

## Principe du jeu

1. Une suite d'emojis est affichée (ex : `⚡🎭🏴‍☠️🗡️` pour un Phantom Thief).
2. Le joueur tape le nom du personnage dans la barre de recherche.
3. Des indices supplémentaires se révèlent progressivement à chaque mauvaise réponse.
4. Pas de limite d'essais formelle, mais un bouton **Abandonner** se déverrouille après plusieurs tentatives.

---

## Structure du dossier

```
emojiMode/
├── emojiMode.html   ← page HTML du mode
├── emoji.css        ← styles spécifiques au mode
└── emojiMode.js     ← logique du jeu (module ES6)
```

---

## `emojiMode.html`

Charge `global.css`, `emoji.css` et `emojiMode.js` en module.

Éléments HTML notables :
- `#emojiDisplay` — zone d'affichage des emojis du jour
- `#textbar` — saisie du nom du personnage
- `#guessButton` — bouton Valider
- `#hintButton` — bouton Indice (révèle un nouvel emoji ou un indice textuel)
- `#wrongGuessList` — liste des mauvaises réponses avec portrait
- `#victoryBox` — panneau de victoire avec portrait complet
- `#rulesModal` — fenêtre d'explication des règles

---

## `emojiMode.js`

Module ES6. Importe depuis `../js/gameCore.js` :
- `parisDateKey` + `msUntilNextParisMidnight` — pour le timer de reset
- `showConfettiExplosion` — confettis de victoire (style `"sides"`)
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`
- `setupFilterButtons` — filtres opus
- `showWrongMini` — vignettes mauvaises réponses

### Particularités techniques

#### Reset quotidien re-planifiable
Contrairement aux autres modes qui utilisent `setupDailyReset` directement, le mode Emoji gère son propre timer `window.__emojiResetTimer` pour pouvoir le ré-armer :
- Écouteur `visibilitychange` : re-planifie si l'onglet revient au premier plan après minuit
- Écouteur `focus` : idem quand la fenêtre reçoit le focus

Cela évite qu'un onglet laissé ouvert toute la nuit reste bloqué sur l'ancien puzzle.

#### Guard `autocompleteBound`
Le module vérifie `input.dataset.autocompleteBound` avant d'initialiser l'autocomplete pour éviter les doublons d'écouteurs en cas de re-render.

### Fonctions spécifiques

| Fonction | Description |
|----------|-------------|
| `checkEmojiGuess()` | Vérifie si la saisie correspond au personnage cible |
| `updateEmojiHint()` | Révèle le prochain indice dans la séquence |
| `resetGame()` | Réinitialise complètement l'état et choisit un nouveau personnage |
| `applyDarkModeStyles()` | Ajustements dark mode locaux |

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `emojiTarget` | Personnage cible (JSON) |
| `emojiAttempts` | Nombre d'essais |
| `emojiGameOver` | `"true"` si partie terminée |
| `emojiHintIndex` | Indice actuellement révélé |
| `filters_Emoji` | Filtres opus actifs |
| `lastPlayedDate_Emoji` | Date de la dernière partie |
