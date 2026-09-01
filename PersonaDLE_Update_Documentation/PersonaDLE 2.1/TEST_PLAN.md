# PersonaDLE v2.1 — Plan de Test QA

> **Document destiné à Hamza — test solo avant déploiement.**
> Contrairement au plan de la 2.0 (rédigé pour Léo et Damien), celui-ci suppose un seul
> testeur. Les points qui nécessitent « deux comptes » (défis, amis) utilisent donc un
> **compte secondaire en navigation privée** — voir §2.2.
>
> Ce document ne re-teste **pas** toute la 2.0 (déjà validée). Il couvre ce qui est
> **nouveau ou modifié en 2.1** : Mode Expert (porte d'entrée + gameplay + déblocage
> admin), contenu ajouté, système de défis, classement, et métadonnées de partage.

---

## 0 — Avant de commencer

### 0.1 Ce que couvre ce document

Depuis `develop`, la 2.1 a livré : les 6 Modes Expert (déblocage par condition, gameplay,
animation de déblocage), le déblocage manuel par un admin, 3 musiques + un skin AOA,
la réparation des défis bloqués + leur extension au Mode Expert, la règle « un seul défi
vivant par expéditeur », la correction du classement (série et ratio), les métadonnées
de partage (Discord/X) sur les 6 pages de mode, puis le dernier lot de contenu
(8 silhouettes P4AU, la musique « Memories of You », le badge *A Gentle Reprieve*) et la
traduction des noms de badges.

### 0.2 Ce que vous ne devez PAS faire

- ❌ Ne pas corriger de code pendant les tests — noter le problème (§8) et continuer.
- ❌ Ne pas jouer une partie Mode Expert avant d'avoir rempli sa condition de déblocage
  (ça n'est de toute façon pas possible — le bouton est verrouillé — mais évitez de
  contourner en tapant `?expert=1` sur un mode non débloqué juste pour voir : c'est
  justement testé au §2.

### 0.3 Piège connu (déjà en base) : ne pas jouer la 037 deux fois par erreur

Les migrations 029→038 doivent avoir été jouées sur votre base **locale** avant de
commencer (elles le sont déjà si vous suivez `develop` normalement via `make up`, qui
importe le schéma à jour). Vérifier :

```bash
docker compose exec db mariadb -u root -prootpassword personadle_db \
  -e "SHOW COLUMNS FROM messages LIKE 'challenge_is_expert';"
```

- [ ] La colonne `challenge_is_expert` existe → migration 037 appliquée, vous pouvez continuer.
  Si elle n'existe pas : `make down && make up` (le schéma se réimporte à jour), ou
  rejouer les migrations manquantes une par une depuis `sql/migrations/`.

---

## 1 — Setup

```bash
git checkout develop
git pull origin develop
make up
```

- [ ] `make up` démarre sans erreur, [http://localhost:8080](http://localhost:8080) répond

```bash
make check
```

- [ ] `lint` + `data` + `i18n` + tests JS + tests PHP passent tous — **0 failed**. Les
  chiffres exacts (nombre de tests) ne sont pas figés, ils montent à chaque ajout — seul
  compte l'absence d'échec.

```bash
npx playwright install chromium   # une seule fois si pas déjà fait
npm run test:e2e
```

- [ ] Les specs `expert-*.spec.js` (6 fichiers, un par mode) passent
- [ ] `expert-gate.spec.js` passe (redirection `?expert=1` pour un visiteur non débloqué)
- [ ] `challenge-supersede.spec.js` passe (règle « un seul défi vivant »)

### 1.2 — Deuxième compte (navigation privée)

Comme pour la 2.0 (§2.2 de son plan) : ouvrez une fenêtre de navigation privée
(`Ctrl+Shift+N`), créez-y un 2ème compte. Il sert d'« ami » pour tester les défis Expert
(§5) sans dépendre d'un autre testeur. Ajoutez-le en ami depuis votre compte principal.

---

## 2 — Porte d'entrée du Mode Expert (les 6 conditions)

> Le bouton **⚡ Expert mode** est visible sur les 6 pages de mode, mais grisé tant que
> la condition n'est pas remplie. Testez au moins 2 modes en entier (un par type de
> condition) plutôt que les 6 — le mécanisme est le même partout.

### 2.1 Bouton verrouillé (avant déblocage)

👉 N'importe quel mode où vous n'avez pas encore la condition, ex.
[silhouette](http://localhost:8080/silhouetteMode/silhouette.html)

- [ ] Le bouton ⚡ est visible mais grisé (`🔒 Expert mode`), non cliquable normalement
- [ ] Survoler ou taper sur le bouton affiche une infobulle avec l'objectif et une barre
  de progression (ex. « 7 / 10 victoires en 4 essais ou moins »)
- [ ] Taper l'URL à la main avec `?expert=1` (ex.
  `http://localhost:8080/silhouetteMode/silhouette.html?expert=1`) → vous êtes renvoyé
  automatiquement vers la page normale, **pas** vers l'Expert

### 2.2 Débloquer un mode « victoire rapide » (Classique ou Silhouette)

> Condition : 10 victoires en 4 essais ou moins **chacune**.

1. Jouer et gagner en ≤ 4 essais, 10 fois de suite (peu importe si vous perdez ou
   abandonnez d'autres parties entre-temps — seules les victoires rapides comptent,
   cumulées à vie sur le compte)

- [ ] Une fois la 10ème victoire rapide validée, une **animation de cadenas qui explose**
  se déclenche **au prochain chargement d'une page de mode** (pas instantanément pendant
  la partie — voir angle mort connu, §2.6)
