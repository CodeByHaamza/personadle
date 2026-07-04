/**
 * wallpapersUi.test.js — Unit tests for profile/wallpapers-ui.js
 * (extracted from profile-page.js's "🖼️ WALLPAPERS DÉBLOCABLES" block).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  UNLOCKABLE_WALLPAPERS,
  renderUnlockableWallpaperGallery,
  checkAndUnlockWallpapers,
  showWallpaperNotification,
} from "../profile/wallpapers-ui.js";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("UNLOCKABLE_WALLPAPERS conditions", () => {
  it("kamoshida_palace unlocks once all 6 modes have a game played", () => {
    const wp = UNLOCKABLE_WALLPAPERS.find((w) => w.id === "kamoshida_palace");
    const stats5 = { modeCount: { Classic: 1, Emoji: 1, Silhouette: 1, AllOutAttack: 1, Personae: 0 } };
    const stats6 = { modeCount: { ...stats5.modeCount, Personae: 1, Music: 1 } };
    expect(wp.check(null, stats5)).toBe(false);
    expect(wp.check(null, stats6)).toBe(true);
  });

  it("madarame_wallpaper requires a custom avatar AND at least 1 friend", () => {
    const wp = UNLOCKABLE_WALLPAPERS.find((w) => w.id === "madarame_wallpaper");
    expect(wp.check({ avatar: "x" }, null, 0)).toBe(false);
    expect(wp.check(null, null, 1)).toBe(false);
    expect(wp.check({ avatar: "x" }, null, 1)).toBe(true);
  });

  it("dark_shopping_district requires Social Link rank >= 5", () => {
    const wp = UNLOCKABLE_WALLPAPERS.find((w) => w.id === "dark_shopping_district");
    expect(wp.check({ bestSocialLinkRank: 4 })).toBe(false);
    expect(wp.check({ bestSocialLinkRank: 5 })).toBe(true);
  });

  it("mitsuo_dungeons requires 75 total games across all modes", () => {
    const wp = UNLOCKABLE_WALLPAPERS.find((w) => w.id === "mitsuo_dungeons");
    expect(wp.check(null, { modeCount: { Classic: 74 } })).toBe(false);
    expect(wp.check(null, { modeCount: { Classic: 40, Emoji: 35 } })).toBe(true);
  });
});

describe("renderUnlockableWallpaperGallery", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="unlockableWallpaperGrid"></div>`;
  });

  it("is a no-op when the container is absent", () => {
    document.body.innerHTML = "";
    expect(() => renderUnlockableWallpaperGallery({})).not.toThrow();
  });

  it("marks an unlocked wallpaper distinctly from locked ones", () => {
    renderUnlockableWallpaperGallery({ unlockedWallpapers: ["kamoshida_palace"] });
    const grid = document.getElementById("unlockableWallpaperGrid");
    const unlockedItem = grid.querySelector('[data-id="kamoshida_palace"]');
    const lockedItem = grid.querySelector('[data-id="madarame_wallpaper"]');
    expect(unlockedItem.classList.contains("unlocked")).toBe(true);
    expect(lockedItem.classList.contains("locked")).toBe(true);
  });

  it("renders one entry per catalog wallpaper", () => {
    renderUnlockableWallpaperGallery({});
    const grid = document.getElementById("unlockableWallpaperGrid");
    expect(grid.querySelectorAll(".unlockable-wp-item")).toHaveLength(UNLOCKABLE_WALLPAPERS.length);
  });
});

describe("checkAndUnlockWallpapers", () => {
  it("unlocks a newly-qualifying wallpaper and calls saveProfile once", async () => {
    const profile = { bestSocialLinkRank: 5 };
    const saveProfile = vi.fn();

    await checkAndUnlockWallpapers(profile, {}, 0, saveProfile);

    expect(profile.unlockedWallpapers).toContain("dark_shopping_district");
    expect(saveProfile).toHaveBeenCalledOnce();
  });

  it("does not call saveProfile when nothing new unlocks", async () => {
    const profile = { unlockedWallpapers: [] };
    const saveProfile = vi.fn();

    await checkAndUnlockWallpapers(profile, {}, 0, saveProfile);

    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("does not re-unlock an already-unlocked wallpaper", async () => {
    const profile = { bestSocialLinkRank: 10, unlockedWallpapers: ["dark_shopping_district"] };
    const saveProfile = vi.fn();

    await checkAndUnlockWallpapers(profile, {}, 0, saveProfile);

    expect(profile.unlockedWallpapers).toEqual(["dark_shopping_district"]);
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

describe("showWallpaperNotification", () => {
  it("appends a notification toast to the document body", () => {
    showWallpaperNotification({ name: "Test Wallpaper", src: "x.webp" });
    expect(document.querySelector(".wallpaper-notif-name").textContent).toBe("Test Wallpaper");
  });

  it("removes the toast when clicked", () => {
    showWallpaperNotification({ name: "Test Wallpaper", src: "x.webp" });
    const notif = document.querySelector(".wallpaper-notif");
    notif.click();
    expect(document.querySelector(".wallpaper-notif")).toBeNull();
  });
});
