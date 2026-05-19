# Configuration cron Hostinger — Leaderboard Cache

## Prérequis

1. `CRON_SECRET` défini dans `api/config.php` sur le serveur Hostinger
2. Script déployé à `https://personadle.net/api/cron/leaderboard.php`

## Hostinger cPanel → Cron Jobs

1. Connexion au cPanel Hostinger
2. Menu "Cron Jobs" (section "Advanced")
3. Fréquence : **Every Hour** (minute=0, hour=_, day=_, month=_, weekday=_)
4. Commande :

```bash
curl -s "https://personadle.net/api/cron/leaderboard.php?key=VOTRE_CRON_SECRET" > /dev/null 2>&1
```

Remplacer `VOTRE_CRON_SECRET` par la valeur de `CRON_SECRET` dans `api/config.php`.

## Test après déploiement

```bash
curl "https://personadle.net/api/cron/leaderboard.php?key=VOTRE_CRON_SECRET"
```

Expected : `{"success":true,"data":{"processed":140,"errors":[],...}}`

## Surveillance

Les logs d'erreur PHP sont dans cPanel → "Error Logs".
Si `errors` est non vide dans la réponse JSON, consulter les logs.
