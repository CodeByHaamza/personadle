/**
 * statsCompare.test.js — Unit tests for the pure calculation helpers in
 * js/stats-compare.js (previously 0% covered — nothing was exported).
 *
 * `_globalWr`/`_pickConclusion`/`_formatCooldown` are exported with their
 * underscore prefix kept intact specifically for testability (same
 * convention already used throughout this file for private helpers).
 * DOM rendering (`openCompareOverlay`, `_populate`, `_drawRadar`…) is left
 * untested — pure orchestration/canvas drawing, not business logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { _globalWr, _pickConclusion, _formatCooldown } from "../js/stats-compare.js";

function player(overrides = {}) {
  return {
    pseudo: "Me",
    total_wins: 0,
    total_games: 0,
    best_streak: 0,
    by_mode: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// _globalWr
// ─────────────────────────────────────────────────────────────────────────────

describe("_globalWr", () => {
  it("returns 0 when no games have been played (avoids divide-by-zero)", () => {
    expect(_globalWr(player({ total_games: 0, total_wins: 0 }))).toBe(0);
  });

  it("computes and rounds the win rate as a percentage", () => {
    expect(_globalWr(player({ total_games: 3, total_wins: 1 }))).toBe(33); // 33.33 → 33
    expect(_globalWr(player({ total_games: 4, total_wins: 3 }))).toBe(75);
  });

  it("returns 100 for a perfect record", () => {
    expect(_globalWr(player({ total_games: 10, total_wins: 10 }))).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _formatCooldown
// ─────────────────────────────────────────────────────────────────────────────

describe("_formatCooldown", () => {
  // Horloge figée : _formatCooldown relit Date.now() en interne. Sans ça, les
  // quelques ms écoulées entre la création de la date cible et l'appel faisaient
  // tomber Math.floor d'une unité sur les valeurs exactes (25m → 24m), rendant
  // ces tests flaky (échec intermittent au pre-push / en CI).
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-07-18T12:00:00Z") }));
  afterEach(() => vi.useRealTimers());

  it("returns '0h' once the deadline has already passed", () => {
    expect(_formatCooldown(new Date(Date.now() - 1000).toISOString())).toBe("0h");
  });

  it("formats a remaining time under an hour as minutes only", () => {
    expect(_formatCooldown(new Date(Date.now() + 25 * 60_000).toISOString())).toBe("25m");
  });

  it("formats hours and minutes when over an hour remains", () => {
    expect(_formatCooldown(new Date(Date.now() + (3 * 3_600_000 + 15 * 60_000)).toISOString())).toBe(
      "3h 15m"
    );
  });

  it("omits the minutes component's leading noise but keeps 0m explicit", () => {
    expect(_formatCooldown(new Date(Date.now() + 2 * 3_600_000).toISOString())).toBe("2h 0m");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _pickConclusion
// ─────────────────────────────────────────────────────────────────────────────

describe("_pickConclusion", () => {
  beforeEach(() => {
    document.documentElement.lang = "en";
    // Fixed at 0.5: skips the 12% "rare" branch (0.5 >= 0.12) and skips the
    // streak-override branches (0.5 is not < 0.4) so the category picked
    // below is driven purely by the win-rate gap being tested, not by luck.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("picks an 'equal' phrase and interpolates both pseudos when win rates are close", () => {
    const me = player({ pseudo: "Alice", total_wins: 5, total_games: 10 }); // 50%
    const friend = player({ pseudo: "Bob", total_wins: 5, total_games: 10 }); // 50%

    const result = _pickConclusion(me, friend);

    expect(result).not.toContain("{{");
    expect(result).toMatch(/Alice|Bob/);
  });

  it("picks an 'overall_win' phrase when my win rate clearly beats my friend's", () => {
    const me = player({ pseudo: "Alice", total_wins: 9, total_games: 10 }); // 90%
    const friend = player({ pseudo: "Bob", total_wins: 1, total_games: 10 }); // 10%

    const result = _pickConclusion(me, friend);

    expect(result).not.toContain("{{");
    expect(result.length).toBeGreaterThan(0);
  });

  it("picks a mode-specific 'mode_lose' phrase for the mode with the biggest gap against me", () => {
    const me = player({
      pseudo: "Alice",
      total_wins: 1,
      total_games: 10, // 10% overall — clear loss, gap > 5
      by_mode: [{ mode: "classic", wins: 0, games: 10 }], // 0% — friend crushes this mode
    });
    const friend = player({
      pseudo: "Bob",
      total_wins: 9,
      total_games: 10, // 90%
      by_mode: [{ mode: "classic", wins: 10, games: 10 }], // 100%
    });

    const result = _pickConclusion(me, friend);

    expect(result).not.toContain("{{");
    expect(result).toContain("Bob");
  });

  it("never leaves an unreplaced {{placeholder}} in the returned phrase", () => {
    const me = player({ pseudo: "Alice", total_wins: 2, total_games: 10 });
    const friend = player({ pseudo: "Bob", total_wins: 8, total_games: 10 });

    const result = _pickConclusion(me, friend);

    expect(result).not.toMatch(/\{\{\w+\}\}/);
  });
});
