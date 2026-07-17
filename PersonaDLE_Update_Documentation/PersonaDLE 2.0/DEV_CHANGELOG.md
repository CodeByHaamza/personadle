# Changelog technique — PersonaDLE v2.0

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE_Update.html` reste le changelog **joueur** — highlights
> uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur
> si elle est réellement visible/parlante côté joueur.

---

## 2026-07-17 — style(auth): "mot de passe oublié" ne ressemble plus à un lien

Léo : malgré le fix PR25 (soulignement retiré), le texte se lit toujours comme un
lien classique. Carte blanche donnée par Hamza. Taille et poids augmentés
(0.8rem/400 → 0.92rem/600), couleur rapprochée du texte normal du formulaire
(hover → `var(--accent)`) — se lit maintenant comme un bouton texte intégré,
pas comme du texte de bas de page. `profile/profile-page.css`, `.auth-forgot-link`.

---

## 2026-07-17 — fix(streak-recovery): garde anti-clic-accidentel sur le fond du popup

Repéré en revue (comportement confirmé, discutable) : cliquer n'importe où sur
`#sr-backdrop` fermait le popup Jack Frost immédiatement, contrairement à la
modale login/register (PR26) qui a une garde anti-clic-accidentel. Carte blanche
donnée par Hamza pour trancher — implémenté (rien n'était perdu définitivement,
mais facile à fermer par erreur pour un truc important).

Fix : même pattern exact que `js/auth.js` (`_dragStartedInside` sur mousedown,
vérifié au click sur le fond) — adapté au fait que `#sr-backdrop` et `#sr-menu`
sont des éléments frères (pas un wrapper autour du contenu comme la modale login),
donc le check compare `e.target !== backdrop` au mousedown plutôt que
`e.target.id !== id`. 3 tests ajoutés (`tests/streakRecovery.test.js`).

---

## 2026-07-17 — feat(badges,titres,wallpapers): notifications de déblocage sur n'importe quelle page

Léo : "les notifications d'obtention doivent se faire peu importe la page, je
viens de gagner et hop notification si j'ai rempli les conditions". Point de
départ de l'investigation : les badges avaient déjà `checkBadgesAfterGame()`
(`profile/badges/badgesManager.js`) câblé dans les 6 modes de jeu depuis un
moment — mais **titres et wallpapers n'avaient strictement aucun équivalent**,
jamais vérifiés en dehors du chargement de la page profil.

En creusant pourquoi les badges eux-mêmes semblaient malgré tout capricieux
(cf. le fix `ace_defective` de la veille, qui ne couvrait que le chemin
serveur/cloud-sync), **deux vrais bugs distincts trouvés côté client** :

1. **`classiqueMode/modeClassique.js`** : le chemin Give Up n'appelait **jamais**
   `checkBadgesAfterGame()` — seul `checkGuess()` côté victoire l'appelait, dans
   un bloc explicitement gardé par `!forceReveal`. Un badge comme `ace_defective`
   (10 give-ups) ne se vérifiait donc jamais juste après l'action qui devait le
   débloquer.
2. **`silhouetteMode/modeSilhouette.js`** : `giveUp()` appelait `showVictory(true)`
   — qui déclenche `checkBadgesAfterGame()` en interne, à la toute fin — **avant**
   d'écrire `stats.giveups` pour CE give-up (le `updateProfileStats`/
   `savePendingSession` de `giveUp()` tournait après le retour de `showVictory()`).
   Le check tournait donc systématiquement sur le compteur d'avant, un tour de
   retard — corrigé en réordonnant : stats loggées avant l'appel à `showVictory()`.

