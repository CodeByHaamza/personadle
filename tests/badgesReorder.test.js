/**
 * badgesReorder.test.js — réordonnancement des badges épinglés (2.3).
 *
 * `deplacerBadge()` porte toute la logique métier du lot : le reste n'est que de
 * la plomberie de pointeur. Elle est donc testée seule, sans DOM, et les cas
 * limites comptent autant que le cas nominal — un index hors bornes venant d'un
 * glissement relâché en dehors de la rangée ne doit jamais perdre un badge.
 */

import { describe, it, expect, afterEach } from "vitest";
import { deplacerBadge, initBadgeReorder } from "../profile/badges/badges_reorder.js";

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

/**
 * La plomberie de pointeur, elle, porte désormais une décision : distinguer un
 * CLIC (ouvrir la fiche du badge) d'un GLISSEMENT (le réordonner). Les deux
 * gestes commencent par le même `pointerdown` — seul le seuil de 6 px les
 * sépare, et se tromper casse soit l'un soit l'autre en silence.
 *
 * L'aperçu en direct est testé par l'ordre du DOM PENDANT le geste : c'est tout
 * l'objet du retour Hamza (« ça fait trop vide »), et c'est invisible dans
 * `deplacerBadge()`, qui ne voit que le résultat.
 */
describe("initBadgeReorder — clic, glissement et aperçu", () => {
  /** Une rangée de badges dont les cases occupent des positions connues. */
  function rangeeDeTest(ids) {
    const rangee = document.createElement("div");
    ids.forEach((id) => {
      const slot = document.createElement("div");
      slot.className = "pin-slot pin-slot--filled";
      slot.dataset.badgeId = id;
      slot.appendChild(document.createElement("img"));
      rangee.appendChild(slot);
    });
    document.body.appendChild(rangee);
    // jsdom ne fait aucune mise en page : sans rects simulés, `caseSous()` ne
    // trouve jamais rien et aucun glissement n'est possible. Chaque case fait
    // 40 px, et son rect est lu d'après sa position COURANTE dans le DOM —
    // l'aperçu réorganise la rangée en direct, des positions figées au départ
    // seraient fausses dès le premier déplacement.
    [...rangee.children].forEach((slot) => {
      slot.getBoundingClientRect = () => {
        const i = [...rangee.children].indexOf(slot);
        return { left: i * 40, right: i * 40 + 39, top: 0, bottom: 39 };
      };
    });
    return rangee;
  }

  const pointeur = (type, x, y = 10) =>
    new window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 });

  const ordreDom = (rangee) => [...rangee.children].map((c) => c.dataset.badgeId);

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("un appui sans déplacement ouvre la fiche, et ne réordonne rien", () => {
    const rangee = rangeeDeTest(["a", "b", "c"]);
    const vus = [];
    const ordres = [];
    initBadgeReorder(
      rangee,
      { selectedBadges: ["a", "b", "c"] },
      (o) => ordres.push(o),
      (id) => vus.push(id)
    );

    const cible = rangee.children[1];
    cible.dispatchEvent(pointeur("pointerdown", 50));
    cible.dispatchEvent(pointeur("pointerup", 50));

    expect(vus).toEqual(["b"]);
    expect(ordres).toEqual([]);
  });

  it("un micro-tremblement sous le seuil reste un clic", () => {
    // Un doigt ne se pose jamais parfaitement immobile : sans le seuil, ouvrir
    // la fiche d'un badge au tactile deviendrait un coup de chance.
    const rangee = rangeeDeTest(["a", "b"]);
    const vus = [];
    initBadgeReorder(
      rangee,
      { selectedBadges: ["a", "b"] },
      () => {},
      (id) => vus.push(id)
    );

    const cible = rangee.children[0];
    cible.dispatchEvent(pointeur("pointerdown", 10));
    cible.dispatchEvent(pointeur("pointermove", 13, 12));
    cible.dispatchEvent(pointeur("pointerup", 13, 12));

    expect(vus).toEqual(["a"]);
  });

  it("le ✕ n'est jamais capté : dépingler n'est pas un clic sur le badge", () => {
    const rangee = rangeeDeTest(["a", "b"]);
    const vus = [];
    const unpin = document.createElement("button");
    unpin.className = "pin-unpin";
    rangee.children[0].appendChild(unpin);
    initBadgeReorder(
      rangee,
      { selectedBadges: ["a", "b"] },
      () => {},
      (id) => vus.push(id)
    );

    unpin.dispatchEvent(pointeur("pointerdown", 10));
    unpin.dispatchEvent(pointeur("pointerup", 10));

    expect(vus).toEqual([]);
  });

  it("réorganise le DOM EN DIRECT pendant le glissement (l'aperçu)", () => {
    const rangee = rangeeDeTest(["a", "b", "c"]);
    const ordres = [];
    const vus = [];
    initBadgeReorder(
      rangee,
      { selectedBadges: ["a", "b", "c"] },
      (o) => ordres.push(o),
      (id) => vus.push(id)
    );

    const saisi = rangee.children[0];
    saisi.dispatchEvent(pointeur("pointerdown", 10));
    saisi.dispatchEvent(pointeur("pointermove", 50)); // passe sur « b »

    // Le badge saisi est DÉJÀ à sa future place, et toujours dans la rangée :
    // c'est ce qui remplace le trou de la première version.
    expect(ordreDom(rangee)).toEqual(["b", "a", "c"]);
    expect(saisi.classList.contains("pin-slot--dragging")).toBe(true);
    expect(saisi.isConnected).toBe(true);

    saisi.dispatchEvent(pointeur("pointerup", 50));
    expect(ordres).toEqual([["b", "a", "c"]]);
    expect(vus).toEqual([]); // un glissement n'ouvre pas la fiche
    expect(saisi.classList.contains("pin-slot--dragging")).toBe(false);
  });

  it("suit le pointeur sur plusieurs cases d'affilée", () => {
    const rangee = rangeeDeTest(["a", "b", "c", "d"]);
    const ordres = [];
    initBadgeReorder(rangee, { selectedBadges: ["a", "b", "c", "d"] }, (o) => ordres.push(o));

    const saisi = rangee.children[0];
    saisi.dispatchEvent(pointeur("pointerdown", 10));
    saisi.dispatchEvent(pointeur("pointermove", 50));
    expect(ordreDom(rangee)).toEqual(["b", "a", "c", "d"]);
    saisi.dispatchEvent(pointeur("pointermove", 130)); // jusqu'à la dernière case
    expect(ordreDom(rangee)).toEqual(["b", "c", "d", "a"]);
    saisi.dispatchEvent(pointeur("pointerup", 130));

    expect(ordres).toEqual([["b", "c", "d", "a"]]);
  });

  it("un glissement revenu à sa place demande quand même un rendu", () => {
    // Le DOM a bougé pendant le geste : sans rendu, il garderait son ordre
    // d'aperçu et ses styles d'animation, même si l'ordre logique est inchangé.
    const rangee = rangeeDeTest(["a", "b"]);
    const ordres = [];
    initBadgeReorder(rangee, { selectedBadges: ["a", "b"] }, (o) => ordres.push(o));

    const saisi = rangee.children[0];
    saisi.dispatchEvent(pointeur("pointerdown", 10));
    saisi.dispatchEvent(pointeur("pointermove", 50));
    saisi.dispatchEvent(pointeur("pointermove", 10)); // retour sur sa case
    saisi.dispatchEvent(pointeur("pointerup", 10));

    expect(ordreDom(rangee)).toEqual(["a", "b"]);
    expect(ordres).toEqual([["a", "b"]]);
  });

  it("un seul badge épinglé : pas réordonnable, mais toujours cliquable", () => {
    const rangee = rangeeDeTest(["a"]);
    const vus = [];
    const ordres = [];
    initBadgeReorder(
      rangee,
      { selectedBadges: ["a"] },
      (o) => ordres.push(o),
      (id) => vus.push(id)
    );

    const seul = rangee.children[0];
    expect(seul.classList.contains("pin-slot--movable")).toBe(false);
    seul.dispatchEvent(pointeur("pointerdown", 10));
    seul.dispatchEvent(pointeur("pointermove", 60));
    seul.dispatchEvent(pointeur("pointerup", 60));

    expect(ordres).toEqual([]);
    expect(vus).toEqual(["a"]);
  });

  it("Entrée et Espace ouvrent la fiche, les flèches réordonnent", () => {
    const rangee = rangeeDeTest(["a", "b", "c"]);
    const vus = [];
    const ordres = [];
    initBadgeReorder(
      rangee,
      { selectedBadges: ["a", "b", "c"] },
      (o) => ordres.push(o),
      (id) => vus.push(id)
    );

    const cible = rangee.children[1];
    const touche = (key) =>
      cible.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));

    touche("Enter");
    touche(" ");
    expect(vus).toEqual(["b", "b"]);
    expect(ordres).toEqual([]);

    touche("ArrowRight");
    expect(ordres).toEqual([["a", "c", "b"]]);
  });

  it("ne pose rien sur une rangée vide ou absente", () => {
    expect(() => initBadgeReorder(null, {}, () => {})).not.toThrow();
    const vide = document.createElement("div");
    document.body.appendChild(vide);
    expect(() => initBadgeReorder(vide, {}, () => {})).not.toThrow();
  });
});
