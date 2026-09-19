# Changelog technique — PersonaDLE v2.2

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE 2.2/PersonaDLE_Update.html` reste le changelog **joueur** —
> highlights uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur si elle
> est réellement visible/parlante côté joueur.
>
> Les entrées de la v2.1 (livrée) et des versions antérieures restent dans leurs
> dossiers respectifs — elles ne sont pas recopiées ici.

---

## 2026-09-19 — Badges de série : la série GLOBALE compte (celle que le joueur voit)

Audit de Colonel-Maskou : record global 19, meilleur mode 16. Les badges « Reach a N-day
streak » (Pyro Spark 7, Raphael 30, Surt 90, Lucifer 120, Helel 365) n'étaient vérifiés que
sur le record **par mode**, alors que le profil affiche — et le client compare — la série
**globale** (`users.global_streak_record`). Un joueur à 30 jours globaux et 25 dans son
meilleur mode se voyait refuser Raphael. En prod : 4 joueurs concernés pour Pyro Spark.

- `condition_check.php` `streak_record` → `max(MAX(user_stats.streak_record) ∪ Expert,
  users.global_streak_record)`. Rattrapé par la réconciliation au prochain profil.
- Test : global 30 / par mode 25 → Raphael et Pyro Spark accordés, Surt non ; l'inverse
  (par mode > global) reste vrai.

---

## 2026-09-19 — Badges de dates pour toutes les années (migration 053) ; 500 des titres ; préprod fidèle

### Pâques, Saint-Valentin, Tanabata, Golden Week, Jour Promis — n'importe quelle année

Décision Hamza. Jusqu'ici Pâques et Saint-Valentin étaient des codes événement d'une seule
année (EASTER2026, VALENTINE2026), Golden Week / Tanabata / Jour Promis des drapeaux posés par
le client si l'on **visitait** le site à la bonne date (par appareil, perdus avec le cache).
Désormais vérifiés côté serveur depuis `game_sessions`, toutes années, et accordés à
l'ouverture du profil :

- `played_on_date` 'MM-JJ' (Saint-Valentin 02-14, Tanabata 07-07), `played_in_period`
  'MM-JJ:MM-JJ' (Golden Week, fenêtre pouvant enjamber le Nouvel An), `played_on_all_dates`
  'MM-JJ,MM-JJ' (Jour Promis : les deux dates, pas forcément la même année),
  `played_on_easter` (dimanche **ou lundi** de Pâques, computus Meeus/Jones/Butcher —
  `personadle_easter_sunday()`). Entiers en SQL, jamais une chaîne formatée.
- Migration 053 : conditions + noms sans année ('Valentine''s Day', 'Easter') ; slugs et
  images inchangés. `lang/*.json` : noms et conditions (« Jouer un 14 février »…).
- Client `badgesData.js` : Valentine/Easter n'ont plus de `eventCode` (`check: () => false`,
  le serveur accorde) ; Golden Week / Tanabata / Jour Promis gardent leurs drapeaux comme
  retour immédiat, le serveur tranche sur les vraies dates de jeu.
- Tests : `testDateBadgeConditionsWorkAnyYear` (Pâques 2024/25/26, samedi refusé, lundi
  accepté ; fenêtre enjambant l'année ; deux dates de deux années) ; le garde-fou de catalogue
  sème et réconcilie les quatre nouveaux types.

### 500 sur GET /api/titles (2.2.6 → hotfix 2.2.7)

`played_on_date` faisait `DATE_FORMAT(played_date,'%m-%d') = ?` ; avec les préparées natives,
sur la MariaDB d'Hostinger (`skip-character-set-client-handshake`), paramètre en
`utf8mb4_general_ci` contre chaîne en `utf8mb4_unicode_ci` → « Illegal mix of collations ».
La réconciliation la jouait pour tous → le menu des titres retombait sur la liste locale.
Corrigé (MONTH/DAY) ; `personadle_condition_allows_unlock_safely()` : une condition qui
plante est loguée (`unlock-reconcile`) et sautée. CLAUDE.md §7 : trois pièges ajoutés.

### Préprod fidèle

Trois écarts fermés : MariaDB 11.8 configurée comme Hostinger (`ops/preprod/`), PHP **8.2**
partout (`ARG PHP_VERSION`, CI), collation de connexion identique. Preuve : l'ancienne
requête échoue désormais aussi sur la préprod.

---

## 2026-09-19 — Déblocages : le serveur accorde ce qui est dû, et une victoire Expert est une victoire

Hamza : Colonel-Maskou a 13 titres mais pas SEES, une relation au rang 10 mais pas Same
Soul, largement les 25 perfects sans Kotone, 135 victoires Expert sans Shadows Converge.
Lecture de la prod : 363 perfects, tout est rempli côté données. La cause est le **modèle**,
pas les compteurs : « le client tente, le serveur tranche » — et le client ne savait pas
évaluer `perfect_wins`, `titles_count`, `social_link_min_rank`, ni `expert_wins_total`
(renvoyé `false` exprès). Personne ne frappait à la porte. Dry-run sur le dump de prod
(préprod) : **~290 titres et ~100 badges dus et jamais accordés** sur la communauté —
Kotone ×59, Reach Out to the Truth ×46, Pancakes ×42, SEES ×22, Best Bro ×29…

### Réconciliation serveur — `api/lib/unlock_reconcile.php`

- `personadle_reconcile_titles()` / `personadle_reconcile_badges()` : à chaque
  `GET /api/titles` et `GET /api/badges` (chargement du profil), tout ce que le joueur n'a pas
  et dont la condition est remplie est accordé, avec la **même porte fail-closed** que les
  POST /unlock (`personadle_condition_allows_unlock`). `same_energy` accordé aux deux.
- Hors périmètre : `manual` et `joker_profile` — déclaratifs (drapeau client, code événement,
  endpoint dédié) ; la fonction générique les laisse passer, les accorder d'office les
  donnerait à tout le monde.
- Le client peut continuer à tenter (retour immédiat), mais ce n'est plus lui qui décide
  de ce qui existe. Coût : ~20 vérifications par GET titres, ~25 par GET badges (les
  `manual` sont sautés) — négligeable, indexé par `user_id`.

### Une victoire Expert est une victoire (décision B, Hamza)

- `personadle_aggregate_user_stat()` et `personadle_user_stat_for_mode()` lisent
  `user_stats` **UNION ALL** `user_stats_expert` : `wins_total`, `mode_wins`, `mode_games`,
  `games_total`, `perfect_wins`, `giveups_total`, `streak_record` (MAX) comptent les deux
  dimensions. Les types qui nomment une dimension s'y limitent toujours
  (`mode_wins_under_attempts` etc. — portes Expert et *Don't Need Your Pity*).
- `expert_wins_total` et `expert_modes_mastered` lisent désormais `user_stats_expert`
  (éditable par l'admin) et non plus `game_sessions` : un titre Expert suit ce que l'admin
  a posé, comme les titres normaux suivent `user_stats`.
- `GET /api/user/:id` renvoie `expert_stats` ; `js/cloud-sync.js` en fait `stats.expert` ;
  `statsForUnlocks()` (`profile/profile-format.js`) additionne les deux pour
  `checkAndUnlockBadges()` et `checkAndUnlockTitles()`. Le profil continue d'afficher les
  deux blocs séparément.

### Tests

- PHPUnit : `testGenericUnlockConditionsCountNormalAndExpertTogether`,
  `testServerReconciliationGrantsWhatIsDueWithoutTheClientAsking` (idempotence, SEES après
  8 titres, `joker_profile` jamais d'office) ; helpers de `BadgeWallpaperCatalogTest`
  alimentent `user_stats_expert`.
- Vitest : `statsForUnlocks`, pull `expert_stats`, badge « 10 victoires » à 6 + 4.
- E2E : Take Your Heart 30 normales + 10 Expert (39 → 403, 40 → 200) ; Kotone accordée au
  simple GET après 25 perfects, sans POST /unlock ; `ace_detective` idem via GET /api/badges.

### Angle mort

- Les titres accordés par le serveur apparaissent débloqués sans l'animation « nouveau
  titre » côté client (elle ne joue que sur les unlocks que le client a tentés). À
  brancher sur le diff `is_unlocked` du GET si on veut la fanfare.

---

## 2026-09-19 — Crons : un refus de clé laisse une trace, un post Discord aussi

En corrigeant les crons hPanel, découverte : le quotidien Discord (`5 0 * * *`) n'avait
**jamais** tourné tout seul depuis le 9 septembre — sa ligne portait une mauvaise clé, et un
403 de `requireCronSecret()` ne laissait aucune empreinte (pas de logs d'accès en SSH chez
Hostinger). Tous les posts du salon étaient des tests manuels.

- `api/bootstrap.php` `requireCronSecret()` : avant le 403, `personadle_log_error('warning',
  'Cron refused: bad or missing X-Cron-Key')` avec `source=cron-auth`, l'endpoint, la
  **longueur** de la clé reçue (jamais la clé) et l'IP. Best-effort : sans base, on refuse
  quand même.
- `discord-daily.php` / `discord_weekly.php` : trace `info` à chaque post réussi
  (`cron-discord-daily` / `cron-discord-weekly`). Demain matin, Admin → Logs dit ce qui s'est
  passé à 00:05 — post, refus, ou rien (= le cron n'a pas tourné).
- E2E `admin-extended` : mauvaise clé sur `leaderboard.php` → 403 + trace lisible par l'admin,
  sans la clé dedans.

---

## 2026-09-19 — Atelier : « re-choisis ton portrait » pour les 220 comptes recadrés avant la 052

Suite de la 052 : en prod, 220 profils portent une image recadrée dont l'origine est
inconnue (`avatar_src` NULL) — leurs amis et le badge Same Energy ne savent pas qui ils
portent tant qu'ils n'ont pas re-choisi un portrait. Décision Hamza : le leur dire dans
l'Atelier.

- `profile/profile-format.js` : `needsAvatarOrigin(profile)` — image encodée ET pas de
  portrait galerie dans `avatarSrc`.
- `profile/profile.html` : `#avatarOriginNotice` (`.atelier-notice`, caché par défaut) sous
  le hint de l'onglet Avatar ; six langues (`profile.avatar_origin_notice`).
- `profile/profile-page.js` : `_markSelectedAvatarCell()` pilote l'encart, et est désormais
  appelé aussi depuis `_applyCloudToUI()` — sur un navigateur neuf, le local est vide au
  moment où la grille se construit, c'est le pull cloud qui apporte l'avatar.
- `sw.js` : `CACHE_VERSION` v100 → v101 (`profile-page.js` précaché).
- Tests : `profileFormat.test.js` (+2), E2E `profile_atelier` « recadré avant la 052 » :
  encart visible, disparaît au re-choix (le serveur reçoit `avatar_src`), absent après
  rechargement.

---

## 2026-09-19 — « Copier pour Discord » échouait pour tout le monde : la CSP bloquait `fetch(data:)`

Hamza, en testant le nouveau salon 🪪┃profiles : « ❌ Échec de la copie. Télécharge-la
manuellement. » Le presse-papiers n'y était pour rien : le bouton faisait
`fetch(dataUrl)` pour obtenir un Blob, et la CSP des pages HTML (`.htaccess` racine,
`connect-src 'self' https://*.pusher.com …`) n'autorise pas `data:` en connexion. Bloqué
en prod **et** en Docker (mod_headers y est actif) — mais aucun test ne cliquait ce bouton.

- `profile/share-card.js` : `dataUrlToBlob()` décode le base64 sans requête ;
  `copyPngToClipboard()` renvoie `false` au lieu de lever (pas de `ClipboardItem`,
  permission refusée). En repli, le bouton **télécharge la carte** et le dit
  (`profile.share_copy_fallback`, six langues) — le joueur repart toujours avec son image.
- Tests : `shareCard.test.js` (Blob sans fetch, signature PNG ; écriture OK / refusée) ;
  E2E `profile_atelier` « Copier pour Discord sous la vraie CSP » (permission clipboard
  accordée au contexte, aucune violation CSP en console) — **rouge sur l'ancien code**,
  vérifié en stashant le correctif.
- Pas de bump `CACHE_VERSION` : `share-card.js` n'est pas précaché et les scripts sont
  servis en network-first.

---

## 2026-09-19 — Discord : top 3 de la semaine, le dimanche à 20 h (`api/cron/discord_weekly.php`)

Idée Hamza : « toutes les semaines, dans un salon, on affiche le top 3 de ladite semaine
(tous les dimanches à 20 h) ». Même mécanique que l'annonce quotidienne : un cron
Hostinger, un webhook, la clé en header — pas de bot à héberger, et les données sont
déjà là (c'est la fenêtre `period=week` du classement).

- **`api/cron/discord_weekly.php`** : deux podiums, victoires en normal (tous modes) et en
  Expert s'il y en a eu ; égalité → moins de parties d'abord, puis pseudo ; comptes supprimés
  exclus ; semaine sans victoire → rien posté (`posted: false`). Voix Margaret (les registres).
  Fenêtre lundi → dimanche 20 h : les parties de 20 h à minuit ne sont pas dedans — prix d'un
  rendez-vous à une heure où le salon est là, assumé dans l'en-tête.
- **`api/lib/discord_webhook.php`** : validation de l'URL (forme Discord, sans query string),
  POST `?wait=true`, caviardage URL + token avant tout log, échappement markdown des pseudos.
  Extrait du quotidien, qui garde sa copie locale (il tourne en prod ; à rebrancher à sa
  prochaine modification).
- **`api/lib/weekly_podium.php`** : la requête et les lignes 🥇🥈🥉, séparées du cron pour être
  testables — le cron exige `CRON_SECRET`, absent en local et en CI.
- Config : `DISCORD_WEEKLY_WEBHOOK` (à défaut, celui du quotidien) et `DISCORD_WEEKLY_MENTION_ROLE`
  (optionnel, opt-in seulement). `phpstan.neon` : les deux en `dynamicConstantNames`, même piège
  que `DISCORD_DAILY_WEBHOOK`. `DEPLOY.md` : les deux crons Discord dans le tableau + rappel du
  fuseau. Nouveau fichier en `snake_case` (règle CLAUDE.md), d'où `discord_weekly` à côté du
  `discord-daily` historique.
- Tests : `DiscordWebhookTest` (URL, caviardage, échappement, lignes), `DatabaseIntegrationTest`
  `testWeeklyPodiumRanksByWinsThenFewerGamesAndKeepsExpertApart` (fenêtre en 2100 pour ne pas
  croiser les parties « aujourd'hui » des autres tests).

### À faire côté prod (TODO.md)

Constante `DISCORD_WEEKLY_WEBHOOK` dans `config.php` (webhook du salon classement), cron hPanel
`0 20 * * 0`, et vérifier l'heure réelle du premier post.
## 2026-09-19 — Same Energy ne tombait presque jamais : le recadrage effaçait « qui » est porté (migration 052)

Hamza : « je suis pas sûr que le badge Same Energy se débloque bien ». Vérification de la
chaîne complète : deux vrais défauts.

1. **Le recadrage cassait la détection.** Choisir un portrait ouvre aussitôt la fenêtre de
   recadrage (retour Hamza du 2026-09-16) ; valider remplace `avatar_data`
   (`../img/avatar/Chie.jpg`) par le PNG recadré en base64. `personadle_same_energy_partners()`
   comparait la fin de `avatar_data` aux noms de fichiers → plus rien ne matchait. Le badge ne
   pouvait tomber que si les **deux** amis avaient fermé la fenêtre sans recadrer. Le client
   gardait bien l'origine (`profile.avatarSrc`) — mais en local seulement : pas synchronisée,
   et le pull cloud la supprimait (`delete p.avatarSrc`).
2. **Deux Chie manquaient** dans la liste (serveur et miroir client) : `chie_satonaka_icon.jpg`
   et `chiesatonaka_revivale.jpg` (P4). `meme_chie_shut_teddie.jpg` est conservée.

### `profiles.avatar_src` — le portrait galerie d'origine, synchronisé

- `sql/migrations/052_profiles_avatar_src.sql` + `bdd_mysql.sql` : `avatar_src VARCHAR(120) NULL`.
  Reprise : `avatar_src = avatar_data` quand celui-ci est un chemin galerie (58 lignes en dev) ;
  un portrait recadré avant la 052 reste inconnu (45 en dev) — le joueur le re-choisit une fois.
- `api/user/index.php` PATCH : règle en quatre cas — `avatar_data` chemin galerie → **déduit**
  (le client n'a rien à dire) ; `avatar_data` null → null ; image recadrée **avec** `avatar_src`
  (null compris) → le client sait ; image recadrée **sans** `avatar_src` → **on garde la valeur
  connue**. Ce dernier cas est celui du sync complet (`_fullCloudSync` renvoie `avatar_data` tel
  quel) et des clients pas encore rafraîchis : écrire NULL là aurait effacé l'origine à chaque
  sync (état dérivé, CLAUDE.md §13). GET renvoie `avatar_src`.
- `api/lib/validation.php` : `personadle_is_gallery_avatar()`, `personadle_validate_avatar_src()`
  (null/'' ou chemin galerie **existant** — jamais une image inline : ce champ dit « qui », il ne
  stocke rien).
- `api/friends/index.php` : `avatar_src` dans chaque ami (retour immédiat côté client).
- `api/lib/condition_check.php` : `COALESCE(avatar_src, IF(avatar_data LIKE '../img/avatar/%',
  avatar_data, NULL))` — l'origine parle ; `avatar_data` ne remonte que s'il est lui-même un
  chemin (profil pré-052 jamais resauvé), jamais les blobs base64.

### Client

- `profile/profile-page.js` : `commitAvatar()` envoie `avatar_src: galleryAvatarPath(selectedAvatarSrc)`
  avec l'image ; `_fullCloudSync` envoie `avatar_src` **seulement s'il est connu localement**
  (sinon silence → le serveur garde). `galleryAvatarPath()` accepte `.avif` (Kanji).
- `js/cloud-sync.js` : `avatar_src` descend dans `profile.avatarSrc` ; null/absent → supprimé
  (plus de portrait fantôme après un changement sur un autre appareil).
- `profile/badges/badgesManager.js` : `mine = profile.avatarSrc || profile.avatar`,
  `theirs = f.avatar_src || f.avatar_data`. `badgesData.js` : liste Chie complétée.
- `sw.js` : `CACHE_VERSION` v99 → v100 (`profile-page.js` précaché).

### Tests

- PHPUnit : `testSameEnergySurvivesTheCropThanksToAvatarSrc` (deux recadrés, un seul, pré-052
  inconnu), `ValidationTest` ×3 (`avatar_src`, `is_gallery_avatar`).
- Vitest : détection via `avatarSrc`/`avatar_src`, toutes les Chie ; pull cloud d'`avatar_src`
  (valeur, null, champ absent).
- E2E `unlocks_wonder_shujin` : le scénario Same Energy passe maintenant par **A recadré + B en
  icône Chie** ; nouveau test de contrat `avatar_src` (déduit, gardé si muet, suit, null explicite,
  400 sur image inline / portrait inconnu / traversée, effacé avec l'avatar).

### Angle mort

- Joueurs déjà recadrés avant la 052 : `avatar_src` NULL, badge impossible tant qu'ils n'ont
  pas re-choisi leur portrait (un clic dans l'Atelier, recadrage compris). À dire à l'ami de
  Hamza qui teste.
## 2026-09-19 — Stats Expert éditables : table `user_stats_expert` (migration 051)

Hamza : « dans le menu admin je peux pas modifier mes stats de mode Expert ». Normal : les
stats Expert n'existaient nulle part. `personadle_expert_stats_by_mode()` faisait un
`GROUP BY` à la volée sur `game_sessions WHERE is_expert = 1` — rien à éditer, et une
partie perdue par un bug (409 `uq_session`, cf. 050) ne pouvait pas être rendue au joueur.
Décision : **même modèle que le mode normal** — une table de compteurs alimentée à chaque
partie, lue par le profil, écrasable par l'admin. Table séparée plutôt qu'une colonne
`is_expert` dans `user_stats` : une vingtaine de lecteurs (badges, titres, classement,
leaderboard cache) supposent « une ligne par mode » et lisent les stats normales sans filtre.

### Base

- `sql/migrations/051_user_stats_expert.sql` + `sql/bdd_mysql.sql` : `user_stats_expert`
  (`user_id, mode` PK, `wins, giveups, games, streak, streak_record, perfect_wins,
  total_time_ms, last_played_at, first_played_at`, FK `users` CASCADE). Reprise de
  l'historique en SQL (`INSERT … SELECT … GROUP BY user_id, mode ON DUPLICATE KEY UPDATE`) —
  compteurs seulement.
- `scripts/backfill_expert_streaks.php` : pose `streak` (via `personadle_recompute_mode_streak(…,
  true)` au dernier jour joué) et `streak_record` (`personadle_expert_streak_record()`, plus longue
  suite de journées Paris gagnantes). « Jours consécutifs » ne se calcule pas raisonnablement en
  SQL, et l'API le faisait déjà en PHP. À lancer une fois après la 051 ; rejouable. En Docker :
  `docker exec -e DB_HOST=db -e DB_USER=root -e DB_PASS=rootpassword personadle_php php
  scripts/backfill_expert_streaks.php`.

### API

- `api/lib/game_session.php` : la branche Expert de `personadle_record_game_session()` appelle
  `personadle_bump_expert_stats()` (INSERT IGNORE de la ligne, puis `games+1`, `wins`/`giveups`,
  `streak` recalculée depuis l'historique — jamais incrémentale —, `streak_record = GREATEST`,
  `perfect_wins`, `total_time_ms`) et renvoie `expert_stats` à côté des `stats` normales
  inchangées. `personadle_expert_stats_by_mode()` lit la table ; `best_attempts` et
  `last_played_date` restent lus dans `game_sessions` (ce ne sont pas des compteurs, l'admin n'a
  pas à les inventer).
- `api/admin/user_stats.php` : `is_expert` (bool) → cible `user_stats_expert`, audit
  `user_stats_expert.overwrite`. `api/admin/user.php` : `expert_stats` dans le détail.
- `api/user/stats.php` : `expert_by_mode` inchangé côté forme — c'est la table qui parle.

### Admin

- `admin/admin.js` `renderTabStats` : deux tableaux (normal / ⚡ Expert), même colonnes, Save
  par ligne envoie `is_expert`. Note d'onglet : l'*accès* Expert reste dans l'onglet ⚡ Expert.

### Tests

- PHPUnit : `testExpertStatsByModeReadsTheExpertTableFedByEachGame` (3 parties Expert + 1
  normale, compteurs, `best_attempts`, streak, écrasement admin relu),
  `testExpertStreakRecordIsTheLongestRunOfConsecutiveWinningDays`.
- E2E `admin-extended.spec.js` : PATCH `is_expert:true` → `expert_stats` côté admin,
  `expert_by_mode` côté joueur, `user_stats` intacte, 403 non-admin.

### Angles morts

- Un joueur qui a déjà des parties Expert mais **aucune ligne** (prod avant la 051) : l'API renvoie
  `[]` jusqu'à la reprise — d'où « 051 puis backfill AVANT le pull » dans `TODO.md`.
- `admin/` n'est pas précaché par le SW : pas de bump `CACHE_VERSION` pour ce lot.

---

## 2026-09-19 — Badges : Velvet Regular « qui s'enlève », Best Bro jamais accordé — deux désaccords local ↔ serveur

Signalés par Hamza via un ami : (1) épingler **Velvet Regular** (50 journées) « s'enlève »
à chaque essai ; (2) « certains badges ont du mal, plusieurs amis notamment ». Lecture de la
prod : cinq joueurs à 53-56 journées distinctes **sans** Velvet Regular en base, un seul
`unique_days` jamais accordé depuis juillet ; **Gyotre, 12 amis acceptés, sans Best Bro**.

### 1. Velvet Regular — le compteur de journées était tenu par appareil

`uniqueDaysSet` vivait dans le profil local : un joueur pouvait se voir 50 jours chez lui —
jours d'avant le compte compris — quand `game_sessions` en comptait 45. Le badge se
débloquait donc en local, `syncBadgesWithBackend()` le poussait, le serveur répondait 403
« Condition not met », **avalé** (`.catch(() => {})`), et le badge restait « débloqué » à
l'écran. L'épingler envoyait `selected_badges` → 403 « Badge not unlocked » → **tout le PATCH
tombait** (avatar, bordure, titre compris) → le pull suivant remettait l'ancienne sélection.
Pour les cinq joueurs à 53-56 jours, le serveur aurait dit oui — mais leur appareil
n'avait jamais atteint 50 (nouvel appareil, cache vidé) : rien à pousser.

- **Serveur = vérité pour les journées** : `GET /api/user/:id` renvoie `unique_days`
  (`COUNT(DISTINCT played_date)`), le pull le pose dans `profile.uniqueDaysPlayed` ;
  connecté, `trackUniqueDay()` n'ajoute qu'aujourd'hui (+1) au lieu de reprendre la
  taille du set local — anonyme, le set reste la vérité.
- **`PATCH /api/user/:id` accorde lui-même** un badge épinglé que le serveur n'a pas si sa
  condition est remplie (même `personadle_condition_allows_unlock()` que `/badges/unlock`,
  badges à code événement exclus) ; sinon **403 « Badge not unlocked: <slug> »** — le slug,
  pour que le client sache quoi retirer.
- Client : `updateWithBadgeFallback()` (profile-page.js) retire le slug refusé de la
  sélection et renvoie le PATCH sans lui, une fois — le reste du profil s'enregistre.
- `syncBadgesWithBackend()` : un 403 « Condition not met » **retire le badge du local** (et
  de la sélection) au lieu de l'avaler — le serveur est la vérité. Panne réseau, 5xx ou 403
  « code événement » laissent le local intact : on ne sait pas.

### 2. Best Bro — le drapeau arrivait après la vérification

`checkSocialBadges()` pose `hasTwoFriends` (et `leblanc3FriendsDay`, `sameEnergyWith`) après
`/api/friends` — donc **après** `checkAndUnlockBadges()`, déjà passé. Le badge attendait la
visite suivante du profil, et sa synchro celle d'après. Pire : `initBadgesSystem()` l'appelle
au chargement, quand `window._currentUser` n'est le plus souvent **pas encore posé** →
retour immédiat, et `_fullCloudSync()` (après l'auth) ne l'appelait pas. Selon la vitesse
de l'auth, le drapeau ne se posait jamais.

- `checkSocialBadges()` revérifie les conditions et synchronise **dans la même passe** dès
  qu'un drapeau change ; `_fullCloudSync()` l'appelle après l'auth résolue.

### Tests

- Vitest (+7) : `cloudSync` (unique_days remplace le local même plus grand ; payload sans
  le champ → intact), `badgesManager` (403 « Condition not met » retire du local et de la
  sélection ; 5xx et 403 « code événement » ne retirent rien ; `trackUniqueDay` connecté =
  serveur + 1, anonyme = set ; Best Bro débloqué **et** poussé à la première passe).
- E2E `unlocks_usecases` (+2) : épingler un badge que le serveur n'a pas → accordé si la
  condition est remplie (première victoire), 403 nommant le slug sinon, `unique_days` = 1 ;
  deux amis acceptés → **une seule** ouverture du profil suffit pour Best Bro en base.
- `tests/social-link.test.js` « flame today » : date UTC → rouge chaque nuit 0-2 h Paris,
  corrigé (même correctif que dans la PR 050).

### Prod

Rien à jouer en base. `profile/profile-page.js` est précaché → bump `CACHE_VERSION` v98 → v99 à
la prochaine release (checklist). Les cinq joueurs à 50+ jours recevront Velvet Regular au
prochain épinglage ou à la prochaine synchro (le serveur dit oui) ; Gyotre aura Best Bro à
sa prochaine visite du profil.
## 2026-09-19 — Le Mode Expert ne se débloquait pas : la prod plafonnait toujours à une partie par jour (migration 050)

Signalé par Hamza : « des gens ne débloquent pas le Mode Expert même en remplissant les
conditions ». Lecture de la prod : **aucun joueur n'a plus d'une session par mode et par
jour** — 10 377 sessions depuis le 24 juillet, maximum 1/jour partout, 0 journée à deux
parties. La porte Émoji (« 10 victoires en une journée ») est donc **inatteignable pour
tout le monde** (tous les joueurs à 1/10), les autres portes n'avancent que d'un cran par
jour, et une partie Expert jouée le même jour que la partie normale n'est jamais
enregistrée — ni pour la porte, ni pour les stats, ni pour le classement.

### Cause

La migration **032** (« chaque partie compte », 2026-09-01) supprimait la contrainte
`uq_session_per_day (user_id, mode, played_date, is_expert)` — le **nom de la référence**
`sql/bdd_mysql.sql`. La table de prod, montée depuis l'archive du 2026-05-06, porte la même
contrainte sous le nom **`uq_session` (user_id, mode, played_date)**, sans `is_expert`.
`DROP INDEX IF EXISTS uq_session_per_day` n'a rien trouvé et n'a rien dit. Depuis, chaque
seconde partie du jour (rejeu, victoire après abandon, Expert après la normale) tombe en
erreur 23000, que `api/lib/game_session.php` traduit — à raison dans le monde de la
référence, où le seul doublon possible est un rejeu de `client_session_id` — en **409
« déjà enregistrée »**, et que `savePendingSession()` jette en silence. Dix-huit jours de
parties perdues, pas un log : le 409 est traité comme un succès des deux côtés.

Le diff `information_schema` prod ↔ référence fait pour la 048 ne comparait que les
**colonnes**. Un diff des contraintes UNIQUE ne montre que celle-ci (hors tables propres à
la prod).

### Correction

- **Migration 050** : `ALTER TABLE game_sessions DROP INDEX IF EXISTS uq_session`. Reste
  `uq_session_client_id` (idempotence de la 032) et l'index de lecture `idx_session_per_day`.
  No-op sur la référence. Validée sur une table recréée avec les index de la prod (deuxième
  insertion du jour refusée avant, acceptée après, rejeu no-op), puis **jouée en prod** après
  un dump de `game_sessions` (1,7 Mo) : il ne reste que `PRIMARY` et `uq_session_client_id`.
  Aucun code à changer : le serveur et le client fonctionnent déjà en « chaque partie
  compte » depuis la 032 (E2E `sessions-same-day.spec.js`), c'est la prod qui ne suivait pas.
- **`scripts/check_prod_schema.php`** compare désormais aussi les **contraintes UNIQUE** :
  toute contrainte présente en prod dont les colonnes ne correspondent ni à un `UNIQUE KEY`
  ni à la `PRIMARY KEY` de la table dans `bdd_mysql.sql` est signalée (les `uq_*_id (id)`
  posés par 025/048 sur l'`id` AUTO_INCREMENT sont donc acceptés : même garantie que la PK
  de la référence). Lancé en prod après la 050 : ✅ aucune dérive. Avant la 050 il aurait
  écrit `game_sessions — contrainte UNIQUE en trop : uq_session (user_id,mode,played_date)`.
- CLAUDE.md §7, nouveau piège : un `DROP INDEX IF EXISTS <nom>` se vérifie par ses
  **colonnes** dans `information_schema.STATISTICS`, jamais par son nom seul.

### Ce qu'on ne récupère pas

Les parties rejetées entre le 1er et le 19 septembre n'ont jamais atteint la base et le
client ne les a pas mises en file (un 409 n'est pas une erreur pour lui). Les progressions
Expert repartent de ce que la prod a réellement enregistré ; les 15 accès offerts par
l'admin (`expert_unlocks_granted`) restent. À partir de maintenant, chaque rejeu compte —
la porte Émoji redevient atteignable en une bonne journée de Rejouer.
## 2026-09-18 — L'annonce Discord du daily pingue le rôle opt-in « 🔔 Daily » ; le quiz d'Arcane vit dans le bot, pas dans le site

`api/cron/discord-daily.php` : mention optionnelle pilotée par `DISCORD_DAILY_MENTION_ROLE`
(`config.php`) — `content` = `<@&id>`, `allowed_mentions.roles` restreint à ce seul rôle, id
nettoyé (`\D` retirés). Constante absente ou vide → aucun ping, comme avant. **Jamais le rôle
Membres** : un ping quotidien sur un rendez-vous de routine fait couper le salon ; le rôle
« 🔔 Daily » est opt-in dans `🎭┃roles`. Renseigné dans `config.example.php` avec l'id du rôle.

**Décision d'organisation** (le même soir) : le test de personnalité `/velvetroom`, écrit en
PHP dans ce dépôt (`api/discord/interactions.php` — HTTP Interactions signées Ed25519, jamais
commité), **n'entre pas dans le site**. Il a été porté dans le bot Python
(`personadle-discord/bot/velvetroom.py` + `velvetroom_ui.py`), qui tourne désormais 24 h/24
en Docker sur le serveur maison. Pourquoi : un seul endroit pour toute la logique Discord,
aucun token de bot ni clé d'application sur l'hébergement du jeu, et des questions modifiables
sans passer par une release du jeu. Le site ne garde que ce qui lui appartient : le daily
(il lit la cible du jour) et son webhook. Les constantes `DISCORD_APP_ID/PUBLIC_KEY/BOT_TOKEN/
GUILD_ID` ajoutées à `config.example.php` pour cette version PHP ont été retirées.

## 2026-09-18 — Les titres parlent portugais, et chacun raconte sa condition dans la langue du joueur (migration 049)

En triant les 288 « valeurs identiques à l'anglais » de `i18n:check-untranslated` (quasi
tous légitimes : noms de modes, titres de jeux, lore gardé en anglais, mots identiques),
le seul vrai trou de traduction trouvé n'était pas dans `lang/` : **`titles` n'avait pas
de `name_pt`**, et `api/titles/index.php` ne connaissait que fr/es/de/it — les joueurs
portugais lisaient les titres en anglais. Et les `description_*` écrites par les
migrations 044/046 n'étaient **jamais servies** : le client affichait pour tout le monde
un texte de condition anglais codé en dur (`titleConditionText`, `profile/titles-ui.js`).
Les 14 titres d'avant la 044 n'avaient d'ailleurs aucune description.

### Quoi

- **Migration 049** : `name_pt`, `description_pt`, puis pour les **22 titres** le nom
  portugais et la description dans les **six langues** — condition lisible + une phrase de
  lore, dans le ton de la 044 (« Une escouade, ce n'est pas une personne… »). Les textes
  en/fr/es/de/it des huit titres de 044/046 sont repris à l'identique. `UPDATE … WHERE slug`,
  idempotente, no-op sur le seed.
- **`sql/bdd_mysql.sql`** : le seed `titles` porte désormais les mêmes colonnes et les mêmes
  textes — il ne les avait pas : une base neuve (Docker, CI) avait toutes les descriptions à
  NULL alors que la prod les avait via 044/046. Le seed redevient la référence des données
  aussi, pas seulement du schéma. Réécrit par script depuis un fichier de traductions, une
  ligne par colonne pour rester lisible en diff.
- **`api/titles/index.php`** : liste blanche `fr/es/de/it/pt`, `name_{lang}` et
  `COALESCE(description_{lang}, description_en) AS description`. Le suffixe passe par la
  liste blanche avant d'entrer dans le nom de colonne (PHPStan/Psalm taint : rien à dire).
- **`api/user/compendium.php`** : `name.pt` dans la carte des noms (le client
  `titleName(title, lang)` le lisait déjà avec repli EN).
- **`profile/titles-ui.js`** : `titleConditionText()` renvoie la description de l'API quand
  elle existe ; le texte anglais codé en dur ne sert plus que sans réponse serveur
  (hors-ligne, première ouverture). Trois rendus concernés : grille des titres, modale
  zoom, toast.

### Choix

- Descriptions plutôt qu'une i18n de `titleConditionText` (22 types × 6 langues dans
  `lang/`) : la table porte déjà les colonnes, la 044 avait choisi ce chemin, et une phrase
  écrite par titre vaut mieux qu'un gabarit « Win {n} {mode} games » traduit.
- Pas de `name_jp` / `description_jp` remplis : aucune langue japonaise servie par le site.
- Le fichier de traductions n'est pas versionné : le seed et la migration **sont** la
  source ; le regénérer se fait depuis la base.

### Prod

- **049 à jouer** avant la prochaine `develop → main` (checklist `TODO.md`). Sans elle :
  `Unknown column 'name_pt'` sur `GET /api/titles` et sur le Compendium → **les deux tombent
  en 500 pour tout le monde**, quelle que soit la langue. Additive et idempotente.
- Vérifiée : import du nouveau `bdd_mysql.sql` dans une base vierge (22 titres, 0 NULL),
  049 rejouée dessus (no-op) et sur la base de dev au schéma 048 (0 NULL après).

### Tests

- `tests/titlesUi.test.js` (+2) : la description prime, une description vide/absente garde
  le texte générique.
- `tests-e2e/titles_i18n.spec.js` (nouveau, 4) : six langues → `name` et `description`
  non vides pour chaque titre ; `pt` renvoie du portugais (« Não Tenho Medo ») et non le
  repli anglais ; langue inconnue → anglais sans erreur ; le Compendium expose `name.pt`
  d'un titre accordé par l'admin.
- PHPUnit 358, Vitest 1411, PHPStan propre sur la branche (les 4 erreurs affichées en local
  viennent d'`api/discord/interactions.php`, travail non commité hors de cette PR), Psalm
  taint propre, `compendium` + `stats_usecases` E2E rejoués.

## 2026-09-18 — Filtres : ne garder que le P5 de base ne tenait pas au rechargement (et l'E2E « cible P5 » qui clignotait)

L'E2E `filters_usecases › la cible du jour RESPECTE les filtres` est tombé une fois sur deux
sur la PR de release #134, sur une arborescence strictement identique à un run vert. Pas
une course : la cible reçue était un personnage **P5S** alors que le joueur du test avait
`filters_Classic = ["P5"]`. Cause dans `js/filterMenu.js` : `_migrate()` ne peut pas
distinguer `["P5"]` écrit par la fenêtre de filtres 2.2 (« le P5 de base, rien d'autre »)
de `["P5"]` de l'ancien format large (« tout Persona 5 ») — il l'étend donc en
`["P5","P5R","P5S","P5T"]` à **chaque** chargement. Le test tirait dans toute la famille,
et selon la graine aléatoire du joueur anonyme tombait sur Kasumi, Sophia ou Toshiro.

Ce n'est pas qu'un problème de test : un joueur qui décoche Royal, Strikers et Tactica
pour ne garder que Persona 5 les retrouvait cochés au rechargement suivant. Même chose
pour P3, P4 ou PQ seuls. Le test unitaire « `['P5']` seul s'étend » (PIÈGE 3,
`tests/gameCore.test.js`) documentait la moitié legacy du compromis, pas la collision.

### Correction — un marqueur de format

- `<storageKey>_precise = "1"`, posé à **chaque** écriture de la liste par le menu
  (`_save`, seed d'un opus récent, migration unique). `_migrate(saved, allOpus, precise)` :
  avec le marqueur, aucun code n'est étendu, on ne garde que les codes connus du mode.
- Une liste **sans** marqueur est une liste d'avant : étendue une fois, réécrite étendue
  **avec** le marqueur. Le joueur peut ensuite décocher Royal et le voir rester décoché.
- Les listes installées par un **défi** gardent l'heuristique large et ne sont ni
  réécrites ni marquées : un expéditeur sur un ancien front peut encore envoyer `["P3"]`
  au sens « toute la famille » (`tests/filters_usecases.test.js` le vérifie), et le
  marqueur décrit les listes du joueur, pas celles d'un défi. Limite connue : un défi
  dont l'expéditeur ne joue que le P5 de base arrive chez le receveur en famille P5.
- `js/filterMenu.js` est précaché par `sw.js` → **bump `CACHE_VERSION` à la prochaine
  release** (noté dans `TODO.md`).

### Tests

- `tests/filterMenu.test.js` (+5) : migration unique + marquage, `["P5"]` marqué reste
  `["P5"]`, ce que le joueur décoche reste décoché au rechargement, le seed pose aussi le
  marqueur, code inconnu ignoré / liste vide préservée.
- `tests-e2e/filters_usecases.spec.js` : l'état du joueur B est posé par `addInitScript`
  (filtres, marqueur, `_seeded` = PTS, graine) avant que le module ne tire la cible — et
  non goto + evaluate + reload. 10 passages d'affilée sans retry ; 35/35 sur les specs
  filtres + défis.

## 2026-09-18 — 2.2 en prod : le Compendium en 500 trente minutes après (migration 048)

**Livré** : PR #132 `develop → main` mergée à 17:37 UTC, commit `7a426b2`. L'auto-déploiement
Hostinger n'a **rien tiré** : le webroot n'avait plus fait de `fetch` depuis le 2 septembre et
son remote pointait encore sur `HamzaKarrouchi/personadle` (compte renommé le 2026-09-12).
Déploiement à la main par Hamza (`git remote set-url origin …CodeByHaamza… && git pull
--ff-only`), puis contrôles : `sw.js` v96 servi, `/api/auth/me` 200 (tables de la 042
lues), classement day et Expert 200, pages et assets 2.2 en 200. La 047 jouée par Hamza dans
la foulée (`leaderboard_cache.score` en `DECIMAL(8,1)`).

**Incident** : « Le Compendium est indisponible pour le moment » pour tout le monde.
`GET /api/user/compendium?id=…` → 500. Le `error_log` en base ne contenait que de
l'anti-triche (l'exception PDO n'y passe pas) ; trouvé en rejouant une à une les requêtes
de `compendium.php` contre la prod : `ORDER BY ut.unlocked_at, ut.id` → **`user_titles.id`
n'existe pas en prod** (clé primaire composite `(user_id, title_id)`, comme
`badges_unlocked` avant la 025). Deuxième fois dans la journée qu'une colonne classée
« cosmétique, jamais lue » par la 025 devient fonctionnelle (la 044 ce matin, avec
`titles.description_*`).

**Correction — migration `048_reconcile_prod_id_columns.sql`** : les quatre colonnes de
`bdd_mysql.sql` encore absentes en prod, d'un coup — `user_titles.id` (celle qui casse),
`user_stats.id`, `game_sessions.created_at`, `social_link_ranks.name_jp`. Même technique que
la 025 pour les `id` : `AUTO_INCREMENT` ajouté en `UNIQUE KEY`, la clé primaire composite
reste ; les lignes existantes sont numérotées. Validée contre des tables recréées dans
Docker avec le `SHOW CREATE TABLE` de la prod (passe, rejeu no-op), no-op sur la
référence, puis jouée en prod et enregistrée : Compendium en 200 avec `user, badges,
titles, wallpapers, friends, challenges, feats` pour deux joueurs testés.

**Depuis la 048, la prod a exactement les colonnes de la référence** (diff
`information_schema` vide hors vues `v_friends`/`v_global_stats`, jamais lues par le code).
Nouveau piège dans CLAUDE.md §7 : plus d'exception « cosmétique » ; `npm run
schema:check-prod` sur le serveur avant chaque release, et toute migration qui INSERT est
rejouée contre le schéma prod recréé, pas seulement contre `bdd_mysql.sql`.

### Ce que l'incident dit de la chaîne de release

- La CI ne peut pas voir ce bug : elle importe `bdd_mysql.sql`, jamais le schéma réel de
  la prod. Un code juste contre la référence était faux contre la prod pendant trente
  minutes. Le détecteur `scripts/check_prod_schema.php` existait depuis juillet et aurait
  listé `user_titles.id` — il n'a pas été lancé, parce que la 025 avait décidé que ces
  colonnes ne comptaient pas.
- `error_log` (table) n'attrape pas les exceptions PDO des endpoints : on l'a appris en
  cherchant l'erreur. La méthode qui a marché — extraire les requêtes du fichier et les
  rejouer une à une en lecture seule — mérite un script si ça se reproduit.
- L'auto-déploiement est à re-brancher dans hPanel (Git → dépôt `CodeByHaamza/personadle`),
  sinon chaque `main` demande un pull manuel. Le cron horaire `api/cron/leaderboard.php`
  est à vérifier au même endroit : le cache était vide avant la release.

## 2026-09-18 — Release 2.2 : la 044 refusée par la prod, `titles` n'avait jamais eu ses colonnes de description

En jouant les migrations 040→046 sur Hostinger avant `develop → main` (procédure
`DEPLOY.md` § Release majeure), la **044** est tombée dès la première ligne :
`Unknown column 'description_en'`. La table `titles` de prod vient de l'archive du
2026-05-06 et n'a **jamais** eu `description_*` / `name_jp` ; son `condition_value` est
`INT NOT NULL DEFAULT 0` là où `sql/bdd_mysql.sql` le laisse NULL. La **025** avait
classé cet écart « cosmétique, jamais lu par le code » — exact jusqu'à ce que la 044
insère des descriptions et un titre sans valeur numérique (`tatsuya_dont_burn_out`,
`played_on_date`), et la 046 pareil (`wonder_go_beyond`, `targets_found`).

Rien n'a été inséré (l'`INSERT` a échoué atomiquement), 040→043 étaient déjà passées.
Correction : la **044 porte désormais son prérequis** — un `ALTER TABLE titles ADD COLUMN
IF NOT EXISTS …` (7 colonnes NULL) + `MODIFY condition_value INT NULL` en tête, avant les
insertions. Choix de l'amender plutôt que d'ajouter une 047 : une 047 numérotée après la
046 devrait pourtant passer AVANT la 044 sur toute base au schéma prod, ce que
`scripts/apply_migrations.sh` (ordre des fichiers) ne ferait jamais. La 044 n'avait été
jouée nulle part ailleurs qu'en Docker/CI, où elle est un no-op.

Vérifié : rejouée contre une base Docker recréée avec le `SHOW CREATE TABLE titles/badges`
de la prod (passe, rejeu no-op, puis 046 passe derrière), et contre le schéma de référence
(no-op). Puis en prod : 044, 045, 046 OK ; `schema_migrations` 040→046 enregistrées ;
69 badges / 22 titres ; `favorite_mode`, `guesses`, `ban_reason`, `is_expert` présentes ;
`uq_leaderboard` à 6 colonnes. Backup local avant tout (`~/personadle_backups/`, 49 Mo).

### Dérive prod restante, constatée au passage (diff `information_schema` prod ↔ référence)

Corrigé dans la foulée : `leaderboard_cache.score` était `int(11)` en prod contre
`DECIMAL(8,1)` dans la référence, et la métrique winrate (`ROUND(…, 1)`,
`api/lib/leaderboard_metrics.php`) y aurait été tronquée — 73.4 et 73.1 à égalité dans le
cache day/week/month. → **047** `leaderboard_cache_score_decimal` (MODIFY idempotent, no-op
sur la référence). Le cache était **vide** en prod au moment de la release (0 ligne dans le
dump d'avant-migration) : le cron horaire `api/cron/leaderboard.php` n'a visiblement jamais
tourné sur Hostinger — à vérifier dans hPanel, sinon le classement par période reste en
calcul live. La 047 est dans le dépôt, à jouer en prod (checklist `TODO.md`).

Non corrigé — aucune n'est lue par le code 2.2, même critère que la 025 :
`game_sessions.created_at`, `social_link_ranks.name_jp`, `user_stats.id`, `user_titles.id`
absentes en prod ; en prod seulement : `friendships.updated_at`, `game_sessions.perfect_win`,
`messages.updated_at`, la table `social_link_badge_configs` et
`social_link_rankup_notifs.is_badge_prompt` ; vues `v_friends` / `v_global_stats` de
définition différente ; types plus stricts en prod (`enum` vs `varchar` sur
`friendships.status`, `game_sessions.result`, `titles.rarity`).

## 2026-09-18 — content(Shujin) : Wonder Shujin en AOA, cinq badges vérifiés serveur, le titre Go Beyond, trois musiques (branche `content/wonder-shujin-badges-musiques`)

Lot de contenu autour de la tenue Shujin de Wonder (P5X). Ce qui le distingue des lots
de badges précédents : **aucun des cinq badges n'est `manual`**. Chacun a une condition
que `api/lib/condition_check.php` tranche à partir de `game_sessions` (ou de
`friendships`/`social_links`/`profiles` pour le badge social), le client ne faisant que
le miroir pour le retour immédiat. Deux vocabulaires nouveaux en découlent
(`targets_found`, `same_energy`), plus un compteur (`mode_expert_perfect_wins`).

### All-Out Attack — Wonder Shujin

- Source : une vidéo mp4 (zip fourni). Conversion en webp animé au format des autres
  AOA (800×450, 30 fps, 106 frames, 1,7 Mo) :
  `ffmpeg -i in.mp4 -vf "crop=1296:729:11:26,fps=30,scale=800:450:flags=lanczos" -loop 0 -an -c:v libwebp_anim -q:v 75 -compression_level 6 Wonder_Shujin.webp`
  Le `crop` retire les bandes de l'enregistrement ; le `-an` retire la piste audio (un
  webp n'en porte pas, mais sans le flag ffmpeg avertit et certains builds échouent).
- Trois fichiers, nommés comme les autres tenues de Wonder (`Wonder_Velvet`,
  `Wonder_Summer`…) : `allOutAttackMode/database/allOutAttack/Wonder_Shujin.webp`
  (animation), `img/Wonder_Shujin.webp` (rendu AOA, portrait), `img/Wonder_Shujin_Battle.webp`
  (artwork de la tenue).
- `aoaCharacters.js` (`{ nom: "Wonder Shujin ( Nagisa Kamishiro )", gif: "Wonder_Shujin", opus: ["P5X"] }`),
  `personas_allOut.js` (autocomplétion), `portraitsMap.js`.
- **Prod** : les animations AOA sont servies depuis le CDN R2 (`allOutAttack/`), pas depuis
  git. `Wonder_Shujin.webp` doit y être **téléversé avant** `develop → main`, sinon la
  cible tombe sur une image cassée le jour où elle sort. Noté dans la checklist `TODO.md`.
- Au passage, le test d'intégrité des assets a sorti une coquille préexistante :
  `Yuki ( Yukimi Fujikawa )` pointait sur `gif: "Yuki_X"` alors que les fichiers et
  `portraitsMap` s'appellent `YukiX` — l'animation ne chargeait pas. Corrigé.

### Cinq badges (migration 046, `sql/bdd_mysql.sql` → 69 badges)

| Badge | Rareté | `condition_type` / `mode` / `value` | Ce que le serveur vérifie |
| --- | --- | --- | --- |
| `starlight_festival` | rare | `targets_found` / `starlight_trio` / NULL | 3 victoires AOA distinctes : Joker, Panther, Mona Starlight |
| `shujin_outlaws` | rare | `targets_found` / `shujin_outlaws` / NULL | AOA Wonder Shujin **et** Silhouette Ren Amamiya + Nagisa Kamishiro |
| `absolute_authority` | rare | `targets_found` / `absolute_authority` / NULL | Classique : Mitsuru Kirijo + Makoto Niijima (les deux présidentes du conseil) |
| `dont_waste_your_breath` | epic | `mode_expert_perfect_wins` / `classic` / 5 | 5 victoires Classique **Expert** en 1 essai (`is_expert = 1`, `attempts = 1`) |
| `same_energy` | epic (social) | `same_energy` / NULL / NULL | un ami accepté, `social_links.rank ≥ 5`, l'un porte Motoha Arai, l'autre Chie |

Les deux badges « je te laisse faire » : *Absolute Authority* réunit les deux présidentes
du conseil des élèves (Mitsuru, Makoto) en Classique — le mode où leur autorité s'entend
dans la citation ; *Don't Waste Your Breath* colle au nom : en Classique Expert, une
citation, une réponse, cinq fois. Cumulatif, donc monotone (piège §7 de CLAUDE.md).

- **`targets_found`** : `condition_mode` est une **clé d'ensemble** de la constante
  `PERSONADLE_TARGET_SETS` (pas un mode de jeu). Un ensemble = liste d'exigences
  `[mode, is_expert|null, [target_name…], minDistinct]` ; `personadle_target_set_met()`
  exige que **toutes** soient remplies, via `COUNT(DISTINCT target_name)` sur les
  sessions gagnées (`result = 'win'`, `target_name IN (…)`, `is_expert` optionnel). Les
  noms sont les `target_name` **exacts** écrits par `api/sessions.php` — donc ceux des
  datasets (`"Wonder Shujin ( Nagisa Kamishiro )"` en AOA, `"Nagisa Kamishiro"` en
  Classique/Émoji/Silhouette/Personae, le `titre` en Music). Une clé inconnue → `false`
  (fail-closed : une faute de frappe dans une migration n'accorde rien à personne).
  `targets_found` et `same_energy` **ne figurent pas** dans `$valueRequiredTypes` : leur
  `condition_value` est légitimement NULL. La première version les y avait mis par
  erreur (mauvaise ancre de patch) et le test PHPUnit Same Energy l'a attrapé.
- **`same_energy`** : `personadle_same_energy_partners()` renvoie les ids des amis
  (`friendships.status = 'accepted'`) dont le lien a `rank ≥ 5` (`LEAST/GREATEST` pour
  retrouver la paire) et dont l'`avatar_data` forme la paire attendue avec le mien —
  `PERSONADLE_SAME_ENERGY_AVATARS = ['arai' => ['Arai.png','Arai2.png'], 'chie' =>
  ['Chie.jpg','Chie2.jpg','chie_pq.jpg','meme_chie_shut_teddie.jpg']]`, comparé par
  `str_ends_with($avatar, '/'.$file)` (le chemin galerie exact ; une data URL ou un nom
  voisin ne passe pas). `LEFT JOIN profiles` parce que `makeUser()` des tests ne crée pas
  de ligne `profiles` (register.php le fait en prod) — et un compte sans ligne profiles ne
  doit pas casser la requête, juste ne pas matcher.
  **Les deux reçoivent le badge au même instant** : `api/badges/index.php`, après
  l'`INSERT IGNORE` du demandeur, boucle sur les partenaires et insère pour eux aussi.
  L'ami le voit à son prochain `pullProfileFromCloud()`.
- **`mode_expert_perfect_wins`** : `personadle_count_expert_perfect_wins()` — `is_expert = 1`,
  `result = 'win'`, `attempts = 1`, par mode. Seul des trois à exiger une `condition_value`.
- Vocabulaire : `personadle_known_condition_types()` gagne les trois ;
  `tests/php/ConditionVocabularyTest.php` (switch == liste connue) reste vert.

### Titre Go Beyond (migration 046, `titles` → 22)

`wonder_go_beyond` — `targets_found` / `wonder_go_beyond`, légendaire, image
`profile/titles/wonder_go_beyond.webp` (2080×512, fourni). L'ensemble : les **5** AOA de
Wonder (Classic, Chinese New Year, Velvet, Summer, Shujin), Nagisa en Classique **et**
Émoji, Nagisa en Personae normal **et** Expert (le `target_name` Personae est le
personnage, pas la persona), et toutes les musiques P5X en Music normal (9 titres) **et**
Expert (les 8 qui ont des paroles — `Arial Of The Soul` est instrumental, donc absent de
`expert_mode_content.md` et non tirable en Expert). Reformulation assumée de la demande
(« ou un truc du genre ») : l'ensemble est fermé et chaque exigence est vérifiable en SQL.
Grindable par construction : le filtre d'opus P5X seul + Rejouer fait tourner les 9 chansons.

Client : `profile/titles-ui.js` `isTitleConditionMet()` gagne `case "targets_found"` →
`targetSetMet(profile, title.condition_mode)`. Le miroir client (`TARGET_SETS` dans
`badgesData.js`) ne connaît que la partie **visible** de l'ensemble (AOA, Classique, Émoji,
Personae — via `profile.characterModeMap`), pas la dimension Expert ni les musiques : il
déclenche la *tentative* d'unlock, et c'est le serveur qui tranche (403 tant que le reste
manque). Un texte de condition lisible est ajouté dans `titleConditionText()`.

### Client (miroirs)

- `profile/badges/badgesData.js` : `TARGET_SETS`, `targetSetMet(profile, key)`,
  `SAME_ENERGY_AVATARS`, `wearsAvatar(avatar, files)`, et les cinq entrées. Les checks :
  `targetSetMet(profile, "starlight_trio" | "shujin_outlaws" | "absolute_authority")`,
  `(profile.classicExpertPerfectWins || 0) >= 5`, `Boolean(profile.sameEnergyWith)`.
- `profile/badges/badgesManager.js` `checkSocialBadges()` : pose `profile.sameEnergyWith =
  partner.user_id` quand un ami de `social_link_rank ≥ 5` forme la paire d'avatars avec moi.
- `classiqueMode/modeClassique.js` : en victoire Expert à 1 essai, `classicExpertPerfectWins++` ;
  le chemin Expert appelle désormais `checkBadgesAfterGame()` (il n'appelait rien, puisque
  `checkUnlocksAfterGame()` est réservé au mode normal).
- `lang/*.json` : `badges.{starlight_festival,shujin_outlaws,absolute_authority,dont_waste_your_breath,same_energy}.{name,condition,description}` ×6 (1285 clés).

### Musique — trois titres, et la règle des jumelles Expert

- `musicsMode/database/music/song/{Invitation_to_Freedom,Light_the_Fire_Up_in_the_Night_P3_Side,Light_the_Fire_Up_in_the_Night_P4_Side}.mp3`,
  `songs.js` (+3 : PQ2 / Lyn Inaizumi ; PQ / Lotus Juice & Yumi Kawamura ; PQ / Lotus Juice
  & Shihoko Hirata), `musicTitles.js` (+3), pools régénérés (`music` 99, `music_expert` 78).
- `expert_mode_content.md` : paroles de *Invitation to Freedom* et de *Light the Fire Up in
  the Night (P3 Side)* uniquement. Les deux faces partagent les **mêmes paroles** — les
  mettre deux fois aurait fait tirer deux cibles indistinguables. Décision : seule la face
  P3 est tirable en Expert, et la face P4 est **acceptée comme réponse** quand la P3 est la
  cible. Nouveau `musicsMode/database/expert_twins.js` (`EXPERT_TWINS = { "…(P3 Side)":
  ["…(P4 Side)"] }`), consommé par `guessMatchesTarget()` dans `modeMusic.js` — Expert
  seulement ; en mode normal les deux mp3 sont différents, la réponse doit être exacte.
- Angle mort assumé : la jumelle ne s'applique qu'à la validation. La cible enregistrée
  (`target_name`) reste la face P3, donc le titre Go Beyond ne dépend pas de ce mécanisme
  (aucune des deux faces n'est P5X).

### Classement — le haut du bloc Expert laissait passer le fond

`profile/leaderboard/leaderboard.css` `.lb-filters-card--expert` : le dégradé violet était
posé **seul** en `background`, translucide jusqu'au bout → la ville en arrière-plan
transparaissait sous le haut du bloc « Classement » quand on cliquait Expert.
`background: linear-gradient(…), var(--lb-surface)` — la teinte par-dessus la surface
opaque, comme le bloc normal.

### Migration `sql/migrations/046_badges_wonder_shujin_go_beyond.sql`

`INSERT IGNORE` sur `badges` (5 lignes, noms en/fr/es/de/it + `condition_en`) et `titles`
(1 ligne, noms et descriptions en 5 langues). Rejouée contre une base vierge (import
`bdd_mysql.sql` → 69 badges / 22 titres), puis une seconde fois : no-op. **À jouer en prod
avant `develop → main`** — sans elle, le client tente `POST /api/badges/unlock` sur un
slug inconnu (404) et les cinq badges n'existent pour personne.

Pas de bump `CACHE_VERSION` ici : `develop` est déjà en v96 contre v95 en `main`
(lot 045, non livré), et ce bump couvrira `modeMusic.js`, `modeClassique.js`,
`leaderboard.css` et `badgesData.js`, tous précachés et tous modifiés par ce lot.

### Tests

- `tests/php/DatabaseIntegrationTest.php` : `winTarget()` (session gagnée sur une cible
  exacte, mode, dimension Expert), un test par ensemble (2/3 → refusé, 3/3 → accordé ; mauvais
  mode → refusé ; Expert requis → normal refusé), Go Beyond complet (24 victoires distinctes),
  `mode_expert_perfect_wins` (4 → refusé, 5 → accordé ; un essai de plus ne compte pas ;
  mode normal ne compte pas), Same Energy (`makeSameEnergyPair()` : rang 4 → refusé, rang 5 →
  accordé dans les deux sens ; deux Arai → refusé ; non ami → refusé ; les deux comptes reçoivent
  le badge via l'endpoint), et **chaque `target_name` des ensembles existe dans
  `api/data/daily_pools.json`** (un renommage de dataset rendrait le badge indébloquable en
  silence). PHPUnit : 358 tests, 2 skips.
- `tests/php/BadgeWallpaperCatalogTest.php` : catalogue exact (69), `wonder_go_beyond` dans
  la table des titres, `mode_expert_perfect_wins` dans le balayage des seuils numériques.
- `tests/badgesCatalogParity.test.js` : `mode_expert_perfect_wins` dans les types numériques.
- `tests/unlocks_wonder_shujin.test.js` (nouveau, 26 tests) : parité **littérale** des miroirs
  (les listes `TARGET_SETS`/`SAME_ENERGY_AVATARS` du client sont comparées à
  `PERSONADLE_TARGET_SETS`/`PERSONADLE_SAME_ENERGY_AVATARS` extraits du **source PHP**,
  commentaires `//` retirés d'abord — une apostrophe dans un commentaire faussait l'extraction),
  existence de chaque cible dans les datasets, `check()` des cinq badges, `checkSocialBadges`,
  le titre côté client, l'intégrité des assets de **toutes** les entrées AOA (webp animé +
  portrait + Battle, autocomplétion, portraitsMap — c'est lui qui a sorti `Yuki_X`), les trois
  musiques (mp3, image, autocomplétion, paroles P3 oui / P4 non), les jumelles (la clé a des
  paroles, chaque valeur est un vrai titre **sans** paroles propres) et un test de source qui
  vérifie que `modeMusic.js` valide bien via `guessMatchesTarget`.
- `tests-e2e/unlocks_wonder_shujin.spec.js` (nouveau, 7 tests, contre la vraie API) : pour
  chaque badge, sessions réelles → `POST /api/badges/unlock` répond **403 avant, 200 après** ;
  Same Energy monté via l'admin (`PATCH /api/admin/social-links/:id {rank}` +
  `PATCH /api/user/:id {avatar_data}`) puis `interact` → **les deux comptes** ont le badge ;
  Go Beyond via `POST /api/titles/unlock {title_slug}` après avoir ouvert les portes Expert
  Personae et Music (15 parfaites chacune). 7/7 en local.
- Changelog joueur : la section « Sept titres et un badge de plus » (volontairement sans noms
  ni conditions) est remplacée par **« Huit titres, six badges et trois musiques »** — demande
  Hamza du 2026-09-18 : « mets tous les badges et titres, bref toute nouvelle donnée ». Tout ce
  que la 2.2 ajoute à la collection y est écrit, images, noms FR/EN et conditions : les 7 titres
  de la 044 + Go Beyond en `.title-card` (vocabulaire de rareté de la 2.0), Song of Orpheus + les
  5 badges de la 046 dans une vitrine `.badge-showcase` (mêmes couleurs de rareté), et la liste
  des 3 musiques avec la règle des jumelles. Les conditions sont de toute façon lisibles dans la
  collection du profil. La section AOA passe à « Trois nouveaux All-Out Attack » avec la carte
  Wonder Shujin (variante `.aoa-card-shujin` — blazer noir à trame, boutons dorés, bande de
  tartan rouge en pied, sombre dans les deux thèmes). Le modal « Nouveautés » 2.2 de
  `index.html` passe à « trois All-Out Attack » et gagne la puce titres/badges/musiques dans les
  6 langues (noms de titres en anglais pour le PT : la table `titles` n'a pas de `name_pt`).

## 2026-09-18 — Badge Data Mining : appel à une fonction qui n'existe pas

Signalé en test : le badge `data_mining` (« Visit 5 different user profiles ») ne se
débloquait pas à la 5e visite. `profile/profile-view.js` appelait
`m.checkBadges(profile, save)` sur le module `badgesManager.js` — **ce symbole n'a
jamais été exporté**. L'appel partait donc sur `undefined`, levait un TypeError, et le
`.catch(() => {})` qui entourait l'import dynamique l'avalait sans la moindre trace en
console. Le joueur finissait par récupérer le badge en rouvrant SON profil (où
`initBadgesSystem()` réévalue toutes les conditions), ce qui rendait le symptôme
intermittent et difficile à relier à la visite elle-même.

Remplacé par `checkBadgesAfterGame()`, le check léger commun à toutes les pages (déjà
utilisé par `js/unlock-notify.js` pour les 6 modes) : il relit `localStorage` — qu'on
vient d'écrire deux lignes plus haut — évalue toutes les conditions et affiche la
notification de déblocage, sans toucher à l'UI de la page profil, absente ici puisqu'on
regarde le profil de quelqu'un d'autre.

### Détails techniques

- `profile/profile-view.js` — `m.checkBadges(...)` → `m.checkBadgesAfterGame()`
- `tests/dataMiningBadge.test.js` (nouveau, 7 tests) sur deux angles :
  - **contrat d'import** : tout `m.xxx()` appelé dans `profile-view.js` doit exister
    parmi les exports de `badgesManager.js`. C'est l'angle qui manquait — un import
    **dynamique** n'est vérifié ni par ESLint ni au chargement, et c'est précisément ce
    qui a laissé passer le bug pendant des mois. Ce garde-fou couvre tous les futurs
    appels de ce module, pas seulement `checkBadges`.
  - **comportement** : 4 profils visités → refusé, 5 → accordé ; 5 fois le même profil →
    refusé (la liste est dédoublonnée par un `Set` côté `profile-view.js`).
- Vérifié en réel : les 2 tests de contrat échouent sur le code d'avant, les 7 passent après.

### Angles morts connus (non corrigés ici)

- `visitedProfileIds` vit **uniquement en `localStorage`**, jamais poussé au backend.
  Visiter 3 profils sur mobile et 2 sur desktop ne débloque donc rien nulle part. Une
  colonne dédiée (ou une réutilisation de l'historique `social_links`) réglerait le point ;
  c'est un choix produit, pas une régression.
- Le suivi des visites est imbriqué dans le `if (gaugeContainer && ...)` de la jauge
  Social Link : si `#socialLinkGaugeContainer` disparaît du HTML, le comptage s'arrête en
  silence. Dépendance à une div sans rapport, à sortir de ce bloc à la prochaine passe.
- Le badge est `condition_type = 'manual'` côté serveur (comme 46 autres) : la condition
  n'est pas revérifiée à l'unlock. Cf. l'audit des conditions de déblocage.

## 2026-09-18 — Un défi Expert se voit enfin comme tel

`challenge_is_expert` (migration 037) traversait toute la chaîne — `api/messages`
→ `js/notifications.js` → `js/challenge-notif.js` — mais ne pilotait que trois
choses **invisibles** : la page d'arrivée (`?expert=1`), le casier `localStorage`
et le barème d'XP. À l'écran, un défi Expert et un défi normal étaient
rigoureusement identiques : même pop-up rouge, même pastille de mode, mêmes
anneaux, même flash. Dans la Boîte de la page Amis, `challenge_is_expert`
n'apparaissait que dans les attributs `data-isexpert` des boutons — lu par le
code, jamais par l'œil.

Le joueur ne découvrait donc la dimension qu'une fois **arrivé sur la page du
mode**, c'est-à-dire après avoir accepté, donc après s'être engagé sur un barème
qui n'a rien à voir (un seul indice, 5 à 30 essais contre 3). Et la migration 037
autorise explicitement un défi normal ET un défi Expert le même jour entre les
mêmes amis : deux lignes strictement identiques dans la Boîte, sans moyen de
savoir lequel des deux boutons « Accepter » menait où.

### Choix de palette

Violet `#b26aff` → magenta `#ff4d8d` sur fond violet-noir, repris **tel quel** de
`.challenge-card--expert` (`css/global.css`), la carte d'**envoi** du défi Expert
qui existait déjà. Volontairement la même des deux côtés : celui qui envoie et
celui qui reçoit doivent reconnaître le même objet. L'or `#ffd700` de l'écran de
déblocage du Mode Expert a été écarté — il dit « tu viens de débloquer quelque
chose », pas « ce défi-ci est Expert », et un troisième vocabulaire Expert aurait
brouillé les deux.

### Détails techniques

- `js/challenge-notif.js` — classe `cn--expert` sur l'overlay + étiquette
  `.cn-expert-tag` dans la carte + message d'accroche dédié. Le DOM reste
  **commun** aux deux variantes : tout l'écart vit dans le CSS, donc une
  évolution de la pop-up normale suit automatiquement.
- `css/challenge-notif.css` — bloc `.cn--expert` en surcharges : fond radial plus
  dense, anneaux violet/magenta, flash `cnFlashExpert`, carte en dégradé avec
  liseré supérieur, avatar/pseudo/pastille/boutons réaccordés. Le liseré est en
  `position: absolute` et non un enfant de flux : la carte est un flex column
  avec `gap: 10px`, un `::before` dans le flux aurait ajouté un espace fantôme.
  Bloc `prefers-reduced-motion` : le surcroît d'effet est coupé, le marqueur
  textuel porte le sens à lui seul.
- `profile/friends/friends.js` — pastille `.fr-challenge-expert-pill` + classe
  `.fr-challenge-card--expert`, sur les **trois** statuts (en cours / gagné /
  expiré). L'historique est justement l'écran où l'on compare ses défis.
- `profile/friends/friends.css` — surcharges assorties, dark mode compris (le
  violet foncé de la pastille de mode passe sous le seuil de lisibilité sur
  `#1a1a1a`, remonté en `#d9a4ff`). La pastille pose `margin-right: auto`
  (l'en-tête est en `space-between`, elle se serait placée au centre) et
  `align-self: flex-start` (les cartes gagnée/expirée sont en flex column, elle
  se serait étirée sur toute la largeur).
- i18n : `challenge.notif_expert_tag` et `challenge.notif_challenges_you_expert`,
  EN d'abord puis fr/es/de/it/pt — `npm run i18n:check` vert, 1266 clés.
- Tests : `tests/challengeNotifExpert.test.js` (nouveau, 10 tests) et 5 tests
  ajoutés à `tests/friends_challenge_actions.test.js`.

### Pourquoi les tests vérifient la CLASSE et pas la couleur

jsdom ne résout pas les feuilles externes : une valeur hexadécimale attendue dans
un test ne prouverait rien de plus que sa propre recopie. Ce qui est verrouillé,
c'est le **crochet** (`cn--expert`, `fr-challenge-card--expert`), le **marqueur
textuel** (traduisible, et vérifié contre le piège CLAUDE.md §5 où `t(key)`
renvoie la clé brute), et la **parité de structure** entre les deux variantes —
si la variante Expert diverge structurellement, elle cesse de suivre les
évolutions de la pop-up normale, ce qui est l'inverse du but.

### Angles morts connus

- La pop-up de **résultat** de défi (`js/challenge-result.js`, vue par
  l'expéditeur quand son défi est battu ou expiré) n'est pas encore marquée. Elle
  reçoit pourtant le message brut, `challenge_is_expert` compris — elle l'ignore,
  simplement (0 occurrence de « expert » dans le fichier). C'est donc un ajout
  purement front, sans rien à faire côté API. À reprendre.
- Aucun test E2E : les tests ci-dessus sont en jsdom, donc le rendu réel des
  dégradés et du liseré n'est vérifié qu'à l'œil.

## 2026-09-18 — Audit des conditions de déblocage : 3 bugs serveur, dont un exploitable

Audit de bout en bout des **92 lignes** du catalogue (64 badges, 7 wallpapers, 21 titres)
et des 64 `check()` client. Chaque condition structurée a été jouée contre une vraie
MariaDB 10.11, à la frontière exacte : compte à `seuil - 1` → doit refuser, compte à
`seuil` → doit accorder.

**Résultat : les 42 conditions structurées sont correctes.** Les 50 autres lignes sont
`manual`/`joker_profile`, c'est-à-dire **pas vérifiées côté serveur du tout** — ce n'est
pas un bug mais c'est un fait qui ne se lisait nulle part. Les bugs trouvés sont ailleurs :
dans l'infrastructure de vérification elle-même.

### Bug 1 — `CONVERT_TZ` rendait la garde anti-spam Social Link totalement inopérante

**Avant.** Les 4 requêtes « interactions d'aujourd'hui » filtraient avec
`DATE(CONVERT_TZ(created_at, '+00:00', 'Europe/Paris')) = :jour`. Vers un fuseau **nommé**,
`CONVERT_TZ` exige les tables de fuseaux du serveur SQL (`mysql.time_zone_name`), qui ne
sont pas peuplées par défaut et sont typiquement absentes d'un hébergement mutualisé — le
dépôt le documentait **déjà** dans `api/admin/activity.php`, qui contourne en regroupant
côté PHP. Les requêtes Social Link, elles, étaient restées dessus.

Sans ces tables, `CONVERT_TZ` ne lève rien : il renvoie `NULL`. `DATE(NULL) = '2026-09-18'`
vaut `NULL`, donc faux, donc **la requête ne trouve jamais rien**. Mesuré sur MariaDB 10.11
sans tables de fuseaux :

- garde « 1 action par jour » morte → **180 appels de `share_streak` d'affilée le même jour
  acceptés**, 2700 XP, rang 10 atteint d'un coup ;
- donc le wallpaper `dark_shopping_district` (rang ≥ 5) **et** le titre
  `aigis_metis_same_soul` (rang ≥ 10) accordés par simple répétition ;
- bonus mutuel mort → deux amis actifs le même jour payés au tarif solo (15 au lieu de 30),
  la jauge progressant deux fois moins vite que ce que le produit annonce.

**Après.** Nouvelle fonction `personadle_paris_day_bounds_utc()` (`api/lib/social_link.php`)
qui calcule les bornes UTC de la journée Paris **en PHP**, DST compris, et les 4 requêtes
comparent désormais la colonne nue : `created_at >= ? AND created_at < ?`. Vérifié : le
même scénario est bloqué au 1ᵉʳ appel, les deux déblocages repassent à « refusé ».
Bénéfice secondaire — la comparaison ne porte plus sur une expression, donc un index sur
`created_at` redevient utilisable.

**Pourquoi rien ne l'avait vu.** Les deux tests de `DatabaseIntegrationTest` qui couvrent
la garde et le bonus mutuel sont bons ; c'est l'**environnement** qui mentait. L'image
Docker MySQL de la CI embarque les tables de fuseaux — CI verte sur un chemin que la prod
n'emprunte pas. Cas exact de CLAUDE.md §13 (« CI verte insuffisante si elle ne peut pas
exécuter le scénario concerné »). Le nouveau `tests/php/ParisDayBoundsTest.php` attaque
donc par un garde-fou **statique** (plus aucun `CONVERT_TZ` exécuté dans `api/`, analyse du
code hors commentaires) plus 7 tests de calcul de bornes, dont les deux journées de
bascule DST (23 h et 25 h). Aucun ne dépend du serveur SQL.

⚠️ **À vérifier en prod** : si les tables de fuseaux SONT peuplées chez Hostinger, la garde
fonctionnait et il n'y a rien à rattraper. Sinon, des rangs Social Link ont pu être gonflés,
et avec eux ces deux déblocages. Commande de contrôle :
`SELECT COUNT(*) FROM mysql.time_zone_name;` — 0 = le bug était actif.

### Bug 2 — badges et titres étaient fail-**open** sur un `condition_type` inconnu

**Avant.** `api/badges/index.php` et `api/titles/index.php` appelaient
`personadle_verify_condition()` en direct. Cette fonction se termine par
`default: return true` — un safe-fallback voulu, pour ne pas rendre inaccessible un badge
ajouté demain avec un type pas encore implémenté. Mais sur le chemin d'un `POST /unlock`,
il fait l'inverse de ce qu'on veut : **une faute de frappe dans une migration ouvrait le
badge à n'importe quel compte authentifié**. `api/wallpapers/index.php` fermait déjà ce
trou de son côté (revue PR #14) — donc trois endpoints, deux comportements.

**Après.** La garde est remontée dans `personadle_condition_allows_unlock()`
(`api/lib/condition_check.php`) et les **trois** endpoints passent par elle. Un type absent,
vide, mal orthographié ou retiré du vocabulaire refuse l'unlock. `personadle_verify_condition()`
garde son fallback permissif là où il a du sens (affichage du catalogue).

### Bug 3 — le vocabulaire avait dérivé, et le test censé le détecter comptait au lieu de comparer

**Avant.** `personadle_known_condition_types()` listait 22 types alors que le `switch` en
gère 24 : **`titles_count` et `played_on_date` manquaient**. Inoffensif tant que seuls les
wallpapers utilisaient cette liste (aucun n'emploie ces deux types), mais c'était une mine :
en étendant le fail-closed aux titres (bug 2), les titres **`sees`** (`titles_count`) et
**`tatsuya_dont_burn_out`** (`played_on_date`) seraient devenus indébloquables pour toujours
— un 403 « Condition not met » sur un joueur qui remplit pourtant la condition.

Un test existait pourtant, `ConditionCheckTest::testKnownConditionTypesMatchesSwitchCases`,
et son commentaire décrivait exactement le bon invariant. Son implémentation faisait
`assertCount(22, $known)`. **Un compte ne dit rien de l'ensemble** : la liste était bien à
22 entrées, avec les deux mauvaises manquantes. Le test était vert et épinglait le mauvais
nombre — c'est lui qui rendait la dérive invisible.

**Après.** Les deux types ajoutés (corrigé **avant** d'appliquer le fail-closed, sinon les
deux titres cassaient). Le compte magique est remplacé par une comparaison **ensembliste**
entre les `case` du switch et la liste — dans `tests/php/ConditionVocabularyTest.php`, sans
base de données, donc elle tourne même sans `make up`. Les 6 tests de ce fichier échouent
tous sur le code d'avant.

### Ce que l'audit a AUSSI vérifié, sans rien trouver

- **Les 64 `check()` client** : chaque champ de profil lu par un `check()` a bien au moins
  un écrivain dans le dépôt. Trois candidats (`velvet_headache`, `chinese_new_year`,
  `github_contributor`) se sont révélés être des **faux positifs de l'outil d'audit** — leurs
  flags sont écrits par le helper `check("flag", cond)` de `modeAllOutAttack.js` et par un
  `onclick` dans `index.html`, deux formes que la première version du script ne couvrait pas.
- **Tous les imports dynamiques du dépôt** : les 4 appels `import(…).then(m => m.x())`
  ciblent des symboles réellement exportés (`data_mining` était le seul cassé, corrigé plus haut).
- **Parité des deux catalogues de badges** : client (64 entrées) ↔ SQL (64 lignes) — mêmes
  slugs, mêmes drapeaux « secret », mêmes seuils chiffrés.

### Trous de test comblés

| Trou | Comblé par |
|---|---|
| Aucun balayage de seuil sur les 5 types Expert | `NUMERIC_THRESHOLD_TYPES` étendu + 6 helpers `game_sessions` |
| Aucun mapping exhaustif par titre (badges/wallpapers en avaient un) | `testEveryTitleHasExpectedConditionColumns` — 21 titres |
| Rien ne comparait `badgesData.js` et la table `badges` | `tests/badgesCatalogParity.test.js` (7 tests, sans base) |
| Le vocabulaire pouvait dériver en silence | `tests/php/ConditionVocabularyTest.php` (6 tests, sans base) |
| `CONVERT_TZ` invisible en CI | `tests/php/ParisDayBoundsTest.php` (8 tests, sans base) |

Total : 338 tests PHPUnit (contre 322) et 1383 Vitest (contre 1376), tous verts — les
PHPUnit joués contre une MariaDB **sans** tables de fuseaux, c'est-à-dire dans la
configuration de la prod et non dans celle de la CI.

### Angle mort assumé, non corrigé ici

**47 badges sur 64** et 1 titre sont `condition_type = 'manual'` : le serveur les accorde
sur simple déclaration du client. N'importe quel compte authentifié peut appeler
`POST /api/badges/unlock` avec ces slugs et les obtenir. C'est cohérent avec un fan-game
sans enjeu compétitif, et plusieurs de ces conditions ne sont pas re-vérifiables depuis les
tables de stats (flags narratifs, codes événement, découvertes de personnages) — mais
certaines le seraient (`data_mining` = 5 profils visités, `leblanc_meeting` = 3 amis
connectés le même jour). À trancher comme décision produit, pas à corriger au détour d'un lot.

## 2026-09-18 — Le classement gagne son axe Expert

L'Expert était exclu du classement **partout**, et de façon cohérente :
`api/cron/leaderboard.php` et `api/leaderboard/index.php` filtraient
`gs.is_expert = 0`, `api/lib/leaderboard_metrics.php` faisait de même pour la série,
et la période `ever` lisait `user_stats` — table que le Mode Expert n'alimente pas,
donc l'exclusion y était vraie **par construction**, sans filtre explicite. Les
commentaires en place l'assumaient (« classement Expert = dimension à part, pas
encore exposée ») et un crochet dormait déjà dans le code :
`personadle_leaderboard_prior()` acceptait un `$expertOnly` qu'aucun appelant ne
passait à `true`. Ce lot l'expose.

### Migration 045 — une colonne, pas un mode de plus

`leaderboard_cache` gagne `is_expert`, et `uq_leaderboard` devient
`(user_id, mode, period, metric, period_start, is_expert)`. **Sans cette clé
élargie, le cron écraserait la ligne normale d'un joueur avec sa ligne Expert à
chaque passage** : un seul des deux classements survivrait, et lequel dépendrait
de l'ordre d'exécution. L'index de lecture est refait pour la même raison —
l'endpoint filtre désormais sur `is_expert`, et un index qui l'ignore force un tri
sur des lignes dont la moitié sera jetée.

Même raisonnement que `game_sessions.is_expert` (031) et
`messages.challenge_is_expert` (037) : l'Expert est une **dimension** du mode. Un
`mode = 'classic_expert'` aurait dupliqué les 7 valeurs de mode, cassé le filtre par
mode du front, et rendu le total `all` ambigu.

Migration rejouée sur base **vierge** (pré-migration), puis une seconde fois pour
vérifier l'idempotence — elle annonce alors « uq_leaderboard porte déjà is_expert »
sans rien toucher.

### Le cas `ever`, qui a demandé son propre chemin

`buildEverLeaderboard()` lit `user_stats`, que l'Expert n'alimente pas : lui ajouter
un filtre n'aurait produit que des zéros. D'où `buildEverExpertLeaderboard()`, qui
agrège `game_sessions`. C'est la **seule** raison pour laquelle ce cas est dupliqué
plutôt que paramétré comme les autres.

### `metric=streak` n'existe pas en Expert, volontairement

`personadle_ever_expert_score_expr('streak')` renvoie `null`. Une série se compte en
jours consécutifs, et l'Expert n'est pas un rendez-vous quotidien : c'est un mode
qu'on ouvre quand on a débloqué la porte. Afficher une « série Expert » inviterait à
jouer l'Expert tous les jours pour ne pas la perdre — ce n'est pas ce que ce mode
raconte.

L'endpoint renvoie donc un classement **vide** plutôt qu'un 400 (un code d'erreur
ressemblerait à une panne pour une absence assumée), le cron ne calcule ni n'écrit
cette combinaison (une ligne vide en cache serait indiscernable d'un cache pas
encore alimenté, et l'API basculerait sur le fallback live à chaque appel), et le
front **explique** l'absence sous les filtres plutôt que de laisser une page blanche
— même réflexe que le texte qui explique pourquoi la liste d'amis est plus courte en
défi Expert.

La série de **période**, elle, existe dans les deux dimensions : son filtre est
simplement paramétré.

### Détails techniques

- `sql/migrations/045_leaderboard_expert_dimension.sql`
- `api/lib/leaderboard_metrics.php` — `personadle_period_streak_scores_sql()` et
  `personadle_period_streak_sql()` prennent `$expertOnly` ; nouvelle
  `personadle_ever_expert_score_expr()`
- `api/leaderboard/index.php` — paramètre `expert`, `buildEverExpertLeaderboard()`,
  dimension dans la clé de lecture du cache et dans le fallback live, et `expert`
  renvoyé dans la réponse **tel qu'il a été compris** (le front vérifie qu'il affiche
  bien ce qu'il croit, au lieu d'un classement normal servi en silence)
- `api/cron/leaderboard.php` — boucle sur les deux dimensions, `is_expert` dans le
  filtre de purge (sans lui, le passage sur une dimension effacerait les lignes
  périmées de l'autre) et dans l'upsert
- `js/api.js` — paramètre `expert`
- `profile/leaderboard/leaderboard.{html,js,css}` — groupe de pills « Dimension »,
  placé **avant** Mode puisqu'il le qualifie ; pastille dans le résumé des filtres ;
  ambiance violet/magenta sur la carte, volontairement plus discrète que la
  notification de défi (le tableau doit rester le sujet), dark mode compris
- i18n : 4 clés × 6 langues, EN d'abord — 1270 clés, `i18n:check` vert
- 8 tests dans `tests/php/LeaderboardMetricsTest.php`

### Sécurité de l'interpolation SQL

`is_expert` est interpolé en **littéral 0/1** dans plusieurs fragments SQL, pas lié
en paramètre — les fragments sont assemblés avant préparation. La valeur est donc
normalisée en `bool` dès la lecture de `$_GET` (`($_GET['expert'] ?? '0') === '1'`)
et ne circule plus que sous cette forme : un `bool` ne peut rien injecter, une chaîne
venue de `$_GET`, si. Même contrat que `$modeFilter`, qui passe par `$pdo->quote()`.

### Angles morts connus

- **Le cron doit tourner une fois après la migration** pour peupler la dimension
  Expert du cache. D'ici là, `day/week/month` + Expert tombe sur le fallback live
  (`game_sessions`) — correct mais plus coûteux. Rien à faire, ça se résorbe tout seul.
- Pas de test E2E sur le filtre : la séparation des deux classements est vérifiée au
  niveau des requêtes SQL, pas du parcours navigateur.
- Le classement Expert « depuis toujours » scanne `game_sessions` à chaque appel,
  sans cache (comme le `ever` normal scanne `user_stats`). `game_sessions` étant bien
  plus grosse, ça deviendra le premier point à surveiller si la page ralentit.

### Revue avant merge (2026-09-18)

Deux défauts trouvés en rejouant la PR sur la stack Docker, corrigés sur la branche :

- **`sql/bdd_mysql.sql` n'avait pas suivi la 045.** Ce fichier est la source de vérité
  chargée par Docker et la CI (aucun runner de migrations sur une base neuve) : sans
  `is_expert`, tout appel `period=day|week|month` plantait en **Fatal PDOException —
  le classement normal compris**, pas seulement l'Expert. Invisible en CI parce
  qu'aucun E2E n'appelait ces périodes. Colonne, clé unique et index ajoutés au schéma
  (miroir exact de la 045, vérifié par import à blanc dans une base neuve puis rejeu
  de la 045 = no-op) ; `DatabaseIntegrationTest::testLeaderboardCacheHasExpertDimension`
  garde le contrat ; `tests-e2e/api.spec.js` appelle désormais day/week/month dans les
  deux dimensions.
- **La série Expert n'était vide que « depuis toujours ».** Pour day/week/month, le cron
  n'écrit jamais la combinaison série × Expert, donc l'appel tombait TOUJOURS sur le
  repli live — qui calculait bel et bien une série Expert (271 entrées sur `week`,
  299 sur `month` en local), pendant que le front affichait « pas de classement série
  en Expert » au-dessus d'une liste pleine. Garde ajoutée en tête de
  `buildPeriodLeaderboard()` : vide pour toutes les périodes, testé en E2E.

Vérifié aussi : **la faille `CONVERT_TZ` était active en prod** (MariaDB 11.8,
`CONVERT_TZ(…,'Europe/Paris')` renvoie `NULL`) — 283 groupes (lien, joueur, action,
jour) répétés dans `social_link_interactions`, jusqu'à 28 `visit_profile` le même jour
sur un lien ; 15 liens à rang ≥ 5, 2 à rang 10. Audit de l'existant à la discrétion du
mainteneur. Rendu clair/sombre capturé (pop-up Expert, Boîte, filtre Dimension, note
série) ; E2E complet joué en local (4 flakes « maintenance » rejoués verts isolément).

## 2026-09-18 — Les badges à code événement n'étaient pas protégés par leur code

**13 badges** du catalogue ont une ligne dans `event_codes` : les saisonniers
(`christmas_2025`, `valentine_2026`, `new_years_2026`, `chinese_new_year_2026`,
`easter_2026`, `sport`) et les secrets communautaires (`true_hacker`, `tae_takemi`,
`arati`, `gyotre`, `dzulian`, `chef`, `lobster`). Leur condition réelle, c'est
« connaître le code », et seul `POST /api/badges/redeem` sait la vérifier — il valide
le code, sa fenêtre de validité, et consomme la redemption dans une transaction.

Mais en base ils portent `condition_type = 'manual'`, ce qui vaut « accordé sans
vérification » côté `personadle_verify_condition()`. Donc **`POST /api/badges/unlock`
avec le slug les accordait aussi, sans le code**. Et le slug n'est pas un secret :
`GET /api/badges` renvoie le catalogue complet à tout utilisateur authentifié, slug
compris. Le code protégeait une porte, à côté d'une fenêtre ouverte.

Vérifié avant/après sur les quatre slugs les plus parlants :

| Badge | Avant | Après |
|---|---|---|
| `christmas_2025` | accordé sans le code | 403 — code requis |
| `valentine_2026` | accordé sans le code | 403 — code requis |
| `dzulian` | accordé sans le code | 403 — code requis |
| `lobster` | accordé sans le code | 403 — code requis |
| `first_win` (sans code) | selon la condition | inchangé |
| `data_mining` (sans code) | accordé (`manual`) | inchangé |

### Où vit le garde, et pourquoi pas dans `condition_check.php`

Dans `api/badges/index.php`, juste après la recherche du badge et **avant** la
vérification de condition. Ce n'est pas une question de CONDITION mais de ROUTE :
`condition_check.php` répond « cet utilisateur remplit-il la condition ? », or ici la
réponse dépend d'un secret que l'utilisateur fournit, pas d'un état en base. L'y
mettre obligerait cette lib à connaître `event_codes`, une table qui ne la regarde pas.

L'ordre compte et il est testé : le garde passe avant la vérification de condition.
S'il passait après, il ne servirait à rien — la condition `manual` aurait déjà répondu
oui et l'endpoint aurait inséré la ligne.

Le garde interroge `event_codes`, **sans aucun slug codé en dur** : un badge saisonnier
créé demain par l'admin est protégé dès la création de son code, sans toucher au PHP.
Un test verrouille ce lien.

### Aucun effet sur un joueur légitime, et c'est vérifié

`handleEventCodeSubmit()` (`profile/badges/badgesManager.js`) est **serveur-d'abord** :
`await api.badges.redeem(code)` d'abord, et le badge n'entre dans le profil local
qu'une fois la réponse OK. Le backend le connaît donc toujours avant le local, et
`syncBadgesWithBackend()` n'a jamais à le repousser par `/unlock` (il ne pousse que les
badges locaux **absents** du backend). Le chemin `/redeem` est inchangé.

### Détails techniques

- `api/badges/index.php` — garde `event_codes` dans la branche `unlock`
- `tests/php/EventCodeBadgeGateTest.php` (nouveau, 6 tests) en deux moitiés :
  la route est fermée (tous les badges à code refusés, garde avant la condition,
  aucun slug en dur) **et** les joueurs légitimes ne sont pas cassés (les badges sans
  code inchangés, `/redeem` accorde et consomme toujours, aucun code n'est orphelin).
  Le test de position échoue sur le code d'avant.

### Ce qui reste `manual` et le restera

Après ce lot, 34 badges restent `manual` sans protection : flags narratifs
(découvertes de personnages en cours de partie), horaires (`night_owl`, `nyx_hour`),
et quelques sociaux. Décision produit prise le 2026-09-18 : on ne les verrouille pas.
`data_mining` (5 profils visités) et `leblanc_meeting` (3 amis connectés le même jour)
seraient pourtant vérifiables côté serveur sans migration — `social_link_interactions`
journalise déjà les `visit_profile` par lien, et `game_sessions` + `friendships`
suffisent pour le second. À reprendre si l'envie vient ; ce n'est pas une dette
urgente pour un fan-game sans enjeu compétitif.

## 2026-09-18 — Trois points de synchronisation oubliés par les lots précédents

Revue de fin de branche : les cinq lots ci-dessus étaient corrects en eux-mêmes, mais
trois conventions du dépôt n'avaient pas été honorées. Aucune n'est un bug de code, les
trois auraient coûté cher au déploiement.

### 1. `CACHE_VERSION` non bumpé — le plus grave des trois

`sw.js` restait en `personadle-v95`. Or ce lot modifie `js/api.js`,
`profile/leaderboard/leaderboard.{html,css,js}` et `profile/friends/friends.{css,js}` —
**tous précachés** par le service worker.

Sans bump, `activate` ne purge rien et le cache-first continue de servir l'ancien front
aux joueurs **déjà venus** : ni le filtre « Dimension » du classement, ni la pastille
Expert de la Boîte, alors que l'API, elle, aurait changé. Invisible en test (un
navigateur neuf reçoit toujours le bon code), visible uniquement pour les habitués —
c'est-à-dire exactement les joueurs qu'on ne veut pas casser. Bumpé en `v96`.

`css/challenge-notif.css` n'est pas dans la liste de précache : il est récupéré au
réseau, rien à faire de ce côté.

### 2. Migration 045 absente de la checklist bloquante de `TODO.md`

C'est **le piège que le dépôt documente lui-même** : les migrations 029/030 avaient été
oubliées de cette liste jusqu'au 2026-09-01, et CLAUDE.md §13 en a fait une règle.
Écrire la migration ne suffit pas — elle doit figurer dans la liste que suit la release.

Conséquence si elle manquait : `api/leaderboard/index.php` interroge `lc.is_expert`, et
la prod n'a pas la colonne. Vérifié pour de vrai contre une base au schéma
pré-migration plutôt qu'affirmé :

```
requête cache → SQLSTATE[42S22] Unknown column 'lc.is_expert'  → 500
période ever  → OK (ne lit pas le cache) → survit
```

Donc **le classement day/week/month tombe en 500 pour tout le monde**, et le cron
horaire échoue à chaque passage. `ever` survit seul. L'entrée de checklist dit
explicitement « avant le `git pull` Hostinger », comme les 040/041/042.

Une seconde entrée a été ajoutée pour le cycle de cron à laisser passer après la
migration — sans elle, le classement Expert par période bascule sur le calcul live
pendant une heure. C'est correct, juste plus coûteux, et ça se résorbe seul : noté pour
que ça ne soit pas pris pour une panne.

### 3. Changelog joueur non alimenté

CLAUDE.md §9 : tout changement **visible ou parlant pour un joueur** va aussi dans
`PersonaDLE_Update.html`. Les cinq lots n'avaient nourri que `DEV_CHANGELOG.md`.

Deux sections ajoutées, en blocs `data-i18n-block` FR/EN appariés (103/103, vérifié),
en langage non technique :

- **⚡ Le Mode Expert sort de l'ombre** — la notification de défi Expert, la pastille
  dans la Boîte, le nouvel axe du classement, et pourquoi « meilleure série » n'y a pas
  d'équivalent (un joueur qui ne trouve pas sa métrique doit lire la raison, pas
  conclure à un oubli).
- **🎖️ Ce qui se gagne, se gagne vraiment** — Data Mining qui tombe enfin au bon
  moment, les badges à code redevenus des badges à code (avec la précision « rien ne
  change si tu as utilisé le tien »), et les Social Links qui comptent juste.

Le reste du travail — fail-closed, vocabulaire des conditions, trous de tests — n'y
figure pas : rien de tout ça ne se voit depuis le jeu, et la section §9 interdit
explicitement de gonfler la page joueur avec du détail technique.

### Ce qui reste non vérifiable depuis cet environnement

Les tests **E2E Playwright** (`npm run test:e2e`, job CI bloquant) n'ont pas pu tourner
ici : ils exigent `make up`, donc un démon Docker, absent de cet environnement. Les
spécifications concernées par ce lot (`challenge_flow`, `challenge_usecases`,
`unlocks_usecases`, `visual_layout`) seront donc jouées pour la première fois **en CI**.
Les 1383 tests Vitest et 351 PHPUnit, eux, sont verts — ces derniers contre une MariaDB
sans tables de fuseaux, soit la configuration de la prod et non celle de la CI.

## 2026-09-17 — content(profil) : 29 portraits Persona Q/Q2 + fond Persona 4 Revival, et deux avatars enfin persistables (branche `content/avatars-pq-fond-p4r`)

### Pourquoi

Lot d'images fourni par Hamza (Downloads du 2026-09-17) : les héros de P3/P4/P5 façon
Persona Q et Q2, Naoto version P4 Revival, Morgana dancing, JoJo Frost, et un fond
d'écran Persona 4 Revival pour la carte de partage — **de base, pas débloquable**
(décision Hamza).

### Quoi

- `img/avatar/` : 29 fichiers, renommés en snake_case ASCII (« P3 Ken Amada PQ2.jpg » →
  `ken_amada_pq2.jpg`, « Naoto Shirogane icon (Persona 4 Revival).jpg » → `naoto_p4r.jpg`,
  « JoJo Frost.jpg » → `jojo_frost.jpg`, `Yosuke_pq.jpg` → `yosuke_pq.jpg`…). Deux raisons :
  la règle CLAUDE.md §4, et la liste blanche du serveur (`personadle_validate_avatar`,
  `[A-Za-z0-9_-]+\.(gif|png|jpe?g|webp)`) — un espace ou une parenthèse rend le portrait
  impossible à enregistrer sur le compte.
- `profile/avatars_data.js` : les 26 portraits Q/Q2 dans un **nouveau groupe « Persona Q »**
  (`key: "personaq"`, ordonné P3 → P4 → P5, placé entre P5X et Spécial ; libellé dans
  `profile-page.js`, en-tête orange Golden Labyrinth dans `profile-page.css`) — retour
  Hamza du 2026-09-18 : on cherche le style, pas le personnage. Naoto P4R en P4, Morgana
  dancing en P5, JoJo Frost en SPECIAL. 175 → 204 entrées.
- Deux portraits mal rangés depuis la 2.0, reclassés au passage (retour Hamza) :
  `hui_marie_p4r_pfp.jpg` de P5X vers **P4** (Marie est un personnage de Persona 4),
  `JOKER.webp` de P5 vers **P2** (c'est le Joker d'Innocent Sin).
- `profile/Wallpaper/wallpaper_p4r.jpg` (1440×2160, 738 Ko) + entrée `p4_revival` dans
  `shareWallpapers.persona4` (`profile/share-card.js`, désormais exporté pour les tests) —
  et non dans `UNLOCKABLE_WALLPAPERS`.

### Deux avatars cassés depuis la 2.0, sortis par le test d'intégrité

En vérifiant que chaque nom listé passe la liste blanche du serveur : `Kanji.avif`
(extension hors liste) et `Caroline&justine.png` (le « & »). Choisis dans la galerie, le
PATCH était refusé en silence (`_syncLocalProfileToCloud` avale l'erreur) : le portrait
restait local, disparaissait au prochain pull cloud, n'apparaissait jamais sur un autre
appareil.
- `api/lib/validation.php` : `avif` accepté dans la galerie (le fichier existe depuis la 2.0,
  les navigateurs le rendent).
- `Caroline&justine.png` → `caroline_justine.png` (`git mv`) ; `normalizeAvatarPath()`
  (`profile/profile-format.js`) remappe l'ancien nom — seul un profil LOCAL peut encore le
  porter, le serveur ne l'a jamais accepté.
- Pas de bump `CACHE_VERSION` : JS/CSS sont en network-first, les nouvelles images ne sont
  pas encore en cache.

### Tests

- `tests/avatars_gallery.test.js` (11) — chaque portrait listé existe, aucun orphelin dans
  `img/avatar/`, aucun doublon, chaque nom passe la liste blanche serveur (miroir exact de la
  regex), groupes connus du picker, les 29 du lot dans le bon groupe ; `normalizeAvatarPath`
  remappe l'ancien nom ; chaque fond de la carte de partage et chaque déblocable existe sur
  le disque, identifiants uniques, P4R d'office et pas déblocable.
- `tests/php/ValidationTest.php` (+2) — `.avif` accepté ; un nom avec « & » refusé même si
  le fichier existe.

### Angles morts

- Les anciens noms non-snake_case de `img/avatar/` et `profile/Wallpaper/` (majuscules,
  « & » dans `Aigis_&_makoto.jpg`…) restent tels quels : les fonds ne passent pas par la
  liste blanche serveur, et renommer des avatars déjà persistés sur des comptes casserait
  leurs profils. Seul `Caroline&justine.png` était à la fois cassé ET jamais persistable.
## 2026-09-17 — fix(streak, connexion, filtres, journée de jeu) : campagne de cas d'usage, sept bugs sortis (branche `test/usecases-streak-filtres-defis-auth`)

### Pourquoi

Après la revue des PR #124/#125, campagne de tests « par cas d'usage » sur la streak,
la connexion, les filtres et les défis — écrits du point de vue du joueur (« j'ai joué
hier, je rejoue aujourd'hui », « je me connecte sur un nouveau téléphone », « j'accepte
un défi sur un appareil où je n'ai jamais ouvert ce mode »), pas fonction par fonction.
Sept bugs, tous reproduits par un test qui échouait avant le correctif. Un fil rouge :
**la journée de jeu est celle de Paris, et rien ne doit la recalculer via l'heure de la
machine ou via `now − 24 h`.**

### Quoi — sept correctifs

1. **Streak client, lendemain du passage à l'heure d'été** (`profile/profileStats.js`)
   — « hier » valait `parisDateKey(Date.now() − 86 400 000)`. La journée du dimanche ne
   fait que 23 h : entre 00:00 et 00:59 Paris le lundi, on retombait DEUX jours en
   arrière. Série d'un joueur assidu cassée (et fausse trace Jack Frost), série d'un
   joueur qui avait sauté le dimanche prolongée. Nouveau `shiftDateKey(key, days)` dans
   `gameCore.js` (arithmétique pure sur la clé, `Date.UTC`). Au passage, un `lastPlayed`
   illisible faisait lever Intl (`RangeError`) et la partie n'était plus comptée du tout.

2. **Reset de minuit, appareils hors Europe** (`gameCore.js::msUntilNextParisMidnight`)
   — l'ancien calcul re-parsait `toLocaleString()` dans le fuseau de la MACHINE puis
   `setHours(24)`. Juste en Europe seulement : pour un appareil aux États-Unis, au Japon,
   en Australie, au Brésil ou en UTC, 60 min d'écart mesurées les deux jours de
   changement d'heure de Paris (reset trop tard au printemps → puzzle de la veille
   jouable jusqu'à 01 h, victoire datée du jour → mismatch anti-triche ; trop tôt à
   l'automne → partie en cours effacée à 23 h, partie gagnée réarmée et comptée deux
   fois). Nouveau `parisMidnightUtc(key)` : essaie UTC+1 et UTC+2, garde celui qu'Intl
   lit comme « 00 h ce jour-là » à Paris. Le test « ≤ 24 h » passe à 25 h (journée du
   passage à l'heure d'hiver). Vérifié sous Europe/Paris, UTC, America/New_York,
   Asia/Tokyo.

3. **Appareil partagé** (`js/auth.js`, `js/api.js`, `gameCore.js`) — A se déconnecte, B
   se connecte : la trace Jack Frost de A (`streakRecovery`) proposait à B de restaurer
   la série perdue de A (acceptée par le serveur si B a assez de jours joués) ; les cases
   `activeChallenge`/`activeChallengeExpert` de A faisaient jouer à B la cible du défi de
   A, partie comptée ni comme défi (403) ni comme partie du jour ; la file
   `pendingSessions` rejouée avec le cookie de B créditait à B les parties de A, et
   `pendingChallengeStatus` partait en 403 puis était jeté. Désormais :
   `clearAccountLocalState()` à la déconnexion (trace + cases, filtres de l'expéditeur
   rendus, état du mode purgé) ; les files ne sont PAS vidées mais chaque entrée porte
   `_owner` (compte au moment de la mise en file, `null` pour un invité) et
   `syncPending()` / `flushPendingChallengeStatus()` / la migration à l'inscription ne
   rejouent que les siennes et celles d'un invité (`ownsQueuedEntry`). `_owner` ne part
   jamais au serveur. `api.js` ne peut pas importer `gameCore.js` (cycle) : filtre passé
   par `window._personadleOwnsQueuedEntry`, même pont que `_personadleApi`. Au passage,
   un login en 200 sans `user` fermait la modale sans connecter ni prévenir → échec.

4. **Défi + première ouverture du mode sur l'appareil** (`js/filterMenu.js`,
   `gameCore.js::isFilterKeyHeldByChallenge`) — sans `<clé>_seeded`, `initFilterMenu`
   seedait PTS dans la liste installée par le défi et la persistait ;
   `releaseActiveChallenge` concluait « le joueur a rechoisi » et ne rendait rien : le
   joueur gardait « filtres de l'expéditeur + PTS » pour toujours. Le panneau joue
   désormais telle quelle une liste qu'un défi actif a installée, sans seed ni
   réécriture ; le seed a lieu sur les filtres du joueur, après le défi.

5. **Nouvel appareil / reconnexion : série remise à 1 + faux Jack Frost**
   (`api/user/index.php`, `js/cloud-sync.js`) — `GET /api/user/:id` ne renvoyait pas
   `global_streak_date` et le pull n'écrivait pas `stats.lastPlayed`. Après une
   connexion sur un nouveau téléphone (ou après logout/login, qui vide le profil), la
   première partie voyait « jamais joué » : série 15 → 1, trace « tu as perdu 15
   jours ». Le pull suivant remettait 16 mais la trace restait : Jack Frost s'ouvrait
   (vérifié : l'overlay était bien dans le DOM) et le clic consommait le crédit de
   60 jours pour rien. Le serveur expose `global_streak_date` ; le pull en dérive
   `lastPlayed` (midi Paris de ce jour). `null` → valeur locale retirée ; champ absent →
   rien touché.

6. **Flamme « joué ensemble aujourd'hui »** (`js/social-link.js`) — date UTC côté
   client, journée Paris côté serveur (`CONVERT_TZ … Europe/Paris`). Entre minuit et 2 h
   à Paris, l'interaction du soir tombait « hier » en UTC : pas de flamme alors que la
   refaire était déjà refusé. `parisDateKey` des deux côtés.

7. **Journée d'une partie finie après minuit** (`gameCore.js::currentGameDay`) — onglet
   ouvert la nuit, téléphone en veille, reset de minuit retardé : le puzzle d'hier fini
   à 00 h 05 partait daté d'aujourd'hui avec la cible d'hier (mismatch anti-triche,
   journée d'hier jamais créditée, puis seconde partie « du jour »). `startGame()` note
   la journée d'armement (`gameDay_<scope>`), `buildGameSession()` date la session de
   cette journée. Le serveur accepte aujourd'hui ou hier et calcule déjà les streaks
   depuis `played_date` (chemin de la file hors ligne) : rien à changer côté API. Repli
   sur aujourd'hui au-delà d'hier.

### Tests

- `tests/streak_usecases.test.js` (28) — les deux passages d'heure 2026 minute par
  minute, minuit Paris vu depuis UTC été/hiver, 31/12, 29 février, six modes le même
  jour, abandon, trace de récupération (écrite, non écrasée, remplacée une fois
  consommée, JSON corrompu, `lastPlayed` corrompu).
- `tests/auth_usecases.test.js` (34) — `initAuth` (200/401/403, panne ×3 avec backoff
  300/900 ms mesuré, 503 du service worker puis 200, 429 ×3, 500-500-401, markup qui
  lève, 200 vide) ; login (payload, trim, remember_me, 401, banni, réseau, 200 sans
  user, double-clic, erreur effacée) ; déconnexion (nettoyage, API en panne, ce qui
  survit, appareil partagé × 5) ; session expirée en cours de partie.
- `tests/filters_usecases.test.js` (33) — sur le vrai panneau : chargement (absent,
  `[]`, ancien format P2/P3, nouveau format, codes d'un autre mode, JSON corrompu,
  non-tableau, isolation entre modes), clics (opus, groupe, tout, compteur, dernier
  opus → `[]`, quota localStorage, fond/✕/Escape), défi × 8,
  `characterMatchesActiveOpus`.
- `tests/streak_sync_usecases.test.js` (10) — pull + première partie : hier,
  aujourd'hui, avant-hier, record, Jack Frost ne s'ouvre pas, journée locale périmée,
  après récupération serveur, backend sans le champ, `null`, illisible.
- `tests/game_day_usecases.test.js` (11) — même jour, Replay, nuit sans reset, reset
  qui arrive, rechargement après minuit, nuit du passage à l'heure d'été, deux jours,
  ancienne version, portées normal/Expert, toujours aujourd'hui ou hier.
- `tests/gameCore.test.js` (+27) — `shiftDateKey`, `msUntilNextParisMidnight` à vérité
  absolue sur douze instants, `parisMidnightUtc`.
- `tests/social-link.test.js` (+3), `tests/notifications.test.js` (+10, revue #124).
- `tests/php/StreakTest.php` (+7) — mêmes passages d'heure côté serveur ;
  `DateTime::diff` est correct sur PHP 8.3, figé au cas où l'hébergeur change de version.
- `tests-e2e/api.spec.js` — `global_streak_date` renvoyé, à la date du jour.

### Décisions / angles morts

- **Cible du jour hors filtres (Classic/Emoji/Silhouette/Music)** — la cible
  quotidienne est tirée du catalogue COMPLET (décision 2.2, miroir de
  `api/lib/daily_target.php`), alors que le texte d'aide des filtres dit « seuls les
  jeux gardés peuvent tomber ». Un joueur aux filtres restreints peut donc avoir une
  cible du jour que l'autocomplétion ne propose pas (elle reste acceptée si tapée à la
  main — les six modes valident sur le roster complet). AOA et Personae re-tirent dans
  le pool filtré, avec l'angle mort anti-triche documenté dans `daily_target.php`.
  Non tranché ici : soit aligner le texte d'aide, soit étendre le re-tirage filtré aux
  quatre modes (élargit le contournement anti-triche) — à décider avant la release.
- Les six modes ne passent pas encore explicitement `played_date` : `currentGameDay()`
  lit la portée posée par `checkResetOnLoad`, ce qui couvre les six. Une page qui
  appellerait `buildGameSession()` sans `checkResetOnLoad` retomberait sur aujourd'hui.
- `_owner` laisse en file les parties d'un compte qui ne revient jamais sur l'appareil :
  quelques entrées de localStorage, pas de plafond posé.
- Le badge « night owl » (`getHours()` local) et les badges d'événement
  (`getMonth()/getDate()` locaux) restent sur l'heure du joueur — volontaire, c'est sa
  nuit et sa date à lui.
## 2026-09-17 — fix(cible du jour) : les six modes respectent les filtres d'opus du joueur (branche `feat/cible-du-jour-filtree`)

### Pourquoi

Classic, Émoji, Silhouette et Music tiraient la cible du jour dans le catalogue COMPLET quels
que soient les filtres. Un joueur « P5 uniquement » pouvait donc recevoir un personnage P3 que
l'autocomplétion ne proposait jamais : la partie du jour lui était injouable — tous les jours —
alors que l'aide des filtres promet « seuls les jeux gardés peuvent tomber ». AOA et Personae
re-tiraient déjà dans le pool filtré depuis la 2.1, chacun à la main. Le test E2E « la cible
du jour est tirée du catalogue COMPLET » figeait ce que le serveur recalculait, pas un choix
produit. Décision Hamza du 2026-09-17 : aligner les quatre modes sur les deux autres.

### Quoi

- `js/gameCore.js::getDailyTargetWithin(pool, filteredPool, mode, keyOf?)` — tirage seedé sur
  le catalogue complet (stable par joueur/jour) ; si la cible n'est pas dans le pool filtré,
  re-tirage avec la même graine DANS le pool filtré. Pool filtré vide → cible complète (le mode
  affiche déjà « aucun résultat »). Une seule source pour les six modes : Classic
  (`dailyCharacter()`), Émoji (`dailyEmojiCharacter()`, parmi les personnages à émojis comme
  le serveur), Silhouette, Music (`filteredSongs`), et AOA/Personae refactorés dessus.
- **Homonymes Personae** (bug préexistant sorti par les nouveaux tests) : Hermes, Susano-o et
  Prometheus sont portés par deux personnages d'opus différents. La comparaison par NOM
  (`c.persona === daily.persona`, client ET serveur) faisait passer le Prometheus de Futaba
  (P5R) pour « présent » chez un joueur « P2 uniquement » parce que celui de Baofu (P2EP)
  l'était : pas de re-tirage, partie injouable. Client : identité d'entrée (`keyOf` par défaut,
  `filteredCharacters` est un `filter()` des mêmes références) ; serveur : index dans le pool.
- `api/lib/daily_target.php::personadle_pick_within_filters()` — miroir exact pour les pools
  de noms, utilisé par classic/emoji/silhouette/music, leurs variantes Expert (table d'opus du
  mode normal, mêmes noms) et AOA. En-tête : la LIMITATION CONNUE (filtres soumis par le
  client, non corrélés) vaut désormais pour les six modes, avec la piste de résolution
  (filtres synchronisés sur le compte, recalcul depuis les filtres stockés) — idem ROADMAP.
- `scripts/export-daily-pools.js` — `opusByName` exporté pour classic, emoji, silhouette,
  music (+ ~70 Ko de JSON, régénéré par `pools:build`).
- Changer un filtre en cours de journée relance toujours une partie ALÉATOIRE (décision 2.2
  inchangée) : le re-tirage filtré ne concerne que le tirage de la cible du jour.

### Tests

- **Parité JS ↔ PHP** vérifiée au moment du changement : 1296 cas (4 dates × 4 seeds ×
  9 modes × 9 filtres), 775 re-tirages effectifs, 0 écart ; +576 cas Personae/Personae Expert
  après le passage à l'identité d'entrée, 0 écart.
- `tests/daily_target_within.test.js` (25) — contrat du helper (présent → inchangée, exclu →
  re-tirage même graine, déterminisme, pool vide, `keyOf`, clés normal/Expert) ; sur les vrais
  catalogues des huit clés de hash : la cible appartient toujours à un opus actif (140 tirages
  par mode, au moins un re-tirage exercé), sans filtre = cible complète ; homonymes Personae ;
  « P5 uniquement » sept jours d'affilée.
- `tests/php/DailyTargetTest.php` (+7) — table d'opus complète par pool, cible dans les
  filtres pour les dix clés (mode normal + Expert), cible complète conservée si dans les
  filtres, filtre vide → catalogue complet, tirages normal/Expert indépendants, Music Expert
  filtré toujours avec paroles, homonymes Personae.
- `tests-e2e/filters_usecases.spec.js` — « catalogue COMPLET » remplacé par « RESPECTE les
  filtres » (cible P5, proposée par l'autocomplétion, stable au rechargement) + « sans filtre
  touché = catalogue complet ». `daily_target.spec.js` (serveur ↔ client) inchangé et vert.

### Angles morts

- Le contournement anti-triche par filtres soumis vaut maintenant pour les six modes (phase 1
  = journal seul, sans conséquence aujourd'hui). Étape B à faire avant tout rejet strict —
  cf. ROADMAP.
- Un joueur qui décoche TOUT garde la cible du catalogue complet, avec le bandeau « aucun
  résultat » : comportement existant, non touché.

## 2026-09-17 — feat(notifications) : demandes d'ami, défis et rank-up en temps réel via Pusher Channels (branche `feature/realtime-notifications`)

### Pourquoi

`js/notifications.js` sondait `/api/notifications` (+ amis, messages, social-links)
toutes les 60 secondes sur chaque page, connecté ou non. Hostinger mutualisé (Apache
+ PHP, pas de process Node persistant) exclut un WebSocket auto-hébergé — Pusher
Channels est le seul service tiers qui tienne sans changer d'hébergeur.

### Quoi

- `api/lib/pusher_trigger.php` — déclenchement d'événements côté serveur en cURL brut
  signé HMAC-SHA256 (pas de SDK, le projet n'a pas de `composer.json`). No-op silencieux
  si `PUSHER_APP_ID`/`KEY`/`SECRET`/`CLUSTER` sont absents.
- `api/pusher/auth.php` + `api/lib/pusher_auth.php` — authentifie l'abonnement aux
  canaux privés `private-user-{id}` via la session PHP existante (refuse tout canal
  qui n'est pas le sien).
- Triggers câblés dans `api/friends/index.php` (`friend_request`, `friend_declined`),
  `api/messages/index.php` (`challenge`, `challenge_beaten`) et
  `api/lib/social_link_interaction.php` (`rankup`).
- `js/notifications.js` : `_check()` reste l'unique source de vérité (dédup
  localStorage, animations) — un event Pusher ne fait que la rappeler immédiatement au
  lieu d'attendre le tick suivant. Trois régimes dans `_initPusher()` :
  **Pusher non configuré** (pas de clé renvoyée par `/api/auth/me`) → polling 60 s
  inchangé, aucun script CDN chargé ; **configuré et connecté** → push pur ;
  **configuré mais indisponible** (CDN, socket) → fallback polling 5 min.
  `_loadPusherScript()` a un timeout de 8 s pour ne jamais bloquer indéfiniment sur un
  CDN injoignable, et `new Pusher()` est sous `try/catch` → fallback.
  *Revue avant merge* : la première version chargeait pusher-js et instanciait
  `new Pusher(null)` même sans clé — pusher-js lance alors une exception hors du
  `try`, `initNotifications()` rejetait et plus aucun rafraîchissement n'avait lieu
  après le premier `_check()`. C'est précisément l'état de la prod au déploiement
  (`api/config.php` sans `PUSHER_*`), d'où le garde `_isPusherConfigured()`.
- `api/lib/social_link_xp_grant.php` — corrige un bug pré-existant : un rank-up déclenché
  par un défi (`CALL add_social_link_xp` dans `api/messages/index.php`) ne relisait
  jamais les OUT params et ne notifiait donc jamais personne, contrairement au chemin
  `/social-links/by-friend/:id/interact`.
- `api/config.example.php`, `api/config.docker.php`, `.env.example`, `docker-compose.yml` :
  4 constantes `PUSHER_*`, vides par défaut.
- `.htaccess` (racine) : `connect-src` étendu à `https://*.pusher.com wss://*.pusher.com`.

### Tests

- `tests/php/PusherTriggerTest.php`, `PusherAuthTest.php` — logique pure (signature,
  auth de canal), sans réseau.
- `tests/php/PusherLiveTest.php` — appel réel signé contre l'API Pusher, skippé sans
  config. Vérifié manuellement avec un vrai compte : HTTP 200, badge et pop-ups reçus
  sans recharger la page (demande d'ami, refus, défi, défi relevé).
- `tests/php/DatabaseIntegrationTest.php` — le correctif rank-up (insertion réelle
  dans `social_link_rankup_notifs`).
- `tests/notifications.test.js` — abonnement, rappel de `_check()` sur event, bascule
  fallback, `stopNotifications()` ; plus les 3 régimes : sans clé (aucun script CDN,
  polling 60 s, clé `null` ne lance rien), clé sans cluster, constructeur qui lance,
  CDN en erreur, CDN en timeout 8 s, reconnexion qui coupe le fallback, coupure courte
  (< grâce 10 s) qui ne l'arme pas, les 5 noms d'événements bindés.
- `phpstan.neon` — `PUSHER_*` ajoutées à `dynamicConstantNames` (même piège que
  `DISCORD_DAILY_WEBHOOK` : la constante vide de `config.example.php` rendait la garde
  « toujours vraie » et le déclenchement « inatteignable », 18 erreurs, CI rouge).

### Angles morts

- Compte Pusher (plan gratuit) à créer et ses 4 clés à renseigner dans `api/config.php`
  sur Hostinger pour activer le temps réel — sans ça le site reste sur le polling 60 s
  d'avant ce lot, strictement sans régression. Ce n'est donc PAS un prérequis de release.
- Le SDK PHP officiel Pusher n'est pas introduit (pas de `composer.json` dans ce lot) ;
  à revisiter si le besoin de dépendances PHP grossit.

## 2026-09-17 — feat(contenu) : 7 titres + 1 badge, filtres en fenêtre, et les cas d'usage des filtres sous test (branche `feat/profil-vitrine`)

### Contenu (visuels fournis par Hamza)

Sept calling cards et un badge, ré-encodés au gabarit du dépôt (1146 px de large
pour les titres, 1024² pour le badge : les sources faisaient jusqu'à 4 Mo sans
perte) et seedés par la **migration 044** — plus `sql/bdd_mysql.sql` pour qu'une
base fraîche les ait aussi.

| Titre | Rareté | Condition |
|---|---|---|
| S.E.E.S. | epic | posséder 8 titres |
| We Share the Same Soul (Aigis & Metis) | epic | un Social Link au rang 10 |
| I Am Not a Princess (Kotone) | rare | 25 victoires parfaites |
| The Case Is Never Closed (Naoto) | rare | 25 victoires en Silhouette |
| Don't Need Your Pity (Shinjiro) | epic | 25 victoires rapides en Classique |
| Take Your Heart (Phantom Thieves) | legendary | 40 victoires en All-Out Attack |
| Some Things Don't Burn Out (Tatsuya) | legendary | jouer un 24 juin (sortie d'Innocent Sin) |

Le badge « Tartarus Conqueror » du visuel est renommé **Song of Orpheus** (epic,
25 victoires en Mode Expert) : le dessin montre les deux Orphée — celui de Makoto
et celui de Kotone — et Messiah, c'est-à-dire la descente aux Enfers et le retour,
pas la tour, et la lyre est dessinée dessus. Le nom « Katabasis » (le mot grec
pour cette descente) a été écrit puis écarté le même jour : personne ne le
comprend sans lire la description, ce qu'un nom de badge doit éviter. Le slug,
le fichier image et la clé i18n suivent (`song_of_orpheus`) — rien n'était encore
déployé. Descriptions traduites en 5 langues dans la migration (titres) et dans
`lang/*.json` + `badgesData.js` (badge, la table `badges` ne portant pas de
colonne description).

**Deux conditions nouvelles** dans `api/lib/condition_check.php` :
- `titles_count` → nombre de titres possédés (S.E.E.S. rassemble la troupe) ;
- `played_on_date` → avoir joué un jour d'anniversaire, `condition_mode` au
  format `'MM-JJ'` (`condition_value` est un INT, il ne peut pas porter la date).
  Cumulatif comme le reste : la journée reste dans l'historique, le titre ne se
  reperd pas (CLAUDE.md §7).

Au passage, `condition_check.php` charge désormais `validation.php` lui-même : il
dépend de `PERSONADLE_MODES` et ne marchait que si un autre fichier l'avait déjà
inclus — vrai via `bootstrap.php` en prod, faux quand PHPUnit lance ce seul
fichier de tests (erreur latente, visible en lançant `ConditionCheckTest` seul).

### Les filtres d'opus : une vraie fenêtre

Le menu déroulant devient une **modale centrée** (fond assombri, en-tête avec
compteur « 19 / 19 » et croix, deux lignes qui expliquent ce que les filtres
changent). Une carte par jeu : le logo à gauche, et **ses opus se déroulent vers
la droite au clic dessus**, chacun arrivant à son tour (retour Hamza — les
montrer tous d'office remplissait la fenêtre sans qu'on ait rien demandé). Un jeu
retenu porte une pastille ✓, un jeu écarté un contour en pointillés.

L'animation passe par `max-width` et non `width` : un volet en ligne dont la
largeur est `auto` ne s'interpole pas, il saute. `max-height: 0` l'accompagne,
sinon la carte gardait la hauteur du volet replié. `prefers-reduced-motion` coupe
transition et arrivées échelonnées.

Conséquence côté tests : le bouton « ✓ Tout / ✗ Aucun » d'un jeu est injecté
**dans** son volet, donc inatteignable tant qu'on n'a pas déroulé.
`filters_usecases.spec.js` passe par un helper `expandGame()` qui fait ce clic
d'abord, comme le joueur — c'est ce qui a fait tomber quatre scénarios en CI
alors qu'ils passaient avant le déroulé.

Le fond est à `z-index: 999` et non 10 000 : `.filter-panel` (`z-index: 1000`,
`position: absolute`) crée un contexte d'empilement, donc la fenêtre est peinte
dedans — un fond posé sur le `body` plus haut voilait la fenêtre elle-même.

### Un bug trouvé par les nouveaux tests : les filtres d'un défi restaient

`tests-e2e/filters_usecases.spec.js` (12 scénarios) couvre la fenêtre, l'effet sur
l'autocomplétion, la persistance, l'indépendance par mode, la cible du jour (tirée
du catalogue COMPLET quels que soient les filtres — c'est ce que le serveur
recalcule), les défis et ce que reçoit le serveur.

Le scénario « un receveur qui n'avait jamais touché ses filtres » a sorti un vrai
bug : `installActiveChallenge()` écrit les filtres de l'expéditeur, et
`releaseActiveChallenge()` ne les retirait pas quand le receveur n'avait **aucune**
clé enregistrée (il s'abstenait d'écrire, au lieu de supprimer). Accepter un défi
« P5 uniquement » restreignait donc son mode Classique **pour toujours**, sans
qu'il ait rien choisi. Corrigé : clé absente à l'acceptation → clé supprimée à la
libération.

### Angle mort connu

Changer un filtre relance une partie (décision 2.2) : cette partie-là n'a donc
pas la cible seedée du jour et l'anti-triche la compte comme un écart. C'est
volontaire côté jeu, mais ça pèse dans le journal — à trancher quand la phase 2
(rejet) sera envisagée.

---

## 2026-09-16 — fix(ui) : douze corrections de finition (index, profil, pages de mode) — branche `feat/profil-vitrine`

Une passe de relecture de Hamza sur le site en local, douze points. Rien de
structurant, mais c'est ce qu'on voit tous les jours.

**Accueil**
1. « Nouveautés » (bas-gauche) et « Reset quotidien » (bas-droite) flottent au-dessus
   du footer et n'avaient ni la même couleur ni de contour : en sombre ils se
   fondaient dedans. Les deux partagent maintenant le même habillage (fond franc,
   bordure, ombre) — leurs règles vivent dans deux fichiers différents
   (`css/index.css` et le `<style>` de `index.html`), un commentaire croisé le dit.
2. Les trois liens sociaux collaient au footer : 26 px d'air sous `#socialLinks`.

**Profil**
3. Dans la modale de partage, les pastilles de couleur sortaient en 52 × 34 (donc
   ovales) : `global.css §18` impose `padding: 12px 20px` à tout `<button>` et la
   règle ne remettait que `min-height: 0`. L'interrupteur « afficher le titre »,
   lui, est un `<label>` — `.share-selector-row label { min-width: 72px }`
   l'élargissait à 72 px et le bouton rond s'arrêtait au milieu de sa piste.
4. Choisir un portrait ouvre maintenant le recadrage dans la foulée : beaucoup sont
   mal cadrés d'origine. Le portrait est appliqué avant d'ouvrir — fermer sans
   toucher à rien le garde tel quel. Un GIF, lui, ne peut pas être recadré (le
   canvas lui ferait perdre son animation).
5. La modale de partage se ferme en cliquant à côté, comme les autres.
6. **Réinitialiser et supprimer son compte** étaient deux boutons rouges en bas de la
   page profil, dont un derrière un simple `confirm()` natif. Ils déménagent dans
   ⚙ Paramètres, section « Zone de danger », et le reset a enfin sa propre
   confirmation : ce qu'on perd, ce qu'on garde (le compte), et quoi faire sans
   compte (exporter d'abord) — le tout traduit. La section n'apparaît que là où la
   page sait ouvrir ces confirmations (`window._personadleDanger`).
7. « Couleur perso » demandait deux clics (la pastille, puis le carré de couleur qui
   apparaissait dessous) : le nuancier s'ouvre maintenant au premier clic, et un
   champ hexadécimal permet de taper une couleur précise.

**Pages de mode**
8. Les règles étaient écrasées : titres de section, puces et séparateurs se
   touchaient. Rythme vertical revu (interlignes, marges, largeur de ligne à 78ch).
9. La flèche du bouton « Filtres » (9 px à 60 % d'opacité) et celle des groupes
   d'opus (40 %) étaient quasi invisibles : plus grandes, pleinement opaques.
10. Les filtres d'opus ne disaient pas ce qu'ils font : une ligne d'explication
    ouvre le panneau, un jeu retenu porte une pastille ✓ (un jeu écarté a un contour
    en pointillés), les boutons « tout / aucun » de groupe ont un libellé court pour
    ne plus être confondus avec le bouton global, et le panneau défile au lieu de
    dépasser de l'écran (P5X était coupé).
11. Le lien du logo s'étendait sur toute la largeur de l'en-tête : cliquer à côté du
    logo renvoyait à l'accueil. Il est réduit à l'image.
12. Le ▶ des lecteurs (mode Musique, musique de profil) paraissait collé à gauche
    dans son rond : le glyphe a des blancs latéraux asymétriques, flex le centre sur
    sa boîte et pas sur ce qu'on voit. Décalage optique, retiré sur le ⏸.

**Au passage** : `js/modal.js` — Escape fermait TOUTES les modales ouvertes, chacune
ayant posé son écouteur. Seule celle du dessus réagit maintenant (l'ordre de
`_trapState` fait foi) ; sans ça, fermer le recadrage fermait aussi l'atelier.

---

## 2026-09-16 — feat(profil, classement) : la page profil devient une vitrine, l'atelier passe en modale, le classement repasse au thème du site (branche `feat/profil-vitrine`)

Second retour de Hamza dans la journée, après avoir essayé l'atelier de la PR #121 :
« les badges encore plus visibles (petits et cachés, on les voit mal — et la carte
Badges dit "toute ta collection" mais on ne les voit pas dedans) ; l'avatar dans une
modale, pas dans la fenêtre par défaut ; p't'être une modale globale pour la
personnalisation ; le bouton exporter on l'enlève et on le met dans les paramètres,
et on rend le partage plus beau et intuitif ; les wallpapers débloqués, trouve un
autre moyen, ils sont supra grands. En bref presque tout à changer. Et refais le
style de la page ranking, vu que Amis a bien été refait. »

Puis, en cours de route : pas d'import d'image en photo de profil (dérives), mais on
doit pouvoir recadrer un portrait mal cadré ; les badges de la page « comme avant »
(gros médaillons) ; et de quoi consulter tous les badges et titres d'un ami.

### La page profil est une vitrine, l'édition vit dans une modale

- Bouton **« Personnaliser »** sur la carte d'identité → `#atelierModal`, la modale qui
  contient les cinq onglets (Avatar, Bordure, Thème, Titre, Badges épinglés). Le ✎ de
  l'avatar, la puce de titre et un emplacement de badge vide y mènent aussi, sur le bon
  onglet. Le dernier onglet ouvert est mémorisé, la croix / Escape / le fond ferment, et
  fermer envoie tout de suite ce qui restait en attente (`closeAtelier`).
- `#atelierModal` et `#sharePreviewModal` sont à **z-index 10000** : `.modal` vit à 1000
  et `.top-right-stack` (Mode sombre, ⚙, Compendium) à 9999 — la croix de fermeture se
  retrouvait sous le bouton Compendium. Même convention que la modale des badges. Le
  recadrage, ouvert DEPUIS l'atelier, passe à 10002.
- L'indicateur d'enregistrement est dupliqué dans l'en-tête de la modale : il est écrit
  sur tous les `[data-save-status]`, la carte étant derrière le fond assombri.
- **Blowout de grille corrigé** : `grid-template-columns: 300px 1fr` → `minmax(0, 1fr)`.
  Une bande à défilement horizontal (les wallpapers) élargissait la colonne de droite à
  1008 px et toute la page défilait de côté.

### Badges : une vraie vitrine, en grand

`renderBadgesShowcase()` (badgesManager.js) rend les badges **débloqués** dans la carte
Badges — gros médaillons cerclés d'or, comme avant la 2.2, épingle sur ceux qui sont sur
la carte d'identité, compteur `n / 63` dans le titre, clic = zoom. La carte ne contenait
qu'un bouton « See All Badges ». La collection complète (verrouillés + conditions) reste
dans `#badgesModal`, qui perd son bouton « Sauvegarder » (chaque clic enregistre déjà).

### Wallpapers : une bande, plus une galerie

Sept vignettes de 180 px mangeaient ~500 px de haut. `renderUnlockableWallpaperGallery()`
rend maintenant une **bande horizontale** de jetons 128 × 72 (~84 px de haut au total) +
compteur ; le clic ouvre `showWallpaperPreview()` — l'image en grand, son nom, sa
condition (lisible, au lieu d'être écrasée sur la vignette). Verrouillé = assombri.

### Partage : l'aperçu d'abord

La modale empilait tous les réglages en haut, l'aperçu tombait sous la ligne de
flottaison et les boutons encore plus bas. Elle passe en deux colonnes (aperçu collant à
gauche, réglages à droite, actions dans une barre fixe), une seule colonne sous 860 px.
**Bug corrigé au passage** : la carte partait avec « Guest Player » et l'ancien avatar —
`setupShareProfile` capturait la référence du profil à l'init, or `initProfile()`
RÉASSIGNE `profile` après le pull cloud. `generatePreview()` relit désormais
localStorage (`_liveProfile`).

### Export → ⚙ Paramètres

`exportProfileFile()` vit dans `js/settings-modal.js` (section « Données »), lu depuis
localStorage donc utilisable partout. La modale des paramètres est montée sur la page
profil **même déconnecté** (`_save()` gère déjà `userId === null`) : un joueur sans
compte est justement celui qui a besoin d'exporter. La carte « Data » du profil devient
la carte « Partage ».

### Avatar : portraits du jeu uniquement, mais recadrables

- **Plus d'import d'image** (`#avatarUploadInput` retiré) : un avatar est vu par les
  amis, le classement et les défis, et rien ne modère une image libre.
- Le **recadrage reste** (`#avatarCropModal`), mais il ne s'ouvre que sur le portrait
  porté — certains portraits sont mal cadrés par défaut. Sa branche morte `cropTarget
  === "song"` disparaît avec `cropTarget`.
- `api/user/migrate.php` écrivait `avatar_data` **sans aucune validation** (JSON fourni
  par l'utilisateur au moment de l'inscription) : il passe maintenant par
  `personadle_validate_avatar()`, comme `PATCH /api/user/:id`.
- Angle mort assumé et documenté dans la fonction : un appel d'API fabriqué à la main
  peut encore poster une image encodée arbitraire — le serveur ne peut pas distinguer le
  recadrage d'un portrait d'une autre image. Fermer ça demanderait de stocker le cadrage
  (zoom/offsets) au lieu des pixels et de refaire le rendu partout où un avatar
  s'affiche (amis, classement, calling cards, carte de partage, compendium).

### Profil consulté : sa collection de badges

`profile-view.js` rend la vitrine de badges du joueur visité (compteur compris) : la
carte Badges n'est plus masquée en entier, seul le bouton vers SA propre collection
l'est. Une carte listant ses **titres** a été essayée puis retirée le même jour
(« ça rend mal » — des calling cards 16:9 empilées) ; l'ajout correspondant à
`GET /api/user/public` a été annulé avec elle. Deux rectangles vides corrigés au
passage : `.song-card.hidden` et `.profile-card.hidden` gardaient leur hauteur (la page
n'a pas de règle `.hidden` globale), et le sélecteur de mode favori s'affichait vide sur
un profil consulté.

### Où vivent les 4 badges mis en avant

Ils étaient passés sous la photo de profil avec la PR #121 ; ils retournent **dans la
carte Badges** (« je veux l'ancien fonctionnement, les 4 affichés dans l'onglet badge et
pas sous la pdp »), au-dessus de la vitrine des débloqués, en emplacements de 76 px. La
carte d'identité ne garde que l'identité : avatar, titre, pseudo, code ami, le bouton
« Personnaliser » et l'état d'enregistrement.

### Classement : le style de la page Amis

`leaderboard.css` réécrit sur le système de `friends.css` (jetons `--lb-*` redéfinis par
`.darkmode`) : la page était sombre en permanence, seul écran noir du site en mode clair.
Le top 3 devient un **podium** (`renderPodium()`, ordre visuel 2–1–3, 1ᵉʳ plus grand et
doré ; une colonne sur mobile), les lignes s'aèrent, sa propre position est épinglée en
haut de la carte (`position: sticky`), et « 674 games » en dur devient
`leaderboard.games_count` traduit.

### Fichiers

`profile/profile.html` (modale atelier, vitrine, carte Titres, modale de partage),
`profile/atelier.js` (ouverture/fermeture de modale, statut multi-cible),
`profile/profile-page.js`, `profile/badges/badgesManager.js` (+ `renderBadgesShowcase`),
`profile/wallpapers-ui.js` (bande + aperçu), `profile/share-card.js` (`_liveProfile`),
`profile/profile-view.js`, `js/settings-modal.js` (+ `exportProfileFile`), `js/auth.js`,
`api/user/public.php` (+ `titles`), `api/user/migrate.php`, `api/lib/validation.php`,
`profile/profile-page.css` (§10c–10f), `profile/leaderboard/leaderboard.{css,js}`,
`css/settings-modal.css`, `lang/*.json` (+18 clés, 3 retirées).

Tests : `tests/atelier.test.js` (+11 : modale, statut de la modale, vitrine),
`tests/wallpapersUi.test.js` (bande + aperçu), `tests/php/ValidationTest.php`,
`tests-e2e/profile_atelier.spec.js` (14 scénarios : vitrine, modale, recadrage, pas
d'import, export dans les paramètres, collection d'un ami…).

### Angles morts connus

- Le podium n'apparaît qu'à la première page et à partir de 3 entrées ; en dessous, les
  lignes gardent leur médaille en emoji.
- La modale de partage garde ses `<select>` natifs : la refonte porte sur la mise en
  page, pas sur les contrôles eux-mêmes.

---

## 2026-09-16 — feat(profile) : l'atelier — personnalisation du profil sans bouton Save (branche `feat/profile-atelier`)

Demande Hamza (2026-09-15) : « rendre la personnalisation du profil plus intuitive —
la sélection des 4 badges, un meilleur menu pour la photo, les couleurs (UI & contour),
le titre, enlever le gros bouton Save, moderniser la navigation ». Prototype validé
le 16 (« go, fais en sorte que ça rende bien »).

### Ce qui change pour le joueur

- **La carte d'identité (gauche) est l'aperçu vivant** : avatar avec une pastille ✎,
  pseudo, le titre équipé en puce cliquable (« ＋ Choisir un titre » quand il n'y en a
  pas), **4 emplacements de badges épinglés** (rempli = badge + ✕ au survol pour le
  retirer, vide = « + » qui ouvre l'onglet Badges), et un **indicateur d'enregistrement**
  (« Tout est enregistré » / « Enregistrement… » / « Enregistré » / « Non enregistré —
  clique pour réessayer »).
- **L'atelier (droite, au-dessus des stats)** : un panneau à cinq onglets — Avatar,
  Bordure, Thème, Titre, Badges. Onglets verticaux sur desktop, en ligne (les cinq
  visibles sans défilement) sur mobile ; flèches ←/→ ; le dernier onglet ouvert est
  mémorisé (`localStorage.atelierTab`).
- **Avatar** : les portraits de la galerie s'appliquent **au clic** (plus de modale à
  valider) ; « Importer une image » (fichier local) et « Ajuster le cadrage » ouvrent
  la modale de recadrage, réduite au canvas. Un portrait fixe est rendu en PNG 300×300
  comme le faisait « Appliquer », un GIF garde son chemin (il resterait animé).
- **Badges** : l'onglet ne montre que les badges débloqués, en vignettes ; épinglé =
  bordure accent + ✓, compteur « n/4 » dans l'indication. Le catalogue complet
  (verrouillés, conditions, recherche) reste dans « See All Badges ».
- **Titre** : la grille des titres vit dans l'onglet (mêmes cartes `.tm-card`,
  reposées sur le thème de la page au lieu du fond de modale sombre).
- **Mode favori** → carte Statistiques (c'est une préférence d'affichage, pas un look).
- Disparus : « Change Picture », « Titles », « Save », la carte « Customization »
  dépliable, la modale Titres, la grille de portraits dans la modale de recadrage.

### Enregistrement automatique

Chaque changement continue d'envoyer **son propre champ tout de suite**
(`saveProfileToCloud({ … })`, comme avant). `markDirty()` — appelé par tous les
modules après un choix — n'allume plus un bouton : il programme (`scheduleAutosave`,
700 ms de regroupement) l'envoi complet `syncProfileToCloud({ strict: true })`, qui
est le filet. Dix clics de pastille = un envoi complet. L'indicateur reflète cet
envoi ; en erreur, un clic relance ; un changement pendant l'envoi déclenche un
second envoi après, jamais en parallèle (`profile/atelier.js`, sans dépendance au
profil ni à l'API — testable seul).

### Bug trouvé en route : un portrait GIF ne se sauvegardait jamais

Depuis la v2.0, `PATCH /api/user/:id` refusait tout `avatar_data` qui n'est pas un
`data:image/(png|jpeg|webp)` — or un GIF n'est pas passé au canvas (il perdrait son
animation) et est stocké par son chemin `../img/avatar/<nom>.gif`, la forme que tout
le client résout déjà (friends, leaderboard, calling cards, profil public,
compendium). Résultat : 400 silencieux, et au pull cloud suivant (rechargement, 3 min)
l'avatar revenait au précédent. Reproduit avant correction sur la pile locale.
→ `personadle_validate_avatar()` (`api/lib/validation.php`, pure, testée) accepte en
plus une **référence à la galerie** : regex stricte `../img/avatar/[A-Za-z0-9_-]+.(gif|
png|jpe?g|webp)` + `is_file()` dans `img/avatar/` (jamais un chemin libre, pas de
traversée). Un ancien chemin v1 `./img/…` est renvoyé sous cette forme par les deux
envois complets (`syncProfileToCloud`, `auth.js` au login). Choisir un GIF encodé en
base64 aurait été l'autre option : jusqu'à 1,7 Mo dans chaque liste d'amis — non.

### Profil consulté (`?view=`)

`activateReadOnlyMode()` masque `#atelier`, `#saveStatus`, la puce vide, désactive
`#equippedTitleBtn`, et retire la carte Badges entière (elle ne contient plus que
l'accès à la collection du propriétaire). `renderViewBadges` rend les mêmes
`.pin-slot--filled` (sans ✕) ; sans badge épinglé, le bloc disparaît (pas de « + »
pour un visiteur).

### Fichiers

- `profile/atelier.js` (nouveau) — onglets + autosave. `profile/profile.html` — carte,
  section `#atelier` (ids historiques conservés : `#avatarGrid`, `#borderSwatches`,
  `#themeSwatches`, `#titlesModalGrid`, `#previewBadges`, `#favModeChips`).
  `profile/profile-page.js` — `markDirty → scheduleAutosave`, `applyAvatarPreset` /
  `commitAvatar`, import + ajuster, suppression de `setupPersoCard` /
  `updateAppearancePreview` / `saveRefreshBtn`. `profile/badges/badgesManager.js` —
  `renderBadgesPreview` (4 emplacements) + `renderBadgePicker` (nouveau), rappelés
  partout où `renderBadgesModal` l'est. `profile/titles-ui.js` — puce vide,
  `_bindTitlesModal` rend la grille sans modale. `profile/profile-view.js`.
  `profile/profile-page.css` — section 10c ; blocs `.perso-*`, `.appearance-preview`,
  `#titlesModal` retirés. `lang/*.json` — 27 clés `profile.*` (+ 4 retirées :
  `customization_title`, `border_color_label`, `theme_label`, `save_refresh`).
- Tests : `tests/atelier.test.js` (onglets, autosave, emplacements, sélecteur),
  `tests/titlesUi.test.js` (+2), `tests/php/ValidationTest.php` (+7),
  `tests-e2e/profile_atelier.spec.js` (7 scénarios : plus de Save, rafale = un envoi,
  GIF qui survit au rechargement, PNG, puce titre + onglet mémorisé, épingler /
  désépingler, profil consulté), `tests-e2e/unlocks_usecases.spec.js` (onglet Titre).

### Angles morts connus

- L'indicateur reflète l'envoi complet ; un envoi de champ isolé qui échoue (réseau)
  alors que l'envoi complet réussit ensuite est de toute façon rattrapé par ce dernier.
- `syncProfileToCloud` envoie `avatar_data` à chaque autosave — un avatar PNG 300×300
  base64 (~100 Ko) par rafale de changements. Acceptable ; à revoir si un jour
  l'autosave se déclenche sur la frappe du pseudo (aujourd'hui le pseudo a son propre
  envoi, sans passer par `markDirty`).

---

## 2026-09-16 — fix(modes) : la cible du jour était aléatoire dès le lendemain, dans les six modes (branche `fix/silhouette-daily-target-notifs`)

Point de départ : un joueur sur Discord — « en mode Shadows, ça affiche parfois Akechi,
taper Akechi ne marche pas, et l'abandon révèle un autre Shadow ». Deux bugs derrière,
dont un gros.

### 1. Le reset quotidien tirait au hasard (six modes)

`checkResetOnLoad()` (nouveau jour au chargement) et `setupDailyReset()` (minuit page
ouverte) faisaient `resetBtn.click()` — le bouton **Rejouer**, qui tire au hasard dans
le pool. La cible seedée joueur + jour + mode (`getDailyTarget`) ne servait donc qu'à
la toute première partie d'un appareil ; dès le lendemain, chaque joueur jouait un
personnage aléatoire : différent sur deux appareils, et signalé par l'anti-triche
serveur (`api/lib/daily_target.php` recalcule la cible seedée) à **chaque** partie.
Mesuré avec une sonde Playwright (joueur qui revient, identifiant connu, état d'hier
en place) : Classique, Émoji, Silhouette, Personae, Musique en écart ; AOA correct au
chargement (il recharge la page) mais pas à minuit. Émoji : `resetGame()` tirait au
hasard sur TOUS ses chemins, sans aucun `getDailyTarget` hors première visite.

Conséquence directe : le journal anti-triche (phase 1, et le panneau admin 🛡 de la
2.2) est du bruit — tout le monde y est. La phase 2 (rejet) prévue par l'audit aurait
bloqué tout le monde. **À vérifier en prod après déploiement** :
`SELECT JSON_UNQUOTE(JSON_EXTRACT(context,'$.mode')) m, COUNT(*) FROM error_log
WHERE message='Daily target mismatch' GROUP BY m` — le compteur doit cesser de
grimper le lendemain de la release.

→ Un tirage explicite par mode : Classique `newRound(random)` (corps de Rejouer),
Émoji `resetGame(random)`, Silhouette `newRound(random)`, Personae / Musique
`resetGame()` sans random, AOA même chemin que le chargement. Rejouer et changement
de filtres restent aléatoires.

### 2. Silhouette : l'image d'hier recouvrait celle du jour (le cas « Akechi »)

Le chargement de l'image **restaurée** depuis localStorage n'avait pas le jeton
`currentPickToken` de `pickCharacter()` : quand le tirage du jour partait pendant que
l'image d'hier chargeait encore (réseau lent, cache froid), l'image d'hier finissait
par se poser dans le DOM — cible d'aujourd'hui, silhouette d'hier. Taper le nom
d'hier : refusé ; abandonner : `revealSrc` (correct) révélait la vraie cible. → même
jeton sur la restauration ; `data-target` sur l'image pour les tests.

### 3. `getPlayerSeedId()` : le compte d'abord

Au premier chargement d'un appareil, `localStorage.playerUserId` n'existe pas encore
quand le mode tire sa cible (posé par auth.js après `/me`) : tirage sur un
identifiant anonyme, différent de celui du serveur. `window._currentUser.id` est
préféré quand la page le connaît déjà (re-tirages, retour d'onglet).

### 4. Toast « Title Unlocked! » à chaque visite du profil

« À chaque fois que je vais sur mon profil j'ai la notif de I Remembered » (Hamza).
`checkAndUnlockTitles()` posait le titre en local et jouait la toast AVANT la réponse
du serveur, 403 avalé. Sur un navigateur qui perd son localStorage entre deux visites,
rebelote à chaque fois. → le serveur confirme d'abord ; 4xx = rien n'est posé ni
annoncé ; l'annonce est mémorisée hors du profil (`_seenTitleAnimIds`, comme
`_seenBadgeAnimIds`). Invité : le local fait foi. Cette règle rend aussi caduc le
« titre fantôme » que `syncTitlesWithBackend()` retire : il ne peut plus naître.

### Divers

- Ren Amamiya : citation « Checkmate! » (décision Hamza).
- README : « Core Team » (Hamza) + « Contributors & Credits » (Léo, Damien, Dzulian,
  rôles datés) ; tableau de CLAUDE.md aligné.

### Tests

- `tests-e2e/daily_target.spec.js` (8) — six modes : deux navigateurs « joueur qui
  revient » tirent la même cible, égale à celle que le serveur attend (même helper,
  pool de `api/data/daily_pools.json`), date du jour posée ; Classique : la partie
  jouée n'apparaît pas dans `/api/admin/anticheat` ; Silhouette : image d'hier
  retardée de 1,5 s → la silhouette affichée est celle du jour. 7/8 rouges sans le
  correctif.
- `tests/titles_reconcile.test.js` (+2) — 403 → rien en local, rien annoncé ;
  accepté → annoncé une fois, plus jamais même profil reconstruit ; invité → local.

## 2026-09-15 — test(E2E) : Expert ↔ défis, déblocages, streak vue du profil, mobile — et deux bugs de plus (même branche)

Deuxième vague demandée par Hamza (« streak, stats, mobile, débloquer les modes Expert
couplé aux défis ça bug beaucoup, badges, titres, wallpapers… ») : 22 tests E2E de
plus, tous contre la vraie pile, et deux bugs sortis en les écrivant.

### Les bugs

6. **L'annonce « Mode Expert débloqué » jouait une fois sur deux.** Le cache de l'état
   Expert est rattaché au compte (`window._currentUser.id`, posé par `initAuth()`) et
   la porte Expert n'attendait pas l'auth : quand `/expert-status` répondait avant
   `/me`, le cache n'était ni lu (pas de diff → pas de cadenas qui explose) ni écrit
   (l'annonce était perdue pour la fois suivante aussi). → `fetchExpertStatus()`
   attend `window._authReady` avant de toucher au cache. Test unitaire rouge sans le
   correctif (auth résolue un tour après la réponse).
7. **4 titres fantômes de plus en prod** (`looking_cool`, `pancakes`, `first_awakening`,
   `always_be_positive`), vus dans `user_titles` du compte de Hamza — la 039 n'en
   listait que 7. → migration **043**, même méthode par slug, rejouée sur base vierge
   avec les trois cas seedés (fantôme seul → transféré ; les deux → le canonique
   reste ; fantôme équipé → repointé), 0 orphelin, idempotente.

### Le diagnostic du titre I Am Not Afraid (compte de Hamza)

Les SELECT prod : `user_stats.classic` = 74 parties / 71 victoires, et
`user_titles` contient bien `aigis_i_am_not_afraid` depuis le 2026-07-24 (import v1).
Le compte de Hamza est sain côté serveur ; le cas « badge oui, titre non » rapporté
est celui d'un ami — même requête à lancer avec son pseudo pour trancher entre
« < 50 victoires Classique enregistrées » et la course corrigée par
`syncTitlesWithBackend()`. Au passage : `user_stats` (71) ≫ `game_sessions` (3
victoires depuis le 24/07) est NORMAL — `user_stats` porte l'historique v1 importé,
`game_sessions` ne commence qu'à la 2.0. Le badge `velvet_regular` (50 jours) a été
accordé à l'import, alors que `game_sessions` n'a que 35 jours distincts : deux
sources, deux histoires.

### Tests ajoutés

- `tests-e2e/unlocks_usecases.spec.js` (15) — **Expert ↔ défis** : porte à 9/10
  victoires rapides, session Expert 403 avant, `?expert=1` renvoyé, défi Expert vers un
  ami non débloqué refusé (409), normal + Expert coexistent le même jour, un défi Expert
  en cours ne bloque pas un défi normal (deux cases), accepter un Expert mène sur
  `?expert=1` avec le bandeau, le jouer n'écrit ni session normale ni Expert, le cadenas
  s'anime une fois. **Déblocages** : badge `first_win` / `ace_defective` (403 → 200,
  idempotent, catalogue), inconnu 404, manuel accordé, fond d'écran `rise_dungeons`
  (29 → 403, 30 → 200), titre `marie_i_remembered` après 12 badges accordés par l'admin,
  code événement (201 / 409 / désactivé 404 / inconnu 404 / vide 400). **Autre
  appareil** : badges et titre accordés en base affichés sur un navigateur neuf, titre
  équipé → persiste côté serveur et sur un troisième navigateur.
- `tests-e2e/mobile_streak_usecases.spec.js` (7) — **streak et stats vues du profil**
  après de vraies parties (0 → hier par API + victoire du jour au navigateur → Parties 2
  / Victoires 2 / Série 2 / Record 2 ; abandon Émoji → Abandons 1, Parties 3, série
  toujours 2 ; navigateur neuf → mêmes chiffres). **Mobile 390 × 844 tactile** : pop-up
  de défi dans l'écran, Accepter au doigt → mode + bandeau, aucun débordement horizontal
  (accueil, mode, Amis, profil), Boîte au doigt, modale des badges dans l'écran, bulle
  d'info entière.
- `tests-e2e/helpers/page.js` — `gotoSettled()` : recharge tant que l'écran de
  maintenance (déclenché en parallèle par `moderation.spec.js`) est là. Les trois
  nouveaux specs passent par lui et par `call()` (503 rejoué) : 6 passages complets
  consécutifs sans échec (184/184).
- `api/auth/register.php` : limite hors prod 50 → 200 inscriptions / 15 min — la suite
  complète en fait 51, la 51e tombait en 429. Prod inchangée (5).
- `tests/expertUnlock.test.js` (+2).

Angle mort : la limite admin (300 requêtes / 5 min, `requireAdmin`) est atteinte si on
enchaîne deux suites complètes en moins de 5 min en local — pas en CI (un passage par
job). `DELETE FROM rate_limits` dans le conteneur pour relancer.

## 2026-09-15 — test(défis, stats) : tous les cas d'usage, et les cinq bugs qu'ils ont sortis (branche `test/defis-stats-usecases`)

Demande Hamza : « tester TOUS les cas de défi possibles » (pop-up index / profil,
Boîte de la page Amis, plusieurs défis en même temps, Plus tard…) et « plein de cas
d'usage sur l'enregistrement des stats », après les bugs de défis qui les ont abîmées.
Chaque test a été écrit contre le comportement RÉEL ; cinq ont trouvé un bug, corrigé
dans le même lot.

### Les bugs trouvés

1. **Titres jamais réclamés au serveur (point 2 de Hamza — « badge Velvet Regular oui,
   titre I Am Not Afraid non »).** En fin de partie, `checkUnlocksAfterGame()` tourne
   juste après `savePendingSession()` SANS l'attendre : le client compte la 50ᵉ
   victoire, POST `/titles/unlock`, le serveur (qui lit `user_stats`) n'a pas encore la
   session → 403 avalé. Le titre entre dans `profile.unlockedTitles` (donc plus jamais
   renvoyé par `checkAndUnlockTitles`) et n'atteint jamais `user_titles`. Les badges
   ont `syncBadgesWithBackend()` depuis toujours ; les titres n'avaient rien.
   → `profile/titles-ui.js` : `syncTitlesWithBackend()` appelé par `initTitlesSection`
   (local absent du serveur → repoussé ; 403 définitif → titre fantôme retiré, le
   backend est la source de vérité ; réseau/404 → gardé pour la prochaine fois).
   Reproduit contre le vrai serveur dans `tests-e2e/stats_usecases.spec.js` (49
   victoires → 403, 50 → 200, et `velvet_regular` reste 403 avec 1 jour distinct).
   **Vérifié sur `develop` avant correctif : le bug y était** (aucun code de titres
   n'a changé entre `main` et `develop`).
2. **Streak globale datée du jour de réception, pas du jour de jeu.**
   `personadle_bump_global_streak()` utilisait `now` : une partie de 23 h 50
   synchronisée à 0 h 10 (file hors ligne) comptait pour le lendemain ; si la
   précédente datait de l'avant-veille, la streak repartait à 1 alors que le joueur
   avait joué chaque jour. La streak par mode lisait déjà `played_date`.
   → `api/lib/streak.php` + `api/lib/game_session.php` : jour de JEU, la date
   mémorisée ne recule jamais (une session de la veille arrivée après celle du jour
   est inerte). PHPUnit `StreakTest` + `DatabaseIntegrationTest`.
3. **Résultat de défi perdu si l'appel échoue.** `checkChallengeCompletion()` envoyait
   `beaten`/`expired` en fire-and-forget : réseau coupé = défi `accepted` en base pour
   toujours (expéditeur jamais prévenu, « en cours » sur la page Amis, 409 pour un
   nouveau défi le même jour). → file `pendingChallengeStatus` (gameCore.js), rejouée
   au début de chaque sondage (`notifications.js`) ; 4xx = définitif, jeté.
4. **Case de défi périmée jamais libérée hors de la page du mode.** Défi accepté lundi,
   jamais joué, nouveau défi accepté mardi depuis l'accueil : les filtres du défi de
   lundi étaient encore posés et devenaient les « filtres d'origine » du défi de mardi.
   → `installActiveChallenge()` partagé dans gameCore.js (les deux chemins
   d'acceptation dupliquaient le même bloc), qui appelle `releaseStaleChallenge()`
   d'abord.
5. **Machine à états des défis sans garde côté serveur.** Un expéditeur pouvait passer
   son propre défi en `expired`/`accepted` ; un `beaten` pouvait revenir `accepted`
   (donc re-bloquer un nouveau défi le même jour). → `api/messages/index.php` :
   destinataire seul, `unread → accepted|read`, `accepted → beaten|expired|read`,
   finaux immuables, `accepted → accepted` idempotent (double clic / second appareil).

### Point 4 de Hamza — bulle d'info des badges (signalement joueur)

Mesuré avec Playwright (sonde `getBoundingClientRect` + captures), trois causes :

1. **LA cause** (retour de Hamza : « la bulle passe dessous, genre Série ») :
   `.badges-grid-wrap { overflow: hidden }`, posé pour l'animation de repli des
   catégories, coupait toute bulle qui MONTE au-dessus du bloc — c'est-à-dire celle
   de chaque badge de première rangée, quelle que soit la position dans la modale
   (bulle à `top: 190`, bloc à `top: 367` : invisible). → `overflow: hidden` seulement
   `.collapsed` ou `.is-animating` (classe posée par `setCategoryCollapsed()` le
   temps de la transition `grid-template-rows`, filet `setTimeout` 600 ms). Vérifié :
   replié → hidden, dépliage → hidden, ouvert → visible, hauteurs identiques à avant.
   `.badge-item:hover { z-index: 5 }` pour que la bulle passe aussi devant la
   catégorie suivante (le `transform` du survol crée un contexte d'empilement).
2. Bord haut de la modale (conteneur de défilement) : variante `.badge-tooltip--below`
   (flèche en haut, couleur via `--badge-arrow`), décidée par
   `adjustTooltipPositions()` depuis la géométrie du badge — plus depuis la position
   courante de la bulle, faussée par les `nth-child` écrits pour 4 colonnes.
3. Mobile : `#badgesModal` en `content-box` faisait 415 px sur 390 (2ᵉ capture du
   joueur, première colonne coupée). → `border-box` avec `max-width: 764px` (= les
   700 px de contenu d'avant + padding + bordure : rendu desktop strictement
   identique, Hamza avait vu la modale rétrécie avec un 700 border-box), padding
   réduit ≤ 480 px.

Au passage : `opacity: 0.5` sur `.badge-item.locked` rendait la bulle
semi-transparente — déplacé sur l'image et le nom.

### Tests ajoutés

- `tests/notifications_challenges.test.js` (25) — le sondage n'avait AUCUN test :
  accueil / profil / pages de jeu / page Amis, deux défis, `_queuedThisPage` vs « vu »
  persistant, plein écran `cr-overlay`, résultats pour l'expéditeur, file de relance.
- `tests/friends_challenge_actions.test.js` (20) — Accepter / Refuser / Reprendre /
  Abandonner par les vrais boutons de la Boîte, serveur d'abord, autre appareil, garde
  d'exclusivité, Expert verrouillé/débloqué (statut mis en cache par module : un seul
  jeu de réponses par fichier).
- `tests/challenge_install.test.js` (15) — l'installateur partagé et la libération
  d'une case périmée ; les deux chemins produisent une case identique.
- `tests/titles_reconcile.test.js` (10) — le scénario « badge oui, titre non » de bout
  en bout côté client.
- `tests/challengeResult.test.js` (+3) — la file de relance.
- `tests-e2e/challenge_usecases.spec.js` (13) — API : toute la machine à états ; UI :
  deux défis à l'accueil, Plus tard / Refuser, mémoire au rechargement et sur le
  profil, accepter depuis la pop-up du profil, exclusivité depuis la pop-up ET la Boîte,
  abandon, **et une partie de défi n'entre pas dans les stats, la partie du jour qui
  suit, si** (vérifié en base).
- `tests-e2e/stats_usecases.spec.js` (16) — `user_stats` ↔ réponse de POST, le cas
  titre/badge, streak hier+aujourd'hui / par mode / globale, ce que le serveur refuse.
- PHPUnit `StreakTest` (+2), `DatabaseIntegrationTest` (+1).

Angle mort assumé : les deux nouveaux specs E2E tolèrent le 503 « maintenance » que
`moderation.spec.js` déclenche en parallèle (toute requête passe par un `call()` qui
rejoue sur 503). Les autres specs n'ont pas cette tolérance et peuvent échouer
localement sans `retries` (la CI en a 2) ; `expert-personae` « nom masqué » échoue
aussi les jours où la fiche de la cible contient un dérivé de son nom
(« terpsichorean ») — c'est la règle de frontière de mot de `maskTerms`, pas un
bug de masquage.

## 2026-09-15 — fix(défi): « Plus tard » ne cachait plus les autres défis en file (relecture PR #112)

Relecture avant merge des PRs empilées #112 → #114 → #117. Un seul vrai bug, dans le
chemin que « Plus tard » venait de rendre visible : deux défis reçus en même temps (deux
amis), « Plus tard » ou la croix sur le premier → le second **n'apparaissait jamais sur
cette page**.

- `js/challenge-notif.js` — `closeOnly` vidait la file (`_queue.length = 0`) en comptant
  sur le sondage suivant (60 s) pour représenter les défis jamais montrés. Or
  `js/notifications.js` les avait déjà notés dans `_queuedThisPage` **avant** de les
  pousser, donc le sondage les filtrait : ils ne revenaient qu'après un changement de
  page. Le commentaire promettait l'inverse. Désormais « Plus tard » et la croix ne
  valent que pour le défi fermé et **enchaînent sur le suivant**, comme « Refuser »
  (`_closeOverlay` → `_showNext`) : le joueur ne l'a pas vu, il n'a rien décidé à son
  sujet.
- `tests/challengeAccept.test.js` — cas « deux défis, Plus tard sur le premier » : le
  second s'affiche, `dismissed` n'est appelé que pour le premier, rien n'est envoyé au
  serveur. Vérifié rouge sans le correctif.
- `js/gameCore.js` — docblock mort au-dessus de `challengeScoreFor()` : le bloc décrivait
  le « par » par mode du 2026-09-12, retiré le 13. Fusionné avec le bloc qui suivait.

Le reste de la relecture (aucun changement de code) :

- migrations 040/041/042 rejouées sur une base **vierge** au schéma de `develop`, puis
  rejouées une seconde fois (idempotence) ; colonnes **et** index du schéma migré
  identiques à `sql/bdd_mysql.sql` de la branche (`information_schema` diffé) ;
- PDO/requêtes préparées ligne à ligne sur `api/admin/{user,announcements,settings,
  anticheat,user_notes,user_notices}.php`, `api/notices/index.php`,
  `api/sessions_today.php`, `api/lib/moderation.php` ; `escHtml` partout dans
  `admin/moderation.js` et `admin/site_panels.js` ;
- garde de maintenance : `me/login/logout`, `admin/`, `cron/` exemptés, admin connecté
  passe, 503 + `Retry-After` sinon — couvert par `tests-e2e/moderation.spec.js` ;
- #114 et #117 n'avaient **jamais tourné en CI** (le workflow ne se déclenche que sur
  les PR vers `develop`/`main`) : Vitest 1043/1043, PHPUnit 275/275, E2E 133/133, lint,
  i18n, pools, docs et data verts en local sur la tête de #117.

Angle mort assumé, inchangé : sans les migrations 040→042 jouées **avant** le pull
Hostinger, `requireAuth()` (colonnes `ban_reason`/`banned_until`), `login.php`, `me.php`
et l'INSERT de `game_sessions` (`guesses`) tombent en 500 — c'est le contrat de la
checklist de release (`DEPLOY.md`, `npm run schema:check-prod`), pas un fallback à coder.

---

## 2026-09-15 — Modération avec messages, annonces, maintenance (branche `feat/admin-moderation-maintenance`)

Réponse à « on peut rendre le menu admin plus booster encore ? genre laisser un message pour
quand je bannis une personne » → « FAIT TOUT et la possibilité de mettre le site en
maintenance ». Un ban sans explication était un mur pour le joueur et une amnésie pour
l'admin ; il n'existait aucun canal admin → joueur, et fermer le site voulait dire « couper
Apache ». Tout passe par la **migration 042** (`042_moderation_maintenance.sql`, MariaDB
`IF NOT EXISTS`, rejouable — reflétée dans `sql/bdd_mysql.sql`).

### Base (migration 042)

- `users` : `ban_reason` (300, vu par le joueur), `ban_note` (interne), `banned_at`,
  `banned_until` (NULL = définitif), `reset_local_state_at`.
- `user_notices` : messages de l'équipe (type `warning`/`info`, `read_at`).
- `admin_notes` : carnet interne par joueur, jamais exposé.
- `announcements` : bandeau global (`level` info/warning/maintenance, FR + EN optionnel,
  fenêtre `starts_at`/`ends_at`, `is_active`).
- `site_settings` : clé/valeur (`maintenance_enabled`, `maintenance_message_fr/en`,
  `maintenance_until`) — extensible à d'autres réglages sans nouvelle migration.

### Serveur

- **`api/lib/moderation.php`** : `personadle_ban_state($pdo, $row)` — `null` si pas banni,
  sinon `{reason, until}` ; **un ban à durée échu est levé en base au passage** (colonnes
  remises à NULL), pas de cron. `personadle_site_setting()` / `personadle_set_site_setting()`
  (upsert, cache statique par requête), `personadle_maintenance_state()`,
  `personadle_active_announcements()` (fenêtre + flag, maintenance devant),
  **`personadle_maintenance_gate($pdo)`** : appelé en fin de `bootstrap.php`, renvoie **503
  `{"error":"maintenance", …}`** à tout le monde sauf `auth/(me|login|logout)`, `admin/`,
  `cron/`, CLI et les admins connectés (`is_admin` mis en cache 60 s en session pour ne pas
  requêter `users` à chaque appel).
- `bootstrap.php` : `requireAuth()` lit les colonnes de ban et passe par `personadle_ban_state`
  (un ban échu ne bloque donc plus) ; **`jsonErrorWith($message, $status, $extra)`** pour les
  erreurs avec champs.
- `auth/login.php` : compte banni → 403 `{"error", "code":"banned", "reason", "until"}`.
  Rate limit login **50/15 min hors prod** (5 en prod), même logique que `register.php` : les
  specs E2E se connectent toutes depuis la même IP et un retry CI rejoue le `beforeAll`.
- `auth/me.php` : toute réponse porte désormais `maintenance`, `announcements`,
  `reset_local_state_at` (et `banned` quand la session vient d'être détruite pour ban) —
  **un seul appel** au chargement, pas de nouvel aller-retour par page.
- `api/notices/index.php` (+ `.htaccess`) : `GET /api/notices/` (mes messages non lus),
  `PATCH /api/notices/:id` (accusé). Dossier avec slash final, comme `friends/` et
  `messages/` (piège mod_dir).
- `api/admin/` : `user.php` (GET expose ban, `notes`, `notices` ; PATCH `is_banned` avec
  `ban_reason`/`ban_note`/`ban_hours` (0 = définitif), `reset_local_state`),
  `user_notes.php`, `user_notices.php`, `announcements.php` (CRUD), `settings.php`
  (GET/PATCH maintenance), `anticheat.php` (écarts « Daily target mismatch » de `error_log`
  groupés par joueur, `?days=`), `users.php` (`?sort=created|last_login|games|pseudo`,
  `?export=csv` — `;` comme séparateur, Excel FR). Chaque fichier a sa `RewriteRule`.
  Au passage : `activity.php` lisait `error_logs` (la table est `error_log`, singulier) —
  corrigé ici, la #114 seule a le bug.

### Client

- **`js/site_notices.js`** (+ `css/site_notices.css`, injecté à la demande) :
  `showMaintenance()` (écran plein Velvet pour le joueur, `body.maintenance-active` ; simple
  bandeau avec lien vers l'admin pour un admin connecté), `showAnnouncements()` (un bandeau
  par annonce, fermeture mémorisée par id dans `dismissedAnnouncements`),
  `showTeamNotices()` (messages de l'équipe, accusés via `api.notices.markRead`),
  `applyRemoteLocalReset(at)` (vide `MODE_STATE_KEYS` normal + Expert, `gameId_*`,
  `guessLog_*`, `activeChallenge`, `lastPlayedDate_*` — **pas** le profil ni la langue ;
  accusé dans `localResetAckAt`, jamais deux fois). `applySiteNotices(me)` orchestre le tout
  depuis `initAuth()` et **ne fait rien sur `/admin/`** (un bandeau y interceptait le clic
  de navigation en test).
- `js/auth.js` : `resolveBanMessage(err)` → « Compte suspendu jusqu'au … Raison : … » au
  login (i18n `auth.banned_until` / `banned_permanent` / `banned_reason`, 6 langues).
- `js/api.js` : `api.notices.pending()` / `markRead(id)`.
- Admin : onglet **🛡️ Modération** (`admin/moderation.js` — ban avec raison/durée/note,
  levée, messages + historique lu/pas lu, notes, profil public, reset ciblé), panneaux
  **📣 Annonces**, **🔧 Maintenance**, **🛡️ Anti-triche** (`admin/site_panels.js`), tri et
  export CSV de la liste. Le bouton ban de l'onglet Profil renvoie vers Modération.

### Tests

- `tests/site_notices.test.js` (12) ; PHPUnit +5 (état de ban, levée à l'échéance,
  définitif, upsert `site_settings`, fenêtre des annonces) ;
  `tests-e2e/moderation.spec.js` (7, stack complète : 403 `banned` au login, accusé de
  message, 403 admin-only, annonce via `/me`, **503 joueur / admin qui passe**, CSV).

### Angles morts

- La maintenance ne se lève **pas** toute seule à `maintenance_until` (informatif) — choix :
  c'est l'admin qui rouvre, après avoir vérifié.
- Le cache `is_admin` de 60 s en session : un admin rétrogradé garde l'accès pendant la
  maintenance jusqu'à une minute.
- Les annonces sont livrées par `/me` : un joueur qui reste sur une page sans recharger ne
  les voit pas avant sa prochaine navigation.

---

## 2026-09-13 — Comparer nos parties, relance des invités, tableau de bord Activité (branche `feat/guest-nudge-compare-admin`)

Trois idées validées par Hamza (« 8, 10, 16 » de la liste du soir), une PR empilée sur #112.

### « Tes amis aujourd'hui » — comparer nos parties (migration 041)

Un bouton **👥 Parties des amis**, jumeau de ⚔ Défier (même hôte — zone Expert puis
navigation —, même verrou « partie du jour finie », monté par `showChallengeButton()` via
`_ensureFriendsGamesButton()`), ouvre une fenêtre (`openFriendsGamesModal()`, habillage de la
modale de défi) avec la **première partie du jour** de chaque ami sur ce mode : résultat,
nombre d'essais, et la **suite des noms proposés** (le bon en vert) ; les amis qui n'ont pas
encore joué sont listés aussi. Première version dans la boîte de victoire, déplacée en bouton
à la demande de Hamza (« à côté des défis ») — la boîte reste propre.

- **Serveur** : `game_sessions.guesses` (JSON, migration 041 — MariaDB `IF NOT EXISTS`,
  rejouable, **à jouer avant le merge dans main** : sans elle plus aucune partie ne
  s'enregistre). `api/sessions.php` accepte `guesses[]` (≤ 40 chaînes ≤ 200 car., sinon
  ignoré, jamais rejeté) ; `personadle_record_game_session()` prend un 12ᵉ paramètre
  optionnel — les appels existants (tests PHPUnit compris) ne changent pas.
  **`api/sessions_today.php`** (`GET ?mode=&expert=`) : amis acceptés, `MIN(id)` par ami
  sur la journée Paris (les replays ne comptent pas — « on garde que la première partie »,
  décision Hamza), **403 `play_first`** tant que le demandeur n'a pas fini la sienne (la
  liste des essais révélerait la cible). Fichier **plat**, pas `api/sessions/today.php` :
  un dossier `sessions/` à côté de `sessions.php` déclenche le 301 de mod_dir sur
  `POST /api/sessions` (méthode dégradée en GET, 403 sur le listing) — vécu en le
  développant, c'est le piège CLAUDE.md §7.
- **Client** (`js/gameCore.js`) : journal des essais `guessLog_<scope>` rattaché à
  l'identifiant de partie (`currentGameId`) — vidé d'office par un Replay ou un nouveau
  jour, retrouvé après un rechargement. Alimenté par `showWrongMini()` (5 modes), par
  `logGuess()` dans le handler de Classique (sa grille ne passe pas par showWrongMini) et
  dans Music (liste maison) ; doublons consécutifs ignorés (Classique Expert journalise
  par les deux chemins). `buildGameSession()` ajoute `guesses`, le bon nom en dernier si
  gagné. `renderFriendsToday(container, mode)` rend la liste (réutilisable) ;
  `showCommunityStats()` reste une no-op exportée (les 6 modes l'appellent encore) ;
  `api.stats.friendsToday()`.
- ⚠️ **La cible du jour est tirée PAR JOUEUR** (`getDailyTarget` seedé sur l'id) : deux
  amis n'ont pas le même personnage. Découvert en testant en navigateur — on compare des
  *parcours*, pas des réponses : le bon essai d'un ami est le dernier de sa partie gagnée,
  et la note le dit (« chacun a son propre personnage du jour »).
- Avatars : chemins `../img/…` relatifs à `profile/` — les pages de mode sont à la même
  profondeur, ils marchent tels quels.
- Tests : `tests/friends_today.test.js` (11 : journal, Replay, showWrongMini, buildGameSession,
  bornes, bouton jumeau et son verrou, fenêtre ✕/Échap, rendu des trois états, play_first,
  Expert/invité) ;
  `DatabaseIntegrationTest::testRecordGameSessionStoresGuesses` (PHPUnit 270 vert) ;
  scénario navigateur Alice/Bob/Carol vérifié (capture).

### Relance des invités

Un joueur **sans compte** avec **3 jours de série ou plus** voit, à la fin de sa partie, une
carte « 🔥 N jours de série ! Crée un compte gratuit pour la sauvegarder » — CTA vers
`profile.html#register`, « Plus tard », au plus une fois par semaine (`guestNudgeShownAt`),
jamais pour un connecté. `maybeNudgeGuest()` appelée par `savePendingSession()` (les 6 modes y
passent, invités compris). `js/auth.js` ouvre la modale d'inscription sur `#register` et
retire l'ancre. La série lue est celle du profil local (`profile/profileStats.js`).
`tests/guest_nudge.test.js` (5) ; parcours carte → modale vérifié en navigateur.

### Admin — 📈 Activité

`api/admin/activity.php` (`?days=7..180`, `requireAdmin()`) : totaux (inscrits, actifs 7 j /
N j, parties, nouveaux comptes, écarts anti-triche loggés), par jour (jours vides inclus), par
mode (parties, taux de victoire, essais moyens sur victoires, part Expert), par heure Paris.
Les TIMESTAMP sont regroupés **en PHP** (`DateTime` + `Europe/Paris`) : `CONVERT_TZ` dépend
des tables de fuseaux du serveur SQL, absentes en mutualisé. `admin/activity.js` : KPI, barres
CSS pures (aucune librairie), sélecteur 7/30/90 j. Route dans `api/admin/.htaccess`, panneau
dans `admin/index.html`, `ADMIN_PANEL_IDS`. Comptes seulement : les invités ne postent pas de
session. Vérifié en navigateur avec le compte admin de seed.

### En passant

- `PERSONADLE_MODES` (`api/lib/validation.php`, chargé par `bootstrap.php`) remplace les
  **neuf** copies de la liste des modes côté PHP ; `tests/expertWiring.test.js` lit désormais
  cette source unique.
- Docs : `api/README.md`, `admin/README.md`, `TODO.md` (migration 041 dans la checklist
  release), FAQ inchangée (rien de nouveau à expliquer au joueur au-delà du bloc lui-même).

### Angles morts

- `guesses` NULL pour toutes les parties enregistrées avant la 2.2 : la comparaison montre
  alors le nombre d'essais seul — c'est voulu, on n'invente rien.
- Un ami qui joue en Expert a une autre cible et une autre dimension : le bloc Expert ne
  liste que les parties Expert (`expert=1`), jamais les normales.
- La relance des invités lit `stats.streak` : un invité qui n'a jamais eu de profil local
  (première visite) n'en a pas — normal, il n'a pas 3 jours.

---

## 2026-09-13 — Défi verrouillé avant la partie, entrée 2.2 Velvet Room, pile haut-droite du profil

Trois décisions de Hamza, plus la CI de #112 (rouge depuis l'ajout de `challenge_flow.spec.js`).

### « Défier un ami » : verrouillé tant que la partie du jour n'est pas finie

Le lot du 12 laissait le bouton cliquable dès l'arrivée, avec un score de référence (« par »
par mode). Décision : un défi porte **toujours un vrai score** — « bats mon score » n'a pas
de sens sans score. `js/gameCore.js` :

- `CHALLENGE_PAR` et le par sont **retirés** ; `challengeScoreFor(score)` renvoie le score ou
  `null`, `isChallengeLocked(score)` en découle. Les 6 modes n'ont rien à changer : ils
  passaient déjà `null` avant la fin et `attempts` après.
- `showChallengeButton()` pose `.btn-challenge--locked` + `aria-disabled` + `title` (i18n
  `challenge.locked_hint`) ; le clic verrouillé n'ouvre rien et fait sortir une bulle
  `.btn-challenge__hint` 2,6 s (le mobile n'a pas de survol). Pas d'attribut `disabled` : le
  clic doit arriver pour montrer le message. CSS dans `global.css` (gris, 🔒 devant l'épée,
  bulle avec flèche, retour à la ligne ≤ 480 px).
- **Depuis la page Amis** (`?challenge=<id>`) sur un mode pas encore joué : la bulle s'affiche
  au lieu de la modale, la présélection est gardée, et `showChallengeButton()` ouvre la modale
  **tout seul** sur cet ami au déverrouillage (`_preselectConsumed` garantit une seule fois).
  Le sélecteur de mode de `friends.js` annonce la règle (`friends.challenge_pick_note`).
- Deux fragilités trouvées en écrivant les tests, corrigées : la ligne présélectionnée
  dépendait de `CSS.escape` et de `scrollIntoView`, absents de jsdom — l'exception faisait
  retomber la liste d'amis sur son état d'erreur. Recherche par `dataset.fid`, appel optionnel.
- Tests : `tests/challenge_button_always.test.js` → **`challenge_button_lock.test.js`** (15,
  dont la présélection différée) ; `tests-e2e/challenge_flow.spec.js` étapes 1–5 réécrites
  (Alice joue pour déverrouiller, Bob joue l'Emoji avant que la modale s'ouvre sur Alice) avec
  **un seul contexte navigateur pour Alice** — « partie finie » est un état local, un contexte
  neuf par étape était un autre appareil. Changelogs joueur (index + page 2.2) reformulés.

### CI #112 — pourquoi le E2E était rouge

`challenge_flow` étape 2 cliquait le bouton avant toute partie ; en CI (1280×720) Playwright
loggait 55× « `.personadle-box` subtree intercepts pointer events » — la boîte de consigne
chevauche le bouton pendant le défilement d'actionnabilité, jamais en local. Le clic sur ce
bouton passe en `{ force: true }` (la visibilité est vérifiée à part) ; le scénario a de toute
façon changé avec le verrou.

### Entrée 2.2 du déroulant « Nouveautés » — Velvet Room, pas techno

« Mise à jour communautaire » était faux (les retours joueurs n'en sont pas le cœur) et le
thème techno ne parlait de rien. L'entrée s'appelle **« Version 2.2 — Le Compendium »** (6
langues), reprend le langage du carnet (`css/index.css` §10c réécrite : `.velvet-theme`,
damier de losanges qui dérive, pentacle qui respire, ornements ❦, or, papier crème en clair /
velours en sombre, `.velvet-btn`) et ouvre sur une puce 📖 Compendium. Plus aucune trace
`tech-*`.

### Profil — pile haut-droite

`profile.html` : le toggle dark mode/⚙ et le bouton Compendium sont dans `.top-right-stack`
(fixe, colonne, `align-items: stretch`) ; le toggle redevient statique dedans, le bouton prend
**exactement sa largeur** (224 px desktop, 93 px mobile où le libellé disparaît), avec 12 px
d'écart. `profile-page.css` §16 réécrite. Mesuré des deux côtés.

---

## 2026-09-13 — Le Compendium : carnet de collection (branche `fix/community-feedback-batch`)

Nouvelle page `profile/compendium/` — un livre qui raconte ce que le joueur a accompli :
badges, titres, fonds d'écran, liens (amitiés + rangs de Social Link), défis et exploits,
chaque entrée datée, avec qui, et un texte d'ambiance. Demande de Hamza (« comme un carnet
de collection », dans le style du *Grimoire du Cœur* de Persona Q), décisions prises le
2026-09-12 : texte **généré** (pas de note personnelle), **uniquement des données
existantes** (aucune table, aucune migration), **public** comme le profil, pas de 3D
lourde, et « Avant le Compendium » pour ce qui n'a pas de date plutôt qu'une date
inventée.

### Backend — `api/user/compendium.php` (+ `RewriteRule ^compendium$` dans `api/user/.htaccess`)

`GET /api/user/compendium` : `?code=` ou `?id=` → public (même exposition que
`user/public.php` : pseudo, code ami, avatar) ; sans cible → `requireAuth()` et le sien.
Lecture seule, 100 % PDO préparé, `is_deleted = 0` partout, défis plafonnés à 300.

- **Badges** : `badges_unlocked` (`unlocked_at`).
- **Titres** : `user_titles × titles` — nom en 5 langues, `rarity`, `image_path`.
- **Fonds** : `user_wallpapers × wallpapers`.
- **Liens** : `friendships` (`accepted_at`) + `social_links` (rang, xp) +
  `social_link_rankup_notifs` (chaque passage de rang daté). Un rang atteint **avant**
  l'existence de cette table n'a pas de date → le client le marque « avant le compendium ».
- **Défis** : `messages` type `challenge`, statuts `beaten`/`expired`, dans les deux sens.
  Le partenaire n'expose que `{id, pseudo}` — l'avatar est résolu côté client depuis la
  liste d'amis, pour ne pas renvoyer un base64 par défi.
- **Exploits** : `game_sessions` (première partie, première victoire et premier
  sans-faute par mode — sous-requêtes `MIN(played_date)` groupées par `mode, is_expert`),
  `expert_unlocks_granted` (accordé par l'admin) vs première session Expert jouée
  (débloqué), `users.global_streak_record`.

### Front — `profile/compendium/`

- `compendium_entries.js` — module **pur** (aucun DOM, aucun i18n) : réponse API →
  `{ badges[], titles[], wallpapers[], bonds[], challenges[], feats[] }` d'entrées
  `{ chapter, kind, title, flavor, vars, date, img|icon|avatar, rank?, expert?, won? }`.
  Tri décroissant par date, non datées à la fin, record de série épinglé en tête
  (`pin`). Doublons de notifs de rang fusionnés (`Set` par rang). `titleName(title,
  lang)` avec repli EN puis slug. `chapterSummary()` pour la page de gauche,
  `paginate()` (jamais zéro page).
- `compendium.js` — la page : `initCompendium()` (exporté pour les tests) attend
  `__i18nReady` + `_authReady`, lit `?view=`, appelle `api.user.compendium()`. Couverture
  (pseudo, *Ouvrir*) → `.cp-cover--opening` → livre : onglets (rôle `tab`, compteur),
  page de gauche (chapitre, résumé chiffré, filigrane, folio romain), page de droite
  (5 entrées/page, folio numérique), tourne-page 3D avec filet `setTimeout` si
  `animationend` ne vient pas (onglet en arrière-plan), ‹ › + flèches clavier, balayage
  tactile. Dates via `Intl.DateTimeFormat(lang, { dateStyle: "long" })`. Scores et
  tentatives en « N essais » (`compendium.tries` / `tries_one`), jamais un nombre nu.
  Libellés d'accessibilité (pager, onglets) posés en JS — `data-i18n` ne couvre pas
  `aria-label`.
- `compendium.css` — préfixe `cp-*`, palette Velvet Room en variables (`--cp-blue`,
  `--cp-gold`, `--cp-paper`…), mode sombre en surcharge de variables seulement. Onglets
  en **index sur le bord supérieur** du livre (première version : signets sur la tranche
  droite — débordaient du viewport à 1280 px et recouvraient le texte en actif).
  `.cp-cover` en `box-sizing: border-box` (sinon 360 + padding + bordure = 410 px sur un
  mobile de 390). Bannières de titre (≈ 4:1) en bandeau au-dessus du texte
  (`.cp-entry--banner`), pas dans un carré de 52 px. `prefers-reduced-motion` coupe tout.
- `js/api.js` — `user.compendium({ code } | { id } | {})`. `js/gameCore.js` —
  `/profile/compendium/` ajouté à `_DEEP_SUBPATHS` (`siteRootPrefix()` → `../../`).
- **Bouton sur le profil** — `profile/profile.html` `#compendiumBtn.grimoire-btn`, fixe
  sous `.darkmode-toggle` (losanges bleus animés + pentacle doré, `profile-page.css`
  §16 ; icône seule ≤ 768 px). `data-auth="connected"` ; en mode `?view=`,
  `profile-view.js` le pointe vers le carnet du joueur visité et le rend visible même
  déconnecté (le carnet est public).
- `sw.js` — les 4 fichiers de la page ajoutés au pré-cache.

### i18n, FAQ, docs, tests

- `lang/*.json` (6 langues) : namespace `compendium.*` — titre, tagline, chapitres et
  descriptions, états vides, stats, exploits, 19 textes d'ambiance `flavor.*`, libellés
  d'accessibilité. FAQ : `faq.q44/a44` (c'est quoi) et `faq.q45/a45` (public, « avant le
  compendium ») dans `pages/faq.html`, section Compte & Profil.
- `profile/compendium/README.md` — chapitres → tables, contrat API, flux, conventions,
  procédure pour ajouter une source d'entrées.
- `tests/compendium_entries.test.js` (18) — chapitres, tri, dates absentes, fusion des
  rang-ups, genres de défi, avatar de partenaire, exploits, résumé, pagination.
  `tests/compendium_page.test.js` (9) — couverture, `?view=`, déconnecté, 404, onglets,
  pagination clavier, rendu d'une entrée (nom i18n, date locale, pastilles, essais).
  `tests-e2e/compendium.spec.js` (4) — route `.htaccess` publique, 404/401, bouton du
  profil visité, ouverture du livre sans session.

### Angles morts

- Les rangs de Social Link antérieurs à `social_link_rankup_notifs` resteront sans date
  pour toujours (pas de reconstruction possible) — c'est assumé, et dit au joueur.
- Un joueur qui a plus de 300 défis terminés verra les 300 plus récents.
- `expert_modes` : « débloqué » est daté de la **première session Expert jouée**, pas du
  jour où la condition a été remplie (non historisé).

---

## 2026-09-12 — Lot « retours communauté » : 8 corrections + 2 refontes (branche `fix/community-feedback-batch`)

Huit remontées joueurs (Discord) plus deux demandes de Hamza, traitées en un commit par
point. Au passage, trois bugs découverts en creusant les remontées (dont deux qui
n'avaient rien à voir avec la plainte initiale). Le layout des pages de mode (barre de
saisie collante, compactage du haut de page) est **volontairement hors de ce lot** : PR
séparée à venir, pour être validé visuellement à part.

### Boutons ronds rendus ovales (retour n° 2, n° 5) — `css/global.css` §18

La règle tactile `button { min-height: 48px; padding: 12px 20px }` s'applique à **tout**
`<button>`, y compris ceux qui déclarent leur propre `width`/`height`. Mesuré au pixel :
pastilles de bordure 28×48, lecteur de musique de profil 34×48, ⚙ Settings 28×48. Sur la
page Amis, 👁 est un `<a>` (30 px) et ✕ un `<button>` (48 px) sur la même ligne — d'où
« pas la même taille ». Chaque bouton-icône pose `min-height: 0` dans sa propre règle
(14 règles, 8 fichiers), `.fr-btn` fixe 36 px pour `<a>` et `<button>`, `.fr-btn--icon`
fait un carré 36×36. **Piège documenté dans CLAUDE.md §7** — c'est un pattern, pas un cas.

Angle mort : tout nouveau bouton-icône retombe dedans s'il ne pose pas `min-height: 0`.

### Double « + » sur Ajouter (n° 5) — `lang/*.json` + `friends.js` + `profile-view.js`

`friends.js` préfixait `+ ` à une clé i18n qui contenait déjà `+ Add`. La clé
`friends.add_friend` redevient un libellé nu (c'est aussi le `title`), les deux appelants
ajoutent le signe.

### Poubelle invisible (n° 6) — `friends.css` + SVG inline

`opacity: 0.5`, 0.78 rem, pleine au survol seulement — donc jamais sur mobile. Zone
tactile 32 px, opacité de repos 0.85, et un SVG inline en `currentColor` à la place de
l'emoji 🗑 (trait fin monochrome sur Windows, pictogramme couleur ailleurs — aucun
contraste garanti).

### Stats Expert : chiffres décalés et fondus (n° 8) — `profile-page.js` / `.css`

Deux causes. L'en-tête « Won / Played · Rate · Best · Streak » était un seul `<span>` calé à
droite ; la clé i18n (même forme `a · b · c · d` dans les 6 langues) est découpée pour poser
un libellé par colonne. **Et chaque ligne est sa propre grille** (`display: grid` par
`.expert-stat-row`) : avec des colonnes `auto`, chaque ligne dimensionne les siennes selon
son contenu, l'en-tête ne pouvait pas tomber au-dessus des chiffres → colonnes en `fr`.
Couleur explicite sur les cellules (elles héritaient du corps de page → gris sur gris en
sombre), et `body.darkmode .mode-stats-header` écrasait le rouge du titre par spécificité.

### Iwatodai Dorm (n° 4) — `musicsMode/database/songs.js`

`opus: ["P3R"]` → `["P3"]`, image `P3.webp`. Convention du dataset = jeu d'origine (Burn My
Dread, Mass Destruction sont en P3 alors qu'ils sont aussi dans Reload), même si la piste
jouée est l'arrangement chanté de Reload. Pools quotidiens indexés par titre → inchangés.

### Bouton ⚙ sur les pages de mode + autoplay de profil réglable (n° 3)

`settings-modal.js` crée sa modale à la demande : le bouton ⚙ rejoint le bloc « Mode Sombre »
sur `index.html` et les 6 modes (style déplacé de `profile-page.css` vers
`settings-modal.css`, classe générique `.settings-btn`). **L'id utilisateur est résolu au
clic « Sauvegarder », pas à l'init** : sur ces pages le bouton est monté avant que
`initAuth()` ait posé `_currentUser`, le réglage ne serait jamais parti en cloud. Deux
réglages `profile_autoplay_own` / `profile_autoplay_others` (vrais par défaut) dans
`profiles.settings` (JSON libre, pas de migration), lus par `song-player.js` et
`profile-view.js` via `profileAutoplayAllowed()`. Tests : `tests/settings_modal.test.js`.

### Mode favori choisi + « Best Mode Overall » (n° 1) — migration **040**

Décision produit : mode favori = choix du joueur ; « Best Mode Overall » = **meilleur taux
de victoire, 3 parties minimum** (un 1/1 ne fait pas 100 %), égalité → le plus joué.
Colonne `profiles.favorite_mode` (**et non** une clé de `settings` : le mode favori se voit
sur le profil visité, `settings` est privé et jamais renvoyé par `public.php`). Validée
serveur (PATCH) contre la liste de `MODES`. Puces dans la carte Customization, sauvegarde
locale + cloud au clic ; `cloud-sync.js` redescend le choix, un `null` cloud efface, un
payload sans le champ (backend pas migré) laisse intact. Helper pur `bestModeOverall()`
(`profile-format.js`), partagé par la page et le profil visité. `stats.favoriteMode` (le
plus joué) reste calculé, plus affiché.

Au passage : les pastilles de bordure n'étaient rendues qu'après un pull cloud — un invité
voyait une rangée vide sous « Avatar Border ». Rendues au chargement et après déconnexion.

⚠️ **Release** : `040` ajoutée à la checklist `TODO.md`. Sans elle, `Unknown column
'favorite_mode'` sur **tout** GET `/api/user/:id` et `/api/user/public` — le profil ne
charge plus, pas seulement le mode favori. PHPUnit n'a pas tourné localement (pas de PHP
hors Docker) : à confirmer en CI.

### Portugais refusé par l'API (bug trouvé en chemin) — `api/lib/validation.php`

Trois listes locales de langues s'arrêtaient à `it` : un joueur en `pt` voyait **tout** son
PATCH profil refusé en 400 « Invalid lang » (avatar, bordure, badges compris — le client
envoie toujours la langue avec le reste), était inscrit en `en`, et l'admin ne pouvait pas
lui poser `pt`. Constante unique `PERSONADLE_SUPPORTED_LANGS`, test PHPUnit de parité avec
`lang/*.json`.

### « Défier un ami » toujours disponible (n° 7) — `js/gameCore.js` + 6 modes

Ce qui se passait : injecté uniquement à la **victoire fraîche**, dans la navigation de fin
de partie (cachée avant), et `return` si déjà présent. Absent avant la fin, après un Give
Up, et au rechargement — pour ce dernier, deux raisons : la victoire restaurée n'est plus
« fraîche », et quand le mode rejoue sa fin de partie au chargement, `initAuth()` n'a pas
encore posé `_currentUser`.

- `initChallengeButton(mode, pool, score)` monte le bouton à l'arrivée, après
  `window._authReady`, dans `.expert-toggle-zone` ; une fois la navigation révélée par
  `revealNextLink`, il y est **déplacé** entre précédent/suivant. Rappeler
  `showChallengeButton()` **met à jour** score et pool.
- Score « par » par mode tant que la partie n'est pas finie (`CHALLENGE_PAR` : classic 5,
  emoji 5, silhouette 4, alloutattack 4, personae 3, music 3) — le serveur exige un score
  > 0, la cible est tirée au hasard, rien n'oblige à avoir joué. Vrai score à la fin,
  victoire **ou abandon**. La modale affiche le score à battre.
- Le pool de cibles peut être une **fonction**, évaluée au clic (les filtres changent).

Tests : `tests/challenge_button_always.test.js` (placement, par, mise à jour, auth).

### Page Amis en 3 onglets + ⚔ Défier par ami (demande Hamza + n° 7)

Cinq blocs empilés → Amis (demandes + liste) / Boîte (messages & défis, état vide au lieu de
disparaître) / Trouver (recherche + joueurs, chargés à la **première ouverture** seulement).
Pastilles (demandes reçues, non-lus), dernier onglet mémorisé, `?tab=`. Ids de sections
inchangés.

⚔ par ami : un défi se joue dans un mode, avec le pool/filtres/dimension Expert **de la page
de ce mode**. Plutôt que recharger six datasets sur la page Amis, le bouton demande le mode
puis navigue vers la page du mode avec `?challenge=<friend_id>` ; `initChallengeButton()`
ouvre la modale sur cet ami (mis en avant, `scrollIntoView`), retire le paramètre de l'URL
(sinon un F5 rouvre). Le clic « Envoyer » reste au joueur. Tests : `tests/friends_tabs.test.js`.

### Marqueur True Confidant (demande Hamza) — deux bugs + un restyle

- `friends.html` ne chargeait **pas** `css/rank10-effect.css` : particules et label
  arrivaient sans style — un bloc de texte brut « ✦ True Confidant » sous l'avatar.
- La liste se re-rend à chaque poll (30 s) et **rejouait** burst + label à chaque fois.
  `applyRank10Effect(…, { celebrate })` : la liste ne célèbre qu'à la première apparition
  de chaque ami dans la session (`Set` par `friendship_id`).
- Restyle : anneau doré fixe (plus de halo pulsant), pastille « ✦ MAX » plate, label
  d'entrée en bulle qui s'efface (plus de machine à écrire).

### Masque Personae Expert insensible aux accents (remontée Minthe / Mio Natsukawa)

La fiche FR de Minthe s'ouvre sur « Minthé est une naïade… » : l'accent faisait rater le
masque « Minthe », la réponse se lisait dès la première ligne. Même fuite en allemand sur
Moros (« morös »). Un balayage des 6 langues n'en trouve pas d'autre — mais rien n'empêchait
la prochaine traduction d'en créer une. `maskTerms()` (`gameCore.js`) compare sur une copie
repliée (é → e) et remplace dans l'original ; NFC en amont pour qu'un accent décomposé garde
la même longueur. Effet voulu : une lettre accentuée est une lettre, plus une frontière de
mot. Le test de non-fuite (`tests/expertContent.test.js`) compare lui aussi sans
diacritiques — il échouait sur Minthe/fr et Moros/de avec l'ancien code.

### Second passage (même jour) — bug `{{count}}`, E2E des défis, six améliorations

- **« ❄️ Rallumer — 0 → {{count}} jours »** : le `tf()` de `profile-page.js` ne transmettait pas
  son 3ᵉ argument à `i18n.t()`, les placeholders restaient bruts. Seul appelant touché : le
  bouton Jack Frost sous les stats. Test de régression sur `tf()` (exporté `_tf`).
- **Profil visité ≠ profil propre pour la streak** : `public.php` n'exposait pas
  `global_streak` ; `profile-view.js` prenait le max des streaks par mode (un joueur voyait
  30 chez lui, ses amis 37 — et une correction admin de la globale restait invisible chez
  eux). Exposée, avec repli sur l'ancien calcul si le champ manque.
- **E2E `tests-e2e/challenge_flow.spec.js`** (8 étapes, navigateur réel) : bouton avant toute
  partie, score par, envoi, ⚔ depuis Amis avec présélection, acceptation depuis la Boîte et
  victoire (`beaten`), *calling card*, abandon depuis le bandeau (`read`), Give Up en défi
  (`expired`). Un seul contexte navigateur par joueur sur les étapes chaînées : le défi accepté
  vit dans `localStorage`. C'est la réponse à « comment tester les défis ».
- **Filtres d'un défi** : un joueur qui n'a jamais touché ses filtres n'a rien en localStorage
  (voulu : « absent = tout actif »), donc `_getActiveFilters()` envoyait `[]` et le
  destinataire gardait SES filtres — cible hors de son autocomplétion s'ils étaient
  restrictifs. `initFilterMenu()` enregistre la liste effective auprès de `gameCore`
  (`registerActiveFilters`), rien n'est persisté, le seeding des futurs opus est intact.
- **Défis Expert depuis l'onglet Amis** : ligne ⚡ remplie en asynchrone, limitée aux modes
  débloqués des deux côtés (`fetchExpertStatus()` + `friends.list({ expert_mode })` par mode
  débloqué chez soi, en parallèle, six au maximum, à l'ouverture du sélecteur).
- **Onglet 📊 Stats admin** : note — les streaks y sont *par mode*, la « Série actuelle » du
  joueur est `users.global_streak` (onglet 🔥). Le « ça ne change rien » était attendu.
- **`stats.favoriteMode` retiré** de `profileStats.js` / `cloud-sync.js` (plus lu depuis le
  mode favori choisi) ; le pull efface la clé d'un profil 2.1.
- **`tests-e2e/visual_layout.spec.js`** (opt-in `E2E_VISUAL=1`, hors CI) : 6 modes × 2
  viewports, cible du jour masquée (elle dépend de `anonPlayerId` et du jour). Références
  locales hors dépôt (`tests-e2e/__screenshots__/`, gitignoré) — le rendu des polices n'est
  pas portable Windows → Linux. À figer AVANT la PR layout, pour relire chaque diff pendant.

### Divers

- Liens GitHub `HamzaKarrouchi` → `CodeByHaamza` (12 fichiers ; l'ancien compte renvoie
  404, l'avatar du README était cassé).
- Doc cron Discord : horaire hPanel `5 0 * * *` (jamais une heure « convertie »).

---

## 2026-09-10 — fix(défi): les six façons dont un défi mourait en silence

Signalé en prod : « parfois pas d'animation, parfois pas de redirection donc on joue sans
rien, parfois redirigé mais le défi n'est pas lancé et on reste bloqué en défi en cours ».
Trois symptômes, six causes distinctes — toutes **muettes** : aucune erreur, aucun message,
rien en console. Elles se cumulaient, d'où l'impression rapportée que « seule l'animation
d'accueil marche ».

### 1. Un défi accepté un autre jour que celui de sa création naissait périmé

`activeChallenge.date` portait `challenge_date`, le jour où **l'expéditeur** a créé le défi.
Or **toutes** ses lectures le comparent à `parisDateKey()` d'aujourd'hui :

| Lecteur | Effet si la date ne colle pas |
|---|---|
| `initChallengeBanner()` | supprime la case, aucune bannière |
| `getActiveChallengeTarget()` | cible dédiée ignorée → on rejoue la cible du jour |
| `getPendingActiveChallenge()` | le défi n'existe plus pour le client |

Un défi envoyé à 23 h 55 et accepté le lendemain matin était donc mort-né : redirection OK,
mais aucun défi à l'arrivée, et un statut `accepted` que plus rien ne pouvait résoudre côté
serveur. Le joueur restait « en défi en cours », et l'expéditeur n'avait jamais de résultat.
Rien ne s'y opposait : la cible et le score voyagent dans le message, ils ne dépendent
d'aucune date.

**Correctif** — la case porte désormais le jour de **jeu** (`date: parisDateKey()`, posé à
l'acceptation) ; le jour d'origine est conservé en `challengeDate`, pour l'affichage et le
débogage. Les deux points d'acceptation sont corrigés (`js/challenge-notif.js`,
`profile/friends/friends.js`).

### 2. Redirection en absolu → 404 hors racine du domaine

`js/challenge-notif.js` construisait sa destination en absolu, avec un seul cas particulier
codé en dur : `pathname.startsWith("/personadle/")` → `/personadle`, sinon `""`. Le site
n'est à la racine du domaine qu'en prod. Partout ailleurs — sous-dossier, préproduction, ou
`…/personadle` **sans** slash final, qui ne déclenche même pas le test — accepter menait sur
une 404, avec un défi déjà passé `accepted`. Bloqué, et sans page où aller.

`js/bottomNav.js` calculait déjà ses liens en relatif et n'avait pas le problème.

**Correctif** — `siteRootPrefix()` / `modePageHref()` (`js/gameCore.js`), en relatif. Les
**trois** tables de pages de mode (challenge-notif en absolu, friends.js en `../../`,
bottomNav dans son coin) sont fusionnées en une seule (`MODE_PAGE_PATH`), et `bottomNav.js`
consomme le même helper pour qu'elles ne puissent plus diverger.

### 3. Cible introuvable → repli silencieux sur la cible du jour

Les 6 modes faisaient `pool.find(...)` et, quand la cible du défi restait introuvable,
retombaient **sans rien dire** sur la cible quotidienne — alors qu'`isChallengePlay()`
restait vrai. La partie ne comptait ni comme défi (mauvaise cible) ni comme partie
quotidienne (jamais enregistrée) : littéralement « on joue sans rien ». Cas réels : pool
Expert plus étroit (fiches de lore, paroles), dataset amputé depuis l'envoi, clé de
désambiguïsation inconnue du client.

**Correctif** — `resolveChallengeTarget(mode, pool, keyOf)` (`js/gameCore.js`) résout contre
le pool **réellement jouable de la page** (dimension comprise) et, en cas d'échec, purge le
défi (`dropUnplayableChallenge()`) : case libérée, filtres rendus, état de mode nettoyé,
statut serveur repassé à `read`, toast au joueur. Personae garde sa résolution maison
(`challengeKey()` désambiguïse les homonymes) mais applique la même règle de sortie, et
vérifie en plus la présence d'une fiche de lore en Expert.

### 4. Aucune sortie quand la bannière ne s'affiche pas

Un défi `accepted` n'affichait **aucun bouton** sur la page Amis. La seule sortie était le
bouton « Abandonner » de la bannière, qui exige la bonne page **et** la bonne dimension
**et** une case locale encore valable. Dès que cette case disparaissait (autre appareil,
cache vidé, acceptation d'un jour précédent, cible injouable), le joueur restait bloqué sans
plus rien pour y toucher — et son ami n'avait jamais de résultat.

**Correctif** — boutons **« Reprendre »** (redirige vers la page du défi) et
**« Abandonner »** sur chaque défi reçu en statut `accepted` (`profile/friends/friends.js`).
Adossés au message lui-même, ils fonctionnent donc **sans** état local. L'abandon attend la
réponse serveur avant de purger le local (piège `performRecovery()`, CLAUDE.md §7) et ne
défait l'état local que s'il correspond bien à ce défi-là (sinon il effacerait un autre défi
en cours de la même dimension).

### 5. Une notification manquée était perdue pour toujours

`js/notifications.js` marquait les défis « vus » en `localStorage` **avant** de les afficher.
Une notification que le joueur n'a jamais vue — navigation dans la seconde, plein écran
par-dessus — ne revenait donc jamais, alors que le message restait `unread` côté serveur.
C'est la cause n°1 des « parfois pas d'animation ».

**Correctif** — deux niveaux : un `Set` en mémoire dédoublonne les sondages de la page
courante, et le « vu » persistant n'est posé que quand le joueur **ferme réellement** la
notification (accepter / refuser / croix), via `setChallengeNotifDismissHandler()`. Les défis
encore en file au moment d'une fermeture par la croix ne sont plus jetés en silence : ils
repartent au sondage suivant. L'acceptation, elle, n'a pas besoin du drapeau : le statut
serveur passe `accepted`, et le sondage ne remonte que les `unread`.

### 6. L'écran de résultat éjectait le joueur de la page qu'il consultait

`showChallengeResult()` posait un `setTimeout(goHome, 11 s)` **inconditionnel**. Sur la
variante « notification » (l'expéditeur apprend que son défi a été relevé), il s'appliquait
aussi : le joueur était renvoyé à l'accueil depuis n'importe quelle page — page Amis
comprise, où il était peut-être en train d'accepter un défi — et l'overlay plein écran
masquait les boutons pendant ces 11 secondes. Il détruisait au passage toute notification de
défi affichée en même temps, définitivement perdue (cause n°5).

**Correctif** — `goHomeOnClose` : vrai en fin de partie (la page de jeu n'a plus rien à
montrer), faux pour la notification, qui se contente de se fermer. Et `notifications.js`
n'empile plus une notification de défi par-dessus un `#cr-overlay` visible : il repasse au
sondage suivant.

### Corrections annexes du même lot

- **Double-clic sur « Accepter »** : deux allers-retours réseau séparent le clic de la
  redirection ; un joueur qui recliquait parce que « rien ne se passe » lançait deux
  acceptations et deux gains d'XP. Boutons verrouillés pendant l'appel, rouverts sur échec
  pour laisser refuser.
- **« Finish your current challenge first » nomme désormais le mode bloquant** — le défi en
  cours peut vivre sur n'importe laquelle des 6 pages, et sa bannière ne s'affiche que sur
  la bonne.
- **`checkChallengeCompletion()` applique enfin la garde de date** : c'était le seul chemin
  sans. Une case restée depuis la veille était consommée par la partie du jour, et
  l'expéditeur recevait un résultat pour une partie qui n'avait rien à voir avec son défi.
- **Parité des deux chemins d'acceptation** : la page Amis n'avait ni la garde « Expert
  débloqué » ni le barème d'XP Expert (25/50) que la notification appliquait déjà. Le même
  défi était donc acceptable ou non selon l'endroit d'où on cliquait.
- **Une seule table `MODE_STATE_KEYS`** (`js/gameCore.js`) : `challenge-notif.js` et
  `friends.js` en gardaient chacun une copie manuscrite, pour un même geste sur les deux
  seuls chemins d'acceptation du produit.
- **Un seul geste de libération** — `releaseActiveChallenge()` — partagé par la fin de
  partie, l'abandon et la purge d'un défi injouable. Les trois sorties laissaient le mode
  dans des états légèrement différents. `initChallengeBanner()` s'en sert aussi pour purger
  un défi périmé : son `removeItem` nu laissait les filtres du défi installés et, pour un
  défi à cible dédiée, la cible d'hier persistée dans l'état du mode.

### Nouveau : panneau admin — onglets « Défis » et « Streak »

Un défi vit dans **deux** états (ligne `messages` + case `localStorage`). Quand ils divergent
au-delà de ce que la page Amis rattrape, il fallait ouvrir phpMyAdmin.

- `api/admin/user_challenges.php` — `GET` liste les 100 derniers défis d'un joueur (les deux
  sens) ; `PATCH` force le statut (**relancer** = `unread`, **annuler** = `read`) ; `DELETE`
  supprime. Chaque action est bornée à un défi qui concerne bien l'utilisateur de l'URL —
  l'id de message vient de la même URL, rien n'empêcherait sinon de piloter n'importe quelle
  ligne `messages` depuis la fiche d'un joueur. Tout est journalisé (`admin_audit_log`).
  Pas d'XP Social Link sur un `beaten` posé à la main : une réparation n'est pas une partie.
- `api/admin/user_streak.php` — `GET` l'état complet (streak globale, record, dernier jour
  validé, cooldown Jack Frost restant, jours réellement joués, streaks par mode) ; `PATCH`
  avec trois actions :
  - `set` — écrit les valeurs telles quelles. **Seul chemin qui autorise une baisse** :
    `recover` ne peut, par construction, que remonter.
  - `recover` — Jack Frost **illimité** : ni cooldown de 60 jours, ni plafond « jours
    réellement joués ». Ces deux gardes protègent d'un joueur qui s'auto-attribue une
    streak, pas d'un admin qui répare un compte. Ne consomme pas la récupération du joueur
    (`streak_recovered_at` inchangé) et ne fait jamais régresser une streak de mode
    (`WHERE streak < ?`).
  - `reset_cooldown` — efface `streak_recovered_at` : le joueur peut réutiliser Jack Frost
    depuis le jeu, immédiatement.
- L'écriture de la restauration est extraite en `personadle_apply_streak_recovery()`
  (`api/lib/streak_recovery.php`), partagée avec le chemin joueur : ce sont les
  **vérifications** qui diffèrent entre admin et joueur, pas l'écriture. La dupliquer aurait
  fait deux `UPDATE` à tenir alignés.
- Front : `admin/challenges.js`, `admin/streak.js`, onglets `⚔ Défis` et `🔥 Streak`,
  `RewriteRule` correspondantes dans `api/admin/.htaccess` (CLAUDE.md §4), pastilles d'état
  et champ `input[type=date]` stylés dans `admin/admin.css`.

### Angles morts connus

- **Non vérifié en bout de chaîne** : ce lot n'a pas pu être rejoué contre la stack Docker
  (aucun démon Docker dans l'environnement utilisé), donc ni E2E Playwright ni PHPUnit
  (`vendor/` absent). Les 6 causes sont couvertes par des tests Vitest
  (`tests/challengeRecovery.test.js`, `tests/challengeAccept.test.js`,
  `tests/challengeResult.test.js`), mais les **deux endpoints admin n'ont été validés que
  par `php -l`** — à exercer manuellement avant release.
- `dropUnplayableChallenge()` libère le local **avant** confirmation serveur (contrairement
  à l'abandon). Assumé : le local est déjà inutilisable, le garder ne rendrait pas le défi
  jouable mais continuerait de bloquer l'acceptation d'un autre et de faire passer chaque
  partie du mode pour un défi. Si le `PATCH` échoue, le défi reste `accepted` en base —
  c'est précisément ce que le bouton « Abandonner » de la page Amis rattrape.
- `loadMessages()` (page Amis) ne lit que les 30 messages les plus récents, **tous types
  confondus** : un défi ancien peut sortir de la fenêtre et redevenir inatteignable depuis
  le jeu. Le panneau admin en voit 100. Une pagination des messages reste à faire.
- Le serveur n'expire jamais un défi `unread` : on peut se voir proposer un défi vieux de
  plusieurs jours. C'est désormais **jouable** (cause n°1), donc ce n'est plus un bug — mais
  une durée de vie explicite reste à décider côté produit.

---

## 2026-09-09 — feat(cron): annonce quotidienne du PersonaDLE sur Discord

Le Discord venait d'être refondu, mais rien n'annonçait le PersonaDLE du jour : le salon
`#🎲┃daily-personadle` restait vide tant qu'un joueur n'y postait pas de lui-même. Ce cron
poste l'annonce à 00:05 heure de Paris, juste après le reset quotidien.

Huit voix tournent (Morgana, Teddie, Elizabeth, Margaret, Theodore, Lavenza, Merope,
Philemon), six phrases chacune, soit 48 messages distincts. Le casting n'est pas arbitraire :
ce sont les personnages qui brisent le quatrième mur dans les jeux — Velvet Room et
mascottes. Les autres sonneraient faux à s'adresser directement au joueur.

Choix d'un **webhook** plutôt que d'un bot : c'est une simple URL POST, donc aucun process à
héberger, aucun token de bot à faire tourner. Et il accepte `username` et `avatar_url` à
chaque message, ce qui suffit à faire parler huit personnages depuis un seul webhook. La
contrepartie est que cette URL est un secret porteur — quiconque l'a peut poster sous ce
nom — d'où les garde-fous ci-dessous.

### Détails techniques

- `api/cron/discord-daily.php` (nouveau) — même moule que les 3 crons existants :
  `require_once bootstrap.php`, `requireCronSecret()`, `jsonSuccess()` / `jsonError()`,
  timezone `Europe/Paris`, plus les champs `elapsed_ms` / `ran_at`.
- **Rotation** : `jour_de_l_année % 8` choisit la voix, `intdiv(jour, 8) % 6` choisit sa
  phrase. La voix revient tous les 8 jours en disant la suivante ; cycle complet 48 jours.
- ⚠️ **Le nombre de voix ne doit jamais être un multiple de 7.** Avec 7 pile, la formule fige
  une voix par jour de la semaine : mercredi serait Elizabeth à vie, et le joueur qui ne
  passe que le lundi n'en verrait jamais qu'une seule. Vérifié par simulation avant/après :
  à 7 voix, 8 mercredis consécutifs donnaient 8 fois le même personnage ; à 8 voix, ils en
  donnent 8 différents. L'avertissement est porté en commentaire dans le fichier.
- **Avatars** : Discord télécharge l'image lui-même, elle doit donc être publiquement servie
  — un chemin local ne lui sert à rien. Les 8 URL ont été vérifiées en 200 avant déploiement.
  Merope et Philemon n'ayant pas d'avatar dans `img/avatar/`, on prend leur portrait de jeu
  dans `database/portraits/`.
- Morgana pointe sur `Morgana.jpg` et non `Morgana.png` : c'est le fichier retenu dans
  `personadle-discord/avatars/` (md5 identique), et il pèse 93 Ko contre 886 Ko.
- **Le secret ne peut pas fuiter, par trois chemins distincts :**
  1. l'URL vit dans `api/config.php` (gitignoré) ; `api/config.example.php` ne porte que la
     clé vide et l'explication ;
  2. sa forme est validée par regex *avant* l'appel curl — une config erronée ne peut pas
     faire poster le contenu ailleurs que chez Discord, et l'absence garantie de query
     string rend sûr l'ajout de `?wait=true` ;
  3. `_discordRedact()` caviarde l'URL complète *et* le token seul dans tout ce qui part en
     log. Sans ce filet, un simple incident réseau écrirait le secret dans `error_log()`
     **et** dans la table `error_log`, relue par `api/admin/error_logs.php` — donc lisible
     depuis l'admin.
- La réponse HTTP d'erreur ne contient que le code Discord, jamais le message curl ni le
  corps de réponse : le diagnostic va en log, caviardé.
- `?wait=true` fait répondre Discord avec le message créé (200) au lieu d'un 204 muet. Sans
  ça, un webhook révoqué serait indiscernable d'un envoi réussi — le salon resterait vide
  sans que le cron ne signale quoi que ce soit.
- `curl_init()` sans argument puis `CURLOPT_URL` : avec l'URL en paramètre, `curl_init()`
  peut renvoyer `false`, et `curl_setopt_array(false, …)` est une `TypeError` fatale en PHP 8.
- `CURLOPT_CONNECTTIMEOUT` à 5 s en plus du `CURLOPT_TIMEOUT` à 15 s : un cron qui pend sur
  un TCP mort n'a aucun intérêt.
- `docs/hostinger-cron-setup.md` — entrée 4, fréquence et prérequis `DISCORD_DAILY_WEBHOOK`.
- `phpstan.neon` — `DISCORD_DAILY_WEBHOOK` ajoutée à `dynamicConstantNames`, comme
  `TRUSTED_PROXIES` avant elle. `config.example.php` sert de `bootstrapFiles` : sans cette
  ligne, PHPStan replie la constante sur `''`, juge la garde toujours vraie et déclare mort
  tout le code qui suit — la CI échouait sur ce seul motif.

### Angles morts connus

- **Le serveur est en UTC, pas en heure de Paris**, et `crontab` est absent de l'hébergement :
  la tâche se crée dans hPanel, dont le fuseau n'est pas vérifiable en SSH. `5 0 * * *` est
  juste dans les deux cas — 00:05 si hPanel raisonne en heure de Paris, 01:05 l'hiver /
  02:05 l'été s'il raisonne en UTC — donc toujours *après* le reset, jamais avant. La
  conversion « maligne » en `5 22 * * *` donnerait 00:05 l'été mais 23:05 l'hiver, soit
  avant le reset : à ne pas faire. Le script forçant `Europe/Paris` en interne, la date
  annoncée et la voix choisie restent justes quoi qu'il arrive ; seul l'horaire de
  publication glisse.
- L'annonce est postée sans vérifier que la cible du jour a bien tourné côté jeu : le cron ne
  lit ni `daily_pools.json` ni la base. C'est volontaire — le message ne divulgue aucune
  cible, il annonce seulement que la journée est ouverte — mais s'il devait un jour citer le
  mode ou un indice, il faudrait le brancher sur `api/lib/daily_target.php`.
- Le fichier déployé à la main sur le serveur est **non suivi par git** dans le webroot, qui
  est un checkout. À la release qui portera cette branche jusqu'à `main`, il faudra supprimer
  la copie manuelle avant le `git pull`, sous peine de le voir échouer sur un fichier non
  suivi à écraser.

## 2026-09-09 — Règle : aucune signature d'outil dans l'historique

Les trois commits du lot précédent portaient des *trailers* de signature d'outil
(`Co-Authored-By`, lien de session) et le corps de la PR #108 finissait par une mention
« generated with ». Ajoutés automatiquement par l'outillage, jamais décidés. L'historique
du dépôt est celui de l'équipe : le crédit va aux humains qui décident.

### Détails techniques

- `CLAUDE.md` §4 : nouvelle sous-section « Messages de commit et corps de PR — RÈGLE
  ABSOLUE : aucune signature d'outil ». Couvre messages de commit, titres et corps de PR,
  commentaires de code et entrées de changelog. Seule exception : une demande explicite,
  formulée pour le lot en cours.
- Le point important est que ces signatures sont ajoutées **par défaut** par l'outillage :
  la consigne est de les **retirer activement** avant de pousser (`git log -1 --format=%B`),
  pas seulement de « ne pas les écrire ».
- Les commits déjà mergés dans `develop` les gardent : réécrire un historique partagé
  coûterait plus cher que le bénéfice cosmétique. La règle vaut pour la suite.

---

## 2026-09-09 — CLAUDE.md : règle de branches explicitée

`main` = prod (pull automatique Hostinger à chaque push). Le flux `feature/*` → `develop`
→ `main` n'était écrit nulle part dans `CLAUDE.md` : il n'existait que dans les commentaires
de `.github/workflows/pr-base-guard.yml`, donc invisible pour qui lit la doc avant de coder.

### Détails techniques

- `CLAUDE.md` §4 : nouvelle sous-section « Branches — RÈGLE ABSOLUE ». Toute PR de travail
  vise `develop` ; le **seul** merge légitime sur `main` est `develop` → `main` au moment
  de sortir une version, et c'est un acte de release décidé explicitement.
- Le garde-fou CI (« PR base guard », exceptions `develop`/`hotfix/*`/`dependabot/*`) y est
  décrit comme un **filet**, pas comme la règle : il ne voit que les PR déjà ouvertes sur
  `main` et ne dit rien du reste.

---

## 2026-09-09 — ouverture du dossier v2.2

La v2.1 est livrée : son dossier ne reçoit plus que d'éventuels correctifs de la 2.1
elle-même. Tout ce qui suit part donc dans `PersonaDLE 2.2/`.

### Détails techniques

- `PersonaDLE 2.2/DEV_CHANGELOG.md` (ce fichier) + `PersonaDLE 2.2/PersonaDLE_Update.html`
  (squelette bilingue EN/FR repris de la 2.1 : même thème, même barre de progression, même
  bouton retour — il ne reste qu'à le remplir).
- `.gitignore` : bloc de 3 lignes pour `PersonaDLE 2.2` (`!dossier`, `dossier/*`,
  `!dossier/fichier`). **Sans lui, tout fichier ajouté au dossier serait ignoré en
  silence** — c'est exactement le piège documenté dans `.gitignore` depuis le 2026-08-29.
  Vérifié après coup : `git check-ignore -v` désigne bien une règle de ré-inclusion, et
  `git status -uall` voit les deux fichiers.
- `CLAUDE.md` §9 mise à jour (la 2.2 devient la version en cours de développement), avec
  la marche à suivre pour la 2.3 — le `.gitignore` y est désormais mentionné, il manquait
  à la consigne d'ouverture de la 2.2.
- L'entrée `version-item` du modal « Nouveautés » de `index.html` sera à ajouter **à la
  sortie** de la 2.2, pas maintenant : elle serait visible par les joueurs.

---

## 2026-09-09 — sécurité : le rate limiting se laissait contourner par un simple header

Contribution externe (PR #107, @Picsou06) + durcissement.

Les 5 endpoints protégés par IP (`auth/login`, `auth/register`, `auth/request-reset`,
`auth/reset-password`, `user/search`) construisaient leur clé `rate_limits` comme ceci :

```php
$firstIp = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]);
$rlIp    = filter_var($firstIp, FILTER_VALIDATE_IP) ? $firstIp : ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
```

Le commentaire au-dessus affirmait que valider le format « empêche le spoofing ». **C'est
faux** : `FILTER_VALIDATE_IP` valide la *forme*, jamais la *provenance*. Le header est
envoyé par le client, et rien devant Apache ne l'écrase. Donc :

```
X-Forwarded-For: 1.2.3.<compteur>
```

→ une clé neuve à chaque requête → **plus aucune limite** sur :

| Endpoint | Quota annoncé | Ce qui redevenait illimité |
|---|---|---|
| `auth/login` | 5 / 15 min | bruteforce de mot de passe |
| `auth/reset-password` | 10 / 15 min | bruteforce du token de reset |
| `auth/request-reset` | 3 / 15 min | spam d'emails depuis notre domaine (réputation d'envoi) |
| `auth/register` | 5 / 15 min | création de comptes en masse |
| `user/search` | 30 / 5 min | énumération des pseudos / friend_codes |

### Détails techniques

- Les 5 blocs dupliqués sont remplacés par `getClientIp()` (`api/bootstrap.php`), qui
  délègue à `personadle_client_ip()` — nouveau fichier `api/lib/client_ip.php`, logique
  pure, sans BDD, testable (même motif que `lib/authz.php`, `lib/format.php`).
- **X-Forwarded-For n'est plus lu par défaut.** Il ne l'est que si `REMOTE_ADDR` est
  lui-même listé dans `TRUSTED_PROXIES` (`api/config.php`, **vide par défaut**), et la
  chaîne est alors parcourue de **droite à gauche** : chaque proxy traversé ajoute son
  pair à la fin, donc le dernier hop non approuvé est le seul que le client ne peut pas
  écrire. Tout ce qu'il a inventé lui-même se retrouve à gauche et est ignoré.
  `personadle_ip_in_range()` accepte IP exacte et CIDR, IPv4 et IPv6 (comparaison
  binaire `inet_pton`, pas de mélange de familles).
- Repli sur `'unknown'` (et non `'127.0.0.1'`) si `REMOTE_ADDR` est absent ou illisible :
  seau partagé assumé, mais pas une IP qui ressemble à une vraie dans la table.
- `personadle_normalize_trusted_proxies()` tolère une constante absente, écrite en chaîne
  simple ou remplie d'entrées vides — `api/config.php` est édité à la main sur le serveur
  et n'est pas versionné, un `TypeError` y transformerait `/api/auth/login` en 500.
- `tests/php/ClientIpTest.php` — 26 cas. Le premier (`testIgnoresSpoofedForwardedFor…`)
  est le test de non-régression : il repasse rouge si quelqu'un refait confiance au
  header sans passer par `TRUSTED_PROXIES`.
- `api/README.md` et `tests/README.md` mis à jour ; chiffres de doc via `npm run docs:fix`.
- `phpstan.neon` : `TRUSTED_PROXIES` ajoutée aux `dynamicConstantNames` (sa valeur dépend
  de l'environnement, comme `APP_ENV`).

### ⚠️ Angle mort à lever avant la mise en prod

`curl -sI https://personadle.net` renvoie `server: hcdn` — **le CDN Hostinger répond
devant le site**. Si ce CDN termine réellement la connexion PHP, `REMOTE_ADDR` vaut son
IP pour *tous* les visiteurs, et keyer dessus ferait partager **un seul seau à tout le
monde** : 5 connexions / 15 min pour le site entier, soit un auto-DoS du login. À
trancher empiriquement, côté SSH, avant de déployer :

```bash
ssh hostinger-personadle "tail -50 ~/logs/*access*"   # 1ʳᵉ colonne = REMOTE_ADDR
```

- IPs variées = celles des vrais visiteurs → rien à faire, `TRUSTED_PROXIES` reste vide.
- Une poignée d'IPs identiques pour tout le monde → y mettre ces IPs/CIDR, le code
  déroule alors X-Forwarded-For correctement (chemin déjà couvert par les tests).

Documenté aussi dans `DEPLOY.md` § Dépannage (ligne « 429 alors qu'un seul essai ») et
dans `api/config.example.php`.

### Non traité ici (PR #107 annonçait un audit non commité)

Le message de commit de la PR mentionne « docs: add security audit of trust boundaries in
api/ » et 3 autres trouvailles — **aucun fichier de doc n'est présent dans le diff** (le
4ᵉ commit de la PR annule une modif de `.gitignore` faite par le 1ᵉʳ : la doc s'est très
probablement fait avaler, cf. le piège documenté dans `.gitignore` lui-même). Les 3
points cités, à traiter séparément :

1. `/api/sessions` — cible attendue seulement **journalisée**, pas rejetée (cohérent avec
   la « phase 1, détection » assumée dans CLAUDE.md §3 — à confirmer comme choix).
2. Drift possible sur la contrainte unique de `game_sessions` entre migrations et prod
   (`SELECT version FROM schema_migrations` = seule source fiable).
3. Image silhouette lisible dans l'onglet Network — à recouper avec `js/silhouette_mask.js`
   (le masque est déjà cuit dans les pixels ; reste à vérifier ce qui transite).
