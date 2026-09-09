# Changelog technique — PersonaDLE v2.2

> Destiné aux développeurs (contributeurs, mainteneurs). Détail précis par commit :
> fichiers touchés, décisions d'architecture, angles morts connus.
>
> Le fichier `PersonaDLE 2.2/PersonaDLE_Update.html` reste le changelog **joueur** —
> highlights uniquement, langage non technique. Toute modification notable doit être
> ajoutée ici (règle CLAUDE.md §9), et seulement reportée dans le HTML joueur si elle
> est réellement visible/parlante côté joueur.
>
> Les entrées de la v2.1 (livrée) et des versions antérieures restent dans leurs
> dossiers respectifs — elles ne sont pas recopiées ici.

---

## 2026-09-09 — Règle : aucune signature d'outil dans l'historique

Les trois commits du lot précédent portaient des *trailers* de signature d'outil
(`Co-Authored-By`, lien de session) et le corps de la PR #108 finissait par une mention
« generated with ». Ajoutés automatiquement par l'outillage, jamais décidés. L'historique
du dépôt est celui de l'équipe : le crédit va aux humains qui décident.

### Détails techniques

- `CLAUDE.md` §4 : nouvelle sous-section « Messages de commit et corps de PR — RÈGLE
  ABSOLUE : aucune signature d'outil ». Couvre messages de commit, titres et corps de PR,
  commentaires de code et entrées de changelog. Seule exception : une demande explicite,
  formulée pour le lot en cours.
- Le point important est que ces signatures sont ajoutées **par défaut** par l'outillage :
  la consigne est de les **retirer activement** avant de pousser (`git log -1 --format=%B`),
  pas seulement de « ne pas les écrire ».
- Les commits déjà mergés dans `develop` les gardent : réécrire un historique partagé
  coûterait plus cher que le bénéfice cosmétique. La règle vaut pour la suite.

---

## 2026-09-09 — CLAUDE.md : règle de branches explicitée

`main` = prod (pull automatique Hostinger à chaque push). Le flux `feature/*` → `develop`
→ `main` n'était écrit nulle part dans `CLAUDE.md` : il n'existait que dans les commentaires
de `.github/workflows/pr-base-guard.yml`, donc invisible pour qui lit la doc avant de coder.

### Détails techniques

- `CLAUDE.md` §4 : nouvelle sous-section « Branches — RÈGLE ABSOLUE ». Toute PR de travail
  vise `develop` ; le **seul** merge légitime sur `main` est `develop` → `main` au moment
  de sortir une version, et c'est un acte de release décidé explicitement.
- Le garde-fou CI (« PR base guard », exceptions `develop`/`hotfix/*`/`dependabot/*`) y est
  décrit comme un **filet**, pas comme la règle : il ne voit que les PR déjà ouvertes sur
  `main` et ne dit rien du reste.

---

## 2026-09-09 — ouverture du dossier v2.2

La v2.1 est livrée : son dossier ne reçoit plus que d'éventuels correctifs de la 2.1
elle-même. Tout ce qui suit part donc dans `PersonaDLE 2.2/`.

### Détails techniques

