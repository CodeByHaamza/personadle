/**
 * profileStats.test.js — Unit tests for profile/profileStats.js
 *
 * updateProfileStats() reads/writes from localStorage under 'personaUserProfile'.
 * Each test sets up a fresh profile, calls the function, and asserts the result.
 *
 * Date helpers use UTC-based ISO strings (same as profileStats.js internals).
 */

import { updateProfileStats } from "../profile/profileStats.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a profile object with sensible defaults and optional stat overrides. */
function makeProfile(statsOverrides = {}) {
  return {
    pseudo: "TestUser",
    stats: {
      games: 0,
      wins: 0,
      giveups: 0,
      streak: 0,
      streakRecord: 0,
      totalTimeMinutes: 0,
      modeCount: {},
      modeWins: {},
      ...statsOverrides,
    },
  };
}

function saveProfile(profile) {
  localStorage.setItem("personaUserProfile", JSON.stringify(profile));
}

function loadProfile() {
  return JSON.parse(localStorage.getItem("personaUserProfile"));
}

/** Returns a UTC date string N days before today (YYYY-MM-DDTHH:mm:ss.sssZ). */
function daysAgoISO(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("updateProfileStats", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Guard clause ───────────────────────────────────────────────────────────

  describe("no profile in localStorage", () => {
    it("is a no-op — does not throw and does not create a profile", () => {
      expect(() =>
        updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 })
      ).not.toThrow();
      expect(localStorage.getItem("personaUserProfile")).toBeNull();
    });
  });

  // ── games / wins / giveups counters ───────────────────────────────────────

  describe("games & win/giveup counters", () => {
    it("increments games on every call regardless of result", () => {
      saveProfile(makeProfile({ games: 5 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.games).toBe(6);
    });

    it("increments wins when result is 'win'", () => {
      saveProfile(makeProfile({ wins: 2 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.wins).toBe(3);
    });

    it("does NOT increment wins when result is 'giveup'", () => {
      saveProfile(makeProfile({ wins: 2 }));
      updateProfileStats({ result: "giveup", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.wins).toBe(2);
    });

    it("increments giveups when result is 'giveup'", () => {
      saveProfile(makeProfile({ giveups: 1 }));
      updateProfileStats({ result: "giveup", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.giveups).toBe(2);
    });

    it("does NOT increment giveups when result is 'win'", () => {
      saveProfile(makeProfile({ giveups: 1 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.giveups).toBe(1);
    });
  });

  // ── modeCount & modeWins ──────────────────────────────────────────────────

  describe("modeCount & modeWins", () => {
    it("increments modeCount for the played mode", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.modeCount.Classic).toBe(1);
    });

    it("normalizes mode aliases: 'classique' → 'Classic'", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "win", mode: "classique", timeSpent: 0 });
      expect(loadProfile().stats.modeCount.Classic).toBe(1);
    });

    it("normalizes mode aliases: 'alloutattack' → 'AllOutAttack'", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "win", mode: "alloutattack", timeSpent: 0 });
      expect(loadProfile().stats.modeCount.AllOutAttack).toBe(1);
    });

    it("increments modeWins when result is 'win'", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "win", mode: "Emoji", timeSpent: 0 });
      expect(loadProfile().stats.modeWins.Emoji).toBe(1);
    });

    it("does NOT create a modeWins entry when result is 'giveup'", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "giveup", mode: "Music", timeSpent: 0 });
      expect(loadProfile().stats.modeWins?.Music).toBeUndefined();
    });

    it("accumulates modeWins across multiple wins in the same mode", () => {
      saveProfile(makeProfile({ modeWins: { Classic: 4 } }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.modeWins.Classic).toBe(5);
    });

    it("sets favoriteMode to the most-played mode", () => {
      saveProfile(makeProfile({ modeCount: { Classic: 5, Emoji: 3 } }));
      updateProfileStats({ result: "win", mode: "Emoji", timeSpent: 0 }); // Emoji → 4
      // Classic (5) is still ahead
      expect(loadProfile().stats.favoriteMode).toBe("Classic");
    });

    it("updates favoriteMode when a mode overtakes the current leader", () => {
      saveProfile(makeProfile({ modeCount: { Classic: 2, Emoji: 2 } }));
      updateProfileStats({ result: "win", mode: "Emoji", timeSpent: 0 }); // Emoji → 3
      expect(loadProfile().stats.favoriteMode).toBe("Emoji");
    });
  });

  // ── Streak logic ──────────────────────────────────────────────────────────

  describe("streak logic", () => {
    it("sets streak to 1 on first ever play (no lastPlayed)", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.streak).toBe(1);
    });

    it("increments streak when played on consecutive days", () => {
      saveProfile(makeProfile({ streak: 3, lastPlayed: daysAgoISO(1) }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.streak).toBe(4);
    });

    it("does not change streak when played twice on the same day", () => {
      // lastPlayed = today (already played today)
      saveProfile(makeProfile({ streak: 5, lastPlayed: new Date().toISOString() }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.streak).toBe(5);
    });

    it("resets streak to 1 when a day was skipped", () => {
      saveProfile(makeProfile({ streak: 10, lastPlayed: daysAgoISO(2) }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.streak).toBe(1);
    });

    it("updates streakRecord when the new streak exceeds it", () => {
      saveProfile(makeProfile({ streak: 7, streakRecord: 7, lastPlayed: daysAgoISO(1) }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      const stats = loadProfile().stats;
      expect(stats.streak).toBe(8);
      expect(stats.streakRecord).toBe(8);
    });

    it("does NOT lower streakRecord when streak resets", () => {
      saveProfile(makeProfile({ streak: 5, streakRecord: 10, lastPlayed: daysAgoISO(2) }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      const stats = loadProfile().stats;
      expect(stats.streak).toBe(1);
      expect(stats.streakRecord).toBe(10);
    });

    it("saves the lastPlayed date after each call", () => {
      saveProfile(makeProfile());
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.lastPlayed).toBeTruthy();
    });
  });

  // ── Time tracking ─────────────────────────────────────────────────────────

  describe("time tracking (timeSpent in seconds → totalTimeMinutes)", () => {
    it("converts seconds to minutes and adds to totalTimeMinutes", () => {
      saveProfile(makeProfile({ totalTimeMinutes: 10 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 120 }); // 2 min
      expect(loadProfile().stats.totalTimeMinutes).toBe(12);
    });

    it("rounds partial minutes (90 s → 2 min)", () => {
      saveProfile(makeProfile({ totalTimeMinutes: 0 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 90 }); // 1.5 → 2
      expect(loadProfile().stats.totalTimeMinutes).toBe(2);
    });

    it("rounds down partial minutes (89 s → 1 min)", () => {
      saveProfile(makeProfile({ totalTimeMinutes: 0 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 89 }); // 1.48 → 1
      expect(loadProfile().stats.totalTimeMinutes).toBe(1);
    });

    it("handles timeSpent = 0 without changing totalTimeMinutes", () => {
      saveProfile(makeProfile({ totalTimeMinutes: 5 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 0 });
      expect(loadProfile().stats.totalTimeMinutes).toBe(5);
    });

    it("accumulates time across multiple sessions", () => {
      saveProfile(makeProfile({ totalTimeMinutes: 0 }));
      updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 }); // +1
      updateProfileStats({ result: "giveup", mode: "Emoji", timeSpent: 180 }); // +3
      expect(loadProfile().stats.totalTimeMinutes).toBe(4);
    });
  });
});
