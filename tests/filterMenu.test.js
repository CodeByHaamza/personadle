/**
 * tests/filterMenu.test.js — DEFAULT_ON_NEW (js/filterMenu.js).
 *
 * Régression du 2026-08-20 : PTS était réinjecté à CHAQUE chargement, donc
 * impossible à décocher — il revenait au rechargement suivant. Le seeding est
 * désormais mémorisé par mode dans `<storageKey>_seeded`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { initFilterMenu } from "../js/filterMenu.js";

const ALL = ["P1", "P5X", "PTS"];

function mount(saved, { fresh = true } = {}) {
  document.body.innerHTML = `
    <div class="filter-panel" id="filterPanel">
      <button id="filterToggleBtn"></button>
      <div class="filter-dropdown" id="filterDropdown">
        <div class="filter-group">
          <button class="filter-main-btn active" data-opus="P1"></button>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn active" data-opus="P5X"></button>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn filter-color-pts active" data-opus="PTS"></button>
        </div>
      </div>
    </div>`;
  if (fresh) localStorage.clear();
  if (saved) localStorage.setItem("filters_Test", JSON.stringify(saved));
  return initFilterMenu("filters_Test", ALL, () => {});
}

const btn = (code) => document.querySelector(`[data-opus="${code}"]`);

describe("filterMenu — opus récents (DEFAULT_ON_NEW)", () => {
  beforeEach(() => localStorage.clear());

  it("désélectionner tout désactive AUSSI PTS", () => {
    const api = mount(["P1", "P5X", "PTS"]);
    document.querySelector(".filter-select-all-btn").click();
    expect(api.getActive()).toEqual([]);
    expect(btn("PTS").classList.contains("active")).toBe(false);
  });

  it("PTS reste désactivé après rechargement (pas réactivé par DEFAULT_ON_NEW)", () => {
    mount(["P1", "P5X", "PTS"]);
    document.querySelector(".filter-select-all-btn").click();
    const saved = JSON.parse(localStorage.getItem("filters_Test"));
    const api2 = mount(saved, { fresh: false });
    expect(api2.getActive()).toEqual([]);
    expect(btn("PTS").classList.contains("active")).toBe(false);
  });

  it("un opus décoché seul ne revient pas via DEFAULT_ON_NEW", () => {
    mount(["P1", "P5X", "PTS"]);
    btn("PTS").click();
    const saved = JSON.parse(localStorage.getItem("filters_Test"));
    const api2 = mount(saved, { fresh: false });
    expect(api2.getActive()).not.toContain("PTS");
    expect(btn("PTS").classList.contains("active")).toBe(false);
  });

  it("un opus récent est réinjecté ET persisté (tient au rechargement suivant)", () => {
    // Le drapeau `_seeded` était écrit avant la liste : au 2e rechargement
    // l'opus n'était plus réinjecté (déjà seedé) et disparaissait pour de bon.
    localStorage.setItem("filters_Test", JSON.stringify(["P1", "P5X"]));
    const api = mount(["P1", "P5X"], { fresh: false });
    expect(api.getActive()).toContain("PTS");
    expect(JSON.parse(localStorage.getItem("filters_Test"))).toContain("PTS");

    const api2 = mount(JSON.parse(localStorage.getItem("filters_Test")), { fresh: false });
    expect(api2.getActive(), "l'opus survit au rechargement suivant").toContain("PTS");
  });
});

describe("joueur neuf — aucun filtre enregistré", () => {
  it("marque les opus récents comme déjà proposés, sans les réactiver plus tard", () => {
    // Le seed n'a de sens que pour un joueur dont les filtres SAUVEGARDÉS datent
    // d'avant l'opus. Chez un joueur neuf tout est déjà actif — mais son
    // `_seeded` n'était jamais écrit, donc son premier décochage de PTS était
    // annulé au chargement suivant. Le bug « impossible à décocher » subsistait,
    // une fois au lieu de toujours.
    mount(null); // aucun filtre en localStorage
    expect(JSON.parse(localStorage.getItem("filters_Test_seeded") || "[]")).toContain("PTS");

    // Le joueur décoche PTS…
    btn("PTS").click();
    expect(JSON.parse(localStorage.getItem("filters_Test"))).not.toContain("PTS");

    // …et il reste décoché au rechargement.
    const api = mount(JSON.parse(localStorage.getItem("filters_Test")), { fresh: false });
    expect(api.getActive()).not.toContain("PTS");
  });
});

/**
 * Marqueur « format précis » (`<storageKey>_precise`), 2026-09-18.
 *
 * ["P5"] seul était indiscernable de l'ancien format large : _migrate() le
 * ré-étendait en toute la famille P5 à CHAQUE chargement. Un joueur qui ne
 * gardait que le P5 de base retrouvait Royal, Strikers et Tactica cochés au
 * rechargement suivant. Vécu via tests-e2e/filters_usecases (« cible P5 » qui
 * tombait sur un personnage P5S selon la graine du joueur).
 */
