# Admin Panel — Design Spec

_Date : 2026-04-30 | Statut : approuvé_

---

## 1. Périmètre

Page d'administration dédiée `/admin/index.html` réservée aux utilisateurs `is_admin = true`.
Permet de gérer **tous les utilisateurs et toutes les données de la BDD** : badges, wallpapers, titres, stats, amis, Social Links, profil.

Bugs corrigés dans cette même session (hors spec) :

- Badge zoom modal invisible sur `index.html` (CSS manquant)
- Avatar bottomNav non mis à jour après cloud sync sur `index.html`

---

## 2. Base de données

### Migration 008

```sql
ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0;
UPDATE users SET is_admin = 1 WHERE pseudo = 'admin';
```

### Impact `formatUser()`

Ajouter `'is_admin' => (bool)($row['is_admin'] ?? false)` dans le retour de `formatUser()` dans `api/bootstrap.php`. La clé est ainsi exposée dans `/api/auth/me` → disponible dans `window._currentUser.is_admin`.

---

## 3. Backend — `/api/admin/`

### Middleware `requireAdmin()`

Ajouté dans `api/bootstrap.php`. Vérifie :

1. Session PHP active (`$_SESSION['user_id']`)
2. `SELECT is_admin FROM users WHERE id = ? AND is_deleted = 0` → doit être `1`

Retourne `403 Forbidden` sinon. **Chaque endpoint admin appelle `requireAdmin()` en première ligne.**

### Endpoints

| Méthode | Chemin                                 | Description                                                                    |
| ------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| GET     | `/api/admin/users`                     | Liste tous les users (search `?q=`, pagination `?page=`)                       |
| GET     | `/api/admin/users/:id`                 | Détail complet d'un user (stats, badges, walls, titles, friends, social links) |
| PATCH   | `/api/admin/users/:id`                 | Modifier pseudo, email, lang, border_color, is_admin                           |
| DELETE  | `/api/admin/users/:id`                 | Hard delete immédiat (admin uniquement)                                        |
| POST    | `/api/admin/users/:id/badges`          | Body `{slug}` → insert dans `badges_unlocked`                                  |
| DELETE  | `/api/admin/users/:id/badges/:slug`    | Retirer badge                                                                  |
| POST    | `/api/admin/users/:id/wallpapers`      | Body `{wallpaper_id}` → insert dans `user_wallpapers`                          |
| DELETE  | `/api/admin/users/:id/wallpapers/:wid` | Retirer wallpaper                                                              |
| POST    | `/api/admin/users/:id/titles`          | Body `{title_id}` → insert dans `user_titles`                                  |
| DELETE  | `/api/admin/users/:id/titles/:tid`     | Retirer titre                                                                  |
| PATCH   | `/api/admin/users/:id/titles/equip`    | Body `{title_id\|null}` → met à jour `profiles.equipped_title_id`              |
| PATCH   | `/api/admin/users/:id/stats`           | Body `{mode, wins, giveups, games, streak, streak_record, perfect_wins}`       |
| DELETE  | `/api/admin/users/:id/friends/:fid`    | Supprimer relation d'amitié                                                    |
| PATCH   | `/api/admin/social-links/:id`          | Body `{xp, rank}` → forcer XP et rang d'un Social Link                         |

Fichiers PHP :

```
api/admin/
├── users.php           ← GET /api/admin/users
├── user.php            ← GET|PATCH|DELETE /api/admin/users/:id
├── user_badges.php     ← POST|DELETE badges
├── user_wallpapers.php ← POST|DELETE wallpapers
├── user_titles.php     ← POST|DELETE|PATCH titles
├── user_stats.php      ← PATCH stats
├── user_friends.php    ← DELETE friendship
└── social_links.php    ← PATCH social link
```

`.htaccess` dans `api/admin/` avec RewriteRules pour chaque fichier.

---

## 4. Frontend

### Fichiers

