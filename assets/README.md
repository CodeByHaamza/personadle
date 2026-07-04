<div align="center">

# 🖼️ Assets

<img src="https://img.shields.io/badge/format-WebP%20·%20SVG%20·%20MP3-orange?style=for-the-badge" alt="Formats">
<img src="https://img.shields.io/badge/usage-partagé-blue?style=for-the-badge" alt="Partagé">

> **Sons, boutons, icônes — les ressources statiques partagées de l'interface.**

</div>

Ce dossier contient les **ressources statiques partagées** entre toutes les pages : boutons d'interface, icônes de réseaux sociaux et effets sonores.

## Structure

```
assets/
├── buttons/              ← boutons d'action, un sous-dossier PAR LANGUE
│   ├── DE/ EN/ ES/ FR/ IT/    ← chacun : Give-up/Hint/Replay/Submit_Button[_Rouge|_Transparent].webp
│   ├── discord.svg
│   ├── github.svg
│   ├── kofi.svg
│   └── point_interrogation.webp
├── lang/                 ← portraits de personnages utilisés par js/lang-selector.js
│   ├── Ann_takamaki_english.webp
│   ├── Bebe_french.webp
│   ├── Caesar_italian.webp
│   ├── Hulkenberg_german.webp
│   ├── Lisa_Silverman_english.webp
│   └── Morgana_Spanish.webp
└── sound_effect/         ← effets sonores du jeu
    ├── Select_sound.mp3
    └── Victory_sound.mp3
```

---

## `buttons/`

Boutons de l'interface de jeu au format **WebP**, dans un **sous-dossier par langue** (`DE/EN/ES/FR/IT/`)
— chaque langue a sa propre variante graphique du texte sur le bouton. Référencés dans `faq.html`,
les 6 pages de mode, `index.html` et `js/lang-selector.js`.

| Fichier (dans chaque sous-dossier de langue) | Utilisation |
|---------|-------------|
| `Give-up_Button.webp` | Bouton "Abandonner" (état normal) |
| `Give-up_Button_Rouge.webp` | Bouton "Abandonner" (état actif / déverrouillé) |
| `Give-up_Button_Transparent.webp` | Bouton "Abandonner" (état désactivé) |
| `Hint_Button.webp` / `_Rouge` / `_Transparent` | Bouton "Indice", 3 états |
| `Replay_Button.webp` / `_Rouge` / `_Transparent` | Bouton "Rejouer", 3 états |
| `Submit_Button.webp` / `_Rouge` | Bouton "Valider" la réponse |

Fichiers communs (hors sous-dossiers de langue) :

| Fichier | Utilisation |
|---------|-------------|
| `point_interrogation.webp` | Icône "?" pour ouvrir les règles |
| `discord.svg` | Lien vers le serveur Discord |
| `github.svg` | Lien vers le dépôt GitHub |
| `kofi.svg` | Lien Ko-fi (soutien) |

---

## `sound_effect/`

Effets sonores déclenchés par JavaScript via `new Audio(...)`.

| Fichier | Déclencheur |
|---------|-------------|
| `Victory_sound.mp3` | Joué à chaque victoire (confettis), dans `showConfettiExplosion()` de `gameCore.js` |
| `Select_sound.mp3` | Joué lors de certaines interactions de sélection |

> **Chemin d'accès depuis un mode** : `../assets/sound_effect/Victory_sound.mp3`
> Le chemin est relatif à la **page HTML** (pas au fichier JS), car `new Audio()` résout les URLs par rapport au document.

---

## Convention de nommage des boutons

Les variantes d'état suivent le schéma :
- `NomBouton.webp` → état par défaut
- `NomBouton_rouge.webp` → état actif / danger
- `NomBouton_transparent.webp` → état désactivé (grisé)
