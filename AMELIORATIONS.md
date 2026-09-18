# 🔧 PersonaDLE — Propositions d'amélioration

> Audit du 2026-06-24, réaudité le 2026-07-05, **relu et complété le 2026-09-13** (section en tête).
> Priorités : 🔴 critique · 🟠 important · 🟡 confort. Ce document est une feuille de route, pas
> une obligation. À piocher selon ton temps.

---

# 🔍 Audit du 2026-09-13 — perf, dépôt, sécurité, docs, idées par mode

> Demande de Hamza : « optimiser le site, rendre le repo plus propre, une template de PR,
> corriger nos docs, checker l'état des PR, proposer des automatisations, et sur chaque page
> et chaque mode proposer des améliorations — anticheat, sécurité, cache, data ». Tout est
> **mesuré** sur le dépôt du jour (branche `fix/community-feedback-batch`, PR #112). Les
> sections historiques (juin–septembre) restent plus bas, elles gardent leurs ✅.
>
> Priorités : 🔴 à faire avant/avec la 2.2 · 🟠 prochaine PR dédiée · 🟡 quand on a le temps ·
> 💡 idée produit à trancher par Hamza/Léo.

## 0. Fait aujourd'hui, dans #112

- ✅ **Template de PR** `.github/PULL_REQUEST_TEMPLATE.md` — la Definition of Done de
  CLAUDE.md §13 en cases à cocher (item « Outillage » de TODO.md).
- ✅ **`new data/` retiré** (corbeille Windows, pas effacé : il contenait les deux `.mov`
  sources de Bui Cosmic et Berry Summer, déjà convertis et intégrés).
- ✅ **CI de #112 verte** : le E2E échouait depuis le 12 (clic intercepté par la boîte de
  consigne en 1280×720) — réécrit avec le verrou du bouton Défier.
- ✅ **`scripts/purge_git_history.sh` corrigé** : il purgeait « tout blob > 5 Mo » et aurait
  effacé badges et wallpapers de l'arbre ; il ne cible plus que les anciens `.gif` AOA.