const P5_ALL = ["P4", "P5", "P5R", "P5S", "P5T", "PTS"];

function mountP5(saved, { fresh = true, precise = null, seeded = ["PTS"] } = {}) {
  document.body.innerHTML = `
    <div class="filter-panel" id="filterPanel">
      <button id="filterToggleBtn"></button>
      <div class="filter-dropdown" id="filterDropdown">
        <div class="filter-group">
          <button class="filter-main-btn active" data-opus="P4"></button>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn active" data-opus-group="P5" data-opus-codes="P5,P5R,P5S,P5T"></button>
          <div class="filter-sub-panel">
            <button class="filter-sub-btn active" data-opus="P5"></button>
            <button class="filter-sub-btn active" data-opus="P5R"></button>
            <button class="filter-sub-btn active" data-opus="P5S"></button>
            <button class="filter-sub-btn active" data-opus="P5T"></button>
          </div>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn filter-color-pts active" data-opus="PTS"></button>
        </div>
      </div>
    </div>`;
  if (fresh) localStorage.clear();
  // PTS est un opus « récent » (DEFAULT_ON_NEW) : déjà proposé, sauf si le test dit le contraire.
  if (seeded) localStorage.setItem("filters_P5Test_seeded", JSON.stringify(seeded));
  if (saved) localStorage.setItem("filters_P5Test", JSON.stringify(saved));
  if (precise !== null) localStorage.setItem("filters_P5Test_precise", precise ? "1" : "0");
  return initFilterMenu("filters_P5Test", P5_ALL, () => {});
}

describe("filterMenu — marqueur « format précis »", () => {
  beforeEach(() => localStorage.clear());

  it("une liste d'avant (sans marqueur) : ['P5'] est étendue UNE fois, puis marquée", () => {
    const api = mountP5(["P5"]);
    expect(api.getActive().sort()).toEqual(["P5", "P5R", "P5S", "P5T"]);
    expect(localStorage.getItem("filters_P5Test_precise")).toBe("1");
    expect(JSON.parse(localStorage.getItem("filters_P5Test")).sort()).toEqual(["P5", "P5R", "P5S", "P5T"]);
  });

  it("avec le marqueur : ['P5'] reste ['P5'] — le P5 de base seul, rien de ré-étendu", () => {
    const api = mountP5(["P5"], { precise: true });
    expect(api.getActive()).toEqual(["P5"]);
  });

  it("ce que le joueur décoche dans la fenêtre reste décoché au rechargement", () => {
    mountP5(["P5", "P5R", "P5S", "P5T"], { precise: true });
    // Il ne garde que le P5 de base
    document.querySelector('.filter-sub-btn[data-opus="P5R"]').click();
    document.querySelector('.filter-sub-btn[data-opus="P5S"]').click();
    document.querySelector('.filter-sub-btn[data-opus="P5T"]').click();
    const saved = JSON.parse(localStorage.getItem("filters_P5Test"));
    expect(saved).toEqual(["P5"]);
    expect(localStorage.getItem("filters_P5Test_precise")).toBe("1");

    // Avant le marqueur, ce rechargement rendait Royal/Strikers/Tactica.
    const api2 = mountP5(saved, { fresh: false });
    expect(api2.getActive()).toEqual(["P5"]);
  });

  it("le seed d'un opus récent écrit aussi le marqueur", () => {
    const api = mountP5(["P4"], { precise: true, seeded: null }); // PTS jamais proposé
    expect(api.getActive().sort()).toEqual(["P4", "PTS"]);
    expect(localStorage.getItem("filters_P5Test_precise")).toBe("1");
  });

  it("marqueur présent : un code inconnu de ce mode est ignoré, une liste vide reste vide", () => {
    expect(mountP5(["P5", "PQ2"], { precise: true }).getActive()).toEqual(["P5"]);
    expect(mountP5([], { precise: true }).getActive()).toEqual([]);
  });
});
