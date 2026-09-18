/**
 * filters_usecases.test.js — Cas d'usage des filtres d'opus, du point de vue du
 * joueur, sur le VRAI panneau (js/filterMenu.js) et le vrai cycle de défi
 * (js/gameCore.js) — pas sur des fonctions isolées.
 *
 * Trois familles :
 *   1. Ce que je vois au chargement selon ce que j'ai (ou pas) enregistré —
 *      migration de l'ancien format, valeurs corrompues, autre mode.
 *   2. Ce que je clique — un opus, un groupe, tout, et ce qui est persisté.
 *   3. Un défi passe par là — filtres de l'expéditeur installés puis rendus, y
 *      compris quand le seeding d'un opus récent (PTS) se glisse entre les deux.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { initFilterMenu } from "../js/filterMenu.js";
import {
  installActiveChallenge,
  releaseActiveChallenge,
  readActiveChallenge,
  registerActiveFilters,
  characterMatchesActiveOpus,
  FILTER_STORAGE_KEYS,
} from "../js/gameCore.js";

/** Catalogue « Classique » réaliste : P1, P2 (deux opus), P3 (trois), P5X, PTS. */
const ALL = ["P1", "P2IS", "P2EP", "P3", "P3FES", "P3P", "P5X", "PTS"];
const KEY = "filters_Classic";

function mount(allOpus = ALL) {
  document.body.innerHTML = `
    <div class="filter-panel" id="filterPanel">
      <button id="filterToggleBtn"></button>
      <div class="filter-dropdown" id="filterDropdown">
        <div class="filter-group">
          <button class="filter-main-btn" data-opus="P1"></button>
        </div>
        <div class="filter-group">
          <div class="filter-sub-panel" data-group-panel="P2">
            <button class="filter-sub-btn" data-opus="P2IS"></button>
            <button class="filter-sub-btn" data-opus="P2EP"></button>
          </div>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn" data-opus-group="P3" data-opus-codes="P3,P3FES,P3P"></button>
          <div class="filter-sub-panel" data-group-panel="P3">
            <button class="filter-sub-btn" data-opus="P3"></button>
            <button class="filter-sub-btn" data-opus="P3FES"></button>
            <button class="filter-sub-btn" data-opus="P3P"></button>
          </div>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn" data-opus="P5X"></button>
        </div>
        <div class="filter-group">
          <button class="filter-main-btn" data-opus="PTS"></button>
        </div>
      </div>
    </div>`;
  const onChange = vi.fn();
  const api = initFilterMenu(KEY, allOpus, onChange);
  return { api, onChange };
}
const saved = () => JSON.parse(localStorage.getItem(KEY));
const click = (sel) => document.querySelector(sel).click();
const isActive = (code) => document.querySelector(`[data-opus="${code}"]`).classList.contains("active");

