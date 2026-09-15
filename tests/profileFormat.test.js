/**
 * profileFormat.test.js — Unit tests for profile/profile-format.js
 * (extracted from profile-page.js, where getStreakTier and formatSongTime
 * were also duplicated verbatim in profile-view.js).
 */

import { describe, it, expect } from "vitest";
import { getStreakTier, formatSongTime, bestModeOverall } from "../profile/profile-format.js";

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

describe("bestModeOverall", () => {
  const e = (mode, games, wins) => ({ mode, games, wins });

  it("retourne le mode au meilleur taux de victoire", () => {
    const best = bestModeOverall([e("classic", 10, 5), e("music", 4, 4), e("emoji", 8, 7)]);
    expect(best.mode).toBe("music");
    expect(best.rate).toBe(1);
  });

  it("ignore les modes sous le plancher de parties — un 1/1 ne fait pas 100 %", () => {
    const best = bestModeOverall([e("classic", 10, 8), e("music", 1, 1), e("emoji", 2, 2)]);
    expect(best.mode).toBe("classic");
  });

  it("à taux égal, le plus joué l'emporte", () => {
    const best = bestModeOverall([e("classic", 4, 2), e("music", 10, 5)]);
    expect(best.mode).toBe("music");
    expect(best.games).toBe(10);
  });

  it("null quand aucun mode n'atteint le plancher, ou sans données", () => {
    expect(bestModeOverall([e("classic", 2, 2)])).toBeNull();
    expect(bestModeOverall([])).toBeNull();
    expect(bestModeOverall(undefined)).toBeNull();
  });

  it("le plancher est paramétrable", () => {
    expect(bestModeOverall([e("classic", 2, 2)], 1).mode).toBe("classic");
  });

  it("tolère des compteurs absents ou non numériques", () => {
    expect(bestModeOverall([{ mode: "classic" }, e("music", 3, "2")]).mode).toBe("music");
  });
});
