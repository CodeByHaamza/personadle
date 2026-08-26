/**
 * expertUnlock.test.js — Porte d'entrée du Mode Expert, côté client.
 *
 * Ce que ce fichier protège (et pourquoi ça n'allait pas de soi) :
 *
 *   1. `expertContext().modeKey` doit être la clé BACKEND ("classic"), pas le
 *      libellé d'affichage. `statsKey`/`hashMode` valent "Classic" en normal et
 *      "ClassicExpert" en Expert : les envoyer à l'API ne matcherait aucun mode,
 *      et le bouton resterait déverrouillé en silence — exactement le genre de
 *      panne qu'aucune erreur ne signale.
 *
 *   2. Le verrou est un affichage OPTIMISTE : hors ligne, non connecté, ou backend
 *      en erreur, le bouton reste cliquable. Ce n'est pas un trou de sécurité —
 *      `api/sessions.php` refuse la session Expert de toute façon — mais il faut
 *      que ce soit un choix testé, pas un effet de bord.
 *
 *   3. Le libellé de condition est construit CÔTÉ CLIENT à partir du type et des
 *      deux nombres. Si le serveur renvoyait la phrase toute faite, elle serait en
 *      anglais pour les 6 langues du site.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  expertContext,
  setupExpertToggle,
  expertConditionLabel,
  resetExpertStatusCache,
  expertNavigate,
} from "../js/gameCore.js";

/** Pose le `<a id="expertToggle">` que les 6 pages de mode contiennent. */
function mountToggle() {
  document.body.innerHTML = `
    <a href="classiqueMode.html?expert=1" id="expertToggle" class="expert-toggle"
       data-i18n="ui.expert_enter">⚡ Expert mode</a>`;
  return document.getElementById("expertToggle");
}

/** Branche le bridge window._personadleApi sur une réponse d'expert-status. */
function stubExpertStatus(expertStatus) {
  window._personadleApi = {
    user: { expertStatus: vi.fn().mockResolvedValue({ expert_status: expertStatus }) },
  };
}

let originalNavigate;

beforeEach(() => {
  resetExpertStatusCache();
  localStorage.clear();
  window._personadleApi = undefined;
  window._currentUser = undefined;
  window.history.replaceState({}, "", "/classiqueMode.html");
  originalNavigate = expertNavigate.go;
  expertNavigate.go = vi.fn();
});

afterEach(() => {
  document.body.innerHTML = "";
  window._personadleApi = undefined;
  window._currentUser = undefined;
  localStorage.clear();
  expertNavigate.go = originalNavigate;
  resetExpertStatusCache();
});

describe("expertContext — clé de mode envoyée au backend", () => {
  it("expose la clé canonique du mode normal, pas le libellé d'affichage", () => {
    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    expect(ctx.modeKey).toBe("classic");
  });

  it("garde la clé du mode NORMAL même sur une page Expert", () => {
    window.history.replaceState({}, "", "/classiqueMode.html?expert=1");
    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });

    // hashMode est suffixé pour cloisonner le tirage quotidien…
    expect(ctx.hashMode).toBe("ClassicExpert");
    // …mais la clé d'API reste celle du mode, sinon aucun statut ne correspondrait.
    expect(ctx.modeKey).toBe("classic");
  });
});

describe("expertConditionLabel — objectif lisible", () => {
  it("énonce l'objectif à atteindre", () => {
    const label = expertConditionLabel({
      condition_type: "mode_wins_under_attempts",
      current: 7,
      required: 10,
    });
    expect(label).toContain("10");
    // L'avancement est rendu par la barre de l'infobulle : le répéter dans la
    // phrase donnerait « 7/10 … 7 / 10 ».
    expect(label).not.toMatch(/\b7\s*\/\s*10\b/);
  });

  it("distingue les trois types de condition", () => {
    const base = { current: 3, required: 15 };
    const perfects = expertConditionLabel({ ...base, condition_type: "mode_consecutive_perfects" });
    const singleDay = expertConditionLabel({ ...base, condition_type: "mode_wins_single_day" });
    expect(perfects).not.toBe(singleDay);
  });

  it("ne renvoie jamais la clé i18n brute quand le type est inconnu", () => {
    const label = expertConditionLabel({ condition_type: "mode_qui_nexiste_pas", current: 1, required: 2 });
    expect(label).not.toContain("ui.expert_cond");
    expect(label).toContain("1");
  });
});

