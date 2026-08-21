# TODO — backlog post-v2.1

> État au 2026-08-21, après le merge de la PR #69 dans `develop`.
>
> Ce fichier suit **le travail restant sur la v2.1 et ce qui vient juste après**. Le périmètre
> produit reste dans `ROADMAP.md` ; le détail commit par commit dans
> `PersonaDLE_Update_Documentation/PersonaDLE 2.1/DEV_CHANGELOG.md`.
>
> Chaque section numérotée est dimensionnée pour tenir dans **une seule branche**.
>
> Vérifié le 2026-08-21 : 778 tests Vitest (38 suites), 102 tests E2E, lint et PHPStan 2.2.8
> propres. `develop` est 80 commits devant `main`.

---

## 🚨 Bloquant release — avant la PR `develop → main`

Le merge dans `develop` ne déploie rien. C'est la PR `develop → main` qui déclenche le
`git pull` Hostinger : **le code arrive avant le schéma**.

- [ ] Jouer `sql/migrations/031_game_sessions_is_expert.sql` en prod (MariaDB, garder les
      `IF NOT EXISTS`). Sans elle : `Unknown column 'is_expert'` à chaque partie Expert.
- [ ] Jouer `sql/migrations/032_sessions_count_every_game.sql` — **dans cet ordre** : sa
      colonne est déclarée `AFTER is_expert`, que la 031 crée. Sans elle :
      `Unknown column 'client_session_id'` à chaque partie.
- [ ] Backup avant la 032 — elle supprime une contrainte d'unicité (aucune donnée effacée,
      mais le retour arrière exigerait de dédoublonner à la main).
- [ ] **Changelog joueur** (`PersonaDLE 2.1/PersonaDLE_Update.html`) — il ne contient **aucune**
      entrée Expert, pour aucun des 6 modes. Le lot entier est à écrire d'un bloc.

> ✅ Les deux migrations ont été **rejouées pour de vrai** le 2026-08-21 contre une base vierge
> au schéma pré-migration, puis une seconde fois pour l'idempotence : schéma final identique à
> `sql/bdd_mysql.sql`, rejeu sans erreur. Elles portent désormais `IF EXISTS` / `IF NOT EXISTS`.
> Chemin de prod : SSH + `mysql --delimiter='$$'`, jamais phpMyAdmin.

---

## 1. Porte d'entrée du Mode Expert — **à faire AVANT la release**

Les 6 modes Expert sont aujourd'hui **ouverts à tout le monde** : le bouton ⚡ est visible et
cliquable par n'importe qui.

**Pourquoi c'est cette section-ci qui presse, et pas les classements** : c'est le seul lot de
ce fichier dont la fenêtre se referme. Une fois la v2.1 en prod, restreindre un accès que les
joueurs ont déjà est perçu comme un retrait, pas comme une progression. Après la release, ce
lot n'est plus faisable proprement — les autres le restent tous.

Bonne nouvelle sur le coût : `api/lib/condition_check.php` gère déjà `mode_wins` avec
`condition_mode`. La règle « Classique Expert après N victoires en Classique » est donc une
**ligne de données**, pas du nouveau code de condition.

