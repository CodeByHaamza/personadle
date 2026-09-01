# Déploiement PersonaDLE sur Hostinger

> Hébergement mutualisé Hostinger (Apache, MariaDB, PHP 8.2). Domaine principal
> `personadle.net`, webroot **`~/domains/personadle.net/public_html`**.

---

## Déploiement courant — automatique (depuis le 2026-07-24)

Le déploiement est **automatique** via l'intégration Git native de Hostinger
(hPanel → Avancé → GIT, « Connecté avec GitHub ») :

```
Local ──(git push)──► GitHub (branche main) ──(webhook auto)──► Hostinger git pull
                                                                       │
                                                        ~/domains/personadle.net/public_html
```

- **Tout push/merge sur `main` déploie le code tout seul** en ~10-30 s. Rien à faire.
- Workflow quotidien : bosser sur `develop` → merge `main` → c'est en ligne.
- ⚠️ **La BDD n'est JAMAIS touchée par le déploiement.** Si un commit ajoute une
  migration SQL (`sql/migrations/0XX.sql`), l'appliquer **manuellement** en SSH
  (mysqldump avant) — voir « Migrations » plus bas.
- ⚠️ **Ne jamais éditer un fichier directement sur le serveur** (sauf `api/config.php`) :
  le prochain `git pull` l'écraserait.

### Appliquer une migration SQL (quand le schéma change)

```bash
ssh hostinger-personadle
# backup d'abord :
mysqldump -u <user> -p<pass> --routines --triggers <db> > ~/db_backup_$(date +%F_%H%M).sql
# puis appliquer (jamais phpMyAdmin si le .sql contient DELIMITER) :
mysql -u <user> -p<pass> <db> < ~/domains/personadle.net/public_html/sql/migrations/0XX_xxx.sql
```

---

## Release majeure — procédure `develop → main`

> Ajoutée pour la 2.1 (2026-09-01). Le déploiement courant décrit plus haut suffit pour un
> correctif isolé. Cette section couvre le cas d'une release qui embarque **des migrations
> SQL** — c'est là que l'ordre compte.

### Le piège central : le code arrive avant le schéma

Le merge sur `main` déclenche le `git pull` Hostinger en ~10-30 s, mais **ne touche jamais la
base**. Merger d'abord, migrer ensuite, c'est donc garantir une fenêtre pendant laquelle le
code de la nouvelle version interroge le schéma de l'ancienne : `Unknown column 'is_expert'`
à chaque partie Expert, badges et titres introuvables, etc.

**Les migrations passent AVANT le merge.** Elles sont additives et idempotentes : la 2.0 en
production continue de tourner sans les voir.

### 1. Avant de toucher à quoi que ce soit

- [ ] `develop` est vert en CI, et la branche de la dernière PR y est mergée
- [ ] Le plan de test de la version a été déroulé — pour la 2.1,
      [`PersonaDLE 2.1/TEST_PLAN.md`](PersonaDLE_Update_Documentation/PersonaDLE%202.1/TEST_PLAN.md)
- [ ] Les entrées de changelog joueur et dev de la version sont écrites (CLAUDE.md §9)
- [ ] `CACHE_VERSION` a été bumpé dans `sw.js` — sinon les assets servis en cache-first
      restent ceux de la version précédente chez les joueurs déjà venus
- [ ] Créneau choisi **hors heure de pointe** : `sw.js` envoie `SW_UPDATED` à tous les onglets
      ouverts, qui se rechargent. L'état de partie survit (il vit dans `localStorage`), mais
      une lecture audio en cours s'arrête

### 2. Constater l'état réel de la base — ne pas se fier au dossier

`sql/migrations/` n'est **pas** le reflet de la prod : une migration y vit dès qu'elle est
écrite sur `develop`, et n'atteint la base qu'ici. La seule source fiable est la table de
suivi créée par la 026 :

```bash
ssh hostinger-personadle
mysql -u <user> -p <db> -e "SELECT version FROM schema_migrations ORDER BY version;"
```

Comparer avec `ls sql/migrations/` et ne jouer que ce qui manque.

### 3. Sauvegarder

