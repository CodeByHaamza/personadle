/**
 * badgesManager.test.js — Unit tests for the badge orchestration logic in
 * profile/badges/badgesManager.js (unlock, selection limit, event codes,
 * share-marking). The badge *conditions* themselves (badgesData.js) are
 * already covered by tests/badgesConditions.test.js.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  unlockBadge,
  toggleBadgeSelection,
  handleEventCodeSubmit,
  getBadgesForShare,
  markProfileAsShared,
  checkBadgesAfterGame,
  trackWeeklyModePlay,
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
  let input, msg, redeemSpy;

  beforeEach(() => {
    document.body.innerHTML = `<input id="in" /><div id="msg"></div>`;
    input = document.getElementById("in");
    msg = document.getElementById("msg");
    redeemSpy = vi.fn();
    window._personadleApi = { badges: { redeem: redeemSpy } };
  });

  afterEach(() => {
    delete window._personadleApi;
  });

  // Le catalogue de codes vit côté serveur (event_codes) — un code créé en
  // admin doit marcher immédiatement, jamais besoin de le dupliquer en JS
  // (c'était le bug : la version précédente validait contre un objet local
  // figé, un code admin fraîchement créé retournait toujours "Invalid code").

  it("unlocks the badge and records the code for a valid permanent code", async () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    redeemSpy.mockResolvedValue({ redeemed: true, code: "ALIBABA", badge_id: "true_hacker" });
    input.value = "alibaba"; // lowercase input — must be uppercased internally

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(redeemSpy).toHaveBeenCalledWith("ALIBABA");
    expect(profile.eventCodes).toContain("ALIBABA");
    expect(profile.badges).toContain("true_hacker");
    expect(saveProfile).toHaveBeenCalledOnce();
    expect(input.value).toBe("");
  });

  // ── Messages d'erreur : chaque cause doit être distinguable ────────────────
  // Auparavant tout ce qui n'était ni 409 ni 410 devenait « Invalid code. Check
  // your spelling! ». Un joueur déconnecté (401) ou hors ligne croyait s'être
  // trompé et réessayait indéfiniment un code pourtant valide.

  it("tells a signed-out player to sign in instead of blaming the code (401)", async () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    redeemSpy.mockRejectedValue({ status: 401, message: "Unauthorized — please log in" });
    input.value = "GYOTRE";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(msg.textContent).not.toMatch(/spelling/i);
    expect(msg.textContent.toLowerCase()).toMatch(/sign in|connecte/);
    expect(profile.eventCodes).toEqual([]);
  });

  it("does not blame the code on a network failure or server error", async () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    redeemSpy.mockRejectedValue(new Error("Failed to fetch")); // pas de .status
    input.value = "GYOTRE";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(msg.textContent).not.toMatch(/spelling/i);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  // ── Régression : le badge était accordé côté serveur, puis le client plantait ──
  // `initProfile()` ne pose `eventCodes: []` que sur un profil NEUF. Un profil
  // enregistré avant l'ajout du champ n'a pas la clé : `.includes()` levait un
  // TypeError APRÈS le 200 du serveur, et le catch l'affichait comme un code
  // invalide. Le joueur avait donc le badge en base, mais lisait « code faux ».
  it("succeeds on a legacy profile that has no eventCodes/badges arrays", async () => {
    const profile = baseProfile();
    delete profile.eventCodes;
    delete profile.badges;
    const saveProfile = vi.fn();
    redeemSpy.mockResolvedValue({ redeemed: true, code: "GYOTRE", badge_id: "gyotre" });
    input.value = "GYOTRE";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toContain("GYOTRE");
    expect(profile.badges).toContain("gyotre");
    expect(saveProfile).toHaveBeenCalledOnce();
    expect(msg.textContent).not.toMatch(/spelling/i);
  });

  it("rejects an unknown/invalid code without mutating the profile", async () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    redeemSpy.mockRejectedValue({ status: 404, message: "Invalid or expired code" });
    input.value = "NOT_A_REAL_CODE";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual([]);
    expect(profile.badges).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("does not re-unlock or duplicate an already-redeemed code (server 409)", async () => {
    const profile = baseProfile({ eventCodes: ["ALIBABA"], badges: ["true_hacker"] });
    const saveProfile = vi.fn();
    redeemSpy.mockRejectedValue({ status: 409, message: "Code already redeemed" });
    input.value = "ALIBABA";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual(["ALIBABA"]);
    expect(profile.badges).toEqual(["true_hacker"]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("shows a warning and does not mutate the profile for an empty code", async () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    input.value = "   ";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(redeemSpy).not.toHaveBeenCalled();
    expect(profile.eventCodes).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("rejects a time-limited event code outside its active window (server 410)", async () => {
    const profile = baseProfile();
    const saveProfile = vi.fn();
    redeemSpy.mockRejectedValue({ status: 410, message: "Code not active yet or already expired" });
    input.value = "XMAS2025";

    await handleEventCodeSubmit(profile, saveProfile, input, msg);

    expect(profile.eventCodes).toEqual([]);
    expect(saveProfile).not.toHaveBeenCalled();
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

// ─────────────────────────────────────────────────────────────────────────────
// trackWeeklyModePlay — feeds profile.weeklyCleanWinModes (title akechi_pancakes,
// condition_type 'weekly_clean_modes'). See tests/titlesUi.test.js for the
// isTitleConditionMet side of the regression.
// ─────────────────────────────────────────────────────────────────────────────

describe("trackWeeklyModePlay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records the first mode played and sets weeklyCleanWinModes to 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    const profile = {};
    const saveProfile = vi.fn();
    trackWeeklyModePlay(profile, saveProfile, "classic");

    expect(profile.weeklyCleanWinModes).toBe(1);
    expect(profile.weeklyModeLog["2026-01-15"]).toEqual(["classic"]);
    expect(saveProfile).toHaveBeenCalledOnce();
  });

  it("normalizes any mode graphy to its canonical key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    const profile = {};
    trackWeeklyModePlay(profile, vi.fn(), "All Out Attack");

    expect(profile.weeklyModeLog["2026-01-15"]).toEqual(["alloutattack"]);
  });

  it("does not double-count the same mode played twice in the same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    const profile = {};
    trackWeeklyModePlay(profile, vi.fn(), "music");
    trackWeeklyModePlay(profile, vi.fn(), "Music");

    expect(profile.weeklyModeLog["2026-01-15"]).toEqual(["music"]);
    expect(profile.weeklyCleanWinModes).toBe(1);
  });

  it("counts distinct modes across several days within the 7-day window", () => {
    const profile = {};
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    trackWeeklyModePlay(profile, vi.fn(), "classic");

    vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
    trackWeeklyModePlay(profile, vi.fn(), "emoji");

    vi.setSystemTime(new Date("2026-01-19T12:00:00Z"));
    trackWeeklyModePlay(profile, vi.fn(), "music");

    expect(profile.weeklyCleanWinModes).toBe(3);
  });

  it("prunes entries older than 7 days out of the rolling window", () => {
    const profile = {};
    vi.useFakeTimers();

    // Played classic 10 days ago — should fall out of the 7-day window.
    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    trackWeeklyModePlay(profile, vi.fn(), "classic");
    expect(profile.weeklyCleanWinModes).toBe(1);

    // Today: only emoji is within the last 7 days.
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    trackWeeklyModePlay(profile, vi.fn(), "emoji");

    expect(profile.weeklyModeLog["2026-01-05"]).toBeUndefined();
    expect(profile.weeklyCleanWinModes).toBe(1);
  });

  it("counts a give-up the same as a win — no result filtering (mirrors the server's approximation)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    // trackWeeklyModePlay takes no `result` argument at all — calling it for a
    // give-up (as checkUnlocksAfterGame does on every mode's give-up path too)
    // counts identically to a win, matching condition_check.php's real query.
    const profile = {};
    trackWeeklyModePlay(profile, vi.fn(), "silhouette");

    expect(profile.weeklyCleanWinModes).toBe(1);
  });

  it("is a no-op when no mode is provided", () => {
    const profile = {};
    const saveProfile = vi.fn();
    trackWeeklyModePlay(profile, saveProfile, undefined);

    expect(profile.weeklyModeLog).toBeUndefined();
    expect(saveProfile).not.toHaveBeenCalled();
  });
});