```
admin/
├── index.html   ← shell page (redirect si !is_admin)
├── admin.css    ← styles dark Persona
└── admin.js     ← logique complète (vanilla ES6 module)
```

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ PERSONADLE ADMIN                    [admin] [Logout]     │
├──────────────┬──────────────────────────────────────────────┤
│  SIDEBAR     │  ZONE PRINCIPALE                             │
│  (fixe)      │                                              │
│  👥 Users    │  [🔍 Recherche pseudo / email / friend_code] │
│  🏅 Badges   │                                              │
│  🖼️  Walls   │  cards utilisateurs (avatar + pseudo + email)│
│  👑 Titles   │                                              │
│  📊 Stats    │  ──── panneau détail (user sélectionné) ──── │
│  👫 Social   │  [avatar] pseudo  email  created_at          │
│              │  ┌──────────────────────────────────────┐    │
│              │  │ Profil│Badges│Walls│Titles│Stats│... │    │
│              │  │  (onglets internes)                  │    │
│              │  └──────────────────────────────────────┘    │
│              │                                              │
│              │  🟠 [Appliquer les dons (3)] ← fab flottant  │
└──────────────┴──────────────────────────────────────────────┘
```

### Onglets du panneau détail

**Profil**

- Champs éditables : pseudo, email, couleur border (color picker), lang (dropdown)
- Toggle `is_admin`
- Bouton "Réinitialiser l'avatar"
- Bouton "Supprimer le compte" (avec confirmation)

**Badges**

- Grille de tous les badges (60+) avec image + nom
- Badge débloqué = coloré + icône ✓ ; verrouillé = grisé
- Clic → ajoute le don à la file d'attente (pas appliqué immédiatement)
- Visuel : badge s'illumine avec halo "en attente"

**Wallpapers**

- Grille avec aperçu miniature (image réelle)
- Même comportement toggle + file d'attente

**Titles**

- Liste complète avec rarity colorée
- Checkboxes pour donner/retirer
- Dropdown séparé "Titre équipé" (appliqué immédiatement, pas dans la file)

**Stats**

- Tableau par mode (6 modes)
- Colonnes : wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms
- Champs `<input type="number">` editables inline
- Ajoutés à la file d'attente comme les badges

**Friends**

- Liste des amis avec avatar + pseudo
- Bouton 🗑️ par ligne (confirmation inline)

**Social Links**

- Liste des Social Links avec pseudo de l'autre user + rang actuel + XP
- Input XP éditable + dropdown rang forcé
- Ajouté à la file d'attente

---

## 5. Système de file d'attente & Animation "Don Divin"

### File d'attente (pendingGifts)

```js
// Structure interne dans admin.js
pendingGifts = [
  { type: 'badge',     id: 'ace_detective', label: 'Ace Detective', img: '...' },
  { type: 'wallpaper', id: 'kamoshida_palace', label: 'Kamoshida Palace', img: '...' },
  { type: 'title',     id: 42, label: 'Phantom Thief' },
  { type: 'stats',     mode: 'classic', data: { wins: 50, streak: 10, ... } },
]
```

Bouton flottant `⚡ Appliquer (N)` apparaît dès qu'il y a ≥1 item en attente.
Au clic :

1. Toutes les requêtes API sont envoyées en `Promise.all()`
2. Si tout réussit → déclencher l'animation
3. Si erreur partielle → notifier les échecs sans animation

### Animation "Don Divin" (Velvet Room style)

**Déclenchement** : après confirmation backend réussie.

**Séquence** :

1. Overlay plein écran apparaît : fond `#050a1a` (bleu nuit), particules dorées qui tombent (CSS `@keyframes`)
2. Texte centré : _"The Admin has spoken…"_ — Cinzel font, doré
3. Les items apparaissent en **cartes** depuis le haut, léger éventail :
   - Badges → carte avec image du badge
   - Wallpapers → carte avec miniature
   - Titles → carte texte avec rarity color
   - Stats → carte résumé chiffré
4. Chaque carte a une animation `drop-in` décalée (50ms par item)
5. Particules burst au moment où chaque carte atterrit
6. Auto-dismiss après 3s ou clic n'importe où
7. Post-animation : reload du panneau détail pour refléter l'état réel

**Fichiers CSS/JS** : inline dans `admin.css` et `admin.js`, pas de dépendances externes.

---

## 6. Sécurité

- `requireAdmin()` vérifie en BDD à chaque requête (pas seulement en session)
- Le frontend `/admin/` redirige vers `/` si `_currentUser?.is_admin !== true`
- Aucun endpoint admin n'est exposé dans le `.htaccess` global
- Suppression hard delete réservée aux admins (pas la suppression douce RGPD)
- Les modifications de stats ne peuvent pas créer de valeurs négatives (validation PHP)

---

## 7. Style visuel

- Background : `#0a0a0f` (noir profond)
- Accent principal : `#e63946` (rouge Persona)
- Accent secondaire : `#ffd700` (doré — réservé à l'animation divine)
- Typo : Oswald (déjà chargée globalement) pour les titres, system-ui pour le corps
- Cards utilisateurs : border `1px solid rgba(255,255,255,0.08)`, hover élève avec glow rouge
- Sidebar active item : border-left rouge + fond légèrement éclairé
- Rarity colors : common=gris, rare=bleu, epic=violet, legendary=doré

---

## 8. Ce qui n'est PAS inclus (hors scope)

- Gestion du catalogue badges/wallpapers/titles (créer/modifier les entrées catalog) → post-v2.0
- Logs d'audit des actions admin → post-v2.0
- Multi-admin avec niveaux de permissions → post-v2.0
