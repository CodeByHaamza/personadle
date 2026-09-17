# Design Spec — Badges Backend + Wallpapers Débloquables + Titres Visuels

**Date :** 2026-04-26  
**Auteur :** Hamza Karrouchi  
**Statut :** Approuvé ✅

---

## Contexte

Passage du système de badges, wallpapers et titres vers le backend (v2.0).  
Approche choisie : **B — par couche, dans l'ordre** (badges → wallpapers → titres).  
Backend sync : **approche B — frontend trust** (frontend vérifie, appelle le backend pour enregistrer).

---

## Vague 1 — Badge Backend Integration

### Architecture

- Le frontend garde toute la logique de vérification des conditions (`badgesData.js`)
- Quand un badge est débloqué localement → `POST /api/badges/unlock { badge_id }`
- Au login / init profil → réconciliation local ↔ backend :
  - union des deux sets (local + backend)
  - badges absents du backend → push via POST
  - badges présents en backend mais absents du local → ajoutés localement + notification

### Endpoints

```
POST /api/badges/unlock        Body: { badge_id: "ace_detective" }
POST /api/badges/event-code    Body: { code: "XMAS2025" }
```

`GET /api/user/:id` retourne déjà `badges[]` depuis `badges_unlocked` — pas de changement.

### Fichiers modifiés

| Fichier                           | Changement                                        |
| --------------------------------- | ------------------------------------------------- |
| `profile/badges/badgesData.js`    | Ajouter 29 nouveaux badges                        |
| `profile/badges/badgesManager.js` | Appel POST après unlock + réconciliation à l'init |
| `api/badges/index.php`            | Nouveau endpoint (unlock + event-code)            |
| `api/badges/.htaccess`            | RewriteRule pour /api/badges                      |
| `profile/badges/images/`          | Recevoir les 29 nouvelles images webp             |
| `lang/*.json`                     | Clés i18n pour les nouveaux badges                |

### Réconciliation locale ↔ backend (pseudo-code)

```js
async function syncBadgesWithBackend(profile, saveProfile) {
  if (!window._personadleApi?.isLoggedIn()) return;
  const { badges: backendBadges } = await window._personadleApi.getUser();
  const backendIds = backendBadges.map((b) => b.badge_id);
  const localIds = profile.badges || [];

  // Backend → local (sync cloud wins)
  const toAddLocally = backendIds.filter((id) => !localIds.includes(id));
  if (toAddLocally.length) {
    profile.badges = [...localIds, ...toAddLocally];
    saveProfile();
    toAddLocally.forEach((id) => showBadgeNotification(getBadgeById(id)));
  }

  // Local → backend (push missing)
  const toSyncUp = localIds.filter((id) => !backendIds.includes(id));
  for (const id of toSyncUp) {
    await window._personadleApi.unlockBadge(id);
  }
}
```

---

## Liste complète des 29 nouveaux badges

### Achievements

