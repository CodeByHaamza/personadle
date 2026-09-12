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
