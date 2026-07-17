/**
 * badgesManager.test.js — Unit tests for the badge orchestration logic in
 * profile/badges/badgesManager.js (unlock, selection limit, event codes,
 * share-marking). The badge *conditions* themselves (badgesData.js) are
 * already covered by tests/badgesConditions.test.js.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  unlockBadge,
  toggleBadgeSelection,
  handleEventCodeSubmit,
  getBadgesForShare,
  markProfileAsShared,
  checkBadgesAfterGame,
} from "../profile/badges/badgesManager.js";

function baseProfile(overrides = {}) {
  return {
    badges: [],
    selectedBadges: [],
    eventCodes: [],
    hasSharedProfile: false,
    stats: {},
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// unlockBadge
// ─────────────────────────────────────────────────────────────────────────────

describe("unlockBadge", () => {
  it("unlocks a known badge and returns true", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();

    const result = unlockBadge(profile, saveProfile, "true_hacker");

    expect(result).toBe(true);
    expect(profile.badges).toContain("true_hacker");
    expect(saveProfile).toHaveBeenCalledOnce();
  });

  it("returns false and does not duplicate an already-unlocked badge", () => {
    const profile = baseProfile({ badges: ["true_hacker"] });
    const saveProfile = vi.fn();

    const result = unlockBadge(profile, saveProfile, "true_hacker");

    expect(result).toBe(false);
    expect(profile.badges).toEqual(["true_hacker"]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("returns false for an unknown badge id and does not mutate the profile", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();

    const result = unlockBadge(profile, saveProfile, "not_a_real_badge");

    expect(result).toBe(false);
    expect(profile.badges).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleBadgeSelection — MAX_SELECTED_BADGES enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("toggleBadgeSelection", () => {
  it("selects a badge that is not yet selected", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();

    toggleBadgeSelection(profile, saveProfile, "badge_a");

    expect(profile.selectedBadges).toEqual(["badge_a"]);
    expect(saveProfile).toHaveBeenCalledOnce();
  });

  it("deselects a badge that is already selected", () => {
    const profile = baseProfile({ selectedBadges: ["badge_a", "badge_b"] });
    const saveProfile = vi.fn();

    toggleBadgeSelection(profile, saveProfile, "badge_a");

    expect(profile.selectedBadges).toEqual(["badge_b"]);
    expect(saveProfile).toHaveBeenCalledOnce();
  });

  it("allows selecting up to exactly 4 badges", () => {
    const profile = baseProfile({ selectedBadges: ["a", "b", "c"] });
    const saveProfile = vi.fn();

    toggleBadgeSelection(profile, saveProfile, "d");

    expect(profile.selectedBadges).toEqual(["a", "b", "c", "d"]);
  });

  it("refuses a 5th selection and leaves selectedBadges unchanged", () => {
    const profile = baseProfile({ selectedBadges: ["a", "b", "c", "d"] });
    const saveProfile = vi.fn();

    toggleBadgeSelection(profile, saveProfile, "e");

    expect(profile.selectedBadges).toEqual(["a", "b", "c", "d"]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("still allows deselecting when already at the 4-badge limit", () => {
    const profile = baseProfile({ selectedBadges: ["a", "b", "c", "d"] });
    const saveProfile = vi.fn();

    toggleBadgeSelection(profile, saveProfile, "b");

    expect(profile.selectedBadges).toEqual(["a", "c", "d"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleEventCodeSubmit
// ─────────────────────────────────────────────────────────────────────────────

describe("handleEventCodeSubmit", () => {
  let input, msg;

  beforeEach(() => {
    document.body.innerHTML = `<input id="in" /><div id="msg"></div>`;
    input = document.getElementById("in");
    msg = document.getElementById("msg");
  });

  it("unlocks the badge and records the code for a valid permanent code", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    input.value = "alibaba"; // lowercase input — must be uppercased internally

    handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toContain("ALIBABA");
    expect(profile.badges).toContain("true_hacker");
    expect(saveProfile).toHaveBeenCalledOnce();
    expect(input.value).toBe("");
  });

  it("rejects an unknown code without mutating the profile", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    input.value = "NOT_A_REAL_CODE";

    handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual([]);
    expect(profile.badges).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("does not re-unlock or duplicate an already-redeemed code", () => {
    const profile = baseProfile({ eventCodes: ["ALIBABA"], badges: ["true_hacker"] });
    const saveProfile = vi.fn();
    input.value = "ALIBABA";

    handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual(["ALIBABA"]);
    expect(profile.badges).toEqual(["true_hacker"]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("shows a warning and does not mutate the profile for an empty code", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    input.value = "   ";

    handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("rejects a time-limited event code outside its active window", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    input.value = "XMAS2025"; // active 2025-12-01 → 2025-12-31 only

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));

    handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBadgesForShare
// ─────────────────────────────────────────────────────────────────────────────

describe("getBadgesForShare", () => {
  it("returns the selected badges resolved from badgesList", () => {
    const profile = baseProfile({ selectedBadges: ["true_hacker"] });
    const result = getBadgesForShare(profile);
    expect(result.map((b) => b.id)).toEqual(["true_hacker"]);
  });

  it("silently skips ids that no longer exist in badgesList", () => {
    const profile = baseProfile({ selectedBadges: ["true_hacker", "not_a_real_badge"] });
    const result = getBadgesForShare(profile);
    expect(result.map((b) => b.id)).toEqual(["true_hacker"]);
  });

  it("caps the result at MAX_SELECTED_BADGES even if selectedBadges has more", () => {
    const profile = baseProfile({
      selectedBadges: ["true_hacker", "tae_takemi", "arati", "dzulian", "chef"],
    });
    const result = getBadgesForShare(profile);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("returns an empty array when nothing is selected", () => {
    expect(getBadgesForShare(baseProfile())).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// markProfileAsShared
// ─────────────────────────────────────────────────────────────────────────────

describe("markProfileAsShared", () => {
  it("sets hasSharedProfile and saves on first call", () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();

    markProfileAsShared(profile, saveProfile);

    expect(profile.hasSharedProfile).toBe(true);
    // Called at least once directly — plus again if this action unlocks a badge
    // (e.g. "Take The Pose", whose condition is hasSharedProfile === true).
    expect(saveProfile).toHaveBeenCalled();
  });

  it("is idempotent — a second call does not save again", () => {
    const profile = baseProfile({ hasSharedProfile: true });
    const saveProfile = vi.fn();

    markProfileAsShared(profile, saveProfile);

    expect(saveProfile).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkBadgesAfterGame — lightweight cross-page check called from every game
// mode's win/give-up handler (classiqueMode, emojiMode, silhouetteMode,
// allOutAttackMode, personaeMode, musicsMode via js/unlock-notify.js).
// ─────────────────────────────────────────────────────────────────────────────

describe("checkBadgesAfterGame", () => {
  it("is a no-op when no profile exists in localStorage", () => {
    expect(() => checkBadgesAfterGame()).not.toThrow();
    expect(document.querySelector(".badge-notification")).toBeNull();
  });

  it("unlocks a newly-qualifying badge read straight from localStorage", () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify(baseProfile({ stats: { giveups: 10 } })) // ace_defective: giveups_total >= 10
    );

    checkBadgesAfterGame();

    const saved = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(saved.badges).toContain("ace_defective");
  });

  it("does not re-unlock a badge already present in profile.badges", () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify(baseProfile({ stats: { giveups: 10 }, badges: ["ace_defective"] }))
    );

    checkBadgesAfterGame();

    const saved = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(saved.badges).toEqual(["ace_defective"]);
  });
});
