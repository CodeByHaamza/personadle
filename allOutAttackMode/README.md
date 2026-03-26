# allOutAttackMode/ — Mode All-Out Attack

Le mode All-Out Attack affiche un **GIF animé d'attaque combinée** (les "All-Out Attacks" emblématiques de Persona 5 et ses suites). Le joueur doit identifier le personnage qui lance l'attaque.

![Aperçu du mode All-Out Attack](../img/preview/preview_all_out_attack.png)

---

## Principe du jeu

1. Un GIF d'All-Out Attack est chargé et affiché.
2. Le joueur tape le nom du personnage dans la barre de recherche.
3. Pas de révélation progressive — l'image reste la même jusqu'à la victoire.
4. Après 3 mauvaises réponses, le bouton **Abandonner** se déverrouille.

![Écran de victoire](../img/preview/preview_all_out_attack_victory.png)

---

## Structure du dossier

```
allOutAttackMode/
├── allOutAttack.html          ← page HTML du mode
├── allOutAttack.css           ← styles spécifiques
├── modeAllOutAttack.js        ← logique du jeu (module ES6)
└── database/
    ├── aoaCharacters.js         ← liste des personnages avec GIF
    ├── personas_allOut.js       ← données des personas associées
    ├── portraitsMap.js          ← correspondance nom → portrait
    └── [images GIF/WebP]        ← les GIFs d'All-Out Attack
```

---

## `modeAllOutAttack.js`

Importe depuis `../js/gameCore.js` :
- `showConfettiExplosion` (style `"sides"`)
- `revealNextLink`, `setupRulesModal`, `setupDailyReset`, `checkResetOnLoad`
- `setupFilterButtons`
- `showWrongMini`

### Système de cache LRU pour les GIFs

Les GIFs d'All-Out Attack sont des fichiers lourds. Ce mode implémente un **cache LRU** (_Least Recently Used_) en mémoire pour éviter de recharger les GIFs déjà vus :

```js
const IMAGE_CACHE_MAX = 20;  // max 20 GIFs en cache simultanément
const imageCache = new Map(); // clé = URL, valeur = Blob URL
```

Fonctions du cache :
- `addToImageCache(url, blobUrl)` — ajoute avec éviction du plus ancien si plein
- `getFromCache(url)` — retourne l'URL en cache ou `null`
- `smartPreload(urls)` — pré-charge les N prochains GIFs en arrière-plan
- `loadImageSafely(url, imgEl, fallback)` — charge avec gestion d'erreur

### Sélection anti-répétition

`getBetterRandomCharacter()` évite de tomber deux fois de suite sur le même personnage en maintenant un historique des 5 derniers ciblés.

### Badges spéciaux (`checkSpecialBadges`)

6 badges peuvent être débloqués dans ce mode :
- Basés sur des personnages ou combinaisons spécifiques devinés
- Vérifiés à chaque victoire via le profil `personaUserProfile` dans le `localStorage`

### Fonctions spécifiques

| Fonction | Description |
|----------|-------------|
| `cdn(fichier)` | Construit l'URL complète du GIF depuis la base locale |
| `getFilteredPersonas()` | Filtre les personnages selon les opus actifs |
| `initializeAutocomplete()` | Dropdown avec filtrage par opus actif |
| `showVictoryBox()` | Affiche le panneau de victoire avec portrait et GIF |
| `updateGiveUpCounter()` | Met à jour le compteur d'essais restants |
| `disableInputs()` | Désactive les contrôles en fin de partie |
| `applyDarkModeStyles()` | Ajustements dark mode (couleur de fond du container GIF) |

---

## `database/` (local)

| Fichier | Contenu |
|---------|---------|
| `aoaCharacters.js` | Tableau des personnages avec leurs fichiers GIF |
| `personas_allOut.js` | Données complémentaires des Personas |
| `portraitsMap.js` | Correspondance nom → portrait pour les mauvaises réponses |

---

## localStorage utilisé

| Clé | Contenu |
|-----|---------|
| `allOutTarget` | Personnage cible (JSON) |
| `allOutAttempts` | Nombre d'essais |
| `allOutGameOver` | `"true"` si partie terminée |
| `filters_AllOutAttack` | Filtres opus actifs |
| `lastPlayedDate_AllOut` | Date de la dernière partie |
