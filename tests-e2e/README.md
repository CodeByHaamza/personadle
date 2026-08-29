<div align="center">

# 🎭 Tests E2E (Playwright)

<img src="https://img.shields.io/badge/Playwright-Chromium-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright">
<img src="https://img.shields.io/badge/cible-stack%20Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">

> **109 tests (14 fichiers) sur un vrai navigateur, contre la stack Docker complète.**
> Couvre les parcours qu'aucun test unitaire ne voit (login, leaderboard, profil public, Social Link, admin).

</div>

---

## ✅ Ce qui est couvert

### `smoke.spec.js` — parcours UI

| Parcours                       | Vérifie                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| Accueil                        | la page charge, titre correct                                 |
| All-Out Attack                 | le mode charge                                                 |
| Leaderboard                    | les **19 faux joueurs** s'affichent (DB → API → front)        |
| Profil public (`?view=`)       | consultable **sans être connecté**                            |
| Login                          | parcours auth réel via la modale (seed `ren@personadle.seed`) |

### `api.spec.js` — régressions sensibles (via l'API)

| Test                     | Vérifie                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Sélection de badges      | les badges épinglés **persistent** côté serveur (PATCH → GET)   |
| Streak global cross-mode | le streak **ne s'effondre pas** quand on change de mode le même jour |

### `social-link.spec.js` — parcours Social Link complet (via l'API)

| Test                                  | Vérifie                                                    |
| -------------------------------------- | ----------------------------------------------------------- |
| Garde-fou "Not friends"                | l'action Social Link échoue tant que les 2 comptes ne sont pas amis |
| Demande d'ami                          | A envoie une demande à B via `friend_code`                 |
| Acceptation                            | B accepte la demande                                        |
| XP mutuelle                            | A et B gagnent chacun de l'XP en faisant `share_streak` le même jour |
| Montée de rang                         | une 2e action mutuelle fait franchir le seuil de rang 2 (100 XP) |
| Anti-spam                              | l'action ne peut pas être répétée le même jour               |

### `admin.spec.js` — endpoints admin (via l'API)

