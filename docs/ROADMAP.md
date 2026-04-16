# PersonaDLE — Roadmap

> État au 16 avril 2026. Mis à jour à chaque session de développement.

---

## Statut global

| Phase | Description | Statut |
| --- | --- | --- |
| v1.0 | Jeu de base (6 modes, localStorage) | ✅ Terminée |
| v1.1 | Profil, badges, streaks, dark mode | ✅ Terminée |
| v2.0 | Backend PHP+MariaDB, comptes, social | 🔄 En cours |
| v2.1 | Contenu étendu, admin, polish | ⏳ Planifiée |

---

## v2.0 — Backend & Social (en cours)

### Infrastructure
- [x] Schéma BDD MySQL/MariaDB — 19 tables
- [x] Docker local (MariaDB 10.6 + PHP 8.3 + PhpMyAdmin)
- [x] API REST PHP — auth (register, login, logout, me)
- [x] API REST PHP — sessions (`POST /api/sessions`)
- [x] API REST PHP — user (GET/PATCH/DELETE, stats, migrate)
- [x] Migration localStorage → BDD (`migrate.php`, idempotent)
- [x] Sync offline-first (`savePendingSession` + fallback localStorage)
- [x] RGPD — soft delete + anonymisation + log `deletion_requests`
- [ ] Déploiement MariaDB chez Hostinger
- [ ] Cron `daily_targets` — génération personnage du jour côté serveur
- [ ] Cron `leaderboard_cache` — recalcul périodique classements
- [ ] Job hard delete J+30 (RGPD)

### Leaderboard
- [x] Page HTML/CSS/JS — filtres mode/période/métrique, pagination
- [x] API `/api/leaderboard` — requêtes directes + `my_rank`

### Amis
- [x] Page HTML/CSS/JS — liste, demandes, recherche, add by code
- [x] API `/api/friends` — GET/POST/PATCH/DELETE, online dots, `last_seen_at`
- [ ] Comparaison stats côte à côte (page Friends)

### Social Link
- [x] XP, rangs 1–10, interactions mutuelles (×2), flamme, jauge, toast rang-up
- [x] API `/api/social-links` — get/by-friend, interact (anti-spam, procédure SQL)
- [ ] True Confidant Badge — génération dynamique au rang 10

### Défis
- [x] Envoyer/relever un défi quotidien
- [x] API `/api/messages` — CRUD, défis par mode/jour, XP Social Link auto
- [x] Bandeau rappel défi actif dans les modes de jeu
- [x] Bouton "Challenge a friend" post-victoire (6 modes)

### Profil
- [ ] Page profil publique (dynamique ou image exportable)
- [ ] Titres/rangs joueur — déblocage automatique + équipement
- [ ] Badges → backend (conditions vérifiées côté serveur)
- [ ] Wallpapers → backend (table `wallpapers_unlocked`)
- [ ] Musique de profil — sélection parmi les musiques du jeu
- [ ] Stats globales post-partie ("X% of players found this character today")

---

## v2.1 — Polish & Contenu (planifiée)

### Nouveau contenu
- [ ] Persona 1 & 2 — ajout des personnages dans la BDD
- [ ] P5X (Persona 5 Tactica / Strikers) — personnages & GIFs AoA
- [ ] Nouveaux portraits WebP (Nyx, Yaldabaoth, Amenosagiri — déjà en assets)
- [ ] Silhouettes manquantes (Nyx, Yaldabaoth — déjà en assets)
- [ ] Nouvelles musiques (P1, P2, P5X, P5R OST)
- [ ] Quotes traduites FR/ES/DE (officielles Atlus uniquement)

### Panel Admin
- [ ] Page `/admin` protégée (rôle `is_admin` dans `users`)
- [ ] Gestion des codes événement (créer, désactiver, voir les utilisateurs)
- [ ] Stats globales du site (parties jouées, modes populaires, graphes)
- [ ] Gestion des signalements (pseudos inappropriés, etc.)
- [ ] Forcer la cible du jour par mode (override `daily_targets`)
- [ ] Vue des comptes utilisateurs (recherche, suspend, anonymise)

### Amis — compléments
- [ ] Comparaison stats côte à côte (graphe radar ou tableau)
- [ ] Notifications push (nouvelles demandes, défis reçus)
- [ ] True Confidant Badge — génération canvas (deux avatars + cadre)
- [ ] Fil d'activité amis ("Léo a trouvé en 2 essais aujourd'hui")

### UX & Responsive
- [ ] Audit responsive complet — mobile 360px → desktop
- [ ] Transitions entre modes (animation page)
- [ ] Tutoriel interactif pour nouveaux joueurs
- [ ] Accessibilité — ARIA labels complets, navigation clavier

### Technique
- [ ] Extension couverture tests (backend PHP — Pest ou PHPUnit)
- [ ] CI/CD GitHub Actions — lint + tests + déploiement Hostinger
- [ ] Script de migration versionnée (remplace `migrations/` manuel)
- [ ] `lang/jp.json` — traduction japonaise (nécessite relecture native)

---

## Backlog (post-v2.1, idées à affiner)

| Idée | Priorité estimée | Notes |
| --- | --- | --- |
| Mode Quotes — deviner le perso depuis une citation | Haute | `database/quotes.js` déjà structuré |
| Mode Image floue — révélation progressive | Moyenne | Variante du mode Silhouette |
| Tournois entre amis | Basse | Nécessite un scheduler temps réel |
| App mobile (PWA avancée) | Basse | Déjà PWA-ready, à pousser |
| Classements saisonniers (par arc Persona) | Basse | Variante leaderboard |
| Mode multijoueur temps réel | Très basse | Nécessite WebSocket — gros chantier |

---

## Décisions d'architecture actées

| Décision | Raison |
| --- | --- |
| Vanilla JS — pas de framework | Maintenabilité, pas de build step, équipe petite |
| Sessions PHP httpOnly — pas JWT | Plus simples à révoquer, suffisants pour ce projet |
| PDO + prepared statements partout | Sécurité SQL injection |
| Offline-first + sync queue | Jeu jouable même sans connexion |
| `rank` en backticks SQL | Mot réservé MySQL 8.0 (window function) |
| SW JS/CSS network-first | Évite Ctrl+Shift+R après chaque déploiement |

---

*Document vivant — mettre à jour après chaque session.*
