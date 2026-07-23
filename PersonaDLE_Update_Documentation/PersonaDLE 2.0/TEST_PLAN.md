# PersonaDLE v2.0 — Plan de Test QA

> **Document destiné à Léo (L2GENDAIRE) et Damien (Corbover).**
> Vous testez l'**expérience utilisateur** du site (depuis un navigateur) et vous lancez les **commandes de setup/tests** depuis un terminal. Vous n'avez **pas besoin de modifier de code** — si quelque chose semble cassé, vous le notez (voir §0.3), vous ne le corrigez pas.

---

## 0 — Avant de commencer

### 0.1 Contexte

Depuis fin mars 2026, le projet a reçu plusieurs centaines de commits (ce nombre continue de grimper à chaque PR, ne vous fiez pas à un chiffre figé) : nouveau backend complet (comptes, amis, classements...), beaucoup de contenu ajouté (personnages, musiques), et plein de petites corrections. Tout ça doit être validé avant de sortir la version 2.0. C'est le rôle de ce document.

### 0.2 Comment lire ce document

- Le document est découpé en **groupes thématiques** (Auth, Modes de jeu, Profil, Social, etc.). Faites-les dans l'ordre, ils s'enchaînent logiquement (ex : il faut un compte avant de pouvoir tester le profil).
- Chaque ligne avec une case `- [ ]` est une vérification à faire. Cochez-la (remplacez `[ ]` par `[x]`) **seulement si le comportement observé correspond à ce qui est décrit**.
- Une case **non cochée = un problème potentiel**. Ne la cochez pas "pour avancer" : notez plutôt le souci dans votre rapport (voir §21 en fin de document) et passez à la suite.
- Chaque test indique une **URL cliquable**. Une fois le site lancé en local (§1), ces liens s'ouvrent directement dans votre navigateur (`Ctrl+clic` ou `Cmd+clic` si vous lisez ce fichier dans un éditeur/Markdown preview/GitHub).
- Quand un test nécessite une manipulation un peu spéciale (ex : 2ème compte, navigation privée, modifier une donnée en base), la marche à suivre est **entièrement détaillée**, étape par étape — vous ne devriez jamais avoir à deviner une commande.

### 0.3 Ce que vous ne devez PAS faire

- ❌ Ne pas corriger de code, même un "petit" bug visuel évident.
- ❌ Ne pas modifier le contenu (textes, BDD) en dehors de ce que ce document vous demande explicitement (ex : promouvoir un compte en admin, voir §2).
- ✅ Vous **pouvez** créer des comptes, jouer des parties, envoyer des demandes d'amis, etc. — tout ce qui passe par l'interface normale du site.

### 0.4 Ressources utiles pendant les tests

