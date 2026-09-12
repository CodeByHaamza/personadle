/**
 * friends_tabs.test.js — profile/friends/friends.js, onglets et ⚔ Défier (2.2)
 *
 * La page Amis empilait cinq blocs ; elle a maintenant trois onglets (Amis /
 * Boîte / Trouver) et un bouton ⚔ par ami qui emmène sur la page du mode choisi
 * avec l'ami présélectionné. Ces tests couvrent la mécanique d'onglets (état,
 * persistance, ?tab=, pastilles) et le sélecteur de mode.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  activateTab,
  initialTab,
  setTabBadge,
  openChallengeModePicker,
} from "../profile/friends/friends.js";

function mountTabs() {
  document.body.innerHTML = `
    <nav class="fr-tabs">
      <button class="fr-tab active" data-tab="friends" aria-selected="true">Amis <span class="fr-tab-badge hidden" id="tabFriendsBadge">0</span></button>
      <button class="fr-tab" data-tab="inbox" aria-selected="false">Boîte <span class="fr-tab-badge hidden" id="tabInboxBadge">0</span></button>
      <button class="fr-tab" data-tab="find" aria-selected="false">Trouver</button>
    </nav>
    <div class="fr-tab-panel" data-tab-panel="friends"></div>
    <div class="fr-tab-panel hidden" data-tab-panel="inbox"></div>
    <div class="fr-tab-panel hidden" data-tab-panel="find"><input id="browseSearch" /></div>`;
}

const visiblePanels = () =>
  [...document.querySelectorAll(".fr-tab-panel")]
    .filter((p) => !p.classList.contains("hidden"))
    .map((p) => p.dataset.tabPanel);

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/profile/friends/friends.html");
  delete window._personadleApi;
  mountTabs();
});

describe("activateTab", () => {
  it("n'affiche qu'un panneau à la fois et marque l'onglet actif", () => {
    activateTab("inbox");
    expect(visiblePanels()).toEqual(["inbox"]);
    const active = [...document.querySelectorAll(".fr-tab.active")].map((b) => b.dataset.tab);
    expect(active).toEqual(["inbox"]);
    expect(document.querySelector('[data-tab="inbox"]').getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[data-tab="friends"]').getAttribute("aria-selected")).toBe("false");
  });

  it("mémorise le dernier onglet ouvert", () => {
    activateTab("find");
    expect(localStorage.getItem("friendsTab")).toBe("find");
  });

  it("retombe sur Amis pour un onglet inconnu", () => {
    activateTab("nope");
    expect(visiblePanels()).toEqual(["friends"]);
  });
});

describe("initialTab", () => {
  it("Amis par défaut", () => {
    expect(initialTab()).toBe("friends");
  });

  it("reprend le dernier onglet mémorisé", () => {
    localStorage.setItem("friendsTab", "inbox");
    expect(initialTab()).toBe("inbox");
  });

  it("?tab= dans l'URL l'emporte sur la mémoire (lien direct vers la boîte)", () => {
    localStorage.setItem("friendsTab", "find");
    window.history.replaceState({}, "", "/profile/friends/friends.html?tab=inbox");
    expect(initialTab()).toBe("inbox");
  });

  it("ignore un ?tab= inconnu", () => {
    window.history.replaceState({}, "", "/profile/friends/friends.html?tab=xyz");
    expect(initialTab()).toBe("friends");
  });
});

describe("setTabBadge", () => {
  it("affiche le compte et se cache à zéro", () => {
    setTabBadge("tabInboxBadge", 3);
    const badge = document.getElementById("tabInboxBadge");
    expect(badge.textContent).toBe("3");
    expect(badge.classList.contains("hidden")).toBe(false);

    setTabBadge("tabInboxBadge", 0);
    expect(badge.classList.contains("hidden")).toBe(true);
  });

  it("ne plante pas sur une pastille absente", () => {
    expect(() => setTabBadge("nope", 2)).not.toThrow();
  });
});

describe("openChallengeModePicker — ⚔ depuis l'onglet Amis", () => {
  it("propose les 6 modes, chacun menant à sa page avec l'ami présélectionné", () => {
    document.body.innerHTML = `
      <div class="fr-entry"><div class="fr-entry-actions">
        <button class="fr-btn js-challenge" data-friend-id="42" data-pseudo="Ann">⚔</button>
      </div></div>`;
    const btn = document.querySelector(".js-challenge");
    openChallengeModePicker(btn, "42", "Ann");

    const links = [...document.querySelectorAll(".fr-mode-picker__btn")];
    expect(links).toHaveLength(6);
    for (const a of links) {
      expect(a.getAttribute("href")).toMatch(/^\.\.\/\.\.\/[A-Za-z]+Mode\/[A-Za-z]+\.html\?challenge=42$/);
    }
    expect(document.querySelector(".fr-mode-picker__title").textContent).toContain("Ann");
  });

  it("un second appel remplace le sélecteur au lieu d'en empiler un deuxième", () => {
    document.body.innerHTML = `
      <div class="fr-entry"><button class="js-challenge" data-friend-id="1" data-pseudo="A">⚔</button></div>
      <div class="fr-entry"><button class="js-challenge" data-friend-id="2" data-pseudo="B">⚔</button></div>`;
    const [b1, b2] = document.querySelectorAll(".js-challenge");
    openChallengeModePicker(b1, "1", "A");
    openChallengeModePicker(b2, "2", "B");
    expect(document.querySelectorAll("#frModePicker")).toHaveLength(1);
    expect(document.querySelector("#frModePicker").closest(".fr-entry")).toBe(b2.closest(".fr-entry"));
  });

  it("échappe le pseudo", () => {
    document.body.innerHTML = `<div class="fr-entry"><button class="js-challenge">⚔</button></div>`;
    openChallengeModePicker(document.querySelector(".js-challenge"), "1", "<img src=x>");
    expect(document.querySelector("#frModePicker img")).toBeNull();
  });
});
