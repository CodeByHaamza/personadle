<div align="center">

# 🎨 CSS

<img src="https://img.shields.io/badge/CSS3-vanilla-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/Dark%20mode-natif-111?style=for-the-badge" alt="Dark mode">
<img src="https://img.shields.io/badge/Responsive-480%20·%20768%20·%201024-blueviolet?style=for-the-badge" alt="Responsive">

> **Global d'abord, composant ensuite.** Une feuille commune + une feuille par composant.
> Dark mode par cascade, responsive en `clamp()`/`min()`, animations préfixées.

</div>

---

## 🗂️ Organisation

```
css/
├── global.css        ← styles partagés par TOUTES les pages
├── index.css         ← page d'accueil uniquement
└── <composant>.css   ← une feuille par composant (chargée par la page qui l'utilise)
```

Chaque **mode de jeu** a en plus son propre CSS dans son dossier (`classiqueMode/`, `emojiMode/`…).

### Feuilles par composant

| Domaine        | Feuilles                                                                           |
| -------------- | ---------------------------------------------------------------------------------- |
| Navigation/UI  | `bottomNav.css` · `filterMenu.css` · `langSelector.css` · `settings-modal.css`     |
| Social & défis | `social-link.css` · `rank10-effect.css` · `challenge-banner.css` · `challenge-notif.css` · `challenge-result.css` · `stats-compare.css` |
| Animations     | `calling-card.css` · `p3-evoker-anim.css` · `tv-friend-anim.css` · `divine-gift.css` |
| Divers         | `streak-recovery.css` · `wallpaper-notification.css` · `faq.css`                    |

---

## ⭐ `global.css`

Chargé par **toutes les pages** (versionné pour casser le cache au déploiement) :

```html
<link rel="stylesheet" href="../css/global.css?v=3" />
```

| Section            | Contenu                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Reset & base       | `box-sizing`, marges/paddings, `font-family`                                   |
| Header / Logo      | logo cliquable en haut de page                                                |
| Boutons d'action   | Valider, Abandonner, Rejouer, Indice                                          |
| Autocomplete       | dropdown de saisie avec portraits miniatures                                  |
| Filtres opus       | `.filter-btn` (P3, P4, P5…) + état `active`                                    |
| Mauvaises réponses | `.wrong-mini` + animation `.shake`                                            |
| Victoire           | `.victory-box` (classe, pas un ID) et ses variantes par mode                  |
| Modal règles       | `#rulesModal` (fond semi-transparent)                                         |
| Confettis          | `.confetti-emoji` + `flyUp` via vars custom (`--x-move`, `--y-move`, `--rotate`)|
| Dark mode          | classe `.darkmode` sur `<body>` — surcharge toutes les couleurs               |
| Responsive         | media queries mobile / tablette                                               |

> Le suffixe `?v=N` force le rechargement du CSS après une mise à jour — à incrémenter à chaque déploiement notable.

---

## 📐 Conventions

- **Dark mode** : classe `.darkmode` sur `<body>` (jamais `<html>`, sauf script inline anti-FOUC).
  Tout passe par la cascade, **pas** de style inline.
- **Responsive** : `min()`, `clamp()`, `vw`/`vh` — éviter les largeurs fixes en `px`.
  Breakpoints : **480px** (mobile) · **768px** (tablette) · **1024px** (petit desktop).
- **Animations** : préfixer les noms spécifiques (`p5ImpactFlash`, `tarotFlip`…) pour éviter les collisions.
- **Variables CSS custom** : animations confettis + couleurs dark mode.
- **Classes pilotées par JS** : `.shake`, `.activated`, `.autocomplete-active`.
