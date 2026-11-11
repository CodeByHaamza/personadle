/**
 * filter_guard.test.js — Changer de filtre en cours de partie = abandon
 * (js/filter_guard.js + setBeforeChange de js/filterMenu.js), 2.4 lot 12.
 *
 * Ce qui compte :
 *  - rien ne se passe pour une partie pas commencée, finie, déjà enregistrée ou de défi ;
 *  - Annuler laisse filtres ET partie intacts ;
 *  - Confirmer enregistre la partie en abandon (même session que le bouton) ;
 *  - dans les six modes, le menu reçoit bien ce garde.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMidGameFilterGuard } from "../js/filter_guard.js";
import { initFilterMenu } from "../js/filterMenu.js";
import { startGame } from "../js/gameCore.js";

const SCOPE = "Classic";

function guard(state, confirmFn) {
  return createMidGameFilterGuard({
    scope: SCOPE,
    modeKey: "classic",
    sessionMode: "Classic",
    isExpert: false,
    getState: () => ({ startedAt: Date.now() - 12_000, filters: ["P5"], ...state }),
    confirmFn,
  });
}

const pending = () => JSON.parse(localStorage.getItem("pendingSessions") || "[]");

beforeEach(() => {
  localStorage.clear();
  delete window._personadleApi; // savePendingSession met alors en file locale
  window.showToast = vi.fn();
  window.history.pushState({}, "", "/classiqueMode/classiqueMode.html");
  startGame(SCOPE); // un identifiant de partie, comme au chargement d'un mode
});

describe("createMidGameFilterGuard", () => {
  it("lets the change through silently when no game is in progress", () => {
    const confirmFn = vi.fn(() => false);
    expect(guard({ attempts: 0, gameOver: false, targetName: "Ann Takamaki" }, confirmFn)()).toBe(
      true
    );
    expect(guard({ attempts: 3, gameOver: true, targetName: "Ann Takamaki" }, confirmFn)()).toBe(
      true
    );
    expect(guard({ attempts: 3, gameOver: false, targetName: null }, confirmFn)()).toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
    expect(pending()).toEqual([]);
  });

  it("cancel keeps everything as it was", () => {
    const confirmFn = vi.fn(() => false);
    expect(guard({ attempts: 3, gameOver: false, targetName: "Ann Takamaki" }, confirmFn)()).toBe(
      false
    );
    expect(confirmFn).toHaveBeenCalledOnce();
    expect(pending()).toEqual([]);
  });

  it("confirm records the game as a give-up, once", () => {
    const g = guard({ attempts: 3, gameOver: false, targetName: "Ann Takamaki" }, () => true);
    expect(g()).toBe(true);
    const sessions = pending();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      mode: "classic",
      result: "giveup",
      attempts: 3,
      target_name: "Ann Takamaki",
      active_filters: ["P5"],
      is_expert: false,
    });
    expect(window.showToast).toHaveBeenCalledOnce();
    // Déjà enregistrée : un second changement passe sans redemander ni réenregistrer.
    expect(g()).toBe(true);
    expect(pending()).toHaveLength(1);
  });
});

describe("filterMenu — setBeforeChange", () => {
  function mount() {
    document.body.innerHTML = `
      <div class="filter-panel" id="filterPanel">
        <button id="filterToggleBtn"></button>
        <div class="filter-dropdown" id="filterDropdown">
          <div class="filter-group"><button class="filter-main-btn active" data-opus="P1"></button></div>
          <div class="filter-group"><button class="filter-main-btn active" data-opus="P5X"></button></div>
        </div>
      </div>`;
    const onChange = vi.fn();
    const api = initFilterMenu("filters_GuardTest", ["P1", "P5X"], onChange);
    return { api, onChange };
  }

  it("a refusing guard cancels the click; an accepting one lets it apply", () => {
    const { api, onChange } = mount();
    api.setBeforeChange(() => false);
    document.querySelector('[data-opus="P1"]').click();
    expect(api.getActive()).toEqual(["P1", "P5X"]);
    expect(onChange).not.toHaveBeenCalled();

    api.setBeforeChange(() => true);
    document.querySelector('[data-opus="P1"]').click();
    expect(api.getActive()).toEqual(["P5X"]);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("the six modes install the guard", () => {
  const MODES = [
    "classiqueMode/modeClassique.js",
    "emojiMode/emojiMode.js",
    "silhouetteMode/modeSilhouette.js",
    "allOutAttackMode/modeAllOutAttack.js",
    "personaeMode/modePersonae.js",
    "musicsMode/modeMusic.js",
  ];
  it.each(MODES)("%s", (file) => {
    const src = readFileSync(join(__dirname, "..", file), "utf8");
    expect(src).toMatch(/_filterApi\.setBeforeChange\(\s*createMidGameFilterGuard\(/);
  });
});