`emojiMode`/`personaeMode`/`musicsMode`/`allOutAttackMode` (chemin give-up direct,
pas de fonction `showVictory()` partagée avec le même piège d'ordre) étaient déjà
corrects des deux côtés.

**Code mort trouvé au passage** : `allOutAttackMode/modeAllOutAttack.js` référençait
`window.forceCheckBadges` — jamais défini nulle part dans tout le repo (`grep`
confirmé), le bloc ne s'exécutait donc jamais. Remplacé par un vrai appel.

### Fix

- `profile/titles-ui.js` : nouvelle fonction exportée `checkTitlesAfterGame()`,
  même contrat que `checkBadgesAfterGame()` (lit `localStorage`, vérifie les
  conditions, notifie, ne rend rien de l'UI profil).
- `profile/wallpapers-ui.js` : idem, `checkWallpapersAfterGame()`.
- `js/unlock-notify.js` (nouveau) : `checkUnlocksAfterGame()`, point d'appel
  unique regroupant les 3 checks — évite de dupliquer 3 imports + 3 appels dans
  les 6 fichiers de mode. **Volontairement pas importé par `gameCore.js`** (qui
  reste sans imports statiques pour éviter tout risque de cycle avec `api.js`,
  cf. CLAUDE.md § Pièges critiques) — chaque mode l'importe directement, comme
  il importait déjà `badgesManager.js`.
- Les 12 points d'appel (6 modes × win/give-up) basculés sur
  `checkUnlocksAfterGame()` ; les 2 bugs ci-dessus corrigés au passage.
- `css/title-notification.css` (nouveau, extrait de `profile-page.css`) +
  `wallpaper-notification.css` : chargés désormais sur les 6 pages de mode en
  plus de `profile.html` — sans ça la notif se déclenchait bien en JS mais
  s'affichait sans style (`.title-notification`/`.wallpaper-notif` n'étaient
  stylées que sur `profile.html`). `.badge-notification`, lui, était déjà dans
  `global.css` — les notifs badges s'affichaient donc déjà correctement partout,
  juste jamais déclenchées au bon moment.

### Angle mort noté, pas recréé par erreur
`.title-rarity-tag` (utilisé dans le HTML généré par `titles-ui.js`, notification
et zoom) n'est stylé nulle part — même pas sur `profile.html` avant ce commit
(`grep` sur tout `profile-page.css` : 0 résultat). Pré-existant, pas dans le
périmètre de ce fix — vérifié pour ne pas l'inventer par erreur en extrayant le
CSS vers le nouveau fichier.

### Tests
20 nouveaux : `checkTitlesAfterGame` (titlesUi.test.js), `checkWallpapersAfterGame`
(wallpapersUi.test.js), `checkBadgesAfterGame` — jusqu'ici sans **aucune**
couverture malgré son usage déjà répandu — (badgesManager.test.js), et
`checkUnlocksAfterGame` bout-en-bout (nouveau `unlockNotify.test.js`).

---

## 2026-07-17 — docs: audit TEST_PLAN_DEV.md

Même traitement que `TEST_PLAN.md` la veille — relu contre le code réel, pas
juste contre sa propre description. Trouvé : incohérence interne (139 vs 168
méthodes PHPUnit citées à deux endroits différents du même document, écrits à
des moments différents de sa rédaction), "Menu de filtres (Jack Frost)" — mix-up
avec la récupération de streak (Jack Frost n'a rien à voir avec le panneau de
filtres opus, visiblement copié par erreur depuis la section §14 dédiée),
"Export/Import JSON" testé comme si le bouton Import existait alors qu'aucune
trace de ce bouton n'existe dans l'UI (`profile-page.js`, aucun HTML). "Chiffres
actuels" relabellisé "à la date de rédaction (6 juillet)" pour ne plus laisser
croire qu'ils sont à jour, avec pointeur vers `TEST_PLAN.md` §22-23 pour tout ce
qui est venu après (PR #25→#30, 17 juillet).

---

## 2026-07-17 — fix(badges): bfcache + collision de nom de persona (Naoto/Futaba)

Hamza : même famille de bug que le badge `ace_defective` de la veille (action faite,
badge pas débloqué, refaire l'action "corrige" — alors que ce n'est pas l'action qui
manquait). Exemple donné : badge "Chronological Convergence" (Naoto + Futaba), a dû
regagner une partie avec la persona de Naoto pour que le badge apparaisse.

Deux causes distinctes, pas une seule :

1. **bfcache jamais géré sur `profile-page.js`** — aucun listener `pageshow` nulle
   part dans le repo (`grep -rl pageshow` vide avant ce commit). Revenir sur la page
   profil via le bouton "précédent" du navigateur après avoir joué ailleurs restaure
   la page **depuis le cache mémoire**, sans ré-exécuter ce script : la variable
   module-level `profile` reste l'objet chargé AVANT la partie. `initBadgesSystem()`
   ayant déjà tourné une fois au tout premier chargement, rien ne le relance sur un
   retour bfcache — le badge fraîchement mérité reste invisible jusqu'au prochain
   rechargement complet **fortuit** de la page (typiquement : l'utilisateur, frustré,
   rejoue "pour être sûr", puis retape l'URL ou fait F5 au lieu de "précédent" — d'où
   l'illusion qu'il fallait rejouer). Fix : listener `pageshow`, si `event.persisted`
   relance `_fullCloudSync()` (qui inclut déjà `forceCheckBadges()` depuis le fix de
   la veille).
2. **Vrai faux-positif de badge, trouvé en creusant celui-ci en particulier** :
   `personaeMode/modePersonae.js` détectait la persona de Futaba via
   `["Necronomicon", "Prometheus"].includes(target.persona)` — mais "Prometheus" est
   le nom de la persona de **2 personnages différents** dans
   `personaeCharacters.js` (Futaba, P5/P5R, ligne ~512 ; Baofu, P2EP, ligne ~874).
   Gagner sur Baofu déclenchait `foundFutabaPersona = true` par erreur (unlock trop
   permissif, pas trop strict — n'explique pas le symptôme "il a fallu rejouer", mais
   bug réel trouvé au passage). Fix : vérifie aussi `target.user.includes("Futaba
   Sakura")`, pas seulement le nom de la persona.

### Angle mort restant
Vérifié que "Prometheus" est la SEULE collision de nom parmi les personas utilisées
par des conditions de badges à flags (`grep -c` sur chaque nom dans
`personaeCharacters.js` — tous les autres n'apparaissent qu'une fois). Si un futur
personnage réutilise un nom de persona déjà utilisé dans une condition de badge à
flags, même angle mort à vérifier au cas par cas — pas de garde générique ajoutée
(le système `condition_type='manual'` reste entièrement à base de flags ad hoc côté
client, cf. TEST_PLAN_DEV.md §2.11 sur les badges "à flags" laissés tels quels).

---

## 2026-07-17 — feat(auth): case "Remember me" réelle — décrite dans TEST_PLAN.md mais jamais codée

Hamza : "vérifie qu'on n'a pas un truc noté dans le plan de test mais pas codé".
Trouvé : `TEST_PLAN.md` §4.4 documentait un test pour une case "Remember me" "si elle
existe" — elle n'existait nulle part (`grep -ri remember js/auth.js` + tout le HTML :
0 résultat). `api/auth/login.php` posait pourtant déjà le cookie `remember_me` +
`remember_me_hash` en base à **chaque** connexion, sans condition — alors que
`lang/*.json` (`auth.cookies_body`, texte RGPD) décrivait déjà ce cookie comme
"optional... if you choose to stay logged in". Fonctionnalité à moitié construite :
le texte légal promettait un choix qui n'existait pas côté UI.

Fix : case à cocher réelle (`#loginRememberMe` dans `profile.html`, cochée par
défaut — comportement historique préservé si l'utilisateur n'y touche pas), envoyée
par `js/auth.js` en `remember_me` au login. `login.php` ne pose le cookie que si
`remember_me` est truthy (absent → `true`, compat clients pas encore à jour).
Décochée : révoque explicitement tout `remember_me_hash` déjà en base + expire le
cookie côté navigateur — sinon décocher n'aurait aucun effet sur un appareil déjà
"mémorisé" par une connexion précédente. Clé i18n `auth.remember_me` ajoutée aux
5 langues. `TEST_PLAN.md` §4.4 mis à jour pour tester coché **et** décoché.

---

## 2026-07-17 — fix(classic,badges): victoryBox persiste après reset + badge giveups_total jamais re-vérifié après cloud sync

Léo (test §22) : "j'ai fait reset en Classic mode mais l'image de victoire est
restée à l'écran" + "j'ai pas réussi à débloquer ace_defective malgré 10+ give-ups".

**Classic mode** : `resetButton` (classiqueMode/modeClassique.js) remettait à zéro
`attempts`/`history`/tous les champs d'input, mais oubliait de cacher
`#victoryBox` — contrairement aux 4 autres modes concernés (allOutAttack, personae,
music, emoji) qui le font tous en tête de leur handler de reset, juste après
`gameOver = false; attempts = 0;`. Vérifié via grep croisé sur les 5 fichiers de
mode — silhouetteMode utilise un mécanisme différent (élément `.victory-box` créé/
détruit dynamiquement, déjà correctement nettoyé dans son `resetGame()`), donc pas
concerné. Fix : ajout de `document.getElementById("victoryBox").style.display =
"none";` au même endroit que les autres modes.

**Badge ace_defective (`giveups_total >= 10`)** : bug d'ordre d'exécution, pas de
logique de comptage — `api/lib/game_session.php` incrémente bien `user_stats.giveups`
à chaque give-up, et `js/profileStats.js`/`js/cloud-sync.js` répercutent
correctement ce total dans `profile.stats.giveups` (local à chaque give-up, cloud
au pull). Le vrai trou : `initBadgesSystem()` (donc `checkAndUnlockBadges()`) est
appelé de façon **synchrone** au chargement de `profile-page.js`, avant que
`pullProfileFromCloud()` (async, dans `_fullCloudSync()`) ait eu la moindre chance
de résoudre et d'écraser `profile.stats` avec le total serveur autoritatif. Tout
badge dont la condition dépend d'un stat agrégé multi-device/multi-session
(`giveups_total`, mais potentiellement d'autres) n'est donc testé qu'une seule
fois, contre un profil local possiblement périmé — et jamais re-testé une fois
les données fraîches arrivées. Classique cas "État dérivé" (CLAUDE.md §13) :
tracer les écritures ne suffit pas, il fallait aussi tracer *quand* la lecture
(le check) a lieu par rapport à ces écritures.

Fix : appel de `forceCheckBadges(profile, saveProfileAndSyncBadges)` dans
`_fullCloudSync()`, juste après `pullProfileFromCloud()`/`_applyCloudToUI()` et
avant `syncBadgesWithBackend()` (pour que tout badge fraîchement débloqué soit
inclus dans le push local→cloud qui suit).

### Angle mort restant
`initBadgesSystem()` (1er check, synchrone) et ce nouveau `forceCheckBadges()`
(2e check, post-sync) tournent tous les deux à chaque chargement de page profil —
redondant mais inoffensif (`checkAndUnlockBadges` ignore déjà les badges présents
dans `profile.badges`). Pas de fix nécessaire, juste noté pour éviter la surprise
en lisant les logs console (`🎉 Badge unlocked` peut apparaître différé de
quelques centaines de ms après le premier rendu de page).

---

## 2026-07-17 — fix(profile): code ami jamais affiché sur son propre profil

Léo : "on peut toujours pas voir notre code ami" — signalé pendant le test de §9
(système social), qui suppose que le code ami est visible sur son propre profil
(explicitement documenté ainsi en tête de §9 dans `TEST_PLAN.md`).

Confirmé un vrai trou, pas une question de config : le backend renvoie bien
`friend_code` (`api/auth/me.php`, `api/user/index.php`), et `profile/profile-view.js`
l'affiche déjà correctement pour un profil **public** (`.profile-friend-code`, classe
CSS déjà stylée dans `profile-page.css`). Mais `profile/profile-page.js` (sa propre
page de profil, connecté) ne l'a jamais câblé — fonctionnalité à moitié construite.

Fix : nouvelle fonction `_renderFriendCode()` dans `profile-page.js`, même pattern que
`profile-view.js` (élément `.profile-friend-code` sous le pseudo dans
`.avatar-card-info`). Idempotente (créée une fois, réutilisée) et appelée dans
`_fullCloudSync()` (login/auth-ready) + au logout (retire l'élément, `window._currentUser`
déjà à `null` à ce moment).

Non testé unitairement — même choix que pour `js/auth.js` (orchestration DOM, cf.
convention de ce projet) ; à vérifier manuellement/E2E.

---

## 2026-07-17 — fix(404): chemins relatifs cassés + doc test plan codes événement

Trouvé en creusant les retours de Léo sur les PR #25-28 fraîchement testées.

### `pages/404.html` — chemins relatifs résolus par rapport à la mauvaise URL

`.htaccess` sert cette page via `ErrorDocument 404 /pages/404.html` (chemin absolu),
mais Apache ne change pas l'URL du navigateur pour un ErrorDocument — elle reste celle
qui a cassé. Tous les chemins **relatifs** de la page (`../css/*.css`, `../img/*.gif`,
imports `../js/*.js`, `../sw.js` pour l'enregistrement du Service Worker,
`../index.html` sur le bouton retour) se résolvaient donc par rapport à l'URL cassée,
pas par rapport à `pages/` — comportement incohérent selon la profondeur de l'URL
d'origine (peut fonctionner par coïncidence pour une URL cassée à la racine, casser pour
une URL cassée plus profonde). Correspond exactement au signalement de Léo : le bouton
"Return to PersonaDLE" ne ramenait pas au bon endroit.

