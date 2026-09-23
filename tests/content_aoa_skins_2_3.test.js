import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { aoaCharacters } from "../allOutAttackMode/database/aoaCharacters.js";
import { portraitsMap } from "../allOutAttackMode/database/portraitsMap.js";
import { personas as aoaPersonas } from "../allOutAttackMode/database/personas_allOut.js";

/**
 * Lot de contenu 2.3 : les skins P5X « Luce Notte » (Shoki Ikenami) et
 * « Soy Pioneer » (Shun Kano).
 *
 * L'essentiel de ce fichier est un garde-fou **général**, pas une vérification
 * des deux seules entrées du lot : un personnage All-Out Attack a besoin de
 * TROIS fichiers, et un lien mort ne lève rien au build. Il rend juste une
 * partie injouable — cadre vide, image de chargement à l'infini — pour le
 * joueur qui tombe dessus ce jour-là.
 *
 *   database/allOutAttack/<gif>.webp        l'animation floutée à deviner
 *   database/img/<gif>.webp                 le portrait masqué (autocomplétion, essais)
 *   database/img/<gif>_Battle.webp          l'illustration révélée en fin de partie
 *
 * `tests/autocompleteNames.test.js` couvre déjà l'appartenance à la liste
 * d'autocomplétion ; ici on couvre les fichiers et la table des portraits.
 */

const repoPath = (relative) => fileURLToPath(new URL("../" + relative, import.meta.url));

const assetPaths = (gif) => ({
  animation: `allOutAttackMode/database/allOutAttack/${gif}.webp`,
  portrait: `allOutAttackMode/database/img/${gif}.webp`,
  battle: `allOutAttackMode/database/img/${gif}_Battle.webp`,
});

/**
 * Un WebP animé porte un chunk `ANIM` dans son conteneur RIFF. Lire l'en-tête
 * évite d'ajouter un décodeur d'image aux dépendances de test juste pour
 * distinguer une animation d'une image fixe.
 */
function isAnimatedWebp(relativePath) {
  const head = readFileSync(repoPath(relativePath)).subarray(0, 64);
  return head.toString("latin1").includes("ANIM");
}

describe("All-Out Attack — intégrité des assets de tout le roster", () => {
  it("chaque personnage a ses trois fichiers", () => {
    const manquants = [];
    for (const { nom, gif } of aoaCharacters) {
      for (const [role, chemin] of Object.entries(assetPaths(gif))) {
        if (!existsSync(repoPath(chemin))) manquants.push(`${nom} → ${role} (${chemin})`);
      }
    }
    expect(manquants).toEqual([]);
  });

  it("chaque personnage est dans la table des portraits, pointant sur son propre gif", () => {
    const incoherents = [];
    for (const { nom, gif } of aoaCharacters) {
      if (!(nom in portraitsMap)) {
        incoherents.push(`${nom} absent de portraitsMap`);
      } else if (portraitsMap[nom] !== gif) {
        incoherents.push(`${nom} → portraitsMap dit "${portraitsMap[nom]}", le dataset dit "${gif}"`);
      }
    }
    expect(incoherents).toEqual([]);
  });

  it("aucun nom en double dans le roster", () => {
    // Deux entrées de même nom rendraient l'une des deux impossible à deviner :
    // l'autocomplétion ne propose qu'un libellé, la comparaison ne peut pas
    // départager, et le joueur verrait sa bonne réponse refusée.
    const noms = aoaCharacters.map((c) => c.nom);
    expect(noms.length).toBe(new Set(noms).size);
    const gifs = aoaCharacters.map((c) => c.gif);
    expect(gifs.length).toBe(new Set(gifs).size);
  });

  it("l'animation de chaque personnage est bien animée", () => {
    // Une image fixe posée là par erreur donnerait une partie où l'indice ne
    // bouge jamais — invisible au chargement, évident pour le joueur.
    const fixes = aoaCharacters
      .filter(({ gif }) => !isAnimatedWebp(assetPaths(gif).animation))
      .map(({ nom }) => nom);
    expect(fixes).toEqual([]);
  });
});

describe("All-Out Attack — skins 2.3", () => {
  const SKINS_2_3 = [
    { nom: "Luce Notte ( Shoki Ikenami )", gif: "Luce_Notte", base: "Luce ( Shoki Ikenami )" },
    { nom: "Soy Pioneer ( Shun Kano )", gif: "Soy_Pioneer", base: "Soy ( Shun Kano )" },
  ];

  it.each(SKINS_2_3)("$nom est dans le roster, en P5X", ({ nom, gif }) => {
    const entree = aoaCharacters.find((c) => c.nom === nom);
    expect(entree, `${nom} doit exister dans aoaCharacters`).toBeDefined();
    expect(entree.gif).toBe(gif);
    expect(entree.opus).toEqual(["P5X"]);
  });

  it.each(SKINS_2_3)("$nom est proposé à la saisie", ({ nom }) => {
    expect(aoaPersonas).toContain(nom);
  });

  it.each(SKINS_2_3)("$nom coexiste avec sa tenue de base", ({ nom, base }) => {
    // Un skin ne remplace pas le personnage : les deux se devinent séparément,
    // avec leur propre animation. Perdre la base au profit du skin retirerait
    // une entrée du tirage quotidien sans que rien ne le signale.
    expect(aoaCharacters.some((c) => c.nom === base)).toBe(true);
    expect(aoaCharacters.some((c) => c.nom === nom)).toBe(true);
  });

  it("les deux skins portent leur nom officiel, pas celui des fichiers source", () => {
    // Les fichiers livrés portaient « Night » et « Frontier » — le premier est une
    // traduction, le second un nom de datamine antérieur. Les noms officiels sont
    // « Notte » et « Pioneer » (lufel.net : Shoki·Notte, Shun·Pioneer). Ce cas
    // existe pour que le retour en arrière soit un échec visible, pas un oubli :
    // c'est le nom que le joueur tape dans l'autocomplétion.
    const noms = aoaCharacters.map((c) => c.nom);
    expect(noms).toContain("Luce Notte ( Shoki Ikenami )");
    expect(noms).toContain("Soy Pioneer ( Shun Kano )");
    expect(noms).not.toContain("Luce Night ( Shoki Ikenami )");
    expect(noms).not.toContain("Soy Frontier ( Shun Kano )");
  });
});
