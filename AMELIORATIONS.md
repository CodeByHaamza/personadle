# 🔧 PersonaDLE — Propositions d'amélioration

> Audit du 2026-06-24. Priorités : 🔴 critique · 🟠 important · 🟡 confort.
> Ce document est une feuille de route, pas une obligation. À piocher selon ton temps.

---

## 1. 🔴 Git & poids du dépôt (le problème n°1)

**Constat mesuré :**

- `.git` = **3,5 Go**
- AOA webp versionnés = **1,7 Go** (192 fichiers), certains à **81 Mo l'unité** (Koromaru, Ken, Aigis_FES…)
- 75 MP3 = 26 Mo, aussi versionnés
- **Aucun Git LFS** → tout l'historique binaire est dans chaque clone, à jamais

**Pourquoi c'est grave :**

- Cloner le repo = télécharger 3,5 Go. CI lente, onboarding pénible.
- GitHub bloque à 100 Mo/fichier (tu frôles la limite) et conseille LFS dès 50 Mo.
- L'historique est **immuable** : même si tu supprimes un webp, ses 81 Mo restent dans `.git` pour toujours, sauf réécriture d'historique.

**Actions :**

1. Migrer les binaires lourds vers **Git LFS** (`.webp`, `.mp3`, `.mp4`) — ou mieux, les **sortir complètement du repo** et les servir depuis un CDN / object storage (Cloudflare R2, Bunny, S3). Le repo ne garde alors que le code.
2. Réécrire l'historique pour purger le poids déjà accumulé : `git filter-repo --strip-blobs-bigger-than 5M` (⚠️ destructif, à coordonner avec les collaborateurs — backup + force-push).
3. Ajouter un `.gitattributes` LFS si tu gardes les assets dans Git.

> 💡 Ça résout aussi en grande partie le risque légal des MP3 Atlus (cf. commit précédent) : hors du repo public, plus de redistribution.

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

**Actions (historiques) :**

1. Ajouter **PHPUnit** + une base de test SQLite/MySQL jetable. Cibler en priorité : calcul de streak (`sessions.php`), `recover-streak.php`, rate-limiting, unicité register.
2. Couvrir le **flux d'intégration streak complet** côté JS : jeu → `syncPending` → `pullProfileFromCloud` → rupture → `performRecovery`. Aujourd'hui chaque maillon est testé isolément, mais pas la chaîne (c'est exactement ce qui laissait passer le revert).
3. Mesurer la couverture (`@vitest/coverage-v8` est déjà installé : `vitest run --coverage`) et fixer un seuil minimal en CI.

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
- **Accessibilité** : audit `aria-*`, focus management des modals (le menu Jack Frost), contrastes, `prefers-reduced-motion` (animations AOA lourdes).
- **PWA** : `sw.js` présent — vérifier la stratégie de cache des gros assets (ne pas pré-cacher 1,7 Go !).

---

## 10. 📌 Ordre de priorité conseillé

1. 🔴 **Git LFS / sortir les assets du repo** (#1) — débloque tout le reste, réduit le risque légal.
2. 🔴 **Réencoder les AOA** (#2) — gros gain perf immédiat pour les joueurs.
3. 🟠 **Tests PHP + flux streak intégré** (#3).
4. 🟠 **Mapping de modes unifié** (#5) + **validation de données en CI** (#4.3).
5. 🟠 **Nettoyer/intégrer `new data/`** proprement (#4.1, #6).
6. 🟡 Le reste (sécu, CI, i18n, a11y) au fil de l'eau.
