# assets/ — Ressources visuelles et sonores

Ce dossier contient les **ressources statiques partagées** entre toutes les pages : boutons d'interface, icônes de réseaux sociaux et effets sonores.

## Structure

```
assets/
├── buttons/              ← images des boutons d'action du jeu
│   ├── Give-up_button*.webp
│   ├── Hint_button*.webp
│   ├── Replay_button*.webp
│   ├── Submit_button*.webp
│   ├── boite_de_dialogue.webp
│   ├── point_interrogation.webp
│   ├── discord.svg
│   ├── github.svg
│   └── kofi.svg
└── sound_effect/         ← effets sonores du jeu
    ├── Select_sound.mp3
    └── Victory_sound.mp3
```

---

## `buttons/`

Boutons de l'interface de jeu au format **WebP** (compression sans perte apparente, support transparent).

| Fichier | Utilisation |
|---------|-------------|
| `Give-up_button.webp` | Bouton "Abandonner" (état normal) |
| `Give-up_button_rouge.webp` | Bouton "Abandonner" (état actif / déverrouillé) |
| `Give-up_button_transparent.webp` | Bouton "Abandonner" (état désactivé) |
| `Hint_button.webp` | Bouton "Indice" |
| `Replay_button.webp` | Bouton "Rejouer" |
| `Submit_button.webp` | Bouton "Valider" la réponse |
| `boite_de_dialogue.webp` | Cadre décoratif de dialogue (style RPG) |
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
