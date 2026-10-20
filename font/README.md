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
| `google/*.woff2`    | Cinzel, Oswald, Playfair Display, Abril Fatface, Special Elite, Inter, JetBrains Mono, Montserrat — **générés**, ne pas éditer |

### Polices Google auto-hébergées (depuis le 2026-10-20)

Plus aucune page ne charge `fonts.googleapis.com` : les fichiers vivent dans `google/`, déclarés
par `css/fonts.css`. Les deux sont **générés** par `node scripts/fetch_google_fonts.js` — pour
ajouter une famille ou une graisse, modifier `FAMILIES` dans ce script et le relancer, puis
lier `css/fonts.css` dans la page (une seule feuille pour toutes les familles : le navigateur
ne télécharge que les polices réellement utilisées). `tests/pwa_fonts.test.js` refuse le
retour d'un lien Google, et la CSP du `.htaccess` ne l'autorise plus.

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