beforeEach(() => {
  localStorage.clear();
  registerActiveFilters(KEY, null);
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Au chargement
// ─────────────────────────────────────────────────────────────────────────────
describe("au chargement — ce que j'ai enregistré", () => {
  it("rien d'enregistré → tout actif, rien n'est écrit dans la clé (« absent = tout »)", () => {
    const { api } = mount();
    expect(api.getActive().sort()).toEqual([...ALL].sort());
    expect(localStorage.getItem(KEY)).toBeNull();
    ALL.forEach((c) => expect(isActive(c)).toBe(true));
    expect(document.querySelector(".filter-head-count").textContent).toBe(`${ALL.length} / ${ALL.length}`);
  });

  it("liste vide enregistrée → tout décoché, avertissement affiché, rien réinjecté", () => {
    localStorage.setItem(KEY, "[]");
    const { api } = mount();
    expect(api.getActive()).toEqual([]);
    expect(document.querySelector(".filter-empty-warning").hidden).toBe(false);
    expect(saved()).toEqual([]);
  });

  it("ancien format « P3 » seul → étendu à P3 + P3FES + P3P", () => {
    localStorage.setItem(KEY, JSON.stringify(["P3"]));
    const { api } = mount();
    expect(api.getActive()).toEqual(expect.arrayContaining(["P3", "P3FES", "P3P"]));
    expect(api.getActive()).not.toContain("P1");
  });

  it("nouveau format « P3 + P3FES » → gardé tel quel (P3P reste décoché)", () => {
    localStorage.setItem(KEY, JSON.stringify(["P3", "P3FES"]));
    const { api } = mount();
    // PTS peut être seedé une fois en plus — on ne teste que P3*
    expect(api.getActive().filter((c) => c.startsWith("P3")).sort()).toEqual(["P3", "P3FES"]);
  });

  it("ancien format « P2 » → P2IS + P2EP", () => {
    localStorage.setItem(KEY, JSON.stringify(["P2"]));
    const { api } = mount();
    expect(api.getActive()).toEqual(expect.arrayContaining(["P2IS", "P2EP"]));
  });

  it("des codes inconnus de CE mode (copiés d'un autre mode) sont ignorés, pas plantés", () => {
    localStorage.setItem(KEY, JSON.stringify(["P4G", "P5R", "P1"]));
    const { api } = mount();
    expect(api.getActive()).toContain("P1");
    expect(api.getActive()).not.toContain("P4G");
    expect(api.getActive()).not.toContain("P5R");
  });

  it("uniquement des codes inconnus → traité comme « rien d'enregistré » : tout actif", () => {
    localStorage.setItem(KEY, JSON.stringify(["P4G", "P5R"]));
    const { api } = mount();
    expect(api.getActive().sort()).toEqual([...ALL].sort());
  });

  it("JSON corrompu → tout actif, pas d'exception", () => {
    localStorage.setItem(KEY, "{not json");
    expect(() => mount()).not.toThrow();
  });

  it("valeur qui n'est pas un tableau (objet, chaîne, nombre) → tout actif", () => {
    for (const v of ['{"a":1}', '"P5"', "42", "null"]) {
      localStorage.clear();
      localStorage.setItem(KEY, v);
      const { api } = mount();
      expect(api.getActive().sort()).toEqual([...ALL].sort());
    }
  });

  it("les filtres d'un autre mode ne fuient pas ici", () => {
    localStorage.setItem(FILTER_STORAGE_KEYS.emoji, JSON.stringify(["P1"]));
    const { api } = mount();
    expect(api.getActive().sort()).toEqual([...ALL].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ce que je clique
// ─────────────────────────────────────────────────────────────────────────────
describe("ce que je clique", () => {
  it("décocher un opus direct le retire, le persiste et prévient le mode avec une COPIE", () => {
    const { api, onChange } = mount();
    click('[data-opus="P1"]');
    expect(api.getActive()).not.toContain("P1");
    expect(saved()).not.toContain("P1");
    expect(onChange).toHaveBeenCalledTimes(1);
    const passed = onChange.mock.calls[0][0];
    passed.push("HACK");
    expect(api.getActive()).not.toContain("HACK");
  });

  it("recocher le remet, et la clé reflète la liste complète (pas « absent »)", () => {
    const { api } = mount();
    click('[data-opus="P1"]');
    click('[data-opus="P1"]');
    expect(api.getActive()).toContain("P1");
    expect(saved().sort()).toEqual([...ALL].sort());
  });

  it("bouton de groupe P3 : tout décocher le groupe, puis tout le recocher", () => {
    const { api } = mount();
    const groupBtn = document.querySelector('[data-group-panel="P3"] .filter-group-select-btn');
    expect(groupBtn.dataset.groupCodes).toBe("P3,P3FES,P3P");
    groupBtn.click();
    expect(api.getActive().filter((c) => c.startsWith("P3"))).toEqual([]);
    expect(document.querySelector('[data-opus-group="P3"]').classList.contains("active")).toBe(false);
    groupBtn.click();
    expect(api.getActive()).toEqual(expect.arrayContaining(["P3", "P3FES", "P3P"]));
  });

  it("groupe partiellement coché : le logo principal reste actif, le bouton propose « tout »", () => {
    mount();
    click('[data-opus="P3P"]');
    expect(document.querySelector('[data-opus-group="P3"]').classList.contains("active")).toBe(true);
    expect(document.querySelector('[data-group-panel="P3"] .filter-group-select-btn').dataset.state).toBe("select");
  });

  it("« tout décocher » puis « tout cocher » : l'avertissement suit, le mode n'est pas relancé sur une liste vide", () => {
    const { api, onChange } = mount();
    click(".filter-select-all-btn");
    expect(api.getActive()).toEqual([]);
    expect(document.querySelector(".filter-empty-warning").hidden).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith([]);
    click(".filter-select-all-btn");
    expect(api.getActive().sort()).toEqual([...ALL].sort());
    expect(document.querySelector(".filter-empty-warning").hidden).toBe(true);
  });

  it("décocher le dernier opus actif laisse la clé à « [] » (choix assumé) et non absente", () => {
    localStorage.setItem(KEY, JSON.stringify(["P1"]));
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    const { api } = mount();
    click('[data-opus="P1"]');
    expect(api.getActive()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBe("[]");
  });

  it("le compteur de l'en-tête suit chaque clic", () => {
    mount();
    const count = () => document.querySelector(".filter-head-count").textContent;
    expect(count()).toBe("8 / 8");
    click('[data-opus="P1"]');
    expect(count()).toBe("7 / 8");
    click('[data-opus="P2IS"]');
    expect(count()).toBe("6 / 8");
  });

  it("localStorage plein (setItem lève) : le clic passe quand même, le mode est prévenu", () => {
    const { api, onChange } = mount();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => click('[data-opus="P1"]')).not.toThrow();
    expect(api.getActive()).not.toContain("P1");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ouvrir le panneau pose un fond, fermer par ✕ ou Escape le retire", () => {
    mount();
    click("#filterToggleBtn");
    expect(document.querySelector(".filter-backdrop")).not.toBeNull();
    expect(document.getElementById("filterDropdown").classList.contains("open")).toBe(true);
    click(".filter-head-close");
    expect(document.querySelector(".filter-backdrop")).toBeNull();
    click("#filterToggleBtn");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("filterDropdown").classList.contains("open")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Un défi passe par là
// ─────────────────────────────────────────────────────────────────────────────
describe("un défi installe les filtres de l'expéditeur, puis me rend les miens", () => {
  const challenge = (filters) => ({
    msgId: 501,
    mode: "classic",
    score: 3,
    senderId: 9,
    challengeFilters: JSON.stringify(filters),
    challengeTarget: "Yu Narukami",
  });

  it("j'avais « P1 seulement » : le défi joue avec P5X seulement, puis je retrouve P1 seulement", () => {
    localStorage.setItem(KEY, JSON.stringify(["P1"]));
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    const c = installActiveChallenge(challenge(["P5X"]));
    const { api } = mount();
    expect(api.getActive()).toEqual(["P5X"]);
    releaseActiveChallenge(c);
    expect(saved()).toEqual(["P1"]);
    expect(readActiveChallenge(false)).toBeNull();
  });

  it("je n'avais jamais touché mes filtres : après le défi la clé redevient ABSENTE (tout actif), pas « [] »", () => {
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    const c = installActiveChallenge(challenge(["P5X"]));
    mount();
    releaseActiveChallenge(c);
    expect(localStorage.getItem(KEY)).toBeNull();
    const { api } = mount();
    expect(api.getActive().sort()).toEqual([...ALL].sort());
  });

  it("PREMIÈRE ouverture du mode sur cet appareil pendant le défi : le seeding de PTS ne doit pas me voler mes filtres", () => {
    // Nouveau téléphone : le joueur accepte un défi depuis la page Amis et ouvre
    // Classique pour la première fois. Aucun `_seeded` → filterMenu injecte PTS
    // dans la liste du défi et la PERSISTE. Si releaseActiveChallenge compare la
    // clé à ce que le défi avait écrit, il conclut « le joueur a rechoisi » et ne
    // rend rien : le joueur garde « P5X + PTS » pour toujours, sans l'avoir choisi.
    const c = installActiveChallenge(challenge(["P5X"]));
    const { api } = mount();
    expect(api.getActive()).toEqual(["P5X"]); // les filtres du défi, rien de plus, rien de persisté en plus
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(["P5X"]));
    releaseActiveChallenge(c);
    expect(localStorage.getItem(KEY)).toBeNull();
    // Le seed n’a pas été « consommé » par le défi : à la prochaine ouverture,
    // sur MES filtres (tout actif), PTS est marqué proposé comme pour tout joueur neuf.
    mount();
    expect(JSON.parse(localStorage.getItem(`${KEY}_seeded`))).toContain("PTS");
  });

  it("idem quand j'avais « P1 seulement » et que PTS n'avait jamais été proposé", () => {
    localStorage.setItem(KEY, JSON.stringify(["P1"]));
    const c = installActiveChallenge(challenge(["P5X"]));
    mount();
    releaseActiveChallenge(c);
    expect(saved()).toEqual(["P1"]);
    // Et PTS m’est proposé une fois, sur MA liste, comme s’il n’y avait pas eu de défi.
    const { api } = mount();
    expect(api.getActive().sort()).toEqual(["P1", "PTS"]);
  });

  it("…mais si j'ai VRAIMENT rechoisi pendant le défi, mon choix prime", () => {
    localStorage.setItem(KEY, JSON.stringify(["P1"]));
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    const c = installActiveChallenge(challenge(["P5X"]));
    mount();
    click('[data-opus="P2IS"]'); // je coche P2IS pendant le défi
    releaseActiveChallenge(c);
    expect(saved().sort()).toEqual(["P2IS", "P5X"]);
  });

  it("l'expéditeur envoie un ancien format « P3 » : je joue P3 + P3FES + P3P", () => {
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    installActiveChallenge(challenge(["P3"]));
    const { api } = mount();
    expect(api.getActive().sort()).toEqual(["P3", "P3FES", "P3P"]);
  });

  it("l'expéditeur n'avait touché à rien (liste complète envoyée) : rien ne change pour moi et je retrouve mon état", () => {
    localStorage.setItem(KEY, JSON.stringify(["P1"]));
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    const c = installActiveChallenge(challenge(ALL));
    const { api } = mount();
    expect(api.getActive().sort()).toEqual([...ALL].sort());
    releaseActiveChallenge(c);
    expect(saved()).toEqual(["P1"]);
  });

  it("défi sans filtres (« [] ») : mes filtres ne bougent pas, ni pendant ni après", () => {
    localStorage.setItem(KEY, JSON.stringify(["P1"]));
    localStorage.setItem(`${KEY}_seeded`, JSON.stringify(["PTS"]));
    const c = installActiveChallenge(challenge([]));
    const { api } = mount();
    expect(api.getActive()).toEqual(["P1"]);
    releaseActiveChallenge(c);
    expect(saved()).toEqual(["P1"]);
  });

  it("un défi d'un mode SANS filtre connu (clé inconnue) n'écrit aucun filtre", () => {
    const c = installActiveChallenge({ ...challenge(["P5X"]), mode: "inconnu" });
    expect(c.filterKey).toBeNull();
    expect(Object.values(FILTER_STORAGE_KEYS).some((k) => localStorage.getItem(k) !== null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// characterMatchesActiveOpus — la question posée à chaque personnage
// ─────────────────────────────────────────────────────────────────────────────
describe("characterMatchesActiveOpus", () => {
  it("opus en tableau : un seul en commun suffit", () => {
    expect(characterMatchesActiveOpus({ opus: ["P3", "P4AU"] }, ["P4AU"])).toBe(true);
    expect(characterMatchesActiveOpus({ opus: ["P3", "P4AU"] }, ["P5"])).toBe(false);
  });
  it("opus en chaîne (ancien dataset) : accepté", () => {
    expect(characterMatchesActiveOpus({ opus: "P1" }, ["P1"])).toBe(true);
  });
  it("aucun filtre actif → aucun personnage", () => {
    expect(characterMatchesActiveOpus({ opus: ["P1"] }, [])).toBe(false);
  });
  it("personnage sans opus, ou absent → false, pas d'exception", () => {
    expect(characterMatchesActiveOpus({ nom: "X" }, ["P1"])).toBe(false);
    expect(characterMatchesActiveOpus(null, ["P1"])).toBe(false);
    expect(characterMatchesActiveOpus(undefined, ["P1"])).toBe(false);
  });
  it("la comparaison est stricte sur le code (P5 ≠ P5R ≠ p5)", () => {
    expect(characterMatchesActiveOpus({ opus: ["P5R"] }, ["P5"])).toBe(false);
    expect(characterMatchesActiveOpus({ opus: ["P5"] }, ["p5"])).toBe(false);
  });
});