describe("infobulle de déblocage", () => {
  /** Pose le bouton dans sa zone, comme dans les 6 pages de mode. */
  function mountZone() {
    document.body.innerHTML = `
      <div class="expert-toggle-zone">
        <a href="classiqueMode.html?expert=1" id="expertToggle" class="expert-toggle"
           data-i18n="ui.expert_enter">⚡ Expert mode</a>
      </div>`;
    return document.getElementById("expertToggle");
  }

  it("affiche l'objectif et une barre de progression proportionnelle", async () => {
    const toggle = mountZone();
    stubExpertStatus({
      classic: { unlocked: false, condition_type: "mode_wins_under_attempts", required: 10, current: 7 },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(document.getElementById("expertLockTooltip")).not.toBeNull());

    const tip = document.getElementById("expertLockTooltip");
    expect(tip.querySelector(".expert-tooltip-count").textContent).toBe("7 / 10");
    expect(tip.querySelector(".expert-tooltip-bar > i").style.width).toBe("70%");
    // L'infobulle doit suivre immédiatement le bouton : le CSS l'affiche via le
    // sélecteur de frère adjacent `.expert-locked:hover + .expert-tooltip`.
    expect(toggle.nextElementSibling).toBe(tip);
    // aria-describedby relie les deux pour les lecteurs d'écran…
    expect(toggle.getAttribute("aria-describedby")).toBe("expertLockTooltip");
    // …et le title natif doit disparaître, sinon deux bulles se superposent.
    expect(toggle.hasAttribute("title")).toBe(false);
  });

  it("n'affiche aucune barre quand il n'y a pas de progression à montrer", async () => {
    mountZone();
    const unauthorized = Object.assign(new Error("Unauthorized"), { status: 401 });
    window._personadleApi = { user: { expertStatus: vi.fn().mockRejectedValue(unauthorized) } };

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(document.getElementById("expertLockTooltip")).not.toBeNull());

    // Une jauge à 0 laisserait croire à une progression réelle qui n'existe pas.
    expect(document.querySelector(".expert-tooltip-bar")).toBeNull();
    expect(document.querySelector(".expert-tooltip-cond").textContent).not.toBe("");
  });

  it("ne dépasse jamais 100 % si la progression a dépassé le seuil", async () => {
    mountZone();
    stubExpertStatus({
      classic: { unlocked: false, condition_type: "mode_consecutive_perfects", required: 15, current: 40 },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(document.getElementById("expertLockTooltip")).not.toBeNull());

    expect(document.querySelector(".expert-tooltip-bar > i").style.width).toBe("100%");
  });

  it("n'empile pas deux infobulles si le câblage est rejoué", async () => {
    mountZone();
    stubExpertStatus({
      classic: { unlocked: false, condition_type: "mode_wins_single_day", required: 10, current: 1 },
    });
    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });

    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(document.getElementById("expertLockTooltip")).not.toBeNull());
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(document.querySelectorAll(".expert-tooltip").length).toBe(1));
  });
});