- ✅ **PR ouvertes** : #112 (ce lot) ; #104/#106 dependabot `vitest`/`coverage-v8` 4 → 5
  (majeure, à traiter à part — lot d'outillage) ; **#62 dependabot `jsdom` vise `main`**
  (antérieur à `target-branch: develop`) → à fermer, une PR équivalente vers `develop`
  reviendra toute seule au prochain cycle hebdo.

## 1. 🔴 Performance — les images du profil (le vrai problème n° 1 aujourd'hui)

| Dossier                  | Fichiers | Poids  | Format actuel            | Affiché à            |
| ------------------------ | -------- | ------ | ------------------------ | -------------------- |
| `profile/badges/images/` | 63       | 109 Mo | PNG 2048×2048, 6–8 Mo/u  | 80 px (200 px zoomé) |
| `profile/Wallpaper/`     | 38       | 115 Mo | PNG 1696×2528, 6–7 Mo/u  | fond de page         |
| `img/avatar/`            | 175      | 27 Mo  | mixte                    | 60–120 px            |
| `database/portraits/`    | 204      | 14 Mo  | webp                     | ok                   |

**Ouvrir la grille des badges = jusqu'à 109 Mo de PNG** pour un joueur ; un wallpaper = 6 Mo
pour un fond. Sur mobile c'est le premier goulot, avant les AOA. Le média est en cache 7 jours
(`.htaccess`), donc un joueur régulier ne le paie qu'une fois par semaine — mais chaque
nouveau joueur, chaque navigation privée, chaque « vider le cache » le repaie.

**Action (mécanique, sans changer l'art — Léo valide le rendu)** : convertir en WebP
`badges` à 512×512 q85 (≈ 40–60 Ko/u → ~3 Mo total, ×35) et `Wallpaper` à 1696 de large
q80 (≈ 250–400 Ko/u → ~12 Mo, ×9), remplacer les 63 `.png` dans `badgesData.js` et les
chemins wallpaper (DB `wallpapers.image_path` + `profile/theme.js`), garder les PNG sources
hors dépôt (dossier partagé Léo) ou dans `assets/sources/` si on veut les versionner. Un
script `scripts/optimize_images.js` (sharp) avec `--check` en CI empêcherait le retour d'un
PNG de 7 Mo. **Gain : −210 Mo dans l'arbre, page profil 20× plus légère.**

## 2. 🔴 Performance — les animations AOA les plus lourdes

77 `.webp` (74 + 3 orphelins `Mount_Ice`, `Mount_Wind`, `Wind_V`, jamais référencés, 20 Mo à
supprimer) : médiane 7 Mo, mais **25 fichiers > 30 Mo, max 80 Mo (Akihiko)**. Le pipeline
validé en 2.2 (`scale=1280:-2, fps=24, libwebp_anim q80`) donne 8 Mo pour Bui Cosmic. La
section §2 historique (juin) le demandait déjà, ce n'est pas fait.

**Action** : réencoder les 25 fichiers > 30 Mo avec le pipeline 2.2, comparer visuellement 3
d'entre eux (Léo), remplacer dans le dépôt **et sur R2** (`npm run aoa:check`… voir §6 —
script à récupérer de la PR #113 fermée, il est indépendant de la décision « hors git »).
Gain joueur : −60 % sur le mode le plus lourd. Gain dépôt : −700 Mo dans l'arbre (l'historique
grossira du poids des nouveaux fichiers, ~200 Mo, puis la purge §3 s'applique).

## 3. 🟠 Dépôt git — 3,8 Go, et quoi faire

Mesuré (`git rev-list --objects --all | git cat-file --batch-check`) : **1,82 Go de `.webp`
AOA (gardés — philosophie « clone = jouable »)**, **1,28 Go d'anciens `.gif` AOA** (62 blobs,
plus aucun suivi), 0,22 Go de docs d'anciennes versions, le reste = code. Deux options,
compatibles entre elles :

1. **Purger les anciens `.gif`** — `scripts/purge_git_history.sh` (corrigé aujourd'hui) :
   3,8 → ≈ 2,5 Go. Réécriture d'historique → force-push, re-clone Léo/Damien, `reset --hard`
   Hostinger, aucune PR ouverte. Procédure pas à pas : TODO.md § « Dépôt git ». **Décision
   Hamza, créneau après release.**
2. **Git LFS pour `allOutAttackMode/database/allOutAttack/*.webp`** (section §1 historique) :
   un `git clone` continue de télécharger les animations (jouable en local, philosophie
   respectée), mais chaque *nouvelle version* d'une animation ne s'empile plus dans les packs.
   Coût : quota LFS GitHub (1 Go stockage / 1 Go bande passante gratuits, puis 5 $/50 Go) —
   avec 1,8 Go d'animations et chaque clone qui les tire, **le quota gratuit ne tient pas** :
   à chiffrer avant (≈ 5–10 $/mois), sinon rester sans LFS et ne purger que l'historique.

## 4. 🟠 Sécurité & anti-triche — état réel, et la marche suivante

**Solide** (vérifié) : PDO préparé partout, bcrypt, sessions httpOnly, CSRF double-submit,
CORS liste blanche, CSP sur l'API (`default-src 'none'`) et sur les pages (`'unsafe-inline'`
assumé, vanilla sans build), HSTS, `X-Frame-Options`, rate limits (login 5/15 min, register,
reset 3/15 min, friends 10, messages 20, sessions 90, admin 300/5 min), `.htaccess` qui
interdit `.git`, `sql/`, `tests/`, `scripts/`, configs. Psalm taint + PHPStan en CI.

**Le trou de fond — l'anti-triche est en phase 1 (détection)** : `api/sessions.php` recalcule
la cible attendue et **logue** l'écart (`error_logs`, source `anti_cheat`) sans rejeter. Et
plus profond : la partie se joue **entièrement côté client** — cible, essais, résultat et
`time_ms` sont déclarés par le navigateur. Un `POST /api/sessions` forgé `{result:'win',
attempts:1, time_ms:800}` monte au classement. Les « manual » badges (~46) s'obtiennent par un
`POST /api/badges/unlock` forgé (section §7 historique).

**Marche 1 (2.2 ou 2.3, une journée)** : `SELECT COUNT(*), user_id FROM error_logs WHERE
context->'$.source'='anti_cheat' GROUP BY user_id` en prod — si zéro faux positif depuis la
2.1, **passer en rejet** (`jsonError('Target mismatch', 422)` à la place du log) sur la
première session du jour. Ajouter un flag `users.suspicious_count` incrémenté à chaque
rejet, visible dans l'admin.

**Marche 2 (2.3, le vrai anti-triche, ~1 semaine)** : *le serveur tient la partie*.
`POST /api/game/start` → le serveur tire la cible (même algo), crée une ligne
`game_rounds (id, user_id, mode, date, target, started_at, attempts, status)` et renvoie un
`round_id` **sans la cible** ; `POST /api/game/guess {round_id, name}` → le serveur compare
et renvoie le feedback (les colonnes 🟩🟨🟥 sont calculées côté serveur) ; la session finale
est déduite de `game_rounds`, plus déclarée. Conséquences : `attempts`, `time_ms`, `result`
deviennent incontestables ; le classement et les badges « manual » liés à une partie
deviennent vérifiables ; le mode anonyme garde l'algo client (rien à protéger). C'est le
seul moyen de rendre le classement *protégé* et pas seulement *observable*. Les 6 modes
partagent déjà `gameCore` → un seul client à écrire.

**Vérifié en passant, rien à faire** : `display_errors` forcé à `0` hors dev
(`api/bootstrap.php`) ; la prod sert déjà **brotli** (`curl -I https://personadle.net/js/gameCore.js`
→ `Content-Encoding: br`, Hostinger compresse au niveau serveur, inutile de l'ajouter au
`.htaccess`). **Un seul durcissement court** : `Permissions-Policy: camera=(), microphone=(),
geolocation=()` manque dans `.htaccess` (une ligne, aucune fonctionnalité ne les utilise).

## 5. 🟠 Cache & chargement

- `Cache-Control` : `no-cache` sur HTML/JS/CSS/JSON (revalidation, 304), 7 j sur les médias,
  1 an sur les polices — cohérent, documenté dans `.htaccess`. Le service worker fait du
  network-first sur le code. **Rien à changer**, sauf le point suivant.
- **Aucun nom de fichier n'est haché** → impossible de mettre `max-age` long sur JS/CSS.
  Un `?v=` manuel traîne sur certains liens (`global.css?v=12`, `profile-page.css?v=7`) et
  pas d'autres : incohérent, et chaque bump touche 20 fichiers. **Action 🟡** : un script
  `scripts/stamp_assets.js` qui réécrit `?v=<hash court du contenu>` dans les HTML au
  pre-commit — même sans build step, ça rend le cache long possible (1 an, `immutable`).
- **Polices** : `font/` n'héberge que `Persona5Font.ttf` ; Oswald, Playfair, Cinzel, Abril
  viennent de Google Fonts sur chaque page (2 connexions tierces, FOUT au chargement) →
  auto-héberger les 4 en `.woff2` dans `font/` (cache 1 an `immutable` déjà prévu par le
  `.htaccess`), et retirer `fonts.googleapis.com` de la CSP.
- `index.html` fait **153 Ko** (le modal « Nouveautés » embarque 5 versions × 6 langues) :
  charger le contenu des versions passées à l'ouverture du modal (fetch d'un fragment) ou
  ne garder inline que la version courante — −100 Ko sur la page d'accueil.
