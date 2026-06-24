# Migrations SQL

Historique des évolutions de schéma (déjà appliquées en prod). Numérotation
chronologique `NNN_description.sql`.

> ⚠️ **Source unique du schéma = [`../bdd_mysql.sql`](../bdd_mysql.sql).**
> C'est lui que charge Docker au démarrage et qui doit refléter la prod. Ces
> migrations sont des **archives** : toute nouvelle colonne/table/contrainte doit
> AUSSI être intégrée à `bdd_mysql.sql`, sinon Docker diverge du code (cf. les
> bugs `is_admin`, `uq_session_per_day`, `social_link_rankup_notifs`).
>
> Le test `tests/php/DatabaseIntegrationTest.php` garde-fou cette cohérence en CI.

Ancien emplacement `api/migrations/` consolidé ici (le `001` historique de
fondation a été renommé `000_social_foundation.sql` pour éviter la collision).
