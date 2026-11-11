/**
 * rank_delta.test.js — ▲▼ depuis la dernière visite (profile/leaderboard/rank_delta.js),
 * 2.4 lot 15.
 *
 * Ce qui compte : une référence par vue (et par jour / semaine / mois pour les
 * périodes bornées), gardée 12 h pour qu'un rechargement n'efface pas les flèches,
 * jamais remplacée par une page partielle, et des pastilles justes.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  BASELINE_TTL_MS,
  deltaBadge,
  periodInstance,
  rankDelta,
  takeBaseline,
  viewKey,
} from "../profile/leaderboard/rank_delta.js";

const VIEW = { expert: false, mode: "all", period: "ever", metric: "wins", friendsOnly: false };

beforeEach(() => localStorage.clear());

describe("periodInstance + viewKey", () => {
  it("bounded periods only compare with themselves", () => {
    expect(periodInstance("day", "2026-11-11")).toBe("2026-11-11");
    expect(periodInstance("month", "2026-11-11")).toBe("2026-11");
    expect(periodInstance("week", "2026-11-11")).toBe("2026-11-09"); // mercredi → lundi
    expect(periodInstance("week", "2026-11-09")).toBe("2026-11-09");
    expect(periodInstance("week", "2026-11-15")).toBe("2026-11-09"); // dimanche
    expect(periodInstance("ever", "2026-11-11")).toBe("ever");
  });

  it("every filter splits the views", () => {
    const k = viewKey(VIEW, "2026-11-11");
    expect(viewKey({ ...VIEW, expert: true }, "2026-11-11")).not.toBe(k);
    expect(viewKey({ ...VIEW, friendsOnly: true }, "2026-11-11")).not.toBe(k);
    expect(viewKey({ ...VIEW, metric: "streak" }, "2026-11-11")).not.toBe(k);
    expect(viewKey({ ...VIEW, period: "day" }, "2026-11-11")).not.toBe(
      viewKey({ ...VIEW, period: "day" }, "2026-11-12")
    );
  });
});

describe("takeBaseline", () => {
  const key = viewKey(VIEW, "2026-11-11");

  it("first visit: no arrows, the ranks become the reference", () => {
    expect(takeBaseline(key, [{ user_id: 1, rank: 1 }], { now: 1_000 })).toBeNull();
    const again = takeBaseline(key, [{ user_id: 1, rank: 4 }], { now: 2_000 });
    expect(rankDelta(again, 1, 4)).toBe(-3);
  });

  it("the reference survives reloads for 12 h, then rotates", () => {
    takeBaseline(key, [{ user_id: 7, rank: 10 }], { now: 0 });
    // Rechargement une heure après : on compare toujours à 10.
    expect(rankDelta(takeBaseline(key, [{ user_id: 7, rank: 6 }], { now: 3_600_000 }), 7, 6)).toBe(
      4
    );
    expect(rankDelta(takeBaseline(key, [{ user_id: 7, rank: 5 }], { now: 7_200_000 }), 7, 5)).toBe(
      5
    );
    // Périmée : plus de flèches, et la référence devient le classement actuel.
    expect(takeBaseline(key, [{ user_id: 7, rank: 5 }], { now: BASELINE_TTL_MS })).toBeNull();
    expect(
      rankDelta(takeBaseline(key, [{ user_id: 7, rank: 2 }], { now: BASELINE_TTL_MS + 1 }), 7, 2)
    ).toBe(3);
  });

  it("a later page never becomes the reference", () => {
    takeBaseline(key, [{ user_id: 99, rank: 60 }], { now: 0, write: false });
    expect(takeBaseline(key, [{ user_id: 1, rank: 1 }], { now: 10 })).toBeNull();
  });
});

describe("rankDelta + deltaBadge", () => {
  it("only compares players present in the reference", () => {
    const b = { at: 0, ranks: { 1: 5 } };
    expect(rankDelta(b, 1, 2)).toBe(3);
    expect(rankDelta(b, 2, 2)).toBeNull();
    expect(rankDelta(null, 1, 2)).toBeNull();
  });

  it("draws ▲ for a climb, ▼ for a drop, nothing when unchanged", () => {
    expect(deltaBadge(3)).toContain("▲3");
    expect(deltaBadge(3)).toContain("lb-delta--up");
    expect(deltaBadge(-2)).toContain("▼2");
    expect(deltaBadge(0)).toBe("");
    expect(deltaBadge(null)).toBe("");
  });
});