- `sw.js` : `CACHE_VERSION` à bumper à la release (checklist), OK.

## 6. 🟠 Automatisations à ajouter

| Quoi                                          | Comment                                                                                  | Bloque ? |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Images trop lourdes / mauvais format          | `scripts/check_assets.js` : refuse un PNG > 500 Ko ou une image > 2048 px hors AOA        | CI       |
| Animations AOA ↔ R2                           | `npm run aoa:check` (script de la PR #113, à reprendre tel quel : HEAD sur chaque nom)   | release  |
| Migration jouée en prod avant merge main      | `scripts/check_prod_schema.php` existe — l'appeler dans le job « PR base guard » vers `main` | CI       |
| Chiffres de doc                               | déjà `docs:fix` au pre-commit ✅                                                          | —        |
| Pools quotidiens                              | déjà `pools:check` ✅                                                                     | —        |
| Rappel de bump `CACHE_VERSION`                | test unitaire : si `git diff develop..HEAD` touche `css/` ou `js/` et pas `sw.js` → warning en CI (non bloquant) | CI |
| Purge des `rate_limits`, `error_logs`         | cron `purge-rate-limits.php` existe ; ajouter une rétention 90 j sur `error_logs`        | cron     |
| Dependabot                                    | grouper `vitest`+`@vitest/*` (déjà) ; ajouter `ignore: major` sur `jsdom`/`vitest` pour ne recevoir que les mineures, et traiter les majeures en lot trimestriel | —   |
| Captures de référence des 6 modes             | `E2E_VISUAL=1` existe (hors CI) ; les figer **avant** la PR layout                       | manuel   |

## 7. 🟡 Documentation — 48 fichiers `.md`, quoi garder

Ce qui est vivant et sain : `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `DEPLOY.md`,
`TODO.md`, `ROADMAP.md`, ce fichier, un README par dossier (23), `tests*/README.md`, les
`DEV_CHANGELOG.md` par version.

À nettoyer (une PR `docs/`, sans risque) :

- `docs/superpowers/specs/*.md` (2 specs d'avril, nom de dossier hérité d'un outil) →
  `docs/specs/` ou les sections « Décisions » de `api/README.md` ; supprimer `superpowers/`.
- `PersonaDLE 2.0/TEST_PLAN.md` (1408 lignes) + `TEST_PLAN_DEV.md` (635) + `2.1/TEST_PLAN.md`
  (505) : plans de test manuels d'une version livrée — soit archivés dans un
  `PersonaDLE_Update_Documentation/archive/`, soit résumés en 30 lignes « ce que couvre
  l'E2E aujourd'hui » dans `tests-e2e/README.md` (qui existe déjà).
- `PersonaDLE 2.0/DOCKER_GUIDE.md` (335) vs `docker/README.md` (221) : deux guides Docker.
  Fusionner dans `docker/README.md`, garder un lien.
- `sql/explication.md` (590) vs `sql/README.md` (88) : même sujet ; fusionner.
- `PersonaDLE 1.1/PersonaDLE_Update.md` + `note_ajout.md` : archive 1.1, ok mais à déplacer
  dans `archive/` pour que le dossier ne montre que le vivant.
- `README.md` (709 lignes) : la section « Development Setup » dit « 1014 unit tests » (auto),
  mais le badge « tests passing » et le tableau des modes datent — 3 chiffres à raccrocher à
  `check-doc-numbers.js` (`syncPoints`) plutôt qu'à corriger à la main.
- Une seule occurrence restante de `HamzaKarrouchi` (DEV_CHANGELOG 2.2, historique — normal).

## 8. 💡 Idées par page et par mode (à trancher — rien n'est fait)

**Transversal (tous les modes)**
- **Partage du résultat du jour** façon Wordle (`🟩🟨🟥` × essais + lien) — copie presse-papiers
  + `navigator.share` sur mobile. Il n'existe que la carte de profil. C'est le premier levier
  de croissance d'un daily game, et c'est 60 lignes dans `gameCore` (les 6 modes ont déjà
  l'historique des essais).
- **Résumé du jour sur l'accueil** : 6 pastilles ✓/✗/– (joué, gagné, pas encore) et le
  streak, à la place des 6 boutons muets — le joueur voit ce qui lui reste.
- **Barre de saisie sticky + compactage** (PR layout déjà décidée).
- **Notification quotidienne** (PWA `Notification` + `sw.js` `push`, opt-in) à l'heure du
  reset — retient les joueurs à streak. Demande un backend VAPID (petit) ou, plus simple,
  une notification locale planifiée quand l'app est ouverte.
- **Calendrier de streak** sur le profil (grille 30 jours par mode, façon GitHub).
- **Onboarding 20 s** : au premier lancement, une bulle par mode (« Classique = devine avec
  des indices colorés ») — beaucoup de joueurs ne comprennent le code couleur qu'après 3 jours.

**Classique** — 🟩🟨🟥 déjà là. Idées : indice « arcane » payant (coûte 1 essai) ; un mode
« sans indice » chronométré pour le classement Expert ; l'historique des essais rejouable
après victoire (« comment j'ai deviné »).

**Emoji** — révélation progressive (un emoji de plus par erreur) ; « thème du jour » (les
3 emojis ont un fil rouge) ; permettre la lecture à voix haute des emojis (a11y).

**Silhouette** — flou dégressif OK ; idée : **silhouette animée** (pose d'attaque, 2 frames) en
Expert ; indice « opus » à 3 erreurs ; la révélation finale avec le portrait couleur qui
« s'allume » (déjà ? à vérifier).

**All-Out Attack** — poids (§2) avant tout. Idées : « image fixe » à 2 erreurs (une frame de
l'animation), ; défi « 5 AOA d'affilée » le week-end ; badge par opus complété.

**Personae** — masque d'accents corrigé en 2.2. Idées : afficher **l'arcane** comme premier
indice, **l'élément** comme second ; un mini « Compendium des personas devinées » (le
Compendium sait déjà lister les premières victoires).

**Music** — Heardle-like : extrait qui **s'allonge** à chaque erreur (2 s → 4 → 8 → 15) au lieu
d'un extrait fixe ; « chanté / instrumental » comme filtre ; paroles Expert existantes.

**Profil / Compendium** — badges en WebP (§1) ; **page « Statistiques »** séparée (distribution
des essais par mode, comme Wordle) ; le Compendium déjà public → bouton « partager mon
Compendium » (lien) ; export JSON du profil déjà là.

**Amis** — 3 onglets OK ; idées : **fil d'activité** (« Yu a battu ton défi Emoji », « Naoto
a atteint rang 5 avec toi ») alimenté par `messages` + `social_link_rankup_notifs` déjà en
base ; défi **hebdomadaire** automatique entre amis (7 jours, cumul des essais).

**Classement** — `day`/`week`/`month` lisent un cache horaire (TODO) ; `friends_only`
existe déjà côté API — le mettre en avant (onglet « Mes amis » par défaut quand on en a) ;
anti-triche §4 d'abord, sinon le classement ne vaut rien.

**Admin** — mono-langue FR (choix) ; ajouter un onglet **« Anti-triche »** : les `error_logs`
source `anti_cheat` groupés par joueur, avec bouton « invalider la session » — préalable à
la marche 1 du §4.

## 9. 📌 Ordre conseillé

1. 🔴 **Merge #112** (CI verte), release 2.2 avec migration 040 + bump `CACHE_VERSION`.
2. 🔴 **Images du profil en WebP** (§1) — PR mécanique, 1 journée, gain immédiat pour tous.
3. 🔴 **Réencodage des 25 AOA lourds** (§2) + upload R2 + `aoa:check` en checklist release.
4. 🟠 **PR layout** (sticky input) — déjà décidée.
5. 🟠 **Anti-triche marche 1** (rejet) après lecture des logs prod ; **marche 2** planifiée 2.3.
6. 🟠 **Partage du résultat du jour** (§8) — le plus gros levier produit pour le moins d'effort.
7. 🟡 Purge des `.gif` (§3) au premier créneau calme ; docs (§7) ; compression/`Permissions-Policy`
   (§4) après un `curl -I` sur la prod.

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

### Audit de pré-release 2.1 (2026-09-01)

Passé sur la surface ajoutée par la 2.1 (4 nouveaux endpoints PHP, 7 modifiés, le diff front).
Psalm `--taint-analysis` : **aucune erreur**. Rien de bloquant trouvé. Vérifié un par un :

- Gardes d'auth et `RewriteRule` présentes sur les 2 nouveaux endpoints (`api/user/expert_status.php`,
  `api/admin/user_expert.php`) — le piège documenté en CLAUDE.md §7 n'a pas été rejoué.
- `api/admin/user_expert.php` : `requireAdmin()` en tête (auth → vérification `is_admin` en base →
  403 → rate limit partagé), `userId` casté et son existence vérifiée, mode validé contre la source
  unique plutôt qu'une liste recopiée, actions journalisées, et un retrait ne peut pas fermer un
  accès **mérité**.
- Classement : `$mode`/`$period`/`$metric` en liste blanche `in_array(..., true)` ; `$limit`/`$offset`
  castés `int` et bornés **avant** leur interpolation dans `LIMIT`/`OFFSET` ; `getFriendIds()` fait
  `array_map('intval')` avant l'`IN (...)`. Interpolations sûres.
- Sessions Expert : `403` si le mode n'est pas débloqué (`api/sessions.php`).
- Rate limits en place : messages 20/15 min, sessions 90/15 min, admin 300/5 min.
- Front : aucun XSS dans le diff 2.1 — le pseudo passe par `textContent`, et les `innerHTML`
  n'interpolent que des nombres et des chaînes i18n internes.

**Deux points ouverts, hérités et assumés — pas des régressions 2.1 :**

- 🟠 **L'anti-triche serveur est en phase 1 : détection seulement.** `api/sessions.php` recalcule la
  cible attendue et **logue** l'écart au lieu de rejeter la session, le temps de confirmer l'absence
  de faux positifs en prod. Conséquence : le classement n'est pas encore *protégé*, seulement
  *observable*. **Action après le déploiement 2.1** : surveiller les logs `anti_cheat` quelques
  jours, puis basculer en rejet.
- 🟠 **`condition_type = 'manual'` renvoie toujours `true`** dans `personadle_verify_condition()`.
  Un `POST /api/badges/unlock` forgé suffit donc à décrocher n'importe lequel des ~46 badges à flag
  narratif. Fermer ce trou demanderait de journaliser la cible de chaque partie côté serveur. Le
  choix est documenté dans les migrations 033 et 038 — et surtout : ne **pas** utiliser `'manual'`
  pour un badge dont la condition est réellement recalculable.

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

> ✅ **Ciblé pour la v2.1** (décision du 2026-07-06, voir ROADMAP.md § v2.1) : les points #1 et #2
> ci-dessous ne sont plus "au fil de l'eau" — version cible fixée.

1. 🔴 **Git LFS + purge d'historique** (#1) — assets restent en local (philosophie du projet), débloque juste le poids du `.git`.
2. 🔴 **Réencoder les AOA** (#2) — gros gain perf immédiat pour les joueurs.
3. ~~🟠 **Tests PHP + flux streak intégré** (#3).~~ ✅ _fait — voir §3._
4. ~~🟠 **Mapping de modes unifié** (#5) + **validation de données en CI** (#4.3).~~ ✅ _fait —
   voir §5/§4.3 (un choix de design reste ouvert sur les libellés courts, pas un bug)._
5. ~~🟠 **Nettoyer/intégrer `new data/`** proprement (#4.1, #6).~~ ✅ _fait — voir §4.1/§6._
6. 🟡 Le reste (sécu, CI, i18n, a11y) au fil de l'eau — seuls points encore ouverts :
   contrastes `--color-accent` (§9, décision de design Léo), stratégie Git LFS (#1) et
   réencodage AOA (#2), toujours en 🔴.
