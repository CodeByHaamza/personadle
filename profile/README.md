# profile/ — Système de profil, statistiques et badges

Ce dossier gère l'ensemble du **système de profil joueur** : personnalisation (avatar, pseudo, fond d'écran), statistiques de jeu et collection de badges à débloquer.

---

## Structure

```
profile/
├── profile.js           ← page profil complète (affichage + éditeur)
├── profileStats.js      ← mise à jour des statistiques après chaque partie
├── badges/
│   ├── badgesData.js    ← définition de tous les badges (conditions, images, textes)
│   ├── badgesManager.js ← vérification et attribution des badges
│   ├── badges.css       ← styles des badges (grille, animations, états)
│   └── images/          ← icônes des badges (.png / .webp)
└── Wallpaper/           ← fonds d'écran disponibles pour le profil (37+)
```

---

## `profile.js` — Page profil

Le profil joueur est accessible depuis la page d'accueil. Il affiche :
- **Avatar** : image de profil choisie parmi les avatars du dossier `img/avatar/`
- **Pseudo** : nom d'affichage personnalisable
- **Fond d'écran** : image de fond choisie parmi les wallpapers disponibles
- **Statistiques globales** : nombre de parties, victoires, abandons, temps moyen
- **Collection de badges** : badges débloqués avec leur description

Toutes les données sont persistées dans `localStorage` sous la clé `personaUserProfile` (objet JSON).

### Structure du profil

```js
{
  pseudo:      "Joker",
  avatar:      "Ren.webp",
  wallpaper:   "P5_Phantom_Thieves_Wallpaper.png",

  // Statistiques par mode
  stats: {
    Classic:    { wins: 12, losses: 3, giveups: 1, totalTime: 4280 },
    Emoji:      { wins: 5,  losses: 1, giveups: 0, totalTime: 900 },
    Silhouette: { ... },
    AllOut:     { ... },
    Personae:   { ... },
    Music:      { ... }
  },

  // Flags de déverrouillage des badges
  foundBurnMyDread:  true,
  foundZutomayo:     false,
  lostToNeverMore:   false,
  // ...
}
```

---

## `profileStats.js` — Mise à jour des stats

Exporté et appelé par chaque mode à la fin de partie :

```js
import { updateProfileStats } from "../profile/profileStats.js";

updateProfileStats({
  result:    "win",     // "win" | "giveup"
  mode:      "Music",   // Nom du mode
  timeSpent: 42         // Secondes passées sur la partie
});
```

Cette fonction lit le profil depuis le `localStorage`, met à jour les compteurs du bon mode, et sauvegarde.

---

## `badges/` — Système de badges

### `badgesData.js`

Définit la liste complète des badges disponibles. Chaque badge a :

```js
{
  id:          "foundBurnMyDread",       // Clé dans le profil
  name:        "Memento Mori",           // Nom affiché
  description: "Tu as trouvé Burn My Dread dans le mode Musique", // Texte
  image:       "Badges_Burn_My_Dread_Silver.png",  // Icône dans badges/images/
  condition:   (profile) => profile.foundBurnMyDread === true
}
```

### `badgesManager.js`

Vérifié après chaque fin de partie (victoire ou abandon) via import dynamique :

```js
import("../profile/badges/badgesManager.js").then(module => {
  module.checkBadges(currentProfile, updatedProfile => {
    localStorage.setItem("personaUserProfile", JSON.stringify(updatedProfile));
  });
});
```

`checkBadges` passe en revue tous les badges de `badgesData.js`, évalue leurs conditions, et notifie le joueur si un nouveau badge est débloqué.

### Galerie des badges

| Badge | Nom | Condition |
|-------|-----|-----------|
| ![](badges/images/Badges_Fisrt_Win.png) | Première Victoire | Gagner n'importe quel mode pour la première fois |
| ![](badges/images/Badges_Burn_My_Dread_Silver.png) | Memento Mori | Trouver "Burn My Dread" en mode Musique |
| ![](badges/images/Badges_Zotomayo.webp) | Hippocampus Reload | Trouver la collab ZUTOMAYO × P3R |
| ![](badges/images/Badges_Velvet_master.png) | Velvet Master | Maîtriser le mode Classique |
| ![](badges/images/Badges_Github_Morgana.png) | Suivre Morgana | Trouver le dépôt GitHub |
| ![](badges/images/Badges_P1_P2_Fan.png) | Ancien Combattant | Deviner un personnage de P1 ou P2 |
| ![](badges/images/Badges_Persona_Q.webp) | Persona Q | Débloquer via le mode Silhouette |
| ![](badges/images/Badge_Twin_Blade.png) | Twin Blade | Deviner Kaguya Picaro en mode Personae |
| ![](badges/images/Badge_Picaro.png) | Picaro | Deviner une Persona Picaro |
| ![](badges/images/Badges_Chiness_New_Year.webp) | Nouvel An Chinois | Badge événement saisonnier |
| ![](badges/images/Badges_Christmas_2025.png) | Noël 2025 | Badge événement Noël |

> La liste complète est dans `badgesData.js`. De nouveaux badges sont ajoutés à chaque mise à jour.

### `badges.css`

Contient les styles de la grille de badges :
- `.badge-grid` — disposition en grille responsive
- `.badge-card` — carte individuelle avec image + nom
- `.badge-card.locked` — badge non débloqué (opacité réduite, image grisée)
- `.badge-card.new` — animation de déverrouillage (flash doré)

---

## `Wallpaper/` — Fonds d'écran

Dossier contenant les images de fond utilisables dans le profil. 37+ wallpapers issus des différents jeux de la saga Persona. Le joueur peut en sélectionner un dans l'éditeur de profil.

---

## Données `localStorage`

Tout le profil est stocké dans une seule clé :

| Clé | Description |
|-----|-------------|
| `personaUserProfile` | Objet JSON complet : pseudo, avatar, wallpaper, stats, flags badges |
