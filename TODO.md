# TODO — backlog post-v2.1

> État au 2026-08-26, après le merge des PR #70 → #73 dans `develop`.
>
> Ce fichier suit **le travail restant sur la v2.1 et ce qui vient juste après**. Le périmètre
> produit reste dans `ROADMAP.md` ; le détail commit par commit dans
> `PersonaDLE_Update_Documentation/PersonaDLE 2.1/DEV_CHANGELOG.md`.
>
> Chaque section numérotée est dimensionnée pour tenir dans **une seule branche**.
>
> Vérifié le 2026-08-26 : 1453 tests Vitest (78 suites), 378 méthodes PHPUnit, 258 tests E2E,
> lint et data/i18n/pools propres.

---

## 🚨 Bloquant release — avant la PR `develop → main`

Le merge dans `develop` ne déploie rien. C'est la PR `develop → main` qui déclenche le
`git pull` Hostinger : **le code arrive avant le schéma**.

> 📖 Procédure complète (ordre, sauvegarde, vérification, **retour arrière**) :
> [`DEPLOY.md`](DEPLOY.md) § « Release majeure ». Cette liste-ci ne suit que l'état
> d'avancement.

- [x] Jouer `sql/migrations/029_badge_gyotre.sql` et `030_titles_junes_investigation.sql`.
      **Oubliées de cette liste jusqu'au 2026-09-01** : elles datent du lot de contenu 2.1
      (commits `6f79abb` / `cdb8941`), alors que cette section a été rédigée pendant le
      travail Mode Expert et démarrait donc à 031. Leurs propres en-têtes disent « insère
      sur la prod déjà peuplée », et ni l'une ni l'autre n'est sur `main`. Sans elles, le
      badge secret Gyotre et les titres Junes / Investigation Team n'existent pas en base :
      le code 2.1 les affiche mais personne ne peut les décrocher. `INSERT IGNORE`, donc
      sans risque même si elles avaient déjà été passées à la main.
- [x] Jouer `sql/migrations/031_game_sessions_is_expert.sql` en prod (MariaDB, garder les
      `IF NOT EXISTS`). Sans elle : `Unknown column 'is_expert'` à chaque partie Expert.
- [x] Jouer `sql/migrations/032_sessions_count_every_game.sql` — **dans cet ordre** : sa
      colonne est déclarée `AFTER is_expert`, que la 031 crée. Sans elle :
      `Unknown column 'client_session_id'` à chaque partie.
- [x] Backup avant la 032 — elle supprime une contrainte d'unicité (aucune donnée effacée,
      mais le retour arrière exigerait de dédoublonner à la main).
- [x] Jouer `sql/migrations/033_badge_denial_of_self.sql` (badge Denial of Self) et
      `034_title_shadows_converge.sql` (titre Shadows Converge). Les deux sont
      `INSERT IGNORE`, sans risque et rejouables — mais sans elles le badge et le titre
      n'existent pas en prod, et le joueur ne peut jamais les décrocher.
- [x] Jouer `sql/migrations/038_badge_false_spring.sql` (badge A Gentle Reprieve). Même
      forme que la 033 : `INSERT IGNORE`, rejouable, mais sans elle le badge n'existe pas
      en base.
- [x] Jouer `sql/migrations/040_profiles_favorite_mode.sql` (colonne
      `profiles.favorite_mode`, MariaDB `IF NOT EXISTS`, rejouable). Sans elle :
      `Unknown column 'favorite_mode'` sur **tout** GET /api/user/:id et GET
      /api/user/public — le profil ne charge plus, pas seulement le mode favori.
- [x] Jouer `sql/migrations/041_game_sessions_guesses.sql` (colonne `game_sessions.guesses`,
      MariaDB `IF NOT EXISTS`, rejouable). Sans elle : **tout** `POST /api/sessions` échoue
      (`Unknown column 'guesses'`) — plus aucune partie n'est enregistrée.
