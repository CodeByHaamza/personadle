/**
 * modeComparisons.test.js — Unit tests for the Wordle-style attribute
 * comparison logic in classiqueMode/modeClassique.js.
 *
 * Note: Classic is the only one of the 6 game modes with a multi-attribute
 * comparison grid (age arrows, array intersections for persona/arcane/opus…).
 * The other 5 modes (Emoji, Silhouette, Personae, Music, All-Out Attack) use
 * a simple exact-name-match guess with a mode-specific reveal mechanic
 * (progressive emoji, image zoom, audio snippet, GIF) — no comparable
 * per-attribute logic exists there to extract.
 */

import { describe, it, expect } from "vitest";
import { compareAttribute, convertAgeToValue } from "../classiqueMode/modeClassique.js";

// ─────────────────────────────────────────────────────────────────────────────
// convertAgeToValue
// ─────────────────────────────────────────────────────────────────────────────

describe("convertAgeToValue", () => {
  it("maps each known age bracket to its expected midpoint", () => {
    expect(convertAgeToValue("< 15")).toBe(10);
    expect(convertAgeToValue("15-20")).toBe(17.5);
    expect(convertAgeToValue("21-40")).toBe(30);
    expect(convertAgeToValue("40+")).toBe(50);
    expect(convertAgeToValue("80+")).toBe(85);
  });

  it("returns -1 for an unknown bracket", () => {
    expect(convertAgeToValue("unknown")).toBe(-1);
    expect(convertAgeToValue(undefined)).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compareAttribute — age (arrow logic)
// ─────────────────────────────────────────────────────────────────────────────

describe("compareAttribute — age", () => {
  it("is correct when the age bracket matches exactly", () => {
    expect(compareAttribute("age", "21-40", "21-40")).toEqual({ status: "correct", arrow: null });
  });

  it("points up when the guess is younger than the target", () => {
    expect(compareAttribute("age", "15-20", "40+")).toEqual({ status: "misplaced", arrow: "up" });
  });

  it("points down when the guess is older than the target", () => {
    expect(compareAttribute("age", "80+", "< 15")).toEqual({ status: "misplaced", arrow: "down" });
  });

  it("is wrong (no arrow) when either bracket is unrecognized", () => {
    expect(compareAttribute("age", "unknown", "21-40")).toEqual({ status: "wrong", arrow: null });
    expect(compareAttribute("age", "21-40", "unknown")).toEqual({ status: "wrong", arrow: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compareAttribute — booleans
// ─────────────────────────────────────────────────────────────────────────────

describe("compareAttribute — boolean fields", () => {
  it("is correct when both booleans match", () => {
    expect(compareAttribute("isDead", true, true)).toEqual({ status: "correct", arrow: null });
    expect(compareAttribute("isDead", false, false)).toEqual({ status: "correct", arrow: null });
  });

  it("is wrong when booleans differ", () => {
    expect(compareAttribute("isDead", true, false)).toEqual({ status: "wrong", arrow: null });
  });

  it("treats a boolean vs non-boolean mismatch as wrong (not a crash)", () => {
    expect(compareAttribute("isDead", true, "maybe")).toEqual({ status: "wrong", arrow: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compareAttribute — array fields (persona, arcane, opus…)
// ─────────────────────────────────────────────────────────────────────────────

describe("compareAttribute — array fields", () => {
  it("is correct when guess and target arrays match exactly (same set)", () => {
    expect(compareAttribute("arcane", ["Fool", "Magician"], ["Fool", "Magician"])).toEqual({
      status: "correct",
      arrow: null,
    });
  });

  it("is misplaced when there is a partial overlap", () => {
    expect(compareAttribute("arcane", ["Fool"], ["Fool", "Magician"])).toEqual({
      status: "misplaced",
      arrow: null,
    });
  });

  it("is misplaced (not correct) when guess has extra values beyond the target set", () => {
    expect(compareAttribute("arcane", ["Fool", "Magician", "Tower"], ["Fool", "Magician"])).toEqual(
      { status: "misplaced", arrow: null }
    );
  });

  it("is wrong when there is no overlap at all", () => {
    expect(compareAttribute("arcane", ["Tower"], ["Fool", "Magician"])).toEqual({
      status: "wrong",
      arrow: null,
    });
  });

  it("wraps a scalar guess into an array before comparing against a target array", () => {
    expect(compareAttribute("arcane", "Fool", ["Fool"])).toEqual({ status: "correct", arrow: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// compareAttribute — plain string fields (nom, opus as scalar, …)
// ─────────────────────────────────────────────────────────────────────────────

describe("compareAttribute — string fields", () => {
  it("is correct on an exact case-insensitive match", () => {
    expect(compareAttribute("nom", "Joker", "JOKER")).toEqual({ status: "correct", arrow: null });
  });

  it("is wrong when strings differ", () => {
    expect(compareAttribute("nom", "Ryuji", "Joker")).toEqual({ status: "wrong", arrow: null });
  });

  it("is wrong when either side is not a string (defensive — no crash)", () => {
    expect(compareAttribute("nom", null, "Joker")).toEqual({ status: "wrong", arrow: null });
    expect(compareAttribute("nom", "Joker", undefined)).toEqual({ status: "wrong", arrow: null });
  });
});
