<div align="center">

# 📄 Pages secondaires

> **Pages HTML autonomes qui ne sont ni un mode de jeu ni le profil : erreurs, légal, support.**

</div>

Ce dossier regroupe les pages qui cohabitaient auparavant à la racine du projet à côté de la
config (`package.json`, `.htaccess`…). Déplacées ici le 2026-07-05 pour clarifier l'arborescence
(cf. `AMELIORATIONS.md` #6).

## Contenu

| Fichier                | Rôle                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `404.html`              | Page d'erreur 404 (référencée par `.htaccess` → `ErrorDocument 404`) |
| `privacy.html` + `privacy.css` | Politique de confidentialité & mentions légales (RGPD)     |
| `faq.html`              | Foire aux questions                                                |
| `reset-password.html`   | Formulaire de réinitialisation de mot de passe (lien envoyé par email, `api/auth/request-reset.php`) |

`sw.js` (service worker) **reste à la racine** — son scope ne couvre que son propre dossier et
les sous-dossiers, le déplacer casserait le cache offline de tout le site en dehors de `pages/`.

## ⚠️ Si tu déplaces ou renommes un fichier ici

Ces pages sont référencées depuis plusieurs endroits qui ne sont pas des liens `<a href>` évidents
à retrouver par simple recherche visuelle. Avant de renommer/déplacer quoi que ce soit, vérifier
(`grep -rn "nom_du_fichier"`) :

- **`.htaccess`** (racine) — `ErrorDocument 404 /pages/404.html`
- **`sw.js`** — précache `SW_BASE + "/pages/404.html"`
- **`sitemap.xml`** — URL absolue de `404.html`
- **`api/auth/request-reset.php`** — construit l'URL de `reset-password.html` envoyée par email
  aux utilisateurs (casser ce lien = emails de reset cassés en prod, silencieusement)
- **`index.html`**, **`profile/profile.html`** — liens `<a href>` vers `privacy.html`/`faq.html`
- **`js/bottomNav.js`** — `buildHrefs()` détecte la profondeur du chemin courant via une liste
  explicite de dossiers connus (`/profile/`, `/classiqueMode/`, …, `/pages/`) pour calculer les
  liens relatifs de la barre de navigation basse (`./`, `../`, `../../`). Un nouveau dossier non
  listé ici casserait silencieusement cette nav sur les pages qu'il contient.
- **Chaque page elle-même** : tous ses chemins relatifs internes (`../css/`, `../img/`,
  `../js/`, `../assets/`, `../index.html`) sont relatifs à **ce dossier** (`pages/`), pas à la
  racine — `privacy.html` fait exception pour `privacy.css` (`./privacy.css`, même dossier).
- **`DEPLOY.md`** — liste des fichiers à uploader en prod (Hostinger)
