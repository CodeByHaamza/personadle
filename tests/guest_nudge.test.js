/**
 * guest_nudge.test.js — relance des invités (2.2)
 *
 * Un joueur SANS compte qui tient 3 jours de série voit, dans la boîte de
 * victoire, une carte « sauvegarde ta série » : lien vers l'inscription,
 * « Plus tard » qui la ferme, et pas de nouvelle carte avant une semaine.
 * Jamais pour un joueur connecté, jamais sous 3 jours.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { maybeNudgeGuest } from "../js/gameCore.js";

function guestWithStreak(n) {
  localStorage.setItem("personaUserProfile", JSON.stringify({ stats: { streak: n } }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete window._currentUser;
  window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html");
  document.body.innerHTML = `<div id="victoryBox"></div>`;
});

describe("maybeNudgeGuest", () => {
  it("à 3 jours de série sans compte : la carte, avec le lien d'inscription", () => {
    guestWithStreak(3);
    expect(maybeNudgeGuest()).toBe(true);
    const card = document.getElementById("guestNudge");
    expect(card).not.toBeNull();
    expect(card.querySelector(".guest-nudge__title").textContent).toContain("3");
    expect(card.querySelector(".guest-nudge__cta").getAttribute("href")).toBe(
      "../profile/profile.html#register"
    );
    expect(Number(localStorage.getItem("guestNudgeShownAt"))).toBeGreaterThan(0);
  });

  it("sous 3 jours, ou connecté, ou sans boîte de victoire : rien", () => {
    guestWithStreak(2);
    expect(maybeNudgeGuest()).toBe(false);

    guestWithStreak(10);
    window._currentUser = { id: 1 };
    expect(maybeNudgeGuest()).toBe(false);

    delete window._currentUser;
    document.body.innerHTML = "";
    expect(maybeNudgeGuest()).toBe(false);
    expect(document.getElementById("guestNudge")).toBeNull();
  });

  it("« Plus tard » ferme la carte ; pas de nouvelle carte avant 7 jours", () => {
    guestWithStreak(5);
    maybeNudgeGuest();
    document.querySelector(".guest-nudge__later").click();
    expect(document.getElementById("guestNudge")).toBeNull();

    expect(maybeNudgeGuest(), "montrée il y a une seconde").toBe(false);
    localStorage.setItem("guestNudgeShownAt", String(Date.now() - 8 * 86_400_000));
    expect(maybeNudgeGuest(), "une semaine plus tard").toBe(true);
  });

  it("rappelée alors que la carte est déjà là : une seule carte", () => {
    guestWithStreak(4);
    maybeNudgeGuest();
    maybeNudgeGuest();
    expect(document.querySelectorAll("#guestNudge")).toHaveLength(1);
  });

  it("profil local illisible : ne casse pas la fin de partie", () => {
    localStorage.setItem("personaUserProfile", "{not json");
    expect(maybeNudgeGuest()).toBe(false);
  });
});
