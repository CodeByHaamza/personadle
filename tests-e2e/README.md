<div align="center">

# 🎭 Tests E2E (Playwright)

<img src="https://img.shields.io/badge/Playwright-Chromium-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright">
<img src="https://img.shields.io/badge/cible-stack%20Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">

> **5 smoke tests sur un vrai navigateur, contre la stack Docker complète.**
> Couvre les parcours qu'aucun test unitaire ne voit (login, leaderboard, profil public).

</div>

---

## ✅ Ce qui est couvert (`smoke.spec.js`)

| Parcours                       | Vérifie                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| Accueil                        | la page charge, titre correct                                 |
| All-Out Attack                 | le mode charge                                                 |
| Leaderboard                    | les **19 faux joueurs** s'affichent (DB → API → front)        |
| Profil public (`?view=`)       | consultable **sans être connecté**                            |
| Login                          | parcours auth réel via la modale (seed `ren@personadle.seed`) |

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

> Cible par défaut : `http://localhost:8090`. Si ton site Docker tourne sur un autre port :
> `PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e`.
> Pas de `webServer` dans [playwright.config.js](../playwright.config.js) — c'est Docker qui sert le site.

### 🔑 sudo

`npx playwright install --with-deps chromium` installe les **dépendances système** du navigateur
et requiert `sudo` (apt). Si tu n'as pas les droits, lance `npx playwright install chromium` (sans
`--with-deps`) : suffisant si les libs sont déjà présentes.

---

## ⚙️ Statut CI

**Optionnels** : non lancés par `npm test` ni par la CI par défaut (ils exigent la stack Docker).
À lancer en local avant une release ou un gros refactor front.

## 💡 Scénarios à ajouter

- Partie complète (deviner → victoire → stats mises à jour)
- Menu Jack Frost + restauration de streak
- Changement de langue (FR/EN/ES/DE/IT) et persistance
- Responsive (viewport mobile) sur les 6 modes
