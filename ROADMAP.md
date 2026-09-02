<div align="center">

# 🗺️ ROADMAP — PersonaDLE

<img src="https://img.shields.io/badge/version-2.0-brightgreen?style=for-the-badge" alt="v2.0">
<img src="https://img.shields.io/badge/prochaine-pré--prod-orange?style=for-the-badge" alt="next">

> **Document vivant.** En haut : ce qui reste à faire (priorisé). En bas : l'historique de ce qui est livré.

</div>

**Légende** — Priorité : 🔴 tôt · 🟠 qualité · 🟢 produit · 🔐 sécurité · ❓ décision &nbsp;|&nbsp; Statut : 📋 planifié · 💡 idée · 🚧 en cours

---

## 🗄️ Migrations SQL à appliquer sur Hostinger (prod)

> `sql/bdd_mysql.sql` est la source de vérité pour Docker/local, mais **rien ne l'applique
> automatiquement sur Hostinger** — chaque migration doit être poussée à la main en prod
> (SSH + `mysql --delimiter='$$' < fichier.sql` si procédure stockée, sinon import normal,
> voir CLAUDE.md §7/§10). Cette liste évite d'en oublier une entre deux déploiements ;
> cocher une fois réellement appliquée en prod, pas juste mergée sur `develop`.

- [ ] `sql/migrations/022_fix_aigis_title_condition.sql` — corrige le titre
  `aigis_i_am_not_afraid`, qui ne pouvait jamais se débloquer en prod (`condition_mode`
  jamais seedé pour aucun titre). PR #14.

---

## 🚀 v2.1 — Prochaine version (périmètre décidé le 2026-07-06, étendu le 2026-07-31, révisé le 2026-08-13)

> La 2.0 part en prod sans attendre ces points — ils avancent en parallèle une fois livrée.
> Priorité pas encore fixée entre eux. Mis de côté pour l'instant, sans version cible :
> Mode Versus temps réel (chantier temps réel plus lourd), notifications push PWA, et carte
> récap périodique — restent en idée dans 🟢 Produit ci-dessous. Groupes d'amis : en réflexion,
> pas encore tranché.

