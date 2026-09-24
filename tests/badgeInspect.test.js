/**
 * badgeInspect.test.js — consulter la fiche d'un badge sans l'épingler (2.3).
 *
 * `construireFiche()` porte la seule décision du lot qui puisse mal tourner : ce
 * qu'on montre d'un badge SECRET encore verrouillé. Si la fiche disait sa
 * condition, l'œil deviendrait un moyen commode de lire toutes les réponses —
 * l'inverse exact de ce que « secret » veut dire.
 *
 * Le reste (ouvrir, fermer, arrêter la propagation du clic) est vérifié sur le
 * DOM, parce que c'est là que le piège se trouve : la carte porte un `onclick`
 * qui épingle, et un œil qui ne l'arrête pas ferait exactement ce qu'il est censé
 * éviter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  construireFiche,
  ouvrirFiche,
  fermerFiche,
  initBadgeInspect,
} from "../profile/badges/badge_inspect.js";

const TEXTES = {
  name: "Velvet Headache",
  condition: "Win 10 games in Personae mode",
  description: "Igor would be proud.",
};

describe("construireFiche", () => {
  it("montre tout d'un badge débloqué", () => {
    const f = construireFiche({ id: "x", secret: false }, TEXTES, true);
    expect(f.titre).toBe("Velvet Headache");
    expect(f.condition).toBe(TEXTES.condition);
    expect(f.description).toBe(TEXTES.description);
    expect(f.etat).toBe("unlocked");
    expect(f.secret).toBe(false);
  });

  it("montre la condition d'un badge NON secret encore verrouillé", () => {
    // C'est tout l'intérêt : savoir ce qu'il reste à faire.
    const f = construireFiche({ id: "x", secret: false }, TEXTES, false);
    expect(f.titre).toBe("Velvet Headache");
    expect(f.condition).toBe(TEXTES.condition);
    expect(f.etat).toBe("locked");
  });

  it("ne révèle RIEN d'un badge secret encore verrouillé", () => {
    const f = construireFiche({ id: "x", secret: true }, TEXTES, false);
    expect(f.titre).toBe("???");
    expect(f.condition).toBe("???");
    expect(f.description).toBe("");
    expect(f.secret).toBe(true);
  });

  it("montre un badge secret une fois débloqué", () => {
    const f = construireFiche({ id: "x", secret: true }, TEXTES, true);
    expect(f.titre).toBe("Velvet Headache");
    expect(f.condition).toBe(TEXTES.condition);
    expect(f.secret).toBe(false);
  });

  it("tolère un badge ou des textes incomplets", () => {
    expect(construireFiche({ id: "z" }, undefined, false).titre).toBe("z");
    expect(construireFiche({}, {}, true).titre).toBe("");
    expect(construireFiche({}, {}, true).condition).toBe("");
  });
});

describe("fiche — ouverture et fermeture", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    fermerFiche();
  });

  it("ouvre un seul panneau, même appelée deux fois", () => {
    ouvrirFiche({ id: "a", img: "a.png" }, TEXTES, true);
    ouvrirFiche({ id: "b", img: "b.png" }, TEXTES, true);
    expect(document.querySelectorAll("#badgeInspectPanel")).toHaveLength(1);
    expect(document.querySelector(".badge-inspect__name").textContent).toBe("Velvet Headache");
  });

  it("le bouton de fermeture retire le panneau", () => {
    ouvrirFiche({ id: "a", img: "a.png" }, TEXTES, true);
    document.querySelector(".badge-inspect__close").click();
    expect(document.getElementById("badgeInspectPanel")).toBeNull();
  });

  it("Échap ferme la fiche", () => {
    ouvrirFiche({ id: "a", img: "a.png" }, TEXTES, true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById("badgeInspectPanel")).toBeNull();
  });

  it("échappe le contenu — un nom ne peut pas injecter de HTML", () => {
    ouvrirFiche({ id: "a", img: "a.png" }, { name: '<img src=x onerror=1>', condition: "" }, true);
    expect(document.querySelector(".badge-inspect__name").innerHTML).not.toContain("<img");
  });

  it("grise l'image d'un badge verrouillé", () => {
    ouvrirFiche({ id: "a", img: "a.png" }, TEXTES, false);
    expect(document.querySelector(".badge-inspect__img").className).toContain("is-locked");
  });
});

describe("initBadgeInspect", () => {
  let grille;
  let equiper;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="g">
        <div class="badge-item" data-id="velvet_headache"></div>
        <div class="badge-item" data-id="autre"></div>
      </div>`;
    grille = document.getElementById("g");
    // La vraie grille pose un onclick qui ÉPINGLE : on le reproduit, puisque
    // c'est précisément ce que l'œil ne doit pas déclencher.
    equiper = vi.fn();
    grille.querySelectorAll(".badge-item").forEach((c) => (c.onclick = equiper));
  });

  afterEach(() => fermerFiche());

  const resoudre = (id) => ({
    badge: { id, img: `${id}.png`, secret: false },
    textes: TEXTES,
    debloque: true,
  });

  it("pose un œil sur chaque carte", () => {
    initBadgeInspect(grille, resoudre);
    expect(grille.querySelectorAll(".badge-inspect-btn")).toHaveLength(2);
  });

  it("n'en pose pas deux quand elle est rappelée", () => {
    initBadgeInspect(grille, resoudre);
    initBadgeInspect(grille, resoudre);
    expect(grille.querySelectorAll(".badge-inspect-btn")).toHaveLength(2);
  });

  it("cliquer l'œil ouvre la fiche SANS épingler", () => {
    initBadgeInspect(grille, resoudre);
    grille.querySelector(".badge-inspect-btn").dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(document.getElementById("badgeInspectPanel")).not.toBeNull();
    expect(equiper, "l'œil ne doit jamais épingler").not.toHaveBeenCalled();
  });

  it("cliquer la carte elle-même épingle toujours", () => {
    // Le garde-fou inverse : l'œil ne doit pas neutraliser le comportement normal.
    initBadgeInspect(grille, resoudre);
    grille.querySelector(".badge-item").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(equiper).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien sans grille ni résolveur", () => {
    expect(() => initBadgeInspect(null, resoudre)).not.toThrow();
    expect(() => initBadgeInspect(grille, null)).not.toThrow();
    expect(grille.querySelectorAll(".badge-inspect-btn")).toHaveLength(0);
  });

  it("ignore un identifiant inconnu sans planter", () => {
    initBadgeInspect(grille, () => null);
    grille.querySelector(".badge-inspect-btn").dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(document.getElementById("badgeInspectPanel")).toBeNull();
  });
});
