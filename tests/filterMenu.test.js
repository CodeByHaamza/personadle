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
