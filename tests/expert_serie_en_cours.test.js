/**
 * expert_serie_en_cours.test.js — L'infobulle Expert montre la série EN COURS.
 *
 * Signalement joueur de novembre 2026 : « la quête n'avance plus » en All-Out
 * Attack et en Musique. Sur ses vraies données : 11 victoires du premier coup
 * d'affilée en AOA, mais l'infobulle affichait 12 / 15 — son RECORD, figé depuis
 * le 20/10. Le serveur renvoyait la meilleure série jamais atteinte (pour qu'un
 * déblocage soit définitif) et le client l'affichait comme progression : après
 * une série cassée, le compteur ne bougeait plus tant que la nouvelle série
 * n'avait pas dépassé l'ancienne.
 *
 * Désormais `current` = série en cours, `best` = record. La barre suit la série
 * en cours ; le record s'affiche à part quand il est plus haut.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { expertContext, setupExpertToggle, resetExpertStatusCache } from "../js/gameCore.js";

function stubExpertStatus(expertStatus) {
  window._personadleApi = {
    user: { expertStatus: vi.fn().mockResolvedValue({ expert_status: expertStatus }) },
  };
}

function mountZone() {
  document.body.innerHTML = `
    <div class="expert-toggle-zone">
      <a href="allOutAttack.html?expert=1" id="expertToggle" class="expert-toggle"
         data-i18n="ui.expert_enter">⚡ Expert mode</a>
    </div>`;
}

async function openTooltipFor(progress) {
  mountZone();
  stubExpertStatus({ alloutattack: progress });
  const ctx = expertContext({ prefix: "aoaExpert", statsKey: "AllOutAttack", hashMode: "AllOutAttack" });
  setupExpertToggle(ctx, "allOutAttack.html");
  await vi.waitFor(() => expect(document.getElementById("expertLockTooltip")).not.toBeNull());
  return document.getElementById("expertLockTooltip");
}

beforeEach(() => {
  resetExpertStatusCache();
  localStorage.clear();
  window._currentUser = undefined;
  window.history.replaceState({}, "", "/allOutAttack.html");
});

afterEach(() => {
  document.body.innerHTML = "";
  window._personadleApi = undefined;
  localStorage.clear();
  resetExpertStatusCache();
});

describe("infobulle Expert — série en cours et record", () => {
  const base = { unlocked: false, condition_type: "mode_consecutive_perfects", required: 15 };

  it("la barre et le compteur suivent la série EN COURS, pas le record", async () => {
    const tip = await openTooltipFor({ ...base, current: 11, best: 12 });
    expect(tip.querySelector(".expert-tooltip-count").textContent).toBe("11 / 15");
    expect(tip.querySelector(".expert-tooltip-bar > i").style.width).toBe("73%");
  });

  it("affiche le record à part quand il dépasse la série en cours", async () => {
    const tip = await openTooltipFor({ ...base, current: 3, best: 12 });
    const best = tip.querySelector(".expert-tooltip-best");
    expect(best).not.toBeNull();
    expect(best.textContent).toContain("12");
  });

  it("n'affiche pas de record quand la série en cours EST le record", async () => {
    const tip = await openTooltipFor({ ...base, current: 9, best: 9 });
    expect(tip.querySelector(".expert-tooltip-best")).toBeNull();
  });

  it("reste compatible avec un serveur qui ne renvoie pas encore `best`", async () => {
    // Le front peut être servi avant que l'API à jour soit déployée (cache, ordre
    // du déploiement) : sans `best`, on affiche simplement la progression reçue.
    const tip = await openTooltipFor({ ...base, current: 5 });
    expect(tip.querySelector(".expert-tooltip-count").textContent).toBe("5 / 15");
    expect(tip.querySelector(".expert-tooltip-best")).toBeNull();
  });

  it("rappelle que toutes les parties comptent, Rejouer compris", async () => {
    // Le joueur ne savait pas qu'un Rejouer gagné en 2 essais casse la série.
    const tip = await openTooltipFor({ ...base, current: 0, best: 4 });
    const hint = tip.querySelector(".expert-tooltip-hint");
    expect(hint).not.toBeNull();
    expect(hint.textContent).not.toBe("");
  });

  it("n'ajoute ni record ni rappel aux conditions cumulatives", async () => {
    // « 10 victoires en 4 essais ou moins » est un total à vie : il ne recule
    // jamais, il n'y a donc ni série à casser ni record distinct à montrer.
    const tip = await openTooltipFor({
      unlocked: false,
      condition_type: "mode_wins_under_attempts",
      required: 10,
      current: 7,
      best: 7,
    });
    expect(tip.querySelector(".expert-tooltip-best")).toBeNull();
    expect(tip.querySelector(".expert-tooltip-hint")).toBeNull();
  });
});
