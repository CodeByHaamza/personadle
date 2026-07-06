# 🔧 PersonaDLE — Propositions d'amélioration

> Audit du 2026-06-24. Priorités : 🔴 critique · 🟠 important · 🟡 confort.
> Ce document est une feuille de route, pas une obligation. À piocher selon ton temps.

---

## 1. 🔴 Git & poids du dépôt (le problème n°1)

> ⚠️ **Décision de philosophie du projet (tranchée)** : tous les assets (musiques, GIFs/webp
> All-Out Attack, etc.) restent **committés dans le repo Git**, jamais gitignorés et jamais
> "CDN-only" — l'objectif est qu'un simple `git clone` suffise pour jouer à tous les modes
> immédiatement, sans étape de téléchargement séparée (c'est pour ça que les AOA existent en
> local **en plus de** R2 Cloudflare, pas à sa place). L'option "sortir complètement les
> assets du repo" ci-dessous est donc **écartée** — elle casse cette philosophie. Git LFS
> reste compatible avec elle : un `git clone` via LFS télécharge quand même les fichiers
> réels automatiquement, seul le stockage interne change.

**Constat mesuré :**

- `.git` = **3,5 Go** (4,8 Go au 2026-07)
- AOA webp versionnés = **1,7 Go** (192 fichiers, 213 au 2026-07), certains à **81 Mo l'unité** (Koromaru, Ken, Aigis_FES…)
- 75 MP3 = 26 Mo, aussi versionnés (86 au 2026-07)
- **Aucun Git LFS** → tout l'historique binaire est dans chaque clone, à jamais

**Pourquoi c'est grave :**

- Cloner le repo = télécharger plusieurs Go. CI lente, onboarding pénible.
- GitHub bloque à 100 Mo/fichier (tu frôles la limite) et conseille LFS dès 50 Mo.
- L'historique est **immuable** : même si tu supprimes un webp, ses 81 Mo restent dans `.git` pour toujours, sauf réécriture d'historique.

**Actions (compatibles avec la philosophie "tout en local, clone = jouable") :**

1. Migrer les binaires lourds vers **Git LFS** (`.webp`, `.mp3`, `.mp4`) — les fichiers restent
   récupérés automatiquement à chaque `git clone`/`checkout`, seul l'historique Git brut arrête
   de grossir indéfiniment avec chaque nouvelle version d'un asset.
2. Réécrire l'historique pour purger le poids déjà accumulé : `scripts/purge_git_history.sh`
   (⚠️ destructif, à coordonner avec les collaborateurs — backup + force-push) — script déjà
   prêt, voir son en-tête.
3. Ajouter un `.gitattributes` LFS une fois la migration faite.

> 💡 Risque légal des MP3/assets Atlus (fan-made, non commercial) : accepté comme un compromis
> délibéré de ce projet, pas résolu par la philosophie "tout en local" — à garder en tête si le
> jeu grossit en visibilité, mais ce n'est plus traité comme une raison de sortir les assets du repo.

---

## 2. 🔴 Poids des AOA animés (perf utilisateur)

Les AOA versionnés font **37 à 81 Mo pièce**. Un joueur sur mobile télécharge potentiellement des dizaines de Mo pour une seule animation.

**Constat de la conversion d'aujourd'hui :** les MP4 sources réencodés en webp animé (q70) donnent **9–25 Mo** pour une qualité visuelle équivalente — soit **3 à 8× plus léger**.

**Actions :**

1. Réencoder **toute** la base AOA existante avec le pipeline validé :
   `ffmpeg -i in.mp4 -vf fps=30 -loop 0 -an -c:v libwebp -q:v 70 -compression_level 6 out.webp`
2. Envisager de **conserver les MP4** comme source de vérité (plus compact que le webp animé) et générer le webp à la volée / au build.
3. ~~Lazy-load + `loading="lazy"` sur les animations~~ — `loading="lazy"` posé sur `#aoaGif`
   (`allOutAttackMode/allOutAttack.html`). Le chargement à la demande (une seule cible du jour,
   pas de préchargement des autres) était déjà en place côté JS (`modeAllOutAttack.js`).

---

## 3. 🟠 Tests

**Constat (au 2026-06-24) :** 209 tests JS (bien !), mais **0 test côté PHP**. `backend.test.js` teste de la logique JS qui _mime_ le backend, pas le vrai code PHP. La logique de streak serveur ([sessions.php](api/sessions.php)), la récupération, l'auth ne sont pas couvertes.

