# PersonaDLE v2.0 — Plan de Test Dev (Hamza)

> ⚠️ Ce document couvre `4d6634e` → PR #13 (6 juillet) : pour tout ce qui vient après
> (PR #25→#30, 17 juillet et suivant), voir `TEST_PLAN.md` §22-§23 — pas dupliqué ici.

> **Ce document est pour toi**, contrairement à [`TEST_PLAN.md`](./TEST_PLAN.md) (même dossier)
> qui reste tel quel pour Léo et Damien (QA, sans accès code). Ici tu as accès au terminal et au
> code : tu peux corriger directement au lieu de juste rapporter, et lancer des commandes que
> Léo/Damien n'ont pas à connaître (PHPStan, requêtes SQL directes, etc.).
>
> **Pourquoi ce document existe** : plusieurs sessions Claude Code récentes — **depuis ton commit
> `4d6634e` inclus** (fin de PR #4, PR #5, #6, #7, #8, #9, #11, #12, et la PR #13 en cours de
> review) — ont tourné dans un sandbox **sans Docker, sans navigateur réel, et avec un accès
> réseau restreint** (téléchargement de `phpunit.phar`/`phpstan.phar` bloqué). Tout a été vérifié
> du mieux possible par lecture de code, tests unitaires, et — quand c'était possible — par les
> runs CI réels sur GitHub Actions (qui, eux, ont Docker). Une partie a aussi été **re-vérifiée
> fraîchement** en préparant ce document (voir §0.3) : suite JS complète, lint, i18n, data,
> `php -l` sur tout le repo — sur un clone tout frais de `develop`, pas juste relu dans le CI
> passé. Mais un certain nombre de choses n'ont **jamais tourné dans un vrai navigateur avec toi
> aux commandes**, ni contre une vraie base MariaDB. La section 2 ci-dessous liste tout ça en
> priorité.
>
> **Mis à jour le 2026-07-06 (3ᵉ passe)** pour couvrir la PR #13 (mergée depuis) et le nouveau
> lot en cours (`claude/roadmap-followups-*`, pas encore en PR à l'heure où j'écris ceci :
> conditions badges/wallpapers structurées) — voir §0.1bis et la nouvelle §2.16.

---

## 0 — Contexte

### 0.1 Ce qui s'est passé depuis ton commit `4d6634e`

32 commits, regroupés en 4 lots (PR #5/#6/#7/#8/#9/#11 + la fin de PR #4) :

| Lot | Commits | Contenu |
|---|---|---|
| **Fin PR #4** | `69501ce` | Suppression de `profile/profile.js` (1220 lignes de code mort, aucun point d'entrée) + bump cache SW v73→v74 |
| **PR #5** | `9b8bb6f` | i18n : script de détection "valeur == anglais" (`i18n:check-untranslated`), traduction de `404.html`/`reset-password.html`, `js/lang-selector.js` (widget partagé), traduction des erreurs login/register (`resolveLoginError`/`resolveRegisterError`) |
| **PR #6** | `347561d` | `js/modal.js` généralisé (focus trap + Escape) à `avatarCropModal`/`sharePreviewModal`/`songModal`/`titlesModal` ; extraction PHP pure (`game_session.php`/`streak_recovery.php`/`social_link_interaction.php`) + tests d'intégration ; **panel admin** : nouveaux onglets Logs (`error_log`), Audit trail (`admin_audit_log`), RGPD, Rate Limits |
| **PR #7** | `bd6a195`…`7532751` | CSRF (double-submit cookie), secret cron en header, 3 suites de tests corrigées (elles réimplémentaient la logique au lieu d'importer le vrai code) |
| **PR #8** | `5cc6076`…`009c284` | Fix fixation de session (`session_regenerate_id()` sur reprise via `remember_me`), factorisation dark-mode/give-up entre modes, factorisation `requestPathSegments()`, a11y modales (focus trap) |
| **PR #9** | `c1881de`…`7523576` | Gros lot : factorisation admin, CORS restreint en prod, rate-limit messages, policy mots de passe communs, CSP sur les pages HTML, réorg `privacy/faq/404/reset-password` → `pages/`, **fix bug Give Up compté comme victoire en Classique**, anti-triche glisser-déposer (silhouette/AOA) |
| **PR #11** | `8f6cdd9`…`d825570` | Fix routage Apache : `POST /api/friends` et `PATCH /api/notifications` se dégradaient silencieusement en `GET` (perte du body) à cause d'une redirection `mod_dir` sur les routes-dossier sans slash final |

Chiffres à l'époque (post-merge PR #11) : **473 tests Vitest** (24 suites) · **125 méthodes PHPUnit** (8 fichiers) · **949 clés i18n** × 5 langues · **23 tables SQL**. Pour les E2E : `docs:check` affichait **25** (comptage statique par regex), mais la CI en exécutait réellement **30** — écart expliqué en §0.2 (et depuis corrigé, voir §0.1bis).

### 0.1bis Ce qui s'est passé depuis (PR #12, PR #13)

| Lot | Statut | Contenu |
|---|---|---|
| **PR #12** | ✅ Mergée | Fix du sous-comptage E2E évoqué en §0.2 ci-dessous (`countE2E()` passe de regex à `npx playwright test --list`) + fix d'un 2ᵉ bug trouvé en testant le 1ᵉʳ (corruption par sous-chaîne dans `check-doc-numbers.js --fix`, ex: "25 E2E"→"30 E2E" corrompait "125 PHPUnit"→"130 PHPUnit" ; remplacement positionnel par indices de regex maintenant). CI confirmée verte, y compris `docs:check` en environnement CI réel. |
| **PR #13** | ✅ Mergée | Anti-triche daily target (phase 1, détection), split de `admin/admin.js` en 8 modules, couverture E2E des 9 endpoints admin qui n'avaient aucun test, fix a11y `prefers-reduced-motion` sur 2 boucles canvas JS. Confirmé vert par la vraie CI (PHPUnit + E2E Docker, voir §2.12-2.13 ci-dessous). Suivi de review : 6 points traités (bug `escHtml` falsy-zero, dédup pagination/loading admin, cross-check hash étendu à 6/6 modes, `prefersReducedMotion()` extrait dans `gameCore.js`, CLAUDE.md §9 corrigé, limitation anti-triche AllOutAttack/Personae documentée). |
| **Nouveau lot** | 🔎 En cours (`claude/roadmap-followups-*`) | Conditions badges/wallpapers en colonnes structurées (`condition_type`/`condition_mode`/`condition_value`, comme `titles`) — détail en §2.16 ci-dessous. |

Chiffres à la date de rédaction (6 juillet 2026, post-PR #13) : **475 tests Vitest**
(25 suites) · **168 méthodes PHPUnit** (11 fichiers, nouveau : `DailyTargetTest.php` +
`ConditionCheckTest.php` + `BadgeWallpaperCatalogTest.php`) · **949 clés i18n** × 5 langues ·
**23 tables SQL** · **54 tests E2E** (6 fichiers, nouveau : `admin-extended.spec.js`, 24 tests).
⚠️ Comme partout dans ce document, **snapshot figé à cette date** — ne reflète déjà plus
l'état réel après les PR #25→#30 (17 juillet, voir `TEST_PLAN.md` §22-§23) et les sessions
suivantes. Pour les chiffres à jour : `npm run docs:check`.

### 0.2 Ce qui vient d'être re-vérifié à l'instant (clone frais de `develop`, sans Docker)

Avant de te livrer la première version de ce document, j'ai reclonné `develop` à part et relancé
ce qui ne nécessite pas MariaDB — pas une relecture, une vraie exécution (chiffres de l'époque,
post-PR #11) :

- [x] `npx vitest run` → **473 passed (473)**, 24 fichiers, 0 échec
- [x] `npm run lint` → **0 erreur**, 19 warnings pré-existants (variables non utilisées dans du code de debug/legacy — rien lié aux PR récentes)
- [x] `npm run i18n:check` → 949 clés OK sur les 5 langues
- [x] `npm run data:check` → 177 personnages valides
- [x] `npm run docs:check` → cohérent
- [x] `php -l` sur **tous** les fichiers `.php` du repo (pas juste ceux touchés par une PR) → 0 erreur de syntaxe
- [ ] **PHPUnit** — toujours impossible ici (pas de MariaDB, `phpunit.phar` toujours bloqué par le proxy). À faire chez toi via `make test-php`.

**Petite trouvaille au passage — ✅ corrigée depuis (PR #12)** : le compteur `scripts/check-doc-numbers.js` sous-évaluait le nombre réel de tests E2E. `tests-e2e/game-flow.spec.js` génère 6 tests responsive via une boucle `for` sur un seul appel `test(...)` dans le code source — le regex du script comptait 1 occurrence statique là où Playwright exécute réellement 6 tests au runtime (25 statique + 5 = 30 réel à l'époque). Remplacé par `npx playwright test --list` (comptage runtime, pas regex) — mergé et vérifié vert en CI.

**Pour la PR #13 (ci-dessous), même méthodologie** — reclone à part, sans Docker :
`npx vitest run` → 475/475 · `npm run lint` → 0 erreur · `npm run docs:check` /
`npm run pools:check` → cohérents · `php -l` sur tous les `.php` touchés → 0 erreur. Le point
nouveau et le plus délicat à vérifier sans Docker (l'algorithme anti-triche `api/lib/daily_target.php`)
a été validé par **comparaison croisée directe** : mêmes seed/date/mode/filtre exécutés en
parallèle sous Node (`getDailyTarget()`, le vrai code client) et sous PHP (le portage), sortie
comparée programmatiquement sur des dizaines de combinaisons — pas une relecture, une exécution
réelle des deux implémentations. Détail en §2.12.

### 0.3 Comment lire ce document

- Section 2 = **prioritaire**, à faire en premier — c'est la checklist spécifique à tout ce qui n'a pas pu être vérifié en navigateur réel.
- Sections 3 à 20 = checklist fonctionnelle complète (reprise de `TEST_PLAN.md`, adaptée : tu peux corriger directement au lieu de juste noter).
- Section 21 = méthodologie de suivi si tu préfères noter plutôt que corriger tout de suite.
- Case `- [ ]` cochée = vérifié OK. Non cochée après un vrai essai = à corriger ou creuser.

---

## 1 — Setup

### 1.1 Prérequis

| Outil | Vérifier | 
|---|---|
| Git | `git --version` |
| Docker Desktop | `docker --version` && `docker compose version` |
| Node.js 18+ | `node --version` |

### 1.2 Récupérer le projet à jour

```bash
git fetch origin develop
git checkout develop
git pull
```

### 1.3 Installer + configurer

```bash
make install        # npm ci + active les git hooks (pre-commit lance i18n + tests + docs:fix)
cp .env.example .env # valeurs par défaut suffisantes pour tester en local
```

### 1.4 Démarrer la stack

```bash
make up
```

- [ ] `http://localhost:8080` répond (page d'accueil)
- [ ] `http://localhost:8081` répond (phpMyAdmin — `personadle_usr` / `devpassword`)

```bash
make down   # éteindre
make logs   # debug si une page plante
```

---

## 2 — 🔧 PRIORITAIRE : à vérifier suite aux sessions Claude Code (depuis `4d6634e`, PR #4 → #13)

> Chaque point ci-dessous a été vérifié par lecture de code / tests unitaires / CI GitHub Actions
> réelle, mais **jamais cliqué en vrai par un humain dans un navigateur**. Coche seulement après
> l'avoir réellement observé — c'est le but de cette section.

### 2.1 Commandes terminal à relancer une fois en local

Tout est déjà vert en CI (voir `.github/workflows/ci.yml`, runs sur `develop`), mais ça vaut le
coup de les relancer une fois toi-même pour être sûr que ton environnement local est sain :

```bash
make check        # lint + data:check + i18n:check + tests JS + tests PHP, tout d'un coup
```

- [ ] `npm run lint` — 0 erreur ESLint
- [ ] `npm run format:check` — Prettier (non-bloquant en CI, mais regarde s'il y a beaucoup de diff)
- [ ] `npx vitest run` — 0 failed (475 à la date de rédaction, ce nombre monte — voir §0.1bis)
- [ ] `npm run i18n:check` — clés cohérentes sur les 5 langues (949 à la date de rédaction)
- [ ] `npm run data:check` — schéma personnages valide
- [ ] `npm run pools:check` — `api/data/daily_pools.json` synchronisé avec les datasets JS (nouveau, PR #13)
- [ ] `make test-php` — 0 failed (168 méthodes à la date de rédaction) — nouveau fichier à
  surveiller : `tests/php/DailyTargetTest.php`
- [ ] PHPStan niveau 5 (voir `ci.yml` job `PHP Lint & Tests` pour la commande exacte si tu veux le lancer isolément)

```bash
npm run test:e2e
```

- [ ] **54 tests E2E** passent, 0 failed (le détail par fichier est en section 2.6-2.8 et 2.14 ci-dessous)

### 2.2 Sécurité — CSRF, session, mots de passe (PR #7, #8, #9)

- [ ] Se connecter, ouvrir DevTools → Application/Storage → Cookies → vérifier la présence de
  `csrf_token` (lisible, pas httpOnly) et du cookie de session (httpOnly)
- [ ] Faire une action mutante (changer pseudo, poster une session de jeu) → DevTools → Network →
  vérifier que le header `X-CSRF-Token` est bien envoyé et matche le cookie
- [ ] Se connecter via "Remember me", fermer le navigateur, le rouvrir → toujours connecté, et
  vérifier en base (`phpMyAdmin` → table `users`) que `remember_me_hash` a changé après cette
  reconnexion (rotation du token — normal)
- [ ] Essayer de créer un compte avec le mot de passe `password123` ou `12345678` → doit être
  refusé avec un message "mot de passe trop commun" (dans les 5 langues si tu changes la langue
  avant de tester)
- [ ] Vérifier que les crons (`api/cron/leaderboard.php` etc.) utilisent bien le header
  `X-Cron-Key` et pas `?key=` — si tu as un vrai cron configuré sur Hostinger, vérifie que la
  commande crontab a bien été mise à jour avec le nouveau format (voir `docs/hostinger-cron-setup.md`)

### 2.3 Bug Give Up compté comme victoire — mode Classique (PR #9)

> Déjà confirmé par un test E2E réel en CI (`game-flow.spec.js`), mais vaut le coup d'un
> coup d'œil visuel en vrai.

- [ ] Mode Classique, faire 8 mauvaises réponses, cliquer "Give Up"
- [ ] La `victoryBox` verte (fond + bordure) s'affiche correctement — si tu vois une boîte
  vide/invisible, `class="victory-box"` manque quelque part
- [ ] Vérifier en base (`game_sessions`, dernière ligne pour ton compte) que `result = 'giveup'`
  et pas `'win'`
- [ ] Vérifier que le badge "victoire du premier coup" (`hasWonFirstTry`) ne se débloque **pas**
  sur un Give Up

### 2.4 Anti-triche glisser-déposer — Silhouette & All-Out Attack (PR #9)

> Bug remonté par toi, corrigé avec 3 couches redondantes (`draggable="false"` + CSS
> `user-drag:none` + `preventDefault(dragstart)`).

- [ ] Mode Silhouette, essayer de cliquer-glisser l'image floutée hors de sa zone → l'image ne
  doit **plus** pouvoir être déplacée du tout
- [ ] Même test en mode All-Out Attack sur le GIF

### 2.5 CSP — pages HTML (PR #9)

> La policy a été construite par audit exhaustif du code (grep sur toutes les ressources
> externes), mais jamais vue tourner dans un vrai navigateur.

- [ ] DevTools → Console, naviguer sur `index.html`, chaque mode de jeu, `profile.html`,
  `pages/faq.html`, `pages/privacy.html` → **0 violation CSP** affichée en rouge dans la console
- [ ] Profil → Export carte PNG (utilise `html2canvas` depuis `cdn.jsdelivr.net`) → doit
  fonctionner sans être bloqué
- [ ] Polices Google (Oswald, Cinzel...) s'affichent bien, pas de fallback système visible
- [ ] Mode All-Out Attack → le GIF depuis le CDN Cloudflare R2 s'affiche bien

### 2.6 Réorganisation `pages/` (PR #9)

- [ ] `http://localhost:8080/pages/faq.html` s'affiche correctement, CSS/JS/images chargées
  (rien en 404 dans l'onglet Network)
- [ ] `http://localhost:8080/pages/privacy.html` idem
- [ ] Depuis ces deux pages, la bottom nav (barre de nav du bas) fonctionne et pointe vers les
  bons chemins (`../index.html`, `../profile/profile.html`...) — c'est le point qui aurait
  cassé silencieusement sans le fix de `js/bottomNav.js`
- [ ] Aller volontairement sur une URL inexistante (`http://localhost:8080/n-importe-quoi`) →
  la page `pages/404.html` s'affiche (pas une erreur Apache brute)
- [ ] Demander un reset de mot de passe (§4.5 plus bas) → l'email (ou le lien affiché en local
  si pas de vrai SMTP configuré) pointe vers `/pages/reset-password.html?token=...` et la page
  fonctionne

### 2.7 Fix routage `/api/friends` et `/api/notifications` (PR #11)

> Confirmé par CI (30/30 E2E passent, y compris tout `social-link.spec.js`), mais un
> clic réel ne coûte rien.

- [ ] Avec 2 comptes (voir §2 de la checklist fonctionnelle plus bas pour en créer un second),
  envoyer une demande d'ami → elle apparaît bien côté destinataire (pas de body perdu)
- [ ] Le badge rouge de demandes d'ami sur la bottom nav se marque bien comme "vu" après avoir
  consulté la page Amis (`PATCH /api/notifications/`)
- [ ] DevTools → Network, en envoyant la demande d'ami : la requête `POST` part directement en
  `POST` vers `/api/friends/` (avec le slash), **pas** de redirection 301 visible dans l'onglet
  Network vers une variante sans slash

### 2.8 Panel admin — Logs, Audit trail, RGPD, Rate Limits (PR #6)

> **Jamais vérifié avec un vrai backend** — la vérification de l'époque a mocké les endpoints
> `/api/admin/*` dans Playwright plutôt que de taper une vraie base. C'est le point le plus
> important de cette section 2 à re-tester réellement.

- [ ] Onglet **🪵 Logs** : provoque une vraie erreur serveur (ex : coupe la BDD un instant,
  ou force une requête invalide) → une ligne apparaît dans le panel avec contexte JSON lisible,
  filtre par niveau et recherche par message fonctionnels
- [ ] Onglet **📋 Audit** : bannis/débannis un compte, attribue un badge manuellement, crée un
  code événement → chaque action apparaît dans l'audit trail avec l'admin responsable, l'action,
  la cible et l'horodatage
- [ ] Onglet **🗑️ RGPD** : la liste des `deletion_requests` s'affiche (vide si personne n'a
  demandé la suppression de son compte) ; si tu as un compte de test en attente de suppression,
  le déclenchement manuel du hard-delete anticipé fonctionne
- [ ] Onglet **⏱️ Rate Limits** : après avoir déclenché un rate-limit (ex : 6 mauvais mots de
  passe d'affilée, §4), la fenêtre apparaît dans ce panel ; la purge manuelle la fait disparaître
- [ ] `make test-php` doit couvrir ces 4 tables (`error_log`, `admin_audit_log`,
  `deletion_requests`, `rate_limits`) via `DatabaseIntegrationTest.php` — vérifie qu'aucun test
  n'est resté en echec silencieux

### 2.9 i18n — pages publiques et erreurs auth (PR #5)

- [ ] `pages/404.html` et `pages/reset-password.html` (attention au nouveau chemin, voir §2.6) :
  changer de langue → texte entièrement traduit, pas de résidu anglais
- [ ] Se tromper de mot de passe / prendre un pseudo déjà utilisé / mismatch de mot de passe à
  l'inscription, **dans une langue autre que l'anglais** (ex : allemand) → le message d'erreur
  s'affiche bien traduit
- [ ] Le sélecteur de langue (`js/lang-selector.js`) se comporte identiquement sur `pages/404.html`
  et `pages/reset-password.html` que sur les autres pages qui l'utilisaient déjà

### 2.10 Suppression de `profile/profile.js` (fin PR #4)

> Fichier mort (aucun point d'entrée) supprimé — vérification rapide qu'il n'y avait pas
> d'angle mort.

- [ ] `profile/profile.html` charge et fonctionne normalement (avatar, stats, badges) — ce
  fichier ne dépendait que de `profile-page.js`/`profile-view.js`, jamais de `profile.js`
- [ ] DevTools → Console, aucune erreur 404 sur un ancien `profile.js` qui aurait été précaché
  par le service worker (le cache SW a été bumpé v73→v74 justement pour ça — si tu avais déjà
  visité le site avant ce commit, un hard-refresh/vidage de cache peut être nécessaire une fois)

### 2.11 Chantiers explicitement reportés — pas des bugs, mais à garder en tête

Ces points ont été **volontairement laissés de côté** pendant les sessions Claude Code (trop
risqués à faire sans vérification navigateur, ou hors-scope) :

- [ ] **`profile/profile-page.js`** (1194 lignes) — pas scindé. En le relisant pour la PR #13, il
  a déjà 9 modules extraits d'un travail antérieur (badges/, wallpapers-ui.js, titles-ui.js,
  song-player.js, share-card.js, theme.js, profile-format.js, formatPlayTime.js, avatars_data.js) ;
  ce qui reste est un contrôleur de page fortement couplé (`profile` partagé, closures
  `markDirty`/`saveProfile`) — décision de ne pas re-découper plutôt qu'à l'aveugle. `admin.js`,
  lui, a été scindé — voir §2.13.
- [ ] **Git LFS + poids du `.git`** (~3,5-4,8 Go, 1,7 Go d'AOA webp versionnés) — script
  `scripts/purge_git_history.sh` déjà prêt mais jamais exécuté (destructif, à coordonner).
- [ ] **Réencodage AOA** — pipeline `ffmpeg` validé (3-8× plus léger) mais pas appliqué à la
  base existante.
- [ ] **Badges "à flags"** — plusieurs conditions de badges restent crues sur parole côté client
  (liste de bypass dans `verifyBadgeCondition()`, `api/badges/index.php`). **Explicitement laissé
  de côté à ta demande** lors du dernier lot (PR #13) — pas retouché.

### 2.12 🆕 Anti-triche daily target — phase 1, détection seulement (PR #13)

> Aucune table `daily_targets` n'existe en BDD (contrairement à ce qu'affirmait ce document et
> `ROADMAP.md` avant — corrigé). Chaque mode calcule sa cible via un algorithme seedé
> (`getDailyTarget()`, FNV-1a), porté en PHP dans `api/lib/daily_target.php`. **Ne rejette rien** :
> logue juste un écart dans `error_log` (source `anti_cheat`) si la cible soumise ne correspond
> pas à celle recalculée côté serveur. Vérifié par comparaison croisée Node/PHP (voir §0.2), mais
> jamais contre une vraie base MariaDB avec de vraies sessions de jeu.

- [ ] `make test-php` fait bien passer `tests/php/DailyTargetTest.php` (nouveau fichier, ~15 tests)
- [ ] Jouer normalement (gagner une partie légitime) dans chacun des 6 modes → vérifier dans
  `phpMyAdmin` (table `error_log`, colonne `context` avec `"source":"anti_cheat"`) qu'**aucune**
  ligne n'apparaît pour ta session — un faux positif ici voudrait dire que l'algorithme PHP ne
  matche pas le client pour au moins un mode
- [ ] Attention particulière à **AllOutAttack** et **Personae** : change le filtre opus en cours
  de partie (panneau de filtres), gagne, puis vérifie encore `error_log` — c'est le chemin le
  plus susceptible de révéler un désaccord client/serveur (repli conditionnel sur pool filtré)
- [ ] Onglet admin **🪵 Logs** : le filtre par recherche "anti_cheat" doit permettre de retrouver
  ces entrées facilement si tu veux surveiller ça dans la durée avant de passer en phase 2 (rejet
  strict — voir `ROADMAP.md` § Sécurité/compte pour le critère de bascule)

### 2.13 🆕 `admin/admin.js` scindé en 8 modules (PR #13)

> 1850 → ~1155 lignes. Comportement censé être strictement inchangé (déplacement mécanique de
> code), vérifié uniquement par `tests/adminSmoke.test.js` (jsdom, pas un vrai navigateur) — **le
> point le plus important à re-tester en vrai de toute cette section**, vu que c'est le panel qui
> gère les actions sensibles (ban, RGPD, dons).

- [ ] Panel admin complet : liste utilisateurs, recherche, pagination — fonctionne comme avant
- [ ] Chaque onglet de détail utilisateur (Profil, Badges, Wallpapers, Titres, Stats, Amis, Social
  Links) s'affiche et permet de sauvegarder/modifier normalement
- [ ] Les 5 panneaux désormais dans leur propre fichier — vérifier que chacun s'ouvre et fonctionne
  identiquement à avant : **🎟️ Codes** (`admin/event-codes.js`), **🪵 Logs**
  (`admin/error-logs.js`), **📋 Audit** (`admin/audit-log.js`), **🗑️ RGPD**
  (`admin/deletion-requests.js`), **⏱️ Rate Limits** (`admin/rate-limits.js`)
- [ ] File d'attente de dons en attente (pending gifts, bouton ⚡ en bas à droite) fonctionne
  toujours après avoir coché/décoché des badges/wallpapers/titres sur plusieurs onglets
- [ ] DevTools → Console : aucune erreur JS au chargement du panel ni en changeant d'onglet/panneau

### 2.14 🆕 Couverture E2E des endpoints admin restants (PR #13)

> `tests-e2e/admin-extended.spec.js` (24 tests, nouveau) — event_codes, error_logs,
> deletion_requests, social_links, user_badges/titles/wallpapers/stats/friends n'avaient
> **aucun** test avant. Jamais exécuté ici (besoin de `make up`).

- [ ] `npx playwright test tests-e2e/admin-extended.spec.js` → 24/24 passent
- [ ] En particulier, vérifier que le test de dons badge/titre/wallpaper ne laisse pas de résidu
  gênant sur un vrai utilisateur de seed (il crée son propre compte cible à la volée, mais vaut le
  coup de vérifier une fois que rien ne fuit sur les comptes `*@personadle.seed`)

### 2.15 🆕 a11y — `prefers-reduced-motion` sur les boucles canvas JS (PR #13)

> `css/global.css` neutralise déjà toutes les animations CSS pour `prefers-reduced-motion`, mais
> deux effets tournaient en JS pur (boucle `requestAnimationFrame`, jamais arrêtée par une media
> query CSS) : le bruit TV statique (`tv-friend-anim.js`) et les confettis du don admin
> (`divine-gift.js`). Jamais vérifié dans un vrai navigateur.

- [ ] DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce"
- [ ] Reçois/simule une demande d'ami avec l'animation TV Persona 4 (`settings.
  anim_friend_request_style = 'persona4_tv'`) → l'écran de la TV reste fixe (pas de bruit
  statique animé), le reste de l'animation (fondu, burst, texte) continue de fonctionner
  normalement (pas cassé, juste sans le grain de bruit)
- [ ] Panel admin → accorde un badge/titre/wallpaper à un utilisateur → l'animation "The Admin has
  spoken…" s'affiche sans les confettis dorés qui tombent
- [ ] Redésactive `prefers-reduced-motion` → les deux animations retrouvent leur effet complet

### 2.16 🆕 Conditions badges/wallpapers en colonnes structurées (2026-07-06, revue PR #14 incluse)

> `badges`/`wallpapers` ont maintenant les mêmes colonnes `condition_type`/`condition_mode`/
> `condition_value` que `titles`, vérifiées par une fonction générique unique
> (`api/lib/condition_check.php`) au lieu de 3 mappings slug→logique divergents. Corrige au
> passage 2 badges (`velvet_regular`, `best_bro`) qui étaient bypassés par erreur. Suite à la
> revue de la PR #14, deux comportements de sécurité ont été durcis : (1) les wallpapers
> restent **fail-closed** si `condition_type` est vide (avant, déléguer directement à la
> fonction partagée aurait silencieusement inversé ce choix, car `titles`/`badges` sont
> fail-open par design) ; (2) un `condition_value` NULL par erreur de saisie sur un type qui
> en a besoin (ex: `wins_total`) refuse désormais l'unlock au lieu de le laisser toujours
> passer (`>= 0` était toujours vrai). Une 2ᵉ passe de revue a aussi attrapé un vrai bug
> via la CI réelle : le garde-fou (2) incluait par erreur `social_link_min_rank`, qui a
> son propre défaut à 10 documenté séparément — corrigé (`d603516`). Elle a aussi ajouté
> un fail-closed strict sur les wallpapers (`personadle_known_condition_types()` : un
> `condition_type` non-vide mais inconnu du vocabulaire est maintenant refusé, pas juste
> un `condition_type` vide) et une couverture "frontière exacte" (value-1 refusé, value
> accordé) sur les 19 badges/wallpapers à seuil simple + un test dédié pour
> `all_modes_won` (5/6 modes refusé, 6/6 accordé) — `tests/php/ConditionCheckTest.php`
> (22 tests) et `tests/php/BadgeWallpaperCatalogTest.php` (7 tests) confirmés verts par
> la CI réelle, mais vaut aussi le coup de re-tester en vrai :

- [ ] `make test-php` → `ConditionCheckTest` (22 tests) et `BadgeWallpaperCatalogTest`
  (7 tests) passent, en plus des suites existantes
- [ ] Gagner 10 parties (tous modes confondus) → le badge **Ace Detective** se débloque
  normalement (`wins_total >= 10`) — comportement inchangé, juste revérifie que le refactor
  n'a rien cassé sur un cas déjà fonctionnel avant
- [ ] Jouer sur **50 jours uniques** (ou modifier directement `game_sessions` en base pour
  simuler) → le badge **Velvet Regular** se débloque désormais réellement (avant cette
  migration, il était toujours accordé sans vérifier la condition)
- [ ] Avoir **2 amis acceptés** → le badge **Best Bro** se débloque désormais réellement
  (même remarque — avant, toujours accordé sans vérifier)
- [ ] Wallpaper **Rise's Dungeons** (30 parties en mode Music, peu importe le résultat) :
  jouer 30 parties Music en perdant volontairement (Give Up) → le wallpaper se débloque
  quand même (vérifie que `mode_games` compte bien les *parties*, pas les *victoires*)
- [ ] Wallpaper **Dark Shopping District** (Social Link rang ≥ 5) : atteindre le rang 5 avec
  un ami → le wallpaper se débloque (`social_link_min_rank`, nouveau condition_type)
- [ ] En base, mettre un wallpaper non-défaut avec `condition_type` NULL (ou vide) → l'unlock
  est **refusé** (403 `Condition not met`), pas accordé — vérifie le fail-closed wallpaper
- [ ] En base, mettre `condition_value` à NULL sur un badge de type `wins_total` (ou autre
  type numérique) → l'unlock est **refusé** même avec des stats élevées, pas accordé par
  erreur (`>= 0` ne doit plus jamais être vrai par défaut)
- [ ] En base, mettre un wallpaper non-défaut avec `condition_type` = une valeur qui n'existe
  pas dans le vocabulaire (ex. `'social_link_rank_10'`, retiré par cette PR, ou une faute
  de frappe) → l'unlock est **refusé**, ne retombe plus sur le safe-fallback `true`
- [ ] Badge à seuil (**Ace Detective**, `wins_total >= 10`) : à 9 victoires, l'unlock est
  bien **refusé** (pas seulement accordé à 10+) — vérifie la frontière exacte, pas juste
  le cas "largement au-dessus du seuil"
- [ ] Panel admin → onglet Badges/Wallpapers d'un utilisateur : l'affichage (nom, rareté,
  image) fonctionne comme avant — les nouvelles colonnes ne sont pas encore exploitées côté
  admin UI, seulement côté vérification serveur
- [ ] `GET /api/badges` et `GET /api/wallpapers` (DevTools → Network) renvoient bien les
  champs `condition_type`/`condition_mode`/`condition_value` en plus des champs existants

---

## 3 — Créer un 2ème compte de test

Identique à `TEST_PLAN.md` §2 : un compte principal + un compte secondaire (navigation privée)
pour tester les fonctionnalités sociales. Pour te passer admin toi-même :

```bash
docker compose exec db mariadb -u root -prootpassword personadle_db \
  -e "UPDATE users SET is_admin = 1 WHERE pseudo = 'TON_PSEUDO';"
```

- [ ] Reconnexion → accès au panneau admin (`/admin/`)

---

## 4 — Authentification & comptes

- [ ] Inscription avec email déjà pris / pseudo déjà pris / mot de passe < 8 caractères → erreurs claires
- [ ] Connexion avec mauvais mot de passe / mauvais email → message générique (pas de détail sur ce qui est faux)
- [ ] Logout → reload → toujours déconnecté
- [ ] "Remember me" → fermer/rouvrir le navigateur → toujours connecté
- [ ] "Mot de passe oublié" → message de confirmation identique que l'email existe ou non
- [ ] 6 mauvais mots de passe d'affilée sur le même compte → rate-limit "trop de tentatives"
- [ ] Bannir un compte (admin) → tentative de connexion refusée avec message clair, puis débannir

---

## 5 — Les 6 modes de jeu

Pour chaque mode : une partie jusqu'à la victoire.

- [ ] **Classique** — autocomplétion avec portraits, grille colorée, confettis + citation à la victoire, Give Up utilisable après quelques essais (voir §2.3 pour le point spécifique)
- [ ] **Emoji** — séquence d'emojis, un de plus révélé par erreur, historique des erreurs avec portraits
- [ ] **Silhouette** — image qui se dévoile progressivement (voir §2.4 pour l'anti-triche)
- [ ] **All-Out Attack** — animation floutée qui se révèle (voir §2.4), Hatsune Miku + Phantom Idols P5X présents dans la rotation
- [ ] **Personae** — c'est le Persona (pas le perso) qui est à deviner
- [ ] **Musique** — lecteur façon P5, pochette correcte, thème coloré selon l'opus, filtres P4AU/P5T fonctionnels
- [ ] Rechargement de page → même cible du jour (pas un nouveau tirage à chaque F5)

---

## 6 — Filtres (opus)

- [ ] Décocher tout sauf P3/P4 → seuls des persos P3/P4 dans l'autocomplétion, persiste après reload
- [ ] Sous-filtres P5 (P5R, P5S, P5T) → décocher un seul sous-code fonctionne indépendamment
- [ ] Tout décocher → message d'avertissement, 0 erreur console

---

## 7 — Profil

- [ ] Pseudo : bouton "Sauvegarder" apparaît seulement après une vraie modif, persiste après reload
- [ ] Avatar : crop fonctionne, gros fichier ne plante pas la page
- [ ] Wallpaper / musique de profil : changement immédiat + persiste
- [ ] Profil public (`?view=CODE_AMI`) : lecture seule, pas de bouton Save
- [ ] Export carte PNG : téléchargement réel, correspond à l'aperçu, changement de thème visible avant download
- [ ] Export JSON : fichier lisible (pas de bouton "Import" actuellement dans l'UI — le
  cloud sync est la seule voie de restauration, ne pas chercher ce bouton)

---

## 8 — Badges, titres, wallpapers, codes

- [ ] Débloquer un badge en jouant → notif visuelle + visible dans la collection
- [ ] Épingler 4 badges max → visibles sur le profil public → **persistent après reload** (régression possible si tu retouches `selected_badges`, cf. le fix d'ownership de la session précédente)
- [ ] Essayer d'épingler un badge non débloqué → refusé en 403 (fix récent, `api/user/index.php`)
- [ ] Code événement : création admin → utilisation → réutilisation refusée → code inconnu refusé
- [ ] Titre équipé visible sous le pseudo, un seul à la fois
- [ ] Wallpaper verrouillé non sélectionnable

---

## 9 — Système social

- [ ] Demande d'ami envoyée/acceptée entre 2 comptes (voir §2.7 pour le point spécifique post-fix)
- [ ] Recherche par code ami (8 caractères)
- [ ] Browse Players : liste paginée, demande d'ami direct depuis la liste
- [ ] 3 styles d'animation de demande (Calling Card, TV P4, Evoker P3) — boutons Accepter/Refuser fonctionnels sur les 3
- [ ] Social Link : jauge progresse à la visite de profil, comparaison de stats avec animation
- [ ] Passage de rang : animation visible **des deux côtés**
- [ ] Défi : bandeau visible, victoire → notif au bout d'~1 min, un seul défi/jour/mode/paire
- [ ] Give up sur un défi → passe en "perdu" proprement
- [ ] Filtres opus restaurés après un défi joué avec des filtres différents
- [ ] Pas de fuite de notification de défi en changeant de compte dans la même fenêtre

---

## 10 — Leaderboard

- [ ] Filtres mode/période/métrique/portée fonctionnels, combo vide → message clair
- [ ] Pagination fonctionne avec les 19 faux joueurs de seed + tes comptes
- [ ] "Amis seulement" → seuls tes 2 comptes de test apparaissent
- [ ] "Ma position" reste visible même hors de la page affichée

---

## 11 — Panneau admin

- [ ] Accès refusé pour un non-admin
- [ ] Ban / lock pseudo fonctionnels
- [ ] Attribution manuelle de badge
- [ ] Code événement : désactivation → réutilisation refusée avec message clair
- [ ] Affichage mobile (375px) : menu en tiroir
- [x] **Mis à jour (PR #13)** : `event_codes`, `social_links`, `user_badges/titles/wallpapers`,
  `deletion_requests`, `error_logs` ont maintenant une couverture E2E (`admin-extended.spec.js`,
  voir §2.14) en plus de `users`/`audit_log`/`rate_limits` (`admin.spec.js`). Clique quand même
  sur chaque onglet en vrai une fois — l'E2E teste l'API, pas le rendu visuel du panel scindé en
  8 modules (§2.13).

---

## 12 — Internationalisation

- [ ] Les 5 langues (EN/FR/ES/DE/IT) traduisent l'interface en entier, noms propres non traduits
- [ ] Boutons illustrés (Hint/Give Up/Submit/Replay) changent d'image selon la langue
- [ ] Langue persiste après reload

---

## 13 — Dark mode & accessibilité

- [ ] Dark mode : rien resté en blanc par erreur, logos de filtres lisibles, persiste après reload
- [ ] Mode daltonien (si activé) : grille Classique reste distinguable
- [ ] **Nouveau** : Tab/Shift+Tab dans une modale (crop avatar, musique, titres, paramètres)
  reste cantonné dedans, Escape ferme + restaure le focus sur l'élément d'origine
- [ ] Menu de filtres (`js/filterMenu.js`) : Tab envoie le focus dans le panneau à l'ouverture,
  restauré sur le bouton toggle à la fermeture (pattern menu déroulant, pas un piège Tab complet)
- [ ] **Nouveau (PR #6)** : `avatarCropModal`, `sharePreviewModal`, `songModal`, `titlesModal`
  ont maintenant le même focus trap que les modales login/register — Tab/Shift+Tab cantonné,
  Escape ferme + restaure le focus, pas de fuite de listener si on rouvre la même modale
  plusieurs fois de suite
- [ ] Note de code mort trouvée en review (pas un bug utilisateur, juste pour info) : dans
  `profile-page.js`, la branche `cropTarget === "song"` de `confirmCrop.onclick` n'est jamais
  atteinte (`cropTarget` n'est jamais assigné à `"song"` nulle part) — reliquat probable d'une
  ancienne feature de recadrage d'artwork musical, jamais nettoyé, sans impact fonctionnel actuel
- [ ] **Nouveau (PR #13)** : `prefers-reduced-motion` — voir §2.15 pour le détail (bruit TV + confettis don admin)

---

## 14 — Streak & récupération Jack Frost

- [ ] Forcer `streak = 0` en base → bouton de récupération visible → utilisation → série restaurée
- [ ] Cooldown : reforcer à 0 juste après → bouton absent/grisé

---

## 15 — Sync cloud & offline

- [ ] Changer le pseudo en base directement → apparaît côté client sans reload complet
- [ ] DevTools → Network → Offline → jouer une partie → ça marche → repasser online → la partie se synchronise

---

## 16 — Sécurité (côté utilisateur)

- [ ] Upload d'un faux fichier image (`.txt` renommé `.jpg`) en avatar → refusé proprement
- [ ] `curl -I http://localhost:8080/api/auth/me` → headers `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` présents
- [ ] Voir aussi §2.2/2.5 ci-dessus pour CSRF et CSP spécifiquement

---

## 17 — Responsive & multi-navigateurs

- [ ] 375px : accueil, Classique, Musique, Profil, Amis, Leaderboard, Admin — rien de coupé/superposé
- [ ] Chrome + Firefox (+ Safari si dispo)

---

## 18 — Documentation

- [ ] `README.md`, `ROADMAP.md`, `CLAUDE.md`, `AMELIORATIONS.md`, `CONTRIBUTING.md` reflètent bien l'état réel (les chiffres sont auto-générés par `npm run docs:fix`, ne les corrige jamais à la main)
- [ ] `PersonaDLE_Update_Documentation/PersonaDLE 2.0/DEV_CHANGELOG.md` — le détail technique de chaque commit récent est cohérent avec ce que tu observes
- [ ] Les 27 README de sous-dossiers restent à jour (liste complète dans `TEST_PLAN.md` §18 si besoin)

---

## 19 — Suggestions

Espace libre — toute idée d'amélioration qui n'est pas un bug. Note-les directement dans
`ROADMAP.md` (section produit) plutôt que dans un rapport séparé, tu es le seul lecteur.

---

## 20 — Checklist finale

- [ ] Section 2 (prioritaire) entièrement passée
- [ ] `make check` + `npm run test:e2e` tous verts en local
- [ ] Sections 3 à 18 passées au moins une fois
- [ ] Toute anomalie trouvée : soit corrigée directement (tu as le code), soit ajoutée à `ROADMAP.md`/`AMELIORATIONS.md` avec le contexte

---

## 21 — Si tu préfères noter plutôt que corriger tout de suite

Contrairement à Léo/Damien, tu n'as pas besoin d'un template de rapport formel — mais si tu veux
garder une trace avant de corriger, le plus simple est une entrée directement dans
`AMELIORATIONS.md` (chantiers) ou `ROADMAP.md` (bugs/décisions), avec :

```
- [ ] **Titre court** — repro : étapes, comportement observé vs attendu, fichier(s) concerné(s)
```

C'est le même format que celui déjà utilisé dans ces deux fichiers — reste cohérent avec
l'existant plutôt que de créer un 3ème système de suivi.

---

*Généré le 5 juillet 2026, couvre tout depuis le commit `4d6634e` (fin PR #4, PR #5, #6, #7, #8, #9, #11).*
