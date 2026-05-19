<div align="center">

# 🔧 Scripts

> **Utilitaires de développement — vérification i18n et outils CLI.**

</div>

---

## Structure

```
scripts/
└── check-i18n.js   ← Détecte les clés manquantes ou en surplus dans les fichiers lang/
```

---

## `check-i18n.js`

Compare tous les fichiers de traduction par rapport à `lang/en.json` (source de vérité).

### Usage

```bash
npm run i18n:check
```

### Ce que ça vérifie

| Vérification        | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| **Clés manquantes** | Présentes dans `en.json` mais absentes dans une autre langue |
| **Clés en surplus** | Présentes dans une traduction mais absentes de `en.json`     |
| **JSON invalide**   | Fichier malformé ou vide                                     |

### Exemple de sortie

```
✅ fr.json — 760/760 keys OK
✅ es.json — 760/760 keys OK
⚠️  de.json — 2 missing keys:
    - ui.challenge.expire_in
    - badges.helel.description
✅ it.json — 760/760 keys OK
```

---

## Règle i18n

`lang/en.json` est la **source de vérité** (760 clés).  
Toujours ajouter une nouvelle clé dans `en.json` en **premier**, puis dans les 4 autres langues.  
Lancer `npm run i18n:check` avant chaque commit pour ne pas déployer des clés manquantes.

→ Documentation complète : [`lang/README.md`](../lang/README.md)
