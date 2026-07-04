# Déploiement PersonaDLE sur Hostinger

> Guide pas-à-pas pour mettre en production sur Hostinger (shared hosting, Apache, MariaDB, PHP 8.3).  
> À faire ensemble, étape par étape.

---

## Vue d'ensemble

```
Local ──(git push)──► GitHub ──(SFTP/FileZilla)──► Hostinger public_html/
                                                        │
                                                   PhpMyAdmin ◄── sql/hostinger_full.sql
```

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

## Étape 3 — Upload des fichiers

### Option A — SFTP (FileZilla)

Credentials SFTP dans hPanel → **Hébergement** → **Accès FTP**.

**Ce qu'il faut uploader** (tout le projet sauf les exclusions ci-dessous) vers `/public_html/` :

```
À uploader :
  ✅ index.html, 404.html, privacy.html, debug.html, sw.js
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

1. Sélectionner le fichier `sql/hostinger_full.sql` _(depuis ton poste local)_
2. Format : SQL → **Exécuter**

Ce fichier contient : schéma complet (20 tables) + seeds badges + seeds wallpapers + Social Link ranks + titres.

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

---

## Checklist finale

- [ ] SSL actif sur `personadle.net` + `www.personadle.net`
- [ ] `api/config.php` créé avec `APP_ENV = 'production'`
- [ ] `sql/hostinger_full.sql` importé sans erreur
- [ ] Compte admin promu via `UPDATE users SET is_admin = 1`
- [ ] Cron leaderboard configuré (toutes les heures)
- [ ] Cron hard-delete configuré (03:00 quotidien)
- [ ] Cron purge-rate-limits configuré (04:00 quotidien)
- [ ] HTTPS testé + redirect HTTP → HTTPS OK
- [ ] Inscription + connexion + partie fonctionnels
