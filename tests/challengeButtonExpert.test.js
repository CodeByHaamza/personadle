import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * challengeButtonExpert.test.js — « Défier un ami » doit exister dans les 6 modes,
 * en normal comme en Expert.
 *
 * Ce que ce fichier protège : la PR #85 a rendu les défis compatibles avec le Mode
 * Expert (colonne `challenge_is_expert`, redirection vers `?expert=1`), mais n'a
 * retiré la garde `if (!isExpert)` que dans 3 modes sur 6. Résultat, signalé par
 * un joueur : aucun bouton « Défier un ami » en Music Expert, alors que le
 * TEST_PLAN §5.3 affirme le contraire. Émoji et All-Out Attack étaient dans le
 * même cas.
 *
 * Une garde oubliée ne casse aucun test et ne lève aucune erreur — elle fait
 * juste disparaître un bouton. D'où cette vérification structurelle, sur le
 * source des 6 modes : c'est la seule façon d'attraper une incohérence entre
 * fichiers qui, pris isolément, sont tous corrects.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MODE_FILES = {
  classic: "classiqueMode/modeClassique.js",
  emoji: "emojiMode/emojiMode.js",
  silhouette: "silhouetteMode/modeSilhouette.js",
  alloutattack: "allOutAttackMode/modeAllOutAttack.js",
  personae: "personaeMode/modePersonae.js",
  music: "musicsMode/modeMusic.js",
};

/** Source du mode, commentaires retirés — une garde citée en commentaire ne compte pas. */
function sourceWithoutComments(relative) {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("« Défier un ami » — les 6 modes se comportent pareil", () => {
  it("chaque mode appelle bien showChallengeButton()", () => {
    const missing = Object.entries(MODE_FILES)
      .filter(([, file]) => !sourceWithoutComments(file).includes("showChallengeButton("))
      .map(([mode]) => mode);
    expect(missing).toEqual([]);
  });

  it("aucun mode ne conditionne le bouton à « pas en Expert »", () => {
    // On cherche une garde Expert sur la même ligne que l'appel, ou juste avant :
    // c'est la forme qu'avaient les trois oublis (`if (!IS_EXPERT) {` puis l'appel).
    const guarded = [];

    for (const [mode, file] of Object.entries(MODE_FILES)) {
      const lines = sourceWithoutComments(file).split("\n");
      const idx = lines.findIndex((l) => l.includes("showChallengeButton("));
      if (idx === -1) continue;

      // La ligne de l'appel et les deux précédentes non vides.
      const context = [lines[idx - 2], lines[idx - 1], lines[idx]]
        .filter(Boolean)
        .join("\n");

      if (/if\s*\(\s*!\s*(IS_EXPERT|EXPERT\.isExpert|isExpert)\s*\)/.test(context)) {
        guarded.push(mode);
      }
    }

    expect(
      guarded,
      "ces modes cachent « Défier un ami » en Expert alors que les défis Expert existent"
    ).toEqual([]);
  });

  it("showChallengeButton transmet la dimension Expert au serveur", () => {
    // Sans ce champ, retirer les gardes ci-dessus recréerait le vrai problème que
    // le commentaire d'origine décrivait : un défi envoyé depuis l'Expert serait
    // joué en mode normal par le destinataire, avec un score incomparable.
    const gameCore = readFileSync(join(ROOT, "js/gameCore.js"), "utf8");
    expect(gameCore).toMatch(/challenge_is_expert:\s*isExpert/);
  });
});
