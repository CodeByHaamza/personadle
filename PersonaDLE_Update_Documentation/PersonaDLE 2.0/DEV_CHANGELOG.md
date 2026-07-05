# Changelog technique — PersonaDLE v2.0

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE_Update.html` reste le changelog **joueur** — highlights
> uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur
> si elle est réellement visible/parlante côté joueur.

---

## 2026-07-04 — Sécurité, tests réels, CI E2E (revue de projet)

Suite à une revue complète du projet sur `develop` : correctifs de sécurité,
correction de tests qui vérifiaient une copie du code plutôt que le code
réel, et branchement des tests E2E en CI. Pas de nouvelle feature joueur.

### Sécurité

- **CSRF (synchronizer token / double-submit cookie)** — documenté dans
  CLAUDE.md §5.1 mais jamais implémenté (SameSite=Lax seul). Ajouté :
  - `api/lib/authz.php` : `personadle_csrf_required(method)` et
    `personadle_csrf_valid(sessionToken, headerToken)` — logique pure, testée
    (`tests/php/AuthzTest.php`, 7 nouveaux tests).
  - `api/bootstrap.php` : émet un cookie `csrf_token` lisible par JS (pas
    HttpOnly — c'est le principe du double-submit) dès l'ouverture de session,
    et `requireCsrf()` (appelée depuis `requireAuth()`) vérifie le header
    `X-CSRF-Token` pour toute méthode mutante (POST/PATCH/DELETE/PUT).
  - **Portée volontairement limitée aux endpoints authentifiés** (via
    `requireAuth()`) : login/register/reset-password/logout restent protégés
    par SameSite=Lax uniquement. Justification : le token CSRF de session
    n'existe de façon fiable côté client qu'après un premier GET (ex.
    `initAuth()` → `GET /auth/me` au chargement de page) — l'imposer sur
    l'endpoint de login lui-même casserait le cas d'un POST de login comme
    toute première requête réseau de la page. Cette portée couvre l'essentiel
    du risque réel (actions authentifiées : profil, amis, RGPD…), conforme à
    la recommandation OWASP de prioriser les actions à état plutôt que
    l'authentification elle-même.
  - `js/api.js` : nouvel export `getCsrfToken()` (lit le cookie), header
    `X-CSRF-Token` ajouté automatiquement dans `apiCall()`.
  - `admin/admin.js` (fetch wrapper indépendant de `js/api.js`) et
    `js/streak-recovery.js` (fetch direct vers `/api/user/recover-streak`,
    authentifié) mis à jour individuellement — ce sont les 2 seuls appels
    mutants authentifiés en dehors de `js/api.js`.
  - CORS : `Access-Control-Allow-Headers` étendu avec `X-CSRF-Token`
    (sinon le preflight OPTIONS rejette la requête réelle).

- **Secret cron en header plutôt qu'en query string** — `api/cron/{leaderboard,
  hard-delete,purge-rate-limits}.php` lisaient `$_GET['key']`, qui finit en
  clair dans les logs d'accès HTTP (serveur/proxy). Remplacé par
  `requireCronSecret()` (nouvelle fonction dans `bootstrap.php`, factorise les
  3 copies identiques) qui lit le header `X-Cron-Key`. Mis à jour :
  `docs/hostinger-cron-setup.md` (réécrit, documente les 3 crons — il ne
  documentait auparavant que `leaderboard.php`) et `DEPLOY.md` (exemples
  `wget --header=`/`curl -H`).

### Tests — corriger les tests qui vérifient une copie du code

Trois suites Vitest réimplémentaient la logique testée au lieu d'importer la
vraie fonction, avec un commentaire "cannot be imported directly" — ce qui
veut dire qu'une régression dans le vrai code peut passer inaperçue tant que
la copie du test reste correcte.

- **`js/filterMenu.js`** : `_migrate()` (migration des filtres opus legacy)
  n'était pas exportée. Ajout d'un export réservé aux tests :
  `export { _migrate as migrateLegacyOpusFilters }`. `tests/gameCore.test.js`
  importe maintenant la vraie fonction au lieu d'une copie de
  `LEGACY_EXPAND`/`_migrate` maintenue à la main dans le fichier de test.

- **`js/api.js`** : `api.stats.syncPending()` est exporté (propriété de l'objet
  `api`) mais appelle `fetch()` réel — le test le contournait avec un helper
  `syncPendingLoop()` recopiant la boucle documentée. Remplacé par un appel
  direct à `api.stats.syncPending()` avec `vi.stubGlobal("fetch", …)` pour
  contrôler les réponses (409 / erreur réseau). Effet de bord découvert :
  `js/api.js` fait `window._personadleApi = api` à l'import — comme
  `tests/gameCore.test.js` importe désormais `{ api }`, ce side-effect
  s'applique à **tout le fichier de test**, pas seulement aux nouveaux tests.
  Ça cassait silencieusement les tests `savePendingSession` existants (qui
  supposaient `window._personadleApi === undefined` par défaut) : leur
  `beforeEach` réinitialise maintenant explicitement `window._personadleApi
  = undefined`.

- **`js/auth.js`** : `updateAuthUI()` n'était pas exportée ("dépendances DOM
  complexes" selon le commentaire du test — en réalité aucune, jsdom suffit).
  Exportée telle quelle, `tests/backend.test.js` importe la vraie fonction.
  **Ceci a révélé un vrai trou de couverture** : la copie du test ne
  reproduisait pas la synchronisation `localStorage.playerUserId` que fait la
  vraie `updateAuthUI()` (utilisée par `getPlayerSeedId()` dans
  `gameCore.js` pour la cible quotidienne). Un nouveau test couvre ce
  comportement (`tests/backend.test.js`).

Résultat : 449 tests Vitest passent (448 → +1 net ; 3 tests réécrits sans
changer le total, 1 nouveau test ajouté sur le gap `playerUserId` découvert).

### CI / E2E

- **Job `e2e` ajouté à `.github/workflows/ci.yml`** : démarre la stack Docker
  complète (`docker compose up -d --build`), attend que `/api/auth/me`
  réponde, lance `npx playwright test` contre `http://localhost:8080`, dump
  les logs Docker en cas d'échec. Marqué `continue-on-error: true` — premier
  branchement, à retirer une fois la stabilité confirmée sur plusieurs runs.