```bash
ssh hostinger-personadle   "mysqldump -u <user> -p'<pass>' --routines --triggers <db>"   > db_backup_$(date +%F_%H%M).sql
```

En rapatriant le dump **en local** plutôt qu'en le laissant sur le serveur : si le disque
Hostinger est le problème, un backup qui n'existe que là-bas ne sert à rien.

Obligatoire avant toute migration **non purement additive**. Pour la 2.1, deux le sont :

| Migration | Ce qu'elle fait de non réversible |
|---|---|
| `032` | Supprime une contrainte d'unicité — aucune donnée effacée, mais revenir en arrière exigerait de dédoublonner à la main |
| `036` | Modifie des lignes existantes (nettoyage des défis bloqués) |

### 4. Jouer les migrations, dans l'ordre

> 🚨 **Les fichiers de migration ne sont PAS sur le serveur.** Le webroot est un checkout de
> `main` : au moment où l'on migre (donc *avant* le merge), il ne contient que les migrations
> de la version précédente. Un `mysql < sql/migrations/0XX.sql` lancé **depuis** le serveur
> échouerait en « fichier introuvable ». C'est précisément l'ordre correct qui crée ce piège.

On les envoie donc **depuis le poste local**, par l'entrée standard de SSH — le fichier est
lu localement et transmis à `mysql` sur le serveur :

```bash
# Depuis le dépôt local, sur la branche develop
ssh hostinger-personadle "mysql -u <user> -p'<pass>' <db>" < sql/migrations/0XX_xxx.sql
```

⚠️ **L'ordre compte au moins une fois** : la `032` déclare sa colonne `AFTER is_expert`, que
la `031` crée. Jouer 032 sans 031 échoue.

⚠️ **`--delimiter='$$'` uniquement si le fichier contient `DELIMITER`** (procédures stockées).
Vérifier avant : `grep -l DELIMITER sql/migrations/0XX_*.sql`. Aucune des migrations 029→038
n'en contient — pour elles, le flag est inutile. Pour celles qui en contiennent, **jamais
phpMyAdmin** : il ne sait pas les lire et échoue à moitié.

Pour la 2.1 : `029 → 030 → 031 → 032 → 033 → 034 → 035 → 036 → 037 → 038`.

### 4bis. Enregistrer les migrations dans `schema_migrations`

> 🚨 **Les fichiers `.sql` ne s'enregistrent PAS eux-mêmes.** C'est
> [`scripts/apply_migrations.sh`](scripts/apply_migrations.sh) qui fait le
> `INSERT INTO schema_migrations` après chaque fichier appliqué. Toute méthode qui
> contourne ce script — dont le `mysql < fichier` de l'étape 4 — laisse donc la table de
> suivi en arrière.
>
> Conséquence si on l'oublie : à la release suivante, l'étape 2 annoncera comme « en
> attente » des migrations pourtant appliquées, et le script les rejouera. Sans dégât
> tant qu'elles sont idempotentes — mais c'est un écart silencieux qui coûte cher à
> diagnostiquer plus tard.

La version est le **nom du fichier sans `.sql`** (`ver=$(basename "$f" .sql)` dans le
script), exactement comme les lignes déjà présentes :

```bash
mysql -u <user> -p <db> -e "INSERT IGNORE INTO schema_migrations (version) VALUES
  ('0XX_nom_du_fichier'), ('0YY_autre_fichier');"
```

> 💡 Le mieux reste d'utiliser `scripts/apply_migrations.sh` quand c'est possible : il
> enchaîne détection du reliquat, backup, application et enregistrement. La procédure
> manuelle ci-dessus existe parce que le script vit dans `sql/`+`scripts/`, dossiers que
> le `.htaccess` bloque et qui ne sont pas toujours à jour sur le serveur avant le merge.

### 5. Vérifier que le schéma a bougé

```bash
mysql -u <user> -p <db> -e "
  SELECT slug FROM badges WHERE slug IN ('gyotre','denial_of_self','false_spring');
  SELECT slug FROM titles WHERE slug IN ('junes','investigation_team','shadows_converge');
  SHOW COLUMNS FROM messages LIKE 'challenge_is_expert';
  SHOW COLUMNS FROM game_sessions LIKE 'is_expert';"
```