| ID                    | Nom                       | Condition                                                                                          | Logique de check (frontend)                                                                                             |
| --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `one_shot`            | Critical Strike           | Deviner en 1 seul essai (n'importe quel mode)                                                      | `attempts === 1 && result === 'win'` dans la session                                                                    |
| `aoa_vision`          | Piercing the Fog          | Deviner le AOA au 1er essai (encore flouté)                                                        | `attempts === 1 && mode === 'alloutattack'`                                                                             |
| `emoji_decoder`       | Emoji Decoder             | Gagner 10 parties en mode Emoji                                                                    | `modeCount.Emoji >= 10`                                                                                                 |
| `navigator`           | Eye of the Navigator      | Utiliser le hint 50 fois en Classic mode                                                           | `profile.classicHintsUsed >= 50`                                                                                        |
| `velvet_regular`      | Velvet Regular            | Jouer 50 jours uniques au total                                                                    | `profile.uniqueDaysPlayed >= 50`                                                                                        |
| `strega`              | Apostles of the Fall      | Trouver Hypnos (Takaya) + Moros (Jin) + Medea (Chidori) en mode Personae                           | `profile.foundHypnos && profile.foundMoros && profile.foundMedea`                                                       |
| `twin_fist`           | Twin Fist                 | Trouver la persona + AOA de Makoto Nijima (Queen) **et** Akihiko Sanada                            | `profile.foundMakotoNijima && profile.foundMakotoNijimaAOA && profile.foundAkihiko && profile.foundAkihikoAOA`          |
| `twin_spear`          | Twin Spear                | Trouver la persona + AOA de Kotone (P3P) **et** Ken Amada                                          | `profile.foundKotone && profile.foundKotoneAOA && profile.foundKen && profile.foundKenAOA`                              |
| `tradition_modernite` | Chronological Convergence | Trouver la persona de Naoto + persona de Futaba + "Secret Base" + "When Mother Was There" en Music | `profile.foundNaotoPersona && profile.foundFutabaPersona && profile.foundSecretBase && profile.foundWhenMotherWasThere` |
| `shapeshifter`        | The Formless Soul         | Deviner le même personnage dans 3 modes différents (cumulatif)                                     | `profile.characterModeMap` — un perso avec 3 clés de mode                                                               |
| `ideal_reality`       | Gentle Illusion           | Give up quand la musique cible est "Our Light" (Music mode)                                        | `profile.gaveUpOnOurLight === true`                                                                                     |
| `for_real`            | For Real                  | Trouver le AOA de Ryuji + sa persona en mode Personae                                              | `profile.foundRyujiAOA && profile.foundRyujiPersona`                                                                    |
| `night_owl`           | Phantom of the Night      | Jouer entre 00h00 et 05h00 (heure de Paris)                                                        | Heure Paris au moment du `buildGameSession`                                                                             |
| `nyx_hour`            | Nyx Hour                  | Jouer entre 00h00 et 00h30 (heure de Paris)                                                        | Heure Paris au moment du `buildGameSession`                                                                             |
| `pyro_spark`          | The Ignition              | Atteindre une streak de 7 jours                                                                    | `stats.streakRecord >= 7`                                                                                               |
| `raphael`             | The Divine Blaze          | Atteindre une streak de 30 jours                                                                   | `stats.streakRecord >= 30`                                                                                              |
| `surt`                | Ragnarök's Dawn           | Atteindre une streak de 90 jours                                                                   | `stats.streakRecord >= 90`                                                                                              |
| `lucifer`             | Crest of the Morning Star | Atteindre une streak de 120 jours                                                                  | `stats.streakRecord >= 120`                                                                                             |
| `helel`               | The Eternal Zenith        | Atteindre une streak de 365 jours                                                                  | `stats.streakRecord >= 365`                                                                                             |
| `reborn_phoenix`      | Phoenix Reborn            | Restaurer sa streak via la grâce (1 fois par 2 mois max)                                           | `profile.streakRestorationUsed === true`                                                                                |
| `stylist`             | Breathtaking Aesthetics   | Avatar perso + couleur UI + 1 badge équipé + musique de profil — les 4                             | `profile.avatarData && profile.profileTheme !== 'default' && profile.selectedBadges.length >= 1 && profile.profileSong` |

### Sociaux

| ID                | Nom             | Condition                                     |
| ----------------- | --------------- | --------------------------------------------- |
| `best_bro`        | Best Bro        | Avoir 2 amis ou plus                          |
| `data_mining`     | Data Mining     | Visiter 5 profils différents d'autres joueurs |
| `leblanc_meeting` | Leblanc Meeting | 3 amis ou plus connectés le même jour que toi |

### Événementiels (auto, date-based)

| ID             | Nom              | Fenêtre                                    |
| -------------- | ---------------- | ------------------------------------------ |
| `golden_week`  | Golden Week      | 29 avril – 5 mai                           |
| `tanabata`     | Tanabata         | 7 juillet                                  |
| `promised_day` | The Promised Day | Jouer le 31 décembre **et** le 1er janvier |

### Secrets

| ID                | Nom                    | Condition                                                                  |
| ----------------- | ---------------------- | -------------------------------------------------------------------------- |
| `hifumi_archives` | The Grandmaster's Tome | Ouvrir n'importe quel PDF de news sur le site                              |
| `report`          | The Priestess's Audit  | Cliquer sur le lien du formulaire bug report (forms.gle/SJeKi7cyUjRyp1vX8) |

---

## Vague 2 — Wallpaper Unlockable System

### Nouvelle table SQL

```sql
CREATE TABLE wallpapers_unlocked (
  user_id      BIGINT UNSIGNED NOT NULL,
  wallpaper_id VARCHAR(50)     NOT NULL,
  unlocked_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, wallpaper_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Endpoints

```
POST /api/wallpapers/unlock    Body: { wallpaper_id: "kamoshida_palace" }
```

`GET /api/user/:id` enrichi : retourne aussi `unlocked_wallpapers: ["kamoshida_palace", ...]`.

### Placement des fichiers

```
profile/Wallpaper/unlockable/
  kamoshida_palace.webp
  madarame_wallpaper.webp
  yukiko_dungeons.webp
  kanji_dungeons.webp
  rise_dungeons.webp
  mitsuo_dungeons.webp
  dark_shopping_district.webp
```

Les 37 wallpapers existants restent libres — aucun changement.

### Conditions de déblocage

| ID                       | Wallpaper              | Condition                                            | Logique                                           |
| ------------------------ | ---------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `kamoshida_palace`       | Kamoshida's Palace     | Avoir joué au moins 1 partie dans chacun des 6 modes | union des modes distincts dans `game_sessions`    |
| `madarame_wallpaper`     | Madarame's Palace      | Avatar personnalisé (canvas crop) + 1 ami minimum    | `profile.avatarData && friendCount >= 1`          |
| `yukiko_dungeons`        | Yukiko's Dungeons      | Jouer 3 jours consécutifs avec le filtre P4 actif    | `profile.p4ConsecutiveDays >= 3`                  |
| `kanji_dungeons`         | Kanji's Dungeons       | Envoyer un défi à un ami et qu'il l'accepte          | flag `profile.challengeAcceptedByFriend === true` |
| `rise_dungeons`          | Rise's Dungeons        | 30 parties totales en Music mode (win ou lose)       | `stats.Music.games >= 30`                         |
| `mitsuo_dungeons`        | Mitsuo's Dungeons      | 75 parties totales tous modes confondus              | sum de tous `stats.*.games >= 75`                 |
| `dark_shopping_district` | Dark Shopping District | Avoir un Social Link à rang 5+ avec un ami           | API `social_links` → rank >= 5                    |

### Notification de déblocage wallpaper

Animation distincte du badge : un **bandeau horizontal** qui glisse depuis le bas avec l'aperçu du wallpaper en miniature, texte "🖼️ Wallpaper Unlocked!" et le nom. Style P4 doré. Durée : 4s.

### UI côté profil

- Wallpapers débloquables affichés dans la galerie avec un **cadenas 🔒** si non débloqué
- Au survol d'un wallpaper verrouillé : tooltip "Condition : [texte de la condition]"
- Quand débloqué : animation courte + cadenas disparaît
- JS : `profile.unlockedWallpapers[]` (array local) + sync backend

---

## Vague 3 — Système de Titres Visuels (Calling Cards)

### Migration du système texte

- Les 10 titres-texte du seed SQL sont **supprimés** et remplacés par les 11 banners visuels
- Table `titles` : ajout d'une colonne `image_path VARCHAR(150)` pour stocker le chemin du banner
- Le reste du schéma (`user_titles`, `equipped_title_id` dans `profiles`) est conservé intact

### Migration SQL

```sql
ALTER TABLE titles ADD COLUMN image_path VARCHAR(150) NULL AFTER slug;
TRUNCATE TABLE user_titles;  -- reset (pas encore de vrais utilisateurs en prod)
TRUNCATE TABLE titles;
-- Re-seed avec les 11 banners visuels (voir ci-dessous)
```

### Placement des fichiers

```
profile/titles/
  joker_looking_cool.webp
  makoto_yuki_memento_mori.webp
  aigis_i_am_not_afraid.webp
  akechi_pancakes.webp
  yosuke_ride_the_wind.webp
  adachi_boring_isnt_it.webp
  marie_i_remembered.webp
  yu_reach_out_to_the_truth.webp
  naoya_first_awakening.webp
  maya_always_be_positive.webp
  velvet_room_thou_art_i.webp
```

### Conditions de déblocage des 11 titres

| Slug                        | Banner                      | Condition                                                              | Logique                             |
| --------------------------- | --------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| `velvet_room_thou_art_i`    | Thou Art I (Velvet Room)    | Débloquer 20 badges                                                    | `profile.badges.length >= 20`       |
| `joker_looking_cool`        | Looking Cool (Joker)        | Atteindre le top 100 d'un leaderboard                                  | API leaderboard `my_rank <= 100`    |
| `makoto_yuki_memento_mori`  | Memento Mori (Makoto P3)    | Jouer 100 jours uniques totaux                                         | `profile.uniqueDaysPlayed >= 100`   |
| `aigis_i_am_not_afraid`     | I Am Not Afraid (Aigis)     | Win 50 parties Classic                                                 | `stats.Classic.wins >= 50`          |
| `akechi_pancakes`           | Pancakes (Akechi)           | Win 3 parties sans give up sur 3 modes différents dans la même semaine | `profile.weeklyCleanWinModes >= 3`  |
| `yosuke_ride_the_wind`      | Ride the Wind (Yosuke)      | Avoir 5 amis ou plus                                                   | `friendCount >= 5`                  |
| `adachi_boring_isnt_it`     | Boring, Isn't It? (Adachi)  | Give up 50 fois au total                                               | sum de tous `stats.*.giveups >= 50` |
| `marie_i_remembered`        | I Remembered (Marie)        | Débloquer 15 badges                                                    | `profile.badges.length >= 15`       |
| `yu_reach_out_to_the_truth` | Reach Out to the Truth (Yu) | Win au moins 1 fois dans les 6 modes                                   | chaque mode a `wins >= 1`           |
| `naoya_first_awakening`     | The First Awakening (Naoya) | Win Classic 15 fois avec filtre P1                                     | `profile.classicP1Wins >= 15`       |
| `maya_always_be_positive`   | Always Be Positive (Maya)   | Win Emoji 10 fois avec filtre P2                                       | `profile.emojiP2Wins >= 10`         |

### Endpoint

```
POST /api/titles/unlock    Body: { title_id: 3 }
GET  /api/user/:id         → enrichi avec unlocked_titles[] + equipped_title_id
PATCH /api/user/:id        → equipped_title_id accepté (déjà géré)
```

### UI côté profil

- Nouvelle section "Calling Card" sur la page profil, sous les badges
- Le banner équipé est affiché en 16:4 (full-width dans la card profil)
- Galerie de déblocage : banners en 16:4 miniatures avec cadenas si verrouillé
- Tooltip sur les verrouillés : condition de déblocage

### Notification de déblocage titre

Animation distincte : un **flash de carte** style Persona (effet tarot retourné — l'image tourne face à face), centré à l'écran, avec le banner en grand, texte "✨ Title Unlocked!" et le nom du banner. Durée : 5s, fermeture au clic. Style doré / arcane.

---

## Résumé des fichiers à créer / modifier

### Nouveaux dossiers

```
api/badges/                      → index.php + .htaccess
api/wallpapers/                  → index.php + .htaccess
api/titles/                      → index.php + .htaccess
profile/Wallpaper/unlockable/    → 7 nouveaux wallpapers
profile/titles/                  → 11 banners visuels
```

### Fichiers modifiés

```
profile/badges/badgesData.js     → 29 nouveaux badges
profile/badges/badgesManager.js  → sync backend + notifications
profile/badges/images/           → 29 nouveaux .webp
profile/profile-page.js          → wallpapers débloquables + titres visuels
profile/profile-page.css         → UI wallpapers + titres + nouvelles animations
css/global.css                   → animations notification wallpaper + titre
sql/bdd_mysql.sql                → wallpapers_unlocked table + migration titles
lang/en.json + fr/es/de/it       → clés i18n pour nouveaux badges/wallpapers/titres
api/user/index.php               → enrichir GET avec unlocked_wallpapers + unlocked_titles
```

---

## Points d'attention (pièges connus)

- `profile.classicHintsUsed` n'existe pas encore → à initialiser dans `badgesManager.js` et à incrémenter dans `classiqueMode/modeClassique.js`
- `profile.uniqueDaysPlayed` n'existe pas → à calculer à partir de `game_sessions` au login ou localement depuis l'historique localStorage
- `profile.characterModeMap` pour Shapeshifter → structure `{ "Ryuji Sakamoto": ["classic", "emoji", "alloutattack"] }`
- Les flags Strega / Twin Fist / Twin Spear → à ajouter dans `personaeMode/modePersonae.js` et `allOutAttackMode/modeAllOutAttack.js`
- `our_light` flag pour Ideal Reality → à ajouter dans `musicsMode/modeMusic.js` (vérifier le nom exact de la chanson dans la BDD musiques)
- Pour Promised Day → nécessite stocker le flag "a joué le 31 déc" entre deux sessions (localStorage + backend)
- `wallpaper_id` dans `profiles` stocke déjà les wallpapers → les unlockables utilisent le même champ, le frontend vérifie juste si le user a le droit avant d'afficher le sélecteur
