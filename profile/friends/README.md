<div align="center">

# 👥 Système d'amis

> **Trouve tes alliés, envoie des défis, monte les rangs du Social Link.**

</div>

---

## Structure

```
profile/friends/
├── friends.html    ← page HTML
├── friends.css     ← styles (listes, cartes, animations TV/Calling Card)
└── friends.js      ← logique (recherche, demandes, interactions Social Link)
```

---

## Fonctionnalités

| Feature | Description |
|---------|-------------|
| Recherche | Par pseudo ou code ami (8 caractères alphanumériques) |
| Demandes | Envoyer, accepter, refuser, supprimer |
| Messagerie & Défis | Défis quotidiens par mode, résolution auto |
| Browse Players | Liste de tous les joueurs inscrits, paginée |
| Social Link | Visite de profil déclenche automatiquement l'XP Social Link |

## Chemins relatifs

Depuis `profile/friends/`, les ressources partagées sont à deux niveaux :
- CSS global : `../../css/`
- JS partagé : `../../js/`
- Styles profil : `../profile-page.css`
