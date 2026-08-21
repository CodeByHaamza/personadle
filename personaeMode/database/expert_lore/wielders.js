/**
 * personaeMode/database/expert_lore/wielders.js
 * Réponses acceptées pour une fiche du mode Personae Expert.
 *
 * En mode Personae, le joueur ne devine pas le nom de la persona mais **son
 * manieur** (`personaeMode/database/persona.js` est la liste d'autocomplétion, et
 * elle contient des noms de personnages : Makoto Yuki, Aigis…).
 *
 * Une fiche de lore décrit une figure mythologique, pas une entrée précise du
 * dataset. Or la même figure est portée par plusieurs entrées :
 *   - variantes cosmétiques d'un même personnage (`Orpheus Picaro`, `Thanatos
 *     Picaro`…), qui n'ont volontairement pas de fiche à elles ;
 *   - homonymes réellement distincts (`Hermes` de Junpei Iori en P3 et celui de
 *     Jun Kurosu en P2IS — deux dessins, deux entrées, cf. CLAUDE.md §4).
 *
 * Décision produit (2026-08-15, Hamza) : la fiche accepte **tous les manieurs de
 * toutes ces entrées**. La description d'Hermès parle du dieu grec, elle est donc
 * juste pour Junpei comme pour Jun ; celle d'Orphée vaut pour Makoto, Kotone et
 * Aigis. Refuser l'un des deux serait perçu comme un bug : rien dans le texte ne
 * permet de les départager.
 */

/** Nom de base d'une entrée : « Orpheus ( Male ) » → « Orpheus ». */
const baseName = (nom) => nom.replace(/\s*\(.*?\)\s*/g, " ").trim();

/**
 * Entrées du dataset couvertes par une fiche de lore : celle de même nom de base,
 * plus ses variantes suffixées (`Picaro`, `Telos`…).
 *
 * Le test de préfixe exige un espace (`base + " "`) pour ne jamais attraper une
 * persona simplement homographe au début — « Hermes » ne doit pas ramasser une
 * hypothétique « Hermesian ».
 *
 * @param {string} loreKey  clé de expert_lore/<lang>.json
 * @param {{persona: string, user: string[]}[]} personae  personaeCharacters
 */
export function expertLoreEntries(loreKey, personae) {
  const base = baseName(loreKey);
  return personae.filter((p) => {
    const nom = baseName(p.persona);
    return nom === base || nom.startsWith(`${base} `);
  });
}

/**
 * Manieurs acceptés comme bonne réponse pour une fiche, sans doublon.
 *
 * @param {string} loreKey  clé de expert_lore/<lang>.json
 * @param {{persona: string, user: string[]}[]} personae  personaeCharacters
 * @returns {string[]} noms de personnages
 */
export function expertWielders(loreKey, personae) {
  return [...new Set(expertLoreEntries(loreKey, personae).flatMap((p) => p.user))];
}