Attendu : 3 badges, 3 titres, et les deux colonnes présentes. Vérifier aussi que
`SELECT COUNT(*) FROM schema_migrations` correspond bien au nombre de fichiers dans
`sql/migrations/` (hors `README.md`) — c'est le contrôle qui attrape un oubli de l'étape 4bis.

### 6. Merger — c'est le déclencheur du déploiement

`main` est protégée : passer par une PR. Les checks requis sont **JS Tests & i18n check**,
**PHP Lint & Tests** et **PR base guard** (l'E2E n'est pas bloquant sur `main`, mais attendre
son vert reste préférable).

```bash
gh pr create --base main --head develop --title "release: v2.X"
gh pr merge --merge   # merge commit, pas squash : on garde l'historique de develop
```

> Sur `main`, on **merge** au lieu de squasher. Les PR de feature sont squashées dans
> `develop` ; écraser ensuite 98 commits en un seul rendrait `git log main` illisible et
> `git bisect` inutilisable sur une régression de prod.

Le `git pull` Hostinger part tout seul dans les ~10-30 s.

### 7. Vérifier en prod

- [ ] La page d'accueil affiche la nouvelle version
- [ ] Cache navigateur : suivre le §8bis du `TEST_PLAN.md` **sur un navigateur déjà venu**
      (surtout pas une fenêtre privée — c'est l'inverse du cas à tester)
- [ ] Aperçu de lien (Discord / opengraph.xyz) sur l'accueil et sur une page de mode
- [ ] Une partie complète dans un mode, connecté : elle doit apparaître dans le profil
- [ ] Les logs d'erreur PHP Hostinger ne se remplissent pas

### 8. Si ça casse — retour arrière

Le code revient en une commande ; **la base, non**.

```bash
git checkout main
git revert -m 1 <sha_du_merge>   # -m 1 : garder la ligne de main
git push origin main             # le pull Hostinger repart tout seul
```

Ce qu'il faut savoir avant d'y compter :

- Les migrations **restent appliquées**. Ce n'est presque jamais un problème : elles sont
  additives, et l'ancien code ignore simplement les colonnes et lignes en trop.
- Les deux exceptions sont `032` et `036`. Si l'une d'elles est en cause, c'est le
  `mysqldump` de l'étape 3 qu'il faut restaurer, pas un `git revert`.
- Restaurer un dump **perd les parties jouées depuis**. À ne faire qu'en dernier recours,
  et en connaissance de cause.

---

## Première installation (référence — déjà réalisée le 2026-07-24)

> Les étapes ci-dessous documentent la mise en place initiale (BDD, `config.php`,
> crons). Elles n'ont **pas** à être refaites à chaque déploiement — seule la section
> « Déploiement courant » ci-dessus s'applique au quotidien. Historique de l'ancien
> déploiement SFTP/FileZilla manuel : voir l'historique git de ce fichier.

---

## Étape 1 — Préparer localement

### 1.1 Générer le CRON_SECRET

```bash
php -r "echo bin2hex(random_bytes(24));"
```

Note le résultat — tu en auras besoin à l'étape 4.

### 1.2 Vérifier que tout est commité

```bash
git status
git log --oneline -5
```

---

## Étape 2 — Hostinger hPanel : créer la base de données

Dans hPanel → **Bases de données** → **Bases de données MySQL** :

