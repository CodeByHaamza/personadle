<div align="center">

# 🎭 Mode Emoji

<img src="../img/preview/preview_emoji.png" alt="Aperçu du mode Emoji" width="700">

> **Des emojis cachent un personnage. Sauras-tu déchiffrer le code ?**

</div>

---

## Principe du jeu

1. Une suite d'emojis est affichée (ex : `⚡🎭🏴‍☠️🗡️` pour un Phantom Thief).
2. Le joueur tape le nom du personnage dans la barre de recherche.
3. Des indices supplémentaires se révèlent progressivement à chaque mauvaise réponse.
4. Pas de limite d'essais formelle, mais un bouton **Abandonner** se déverrouille après plusieurs tentatives.

---

## 🎭 Exemples de séquences

Les emojis (issus de `../database/characters_clean.js`) décrivent le personnage : personnalité,
attribut marquant ou histoire. La bonne réponse est le **personnage**.

<table>
  <thead>
    <tr><th>Séquence</th><th>Lecture</th><th>Réponse</th></tr>
  </thead>
  <tbody>
    <tr>
      <td align="center" width="130"><h3>🎭 🃏 💥</h3></td>
      <td>masque · joker · All-Out Attack</td>
      <td align="center"><img src="../database/portraits/Ren.webp" width="58" alt="Ren"><br><sub><b>Ren Amamiya</b></sub></td>
    </tr>
    <tr>
      <td align="center"><h3>⚡ 🏃‍♂️ 🏴‍☠️</h3></td>
      <td>éclair · coureur · pirate</td>
      <td align="center"><img src="../database/portraits/Ryuji.webp" width="58" alt="Ryuji"><br><sub><b>Ryuji Sakamoto</b></sub></td>
    </tr>
    <tr>
      <td align="center"><h3>🤣 ❄️ 🧸</h3></td>
      <td>rire · glace · peluche</td>
      <td align="center"><img src="../database/portraits/Teddie.webp" width="58" alt="Teddie"><br><sub><b>Teddie</b></sub></td>
    </tr>
    <tr>
      <td align="center"><h3>🔫 🔍 🕵️‍♂️</h3></td>
      <td>flingue · loupe · détective</td>
      <td align="center"><img src="../database/portraits/Naoto.webp" width="58" alt="Naoto"><br><sub><b>Naoto Shirogane</b></sub></td>
    </tr>
    <tr>
      <td align="center"><h3>🎧 🌙 ♂️</h3></td>
      <td>casque · lune · héros silencieux</td>
      <td align="center"><img src="../database/portraits/Yuki.webp" width="58" alt="Makoto Yuki"><br><sub><b>Makoto Yuki</b></sub></td>
    </tr>
  </tbody>
</table>

> Les séquences sont conçues pour être ni trop faciles ni trop obscures — résolvables en 2-3 indices.

---

## 🔍 Révélation progressive des indices

À chaque mauvaise réponse, un **indice supplémentaire** est dévoilé dans la séquence :

```
Tentative 0 (départ)   →   🎭 ? ?
Tentative 1 (raté)     →   🎭 🃏 ?
Tentative 2 (raté)     →   🎭 🃏 💥     → Ren Amamiya !
```

Chaque emoji supplémentaire affine l'identité du personnage. Le premier indice peut parfois sembler abstrait — c'est voulu.

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
- ~~Écouteur `focus`~~ : supprimé — `visibilitychange` seul suffit, avec vérification de date

Cela évite qu'un onglet laissé ouvert toute la nuit reste bloqué sur l'ancien puzzle.

#### Guard `autocompleteBound`

Le module vérifie `input.dataset.autocompleteBound` avant d'initialiser l'autocomplete pour éviter les doublons d'écouteurs en cas de re-render.

### Fonctions spécifiques

| Fonction                | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `checkEmojiGuess()`     | Vérifie si la saisie correspond au personnage cible               |
| `updateEmojiHint()`     | Révèle le prochain indice dans la séquence                        |
| `resetGame()`           | Réinitialise complètement l'état et choisit un nouveau personnage |
| `applyDarkModeStyles()` | Ajustements dark mode locaux                                      |

---

## localStorage utilisé

| Clé                    | Contenu                     |
| ---------------------- | --------------------------- |
| `emojiTarget`          | Personnage cible (JSON)     |
| `emojiAttempts`        | Nombre d'essais             |
| `emojiGameOver`        | `"true"` si partie terminée |
| `emojiHintIndex`       | Indice actuellement révélé  |
| `filters_Emoji`        | Filtres opus actifs         |
| `lastPlayedDate_Emoji` | Date de la dernière partie  |
