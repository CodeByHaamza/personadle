/**
 * social-link.test.js — Unit tests for js/social-link.js
 *
 * Covers the client-side logic that is *not* pure XP/rank math (that lives
 * server-side in api/lib/social_link.php, see tests/php/SocialLinkTest.php):
 * flame indicator, rank-10 permanent effect, and the rank-up overlay's
 * tier/sparkle/phrase selection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  addFlameIfPlayedToday,
  applyRank10Effect,
  showSocialLinkRankUp,
} from "../js/social-link.js";

function clearStorage() {
  localStorage.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// addFlameIfPlayedToday
// ─────────────────────────────────────────────────────────────────────────────

describe("addFlameIfPlayedToday", () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<span id="pseudo"></span>';
    container = document.getElementById("pseudo");
  });

  it("adds the flame when the last interaction is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    addFlameIfPlayedToday({ social_link_last_interaction: `${today} 10:00:00` }, container);
    expect(container.querySelector(".fr-flame")).not.toBeNull();
  });

  it("does not add the flame when the last interaction was yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    addFlameIfPlayedToday({ social_link_last_interaction: `${yesterday} 10:00:00` }, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
  });

  it("is a no-op when there is no last interaction", () => {
    addFlameIfPlayedToday({ social_link_last_interaction: null }, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
  });

  it("is a no-op when social_link_last_interaction is undefined", () => {
    addFlameIfPlayedToday({}, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyRank10Effect
// ─────────────────────────────────────────────────────────────────────────────

describe("applyRank10Effect", () => {
  let avatar, pseudo;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="wrap" style="position:static">
        <img id="avatar" />
      </div>
      <span id="pseudo"></span>
    `;
    avatar = document.getElementById("avatar");
    pseudo = document.getElementById("pseudo");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds the permanent rank10-avatar class immediately", () => {
    applyRank10Effect(avatar, pseudo);
    expect(avatar.classList.contains("rank10-avatar")).toBe(true);
  });

  it("appends a single rank10-icon to the pseudo element", () => {
    applyRank10Effect(avatar, pseudo);
    applyRank10Effect(avatar, pseudo); // idempotent — must not duplicate the icon
    expect(pseudo.querySelectorAll(".rank10-icon")).toHaveLength(1);
  });

  it("is a no-op when avatarEl is null", () => {
    expect(() => applyRank10Effect(null, pseudo)).not.toThrow();
  });

  it("spawns 8 particles after the delay, then removes them", () => {
    applyRank10Effect(avatar, pseudo, 0);

    vi.advanceTimersByTime(10);
    const wrap = document.getElementById("wrap");
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(8);

    vi.advanceTimersByTime(900);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(0);
  });

  it("shows then removes the 'True Confidant' label", () => {
    applyRank10Effect(avatar, pseudo, 0);
    const wrap = document.getElementById("wrap");

    vi.advanceTimersByTime(10 + 600);
    const label = wrap.querySelector(".rank10-label");
    expect(label).not.toBeNull();
    expect(label.textContent).toContain("True Confidant");

    vi.advanceTimersByTime(1800 + 600);
    expect(wrap.querySelector(".rank10-label")).toBeNull();
  });

  it("respects a custom delayMs before starting the particle burst", () => {
    applyRank10Effect(avatar, pseudo, 500);
    const wrap = document.getElementById("wrap");

    vi.advanceTimersByTime(100);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(0);

    vi.advanceTimersByTime(450);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showSocialLinkRankUp
// ─────────────────────────────────────────────────────────────────────────────

describe("showSocialLinkRankUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearStorage();
    document.body.innerHTML = "";
    document.documentElement.lang = "en";
    if (!window.requestAnimationFrame) {
      vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(cb, 0));
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("assigns the tier1 class for ranks 1-3", () => {
    showSocialLinkRankUp(2, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--tier1");
  });

  it("assigns the tier2 class for ranks 4-6", () => {
    showSocialLinkRankUp(5, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--tier2");
  });

  it("assigns the tier3 class for ranks 7-9", () => {
    showSocialLinkRankUp(8, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--tier3");
  });

  it("assigns the rank10 class for rank 10", () => {
    showSocialLinkRankUp(10, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--rank10");
  });

  it("renders more sparkles for rank 10 than for rank 1", () => {
    showSocialLinkRankUp(10, null);
    const rank10Count = document.querySelectorAll(".sl-ru-sparkle").length;

    document.body.innerHTML = "";
    showSocialLinkRankUp(1, null);
    const rank1Count = document.querySelectorAll(".sl-ru-sparkle").length;

    expect(rank10Count).toBeGreaterThan(rank1Count);
  });

  it("falls back to the internal rank-name table when rankNames is null", () => {
    showSocialLinkRankUp(5, null);
    expect(document.querySelector(".sl-ru-name").textContent).toBe("Confidant");
  });

  it("prefers the provided rankNames for the current language", () => {
    showSocialLinkRankUp(5, { en: "Confidant", fr: "Confident" });
    expect(document.querySelector(".sl-ru-name").textContent).toBe("Confidant");
  });

  it("displays the requested rank number", () => {
    showSocialLinkRankUp(7, null);
    expect(document.querySelector(".sl-ru-rank-num").textContent).toContain("7");
  });

  it("removes a pre-existing overlay before rendering a new one", () => {
    showSocialLinkRankUp(3, null);
    showSocialLinkRankUp(4, null);
    expect(document.querySelectorAll("#sl-rankup-overlay")).toHaveLength(1);
  });

  it("auto-closes after ~6s for non-rank-10 tiers", () => {
    showSocialLinkRankUp(3, null);
    vi.advanceTimersByTime(6000 + 500 + 10);
    expect(document.getElementById("sl-rankup-overlay")).toBeNull();
  });

  it("auto-closes after ~8.5s for rank 10 (longer celebration)", () => {
    showSocialLinkRankUp(10, null);

    vi.advanceTimersByTime(6000);
    expect(document.getElementById("sl-rankup-overlay")).not.toBeNull();

    vi.advanceTimersByTime(2500 + 500 + 10);
    expect(document.getElementById("sl-rankup-overlay")).toBeNull();
  });

  it("closes immediately when the overlay is clicked", () => {
    showSocialLinkRankUp(3, null);
    document.getElementById("sl-rankup-overlay").click();
    vi.advanceTimersByTime(500 + 10);
    expect(document.getElementById("sl-rankup-overlay")).toBeNull();
  });
});
