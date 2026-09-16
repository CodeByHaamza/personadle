/**
 * atelier.test.js — l'Atelier du profil (profile/atelier.js) et les deux
 * rendus qui en dépendent dans badgesManager.js : les 4 emplacements de badges
 * épinglés sur la carte d'identité et l'onglet Badges (vignettes cliquables).
 *
 * Contrat 2.2 (décision Hamza du 2026-09-16) : plus de bouton Save — chaque
 * changement programme l'envoi complet, l'indicateur #saveStatus dit où on en
 * est, et un envoi raté se relance d'un clic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initAtelier,
  openAtelier,
  openAtelierTab,
  closeAtelier,
  savedAtelierTab,
  initSaveStatus,
  scheduleAutosave,
  flushAutosave,
  _resetAutosave,
} from "../profile/atelier.js";
import {
  renderBadgesPreview,
  renderBadgePicker,
  toggleBadgeSelection,
} from "../profile/badges/badgesManager.js";
import { badgesList } from "../profile/badges/badgesData.js";

const TABS = ["avatar", "border", "theme", "title", "badges"];

function atelierDom() {
  document.body.innerHTML = `
    <button id="openAtelierBtn"></button>
    <div id="saveStatus" data-save-status>
      <span class="save-status-dot"></span><span id="saveStatusText" data-save-status-text></span>
    </div>
    <div id="atelierModal" class="modal hidden">
      <div class="modal-content" id="atelier">
        <div class="atelier-modal-head">
          <div id="atelierSaveStatus" data-save-status>
            <span data-save-status-text></span>
          </div>
          <button id="closeAtelierModal"></button>
        </div>
        <div id="atelierTabs" role="tablist">
          ${TABS.map(
            (p, i) =>
              `<button class="atelier-tab" role="tab" data-pane="${p}" aria-selected="${i === 0}"></button>`
          ).join("")}
        </div>
        <div class="atelier-panes">
          ${TABS.map(
            (p, i) => `<div class="atelier-pane${i === 0 ? "" : " hidden"}" data-pane="${p}"></div>`
          ).join("")}
        </div>
      </div>
    </div>
    <div id="previewBadges"></div>
    <p id="badgePickHint"></p>
    <div id="badgePickGrid"></div>
  `;
}

const modalOpen = () => !document.getElementById("atelierModal").classList.contains("hidden");

const selectedTab = () =>
  document.querySelector('.atelier-tab[aria-selected="true"]')?.dataset.pane;
const visiblePane = () => document.querySelector(".atelier-pane:not(.hidden)")?.dataset.pane;
const status = () => document.getElementById("saveStatus").dataset.state;
const modalStatus = () => document.getElementById("atelierSaveStatus").dataset.state;

beforeEach(() => {
  atelierDom();
  localStorage.clear();
  _resetAutosave();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete window.i18n;
});

// ─────────────────────────────────────────────────────────────────────────────
// Onglets
// ─────────────────────────────────────────────────────────────────────────────

describe("onglets de l'atelier", () => {
  it("openAtelierTab sélectionne l'onglet, montre son panneau et mémorise le choix", () => {
    openAtelierTab("title");
    expect(selectedTab()).toBe("title");
    expect(visiblePane()).toBe("title");
    expect(document.querySelectorAll(".atelier-pane:not(.hidden)")).toHaveLength(1);
    expect(localStorage.getItem("atelierTab")).toBe("title");
    expect(savedAtelierTab()).toBe("title");
  });

  it("un nom inconnu retombe sur le premier onglet (Avatar)", () => {
    openAtelierTab("nope");
    expect(selectedTab()).toBe("avatar");
    expect(visiblePane()).toBe("avatar");
  });

  it("initAtelier rouvre le dernier onglet utilisé — le joueur revient là où il en était", () => {
    localStorage.setItem("atelierTab", "badges");
    initAtelier();
    expect(selectedTab()).toBe("badges");
    expect(visiblePane()).toBe("badges");
  });

  it("clic sur un onglet + navigation aux flèches (tablist accessible)", () => {
    initAtelier();
    document.querySelector('.atelier-tab[data-pane="theme"]').click();
    expect(visiblePane()).toBe("theme");

    const list = document.getElementById("atelierTabs");
    list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(visiblePane()).toBe("title");
    list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    list.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(visiblePane()).toBe("border");
    // Seul l'onglet actif est dans l'ordre de tabulation
    expect(document.querySelector('.atelier-tab[data-pane="border"]').tabIndex).toBe(0);
    expect(document.querySelector('.atelier-tab[data-pane="avatar"]').tabIndex).toBe(-1);
  });

  it("ne plante pas sur une page sans atelier (profil public, tests d'autres modules)", () => {
    document.body.innerHTML = "";
    expect(() => openAtelierTab("title")).not.toThrow();
    expect(() => openAtelier("title")).not.toThrow();
    expect(() => closeAtelier()).not.toThrow();
    expect(() => initAtelier()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// La modale (2.2, second retour Hamza : la page profil est une vitrine)
// ─────────────────────────────────────────────────────────────────────────────

describe("la modale de personnalisation", () => {
  it("openAtelierTab seul ne l'ouvre PAS — c'est openAtelier qui ouvre", () => {
    openAtelierTab("theme");
    expect(modalOpen()).toBe(false);
    openAtelier("theme");
    expect(modalOpen()).toBe(true);
    expect(visiblePane()).toBe("theme");
  });

  it("openAtelier sans argument rouvre le dernier onglet utilisé", () => {
    localStorage.setItem("atelierTab", "badges");
    openAtelier();
    expect(modalOpen()).toBe(true);
    expect(visiblePane()).toBe("badges");
  });

  it("« Personnaliser », la croix et le clic sur le fond ouvrent/ferment", () => {
    initAtelier();
    document.getElementById("openAtelierBtn").click();
    expect(modalOpen()).toBe(true);

    document.getElementById("closeAtelierModal").click();
    expect(modalOpen()).toBe(false);

    document.getElementById("openAtelierBtn").click();
    document.getElementById("atelierModal").click(); // le fond, pas le contenu
    expect(modalOpen()).toBe(false);
  });

  it("un clic DANS la modale ne la ferme pas", () => {
    initAtelier();
    openAtelier();
    document.getElementById("atelier").click();
    expect(modalOpen()).toBe(true);
  });

  it("fermer envoie tout de suite ce qui était en attente (et rien sinon)", async () => {
    const sync = vi.fn().mockResolvedValue();
    initSaveStatus(sync);
    initAtelier();
    openAtelier();

    closeAtelier();
    expect(sync, "rien en attente : pas d'envoi pour une simple fermeture").not.toHaveBeenCalled();

    openAtelier();
    scheduleAutosave();
    closeAtelier();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync, "un choix en attente part sans attendre le regroupement").toHaveBeenCalledOnce();
  });

  it("l'indicateur de l'en-tête de la modale suit celui de la carte", async () => {
    const sync = vi.fn().mockResolvedValue();
    initSaveStatus(sync);
    scheduleAutosave();
    expect(status()).toBe("saving");
    expect(modalStatus()).toBe("saving");
    await vi.advanceTimersByTimeAsync(700);
    expect(modalStatus()).toBe("saved");
    expect(document.querySelector("#atelierSaveStatus [data-save-status-text]").textContent).toBe(
      "Saved"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enregistrement automatique
// ─────────────────────────────────────────────────────────────────────────────

describe("enregistrement automatique", () => {
  it("regroupe une rafale de changements en UN seul envoi, puis affiche « enregistré » puis rien", async () => {
    const sync = vi.fn().mockResolvedValue();
    initSaveStatus(sync);
    expect(status()).toBe("idle");

    scheduleAutosave();
    scheduleAutosave();
    scheduleAutosave();
    expect(status()).toBe("saving");
    expect(sync).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(700);
    expect(sync).toHaveBeenCalledOnce();
    expect(status()).toBe("saved");

    await vi.advanceTimersByTimeAsync(1800);
    expect(status()).toBe("idle");
  });

  it("un envoi raté passe en erreur et se relance d'un clic sur l'indicateur", async () => {
    const sync = vi.fn().mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce();
    initSaveStatus(sync);

    scheduleAutosave();
    await vi.advanceTimersByTimeAsync(700);
    expect(status()).toBe("error");
    expect(document.getElementById("saveStatus").classList.contains("save-status--error")).toBe(true);
    expect(modalStatus()).toBe("error");

    document.getElementById("atelierSaveStatus").click(); // relance depuis la modale aussi
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(status()).toBe("saved");
  });

  it("un changement PENDANT l'envoi déclenche un second envoi après, jamais en parallèle", async () => {
    let release;
    const sync = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockResolvedValueOnce();
    initSaveStatus(sync);

    flushAutosave();
    expect(sync).toHaveBeenCalledOnce();
    scheduleAutosave();
    await vi.advanceTimersByTimeAsync(700);
    // Le premier envoi n'est pas fini : pas de second appel concurrent
    expect(sync).toHaveBeenCalledOnce();

    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(status()).toBe("saved");
  });

  it("les libellés passent par i18n avec repli anglais", async () => {
    window.i18n = { t: (k) => (k === "profile.saving" ? "Enregistrement…" : k) };
    initSaveStatus(vi.fn().mockResolvedValue());
    scheduleAutosave();
    expect(document.getElementById("saveStatusText").textContent).toBe("Enregistrement…");
    await vi.advanceTimersByTimeAsync(700);
    // clé absente → repli
    expect(document.getElementById("saveStatusText").textContent).toBe("Saved");
  });

  it("le clic sur l'indicateur ne fait rien hors erreur", () => {
    const sync = vi.fn().mockResolvedValue();
    initSaveStatus(sync);
    document.getElementById("saveStatus").click();
    expect(sync).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Badges épinglés (carte d'identité) + onglet Badges
// ─────────────────────────────────────────────────────────────────────────────

const ids = badgesList.slice(0, 6).map((b) => b.id);

function profileWith(unlocked, selected) {
  return { badges: unlocked, selectedBadges: selected, eventCodes: [], stats: {} };
}

describe("renderBadgesPreview — 4 emplacements", () => {
  it("rend toujours 4 cases : épinglés puis « + » pour le reste", () => {
    renderBadgesPreview(profileWith(ids, ids.slice(0, 2)));
    const slots = document.querySelectorAll("#previewBadges .pin-slot");
    expect(slots).toHaveLength(4);
    expect(document.querySelectorAll(".pin-slot--filled")).toHaveLength(2);
    expect(document.querySelectorAll(".pin-slot--empty")).toHaveLength(2);
    // Les images gardent la classe/données que la carte de partage lit
    const imgs = document.querySelectorAll("#previewBadges img.badge-preview-img");
    expect([...imgs].map((i) => i.dataset.badgeId)).toEqual(ids.slice(0, 2));
  });

  it("sans badge épinglé : 4 « + » et aucun texte « No badges selected »", () => {
    renderBadgesPreview(profileWith(ids, []));
    expect(document.querySelectorAll(".pin-slot--empty")).toHaveLength(4);
    expect(document.getElementById("previewBadges").textContent).not.toMatch(/No badges/);
  });

  it("un « + » ouvre l'onglet Badges de l'atelier", () => {
    renderBadgesPreview(profileWith(ids, []));
    document.querySelector(".pin-slot--empty").click();
    expect(visiblePane()).toBe("badges");
  });

  it("la croix désépingle sans passer par la modale, et re-rend les 4 cases", () => {
    const profile = profileWith(ids, ids.slice(0, 3));
    const save = vi.fn();
    renderBadgePicker(profile, save); // fournit le saveProfile courant
    renderBadgesPreview(profile);
    document.querySelector(`.pin-unpin[data-unpin="${ids[1]}"]`).click();
    expect(profile.selectedBadges).toEqual([ids[0], ids[2]]);
    expect(save).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(".pin-slot--filled")).toHaveLength(2);
    expect(document.querySelectorAll(".pin-slot--empty")).toHaveLength(2);
  });

  it("ignore un id épinglé qui n'existe plus dans le catalogue", () => {
    renderBadgesPreview(profileWith(ids, ["ghost_badge", ids[0]]));
    expect(document.querySelectorAll(".pin-slot--filled")).toHaveLength(1);
  });
});

describe("renderBadgePicker — onglet Badges", () => {
  it("ne montre que les badges débloqués, épinglés marqués aria-pressed + ✓, compteur dans l'indication", () => {
    renderBadgePicker(profileWith(ids.slice(0, 3), [ids[1]]), vi.fn());
    const picks = document.querySelectorAll("#badgePickGrid .badge-pick");
    expect(picks).toHaveLength(3);
    const pinned = document.querySelector(`.badge-pick[data-id="${ids[1]}"]`);
    expect(pinned.getAttribute("aria-pressed")).toBe("true");
    expect(pinned.querySelector(".badge-pick-check")).not.toBeNull();
    expect(document.querySelector(`.badge-pick[data-id="${ids[0]}"]`).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(document.getElementById("badgePickHint").dataset.count).toBe("1/4");
  });

  it("clic = épingler / désépingler, et les 4 cases de la carte suivent", () => {
    const profile = profileWith(ids, []);
    const save = vi.fn();
    renderBadgePicker(profile, save);
    renderBadgesPreview(profile);

    document.querySelector(`.badge-pick[data-id="${ids[2]}"]`).click();
    expect(profile.selectedBadges).toEqual([ids[2]]);
    expect(document.querySelectorAll(".pin-slot--filled")).toHaveLength(1);
    expect(document.querySelector(`.badge-pick[data-id="${ids[2]}"]`).getAttribute("aria-pressed")).toBe(
      "true"
    );

    document.querySelector(`.badge-pick[data-id="${ids[2]}"]`).click();
    expect(profile.selectedBadges).toEqual([]);
    expect(document.querySelectorAll(".pin-slot--filled")).toHaveLength(0);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("refuse un 5e badge (alerte) — la limite reste 4 comme dans la modale", () => {
    const profile = profileWith(ids, ids.slice(0, 4));
    renderBadgePicker(profile, vi.fn());
    document.querySelector(`.badge-pick[data-id="${ids[4]}"]`).click();
    expect(profile.selectedBadges).toEqual(ids.slice(0, 4));
    expect(document.querySelector(".badge-limit-alert")).not.toBeNull();
  });

  it("état vide explicite quand rien n'est débloqué", () => {
    renderBadgePicker(profileWith([], []), vi.fn());
    expect(document.querySelector("#badgePickGrid .badge-pick-empty")).not.toBeNull();
    expect(document.querySelectorAll(".badge-pick")).toHaveLength(0);
  });

  it("un emplacement vide ouvre la MODALE sur l'onglet Badges", () => {
    renderBadgesPreview(profileWith(ids, []));
    document.querySelector(".pin-slot--empty").click();
    expect(modalOpen()).toBe(true);
    expect(visiblePane()).toBe("badges");
  });

  it("toggleBadgeSelection re-rend aussi le sélecteur (une seule source d'état)", () => {
    const profile = profileWith(ids, []);
    renderBadgePicker(profile, vi.fn());
    toggleBadgeSelection(profile, vi.fn(), ids[0]);
    expect(document.querySelector(`.badge-pick[data-id="${ids[0]}"]`).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});
