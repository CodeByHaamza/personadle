<div align="center">

# 👤 Profil Joueur

<img src="https://img.shields.io/badge/cloud--first-backend%20source%20of%20truth-2496ED?style=for-the-badge" alt="Cloud-first">
<img src="https://img.shields.io/badge/Social%20Link-rang%201→10-e63946?style=for-the-badge" alt="Social Link">
<img src="https://img.shields.io/badge/offline-fallback%20localStorage-success?style=for-the-badge" alt="Offline">

> **Tout ce qui te définit comme joueur** — avatar, stats, amis, Social Link, titres.

</div>

---

## 🪪 À quoi ressemble un profil

<table>
  <tr>
    <td rowspan="2" align="center"><img src="../img/avatar/Joker.jpg" width="104" alt="avatar"></td>
    <td><h3>🎭 Joker <sub>· ✦ True Confidant</sub></h3><sub>Titre équipé : <b>Phantom Thief</b> · couleur UI rouge · 🎵 Last Surprise</sub></td>
  </tr>
  <tr>
    <td>🏆 <b>142</b> victoires &nbsp;·&nbsp; 🔥 streak <b>7</b> &nbsp;·&nbsp; 🎯 record <b>23</b> &nbsp;·&nbsp; ⏱️ 4 h jouées</td>
  </tr>
</table>

Un profil = un **avatar**, un **pseudo**, un **titre** équipé, une **couleur d'UI**, une **musique**,
un **fond d'écran**, ses **statistiques** par mode, ses **amis** et ses **Social Links**. Le tout
exportable en **carte PNG** partageable.

---

## 🗂️ Structure

```
profile/
├── profile.html / profile-page.css / profile-page.js  ← page profil (affichage + éditeur)
├── profileStats.js      ← mise à jour des statistiques après chaque partie
├── profile-view.js      ← vue profil public d'un autre joueur (?view= / ?uid=)
├── friends/             ← système d'amis
├── leaderboard/         ← classements
├── badges/              ← système de badges (→ voir badges/README.md)
├── titles/              ← titres/rangs joueur déblocables
└── Wallpaper/           ← fonds d'écran du profil
```

---

## ☁️ Cloud Sync

Le profil v2.0 est **source-of-truth backend** :

- `js/cloud-sync.js` → `pullProfileFromCloud()` écrase le `localStorage` depuis le serveur au login
  et toutes les 3 minutes.
- `js/auth.js` → events `personadle:auth-login` / `personadle:auth-logout` sans recharger la page.
- Le jeu fonctionne **hors ligne** ; la sync reprend au retour en ligne via `savePendingSession()`.

### Structure du profil (cloud)

```js
{
  pseudo:      "Joker",
  avatar:      "Ren.webp",
  wallpaper_id: 3,
  equipped_title_id: 7,
  profile_music_id: 12,
  stats: {
    Classic:    { wins: 12, giveups: 1, games: 15, streak: 4, streak_record: 7 },
    Emoji:      { wins: 5,  giveups: 0, games: 6,  streak: 2, streak_record: 5 },
    // Silhouette, AllOut, Personae, Music…
  },
}
```

---

## 👥 Système d'amis (`friends/`)

- Recherche par **pseudo** ou par **code ami** unique.
- Envoyer / accepter / refuser / supprimer une demande.
- Statut en ligne (`last_seen_at`).
- Animations de demande : 📺 P4 TV · 🃏 Calling Card · 🔫 P3 Evoker (au choix dans les paramètres).

```
GET /api/friends · POST /api/friends · PATCH /api/friends/:id · DELETE /api/friends/:id
```

---

## 💫 Social Link

La relation entre deux amis progresse en **rang 1 → 10** via des interactions mutuelles.

| Rang | Nom              | XP    | Rang | Nom              | XP    |
| :--: | ---------------- | ----: | :--: | ---------------- | ----: |
|  1   | Stranger         |     0 |  6   | Trusted Ally     | 1 000 |
|  2   | Acquaintance     |   100 |  7   | True Ally        | 1 350 |
|  3   | Companion        |   250 |  8   | Bond             | 1 750 |
|  4   | Ally             |   450 |  9   | Unbreakable Bond | 2 200 |
|  5   | Confidant        |   700 | 10   | True Confidant   | 2 700 |

| Action                     | XP solo | XP mutuel |
| -------------------------- | :-----: | :-------: |
| Visiter le profil d'un ami |    5    |    10     |
| Partager son score du jour |   10    |    20     |
| Comparer ses stats         |   10    |    20     |
| Envoyer / relever un défi  |   15    |    35     |
| Jouer le même jour (auto)  |   20    |    20     |

> **Rang 10 — True Confidant** : halo doré pulsant + burst de particules + label "✦ True Confidant"
> à chaque visite (`css/rank10-effect.css` + `applyRank10Effect()` dans `js/social-link.js`).

---

## 🏆 Leaderboard (`leaderboard/`)

Classements par **mode** × **période** (hebdo / mensuel / all-time) × **scope** (tous / amis).

```
GET /api/leaderboard?mode=Classic&period=weekly&friends_only=1
```

La réponse inclut `my_rank` → on affiche sa position sans paginer jusqu'à soi.

---

## 🔰 Titres / Rangs (`titles/`)

Un titre s'affiche sous le pseudo, déblocable par conditions de stats, **vérifié côté serveur**.

```
GET /api/titles · POST /api/titles/unlock · PATCH /api/user (equipped_title_id)
```

---

## 🎖️ Badges & 🖼️ Wallpapers

- **Badges** : grille de récompenses, **déblocage vérifié côté serveur** (anti-triche) via
  `GET /api/badges` + `syncBadgesWithBackend()`. Détails techniques → [`badges/README.md`](badges/README.md).
- **Wallpapers** : fonds d'écran du profil, gérés en BDD (table `wallpapers`), unlock vérifié serveur.

---

## `profileStats.js` — stats de fin de partie

Appelé par chaque mode à la fin d'une partie :

```js
import { updateProfileStats } from "../profile/profileStats.js";

updateProfileStats({ result: "win", mode: "Music", timeSpent: 42 });
```

Envoie la session au backend via `savePendingSession()` (fallback `localStorage` si hors ligne).
Frontière de journée **toujours** en heure de Paris (`parisDateKey()`), jamais UTC.

---

## 🖼️ Export de la carte de profil

Le bouton **Share Profile** génère un PNG via `html2canvas` : 8 thèmes, wallpapers Persona,
boutons Download · X · Discord · Email. (`js/calling-card.js` + `css/calling-card.css`.)

---

## Données `localStorage` (cache hors ligne)

| Clé                  | Description                                          |
| -------------------- | --------------------------------------------------- |
| `personaUserProfile` | Objet JSON complet : pseudo, avatar, wallpaper, stats |
| `personadle_lang`    | Langue sélectionnée                                 |
| `personaSettings`    | Paramètres UI (dark mode, daltonien, anim amis…)    |

> En v2.0, `localStorage` est un **cache**. La source de vérité est le backend :
> `pullProfileFromCloud()` écrase le cache à chaque login et toutes les 3 minutes.