Fix : tous les chemins passés en absolu (`/css/...`, `/img/...`, `/js/...`, `/sw.js`,
`/index.html`). Fonctionne pour Docker local et Hostinger (tous deux servis à la racine
du domaine) — angle mort connu et accepté : ne couvre pas un déploiement Apache local
hors-Docker servi sous un sous-chemin `/personadle/` (cf. CLAUDE.md §3), cas de moins en
moins pertinent vu que `make up` est le flux documenté.

### `TEST_PLAN.md` §8.3 — instruction obsolète (champ "quota" inexistant)

La section demandait de renseigner un "quota" à la création d'un code événement — ce
champ n'existe ni dans `admin/event-codes.js` ni dans la table `event_codes`. Réécrite
pour matcher le vrai formulaire (Code, Badge ID = slug exact, Description, Code
permanent, Date début/fin). Ajout d'une note de diagnostic (onglet Network → réponse de
`redeem`) pour la prochaine fois qu'un testeur rapporte "le code n'existe pas" sans plus
de détail — cause exacte encore non identifiée au moment de ce commit (piste : Léo à
recontacter avec la réponse HTTP précise).

### Non résolu / à trancher

- **Popup streak recovery** : `#sr-backdrop` ferme le popup au moindre clic, sans la
  garde anti-clic-accidentel ajoutée à la modale login/register (PR #26,
  `_dragStartedInside`). Rien n'est perdu définitivement (le bouton profil reste
  disponible ensuite), mais correspond au "despawn" rapporté par Léo. Pas corrigé ici —
  "cliquer dehors pour fermer" peut être un choix voulu, à confirmer avant de toucher au
  comportement.
- **Panel admin mobile** : code du tiroir (`admin.css`/`admin.js`) relu, structurellement
  correct (position fixed, transform, overlay, z-index). Signalé par Léo comme "pas
  optimisé" mais pas de bug identifié dans le code — à reconfirmer s'il a bien utilisé le
  bouton ☰.

## 2026-07-17 — fix(css): `.badge-notification` déborde sur petits viewports

`css/global.css` : `min-width: 300px; max-width: 360px;` faisait déborder la
notification de déblocage de badge à gauche sur viewports très étroits
(iPhone SE 1ère gen : 320 px — bord gauche à −60 px, hors écran).
Remplacé par `min(300px, calc(100vw - 40px))` / `min(360px, calc(100vw - 40px))`
pour que la notification reste toujours dans le viewport avec 20 px de marge
de chaque côté.

Note : la PR d'origine (#28) proposait aussi un fix `_addAdminNavItem`
(profondeur `/profile/friends/`, `/profile/leaderboard/`) et une correction
`lang/README.md` (967 → 968 clés) — les deux étaient déjà appliqués sur
`develop` au moment du merge (PR #26 et le fix `docs:fix` de PR #27,
respectivement) ; la branche #28 avait divergé avant ces merges. Rebasée
sans conflit fonctionnel, seul le fix CSS restait réellement nouveau.

---

## 2026-07-16 — fix: streak recovery visuel + challenges classiques + console + admin responsive

### Streak recovery (bug 14.2)

- **`profile/profile.html`** : ajout `<div id="streakRecoveryPrompt" class="srp hidden">` entre `statsContainer` et `modeStatsContainer`.
- **`js/streak-recovery.js`** : export de `getPreviousStreak()` — retourne `previousStreak` stocké en localStorage (0 si absent).
- **`profile/profile-page.js`** : quand `streak === 0 && canRecover() && previousStreak > 1`, injecte un bouton proéminent "❄️ Rallumer — 0 → N jours" qui déclenche `showStreakRecoveryMenu(prev)`. Animation ❄️ gelée ajoutée sur la carte streak tier-0 (`streakIceGlow`, `flakeSpin`).
- **`profile/profile-page.css`** : `.stat-streak-t0` (fond bleu glacier, border translucide, glow cyclique), `.streak-side-flake` (rotation infinie), `.srp-btn` (gradient bleu-cyan, hover subtil).
- **`lang/{en,fr,es,de,it}.json`** : clé `streak_recovery.profile_btn` ajoutée dans les 5 langues.

### Challenges classiques (bug classique)

- **`classiqueMode/modeClassique.js` l.558** : `textbar.value = ""` à l'init — empêche le bfcache de restaurer la saisie précédente de Player A quand Player B ouvre le même classiqueMode.html depuis une notification.
- **`classiqueMode/modeClassique.js` l.753-755** : guard `if (localStorage.getItem("activeChallenge")) return;` dans le callback de `checkResetOnLoad`. Sans ce guard, un Player B n'ayant pas encore joué aujourd'hui déclenchait `resetButton.click()` (reset aléatoire via `Math.random()`) qui écrasait la cible quotidienne déterministe posée par `getDailyTarget` — entraînant Igor comme cible sur les pools filtrés minuscules.

### Console (bug 6.3)