> ✅ **Résolu depuis** : `tests/php/` compte aujourd'hui 8 fichiers / 123 méthodes PHPUnit
> (`StreakTest`, `AuthzTest`, `SocialLinkTest`, `FriendsTest`, `ValidationTest`,
> `AdminValidationTest`, `FormatUserTest`, `DatabaseIntegrationTest` — cette dernière avec
> une vraie intégration MariaDB), câblés en CI (`.github/workflows/ci.yml`).

> ✅ **Résolu depuis** : seuil de couverture Vitest fixé et bloquant en CI
> (`vitest.config.js` : `lines 70% / functions 65% / branches 65% / statements 70%`
> sur les fichiers sensibles `gameCore.js`, `streak-recovery.js`, `cloud-sync.js`,
> `social-link.js`, `profileStats.js`, `formatPlayTime.js`, `validate_characters.js` —
> `npm run test:coverage` dans `.github/workflows/ci.yml`).

**Actions (historiques) :**

1. Ajouter **PHPUnit** + une base de test SQLite/MySQL jetable. Cibler en priorité : calcul de streak (`sessions.php`), `recover-streak.php`, rate-limiting, unicité register.
2. Couvrir le **flux d'intégration streak complet** côté JS : jeu → `syncPending` → `pullProfileFromCloud` → rupture → `performRecovery`. Aujourd'hui chaque maillon est testé isolément, mais pas la chaîne (c'est exactement ce qui laissait passer le revert).
   > ✅ **Résolu depuis** : `tests/streakFlow.integration.test.js` câble ensemble
   > `performRecovery()` et `pullProfileFromCloud()` autour d'un faux backend en mémoire —
   > couvre le cas "récup acceptée → pas de revert au pull suivant" et "récup refusée
   > (cooldown) → aucune fausse restauration", exactement le scénario qui laissait passer
   > le revert silencieux.
3. ~~Mesurer la couverture et fixer un seuil minimal en CI~~ — fait, voir ci-dessus.
4. **Nouveau (audit du 2026-07-04)** : la couverture au niveau des **endpoints API** reste faible
   (~7/38 fichiers `api/*.php` exercés par un test exécuté, E2E ou unitaire — le reste ne passe
   que par PHPStan/lint statique, jamais réellement invoqué en CI). Cibler en priorité les
   endpoints `admin/*`, `messages/index.php`, `leaderboard/index.php`.
   > ✅ **Résolu depuis** : `tests-e2e/admin.spec.js` exerce `GET /api/admin/users`,
   > `GET /api/admin/audit_log`, `GET /api/admin/rate_limits` et le garde-fou `requireAdmin()`
   > (403 pour un non-admin) sur `PATCH /api/admin/users/:id`. `tests-e2e/admin-extended.spec.js`
   > (nouveau, 24 tests) complète avec les endpoints qui restaient non couverts : `event_codes`
   > (cycle créer/lister/désactiver/supprimer), `error_logs`, `deletion_requests`, `social_links`
   > (liste + 404), et les dons utilisateur `user_badges`/`user_titles`/`user_wallpapers`
   > (accorder/retirer, catalogue lu dynamiquement via `/api/titles`/`/api/wallpapers` plutôt que
   > des IDs figés) + `user_stats` (écrasement + validations 400) + `user_friends` (403 + 404) —
   > via le même compte admin de seed.
5. Le job E2E (`e2e` dans `ci.yml`) reste `continue-on-error` — critère de sortie documenté
   dans `tests-e2e/README.md` § Statut CI (10 runs consécutifs verts sur `develop`).
   > 🔎 **Vérifié le 2026-07-05** : seulement 2/10 exécutions consécutives vertes sur `develop`
   > à ce jour (historique des jobs `e2e` depuis son introduction). Critère non atteint — le
   > job reste `continue-on-error`, aucune action nécessaire pour l'instant.

---

## 4. 🟠 Cohérence des données & lore Persona

### 4.1 Schéma de données

Le schéma de [characters_clean.js](database/characters_clean.js) est :
`nom, genre[], age, arcane[], opus[], personaUser, persona, emoji[], quote`.

**Ce que tu avais écrit dans `new data/caractere/data.txt` (P5X) ne mappait pas encore au schéma :**

| Ton champ                        | Schéma                            | À faire                                                                             |
| -------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| `Code Name` (Anri, Pinky, Blitz) | ❌ pas de champ                   | Ajouter un champ `codeName` au schéma (et l'exploiter dans les modes) ou le retirer |
| `age: "Still in Twenties"`       | `age` est un range type `"15-20"` | Uniformiser → ex. `"20-29"`                                                         |
| `genre`                          | `genre[]` requis                  | Manquant pour les 3 (ex. `["Human","Female"]`)                                      |
| `arcane`, `opus`, `quote`        | requis                            | Manquants — `opus: ["P5X"]` au minimum                                              |

**Typos relevés :** `fille humainre` → _humaine_. Format hétérogène entre les 3 fiches (l'une numérote l'âge, l'autre non).

> ✅ **Résolu depuis** : les 3 fiches sont intégrées dans `characters_clean.js` avec le
> schéma conforme — `Aran Hirano` (Anri, persona Gentileschi), `Narumi Nashimoto` (Pinky,
> persona Asterope), `Kumi Katayama` (Blitz, persona Kiskil-lilla) — `genre[]`, `age` en
> tranche canonique (`"15-20"`/`"21-40"`), `arcane`/`opus`/`quote` tous renseignés. Champ
> `codeName` retiré (pas exploité par les modes) plutôt qu'ajouté au schéma — décision
> tranchée. `npm run data:check` (`scripts/validate_characters.js`) confirme les 177
> personnages actuels conformes, ces 3 inclus.

### 4.2 Vérification lore (à confirmer par toi / Léo / Dzulian)

Les personas cités — **Gentileschi** (Aran/Anri), **Asterope** (Narumi/Pinky), **Kiskil-lilla** (Kumi/Blitz) — méritent une vérif contre une source canonique P5X avant intégration : Asterope (Pléiade grecque) et Kiskil-lilla (mythologie sumérienne/Lilith) collent à la convention de nommage ; **Gentileschi** (peintre baroque) détonne — à double-checker. Je n'ai pas pu vérifier ces faits, à valider côté data.

### 4.3 Intégrité globale

- Ajouter un **script de validation des données** (`scripts/validate-characters.js`) lancé en CI : vérifie que chaque perso a tous les champs requis, que `opus` ∈ liste connue, que chaque `nom` a un portrait dans [portraitsMap.js](database/portraitsMap.js) et un fichier image existant, que les emoji sont non vides, etc.
- Vérifier les **doublons** de `nom` et la cohérence `personaUser ⇒ persona` non vide.

> ✅ **Résolu depuis** : `scripts/validate_characters.js` (`npm run data:check`, câblé dans
> `.github/workflows/ci.yml`) couvre tout ce qui précède — champs requis (`nom`/`age`
> string, `genre`/`arcane`/`opus`/`emoji` tableaux non vides), `age` dans les tranches
> canoniques, `opus` ∈ `VALID_OPUS`, `arcane` ∈ `VALID_ARCANA` (warning si non canonique),
> portrait présent dans `portraitsMap` **et** sur disque, doublons de `nom`, cohérence
> `personaUser ⇒ persona` non vide, emoji dupliqués (warning). `npm run data:check` passe
> aujourd'hui sans erreur sur les 177 personnages.

---

## 5. 🟠 Cohérence de nommage (modes)

Le vocabulaire des modes diverge selon les couches :

- Backend : `classic` ([sessions.php](api/sessions.php))
- Client : `classique` ([profileStats.js](profile/profileStats.js)), `Classic`, `All Out Attack`, `alloutattack`…

> ✅ **Résolu depuis** : la table canonique existe (`MODES`/`normalizeModeKey()`/`modeLabel()`
> dans `gameCore.js`) et est bien adoptée dans `profileStats.js`/`cloud-sync.js`, contrairement
> à ce que cette section laissait penser.
>
> **Réaudité le 2026-07-05** — ce qui reste, plus nuancé qu'un simple "pas encore migré" :
> - `js/stats-compare.js` et `admin/admin.js` dupliquaient la **liste des clés** de mode (risque
>   réel de drift si un mode est ajouté/retiré) → corrigé, dérivée de `MODES.map(m => m.key)`.
> - `profile/leaderboard/leaderboard.js` et `js/challenge-notif.js` gardent des **libellés
>   propres à leur contexte d'affichage** ("All-Out" en radar chart compact, "💥 All-Out" en
>   onglet admin, "ALL-OUT ATTACK" en bannière de défi) qui **ne correspondent pas** au libellé
>   canonique `modeLabel("alloutattack")` → `"AllOutAttack"` (sans espace/tiret). Les forcer à
>   appeler `modeLabel()` changerait visuellement l'affichage dans 4 endroits différents sans
>   pouvoir le vérifier en navigateur ici — à traiter par un vrai choix de design (uniformiser le
>   libellé canonique lui-même, ou documenter que chaque contexte a le droit à son propre libellé
>   court) plutôt qu'un remplacement mécanique.

---

## 6. 🟡 Architecture & arborescence

- **Modes dupliqués** : chaque mode a son `database/` local (`musicsMode/database`, `personaeMode/database`…) en plus du `database/` racine. Centraliser ou documenter clairement la frontière.
- ~~**Fichiers à la racine** : `privacy.css`, `privacy.html`, `404.html`, `faq.html`, `reset-password.html` cohabitent avec la config~~
  > ✅ **Résolu depuis** : déplacés dans `pages/` (voir `pages/README.md`). `sw.js` reste à la
  > racine (portée d'un service worker limitée à son propre dossier et ses sous-dossiers —
  > le déplacer casserait le cache offline de tout le site). Toutes les références mises à
  > jour : `index.html`, `profile/profile.html`, `.htaccess` (`ErrorDocument 404`),
  > `sw.js` (précache), `sitemap.xml`, `api/auth/request-reset.php` (lien email), et
  > `js/bottomNav.js` (détection de profondeur de chemin pour la nav du bas).
- **Convention de nommage de fichiers** : CLAUDE.md impose `snake_case`, mais le repo mélange `streak-recovery.js` (kebab), `gameCore.js` (camel), `characters_clean.js` (snake). Soit aligner, soit assouplir la règle dans CLAUDE.md pour refléter la réalité.
- ~~**`new data/`** : dossier de travail non structuré (espaces, casse hétérogène, jpeg/webp/mp4 mêlés). Définir une convention d'ingestion : `incoming/<type>/<persona-snake_case>.<ext>` + un script qui valide/renomme/optimise avant de pousser en base.~~
  > ✅ **Résolu depuis** : le dossier `new data/` n'existe plus (contenu P5X intégré dans
  > `characters_clean.js`, voir §4.1). La convention d'ingestion demandée existe désormais
  > dans `ROADMAP.md` § "À venir — contenu conditionné à une sortie de jeu" : checklist
  > numérotée des fichiers à toucher pour un nouveau personnage/jeu, plus `npm run
  > data:check` (§4.3) qui valide le résultat avant de le considérer prêt.
- **Nouveau (audit du 2026-07-04)** : deux « god files » à scinder en sous-modules ES6
  (déjà chargés en `type="module"`, donc techniquement scindable sans casser l'ordre de
  chargement) : `admin/admin.js` (1847 lignes, 39 fonctions) et `profile/profile-page.js`
  (1194 lignes).
  > ✅ **`admin/admin.js` résolu depuis** : scindé en 8 modules (`admin/admin-api.js` — client
  > REST + toast + escHtml, `admin/catalogs.js`, et un fichier par panneau autonome :
  > `event-codes.js`, `error-logs.js`, `audit-log.js`, `deletion-requests.js`, `rate-limits.js`),
  > `admin.js` passant de 1850 à ~1155 lignes. Comportement strictement inchangé (déplacement
  > mécanique). La liste utilisateurs + les 7 onglets de détail utilisateur restent dans
  > `admin.js` : ils partagent un état fortement couplé (`_selectedUser`/`_userDetail`/pending
  > gifts) et les séparer aurait un risque de régression plus élevé pour un gain plus faible —
  > pas de vérification navigateur possible ici (pas de Docker), donc reporté plutôt que scindé
  > à l'aveugle. `admin.js` n'avait **aucune** couverture Vitest jusqu'ici (seul un sous-ensemble
  > de panneaux est couvert par l'E2E, qui a besoin de Docker) ; `tests/adminSmoke.test.js`
  > comble ce trou (import du graphe de 8 modules, bootstrap complet, clic sur les 5 boutons de
  > panneaux extraits) — pensé pour attraper la classe de bug la plus probable d'un découpage
  > mécanique (export manquant, variable renommée dans un seul des fichiers).
  >
  > ⚠️ **`profile/profile-page.js` : pas de nouveau découpage** — en le relisant, il a déjà 9
  > modules extraits (`profile/badges/`, `wallpapers-ui.js`, `titles-ui.js`, `song-player.js`,
  > `share-card.js`, `theme.js`, `profile-format.js`, `formatPlayTime.js`, `avatars_data.js`).
  > Les 1194 lignes restantes sont la logique de contrôleur de page (chargement/sauvegarde du
  > profil, thème, stats, crop avatar, bootstrap), fortement couplée à un objet `profile`
  > partagé et des closures (`markDirty`/`saveProfile`) — un découpage supplémentaire aurait un
  > risque de régression réel pour un gain marginal, sans pouvoir tester dans un vrai navigateur
  > ici. Décision de ne pas re-découper plutôt que de le faire à l'aveugle.
- **Nouveau (audit du 2026-07-04)** : `filterCharacterPool`/`updateCounters` sont dupliqués
  entre `classiqueMode/modeClassique.js` et `emojiMode/emojiMode.js` avec de **vraies
  différences de comportement** — `filterCharacterPool` de Classique exclut les noms déjà
  devinés (`guessHistory`) et mute le tableau `personas` en place, celui d'Emoji ne fait
  aucune exclusion et retourne un nouveau tableau ; `updateCounters` de Classique pilote 2
  compteurs (`hintCounter` + `giveUpCounter`), celui d'Emoji un seul. Avant de factoriser,
  trancher si l'absence d'exclusion en Emoji est un choix voulu ou un oubli — sinon le
  factoring risque de figer un bug ou d'en introduire un.

---

## 7. 🟡 Sécurité (déjà solide — durcissements)

Le backend est déjà bien fait (PDO préparé, bcrypt, CORS whitelist, sessions sécurisées). Pistes :

- ~~**Rate-limiting** basé sur `sys_get_temp_dir()`~~
  > ✅ **Résolu depuis** : table SQL `rate_limits` (helper `rateLimit()` dans `bootstrap.php`,
  > upsert atomique), partagée entre instances. Voir `api/README.md`.
- ~~Ajouter un **CSP** en plus des headers existants~~
  > ✅ **Résolu depuis** : l'API en avait déjà une (`default-src 'none'`, `api/bootstrap.php`).
  > Ajoutée pour les pages HTML front via `.htaccess` racine (`Header set Content-Security-Policy`,
  > scopé aux `.html` pour ne jamais écraser la policy plus stricte de l'API), avec
  > `mod_headers` activé dans `docker/php/Dockerfile`. `'unsafe-inline'` reste nécessaire pour
  > script-src/style-src (vanilla JS sans build step, `<script>`/`style=""` inline sur la
  > plupart des pages) — les retirer demanderait d'externaliser tous ces scripts, un chantier
  > séparé et plus risqué (idem god files, pas de vérification navigateur possible ici).
- **CSRF** : tu es en `SameSite=Lax` + sessions cookie ; pour les POST sensibles, un token CSRF explicite serait une ceinture+bretelles.
  > ✅ **Résolu depuis** : token CSRF double-submit (`requireCsrf()` dans `bootstrap.php`,
  > cookie `csrf_token` lisible par JS, header `X-CSRF-Token` envoyé par `js/api.js`) — scope
  > : endpoints authentifiés (login/register restent SameSite-Lax-only, décision documentée).
- Logs d'erreur PHP : vérifier qu'aucune stack trace ne fuit en prod (`display_errors=Off`).

---

## 8. 🟡 CI/CD & qualité de code

- Le hook pre-commit lance i18n + tests (bien). Ajouter en CI : `format:check` (Prettier), `i18n:check`, couverture, **lint** (ESLint absent — l'ajouter), et un **PHP linter** (`php -l` sur tous les `.php`, ou PHPStan).
  > ✅ **Résolu depuis** : `eslint.config.js` existe, `npm run lint` tourne en CI
  > (`.github/workflows/ci.yml`), PHPStan niveau 5 câblé aussi, `php -l` en CI sur tous les `.php`.
- **Dependabot / renovate** pour les deps npm.
- Badge de couverture réel dans le README (le badge « 190 passing » est déjà à recaler : ce
  chiffre continue de dater vite — au 2026-07, on est à **449** tests Vitest).

---

## 9. 🟡 i18n, accessibilité, PWA

- ~~**Strings en dur** dans `streak-recovery.js` (« Streak Lost! », messages d'erreur) non passées par i18n.~~
  > ❌ **Ce constat était faux, corrigé le 2026-07-05** : les 8 chaînes visibles de
  > `streak-recovery.js` passent déjà toutes par `_t(key, fallback, vars)`, les 8 clés
  > `streak_recovery.*` existent dans `lang/en.json` **et** dans les 4 autres langues avec de
  > vraies traductions (`npm run i18n:check-untranslated` ne signale aucun doublon EN). Le seul
  > texte non traduit est `alt="Jack Frost"` — un nom de perso, volontairement exclu de l'i18n
  > par convention (CLAUDE.md §5). Rien à corriger.
- **Accessibilité** : audit `aria-*`, contrastes, `prefers-reduced-motion` (animations AOA lourdes
  volontairement exclues — ce sont du contenu de jeu, cf. `css/global.css`).
  > ✅ **Résolu depuis** : focus management des modales — `js/modal.js` (trap Tab/Escape +
  > restauration du focus) est maintenant branché sur `js/auth.js`, `profile/profile-page.js`
  > (crop avatar), `js/settings-modal.js` **et** le menu de filtres Jack Frost
  > (`js/filterMenu.js` — focus envoyé dans le panneau à l'ouverture, restauré sur le bouton
  > toggle à la fermeture via Escape ; pas de piège Tab complet, ce n'est pas une modale mais
  > un menu déroulant, cf. WAI-ARIA menu-button pattern).
  >
  > ✅ **`prefers-reduced-motion` — résolu pour les 2 boucles JS restantes (2026-07-05)** :
  > `css/global.css` neutralise déjà toutes les animations/transitions CSS (règle globale
  > `*, *::before, *::after`), mais deux effets tournent en JS pur via une boucle
  > `requestAnimationFrame` qu'une media query CSS ne peut jamais arrêter : le bruit TV statique
  > (`js/tv-friend-anim.js`) et les confettis dorés du don admin (`js/divine-gift.js`). Les deux
  > sautent maintenant leur boucle si `matchMedia('(prefers-reduced-motion: reduce)').matches`.
  >
  > 🔎 **Contrastes — audité, pas corrigé (décision de design à trancher séparément)** :
  > `--color-accent` (`#e63946`, utilisé comme couleur de texte dans 10+ fichiers CSS) a un
  > ratio de 4.17:1 sur fond blanc — sous le seuil AA texte normal (4.5:1), au-dessus du seuil
  > AA texte large/composant (3:1). `--color-accent-dark` (`#c62828`, déjà dans la palette) est
  > à 5.62:1 en light mode mais seulement 3.47:1 en dark mode (fond quasi noir) — aucune valeur
  > unique ne satisfait proprement les deux thèmes ; à trancher par un choix de palette (Léo)
  > plutôt qu'un changement mécanique sur 10+ fichiers sans vérification visuelle possible ici.
  > `--color-success`/`--color-warning` (`css/global.css`) sont définis mais ne sont utilisés
  > nulle part ailleurs dans le CSS — code mort, sans impact a11y, à supprimer à l'occasion.
- **PWA** : `sw.js` présent — vérifier la stratégie de cache des gros assets (ne pas pré-cacher 1,7 Go !).

---

## 10. 📌 Ordre de priorité conseillé

1. 🔴 **Git LFS + purge d'historique** (#1) — assets restent en local (philosophie du projet), débloque juste le poids du `.git`.
2. 🔴 **Réencoder les AOA** (#2) — gros gain perf immédiat pour les joueurs.
3. ~~🟠 **Tests PHP + flux streak intégré** (#3).~~ ✅ _fait — voir §3._
4. ~~🟠 **Mapping de modes unifié** (#5) + **validation de données en CI** (#4.3).~~ ✅ _fait —
   voir §5/§4.3 (un choix de design reste ouvert sur les libellés courts, pas un bug)._
5. ~~🟠 **Nettoyer/intégrer `new data/`** proprement (#4.1, #6).~~ ✅ _fait — voir §4.1/§6._
6. 🟡 Le reste (sécu, CI, i18n, a11y) au fil de l'eau — seuls points encore ouverts :
   contrastes `--color-accent` (§9, décision de design Léo), stratégie Git LFS (#1) et
   réencodage AOA (#2), toujours en 🔴.
