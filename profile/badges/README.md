<div align="center">

# 🎖️ Badges

> **60+ récompenses à débloquer — achievements, événements, secrets, social.**

</div>

---

## Structure

```
profile/badges/
├── badges.css         ← Styles (grille, couleurs rareté, animation déblocage)
├── badgesData.js      ← Catalogue des badges (id, slug, catégorie, rareté, condition)
├── badgesManager.js   ← Logique (vérification conditions, sync BDD, rendu UI)
└── images/            ← Visuels WebP / PNG des badges (60+ fichiers)
```

---

## Catégories

5 catégories réelles (`BADGE_CATEGORIES` dans `badgesData.js`) :

| Catégorie          | Description                         | Exemples                                             |
| ------------------ | ----------------------------------- | ---------------------------------------------------- |
| 🏆 **Achievement** | Performance en jeu                  | First Win, One Shot, Night Owl, Ace Detective, Strega |
| 🔥 **Streak**      | Paliers de série (streak globale)   | The Ignition (7j), The Divine Blaze (30j), Ragnarök's Dawn (90j), Crest of the Morning Star (120j), The Eternal Zenith (365j) |
| 🎉 **Event**       | Badges saisonniers ou codes limités | Christmas 2025, New Year 2026, Tanabata, St-Valentin |
| 🔒 **Secret**      | Conditions cachées non documentées  | True Hacker, Truth & Duality, Tae Takemi Fan, Dzulian |
| 👥 **Social**      | Interactions avec d'autres joueurs  | Best Bro, Leblanc Meeting, Take The Pose, Data Mining |

---

## Raretés

| Rareté        | Couleur | Condition type                   |
| ------------- | ------- | -------------------------------- |
| **Common**    | Gris    | Accessible rapidement            |
| **Rare**      | Bleu    | Demande un effort notable        |
| **Epic**      | Violet  | Condition difficile ou cachée    |
| **Legendary** | Or      | Extrêmement rare, souvent secret |

---

## Flux de déblocage

```
Fin de partie / action utilisateur
         ↓
badgesManager.checkBadgeConditions()
         ↓
Nouveau badge détecté côté client
         ↓
POST /api/badges (validation serveur — anti-triche)
         ↓
INSERT INTO badges_unlocked
         ↓
syncBadgesWithBackend()
         ↓
renderBadgesPreview() + renderBadgesModal()   ← mise à jour UI sans rechargement
```

> Les conditions sont **vérifiées côté serveur** — le frontend signale un candidat, le backend valide.

---

## Codes événement

Des badges exclusifs peuvent être obtenus via des codes limités dans le temps :

```js
// Appel depuis le profil
POST /api/badges/redeem  { "code": "PERSONA-2025" }
```

La validation vérifie : code existant, quota non atteint, date d'expiration, unicité par utilisateur.
Après validation : `INSERT IGNORE INTO badges_unlocked` + `INSERT INTO event_codes_redeemed`.

---

## Affichage profil

Le joueur peut épingler jusqu'à **4 badges** sur son profil public (`profiles.selected_badges`).

```js
badgesManager.renderBadgesPreview(); // 4 slots sur la page profil
badgesManager.renderBadgesModal(); // grille complète dans la modale
```

> ⚠️ Race condition connue et résolue : `syncBadgesWithBackend()` est async fire-and-forget.
> Les deux fonctions `render*` doivent être appelées **dans le callback du fetch**, après sync, pas avant.

---

## Chemins relatifs

Depuis `profile/badges/`, les ressources partagées sont à deux niveaux :

- CSS global : `../../css/`
- JS partagé : `../../js/`
- Styles profil : `../profile-page.css`
