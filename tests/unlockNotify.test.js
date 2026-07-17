/**
 * unlockNotify.test.js — Unit tests for js/unlock-notify.js.
 *
 * checkUnlocksAfterGame() is the single call site every game mode (classiqueMode,
 * emojiMode, silhouetteMode, allOutAttackMode, personaeMode, musicsMode) uses after
 * a win/give-up to trigger badge/title/wallpaper checks "regardless of page" —
 * previously this only ever happened on the next profile page visit.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkUnlocksAfterGame } from "../js/unlock-notify.js";
import { _resetTitlesData } from "../profile/titles-ui.js";

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  delete window._currentUser;
  _resetTitlesData();
  vi.restoreAllMocks();
});

describe("checkUnlocksAfterGame", () => {
  it("is a no-op when no profile exists in localStorage", async () => {
    expect(() => checkUnlocksAfterGame()).not.toThrow();
    // Titles/wallpapers run async internally — give their microtasks a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector(".badge-notification")).toBeNull();
    expect(document.querySelector(".title-notification")).toBeNull();
    expect(document.querySelector(".wallpaper-notif")).toBeNull();
  });

  it("checks badges, titles, and wallpapers in a single call and notifies for each", async () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({
        badges: [],
        stats: { giveups: 10 }, // badge: ace_defective (giveups_total >= 10)
        bestSocialLinkRank: 5, // wallpaper: dark_shopping_district
      })
      // 0 badges → no title qualifies yet, keeps this test focused on badges+wallpapers.
    );

    checkUnlocksAfterGame();

    await vi.waitFor(() => {
      expect(document.querySelector(".badge-notification")).not.toBeNull();
      expect(document.querySelector(".wallpaper-notif")).not.toBeNull();
    });

    const saved = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(saved.badges).toContain("ace_defective");
    expect(saved.unlockedWallpapers).toContain("dark_shopping_district");
  });

  it("a failure in one check does not prevent the others from running", async () => {
    // Malformed stats shouldn't crash the badge check and take titles/wallpapers down with it.
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ bestSocialLinkRank: 5, stats: null })
    );

    expect(() => checkUnlocksAfterGame()).not.toThrow();

    await vi.waitFor(() => {
      expect(document.querySelector(".wallpaper-notif")).not.toBeNull();
    });
  });
});
