/**
 * streakRecovery.test.js — Tests unitaires pour js/streak-recovery.js
 *
 * Couvre :
 *   - canRecover() : toutes les conditions de cooldown
 *   - checkStreakRecovery() : affichage conditionnel, flag shown écrit au bon moment
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { canRecover, checkStreakRecovery, performRecovery } from "../js/streak-recovery.js";

const RECOVERY_KEY = "streakRecovery";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  delete globalThis.window?._currentUser;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window?._currentUser;
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

// ─────────────────────────────────────────────────────────────
// performRecovery() — la récupération doit refléter la réalité backend.
// Régression historique : la récup écrivait le localStorage de façon
// optimiste puis appelait le backend en fire-and-forget. Si le backend
// refusait (cooldown 429 / validation 400), le client croyait avoir
// réussi, puis le prochain pullProfileFromCloud écrasait la streak →
// "récupération qui disparaît".
// ─────────────────────────────────────────────────────────────

describe("performRecovery", () => {
  function seedProfile(stats = {}) {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ stats: { streak: 0, streakRecord: 0, ...stats } })
    );
  }

  it("restores streak locally for a guest (no account, no backend call)", async () => {
    // Pas de window._currentUser → joueur local pur, aucun risque de revert cloud
    seedProfile();
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 7 }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await performRecovery(7);

    expect(res.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.stats.streak).toBe(7);
    // Crédit consommé
    const rec = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    expect(rec.previousStreak).toBe(0);
    expect(rec.lastUsed).toBeTruthy();
  });

  it("does NOT consume the credit when the backend rejects (cooldown 429)", async () => {
    globalThis.window._currentUser = { id: 42 };
    seedProfile({ streak: 0 });
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 7 }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Streak recovery on cooldown." }),
    });

    const res = await performRecovery(7);

    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    // La streak NE doit PAS avoir été restaurée localement
    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.stats.streak).toBe(0);
    // Le crédit NE doit PAS être consommé → previousStreak intact, pas de lastUsed
    const rec = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    expect(rec.previousStreak).toBe(7);
    expect(rec.lastUsed).toBeUndefined();
  });

  it("restores streak when the backend accepts (200)", async () => {
    globalThis.window._currentUser = { id: 42 };
    seedProfile({ streak: 0 });
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 9 }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ recovered: true, streak: 9 }),
    });

    const res = await performRecovery(9);

    expect(res.ok).toBe(true);
    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.stats.streak).toBe(9);
    const rec = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    expect(rec.previousStreak).toBe(0);
  });

  it("does NOT consume the credit on network failure", async () => {
    globalThis.window._currentUser = { id: 42 };
    seedProfile({ streak: 0 });
    localStorage.setItem(RECOVERY_KEY, JSON.stringify({ previousStreak: 4 }));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const res = await performRecovery(4);

    expect(res.ok).toBe(false);
    const rec = JSON.parse(localStorage.getItem(RECOVERY_KEY));
    expect(rec.previousStreak).toBe(4);
    expect(rec.lastUsed).toBeUndefined();
  });
});
