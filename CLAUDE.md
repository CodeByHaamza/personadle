# CLAUDE.md — PersonaDLE

> Référence Claude Code. Lire en priorité.

---

## 1. Présentation

**PersonaDLE** — jeu de devinettes quotidien fan-made (Persona P1→P5X), 6 modes.
**Site** : https://personadle.net | **Dépôt** : https://github.com/CodeByHaamza/personadle | **v2.0** (backend PHP+MariaDB)

| Pseudo | Rôle |
|---|---|
| Hamza Karrouchi | Founder & Lead Dev — **seul mainteneur actif** depuis mi-2025 |
| Léo (L2GENDAIRE) | Data & Design (2025) — base de personnages d'origine, inactif depuis |
| Damien (Corbover) | Front-End / CSS (2026) — modularisation CSS, ponctuel |
| Dzulian | Consultant P1/P2 — ponctuel |

Le README distingue désormais « Core Team » (Hamza) et « Contributors & Credits »
(les trois autres, rôles datés) — décision Hamza du 2026-09-15 : le crédit reste, le
niveau d'implication est dit honnêtement.

---

## 2. Stack

- **Frontend** : Vanilla JS ES6+ (zéro framework), modules ES6, `localStorage`
- **Backend** : PHP 8.3 + PDO — MySQL 8.0 local / MariaDB 10.6+ Hostinger
- **Tests** : Vitest + jsdom (`npm test`)
- **Auth** : bcrypt + sessions PHP httpOnly — pas JWT

---

## 3. Architecture

```
personadle/
├── js/                  ← gameCore.js, api.js, auth.js, i18n.js, cloud-sync.js…
├── css/                 ← global.css + un CSS par composant
├── database/            ← characters_clean.js, personas.js, quotes.js, portraits/
├── lang/                ← en.json (source de vérité, 1264 clés), fr/es/de/it/pt.json
├── classiqueMode/  emojiMode/  allOutAttackMode/  silhouetteMode/  personaeMode/  musicsMode/
├── profile/             ← profile-page.js, badges/, friends/, leaderboard/
├── api/                 ← PHP REST (auth/, user/, messages/, social-links/, leaderboard/…)
├── tests/               ← 67 suites Vitest (1194 tests) + tests/php/ (PHPUnit)
└── sql/                 ← bdd_mysql.sql (28 tables)
```

**Fichiers clés :**
- `js/gameCore.js` — utilitaires partagés : `parisDateKey()`, `getDailyTarget()`, `savePendingSession()`, `FILTER_STORAGE_KEYS`
- `js/api.js` — client REST + `window._personadleApi` (bridge anti-circulaire)
- `js/cloud-sync.js` — `pullProfileFromCloud()` : backend = source de vérité absolue
- `api/bootstrap.php` — CORS, PDO singleton, `requireAuth()`, `requireAdmin()`
- `api/sessions.php` — logique streak (par mode, par date Paris, UTC → Paris)
- `api/lib/daily_target.php` — anti-triche (phase 1, détection) : recalcule la cible quotidienne
  attendue par mode (portage PHP de `getDailyTarget()`) contre `api/data/daily_pools.json`
  (généré par `scripts/export-daily-pools.js` depuis les datasets JS — `npm run pools:check`/`pools:build`)
- `api/lib/condition_check.php` — vérification générique de condition de déblocage
  (`condition_type`/`condition_mode`/`condition_value`), partagée par `titles`/`badges`/`wallpapers`

---

## 4. Conventions

### Branches — RÈGLE ABSOLUE : on ne merge JAMAIS sur `main`

Le flux est **`feature/*` → `develop` → `main`**, sans exception.

- **Toute PR de travail vise `develop`.** Correctif, contenu, doc, contribution externe
  reprise : la base est `develop`, jamais `main`.
- **`main` = ce qui tourne en prod.** Hostinger fait un `git pull` automatique en ~10-30 s
  sur chaque push. Merger une branche de travail directement dessus met en prod du code
  dont la migration SQL n'a pas encore été jouée (cf. §13 et `DEPLOY.md`).
