# Guide Docker — PersonaDLE

> **Pour qui ?** Tout collaborateur qui veut faire tourner PersonaDLE sur sa machine,
> que tu sois développeur, designer ou testeur, sous Windows, macOS ou Linux.
>
> Ce guide couvre uniquement ce qui n'est pas déjà documenté ailleurs.
> Les sections pointent vers les docs existantes pour éviter la duplication.

---

## Sommaire

1. [C'est quoi Docker ?](#1--cest-quoi-docker-)
2. [Installer Docker](#2--installer-docker)
3. [Vérifier l'installation](#3--vérifier-linstallation)
4. [Cloner le projet](#4--cloner-le-projet)
5. [Démarrer, utiliser et arrêter](#5--démarrer-utiliser-et-arrêter)
6. [Ouvrir la base de données](#6--ouvrir-la-base-de-données)
7. [Créer un compte admin](#7--créer-un-compte-admin)
8. [Lancer les tests automatisés](#8--lancer-les-tests-automatisés)
9. [Problèmes courants](#9--problèmes-courants)

---

## 1 — C'est quoi Docker ?

Docker crée des **mini-ordinateurs virtuels** (containers) qui tournent à l'intérieur de ta machine.
Chaque container embarque exactement ce dont il a besoin : PHP, MariaDB, PhpMyAdmin.

**Résultat :** tu n'installes ni PHP ni MySQL sur ta machine. Tu lances une commande, tout démarre.
Sur Windows, Mac ou Linux, le comportement est identique.

Le projet utilise **3 containers** — détails techniques dans [`docker/README.md`](../../docker/README.md) :

| Container | Rôle | Adresse locale |
|-----------|------|----------------|
| `personadle_php` | Site + API (Apache / PHP 8.3) | http://localhost:8080 |
| `personadle_db` | Base de données (MariaDB 10.6) | localhost:3307 |
| `personadle_pma` | Interface graphique BDD | http://localhost:8081 |

---

## 2 — Installer Docker

### Windows

1. Télécharger **Docker Desktop** :
   https://www.docker.com/products/docker-desktop/

2. Lancer l'installeur `.exe`. Quand il demande "Use WSL 2 instead of Hyper-V" → **cocher WSL 2** (recommandé).

3. Redémarrer la machine si demandé.

4. Ouvrir Docker Desktop. L'icône baleine apparaît dans la barre de tâches.
   Attendre que l'indicateur passe au vert ("Docker Desktop is running").

> **Si WSL 2 non installé :**
> Ouvrir PowerShell en admin, taper `wsl --install`, redémarrer, puis relancer Docker Desktop.

### macOS

1. Télécharger **Docker Desktop** (choisir Apple Silicon ou Intel selon ton Mac) :
   https://www.docker.com/products/docker-desktop/

2. Glisser `Docker.app` dans `/Applications`. Lancer Docker Desktop.

3. Attendre que la baleine dans la barre de menu soit stable (plus de mouvement).

### Linux (Ubuntu / Debian)

Docker Desktop existe pour Linux mais la méthode Engine + plugin Compose est plus légère :

```bash
# Ajouter le dépôt officiel Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Puis autoriser ton utilisateur à lancer Docker sans `sudo` :

```bash
sudo usermod -aG docker $USER
newgrp docker   # ou fermer/rouvrir le terminal
```

---

## 3 — Vérifier l'installation

Dans un terminal (PowerShell sur Windows, Terminal sur Mac/Linux) :

```bash
docker --version        # Docker version 24.x.x ou plus récent
docker compose version  # Docker Compose version v2.x.x
```

> **Si `docker compose` renvoie une erreur mais `docker-compose` fonctionne** :
> Tu as l'ancienne version (v1). Désinstalle-la et installe Docker Desktop ou le plugin Compose v2.

Tester que Docker tourne vraiment :

```bash
docker run --rm hello-world
```

Tu dois voir `Hello from Docker!`. Si oui, Docker est opérationnel.

---

## 4 — Cloner le projet

```bash
git clone https://github.com/HamzaKarrouchi/personadle.git
cd personadle
```

> **Windows — ligne de fin de fichier :** Configurer Git avant de cloner pour éviter les erreurs
> `\r: command not found` dans les containers. Lancer d'abord :
> `git config --global core.autocrlf false`
> Si tu as déjà cloné, voir [§9 — Problèmes courants](#windows--les-fins-de-ligne-cassent-les-scripts).

> **Windows — chemins avec espaces :** Placer le projet dans un chemin sans espace.
> Préférer `C:\dev\personadle` plutôt que `C:\Users\Mon Nom\Documents\...`.

---

## 5 — Démarrer, utiliser et arrêter

Tout est documenté dans [`docker/README.md`](../../docker/README.md) — lire dans l'ordre :

- **[Premier lancement](../../docker/README.md#premier-lancement)** — `docker compose up -d`, vérifier que les containers sont `Up`
- **[Compte de test](../../docker/README.md#compte-de-test)** — `dev@personadle.local` / `devpassword123` créé automatiquement
- **[Commandes utiles](../../docker/README.md#commandes-utiles)** — logs, shell, MySQL, rebuild
- **[Réinitialiser la BDD](../../docker/README.md#réinitialiser-la-base-de-données)** — `docker compose down -v`
- **[Variables d'environnement](../../docker/README.md#variables-denvironnement-env)** — ports, credentials

---

## 6 — Ouvrir la base de données

### Via PhpMyAdmin (interface graphique, recommandé)

```
http://localhost:8081
```

Les identifiants sont préremplis. Clique **Connexion** — tu verras la base `personadle_db` avec les 20+ tables.

### Depuis un client SQL externe (TablePlus, DBeaver, HeidiSQL…)

| Paramètre | Valeur |
|-----------|--------|
| Hôte | `127.0.0.1` |
| Port | `3307` |
| Utilisateur | `personadle_usr` |
| Mot de passe | `devpassword` |
| Base | `personadle_db` |

> La commande CLI MySQL est dans [`docker/README.md` — Commandes utiles](../../docker/README.md#commandes-utiles).

---

## 7 — Créer un compte admin

Le compte de test `DevJoker` n'a pas les droits admin.

Pour les scénarios complets (création de comptes, promotion admin, comptes de test supplémentaires),
voir **[`TEST_PLAN.md` §3 — Comptes de test à créer](TEST_PLAN.md#3--comptes-de-test-à-créer)**.

Raccourci rapide — promouvoir `DevJoker` directement :

```bash
docker compose exec db mariadb -u personadle_usr -pdevpassword personadle_db \
  -e "UPDATE users SET is_admin = 1 WHERE email = 'dev@personadle.local';"
```

Se déconnecter / reconnecter sur le site pour que la session soit rafraîchie.

---

## 8 — Lancer les tests automatisés

Les tests nécessitent **Node.js 18+** sur ta machine hôte (pas dans Docker).

```bash
node --version   # doit afficher v18.x ou plus
npm --version    # doit afficher 9.x ou plus
```

Installer Node.js si absent :
- Windows / Mac : https://nodejs.org/ (choisir LTS)
- Linux : `sudo apt install nodejs npm` ou via [nvm](https://github.com/nvm-sh/nvm)

Puis depuis le dossier `personadle/` :

```bash
npm install   # une seule fois après le clone
npm test      # 449 tests doivent passer
```

Pour les scénarios manuels à tester (les 6 modes, auth, badges, défis…),
voir **[`TEST_PLAN.md`](TEST_PLAN.md)** — notamment :

- [§1 — Environnement de test](TEST_PLAN.md#1--environnement-de-test) : versions requises
- [§2 — Lancer le projet Docker](TEST_PLAN.md#2--lancer-le-projet-docker) : checklist de démarrage
- [§4 — Tests automatisés](TEST_PLAN.md#4--tests-automatisés) : ce que couvre `npm test`

---

## 9 — Problèmes courants

### Le port 8080 (ou 8081 / 3307) est déjà utilisé

Un autre programme utilise ce port.

**Identifier le conflit :**

```bash
# Linux / macOS
ss -tlnp | grep 8080

# Windows (PowerShell)
netstat -ano | findstr :8080
```

**Changer le port de PersonaDLE :**

```bash
cp .env.example .env
```

Éditer `.env` :

```dotenv
APP_PORT=8090        # site  → http://localhost:8090
PMA_PORT=8082        # PMA   → http://localhost:8082
DB_EXPOSE_PORT=3308  # MySQL → localhost:3308
```

```bash
docker compose down && docker compose up -d
```

---

### L'API retourne `{"error":"Database unavailable"}`

**Cause :** tu as un fichier `api/config.php` sur ta machine (développement PHP local natif).
Ce fichier est ignoré par Git mais s'il est présent, il prend priorité sur les variables Docker
et pointe vers ton MySQL local (`127.0.0.1`) au lieu du container `db`.

```bash
ls api/config.php   # s'il existe → c'est le problème
```

**Solution :**

```bash
mv api/config.php api/config.php.bak     # mettre de côté
docker compose restart php               # recharger la config
```

Restaurer quand tu reviens au dev PHP natif :

```bash
mv api/config.php.bak api/config.php
```

---

### La DB est `unhealthy` ou les containers ne démarrent pas

```bash
docker compose logs db   # chercher une erreur dans les logs MariaDB
docker compose ps        # vérifier les statuts
```

Au premier lancement, MariaDB peut prendre 30-40 secondes à passer `healthy` (application du schéma SQL).
Si le problème persiste : reset complet → [`docker/README.md` — Réinitialiser la BDD](../../docker/README.md#réinitialiser-la-base-de-données).

---

### Windows — erreur "permission denied" sur les volumes

Ouvrir Docker Desktop → Settings → Resources → File Sharing.
Vérifier que le lecteur contenant le projet est coché.

---

### Windows — les fins de ligne cassent les scripts

Erreurs du type `\r: command not found` dans les logs :

```bash
git config core.autocrlf false
git rm --cached -r .
git reset --hard
```

---

### macOS — "Cannot connect to Docker daemon"

Docker Desktop n'est pas lancé. Ouvrir depuis les Applications, attendre que la baleine soit stable.

---

### Linux — "permission denied" sur le socket Docker

```bash
sudo usermod -aG docker $USER && newgrp docker
```

---

### Les modifications PHP ne sont pas visibles

Les fichiers sont en bind-mount — les changements sont immédiats sans rebuild.
Si l'ancien code persiste, vider le cache opcache :

```bash
docker compose exec php kill -USR2 1
```
