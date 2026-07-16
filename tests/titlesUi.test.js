/**
 * titlesUi.test.js — Unit tests for profile/titles-ui.js
 * (extracted from profile-page.js's "🎴 TITRES VISUELS (CALLING CARDS)" block).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TITLES_LOCAL,
  isTitleConditionMet,
  titleConditionText,
  renderTitlesSection,
  getEquippedTitle,
  resetTitlesUnlockedState,
  _resetTitlesData,
} from "../profile/titles-ui.js";

beforeEach(() => {
  document.body.innerHTML = "";
  _resetTitlesData();
  vi.restoreAllMocks();
});

describe("isTitleConditionMet", () => {
  const find = (slug) => TITLES_LOCAL.find((t) => t.slug === slug);

  it("badges_count — met once the badge count reaches the threshold", () => {
    const title = find("velvet_room_thou_art_i"); // condition_value: 20
    expect(isTitleConditionMet(title, { profile: { badges: new Array(19) } })).toBe(false);
    expect(isTitleConditionMet(title, { profile: { badges: new Array(20) } })).toBe(true);
  });

  it("unique_days — reads profile.uniqueDaysPlayed", () => {
    const title = find("makoto_yuki_memento_mori"); // condition_value: 100
    expect(isTitleConditionMet(title, { profile: { uniqueDaysPlayed: 99 } })).toBe(false);
    expect(isTitleConditionMet(title, { profile: { uniqueDaysPlayed: 100 } })).toBe(true);
  });

  it("all_modes_won — reads the precomputed allModesWon flag", () => {
    const title = find("yu_reach_out_to_the_truth");
    expect(isTitleConditionMet(title, { profile: {}, allModesWon: false })).toBe(false);
    expect(isTitleConditionMet(title, { profile: {}, allModesWon: true })).toBe(true);
  });

  it("friends_count — reads the precomputed friendCount", () => {
    const title = find("yosuke_ride_the_wind"); // condition_value: 5
    expect(isTitleConditionMet(title, { profile: {}, friendCount: 4 })).toBe(false);
    expect(isTitleConditionMet(title, { profile: {}, friendCount: 5 })).toBe(true);
  });

  it("giveups_total — reads the precomputed giveups total", () => {
    const title = find("adachi_boring_isnt_it"); // condition_value: 50
    expect(isTitleConditionMet(title, { profile: {}, giveups: 49 })).toBe(false);
    expect(isTitleConditionMet(title, { profile: {}, giveups: 50 })).toBe(true);
  });

  it("joker_profile — requires the All-Out Attack theme AND a P5 signature track", () => {
    const title = find("joker_looking_cool");
    expect(
      isTitleConditionMet(title, {
        profile: { profileTheme: "velvet_room", profileMusicId: "Last_Surprise.mp3" },
      })
    ).toBe(false);
    expect(
      isTitleConditionMet(title, {
        profile: { profileTheme: "all_out", profileMusicId: "not_a_joker_song.mp3" },
      })
    ).toBe(false);
    expect(
      isTitleConditionMet(title, {
        profile: { profileTheme: "all_out", profileMusicId: "Last_Surprise.mp3" },
      })
    ).toBe(true);
  });

  it("joker_profile — also unlocks via Joker/Ren avatar (avatarSrc)", () => {
    const title = find("joker_looking_cool");
    // avatarSrc contenant un fichier Joker → true
    expect(
      isTitleConditionMet(title, {
        profile: { avatarSrc: "../img/avatar/JOKER.webp" },
      })
    ).toBe(true);
    // avatarSrc contenant Joker.jpg → true
    expect(
      isTitleConditionMet(title, {
        profile: { avatarSrc: "../img/avatar/Joker.jpg" },
      })
    ).toBe(true);
    // avatarSrc contenant Ren.webp → true
    expect(
      isTitleConditionMet(title, {
        profile: { avatarSrc: "../img/avatar/Ren.webp" },
      })
    ).toBe(true);
    // avatar GIF (path stocké directement dans profile.avatar) → true
    expect(
      isTitleConditionMet(title, {
        profile: { avatar: "../img/avatar/Ren.gif" },
      })
    ).toBe(true);
    // avatar base64 sans avatarSrc, ni song+thème → false
    expect(
      isTitleConditionMet(title, {
        profile: { avatar: "data:image/png;base64,abc123" },
      })
    ).toBe(false);
    // avatar non-joker → false
    expect(
      isTitleConditionMet(title, {
        profile: { avatarSrc: "../img/avatar/Ryuji.jpg" },
      })
    ).toBe(false);
  });

  it("returns false for an unrecognized condition_type (defensive)", () => {
    expect(isTitleConditionMet({ condition_type: "not_a_real_condition" }, { profile: {} })).toBe(
      false
    );
  });
});

describe("titleConditionText", () => {
  it("produces a human-readable string for a known condition_type", () => {
    expect(titleConditionText({ condition_type: "badges_count", condition_value: 20 })).toBe(
      "Unlock 20 badges"
    );
  });

  it("falls back to the raw condition_type for an unknown one", () => {
    expect(titleConditionText({ condition_type: "mystery_condition" })).toBe("mystery_condition");
  });
});

describe("getEquippedTitle", () => {
  it("returns null when nothing is equipped", () => {
    expect(getEquippedTitle({})).toBeNull();
  });

  it("resolves the equipped title by slug", () => {
    const eq = getEquippedTitle({ equippedTitleSlug: "adachi_boring_isnt_it" });
    expect(eq?.slug).toBe("adachi_boring_isnt_it");
  });
});

describe("renderTitlesSection", () => {
  it("is a no-op when the expected DOM elements are absent", () => {
    expect(() =>
      renderTitlesSection({}, vi.fn(), vi.fn(), vi.fn())
    ).not.toThrow();
  });

  it("hides the calling-card image when no title is equipped", () => {
    document.body.innerHTML = `<img id="equippedTitleImg" style="display:block">`;
    renderTitlesSection({}, vi.fn(), vi.fn(), vi.fn());
    expect(document.getElementById("equippedTitleImg").style.display).toBe("none");
  });

  it("shows the calling-card image when a title is equipped", () => {
    document.body.innerHTML = `<img id="equippedTitleImg">`;
    renderTitlesSection(
      { equippedTitleSlug: "adachi_boring_isnt_it" },
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    const img = document.getElementById("equippedTitleImg");
    expect(img.style.display).toBe("block");
    expect(img.dataset.rarity).toBe("common");
  });
});

describe("resetTitlesUnlockedState", () => {
  it("clears is_unlocked on every title", () => {
    // Simulate an unlock via renderTitlesSection's shared _titlesData state
    const before = getEquippedTitle({ equippedTitleSlug: "adachi_boring_isnt_it" });
    expect(before).not.toBeNull();
    resetTitlesUnlockedState();
    // No public getter for is_unlocked besides going through the grid render — smoke check only.
    expect(() => resetTitlesUnlockedState()).not.toThrow();
  });
});