- **Bug de config découvert en préparant ce job** : `playwright.config.js` et
  2 specs (`api.spec.js`, `social-link.spec.js`) avaient `8090` comme port par
  défaut, alors que `docker-compose.yml`/`.env.example` exposent le site sur
  `8080` par défaut. `TEST_PLAN.md` documentait déjà ce mismatch comme un
  contournement connu (`PLAYWRIGHT_BASE_URL=http://localhost:8080` à passer
  systématiquement) plutôt que de corriger le défaut. Le défaut est maintenant
  `8080` dans les 3 fichiers — la variable d'env reste disponible pour
  surcharger si `.env` change `APP_PORT`.

### Documentation interne

- `js/gameCore.js` : docblock d'en-tête resynchronisé avec les 20 exports
  réels du fichier (`MODES`, `normalizeModeKey`, `modeLabel`,
  `FILTER_STORAGE_KEYS`, `showChallengeButton` manquaient).
- `CLAUDE.md` §8 : "242 tests, 8 suites" → "448 tests, 24 suites" (comptage
  réel via `npm test`), et note sur le job `e2e` en CI.
- `js/i18n.js` : docblock dupliqué de `initLang()` supprimé (gardé la version
  avec le bon type de retour `Promise<string>`).
- `README.md` : date "Last updated" (mai → juillet 2026).
- `ROADMAP.md` : ajout de 2 points identifiés pendant la revue —
  anti-triche absent sur `api/sessions.php` (`daily_targets` jamais lu côté
  serveur, un joueur connecté peut POST un résultat arbitraire) et
  duplication de `initializeAutocomplete()`/dark-mode inline dans les 6
  fichiers de mode (`js/autocomplete.js`/`js/gameCore.js` existent déjà pour
  ça). Le point sur le bloat `.git` était déjà tracké (ROADMAP.md +
  AMELIORATIONS.md), pas dupliqué.

---

## 2026-07-04 — `347561d` feat(admin): panel admin — audit trail, RGPD, rate limits + a11y modales

- **Focus trap générique** : `js/modal.js` (nouveau) extrait `openModal()`/
  `closeModal()` de `js/auth.js`, généralisé à un `Map<id, state>` (plusieurs
  modales indépendantes sans écraser l'état les unes des autres — corrige un
  bug latent de l'implémentation d'origine à slot global unique). Option
  `onClose` pour synchroniser un état additionnel (overlay de `titlesModal`).
  Migré : `avatarCropModal`/`sharePreviewModal`/`songModal`/`titlesModal`.
  `tests/modal.test.js` (13 tests) : ARIA, focus initial/restauré, trap
  Tab/Shift+Tab, indépendance entre modales.