- [x] Jouer `sql/migrations/042_moderation_maintenance.sql` (colonnes de ban motivé sur `users`,
      tables `user_notices`, `admin_notes`, `announcements`, `site_settings` ; MariaDB
      `IF NOT EXISTS`, rejouable). Sans elle : **`requireAuth()` plante** (`Unknown column
      'ban_reason'`) — plus aucun appel authentifié ne passe, et `GET /api/auth/me` tombe
      en 500 sur toutes les pages. À jouer **avant** le `git pull` de Hostinger, pas après.
- [x] Jouer `sql/migrations/045_leaderboard_expert_dimension.sql` (colonne
      `leaderboard_cache.is_expert`, clé unique `uq_leaderboard` élargie, index de lecture
      refait ; MariaDB `IF NOT EXISTS`, rejouable). **À jouer AVANT le `git pull` Hostinger.**
      Sans elle, `api/leaderboard/index.php` interroge `lc.is_expert` sur une colonne qui
      n'existe pas : `Unknown column` → **le classement day/week/month tombe en 500 pour
      tout le monde** (la période `ever` survit, elle ne lit pas le cache), et le cron
      horaire échoue à chaque passage. Rejouée pour de vrai le 2026-09-18 contre une base
      vierge au schéma pré-migration, puis une seconde fois pour l'idempotence.
- [x] Jouer `sql/migrations/046_badges_wonder_shujin_go_beyond.sql` (5 badges + titre Go Beyond,
      `INSERT IGNORE`, rejouable). Sans elle, les cinq badges et le titre n'existent pas en base :
      le client tente `POST /api/badges/unlock` sur un slug inconnu (404) et personne ne peut les
      décrocher. Rejouée le 2026-09-18 contre une base vierge (69 badges / 22 titres), puis une
      seconde fois : no-op.
- [x] **Téléverser `allOutAttackMode/database/allOutAttack/Wonder_Shujin.webp` sur le bucket R2**
      (`allOutAttack/Wonder_Shujin.webp`) **avant** `develop → main`. En prod les animations AOA
      sont servies depuis le CDN, pas depuis git : sans l'upload, la cible « Wonder Shujin »
      affiche une image cassée le jour où elle est tirée. Bui Cosmic et Berry Summer ont-ils
      déjà été poussés ? À vérifier au même moment (même lot 2.2).
- [x] Jouer `sql/migrations/047_leaderboard_cache_score_decimal.sql` (`leaderboard_cache.score`
      `int` → `DECIMAL(8,1)`, MODIFY idempotent, rejouable). Sans elle, la métrique winrate du
      classement mis en cache est tronquée à l'entier (73.4 → 73, égalités artificielles). Pas
      bloquante pour le déploiement (aucun crash, et le cache était vide en prod) — à jouer dès
      que possible : `ssh hostinger-personadle mysql u870779941_personadle < sql/migrations/047_leaderboard_cache_score_decimal.sql`
      puis `INSERT IGNORE INTO schema_migrations (version) VALUES ('047_leaderboard_cache_score_decimal')`.
- [x] Jouer `sql/migrations/048_reconcile_prod_id_columns.sql` — **jouée en urgence le 2026-09-18**,
      trente minutes après la mise en prod : le Compendium tombait en 500 (`user_titles.id` absente en
      prod, `ORDER BY ut.id`). Aligne aussi `user_stats.id`, `game_sessions.created_at`,
      `social_link_ranks.name_jp`. Depuis : prod = référence colonne pour colonne.
- [ ] **hPanel → Avancé → Git : re-brancher l'auto-déploiement** sur `CodeByHaamza/personadle`. Il
      est mort depuis le renommage du compte (2026-09-12) : la 2.2 a été tirée à la main
      (`git remote set-url` + `git pull --ff-only` dans le webroot). Tant que ce n'est pas fait,
      chaque merge sur `main` = pull manuel, et « c'est mergé » ≠ « c'est en prod ».
- [ ] **hPanel → Cron : vérifier que `api/cron/leaderboard.php` tourne toutes les heures.** Le cache
      `leaderboard_cache` était vide au moment de la release (0 ligne dans le dump) — il n'a
      probablement jamais tourné. Le classement par période marche en calcul live, plus coûteux.
