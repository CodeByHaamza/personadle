import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * musicExpertNoEjection.test.js — Music Expert ne renvoie jamais au mode normal.
 *
 * Bug de production du 2026-09-02 : un joueur ayant Music Expert débloqué en
 * était éjecté à chaque ouverture. Ni un rechargement forcé, ni le retrait puis
 * le redonnage du mode par un admin n'y changeaient quoi que ce soit — parce que
 * le déblocage n'était pas en cause du tout.
 *
 * `modeMusic.js` portait un renvoi vers `musics.html` écrit AVANT l'existence des
 * défis Expert. Il appelait `getPendingActiveChallenge()` sans argument : cette
 * fonction lit la dimension de la PAGE, donc `activeChallengeExpert` sur
 * `?expert=1`. Elle détectait un défi Expert, et renvoyait vers le mode normal —
 * l'inverse de ce qu'il fallait.
 *
 * Le joueur était piégé : le défi vit dans localStorage, et la bannière du mode
 * normal ne lit pas la case Expert — donc pas de bouton Abandonner pour en sortir.
 *
 * Vérification STRUCTURELLE : le symptôme est une navigation, invisible pour un
 * test unitaire classique (jsdom n'implémente pas `location.replace`), et le
 * risque réel est qu'on réintroduise un jour ce renvoi « pour bien faire ».
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Source d'un mode, commentaires retirés — un renvoi cité en commentaire ne compte pas. */
function sourceWithoutComments(relative) {
  return readFileSync(join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("Music Expert — aucune éjection vers le mode normal", () => {
  const src = sourceWithoutComments("musicsMode/modeMusic.js");

  it("ne redirige jamais vers musics.html", () => {
    expect(src).not.toMatch(/location\.(replace|href)\s*=?\s*\(?\s*["']musics\.html/);
  });

  it("n'appelle plus getPendingActiveChallenge()", () => {
    // Sans argument, elle lit la dimension de la page courante : en Expert elle
    // renvoie le défi Expert, ce qui rendait la condition d'éjection vraie
    // précisément pour les joueurs qu'elle prétendait protéger.
    expect(src).not.toContain("getPendingActiveChallenge");
  });

  it("le repli de Personae, lui, reste en place", () => {
    // Contre-exemple volontaire : celui-là est légitime — sans fiche de lore
    // chargée, il n'y a aucune partie Expert possible. Ce test existe pour qu'on
    // ne « nettoie » pas les deux d'un coup en croyant bien faire.
    const personae = sourceWithoutComments("personaeMode/modePersonae.js");
    expect(personae).toMatch(/location\.replace\(["']personae\.html["']\)/);
    expect(personae).toContain("expertLore");
  });
});
