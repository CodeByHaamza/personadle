/**
 * formatPlayTime.test.js — Tests du formatage du temps de jeu (profile/formatPlayTime.js).
 *
 * Fonction pure (hors lecture de localStorage "lang") : on verrouille les
 * frontières min → jour → semaine → mois → an et la pluralisation par langue.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { formatPlayTime } from "../profile/formatPlayTime.js";

const DAY = 1440;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("lang", "en");
});

describe("formatPlayTime — minutes", () => {
  it("shows raw minutes below one day", () => {
    expect(formatPlayTime(0)).toBe("0 min");
    expect(formatPlayTime(59)).toBe("59 min");
    expect(formatPlayTime(DAY - 1)).toBe(`${DAY - 1} min`);
  });

  it("clamps negative input to zero", () => {
    expect(formatPlayTime(-50)).toBe("0 min");
  });

  it("rounds to the nearest minute", () => {
    expect(formatPlayTime(0.4)).toBe("0 min");
    expect(formatPlayTime(1.6)).toBe("2 min");
  });
});

describe("formatPlayTime — days & hours", () => {
  it("formats an exact day without trailing hours", () => {
    expect(formatPlayTime(DAY)).toBe("1 day");
  });

  it("appends hours when present", () => {
    expect(formatPlayTime(DAY + 60)).toBe("1 day 1h");
  });

  it("pluralizes days beyond one", () => {
    expect(formatPlayTime(2 * DAY)).toBe("2 days");
  });
});

describe("formatPlayTime — weeks / months / years", () => {
  it("formats weeks, with days when present", () => {
    expect(formatPlayTime(WEEK)).toBe("1 week");
    expect(formatPlayTime(WEEK + DAY)).toBe("1 week 1 day");
  });

  it("formats months", () => {
    expect(formatPlayTime(MONTH)).toBe("1 month");
  });

  it("formats years", () => {
    expect(formatPlayTime(YEAR)).toBe("1 year");
  });
});

describe("formatPlayTime — localization", () => {
  it("uses French units when lang=fr", () => {
    localStorage.setItem("lang", "fr");
    expect(formatPlayTime(DAY)).toBe("1 jour");
    expect(formatPlayTime(2 * DAY)).toBe("2 jours");
  });

  it("falls back to English for an unknown language", () => {
    localStorage.setItem("lang", "jp");
    expect(formatPlayTime(DAY)).toBe("1 day");
  });
});