- **Audit trail admin** : table `admin_audit_log` (migration 020) +
  `personadle_log_admin_action()` (`api/lib/admin_audit.php`) câblé sur
  toutes les mutations admin (ban/unban, grant/revoke admin, badges/titres/
  wallpapers, event codes, social links, hard delete). Panel "📋 Audit".
- **RGPD — visibilité + déclenchement manuel** : logique de
  `api/cron/hard-delete.php` extraite vers `api/lib/deletion_requests.php`
  (réutilisée par le cron ET le nouveau panel admin "🗑️ RGPD").
- **Rate limits — visibilité + purge manuelle** : `api/admin/rate_limits.php`
  (nouveau), panel "⏱️ Rate Limits".
- **Observabilité** : table `error_log` (migration 019) +
  `personadle_log_error()` (`api/lib/error_log.php`), panel "🪵 Logs". Câblé
  uniquement sur les 3 endpoints critiques traités dans ce lot (sessions,
  recover-streak, social-links interact) — le reste des `error_log()`
  existants dans le codebase n'a volontairement pas été balayé.
- **Suivi PR #6** : `api/lib/game_session.php` (docblock `@return` corrigé,
  bloquait PHPStan) ; `js/modal.js` (listener `keydown` fantôme si une modale
  est rouverte sans `closeModal()` entre les deux — fix + test de régression) ;
  angle mort d'audit comblé sur `user_stats.php` (écrasement de stats) et
  `user_friends.php` (suppression forcée d'amitié).
- Non exécuté en sandbox faute de Docker/MariaDB (`tests/php/
  DatabaseIntegrationTest.php` étendu de 459 lignes) — à confirmer via
  `make up && make test-php` ou la CI.

## 2026-07-04 — `9b8bb6f` fix(i18n): 404/reset-password/login-register traduits + check valeur == EN

- **`scripts/check-i18n-untranslated.js`** (`npm run i18n:check-untranslated`) :
  compare chaque valeur FR/ES/DE/IT à son équivalent EN pour repérer les
  traductions probablement jamais faites (copié-collé). Purement informatif
  (exit 0 systématique), averti en pre-commit uniquement si des `lang/*.json`
  sont stagés. Premier passage : 0 vraie traduction manquante sur ~327
  correspondances (toutes attendues par design — noms propres, opus, mots
  empruntés — voir CLAUDE.md §5).
- **`404.html` + `reset-password.html`** : intégralement traduits (étaient
  100% en dur en anglais). Nouvelle section `reset_password` (12 clés ×
  5 langues). `js/lang-selector.js` (nouveau, testé) extrait le widget de
  sélecteur de langue dupliqué inline sur `privacy.html`/`faq.html`/
  `profile.html`/etc. — utilisé sur les 2 nouvelles pages sans toucher aux
  pages existantes.
- **`js/auth.js`** : erreurs de login/register traduites (les clés
  `auth.error_*` existaient dans `lang/*.json` mais n'étaient jamais
  utilisées — le message brut du backend, toujours en anglais, s'affichait).
- Restent hors scope (notés dans le commit) : `admin/index.html` (aucun
  i18n, outil interne) et l'audit visuel des ~327 correspondances EN
  "attendues" n'a pas été repassé caractère par caractère.

## 2026-07-04 — `69501ce` chore(profile): supprime profile.js (code mort)

`profile/profile.js` n'était plus importé nulle part depuis la décomposition
de `profile-page.js` (voir commit suivant) — supprimé plutôt que gardé
"au cas où".

## 2026-07-04 — `4d6634e` Tests, sécurité/data et décomposition de profile-page.js

- **+66 tests Vitest, +4 suites PHPUnit** sur les zones sans couverture
  identifiées lors d'un audit de tests : `js/social-link.js`,
  `api/auth`+`api/admin` (logique pure), `classiqueMode/modeClassique.js`
  (grille de comparaison), `profile/badges/badgesManager.js`.
- **Extractions pour rendre la logique testable sans MySQL** :
  `api/lib/social_link.php` (XP/rang, pattern `api/lib/streak.php`),
  `api/lib/validation.php` + `api/lib/authz.php` + `api/lib/format.php`
  (depuis `register.php`/`reset-password.php`/`bootstrap.php`).
  `classiqueMode/modeClassique.js` : `compareAttribute()` extrait de
  `checkGuess()`. `profile/badges/badgesManager.js` :
  `toggleBadgeSelection`/`handleEventCodeSubmit` exportées.
- **Décomposition de `profile-page.js`** (devenu trop volumineux) : extrait
  `profile/share-card.js`, `profile/song-player.js`, `profile/titles-ui.js`,
  `profile/wallpapers-ui.js`, `profile/theme.js`. `profile/profile.js`
  (ancien monolithe pré-décomposition) devient mort — supprimé au commit
  suivant (`69501ce`).
- Tests PHP écrits et vérifiés par `php -l` mais non exécutés dans cette
  session (téléchargement de `phpunit.phar` bloqué par la policy réseau du
  sandbox) — à valider via `make test-php` ou la CI.

---

## 2026-07-05 — fix(classique): Give Up n'est plus compté comme une victoire

**Bug trouvé en écrivant un test E2E de partie complète** (pas un audit
ciblé) : en mode Classique, cliquer "Give Up" appelait
`checkGuess(target.nom, target, true)` pour révéler la réponse. Le bloc
`if (isWin)` de `checkGuess()` traite `isWin = correspondance || forceReveal`
comme une seule condition — sans distinguer une vraie victoire d'un
`forceReveal` — et loggait donc systématiquement `result: "win"` +
positionnait `statsAlreadyLogged = true` **avant** que le handler du bouton
Give Up n'ait la main pour logger son propre `result: "giveup"` (silencieusement
ignoré ensuite, puisque le flag était déjà à `true`). Conséquence réelle :
stats et badges (`hasWonFirstTry` notamment) faussés pour tout abandon de
partie en Classique.

Vérifié que les 5 autres modes n'ont **pas** ce bug : Emoji fait
`result = forceReveal ? "giveup" : "win"` directement ; Silhouette/AllOutAttack
(et par le même schéma, Personae/Music) séparent l'affichage de révélation du
log de session, avec le win-log explicitement gardé par `!force`.

**Fix** (`classiqueMode/modeClassique.js`, `checkGuess()`) : ajout de
`!forceReveal` à la garde du bloc qui logge la victoire + les flags de badges
(`if (wasFresh && !statsAlreadyLogged && !forceReveal)`), et au bloc de
confettis/`showChallengeButton`/`checkChallengeCompletion(…, true)` (qui
s'exécutaient aussi à tort sur un Give Up, en double avec les appels
équivalents — mais avec les bons arguments — du handler Give Up
lui-même). Comportement du vrai chemin victoire strictement inchangé
(`forceReveal` vaut toujours `false` sur un clic normal du bouton deviner).

Non vérifié en navigateur (Docker indisponible dans le sandbox où ce fix a
été fait) — logique relue attentivement + comparée aux 5 autres modes,
473/473 tests Vitest inchangés, `php -l`/`node --check` propres. À confirmer
manuellement (jouer une partie Classique, cliquer Give Up, vérifier
`user_stats`/`game_sessions` en base) avant release si possible.

---

## 2026-07-05 — fix(silhouette, aoa): triche possible en glissant l'image hors de sa zone

**Signalé par l'utilisateur** : en mode Silhouette, on pouvait cliquer-glisser l'image
silhouette hors de `.silhouette-box` (qui a `overflow: hidden`) pour révéler le personnage
à deviner. Cause : les `<img>` sont nativement `draggable` dans les navigateurs, et l'aperçu
de drag natif (la miniature qui suit le curseur) est généré à partir des pixels réels de
l'image — il n'applique pas le filtre CSS (`filter: brightness(0)`) qui crée l'effet
silhouette, et flotte au-dessus de la page sans être contraint par `overflow: hidden`.

Vérifié que le mode **All-Out Attack** a exactement la même vulnérabilité (`#aoaGif` utilise
aussi un filtre de flou progressif, cf. `allOutAttackMode/allOutAttack.css`) — corrigé aux
deux endroits. Les 4 autres modes n'affichent jamais d'image volontairement floutée/masquée
par CSS, donc pas concernés.

**Fix, 3 couches (redondantes exprès, robustesse cross-browser)** :
1. `draggable="false"` sur `<img id="silhouetteImage">` et `<img id="aoaGif">` — désactive le
   drag natif dans la quasi-totalité des navigateurs modernes (vérifié : `img.draggable === false`
   côté DOM après rendu, testé via Playwright/Chromium headless).
2. CSS `-webkit-user-drag: none; user-select: none;` sur les deux mêmes éléments.
3. `addEventListener("dragstart", e => e.preventDefault())` en JS (`modeSilhouette.js`,
   `modeAllOutAttack.js`) — filet de sécurité si les deux couches précédentes ne suffisent pas
   sur un navigateur particulier.

473/473 tests Vitest inchangés, `node --check`/ESLint propres. Vérifié via Playwright headless
(sans backend, juste le rendu statique) que `draggable` vaut bien `false` au niveau DOM sur les
deux images — pas de test E2E de bout en bout du drag lui-même (comportement natif du
navigateur, pas simulable de façon fiable en E2E).

---

## 2026-07-05 — fix: retours de review PR (victoryBox Classique + rate-limit E2E)

**Signalé par la review GitHub de la PR** (run E2E réel, pas une supposition) :

1. **`#victoryBox` invisible en mode Classique** (`game-flow.spec.js`, test Give Up) :
   `classiqueMode/classiqueMode.html` déclarait `<div id="victoryBox" style="display: none"></div>`
   **sans** `class="victory-box"`, contrairement aux 5 autres modes qui ont tous
   `class="victory-box"` (cf. `.victory-box` dans `css/global.css` : `padding: 20px 25px;
   border: 3px solid …` — c'est cette classe qui donne au conteneur sa taille/son style, pas
   l'id). Sans elle, la boîte est un `<div>` vide sans padding/bordure : hauteur 0, donc
   invisible pour Playwright (`toBeVisible()` exige un bounding box non nul) **que ce soit sur
   un vrai win ou un Give Up** — pas une régression du fix Give Up=Win de la veille, un bug
   structurel préexistant dans le HTML de ce mode, simplement révélé par le nouveau test E2E.
   **Fix** : ajout de `class="victory-box"` sur la div (`classiqueMode/classiqueMode.html`).

2. **`social-link.spec.js` en échec par épuisement du rate-limit d'inscription** :
   `POST /api/auth/register` est limité à 5 inscriptions / 15 min par IP
   (`api/auth/register.php`). Avec `admin.spec.js` (1 inscription) + `api.spec.js` (2, dont le
   nouveau bloc recover-streak) + `social-link.spec.js` (2, comptes A et B), le total tombe
   pile sur la limite — et `retries: 2` en CI + `test.describe.serial` (qui rejoue tout le
   bloc, donc son `beforeAll`, si un test du groupe échoue) peut ré-inscrire les mêmes comptes
   et dépasser le quota, avec un ordre non déterministe sous `fullyParallel: true`. Confirmé
   par la review : problème de marge de la suite de tests elle-même, pas une régression du
   code produit. **Fix** : le plafond reste `5` en production (`APP_ENV === 'production'`,
   sécurité inchangée) mais passe à `50` dans les autres environnements
   (`APP_ENV=local` en Docker/E2E, cf. `api/config.docker.php`) — assez de marge pour
   absorber des retries CI sans affaiblir la protection anti-abus en prod.

Ajout en bonus (suggestion de la review, pas un correctif) : upload de `test-results/` et
`playwright-report/` en artefact CI sur échec du job `e2e` (`.github/workflows/ci.yml`), pour
diagnostiquer plus vite la prochaine fois sans avoir à reproduire en local.

473/473 tests Vitest inchangés, `php -l` propre sur `register.php`. Non revérifié par un run
E2E réel dans ce sandbox (Docker indisponible) — les deux causes ont été confirmées par
lecture de code croisée avec le comportement documenté de Playwright/MariaDB plutôt que par
observation directe.

---

## 2026-07-05 — fix(e2e): POST /api/friends sans slash final perd son body (issue #10)

**Cause racine trouvée** après ouverture de l'issue #10 (bug latent noté hors scope de
la PR #9) : `tests-e2e/social-link.spec.js` appelait `a.ctx.post("/api/friends", …)`
**sans slash final**. `api/friends/.htaccess` ne route la racine du dossier
(`RewriteRule ^$ index.php`) que pour l'URL se terminant par `/` — sur `/api/friends`
sans slash, Apache (mod_dir, `DirectorySlash` par défaut ON) répond d'abord par un
`301` vers `/api/friends/` **avant** que la règle de réécriture du dossier ne s'applique.
Un client qui suit les redirections (Playwright `APIRequestContext` comme `fetch`)
convertit alors le `POST` en `GET` sur l'URL redirigée, perdant le body — la requête
retombe sur le handler `GET /api/friends` qui répond `200 { friends, pending_requests }`
au lieu de créer la demande. D'où le symptôme : `res.ok()` reste vrai (200 est un succès),
mais `body.status` ne vaut jamais `"pending"` puisque aucune demande n'a été créée.

Preuve que ce n'est pas un bug produit : `js/api.js:346` fait déjà
`post("/friends/", …)` **avec** le slash final (de même que `/messages/` pour la même
raison) — un choix déjà fait côté front, juste pas repris dans le test E2E qui n'avait
jamais pu être exécuté jusqu'au bout avant le fix du rate-limit d'inscription (voir
entrée du jour précédente).

**Fix** : ajout du slash final sur l'appel du test (`tests-e2e/social-link.spec.js`),
aligné sur la convention déjà en place dans `js/api.js`. Aucun changement côté
`api/friends/index.php` — le code serveur était correct. Piège documenté dans
`CLAUDE.md` § 7 pour éviter la récidive sur un futur test ou appel direct à ces routes.

Issue #10 fermée par ce commit. Non revérifié par un run E2E réel (Docker indisponible
dans ce sandbox) — cause confirmée par lecture croisée du comportement documenté
d'Apache `mod_dir`/`DirectorySlash` et de la gestion des redirections `fetch`/Playwright
sur les méthodes non-GET, plus la présence du même contournement déjà en place côté
front (`js/api.js`).

---

## 2026-07-05 — ⚠️ fix(api): PATCH /notifications dégradé en GET + nettoyage stubs .php/dossier

**Suite de l'investigation issue #10** : la review a précisé la cause exacte du bug
`/api/friends` — `api/.htaccess` teste `-d` (dossier) **avant** `.php -f`, donc une
requête sur une route-dossier sans slash final matche toujours le passe-plat "dossier
existant" avant de pouvoir atteindre un éventuel stub `.php` du même nom. Elle a aussi
révélé que **`api/friends.php` est un stub déjà présent dans le repo** (compat pour
d'anciennes versions d'`api.js` mises en cache par le service worker), mais rendu
inatteignable par cet ordre.

**En vérifiant ce point, découverte d'un vrai bug produit, distinct** : `api/notifications.php`
existe en doublon de `api/notifications/index.php`, avec une implémentation du `PATCH`
divergente et obsolète (no-op, ne renseigne jamais `seen_at` — contrairement à la
vraie version dans `notifications/index.php`). Or `js/api.js:377`
(`markSeen: () => apiCall("/notifications", …)`) appelle cette route **sans slash
final** — donc en production, ce `PATCH` subit la même dégradation silencieuse en `GET`
que `/api/friends` : le badge rouge "demandes d'ami" de la bottom nav ne se marque
vraisemblablement **jamais** comme vu.

**Fix (3 changements, comportement produit réellement modifié — d'où le `⚠️`)** :
1. `js/api.js` — slash final ajouté sur `markSeen()` (`/notifications/`), même
   convention que `/friends/` et `/messages/`. C'est le fix qui règle réellement le bug
   du badge.
2. `api/notifications.php` **supprimé** — stub mort (de toute façon inatteignable côté
   serveur, `-d` gagnant toujours), et surtout divergent/incorrect par rapport à
   `notifications/index.php`, qui reste la seule implémentation.
3. `api/.htaccess` — réordonné : test `.php -f` avant `-f OR -d`, pour que
   `api/friends.php` (stub légitime, conservé) redevienne atteignable comme prévu par
   son propre commentaire, sans changer le routage d'aucune autre route (vérifié :
   seules `friends.php`/`friends/` et l'ex-`notifications.php`/`notifications/`
   avaient une collision fichier/dossier dans `api/`).

Non revérifié par un run E2E réel (Docker indisponible dans ce sandbox) — le
raisonnement s'appuie sur une relecture attentive de `api/.htaccess` et de chaque
route concernée, plus la confirmation apportée par la review sur le run CI réel qui a
révélé le problème initial.

---

## Comment utiliser ce fichier

- Un commit qui touche au code (pas juste de la doc/config triviale) →
  une entrée ici, avec les fichiers clés et le **pourquoi** des décisions non
  évidentes (pas juste la liste des fichiers modifiés, déjà visible dans le
  diff).
- Si le changement est aussi visible/parlant pour un joueur (nouvelle
  feature, fix d'un bug qu'il pouvait remarquer), ajouter une entrée courte,
  non technique, dans `PersonaDLE_Update.html` — jamais l'inverse (ne pas
  alléger ce fichier-ci pour "faire propre").
