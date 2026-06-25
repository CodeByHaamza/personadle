<div align="center">

# 🎵 Mode Musique

<img src="../img/preview/preview_music.png" alt="Aperçu du mode Musique" width="700">

> **Reconnais l'extrait. Les fans purs et durs seulement.**

</div>

---

## Principe du jeu

1. Un lecteur audio est affiché avec un extrait de chanson.
2. Le joueur saisit le titre de la chanson dans la barre de recherche.
3. Jusqu'à **3 mauvaises réponses** sont autorisées ; au-delà, le bouton **Abandonner** se déverrouille.
4. Les mauvaises réponses affichent la pochette d'album et le titre proposé.

---

## 🎵 Catalogue — 85 titres répartis par opus

<table>
  <thead>
    <tr>
      <th>Opus</th>
      <th>Pochette</th>
      <th>Jeux couverts</th>
      <th>Titres</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>P1</strong></td>
      <td><img src="database/img/P1.webp" alt="P1" width="60"/></td>
      <td>Persona 1</td>
      <td>8</td>
    </tr>
    <tr>
      <td><strong>P2</strong></td>
      <td><img src="database/img/P2IS.webp" alt="P2IS" width="60"/> <img src="database/img/P2EP.webp" alt="P2EP" width="60"/></td>
      <td>Persona 2 IS · EP</td>
      <td>4</td>
    </tr>
    <tr>
      <td><strong>P3</strong></td>
      <td><img src="database/img/P3.webp" alt="P3" width="60"/> <img src="database/img/P3FES.webp" alt="P3FES" width="60"/> <img src="database/img/P3P.webp" alt="P3P" width="60"/> <img src="database/img/P3R.webp" alt="P3R" width="60"/></td>
      <td>P3 · P3 FES · P3P · P3 Reload</td>
      <td>27</td>
    </tr>
    <tr>
      <td><strong>P4</strong></td>
      <td><img src="database/img/P4.webp" alt="P4" width="60"/> <img src="database/img/P4G.webp" alt="P4G" width="60"/> <img src="database/img/P4AU.webp" alt="P4AU" width="60"/> <img src="database/img/P4D.webp" alt="P4D" width="60"/></td>
      <td>P4 · P4 Golden · P4 Arena Ultimax · P4 Dancing</td>
      <td>21</td>
    </tr>
    <tr>
      <td><strong>P5</strong></td>
      <td><img src="database/img/P5.webp" alt="P5" width="60"/> <img src="database/img/P5R.webp" alt="P5R" width="60"/> <img src="database/img/P5S.webp" alt="P5S" width="60"/> <img src="database/img/P5T.webp" alt="P5T" width="60"/></td>
      <td>P5 · P5 Royal · P5 Strikers · P5 Tactica</td>
      <td>25</td>
    </tr>
    <tr>
      <td><strong>P5X</strong></td>
      <td><img src="database/img/P5X.webp" alt="P5X" width="60"/></td>
      <td>Persona 5: The Phantom X</td>
      <td>8</td>
    </tr>
    <tr>
      <td><strong>PQ / PQ2</strong></td>
      <td><img src="database/img/PQ.webp" alt="PQ" width="60"/> <img src="database/img/PQ2.webp" alt="PQ2" width="60"/></td>
      <td>Persona Q · Persona Q2</td>
      <td>5</td>
    </tr>
    <tr>
      <td><strong>Velvet Room</strong></td>
      <td><img src="database/img/Velvet.webp" alt="Velvet" width="60"/></td>
      <td>Aria of the Soul (toutes versions)</td>
      <td>1</td>
    </tr>
    <tr>
      <td><strong>Collab ZUTOMAYO</strong></td>
      <td><img src="database/img/Zutomayo.jpg" alt="Zutomayo" width="60"/></td>
      <td>P3 Reload × ZUTOMAYO</td>
      <td>1</td>
    </tr>
  </tbody>
</table>

> **Note** : Certaines chansons appartiennent à plusieurs opus (ex. _Aria of the Soul_ couvre P3→P5X) ; les totaux par opus reflètent le filtre actif, pas des entrées dupliquées.

---

## Structure du dossier

