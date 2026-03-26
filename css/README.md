# css/ — Architecture des styles

Ce dossier contient les feuilles de style globales de Personadle.
Chaque mode de jeu possède en plus son propre CSS local dans son dossier.

## Structure

```
css/
├── global.css   ← styles partagés par toutes les pages
├── index.css    ← styles spécifiques à la page d'accueil (index.html)
└── style.css    ← legacy — ancienne feuille unique (conservée pour référence)
```

---

## `global.css` — Styles communs

Chargé par **toutes les pages** via :
```html
<link rel="stylesheet" href="../css/global.css?v=3" />
```

Contient :

| Section | Description |
|---------|-------------|
| **Reset & base** | `box-sizing`, marges/paddings globaux, `font-family` |
| **Header / Logo** | Positionnement du logo cliquable en haut de page |
| **Boutons d'action** | Styles des boutons Valider, Abandonner, Rejouer, Indice |
| **Autocomplete** | Dropdown de saisie (`.autocomplete-items`, `.list-options`) avec portraits en miniature |
| **Filtres opus** | Boutons `.filter-btn` (P3, P4, P5…) avec état `active` |
| **Mauvaises réponses** | `.wrong-mini` avec animation `.shake` |
| **Victoire** | `#victoryBox` et ses variantes par mode |
| **Navigation modes** | `#modeNavigationContainer` (boutons Précédent / Suivant) |
| **Modal règles** | `#rulesModal` avec fond semi-transparent |
| **Confettis** | `.confetti-emoji` avec animation `flyUp` via propriétés CSS custom (`--x-move`, `--y-move`, `--rotate`) |
| **Dark mode** | Classe `.darkmode` sur `<body>` — surcharge toutes les couleurs |
| **Toggle dark mode** | Composant `.switch` (label + input checkbox caché + pseudo-élément slider) |
| **Profil** | Styles du menu profil, avatar, pseudo |
| **Responsive** | Media queries pour mobile |

### Versionning CSS

Le suffixe `?v=3` dans les balises `<link>` force le rechargement du CSS chez les visiteurs après une mise à jour. À incrémenter manuellement à chaque déploiement significatif.

---

## `index.css` — Page d'accueil

Chargé uniquement par `index.html`. Contient :
- La grille des boutons de sélection de mode (`.gamemode-button`)
- Le titre principal et sous-titres
- Les styles des liens réseaux sociaux (Discord, GitHub, Ko-fi)
- La section classement / profil en haut

---

## `style.css` — Legacy

Ancienne feuille de style monolithique d'avant le refactoring CSS.
Conservée pour référence historique. **Ne pas modifier ni charger directement.**

---

## Conventions

- **Variables CSS custom** : utilisées pour les animations confettis (`--x-move`, `--y-move`, `--rotate`) et quelques couleurs dark mode.
- **Classes utilitaires** : `.shake`, `.activated`, `.autocomplete-active` sont pilotées dynamiquement par JavaScript.
- **Dark mode** : `document.body.classList.toggle("darkmode")` — tout le dark mode est géré par la cascade CSS, pas par des styles inline.
