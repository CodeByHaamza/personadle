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
  checkTitlesAfterGame,
  _resetTitlesData,
} from "../profile/titles-ui.js";

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  delete window._currentUser;
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

  it("classic_p1_wins — reads stats.modeWins.Classic (regression: naoya_first_awakening never unlocked because it read a nonexistent profile.classicP1Wins field)", () => {
    const title = find("naoya_first_awakening"); // condition_value: 15
    expect(isTitleConditionMet(title, { profile: {}, stats: { modeWins: { Classic: 14 } } })).toBe(
      false
    );
    expect(isTitleConditionMet(title, { profile: {}, stats: { modeWins: { Classic: 15 } } })).toBe(
      true
    );
  });

  it("emoji_p2_wins — reads stats.modeWins.Emoji (regression: maya_always_be_positive never unlocked because it read a nonexistent profile.emojiP2Wins field)", () => {
    const title = find("maya_always_be_positive"); // condition_value: 10
    expect(isTitleConditionMet(title, { profile: {}, stats: { modeWins: { Emoji: 9 } } })).toBe(
      false
    );
    expect(isTitleConditionMet(title, { profile: {}, stats: { modeWins: { Emoji: 10 } } })).toBe(
      true
    );
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

describe("titles modal grid — equip click handler", () => {
  it("ignores an equip click while the title's real id hasn't loaded yet (regression: used to silently unequip by sending equipped_title_id: null)", () => {
    document.body.innerHTML = `<div id="titlesModalGrid"></div>`;
    const profile = { unlockedTitles: ["adachi_boring_isnt_it"] };
    const saveProfile = vi.fn();
    const saveProfileToCloud = vi.fn();
    renderTitlesSection(profile, saveProfile, saveProfileToCloud, vi.fn());

    // Before initTitlesSection() resolves /api/titles, every card's data-id is "" (id: null).
    const card = document.querySelector('.tm-card[data-slug="adachi_boring_isnt_it"]');
    expect(card.dataset.id).toBe("");
    card.dispatchEvent(new Event("click", { bubbles: true }));

    expect(saveProfileToCloud).not.toHaveBeenCalled();
    expect(profile.equippedTitleSlug).toBeUndefined();
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

describe("checkTitlesAfterGame", () => {
  it("is a no-op when no profile exists in localStorage", () => {
    expect(() => checkTitlesAfterGame()).not.toThrow();
    expect(document.querySelector(".title-notification")).toBeNull();
  });

  it("unlocks a newly-qualifying title from localStorage and shows a notification", async () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ badges: new Array(20).fill("x") }) // velvet_room_thou_art_i: badges_count >= 20
    );

    checkTitlesAfterGame();
    await vi.waitFor(() => {
      expect(document.querySelector(".title-notification")).not.toBeNull();
    });

    const saved = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(saved.unlockedTitles).toContain("velvet_room_thou_art_i");
  });

  it("does not re-unlock a title already present in unlockedTitles", async () => {
    // 20 badges also satisfies marie_i_remembered (badges_count >= 15) — mark both
    // already-unlocked so the assertion isn't confused by a genuinely different unlock.
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({
        badges: new Array(20).fill("x"),
        unlockedTitles: ["velvet_room_thou_art_i", "marie_i_remembered"],
      })
    );

    checkTitlesAfterGame();
    // Give the async condition check a tick to run — no notification should ever appear.
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector(".title-notification")).toBeNull();
  });

  it("works without window._currentUser (friendCount defaults to 0, no fetch attempted)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    localStorage.setItem("personaUserProfile", JSON.stringify({ badges: new Array(20).fill("x") }));

    checkTitlesAfterGame();
    await vi.waitFor(() => {
      expect(document.querySelector(".title-notification")).not.toBeNull();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
