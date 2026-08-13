import { describe, it, expect } from "vitest";

// Garde-fou (bug 2.1) : un personnage ajouté au dataset d'un mode mais OUBLIÉ dans
// la liste de noms d'autocomplétion de ce mode est injouable (jamais proposé à la
// saisie). Chaque mode a sa liste de noms séparée — facile à oublier. Ce test
// vérifie que tout personnage devinable figure bien dans la liste de son mode.

import { characters } from "../database/characters_clean.js";
import { personas } from "../database/personas.js";
import { silhouetteCharacters } from "../silhouetteMode/database/silhouetteCharacters.js";
import { personas as silPersonas } from "../silhouetteMode/database/persona.js";
import { personaeCharacters } from "../personaeMode/database/personaeCharacters.js";
import { personas as perPersonas } from "../personaeMode/database/persona.js";
import { aoaCharacters } from "../allOutAttackMode/database/aoaCharacters.js";
import { personas as aoaPersonas } from "../allOutAttackMode/database/personas_allOut.js";

/** Noms présents dans le dataset mais absents de la liste d'autocomplétion. */
function missingFromList(datasetNames, list) {
  const set = new Set(list);
  return [...new Set(datasetNames)].filter((name) => !set.has(name));
}

describe("les listes d'autocomplétion couvrent tous les personnages devinables", () => {
  it("classic / emoji : characters_clean.js ⊆ personas.js", () => {
    expect(missingFromList(characters.map((c) => c.nom), personas)).toEqual([]);
  });

  it("silhouette : silhouetteCharacters.js ⊆ persona.js", () => {
    expect(missingFromList(silhouetteCharacters.map((c) => c.nom), silPersonas)).toEqual([]);
  });

  it("personae : wielders (champ user) ⊆ persona.js", () => {
    // En mode Personae on devine le PERSONNAGE qui utilise la persona, pas la persona.
    expect(missingFromList(personaeCharacters.flatMap((c) => c.user), perPersonas)).toEqual([]);
  });

  it("all-out attack : aoaCharacters.js ⊆ personas_allOut.js", () => {
    expect(missingFromList(aoaCharacters.map((c) => c.nom), aoaPersonas)).toEqual([]);
  });
});
