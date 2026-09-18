<!--
  Modèle de PR — PersonaDLE. Base : `develop` (jamais `main`, sauf release develop → main).
  Les cases sont la Definition of Done de CLAUDE.md §13 : coche ce qui s'applique, supprime
  le reste. Pas de signature d'outil dans le titre, le corps ou les commits (CLAUDE.md §4).
-->

## Pourquoi

<!-- Le problème ou le besoin, en deux phrases. Retour joueur ? Bug vu où ? Décision de qui ? -->

## Quoi

<!-- Ce que la PR change, du point de vue du joueur d'abord, puis technique si utile. -->

-

## Vérifications

- [ ] `npm test` · `npm run lint` · `npm run i18n:check` · `npm run docs:check` · `npm run pools:check`
- [ ] E2E (`make up` + `npm run test:e2e`) si le parcours touché a une spec — ou spec ajoutée
- [ ] Rendu vérifié (capture jointe) en clair **et** sombre, desktop **et** mobile, si l'UI bouge

### Selon le type de changement

- [ ] **Migration SQL** — rejouée pour de vrai contre une base **vierge** (pas déjà migrée), rejouable (`IF [NOT] EXISTS`), ajoutée à la checklist « Bloquant release » de `TODO.md`, backup rappelé avant tout `DROP`/`DELETE`
- [ ] **Nouveau `.php` dans `api/user/` ou `api/admin/`** — sa `RewriteRule` dans le `.htaccess` du dossier
- [ ] **PHP** — PDO préparé ligne par ligne sur le diff ; condition de déblocage vérifiée **côté serveur**
- [ ] **i18n** — clé EN d'abord, puis les 5 autres langues ; textes de lore/noms non traduits
- [ ] **Données de jeu** — `npm run data:check`, `pools:build` ; personas multi-wielders selon CLAUDE.md §4
- [ ] **Assets** — restent dans le dépôt (jouable 100 % en local) ; AOA aussi uploadé sur R2
- [ ] **État dérivé** (localStorage, cloud sync) — tous les chemins d'écriture de la source tracés, invalidation vérifiée
- [ ] **Config partagée** (ports, env, CI) — vérifiée contre `docker-compose.yml` / `.env.example`

## Docs

- [ ] `PersonaDLE 2.x/DEV_CHANGELOG.md` — entrée datée (pourquoi, fichiers, angles morts)
- [ ] `PersonaDLE_Update.html` (joueur, FR + EN) — **seulement** si visible par un joueur
- [ ] README du dossier touché, CLAUDE.md si une règle ou un piège change

## Angles morts

<!-- Ce que la PR ne couvre pas, ce qu'il faudra surveiller en prod, ce qui reste à décider. -->
