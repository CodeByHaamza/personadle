<div align="center">

# 🔧 Scripts

<img src="https://img.shields.io/badge/Node-CLI-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node CLI">
<img src="https://img.shields.io/badge/qualité-i18n%20·%20data%20·%20seed-blue?style=for-the-badge" alt="Outils">

> **Outils CLI de dev : vérif i18n, validation des données, génération du seed, migrations.**

</div>

---

## 📜 Inventaire

| Script                  | Lancement                | Rôle                                                         |
| ----------------------- | ------------------------ | ------------------------------------------------------------ |
| `check-i18n.js`         | `npm run i18n:check`     | Clés manquantes/en surplus vs `lang/en.json` (source vérité) |
| `check-i18n-untranslated.js` | `npm run i18n:check-untranslated` | Repère les valeurs FR/ES/DE/IT identiques à l'anglais (copié-collé oublié) |
| `validate_characters.js`| `npm run data:check`     | Valide le schéma des personnages (opus, arcane, âges, emoji) |
| `gen_seed_dev.mjs`      | `node scripts/gen_seed_dev.mjs` | Génère `docker/mysql/init/03_seed_dev.sql` (19 faux joueurs) |
| `migrate.sh`            | `bash scripts/migrate.sh`| Applique les migrations SQL (`sql/migrations/`)              |
| `purge_git_history.sh`  | _manuel — voir l'en-tête_| Purge l'historique git (DESTRUCTIF, garde les AOA offline)   |

---

## 🌐 `check-i18n.js`

Compare chaque langue à `lang/en.json` (source de vérité, 947 clés).

```bash
npm run i18n:check
```

| Vérification        | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| **Clés manquantes** | Présentes dans `en.json` mais absentes d'une autre langue    |
| **Clés en surplus** | Présentes dans une traduction mais absentes de `en.json`     |
| **JSON invalide**   | Fichier malformé ou vide                                     |

```
✅ fr.json — 871/871 keys OK
⚠️  de.json — 2 missing keys: ui.challenge.expire_in, badges.helel.description
```

---

## 🎭 `validate_characters.js`

Valide `database/characters_clean.js` : champs requis, valeurs d'`opus`/`arcane`/`age` dans les
listes autorisées, présence des portraits sur disque, doublons d'emojis. **Erreurs** = build cassé,
**warnings** = à surveiller.

```bash
npm run data:check
```

---

## 🌱 `gen_seed_dev.mjs`

Génère le seed Docker des **19 faux joueurs Persona** (avatars, musiques, titres, badges, couleurs,
Social Links). Régénère `docker/mysql/init/03_seed_dev.sql`, rejoué à chaque `docker compose down -v && up`.

---

## ⚠️ `purge_git_history.sh`

Récupère le poids de l'historique git (`.git` ≈ 3,6 Go) en gardant les AOA actuels (jeu offline préservé).
**DESTRUCTIF** (réécrit l'histoire + force-push) — backups et confirmation requis. Voir l'en-tête du script.

---

## 📝 Règle i18n

`lang/en.json` = **source de vérité**. Toujours ajouter une clé en EN **d'abord**, puis dans les
4 autres langues. `npm run i18n:check` avant chaque commit. → [`lang/README.md`](../lang/README.md)
