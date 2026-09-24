/**
 * badgesReorder.test.js — réordonnancement des badges épinglés (2.3).
 *
 * `deplacerBadge()` porte toute la logique métier du lot : le reste n'est que de
 * la plomberie de pointeur. Elle est donc testée seule, sans DOM, et les cas
 * limites comptent autant que le cas nominal — un index hors bornes venant d'un
 * glissement relâché en dehors de la rangée ne doit jamais perdre un badge.
 */

import { describe, it, expect } from "vitest";
import { deplacerBadge } from "../profile/badges/badges_reorder.js";

const LISTE = ["a", "b", "c", "d"];

describe("deplacerBadge", () => {
  it("déplace vers la droite", () => {
    expect(deplacerBadge(LISTE, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("déplace vers la gauche", () => {
    expect(deplacerBadge(LISTE, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("déplace d'une seule case, dans les deux sens", () => {
    expect(deplacerBadge(LISTE, 1, 2)).toEqual(["a", "c", "b", "d"]);
    expect(deplacerBadge(LISTE, 2, 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("ne change rien quand la cible est la position de départ", () => {
    expect(deplacerBadge(LISTE, 2, 2)).toEqual(LISTE);
  });

  it("ne perd JAMAIS un badge, quel que soit le déplacement", () => {
    // L'invariant qui compte : le joueur peut relâcher son glissement n'importe
    // où, y compris en dehors de la rangée. Perdre un badge épinglé serait un
    // bug silencieux — il se retrouverait dépinglé sans l'avoir demandé.
    for (let d = -2; d <= LISTE.length + 1; d++) {
      for (let v = -2; v <= LISTE.length + 1; v++) {
        const sortie = deplacerBadge(LISTE, d, v);
        expect([...sortie].sort(), `deplacerBadge(liste, ${d}, ${v})`).toEqual([...LISTE].sort());
        expect(sortie.length).toBe(LISTE.length);
      }
    }
  });

  it("refuse les index hors bornes sans modifier l'ordre", () => {
    expect(deplacerBadge(LISTE, -1, 2)).toEqual(LISTE);
    expect(deplacerBadge(LISTE, 0, 9)).toEqual(LISTE);
    expect(deplacerBadge(LISTE, 9, 0)).toEqual(LISTE);
  });

  it("refuse les index non entiers (un pointeur peut rendre n'importe quoi)", () => {
    expect(deplacerBadge(LISTE, 1.5, 2)).toEqual(LISTE);
    expect(deplacerBadge(LISTE, 0, NaN)).toEqual(LISTE);
    expect(deplacerBadge(LISTE, undefined, 1)).toEqual(LISTE);
  });

  it("rend toujours un NOUVEAU tableau — l'original n'est pas modifié", () => {
    // La fonction est appelée avec `profile.selectedBadges` : une mutation en
    // place rendrait la comparaison « l'ordre a-t-il changé ? » toujours fausse,
    // et rien ne serait jamais sauvegardé.
    const original = [...LISTE];
    const sortie = deplacerBadge(original, 0, 3);
    expect(original).toEqual(LISTE);
    expect(sortie).not.toBe(original);
  });

  it("tolère une entrée absente ou invalide", () => {
    expect(deplacerBadge(null, 0, 1)).toEqual([]);
    expect(deplacerBadge(undefined, 0, 1)).toEqual([]);
    expect(deplacerBadge([], 0, 1)).toEqual([]);
  });

  it("gère une liste d'un seul badge", () => {
    expect(deplacerBadge(["a"], 0, 0)).toEqual(["a"]);
  });
});
