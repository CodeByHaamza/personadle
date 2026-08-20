# TODO — branche `feat/v2.1-expert-modes`

> État au 2026-08-19. Ce fichier suit **le travail restant sur cette branche**, pas le
> périmètre produit de la v2.1 (qui est dans `ROADMAP.md`). À supprimer au merge.
>
> La branche reste ouverte jusqu'à ce que les 6 modes Expert soient prêts (décision Hamza) :
> pas de PR intermédiaire.
>
> Vérifié le 2026-08-19 : 721 tests Vitest et 89 tests E2E passent, lint propre.

---

## ⚠️ À faire AVANT tout merge vers `main`

Le déploiement Hostinger est un `git pull` automatique : **le code arrive avant les
migrations**. Déployer sans les jouer casse la prod.

- [ ] Jouer `sql/migrations/031_game_sessions_is_expert.sql` en prod (MariaDB, garder les
      `IF NOT EXISTS`). Sans elle : `Unknown column 'is_expert'` à chaque partie Expert.
- [ ] Jouer `sql/migrations/032_sessions_count_every_game.sql` en prod. Sans elle :
      `Unknown column 'client_session_id'` à chaque partie.
- [ ] Backup avant la 032 — elle supprime une contrainte d'unicité (aucune donnée effacée,
      mais le retour arrière exigerait de dédoublonner à la main).

---

## ✅ Terminé sur cette branche

- **Modes Expert livrés** : Classique, Émoji, All-Out Attack, Music, Personae. Bouton, règles
  dédiées, i18n 6 langues, pools serveur, tests E2E (5 specs, 35 tests).
- **Contenu Expert** : 73 chansons avec paroles, 137 fiches de lore Personae × 6 langues
  (EN/FR/ES/DE/IT/PT), 180 personnages avec citation.
- **Refonte des stats — câblage client** : la garde « une partie par jour » est remplacée par
  une garde « cette partie » (`startGame`/`isGameLogged`/`markGameLogged`, gameCore.js), et
  l'identifiant de partie sert de clé d'idempotence serveur.
- **4 bugs joueurs** : défis bloqués, boucle de reconnexion sur la page Amis, stats mal
  enregistrées, chargement infini en All-Out Attack.

---

## 1. Refonte des stats — ce qui reste

- [ ] Test E2E : jouer **deux parties le même jour** dans un mode et vérifier que les deux
      apparaissent côté serveur. C'est le seul contrôle qui prouve la promesse « 50 parties
      = 50 parties comptées » de bout en bout ; les 721 tests unitaires ne couvrent que la
      garde elle-même.

## 2. Les trois classements

Décidé le 2026-08-15, détaillé dans `ROADMAP.md`. Sans ça, le classement récompense le volume.
**C'est le prochain gros morceau.**

- [ ] **Meilleure série** — la streak existe déjà, il manque l'axe de tri.
- [ ] **Meilleur ratio** — lissé. Reco : moyenne bayésienne `(wins + C·m)/(games + C)`,
      C ≈ 20, plutôt que Wilson : un classement dont personne ne comprend le calcul passe
      pour truqué.
- [ ] **Meilleur score** — général et par mode.
- [ ] Chaque axe décliné en version Expert (`is_expert`), soit la 4e dimension déjà prévue.

## 3. Défis déjà bloqués en base

Le correctif du 2026-08-15 empêche d'en créer de nouveaux, **il ne répare pas l'existant**.

- [ ] Migration de nettoyage ponctuelle : repasser en `unread` les `messages` en statut
      `accepted` sans partie associée et vieux de plus de 7 jours. Non idempotente par
      nature — ne pas la rejouer sur des défis récents légitimement en cours.