- [ ] Avant la prochaine release : `npm run schema:check-prod` **sur le serveur** (colonnes ET contraintes UNIQUE depuis la 050), et rejouer toute
      migration qui INSERT contre le `SHOW CREATE TABLE` de la prod recréé dans Docker (CLAUDE.md §7).
- [ ] **Après la migration 045 : laisser passer un cycle du cron** (`api/cron/leaderboard.php`,
      horaire) pour peupler la dimension Expert du cache. D'ici là le classement Expert par
      période bascule sur le calcul live — correct, mais plus coûteux. Rien à faire, ça se
      résorbe seul ; c'est noté pour ne pas le prendre pour une panne.
- [x] Jouer `sql/migrations/049_titles_pt_descriptions.sql` (`titles.name_pt`, `description_pt`,
      noms PT + descriptions six langues des 22 titres ; `ADD COLUMN IF NOT EXISTS` + `UPDATE` par
      slug, rejouable). **À jouer AVANT le `git pull` Hostinger.** Sans elle, `GET /api/titles` et
      le Compendium interrogent `name_pt` → `Unknown column` → **500 pour tout le monde**, quelle
      que soit la langue. Vérifiée le 2026-09-18 sur un import vierge du nouveau `bdd_mysql.sql`
      (no-op) et sur la base de dev au schéma 048.
- [x] **Bumper `CACHE_VERSION` dans `sw.js` (v98 → v99, fait le 2026-09-19)** : `profile/profile-page.js`
      (précaché) change après le hotfix des titres (badges sociaux, épinglage — 2026-09-19).
- [x] Jouer `sql/migrations/050_game_sessions_drop_uq_session.sql` — **jouée en prod le 2026-09-19**
      (dump `game_sessions` avant) : la contrainte « une partie par jour » de l'archive de mai
      (`uq_session`) n'avait jamais été supprimée, la 032 visant un autre nom. Chaque rejeu et chaque
      partie Expert du même jour tombaient en 409 depuis le 1er septembre ; porte Émoji inatteignable.
- [x] Jouer `sql/migrations/052_profiles_avatar_src.sql` (colonne `profiles.avatar_src` + reprise
      des portraits galerie non recadrés ; `ADD COLUMN IF NOT EXISTS`, `UPDATE` borné, rejouable).
      **À jouer AVANT le `git pull` Hostinger.** Sans elle, `GET /api/user/:id`, `GET /api/friends/`
      et tout PATCH d'avatar tombent en `Unknown column 'avatar_src'` → **500 sur le profil et la
      liste d'amis pour tout le monde**. Puis `INSERT IGNORE INTO schema_migrations (version) VALUES
      ('052_profiles_avatar_src')`. Vérifiée le 2026-09-19 sur la base de dev au schéma 051 (58 origines
      reprises, 45 portraits recadrés restent inconnus) et sur un import vierge (no-op).
- [x] Jouer `sql/migrations/053_date_badges_any_year.sql` — **jouée et enregistrée en prod le 2026-09-19 nuit** (dump `badges` avant). (5 `UPDATE badges` par slug, rejouable) **avant le
      pull** : sans elle, les cinq badges de dates gardent `manual` et ne tombent jamais d'office ; avec le
      nouveau code, aucun crash dans les deux sens (pas de nouvelle colonne). Puis `INSERT IGNORE INTO
      schema_migrations (version) VALUES ('053_date_badges_any_year')`. Validée le 2026-09-19 sur import
      vierge + rejouée sur la préprod (dump de prod).
- [x] **Bumper `CACHE_VERSION` dans `sw.js` (v100 → v101, fait le 2026-09-19 nuit)** : `profile/profile-page.js`
      (précaché) porte l'encart Atelier « portrait sans origine ».
- [x] **Bumper `CACHE_VERSION` dans `sw.js` (v99 → v100, fait le 2026-09-19)** : `profile/profile-page.js`
      (précaché) envoie désormais `avatar_src` au recadrage (badge Same Energy).
- [x] Jouer `sql/migrations/051_user_stats_expert.sql` (table `user_stats_expert` + reprise des
      **Jouées en prod le 2026-09-19 (051 puis 052, dump 51 Mo en local avant, validées contre le schéma prod recréé dans Docker) : 79 lignes Expert / 300 parties reprises, 7 origines d'avatar.** Backfill des streaks à lancer depuis le webroot après le pull.
      compteurs depuis `game_sessions WHERE is_expert = 1`, `CREATE TABLE IF NOT EXISTS` + `INSERT …
      ON DUPLICATE KEY`, rejouable), **puis** `php scripts/backfill_expert_streaks.php` depuis le
      webroot (pose `streak`/`streak_record`, que le SQL ne peut pas calculer ; rejouable aussi).
      **À jouer AVANT le `git pull` Hostinger.** Sans la table, `GET /api/user/:id/stats`
      (`expert_by_mode`) et chaque enregistrement de partie Expert tombent en `Table doesn't exist`
      → **500 sur la page profil et sur toute partie Expert**. Puis `INSERT IGNORE INTO
      schema_migrations (version) VALUES ('051_user_stats_expert')`. Vérifiée le 2026-09-19 sur la
      base de dev au schéma 050 (326 lignes reprises pour 540 parties Expert) et sur un import vierge
      du nouveau `bdd_mysql.sql` (no-op).