- `PersonaDLE 2.2/DEV_CHANGELOG.md` (ce fichier) + `PersonaDLE 2.2/PersonaDLE_Update.html`
  (squelette bilingue EN/FR repris de la 2.1 : même thème, même barre de progression, même
  bouton retour — il ne reste qu'à le remplir).
- `.gitignore` : bloc de 3 lignes pour `PersonaDLE 2.2` (`!dossier`, `dossier/*`,
  `!dossier/fichier`). **Sans lui, tout fichier ajouté au dossier serait ignoré en
  silence** — c'est exactement le piège documenté dans `.gitignore` depuis le 2026-08-29.
  Vérifié après coup : `git check-ignore -v` désigne bien une règle de ré-inclusion, et
  `git status -uall` voit les deux fichiers.
- `CLAUDE.md` §9 mise à jour (la 2.2 devient la version en cours de développement), avec
  la marche à suivre pour la 2.3 — le `.gitignore` y est désormais mentionné, il manquait
  à la consigne d'ouverture de la 2.2.
- L'entrée `version-item` du modal « Nouveautés » de `index.html` sera à ajouter **à la
  sortie** de la 2.2, pas maintenant : elle serait visible par les joueurs.

---

## 2026-09-09 — sécurité : le rate limiting se laissait contourner par un simple header

Contribution externe (PR #107, @Picsou06) + durcissement.

Les 5 endpoints protégés par IP (`auth/login`, `auth/register`, `auth/request-reset`,
`auth/reset-password`, `user/search`) construisaient leur clé `rate_limits` comme ceci :

```php
$firstIp = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')[0]);
$rlIp    = filter_var($firstIp, FILTER_VALIDATE_IP) ? $firstIp : ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
```

Le commentaire au-dessus affirmait que valider le format « empêche le spoofing ». **C'est
faux** : `FILTER_VALIDATE_IP` valide la *forme*, jamais la *provenance*. Le header est
envoyé par le client, et rien devant Apache ne l'écrase. Donc :

```
X-Forwarded-For: 1.2.3.<compteur>
```

→ une clé neuve à chaque requête → **plus aucune limite** sur :

| Endpoint | Quota annoncé | Ce qui redevenait illimité |
|---|---|---|
| `auth/login` | 5 / 15 min | bruteforce de mot de passe |
| `auth/reset-password` | 10 / 15 min | bruteforce du token de reset |
| `auth/request-reset` | 3 / 15 min | spam d'emails depuis notre domaine (réputation d'envoi) |
| `auth/register` | 5 / 15 min | création de comptes en masse |
| `user/search` | 30 / 5 min | énumération des pseudos / friend_codes |

### Détails techniques

- Les 5 blocs dupliqués sont remplacés par `getClientIp()` (`api/bootstrap.php`), qui
  délègue à `personadle_client_ip()` — nouveau fichier `api/lib/client_ip.php`, logique
  pure, sans BDD, testable (même motif que `lib/authz.php`, `lib/format.php`).
- **X-Forwarded-For n'est plus lu par défaut.** Il ne l'est que si `REMOTE_ADDR` est
  lui-même listé dans `TRUSTED_PROXIES` (`api/config.php`, **vide par défaut**), et la
  chaîne est alors parcourue de **droite à gauche** : chaque proxy traversé ajoute son
  pair à la fin, donc le dernier hop non approuvé est le seul que le client ne peut pas
  écrire. Tout ce qu'il a inventé lui-même se retrouve à gauche et est ignoré.
  `personadle_ip_in_range()` accepte IP exacte et CIDR, IPv4 et IPv6 (comparaison
  binaire `inet_pton`, pas de mélange de familles).
- Repli sur `'unknown'` (et non `'127.0.0.1'`) si `REMOTE_ADDR` est absent ou illisible :
  seau partagé assumé, mais pas une IP qui ressemble à une vraie dans la table.
- `personadle_normalize_trusted_proxies()` tolère une constante absente, écrite en chaîne
  simple ou remplie d'entrées vides — `api/config.php` est édité à la main sur le serveur
  et n'est pas versionné, un `TypeError` y transformerait `/api/auth/login` en 500.
- `tests/php/ClientIpTest.php` — 26 cas. Le premier (`testIgnoresSpoofedForwardedFor…`)
  est le test de non-régression : il repasse rouge si quelqu'un refait confiance au
  header sans passer par `TRUSTED_PROXIES`.
- `api/README.md` et `tests/README.md` mis à jour ; chiffres de doc via `npm run docs:fix`.
- `phpstan.neon` : `TRUSTED_PROXIES` ajoutée aux `dynamicConstantNames` (sa valeur dépend
  de l'environnement, comme `APP_ENV`).

### ⚠️ Angle mort à lever avant la mise en prod

`curl -sI https://personadle.net` renvoie `server: hcdn` — **le CDN Hostinger répond
devant le site**. Si ce CDN termine réellement la connexion PHP, `REMOTE_ADDR` vaut son
IP pour *tous* les visiteurs, et keyer dessus ferait partager **un seul seau à tout le
monde** : 5 connexions / 15 min pour le site entier, soit un auto-DoS du login. À
trancher empiriquement, côté SSH, avant de déployer :

```bash
ssh hostinger-personadle "tail -50 ~/logs/*access*"   # 1ʳᵉ colonne = REMOTE_ADDR
```

- IPs variées = celles des vrais visiteurs → rien à faire, `TRUSTED_PROXIES` reste vide.
- Une poignée d'IPs identiques pour tout le monde → y mettre ces IPs/CIDR, le code
  déroule alors X-Forwarded-For correctement (chemin déjà couvert par les tests).

Documenté aussi dans `DEPLOY.md` § Dépannage (ligne « 429 alors qu'un seul essai ») et
dans `api/config.example.php`.

### Non traité ici (PR #107 annonçait un audit non commité)

Le message de commit de la PR mentionne « docs: add security audit of trust boundaries in
api/ » et 3 autres trouvailles — **aucun fichier de doc n'est présent dans le diff** (le
4ᵉ commit de la PR annule une modif de `.gitignore` faite par le 1ᵉʳ : la doc s'est très
probablement fait avaler, cf. le piège documenté dans `.gitignore` lui-même). Les 3
points cités, à traiter séparément :

1. `/api/sessions` — cible attendue seulement **journalisée**, pas rejetée (cohérent avec
   la « phase 1, détection » assumée dans CLAUDE.md §3 — à confirmer comme choix).
2. Drift possible sur la contrainte unique de `game_sessions` entre migrations et prod
   (`SELECT version FROM schema_migrations` = seule source fiable).
3. Image silhouette lisible dans l'onglet Network — à recouper avec `js/silhouette_mask.js`
   (le masque est déjà cuit dans les pixels ; reste à vérifier ce qui transite).