- **`profile/badges/badgesManager.js` l.421** : suppression du `console.log("🔍 Checking badges...")` appelé à chaque `DOMContentLoaded` (toutes les pages chargent l'index, qui appelle `checkBadgesAfterGame` en permanence).

### Admin responsive (bug 11.5)

- **`admin/admin.css`** breakpoint `max-width: 480px` : `.admin-header-right` passe en `overflow-x: auto; flex-shrink: 1; min-width: 0` avec enfants `flex-shrink: 0`. Permet de scroller la barre des boutons (Codes, Logs, Audit, RGPD, Rate Limits) sans les cacher — les fonctions restent accessibles sur mobile sans régression.

---

## 2026-07-16 — fix: onglet Admin nav + stats profil i18n + drag-to-close modale

Trois bugs isolés corrigés dans la même PR.

### Onglet Admin manquant sur friends/leaderboard (`js/auth.js`, `js/bottomNav.js`)

`personadle:auth-ready` n'était jamais dispatché : seul `personadle:auth-login` existait,
déclenché uniquement lors d'une connexion manuelle. Sur les pages friends et leaderboard,
`initBottomNav()` est appelé avant que la promesse `initAuth()` soit résolue — le check
synchrone `window._currentUser?.is_admin` échoue, et le listener `personadle:auth-ready`
ne se déclenchait jamais → l'onglet Admin n'apparaissait pas.

Fix : dispatch `personadle:auth-ready` dans le bloc `finally` d'`initAuth()`, après
`window._authResolved = true`.

Second bug associé : le calcul du href admin dans `_addAdminNavItem()` ne distinguait
pas les pages 2 niveaux de profondeur (`/profile/friends/`, `/profile/leaderboard/`)
— elles recevaient `../admin/` au lieu de `../../admin/`. Corrigé en réutilisant
le pattern `isDeepSubpath` déjà présent dans `buildHrefs()`.

### Stats profil en anglais quelle que soit la langue (`profile/profile-page.js`)

Les labels des stats (`renderStats`) et des en-têtes du tableau de modes
(`renderModeStats`) étaient des chaînes hardcodées en anglais, ignorant les clés i18n
qui existent pourtant dans `lang/*.json` :
`profile.stat_wins_label`, `stat_giveups_label`, `stat_games_label`,
`stat_best_streak_label`, `stat_time_label`, `stat_first_played_label`,
`stat_fav_mode_label`, `stat_current_streak_label`, `mode_col_mode`, `mode_col_games`.

Fix : remplacement par `tf()`. Ajout de `renderModeStats()` dans le listener
`personadle:i18n-ready` (seul `renderStats()` y était, le tableau de modes restait
donc en anglais même après changement de langue).

### Drag text → fermeture modale compte (`js/auth.js`)

Si l'utilisateur sélectionnait du texte dans le formulaire et relâchait la souris
sur le backdrop, le navigateur générait un `click` sur le backdrop (cible commune
du mousedown/mouseup) → fermeture involontaire de la modale.

Fix : flag `_dragStartedInside` posé sur `mousedown`. Le handler `click` ignore la
fermeture si le drag a commencé à l'intérieur du contenu de la modale.

---

## 2026-07-16 — feat: nouveau logo + avatars Theodore + correctifs UI/perf

### Logo

`img/New_Logo_PersonaDLE.png` remplace `img/Logo_PersonaDLE.png` dans tous les
points d'entrée : `index.html` (src + og:image), les 6 pages mode, `README.md`.
L'ancien fichier reste présent pour l'affichage avant/après dans `PersonaDLE_Update.html`.

### Avatars Theodore (P3 Portable)

`theodore.jpeg`, `theodore2-5.jpeg` ajoutés dans `profile/avatars_data.js` (groupe P3),
juste après Elisabeth/Elisabeth2. `img/avatar/` contient déjà les fichiers — le
user les a déposés manuellement.

### Fix gitignore — illustrations docs

`.gitignore` : ajout de règles `!` pour `*.png`, `*.jpg`, `*.jpeg`, `*.gif`,
`*.webp`, `*.pdf`, `note_ajout.md`, `PersonaDLE_Update.md` dans
`PersonaDLE_Update_Documentation/PersonaDLE 2.0/`. 13 fichiers de doc précédemment
exclus sont maintenant versionnés.

### Fix "Mot de passe oublié?" — ressemble à un lien

`.auth-forgot-link` dans `profile/profile-page.css` : suppression de
`text-decoration: underline`, couleur neutre muted au lieu de la couleur accent
rouge. Hover subtil au lieu du `filter: brightness`. Aucun changement fonctionnel.

### Fix AOA lag — CDN CloudFlare R2 exclu du SW

`sw.js` : le CDN R2 (`pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev`) était capturé
par la stratégie `cacheFirst` des images, créant des réponses opaques stale qui
causaient le lag du mode All-Out Attack (Ctrl+Shift+R le contournait). Ajout d'un
cas `network-only` avant `cacheFirst`. CACHE_VERSION bumped `v74 → v75`.

### Grille index — 2 colonnes + tailles ajustées

`css/index.css` :

- `#gameModeSelector` : grille 2×3 sur desktop (>768px). Colonne gauche :
  Classique, Emoji, All-Out Attack. Colonne droite : Silhouette, Personae, Music.
  `grid-template-columns: repeat(2, 1fr)`, max-width 900px.
- `.gamemode-title` : font-size 36px → 27px (proportionnel 75 %), responsive
  adapté (22px → 16px sur tablette, 16px sur mobile).

### Fix background 404

`pages/404.html` : redesign du background — gradient diagonal plus marqué,
motif de lignes en relief, suppression des scanlines plates au profit d'un
effet velvet room plus riche visuellement.

---

## 2026-07-16 — fix(build): Makefile portable Windows natif (sans Git Bash/WSL)

Trouvé en aidant un testeur (Windows, PowerShell natif) : `make test-php`
échouait avec `'test' n'est pas reconnu` / `'wget' n'est pas reconnu`.

`SHELL := /bin/bash` ne résout à rien sur Windows natif (le chemin littéral
`/bin/bash` n'existe pas hors WSL) — Make retombe silencieusement sur
`cmd.exe`, qui n'a ni `test`, ni `wget`, ni `grep`/`sort`/`awk`, ni `rm`.
3 cibles en dépendaient :

- `$(PHPUNIT_PHAR)` (`test -f || wget`) → `scripts/download_phpunit.js`
  (télécharge via le module `https` de Node, suit les redirections, no-op si
  le fichier existe déjà)
- `help` (`grep | sort | awk`) → `scripts/make_help.js` (parse le Makefile
  lui-même)
- `clean` (`rm -f`/`rm -rf`) → `scripts/clean_artifacts.js`
  (`fs.rmSync(..., { recursive: true, force: true })`)

Node est déjà une dépendance obligatoire du projet (Vitest) donc ces 3
scripts tournent identiquement sur Windows/Mac/Linux/CI, sans dépendre du
shell que `make` choisit d'invoquer. `SHELL := /bin/bash` retiré (plus aucune
cible n'a besoin de syntaxe bash — `&&`/`||`/sous-shells) ; toutes les autres
cibles (`up`/`down`/`db-import`…) n'appelaient déjà que des binaires
multiplateformes (`npm`, `php`, `docker compose`) et n'ont pas changé.

### Angle mort documenté

Le téléchargement réel de `phpunit.phar` n'a pas pu être testé de bout en
bout dans cette session (proxy sandbox bloquant `phar.phpunit.de`, cf.
`/__agentproxy/status` → `connect_rejected`) — vérifié à la place : usage
sans argument, no-op si le fichier existe déjà, `make help`/`make clean`
réellement exécutés via `make` (pas juste les scripts isolés), `php -l`/
`npm run lint` propres. Le téléchargement effectif reste à confirmer par un
contributeur (CI ou local) non bloqué par ce proxy.

### `test-php` déplacé vers Docker (suite du même fil)

Le même testeur n'avait pas PHP installé nativement sur Windows (seulement
dans le conteneur `personadle_php`, monté sur `.:/var/www/html`) —
`php phpunit.phar` échouait avec `php n'est pas reconnu`. Plutôt que
d'exiger un PHP natif juste pour lancer les tests (jamais documenté comme
prérequis), `test-php` tourne maintenant dans le conteneur :
`$(DC) exec -T php php $(PHPUNIT_PHAR)` au lieu de `php $(PHPUNIT_PHAR)`.
Nécessite `make up` (déjà un prérequis documenté dans `CONTRIBUTING.md`).
Confirmé fonctionnel en conditions réelles côté testeur : 175 tests, 317
assertions, 71 skipped (attendu — tests d'intégration BDD spécifiques).

`CONTRIBUTING.md` mis à jour en conséquence (retire la mention implicite
d'un PHP natif requis).

## 2026-07-16 — fix(api): rateLimit() fail-open + erreur JS brute côté auth

Bug remonté par un testeur (compte local, schéma Docker périmé) : inscription
impossible, message d'erreur JS interne affiché à l'utilisateur.

- **`js/auth.js`** (PR #22) : `setupLoginForm()`/`setupRegisterForm()`
  affichaient `err.message` brut pour toute erreur non reconnue par
  `resolveLoginError`/`resolveRegisterError` — y compris une `TypeError` JS
  interne (`const { user } = await api.auth.register(...)` avec `user` `null`
  quand `apiCall()` reçoit un statut succès mais un corps non-JSON). Fix :
  n'afficher le message brut que si `err instanceof ApiError`, sinon message
  générique traduit.
- **`api/bootstrap.php` — `rateLimit()`** : cause racine trouvée côté serveur
  du testeur — sa table `rate_limits` n'existait pas (volume Docker créé
  avant l'ajout de cette table à `sql/bdd_mysql.sql`, jamais recréé depuis).
  `rateLimit()` n'avait aucune gestion d'erreur et est appelée en tout premier
  sur chaque endpoint protégé (login, register, sessions, messages…), avant
  tout `try/catch` de l'endpoint lui-même : une `PDOException` (table
  manquante, coupure BDD momentanée) faisait planter tout l'endpoint avec une
  fatal error PHP brute — renvoyée en HTTP 200 par Apache/mod_php (pas 500),
  ce qui explique le corps non-JSON reçu côté frontend. Fix : `rateLimit()`
  attrape désormais l'exception, journalise (`error_log`), et **fail open**
  (laisse passer la requête plutôt que de planter l'endpoint). Compromis
  volontaire : en cas d'indisponibilité de `rate_limits`, le throttling est
  temporairement inactif plutôt que de bloquer toute l'API — accepté car le
  scénario déclencheur (table manquante/BDD indisponible) est déjà couvert
  côté disponibilité générale par `pdo()` (503 sur échec de connexion), et le
  risque d'abus pendant cette fenêtre est jugé plus faible que le risque de
  panne totale de l'auth pour un incident BDD ponctuel.

### Angle mort documenté

Aucun test unitaire dédié à `rateLimit()` (testé indirectement via
`DatabaseIntegrationTest.php`, qui nécessite Docker/MariaDB — non exécutable
en session sandboxée, comme les autres tests d'intégration PHP de ce projet).
Vérifié : `php -l` sur tout `api/`, `npm test` (482/482), et
`DatabaseIntegrationTest::testDatabaseSchema` couvre déjà la présence de
`rate_limits` (« schéma Docker périmé ? ») — confirmera en CI que ce fix ne
casse rien côté intégration BDD.

## 2026-07-12 — fix: régression port E2E (8090) + avatarSrc stale après cloud sync

Corrections suite à une review de la PR `feat/ui-pages-joker-profile-kotone`.

- **Port E2E** : `playwright.config.js` et les specs `admin.spec.js`,
  `admin-extended.spec.js`, `api.spec.js`, `social-link.spec.js` avaient basculé
  le défaut de `8080` vers `8090`, exactement l'inverse du fix déjà documenté le
  2026-07-04 (`docker-compose.yml`/`.env.example` exposent `8080` par défaut).
  La CI restait verte car `PLAYWRIGHT_BASE_URL` y est fixé explicitement — le
  cassage n'était visible qu'en local (`make up` + `npm run test:e2e` sans
  variable d'env). Remis à `8080` partout (config, 4 specs, `TEST_PLAN.md`,
  `TEST_PLAN_DEV.md`).
- **`profile.avatarSrc` stale après sync cloud** : `js/cloud-sync.js` écrit
  `p.avatar` depuis `avatar_data` mais ne touchait jamais `p.avatarSrc`. Or
  `profile/titles-ui.js` donne la priorité à `avatarSrc` sur `avatar` pour la
  condition du titre "Looking Cool" (déblocage via avatar Joker/Ren, ajouté
  dans cette même PR) — un changement d'avatar légitime via cloud pull sur un
  autre appareil laissait `avatarSrc` pointer sur l'ancien avatar, gardant le
  titre affiché comme débloqué à tort. Fix : `delete p.avatarSrc` dans
  `pullProfileFromCloud()` dès que `avatar_data` est mis à jour.

---

## 2026-07-11 — Migrations BDD Hostinger m000→m022 + audit schéma

Application de toutes les migrations en attente sur la base Hostinger
(MariaDB 11.8.8) et alignement du schéma de production.

### Migrations appliquées

- Script consolidé idempotent `sql/migration_hostinger_full.sql` (m000→m022) :
  tables `badges`, `wallpapers`, `event_codes`, `rate_limits`, `error_log`,
  `admin_audit_log`, `social_link_ranks`, `social_links`, `social_link_badge_configs`,
  `social_link_interactions`, `social_link_rankup_notifs`, `leaderboard_cache` ;
  colonnes ajoutées : `users.global_streak/record/date`, `users.reset_token_*`,
  `users.streak_recovered_at`, `badges.condition_*`, `wallpapers.condition_*`,
  `titles.condition_mode` ; slugs de titres normalisés.

### Correctifs appliqués (spécifiques Hostinger)

- `friendships.seen_at` : ajouté sans `AFTER accepted_at` (colonne inexistante
  sur Hostinger — schema Hostinger n'a jamais eu `accepted_at`).
- `titles.condition_mode/type/value` : colonnes manquantes sur Hostinger
  (créées localement dans `bdd_mysql.sql` sans migration correspondante).
- `social_link_rankup_notifs` FK : `recipient_id`/`partner_id` étaient `INT(11)`
  (signé) alors que `users.id` est `BIGINT(20) UNSIGNED` → corrigé, FK ajoutées.
- `ADD CONSTRAINT IF NOT EXISTS` : syntaxe non supportée sur MariaDB 11.8 pour
  les FK → remplacé par pattern `PREPARE/EXECUTE` conditionnel.
- `leaderboard_cache.uq_leaderboard` : déjà à 5 colonnes (metric inclus),
  aucune action requise.

### Audit schéma (hostinger vs local)

Export `sql/hostinger_current_schema.sql` (snapshot 2026-07-11). Diffs connus
sans impact fonctionnel :

- `friendships` : `accepted_at` existe localement, pas sur Hostinger.
- `titles`/`social_link_ranks` : colonnes `name_jp`, `description_*` localement
  uniquement (pas de langue JP en prod).
- `user_titles`/`user_stats`/`badges_unlocked` : PK avec `id` auto-increment
  local, PK composite sur Hostinger.
- `game_sessions.result` : `VARCHAR` local vs `ENUM` Hostinger.
- Types `ENUM` vs `VARCHAR` sur `rarity` (titles/badges) — valeurs identiques.

### Correction post-review (2026-07-12)

Le script `migration_hostinger_full.sql` committé ne reflétait pas fidèlement les
correctifs listés ci-dessus (probablement appliqués à la main sur Hostinger sans
être reportés dans le fichier). Corrigé :

- `friendships.seen_at` : `AFTER accepted_at` remplacé par `AFTER updated_at`
  (le script plantait sur une base fraîche, `accepted_at` n'existant pas).
- `social_link_rankup_notifs.recipient_id/partner_id` : `MODIFY COLUMN` vers
  `BIGINT UNSIGNED` ajouté avant les `ADD CONSTRAINT` (m015) — la FK vers
  `users.id` échouait sinon (type mismatch, la colonne restait `INT` depuis m009).
- `ADD CONSTRAINT IF NOT EXISTS` (FK) réellement remplacé par le pattern
  `PREPARE/EXECUTE` conditionnel (il était encore utilisé tel quel en m015).
- `social_link_rankup_notifs.is_badge_prompt` : colonne présente sur Hostinger
  mais absente du script — ajoutée (`ADD COLUMN IF NOT EXISTS`).
- Rappel de sauvegarde ajouté avant le `DROP TABLE IF EXISTS social_link_badges`
  (destructif, aucun backup mentionné auparavant).

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

## 2026-07-05 — Anti-triche daily target (phase 1), god files, couverture E2E admin, a11y

Suite du menu d'améliorations issu de la revue de projet du 2026-07-04/05 (`AMELIORATIONS.md`,
`ROADMAP.md`). Un point du menu (durcissement des conditions de badges "à flags") a été
explicitement laissé de côté à la demande du dev.

### ⚠️ Anti-triche `api/sessions.php` — phase 1 (détection, pas de rejet)

L'investigation a révélé que le point ROADMAP était mal cadré : **aucune table
`daily_targets` n'existe** en BDD (ni schéma ni migrations), contrairement à ce
qu'affirmaient ROADMAP.md et ce fichier. Chacun des 6 modes calcule sa cible via un
algorithme seedé différent (`getDailyTarget()` dans `js/gameCore.js`, hash FNV-1a
32 bits sur `seedId|date|mode` modulo la taille du pool), avec en plus un repli
conditionnel sur le filtre opus actif pour AllOutAttack et Personae — donc pas une
simple lecture de table à ajouter.

- `scripts/export-daily-pools.js` — exporte les pools JS (source de vérité :
  `characters_clean.js`, `silhouetteCharacters.js`, `songs.js`, `personas_allOut.js`
  + `aoaCharacters.js`, `personaeCharacters.js`) vers `api/data/daily_pools.json`,
  lisible par PHP. `npm run pools:check`/`pools:build`, câblé en CI et dans le hook
  pre-commit (même pattern que `check-doc-numbers.js`).
- `api/lib/daily_target.php` — porte l'algorithme FNV-1a et les deux replis
  conditionnels (AllOutAttack, Personae) en PHP. Le hash n'opère que sur de l'ASCII
  (seed numérique, date ISO, nom de mode ASCII), donc `ord()` par octet est
  équivalent à `charCodeAt()` par unité UTF-16 côté JS — vérifié par comparaison
  croisée directe des deux implémentations sous Node/PHP sur des dizaines de
  combinaisons seed/date/mode/filtre, y compris les cas qui déclenchent réellement
  le repli filtré.
- `api/sessions.php` recalcule la cible attendue et logue un écart (`error_log`,
  niveau `warning`, source `anti_cheat`) **sans rejeter la requête**. Décision
  volontaire : impossible de garantir zéro faux positif sans testing en conditions
  réelles de prod, et un rejet à tort bloquerait des victoires légitimes pour tous
  les joueurs. Même logique que le critère "10 runs verts" avant de rendre le job
  E2E bloquant (`tests-e2e/README.md`). Le rejet strict (phase 2) est documenté
  dans ROADMAP.md comme prochaine étape, conditionnée à zéro anomalie observée.
- **Prérequis découvert en cours de route** : `AllOutAttack`/`Personae`
  n'envoyaient jamais leur filtre opus actif dans `active_filters` du body
  `POST /api/sessions` (toujours `[]`, alors que Classic le faisait déjà) — rendant
  la validation de leur repli filtré impossible côté serveur. Corrigé
  (`allOutAttackMode/modeAllOutAttack.js`, `personaeMode/modePersonae.js`) pour
  qu'ils envoient `activeOpusFilters`/`activeFilters` comme Classic.
- `tests/php/DailyTargetTest.php` — couvre le hash, les 6 modes, et les deux
  replis filtrés sur des cas dont le déclenchement réel a été vérifié manuellement.

### refactor(admin): `admin/admin.js` scindé en 8 modules ES6

1850 → ~1155 lignes. Comportement strictement inchangé (déplacement mécanique).
5 panneaux totalement autonomes (état/DOM propres, zéro couplage avec l'utilisateur
sélectionné) extraits dans leur propre fichier : `event-codes.js`, `error-logs.js`,
`audit-log.js`, `deletion-requests.js`, `rate-limits.js`. Utilitaires partagés dans
`admin-api.js` (client REST + toast + escHtml + getTypeLabel) et `catalogs.js`
(chargement badges/wallpapers/titres). La liste utilisateurs + les 7 onglets de
détail utilisateur restent dans `admin.js` : état fortement couplé
(`_selectedUser`/`_userDetail`/pending gifts), séparer aurait un risque de
régression plus élevé pour un gain plus faible — reporté plutôt que scindé à
l'aveugle (pas de Docker disponible pour vérifier en navigateur).

`admin.js` n'avait jusqu'ici **aucune** couverture Vitest. `tests/adminSmoke.test.js`
comble ce trou : import du graphe de 8 modules, bootstrap complet (auth → catalogues
→ liste utilisateurs), clic sur les 5 boutons de panneaux extraits — pensé pour
attraper la classe de bug la plus probable d'un découpage mécanique (export
manquant, variable renommée dans un seul des fichiers).

`profile/profile-page.js` (1194 lignes) n'a **pas** été re-découpé : en le relisant,
il a déjà 9 modules extraits d'un travail antérieur (badges/, wallpapers-ui.js,
titles-ui.js, song-player.js, share-card.js, theme.js, profile-format.js,
formatPlayTime.js, avatars_data.js) ; les lignes restantes sont la logique de
contrôleur de page, fortement couplée à un objet `profile` partagé et des
closures — un découpage supplémentaire aurait un risque réel pour un gain marginal.

### test(e2e): couverture des endpoints admin restants

`event_codes`, `error_logs`, `deletion_requests`, `social_links`, `user_badges`,
`user_titles`, `user_wallpapers`, `user_stats`, `user_friends` n'avaient jusqu'ici
aucun test (ni Vitest, ni E2E, ni PHPUnit — seuls `php -l`/PHPStan les vérifiaient).
`tests-e2e/admin-extended.spec.js` (24 tests) complète `admin.spec.js` : 403 pour un
non-admin sur chaque route, cycles créer/lister/modifier/supprimer pour les codes
événement et les dons badge/titre/wallpaper (catalogue lu dynamiquement via
`/api/titles`/`/api/wallpapers` plutôt que des IDs figés en dur), validations
400/404.

### ⚠️ fix(a11y): `prefers-reduced-motion` pour les boucles canvas JS

`css/global.css` neutralise déjà toutes les animations/transitions CSS pour
`prefers-reduced-motion: reduce`, mais deux effets tournent en JS pur via une
boucle `requestAnimationFrame` qu'une media query CSS ne peut jamais arrêter : le
bruit TV statique (`js/tv-friend-anim.js`) et les confettis dorés du don admin
(`js/divine-gift.js`). Les deux sautent maintenant leur boucle si
`matchMedia('(prefers-reduced-motion: reduce)').matches`.

Audit complémentaire sans changement de code (décisions de design à trancher
séparément, détaillées dans `AMELIORATIONS.md` §9) : `streak-recovery.js` est déjà
entièrement i18n (le point ROADMAP/AMELIORATIONS qui affirmait le contraire était
faux, corrigé) ; `--color-accent` (#e63946) est sous le seuil AA texte normal
(4.17:1 sur blanc) sans qu'une seule teinte de repli satisfasse proprement les deux
thèmes clair/sombre.

### Vérifications communes à ce lot

`npx vitest run` (475/475), `npm run lint` (0 erreur), `npm run pools:check`,
`npm run docs:check`, `php -l` sur tous les fichiers PHP touchés, et pour
`daily_target.php` une comparaison croisée directe Node/PHP (voir plus haut) —
seule vérification possible sans Docker/MariaDB dans ce sandbox. Les nouveaux
tests E2E (`admin-extended.spec.js`) et PHPUnit (`DailyTargetTest.php`) n'ont pas
pu être exécutés ici (nécessitent respectivement `make up` et un environnement
PHPUnit) — à confirmer via la CI réelle.

### Suite à la review de la PR #13

- `admin/admin-api.js::escHtml` corrigeait `String(str || "")` — un champ numérique valant
  légitimement 0 s'affichait vide au lieu de "0". Corrigé en `String(str ?? "")`, propagé
  automatiquement aux 8 modules admin qui l'importent.
- Pagination (`renderXPagination`) et bandeaux "Chargement…"/erreur, copiés-collés à l'identique
  dans `event-codes.js`/`error-logs.js`/`audit-log.js`/`deletion-requests.js`/`rate-limits.js`,
  factorisés en `renderPagination()`/`renderLoading()`/`renderError()` dans `admin-api.js`.
  Vérifié par `tests/adminSmoke.test.js` (clique déjà sur les 5 panneaux) + relecture.
- `tests/php/DailyTargetTest.php` ne cross-vérifiait la valeur de hash que pour 3 modes sur 6
  (Classic/Personae/Music) — Emoji/Silhouette/AllOutAttack n'avaient qu'un test de bornes.
  Ajouté les 3 valeurs manquantes (cross-check Node/PHP, même méthode).
- **Limitation documentée, pas corrigée** : pour AllOutAttack/Personae, `$activeFilters` est
  accepté tel que soumis par le client sans être corrélé à un état côté serveur — un client peut
  soumettre n'importe quel sous-ensemble de codes opus pour faire correspondre le recalcul
  serveur au nom qu'il veut faire valider. Sans conséquence en phase 1 (détection), mais à
  corriger (filtre stocké côté serveur) avant d'activer le rejet strict pour ces 2 modes
  spécifiquement — documenté dans `api/lib/daily_target.php` et `ROADMAP.md`.
- `js/tv-friend-anim.js` et `js/divine-gift.js` recopiaient le même check
  `matchMedia("(prefers-reduced-motion: reduce)")` — extrait en `prefersReducedMotion()`
  (`js/gameCore.js`), conforme à CLAUDE.md §8 (réutiliser gameCore.js pour ce type d'utilitaire).
- `CLAUDE.md` §9 pointait vers un `PersonaDLE_Update.md` qui n'existe pas pour la v2.0 (seulement
  pour l'archive v1.1) — corrigé pour refléter la pratique réelle : `DEV_CHANGELOG.md` (dev) +
  `PersonaDLE_Update.html` (joueur, page HTML bilingue), comme documenté en tête de ce fichier.
- Perf (`daily_pools.json` entièrement reparsé à chaque `POST /api/sessions` quel que soit le
  mode joué) : accepté tel quel vu la taille modeste du fichier (~40 Ko), commentaire ajouté
  plutôt qu'une restructuration en fichiers par mode — à revisiter si le roster grossit beaucoup.

---

## 2026-07-06 — Conditions badges/wallpapers en colonnes structurées

Suite du menu ROADMAP.md : `badges`/`wallpapers` n'avaient qu'un texte libre d'affichage
(`condition_en`/`unlock_condition`), la vérification serveur passant par un mapping
slug→logique en dur dans `api/badges/index.php`/`api/wallpapers/index.php` — fragile
(un nouveau badge ajouté sans mise à jour du switch passait toujours en "safe fallback
= true"). `titles` avait déjà résolu ce problème avec des colonnes structurées
(`condition_type`/`condition_mode`/`condition_value`) — ce lot applique le même schéma
aux deux autres tables.

- **`api/lib/condition_check.php`** (nouveau) — `personadle_verify_condition()` extrait
  de l'ancien `verifyTitleCondition()` (`api/titles/index.php`), généralisé et partagé
  par les 3 tables au lieu de 3 mappings divergents. 3 nouveaux `condition_type` :
  `mode_games` (parties jouées, pas victoires — ex. wallpaper `rise_dungeons`),
  `games_total` (parties tous modes), `social_link_min_rank` (généralise
  `social_link_rank_10` avec un seuil au lieu d'un rang exact).
- **`sql/migrations/021_structured_badge_wallpaper_conditions.sql`** + `bdd_mysql.sql`
  mis à jour directement (schéma + seed) : `ALTER TABLE` badges/wallpapers, backfill de
  toutes les valeurs existantes. 15/60 badges et 5/7 wallpapers ont une condition
  réellement structurable ; le reste (flags narratifs multi-persos, redeem de code
  événement, vérifié par un autre endpoint comme social-links/streak-recovery) reçoit
  `condition_type = 'manual'` — documente explicitement le choix au lieu de laisser
  `NULL` en silence.
- **Corrige au passage 2 vrais bugs de mapping**, découverts en cartographiant chaque
  badge vers son condition_type réel : `velvet_regular` ("jouer 50 jours uniques") et
  `best_bro` ("avoir 2+ amis") étaient dans la liste des badges "impossible à
  structurer, toujours autorisé" alors qu'ils sont structurellement identiques à
  `unique_days`/`friends_count`, déjà utilisés par `titles`. Ces deux badges sont
  maintenant réellement vérifiés côté serveur.
- `api/badges/index.php`/`api/wallpapers/index.php` réécrits pour lire les 3 colonnes
  et appeler la fonction partagée — les anciennes fonctions `verifyBadgeCondition()`
  (avec sa liste de bypass slug par slug) et `verifyWallpaperCondition()` supprimées.
- `tests/php/ConditionCheckTest.php` (21 tests, même pattern `DatabaseIntegrationTest.php`
  — vraie MariaDB, transaction annulée en tearDown) couvre chaque `condition_type`.

Non exécuté en sandbox (pas de Docker/MariaDB) — vérifié par relecture attentive +
comparaison structurelle avec `verifyTitleCondition()` (déjà tournée en CI réelle avant
cette PR) + un script Python de validation structurelle des lignes SQL modifiées
(nombre de champs par ligne INSERT = nombre de colonnes déclarées, sur les 60 lignes
badges et 7 lignes wallpapers). À confirmer via la CI (`make test-php`).

### Suivi de revue (PR #14)

- **Fail-closed wallpaper préservé** — `personadle_verify_condition()` est fail-open par
  design (un `condition_type` NULL/inconnu débloque toujours, pour ne jamais bloquer un
  futur ajout de titre/badge). L'ancien `verifyWallpaperCondition()` faisait l'inverse
  (`default: return false`). Déléguer wallpapers directement à la fonction partagée aurait
  silencieusement inversé ce choix pour tout wallpaper futur sans `condition_type`. Fix :
  garde explicite `if (empty($wallpaper['condition_type'])) return false;` dans
  `canUnlockWallpaper()` (`api/wallpapers/index.php`) **avant** la délégation.
- **`condition_value` NULL fail-closed** — `$condValue ?? 0` combiné à des comparaisons
  `>= $val` faisait qu'un badge/wallpaper avec `condition_type` défini mais
  `condition_value` NULL par erreur de saisie (colonne nullable) était toujours débloqué
  (`>= 0` toujours vrai), au lieu de refuser. Fix : liste `$valueRequiredTypes` vérifiée
  avant le `switch`, retourne `false` si un type qui a besoin d'une valeur numérique a
  `condition_value = NULL`. `social_link_min_rank` en est volontairement exclu (défaut à
  10 documenté séparément).
- **`classic_p1_wins`/`emoji_p2_wins` corrigés dans le docblock** — la revue affirmait ces
  deux alias inutilisés par le seed. Faux : `naoya_first_awakening` et
  `maya_always_be_positive` (`bdd_mysql.sql`) les utilisent réellement. Docblock mis à
  jour pour le documenter explicitement au lieu de supprimer du code fonctionnel.
- **`SUM`/`MAX` factorisés** — `personadle_aggregate_user_stat()` et
  `personadle_user_stat_for_mode()` extraits pour éliminer la duplication SQL entre les
  différents `condition_type` numériques (whitelist de colonnes/fonctions en défense en
  profondeur, `$column`/`$fn` ne sont jamais une entrée utilisateur).
- **`tests/php/BadgeWallpaperCatalogTest.php`** (nouveau, 5 tests) — répond aussi à la
  demande de couverture par badge individuel : `testEveryBadgeHasExpectedConditionColumns()`
  vérifie que les 60 lignes réelles de `badges` correspondent exactement au mapping attendu
  (catalogue complet, pas un échantillon), idem pour les 7 wallpapers non-défaut. Les 3
  tests restants copient le SELECT exact des 3 endpoints réels (`badges`/`wallpapers`/
  `titles`) pour fermer le trou identifié en revue : les tests précédents appelaient
  `personadle_verify_condition()` avec des littéraux, jamais via le vrai flux bout-en-bout,
  donc un décalage de nom de colonne entre le SELECT d'un endpoint et la fonction n'aurait
  pas été détecté.

### Suivi de revue, 2ᵉ passe (PR #14)

- **Vrai bug attrapé par la CI elle-même (commit `d603516`)** — `ConditionCheckTest::testSocialLinkMinRankDefaultsToRank10WhenValueIsNull`
  a échoué au premier push du suivi de revue (`2da76c01`) : la nouvelle garde
  `$valueRequiredTypes` (refus si `condition_value` NULL, ajoutée par ce même commit)
  incluait encore `social_link_min_rank` malgré le commentaire juste au-dessus affirmant
  l'inverse. Ce type a son propre défaut à 10 documenté dans le `switch`, donc la garde
  générique le court-circuitait avant d'y arriver — `social_link_min_rank` retournait
  toujours `false`, même à rang 10. Retiré de la liste dans `d603516` — reconfirmé vert
  par la CI dans la foulée.
- **Frontière exacte value-1/value ajoutée pour les 19 badges/wallpapers à seuil simple**
  (`BadgeWallpaperCatalogTest::testStructuredConditionsRespectExactThreshold`) + un test
  dédié pour `kamoshida_palace`/`all_modes_won` (5/6 modes refusé, 6/6 accordé). Répond au
  point le plus important d'une 2ᵉ passe de revue : aucun test existant ne prouvait qu'un
  seuil réel du catalogue (par opposition à une valeur inventée dans `ConditionCheckTest.php`,
  ou à la donnée en base vérifiée par `testEveryBadgeHasExpectedConditionColumns()`) était
  respecté à l'exécution — exactement la classe de bug qui vient de casser
  `social_link_min_rank` silencieusement.
- **`personadle_known_condition_types()`** (nouveau, `condition_check.php`) — liste
  exhaustive des 17 `condition_type` reconnus. `canUnlockWallpaper()`
  (`api/wallpapers/index.php`) comparait juste `!empty($condition_type)`, ce qui ne
  distingue pas un type reconnu (`manual`) d'une faute de frappe ou d'un type retiré du
  vocabulaire (l'ancien `social_link_rank_10`) — les deux tombaient sur le safe-fallback
  `true` partagé avec badges/titles, débloquant un wallpaper par erreur. Comparaison
  stricte à cette liste maintenant. `ConditionCheckTest::testKnownConditionTypesMatchesSwitchCases()`
  garde la liste synchronisée avec les vrais `case` du switch.
- **`tests/php/BadgeWallpaperCatalogTest.php` — test titres corrigé** : utilisait
  `WHERE slug = ?` alors que le vrai endpoint (`api/titles/index.php::POST /unlock`) fait
  `WHERE id = ?` après une résolution slug→id séparée. Passait par coïncidence (même
  ligne), sans jamais exercer la requête réellement utilisée par le check de condition.
  Résout maintenant l'id d'abord, comme le fait le vrai endpoint.
- **`sql/bdd_mysql.sql`** : commentaire de schéma sur `condition_type` mis à jour
  (retire `social_link_rank_10`, ajoute `mode_games`/`games_total`/`social_link_min_rank`).

### Suivi de revue, 4ᵉ passe (PR #14) — bug bloquant du titre Aigis corrigé

- **`titles.aigis_i_am_not_afraid` ne pouvait jamais se débloquer** — l'`INSERT INTO
  titles` n'incluait même pas la colonne `condition_mode` (NULL pour tous les titres,
  sans exception). Avec `condition_type='mode_wins'` et aucun mode résolu,
  `personadle_verify_condition()` refuse immédiatement (`return false`) sans jamais
  consulter les stats — bug confirmé identique sur `develop`, pas introduit par cette
  PR. Fix (confirmé par le mainteneur — la doc joueur `PersonaDLE_Update.html` annonce
  "Win 50 games in Classic Mode") : ajoute `condition_mode` à la liste de colonnes de
  l'`INSERT INTO titles` (`bdd_mysql.sql`), NULL pour les 10 autres titres, `'classic'`
  pour `aigis_i_am_not_afraid`. `sql/migrations/022_fix_aigis_title_condition.sql` pour
  propager le fix vers la prod Hostinger (déjà déployée avec le seed cassé).
- **`GET /api/titles` expose maintenant `condition_mode`** (`api/titles/index.php`) —
  absent du `SELECT` du `GET`, incohérent avec le `POST /unlock` du même fichier et avec
  `GET /api/badges`/`GET /api/wallpapers` (mis à jour par cette PR pour exposer les 3
  colonnes ensemble).
- **`BadgeWallpaperCatalogTest::testStructuredConditionsRespectExactThreshold()` remplacé
  par un mécanisme générique lisant le catalogue DIRECTEMENT en base** (badges +
  wallpapers + **titles**), plutôt qu'une liste de 19 slugs codée en dur — un futur
  badge/wallpaper/titre utilisant un `condition_type` déjà supporté est désormais couvert
  automatiquement dès son insertion en base, sans qu'un humain doive ajouter une ligne de
  test. Étend aussi la couverture aux types utilisés uniquement par `titles`
  (`badges_count`, `weekly_clean_modes`, `classic_p1_wins`, `emoji_p2_wins`) et à
  `perfect_wins` (supporté par `condition_check.php` mais non utilisé par le catalogue
  actuel — ajouté par anticipation, coût marginal nul).

---

## 2026-07-11 — redesign(ui): FAQ et Privacy — thème Velvet Room complet

Refonte visuelle complète de `pages/faq.html` et `pages/privacy.html` pour rejoindre l'esthétique Retro-Futurism du reste du jeu.

### FAQ

- **Fond** : `#0b0a1f` toujours sombre (Velvet Room), gradients radiaux animés (`fqBgPulse`), scanlines overlay
- **Titre** : Cinzel, `clamp(2.6rem…5rem)`, shimmer gradient animé (`titleShimmer` 6 s)
- **Barre de progression** : dégradé violet → rouge → or
- **Recherche** : input dark glass avec bordure violet/rouge neon au focus
- **Tabs de filtre** : pills neon couleur par catégorie (`game`=rouge, `gameplay`=rose, `account`=bleu, `community`=violet, `team`=or)
- **Headers catégorie** : dark glass, barre neon colorée à gauche (`::before`), glow ambiant par catégorie
- **Items FAQ** : dark glass, bordure neon colorée + glow quand `open`
- **Jack Frost** : 115 px, glow bleu-violet
- **Équipe** : cartes dark glass bordure or, hover lift + glow gold
- **Bouton Back** : déplacé à la FIN de la page (était au milieu — bug UX signalé par l'utilisateur)
- **`prefers-reduced-motion`** : toutes les animations désactivées

### Privacy

- **Fond** : même thème `#0b0a1f` avec gradients radiaux animés
- **Titre** : Cinzel, shimmer identique au FAQ
- **Shield hero** : emoji 🔐 avec animation `shieldPulse` violet→rouge
- **Intro card** : dark glass, bordure violet neon
- **Badges** : glassmorphism neon (vert/bleu/rouge/violet) en remplacement des pastilles blanches plates
- **Cartes de section** : dark glass + bordure gauche colorée par type (`--card-accent` CSS custom property) + glow hover par type (rouge/vert/bleu/violet)
- **Titres de section** : couleur neon par type de section
- **Listes** : `✕` rouge-pink pour "never do", `✓` vert neon pour "security"
- **Personnages Sae/Zenkichi** : glow violet ajouté au `filter: drop-shadow`
- **Bouton email** : style cohérent avec le bouton Back
- **Chip "last updated"** : fond violet subtle

---

## 2026-07-11 — fix(ui): victoryBox Classique vide + tooltip {{n}} non interpolé + redesign pages statiques

Trois correctifs isolés regroupés dans un lot UI/fix.

### victoryBox Classique (mode classique — barre blanche/verte vide à la victoire)

`classiqueMode/classiqueMode.html` avait un `<div id="victoryBox">` vide, contrairement à tous les autres modes qui contiennent `<img id="victoryPortrait">` + `<p id="winMessage">`. Symptôme : boîte verte/blanche vide animée à la victoire, aucun portrait ni message.

- **`classiqueMode/classiqueMode.html`** — ajout de `<img id="victoryPortrait">` + `<p id="winMessage" class="win-message">` dans `#victoryBox`
- **`classiqueMode/modeClassique.js`** — helper `fillVictoryBox(nom, isGiveup)` appelé aux 3 points : victoire, déjà-joué (restore), abandon
- **`lang/{en,fr,es,de,it}.json`** — ajout `modes.classic.correct` et `modes.classic.giveup_reveal` (clés de texte `{{name}}`)

### Tooltip amis `{{n}}` affiché brut

`js/social-link.js` : fonction `t(key, fallback)` locale ignorait silencieusement l'objet `vars` (3ème argument). Les appels `t('key', fallback, { n: X })` passaient `vars` mais la fonction interne ne le relayait pas à `window.i18n?.t?.(key, vars)`.

- **`js/social-link.js`** (ligne 23) — signature `t(key, fallback, vars)` + passage de `vars` à `window.i18n?.t?.(key, vars)`

### Redesign pages statiques (404, FAQ, Privacy)

Mise à niveau visuelle des pages statiques pour rejoindre l'esthétique Retro-Futurism du reste du jeu.

- **`pages/404.html`** — réécriture complète : thème Velvet Room (bg `#0c0b1a`, dégradé violet profond), grand "404" Cinzel avec glitch/chromatic aberration CSS (`::before` rouge / `::after` bleu), card glassmorphism gold-border, Igor GIF avec floating animation, diamonds pulsants, SVG arrow sur le bouton retour, corner brackets dorés, bottom nav, dark mode toggle, scanlines overlay, `prefers-reduced-motion`, easter egg ALIBABA préservé
- **`pages/faq.html`** — remplacement du `🔍` emoji dans le `innerHTML` dynamique (ligne 890) par un SVG inline magnifying glass ; back button : `display:inline-flex`, `cursor:pointer`, `text-decoration:none`, `:focus-visible` gold outline ; SVG arrow à la place de `← Back`
- **`pages/privacy.html`** — back button : `display:inline-flex`, `cursor:pointer`, `text-decoration:none`, `:focus-visible` gold outline ; SVG arrow à la place de `← Back`

### Détails techniques

- Le glitch 404 tourne à 6 s d'intervalle, déclenche à 88 % du cycle (glitch court, pause longue) — evite la fatigue visuelle
- Pas de `@import` Google Fonts en CSS — balise `<link>` dans le `<head>` pour ne pas bloquer le rendu
- `initLangSelector()` importé de `js/lang-selector.js` (pattern identique à `reset-password.html`, seul autre fichier dans `pages/` qui l'utilise)

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
