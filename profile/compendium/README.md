<div align="center">

# 📖 Le Compendium

> **Ton carnet de collection : tout ce que tu as accompli, daté, avec qui, et un petit mot.**

</div>

---

## Ce que c'est

Un livre, accessible depuis la page profil (bouton au pentacle sous le mode
sombre — hommage au _Grimoire du Cœur_ de Persona Q). Couverture fermée à
l'arrivée, puis double page avec six chapitres en onglets :

| Chapitre         | Contenu                                                                                          | Source                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 🎖️ Badges        | Chaque badge débloqué et sa date                                                                 | `badges_unlocked`                                                       |
| 🏅 Titres        | Titres obtenus, nom dans la langue du joueur, rareté                                             | `user_titles` × `titles`                                                |
| 🖼️ Fonds d'écran | Fonds débloqués, jeu d'origine                                                                   | `user_wallpapers` × `wallpapers`                                        |
| 💙 Liens         | Amitiés nouées, chaque rang de Social Link franchi, ✦ MAX à 10                                   | `friendships`, `social_links`, `social_link_rankup_notifs`              |
| ⚔ Défis          | Défis terminés dans les deux sens (gagné / perdu / tenu / battu)                                 | `messages` (type `challenge`, statut `beaten`/`expired`)                |
| 🌟 Exploits      | Première partie, première victoire et premier sans-faute par mode, modes Expert, record de série | `game_sessions`, `expert_unlocks_granted`, `users.global_streak_record` |

Chaque entrée = visuel + titre + **texte d'ambiance** + date. Décisions produit
(2026-09-12) :

- **Texte généré, pas de note personnelle** — `compendium.flavor.*` dans
  `lang/*.json`, avec variables (`{{name}}`, `{{mode}}`, `{{score}}`…).
- **Rien que de l'existant** — aucune table nouvelle, aucune migration. Le carnet
  se lit dans les données déjà là.
- **Public, comme le profil** — depuis le profil d'un ami, le même bouton ouvre
  le sien (`compendium.html?view=CODE`).
- **Jamais de date inventée** — un rang de Social Link atteint avant l'arrivée
  de l'historique des rang-ups, ou un record de série, s'affiche
  « Avant le Compendium ».

---

## Structure

```
profile/compendium/
├── compendium.html          ← page (couverture + livre)
├── compendium.css           ← Velvet Room : bleu profond, or, papier crème ; animations cp*
├── compendium.js            ← page : fetch, couverture, onglets, tourne-page, rendu
├── compendium_entries.js    ← PUR : réponse API → chapitres d'entrées (testé)
└── README.md
```

Backend : `api/user/compendium.php` (`GET /api/user/compendium`, route dans
`api/user/.htaccess`).

```
GET /api/user/compendium              → le sien (session requise)
GET /api/user/compendium?code=XXXXXXXX → par code ami (public)
GET /api/user/compendium?id=42         → par id (public)
```

Réponse : `{ user, badges[], titles[], wallpapers[], friends[] (avec rank_ups[]),
challenges[], feats{} }` — lecture seule, comptes supprimés exclus, défis
plafonnés à 300.

Client : `api.user.compendium({ code } | { id } | {})` dans `js/api.js`.

---

## Flux de la page

1. `initCompendium()` attend i18n + auth, lit `?view=`, appelle l'API.
2. `buildChapters(data, { lang })` (pur) classe et trie : entrées datées du plus
   récent au plus ancien, non datées à la fin, record de série épinglé en tête.
3. Couverture : pseudo du propriétaire, bouton _Ouvrir_ → animation
   `.cp-cover--opening` (charnière à gauche) → livre.
4. Livre : onglets (un par chapitre, avec compteur), page de gauche = résumé
   chiffré (`chapterSummary`), page de droite = entrées paginées par 5
   (`paginate`) avec tourne-page 3D ; ‹ › et flèches clavier.
5. Mobile (≤ 768 px) : une page, onglets horizontaux défilables, balayage
   gauche/droite pour tourner, glissement à la place de la 3D.
   `prefers-reduced-motion` coupe toutes les animations.

---

## Conventions

- Fallback i18n **avec variables** : `t(key, fallback, vars)` — cf. CLAUDE.md §5.
- Noms de mode : `modes.<key>.name` (déjà traduits partout), jamais une table
  locale.
- Scores et tentatives : `compendium.tries` / `compendium.tries_one`
  (« 4 essais » / « 1 essai »).
- Avatars de défi : résolus **côté client** depuis la liste d'amis
  (`friends[].avatar_data`), pour ne pas renvoyer un base64 par défi.
- Chemins : la page est à deux niveaux → `siteRootPrefix()` renvoie `../../`
  (`/profile/compendium/` est dans `_DEEP_SUBPATHS`, `js/gameCore.js`).

## Tests

- `tests/compendium_entries.test.js` — module pur : chapitres, tri, dates
  absentes, fusion des rang-ups, genres de défi, résumé, pagination.
- `tests/compendium_page.test.js` — page : couverture, `?view=`, états
  déconnecté / 404, onglets, pagination, rendu d'une entrée.

## Ajouter une source d'entrées

1. `api/user/compendium.php` — ajouter la requête (PDO préparé), exposer un
   tableau nommé.
2. `compendium_entries.js` — pousser des entrées `{ chapter, kind, title,
flavor, vars, date, img|icon|avatar }` ; `title` en clair ou `key:<clé i18n>`.
3. `lang/en.json` d'abord — `compendium.flavor.<kind>` (+ 5 langues,
   `npm run i18n:check`).
4. Un test dans `compendium_entries.test.js`.
