/**
 * daily_status.test.js — js/daily_status.js (pastilles « joué aujourd'hui »).
 *
 * Le piège : chaque mode passe SA portée de stats à markGameLogged(), et il n'y a
 * pas de règle commune (« silhouette » en minuscules, « AllOut »). Une portée
 * mal recopiée ici = une pastille qui ne s'allume jamais, sans aucune erreur.
 * D'où le dernier bloc, qui relit les fichiers de mode.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODE_STATS_SCOPE,
  dailyDoneKey,
  dailyProgress,
  isModeDoneToday,
} from "../js/daily_status.js";
import { markGameLogged, startGame, parisDateKey } from "../js/gameCore.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const today = "2026-10-20";

beforeEach(() => localStorage.clear());

describe("isModeDoneToday", () => {
  it("is false when nothing was played", () => {
    expect(isModeDoneToday("classic", { today })).toBe(false);
  });

  it("reads the dailyDone_<scope> trace for today", () => {
    localStorage.setItem(dailyDoneKey("Classic"), today);
    expect(isModeDoneToday("classic", { today })).toBe(true);
  });

  it("ignores yesterday's trace", () => {
    localStorage.setItem(dailyDoneKey("Classic"), "2026-10-19");
    expect(isModeDoneToday("classic", { today })).toBe(false);
  });

  it("falls back on a game armed today and already logged (games from before the trace)", () => {
    localStorage.setItem("gameId_Emoji", "abc");
    localStorage.setItem("gameDay_Emoji", today);
    localStorage.setItem("gameLogged_Emoji", "abc");
    expect(isModeDoneToday("emoji", { today })).toBe(true);
  });

  it("does not count a game armed today but not finished", () => {
    localStorage.setItem("gameId_Emoji", "abc");
    localStorage.setItem("gameDay_Emoji", today);
    expect(isModeDoneToday("emoji", { today })).toBe(false);
  });

  it("uses the mode's real scope (silhouette is lowercase, All-Out Attack is AllOut)", () => {
    localStorage.setItem(dailyDoneKey("silhouette"), today);
    localStorage.setItem(dailyDoneKey("AllOut"), today);
    expect(isModeDoneToday("silhouette", { today })).toBe(true);
    expect(isModeDoneToday("alloutattack", { today })).toBe(true);
  });

  it("does not count an Expert game as the mode of the day", () => {
    localStorage.setItem(dailyDoneKey("ClassicExpert"), today);
    expect(isModeDoneToday("classic", { today })).toBe(false);
  });

  it("returns false for an unknown mode", () => {
    expect(isModeDoneToday("tetris", { today })).toBe(false);
  });
});

describe("dailyProgress", () => {
  it("counts the modes played today, in MODES order", () => {
    localStorage.setItem(dailyDoneKey("Classic"), today);
    localStorage.setItem(dailyDoneKey("Music"), today);
    const p = dailyProgress({ today });
    expect(p.total).toBe(6);
    expect(p.done).toBe(2);
    expect(p.modes.map((m) => m.key)).toEqual([
      "classic",
      "emoji",
      "silhouette",
      "alloutattack",
      "personae",
      "music",
    ]);
    expect(p.modes.filter((m) => m.done).map((m) => m.key)).toEqual(["classic", "music"]);
  });
});

describe("markGameLogged writes the trace, and Replay keeps it", () => {
  it("marks the mode as played today and survives startGame()", () => {
    startGame("Classic");
    markGameLogged("Classic");
    expect(localStorage.getItem(dailyDoneKey("Classic"))).toBe(parisDateKey());
    startGame("Classic"); // Replay : gameLogged_* est effacé, pas la trace
    expect(isModeDoneToday("classic")).toBe(true);
  });
});

describe("MODE_STATS_SCOPE matches what each mode really logs", () => {
  const FILES = {
    classic: "classiqueMode/modeClassique.js",
    emoji: "emojiMode/emojiMode.js",
    silhouette: "silhouetteMode/modeSilhouette.js",
    alloutattack: "allOutAttackMode/modeAllOutAttack.js",
    personae: "personaeMode/modePersonae.js",
    music: "musicsMode/modeMusic.js",
  };

  for (const [key, file] of Object.entries(FILES)) {
    it(`${key} → "${MODE_STATS_SCOPE[key]}"`, () => {
      const src = readFileSync(join(ROOT, file), "utf8");
      const scope = MODE_STATS_SCOPE[key];
      // La portée apparaît soit en statsKey littéral, soit via `const modeName = "…"`.
      const literal = new RegExp(`statsKey:\\s*"${scope}"|const modeName = "${scope}"`);
      expect(src).toMatch(literal);
    });
  }
});
