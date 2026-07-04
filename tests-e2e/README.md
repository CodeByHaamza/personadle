<div align="center">

# 🎭 Tests E2E (Playwright)

<img src="https://img.shields.io/badge/Playwright-Chromium-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright">
<img src="https://img.shields.io/badge/cible-stack%20Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">

> **13 tests (3 fichiers) sur un vrai navigateur, contre la stack Docker complète.**
> Couvre les parcours qu'aucun test unitaire ne voit (login, leaderboard, profil public, Social Link).

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
`http://localhost:8080`. Non bloquant pour les autres jobs (JS/PHP) — ils tournent en parallèle.
Toujours lançable en local avant une release ou un gros refactor front (voir ci-dessus).

## 💡 Scénarios à ajouter

- Partie complète (deviner → victoire → stats mises à jour)
- Menu Jack Frost + restauration de streak
- Changement de langue (FR/EN/ES/DE/IT) et persistance
- Responsive (viewport mobile) sur les 6 modes