- [x] **Bumper `CACHE_VERSION` dans `sw.js` (v96 → v97, fait le 2026-09-18 soir)** : `js/filterMenu.js`
      (précaché) et `profile/titles-ui.js` changent après la 2.2 (marqueur de format des filtres,
      descriptions de titres — 2026-09-18 soir). Sans bump,
      un joueur déjà venu garde l'ancien menu de filtres et le bug « Royal revient » avec.
- [x] **Bumper `CACHE_VERSION` dans `sw.js`** (v95 → v96, fait le 2026-09-18 — précédemment
      v94 → v95 le 2026-09-01). Sans bump, `activate` ne purge pas l'ancien cache et les
      assets servis en cache-first restent ceux de la version précédente. Invisible en test :
      seuls les joueurs DÉJÀ venus sont concernés. Ce lot le rendait critique et pas seulement
      cosmétique : `js/api.js`, `profile/leaderboard/leaderboard.{html,css,js}` et
      `profile/friends/friends.{css,js}` sont tous **précachés** et tous modifiés — sans bump,
      un joueur déjà venu garde l'ancien front et ne voit ni le filtre Dimension du classement,
      ni la pastille Expert de sa Boîte, alors que l'API, elle, aura changé.
- [ ] **Top 3 hebdo Discord** (`api/cron/discord_weekly.php`) : (1) créer le webhook du salon
      classement (Modifier le salon → Intégrations → Webhooks, ou `setup.mjs` côté dépôt
      Discord) ; (2) `define('DISCORD_WEEKLY_WEBHOOK', '…')` dans `api/config.php` sur le serveur
      (sans elle, le post part sur le webhook du quotidien) ; (3) cron hPanel `0 20 * * 0` avec la
      commande de `DEPLOY.md` § Étape 6 ; (4) tester à la main une fois
      (`curl -H "X-Cron-Key: …" https://personadle.net/api/cron/discord_weekly.php`) et vérifier
      l'heure réelle du premier dimanche (fuseau du cron).
- [ ] **Déployer hors heure de pointe.** `sw.js` envoie `SW_UPDATED` à tous les onglets via
      `clients.claim()`, et chaque page répond par `window.location.reload()`. L'état de
      partie survit (il vit dans `localStorage`), mais un joueur en cours de partie est
      rechargé sans préavis — et en mode Music, sa lecture audio s'arrête. Comportement
      volontaire (c'est lui qui garantit qu'on ne reste pas sur du code périmé), simplement
      à ne pas déclencher en pleine affluence.