- [ ] Choisir la condition par mode (reco : `mode_wins` sur le mode normal correspondant —
      lisible, déjà mesurée, et elle apprend le mode avant d'en durcir la règle).
- [ ] Seed SQL des conditions + **1 badge et 1 titre** de déblocage (mêmes colonnes
      `condition_type` / `condition_mode` / `condition_value` que `titles` et `badges`).
- [ ] **Vérification serveur obligatoire** dans `api/sessions.php` : refuser `is_expert = 1`
      si la condition du mode n'est pas remplie. Le mode vit dans l'URL — un gate purement
      client se contourne en tapant `?expert=1`.
- [ ] Endpoint (ou extension d'un existant) qui rend l'état de déblocage des 6 modes, pour
      que le front n'ait pas à le deviner.
- [ ] Front : griser le bouton ⚡ avec la condition en clair, et rediriger `?expert=1` vers le
      mode normal tant qu'elle n'est pas remplie.
- [ ] i18n 6 langues (EN d'abord) pour le libellé de condition et la notification de déblocage.
- [ ] Tests : condition serveur refusée/acceptée (PHPUnit), redirection front (E2E), et
      l'invariant « un mode Expert non débloqué ne peut pas enregistrer de session ».

## 2. Les trois classements

Décidé le 2026-08-15, détaillé dans `ROADMAP.md`. **Le prochain gros morceau**, mais il peut
partir après la release : ajouter des axes de tri n'enlève rien à personne.

- [ ] **Meilleure série** — la streak existe déjà, il manque l'axe de tri.
- [ ] **Meilleur ratio** — lissé. Reco : moyenne bayésienne `(wins + C·m)/(games + C)`, C ≈ 20,
      plutôt que Wilson : un classement dont personne ne comprend le calcul passe pour truqué.
      Le garde-fou actuel est un seuil brut (`IF(COUNT(*) >= 5, …)`) qui laisse encore 5/5 =
      100 % devant 200/210.
- [ ] **Meilleur score** — général et par mode.
- [ ] Chaque axe décliné en version Expert (`is_expert`), soit la 4e dimension déjà prévue.

> Décision produit confirmée le 2026-08-21 : le classement compte des **parties**, pas des
> jours. 100 victoires jouées valent 100. La régularité, c'est la streak ; le rapport
> victoires/parties, c'est le ratio. Chaque métrique fait un seul métier.

## 3. Défis déjà bloqués en base

Le correctif du 2026-08-15 empêche d'en créer de nouveaux, **il ne répare pas l'existant**.
Bug qui touche des joueurs **aujourd'hui en prod** — branche courte, valeur immédiate.

- [ ] Migration de nettoyage ponctuelle : repasser en `unread` les `messages` en statut
      `accepted` sans partie associée et vieux de plus de 7 jours. Non idempotente par nature
      — ne pas la rejouer sur des défis récents légitimement en cours.
- [ ] Bouton « abandonner le défi en cours ». Sans lui le blocage se reproduira à la première
      panne réseau au mauvais moment, et il n'existe aujourd'hui aucune sortie.
      `getPendingActiveChallenge()` fournit déjà l'état ; il manque l'action inverse (purge
      d'`activeChallenge`, restauration des filtres, statut serveur remis à `read`).

## 4. Défis en Mode Expert

Aujourd'hui l'Expert **n'émet pas** de défi et **n'en joue pas** — neutralisé volontairement.
À faire **après** la section 1 : proposer des défis sur un mode pas encore débloqué n'a pas
de sens.

- [ ] Colonne `challenge_is_expert` sur `messages`.
- [ ] Tirage de la cible du défi restreint au pool Expert côté émetteur.
- [ ] Les deux points d'acceptation (`js/challenge-notif.js`, `profile/friends/friends.js`)
      doivent ajouter `?expert=1` à l'URL.
- [ ] Barème : un défi Expert ne se compare qu'à un défi Expert.
- [ ] Retirer les gardes centrales de neutralisation : `js/gameCore.js`
      (`getActiveChallengeTarget()`, `showChallengeButton()`), `js/challenge-result.js`
      (`checkChallengeCompletion()`), et la redirection de `musicsMode/modeMusic.js`. Les
      3 gardes `!EXPERT.isExpert` de `modePersonae.js` sont devenues redondantes.

## 5. Sécurité — **autre branche** (décision Hamza, 2026-08-19)

Le volet **dépendances est déjà réglé par construction** : `package.json` n'a aucune
dépendance de production, il n'y a pas de `composer.json`, `npm audit --omit=dev` sort 0
vulnérabilité. Le risque vit dans les 61 fichiers PHP écrits à la main.

- [ ] **PHPStan en mode taint sur `api/`** — déterministe, gratuit, jouable en CI à chaque PR.
      Meilleur rapport effort/résultat, à faire **avant** strix.
- [ ] **strix** (pentest autonome, Apache 2.0) — exploration ponctuelle. Jamais contre
      `personadle.net` (il attaque réellement et écrit en base), uniquement contre la stack
      locale sur base jetable ; budget LLM fixé d'avance ; sortie traitée comme des hypothèses,
      **jamais** comme une porte de CI (non déterministe).
- [ ] **Anti-triche : la cible n'est vérifiée que sur la 1re session du jour**
      (`$hasSessionToday`, `api/sessions.php`) — et pour une bonne raison : un replay tire une
      cible aléatoire côté client, l'écart y est normal. Conséquence : un client qui poste
      directement sur `/api/sessions` peut enregistrer des parties inventées
      (`target_name`, `attempts`, `time_ms` arbitraires) jusqu'au rate limit (90 / 15 min).
      Le fix qui ne coûte rien au joueur normal : valider `target_name` contre le pool du mode
      (`api/data/daily_pools.json` est déjà chargé par `daily_target.php`).
- [ ] Cibles prioritaires : IDOR sur `api/user/*`, contournement de `requireAdmin()`, absence
      de jeton anti-CSRF (sessions en cookie httpOnly), abus de la logique de défis.

---

## Outillage

- [ ] **CI : rejeu de migration sur base vierge.** CLAUDE.md §13 l'exige, rien ne le vérifie —
      la CI charge `bdd_mysql.sql`, qui contient déjà le schéma d'arrivée, donc **aucun
      environnement ne rejoue jamais `sql/migrations/*`**. Fait à la main le 2026-08-21, pas
      automatisé. Blocage réel : les migrations utilisent `ADD COLUMN IF NOT EXISTS`, syntaxe
      MariaDB que MySQL 8.0 refuse — un job de replay demande de les réécrire en procédure
      stockée, ou de faire tourner la CI sur MariaDB.
- [ ] **PHPStan installé en `releases/latest`** dans `.github/workflows/ci.yml` — le build
      n'est pas reproductible. C'est ce qui a fait rougir le job PHP sur trois commits sans
      qu'une ligne change (2.2.2 → 2.2.8). Arbitrage à trancher : pinner (déterministe, on
      rate les nouvelles détections) ou garder `latest` (c'est lui qui a attrapé la garde
      morte `$expertModes`).
- [ ] **Déploiement : étape de migration** dans le hook Hostinger, ou règle écrite « migration
      en prod avant merge vers main ». Aujourd'hui le code précède systématiquement le schéma.
- [ ] **Template de PR GitHub** reprenant la Definition of Done de CLAUDE.md §13, pour la
      rendre exécutable au lieu de la laisser en prose.
- [ ] **5 PR dependabot ouvertes** — dont `vitest` 2 → 4, une majeure qui touche 778 tests.
      **Uniquement des devDependencies** : maintenance d'outillage, pas un sujet de sécurité.
      Lot à part.
- [ ] **Skill projet « rituel de livraison »** — `docs:fix`, `pools:build`, entrée
      `DEV_CHANGELOG.md`, migration rejouée, i18n EN d'abord, `.htaccess` pour tout nouveau
      `.php`. Déjà dans CLAUDE.md, mais en prose ; une skill le rendrait exécutable.
- [ ] **Aucun test PHPUnit sur le score du classement.** Vérifié à la main seulement.

---

## Points ouverts pour Hamza

- [ ] **4 dessins de personas P1 non détournés** (`Houri`, `Bres`, `Mot`, `Verdandi`) — fond
      blanc ou papier, visible en jeu. À arbitrer avec Léo.
- [ ] **`Orpheus ( Male )` porte la fiche de la famille Orpheus** — c'était la seule entrée du
      dataset capable de la recevoir, le `.md` ne connaissant qu'« Orpheus ». À confirmer.
- [ ] **AOA Expert et les skins recolorés** — 10 familles (Wonder ×4, Closer ×3, Starlight…)
      partagent silhouette et pose. En noir et blanc au flou maximal elles seront
      vraisemblablement indistinguables. Risque signalé, arbitré « on garde ». À revoir si les
      joueurs le remontent.
- [ ] **Latence du classement `day` / `week` / `month`** — ils lisent `leaderboard_cache`,
      alimenté par un cron **horaire**. Seul `ever` est immédiat. Un joueur qui enchaîne une
      soirée ne se voit pas monter en direct dans le classement du jour. À revoir si ça gêne.
- [x] **Seuil d'abandon en Expert** — fixé à 5 dans les 6 modes, validé à l'usage.
- [x] **`new data/` non suivi par git** — dossier absent, plus rien à faire.

## Dette repérée en passant

- [ ] **Débordement horizontal de `.nav-item`** (barre du bas) sur mobile, commun aux 6 modes.
      `.audio-wrapper` et `.expert-lyrics-wrapper` ont été corrigés ; la barre non.
- [ ] **`personadle_expert_stats_by_mode()` fait du N+1** — un recalcul de streak par mode.
      Assumé (`ponytail:` posé dans le code), à matérialiser si la page profil ralentit.
- [ ] **Variantes cosmétiques sans fiche de lore** — 14 entrées (`* Picaro`, `Orpheus Telos`,
      `Orpheus ( Female )`) exclues du pool Personae Expert. Choix assumé : leur lore serait
      mot pour mot celui de la persona de base. À rouvrir seulement si on leur écrit un texte.
- [ ] **Tests E2E sensibles à la charge en local.** Avec 4 workers et `retries: 0`, un test
      différent échoue par intermittence (contention PHP-FPM). En CI `retries: 2` l'absorbe.
      Piste : plafonner `workers` en local, ou augmenter le pool PHP-FPM du conteneur de dev.
- [ ] **Noms de personnages en dur dans les specs E2E** — plusieurs specs devinent des noms
      fixes en supposant qu'ils sont faux. Selon la date, l'un d'eux peut être la cible : la
      partie se gagne et le test échoue pour une raison sans rapport. Un helper partagé
      « devine N mauvaises réponses » réglerait la classe entière.
- [ ] **Stats qui reculent après une coupure réseau** — les sessions en file
      (`pendingSessions`) ne sont pas décomptées à l'affichage, et `pullProfileFromCloud()`
      écrase le local par le backend. Antérieur à la v2.1. Le fix demande de réconcilier la
      file avec le backend au rendu.

---

## Bugs tranchés — ne pas rouvrir sans élément nouveau

- [x] **« 50 victoires non sauvegardées »** — deux causes, les deux corrigées. (1) Le design
      d'alors n'enregistrait qu'une session par jour : levé par la migration 032. (2) Le rate
      limit de `api/sessions.php` (`15 / 15 min`), calibré pour ce monde-là, devenait le
      plafond effectif et coupait à la **16e partie d'affilée** — sans rien perdre, mais sans
      rien compter non plus, et le compteur *reculait* au `pullProfileFromCloud()` suivant.
      Porté à `90 / 15 min`. Vérifié de bout en bout : 50 victoires classique le même jour
      donnent `games=50`, `wins=50`, classements `ever` et `day` à 50, badges `mode_wins ≥ 50`
      / `mode_games ≥ 30` / `games_total ≥ 25` débloqués.
- [x] **Refonte des stats** — câblage client et serveur terminés, `sessions-same-day.spec.js`
      le prouve côté serveur, `expertWiring.test.js` verrouille le câblage des 6 modes.
