# PersonaDLE v2.0 — Plan de Test QA

> **Document destiné au testeur.**  
> Parcourir chaque section dans l'ordre. Cocher chaque case ✅ une fois la vérification confirmée.  
> Toute case non cochée = bug à remonter avant validation.

---

## Sommaire

1. [Environnement de test](#1--environnement-de-test)
2. [Lancer le projet (Docker)](#2--lancer-le-projet-docker)
3. [Comptes de test à créer](#3--comptes-de-test-à-créer)
4. [Tests automatisés](#4--tests-automatisés)
5. [Auth & Comptes](#5--auth--comptes)
6. [6 Modes de jeu](#6--6-modes-de-jeu)
7. [Système de filtres](#7--système-de-filtres)
8. [Profil utilisateur](#8--profil-utilisateur)
9. [Badges](#9--badges)
10. [Titres & Wallpapers](#10--titres--wallpapers)
11. [Système d'amis](#11--système-damis)
12. [Social Link](#12--social-link)
13. [Défis quotidiens](#13--défis-quotidiens)
14. [Leaderboard](#14--leaderboard)
15. [Notifications](#15--notifications)
16. [Panneau Admin](#16--panneau-admin)
17. [Internationalisation (i18n)](#17--internationalisation-i18n)
18. [Dark Mode & Accessibilité](#18--dark-mode--accessibilité)
19. [Profile Card Export (PNG)](#19--profile-card-export-png)
20. [Streak Recovery](#20--streak-recovery)
21. [Cloud Sync & Offline-first](#21--cloud-sync--offline-first)
22. [Sécurité](#22--sécurité)
23. [Responsive & Compatibilité](#23--responsive--compatibilité)
24. [Revue de la documentation](#24--revue-de-la-documentation)
25. [Revue du code & commentaires](#25--revue-du-code--commentaires)
26. [Revue des tests automatisés](#26--revue-des-tests-automatisés)
27. [Suggestions d'amélioration](#27--suggestions-damélioration)

---

## 1 — Environnement de test

### Prérequis

| Outil | Version minimale | Vérification |
|-------|-----------------|-------------|
| Docker | 24+ | `docker --version` |
| Docker Compose | 2.x (plugin) | `docker compose version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Navigateur | Chrome 90+ ou Firefox 88+ | — |

### Répertoire du projet

```
/home/pchamza/Project/personadle/
├── docker-compose.yml   ← stack Docker (MariaDB + PHP/Apache + PhpMyAdmin)
├── docker/              ← Dockerfile PHP, php.ini, seed SQL
├── api/                 ← Backend PHP 8.3
├── sql/                 ← Schémas BDD
├── js/ / css/ / lang/   ← Frontend vanilla
└── tests/               ← 190 tests Vitest
```

### URLs d'accès (une fois Docker lancé)

| Service | URL |
|---------|-----|
| **Site** | http://localhost:8080 |
| **PhpMyAdmin** | http://localhost:8081 |
| **API (test)** | http://localhost:8080/api/auth/me |

---

## 2 — Lancer le projet (Docker)

### Premier lancement

```bash
# 1. Se placer dans le dossier du projet
cd /home/pchamza/Project/personadle

# 2. (Optionnel) Copier le .env si tu veux surcharger les ports
cp .env.example .env  # puis éditer si besoin

# 3. Construire les images et démarrer les conteneurs
docker compose up -d --build

# 4. Attendre ~30 secondes que MariaDB soit prête (healthcheck auto)
docker compose ps   # attendre que db soit "healthy"

# 5. Vérifier que les 3 conteneurs tournent
docker compose ps
# Doit afficher : personadle_db (healthy), personadle_php (running), personadle_pma (running)
```

### Credentials par défaut

| Rôle | Valeur |
|------|--------|
| DB User | `personadle_usr` |
| DB Pass | `devpassword` |
| DB Name | `personadle_db` |
| PhpMyAdmin | user: `personadle_usr` / pass: `devpassword` |

### Commandes utiles

```bash
# Redémarrer sans rebuild
docker compose up -d

# Voir les logs PHP/Apache en temps réel
docker compose logs -f php

# Voir les logs MariaDB
docker compose logs -f db

# Arrêter proprement
docker compose down

# Reset COMPLET (supprime la BDD — tout repart de zéro)
docker compose down -v
docker compose up -d --build

# Lancer un shell dans le conteneur PHP
docker compose exec php bash

# Lancer les migrations manuellement (si besoin)
docker compose exec php bash
mysql -h db -u personadle_usr -pdevpassword personadle_db < /var/www/html/api/migrations/011_event_codes_moderation.sql
```

### Installer les dépendances Node (une seule fois)

```bash
cd /home/pchamza/Project/personadle
npm install
```

### Activer les git hooks (recommandé)

```bash
git config core.hooksPath .githooks
```

---

## 3 — Comptes de test à créer

Créer ces 3 comptes via http://localhost:8080 **avant** de commencer les tests.

| Compte | Email | Pseudo | Rôle |
|--------|-------|--------|------|
| Admin | admin@test.com | AdminTest | Promouvoir en admin (voir ci-dessous) |
| User A | usera@test.com | PlayerA | Compte principal de test |
| User B | userb@test.com | PlayerB | Compte secondaire (tests amis/défis) |

### Promouvoir AdminTest en admin

Après inscription sur http://localhost:8080 :

```bash
# Via PhpMyAdmin → onglet SQL
# Ou via terminal :
docker compose exec db mysql -u personadle_usr -pdevpassword personadle_db \
  -e "UPDATE users SET is_admin = 1 WHERE pseudo = 'AdminTest';"
```

---

## 4 — Tests automatisés

```bash
cd /home/pchamza/Project/personadle

# Lancer les 190 tests Vitest
npm test
```

- [ ] **190 tests passants, 0 échec**
- [ ] Aucun test skipped (`skip` / `todo`) sans raison documentée

```bash
# Vérifier la cohérence des clés i18n
npm run i18n:check
```

- [ ] **0 clé manquante** dans fr.json, es.json, de.json, it.json
- [ ] Aucune clé en surplus dans les traductions

---

## 5 — Auth & Comptes

### 5.1 Inscription

1. Aller sur http://localhost:8080
2. Cliquer sur "Sign Up" / "Créer un compte"
3. Remplir : email valide, pseudo unique, mot de passe (min 8 caractères)
4. Valider

- [ ] Le compte est créé sans erreur
- [ ] L'utilisateur est connecté automatiquement après inscription
- [ ] La navbar/UI passe en mode "connecté" (pseudo affiché, pas de bouton "Sign In")
- [ ] Tester un email déjà utilisé → message d'erreur clair
- [ ] Tester un pseudo déjà pris → message d'erreur clair
- [ ] Tester un mot de passe trop court → message d'erreur clair

### 5.2 Connexion

1. Se déconnecter (si connecté)
2. Aller sur "Sign In"
3. Entrer email + mot de passe valides

- [ ] Connexion réussie, session créée
- [ ] Profil chargé depuis le cloud (pseudo, avatar, stats)
- [ ] Tester un mauvais mot de passe → erreur "Invalid credentials"
- [ ] Tester un email inexistant → erreur

### 5.3 Déconnexion

1. Cliquer sur "Logout" depuis le profil ou la navbar

- [ ] Session PHP détruite
- [ ] UI repasse en mode "déconnecté"
- [ ] Rechargement de page → toujours déconnecté (pas de session fantôme)

### 5.4 Remember Me / Persistance

1. Cocher "Remember Me" lors de la connexion
2. Fermer complètement le navigateur
3. Rouvrir et aller sur http://localhost:8080

- [ ] L'utilisateur est toujours connecté (token remember_me)

### 5.5 Rate Limiting sur le login

1. Faire 6 tentatives de connexion avec un mauvais mot de passe en moins d'une minute

- [ ] À la 6ème tentative : réponse `429 Too Many Requests`
- [ ] Message d'erreur lisible affiché

### 5.6 Compte banni

1. Avec AdminTest, bannir PlayerA depuis l'admin (`/admin/`)
2. Essayer de se connecter avec PlayerA

- [ ] Connexion refusée, message "Account suspended" ou équivalent
- [ ] Session précédente détruite (si PlayerA était déjà connecté, `me.php` retourne `banned: true`)

---

## 6 — 6 Modes de jeu

> Tester chaque mode avec le compte **PlayerA**.  
> Pour chaque mode : une partie complète en mode normal, puis tester les cas limites.

### 6.1 Mode Classique

URL : http://localhost:8080/classiqueMode/classiqueMode.html

1. Chercher un personnage via l'autocomplétion
2. Soumettre une réponse

- [ ] L'autocomplétion affiche des personnages avec portraits
- [ ] Soumission affiche une ligne de résultat avec les 7 attributs colorés (vert / orange / rouge)
- [ ] Les attributs corrects sont verts, partiels oranges, faux rouges
- [ ] La grille de résultats est scrollable si nécessaire
- [ ] Trouver le bon personnage → animation confettis + son victoire
- [ ] Tentative de trouver le personnage → session enregistrée en BDD (`game_sessions`)
- [ ] Rejouer → le jeu reset, nouvelle cible
- [ ] Give-up → révèle la réponse
- [ ] Quote du personnage affichée après victoire
- [ ] Stat communautaire "X% found it" affichée (si backend répond)

### 6.2 Mode Emoji

URL : http://localhost:8080/emojiMode/emojiMode.html

- [ ] Séquence d'emojis affichée progressivement à chaque mauvaise réponse
- [ ] Portraits dans l'historique des erreurs
- [ ] Victoire → confettis + son
- [ ] Session enregistrée en BDD

### 6.3 Mode Silhouette

URL : http://localhost:8080/silhouetteMode/silhouetteMode.html

- [ ] Silhouette progressivement révélée (zoom out à chaque mauvaise réponse)
- [ ] Victoire → image en couleur + confettis
- [ ] Session enregistrée en BDD

### 6.4 Mode All-Out Attack

URL : http://localhost:8080/allOutAttackMode/allOutAttack.html

- [ ] GIF animé affiché (flou/masqué)
- [ ] Cache LRU fonctionne (pas de rechargement GIF déjà vu)
- [ ] Victoire → confettis + son
- [ ] Session enregistrée en BDD

### 6.5 Mode Personae

URL : http://localhost:8080/personaeMode/personaeMode.html

- [ ] Persona affichée (pas le personnage)
- [ ] Réponse correcte → le personnage associé révélé
- [ ] Session enregistrée en BDD

### 6.6 Mode Musique

URL : http://localhost:8080/musicsMode/musics.html

- [ ] Lecteur audio custom affiché (style Persona 5)
- [ ] La piste joue avec les animations de barres sonores
- [ ] Thème de couleur change selon l'opus de la piste (P5 = rouge, P3 = bleu, etc.)
- [ ] Pochette album affichée correctement
- [ ] Bouton Skip → change de piste
- [ ] Deviner le personnage → victoire
- [ ] Session enregistrée en BDD
- [ ] Vérifier qu'au moins une piste P3P, P4AU, P5T, P5S est accessible dans les filtres

### 6.7 Reset quotidien

- [ ] Jouer une partie → revenir le lendemain (ou modifier la date système)
- [ ] La cible est nouvelle, l'historique du jour précédent est conservé dans les stats

---

## 7 — Système de filtres

> Tester dans le Mode Classique puis vérifier que la logique s'applique aux autres modes.

### 7.1 Sélection d'opus

1. Ouvrir le panneau filtres
2. Décocher P5, P5R (garder P3, P4)

- [ ] La liste d'autocomplétion ne propose que des personnages P3 et P4
- [ ] Le filtre est sauvegardé dans localStorage
- [ ] Recharger la page → les filtres sont rétablis

### 7.2 Sous-filtres (P5 → P5R, P5S, P5T, P5X)

1. Activer P5 puis cliquer sur la flèche pour voir les sous-filtres
2. Décocher P5R mais laisser P5, P5S, P5T

- [ ] Seuls les personnages P5, P5S, P5T apparaissent (pas P5R)
- [ ] La migration du format ancien (P5 générique → sous-codes) ne ré-expand pas une sélection précise

### 7.3 Guard pool vide

1. Décocher tous les opus

- [ ] Un message d'avertissement est affiché ("Aucun filtre sélectionné" ou similaire)
- [ ] Aucun crash JavaScript dans la console

### 7.4 Filtres Music Mode

1. Aller dans le Mode Musique
2. Vérifier que P4AU et P5T sont présents comme filtres

- [ ] P4AU s'affiche avec son logo
- [ ] P5T s'affiche avec son logo
- [ ] Les tracks correspondantes sont incluses dans le pool

---

## 8 — Profil utilisateur

URL : http://localhost:8080/profile/profile.html (ou bouton profil en bas)

### 8.1 Affichage initial

- [ ] Pseudo affiché correctement
- [ ] Avatar par défaut si aucun avatar uploadé
- [ ] Stats par mode affichées (wins, streak, games)
- [ ] Titre équipé affiché sous le pseudo (si débloqué)

### 8.2 Édition du pseudo

1. Cliquer sur l'icône d'édition du pseudo
2. Changer le pseudo
3. Observer le bouton "Sauvegarder"

- [ ] Le bouton "Sauvegarder" **n'apparaît que** quand une modification est faite (dirty-state)
- [ ] Sauvegarder → pseudo mis à jour en BDD
- [ ] Reload de la page → nouveau pseudo conservé
- [ ] Pseudo déjà pris → erreur

### 8.3 Upload avatar

1. Cliquer sur l'avatar
2. Uploader une image (JPG ou PNG)
3. Cropper via l'interface canvas

- [ ] L'outil de crop s'affiche
- [ ] L'avatar est enregistré en base64 WebP dans la BDD
- [ ] L'avatar s'affiche sur le profil après sauvegarde
- [ ] Tester une image trop grande → pas de crash (redimensionnement auto)

### 8.4 Sélection wallpaper

1. Aller dans la section wallpapers du profil
2. Sélectionner un wallpaper disponible

- [ ] Le fond d'écran change sur la page profil
- [ ] La modification est persistée après reload

### 8.5 Profil public (vue d'un autre joueur)

1. Aller sur le profil de PlayerB depuis le compte PlayerA
2. URL : `/profile/profile.html?view=CODE_AMI_PLAYERB`

- [ ] Le profil s'affiche en mode lecture seule
- [ ] Le bouton "Sauvegarder" n'est pas visible
- [ ] Pseudo, avatar, badges épinglés, titre affichés correctement
- [ ] L'XP Social Link est gagné automatiquement au chargement (visite profil ami)

### 8.6 Export / Import JSON

1. Exporter le profil en JSON (bouton Export)
2. Dans un autre navigateur ou après reset, importer le JSON

- [ ] Export génère un fichier JSON téléchargeable
- [ ] Import restaure les données correctement

---

## 9 — Badges

### 9.1 Unlock via gameplay

Réaliser les actions suivantes et vérifier le déblocage :

- [ ] **First Win** — Gagner une partie dans n'importe quel mode
- [ ] **One Shot** — Gagner en 1 essai dans n'importe quel mode
- [ ] **Night Owl** — Jouer après minuit (23h55+ Paris si faisable)

Pour chaque badge débloqué :
- [ ] Animation de déblocage jouée (notification visuelle)
- [ ] Badge visible dans la collection du profil

### 9.2 Redeem un code événement

1. Depuis l'AdminTest, créer un code événement dans `/admin/` → Codes
   - Code : `TEST-2026`
   - Badge cible : n'importe quel badge non encore débloqué
   - Quota : 10
   - Expiration : dans 1 heure

2. Depuis PlayerA, aller dans le profil → section badges → "Redeem code"
3. Saisir `TEST-2026`

- [ ] Code accepté, badge débloqué
- [ ] Message de confirmation affiché
- [ ] Ressaisir le même code → erreur "Code déjà utilisé"
- [ ] Saisir un code inexistant → erreur claire

### 9.3 Épingler des badges

1. Ouvrir la collection de badges
2. Sélectionner 4 badges à épingler

- [ ] Maximum 4 badges épinglés (le 5ème remplace le moins récent ou affiche une erreur)
- [ ] Les badges épinglés apparaissent sur le profil public
- [ ] La sélection est persistée après reload

---

## 10 — Titres & Wallpapers

### 10.1 Débloquer un titre

Réaliser la condition d'un titre simple (ex : "Phantom Thief" = 10 victoires Classic) :

- [ ] Après la condition remplie, le titre apparaît dans la liste des titres débloqués
- [ ] Équiper le titre → il s'affiche sous le pseudo sur le profil
- [ ] Un seul titre équipé à la fois
- [ ] Changer de titre → l'ancien est retiré, le nouveau s'affiche

### 10.2 Wallpapers

- [ ] Les wallpapers par défaut (`is_default = true`) sont accessibles sans condition
- [ ] Les wallpapers verrouillés ne peuvent pas être sélectionnés sans déblocage
- [ ] La sélection d'un wallpaper est sauvegardée en BDD

---

## 11 — Système d'amis

URL : http://localhost:8080/profile/friends/friends.html

### 11.1 Recherche & ajout

1. Avec PlayerA, chercher PlayerB par pseudo
2. Envoyer une demande d'ami

- [ ] La recherche retourne PlayerB
- [ ] La demande est envoyée (statut "pending")

### 11.2 Accepter une demande

1. Se connecter avec PlayerB
2. Aller dans Amis → Demandes reçues
3. Accepter la demande de PlayerA

- [ ] PlayerA apparaît dans la liste d'amis de PlayerB
- [ ] PlayerB apparaît dans la liste d'amis de PlayerA

### 11.3 Recherche par code ami

1. Récupérer le code ami de PlayerB (affiché dans son profil)
2. Depuis PlayerA, chercher par ce code

- [ ] PlayerB trouvé directement par son code unique (8 caractères)

### 11.4 Statut online

1. PlayerB est connecté et actif
2. PlayerA regarde sa liste d'amis

- [ ] Un indicateur vert (dot online) est visible sur la carte de PlayerB

### 11.5 Supprimer un ami

1. PlayerA supprime PlayerB de ses amis

- [ ] PlayerB disparaît de la liste d'amis de PlayerA
- [ ] PlayerA disparaît de la liste d'amis de PlayerB

### 11.6 Browse Players

1. Aller sur l'onglet "Browse Players" (liste de tous les joueurs)

- [ ] Liste paginée des joueurs
- [ ] Possibilité d'envoyer une demande depuis la liste
- [ ] Pagination fonctionne (page 2, etc.)

### 11.7 Animations de demandes d'amis

> Tester les 3 styles dans Settings.

**Calling Card (🃏)**
- [ ] Animation carte manuscrite style Phantom Thieves jouée à la réception d'une demande
- [ ] Boutons Accepter / Refuser fonctionnels dans l'animation

**P4 TV (📺)**
- [ ] Animation TV Persona 4 jouée (écran TV allumé, avatar)
- [ ] L'animation reste en attente jusqu'à un choix (overlay stable, pas de disparition intempestive)
- [ ] Animation burst avatar au-dessus de la TV visible (non clippée)

**P3 Evoker (🔫)**
- [ ] Animation Evoker Persona 3 jouée
- [ ] Boutons Accepter / Refuser fonctionnels

---

## 12 — Social Link

### 12.1 Gain d'XP — Visite de profil

1. PlayerA visite le profil de PlayerB

- [ ] XP Social Link gagné automatiquement (sans clic de bouton)
- [ ] Le rang est visible dans la jauge Social Link sur le profil de PlayerB

### 12.2 Gain d'XP — Comparaison stats

1. PlayerA clique sur "Comparer les stats" avec PlayerB

- [ ] Overlay de comparaison radar s'ouvre
- [ ] Animations séquentielles des barres
- [ ] XP Social Link gagné automatiquement (via l'appel API /api/user/compare)

### 12.3 Progression des rangs

1. Accumuler assez d'XP pour passer du rang 1 (Stranger) au rang 2 (Acquaintance)

- [ ] Animation de rang-up Persona style jouée (toast ou overlay)
- [ ] Le nouveau rang est affiché dans la jauge
- [ ] Les deux joueurs (PlayerA et PlayerB) voient le rang-up

### 12.4 True Confidant (rang 10)

> Long à tester en conditions réelles — vérifier via BDD si nécessaire.

```bash
# Forcer le rang 10 via BDD pour le test :
docker compose exec db mysql -u personadle_usr -pdevpassword personadle_db -e "
  UPDATE social_links SET rank = 10, xp = 2700
  WHERE (user_a_id = (SELECT id FROM users WHERE pseudo='PlayerA')
      AND user_b_id = (SELECT id FROM users WHERE pseudo='PlayerB'))
     OR (user_b_id = (SELECT id FROM users WHERE pseudo='PlayerA')
      AND user_a_id = (SELECT id FROM users WHERE pseudo='PlayerB'));"
```

- [ ] Halo doré pulsant autour de l'avatar de PlayerB visible depuis PlayerA
- [ ] Animation burst 8 particules + label typewriter "✦ True Confidant" au chargement
- [ ] L'effet est visible aussi dans la liste d'amis

---

## 13 — Défis quotidiens

### 13.1 Envoyer un défi

1. PlayerA va dans Amis → PlayerB → "Envoyer un défi"
2. Choisir le mode Classic, sélectionner des filtres
3. Envoyer

- [ ] Le défi est envoyé (visible dans les messages de PlayerB)
- [ ] Un seul défi par mode par jour entre deux amis (doublon refusé)

### 13.2 Bandeau défi actif

1. PlayerB se connecte et ouvre le Mode Classique

- [ ] Un bandeau en haut de la page indique le défi de PlayerA
- [ ] Le bandeau affiche le mode, le nom de l'expéditeur et les filtres actifs

### 13.3 Résolution par victoire

1. PlayerB joue le mode indiqué et trouve le personnage

- [ ] `checkChallengeCompletion(true)` est appelé
- [ ] Le défi est marqué comme résolu (win) côté BDD
- [ ] XP Social Link (+15 pour l'envoi du défi, +35 pour la victoire)
- [ ] PlayerA reçoit une notification du résultat

### 13.4 Résolution par give-up

1. PlayerB clique sur "Give Up" pendant le défi

- [ ] `checkChallengeCompletion(false)` est appelé
- [ ] Le défi est marqué comme résolu (loss) côté BDD
- [ ] PlayerA reçoit une notification de défaite de PlayerB

### 13.5 Restauration des filtres après défi

1. PlayerB avait des filtres P4+P5 actifs avant le défi P3 de PlayerA
2. Après résolution du défi

- [ ] Les filtres de PlayerB reviennent à P4+P5 automatiquement

---

## 14 — Leaderboard

URL : http://localhost:8080/profile/leaderboard/leaderboard.html

### 14.1 Filtres

Tester chaque combinaison de filtres :

- [ ] **Mode** : All / Classic / Emoji / Silhouette / All-Out / Personae / Music
- [ ] **Période** : All time / Month / Week / Today
- [ ] **Métrique** : Wins / Win Rate / Best Streak / Perfect / Games Played
- [ ] **Scope** : Global / Friends only

Pour chaque filtre changé :
- [ ] La liste se recharge avec les bonnes données
- [ ] Aucun crash (pool vide = message "No data yet")

### 14.2 Pagination

1. Vérifier qu'il y a plusieurs pages (créer des comptes si nécessaire)

- [ ] Boutons "Page suivante / précédente" fonctionnels
- [ ] La page courante est mise en évidence

### 14.3 Ma position (my_rank)

1. Être connecté avec PlayerA qui a des stats

- [ ] Un encart "Ma position" est toujours visible en bas (même si hors de la page affichée)
- [ ] Le rang et le score sont corrects

### 14.4 Scope Friends

1. PlayerA et PlayerB sont amis
2. Activer le filtre "Friends only"

- [ ] Seuls les amis de PlayerA apparaissent dans le classement
- [ ] PlayerA lui-même apparaît

---

## 15 — Notifications

### 15.1 Polling résultats de défis

1. PlayerB a relevé un défi de PlayerA
2. PlayerA navigue sur une page non-jeu (ex: profil)

- [ ] Après maximum 60 secondes, l'animation de résultat de défi joue pour PlayerA
- [ ] L'animation indique win ou loss selon le résultat de PlayerB
- [ ] L'animation ne rejoue pas si PlayerA rafraîchit la page (flag `_crInitDone_ID`)

### 15.2 Notification rank-up Social Link

1. PlayerA monte en rang avec PlayerB

- [ ] PlayerA ET PlayerB reçoivent tous les deux une notification de rang-up
- [ ] Le nouveau rang est correctement indiqué dans la notification

### 15.3 Changement de compte

1. PlayerA reçoit une animation de défi
2. PlayerA se déconnecte, PlayerC se connecte sur la même session

- [ ] PlayerC ne voit PAS l'animation de PlayerA (flags namespaced par user_id)

---

## 16 — Panneau Admin

URL : http://localhost:8080/admin/  
*(Se connecter avec AdminTest)*

### 16.1 Accès

- [ ] Accessible uniquement avec un compte `is_admin = 1`
- [ ] Compte non-admin → redirection ou 403

### 16.2 Dashboard

- [ ] Statistiques globales affichées (comptes actifs, parties du jour)
- [ ] Activité récente visible

### 16.3 Gestion utilisateurs

1. Rechercher PlayerA par pseudo

- [ ] Fiche utilisateur complète (stats, badges, titres, amis)
- [ ] Bouton "Ban" fonctionne → `is_banned = 1` en BDD
- [ ] Bouton "Unban" fonctionne → `is_banned = 0`
- [ ] Bouton "Lock pseudo" fonctionne → PlayerA ne peut plus changer son pseudo

### 16.4 Attribution de badge

1. Trouver PlayerA, aller dans l'onglet Badges
2. Sélectionner un badge et cliquer "Appliquer"

- [ ] Badge enregistré dans `badges_unlocked` pour PlayerA
- [ ] PlayerA voit le badge dans sa collection après reload

### 16.5 Codes événement

1. Aller dans l'onglet Codes
2. Créer un code : `QA-2026`, badge cible, quota 5, expiration demain

- [ ] Code créé visible dans la liste
- [ ] Redeem via PlayerA → succès (voir §9.2)
- [ ] Expirer le code via admin → PlayerB essaie de le redeem → erreur "Code expiré"

### 16.6 Modération mobile

1. Ouvrir l'admin sur mobile (ou DevTools 375px)

- [ ] Sidebar en drawer (hamburger)
- [ ] Toutes les actions accessibles sur mobile

---

## 17 — Internationalisation (i18n)

### 17.1 Changement de langue

1. Cliquer sur le sélecteur de langue (🌐 EN ▼)
2. Passer successivement en FR, ES, DE, IT, puis retour EN

Pour chaque langue :
- [ ] L'interface se traduit entièrement (boutons, labels, messages d'erreur)
- [ ] Les boutons de jeu (Hint, Give-Up, Submit, Replay) affichent l'image localisée
- [ ] Le nom des personnages **ne se traduit pas** (Ryuji reste Ryuji)
- [ ] Les termes lore ne se traduisent pas ("All-Out Attack", "Velvet Room")

### 17.2 Persistance de la langue

1. Passer en FR
2. Recharger la page

- [ ] La langue FR est conservée
- [ ] Si connecté, la langue est syncée en BDD (changer de navigateur = même langue)

### 17.3 Fallback EN

1. Simuler une clé manquante dans fr.json (temporairement)
2. Recharger en mode FR

- [ ] La valeur EN s'affiche au lieu d'une clé brute

---

## 18 — Dark Mode & Accessibilité

### 18.1 Dark Mode

1. Activer le dark mode depuis les paramètres

- [ ] L'interface passe en fond sombre
- [ ] Les logos d'opus dans les filtres restent lisibles (fond coloré, pas d'inversion)
- [ ] Reload → dark mode conservé

### 18.2 Mode daltonien

1. Activer le mode daltonien dans les paramètres

- [ ] Les couleurs de feedback de la grille Classique changent (orangé → motifs / couleurs adaptées)
- [ ] Reload → mode conservé

---

## 19 — Profile Card Export (PNG)

### 19.1 Export basique

1. Depuis le profil, cliquer sur "Share / Export"
2. Laisser le thème par défaut
3. Cliquer "Download"

- [ ] Un fichier PNG est téléchargé (780×1386px environ)
- [ ] Le PNG contient : avatar, pseudo, badges épinglés, titre, stats principales

### 19.2 Thèmes

1. Essayer les 8 thèmes disponibles dans la modale d'export

- [ ] Chaque thème change le style visuel de la carte (couleurs, polices)
- [ ] Le PNG reflète le thème sélectionné

### 19.3 Wallpapers sur la carte

1. Sélectionner un wallpaper dans la modale d'export

- [ ] Le fond de la carte change avec le wallpaper sélectionné

### 19.4 Boutons de partage

- [ ] Bouton "X (Twitter)" → ouvre Twitter avec texte prérempli et image
- [ ] Bouton "Discord" → copie dans le presse-papier ou ouvre Discord
- [ ] Bouton "Email" → ouvre le client email

---

## 20 — Streak Recovery

### 20.1 Affichage du bouton

1. S'assurer que PlayerA a une streak de 0 (perdre une série)

```bash
# Forcer streak = 0 via BDD pour le test :
docker compose exec db mysql -u personadle_usr -pdevpassword personadle_db -e "
  UPDATE user_stats SET streak = 0
  WHERE user_id = (SELECT id FROM users WHERE pseudo = 'PlayerA')
  AND mode = 'classic';"
```

2. Aller sur le profil de PlayerA, section Stats

- [ ] Un bouton "🔥 Restore Streak" est visible
- [ ] Si la streak est > 0 → bouton **non visible**

### 20.2 Utiliser la récupération

1. Cliquer sur "🔥 Restore Streak"
2. Confirmer dans le menu Jack Frost

- [ ] La streak est restaurée (valeur précédente ou 1)
- [ ] Le bouton disparaît après utilisation

### 20.3 Cooldown

1. Réutiliser la récupération immédiatement (sans attendre 2 mois)

- [ ] Bouton grisé ou absent
- [ ] Message d'erreur "Recovery available in X days" ou équivalent

---

## 21 — Cloud Sync & Offline-first

### 21.1 Sync au login

1. Jouer une partie sans être connecté (mode localStorage)
2. Se connecter avec PlayerA

- [ ] Les sessions locales sont envoyées à l'API (`syncPending()`)
- [ ] Les stats en BDD reflètent les parties jouées offline

### 21.2 Offline → Online

1. Ouvrir DevTools → Network → mettre en mode "Offline"
2. Jouer une partie

- [ ] La partie se joue normalement
- [ ] La session est mise en queue dans localStorage (`pendingSessions`)
3. Remettre Online

- [ ] La session en attente est envoyée automatiquement à la reconnexion
- [ ] Aucune session dupliquée (409 → silencieux, pas d'erreur utilisateur)

### 21.3 Source de vérité cloud

1. Modifier manuellement le pseudo en BDD :
```bash
docker compose exec db mysql -u personadle_usr -pdevpassword personadle_db -e "
  UPDATE users SET pseudo = 'CloudPseudo'
  WHERE pseudo = 'PlayerA';"
```
2. Attendre 3 minutes (sync périodique) ou naviguer vers le profil

- [ ] Le pseudo "CloudPseudo" apparaît dans l'UI sans rechargement manuel

---

## 22 — Sécurité

### 22.1 Validation avatar

1. Essayer d'uploader un fichier PHP ou SVG comme avatar

- [ ] Refusé côté serveur (préfixe `data:image/...` vérifié)
- [ ] Message d'erreur 400 ou message UI

### 22.2 Auto-attribution de badge (IDOR)

1. Via Postman ou curl, envoyer `POST /api/badges` avec un badge jamais débloqué, sans remplir la condition

```bash
curl -s -X POST http://localhost:8080/api/badges \
  -H "Content-Type: application/json" \
  -b "PHPSESSID=SESSION_PLAYER_A" \
  -d '{"badge_slug": "legendary_badge"}'
```

- [ ] Refusé si la condition n'est pas remplie (verification côté serveur)

### 22.3 IDOR défi (farm XP)

1. Essayer de marquer son propre défi comme "beaten" via curl

```bash
curl -s -X PATCH http://localhost:8080/api/messages/1 \
  -H "Content-Type: application/json" \
  -b "PHPSESSID=SESSION_SENDER" \
  -d '{"status": "beaten"}'
```

- [ ] Refusé (seul le receiver peut passer en `beaten`)

### 22.4 CORS

1. Depuis un domaine externe (ex: `evil.com`), faire un `fetch` vers l'API avec `credentials: 'include'`

- [ ] La réponse est bloquée (origine non whitelistée)

### 22.5 Headers de sécurité

1. Faire `curl -I http://localhost:8080/api/auth/me`

- [ ] `X-Frame-Options: DENY` présent
- [ ] `X-Content-Type-Options: nosniff` présent
- [ ] `Referrer-Policy` présent

---

## 23 — Responsive & Compatibilité

> Tester sur Chrome DevTools avec les résolutions suivantes.

### Résolutions à tester

| Résolution | Profil |
|-----------|--------|
| 375×667 | iPhone SE (mobile) |
| 768×1024 | iPad (tablette) |
| 1280×720 | Desktop standard |
| 1920×1080 | Grand écran |

### Pages à tester sur mobile (375px)

- [ ] Page d'accueil (`index.html`) — cards modes lisibles, logo adaptatif
- [ ] Mode Classique — grille de résultats scrollable horizontalement
- [ ] Mode Musique — lecteur audio responsive
- [ ] Profil — stats lisibles, boutons accessibles
- [ ] Amis — cartes empilées, recherche accessible
- [ ] Leaderboard — tableau scrollable
- [ ] Admin — sidebar en drawer (hamburger)

### Test rapide multi-navigateurs

- [ ] Chrome 90+ — fonctionnel
- [ ] Firefox 88+ — fonctionnel
- [ ] Safari 14+ (si disponible) — fonctionnel

---

## 24 — Revue de la documentation

> Cette section ne teste pas le code — elle vérifie que la documentation accompagne correctement le projet. Un testeur qui passe uniquement les cases fonctionnelles sans lire la doc passe à côté de la moitié du travail.

### 24.1 READMEs des dossiers

Lire chaque README dans son intégralité et vérifier qu'il correspond à la réalité du code :

- [ ] `README.md` (racine) — présentation générale, stack, modes, dev setup
- [ ] `api/README.md` — tous les endpoints listés, signatures bootstrap, règles sécurité
- [ ] `sql/README.md` — 20 tables documentées, différences MySQL/MariaDB
- [ ] `admin/README.md` — 7 onglets décrits, actions et effets BDD
- [ ] `profile/badges/README.md` — 4 catégories, flow unlock, race condition documentée
- [ ] `scripts/README.md` — `check-i18n.js` décrit, exemples de sorties
- [ ] `tests/README.md` — 190 tests, couverture par suite
- [ ] `lang/README.md` (si existant) — architecture i18n, règles de traduction

Pour chaque README :

- [ ] Les exemples de commandes sont corrects et fonctionnels
- [ ] Les avertissements (`> ⚠️`, notes importantes) sont bien mis en évidence
- [ ] Aucune information contradictoire entre deux READMEs

### 24.2 CLAUDE.md (instructions projet)

Lire `CLAUDE.md` à la racine du projet :

- [ ] Section 2 (Stack) : la stack décrite correspond à ce qui est effectivement utilisé
- [ ] Section 3 (Architecture fichiers) : l'arbre de fichiers correspond à la réalité (pas de fichier manquant ou fantôme)
- [ ] Section 11 (Fonctionnalités en place) : chaque entrée marquée ✅ Stable fonctionne bien en pratique
- [ ] Section 12 (Ce qu'il reste à construire) : les cases cochées [x] sont réellement terminées
- [ ] Section 13 (Pièges connus) : chaque piège documenté correspond à un vrai problème résolu — vérifier au moins 3 aléatoirement

### 24.3 Documentation des mises à jour

Lire `PersonaDLE_Update_Documentation/PersonaDLE 2.0/PersonaDLE_Update.md` :

- [ ] Les sections de la v2.0 couvrent les grandes fonctionnalités (backend, friends, social link, défis, leaderboard, admin)
- [ ] Chaque entrée a un titre, une description et des détails techniques
- [ ] Le niveau de détail est suffisant pour qu'un développeur externe comprenne ce qui a changé
- [ ] Lire aussi `note_ajout.md` : les notes informelles correspondent aux décisions prises en session

### 24.4 ROADMAP.md

Lire `ROADMAP.md` :

- [ ] Les éléments marqués ✅ sont bien terminés et fonctionnels
- [ ] Aucun élément ✅ n'a en réalité des bugs critiques non résolus
- [ ] Les éléments 📋 / 💡 sont clairement différenciés (planifié vs idée à valider)
- [ ] Les notes dans la colonne "Notes" sont à jour

---

## 25 — Revue du code & commentaires

> L'objectif est de vérifier que le code est lisible, cohérent et maintenable — pas de faire une relecture ligne par ligne.

### 25.1 Fichiers structurants à inspecter

Ouvrir et lire en diagonale :

- [ ] `js/gameCore.js` — fonctions communes bien nommées, logique de date DST-safe commentée
- [ ] `js/api.js` — tous les groupes d'endpoints (`api.auth.*`, `api.stats.*`, `api.user.*`) présents, bridge `window._personadleApi` documenté
- [ ] `js/cloud-sync.js` — `pullProfileFromCloud()` clairement documenté, hook `_onCloudSync` expliqué
- [ ] `api/bootstrap.php` — chaîne de fallback config commentée, helpers `requireAuth()` / `jsonError()` compréhensibles
- [ ] `api/auth/login.php` — vérification `is_banned` présente, commentaires de sécurité

### 25.2 Commentaires dans les zones critiques

Vérifier que les zones non-évidentes ont un commentaire :

- [ ] La gestion DST Paris dans `gameCore.js` (`Intl.DateTimeFormat`, `Europe/Paris`)
- [ ] Le cache LRU GIFs dans `allOutAttackMode/modeAllOutAttack.js`
- [ ] Le bridge `window._personadleApi` (évite les imports circulaires)
- [ ] Le pattern `savePendingSession` fire-and-forget (callers non-async intentionnellement)
- [ ] La procédure `gain_social_link_xp` dans les scripts SQL (label `proc_body:`, MariaDB-specific)

### 25.3 Cohérence de nommage

Vérifier en parcourant les fichiers JS principaux :

- [ ] `camelCase` pour les fonctions et variables (aucun `snake_case` résiduel)
- [ ] `PascalCase` pour les classes uniquement
- [ ] Pas de variable `x`, `tmp`, `data2` sans contexte — noms explicites partout

### 25.4 Sécurité backend — revue rapide

Ouvrir 3 fichiers PHP au hasard dans `api/` :

- [ ] Toutes les requêtes SQL passent par `$pdo->prepare()` + `execute()` — aucune concaténation de chaîne SQL
- [ ] Les inputs utilisateur sont validés avant d'être utilisés
- [ ] Toutes les réponses retournent du JSON propre (via `jsonSuccess()` / `jsonError()`)

---

## 26 — Revue des tests automatisés

### 26.1 Lancer et comprendre la suite

```bash
# Depuis la racine du projet
npm test
```

- [ ] Les 190 tests passent (0 failed)
- [ ] Aucun test n'est en mode `skip` ou `todo` sans justification

```bash
# Pour voir le détail par suite
npm test -- --reporter=verbose
```

- [ ] `gameCore.test.js` : ~172 tests — logique de jeu, dates, streaks, normalisation, filtres
- [ ] `backend.test.js` : 18 tests — buildGameSession, savePendingSession, auth UI DOM

### 26.2 Comprendre la structure des tests

Lire `tests/gameCore.test.js` (en diagonal) :

- [ ] Les suites (`describe`) correspondent bien aux fonctions documentées dans la section couverture du README
- [ ] Les cas limites sont testés (DST, pool vide, streak à 0, filtre inconnu…)
- [ ] Les noms de tests (`it(...)`) sont clairs et décrivent le comportement attendu

Lire `tests/backend.test.js` :

- [ ] `buildGameSession` : les 6 cas couvrent les combinaisons mode/résultat/filtres
- [ ] `savePendingSession` : les 7 cas couvrent online, offline, 409, erreur réseau
- [ ] `Auth UI DOM` : les 5 cas vérifient que les événements `personadle:auth-login` / `personadle:auth-logout` sont bien dispatché

### 26.3 Vérifier que les tests testent vraiment

Choisir 3 tests au hasard dans `gameCore.test.js` :

- [ ] Le test échouerait si on supprimait la logique testée (le test a de la valeur)
- [ ] Les assertions sont précises (pas juste `expect(result).toBeTruthy()` pour tout)

### 26.4 Couverture manquante identifiée

- [ ] Lister au moins 2 fonctions dans `gameCore.js` ou `api.js` qui ne sont pas encore testées
- [ ] Les noter dans la section §27 (Suggestions) ci-dessous

---

## 27 — Suggestions d'amélioration

> Cette section n'a pas de cases à cocher — c'est un espace libre pour consigner toutes les observations du testeur : bugs mineurs, incohérences, UX à améliorer, dette technique, documentation à clarifier.

### Format suggéré

```text
[CATÉGORIE] Titre court
Fichier(s) concerné(s) : ...
Description : ...
Priorité estimée : Haute / Moyenne / Faible
```

### Catégories disponibles

- `[BUG]` — comportement incorrect
- `[UX]` — expérience utilisateur dégradée
- `[PERF]` — problème de performance
- `[DOC]` — documentation manquante ou incorrecte
- `[TEST]` — couverture de test insuffisante
- `[SÉCU]` — risque de sécurité
- `[REFACTO]` — dette technique à adresser

### Observations du testeur

Remplir au fil des sections précédentes.

---

## Checklist finale avant validation

- [ ] §4 — 190 tests automatisés passants
- [ ] §4 — 0 clé i18n manquante
- [ ] §5 — Auth complète (inscription, login, logout, ban, rate limiting)
- [ ] §6 — Les 6 modes jouables + sessions enregistrées en BDD
- [ ] §7 — Filtres opus persistants + sous-filtres P5 + P4AU + P5T
- [ ] §8 — Profil : avatar, pseudo, dirty-state, profil public, sync cloud
- [ ] §9 — Badges : unlock gameplay + redeem code + épinglage max 4
- [ ] §10 — Titres équipables + wallpapers
- [ ] §11 — Amis : recherche, demandes, animations ×3
- [ ] §12 — Social Link : XP automatique, rang-up, True Confidant
- [ ] §13 — Défis : envoi, bandeau, victoire, give-up, filtres restaurés
- [ ] §14 — Leaderboard : tous filtres + my_rank + scope amis
- [ ] §15 — Notifications : polling, résultats défis, changement de compte
- [ ] §16 — Admin : ban, attribution badges, codes événement
- [ ] §17 — i18n : 5 langues + boutons localisés + fallback EN
- [ ] §18 — Dark mode + mode daltonien
- [ ] §19 — Profile Card PNG : export + 8 thèmes
- [ ] §20 — Streak recovery : bouton conditionnel + cooldown
- [ ] §21 — Offline-first : queue localStorage + sync automatique
- [ ] §22 — Sécurité : validation avatar, anti-IDOR, CORS, headers
- [ ] §23 — Responsive : mobile 375px + tablette + desktop
- [ ] §24 — Documentation : tous les READMEs lus + CLAUDE.md + ROADMAP + Update doc
- [ ] §25 — Code : commentaires zones critiques, nommage, requêtes SQL préparées
- [ ] §26 — Tests : 190 passants, structure comprise, couverture manquante identifiée
- [ ] §27 — Suggestions : au moins 3 observations consignées

---

*PersonaDLE v2.0 — Document généré le 14 mai 2026.*  
*Mettre à jour ce document à chaque nouvelle fonctionnalité ou correction majeure.*
