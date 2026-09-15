# Configuration cron Hostinger

## Prérequis

1. `CRON_SECRET` défini dans `api/config.php` sur le serveur Hostinger
2. Scripts déployés dans `https://personadle.net/api/cron/`

## Authentification

Les 3 endpoints cron partagent le même secret, envoyé dans le header
`X-Cron-Key` (et non en query string `?key=` — une query string finit en
clair dans les logs d'accès HTTP du serveur/proxy, pas un header).

## Hostinger cPanel → Cron Jobs

Créer une tâche par script ci-dessous (menu "Cron Jobs", section "Advanced").

### 1. Leaderboard cache — toutes les heures

Fréquence : **Every Hour** (minute=0, hour=_, day=_, month=_, weekday=_)

```bash
curl -s -H "X-Cron-Key: VOTRE_CRON_SECRET" "https://personadle.net/api/cron/leaderboard.php" > /dev/null 2>&1
```

### 2. RGPD hard delete — une fois par jour

Fréquence : **Daily at 03:00** (heure de Paris)

```bash
curl -s -H "X-Cron-Key: VOTRE_CRON_SECRET" "https://personadle.net/api/cron/hard-delete.php" > /dev/null 2>&1
```

### 3. Purge rate limits — une fois par jour

Fréquence : **Daily at 04:00** (heure de Paris)

```bash
curl -s -H "X-Cron-Key: VOTRE_CRON_SECRET" "https://personadle.net/api/cron/purge-rate-limits.php" > /dev/null 2>&1
```

### 4. Annonce Discord du daily — une fois par jour

Fréquence : **Daily at 00:05** (heure de Paris) — juste après le reset du jeu.

```bash
curl -s -H "X-Cron-Key: VOTRE_CRON_SECRET" "https://personadle.net/api/cron/discord-daily.php" > /dev/null 2>&1
```

Prérequis : `DISCORD_DAILY_WEBHOOK` défini dans `api/config.php` (webhook
Morgana du salon `#🎲┃daily-personadle`).

**À créer à la main dans hPanel → Avancé → Tâches Cron.** `crontab` n'existe
pas sur cet hébergement, la tâche ne peut pas être posée en SSH.

⚠️ **Planifier `5 0 * * *`, surtout pas `5 22 * * *`.** Le serveur tourne en
UTC. Une heure « convertie » pour tomber à 00:05 Paris en été publierait
l'annonce à 23:05 Paris en hiver — donc **avant** le reset de minuit, avec le
puzzle de la veille.

`5 0 * * *` fait tomber l'annonce entre 01:05 et 02:05 heure de Paris selon la
saison. C'est plus tard qu'idéal, mais toujours **après** le reset, ce qui est
la seule contrainte qui compte. Le script calcule sa date en `Europe/Paris`,
donc le contenu reste correct quelle que soit l'heure de déclenchement.

Tant que cette tâche n'existe pas, rien ne se poste automatiquement.

**Pour affiner ensuite :** l'horodatage du premier message automatique sur
Discord révèle si hPanel raisonne en UTC ou en heure de Paris. Avec cette
information, on peut resserrer à 00:05 pile.

Remplacer `VOTRE_CRON_SECRET` par la valeur de `CRON_SECRET` dans `api/config.php`.

## Test après déploiement

```bash
curl -H "X-Cron-Key: VOTRE_CRON_SECRET" "https://personadle.net/api/cron/leaderboard.php"
```

Expected : `{"success":true,"data":{"processed":140,"errors":[],...}}`

## Surveillance

Les logs d'erreur PHP sont dans cPanel → "Error Logs".
Si `errors` est non vide dans la réponse JSON, consulter les logs.
