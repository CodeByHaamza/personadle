<div align="center">

# 🌑 Silhouette Mode

<img src="../img/preview/preview_shadow.png" alt="Aperçu du mode Silhouette" width="700">

> **Un personnage se cache dans l'ombre. Sauras-tu le reconnaître avant qu'il soit trop tard ?**

</div>

---

## 🎮 Principe du jeu

1. Un portrait est affiché entièrement masqué — **silhouette noire totale**. Depuis la 2.1 le
   noircissement est **cuit dans les pixels** (`js/silhouette_mask.js`), plus seulement appliqué
   en CSS : voir « Anti-triche » plus bas.
2. À chaque mauvaise réponse, l'image **dézoome** (le zoom passe de 1.8× à 1.0× par paliers de
   0.2) — la silhouette reste noire jusqu'à la victoire ou l'abandon, seul le cadrage change.
3. Le joueur peut deviner à tout moment ; plus il attend, plus le cadrage se resserre.
4. Après **5 mauvaises réponses**, le bouton **Abandonner** se déverrouille.

---

## 👁️ De l'ombre à la lumière

La même image — deux états. À gauche, ce que voit le joueur. À droite, la révélation.

<table align="center">
  <tr>
    <th align="center" width="50%">🌑 Silhouette initiale</th>
    <th align="center" width="50%">✅ Portrait révélé</th>
  </tr>
  <tr>
    <td align="center">
      <img src="database/img/Ren_silhouette.webp" style="filter: brightness(0)" width="220" alt="Ren — silhouette">
      <br><sub>Ren Amamiya (Joker) — P5R</sub>
    </td>
    <td align="center">
      <img src="database/img/Ren_silhouette.webp" width="220" alt="Ren révélé">
      <br><sub>Ren Amamiya (Joker) — P5R</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="database/img/Nagisa_silhouette.webp" style="filter: brightness(0)" width="220" alt="Ann — silhouette">
      <br><sub>Nagisa Kaneshiro (Wonder) — P5X</sub>
    </td>
    <td align="center">
      <img src="database/img/Nagisa_silhouette.webp" width="220" alt="Ann révélée">
      <br><sub>Nagisa Kaneshiro (Wonder) — P5X</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="database/img/Yuki_silhouette.webp" style="filter: brightness(0)" width="220" alt="Joker — silhouette">
      <br><sub>Makoto Yuki — P3R</sub>
    </td>
    <td align="center">
      <img src="database/img/Yuki_silhouette.webp" width="220" alt="Joker révélé">
      <br><sub>Makoto Yuki — P3R</sub>
    </td>
  </tr>
</table>

---

## 📊 Progression du zoom

La silhouette reste **noire** sur toute la partie — seul le cadrage se resserre à chaque
mauvaise réponse (`scale()` CSS, pas de couleur/luminosité progressive) :

| Essais | Zoom (`scale`) |
| ------ | -------------- |
| 0      | 1.8×           |
| 1      | 1.6×           |
| 2      | 1.4×           |
| 3      | 1.2×           |
| 4+     | 1.0× (plancher)|

La révélation complète (couleurs, `filter: none`) n'intervient qu'à la **victoire ou l'abandon**,
pas progressivement pendant la partie.

---

## 🏗️ Structure du dossier

```
silhouetteMode/
├── silhouette.html            ← page HTML du mode
├── silhouette.css             ← styles spécifiques (filtres CSS silhouette, zoom)
├── modeSilhouette.js          ← logique du jeu (module ES6)
└── database/
    ├── silhouetteCharacters.js  ← liste des personnages disponibles dans ce mode
    ├── portraitsMapSilhouette.js ← correspondance nom → chemin portrait
    ├── persona.js               ← données personas pour le filtre PQ
    └── img/                     ← portraits silhouette (WebP)
```

---

## 🖼️ `silhouette.html`

Éléments HTML notables :

| Élément                          | Rôle                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `.silhouette-box`                | Div contenant l'image, le voile de chargement et le message de fin |
| `#silhouetteImage`               | L'image elle-même — son `src` porte la version **déjà noircie** |
| `.silhouette-loader`             | Voile de chargement, couvre le décodage de la première image |
| `#textbar`                       | Champ de saisie avec autocomplete                      |
| `#guessButton` / `#giveUpButton` | Actions principales                                    |
| `#wrongGuessList`                | Liste des mauvaises réponses                           |
| `#victoryBox`                    | Révélation finale avec portrait en couleur             |

---

## 🎨 `silhouette.css`

Styles spécifiques à l'effet silhouette :

- `filter: brightness(0)` → **filet de sécurité uniquement** depuis la 2.1. Les pixels arrivent
  déjà noirs ; ce filtre ne sert plus que si le noircissement par canvas a échoué
  (`blackenToDataURL()` renvoie `null`), auquel cas on retombe sur l'ancien comportement
