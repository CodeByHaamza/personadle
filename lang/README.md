<div align="center">

# 🌐 Traductions i18n

> **Cinq langues. Une seule source de vérité : `en.json`.**

</div>

Contient les traductions de toute l'interface de PersonaDLE.

---

## Fichiers

| Fichier   | Langue   | Statut                            |
| --------- | -------- | --------------------------------- |
| `en.json` | Anglais  | ✅ Complet — **source de vérité** |
| `fr.json` | Français | ✅ Complet                        |
| `es.json` | Espagnol | ✅ Complet                        |
| `de.json` | Allemand | ✅ Complet                        |
| `it.json` | Italien  | ✅ Complet                        |
| `jp.json` | Japonais | ⏳ Envisagé                       |

> Les 5 langues actives sont synchronisées (871 clés chacune, vérifié par `npm run i18n:check`).

> `en.json` est toujours la référence. En cas de clé manquante dans une autre langue, le système affiche la version anglaise.

---

## Structure des clés

```
ui.*             → Boutons, labels, placeholders globaux
modes.classic.*  → Mode Classique (règles, messages, tooltips)
modes.emoji.*    → Mode Emoji
modes.silhouette.* → Mode Silhouette
modes.alloutattack.* → Mode All-Out Attack
modes.personae.* → Mode Personae
modes.music.*    → Mode Musique
game.*           → Messages génériques de jeu (victoire, abandon, timer)
profile.*        → Page profil (stats, labels, confirmations)
badges.*         → Noms, conditions et descriptions des badges
social_link.*    → Noms des 10 rangs Social Link, messages XP
auth.*           → Connexion, inscription, erreurs API
leaderboard.*    → Classement (onglets, périodes, labels)
index.*          → Page d'accueil (titre, footer, liens)
errors.*         → Messages d'erreur (404, filtres vides, chargement)
```

Les variables dynamiques utilisent la syntaxe `{{variable}}` :

```json
"win_message": "Congratulations! Found in {{count}} attempt(s)!"
```

---

## Ce qu'on ne traduit pas

- Noms de personnages, Personae, musiques
- Codes opus : P3, P4G, P5R, PQ2…
- Noms de jeux : "Persona 5 Royal", "Persona Q2"…
- Termes de la lore conservés en anglais : "All-Out Attack", "Velvet Room", "Phantom Thieves", "Arcana", "Shadow"
- Quotes des personnages (dans `database/quotes.js`)

---

## Ajouter une nouvelle string UI

1. Ajouter la clé dans `en.json` en premier
2. Ajouter la même clé dans `fr.json` (et ES/DE si disponibles)
3. Vérifier la cohérence : `npm run i18n:check`
4. Dans le HTML : `<element data-i18n="clé.json">Fallback text</element>`

---

## Vérifier la cohérence entre fichiers

```bash
npm run i18n:check
```

Affiche les clés présentes dans `en.json` mais manquantes dans les autres langues.
Un exit code `1` indique des clés manquantes (bloque le CI si configuré).

---

## Ajouter une nouvelle langue

1. Copier `en.json` → `xx.json` (code ISO 639-1 : `es`, `de`, `jp`…)
2. Traduire toutes les valeurs (ne pas modifier les clés)
3. Ajouter `'xx'` dans le tableau `TARGET_LANGS` de `scripts/check-i18n.js`
4. Mettre à jour ce README (tableau des fichiers ci-dessus)
5. Mettre à jour `SUPPORTED_LANGS` dans `js/i18n.js`