- **Le SEUL merge légitime sur `main` est `develop` → `main`, au moment de sortir une
  version.** C'est un acte de release, décidé explicitement — jamais une étape de fin de
  tâche, jamais « pendant qu'on y est ».
- Ne jamais ouvrir, rebaser ou re-cibler une PR vers `main` de sa propre initiative. Si
  une PR se retrouve sur la mauvaise base : `gh pr edit <numéro> --base develop`.

Le job CI **« PR base guard »** (`.github/workflows/pr-base-guard.yml`) refuse toute PR
vers `main` dont la source n'est pas `develop`, `hotfix/*` ou `dependabot/*` — `hotfix/*`
pour un correctif urgent en prod qui ne peut pas attendre `develop`, `dependabot/*` parce
que Dependabot cible la branche par défaut. Ce garde-fou est un filet, pas la règle : la
règle est ci-dessus, et elle vaut même quand le garde-fou laisserait passer.

### Messages de commit et corps de PR — RÈGLE ABSOLUE : aucune signature d'outil

**Rien dans le dépôt ne mentionne Claude, Anthropic, ou un assistant d'IA quel qu'il soit.**
Ni message de commit, ni titre/corps de PR, ni commentaire de code, ni entrée de changelog.

Interdits, sans exception tacite :

- les *trailers* `Co-Authored-By: Claude …`, `Claude-Session: …`, `Generated-by: …`
- les mentions de fin de PR type « 🤖 Generated with Claude Code », liens de session inclus
- toute formule « écrit/assisté par … » dans le corps d'un commit ou d'une PR

**Seule exception : une demande explicite de Hamza sur ce commit ou cette PR précis.**
« On l'avait mis la dernière fois » n'en est pas une : la demande doit être formulée pour
le lot en cours.

Pourquoi : l'historique du dépôt est celui de l'équipe (cf. §1). Le crédit va aux humains
qui décident, et un dépôt public de fan-game n'a pas à se lire comme une sortie de machine.
Le message de commit doit expliquer **le pourquoi du changement**, pas par quel outil il a
été tapé.

⚠️ Ces signatures sont ajoutées **par défaut** par certains outils (Claude Code notamment) :
il faut donc les retirer activement à chaque commit et à chaque PR, pas seulement « ne pas
les écrire ». Vérifier avec `git log -1 --format=%B` avant de pousser.

### Nommage des fichiers — RÈGLE ABSOLUE
**Tous les nouveaux fichiers utilisent le `snake_case` avec underscores** (ex: `badge_manager.js`, `user_stats.php`).
Ne jamais utiliser camelCase ou kebab-case pour les noms de fichiers afin de garantir la stabilité de l'arborescence sur tous les OS.

### JavaScript
- Arrow functions, destructuring, template literals, `async/await`
- `camelCase` variables/fonctions · `PascalCase` classes
- Réutiliser `gameCore.js` avant de réécrire une utilité
- Bridge `window._personadleApi` pour éviter les imports circulaires (`gameCore` ↔ `api`)
- Ne pas empiler des `addEventListener` — vérifier si le listener existe déjà

### CSS
- `global.css` commun, un CSS par mode dans son dossier
- Dark mode via classe `.darkmode` sur `<body>` (jamais `<html>` sauf script inline)
- Préfixer les animations spécifiques (`p5ImpactFlash`, `tarotFlip`…)

### PHP
- PDO obligatoire — **jamais** de concaténation SQL
- `password_hash($pwd, PASSWORD_BCRYPT)` uniquement
- Codes HTTP corrects (200, 201, 400, 401, 403, 404, 409, 500)
- Tout nouveau `.php` dans `api/user/` ou `api/admin/` → ajouter sa `RewriteRule` dans `.htaccess`

