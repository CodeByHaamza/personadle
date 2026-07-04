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
3. Lazy-load + `loading="lazy"` sur les animations, et ne charger l'AOA du jour que quand nécessaire.

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
3. ~~Mesurer la couverture et fixer un seuil minimal en CI~~ — fait, voir ci-dessus.
4. **Nouveau (audit du 2026-07-04)** : la couverture au niveau des **endpoints API** reste faible
   (~7/38 fichiers `api/*.php` exercés par un test exécuté, E2E ou unitaire — le reste ne passe
   que par PHPStan/lint statique, jamais réellement invoqué en CI). Cibler en priorité les
   endpoints `admin/*`, `messages/index.php`, `leaderboard/index.php`.
5. Le job E2E (`e2e` dans `ci.yml`) reste `continue-on-error` — critère de sortie documenté
   dans `tests-e2e/README.md` § Statut CI (10 runs consécutifs verts sur `develop`).

---

## 4. 🟠 Cohérence des données & lore Persona

### 4.1 Schéma de données

Le schéma de [characters_clean.js](database/characters_clean.js) est :
`nom, genre[], age, arcane[], opus[], personaUser, persona, emoji[], quote`.

**Ce que tu as écrit dans `new data/caractere/data.txt` (P5X) ne mappe pas encore au schéma :**

| Ton champ                        | Schéma                            | À faire                                                                             |
| -------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| `Code Name` (Anri, Pinky, Blitz) | ❌ pas de champ                   | Ajouter un champ `codeName` au schéma (et l'exploiter dans les modes) ou le retirer |
| `age: "Still in Twenties"`       | `age` est un range type `"15-20"` | Uniformiser → ex. `"20-29"`                                                         |
| `genre`                          | `genre[]` requis                  | Manquant pour les 3 (ex. `["Human","Female"]`)                                      |
| `arcane`, `opus`, `quote`        | requis                            | Manquants — `opus: ["P5X"]` au minimum                                              |

**Typos relevés :** `fille humainre` → _humaine_. Format hétérogène entre les 3 fiches (l'une numérote l'âge, l'autre non).

### 4.2 Vérification lore (à confirmer par toi / Léo / Dzulian)

Les personas cités — **Gentileschi** (Aran/Anri), **Asterope** (Narumi/Pinky), **Kiskil-lilla** (Kumi/Blitz) — méritent une vérif contre une source canonique P5X avant intégration : Asterope (Pléiade grecque) et Kiskil-lilla (mythologie sumérienne/Lilith) collent à la convention de nommage ; **Gentileschi** (peintre baroque) détonne — à double-checker. Je n'ai pas pu vérifier ces faits, à valider côté data.

### 4.3 Intégrité globale

- Ajouter un **script de validation des données** (`scripts/validate-characters.js`) lancé en CI : vérifie que chaque perso a tous les champs requis, que `opus` ∈ liste connue, que chaque `nom` a un portrait dans [portraitsMap.js](database/portraitsMap.js) et un fichier image existant, que les emoji sont non vides, etc.
- Vérifier les **doublons** de `nom` et la cohérence `personaUser ⇒ persona` non vide.

---

## 5. 🟠 Cohérence de nommage (modes)

Le vocabulaire des modes diverge selon les couches :

- Backend : `classic` ([sessions.php](api/sessions.php))
- Client : `classique` ([profileStats.js](profile/profileStats.js)), `Classic`, `All Out Attack`, `alloutattack`…

**Action :** une **table de mapping unique** exportée depuis `gameCore.js` (canonical key ↔ label ↔ backend mode ↔ dossier), importée partout. Supprime une classe entière de bugs silencieux.

---

## 6. 🟡 Architecture & arborescence

- **Modes dupliqués** : chaque mode a son `database/` local (`musicsMode/database`, `personaeMode/database`…) en plus du `database/` racine. Centraliser ou documenter clairement la frontière.
- **Fichiers à la racine** : `privacy.css`, `privacy.html`, `sw.js`, `404.html`, `faq.html` cohabitent avec la config. Envisager un dossier `pages/` ou `public/`.
- **Convention de nommage de fichiers** : CLAUDE.md impose `snake_case`, mais le repo mélange `streak-recovery.js` (kebab), `gameCore.js` (camel), `characters_clean.js` (snake). Soit aligner, soit assouplir la règle dans CLAUDE.md pour refléter la réalité.
- **`new data/`** : dossier de travail non structuré (espaces, casse hétérogène, jpeg/webp/mp4 mêlés). Définir une convention d'ingestion : `incoming/<type>/<persona-snake_case>.<ext>` + un script qui valide/renomme/optimise avant de pousser en base.
- **Nouveau (audit du 2026-07-04)** : deux « god files » à scinder en sous-modules ES6
  (déjà chargés en `type="module"`, donc techniquement scindable sans casser l'ordre de
  chargement) : `admin/admin.js` (1847 lignes, 39 fonctions) et `profile/profile-page.js`
  (1194 lignes). ⚠️ Report volontaire : ce refactor touche des actions sensibles côté admin
  (ban, suppression RGPD…) et n'a **pas pu être vérifié visuellement en navigateur** (pas de
  Docker dans le sandbox où cet audit a été fait) — à faire avec un vrai test manuel en local
  après coup, pas en aveugle.
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

- **Rate-limiting** basé sur `sys_get_temp_dir()` : non partagé entre instances et effaçable. Passer sur une table SQL ou Redis si tu scales.
- Ajouter un **CSP** (`Content-Security-Policy`) en plus des headers existants.
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

- **Strings en dur** dans `streak-recovery.js` (« Streak Lost! », messages d'erreur) non passées par i18n. Les externaliser dans `lang/en.json`.
- **Accessibilité** : audit `aria-*`, contrastes, `prefers-reduced-motion` (animations AOA lourdes
  volontairement exclues — ce sont du contenu de jeu, cf. `css/global.css`).
  > ✅ **Résolu depuis** : focus management des modales — `js/modal.js` (trap Tab/Escape +
  > restauration du focus) est maintenant branché sur `js/auth.js`, `profile/profile-page.js`
  > (crop avatar), `js/settings-modal.js` **et** le menu de filtres Jack Frost
  > (`js/filterMenu.js` — focus envoyé dans le panneau à l'ouverture, restauré sur le bouton
  > toggle à la fermeture via Escape ; pas de piège Tab complet, ce n'est pas une modale mais
  > un menu déroulant, cf. WAI-ARIA menu-button pattern).
- **PWA** : `sw.js` présent — vérifier la stratégie de cache des gros assets (ne pas pré-cacher 1,7 Go !).

---

## 10. 📌 Ordre de priorité conseillé

1. 🔴 **Git LFS + purge d'historique** (#1) — assets restent en local (philosophie du projet), débloque juste le poids du `.git`.
2. 🔴 **Réencoder les AOA** (#2) — gros gain perf immédiat pour les joueurs.
3. 🟠 **Tests PHP + flux streak intégré** (#3).
4. 🟠 **Mapping de modes unifié** (#5) + **validation de données en CI** (#4.3).
5. 🟠 **Nettoyer/intégrer `new data/`** proprement (#4.1, #6).
6. 🟡 Le reste (sécu, CI, i18n, a11y) au fil de l'eau.
