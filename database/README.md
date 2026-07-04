<div align="center">

# 🗄️ Base de données personnages

> **177 personnages de P1 à P5X — organisés par opus, avec portraits, emojis et citations.**

</div>

Ce dossier contient les données des personnages utilisés dans le **mode Classique** ainsi que les portraits associés.
Les autres modes possèdent leur propre sous-dossier `database/` dans leur répertoire.

## Structure

```
database/
├── characters_clean.js   ← liste complète des personnages jouables (177 entrées)
├── personas.js           ← liste de noms pour l'autocomplétion du mode Classique (pas Personae)
├── quotes.js             ← surcouche de citations traduites (actuellement vide, prévue post-v2.0)
├── compare-phrases.js    ← phrases Persona i18n pour l'overlay de comparaison de stats (amis)
├── portraitsMap.js       ← correspondance nom → identifiant de fichier portrait
└── portraits/            ← images des personnages (.webp, 189 fichiers)
    ├── Ren.webp
    ├── Yu.webp
    ├── Aigis.webp
    └── ...
```

---

## `characters_clean.js`

Tableau JavaScript exporté contenant **tous les personnages** disponibles dans le mode Classique.

### Structure d'un personnage

```js
{
  nom:         "Ren Amamiya",              // Nom complet
  genre:       ["Human","Male"],            // Tableau — comparé par intersection
  age:         "15-20",                     // Tranche d'âge
  arcane:      ["Fool","World"],            // Tableau — un perso peut avoir plusieurs arcanes
  opus:        ["P5","P5R","P5S","P5T","PQ2"], // Tableau — tous les jeux où il apparaît
  personaUser: true,                        // Utilisateur de Persona ou Shadow ?
  persona:     "Arsène",                    // Nom du Persona
  emoji:       ["🎭", "🃏", "💥"],           // Séquence emoji (mode Emoji)
  quote:       "...You are held captive...", // Citation officielle affichée à la victoire
}
```

Pas de champs `codename`, `realname`, `role`, `sex`, `japanese` ou `dlc` — ces champs n'existent
pas dans les données.

### Filtres opus disponibles

| Clé filtre | Jeux couverts                               |
| ---------- | ------------------------------------------- |
| `P1`       | Persona 1                                   |
| `P2`       | P2: Innocent Sin, P2: Eternal Punishment    |
| `P3`       | P3, P3 FES, P3 Portable, P3 Reload          |
| `P4`       | P4, P4 Golden, P4 Arena Ultimax, P4 Dancing |
| `P5`       | P5, P5 Royal, P5 Strikers, P5 Tactica       |
| `P5X`      | Persona 5 The Phantom X                     |
| `PQ`       | Persona Q, Persona Q2                       |

---

## `portraitsMap.js`

Objet de correspondance `{ nomPersonnage: "identifiant" }` — une valeur **sans** extension ni
chemin (ex: `"Ren Amamiya": "Ren"`), pas un chemin complet. Chaque mode reconstruit lui-même le
chemin et l'extension (`portraitsMap[name] || name.split(" ")[0]`, puis `.webp`). Utilisé par
Classique, Emoji, Silhouette et All-Out Attack pour afficher la bonne image.

---

## `portraits/`

Dossier contenant les portraits des personnages au format **WebP** pour un chargement optimisé.

Quelques exemples (vignettes 72 px) :

<table>
  <tr>
    <td align="center"><img src="portraits/Ren.webp" width="72" alt="Ren"><br><sub>Ren (Joker)</sub></td>
    <td align="center"><img src="portraits/Yu.webp" width="72" alt="Yu"><br><sub>Yu Narukami</sub></td>
    <td align="center"><img src="portraits/Aigis.webp" width="72" alt="Aigis"><br><sub>Aigis</sub></td>
    <td align="center"><img src="portraits/Ann.webp" width="72" alt="Ann"><br><sub>Ann Takamaki</sub></td>
    <td align="center"><img src="portraits/Mitsuru.webp" width="72" alt="Mitsuru"><br><sub>Mitsuru Kirijo</sub></td>
  </tr>
  <tr>
    <td align="center"><sub>Persona 5</sub></td>
    <td align="center"><sub>Persona 4</sub></td>
    <td align="center"><sub>Persona 3</sub></td>
    <td align="center"><sub>Persona 5</sub></td>
    <td align="center"><sub>Persona 3</sub></td>
  </tr>
</table>

> **Note** : Les portraits sont la propriété d'Atlus / SEGA. Ils sont utilisés dans un contexte fan-made non commercial.

---

## Ajouter un personnage

1. Ajouter l'entrée dans `characters_clean.js` en respectant le format ci-dessus.
2. Déposer le portrait `.webp` dans `portraits/` avec le bon nom (doit correspondre au champ `portrait`).
3. Ajouter l'entrée dans `portraitsMap.js` si nécessaire.
4. Tester via la console du navigateur : `debugAllClassique()` (si disponible).