```
musicsMode/
├── musics.html               ← page HTML du mode
├── music.css                 ← styles spécifiques (lecteur audio)
├── modeMusic.js              ← logique du jeu (module ES6)
└── database/
    ├── songs.js                ← base de données complète des chansons (85 titres)
    ├── musicTitles.js          ← liste des titres (pour l'autocomplete)
    ├── img/                    ← pochettes d'album par jeu
    │   ├── P1.webp
    │   ├── P2IS.webp / P2EP.webp
    │   ├── P3.webp / P3FES.webp / P3P.webp / P3R.webp
    │   ├── P4.webp / P4G.webp / P4AU.webp / P4D.webp
    │   ├── P5.webp / P5R.webp / P5S.webp / P5T.webp
    │   ├── P5X.webp
    │   ├── PQ.webp / PQ2.webp
    │   ├── Velvet.webp
    │   └── Zutomayo.jpg        ← pochette spéciale collab ZUTOMAYO
    └── music/                  ← fichiers audio (⚠️ non versionnés, voir .gitignore)
```

> **Important** : Le dossier `music/` contenant les fichiers `.mp3` est exclu du dépôt Git (`.gitignore`) car les pistes audio de la saga Persona sont protégées par le droit d'auteur. Les fichiers doivent être fournis séparément.

---

## `songs.js` — Structure d'une chanson

```js
{
  titre:    "Rivers in the Desert",   // Titre de la chanson
  opus:     ["P5R"],                  // Jeu(x) d'origine (tableau)
  fichier:  "rivers_in_the_desert.mp3", // Fichier dans database/music/
  image:    "P5R.webp",               // Pochette dans database/img/
  vocalist: "Lyn Inaizumi",           // Chanteur(se) (optionnel)
  lien:     "https://..."             // Lien d'écoute externe (optionnel)
}
```

### Filtres disponibles

| Filtre | Jeux couverts                               |
| ------ | ------------------------------------------- |
| P1     | Persona 1                                   |
| P2     | Persona 2 IS + EP                           |
| P3     | P3, P3 FES, P3P, P3 Reload                  |
| P4     | P4, P4 Golden, P4 Arena Ultimax, P4 Dancing |
| P5     | P5, P5 Royal, P5 Strikers, P5 Tactica       |
| P5X    | Persona 5: The Phantom X                    |
| PQ     | Persona Q + Q2                              |

---

## `modeMusic.js`

Importe depuis `../js/gameCore.js` :

- `normalize` — comparaison des titres sans accents ni casse
- `showConfettiExplosion` — `{ emojiList: ["🎵","🎶","🎉","✨"], count: 30, spreadFrom: "bottom" }`
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`

> **Note** : Ce mode utilise sa propre fonction `setupFilterButtons` (comme le mode Silhouette), car il mutate directement le tableau `activeFilters` avec `push/filter`.

### Fonctions spécifiques

| Fonction                   | Description                                                             |
| -------------------------- | ----------------------------------------------------------------------- |
| `getFilteredSongs()`       | Retourne les chansons selon les filtres actifs                          |
| `pickSong()`               | Sélectionne aléatoirement une chanson (anti-répétition sur 5 dernières) |
| `showVictory(force?)`      | Victoire ou révélation avec badges, stats, confettis                    |
| `showWrong(name)`          | Affiche la pochette + titre de la mauvaise réponse                      |
| `handleGuess()`            | Vérifie la saisie avec `normalize()`                                    |
| `giveUp()`                 | Abandonne après 3 essais                                                |
| `resetGame()`              | Remet à zéro et choisit une nouvelle chanson                            |
| `initializeAutocomplete()` | Dropdown avec pochettes, filtré par opus + chansons déjà proposées      |
| `applyDarkModeStyles()`    | Fond sombre et bordure sur le lecteur audio                             |

### Debug

```js
// Dans la console du navigateur :
debugAllMusic(); // Vérifie que tous les titres de musicTitles.js existent dans songs.js
```

---

## localStorage utilisé

| Clé                    | Contenu                           |
| ---------------------- | --------------------------------- |
| `musicTarget`          | Chanson cible (JSON)              |
| `musicAttempts`        | Nombre d'essais                   |
| `musicGameOver`        | `"true"` si partie terminée       |
| `musicTriedTitles`     | Titres déjà proposés (JSON array) |
| `musicForceReveal`     | `"true"` si abandon déclenché     |
| `musicActiveFilters`   | Filtres opus actifs               |
| `lastPlayedDate_Music` | Date de la dernière partie        |
