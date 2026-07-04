/**
 * profileFormat.test.js — Unit tests for profile/profile-format.js
 * (extracted from profile-page.js, where getStreakTier and formatSongTime
 * were also duplicated verbatim in profile-view.js).
 */

import { describe, it, expect } from "vitest";
import { getStreakTier, formatSongTime } from "../profile/profile-format.js";

describe("getStreakTier", () => {
  it("returns tier 0 for no streak", () => {
    expect(getStreakTier(0)).toBe(0);
  });

  it("returns the correct tier at each threshold boundary", () => {
    expect(getStreakTier(1)).toBe(1);
    expect(getStreakTier(2)).toBe(1);
    expect(getStreakTier(3)).toBe(2);
    expect(getStreakTier(6)).toBe(2);
    expect(getStreakTier(7)).toBe(3);
    expect(getStreakTier(13)).toBe(3);
    expect(getStreakTier(14)).toBe(4);
    expect(getStreakTier(29)).toBe(4);
    expect(getStreakTier(30)).toBe(5);
    expect(getStreakTier(365)).toBe(5);
  });
});

describe("formatSongTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatSongTime(65)).toBe("1:05");
    expect(formatSongTime(9)).toBe("0:09");
    expect(formatSongTime(600)).toBe("10:00");
  });

  it("returns 0:00 for negative or non-finite input", () => {
    expect(formatSongTime(-5)).toBe("0:00");
    expect(formatSongTime(NaN)).toBe("0:00");
    expect(formatSongTime(Infinity)).toBe("0:00");
  });
});
