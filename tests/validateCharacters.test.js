/**
 * validateCharacters.test.js — Tests du validateur de données personnages.
 *
 * Le validateur prend un tableau de personnages (+ une portraitsMap) et renvoie
 * une liste d'erreurs lisibles. Zéro erreur = données conformes au schéma.
 */

import { describe, it, expect } from "vitest";
import {
  validateCharacters,
  VALID_OPUS,
  VALID_ARCANA,
  VALID_AGES,
} from "../scripts/validate_characters.js";

/** Personnage minimal valide, surchargeable champ par champ. */
function makeChar(overrides = {}) {
  return {
    nom: "Joker",
    genre: ["Human", "Male"],
    age: "15-20",
    arcane: ["Fool"],
    opus: ["P5", "P5R"],
    personaUser: true,
    persona: "Arsene",
    emoji: ["🎭", "🔫"],
    quote: "You'll never see it coming.",
    ...overrides,
  };
}

const portraits = { Joker: "Joker", Mona: "Mona" };

describe("validateCharacters", () => {
  it("returns no error and no warning for a fully valid character", () => {
    expect(validateCharacters([makeChar()], portraits)).toEqual({ errors: [], warnings: [] });
  });

  it("flags a missing or empty structural string field as an error", () => {
    const { errors } = validateCharacters([makeChar({ age: "" })], portraits);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/age/);
  });

  it("treats an empty quote as a warning, not an error", () => {
    const { errors, warnings } = validateCharacters([makeChar({ quote: "" })], portraits);
    expect(errors).toEqual([]);
    expect(warnings.join()).toMatch(/quote/);
  });

  it("flags an empty required array field as an error", () => {
    const { errors } = validateCharacters([makeChar({ emoji: [] })], portraits);
    expect(errors.join()).toMatch(/emoji/);
  });

  it("flags a non-array where an array is required", () => {
    const { errors } = validateCharacters([makeChar({ genre: "Human" })], portraits);
    expect(errors.join()).toMatch(/genre/);
  });

  it("flags an unknown opus code", () => {
    const { errors } = validateCharacters([makeChar({ opus: ["P5", "P9000"] })], portraits);
    expect(errors.join()).toMatch(/P9000/);
  });

  it("accepts every code listed in VALID_OPUS", () => {
    const { errors } = validateCharacters([makeChar({ opus: [...VALID_OPUS] })], portraits);
    expect(errors).toEqual([]);
  });

  it("accepts the Dancing spin-off codes (P3D/P4D/P5D)", () => {
    const { errors } = validateCharacters([makeChar({ opus: ["P4D"] })], portraits);
    expect(errors).toEqual([]);
  });

  it("flags personaUser:true without a persona name", () => {
    const { errors } = validateCharacters(
      [makeChar({ personaUser: true, persona: "" })],
      portraits
    );
    expect(errors.join()).toMatch(/persona/i);
  });

  it("flags a non-boolean personaUser", () => {
    const { errors } = validateCharacters([makeChar({ personaUser: "yes" })], portraits);
    expect(errors.join()).toMatch(/personaUser/);
  });

  it("flags duplicate names", () => {
    const { errors } = validateCharacters([makeChar(), makeChar()], portraits);
    expect(errors.join()).toMatch(/doublon|duplicate/i);
  });

  it("flags a character absent from portraitsMap", () => {
    const { errors } = validateCharacters([makeChar({ nom: "Ghost" })], { Joker: "Joker" });
    expect(errors.join()).toMatch(/portrait/i);
  });

  it("reports the character name in every message", () => {
    const { errors } = validateCharacters([makeChar({ nom: "Yusuke", age: "" })], {
      Yusuke: "Yusuke",
    });
    expect(errors[0]).toMatch(/Yusuke/);
  });
});

describe("validateCharacters — age buckets", () => {
  it("accepts every canonical age bucket", () => {
    for (const age of VALID_AGES) {
      const { errors } = validateCharacters([makeChar({ age })], portraits);
      expect(errors.filter((e) => /age/i.test(e))).toEqual([]);
    }
  });

  it("flags an off-bucket age like '15-16' as an error", () => {
    const { errors } = validateCharacters([makeChar({ age: "15-16" })], portraits);
    expect(errors.join()).toMatch(/age/i);
    expect(errors.join()).toMatch(/15-16/);
  });
});

describe("validateCharacters — arcane", () => {
  it("accepts every canonical arcana without warning", () => {
    const { warnings } = validateCharacters([makeChar({ arcane: [...VALID_ARCANA] })], portraits);
    expect(warnings.filter((w) => /arcane/i.test(w))).toEqual([]);
  });

  it("warns on a non-canonical arcana spelling", () => {
    const { warnings } = validateCharacters([makeChar({ arcane: ["Hanged"] })], portraits);
    expect(warnings.join()).toMatch(/arcane/i);
    expect(warnings.join()).toMatch(/Hanged/);
  });
});

describe("validateCharacters — emoji duplicates", () => {
  it("warns when the same emoji appears twice for a character", () => {
    const { warnings } = validateCharacters([makeChar({ emoji: ["🎭", "🎭"] })], portraits);
    expect(warnings.join()).toMatch(/emoji/);
  });

  it("does not warn for distinct emojis", () => {
    const { warnings } = validateCharacters([makeChar({ emoji: ["🎭", "🔫", "🌀"] })], portraits);
    expect(warnings.filter((w) => /emoji/.test(w))).toEqual([]);
  });
});

describe("validateCharacters — portrait on disk", () => {
  it("is an error when the portrait identifier has no file on disk", () => {
    const { errors } = validateCharacters(
      [makeChar({ nom: "Joker" })],
      { Joker: "Joker" },
      new Set(["SomeoneElse"])
    );
    expect(errors.join()).toMatch(/disque|introuvable/i);
  });

  it("passes when the portrait file is present on disk", () => {
    const { errors } = validateCharacters(
      [makeChar({ nom: "Joker" })],
      { Joker: "Joker" },
      new Set(["Joker"])
    );
    expect(errors).toEqual([]);
  });

  it("skips the disk check when no file set is provided", () => {
    const { errors } = validateCharacters([makeChar({ nom: "Joker" })], { Joker: "Joker" });
    expect(errors).toEqual([]);
  });
});
