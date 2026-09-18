/**
 * game_day_usecases.test.js — À quelle JOURNÉE appartient une partie ?
 *
 * Une partie est armée quand sa cible est tirée (checkResetOnLoad au chargement,
 * startGame au Replay ou au reset de minuit) et se termine plus tard. Les deux
 * moments tombent presque toujours le même jour Paris — sauf quand l'onglet
 * reste ouvert la nuit sur un téléphone en veille : le reset de minuit
 * (setTimeout) est retardé et le joueur finit le puzzle d'HIER à 00 h 05.
 *
 * Ce que le serveur doit alors recevoir : la partie d'hier, datée d'hier — il
 * l'accepte (aujourd'hui ou hier), l'anti-triche recalcule la cible d'hier, et
 * la journée d'hier est créditée. Puis le puzzle d'aujourd'hui compte pour
 * aujourd'hui. Datée du jour de fin, la même partie partait avec la cible
 * d'hier sous la date d'aujourd'hui.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkResetOnLoad,
  startGame,
  currentGameDay,
  buildGameSession,
  parisDateKey,
} from "../js/gameCore.js";

const SCOPE = "Classic";
const LAST_KEY = "lastPlayedDate_Classic";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("journée d'une partie — cas ordinaires", () => {
  it("armée et finie le même jour → datée de ce jour", () => {
    vi.setSystemTime(new Date("2026-06-16T10:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-06-16T23:30:00+02:00"));
    expect(currentGameDay(SCOPE)).toBe("2026-06-16");
    expect(buildGameSession({ mode: "classic", targetName: "Yu", result: "win", attempts: 3 }).played_date).toBe("2026-06-16");
  });

  it("Replay (startGame) réarme sur le jour courant", () => {
    vi.setSystemTime(new Date("2026-06-16T10:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-06-17T10:00:00+02:00"));
    startGame(SCOPE);
    expect(currentGameDay(SCOPE)).toBe("2026-06-17");
  });

  it("sans portée connue (page sans checkResetOnLoad) → aujourd'hui", () => {
    vi.setSystemTime(new Date("2026-06-16T10:00:00+02:00"));
    expect(currentGameDay(null)).toBe("2026-06-16");
  });
});

describe("onglet ouvert la nuit, reset de minuit pas encore passé", () => {
  it("le puzzle d'hier fini à 00 h 05 est daté d'HIER", () => {
    vi.setSystemTime(new Date("2026-06-16T22:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {}); // armé le 16
    vi.setSystemTime(new Date("2026-06-17T00:05:00+02:00")); // minuit passé, pas de reset
    expect(parisDateKey()).toBe("2026-06-17");
    const s = buildGameSession({ mode: "classic", targetName: "Yu", result: "win", attempts: 4 });
    expect(s.played_date).toBe("2026-06-16");
  });

  it("puis le reset (startGame) arrive : la partie suivante est datée d'aujourd'hui", () => {
    vi.setSystemTime(new Date("2026-06-16T22:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-06-17T00:05:00+02:00"));
    startGame(SCOPE); // ce que fait newRound(false) au reset
    expect(buildGameSession({ mode: "classic", targetName: "Ann", result: "win", attempts: 2 }).played_date).toBe("2026-06-17");
  });

  it("un rechargement après minuit détecte le nouveau jour et réarme sur aujourd'hui", () => {
    vi.setSystemTime(new Date("2026-06-16T22:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-06-17T00:05:00+02:00"));
    const onReset = vi.fn();
    checkResetOnLoad(LAST_KEY, SCOPE, onReset);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(currentGameDay(SCOPE)).toBe("2026-06-17");
  });

  it("la nuit du passage à l'heure d'été aussi : armée dimanche 29 à 23 h, finie lundi 30 à 00 h 30 → dimanche", () => {
    vi.setSystemTime(new Date("2026-03-29T23:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-03-30T00:30:00+02:00"));
    expect(currentGameDay(SCOPE)).toBe("2026-03-29");
  });
});

describe("garde-fous", () => {
  it("partie armée il y a DEUX jours (onglet oublié) → repli sur aujourd'hui, le serveur refuserait avant-hier", () => {
    vi.setSystemTime(new Date("2026-06-14T22:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-06-16T09:00:00+02:00"));
    expect(currentGameDay(SCOPE)).toBe("2026-06-16");
  });

  it("partie armée par une version sans clé de journée (même jour) → aujourd'hui, et la clé est posée", () => {
    vi.setSystemTime(new Date("2026-06-16T10:00:00+02:00"));
    localStorage.setItem(LAST_KEY, "2026-06-16");
    localStorage.setItem("gameId_Classic", "ancien-id");
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    expect(localStorage.getItem("gameDay_Classic")).toBe("2026-06-16");
    expect(currentGameDay(SCOPE)).toBe("2026-06-16");
  });

  it("chaque portée a sa journée : l'Expert armé aujourd'hui n'entraîne pas le normal armé hier", () => {
    vi.setSystemTime(new Date("2026-06-16T22:00:00+02:00"));
    checkResetOnLoad(LAST_KEY, SCOPE, () => {});
    vi.setSystemTime(new Date("2026-06-17T00:05:00+02:00"));
    checkResetOnLoad("lastPlayedDate_Classic_expert", "ClassicExpert", () => {});
    expect(currentGameDay("ClassicExpert")).toBe("2026-06-17");
    expect(currentGameDay(SCOPE)).toBe("2026-06-16");
  });

  it("la journée envoyée est toujours acceptable par le serveur : aujourd'hui ou hier, jamais plus vieux", () => {
    for (const armedAt of ["2026-06-16T22:00:00+02:00", "2026-06-15T22:00:00+02:00", "2026-06-10T22:00:00+02:00"]) {
      localStorage.clear();
      vi.setSystemTime(new Date(armedAt));
      startGame(SCOPE);
      vi.setSystemTime(new Date("2026-06-17T00:05:00+02:00"));
      expect(["2026-06-17", "2026-06-16"]).toContain(currentGameDay(SCOPE));
    }
  });
});
