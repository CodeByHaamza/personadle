import { describe, it, expect } from "vitest";

import { characters } from "../database/characters_clean.js";
import { personaeCharacters } from "../personaeMode/database/personaeCharacters.js";

/**
 * Lot de contenu 2.3 : Elisabeth devient utilisatrice de persona en mode Classique.
 *
 * Le mode Personae enregistre depuis la 2.1 qu'elle manie **Thanatos** dans P4AU,
 * aux côtés de Makoto Yuki et Kotone Shiomi en P3 (entrée fusionnée, cf. CLAUDE.md
 * §4 « personas multi-wielders »). Le dataset du mode Classique, lui, la donnait
 * encore en `personaUser: false` — les deux se contredisaient, et c'est le
 * Classique que voit le joueur dans sa grille de comparaison.
 *
 * Theodore **reste** non-utilisateur : il n'apparaît pas dans P4AU et ne manie
 * aucune persona. C'est la moitié du lot qu'il serait le plus facile de « corriger »
 * par symétrie un jour, d'où un cas qui le dit explicitement.
 */

const byName = (nom) => characters.find((c) => c.nom === nom);

describe("Velvet Room — qui manie une persona en mode Classique", () => {
  it("Elisabeth manie Thanatos", () => {
    const elizabeth = byName("Elizabeth");
    expect(elizabeth, "Elizabeth doit exister dans characters_clean.js").toBeDefined();
    expect(elizabeth.personaUser).toBe(true);
    expect(elizabeth.persona).toBe("Thanatos");
  });

  it("le mode Personae la compte bien parmi les manieurs de Thanatos", () => {
    // La cohérence entre les deux datasets est le sujet même du lot : si l'entrée
    // Thanatos du mode Personae perdait Elisabeth, le Classique affirmerait seul
    // quelque chose que plus rien ne soutient.
    const thanatos = personaeCharacters.find((p) => p.persona === "Thanatos");
    expect(thanatos, "l'entrée Thanatos doit exister en mode Personae").toBeDefined();
    expect(thanatos.user).toContain("Elizabeth");
    expect(thanatos.opus).toContain("P4AU");
  });

  it("Theodore reste non-utilisateur de persona", () => {
    const theodore = byName("Theodore");
    expect(theodore, "Theodore doit exister dans characters_clean.js").toBeDefined();
    expect(theodore.personaUser).toBe(false);
    expect(theodore.persona).toBe("NONE");
  });

  it("ni l'un ni l'autre n'a d'arcane, ni d'âge connu", () => {
    // Décision Hamza : seul `personaUser`/`persona` change pour Elisabeth. Son
    // arcane et son âge ne sont pas touchés, et ce cas est là pour que le jour où
    // quelqu'un voudra « compléter » sa fiche, ce soit une décision et pas un
    // glissement : ce sont deux colonnes de la grille que le joueur compare.
    for (const nom of ["Elizabeth", "Theodore"]) {
      expect(byName(nom).arcane, nom).toEqual(["NONE"]);
      expect(byName(nom).age, nom).toBe("Unknown");
    }
  });
});
