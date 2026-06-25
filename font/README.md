<div align="center">

# 🔤 Font

<img src="https://img.shields.io/badge/Persona5Font-.ttf-e63946?style=for-the-badge" alt="Persona5Font">

> **La police d'affichage façon Persona 5, utilisée pour les titres et accents de l'UI.**

</div>

---

## Contenu

| Fichier             | Rôle                                                            |
| ------------------- | --------------------------------------------------------------- |
| `Persona5Font.ttf`  | Police display inspirée de l'UI de Persona 5 (titres, accents)  |

## Utilisation

Chargée en CSS via `@font-face`, puis appliquée aux éléments décoratifs (titres, boutons stylisés) :

```css
@font-face {
  font-family: "Persona5";
  src: url("../font/Persona5Font.ttf") format("truetype");
  font-display: swap;
}
```

> Réserver cette police aux **éléments d'accent** (titres, victoires). Le corps de texte reste sur une
> police système lisible. ⚖️ Les éléments de design Persona sont la propriété d'Atlus / SEGA —
> usage fan-made non commercial.