1. Créer une base de données → noter le nom (ex: `u123456_personadle`)
2. Créer un utilisateur DB → noter login + mot de passe
3. Associer l'utilisateur à la base avec les droits : `SELECT, INSERT, UPDATE, DELETE`  
   _(pas ALTER — même principe qu'en local)_

Dans hPanel → **Hébergement** → **SSL** :

- Activer Let's Encrypt sur `personadle.net` et `www.personadle.net`

---

## Étape 3 — Mise en place des fichiers

> **Méthode retenue (2026-07-24)** : intégration **Git native Hostinger** (hPanel →
> Avancé → GIT → « Déploiement depuis GitHub », dépôt `HamzaKarrouchi/personadle`,
> branche `main`, répertoire `domains/personadle.net/public_html`). Le clone initial +
> tous les déploiements suivants passent par là (cf. « Déploiement courant » en haut).
> Les deux options manuelles ci-dessous sont conservées pour référence historique.

### Option A — SFTP (FileZilla)

Credentials SFTP dans hPanel → **Hébergement** → **Accès FTP**.

**Ce qu'il faut uploader** (tout le projet sauf les exclusions ci-dessous) vers `/public_html/` :

```
À uploader :
  ✅ index.html, sw.js
  ✅ pages/      (tout le dossier — 404.html, privacy.html, faq.html, reset-password.html)
  ✅ .htaccess (racine)
  ✅ api/        (tout le dossier)
  ✅ js/         (tout le dossier)
  ✅ css/        (tout le dossier)
  ✅ lang/       (tout le dossier)
  ✅ profile/    (tout le dossier)
  ✅ classiqueMode/, emojiMode/, silhouetteMode/
  ✅ allOutAttackMode/, personaeMode/, musicsMode/
  ✅ database/   (tout le dossier)
  ✅ assets/     (tout le dossier)
  ✅ img/        (tout le dossier)
  ✅ admin/      (tout le dossier)

À NE PAS uploader :
  ❌ node_modules/           (inutile en prod)
  ❌ api/config.php          (sera créé manuellement à l'étape 4)
  ❌ tests/                  (inutile en prod)
  ❌ scripts/                (inutile en prod)
  ❌ sql/                    (ne pas exposer les schémas en public_html)
  ❌ PersonaDLE_Update_Documentation/
  ❌ Bot_Alibaba/
  ❌ graphify-out/
  ❌ .git/
```

> **Conseil** : Upload via FileZilla en filtrant les dossiers exclus. Ou `rsync` si SSH disponible.

### Option B — Git clone (si SSH disponible sur Hostinger)

```bash
# Dans le terminal SSH Hostinger
cd ~/public_html
git clone https://github.com/HamzaKarrouchi/personadle.git .
```

---

## Étape 4 — Créer api/config.php sur Hostinger

Via hPanel → **Gestionnaire de fichiers** → `public_html/api/` → Créer `config.php` :

```php
<?php
// ── Base de données (credentials fournis par hPanel) ────────────────────────
define('DB_HOST', 'localhost');          // généralement 'localhost' sur Hostinger
define('DB_PORT', 3306);
define('DB_NAME', 'u123456_personadle'); // ← ton nom de BDD hPanel
define('DB_USER', 'u123456_user');       // ← ton utilisateur DB hPanel
define('DB_PASS', 'MOT_DE_PASSE_DB');   // ← ton mot de passe DB hPanel

// ── Environnement ────────────────────────────────────────────────────────────
define('APP_ENV', 'production');         // active cookies Secure + HTTPS

// ── Cron secret ──────────────────────────────────────────────────────────────
define('CRON_SECRET', 'COLLER_LE_SECRET_GENERE_A_ETAPE_1');
```

> ⚠️ Ce fichier est dans `.gitignore` — ne jamais le committer.

---

## Étape 5 — Initialiser la base de données (PhpMyAdmin)

Dans hPanel → **PhpMyAdmin** → sélectionner ta base → onglet **Importer** :

1. Sélectionner le fichier `sql/bdd_mysql.sql` _(depuis ton poste local — c'est la seule
   source de vérité du schéma, chargée automatiquement par Docker en dev)_
2. Format : SQL → **Exécuter**

Ce fichier contient : schéma complet (23 tables) + seeds badges (60) + seeds wallpapers (7) +
Social Link ranks + titres.

> ⚠️ Ne pas utiliser `sql/hostinger_full.sql` — c'est une archive figée au 2026-05-06,
> explicitement dépréciée dans son propre en-tête (schéma déjà périmé de plusieurs migrations).
> `bdd_mysql.sql` contient tout ce qu'il contenait, à jour.

### Créer le compte admin

1. S'inscrire normalement sur `https://personadle.net` avec ton pseudo admin
2. Dans PhpMyAdmin → onglet **SQL** :

```sql
UPDATE users SET is_admin = 1 WHERE pseudo = 'TonPseudo';
```

---

## Étape 6 — Configurer les crons Hostinger

Dans hPanel → **Avancé** → **Tâches Cron** :

| Fréquence               | Commande                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Toutes les heures**   | `wget --header="X-Cron-Key: TON_SECRET" -qO- "https://personadle.net/api/cron/leaderboard.php" > /dev/null 2>&1`   |
| **1× par jour à 03:00** | `wget --header="X-Cron-Key: TON_SECRET" -qO- "https://personadle.net/api/cron/hard-delete.php" > /dev/null 2>&1`   |
| **1× par jour à 04:00** | `wget --header="X-Cron-Key: TON_SECRET" -qO- "https://personadle.net/api/cron/purge-rate-limits.php" > /dev/null 2>&1` |

Remplace `TON_SECRET` par la valeur de `CRON_SECRET` de ton `config.php`. Le secret passe
désormais par un header (`X-Cron-Key`) plutôt qu'en query string `?key=` — une query string
finit en clair dans les logs d'accès HTTP du serveur/proxy, pas un header.

---

## Étape 7 — Vérifications post-déploiement

Tester dans l'ordre :

```
1. https://personadle.net             → redirige bien en HTTPS, page d'accueil OK
2. https://personadle.net/api/auth/me → {"error":"Unauthorized"} (401 = API répond)
3. Inscription d'un compte test       → email/pseudo/password
4. Connexion                          → session créée, profil chargé
5. Jouer une partie (Classic)         → partie enregistrée en BDD
6. Leaderboard week                   → données depuis game_sessions
7. Uploader un avatar                 → canvas crop, sauvegarde OK
8. Vérifier HTTPS partout             → pas de mixed content
```

### Test rapide de l'API depuis le terminal local

```bash
# Test API (remplace le domaine)
curl -s https://personadle.net/api/auth/me | python3 -m json.tool

# Test cron leaderboard (remplace TON_SECRET)
curl -s -H "X-Cron-Key: TON_SECRET" "https://personadle.net/api/cron/leaderboard.php" | python3 -m json.tool
```

---

## Dépannage courant

| Symptôme                                         | Cause probable                               | Solution                                                                           |
| ------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| API retourne du HTML au lieu de JSON             | `.htaccess` non pris en compte               | Vérifier `AllowOverride All` dans hPanel                                           |
| `500 Internal Server Error` sur `/api/*`         | `config.php` manquant ou mauvais credentials | Vérifier le fichier, tester la connexion DB                                        |
| Cookies de session perdus après quelques minutes | `gc_maxlifetime` trop court côté Hostinger   | Vérifier `php.ini` Hostinger, le remember-me token compense                        |
| CORS bloqué depuis le navigateur                 | Origine non whitelistée                      | Vérifier `bootstrap.php` → `$allowedOrigins`                                       |
| Avatars trop lourds refusés                      | `post_max_size` trop petit                   | hPanel → PHP → `post_max_size = 16M`, `upload_max_filesize = 16M`                  |
| Images/assets cassés                             | Chemin relatif incorrect                     | Vérifier que le projet est à la racine de `public_html/`, pas dans un sous-dossier |
| `mod_rewrite` non actif                          | Module Apache désactivé                      | hPanel → PHP/Apache → activer `mod_rewrite`                                        |
| CSP absente sur les pages HTML (vérifier via les DevTools → onglet Network → headers) | `mod_headers` désactivé (le `.htaccess` racine utilise `Header set`, silencieux si le module est absent) | hPanel → PHP/Apache → activer `mod_headers` (activé par défaut sur la plupart des hébergements mutualisés) |

---

## Checklist finale

- [ ] SSL actif sur `personadle.net` + `www.personadle.net`
- [ ] `api/config.php` créé avec `APP_ENV = 'production'`
- [ ] `sql/bdd_mysql.sql` importé sans erreur
- [ ] Compte admin promu via `UPDATE users SET is_admin = 1`
- [ ] Cron leaderboard configuré (toutes les heures)
- [ ] Cron hard-delete configuré (03:00 quotidien)
- [ ] Cron purge-rate-limits configuré (04:00 quotidien)
- [ ] HTTPS testé + redirect HTTP → HTTPS OK
- [ ] Inscription + connexion + partie fonctionnels
