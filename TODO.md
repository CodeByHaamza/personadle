# TODO — branche `feat/v2.1-expert-modes`

> État au 2026-08-15. Ce fichier suit **le travail restant sur cette branche**, pas le
> périmètre produit de la v2.1 (qui est dans `ROADMAP.md`). À supprimer au merge.
>
> La branche reste ouverte jusqu'à ce que les 6 modes Expert soient prêts (décision Hamza) :
> pas de PR intermédiaire.

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

## 1. Refonte des stats — finir le câblage client

La couche serveur est faite (migration 032, streak sur jours distincts, idempotence).
**Le joueur ne voit encore aucun changement.**

- [ ] Retirer la garde `!localStorage.getItem(todayKey)` dans les 6 modes — c'est elle qui
      empêche encore de loguer plus d'une partie par jour.
- [ ] Vérifier mode par mode que les parties de **défi** restent exclues de la session
      quotidienne (`isChallengePlay()`), sinon un défi comptera deux fois.
- [ ] `updateProfileStats()` (stats client) doit accumuler comme le serveur, sinon le profil
      local divergera au prochain `pullProfileFromCloud()`.
- [ ] Tests E2E : jouer deux parties dans la même journée et vérifier que les deux
      apparaissent.

## 2. Les trois classements

Décidé le 2026-08-15, détaillé dans `ROADMAP.md`. Sans ça, le classement récompense le volume.

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

## 4. Mode Personae Expert

**Le contenu est prêt** : 137 fiches EN + FR, roster complet, règle des manieurs implémentée
et testée (`expertWielders()`).

- [ ] Coder le mode : lore affiché à la place du portrait, masquage via `maskTerms()`,
      révélation en fin de partie.
- [ ] Pool serveur `personae_expert` — seules les personas ayant une fiche sont tirables.
- [ ] Bouton, règles dédiées, i18n 6 langues, tests E2E.

## 5. Mode Silhouette Expert

- [ ] Dézoom **figé** au maximum (le mode normal dézoome de 0.2 par erreur).
- [ ] Point de zoom tiré au hasard **sur un contour**, pas au centre fixe. ⚠️ Un point
      purement aléatoire peut tomber en plein aplat noir uniforme et ne rien montrer
      d'exploitable — il faut des points d'ancrage pré-repérés par personnage, ou une
      contrainte sur les zones qui touchent un contour.
- [ ] Bouton, règles, i18n, tests.

## 6. Mode Émoji Expert

Mécanique **non tranchée**. Quatre pistes discutées le 2026-08-15, reco = option 3.

1. Un seul émoji, figé — gratuit, mais très inégal (🔫 couvre la moitié du roster P5).
2. Révélation inversée : tous les émojis, on en retire un par erreur — gratuit, mais perdre
   de l'information en jouant est conceptuellement bizarre.
3. **Émojis mélangés + 1 ou 2 leurres** pris chez un autre personnage — gratuit, difficulté
   réelle, rend le mode *différent* plutôt que *diminué*. À trancher : nombre de leurres, et
   s'ils sont tirés au hasard ou pris dans le même opus (plus vicieux).
4. Jeu d'émojis inédits, plus abstraits — le plus intéressant, et 184 personnages à
   re-décrire.

## 7. Défis en Mode Expert

Aujourd'hui l'Expert **n'émet pas** de défi et **refuse** d'en jouer un (redirection vers le
mode normal). C'est propre, pas cassé — mais incomplet.

- [ ] Colonne `challenge_is_expert` sur `messages`.
- [ ] Tirage de la cible du défi restreint au pool Expert côté émetteur.
- [ ] Les deux points d'acceptation (`js/challenge-notif.js`, `profile/friends/friends.js`)
      doivent ajouter `?expert=1` à l'URL.
- [ ] Barème : un défi Expert ne se compare qu'à un défi Expert.

## 8. Traductions Personae — ES / DE / IT / PT

- [ ] 137 fiches × 4 langues. EN et FR sont validés et servent de source.
- [ ] Les tableaux `mask` sont **propres à chaque langue** : le texte emploie parfois une
      autre forme du nom (« Maïa » vs « Maia »), et `maskTerms()` ne normalise pas les
      diacritiques.

## 9. Déblocage des modes Expert

Les modes livrés sont **ouverts à tout le monde** — le bouton ⚡ est visible et cliquable.

- [ ] Condition par mode via `api/lib/condition_check.php` (déjà partagé par
      titles/badges/wallpapers).
- [ ] **Vérification serveur obligatoire** : le mode vit dans l'URL, un gate purement client
      se contourne en tapant `?expert=1`.
- [ ] Front : masquer/griser le bouton et rediriger `?expert=1` tant que la condition n'est
      pas remplie.

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
      689 tests. À traiter comme un lot à part.
- [ ] **Skill projet « rituel de livraison »** — `docs:fix`, `pools:build`, entrée
      `DEV_CHANGELOG.md`, migration rejouée, i18n EN d'abord, `.htaccess` pour tout nouveau
      `.php`. Déjà décrit dans CLAUDE.md, mais en prose ; une skill le rendrait exécutable.

---

## Points ouverts pour Hamza

- [ ] **Seuil d'abandon en Expert** — fixé à 5 partout. Un message tronqué demandait
      « give up au bout de ___ essais » ; le chiffre n'a jamais été donné.
- [ ] **`Orpheus ( Male )` porte la fiche de la famille Orpheus** — c'était la seule entrée du
      dataset capable de la recevoir, le `.md` ne connaissant qu'« Orpheus ». À confirmer.
- [ ] **AOA Expert et les skins recolorés** — 10 familles (Wonder ×4, Closer ×3, Starlight…)
      partagent silhouette et pose. En noir et blanc au flou maximal elles seront
      vraisemblablement indistinguables. Risque signalé, arbitré « on garde ». À revoir si les
      joueurs le remontent.

## Dette repérée en passant

- [ ] **Débordement horizontal de `.nav-item`** (barre du bas) sur mobile, commun aux 6 modes.
      `.audio-wrapper` et `.expert-lyrics-wrapper` ont été corrigés ; la barre de navigation
      non.
- [ ] **Bug 3 non tranché** — « 50 victoires non sauvegardées » s'expliquait par le design
      d'alors (une session par jour). Si, une fois le point 1 câblé, des joueurs signalent
      encore des parties perdues, c'est autre chose et il faudra creuser.
