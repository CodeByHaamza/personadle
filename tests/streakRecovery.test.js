/**
 * streakRecovery.test.js — Tests unitaires pour js/streak-recovery.js
 *
 * Couvre :
 *   - canRecover() : toutes les conditions de cooldown
 *   - checkStreakRecovery() : affichage conditionnel, flag shown écrit au bon moment
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { canRecover, checkStreakRecovery } from "../js/streak-recovery.js";

const RECOVERY_KEY = "streakRecovery";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// canRecover()
// ─────────────────────────────────────────────────────────────

describe("canRecover", () => {
  it("returns false when no data in localStorage", () => {
    expect(canRecover()).toBe(false);
  });

  it("returns false when previousStreak is 0", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 0 }));
    expect(canRecover()).toBe(false);
  });

  it("returns false when previousStreak is 1 (minimum is 2)", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 1 }));
    expect(canRecover()).toBe(false);
  });

  it("returns true when previousStreak >= 2 and no lastUsed", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5 }));
    expect(canRecover()).toBe(true);
  });

  it("returns false when lastUsed is within 60 days", () => {
    const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5, lastUsed: recent }));
    expect(canRecover()).toBe(false);
  });

  it("returns false when lastUsed is exactly 59 days ago", () => {
    const almostReady = new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5, lastUsed: almostReady }));
    expect(canRecover()).toBe(false);
  });

  it("returns true when lastUsed is more than 60 days ago", () => {
    const oldDate = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5, lastUsed: oldDate }));
    expect(canRecover()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// checkStreakRecovery()
// ─────────────────────────────────────────────────────────────

describe("checkStreakRecovery", () => {
  it("does nothing when no previousStreak stored", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);
    checkStreakRecovery();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("does nothing when previousStreak <= 1", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 1 }));
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);
    checkStreakRecovery();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("does nothing when shown=true (already used)", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 7, shown: true }));
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);
    checkStreakRecovery();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("does nothing when canRecover() returns false", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 7, lastUsed: recent }));
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);
    checkStreakRecovery();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("does NOT write shown=true before user confirms", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5 }));
    vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);

    checkStreakRecovery();

    const stored = JSON.parse(localStorage.getItem(RECOVERY_KEY) || "{}");
    // shown must NOT be written yet — only written in _recover() when user clicks confirm
    expect(stored.shown).toBeUndefined();
  });

  it("does nothing when sessionStorage has _srDismissed", () => {
    sessionStorage.setItem("_srDismissed", "1");
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5 }));
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);
    checkStreakRecovery();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("schedules the menu display via setTimeout when recovery is available", () => {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 5 }));
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 0);
    checkStreakRecovery();
    expect(setTimeoutSpy).toHaveBeenCalledOnce();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 800);
  });
});