describe("setupExpertToggle — verrou du bouton ⚡", () => {
  it("verrouille le bouton quand le mode n'est pas débloqué", async () => {
    const toggle = mountToggle();
    stubExpertStatus({
      classic: {
        unlocked: false,
        condition_type: "mode_wins_under_attempts",
        required: 10,
        current: 4,
      },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(toggle.classList.contains("expert-locked")).toBe(true));

    // Plus de href : le lien ne doit être ni activable, ni copiable.
    expect(toggle.hasAttribute("href")).toBe(false);
    expect(toggle.getAttribute("aria-disabled")).toBe("true");
    // La condition doit être lisible au survol (infobulle) ET par un lecteur
    // d'écran (aria-label), qui n'a pas accès au rendu visuel.
    const tip = document.getElementById("expertLockTooltip");
    expect(tip.querySelector(".expert-tooltip-count").textContent).toBe("4 / 10");
    expect(toggle.getAttribute("aria-label")).toContain("10");
    // Reste atteignable au clavier, sinon l'aria-label est inaccessible.
    expect(toggle.getAttribute("tabindex")).toBe("0");
  });

  it("laisse le bouton intact quand le mode est débloqué", async () => {
    const toggle = mountToggle();
    stubExpertStatus({
      classic: { unlocked: true, condition_type: "mode_wins_under_attempts", required: 10, current: 10 },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(window._personadleApi.user.expertStatus).toHaveBeenCalled());

    expect(toggle.classList.contains("expert-locked")).toBe(false);
    expect(toggle.getAttribute("href")).toBe("classiqueMode.html?expert=1");
  });

  it("verrouille pour un visiteur non connecté (401) et invite à se connecter", async () => {
    const toggle = mountToggle();
    const unauthorized = Object.assign(new Error("Unauthorized"), { status: 401 });
    window._personadleApi = { user: { expertStatus: vi.fn().mockRejectedValue(unauthorized) } };

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(toggle.classList.contains("expert-locked")).toBe(true));

    // Le déblocage appartient au compte : sans compte, rien n'est débloquable.
    // L'infobulle doit dire quoi faire, pas afficher une progression 0/10 trompeuse.
    expect(document.querySelector(".expert-tooltip-count")).toBeNull();
    expect(toggle.hasAttribute("href")).toBe(false);
  });

  it("verrouille par défaut quand le backend est injoignable et qu'on ne sait rien", async () => {
    const toggle = mountToggle();
    window._personadleApi = {
      user: { expertStatus: vi.fn().mockRejectedValue(new Error("offline")) },
    };

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(toggle.classList.contains("expert-locked")).toBe(true));
  });

  it("garde le mode ouvert hors ligne si le compte l'avait déjà débloqué", async () => {
    const toggle = mountToggle();
    window._currentUser = { id: 42 };
    localStorage.setItem(
      "expertUnlockStatus",
      JSON.stringify({
        userId: 42,
        modes: {
          classic: { unlocked: true, condition_type: "mode_wins_under_attempts", required: 10, current: 10 },
        },
      }),
    );
    window._personadleApi = {
      user: { expertStatus: vi.fn().mockRejectedValue(new Error("offline")) },
    };

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(window._personadleApi.user.expertStatus).toHaveBeenCalled());

    expect(toggle.classList.contains("expert-locked")).toBe(false);
  });

  it("ignore le cache d'un AUTRE compte sur un appareil partagé", async () => {
    const toggle = mountToggle();
    window._currentUser = { id: 7 }; // ce n'est pas le joueur qui avait débloqué
    localStorage.setItem(
      "expertUnlockStatus",
      JSON.stringify({
        userId: 42,
        modes: { classic: { unlocked: true, condition_type: "mode_wins_under_attempts", required: 10, current: 10 } },
      }),
    );
    window._personadleApi = {
      user: { expertStatus: vi.fn().mockRejectedValue(new Error("offline")) },
    };

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(toggle.classList.contains("expert-locked")).toBe(true));
  });

  it("ne verrouille jamais le bouton de RETOUR depuis une page Expert", async () => {
    window.history.replaceState({}, "", "/classiqueMode.html?expert=1");
    const toggle = mountToggle();
    stubExpertStatus({
      classic: { unlocked: false, condition_type: "mode_wins_under_attempts", required: 10, current: 0 },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(expertNavigate.go).toHaveBeenCalled());

    // Sur une page Expert le bouton signifie « revenir au mode normal » : le
    // verrouiller enfermerait le joueur sur la page.
    expect(toggle.classList.contains("expert-locked")).toBe(false);
    expect(toggle.getAttribute("href")).toBe("classiqueMode.html");
  });

  it("renvoie vers le mode normal quand ?expert=1 est tapé à la main sur un mode verrouillé", async () => {
    window.history.replaceState({}, "", "/classiqueMode.html?expert=1");
    mountToggle();
    stubExpertStatus({
      classic: { unlocked: false, condition_type: "mode_wins_under_attempts", required: 10, current: 2 },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(expertNavigate.go).toHaveBeenCalledWith("classiqueMode.html"));
  });

  it("ne redirige PAS depuis une page Expert sur une simple panne réseau", async () => {
    window.history.replaceState({}, "", "/classiqueMode.html?expert=1");
    mountToggle();
    window._personadleApi = {
      user: { expertStatus: vi.fn().mockRejectedValue(new Error("offline")) },
    };

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(window._personadleApi.user.expertStatus).toHaveBeenCalled());

    // Éjecter un joueur légitimement débloqué au premier hoquet réseau serait pire
    // que de le laisser jouer : le serveur refuse de toute façon d'enregistrer la
    // session de quelqu'un qui ne l'est pas.
    expect(expertNavigate.go).not.toHaveBeenCalled();
  });

  it("laisse la page Expert quand le mode est bien débloqué", async () => {
    window.history.replaceState({}, "", "/classiqueMode.html?expert=1");
    mountToggle();
    stubExpertStatus({
      classic: { unlocked: true, condition_type: "mode_wins_under_attempts", required: 10, current: 12 },
    });

    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });
    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(window._personadleApi.user.expertStatus).toHaveBeenCalled());

    expect(expertNavigate.go).not.toHaveBeenCalled();
  });

  it("ne redemande pas le statut à chaque appel (une réponse couvre les 6 modes)", async () => {
    mountToggle();
    stubExpertStatus({
      classic: { unlocked: true, condition_type: "mode_wins_under_attempts", required: 10, current: 10 },
    });
    const ctx = expertContext({ prefix: "classicExpert", statsKey: "Classic", hashMode: "Classic" });

    setupExpertToggle(ctx, "classiqueMode.html");
    await vi.waitFor(() => expect(window._personadleApi.user.expertStatus).toHaveBeenCalledTimes(1));
    setupExpertToggle(ctx, "classiqueMode.html");
    await Promise.resolve();

    expect(window._personadleApi.user.expertStatus).toHaveBeenCalledTimes(1);
  });
});
