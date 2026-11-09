/**
 * filter_change_rearms_game.test.js — Changer de filtre arme une NOUVELLE partie.
 *
 * Signalement joueur de novembre 2026 : en All-Out Attack, le changement de
 * filtre recopiait `resetGame()` à la main… sans `startGame()`. Après une partie
 * terminée (donc marquée enregistrée), la partie relancée par le filtre gardait
 * l'identifiant de la précédente : `isGameLogged()` restait vrai et sa victoire
 * n'était JAMAIS enregistrée — ni stats, ni série, ni progression Expert.
 *
 * Règle : dans les 6 modes, le rappel de `initFilterMenu()` passe par le reset
 * du mode (`resetGame(…)`, ou le bouton Rejouer en Classique), qui appelle
 * `startGame()`. On vérifie la source plutôt que d'exécuter les modes : ce sont
 * des scripts de page qui se câblent au chargement du DOM.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

const MODES = {
  classic: "classiqueMode/modeClassique.js",
  emoji: "emojiMode/emojiMode.js",
  silhouette: "silhouetteMode/modeSilhouette.js",
  alloutattack: "allOutAttackMode/modeAllOutAttack.js",
  personae: "personaeMode/modePersonae.js",
  music: "musicsMode/modeMusic.js",
};

/** Corps du rappel passé à initFilterMenu(), de son ouverture au `});` qui le ferme. */
function filterCallbackBody(source) {
  const start = source.indexOf("initFilterMenu(");
  if (start === -1) return null;
  const end = source.indexOf("\n  });", start);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("changement de filtre", () => {
  it.each(Object.entries(MODES))("%s : relance la partie par le reset du mode", (mode, file) => {
    const body = filterCallbackBody(readFileSync(join(ROOT, file), "utf8"));
    expect(body, `${file} : initFilterMenu() introuvable`).not.toBeNull();
    expect(/resetGame\(|resetButton\.click\(\)/.test(body)).toBe(true);
  });

  it("alloutattack : ne retire plus la cible à la main (c'est ce qui sautait startGame)", () => {
    const body = filterCallbackBody(readFileSync(join(ROOT, MODES.alloutattack), "utf8"));
    expect(body).not.toContain("getBetterRandomCharacter(");
  });
});