- [ ] L'animation montre le nom du mode débloqué et se ferme seule après quelques secondes
- [ ] Le bouton ⚡ est maintenant actif, cliquable, sans infobulle de verrou

### 2.3 Débloquer le mode « volume sur un jour » (Émoji)

> Condition : 10 victoires sur une seule journée. Pas la peine d'attendre 10 jours —
> il faut 10 victoires **le même jour**.

1. Gagner 10 parties d'Émoji dans la même session (rejouer immédiatement après chaque victoire)

- [ ] Après la 10ème, même comportement qu'en §2.2 (animation au prochain chargement)

### 2.4 Débloquer un mode « régularité » (AOA, Personae ou Musique)

> Condition : 15 victoires **parfaites** (1er essai) **d'affilée**. Une seule partie non
> parfaite (2+ essais, ou abandon) remet le compteur à zéro.

1. Choisir un des 3 modes, enchaîner 15 victoires en 1 seul essai chacune, sans en rater
   aucune entre-temps

- [ ] Le compteur de progression dans l'infobulle avance bien à chaque victoire parfaite
- [ ] Si vous ratez volontairement une partie avant d'arriver à 15 (2 essais ou give-up)
  → la progression retombe à 0 (revérifier l'infobulle)
- [ ] Une fois les 15 d'affilée obtenues → animation de déblocage

### 2.5 Un mode débloqué n'en débloque pas un autre

- [ ] Une fois un mode débloqué (ex. Classique), un mode **non encore débloqué**
  (ex. Personae) reste grisé — pas de déblocage croisé

### 2.6 Angle mort connu (ne pas signaler comme bug)

L'animation se déclenche **au chargement d'une page de mode**, pas à l'instant exact où
la dernière partie est validée. Si vous gagnez votre 10ème victoire rapide puis fermez
l'onglet sans naviguer ailleurs, vous verrez l'animation à votre prochaine visite — c'est
documenté, pas un défaut.

---

## 3 — Gameplay en Mode Expert

> Une fois au moins un mode débloqué (§2), jouez-y une partie complète en Expert.

- [ ] La partie Expert a son **propre** état (essais, cible) indépendant du mode normal —
  vérifiable en jouant un coup en normal, puis en allant en Expert : le compteur
  d'essais Expert repart à 0
- [ ] L'indice donné est bien réduit par rapport au mode normal (cf. `rulesExpert`
  affiché sur la page — une seule citation/silhouette/etc., pas de grille comparative)
