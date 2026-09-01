# Migrations SQL

Historique des évolutions de schéma, numérotation chronologique `NNN_description.sql`.

> 🚨 **Ce dossier n'est PAS le reflet de la prod.** Cette ligne disait
> « déjà appliquées en prod » — c'était vrai à l'époque du dépôt mono-branche, ça ne
> l'est plus : une migration est écrite sur `develop` et n'atteint la prod qu'à la
> release suivante. Au 2026-09-01, **029 → 038 attendent encore d'être jouées** (la
> prod s'arrête à la 028), et cette formule a directement contribué à ce qu'elles
> soient oubliées de la checklist de release.
>
> **La seule source fiable, c'est la base elle-même** — table créée par la 026 :
>
> ```bash
> mysql -u <user> -p <db> -e "SELECT version FROM schema_migrations ORDER BY version;"
> ```
>
> La liste de ce qui reste à jouer vit dans la section « Bloquant release » de
> [`TODO.md`](../../TODO.md).

---

> ⚠️ **Source unique du schéma = [`../bdd_mysql.sql`](../bdd_mysql.sql).**
> C'est lui que charge Docker au démarrage et qui doit refléter la prod. Ces
> migrations sont des **archives** : toute nouvelle colonne/table/contrainte doit
> AUSSI être intégrée à `bdd_mysql.sql`, sinon Docker diverge du code (cf. les
> bugs `is_admin`, `uq_session_per_day`, `social_link_rankup_notifs`).
>
> Le test `tests/php/DatabaseIntegrationTest.php` garde-fou cette cohérence en CI.

Ancien emplacement `api/migrations/` consolidé ici (le `001` historique de
fondation a été renommé `000_social_foundation.sql` pour éviter la collision).

> Note : la numérotation saute de `009` à `011` (pas de `010`) — écart connu de la
> consolidation, la suite reste continue à partir de `011`.
