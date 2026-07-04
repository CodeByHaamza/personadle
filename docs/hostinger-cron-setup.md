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

Remplacer `VOTRE_CRON_SECRET` par la valeur de `CRON_SECRET` dans `api/config.php`.

## Test après déploiement

```bash
curl -H "X-Cron-Key: VOTRE_CRON_SECRET" "https://personadle.net/api/cron/leaderboard.php"
```

Expected : `{"success":true,"data":{"processed":140,"errors":[],...}}`

## Surveillance

Les logs d'erreur PHP sont dans cPanel → "Error Logs".
Si `errors` est non vide dans la réponse JSON, consulter les logs.