- [ ] Gagner une partie Expert fonctionne normalement (confettis, son)
- [ ] Revenir en mode normal (bouton « ← Normal mode ») et vérifier que la partie normale
  du jour n'a pas été affectée par la partie Expert

---

## 4 — Déblocage manuel par un admin

👉 [http://localhost:8080/admin/](http://localhost:8080/admin/) — nécessite un compte admin
(voir §2.3 du plan 2.0 pour la procédure `UPDATE users SET is_admin = 1`)

1. Rechercher le **compte secondaire** (créé en §1.2, qui n'a probablement aucun mode
   Expert débloqué) dans la liste, ouvrir sa fiche
2. Aller sur l'onglet **⚡ Expert**

- [ ] Les 6 modes s'affichent avec un état clair : `🔒 Verrouillé`, `🎁 Accordé`, ou
  `✅ Gagné en jouant`
- [ ] Pour un mode `🔒 Verrouillé` du compte secondaire, cliquer **Débloquer**
- [ ] L'état passe à `🎁 Accordé`, et un bouton **Retirer le don** apparaît à la place
- [ ] Se reconnecter avec le compte secondaire (ou recharger sa session) → le mode
  accordé est bien jouable en Expert, **sans** avoir rempli la condition
- [ ] La progression affichée pour ce joueur reste `0 / X` (le don n'invente pas de
  fausses victoires) — revérifier dans son infobulle si vous retirez le don ensuite
- [ ] Cliquer **Retirer le don** → confirmation demandée, puis le mode repasse
  `🔒 Verrouillé` (sauf s'il avait entre-temps rempli la vraie condition — dans ce cas
  un message l'indique explicitement plutôt que de fermer silencieusement l'accès)
- [ ] Pour un mode déjà `✅ Gagné en jouant` (compte principal, un mode débloqué en §2) :
  **aucun bouton de retrait n'est proposé** — un accès mérité ne peut pas être repris

---

## 5 — Défis (bloqués, abandon, Mode Expert)

> Nécessite les 2 comptes amis (§1.2).

### 5.1 Bouton « Abandonner »

1. Depuis le compte principal, envoyer un défi Classique au compte secondaire (bouton
   « Défier un ami » après une partie)
2. Avec le compte secondaire, **accepter** le défi mais ne pas le terminer

- [ ] Un bandeau de défi actif s'affiche en haut de la page du mode, avec un bouton
  **✕** (masquer) et un bouton distinct **Abandonner le défi**
- [ ] Cliquer ✕ → le bandeau disparaît mais le défi reste actif (le rouvrir sur une
  autre page du même mode le refait réapparaître)
- [ ] Cliquer **Abandonner** → confirmation demandée, puis le défi est bien libéré :
  vous pouvez immédiatement en accepter un nouveau du même ami sans message de blocage

### 5.2 Un seul défi vivant par expéditeur

1. Depuis le compte principal, envoyer un défi au compte secondaire (mode au choix,
   ne pas le faire accepter)
2. Envoyer un **second** défi le même jour, même ami, mode différent, **sans avoir
   accepté le premier**

- [ ] Le compte secondaire ne voit plus que le **second** défi dans ses notifications —
  le premier a disparu de la liste des défis en attente (remplacé, pas empilé)
3. Répéter, mais cette fois **accepter** le premier défi avant que le compte principal
   n'en envoie un second

- [ ] Le second défi est refusé par le serveur (message « un défi existe déjà
  aujourd'hui pour cet ami ») — un défi **accepté** n'est jamais remplacé silencieusement

### 5.3 Défis en Mode Expert

> Nécessite qu'au moins un mode Expert soit débloqué sur le compte principal (§2 ou §4).

1. Sur une page en Mode Expert (`?expert=1`), envoyer un défi à l'ami (le bouton
   « Défier un ami » doit être visible ici aussi, pas seulement en normal)
2. Avec le compte secondaire (qui doit aussi avoir ce mode débloqué — utiliser le
   déblocage admin du §4 si besoin), accepter la notification

- [ ] L'acceptation redirige bien vers la page **Expert** du mode (`?expert=1` dans
  l'URL), pas vers la page normale
- [ ] Le même jour, un défi **normal** peut aussi être envoyé entre les deux mêmes
  comptes dans le même mode, en plus du défi Expert — les deux coexistent (ce sont deux
  dimensions différentes, cf. §5.2 qui ne s'applique qu'à l'intérieur d'une même
  dimension)
- [ ] Jouer et gagner la partie Expert → le défi Expert passe en résolu, **sans**
  affecter un éventuel défi normal en cours avec le même ami

---

## 6 — Contenu ajouté

### 6.1 Chord Summer (All-Out Attack)

👉 [http://localhost:8080/allOutAttackMode/allOutAttack.html](http://localhost:8080/allOutAttackMode/allOutAttack.html)

- [ ] Taper « Chord » dans le champ de réponse → **deux** suggestions apparaissent,
  `Chord ( Ayaka Sakai )` et `Chord Summer ( Ayaka Sakai )`
- [ ] Jouer plusieurs parties (filtre P5X actif) jusqu'à tomber sur Chord Summer comme
  cible du jour → l'animation de bataille et le portrait s'affichent correctement, sans
  image cassée

### 6.2 Les 3 nouvelles musiques

👉 [http://localhost:8080/musicsMode/musics.html](http://localhost:8080/musicsMode/musics.html)

- [ ] Filtrer sur P2IS, PQ2 et P3FES successivement → « Kimi no Tonari », « Wait and
  See » et « Heartful Cry » apparaissent chacune dans leur filtre respectif
- [ ] Les pochettes s'affichent (pas d'image cassée)
- [ ] En Mode Expert Musique (si débloqué, §2), rejouer jusqu'à tomber sur « Wait and
  See » ou « Kimi no Tonari » → des paroles s'affichent comme indice. Si vous tombez sur
  « Heartful Cry » en Expert, elle **ne doit pas apparaître** dans le tirage — elle n'a
  pas de paroles, donc pas d'indice possible, donc exclue du pool Expert (comportement
  voulu, pas un bug si elle ne sort jamais en Expert)

---

### 6.3 Les 8 silhouettes P4AU

👉 [silhouette](http://localhost:8080/silhouetteMode/silhouette.html)

- [ ] Taper « Junpei » dans le champ de réponse → **deux** suggestions, toutes deux
  intitulées « Junpei Iori », la seconde portant une **pastille `P4AU`** sous le nom
  (pastille encadrée, pas le sous-titre italique réservé aux vrais noms type
  « Crow (Akechi) »). Les deux portraits affichés sont **différents**
- [ ] Idem pour Aigis, Akihiko, Fuuka, Ken, Koromaru, Mitsuru et Yukari
- [ ] En pastille sombre (dark mode) : le texte de la pastille reste lisible
- [ ] Filtrer sur **P4AU seul** → le tirage ne propose plus que Labrys, Sho et les
  8 variantes ; aucune silhouette P3 ne sort
- [ ] Répondre « Junpei Iori » alors que la cible est la version P4AU → c'est compté
  **faux** (comportement voulu : deux dessins différents, deux réponses différentes)

### 6.4 « Memories of You » et le badge *A Gentle Reprieve*

👉 [musics](http://localhost:8080/musicsMode/musics.html)

- [ ] Filtrer sur **P3R** → « Memories of You » apparaît, pochette P3R affichée, l'audio
  se lance
- [ ] Rejouer jusqu'à l'avoir comme cible, puis **abandonner** → le badge
  **Un Doux Sursis / A Gentle Reprieve** se débloque
- [ ] La **gagner** (au lieu de l'abandonner) ne débloque **pas** de progression sur le badge
  *Chronological Convergence* — c'est le correctif de l'alias, seule « When Mother Was There »
  doit y compter
- [ ] En Music Expert, elle sort bien du tirage avec des paroles comme indice

### 6.5 Le voile de chargement en Silhouette

> Test à faire **cache vidé** (`Ctrl+Shift+R`, ou onglet privé) — c'est le seul cas où
> le défaut se voyait.

- [ ] Premier chargement de silhouette.html : un **spinner** occupe le cadre, puis la
  silhouette apparaît directement au bon zoom — elle ne doit **jamais** s'afficher
  dézoomée un court instant
- [ ] En **Expert** (`?expert=1`), cache vidé : la silhouette **n'apparaît à aucun moment**
  avant le premier clic sur ⚡ FLASH. C'était une fuite de réponse, pas un défaut visuel

### 6.6 Noms de badges traduits

👉 [profil](http://localhost:8080/profile/profile.html) → onglet Badges

- [ ] Basculer en FR, ES, DE puis IT → les noms de badges sont dans la langue choisie
  (*Gentle Illusion* → « Douce Illusion », *Eye of the Navigator* → « Œil du Navigateur »,
  *Apostles of the Fall* → « Apôtres de la Chute »…)
- [ ] Restent volontairement en anglais dans toutes les langues : **Memento Mori**,
  **Hippocampus Reload**, **Golden Week**, **Tanabata** — ce n'est pas un oubli
- [ ] Un badge secret affiche toujours `???` comme condition, dans toutes les langues

### 6.7 Anti-triche — copier la silhouette

> Vérification **obligatoirement manuelle** : jsdom n'implémente pas le rendu canvas,
> aucun test automatisé ne peut confirmer que les pixels sortent noirs.

👉 [silhouette](http://localhost:8080/silhouetteMode/silhouette.html), partie **en cours**
(pas terminée)

- [ ] Clic droit sur la silhouette → **Copier l'image**, puis coller dans n'importe quel
  éditeur d'image ou une conversation → on doit obtenir une **forme noire**, pas le
  personnage. C'était le trou : le filtre CSS ne s'appliquait qu'à l'affichage
- [ ] Clic droit → **Enregistrer l'image sous…** → même résultat, fichier noir
- [ ] Clic droit → **Ouvrir l'image dans un nouvel onglet** → forme noire
- [ ] Recharger la page (F5) **en pleine partie** → la silhouette reste noire, et le
  clic droit rend toujours une forme noire (le chemin de restauration de session est
  passé par le même noircissement)
- [ ] **Gagner ou abandonner** → l'image d'origine s'affiche enfin en couleur, et le clic
  droit la rend normalement. La révélation ne doit pas être cassée par la protection
- [ ] Cliquer **Rejouer** juste après → la nouvelle silhouette est noire dès son
  apparition (aucune fuite de l'image précédente)

> ℹ️ **Ce qui reste ouvert, volontairement** : l'URL du fichier reste visible dans
> l'onglet Réseau des DevTools, et la cible du jour reste en clair dans
> `localStorage` (`DevTools → Application`). Impossible à fermer côté client — la
> défense de l'intégrité du **classement** est serveur (`api/lib/daily_target.php`).
> Ce correctif protège le joueur honnête, pas le classement. **Non signalable comme bug.**
>
> ℹ️ Le mode **All-Out Attack** n'a pas cette protection : ses GIFs viennent d'un CDN
> cross-origin qui « teinte » le canvas et interdit l'export. Il faudrait configurer CORS
> sur le bucket R2 — hors périmètre 2.1.

---

## 7 — Classement (série & ratio corrigés)

👉 [http://localhost:8080/profile/leaderboard/leaderboard.html](http://localhost:8080/profile/leaderboard/leaderboard.html)

### 7.1 Les 3 dimensions existantes, inchangées

- [ ] Portée (Global / Amis), mode, période (Jour/Semaine/Mois/Depuis toujours) restent
  tous sélectionnables comme avant — rien n'a bougé sur la navigation elle-même

### 7.2 Le ratio ne favorise plus le petit échantillon

1. Sur un compte avec très peu de parties jouées (le compte secondaire fraîchement créé
   convient), gagner 1 seule partie dans un mode
2. Comparer son classement en métrique **Taux de victoire** à un compte avec beaucoup
   de parties (le compte principal, après tous les tests précédents)

- [ ] Le compte à 1 victoire / 1 partie **n'apparaît pas en tête** du classement ratio
  malgré ses 100 % bruts — il doit être proche du taux moyen du site, pas en 1ère place

### 7.3 La série compte des jours, pas des victoires

1. Jouer 5 parties gagnées dans le **même mode**, réparties sur 5 jours différents (ou,
   pour un test rapide, jouer plusieurs parties le même jour et vérifier que ça ne
   gonfle PAS la série)

- [ ] En métrique **Meilleure série**, la valeur affichée correspond au nombre de
  **jours consécutifs** réellement joués — pas au nombre total de victoires du jour
2. Si possible, comparer avec la série affichée sur votre propre profil
  (`/profile/profile.html`, section statistiques) → les deux doivent maintenant
  raconter la même histoire (avant le correctif, le classement pouvait afficher moins
  que le profil)

---

## 8 — Aperçu des liens partagés (Discord / X)

> Pas testable dans DevTools seul — un aperçu de lien ne se génère qu'une fois l'URL
> réellement partagée quelque part. En local (`localhost`), impossible à vérifier
> directement ; à faire **une fois en prod** après déploiement.

- [ ] Une fois en prod, coller `https://www.personadle.net/` dans un salon Discord (ou
  utiliser un outil comme [opengraph.xyz](https://www.opengraph.xyz) pointé sur l'URL
  prod) → une carte complète s'affiche : logo en bannière large, titre, description
- [ ] Faire de même avec un lien de mode, ex.
  `https://www.personadle.net/musicsMode/musics.html` → la carte annonce bien
  « Personadle — Music Mode » et sa propre description, **pas** celle de la page
  d'accueil

---

## 8bis — Cache navigateur après déploiement

> À faire **une fois en prod**, juste après le déploiement. C'est le scénario que les
> tests ne peuvent pas couvrir : il concerne les joueurs **déjà venus**, dont le
> navigateur détient la version précédente.

1. Sur un navigateur ayant **déjà visité le site avant la mise à jour** (surtout pas une
   fenêtre privée — c'est justement l'inverse du cas à tester), ouvrir personadle.net
   normalement, **sans** `Ctrl+Shift+R`

- [ ] La page d'accueil affiche bien la 2.1 (modal « Nouveautés » avec l'entrée 2.1)
- [ ] Les 6 modes chargent leur nouvelle version — le bouton ⚡ Expert est présent
- [ ] Changer de langue → les nouvelles clés (badges traduits, `Chargement de la
  silhouette…`) s'affichent traduites, pas sous forme de clé brute
- [ ] `DevTools → Application → Service Workers` : la version active est
  **`personadle-v95`**, et aucun ancien cache `personadle-v94` ne subsiste dans
  `Cache Storage`
- [ ] `DevTools → Network`, recharger : `sw.js`, les `.js`, `.css` et `lang/*.json`
  répondent en **200 ou 304**, jamais « (disk cache) » sans requête — c'est ce que
  garantissent les nouveaux en-têtes `Cache-Control: no-cache` du `.htaccess`
- [ ] Les images répondent bien en cache (`max-age=604800`) — normal et voulu, elles
  portent des noms neufs quand elles changent

> ⚠️ Si un joueur signale malgré tout une version périmée : lui faire vider le service
> worker (`Application → Service Workers → Unregister`) plutôt qu'un simple
> `Ctrl+Shift+R`, qui contourne le SW sans le mettre à jour.

---

## 9 — Checklist finale avant `develop → main`

- [ ] §1 — `make check` + E2E passent, migrations 029→038 confirmées en local
- [ ] §2 — Les 3 types de condition testés (au moins 1 mode chacun), verrou + animation
  + isolation entre modes
- [ ] §3 — Gameplay Expert isolé du mode normal
- [ ] §4 — Déblocage/retrait admin, sans jamais pouvoir retirer un accès mérité
- [ ] §5 — Abandon, remplacement de défi non accepté, coexistence normal/Expert
- [ ] §6 — Chord Summer, les musiques, les 8 silhouettes P4AU, le badge A Gentle
  Reprieve, le voile de chargement Silhouette et les badges traduits
- [ ] §7 — Ratio et série corrigés, cohérents avec le profil
- [ ] §8 — Aperçu de lien vérifié une fois en prod (post-déploiement)
- [ ] §8bis — Cache navigateur vérifié en prod sur un navigateur déjà venu

> 📖 **La procédure de déploiement elle-même** (ordre des opérations, sauvegarde, vérification
> du schéma réel, retour arrière) vit dans [`DEPLOY.md`](../../DEPLOY.md), section
> « Release majeure ». Ce qui suit n'est que la liste des migrations propres à la 2.1.

### Migrations à jouer en prod, dans cet ordre

```
029 → 030 → 031 → 032 → 033 → 034 → 035 → 036 → 037 → 038
```

> ⚠️ **Corrigé le 2026-09-01 — la plage était fausse.** Ce plan annonçait
> `031 → 037`. Or `git diff main..develop -- sql/` montre que **029** (badge secret
> `gyotre`) et **030** (titres `junes` / `investigation_team`) ne sont pas non plus
> sur `main` : elles ont été écrites pendant le lot de contenu 2.1, pas en 2.0.
> Sans elles, le code 2.1 référence des lignes `badges` / `titles` inexistantes en
> prod — le badge et les deux titres seraient introuvables. **038** est la nouvelle
> migration du badge `false_spring`.

**Vérifier d'abord ce que la prod a déjà** (la 026 a créé une table de suivi) :

```bash
ssh hostinger-personadle
mysql -u u870779941_Hamza -p u870779941_personadle   -e "SELECT version FROM schema_migrations ORDER BY version;"
```

Ne rejouer que ce qui manque. Toutes ces migrations sont idempotentes
(`INSERT IGNORE` / `IF NOT EXISTS`) **sauf** la 032 et la 036 — d'où les deux
sauvegardes ci-dessous.

- [ ] **Backup pris avant la 032** (supprime une contrainte d'unicité)
- [ ] **Backup pris avant la 036** (modifie des lignes existantes, sans retour arrière)
- [ ] Chemin SSH + `mysql --delimiter='$$'` utilisé, **jamais** phpMyAdmin pour ces deux-là
- [ ] Après la 038 : `SELECT slug FROM badges WHERE slug IN ('gyotre','denial_of_self','false_spring');`
  renvoie bien **3 lignes**, et `SELECT slug FROM titles WHERE slug IN ('junes','investigation_team','shadows_converge');`
  en renvoie **3** aussi

---

## 10 — Méthodologie de rapport

Pour chaque anomalie trouvée, noter au minimum :

```
[BUG] Titre court
Section : §X.Y
Étapes : 1. ... 2. ... 3. ...
Attendu : ...
Observé : ...
```

Les suggestions (amélioration, texte à clarifier) suivent le même format avec
`[SUGGESTION]` à la place de `[BUG]`.
