# musicsMode/ — Mode Musique

Le mode Musique propose d'**identifier une chanson de la saga Persona** à partir d'un court extrait audio. C'est un mode qui récompense les fans connaissant bien les bandes-originales iconiques de la série.

![Aperçu du mode Musique](../img/preview/preview_music.png)

---

## Principe du jeu

1. Un lecteur audio est affiché avec un extrait de chanson.
2. Le joueur saisit le titre de la chanson dans la barre de recherche.
3. Jusqu'à **3 mauvaises réponses** sont autorisées ; au-delà, le bouton **Abandonner** se déverrouille.
4. Les mauvaises réponses affichent la pochette d'album et le titre proposé.

---

## Structure du dossier

```
musicsMode/
├── musics.html               ← page HTML du mode
├── music.css                 ← styles spécifiques (lecteur audio)
├── modeMusic.js              ← logique du jeu (module ES6)
└── database/
    ├── songs.js                ← base de données complète des chansons
    ├── musicTitles.js          ← liste des titres (pour l'autocomplete)
    ├── img/                    ← pochettes d'album par jeu
    │   ├── P3.webp
    │   ├── P4G.webp
    │   ├── P5R.webp
    │   ├── Zutomayo.jpg        ← pochette spéciale collab ZUTOMAYO
    │   └── ...
    └── music/                  ← fichiers audio (⚠️ non versionnés, voir .gitignore)
```

> **Important** : Le dossier `music/` contenant les fichiers `.mp3` est exclu du dépôt Git (`.gitignore`) car les pistes audio de la saga Persona sont protégées par le droit d'auteur. Les fichiers doivent être fournis séparément.

---

## `songs.js` — Structure d'une chanson

```js
{
  titre:    "Rivers in the Desert",   // Titre de la chanson
  opus:     "P5R",                    // Jeu d'origine
  fichier:  "rivers_in_the_desert.mp3", // Fichier dans database/music/
  image:    "P5R.webp",               // Pochette dans database/img/
  vocalist: "Lyn Inaizumi",           // Chanteur(se) (optionnel)
  lien:     "https://..."             // Lien d'écoute externe (optionnel)
}
```

### Filtres disponibles

| Filtre | Jeux couverts |
|--------|---------------|
| P1 | Persona 1 |
| P2 | Persona 2 IS + EP |
| P3 | P3, P3 FES, P3P, **P3 Reload** |
| P4 | P4, P4 Golden, P4 Arena Ultimax, P4 Dancing |
| P5 | P5, P5 Royal, P5 Strikers, P5 Tactica |
| P5X | Persona 5: The Phantom X |
| PQ | Persona Q + Q2 |

---

## `modeMusic.js`

Importe depuis `../js/gameCore.js` :
- `normalize` — comparaison des titres sans accents ni casse
- `showConfettiExplosion` — `{ emojiList: ["🎵","🎶","🎉","✨"], count: 30, spreadFrom: "bottom" }`
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`

> **Note** : Ce mode utilise sa propre fonction `setupFilterButtons` (comme le mode Silhouette), car il mutate directement le tableau `activeFilters` avec `push/filter`.

### Badges débloquables

| Badge | Condition |
|-------|-----------|
| ![Badge Burn My Dread](../profile/badges/images/Badges_Burn_My_Dread_Silver.png) | Trouver "Burn My Dread" (thème titre de P3) |
| ![Badge Zutomayo](../profile/badges/images/Badges_Zotomayo.webp) | Trouver la chanson de la collaboration ZUTOMAYO × P3R |
| Unsolved Case (Adachi gagne) | Abandonner sur "Never More" (thème de fin de P4) |

### Fonctions spécifiques

| Fonction | Description |
|----------|-------------|
| `getFilteredSongs()` | Retourne les chansons selon les filtres actifs |
| `pickSong()` | Sélectionne aléatoirement une chanson (anti-répétition sur 5 dernières) |
| `showVictory(force?)` | Victoire ou révélation avec badges, stats, confettis |
| `showWrong(name)` | Affiche la pochette + titre de la mauvaise réponse |
| `handleGuess()` | Vérifie la saisie avec `normalize()` |
| `giveUp()` | Abandonne après 3 essais |
| `resetGame()` | Remet à zéro et choisit une nouvelle chanson |
| `initializeAutocomplete()` | Dropdown avec pochettes, filtré par opus + chansons déjà proposées |
| `applyDarkModeStyles()` | Fond sombre et bordure sur le lecteur audio |

### Debug

```js
// Dans la console du navigateur :
debugAllMusic()   // Vérifie que tous les titres de musicTitles.js existent dans songs.js
```

---

## Illustration des pochettes

| Jeu | Pochette |
|-----|----------|
| Persona 3 | ![P3](database/img/P3.webp) |
| Persona 4 Golden | ![P4G](database/img/P4G.webp) |
| Persona 5 Royal | ![P5R](database/img/P5R.webp) |
| Collab ZUTOMAYO | ![Zutomayo](database/img/Zutomayo.jpg) |

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `musicTarget` | Chanson cible (JSON) |
| `musicAttempts` | Nombre d'essais |
| `musicGameOver` | `"true"` si partie terminée |
| `musicTriedTitles` | Titres déjà proposés (JSON array) |
| `musicForceReveal` | `"true"` si abandon déclenché |
| `musicActiveFilters` | Filtres opus actifs |
| `lastPlayedDate_Music` | Date de la dernière partie |
