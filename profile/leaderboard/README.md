<div align="center">

# 🏆 Leaderboard

> **Les meilleurs joueurs, par mode, par période, par métrique.**

</div>

---

## Structure

```
profile/leaderboard/
├── leaderboard.html    ← page HTML
├── leaderboard.css     ← styles (pills filtres, tableau, ma position)
└── leaderboard.js      ← logique (fetch API, filtres, pagination, my_rank)
```

---

## Filtres disponibles

| Filtre       | Options                                                         |
| ------------ | --------------------------------------------------------------- |
| **Scope**    | Global · Friends only                                           |
| **Mode**     | All · Classic · Emoji · Silhouette · All-Out · Personae · Music |
| **Période**  | All time · Month · Week · Today                                 |
| **Métrique** | Wins · Win rate · Best streak · Perfect · Games played          |

## API

`GET /api/leaderboard?mode=&period=&metric=&scope=&page=`

Retourne `{ rows: [...], my_rank: { rank, score } }` — le rang personnel est toujours inclus même si hors de la page affichée.

## Chemins relatifs

Depuis `profile/leaderboard/`, les ressources partagées sont à deux niveaux :

- CSS global : `../../css/`
- JS partagé : `../../js/`
- Styles profil : `../profile-page.css`