- 📖 FAQ du site : [http://localhost:8080/faq.html](http://localhost:8080/faq.html) — si un comportement vous semble bizarre, vérifiez d'abord si la FAQ l'explique (certains "bugs" sont des choix voulus).
- 📜 Changelog technique complet de la 2.0 : [`PersonaDLE_Update.md`](./PersonaDLE_Update.md) (même dossier que ce fichier) — utile si vous voulez comprendre le détail technique d'une feature avant de la tester.
- 📝 Notes de développement : [`note_ajout.md`](./note_ajout.md) (même dossier).

---

## 1 — Installer et lancer le projet en local (Docker)

> À faire **une seule fois** (sauf la partie "lancer" que vous referez à chaque session de test).
> Chacun de vous fait cette installation **sur sa propre machine** — vous n'avez pas besoin de vous coordonner pour cette étape, vous travaillez chacun sur votre copie locale du projet.

### 1.1 Logiciels à installer au préalable

| Outil | Pourquoi | Vérifier l'installation |
|---|---|---|
| **Git** | Récupérer le code du projet | Terminal → `git --version` → doit afficher un numéro de version |
| **Docker Desktop** | Fait tourner la base de données + le serveur sans rien installer manuellement | Terminal → `docker --version` et `docker compose version` |
| **Node.js** (version 18 ou plus) | Lancer les tests automatisés du frontend | Terminal → `node --version` |

Si l'une de ces commandes ne fonctionne pas ("command not found"), c'est que l'outil correspondant n'est pas installé — installez-le depuis son site officiel (`git-scm.com`, `docker.com/products/docker-desktop`, `nodejs.org`) avant de continuer.

> 💡 Sur Windows, faites tout ce qui suit dans un terminal **WSL2** ou **Git Bash** plutôt que l'invite de commandes classique.

### 1.2 Récupérer le projet

```bash
git clone https://github.com/HamzaKarrouchi/personadle.git
cd personadle
git checkout develop
```

> Si vous avez déjà le projet cloné, faites simplement `git pull` sur la branche `develop` pour être à jour.

### 1.3 Installer les dépendances et préparer l'environnement

```bash
# Installe les paquets Node.js nécessaires aux tests + active les vérifications automatiques avant chaque commit
make install
```

- [ ] La commande se termine sans erreur rouge (`npm ci` puis activation des git hooks)

```bash
# Crée votre fichier de configuration local à partir du modèle fourni
cp .env.example .env
```

> Vous n'avez **rien à modifier** dans `.env` pour les tests — les valeurs par défaut suffisent.

### 1.4 Démarrer le site (base de données + serveur)

```bash
make up
```

Cette commande démarre 3 services dans des conteneurs isolés :
- une base de données **MariaDB** déjà pré-remplie avec le schéma + **19 faux joueurs** (utile plus tard pour tester le classement, §10)
- le **serveur PHP** qui fait tourner le site
- **phpMyAdmin**, une interface web pour consulter/modifier la base de données sans ligne de commande

Le **premier lancement** peut prendre 1 à 2 minutes (construction de l'image PHP + initialisation de la base). Patientez jusqu'à voir s'afficher :
```
→ Site       : http://localhost:8080
→ phpMyAdmin : http://localhost:8081
```

- [ ] Ouvrir [http://localhost:8080](http://localhost:8080) dans le navigateur → la page d'accueil de PersonaDLE s'affiche (les 6 modes de jeu en cartes)
- [ ] Ouvrir [http://localhost:8081](http://localhost:8081) → phpMyAdmin s'affiche (login : `personadle_usr` / mot de passe : `devpassword`)

### 1.5 Commandes utiles pendant les tests

```bash
make down       # Éteindre le site (à faire en fin de session si vous voulez)
make up          # Le rallumer (vos données restent — pas de perte)
make logs        # Voir ce qui se passe "sous le capot" si une page plante (Ctrl+C pour sortir)
```

> ⚠️ Si vous devez **tout réinitialiser** (base de données corrompue par un test, comptes en trop...), demandez d'abord à Hamza — la commande de reset complet supprime toutes vos données de test.

---

## 2 — Créer vos comptes de test

> Chacun de vous (Léo et Damien) crée **2 comptes** sur sa propre installation locale : un **compte principal** et un **compte secondaire**. Le compte secondaire sert à simuler "un ami" pour tester les fonctionnalités sociales (amis, défis, Social Link) sans dépendre de l'autre testeur.

### 2.1 Compte Principal

1. Aller sur [http://localhost:8080](http://localhost:8080)
2. Cliquer sur "Sign Up" / "Créer un compte"
3. Remplir avec une adresse email à vous (ex : `votrenom.test@gmail.com` — peu importe qu'elle existe vraiment, ce n'est pas vérifié en local), un pseudo, un mot de passe

- [ ] Le compte se crée et vous êtes connecté automatiquement

### 2.2 Compte Secondaire — via navigation privée

Pour avoir un 2ème compte **en même temps** que le premier (sans être déconnecté), il faut l'ouvrir dans une fenêtre de **navigation privée** — le site ne partage pas la session entre une fenêtre normale et une fenêtre privée.

**Comment ouvrir une fenêtre de navigation privée :**

| Navigateur | Raccourci |
|---|---|
| Chrome | `Ctrl+Shift+N` (Windows/Linux) ou `Cmd+Shift+N` (Mac) |
| Firefox | `Ctrl+Shift+P` (Windows/Linux) ou `Cmd+Shift+P` (Mac) |

1. Ouvrir une fenêtre de navigation privée
2. Aller sur [http://localhost:8080](http://localhost:8080) (oui, ça fonctionne aussi en local)
3. Créer un 2ème compte avec une **autre adresse email** et un **autre pseudo** que le Compte Principal

- [ ] Le 2ème compte se crée sans erreur, indépendamment du premier
- [ ] Les deux fenêtres (normale = Compte Principal, privée = Compte Secondaire) restent connectées chacune à son propre compte sans se gêner

> 📝 Notez vos 2 pseudos quelque part (bloc-notes, etc.) — vous allez les réutiliser tout le document, notamment pour vous ajouter en ami entre les deux.

### 2.3 Promouvoir le Compte Principal en administrateur

Le panneau admin (§11) n'est accessible qu'aux comptes "admin". On le fait passer admin directement en base de données via phpMyAdmin (plus simple qu'en terminal) :

1. Aller sur [http://localhost:8081](http://localhost:8081) (phpMyAdmin)
2. Se connecter (`personadle_usr` / `devpassword`)
3. Dans le menu de gauche, cliquer sur la base `personadle_db`, puis sur la table `users`
4. Cliquer sur l'onglet **SQL** en haut, coller ceci en remplaçant `VOTRE_PSEUDO` par le pseudo exact de votre Compte Principal, puis cliquer "Exécuter" :

```sql
UPDATE users SET is_admin = 1 WHERE pseudo = 'VOTRE_PSEUDO';
```

- [ ] Le message "1 ligne affectée" apparaît
- [ ] Se déconnecter/reconnecter sur le site avec le Compte Principal → un accès au panneau admin apparaît (bouton ou lien, selon l'UI)

> Alternative terminal (si vous préférez) :
> ```bash
> docker compose exec db mariadb -u root -prootpassword personadle_db -e "UPDATE users SET is_admin = 1 WHERE pseudo = 'VOTRE_PSEUDO';"
> ```

---

## 3 — Lancer les tests automatisés (terminal)

> Ces commandes vérifient que le code fonctionne correctement sans que vous ayez à tout tester manuellement. Lancez-les **avant** de commencer les tests manuels — si l'une d'elles échoue, c'est déjà un problème à signaler avant même d'ouvrir le site.

```bash
make test
```
- [ ] Le résultat final affiche **`Test Files  26 passed (26)`** et **`Tests  482 passed (482)`** (ou plus, si du contenu a été ajouté depuis ce document — l'important est **0 failed**, ces deux nombres montent régulièrement)

```bash
npm run lint
```
- [ ] Aucune ligne en rouge / aucune erreur affichée (des "warnings" jaunes ne sont pas bloquants, mais notez-en quelques-uns si vous en voyez beaucoup)

```bash
npm run i18n:check
```
- [ ] Le script signale **0 clé manquante** dans les fichiers de traduction (fr/es/de/it)

```bash
npm run data:check
```
- [ ] Aucune erreur de schéma sur les fichiers de données des personnages

```bash
make test-php
```
> La première exécution télécharge automatiquement `phpunit.phar` (outil de test PHP), c'est normal que ce soit plus long la première fois.
- [ ] Les tests PHP (12 classes dans `tests/php/` — `StreakTest`, `DatabaseIntegrationTest`, `FriendsTest`, `SocialLinkTest`... la liste s'allonge avec le projet) passent sans erreur

> 💡 Raccourci : `make check` lance tout d'un coup (lint + data + i18n + tests JS + tests PHP).

### 3.1 Tests E2E (Playwright) — optionnel mais recommandé

> Ces tests pilotent un vrai navigateur contre votre stack Docker. Comme `make up` est déjà lancé (§1.4), vous avez tout ce qu'il faut pour les exécuter — ça vaut le coup de les faire en plus des tests manuels.

```bash
# Une seule fois : Playwright lui-même est déjà installé via `make install` (§1.3),
# il ne manque que le binaire du navigateur :
npx playwright install chromium

# Lancer les tests — cible déjà http://localhost:8080 par défaut (le port Docker de §1.4).
# Seulement nécessaire si ton .env change APP_PORT :
# PLAYWRIGHT_BASE_URL=http://localhost:TON_PORT npm run test:e2e
npm run test:e2e
```

- [ ] Les 5 scénarios de `smoke.spec.js` passent (accueil, All-Out Attack, leaderboard avec les 19 faux joueurs, profil public sans connexion, login réel)
- [ ] Les 5 scénarios de `api.spec.js` passent (persistance des badges épinglés, rejet d'un badge non débloqué, streak global qui ne s'effondre pas cross-mode, 2 validations de `previous_streak` côté serveur)
- [ ] Les 6 scénarios de `social-link.spec.js` passent (ajout d'ami → acceptation → interaction mutuelle → XP → montée de rang)
- [ ] Les 8 scénarios de `game-flow.spec.js` passent (Give Up en mode Classique, changement de langue, + 6 tests responsive à 375px — un par mode de jeu)
- [ ] Les 6 scénarios de `admin.spec.js` passent (panneau admin)
- [ ] Les 24 scénarios de `admin-extended.spec.js` passent (panneau admin, cas avancés)

---

## 4 — Authentification & comptes

### 4.1 Inscription — cas d'erreur

> Vous avez déjà testé l'inscription "qui marche" en §2. Ici on teste les cas qui doivent **échouer proprement**.

Sur [http://localhost:8080](http://localhost:8080), cliquer sur "Sign Up" et essayer :

- [ ] Un email déjà utilisé par un compte existant → message d'erreur clair affiché (pas de page blanche, pas de crash)
- [ ] Un pseudo déjà pris → message d'erreur clair
- [ ] Un mot de passe trop court (moins de 8 caractères) → message d'erreur clair

### 4.2 Connexion

1. Se déconnecter (bouton "Logout")
2. Cliquer sur "Sign In", entrer les identifiants du Compte Principal

- [ ] Connexion réussie
- [ ] Tester avec un **mauvais mot de passe** → message "identifiants invalides" (pas de détail sur ce qui est faux exactement, par sécurité)
- [ ] Tester avec un **email qui n'existe pas** → même type de message générique

### 4.3 Déconnexion & persistance

- [ ] Cliquer "Logout" → l'interface repasse en mode "non connecté"
- [ ] Recharger la page (F5) après logout → toujours déconnecté (pas de retour fantôme à l'état connecté)

### 4.4 "Se souvenir de moi"

> La case "Remember me" / "Se souvenir de moi" est cochée par défaut dans le formulaire de connexion.

1. Se reconnecter avec la case "Remember me" / "Se souvenir de moi" **cochée** (valeur par défaut)
2. Fermer complètement le navigateur (pas juste l'onglet) puis le rouvrir sur [http://localhost:8080](http://localhost:8080)

- [ ] Toujours connecté automatiquement
3. Se déconnecter, se reconnecter en **décochant** cette fois la case
4. Fermer complètement le navigateur puis le rouvrir

- [ ] **Déconnecté** cette fois (pas de reconnexion automatique — la case décochée doit être respectée)

### 4.5 Mot de passe oublié

1. Sur l'écran de connexion, cliquer "Mot de passe oublié ?" / "Forgot password?"
2. Entrer l'email du Compte Principal

- [ ] Un message confirme l'envoi (même si vous ne recevez pas réellement l'email en local, c'est attendu — pas de service mail configuré en local)
- [ ] Aucune erreur affichée même si l'email entré n'existe pas en base (par sécurité, le message doit rester le même dans les deux cas)

### 4.6 Trop de tentatives (anti brute-force)

> Limite réelle : **5 tentatives par tranche de 15 minutes** (pas juste "1 minute" — les 6 essais
> rapides ci-dessous tombent largement dans cette fenêtre de 15 min, donc le test marche quand
> même, mais ne soyez pas surpris si le blocage persiste plus longtemps que prévu si vous
> retestez juste après).

1. Sur l'écran de connexion, entrer volontairement un **mauvais mot de passe 6 fois de suite**, avec le même email

- [ ] À partir de la 6ème tentative, un message du type "trop de tentatives, réessayez plus tard" apparaît (au lieu du message "identifiants invalides" habituel)

### 4.7 Compte banni

> Nécessite que le Compte Principal soit déjà admin (§2.3).

1. Aller dans le panneau admin (§11) avec le Compte Principal
2. Bannir le Compte Secondaire
3. Dans la fenêtre privée (Compte Secondaire), se déconnecter puis essayer de se reconnecter

- [ ] La connexion est refusée avec un message clair (compte suspendu/banni)
4. Pensez à **débannir** le Compte Secondaire ensuite depuis l'admin pour pouvoir continuer les tests sociaux plus loin dans le document

---

## 5 — Les 6 modes de jeu

> Jouez avec le **Compte Principal**. Pour chaque mode : une partie jusqu'à la victoire, puis les cas particuliers listés.

### 5.1 Mode Classique

👉 [http://localhost:8080/classiqueMode/classiqueMode.html](http://localhost:8080/classiqueMode/classiqueMode.html)

1. Taper le nom d'un personnage dans la barre de recherche
2. Valider une proposition

- [ ] L'autocomplétion propose des personnages avec leur portrait au fur et à mesure de la frappe
- [ ] La validation affiche une ligne avec plusieurs attributs colorés (vert = correct, orange = partiellement correct, rouge = faux)
- [ ] Trouver le bon personnage → animation de confettis + son de victoire
- [ ] Une citation du personnage s'affiche après la victoire
- [ ] Le bouton "Give up" devient utilisable après quelques essais ratés, et révèle la réponse si cliqué
- [ ] Recharger la page → c'est toujours le même personnage du jour qui est demandé (pas un nouveau à chaque rechargement)

### 5.2 Mode Emoji

👉 [http://localhost:8080/emojiMode/emojiMode.html](http://localhost:8080/emojiMode/emojiMode.html)

- [ ] Une séquence d'emojis s'affiche, avec un emoji supplémentaire révélé à chaque mauvaise réponse
- [ ] Victoire → confettis + son
- [ ] L'historique des erreurs affiche le portrait de chaque personnage proposé à tort

### 5.3 Mode Silhouette

👉 [http://localhost:8080/silhouetteMode/silhouette.html](http://localhost:8080/silhouetteMode/silhouette.html)

- [ ] Une silhouette sombre du personnage s'affiche, de plus en plus "dézoomée"/visible à chaque erreur
- [ ] Victoire → l'image apparaît en couleur + confettis

### 5.4 Mode All-Out Attack

👉 [http://localhost:8080/allOutAttackMode/allOutAttack.html](http://localhost:8080/allOutAttackMode/allOutAttack.html)

> Ce mode a reçu des **nouveaux personnages P5X** récemment (Hatsune Miku en collaboration P5X, et les 3 Phantom Idols Anri/Pinky/Blitz) — portez une attention particulière à ceux-là.

- [ ] L'animation de bataille (floutée au départ) se révèle progressivement
- [ ] Victoire → confettis + son
- [ ] Filtrer sur l'opus P5X (voir §6) → vérifier que Hatsune Miku et les Phantom Idols apparaissent bien dans la rotation possible (jouer plusieurs parties si besoin pour les voir passer)
- [ ] L'animation de Hatsune Miku se joue sans saccade/lag visible

### 5.5 Mode Personae

👉 [http://localhost:8080/personaeMode/personae.html](http://localhost:8080/personaeMode/personae.html)

- [ ] C'est le Persona (pas le personnage) qui est affiché à deviner
- [ ] Une réponse correcte révèle le personnage associé à ce Persona

### 5.6 Mode Musique

👉 [http://localhost:8080/musicsMode/musics.html](http://localhost:8080/musicsMode/musics.html)

> Ce mode a reçu **13 nouvelles pistes** et 2 nouveaux opus filtrables (P4AU, P5T).

- [ ] Un lecteur audio façon Persona 5 s'affiche (barres animées, design sombre)
- [ ] La pochette de l'album s'affiche correctement (pas d'image cassée)
- [ ] La couleur du thème change selon l'opus de la piste en cours (ex : rouge pour P5, bleu pour P3...)
- [ ] Le bouton "Skip"/suivant change de piste correctement
- [ ] Victoire → confettis + son
- [ ] Ouvrir le panneau de filtres (§6) → **P4AU** et **P5T** apparaissent dans la liste des opus, chacun avec son logo
- [ ] En filtrant uniquement sur P4AU, puis uniquement sur P5T → des pistes différentes sortent à chaque fois (le filtre a un effet réel, pas juste visuel)
- [ ] Changer de filtre **en cours de partie** → une nouvelle piste se charge bien (pas la même piste qui continue à jouer malgré le changement de filtre)

### 5.7 Réinitialisation quotidienne

- [ ] Jouer une partie dans un mode au choix, gagner ou perdre
- [ ] Revenir sur la page le lendemain (ou redemander à Hamza comment simuler le changement de jour si besoin) → un nouveau personnage/piste est proposé, et la partie précédente reste comptée dans les statistiques (§7)

---

## 6 — Système de filtres (opus)

> Le panneau de filtres est partagé par les 6 modes — testez-le une fois en détail dans le Mode Classique, le comportement doit être identique partout.

👉 [http://localhost:8080/classiqueMode/classiqueMode.html](http://localhost:8080/classiqueMode/classiqueMode.html) → ouvrir l'icône/le bouton "Filtres"

### 6.1 Sélection simple

1. Décocher tous les opus sauf P3 et P4

- [ ] Seuls des personnages P3 et P4 apparaissent dans l'autocomplétion
- [ ] Recharger la page → le filtre P3+P4 est toujours actif (pas de reset au rechargement)

### 6.2 Sous-filtres (P5 et ses variantes)

1. Réactiver tous les opus, puis cliquer sur la petite flèche à côté de "P5" pour dérouler ses sous-variantes (P5R, P5S, P5T...)
2. Décocher uniquement P5R en laissant les autres variantes P5 actives

- [ ] Les personnages P5R n'apparaissent plus, mais P5, P5S et P5T restent disponibles

### 6.3 Aucun filtre sélectionné

1. Décocher absolument tous les opus

- [ ] Un message d'avertissement s'affiche (du type "aucun filtre sélectionné")
- [ ] Ouvrir la console du navigateur (touche `F12` → onglet "Console") → aucune erreur rouge n'apparaît

---

## 7 — Profil utilisateur

👉 [http://localhost:8080/profile/profile.html](http://localhost:8080/profile/profile.html)

### 7.1 Affichage de base

- [ ] Le pseudo du Compte Principal s'affiche correctement
- [ ] Les statistiques par mode (victoires, série en cours, parties jouées) correspondent à ce que vous avez réellement joué en §5

### 7.2 Modifier le pseudo (dirty-state)

1. Cliquer sur l'icône d'édition à côté du pseudo, taper un nouveau pseudo

- [ ] **Important** : un bouton "Sauvegarder" n'apparaît **qu'après** avoir fait une vraie modification (il ne doit pas être visible avant que vous touchiez à quoi que ce soit)
- [ ] Cliquer "Sauvegarder" → le pseudo change, et reste changé après un rechargement de page (`F5`)

### 7.3 Avatar

1. Cliquer sur l'avatar, choisir une image (JPG ou PNG) depuis votre ordinateur
2. Recadrer l'image dans l'outil qui s'affiche

- [ ] L'outil de recadrage (crop) fonctionne (on peut déplacer/zoomer)
- [ ] Après sauvegarde, l'avatar choisi s'affiche bien sur le profil
- [ ] Essayer une image volontairement très grande (plusieurs Mo) → pas de plantage de la page

### 7.4 Wallpaper du profil

1. Dans la section wallpapers, en choisir un parmi ceux disponibles sans condition

- [ ] Le fond de la page profil change immédiatement
- [ ] Ça reste après un rechargement de page

### 7.5 Musique de profil

1. Choisir une chanson dans la liste des musiques disponibles pour le profil

- [ ] Un mini-lecteur apparaît sur le profil et joue la piste choisie
- [ ] La sélection est conservée après rechargement

### 7.6 Profil public (vue d'un autre joueur)

> Nécessite que le Compte Secondaire existe (§2.2). Le "code ami" de chaque compte est affiché sur sa propre page de profil.

1. Avec le Compte Secondaire (fenêtre privée), récupérer son code ami affiché sur son profil
2. Avec le Compte Principal, aller sur :
   `http://localhost:8080/profile/profile.html?view=LE_CODE_AMI_RÉCUPÉRÉ`

- [ ] Le profil du Compte Secondaire s'affiche en lecture seule (pas de bouton "Sauvegarder" visible)
- [ ] Pseudo, avatar et stats du Compte Secondaire sont visibles correctement

### 7.7 Export de la carte de profil (PNG)

1. Depuis le profil du Compte Principal, cliquer sur "Export"/"Share" (bouton de partage)
2. Essayer différents thèmes proposés dans la fenêtre qui s'ouvre
3. Cliquer "Download"

- [ ] Un fichier image (PNG) se télécharge réellement
- [ ] L'image téléchargée correspond bien à ce qui était prévisualisé (pseudo, avatar, badges épinglés visibles)
- [ ] Changer de thème dans la fenêtre → l'aperçu change visuellement avant même de télécharger

### 7.8 Export / Import JSON du profil

> En plus de la synchronisation cloud, le profil peut toujours être exporté/importé en fichier JSON local (utile par exemple pour une sauvegarde manuelle).

1. Sur le profil, chercher un bouton "Export" (différent du "Export PNG" du §7.7 — ici on cherche un export de **données**, pas d'image) et l'utiliser

- [ ] Un fichier `.json` se télécharge réellement
- [ ] L'ouvrir avec un éditeur de texte → le contenu ressemble à des données de profil lisibles (pseudo, stats...), pas à du charabia ou un fichier vide

2. Si un bouton "Import" existe à côté, tester l'import de ce même fichier

- [ ] L'import ne fait pas planter la page (même si vous ne voyez pas de changement visible, le profil cloud étant la source de vérité — voir §15)

---

## 8 — Récompenses (badges, titres, wallpapers, codes)

### 8.1 Débloquer un badge en jouant

> Choisissez 2-3 conditions simples à réaliser (ex : gagner une première partie, gagner en un seul essai). La liste complète des badges et leurs catégories est consultable depuis le profil → section Badges.

- [ ] Après avoir réalisé une condition, une notification visuelle de déblocage apparaît
- [ ] Le badge débloqué est bien visible dans votre collection sur le profil

### 8.2 Épingler des badges

1. Dans la collection de badges du profil, sélectionner 4 badges à "épingler" (mettre en avant)

- [ ] Impossible d'en épingler plus de 4 en même temps
- [ ] Les badges épinglés sont ceux visibles sur votre profil public (revérifiez via l'URL `?view=` du §7.6 depuis l'autre compte)
- [ ] Recharger la page → la sélection des badges épinglés est toujours là (ce point a été spécifiquement corrigé récemment — un oubli ici serait une régression)

### 8.3 Code événement

> Le formulaire de création a : Code, Badge ID (texte libre, le **slug exact** du badge —
> pas son nom affiché), Description (optionnel), case "Code permanent", et si décochée :
> Date début / Date fin (granularité jour, pas d'heure précise).

1. Avec le Compte Principal (admin, §2.3), aller dans le panneau admin → onglet "Codes" (§11)
2. Créer un nouveau code : code = `QATEST2026`, badge ID = `first_win` (ou un autre slug que vous n'avez pas encore débloqué — le slug, pas le nom affiché), cocher "Code permanent" pour simplifier le test
3. Avec le même compte, aller sur le profil → section badges → champ "Entrer un code"
4. Saisir `QATEST2026`

- [ ] Le code est accepté, le badge cible se débloque immédiatement
- [ ] Ressaisir le **même** code une 2ème fois → message d'erreur "code déjà utilisé"
- [ ] Saisir un code qui n'existe pas (ex : `BIDON123`) → message d'erreur clair

> Si le code créé est refusé comme "inexistant" alors qu'il est bien visible dans la liste
> de l'onglet Codes : ouvrez DevTools (F12) → onglet **Network** → retentez la saisie →
> cliquez sur la requête `redeem` → regardez l'onglet **Response**. Le message exact
> (`Invalid or expired code` / `Code not active yet or already expired` / `Code already
> redeemed`) indique précisément où ça coince — notez-le dans le rapport d'anomalie plutôt
> que "ça marche pas", ça permet de creuser sans refaire le test à distance.

### 8.4 Titres

1. Réaliser la condition d'un titre simple si vous en connaissez un, sinon passez ce point en notant que vous n'avez pas pu le tester
2. Une fois un titre débloqué, l'équiper depuis le profil

- [ ] Le titre équipé s'affiche bien sous le pseudo sur le profil
- [ ] Un seul titre peut être équipé à la fois — en équiper un nouveau retire l'ancien automatiquement

### 8.5 Wallpapers verrouillés

- [ ] Les wallpapers marqués comme "verrouillés"/non débloqués ne sont pas sélectionnables tant que la condition n'est pas remplie

---

## 9 — Système social

> À partir d'ici, vous allez beaucoup utiliser vos **deux comptes en même temps** (Compte Principal dans une fenêtre normale, Compte Secondaire dans la fenêtre privée du §2.2). Gardez les deux fenêtres ouvertes côte à côte.

### 9.1 Devenir amis

👉 [http://localhost:8080/profile/friends/friends.html](http://localhost:8080/profile/friends/friends.html)

1. Avec le Compte Principal, rechercher le pseudo du Compte Secondaire et envoyer une demande d'ami
2. Avec le Compte Secondaire, aller sur la même page, onglet "Demandes reçues", accepter la demande

- [ ] La demande apparaît bien côté Compte Secondaire après l'envoi
- [ ] Une fois acceptée, chaque compte voit l'autre dans sa liste d'amis

### 9.2 Recherche par code ami

1. Sur le Compte Principal, chercher le Compte Secondaire en tapant directement son **code ami** (8 caractères, visible sur son profil) au lieu de son pseudo

- [ ] Le compte est trouvé directement par ce code

### 9.2bis Browse Players (liste de tous les joueurs)

1. Sur la page Amis, chercher un onglet ou une section "Browse Players" / "Parcourir les joueurs" (liste de tous les comptes existants, pas juste vos amis)

- [ ] La liste s'affiche, paginée (vous devriez voir vos comptes + les 19 faux joueurs pré-remplis en base)
- [ ] Depuis cette liste, on peut envoyer une demande d'ami directement
- [ ] Changer de page dans la pagination fonctionne sans recharger toute la page bizarrement

### 9.3 Animations de demande d'ami

> Il existe **3 styles d'animation** différents, sélectionnables dans les paramètres. Testez les 3.

1. Aller dans les paramètres du Compte Secondaire, choisir le style "Calling Card"
2. Avec le Compte Principal, envoyer (ou renvoyer) une demande d'ami au Compte Secondaire
3. Observer côté Compte Secondaire

- [ ] **Calling Card** : une animation de carte manuscrite façon Phantom Thieves s'affiche, avec des boutons Accepter/Refuser fonctionnels
- [ ] **TV Persona 4** (changer le style dans les paramètres et recommencer) : une animation de télévision façon Persona 4 s'affiche, sans être coupée/rognée sur les bords de l'écran
- [ ] **Evoker Persona 3** (3ème style) : l'animation correspondante se joue, boutons fonctionnels

### 9.4 Social Link — gain d'XP

1. Avec le Compte Principal, aller voir le profil public du Compte Secondaire (comme au §7.6)

- [ ] Une jauge "Social Link" progresse automatiquement, sans avoir besoin de cliquer sur un bouton spécifique
2. Cliquer sur "Comparer les stats" si ce bouton est visible sur le profil de l'ami

- [ ] Une fenêtre de comparaison (graphique radar ou similaire) s'ouvre avec une animation
- [ ] La jauge Social Link progresse encore un peu après cette action

### 9.5 Passage de rang Social Link

> Répétez les actions du §9.4 plusieurs fois (visites de profil, comparaisons) jusqu'à voir la jauge passer un palier.

- [ ] Une animation de "passage de rang" s'affiche (façon Persona) quand le palier est franchi
- [ ] Les deux comptes voient chacun cette notification de passage de rang (pas seulement celui qui a déclenché l'action)

### 9.6 Envoyer et résoudre un défi

1. Depuis le profil d'ami du Compte Secondaire (vu depuis le Compte Principal), cliquer "Envoyer un défi", choisir le Mode Classique avec quelques filtres, envoyer
2. Avec le Compte Secondaire, ouvrir le Mode Classique

- [ ] Un bandeau visible indique le défi en cours, avec le pseudo de l'expéditeur (Compte Principal) et les filtres imposés
3. Jouer et gagner la partie

- [ ] Le défi passe en "gagné" (vérifiable en revenant sur la page des amis ou via une notification)
- [ ] Le Compte Principal reçoit une notification du résultat (peut prendre jusqu'à 1 minute — le système vérifie automatiquement toutes les 60 secondes, pas besoin de recharger frénétiquement)

4. Renvoyer un 2ème défi identique le **même jour**, dans le même mode, entre les deux mêmes comptes

- [ ] Le 2ème envoi est refusé avec un message clair (un seul défi par paire de joueurs et par jour, par mode)

5. Envoyer un nouveau défi, mais cette fois cliquer "Give up" pendant la partie au lieu de gagner

- [ ] Le défi passe en "perdu" côté expéditeur, sans erreur ni blocage de l'interface

### 9.7 Filtres restaurés après un défi

1. Avant d'accepter un défi, notez quels filtres opus étaient actifs sur le Compte Secondaire
2. Faites-lui accepter/jouer un défi avec des filtres différents (envoyés par le Compte Principal)
3. Une fois le défi terminé (gagné ou abandonné)

- [ ] Les filtres d'origine du Compte Secondaire (notés à l'étape 1) sont automatiquement restaurés

### 9.8 Pas de fuite de notification entre comptes

> Ce point vérifie que l'animation de résultat de défi (§9.6) ne "fuit" pas vers le mauvais compte quand on change d'utilisateur dans la **même fenêtre de navigateur**.

1. Dans la fenêtre normale, connecté avec le Compte Principal, déclenchez une notification de résultat de défi (rejouez le scénario du §9.6 pour en avoir une fraîche en attente)
2. Avant qu'elle ne s'affiche, déconnectez-vous du Compte Principal **dans cette même fenêtre** et reconnectez-vous avec le Compte Secondaire

- [ ] Le Compte Secondaire ne voit **pas** l'animation/notification qui appartenait au Compte Principal
- [ ] Le Compte Secondaire continue de recevoir normalement ses propres notifications par la suite

---

## 10 — Leaderboard (classement)

👉 [http://localhost:8080/profile/leaderboard/leaderboard.html](http://localhost:8080/profile/leaderboard/leaderboard.html)

> La base de test contient déjà **19 faux joueurs** pré-remplis — vous n'avez pas besoin de créer des dizaines de comptes pour tester la pagination.

### 10.1 Filtres

Pour chaque filtre, vérifier que la liste se met à jour sans erreur :

- [ ] **Mode** : tester "Tous les modes" puis au moins 2 modes spécifiques
- [ ] **Période** : Aujourd'hui / Semaine / Mois / Depuis toujours
- [ ] **Métrique** : Victoires / Taux de victoire / Meilleure série / Parties parfaites / Parties jouées
- [ ] **Portée** : Global, puis "Amis seulement" (voir §10.3 ci-dessous)
- [ ] Une combinaison de filtres qui ne retourne aucun résultat affiche un message clair ("aucune donnée") plutôt qu'un écran vide ou cassé

### 10.2 Pagination

- [ ] Avec 19 faux joueurs + vos comptes, il doit y avoir plusieurs pages — les boutons page suivante/précédente fonctionnent

### 10.3 Portée "Amis seulement"

> Nécessite d'avoir accepté la demande d'ami du §9.1.

1. Avec le Compte Principal connecté, activer le filtre "Amis seulement"

- [ ] Seuls le Compte Principal et le Compte Secondaire apparaissent dans la liste (pas les 19 faux joueurs)

### 10.4 Ma position

- [ ] En étant connecté, un encart "Ma position" / "My rank" reste visible (même si votre rang réel est en dehors de la page actuellement affichée)

---

## 11 — Panneau admin

👉 [http://localhost:8080/admin/](http://localhost:8080/admin/)

> Nécessite que le Compte Principal soit admin (§2.3). Connectez-vous avec lui avant d'aller sur cette URL.

### 11.1 Accès

- [ ] Le panneau s'affiche normalement avec un compte admin
- [ ] Se déconnecter et se reconnecter avec le Compte Secondaire (non-admin) puis retenter d'aller sur `/admin/` → accès refusé/redirigé

### 11.2 Gestion utilisateur

1. Rechercher le Compte Secondaire dans la liste

- [ ] Sa fiche complète s'affiche (stats, badges, amis...)
- [ ] Le bouton "Ban" le bannit réellement (déjà testé en §4.7) — pensez à le débannir si ce n'est pas déjà fait
- [ ] Le bouton "Lock pseudo" empêche ensuite ce compte de changer son propre pseudo depuis son profil (à vérifier en se reconnectant sur le Compte Secondaire et en essayant de changer son pseudo)

### 11.3 Attribution manuelle de badge

1. Sur la fiche du Compte Secondaire, onglet Badges, sélectionner un badge non débloqué et l'appliquer

- [ ] Le badge apparaît bien dans la collection du Compte Secondaire après rechargement de son profil

### 11.4 Codes événement

> Déjà testé en partie au §8.3 — ici on vérifie la gestion du code après coup.

1. Retrouver le code `QATEST2026` créé au §8.3 dans la liste des codes
2. Le désactiver ou le faire expirer manuellement
3. Essayer de le ressaisir depuis un profil qui n'a pas encore ce badge

- [ ] Un message d'erreur "code expiré"/"code inactif" s'affiche

### 11.5 Affichage mobile

1. Ouvrir les outils développeur du navigateur (`F12`), activer le mode "responsive"/mobile (icône téléphone/tablette en haut de la fenêtre des outils dev), choisir une largeur d'environ 375px
2. Recharger `/admin/`

- [ ] Le menu latéral se transforme en menu "tiroir" accessible via une icône hamburger
- [ ] Les actions principales restent accessibles sans avoir à zoomer/dézoomer

---

## 12 — Internationalisation (langues)

> Le site est traduit en 5 langues : Anglais (EN, langue de référence), Français, Espagnol, Allemand, Italien.

1. Cliquer sur le sélecteur de langue (généralement en haut, icône 🌐)
2. Passer successivement par chaque langue disponible

Pour **chaque** langue testée :
- [ ] L'interface se traduit dans son ensemble (boutons, titres, messages d'erreur) — pas de texte resté en anglais "par accident" en dehors des noms propres
- [ ] Les noms de personnages et de Personas **ne sont pas traduits** (ex : "Ryuji" reste "Ryuji" dans toutes les langues — c'est volontaire, pas un bug)
- [ ] Les boutons illustrés du jeu (Hint, Give Up, Submit, Replay) changent bien d'image selon la langue

3. Choisir le Français, recharger la page (`F5`)

- [ ] La langue Français reste sélectionnée après rechargement

---

## 13 — Dark mode & accessibilité

1. Activer le mode sombre depuis les paramètres

- [ ] L'interface entière passe en thème sombre (pas de zone restée blanche par erreur)
- [ ] Les logos d'opus dans le panneau de filtres restent bien lisibles en mode sombre
- [ ] Recharger la page → le mode sombre reste actif

2. Le mode "daltonien" n'est **pas** dans le panneau de paramètres global — c'est un bouton dédié directement sur la page du Mode Classique (`Daltonian Mode: OFF`, en bas des contrôles). Cliquer dessus, puis rejouer une partie (§5.1)

- [ ] Le code couleur de la grille de résultats (vert/orange/rouge) change pour rester lisible/distinguable

---

## 14 — Streak (série de jours) & récupération "Jack Frost"

### 14.1 Forcer une série cassée (pour le test)

> On force artificiellement la "streak" à 0 en base pour pouvoir tester le bouton de récupération, sans devoir attendre plusieurs jours réels.

1. Aller sur [http://localhost:8081](http://localhost:8081) (phpMyAdmin), table `user_stats`
2. Trouver la ligne correspondant au Compte Principal et au mode `classic`, mettre la colonne `streak` à `0` et valider

### 14.2 Bouton de récupération

1. Aller sur le profil du Compte Principal, section statistiques

- [ ] Un bouton de récupération de série (🔥) est visible puisque la streak est à 0
2. Cliquer sur le bouton et confirmer dans la fenêtre qui s'ouvre

- [ ] La série est restaurée à une valeur non nulle
- [ ] Le bouton disparaît une fois utilisé

### 14.3 Cooldown (ne peut pas être réutilisé tout de suite)

1. Refaire baisser la streak à 0 via phpMyAdmin comme en 14.1
2. Retourner sur le profil

- [ ] Le bouton de récupération est absent ou grisé, avec un message indiquant qu'il faut attendre (la vraie limite est de ~2 mois, mais le simple fait que le bouton ne réapparaisse pas immédiatement suffit à valider ce point)

---

## 15 — Synchronisation cloud & mode hors-ligne

### 15.1 Le cloud fait foi

1. Via phpMyAdmin, table `users`, changer manuellement le pseudo du Compte Principal en `CloudPseudoTest`
2. Sur le site (toujours connecté avec ce compte), attendre **jusqu'à 3 minutes** sans rien faire (la sync automatique tourne toutes les 3 min pile), ou simplement naviguer vers une autre page du profil

- [ ] Le nouveau pseudo `CloudPseudoTest` apparaît dans l'interface sans avoir eu besoin de recharger complètement la page

### 15.2 Jouer hors-ligne

1. Ouvrir les outils développeur (`F12`) → onglet "Network"/"Réseau" → cocher la case "Offline"
2. Jouer une partie complète dans un mode au choix

- [ ] La partie se déroule normalement malgré la coupure réseau simulée (pas de blocage, pas de message d'erreur bloquant)
3. Décocher "Offline" pour revenir en ligne, attendre quelques secondes

- [ ] La partie jouée hors-ligne finit par apparaître dans vos statistiques (la synchronisation se fait automatiquement au retour du réseau)

---

## 16 — Sécurité (vérifications simples, côté utilisateur)

> Pas besoin de compétences techniques particulières pour cette section — uniquement des manipulations depuis l'interface.

### 16.1 Validation de l'avatar

1. Essayer d'uploader en avatar (§7.3) un fichier qui n'est **pas une image classique** (par exemple un `.txt` renommé en `.jpg`, ou un fichier `.svg`)

- [ ] Le fichier est refusé avec un message d'erreur, pas d'upload silencieux et pas de plantage

### 16.2 En-têtes de réponse (optionnel, terminal)

> Optionnel — seulement si vous êtes à l'aise avec un terminal.

```bash
curl -I http://localhost:8080/api/auth/me
```

- [ ] La réponse contient bien les lignes `X-Frame-Options`, `X-Content-Type-Options` et `Referrer-Policy`

---

## 17 — Responsive (mobile / tablette / desktop)

> Utiliser les outils développeur du navigateur (`F12` → mode responsive, icône téléphone/tablette) pour simuler chaque taille.

| Résolution | Profil simulé |
|---|---|
| 375×667 | Mobile (iPhone SE) |
| 768×1024 | Tablette (iPad) |
| 1920×1080 | Grand écran desktop |

Pour chacune des pages suivantes, à **375px de large** :

- [ ] [http://localhost:8080](http://localhost:8080) — page d'accueil, cartes des modes lisibles sans débordement horizontal
- [ ] Mode Classique — la grille de résultats reste consultable (scroll horizontal si besoin, mais rien de coupé/illisible)
- [ ] Mode Musique — le lecteur audio s'adapte à la largeur de l'écran
- [ ] Profil — statistiques et boutons restent accessibles sans superposition
- [ ] Amis — les cartes de joueurs s'empilent verticalement, la recherche reste utilisable
- [ ] Leaderboard — le tableau reste consultable
- [ ] Admin — menu latéral en tiroir (déjà vérifié au §11.5)

### Test multi-navigateurs (si possible)

- [ ] Le site fonctionne sur Chrome
- [ ] Le site fonctionne sur Firefox
- [ ] (Si disponible) Le site fonctionne sur Safari

---

## 18 — Lecture de la documentation

> Cette section ne teste pas le code, mais vérifie que la documentation est fiable. Lisez **chaque** document de la liste **en entier**, pas juste le titre — pour chacun, vérifiez qu'il correspond à ce que vous avez réellement observé en testant (rien de contradictoire, rien de manifestement faux ou périmé).
>
> Le projet contient **27 README** répartis dans les dossiers, plus quelques documents généraux. Cochez au fur et à mesure.

### 18.1 Documents généraux (racine)

- [ ] [`README.md`](../../README.md) — présentation générale, stack technique, modes décrits
- [ ] [`ROADMAP.md`](../../ROADMAP.md) — les éléments marqués "déjà livrés" (✅) correspondent à des fonctionnalités que vous avez testées et qui fonctionnent
- [ ] [`CLAUDE.md`](../../CLAUDE.md) — pas un README à proprement parler, mais très dense en pièges connus (section "Pièges critiques") ; en cas de bug surprenant pendant vos tests, vérifiez d'abord s'il n'est pas déjà documenté ici
- [ ] [`faq.html`](http://localhost:8080/faq.html) (site) — toutes les catégories parcourues ; aucune réponse ne contredit ce que vous avez observé
- [ ] [`PersonaDLE_Update.md`](./PersonaDLE_Update.md) — le changelog technique 2.0 couvre bien les grandes fonctionnalités que vous venez de tester
- [ ] [`note_ajout.md`](./note_ajout.md) — notes de développement, cohérentes avec le changelog

### 18.2 Modes de jeu

- [ ] `classiqueMode/README.md`
- [ ] `emojiMode/README.md`
- [ ] `silhouetteMode/README.md`
- [ ] `allOutAttackMode/README.md`
- [ ] `personaeMode/README.md`
- [ ] `musicsMode/README.md`

### 18.3 Profil & social

- [ ] `profile/README.md`
- [ ] `profile/badges/README.md`
- [ ] `profile/friends/README.md`
- [ ] `profile/leaderboard/README.md`
- [ ] `admin/README.md`

### 18.4 Backend & données

- [ ] `api/README.md`
- [ ] `sql/README.md`
- [ ] `sql/migrations/README.md`
- [ ] `database/README.md`
- [ ] `docker/README.md`

### 18.5 Frontend & assets

- [ ] `js/README.md`
- [ ] `css/README.md`
- [ ] `lang/README.md`
- [ ] `assets/README.md`
- [ ] `font/README.md`

### 18.6 Tests & outils

- [ ] `tests/README.md`
- [ ] `tests-e2e/README.md`
- [ ] `scripts/README.md`

### 18.7 Autres

- [ ] `docs/roadmap/README.md`
- [ ] `pages/README.md`

---

## 19 — Suggestions & idées (sans case à cocher)

> Espace libre — toute observation qui n'est pas un bug à proprement parler : une amélioration possible, un texte qui pourrait être plus clair, une icône ambiguë, etc. Notez-les avec le même format que les bugs (§21), juste avec la catégorie `[SUGGESTION]`.

---

## 20 — Checklist finale avant de dire "c'est testé"

- [ ] §3 — Tous les tests automatisés passent (JS + lint + i18n + data + PHP + E2E Playwright)
- [ ] §4 — Inscription, connexion, déconnexion, mot de passe oublié, rate-limit, ban : tous testés
- [ ] §5 — Les 6 modes jouables jusqu'à la victoire, y compris les nouveaux contenus (Miku, Phantom Idols, 13 pistes musicales)
- [ ] §6 — Filtres + sous-filtres + cas "aucun filtre" testés
- [ ] §7 — Profil : pseudo, avatar, wallpaper, musique, profil public, export PNG, export/import JSON
- [ ] §8 — Badges, codes événement, titres testés
- [ ] §9 — Amis, Browse Players, 3 styles d'animation, Social Link, défis (victoire ET give-up), pas de fuite de notification entre comptes
- [ ] §10 — Leaderboard : tous les filtres + pagination + scope amis
- [ ] §11 — Admin : ban, lock pseudo, attribution badge, codes, affichage mobile
- [ ] §12 — Les 5 langues testées, persistance après rechargement
- [ ] §13 — Dark mode + accessibilité daltonien
- [ ] §14 — Streak recovery : bouton conditionnel + cooldown
- [ ] §15 — Cloud sync + mode hors-ligne
- [ ] §16 — Vérifications sécurité de base
- [ ] §17 — Responsive sur au moins 2 tailles d'écran + 2 navigateurs
- [ ] §18 — Les 27 README du projet + CLAUDE.md + ROADMAP + FAQ + changelog 2.0 ont été lus en entier
- [ ] §19 — Au moins quelques suggestions notées
- [ ] §21 — Toutes les anomalies trouvées sont bien rapportées avec le template ci-dessous
- [ ] §22, §23 — Correctifs des PR #25→#30 re-testés

---

## 21 — Méthodologie de rapport

> Comment consigner ce que vous trouvez, pour que ce soit utilisable par Hamza derrière — que vous travailliez sur un **Google Docs partagé** ou **chacun de votre côté** dans vos propres notes.

### 21.1 Où écrire vos rapports

Deux options, à choisir ensemble (Léo + Damien) selon ce qui vous convient :

1. **Un Google Docs (ou Sheets) partagé** — un seul document à deux, une entrée par anomalie trouvée, dans l'ordre chronologique. Avantage : vous voyez en direct si l'autre a déjà trouvé le même bug (évite les doublons).
2. **Chacun ses notes**, puis on regroupe à la fin de la session de test — utilisez exactement le même template ci-dessous dans vos notes personnelles, pour que la fusion soit facile ensuite.

Dans les deux cas : **une anomalie = une entrée**, même si elle vous semble mineure. Ne résumez pas plusieurs problèmes en une seule ligne.

### 21.2 Template à copier-coller pour chaque anomalie

```
---
🗓️ Date : [JJ/MM/AAAA — l'heure si pertinent]
👤 Testeur : [Léo / Damien]
📍 Section concernée : [ex : §9.6 — Défis quotidiens]
🏷️ Catégorie : [BUG / UX / DOC / SÉCU / PERF / SUGGESTION]
🚦 Priorité ressentie : [Bloquant / Majeur / Mineur / Cosmétique]

🔁 Cheminement (étapes pour reproduire) :
1. ...
2. ...
3. ...

👀 Ce qui se passe (comportement observé) :
[Décrivez ce que vous voyez réellement]

✅ Ce qui devrait se passer (comportement attendu) :
[Selon ce que le document de test ou la doc décrit]

📸 Capture d'écran :
[Lien vers l'image, ou collée directement si Google Docs]

💡 Suggestion (optionnel) :
[Une piste si vous en avez une — pas obligatoire]
---
```

### 21.3 Niveaux de priorité — définition rapide

| Priorité | Signification |
|---|---|
| 🔴 **Bloquant** | Empêche de continuer à tester, ou casse une fonctionnalité centrale (ex : impossible de se connecter) |
| 🟠 **Majeur** | La fonctionnalité ne marche pas comme prévu, mais on peut continuer à tester autour |
| 🟡 **Mineur** | Petit souci ponctuel sans impact sur le reste (ex : un libellé manquant dans une langue) |
| ⚪ **Cosmétique** | Visuel uniquement, aucun impact fonctionnel |

### 21.4 Captures d'écran

- Prenez une capture **à chaque fois** que c'est visuel (presque toujours possible) — ça évite les allers-retours pour clarifier ce que vous avez vu.
- Si le bug implique la console développeur (erreur JS rouge), incluez aussi une capture de l'onglet Console (`F12`).
- Nommez vos fichiers de façon à pouvoir les retrouver, ex : `2026-06-26_defi-givup_leo.png`.

### 21.5 Avant de transmettre à Hamza

- [ ] Toutes les entrées suivent le template ci-dessus (rien en vrac sans structure)
- [ ] Les doublons entre vos deux rapports (si notes séparées) ont été fusionnés
- [ ] Chaque entrée a une priorité assignée

---

## 22 — Correctifs PR #25→#28 (17 juillet 2026) — à tester par Léo & Damien

> Ces 4 PR sont arrivées **après** la rédaction initiale de ce document (26 juin), donc pas
> couvertes par les sections ci-dessus. Chaque sous-section correspond à une PR : mêmes
> conventions (cases à cocher, `👉` = lien direct, `>` = note importante).
>
> Pré-requis commun : `git pull` sur `develop` avant de commencer, puis `make up` (ou
> redémarrer la stack si déjà lancée, pour être sûr d'avoir la dernière version du code
> et des assets).

### 22.1 PR #25 — Nouveau logo, grille index, avatars Theodore, fixes UI/perf

👉 [http://localhost:8080](http://localhost:8080)

- [ ] Logo affiché correctement sur la page d'accueil **et** les 6 modes (plus petit qu'avant, pas de débordement)
- [ ] Grille des 6 modes sur l'accueil : **2 colonnes** en desktop (fenêtre large), **1 colonne** en dessous de 480px de large (redimensionner la fenêtre ou DevTools → mode responsive)
- [ ] Mode All-Out Attack : plus de lag/saccade sur les GIFs sans avoir besoin de `Ctrl+Shift+R` (si ça lague encore au tout premier chargement après le `git pull`, c'est normal — le Service Worker doit d'abord se mettre à jour ; rechargez une 2e fois)
- [ ] Page profil → bouton "Mot de passe oublié ?" : plus de soulignement, couleur discrète (gris), ne ressemble plus à un lien
- [ ] Dans la grille d'avatars, groupe P3 → **Theodore** (5 variantes) apparaît juste après Elisabeth
- [ ] Page 404 (URL invalide, ex: `/nimportequoi`) : fond visuellement plus riche (halos + bandes diagonales + grain doré)
- [ ] `PersonaDLE_Update.html` — les images d'illustration s'affichent (déjà validé avec Léo plus tôt, normalement réglé — revérifier vite fait)

### 22.2 PR #26 — Onglet Admin sur pages profondes, stats profil traduites, modale

> Nécessite un compte **admin** (voir §2.3 si pas encore fait).

- [ ] Connecté en admin, aller sur `/profile/friends/friends.html` → onglet **Admin** visible dans la bottom nav, et le lien pointe bien vers `/admin/` (pas de 404)
- [ ] Idem sur `/profile/leaderboard/leaderboard.html`
- [ ] Page profil, passer la langue en français (ou une autre) → les libellés de stats sont traduits ("Victoires", "Parties jouées", etc. — plus de texte en anglais)
- [ ] Changer de langue une 2e fois sur la page profil → le tableau de détail par mode (en dessous des stats) se retraduit aussi
- [ ] Dans la modale login/register, **sélectionner du texte** dans le formulaire (double-clic sur un mot) puis relâcher la souris en dehors du formulaire → la modale reste ouverte

### 22.3 PR #27 — Streak recovery visuel, challenges classiques, console, admin responsive

**Carte streak gelée + bouton de récupération**

> ⚠️ Le §14.1 de ce document (modifier `streak` dans phpMyAdmin) ne suffit **plus** à lui
> seul pour faire apparaître le bouton depuis cette PR : la valeur `previousStreak` qui
> déclenche le bouton vit dans le `localStorage` du navigateur (clé `streakRecovery`), pas
> en base. Pour tester sans attendre plusieurs jours réels, ouvrez la console du navigateur
> (F12) sur la page profil et lancez :
> ```js
> localStorage.setItem('streakRecovery', JSON.stringify({ previousStreak: 5, shown: false }));
> ```
> puis mettez `streak` à `0` dans phpMyAdmin (`user_stats`, comme en §14.1) et rechargez la page.

- [ ] Streak à 0 **avec** `previousStreak > 1` en localStorage → carte de streak avec effet glace (❄️, glow bleuté) + bouton proéminent "❄️ Rallumer — 0 → N jours" en dessous des stats
- [ ] Cliquer le bouton → le menu Jack Frost habituel s'ouvre
- [ ] Streak > 0 → pas de bouton, pas d'effet glace
- [ ] **Compte tout neuf / jamais joué** (streak = 0, sans `previousStreak` enregistré) → l'effet glace ❄️ sur la carte reste visible (c'est normal, il s'affiche dès que streak=0, peu importe l'historique), mais **pas de bouton** "Rallumer" (normal aussi, rien à récupérer)
- [ ] Cooldown : après une récupération, refaire le test avec le même `localStorage.setItem` — le bouton ne doit **pas** réapparaître avant ~2 mois (mais souvenez-vous : c'est le serveur qui fait vraiment foi, pas ce flag local — voir §14.3)

**Challenges classiques**

- [ ] Envoyer un défi Classique à un ami qui n'a pas encore joué aujourd'hui → côté ami, accepter le défi → la cible du défi correspond bien au personnage du jour normal (pas "Igor", qui était un bug de reset aléatoire)
- [ ] Sur `classiqueMode.html`, taper quelque chose dans la barre de recherche, revenir en arrière avec le bouton du navigateur puis y retourner (ou ouvrir depuis une notification de défi) → le champ est vide au chargement, pas de texte fantôme

**Divers**

- [ ] Console navigateur (F12) sur `index.html` → plus de log `🔍 Checking badges...` qui spammait à chaque chargement
- [ ] Panneau admin sur mobile ≤480px (DevTools responsive) → la barre de boutons en haut (Codes, Logs, Audit, RGPD, Rate Limits) est scrollable horizontalement, tous les boutons restent accessibles (rien de caché/coupé)

### 22.4 PR #28 — Notification de badge qui débordait sur petit écran

- [ ] DevTools → mode responsive → largeur **320px** (ex: iPhone SE 1ère génération)
- [ ] Débloquer n'importe quel badge (ou en attribuer un depuis l'admin à votre propre compte pour aller plus vite) → la notification qui apparaît en haut à droite reste **entièrement visible**, pas de bord coupé à gauche

---

## 23 — Correctifs du 17 juillet 2026 (retours Léo) — à re-tester

> Ces 2 fixes répondent directement à deux bugs remontés par Léo pendant les tests du §22.
> `git pull` sur `develop` (une fois la PR mergée) + `make up` avant de commencer, comme au §22.

### 23.1 Classic mode — l'écran de victoire restait affiché après reset

> Signalé par Léo : "j'ai fait reset en Classic mode mais l'image de victoire est restée à l'écran".
> Confirmé : le bouton reset oubliait de cacher `#victoryBox`, contrairement aux 5 autres modes.

👉 [http://localhost:8080/classiqueMode/classiqueMode.html](http://localhost:8080/classiqueMode/classiqueMode.html)

1. Jouer une partie jusqu'à la victoire (ou "Give up") — l'écran de victoire/résultat s'affiche
2. Cliquer sur le bouton "Reset" / de réinitialisation

- [ ] L'écran de victoire disparaît immédiatement au reset (plus aucune trace de l'ancienne partie), la barre de recherche redevient utilisable pour un nouveau personnage

### 23.2 Badge "Ace Defective" (giveups_total ≥ 10) jamais débloqué

> Signalé par Léo : il n'a pas réussi à débloquer `ace_defective` malgré 10+ abandons. Pas un
> problème de comptage (le total côté serveur était correct) mais un problème d'ordre
> d'exécution : le tout premier check de badges au chargement de la page profil tournait
> **avant** que la synchronisation cloud n'ait eu le temps de ramener le total à jour — donc
> jamais re-testé une fois les vraies données arrivées.

1. Avoir déjà cumulé (ou cumuler maintenant, sur plusieurs jours/modes différents — un abandon
   par jour et par mode) **10 "Give up"** au total, tous modes confondus
2. Aller sur [http://localhost:8080/profile/profile.html](http://localhost:8080/profile/profile.html) (recharger la page si vous étiez déjà dessus)

- [ ] Le badge **Ace Defective** apparaît débloqué dans la collection, sans avoir besoin de recharger la page une 2ème fois

> 💡 Pour aller plus vite sans attendre plusieurs jours : en admin (§11.3), attribuez-vous
> directement ce badge sur votre propre compte pour vérifier au moins qu'il s'affiche bien une
> fois débloqué — puis, si vous avez le temps, testez le vrai parcours (10 abandons naturels)
> pour valider le fix de timing lui-même.

### 23.3 Synchronisation badges/titres/wallpapers après avoir joué sur une autre page (bfcache)

> Teste la restauration "bfcache" du navigateur spécifiquement (retour via le bouton
> **précédent**, pas un vrai rechargement) — cause plus générale derrière le §23.2 et
> probablement derrière ce que tu as remonté sur le badge Naoto/Futaba.

1. Aller sur le profil, **noter** un badge/titre/wallpaper pas encore débloqué mais dont vous
   pouvez remplir la condition rapidement (ex : gagner une partie dans un mode où il ne vous
   manque qu'une victoire)
2. Cliquer sur un lien vers un mode de jeu (ou taper l'URL), jouer et remplir la condition
3. Utiliser le bouton **précédent** du navigateur (pas F5, pas retaper l'URL) pour revenir sur le profil

- [ ] Le badge/titre/wallpaper apparaît débloqué **sans avoir besoin de recharger la page une
  2ème fois**

### 23.4 Case "Remember me" au login

> Voir §4.4 (mis à jour) pour le test complet coché/décoché.

- [ ] Revoir §4.4 en entier — nouveau comportement à tester dans les deux sens (coché = mémorisé,
  décoché = déconnecté à la fermeture du navigateur)

### 23.5 Notifications de badge/titre/wallpaper "en live", sur n'importe quelle page

> Un badge/titre/wallpaper débloqué doit se notifier directement sur la page où vous jouez,
> pas seulement en visitant le profil. Les 6 modes sont concernés — testez-en au moins 2-3,
> pas besoin des 6.

1. Choisir un mode de jeu où il vous manque **une seule condition** pour débloquer un badge,
   un titre ou un wallpaper (ex : `ace_defective` s'il vous manque un seul Give Up ; n'importe
   quel badge/titre/wallpaper à condition simple visible dans la collection du profil)
2. Jouer et remplir cette condition (gagner ou abandonner selon le cas), **sans quitter la page**
   du mode de jeu

- [ ] Une notification de déblocage apparaît directement sur la page du mode de jeu, sans avoir
  besoin d'aller sur le profil (comparez avec l'attente `_style visuel_` : badge = notif en haut
  à droite façon toast, titre = carte façon "calling card" glissant depuis la droite en bas,
  wallpaper = bandeau horizontal en bas)
3. Refaites le test spécifiquement en **Give Up en mode Classique** (c'était le cas cassé)

- [ ] Notification badge visible directement après le Give Up, sans recharger ni changer de page

### 23.6 Popup streak recovery — fermeture accidentelle par clic sur le fond

> Comportement confirmé en revue de code, discutable plutôt que franchement cassé — carte
> blanche donnée par Hamza pour ajouter une garde, comme sur la modale login (§4.4/PR26).

1. Forcer l'apparition du popup Jack Frost (§14.2/§22.3 — `streak` à 0 en base +
   `previousStreak` en localStorage)
2. Dans le popup, essayer de **sélectionner du texte** (double-clic sur un mot de la
   description) puis relâcher la souris **en dehors** du popup (sur le fond assombri)

- [ ] Le popup **reste ouvert**
3. Cliquer directement, sans sélection, sur le fond assombri en dehors du popup

- [ ] Le popup se ferme normalement (comportement "clic dehors" volontaire, inchangé)

### 23.7 Style "mot de passe oublié"

> Retour design de Léo, pas un bug — carte blanche donnée par Hamza. Texte agrandi et mis en
> gras pour ne plus se lire comme un lien classique, même sans soulignement (déjà retiré en PR25).

- [ ] Sur l'écran de connexion, "Forgot password?" / "Mot de passe oublié ?" se lit maintenant
  comme du texte de formulaire plutôt qu'un lien isolé — avis subjectif à donner (toujours pas
  convaincant ? autre chose à essayer ?)

---

## 24 — Retours de test manuel (Hamza, BDD vierge) — à re-tester par Léo & Damien

> `git pull` sur `develop` (une fois la PR mergée) + `make up`, comme aux sections précédentes.

### 24.1 Écran de victoire — plus de stat communautaire

- [ ] Gagner une partie dans n'importe quel mode → l'écran de victoire ne montre plus de ligne
  du type "X% of N players found this today!"

### 24.2 All-Out Attack — nom qui casse en plein milieu

👉 [http://localhost:8080/allOutAttackMode/allOutAttack.html](http://localhost:8080/allOutAttackMode/allOutAttack.html)

> Surtout visible en français avec des noms longs entre parenthèses (ex : personnages liés à
> une identité secrète).

- [ ] Gagner ou abandonner sur un personnage au nom long en FR → le nom ne se coupe plus en plein
  milieu sur l'écran de victoire (reste entier, retombe proprement à la ligne si besoin)

### 24.3 Code ami — cliquable pour copier

👉 [http://localhost:8080/profile/profile.html](http://localhost:8080/profile/profile.html)

- [ ] Cliquer sur le code ami affiché sous le pseudo → le texte devient "Copié !" pendant ~1,5s
  puis revient au code
- [ ] Coller (Ctrl+V) juste après le clic dans un champ texte quelconque → le bon code apparaît
- [ ] Le code n'a plus l'air "fantôme"/grisé — lisible normalement, avec une icône 📋

### 24.4 Wallpapers — condition traduite + rappel au survol

👉 Profil → section Wallpapers

- [ ] Passer la langue en français (ou autre) → les conditions de déblocage sous chaque
  wallpaper verrouillé sont traduites (plus de texte en anglais)
- [ ] Survoler un wallpaper **déjà débloqué** → un petit rappel de la condition remplie apparaît
  au survol (comme c'est déjà le cas pour les badges/titres)

### 24.5 Badges — bouton Save en bas de la modale

👉 Profil → section Badges → ouvrir "See All Badges"

- [ ] Le bouton "Save" est en bas de la fenêtre (pas en haut), reste visible même en scrollant
  la grille de badges
- [ ] Cliquer dessus → confirmation visuelle claire (le bouton change d'apparence brièvement),
  puis la fenêtre se ferme

### 24.6 Silhouette — image de Seiji

👉 [http://localhost:8080/silhouetteMode/silhouette.html](http://localhost:8080/silhouetteMode/silhouette.html)

- [ ] Si Seiji sort comme personnage du jour (ou via un ami/replay) → l'image de silhouette
  s'affiche correctement, pas cassée/manquante

### 24.7 Musique — thème visuel pour les musiques transversales + bordure P3P

> Nouveauté trouvée en review de code, absente de la description initiale de la PR — vérifiée
> mais jamais testée en navigateur.

👉 [http://localhost:8080/musicsMode/musics.html](http://localhost:8080/musicsMode/musics.html)

- [ ] Si "Aria of the Soul" (présente dans plusieurs jeux Persona) sort comme cible → le lecteur
  prend une teinte bleu profond dédiée, pas la couleur du premier opus de la liste
- [ ] Filtrer sur **P3P** uniquement, jouer une piste → une fine bordure tournante mi-bleue
  mi-rose apparaît autour du lecteur audio
- [ ] Si vous avez un réglage "réduire les animations" activé (OS ou navigateur) → la bordure
  P3P reste visible mais ne tourne plus

### 24.8 Musique — réinitialisation quotidienne (fix technique)

> Le calcul de la date de reset en mode Musique utilisait l'heure UTC au lieu de l'heure de
> Paris (même piège que documenté dans CLAUDE.md pour les streaks) — corrigé silencieusement,
> difficile à observer directement, mais si vous jouez entre ~1h et 3h du matin (heure de Paris,
> selon la saison), notez si le mode Musique se comporte différemment des 5 autres modes pour
> la réinitialisation du jour.

---

## 25 — Victoire post-abandon & défi à cible aléatoire (PR #32) — à tester AVANT prod

> Ces 2 features (décisions produit du 17 juillet) ont été vérifiées par tests
> automatisés (PHPUnit contre vraie MariaDB + Vitest) mais **jamais cliquées dans
> un vrai navigateur**. Le flux défi touche 6 modes + l'API — c'est le test
> manuel le plus important de ce document tant qu'il n'est pas coché.
> Pré-requis : `git pull`, `make up`, et 2 comptes (§2).

### 25.1 Une victoire compte même après un abandon (même jour)

1. Sur un mode au choix (ex : Classique), jouer la partie du jour et **Give Up**
2. Vérifier sur la page profil : le mode compte 1 partie, 0 victoire
3. Revenir sur le mode, cliquer **Replay**, jouer jusqu'à la victoire

- [ ] La victoire est bien comptée : profil → +1 victoire, le give-up du jour est annulé (0 giveup sur ce mode aujourd'hui)
- [ ] En base (phpMyAdmin → `game_sessions`, ligne du jour pour ce mode) : `result = 'win'`
- [ ] `user_stats` : `games` n'a PAS augmenté une 2ᵉ fois (toujours 1 partie pour ce jour)
- [ ] Rejouer encore et re-gagner → pas de double comptage (la 2ᵉ victoire du jour est ignorée, 409 silencieux)
- [ ] admin → 🪵 Logs, recherche `anti_cheat` : **aucune** nouvelle ligne provoquée par ces replays

### 25.2 Défi à cible aléatoire (« un autre guest à deviner »)

1. Compte A : jouer et gagner la partie du jour d'un mode (ex : Musique), cliquer **⚔ Challenge a Friend** → envoyer au compte B
2. Compte B (navigation privée) : jouer d'abord **sa propre partie du jour** dans ce même mode (pour vérifier que le défi ne tombe pas dessus)
3. Compte B : accepter le défi depuis la notification

- [ ] La cible du défi est **différente** de la cible du jour (B ne retombe pas sur ce qu'il vient de jouer — c'était le bug d'origine)
- [ ] Refresh (F5) en pleine partie de défi → même cible de défi conservée, pas de re-tirage
- [ ] Finir le défi (victoire ou give-up) → l'écran de résultat du défi s'affiche (score, Social Link)
- [ ] Après le défi, revenir sur le mode → la **partie du jour normale** est de retour (cible quotidienne, état propre)
- [ ] La partie de défi n'apparaît PAS dans les stats quotidiennes (profil : pas de partie/victoire en plus pour ce mode ce jour-là)
- [ ] Compte A : la notification de résultat du défi arrive (~1 min)
- [ ] Refaire le test sur au moins un 2ᵉ mode (les 6 sont câblés : Classique, Emoji, Silhouette, AOA, Personae, Musique)
- [ ] Filtres opus de B restaurés après le défi (comportement §9 inchangé)

### 25.3 Déploiement (Hamza uniquement)

- [ ] **Migration `sql/migrations/023_challenge_target.sql` appliquée sur Hostinger AVANT de déployer le code** (SSH + `mysql < fichier.sql`, jamais phpMyAdmin — cf. CLAUDE.md §7) ; sans elle, l'INSERT de défi retombe sur le fallback sans cible (défis ancien format, pas de casse mais feature inactive)

## 26 — Code événement pointant vers un badge inexistant (retour Léo, 19 juillet 2026) — à re-tester

> Signalé par Léo : "même si je crée un code pr un badge ça marche tjrs pas". Confirmé : la
> création d'un code événement en admin (§11) ne vérifiait jamais que le `badge_id` saisi
> correspondait à un slug existant dans `badges` — un slug mal tapé se créait sans erreur, puis
> le redeem du code renvoyait quand même succès (200) sans jamais débloquer de badge, sans aucun
> message d'erreur pour comprendre pourquoi.

### 26.1 Création d'un code avec un badge_id invalide → refusée

👉 Panneau admin → onglet "🎟️ Codes événement" (§11)

1. Créer un nouveau code avec un `Badge ID` qui n'existe pas dans le catalogue (ex :
   `ce_badge_nexiste_pas`)

- [ ] La création est **refusée** avec un message clair ("Badge introuvable dans le catalogue"),
  le code n'apparaît pas dans la liste

### 26.2 Création d'un code avec un badge_id valide → toujours fonctionnel

1. Créer un nouveau code avec un `Badge ID` réel (ex : `first_win`)
2. Redeem ce code depuis le profil (§9 ou la modale badges) avec un compte qui n'a pas encore
   ce badge

- [ ] Le code est créé sans erreur, le redeem réussit et le badge apparaît débloqué dans la
  collection du compte qui a redeem

> 💡 Si vous avez encore un vieux code cassé créé avant ce fix (badge_id introuvable), le
> redeem doit maintenant échouer avec une erreur explicite au lieu de renvoyer un faux succès —
> et ne doit pas "consommer" votre essai (vous pourrez le redeem normalement une fois le
> badge_id corrigé côté admin).

## 27 — Code événement créé en admin invisible en jeu (vidéo Léo, 19 juillet 2026) — à re-tester

> Signalé par Léo (vidéo à l'appui) : il crée un code en admin (`QATEST2026` → `ace_defective`,
> actif, permanent), va dans son profil, entre le code — "❌ Invalid code. Check your spelling!"
> alors que le code est bien actif côté admin (0 utilisation, jamais fonctionnel pour personne).
>
> Root cause, différente du §26 : le champ "Entrer un code" du profil ne parlait **jamais** au
> serveur. `handleEventCodeSubmit()` (`profile/badges/badgesManager.js`) validait contre un
> dictionnaire JS codé en dur (`eventCodes` dans `badgesData.js`) — recopié à la main depuis la
> table `event_codes` à un moment donné, jamais synchronisé depuis. Tout code créé (ou modifié)
> en admin après ce recopiage était invisible du dictionnaire JS → "Invalid code" pour 100% des
> joueurs, éternellement, sans nouveau déploiement de code. Les codes plus anciens (`ALIBABA`,
> `GOURMET`, `XMAS2025`…) fonctionnaient par coïncidence : ils étaient présents des deux côtés.
>
> Fix : `handleEventCodeSubmit()` appelle maintenant réellement `POST /api/badges/redeem`
> (l'endpoint déjà fixé au §26) au lieu du dictionnaire local — un code créé en admin marche
> immédiatement, sans déploiement.

1. Panneau admin → onglet "🎟️ Codes événement" (§11) : créer un nouveau code permanent avec un
   `Badge ID` valide que vous n'avez pas encore débloqué (ex : `first_win` si pas déjà eu)
2. Aller sur le profil → section Badges → champ "Entrer un code événement"
3. Entrer le code fraîchement créé, cliquer "Utiliser"

- [ ] Le badge se débloque **immédiatement**, sans rien redéployer ni redémarrer le serveur
- [ ] Réessayer le même code → message "already redeemed", pas de double déblocage
- [ ] Un code inexistant → message d'erreur clair (pas de crash, pas de blocage de l'UI)
- [ ] Un des anciens codes secrets encore actifs (ex : `GOURMET`, `DZULIAN`, `ARATI` — voir §11
  pour la liste, avec un compte qui ne l'a pas encore) → fonctionne toujours normalement

## 28 — Collab Discord, portugais (PT) & modale "Historique des MAJ" (23 juillet 2026) — à tester par Léo

> Lot de 4 PR : modale Discord (accueil + FAQ), ajout du portugais comme 6ᵉ langue, boutons
> illustrés FR/ES/DE/IT/PT redimensionnés (poids divisé par ~10-15, aucun changement visuel
> attendu), et contenu complété de la modale "Historique des MAJ".

### 28.1 Modale Discord — accueil ET FAQ

👉 [http://localhost:8080/index.html](http://localhost:8080/index.html) puis
[http://localhost:8080/pages/faq.html](http://localhost:8080/pages/faq.html)

1. Sur l'accueil, cliquer l'icône Discord dans les liens sociaux (bas de page)
2. Sur la FAQ, ouvrir la question "Is there a Discord server?" (catégorie Community) puis
   cliquer "Join the Discord →"

- [ ] Dans les deux cas, une modale s'ouvre (pas de redirection directe) présentant **deux**
  serveurs côte à côte : Le Grimoire du Cœur (FR) et PersonaDLE (international)
- [ ] Les deux icônes de serveur s'affichent (pas d'image cassée)
- [ ] Fermeture au clic sur le X, au clic en dehors de la modale (overlay), et à la touche
  Échap — testez les 3 sur au moins une des deux pages
- [ ] Les boutons "Join" de chaque carte ouvrent bien le bon serveur Discord dans un nouvel
  onglet

### 28.2 Portugais — 6ᵉ langue

👉 N'importe quelle page avec le sélecteur de langue (accueil, FAQ, confidentialité, profil)

1. Ouvrir le sélecteur de langue → vérifier la présence de l'option "Português" (personnage
   Matador)
2. Sélectionner le portugais

- [ ] Toute l'interface bascule en portugais (pas de texte resté en anglais qui traînerait)
- [ ] Aller sur un mode de jeu (ex : Classique) → les 4 boutons illustrés (Índice, Desistir,
  Jogar de Novo, Confirmar) s'affichent nets, texte lisible, pas flous ni pixelisés
- [ ] Survoler les boutons → pas de crash, l'état visuel change (même sans variante rouge
  dédiée pour le PT — comportement voulu, pas un bug)

### 28.3 Boutons illustrés FR/ES/DE/IT — contrôle visuel post-recompression

> Ces boutons ont été redimensionnés pour diviser leur poids par ~10-15 (ils étaient exportés
> 2x plus grands que nécessaire). Aucun changement de contenu — juste une vérification qu'il
> n'y a pas eu de perte de qualité au passage.

👉 Basculer successivement en FR, ES, DE, IT (§28.2) et aller sur un mode de jeu

- [ ] Dans chaque langue, les 4 boutons (indice/abandonner/rejouer/valider et équivalents)
  restent nets, sans flou ni artefact de compression visible
- [ ] Le survol (variante rouge) fonctionne toujours normalement

### 28.4 Modale "Historique des MAJ" — contenu complété

👉 Accueil → bouton "📰 News" en bas à droite → dérouler "Version 2.0 — Major Update"

- [ ] La liste contient désormais un bullet **"New Characters"** (nouveaux personnages —
  antagonistes, Persona 5 Strikers, Phantom Idols P5X, exclusivités All-Out Attack)
- [ ] La liste contient désormais un bullet **"Discord Collab"**
- [ ] Vérifier dans au moins une langue autre que l'anglais (ex : FR) que ces deux bullets
  sont bien traduits, pas restés en anglais

### 📸 TODO — Screenshots README à refaire

> Pas un test à cocher — une tâche à part pour Léo (Data & Design) avant la sortie de la 2.0.

Le `README.md` (captures d'écran de présentation du jeu) montre encore l'**ancien design des
pages** — le refonte visuelle n'y est pas reflétée, pas juste du contenu manquant (collab
Discord, portugais). À refaire avant la sortie officielle de la 2.0 pour éviter que les
captures ne montrent une version visuellement obsolète du site aux nouveaux visiteurs du repo
GitHub.

---

*PersonaDLE v2.0 — Plan de test généré le 26 juin 2026, corrigé et complété le 17 juillet 2026,
complété le 23 juillet 2026 (collab Discord, portugais, modale MAJ).*
*À mettre à jour si de nouvelles fonctionnalités sont ajoutées avant la fin de la phase de test.*