- [ ] **Mode Expert** — révision 2026-08-13 : **plusieurs tentatives comme en mode normal**
  (pas de tentative unique — trop punitif sur du contenu ambigu, ex. skins AOA recolorés
  indiscernables en un seul coup d'œil). Principe commun : un indice de **départ nettement plus
  pauvre qu'en mode normal**. Certains modes le gardent figé toute la partie (Classique, AOA),
  d'autres le font évoluer par essai raté mais avec un point de départ et/ou un rythme bien plus
  dur que le mode normal (Musique, Silhouette, Personae — détails ci-dessous). Mécanique
  spécifiée par mode le 2026-08-13 :
  - Classique : seule la citation (`quote`) est donnée, aucune autre catégorie affichée, sur
    toute la partie — indice figé
  - Émoji : encore à définir — le mode normal est déjà considéré difficile de base, donc l'écart
    Expert pourrait être plus faible que sur les autres modes ; aucune mécanique tranchée
  - AOA : flou figé au niveau initial (le plus flou) **+ image en noir et blanc** — deux filtres
    CSS cumulés, indice figé, aucun nouveau mécanisme ni contenu à produire. À valider avant de
    livrer : sur les familles de skins recolorés (silhouette/pose identiques, ex. lignes
    "Starlight"/"Summer"), le N&B cumulé au flou max ne doit pas rendre deux entrées de la même
    famille indiscernables — sinon exclure ces entrées du pool Expert ou ne garder qu'un seul
    des deux filtres pour elles
  - Silhouette : garde la logique de dézoom déjà utilisée en mode normal (`modeSilhouette.js` —
    zoom CSS `scale()` de 1.8 à 1, -0.2 par essai raté jusqu'au plein cadre) — indice figé côté
    mécanique, aucun nouveau système. Seul changement : le **point autour duquel on zoome est
    tiré au hasard sur la silhouette**, au lieu du centre fixe de l'image utilisé en mode
    normal. ⚠️ Un point purement aléatoire peut tomber en plein milieu de l'aplat noir uniforme
    (silhouette rendue via `filter: brightness(0)`) et ne rien montrer d'exploitable au 1er
    essai — le tirage doit être contraint à des zones qui touchent un contour de la silhouette,
    pas un pixel random sur toute l'image (ex. quelques points d'ancrage pré-repérés par
    personnage plutôt qu'un tirage libre)
  - Personae : **aucune image**. Indice par défaut = texte biographique/historique de la
    persona (origine mythologique ou littéraire réelle), **nom et alias du personnage retirés
    du texte** — ex. pour Arsène (Arsène Lupin) : retirer à la fois "Arsène" et son alias
    "Raoul" du texte source. Après un certain nombre d'essais ratés, le joueur peut **demander
    un indice supplémentaire** : un second texte, la description physique/design de la persona
    en jeu (ex. notes de Shigenori Soejima sur le design d'Arsène), même traitement de retrait
    de nom. Implications :
    - **Seul mode nécessitant un vrai nouveau mécanisme** (les 5 autres ne font que dégrader un
      indice existant) : bouton "demander un indice" gated par un nombre d'essais ratés, état à
      tracker pendant la partie (indice demandé ou non)
    - **Deux textes par persona** à rédiger/sourcer par Hamza (au lieu d'un) ; retrait des noms
      fait manuellement à la rédaction, pas de traitement dynamique côté client
    - Le texte biographique est **traduit** (i18n complet, 6 langues) ; à confirmer si le
      second texte (description physique) l'est aussi — probablement oui, même régime
    - Sourcé par Hamza, livré **par paquet** (Persona 3 d'abord, Persona 4 ensuite, etc.).
      Implique un flag "a du contenu Expert" par persona, à intégrer au pool de tirage
      quotidien (`scripts/export-daily-pools.js`, `npm run pools:build`/`pools:check`) pour que
      la cible du jour en Expert Personae ne pioche que parmi les persos déjà couverts par un
      paquet livré
    - **Réponses acceptées** (décision 2026-08-15) : une fiche décrit une figure mythologique,
      pas une entrée précise du dataset — elle accepte donc **tous les manieurs de toutes les
      entrées de la même figure**. La fiche d'Orphée vaut pour Makoto, Kotone et Aigis (5
      entrées avec les variantes Picaro/Telos) ; celle d'Hermès pour Junpei Iori **et** Jun
      Kurosu, dont les personas sont deux entrées distinctes (dessins différents) du même dieu
      grec. Refuser l'un des deux serait perçu comme un bug : rien dans le texte ne permet de
      les départager. Règle déjà implémentée et testée —
      `personaeMode/database/expert_lore/wielders.js`, 4 tests dans `tests/expertContent.test.js`.
  - Musique : paroles révélées progressivement à chaque essai raté, cumulatives (les précédentes
    restent affichées, pas juste la dernière) — façon lecteur de paroles synchronisées type
    Spotify : 1 phrase pour commencer, une de plus par essai raté. Paroles à sourcer en ligne
    par Hamza, pas besoin de la chanson complète — il s'arrête où il juge avoir assez de texte
    pour le mode. Pas de i18n nécessaire (parole = parole dans sa langue d'origine, même
    traitement que les titres de musique déjà exemptés côté §5 CLAUDE.md). N'existent pas
    encore dans `musicsMode/database/songs.js`
  - Condition de déblocage **différente par mode** (à trancher au cas par cas au moment de
    l'implémentation, pas de règle uniforme entre les 6). **À coder sur une branche dédiée**
    (décision 2026-08-15) — le mode Music Expert est livré déverrouillé, le bouton
    « ⚡ Expert mode » (`musicsMode/musics.html`) est visible et cliquable par tout le monde.
    Ce qu'il faudra brancher :
    - la condition elle-même passe par `api/lib/condition_check.php`
      (`condition_type`/`condition_mode`/`condition_value`), déjà partagé par
      titles/badges/wallpapers — pas de système parallèle à inventer
    - vérification **côté serveur obligatoire** (CLAUDE.md §13) : un gate purement client
      serait contournable en tapant `?expert=1` à la main, puisque le mode vit dans l'URL
    - piste retenue pour Music : X victoires en Music normal (valeur à fixer) ; le compte
      est déjà lisible dans `user_stats` (mode `music`, `is_expert` exclu par construction)
    - côté front : masquer/griser le bouton et rediriger `?expert=1` vers le mode normal
      tant que la condition n'est pas remplie
  - Récompense **supérieure au mode normal**, surtout en **défi ami** (voir item "Bonus XP
    Social Link" juste en dessous — logique mise à jour suite à cette révision)
  - Nouveau badge/titre : débloqué une fois les 6 modes Expert battus au moins une fois chacun
    (réutilise le système de conditions structurées déjà en place, `condition_check.php`)
  - **Défis déjà bloqués en base** — le correctif du 2026-08-15 empêche d'en créer de
    nouveaux, il ne répare pas l'existant. Décision : **les deux**, dans cet ordre.
    1. Migration de nettoyage ponctuelle : repasser en `unread` les `messages` en statut
       `accepted` sans partie associée et vieux de plus de 7 jours. Ponctuel, à jouer une
       fois en prod, non idempotent par nature (ne pas le rejouer sur des défis récemment
       acceptés et légitimement en cours).
    2. Bouton « abandonner le défi en cours » côté joueur — sans lui, le même blocage se
       reproduira à la première panne réseau au mauvais moment, et il n'existe aujourd'hui
       aucun moyen de sortir d'un défi accepté. `getPendingActiveChallenge()` (gameCore.js)
       fournit déjà l'état à afficher ; il manque l'action inverse (purge de
       `activeChallenge`, restauration des filtres, statut serveur remis à `read`).
  - **Défis en Mode Expert** — à coder sur la branche dédiée, avec le déblocage
    (constaté le 2026-08-15 en livrant Music Expert). Aujourd'hui l'Expert **n'émet pas**
    de défi et **refuse** d'en jouer un : ouvrir `musics.html?expert=1` avec un défi actif
    redirige vers le mode normal. Raison : un défi porte un barème (nombre d'essais) et une
    cible ; joué en Expert le barème n'est plus comparable (5 à 30 essais contre 3), et la
    cible peut être un instrumental, qui n'a aucune parole à révéler. Ce qu'il faudra :
    - colonne `challenge_is_expert` sur `messages` (même forme que `is_expert` sur
      `game_sessions`, migration 031) — sans elle le destinataire ne peut pas savoir en
      quel mode le défi a été émis
    - tirage de la cible du défi restreint au pool `music_expert` côté émetteur
    - les deux points d'acceptation (`js/challenge-notif.js` et `profile/friends/friends.js`,
      cf. `MODE_PAGE`) doivent ajouter `?expert=1` à l'URL du mode
    - barème : 1 défi Expert ne se compare qu'à un autre défi Expert. Le bonus XP prévu
      ci-dessous (x2/x3 sur le mutuel) s'y branche naturellement.
- [ ] **Bonus XP Social Link selon la performance en défi** — actuellement XP mutuel fixe (35)
  sur un défi battu (`checkChallengeCompletion()`, `js/challenge-result.js`). À faire varier
  selon le nombre de tentatives utilisées — **pas le temps** : déclaratif côté client, donc plus
  facile à trafiquer qu'un nombre d'essais qui découle directement du jeu réel. Pour un défi
  joué en **Mode Expert** (révision 2026-08-13 : Expert a maintenant plusieurs tentatives comme
  le mode normal, donc la comparaison d'essais entre les deux joueurs redevient possible — le
  bonus n'est plus justifié par "pas de comparaison possible" mais par la difficulté du mode
  lui-même, indice dégradé qui ne s'améliore pas) : bonus significatif à part (x2/x3 sur le
  mutuel normal) pour avoir battu le défi en Expert, à brancher sur `GET /api/user/compare`
  déjà existant (comparaison de stats entre amis, +10/+20 XP, cooldown 72h) plutôt que
  d'inventer un système parallèle.
- [ ] **Connexion rapide Discord** — 📅 **reporté en 2.2** (arbitrage Hamza, 2026-08-27).
  Un temps envisagé dans la 2.1 avec les classements et les défis Expert, puis sorti du lot :
  c'est le seul des cinq qui touche à l'**authentification**, le plus risqué (flow OAuth,
  migration, liaison de comptes), et le seul dont la valeur ne dépend pas d'être livré
  maintenant. Le décaler ne retire rien aux joueurs — les quatre autres lots, eux, sont faits.
  À grouper avec la **vérification d'e-mail** ci-dessus : les deux touchent le même code
  d'inscription, les faire ensemble coûte bien moins cher que séparément.

  **Ordre retenu : lier d'abord, inscrire ensuite.** Lier est strictement additif (le compte
  reste e-mail + mot de passe, Discord devient une identité en plus). L'inscription via
  Discord, elle, change le modèle de compte — des comptes sans mot de passe, ce qui ruisselle
  sur la réinitialisation, la suppression RGPD, et laisse le joueur sans accès si Discord
  tombe ou s'il quitte la plateforme. Faire la liaison d'abord signifie que l'inscription
  réutilisera ensuite une machinerie déjà éprouvée.

  (lier un compte existant + option à l'inscription, comme "Sign in with Google" sur d'autres
  sites) — compatible avec le modèle sessions PHP actuel (OAuth vérifie l'identité, puis
  session normale ouverte comme un login classique, pas de JWT).
  Points à trancher à l'implémentation :
  - Discord ne garantit pas un email vérifié → touche directement l'item "vérification d'email
    à l'inscription" ci-dessous, à voir ensemble
  - Liaison à un compte existant **uniquement depuis le profil en étant déjà connecté** (bouton
    "Lier Discord"), pas d'auto-merge automatique par correspondance d'email — évite la classe
    de risque prise de compte par email
  - Schéma minimal : colonne `discord_id` (unique) + `discord_username` sur `users`, pas de
    table `oauth_accounts` séparée tant qu'un seul provider existe
  - `discord_id` = donnée personnelle → à intégrer au flow RGPD existant (suppression/export)
- [ ] **Classements séparés plutôt qu'un score unique** (décision 2026-08-15, suite à la
  migration 032 qui fait compter toutes les parties). Un classement au volume récompenserait
  celui qui enchaîne 200 parties plutôt que le meilleur joueur. Trois axes distincts :
  - **Meilleure série** — la régularité, déjà mesurée par la streak (jours distincts).
  - **Meilleur ratio** — victoires / parties, **lissé** pour qu'un joueur à 1 partie et
    1 victoire ne soit pas premier. Deux méthodes possibles : moyenne bayésienne
    `(wins + C·m) / (games + C)` avec `m` le taux moyen global et `C` ≈ 20 parties
    fictives (simple à expliquer au joueur), ou borne inférieure de Wilson à 95 %
    (plus rigoureuse, plus dure à expliquer). Recommandation : bayésienne, parce qu'un
    classement dont personne ne comprend le calcul est perçu comme truqué.
  - **Meilleur score** — général et par mode, sur le volume assumé.
  Chaque axe existe aussi en version Expert (`is_expert`), soit la 4e dimension déjà prévue
  ci-dessous.
- [ ] **Filtre "Expert" sur le classement** — `api/leaderboard/` distingue déjà mode / période /
  métrique ; ajouter une 4e dimension (colonne `is_expert` sur `game_sessions`) plutôt qu'un
  classement séparé — réutilise tout le pipeline existant (endpoint, agrégation `user_stats`,
  cache horaire) au lieu d'un système parallèle.
- [ ] **Compendium des unlocks** — vue "archive" style Persona (icône livre, aura Velvet Room),
  structurée en **chapitres** : Naissance (inscription), Amitié (demandes acceptées + montées de
  rang Social Link), Badges, Titres, Wallpapers, Défis (1ère victoire, records), Mode Expert
  (1ère complétion par mode + badge 6/6), Compte lié (Discord), Streaks (record, récupérations
  Jack Frost). Aucune nouvelle donnée serveur nécessaire pour la quasi-totalité :
  `badges_unlocked`/`user_titles` déjà en base avec dates, et les montées de rang Social Link
  sont déjà loggées avec timestamp (`social_link_rankup_notifs`, jamais purgé, juste marqué vu).
- [ ] **Petits fixes trouvés lors de l'audit PR #57, laissés de côté à l'époque** — inclus dans
  ce lot puisque Mode Expert retouche de toute façon les 6 modes :
  - `uniqueDaysPlayed` incohérent entre modes : un give-up compte pour Music/AllOutAttack/
    Personae mais pas pour Classic/Emoji/Silhouette
  - Texte des titres `naoya_first_awakening`/`maya_always_be_positive` mentionne "avec filtre
    P1/P2" alors que la vraie condition (serveur et client) ne vérifie aucun filtre
- [ ] **Historique de profil** : graphe de streak + calendrier des jours joués (`uniqueDaysSet` déjà en base).
- [ ] **Saison / ladder** avec reset périodique + récompenses.
- [ ] **Vérification d'email à l'inscription** (confirmer l'adresse avant activation complète) — détail dans 🔐 Sécurité/compte ci-dessous.
- [ ] **Stratégie assets AOA + Git LFS** — détail dans 🔴 À prévoir assez tôt ci-dessous.
- [ ] **CRUD Badges (admin)** — proposé par Hamza le 2026-07-19 suite au bug event_codes/badge_id
  (voir DEV_CHANGELOG.md même date) : formulaire admin pour créer un badge (nom, description,
  image en drag & drop, code événement optionnel, dates optionnelles) sans passer par SQL/SSH.
  **Piège identifié à l'analyse — pas un simple formulaire** : le rendu client actuel ne lit
  PAS la table `badges`, il duplique chaque badge dans 2 fichiers statiques —
  `profile/badges/badgesData.js` (`badgesList`, avec fonction `check()` de vérif client) et
  `lang/*.json` (bloc `badges.<slug>.{name,condition,description}` par langue). Un badge créé
  uniquement en DB via le CRUD serait débloquable côté serveur mais **invisible dans l'UI**
  (pas dans la grille, pas compté, pas d'image) tant que ces 2 fichiers ne sont pas mis à jour
  en code — donc la promesse "badge en ligne sans coder" ne tient que si on va jusqu'au bout :
  - **Phase A** (petite) : CRUD "bookkeeping" honnête sur ses limites — écrit dans `badges` +
    upload image validé (jamais SVG, `getimagesize()`, nom de fichier dérivé du slug côté
    serveur, pas du nom client) + audit log (`badge.create`/`update`/`delete`, même convention
    que `badge.grant`/`badge.revoke` déjà utilisés pour l'octroi par joueur). Gain réel : plus
    la classe de bug event_codes qu'on vient de fixer, un seul endroit pour gérer un badge —
    mais le badge reste invisible joueur tant que `badgesData.js`/`lang/en.json` n'ont pas
    été touchés en code.
  - **Phase B** (le vrai chantier) : faire de `badges` la source unique — `badgesManager.js`
    consomme directement `GET /api/badges` (qui résout déjà `name_{lang}` server-side) au lieu
    de `badgesData.js`. Là seulement le CRUD tient sa promesse. Refactor plus profond, pas
    pour un simple ticket.
  - **Trouvé en creusant, indépendant du CRUD mais à corriger avant d'en créer plus** :
    `condition_type = 'manual'` retourne toujours `true` dans `personadle_verify_condition()`
    → n'importe quel utilisateur connecté peut débloquer n'importe quel badge `manual`
    directement via `POST /api/badges/unlock {badge_id}`, sans code ni jeu (déjà vrai
    aujourd'hui pour `burn_my_dread`, `velvet_headache`, `twin_blade`, etc.). Si le CRUD
    facilite la création de badges "à coder plus tard" (donc `manual` par défaut), il
    vaudrait le coup d'ajouter un `condition_type='code_only'` qui retourne `false` dans
    `/unlock` — le seul chemin de déblocage resterait `/api/badges/redeem`. Un `case` de
    plus dans `condition_check.php`.
  - **Décision (2026-07-19)** : reporté à la v2.1, pas d'implémentation pour l'instant.

---

## 🎯 Prochaines étapes

### 🔴 À prévoir assez tôt

- [x] **Conditions badges/wallpapers en colonnes structurées** — ✅ _livré (migration
  `sql/migrations/021_structured_badge_wallpaper_conditions.sql` + `bdd_mysql.sql` mis
  à jour). `badges`/`wallpapers` ont maintenant les mêmes colonnes structurées que
  `titles` (`condition_type`/`condition_mode`/`condition_value`), vérifiées par
  `api/lib/condition_check.php` — extrait de l'ancien `verifyTitleCondition()`
  (`api/titles/index.php`), **une seule** fonction générique désormais partagée par
  les 3 tables au lieu de 3 mappings slug→logique divergents (`api/badges/index.php`,
  `api/wallpapers/index.php` réécrits pour l'utiliser). 15/60 badges et 5/7 wallpapers
  ont une condition réellement structurable (le reste : flags narratifs multi-persos,
  redeem de code événement, ou vérifié par un autre endpoint — `condition_type='manual'`,
  documenté explicitement plutôt que laissé `NULL` en silence). Corrige au passage 2
  badges (`velvet_regular` 50 jours uniques, `best_bro` 2+ amis) qui étaient
  structurellement calculables mais bypassés par erreur de mapping (toujours `true`).
  3 nouveaux `condition_type` ajoutés au vocabulaire (`mode_games`, `games_total`,
  `social_link_min_rank`). `tests/php/ConditionCheckTest.php` (22 tests) +
  `tests/php/BadgeWallpaperCatalogTest.php` (7 tests, dont un qui prouve que chaque
  seuil réel du catalogue est respecté à l'exacte frontière value-1/value), même
  pattern que `DatabaseIntegrationTest.php` — confirmé vert par la CI réelle après
  un aller-retour (un bug de garde-fou sur `social_link_min_rank` a été attrapé et
  corrigé grâce à elle)._
- [ ] **Stratégie assets AOA** (~1,8 Go dans git) — 🎯 _cible 2.1._ Git LFS (**pas** CDN-only/sortir
  les assets du repo — option explicitement écartée, voir AMELIORATIONS.md §1 : casse la
  philosophie "un `git clone` suffit pour jouer", Git LFS reste compatible avec elle). Migration
  des binaires lourds (`.webp`/`.mp3`/`.mp4`) + `scripts/purge_git_history.sh` (prêt, destructif,
  à coordonner) pour purger le poids déjà accumulé + `.gitattributes` LFS. Réencodage AOA en
  parallèle (webp q70 : 37-81 Mo → 9-25 Mo par fichier, voir AMELIORATIONS.md §2).

## 📆 À venir — contenu conditionné à une sortie de jeu

> ⚠️ **Ce n'est pas une liste de tâches à faire maintenant.** Rien à faire tant qu'aucun des
> jeux ci-dessous n'a de date/contenu officiel confirmé — c'est la procédure de référence
> pour **le jour où** ça arrive (nouveau perso ajouté, ou remaster d'un jeu déjà supporté),
> pour ne pas avoir à la refaire de mémoire à ce moment-là. Aucune de ces étapes ne bloque
> la release 2.0 actuelle.

**Kotone Shiomi (P5X)** : roster de base + silhouette + persona (Orpheus) + All-Out-Attack
— teaser P5X confirmé. GIF AOA actuel = `allOutAttackMode/database/allOutAttack/Kotone.webp`
(fan-made P3P, à remplacer par l'animation officielle P5X une fois publiée).

![Kotone Shiomi — teaser P5X](img/kotone-p5x.webp)

**Kotone Shiomi (P3/P3P/PQ2) — GIF AOA actuel = fan-made, à remplacer une fois sorti sur P5X** :
portrait/silhouette/persona sont bien de l'artwork officiel (P3P), mais l'animation All-Out-Attack
(`allOutAttackMode/database/allOutAttack/Kotone.webp`) est un **fan-made imaginant un design
"P3 Reload FeMC"** — les jeux originaux (P3/P3P, 2009-2010) n'ont jamais eu de cinématique
All-Out-Attack (mécanique introduite dans des jeux plus récents), donc aucune animation
officielle n'existe pour elle à la source. **P5X va lui en donner une vraie** (même mécanisme que
Fuuka, dont le GIF AOA de ce projet vient de P5X plutôt que de P3 d'origine) — à remplacer une
fois ce contenu P5X publié, pas de date connue.

> ✅ **Incohérence d'opus corrigée (2026-07-06)** : confirmé qu'elle n'apparaît pas dans P3 Reload
> (uniquement P3P) — le tag `"P3R"` de `silhouetteCharacters.js` était bien une confusion avec le
> design du fan-art AOA ci-dessus. `aoaCharacters.js` (`["P3","P3P"]` → `["P3P"]`, PQ2 non
> applicable — absent du vocabulaire d'opus de ce mode) et `silhouetteCharacters.js`
> (`["P3","P3R"]` → `["P3P","PQ2"]`, PQ2 supporté ici) alignés sur `characters_clean.js`.
> `npm run data:check`/`pools:check` ✅ après régénération de `api/data/daily_pools.json`.

Deux cas différents, qui touchent des fichiers différents :

**A. Nouveau jeu de la licence (roster inédit)** — ex. Persona 6, Metaphor: ReFantazio, SMT.
Le jour où un personnage doit être ajouté, toucher dans cet ordre :

1. `database/characters_clean.js` — fiche perso (nom, genre, âge, persona, arcane, opus…)
2. Déposer les assets bruts (portrait, GIFs AOA, musique) dans `incoming/<type>/<persona-snake_case>.<ext>`
   (`type` ∈ `portrait`/`aoa`/`music`/`misc`) puis `npm run ingest:check`
   (`scripts/validate_incoming.js`) — valide le nommage snake_case et l'extension avant
   d'intégrer quoi que ce soit dans `database/`/`<mode>/database/`. Le script valide
   uniquement (pas de renommage/optimisation automatique) — à faire à la main avant dépôt.
3. `database/personas.js` — ajouter le nom à la liste d'autocomplétion (Classic)
4. `database/quotes.js` — citation(s) du perso
5. `database/portraits/*.webp` + `database/portraitsMap.js` — portrait + mapping nom→fichier
6. `allOutAttackMode/database/aoaCharacters.js` + `personas_allOut.js` + `portraitsMap.js` + GIFs — équivalent AOA
7. `silhouetteMode/database/`, `personaeMode/database/`, `musicsMode/database/` — mêmes ajouts côté silhouette/personae/musique si le perso a un thème musical propre
8. `emojiMode` — séquence d'emojis pour le nouveau perso
9. `profile/avatars_data.js` + `img/avatar/` — nouveaux avatars de profil (PDP) groupés par jeu
10. `musicsMode/database/songs.js` + `musicTitles.js` + fichiers audio — OST du nouveau jeu
11. **Filtres opus** — ajouter le nouveau code opus (ex. `"P6"`) au tableau `ALL_OPUS` de **chaque** mode (`classiqueMode`, `emojiMode`, `silhouetteMode`, `personaeMode`, `musicsMode`, `allOutAttackMode`) pour qu'il apparaisse dans le panneau de filtres
12. `npm run data:check` (`scripts/validate_characters.js`) — doit passer sans erreur sur le nouveau roster

**B. Remaster/Revival d'un jeu déjà supporté (assets seulement)** — ex. Persona 4 Revival
(remplace P4/P4G comme Persona 3 Reload a remplacé les artworks P3 d'origine).

1. Mêmes assets bruts déposés dans `incoming/<type>/...` + `npm run ingest:check` avant remplacement (voir cas A, étape 2)
2. Remplacer les portraits (`database/portraits/*.webp`) par le nouvel artwork officiel
3. Remplacer les GIFs AOA correspondants si Atlus republie des animations
4. Vérifier si le nouvel opus doit être **distinct** dans les filtres (`P4R` séparé de `P4`/`P4G`)
   ou **fusionné** (même roster, juste un artwork mis à jour) — décision à prendre au cas par cas
5. Pas de changement sur `personas.js`/`quotes.js` si les personnages restent les mêmes

→ Le jour où ça devient récurrent, envisager un script `scripts/add_character.js` qui
scaffolde les entrées dans tous les fichiers concernés plutôt que de suivre cette liste à la main.

**Jeux à surveiller** (aucune action tant que rien n'est officiellement annoncé) :

<table>
<tr>
<td width="50%" align="center">

<img src="docs/roadmap/persona-4-revival.jpg" width="280" alt="Persona 4 Revival"><br>
<b>Persona 4 Revival</b><br>
Remaster — cas B (remplacement d'assets P4/P4G)

</td>
<td width="50%" align="center">

<img src="docs/roadmap/persona-6.jpg" width="280" alt="Persona 6"><br>
<b>Persona 6</b><br>
Nouveau jeu — cas A (roster inédit)

</td>
</tr>
</table>

### 🟠 Qualité / robustesse

- [x] **Responsive + a11y** des nouvelles modales (avatar, musique, couleurs) — ✅ _livré (`js/modal.js`, focus trap + Escape + restauration du focus, réutilisé par avatarCropModal/sharePreviewModal/songModal/titlesModal). Vérifié en Playwright/Chromium (Tab/Shift+Tab cantonné, crop modal OK en viewport mobile 375px)._
- [x] **Couverture PHP** : tests d'intégration par endpoint critique (`sessions`, `social-links/interact`, `recover-streak`) — ✅ _livré (logique extraite dans `api/lib/game_session.php`/`streak_recovery.php`/`social_link_interaction.php`, endpoints réduits à de fins wrappers, tests dans `tests/php/DatabaseIntegrationTest.php`). Écrit dans un sandbox sans MariaDB/Docker, donc jamais exécuté par la session qui l'a écrit — mais **confirmé vert depuis par la vraie CI** (job "PHP Lint & Tests" → "Run PHPUnit (logic + DB integration)", run [28751031317](https://github.com/HamzaKarrouchi/personadle/actions/runs/28751031317), contre une vraie MariaDB)._
- [x] **Check i18n « valeur == EN »** — ✅ _livré (`scripts/check-i18n-untranslated.js`, `npm run i18n:check-untranslated`, avertissement pre-commit sur `lang/*.json` staged). Premier passage : 0 vraie traduction manquante, uniquement des correspondances attendues (noms, opus, lore, placeholders — voir §5 de CLAUDE.md)._
- [x] **Observabilité prod** — ✅ _livré, option self-hosted choisie (pas de dépendance externe) : table `error_log` (migration 019) + `personadle_log_error()` (`api/lib/error_log.php`) + panel admin "🪵 Logs" (recherche, filtre par niveau, pagination). Câblé dans les 3 endpoints critiques traités ci-dessus (sessions, recover-streak, social-links interact) ; le reste des `error_log()` existants dans le codebase n'a volontairement pas été balayé (portée bien plus large, décision distincte). Pas de handler d'exception global ajouté à bootstrap.php — changerait le comportement de TOUTE l'API sans pouvoir être vérifié en sandbox, jugé trop risqué pour ce lot._
- [x] **Panel admin — contrôle étendu** (audit trail, RGPD, rate limits) — ✅ _livré : table `admin_audit_log` (migration 020) + `personadle_log_admin_action()` câblé sur toutes les mutations admin (ban/unban, grant/revoke admin, badges/titres/wallpapers, event codes, social links, hard delete) + panel "📋 Audit" ; visibilité + déclenchement manuel anticipé des `deletion_requests` RGPD (logique extraite de `api/cron/hard-delete.php` vers `api/lib/deletion_requests.php`, réutilisée par le cron et l'admin) + panel "🗑️ RGPD" ; visibilité + purge manuelle des `rate_limits` + panel "⏱️ Rate Limits". **Confirmé vert par la vraie CI** : `tests-e2e/admin.spec.js` (users/audit_log/rate_limits) + `tests-e2e/admin-extended.spec.js` (event_codes/error_logs/deletion_requests/social_links/dons utilisateur, 24 tests, PR #13) tous exécutés avec succès contre un vrai stack Docker (job "E2E Playwright", run [28751031317](https://github.com/HamzaKarrouchi/personadle/actions/runs/28751031317)). News in-game (actuellement HTML statique sans BDD) volontairement laissée hors scope — portée trop différente pour ce lot._
- [x] **Dédupliquer l'autocomplete et le dark-mode inline entre les 6 modes** — ✅ _déjà résolu pour
  la partie réellement dupliquée : `js/autocomplete.js` extrait `closeAutocompleteList()`,
  `closeAllAutocompleteLists()` et `removeFromAutocomplete()` (identiques à 100% dans les 6 modes),
  et `applyDarkModeOverrides()` (`js/gameCore.js`) est la seule implémentation du dark-mode, chaque
  mode se contentant d'un court appel de config. `initializeAutocomplete()` elle-même reste
  volontairement propre à chaque mode (debounce, cache `_acCurrentArray`/`_acInitDone`, filtres
  opus actifs, chemins de portraits, handler de clic tous divergents entre les modes) — la
  réunifier sans pouvoir vérifier visuellement les 6 pages serait risqué pour un gain incertain._
  _Réaudité le 2026-07-05, relecture complète des 5 implémentations, même conclusion._

### 🟢 Produit (idées — sans version cible pour l'instant)

> **Mode Expert, historique de profil, saison/ladder, compendium des unlocks** : passés en
> 🚀 v2.1 ci-dessus (décision du 2026-07-06) — plus dans cette liste.

- [ ] **Mode Versus / défi temps réel** entre amis — écarté pour la 2.1 (chantier temps réel
  plus lourd que les autres points retenus), reste en idée.
- [ ] 💡 **Groupes d'amis** (au-delà du 1-à-1) — petits groupes ("table du Velvet Room") avec
  leaderboard privé. Étend `friendships`/`leaderboard` au-delà des paires Social Link
  (implique une nouvelle table de groupe + permissions à définir). **En réflexion**, pas
  encore de décision de version.
- [ ] **Notifications push (PWA)** — rappel quotidien (levier de rétention « daily ») — écarté
  pour la 2.1, reste en idée.
- [ ] 💡 **Carte récap périodique** (façon "wrapped") — parties jouées, victoires, mode préféré,
  streak sur la période. Distincte de la carte de profil déjà livrée (`profile/share-card.js`,
  instantané figé de l'état actuel) — réutiliserait la même génération d'image/mêmes thèmes avec
  des données agrégées dans le temps à la place. Hebdo vs mensuel pas tranché. **En réflexion**,
  pas de version cible, probablement pas 2.1.

### 🔐 Sécurité / compte

- [x] **Reset de mot de passe par email** — ✅ _livré (request-reset / reset-password, token hashé 1h, page dédiée)._
- [ ] **Vérification d'email à l'inscription** (confirmer l'adresse avant activation complète) — 🎯 _cible 2.1._
- [x] **Anti-triche sur les résultats de partie** — 🚧 _phase 1 livrée (détection), phase 2
  (rejet strict) délibérément différée. Correction factuelle au passage : il n'existe **aucune**
  table `daily_targets` en BDD (ni dans `sql/bdd_mysql.sql`, ni dans les migrations) — l'ancienne
  formulation de ce point l'affirmait à tort. Chacun des 6 modes calcule sa cible via un algorithme
  seedé différent (`getDailyTarget()`, FNV-1a sur `seedId|date|mode`), avec un repli conditionnel
  sur le filtre opus actif pour AllOutAttack et Personae — pas une simple lecture de table._
  >
  > `scripts/export-daily-pools.js` exporte les pools JS (source de vérité) vers
  > `api/data/daily_pools.json` (vérifié en CI, `npm run pools:check`) ; `api/lib/daily_target.php`
  > porte l'algorithme FNV-1a et les deux replis conditionnels en PHP (vérifié par comparaison
  > croisée directe avec `getDailyTarget()` sous Node sur des dizaines de combinaisons
  > seed/date/mode/filtre) ; `api/sessions.php` recalcule la cible attendue et logue un écart
  > (`error_log`, source `anti_cheat`) **sans rejeter la requête** — le temps de confirmer en
  > prod l'absence de faux positifs, même principe que le critère "10 runs verts" avant de
  > rendre le job E2E bloquant (`tests-e2e/README.md`). Prérequis découvert et corrigé au passage :
  > `AllOutAttack`/`Personae` n'envoyaient jamais leur filtre opus actif dans `active_filters`
  > (toujours `[]`), rendant la validation de leur repli impossible — corrigé pour qu'ils
  > l'envoient comme le fait déjà Classique.
  >
  > **Phase 2 (rejet strict)** : à activer une fois confirmé en prod (logs `error_log` source
  > `anti_cheat`) que 0 faux positif ne s'est produit sur une période à définir. Distinct du
  > point ❓ ci-dessous (badges à flags) : celui-ci touche l'intégrité des sessions elles-mêmes,
  > donc le leaderboard en entier.
  >
  > ⚠️ **Limitation trouvée en review (PR #13)** : pour AllOutAttack/Personae, `$activeFilters`
  > est accepté tel que soumis par le client sans être corrélé à un état côté serveur (aucune
  > session ne mémorise le filtre opus réellement actif) — un client peut donc soumettre
  > n'importe quel sous-ensemble de codes opus pour faire correspondre le recalcul serveur au
  > nom qu'il veut faire valider, contrairement à Classic/Emoji/Silhouette/Music (pas de repli
  > filtré, donc pas contournables ainsi). À corriger (filtre stocké côté serveur, pas re-soumis
  > par le client) avant d'activer le rejet strict pour ces 2 modes spécifiquement — voir le
  > commentaire en tête de `api/lib/daily_target.php`.

### ❓ Décisions de design à trancher

- [ ] **Abandon casse-t-il le streak ?** Aujourd'hui **non** (streak global = jours _joués_). Beaucoup de daily games cassent au give-up.
- [ ] **Durcir l'anti-triche des badges à flags ?** Crus sur parole — OK fan-game, à durcir si leaderboard « propre » (lié aux conditions structurées).

---

<details>
<summary><b>✅ Déjà livré — historique (v1 → v2.0) — cliquer pour déplier</b></summary>

> Synthèse : backend PHP/MariaDB complet (auth, sessions, social, leaderboard, admin, RGPD),
> profil personnalisable (avatars groupés, musique, couleurs, badges, titres, wallpapers),
> Social Link rangs 1-10, défis, streak globale + Jack Frost, FAQ, i18n 6 langues,
> **894 tests JS · 241 PHPUnit · 113 E2E · PHPStan niveau 5 · CI/CD GitHub Actions**.

### Backend & Infrastructure

| #   | Fonctionnalité                                 | Notes                                                                            |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| B1  | Schéma BDD (24 tables, MySQL/MariaDB)          | `sql/bdd_mysql.sql` = source de vérité + migrations `sql/migrations/` (000→020)   |
| B2  | API auth — register / login / logout / me      | Sessions PHP httpOnly, remember-me hashé, **reset mot de passe** (email)          |
| B3  | API sessions + streak par-mode & **globale**   | Calcul serveur (`api/lib/streak.php`), frontière Paris, contrat de schéma testé   |
| B4  | API user — GET/PATCH/DELETE + stats + migrate  | Migration localStorage→BDD idempotente                                            |
| B5  | Sync offline-first (`savePendingSession`)      | Fallback localStorage si offline                                                  |
| B6  | RGPD — soft delete + anonymisation + hard J+30 | `is_deleted`, `deletion_requests`, cron `hard-delete.php`                         |
| B7  | API amis / leaderboard / social-links          | `api/friends`, `api/leaderboard`, `api/social-links` (XP, anti-spam, mutuel)      |
| B8  | Cloud sync source-of-truth (`cloud-sync.js`)   | `pullProfileFromCloud()` — backend écrase le localStorage                         |
| B9  | Rate-limiting SQL + validation serveur         | Table `rate_limits`, conditions wallpapers/badges validées (anti-triche)         |
| B10 | API Admin (comptes, badges, codes, modération) | `api/admin/` — ban enforcé sur tous les endpoints authentifiés                   |
| B11 | CI/CD GitHub Actions                           | CI (lint, data, i18n, coverage, PHPUnit DB, PHPStan) + **CD auto sur merge main** |

### Système d'Amis & Social Link

| #   | Fonctionnalité                                        | Notes                                                                 |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| S1  | Demandes d'ami (code/pseudo), liste, statut online    | Anti-self, anti-doublon, recherche paginée                            |
| S2  | Social Link rangs 1-10, XP, mutuel ×2, anti-spam      | Logique en PHP pur (`api/lib/social_link.php`, testable sans BDD), **tooltip** d'explication (ex-boutons) |
| S3  | Effet rang 10 — True Confidant                        | Halo doré + burst + typewriter (`css/rank10-effect.css`)              |
| S4  | Comparaison de stats + phrases Persona i18n           | Overlay radar (`database/compare-phrases.js`)                         |
| S5  | Défis quotidiens entre amis (6 modes)                 | Bandeau + post-victoire, give-up = défaite                            |
| S6  | Animations de demande (Calling Card / P4 TV / Evoker) | Choix dans les paramètres                                            |
| S7  | Streak recovery — Jack Frost                          | Cooldown 60j **enforced serveur** (verrou FOR UPDATE), anti-revert    |
| S8  | Rank-up notifié aux **2** joueurs                     | `social_link_rankup_notifs` + polling                                |

### Profil & Personnalisation

| #   | Fonctionnalité                                | Notes                                                                       |
| --- | --------------------------------------------- | --------------------------------------------------------------------------- |
| P1  | Page profil + vue publique (`?view=`/`?uid=`) | Consultable sans login                                                       |
| P2  | Avatars **groupés par jeu** + tags thème      | 168 avatars, en-têtes stylisés (`avatars_data.js`)                          |
| P3  | Musique de profil — **modal visuel** (covers) | Recherchable, groupé par jeu, fallback cover                                |
| P4  | Couleurs **unifiées** + aperçu live           | Bordure avatar + thème en pastilles, preview en direct                      |
| P5  | Badges (60+), titres, wallpapers → backend    | Unlock validé serveur (stats), sélection épinglée persistée + bouton Save   |
| P6  | Carte de profil exportable (PNG)              | `html2canvas`, 8 thèmes, partage X / Discord / Email                        |
| P7  | Cadeaux admin (divine gift), Settings ⚙       | Déduplication des annonces                                                  |

### Leaderboard · Admin · UX

| #   | Fonctionnalité                                  | Notes                                                          |
| --- | ----------------------------------------------- | -------------------------------------------------------------- |
| L1  | Classement mode × période × métrique × scope    | `my_rank` inclus, cron cache, amis-only                        |
| AD1 | Dashboard admin, modération, codes événement    | Accès `is_admin`, attribution badges/titres/wallpapers         |
| U1  | News in-game, page Confidentialité (RGPD)       | i18n 6 langues                                                 |
| U2  | **FAQ enrichie** (32 questions) + bouton report | Report → **GitHub issues** (templates), streak expliqué        |

### Qualité & DevEx

| #   | Élément                                       | Notes                                                                         |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Q1  | Tests : 894 Vitest · 241 PHPUnit · 113 E2E     | `npm test` · `make test-php` · `npm run test:e2e`                             |
| Q2  | i18n EN/FR/ES/DE/IT/PT (1099 clés)             | `npm run i18n:check`                                                          |
| Q3  | PHPStan niveau 5 + ESLint + Prettier          | Dans la CI                                                                     |
| Q4  | Seuils de couverture en CI                    | `npm run test:coverage` (~77 %)                                              |
| Q5  | Docker Compose (DB + PHP + phpMyAdmin + seed) | `make up` — 19 faux joueurs                                                   |
| Q6  | Service Worker offline-first, BASE_URL auto   | network-first JS/CSS                                                          |
| Q7  | CI sur push/PR · **CD auto sur merge main**   | `.github/workflows/` (ci.yml + cd.yml)                                        |

</details>