### Données de jeu — personas multi-wielders (`personaeMode/database/personaeCharacters.js`)
*Règle posée le 2026-08-13 suite au lot P4AU 2.1 (Thanatos/Elizabeth) — évite de refaire le
raisonnement à chaque nouveau perso cross-jeu.*
- **Un nom de persona = une seule entrée**, même si plusieurs personnages l'utilisent dans des
  opus différents → fusionner dans le même `user` (array) et combiner les `opus`. Exemple :
  `Thanatos` → `user: ["Makoto Yuki", "Kotone Shiomi", "Elizabeth"]`, `opus` couvrant P3+P4AU
  (Elizabeth l'utilise dans P4AU, mais reste la même entrée que Makoto/Kotone en P3) — même
  principe déjà posé par `Orpheus Telos`, qui combine 3 wielders de sous-continuités différentes.
- **Scinder en plusieurs entrées SEULEMENT si le nom de persona est réutilisé par deux
  personnages réellement différents** (coïncidence de nommage, pas le même "titre"). **Critère
  concret à vérifier : le champ `image`.** Même `image` (même dessin) → cas 1, fusionner. Deux
  `image` différentes (deux dessins différents) → cas 2, scinder. Exemple : `Hermes` (Junpei
  Iori, P3, `image: "Hermes"`) et `Hermes` (Jun Kurosu, P2IS, `image: "Jun_Hermes"`) restent 2
  entrées séparées — deux dessins différents, deux opus différents, juste le même nom. Idem
  `Prometheus` (Futaba Sakura, P5R vs Baofu, P2EP — `image` différente aussi).
- **Pourquoi ça compte** : fusionner à tort 2 personnages différents dans un seul `user`
  accepterait une mauvaise réponse comme correcte. Scinder à tort la même persona/image en 2
  entrées peut au contraire refuser une bonne réponse selon quelle entrée a été tirée en
  interne — perçu comme un bug par le joueur, l'image affichée étant identique des deux côtés.
- Défis entre amis (`modePersonae.js`) : les noms légitimement dupliqués (2e cas ci-dessus)
  sont désambiguïsés automatiquement par `challengeKey()`/`findByChallengeKey()` — rien à faire
  de plus en ajoutant du contenu.

---

## 5. i18n

- `lang/en.json` = **source de vérité** — toujours ajouter la clé EN en premier
- Variables : `{{variable}}` — `t('key', { vars })` dans `js/i18n.js`
- Ne pas traduire : noms persos, personas, titres musiques, codes opus, termes lore
- `npm run i18n:check` — vérifie la cohérence entre tous les fichiers lang/
- **`admin/` est hors périmètre i18n** — outil interne, mono-langue (FR) par choix explicite,
  0 `data-i18n`. Ne pas le traduire "par réflexe" en ajoutant du contenu ailleurs dans le
  produit ; si ce choix change un jour, le documenter ici en même temps.

**Pattern fallback correct :**
```js
const r = window.i18n?.t?.(key);
return (r != null && r !== key) ? r : fallback;
// ⚠️ t(key) retourne la clé (truthy) si absente — ?? ne se déclenche jamais
```

---

## 6. Responsive

| Breakpoint | Cible |
|---|---|
| `max-width: 480px` | Mobile |
| `max-width: 768px` | Tablette |
| `max-width: 1024px` | Petit desktop |

Utiliser `min()`, `clamp()`, `vw`/`vh`. Éviter les largeurs fixes en `px` sur les conteneurs.

---

## 7. Pièges critiques

| Problème | Solution |
|---|---|
| `rank` mot réservé MySQL 8.0 | Toujours entourer de backticks |
| CORS + `credentials: 'include'` | Whitelist exacte + `Allow-Credentials: true` — jamais `*` |
| `t(key) ?? fallback` | Voir pattern section 5 |
| Import circulaire `gameCore` ↔ `api` | Bridge `window._personadleApi` |
| `savePendingSession` 409 | `continue` silencieux, pas `return` |
| `.htaccess` api/user/ ou api/admin/ | Chaque nouveau `.php` = nouvelle `RewriteRule` |
| PDO param nommé répété | MySQL PDO ne supporte pas `:param` deux fois — utiliser `?` positionnels |
| `window.onclick` écrase handlers | Toujours `window.addEventListener('click', fn)` |
| `LEAVE proc_name` non reconnu MariaDB | Labelliser `proc_body: BEGIN…END` → `LEAVE proc_body` |
| Procédure stockée import Hostinger | SSH + `mysql --delimiter='$$' < fichier.sql` — jamais phpMyAdmin |
| Streak cooldown Jack Frost | Cooldown 60j **enforced côté serveur** (`users.streak_recovered_at`) ; le gate client n'est qu'un confort UX |
| Récupération de streak | `performRecovery()` (`js/streak-recovery.js`) **attend** la réponse backend et ne consomme le crédit qu'en cas de succès — ne jamais repasser en fire-and-forget (sinon revert silencieux au prochain `pullProfileFromCloud`) |
| Validation `previous_streak` | Plafonnée au nb de jours **distincts** joués (`COUNT(DISTINCT played_date)`), pas au `streak_record` par mode (streak client = globale) |
| Streak client en UTC | **Toujours** `parisDateKey()` pour la frontière de journée dans `profileStats.js` — jamais `toISOString()` |
| DST Paris mal géré | `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' })` |
| `ALTER TABLE … ADD COLUMN IF NOT EXISTS` | Syntaxe MariaDB uniquement — MySQL 8.0 : `ADD COLUMN` sans condition |
| `isolation: isolate` clippe le burst avatar | Sortir `.tv-burst-wrap` du corps TV → enfant direct de `.tv-wrap`, z-index:20 |
| `POST`/`PATCH` sur une route dossier (`/api/friends`, `/messages`, `/notifications`…) sans `/` final | Apache (mod_dir) 301 vers l'URL avec slash → la méthode dégrade en GET (body perdu), `res.ok()` reste vrai mais rien n'est écrit. `js/api.js` met déjà le `/` final sur ces routes — faire pareil dans tout nouveau test E2E ou appel direct |
| `foo.php` + dossier `foo/` coexistants dans `api/` | `api/.htaccess` teste `.php -f` **avant** `-d` (sinon le dossier gagne toujours et le stub `.php` est inatteignable, même avec le slash final) |
| Une `animation` CSS écrase le style inline | Une animation en cours bat les déclarations normales, **inline compris**. Ne jamais animer une propriété que le JS pilote en inline (`transform`, `opacity`). Vécu en 2.1 : `popInSilhouette` révélait la silhouette avant le premier flash en Expert |
| `filter: brightness(0)` / `blur()` ne cachent rien | Un filtre CSS est un effet de peinture : « clic droit → Copier l'image » rend l'original. Pour masquer une réponse, cuire l'effet dans les pixels (`js/silhouette_mask.js`) — le filtre CSS ne reste qu'un filet |
| Assets périmés après un déploiement | Bumper `CACHE_VERSION` dans `sw.js` (sinon `activate` ne purge rien et le cache-first sert l'ancien). Invisible en test : seuls les joueurs **déjà venus** sont touchés |
| Condition de déblocage non monotone | Un accès **gagné ne doit jamais se reperdre**. Toute condition doit être cumulative (`COUNT` à vie) ou un `MAX` sur l'historique — jamais une valeur « en cours ». Vécu en 2.1 : `mode_consecutive_perfects` renvoyait la série courante, donc 3 Modes Expert se re-verrouillaient à la première partie ratée, et une partie Expert en cours était refusée en 403 |
| Une migration écrite ≠ une migration jouée | `sql/migrations/` n'est PAS le reflet de la prod — une migration vit sur `develop` jusqu'à la release. Seule source fiable : `SELECT version FROM schema_migrations`. Vécu en 2.1 : 029/030 oubliées de la checklist |
| Bouton rond/carré rendu ovale | `css/global.css` §18 impose `min-height: 48px; padding: 12px 20px` à **tout** `<button>` (cible tactile). Un bouton-icône avec `width`/`height` propres (pastille 28px, play 34px, ✕ de modale) sort en 28×48. Tout nouveau bouton-icône pose `min-height: 0` dans sa propre règle. Vécu en 2.2 : pastilles de bordure, lecteur de musique, ⚙ Settings, boutons amis |

---

## 8. Tests & qualité

- `npm test` · `npm run test:watch` · `npm run test:coverage`
- **1194 tests** (Vitest + jsdom), 67 suites dans `tests/` (`gameCore`, `backend`, `auth`, `i18n`,
  `social-link`, `profilePage`, `badgesManager`, `badgesConditions`, `streakFlow.integration`,
  `streakRecovery`, `validateCharacters`, `formatPlayTime`… — cf. `tests/` pour la liste à jour)
- `npm run lint` (ESLint flat config) · `npm run data:check` (schéma personnages) · `npm run i18n:check`
- E2E Playwright : `npm run test:e2e` (local, nécessite `make up`) — job CI dédié `e2e`,
  **bloquant** depuis le 24 juillet 2026 (stabilité confirmée, voir `tests-e2e/README.md`)
- Tout nouvel utilitaire `gameCore.js` → tests correspondants obligatoires
- Vocabulaire des modes : **toujours** passer par `normalizeModeKey()` / `modeLabel()` (gameCore.js)

### 🔢 Chiffres de doc — ne JAMAIS les mettre à jour à la main

Les nombres ci-dessus (tests, tables SQL, clés i18n) ainsi que leurs équivalents dans
`README.md`, `ROADMAP.md`, `CONTRIBUTING.md`, `tests/README.md` sont **auto-calculés et
auto-corrigés** par `scripts/check-doc-numbers.js` — c'est ce script qui a recalculé ces
valeurs, pas une estimation manuelle. Après avoir ajouté un test, une table SQL ou une
clé i18n :

- `npm run docs:fix` — recalcule et réécrit directement les chiffres partout où ils apparaissent
- `npm run docs:check` — vérifie sans écrire (utilisé en CI, échoue si un chiffre est faux)
- Le hook pre-commit lance `docs:fix` automatiquement et re-stage les fichiers modifiés

Si tu ajoutes un nouvel endroit où un de ces chiffres est cité en dur, ajoute aussi son
point de synchronisation dans `syncPoints` (`scripts/check-doc-numbers.js`) — sinon il
driftera en silence comme tous les autres avant l'audit de juillet 2026.

### 🎯 Pools de tirage quotidien — ne JAMAIS les éditer à la main

`api/data/daily_pools.json` (lu par `api/lib/daily_target.php` pour l'anti-triche serveur,
§3) est **généré**, pas écrit à la main — `scripts/export-daily-pools.js` l'exporte depuis
les datasets JS (source de vérité). Après avoir ajouté un personnage, une chanson ou modifié
un pool de tirage :

- `npm run pools:build` — régénère `api/data/daily_pools.json`
- `npm run pools:check` — vérifie sans écrire (utilisé en CI, échoue si désynchronisé)
- Le hook pre-commit régénère et re-stage automatiquement si nécessaire

---

## 9. Documentation des mises à jour

> **Règle absolue** : tout ajout/correction notable → deux fichiers distincts, pas un seul
> (corrigé le 2026-07-06 — la version précédente de cette section pointait vers un
> `PersonaDLE_Update.md` qui n'existe pas pour la v2.0, seulement pour l'archive v1.1) :
>
> **Un dossier par version.** Version en cours de développement : **v2.2**
> (`PersonaDLE 2.2/`, ouvert le 2026-09-09). Écrire dans le dossier de la version **en
> cours de développement**, jamais dans celui d'une version déjà livrée — `PersonaDLE 2.0/`
> et `PersonaDLE 2.1/` ne reçoivent plus que des correctifs de leur propre version en prod :
>
> - `PersonaDLE_Update_Documentation/PersonaDLE 2.2/DEV_CHANGELOG.md` — changelog **dev**
>   (contributeurs/mainteneurs), détail précis par commit : fichiers touchés, décisions
>   d'architecture, angles morts connus. Toute modification qui touche au code en a besoin.
> - `PersonaDLE_Update_Documentation/PersonaDLE 2.2/PersonaDLE_Update.html` — changelog
>   **joueur** (page HTML bilingue EN/FR, blocs `data-i18n-block`), highlights uniquement,
>   langage non technique. À alimenter **seulement** si le changement est visible/parlant
>   pour un joueur (nouvelle feature, fix d'un bug qu'il pouvait remarquer) — jamais l'inverse
>   (ne pas alléger DEV_CHANGELOG.md pour "faire propre"). La page est liée depuis le modal
>   « Nouveautés » de `index.html`, entrée `version-item` par version — **entrée 2.2 à
>   ajouter à la sortie de la version**, pas avant.
>
> À l'ouverture d'une v2.3 : créer `PersonaDLE 2.3/`, y démarrer les deux fichiers, ajouter
> son bloc de 3 lignes dans `.gitignore` (sinon les fichiers sont ignorés en silence — voir
> le piège documenté dans `.gitignore`), et mettre à jour cette section. C'est ce point de
> synchronisation qui a manqué à la 2.1, dont les entrées se sont accumulées dans le dossier
> de la 2.0 jusqu'au 2026-08-20.

Format d'une entrée `DEV_CHANGELOG.md` :

```markdown
## AAAA-MM-JJ — Titre court
Description concise du lot (pourquoi, pas juste quoi).
### Détails techniques (si pertinent)
```

Notes rapides → `note_ajout.md` (même dossier).

---

## 10. Commandes utiles

```bash
npm test                  # Tests
npm run test:watch        # Mode watch
npm run i18n:check        # Vérifier clés i18n manquantes
bash setup.sh             # Install backend local (première fois)
ssh hostinger-personadle  # Accès SSH Hostinger
mysql -u u870779941_Hamza -p u870779941_personadle  # MariaDB prod
```

---

## 11. Comportement — Rôle de Mentor

Claude Code agit en **mentor technique** : critiquer les choix problématiques avant de coder, proposer une alternative si clairement meilleure, expliquer les décisions non évidentes. Ce rôle ne signifie pas remettre en cause chaque détail ou bloquer si l'utilisateur confirme sa décision.

---

## 12. Graphify

Knowledge graph dans `graphify-out/`.
- Questions d'architecture → lire `graphify-out/GRAPH_REPORT.md` en premier
- Après modification de fichiers : `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`

---

## 13. Definition of Done — vérification par type de changement

> Ajouté après review PR #19/#20 (juillet 2026) : le changelog décrivait correctement
> les fixes attendus, le script SQL committé ne les appliquait pas. Donner le contexte
> "correct" ne suffit pas — il faut comparer l'artefact réel à ce qui est annoncé, pas
> juste le décrire.

**Migrations SQL**
- Exécuter réellement le script contre une base **vierge** (pré-migration) — pas une
  base déjà migrée (`IF NOT EXISTS` y rend tout no-op, ne prouve rien)
- Backup rappelé juste avant tout `DROP`/`DELETE`/`TRUNCATE`/rétrécissement de colonne
- Chaque fix annoncé dans le changelog repéré ligne par ligne dans le script committé
- Types FK vérifiés cohérents avec la table référencée avant `ADD CONSTRAINT`

**Config partagée (ports, env, CI)**
- Toute valeur par défaut modifiée vérifiée contre `docker-compose.yml`/`.env.example`,
  pas en isolation dans le fichier qu'on modifie
- Variable d'env fixée en dur en CI qui pourrait masquer une régression du défaut
  local → vérifier explicitement, ou noter l'angle mort dans la PR

**Sécurité / PHP**
- PDO + requêtes préparées vérifié ligne par ligne sur le diff — pas un `grep SELECT`
- Condition de déblocage (badge/titre/wallpaper) revérifiée côté serveur, jamais
  côté client seul

**État dérivé (localStorage, cloud sync)**
- Champ dérivé d'une autre source de vérité (ex: `avatarSrc` dérivé de `avatar`) →
  tracer tous les chemins d'écriture de la source et vérifier l'invalidation. Périmé
  silencieusement = bug, même si ça marchait au premier test.

**Avant merge**
- Affirmations du corps de PR spot-vérifiées contre le diff réel, pas prises pour
  acquises
- CI verte insuffisante si elle ne peut pas exécuter le scénario concerné (replay
  migration sur base vierge, config testée sans override d'env) → le signaler