Utilise le compte admin de seed (`admin@personadle.local`, `docker/mysql/init/02_seed_test.sql`
— nécessite une base fraîche, le seed ne tourne qu'à la première init du volume Docker).

| Test                                          | Vérifie                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| `GET /api/admin/users` (admin)                | réussit, retourne une liste                                |
| `GET /api/admin/users` (non-admin)            | 403 (`requireAdmin()`)                                     |
| `GET /api/admin/audit_log` (admin)            | réussit, retourne une liste                                |
| `GET /api/admin/audit_log` (non-admin)        | 403                                                         |
| `GET /api/admin/rate_limits` (admin)          | réussit                                                     |
| `PATCH /api/admin/users/:id` (non-admin)      | 403 avant même la logique de ban                           |

`api.spec.js` couvre aussi l'anti-triche de `POST /api/user/recover-streak` : rejet d'un
`previous_streak` supérieur au nombre de jours distincts réellement joués, et rejet d'une valeur
hors bornes (`< 2`).

### `admin-extended.spec.js` — endpoints admin restants (via l'API)

Complète `admin.spec.js`, qui ne couvrait que `users`/`audit_log`/`rate_limits`. Même compte
admin de seed.

| Endpoint                                        | Vérifie                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `event_codes` (GET/POST/PATCH/DELETE)           | 403 non-admin, cycle complet créer → lister → désactiver → supprimer      |
| `error_logs` (GET)                              | 403 non-admin, pagination admin                                           |
| `deletion_requests` (GET, POST .../process)     | 403 non-admin, pagination admin                                           |
| `social-links` (GET liste, GET détail)          | 403 non-admin, liste admin, 404 sur id inexistant                         |
| `users/:id/badges` (POST/DELETE)                | 403 non-admin, accorder/re-accorder (`already_had`)/retirer, 404 slug inconnu |
| `users/:id/titles` (POST/PATCH equip/DELETE)    | accorder, équiper, déséquiper, retirer — catalogue lu via `/api/titles`   |
| `users/:id/wallpapers` (POST/DELETE)            | accorder/retirer — catalogue lu via `/api/wallpapers`                     |
| `users/:id/stats` (PATCH)                       | 403 non-admin, écrasement valide, 400 mode invalide, 400 champ manquant   |
| `users/:id/friends/:fid` (DELETE)               | 403 non-admin, 404 amitié inexistante                                     |

### `game-flow.spec.js` — partie complète, langue, responsive (navigateur réel)

| Test                                          | Vérifie                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| Give Up en Classique                          | révèle la réponse, enregistre une session `result: "giveup"` (pas `"win"` — cf. le fix du 2026-07-05) |
| Changement de langue                          | l'UI se met à jour et persiste après rechargement          |
| Responsive (375px)                            | pas de débordement horizontal sur les 6 modes de jeu        |

---

## 🚀 Lancer

```bash
# 1. Installer Playwright (une fois) — voir §sudo ci-dessous
npm i -D @playwright/test
npx playwright install chromium

# 2. Démarrer la stack Docker (DB seedée avec les faux joueurs)
make up

# 3. Lancer les E2E
npm run test:e2e
```

> Cible par défaut : `http://localhost:8080` (le `APP_PORT` par défaut de `docker-compose.yml`).
> Si ton `.env` change `APP_PORT` : `PLAYWRIGHT_BASE_URL=http://localhost:TON_PORT npm run test:e2e`.
> Pas de `webServer` dans [playwright.config.js](../playwright.config.js) — c'est Docker qui sert le site.

### 🔑 sudo

`npx playwright install --with-deps chromium` installe les **dépendances système** du navigateur
et requiert `sudo` (apt). Si tu n'as pas les droits, lance `npx playwright install chromium` (sans
`--with-deps`) : suffisant si les libs sont déjà présentes.

---

## ⚙️ Statut CI

Lancés dans un job dédié (`e2e`) de `.github/workflows/ci.yml` : la stack Docker complète
(`docker compose up -d --build`) est démarrée dans le runner, puis Playwright tourne contre
`http://localhost:8080`. Job indépendant des autres (JS/PHP) — ils tournent en parallèle.
Toujours lançable en local avant une release ou un gros refactor front (voir ci-dessus).

**Bloquant depuis le 24 juillet 2026.** Branché en CI le 8 juillet 2026 en `continue-on-error`
le temps de confirmer sa stabilité ; critère de sortie (10 runs consécutifs verts sur `develop`)
largement atteint — 28 runs vérifiés job par job entre le 8 et le 24 juillet, tous verts.
`continue-on-error: true` retiré du job `e2e` dans `.github/workflows/ci.yml` : un échec e2e
bloque désormais la CI comme n'importe quel autre job.

## 💡 Scénarios à ajouter

- ~~Partie complète (deviner → victoire → stats mises à jour)~~ — fait via Give Up
  (`game-flow.spec.js`), seul chemin déterministe sans devoir prédire la cible du jour.
- Menu Jack Frost + restauration de streak — **partiellement fait** : l'anti-triche serveur de
  `POST /api/user/recover-streak` est testée (`api.spec.js`), mais pas l'ouverture du menu ni le
  clic "Restaurer" en UI — nécessiterait de simuler plusieurs jours de parties réelles
  (`played_date` n'accepte qu'aujourd'hui/hier, cf. `api/sessions.php`) pour tester le chemin de
  succès en conditions réalistes.
- ~~Changement de langue (FR/EN/ES/DE/IT) et persistance~~ — fait (`game-flow.spec.js`, langue FR
  uniquement pour l'instant — ES/DE/IT non testées individuellement).
- ~~Responsive (viewport mobile) sur les 6 modes~~ — fait (`game-flow.spec.js`, 375px, vérifie
  l'absence de débordement horizontal).