- [ ] Bouton « abandonner le défi en cours ». Sans lui le blocage se reproduira à la première
      panne réseau au mauvais moment, et il n'existe aujourd'hui aucune sortie.
      `getPendingActiveChallenge()` fournit déjà l'état ; il manque l'action inverse (purge
      d'`activeChallenge`, restauration des filtres, statut serveur remis à `read`).

## 4. Mode Silhouette Expert — le dernier mode

Reporté explicitement par Hamza, mais c'est ce qui bloque la fermeture de la branche.

- [ ] Dézoom **figé** au maximum (le mode normal dézoome de 0.2 par erreur).
- [ ] Point de zoom tiré au hasard **sur un contour**, pas au centre fixe. ⚠️ Un point
      purement aléatoire peut tomber en plein aplat noir uniforme et ne rien montrer
      d'exploitable — il faut des points d'ancrage pré-repérés par personnage, ou une
      contrainte sur les zones qui touchent un contour.
- [ ] Bouton, règles, i18n, tests. `silhouette.html` n'a aujourd'hui **aucun** `#expertToggle`.

## 5. Défis en Mode Expert

Aujourd'hui l'Expert **n'émet pas** de défi et **n'en joue pas**. Neutralisé volontairement le
2026-08-19 dans Personae : `activeChallenge` n'étant pas scopé par mode, un défi créé en normal
s'imposait comme cible en Expert et une victoire Expert validait le défi normal.

- [ ] Colonne `challenge_is_expert` sur `messages`.
- [ ] Tirage de la cible du défi restreint au pool Expert côté émetteur.
- [ ] Les deux points d'acceptation (`js/challenge-notif.js`, `profile/friends/friends.js`)
      doivent ajouter `?expert=1` à l'URL.
- [ ] Barème : un défi Expert ne se compare qu'à un défi Expert.
- [ ] Réactiver le circuit dans `modePersonae.js` (3 gardes `!EXPERT.isExpert`) une fois fait.

## 6. Déblocage des modes Expert — **autre branche** (décision Hamza)

Les modes livrés sont **ouverts à tout le monde** — le bouton ⚡ est visible et cliquable.

- [ ] Condition par mode via `api/lib/condition_check.php` (déjà partagé par
      titles/badges/wallpapers), + nouveau badge et titre.
- [ ] **Vérification serveur obligatoire** : le mode vit dans l'URL, un gate purement client
      se contourne en tapant `?expert=1`.
- [ ] Front : masquer/griser le bouton et rediriger `?expert=1` tant que la condition n'est
      pas remplie.

---

## Branche « analyse sécurité » — **autre branche** (décision Hamza, 2026-08-19)

Analyse faite le 2026-08-19 : le volet **dépendances est déjà réglé par construction** —
`package.json` n'a aucune dépendance de production (tout est en devDependencies), il n'y a pas
de `composer.json`, et `npm audit --omit=dev` sort 0 vulnérabilité. Le risque vit dans les
61 fichiers PHP écrits à la main (17 endpoints `requireAuth()`, 15 `requireAdmin()`).

- [ ] **PHPStan en mode taint sur `api/`** — déterministe, gratuit, jouable en CI à chaque PR.
      Meilleur rapport effort/résultat, à faire **avant** strix.
- [ ] **strix** (agent de pentest autonome, Apache 2.0, Docker + clé LLM) — exploration
      ponctuelle. Contraintes : jamais contre `personadle.net` (il attaque réellement et
      écrit en base), uniquement contre la stack locale sur base jetable ; budget LLM fixé
      d'avance ; sortie traitée comme des hypothèses à confirmer, **jamais** comme une porte
      de CI (non déterministe).
- [ ] Cibles prioritaires quand ce sera fait : IDOR sur `api/user/*`, contournement de
      `requireAdmin()`, absence de jeton anti-CSRF (sessions en cookie httpOnly), abus de la
      logique de défis.

---

## Améliorations d'outillage (hors périmètre Expert)

- [ ] **CI : rejeu de migration sur base vierge.** CLAUDE.md §13 l'exige, rien ne le vérifie.
      C'est ce contrôle qui a attrapé le piège de l'unique key (031) et de son remplacement
      (032). Un job qui charge `bdd_mysql.sql` puis applique `sql/migrations/*` dans l'ordre.
- [ ] **Déploiement : étape de migration** dans le hook Hostinger, ou règle écrite « migration
      en prod avant merge ». Aujourd'hui le code précède systématiquement le schéma.
- [ ] **Template de PR GitHub** reprenant la Definition of Done de CLAUDE.md §13, pour la
      rendre exécutable au lieu de la laisser en prose.
- [ ] **7 PR dependabot en attente sur `main`** — dont `vitest` 2 → 4, une majeure qui touche
      721 tests. Ce sont **uniquement des devDependencies** : c'est de la maintenance
      d'outillage, pas un sujet de sécurité. À traiter comme un lot à part.
- [ ] **Skill projet « rituel de livraison »** — `docs:fix`, `pools:build`, entrée
      `DEV_CHANGELOG.md`, migration rejouée, i18n EN d'abord, `.htaccess` pour tout nouveau
      `.php`. Déjà décrit dans CLAUDE.md, mais en prose ; une skill le rendrait exécutable.

---

## Points ouverts pour Hamza

- [ ] **`Orpheus ( Male )` porte la fiche de la famille Orpheus** — c'était la seule entrée du
      dataset capable de la recevoir, le `.md` ne connaissant qu'« Orpheus ». À confirmer.
- [ ] **AOA Expert et les skins recolorés** — 10 familles (Wonder ×4, Closer ×3, Starlight…)
      partagent silhouette et pose. En noir et blanc au flou maximal elles seront
      vraisemblablement indistinguables. Risque signalé, arbitré « on garde ». À revoir si les
      joueurs le remontent.
- [x] **Seuil d'abandon en Expert** — fixé à 5 dans les 5 modes livrés, validé à l'usage.

## Dette repérée en passant

- [ ] **Débordement horizontal de `.nav-item`** (barre du bas) sur mobile, commun aux 6 modes.
      `.audio-wrapper` et `.expert-lyrics-wrapper` ont été corrigés ; la barre de navigation
      non.
- [ ] **Variantes cosmétiques sans fiche de lore** — 14 entrées (`* Picaro`, `Orpheus Telos`,
      `Orpheus ( Female )`) sont exclues du pool Personae Expert. Choix assumé : leur lore
      serait mot pour mot celui de la persona de base, donc deux cibles afficheraient le même
      texte. À rouvrir seulement si on leur écrit un texte propre.
- [ ] **Tests E2E sensibles à la charge en local.** Avec 4 workers et `retries: 0`, un test
      différent échoue par intermittence (init de page trop lente quand 4 navigateurs tapent
      le même conteneur PHP). En CI `retries: 2` l'absorbe, ce qui explique la stabilité du
      job depuis juillet. Deux vraies causes ont été corrigées le 2026-08-19 (budget trop
      court dans `expert-aoa.spec.js`, nom en dur qui pouvait ÊTRE la cible dans
      `expert-emoji.spec.js`) ; le reste est de la contention. Piste : plafonner `workers`
      en local, ou augmenter le pool PHP-FPM du conteneur de dev.
- [ ] **Noms de personnages en dur dans les specs E2E** — plusieurs specs devinent des noms
      fixes en supposant qu'ils sont faux. Selon la date, l'un d'eux peut être la cible : la
      partie se gagne, les entrées se désactivent, le test échoue pour une raison sans rapport
      avec ce qu'il vérifie. Corrigé au cas par cas dans `expert-emoji.spec.js` ; un helper
      partagé « devine N mauvaises réponses » réglerait la classe entière.
- [ ] **Bug 3 non tranché** — « 50 victoires non sauvegardées » s'expliquait par le design
      d'alors (une session par jour). Le point 1 étant câblé, si des joueurs signalent encore
      des parties perdues, c'est autre chose et il faudra creuser.
