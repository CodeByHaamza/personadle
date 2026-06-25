<div align="center">

# 🐳 Docker — Environnement de dev

<img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Compose">
<img src="https://img.shields.io/badge/PHP-8.3%20%2B%20Apache-777BB4?style=for-the-badge&logo=php&logoColor=white" alt="PHP">
<img src="https://img.shields.io/badge/MariaDB-10.6-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB">

> **`make up` (ou `docker compose up -d`) — c'est tout ce qu'il faut pour démarrer.**
> Schéma + seed (titres, rangs, **19 faux joueurs**) chargés automatiquement.

</div>

Ce dossier contient la configuration Docker pour lancer l'environnement de développement local complet en **une seule commande**.

> **Nouveau collaborateur ?** Lire d'abord le guide complet :
> [`PersonaDLE_Update_Documentation/PersonaDLE 2.0/DOCKER_GUIDE.md`](../PersonaDLE_Update_Documentation/PersonaDLE%202.0/DOCKER_GUIDE.md)
> (installation Docker, Windows/Mac/Linux, dépannage, reset…)
>
> Ce README couvre les détails techniques pour les développeurs qui connaissent déjà Docker.

---

## Ce que Docker fournit

| Service      | Image            | Port local              | Description                                         |
| ------------ | ---------------- | ----------------------- | --------------------------------------------------- |
| `php`        | PHP 8.3 + Apache | `http://localhost:8080` | Le site complet + API REST                          |
| `db`         | MariaDB 10.6     | `localhost:3307`        | Base de données (même version qu'en prod Hostinger) |
| `phpmyadmin` | phpMyAdmin 5     | `http://localhost:8081` | Interface graphique pour la BDD                     |

Le schéma BDD (`sql/bdd_mysql.sql`) est appliqué **automatiquement** au premier démarrage — tables, index, contraintes, et seed de données (titres, rangs Social Link, compte de test).

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac / Windows) ou Docker Engine + Compose (Linux)
- Git (pour cloner le repo)

Vérifier que Docker tourne :

```bash
docker --version        # Docker version 24+
docker compose version  # Docker Compose version 2+
```

---

## Premier lancement

```bash
# 1. Cloner le repo
git clone https://github.com/HamzaKarrouchi/personadle.git
cd personadle

# 2. Copier le fichier d'environnement
cp .env.example .env
# (optionnel) modifier les ports dans .env si 8080/8081 sont déjà utilisés

# 3. Démarrer les containers (construit les images au premier lancement ~1-2 min)
docker compose up -d

# 4. Vérifier que tout est up
docker compose ps
```

Accès :

- **Site** → [http://localhost:8080](http://localhost:8080)
- **PhpMyAdmin** → [http://localhost:8081](http://localhost:8081)

---

## Compte de test

Un compte développeur est créé automatiquement au premier démarrage :

| Champ        | Valeur                 |
| ------------ | ---------------------- |
| Email        | `dev@personadle.local` |
| Mot de passe | `devpassword123`       |
| Pseudo       | `DevJoker`             |

En plus, **19 faux joueurs Persona** (Yu, Ren, Akechi, Wonder…) sont créés pour peupler le
leaderboard, les profils et le social. Mot de passe commun : **`test1234`**. Pseudos visibles
sur [http://localhost:8080/profile/leaderboard/leaderboard.html](http://localhost:8080/profile/leaderboard/leaderboard.html).

---

## Commandes utiles

```bash
# Démarrer les services (arrière-plan)
docker compose up -d

# Arrêter les services (les données sont conservées)
docker compose down

# Voir les logs Apache/PHP en temps réel
docker compose logs -f php

# Voir les logs MariaDB
docker compose logs -f db

# Ouvrir un shell dans le container PHP
docker compose exec php bash

# Ouvrir un shell MySQL directement
docker compose exec db mariadb -u personadle_usr -pdevpassword personadle_db

# Reconstruire l'image PHP après un changement de Dockerfile
docker compose build php && docker compose up -d php
```

---

## Réinitialiser la base de données

Si tu as besoin de repartir d'une BDD propre (schéma + seed rejoués) :

```bash
# Arrêter les services ET supprimer le volume de données
docker compose down -v

# Redémarrer (le schéma est rejoué automatiquement)
docker compose up -d
```

> ⚠️ `down -v` supprime toutes les données locales. À utiliser seulement si tu veux un reset complet.

---

## Variables d'environnement (`.env`)

Le fichier `.env` (copié depuis `.env.example`) contrôle les credentials et les ports. Il est dans `.gitignore` — ne jamais le committer.

| Variable         | Défaut        | Description                    |
| ---------------- | ------------- | ------------------------------ |
| `MYSQL_PASSWORD` | `devpassword` | Mot de passe BDD               |
| `APP_PORT`       | `8080`        | Port du site                   |
| `PMA_PORT`       | `8081`        | Port PhpMyAdmin                |
| `DB_EXPOSE_PORT` | `3307`        | Port MariaDB exposé sur l'hôte |

---

## Structure des fichiers

```
docker/
├── php/
│   ├── Dockerfile      ← Image PHP 8.3 + Apache + extensions
│   ├── vhost.conf      ← VirtualHost Apache (AllowOverride All)
│   └── php.ini         ← Surcharges PHP (sessions 30j, display_errors en dev)
├── mysql/
│   └── init/
│       ├── 02_seed_test.sql  ← Compte de test dev@personadle.local
│       └── 03_seed_dev.sql   ← 19 faux joueurs Persona (mdp test1234) — leaderboard/social
└── README.md           ← Ce fichier

# À la racine du projet :
docker-compose.yml      ← Orchestration des services
.env.example            ← Template de configuration (copier en .env)
sql/bdd_mysql.sql       ← Schéma BDD (monté automatiquement au démarrage)
api/config.docker.php   ← Config API lisant les variables d'environnement
```

---

## PhpMyAdmin

Accès : [http://localhost:8081](http://localhost:8081)

- **Serveur** : `db` (pré-configuré)
- **Utilisateur** : `personadle_usr`
- **Mot de passe** : `devpassword` (ou la valeur de `MYSQL_PASSWORD` dans ton `.env`)

---

## Problèmes courants

**Le port 8080 est déjà utilisé**

```bash
# Dans .env, changer APP_PORT
APP_PORT=8090
docker compose up -d
```

**Les containers démarrent mais la BDD n'est pas accessible**

```bash
# Vérifier que le container db est healthy
docker compose ps
# Attendre que le statut passe à "healthy" (~20-30s au premier démarrage)
```

**Modifications PHP non visibles**
Les fichiers sont montés en bind-mount — toute modification est visible immédiatement sans rebuild. Si le cache opcache pose problème :

```bash
docker compose exec php kill -USR2 1
```