> ✅ **Release 2.2.8 — 2026-09-19 nuit** : badges de dates toutes années (053), PHP 8.2 partout, garde-fou de
> catalogue (réconciliation), préprod fidèle. Après 2.2.5 (traces crons), 2.2.6 (réconciliation serveur +
> victoires Expert), 2.2.7 (hotfix 500 titres).
>
> ✅ **Release 2.2.4 — 2026-09-19 nuit** : encart Atelier « re-choisis ton portrait » pour les 220 comptes
> recadrés avant la 052 (`needsAvatarOrigin`), v101. Rien à jouer en base.
>
> ✅ **Release 2.2.3 — 2026-09-19 soir** : stats Expert éditables (#146, table `user_stats_expert`, 051),
> Same Energy survit au recadrage (#147, `profiles.avatar_src`, 052, v100), top 3 hebdo Discord (#148,
> cron `discord_weekly.php`), « Copier pour Discord » réparé (#149, CSP). 051 + 052 jouées et enregistrées en
> prod avant le merge. Reste côté serveur : `php scripts/backfill_expert_streaks.php` depuis le webroot
> juste après le pull, `DISCORD_WEEKLY_WEBHOOK` dans `config.php` (sinon repli sur le quotidien), cron hPanel
> `0 20 * * 0`.
>
> ✅ **Release 2.2.2 — 2026-09-19** : ping du rôle « 🔔 Daily » (#141), migration 050 déjà jouée en prod +
> détecteur de schéma sur les UNIQUE (#142), badges : le serveur est la vérité (#143), v99. Rien à jouer
> en base. Reste côté serveur : `define('DISCORD_DAILY_MENTION_ROLE', '1550573338336698521');` dans
> `api/config.php` pour activer le ping.
>
> ✅ **Release 2.2.1 — 2026-09-18 soir** : 049 jouée en prod (dump `titles`/`user_titles` avant, 22 titres,
> 0 NULL), `CACHE_VERSION` v97, puis `develop → main` — l'auto-déploiement Hostinger re-branché a
> tiré le commit tout seul. Contient #135 (filtres) et #136 (titres PT + descriptions).
>
> ✅ **Release 2.2 — 2026-09-18** : `schema_migrations` en prod confirme 029→039 (jouées à la 2.1)
> puis 040→046 jouées ce jour depuis le poste local (backup `~/personadle_backups/` 49 Mo avant).
> La 044 a d'abord été refusée (`titles` de prod sans `description_*`, `condition_value NOT NULL`) et
> porte désormais son prérequis de schéma — voir DEV_CHANGELOG 2.2 du 2026-09-18. Le cache de
> classement était vide en prod : **vérifier dans hPanel que le cron horaire
> `api/cron/leaderboard.php` existe et passe** (sinon le classement par période reste en live).
>
> ✅ Les deux migrations ont été **rejouées pour de vrai** le 2026-08-21 contre une base vierge
> au schéma pré-migration, puis une seconde fois pour l'idempotence : schéma final identique à
> `sql/bdd_mysql.sql`, rejeu sans erreur. Elles portent désormais `IF EXISTS` / `IF NOT EXISTS`.
> Chemin de prod : SSH + `mysql --delimiter='$$'`, jamais phpMyAdmin.
>
> ✅ **Le changelog joueur n'est plus bloquant** (2026-08-26). Cette section affirmait qu'il ne
> contenait « aucune entrée Expert, pour aucun des 6 modes » — vrai le 2026-08-21, comblé
> depuis par la PR #71 : `PersonaDLE_Update.html` a sa section ⚡ complète (les 6 modes +
> « Le Mode Expert se mérite »). Reste à y ajouter le contenu livré après cette PR
> (nouvelles musiques, nouveau personnage AOA).

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

> ✅ **Fait le 2026-08-25**, branche `feat/expert-mode-unlock-conditions`. Conditions
> arbitrées avec Hamza, plus exigeantes que la reco `mode_wins` initiale — elles mesurent
> la maîtrise (vitesse, régularité), pas le volume :
>
> | Mode | Condition |
> |---|---|
> | Classique, Silhouette | 10 victoires en 4 essais ou moins chacune |
> | Émoji | 10 victoires sur une seule journée |
> | AOA, Personae, Musique | 15 victoires parfaites (1 essai) d'affilée |
>
> Décision produit : le déblocage est une propriété du **compte** — il suit le joueur sur
> tous ses appareils, et sans compte rien n'est débloquable (défaut fail-closed).

- [x] Conditions choisies par mode (voir tableau ci-dessus).
- [x] Seed SQL + **1 badge** (`denial_of_self`, migration 033 — 10 victoires Expert dans
      chacun des 6 modes) et **1 titre** (`shadows_converge`, migration 034 — 50 victoires
      Expert au total, toutes réparties comme le joueur veut).
- [x] **Vérification serveur** dans `api/sessions.php` : `is_expert = 1` refusé en 403 si le
      mode n'est pas débloqué. Seuils lus depuis `api/lib/expert_unlocks.php`, source unique
      partagée avec l'endpoint — l'écran ne peut pas annoncer une règle différente.
- [x] `GET /api/user/expert-status` : état des 6 modes + progression. Ne renvoie aucun
      libellé (sinon anglais pour les 6 langues), seulement `condition_type` et les nombres.
- [x] Front : bouton grisé avec infobulle stylée (objectif + barre de progression), et
      redirection `?expert=1` → mode normal quand le mode est verrouillé.
- [x] i18n 6 langues.
- [x] Tests Vitest (20, `tests/expertUnlock.test.js`) + validation manuelle bout en bout sur
      la stack Docker : filtre ≤4 essais, déblocage au seuil exact, isolation par mode,
      403 sur session Expert verrouillée, 201 une fois débloquée, migrations rejouées.

**Reste à faire sur ce lot** — ✅ **soldé le 2026-08-26** :

- [x] **Tests PHPUnit** du gate serveur et des nouveaux `condition_type` :
      `tests/php/ExpertUnlocksTest.php`, 22 méthodes / 50 assertions contre la vraie
      MariaDB. Couvrent les 3 fonctions de comptage (bornes, exclusion des abandons,
      exclusion de `is_expert = 1`, isolation par mode et par compte), le déblocage au
      seuil exact, le fail-closed d'un compte neuf, et le fait que le serveur ne renvoie
      aucun libellé traduisible.
- [x] **Test E2E** de la redirection `?expert=1` → mode normal : `tests-e2e/expert-gate.spec.js`,
      7 tests. Inclut la contre-preuve (le mode débloqué reste accessible) sans laquelle un
      gate qui redirigerait tout le monde passerait pour correct, et l'isolation par mode
      (un compte débloqué en Classique est toujours redirigé sur Silhouette Expert).
- [x] **Changelog joueur** : fait par la PR #71 (voir la note du bloc bloquant ci-dessus).

> ⚠️ Découvert en écrivant ces tests : `make test-php` lançait PHPUnit **sans les variables
> `DB_TEST_*`**, donc avec le défaut host-side `127.0.0.1:3307`, injoignable depuis le
> conteneur. Résultat : 106 tests sur 215 se marquaient « skipped » et la cible sortait
> verte — un local plus permissif que la CI, qui elle passe bien ces variables. C'est ce
> trou qui explique que le gate n'ait jamais été couvert : les tests d'intégration
> existants ne tournaient tout simplement pas en local. Corrigé (`PHPUNIT_DB_ENV` dans le
> Makefile) : `make test-php` exécute désormais les 215.

## 2. Les trois classements

Décidé le 2026-08-15, détaillé dans `ROADMAP.md`. **Le prochain gros morceau**, mais il peut
partir après la release : ajouter des axes de tri n'enlève rien à personne.

- [x] **Meilleure série** — l'axe existait, mais il ne mesurait pas une série. Sur une
      période il renvoyait le **nombre de victoires** (20 parties le même jour = « série 20 »),
      et sur `ever`+`all` il lisait `MAX(us.streak_record)`, le record d'un seul mode, alors
      que la streak est globale. Corrigé : vrais jours consécutifs (méthode des îlots) et
      `users.global_streak_record`.
- [x] **Meilleur ratio** — moyenne bayésienne `(wins + C·m)/(games + C)`, C = 20, `m` calculé
      sur les données réelles. Le cas qui motivait tout est vérifié par test : 1/1 passe de
      100 % (1ᵉʳ) à 52,4 %, et 190/200 devient premier à 90,9 %. Un seuil de **participation**
      (≥ 1 partie) s'ajoute au lissage : la formule attribue la moyenne du site à qui n'a rien
      joué, un compte à 0 partie serait apparu à ~50 %.
- [x] ~~**Meilleur score**~~ — **abandonné** (arbitrage Hamza, 2026-08-27) : « victoires » et
      « parties » couvrent déjà cet axe, une troisième métrique aurait doublonné.
- [x] **Formules dédupliquées** — `api/leaderboard/index.php` et `api/cron/leaderboard.php`
      recopiaient les mêmes expressions SQL avec un commentaire « doit rester identique à »
      pour tout garde-fou. Une divergence ne se serait vue qu'en comparant deux périodes
      entre elles. Les deux appellent désormais `api/lib/leaderboard_metrics.php`.
- [ ] Chaque axe décliné en version Expert (`is_expert`), soit la 4e dimension déjà prévue.

> Décision produit confirmée le 2026-08-21 : le classement compte des **parties**, pas des
> jours. 100 victoires jouées valent 100. La régularité, c'est la streak ; le rapport
> victoires/parties, c'est le ratio. Chaque métrique fait un seul métier.

## 3. Défis déjà bloqués en base

Le correctif du 2026-08-15 empêche d'en créer de nouveaux, **il ne répare pas l'existant**.
Bug qui touche des joueurs **aujourd'hui en prod** — branche courte, valeur immédiate.

- [x] Migration de nettoyage ponctuelle — `sql/migrations/036_cleanup_stuck_challenges.sql`.
      **Deux écarts assumés au plan initial**, détaillés dans l'en-tête du script :
      (1) cible `read` et non `unread` — `unread` ferait ressurgir comme neufs des défis
      vieux de plusieurs semaines ; (2) pas de test « sans partie associée » — vérifié, il
      n'apporte aucune sécurité et laisse au contraire bloquées les lignes dont le PATCH
      final a échoué (`updateStatus()` est en fire-and-forget). La borne de 7 jours suffit
      à protéger les défis en cours. Rejouée pour de vrai contre la base locale : 5 cas
      témoins OK, second passage = 0 ligne touchée.
- [x] Bouton « abandonner le défi en cours » — `js/challenge-banner.js`
      (`abandonActiveChallenge()`), distinct du `✕` qui ne fait que masquer le bandeau.
      L'appel serveur est **attendu** avant toute purge locale : c'est le piège de
      `performRecovery()` (CLAUDE.md §7), un fire-and-forget laisserait le défi `accepted`
      en base pendant que le client se croit libéré. Restaure les filtres et l'état du mode
      exactement comme `checkChallengeCompletion()`. 4 clés i18n × 6 langues.

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

- [x] ~~**PHPStan en mode taint sur `api/`**~~ → **fait avec Psalm**, pas PHPStan.
      ⚠️ **La prémisse de cette ligne était fausse** : PHPStan n'a **aucune** analyse de taint
      en open source (vérifié sur la 2.2.2 embarquée par la CI — ni option `--taint`, ni
      commande dédiée). L'outil libre qui fait ce travail est Psalm. Configuré dans
      `psalm.xml` en `errorLevel 8` (le plus permissif) pour n'analyser **que** le taint :
      le typage reste le domaine de PHPStan niveau 5, et un rapport noyé sous des remarques
      de typage ne serait jamais lu. Branché en CI, **bloquant** (déterministe, sans budget).
      Lancer en local : `npm run security:taint` (stack Docker requise).
      Résultat sur le code actuel : **0 alerte réelle**. Le seul flux détecté
      (`$_GET` → `echo json_encode` dans `jsonSuccess()`) est un faux positif sûr — la
      réponse part en `application/json` + `X-Content-Type-Options: nosniff`, elle ne peut
      pas être interprétée comme du HTML. Exclusion réduite à ces 2 identifiants dans ce seul
      fichier, justifiée dans `psalm.xml`.
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

## Dépôt git — purge des anciens `.gif` All-Out Attack de l'historique (décision Hamza)

Mesuré le 2026-09-13 (`git rev-list --objects --all | git cat-file --batch-check`) : `.git`
pèse **3,8 Go**. Dans `allOutAttackMode/database/allOutAttack/` : **79 blobs `.webp` = 1,82 Go**
(les animations actuelles et leurs versions — **on les garde**, le dépôt doit permettre de
jouer 100 % en local) et **62 blobs `.gif` = 1,28 Go** : les anciens GIF remplacés par les
`.webp`, **plus aucun n'est suivi**, ils ne servent qu'à gonfler chaque clone. Le reste
(0,22 Go de docs d'anciennes versions, quelques wallpapers) est négligeable.

Seule une réécriture de l'historique enlève ces 1,28 Go — donc **force-push, re-clone pour
Léo et Damien, `reset --hard` sur Hostinger, PR ouvertes à recréer**. À ne faire que :

- [ ] **au bon créneau** : juste après une release, **aucune PR ouverte** (chaque PR ouverte
      devrait être recréée — tous les SHA changent) ;
- [ ] **Léo et Damien prévenus** : leurs clones deviennent incompatibles → `git clone` à
      neuf (rien de local à garder chez eux avant) ;
- [ ] **sauvegarde** : `git clone --mirror https://github.com/CodeByHaamza/personadle.git
      personadle-backup.git`, gardée hors ligne un mois ;
- [ ] **réécriture** : `bash scripts/purge_git_history.sh` (réécrit le 2026-09-13 — il cible
      **uniquement** `allOutAttackMode/database/allOutAttack/*.gif` ; l'ancienne version purgeait
      « tout blob > 5 Mo » et aurait emporté les badges et wallpapers PNG). Il fait lui-même le
      miroir de sauvegarde, refuse un arbre sale, demande `PURGE`, puis `gc`. Attendu :
      `.git` ≈ 3,8 → ≈ 2,5 Go. Ne toucher ni aux `.webp` (jouer local), ni aux `.gif` d'`img/`
      (avatars, loading — petits et encore servis) ;
- [ ] **vérifier** sur le miroir réécrit, cloné à part : `npm test`, `make up` +
      `npm run test:e2e`, `git log --oneline | wc -l` identique, `git diff <ancien main>
      <nouveau main>` vide hors `.gif` purgés ;
- [ ] **pousser** : `git push --force --mirror` (toutes branches et tags) ;
- [ ] **Hostinger** (le `git pull` auto refusera l'historique divergent) : SSH,
      `cd domains/personadle.net/public_html && git fetch origin && git reset --hard
      origin/main`, puis vérifier `api/config.php` et les fichiers non suivis toujours en
      place. Hors heure de pointe, prévoir quelques minutes ;
- [ ] **après coup** : `git gc --prune=now --aggressive` sur chaque clone survivant ;
      supprimer le miroir de sauvegarde après un mois sans problème.

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

- [ ] **Page Classique défilée de ~215 px au chargement en CI (1280×720)** — la boîte de
      consigne `.personadle-box` intercepte alors le clic sur ⚔ Défier (55 retries Playwright,
      trace du run 34777768286 ; capture : bouton collé au bord haut, logo hors écran). Non
      reproduit en local (bouton à y=214, boîte à y=273, `scrollY=0`). Contourné dans
      `challenge_flow.spec.js` par `dispatchEvent("click")`. À comprendre avec la PR layout
      (sticky input) : si un joueur en 720 px de haut arrive défilé, c'est un vrai défaut.
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