- `filter: none` → appliqué uniquement à la révélation finale (victoire ou abandon)
- `transform: scale()` → seul élément qui varie progressivement, par niveau d'essai (1.8× → 1.0×)
- Transition CSS douce entre chaque niveau de zoom
- ⚠️ **Ne jamais remettre d'`animation` sur `#silhouetteImage`** : une animation en cours bat le
  style inline dans la cascade. L'ancienne `popInSilhouette` animait `transform` et `opacity`,
  les deux propriétés pilotées par le JS — elle dézoomait l'image au premier chargement et,
  en Mode Expert, la révélait avant le premier flash

---

## 🛡️ Anti-triche

`filter: brightness(0)` est un effet **de peinture** : il n'existe qu'au moment d'afficher. Le
bitmap présent dans le DOM restait donc l'image d'origine, et « clic droit → Copier l'image »
livrait le personnage à deviner — sans outil ni compétence technique.

Depuis la 2.1, `js/silhouette_mask.js` noircit l'image **dans ses pixels** via un canvas hors
écran (remplissage noir en `source-in`, qui conserve le canal alpha — rendu identique au pixel
près à `brightness(0)`). C'est ce résultat qui est donné à `<img src>` ; l'originale n'entre
dans le DOM qu'à la révélation de fin de partie.

Le chemin de **restauration de session** passe par le même flux : sans ça, un F5 en pleine
partie rouvrirait le trou.

Autres gardes, plus anciennes, contre le glisser-déposer (qui ignore lui aussi le filtre CSS) :
`draggable="false"` (HTML), `-webkit-user-drag: none` (CSS) et `preventDefault('dragstart')` (JS).

### Ce que ça ne protège pas — à ne pas croire fermé

- L'**URL du fichier** reste visible dans l'onglet Réseau des DevTools.
- La **cible du jour** reste en clair dans `localStorage` (les 6 modes sont concernés).

Fermer ces deux-là demanderait de rendre la silhouette côté serveur. Ce n'est pas le sujet :
l'intégrité du **classement** est défendue côté serveur (`api/lib/daily_target.php`), et ce
module protège l'expérience du joueur honnête, pas le classement.

Le mode **All-Out Attack** ne peut pas recevoir le même correctif : ses GIFs viennent d'un CDN
cross-origin, qui « teinte » le canvas et fait échouer `toDataURL()`. Il faudrait activer CORS
sur le bucket R2.

---

## 🔧 `modeSilhouette.js`

Importe depuis `../js/gameCore.js` :

- `showConfettiExplosion` (style `"sides"`)
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`
- `showWrongMini`

Le panneau de filtres opus est géré par `initFilterMenu` (`../js/filterMenu.js`), comme dans les
5 autres modes — il n'y a pas de réimplémentation locale.

### Fonctions spécifiques

| Fonction                   | Description                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `pickCharacter()`          | Choisit aléatoirement un personnage avec un token anti-race (évite les changements simultanés) |
| `applyZoom(level)`         | Ajuste le niveau de zoom et de luminosité de l'image selon le nombre d'essais                  |
| `showVictory()`            | Révèle l'image en couleur, déclenche les confettis et vérifie le badge PQ                      |
| `showWrong()`              | Affiche la vignette du mauvais personnage et réduit le zoom                                    |
| `handleGuess()`            | Vérifie la saisie et dispatche vers victoire ou mauvaise réponse                               |
| `giveUp()`                 | Révèle le personnage sans victoire                                                             |
| `resetGame()`              | Remet à zéro l'état et choisit un nouveau personnage                                           |
| `initializeAutocomplete()` | Dropdown avec filtre `_guessed` (personnages déjà proposés masqués)                            |

---

## 🗄️ `database/` (local)

Ce mode possède sa propre base de données locale séparée de la base globale `database/`, car les personnages disponibles sont un sous-ensemble avec des portraits spécifiques aux silhouettes.

| Fichier                     | Contenu                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `silhouetteCharacters.js`   | Tableau des personnages jouables en mode Silhouette               |
| `portraitsMapSilhouette.js` | Correspondance nom → chemin vers le portrait                      |
| `persona.js`                | Données des Personas (utilisées pour la vérification du badge PQ) |
| `img/`                      | Portraits spécifiques au mode Silhouette (WebP, fond transparent) |

---

## 💾 localStorage utilisé

| Clé                         | Contenu                     |
| --------------------------- | --------------------------- |
| `silhouetteTarget`          | Personnage cible (JSON)     |
| `silhouetteAttempts`        | Nombre d'essais             |
| `silhouetteGameOver`        | `"true"` si partie terminée |
| `silhouetteActiveFilters`   | Filtres opus actifs         |
| `lastPlayedDate_Silhouette` | Date de la dernière partie  |
