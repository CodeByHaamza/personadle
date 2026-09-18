/**
 * streak_usecases.test.js — Cas d'usage de la streak CLIENT (profile/profileStats.js),
 * à la frontière de journée Paris, sur toute l'année.
 *
 * Pourquoi cette suite à part de profileStats.test.js : celle-ci teste la logique
 * en jours « génériques » (hier = now − 24 h). Ici on joue les vrais moments où la
 * journée Paris ne fait PAS 24 heures — passage à l'heure d'été (23 h), à l'heure
 * d'hiver (25 h) — et les minutes qui encadrent minuit Paris, pour les deux sens
 * de décalage avec UTC. C'est là que « hier » se calcule mal.
 *
 * Chaque cas est écrit du point de vue du joueur : « j'ai joué hier, je rejoue
 * aujourd'hui → ma série continue ». Rien d'autre n'a le droit de la casser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { updateProfileStats } from "../profile/profileStats.js";
import { parisDateKey } from "../js/gameCore.js";

function saveProfile(stats) {
  localStorage.setItem(
    "personaUserProfile",
    JSON.stringify({ pseudo: "Joker", stats: { games: 0, wins: 0, streak: 0, streakRecord: 0, ...stats } })
  );
}
const stats = () => JSON.parse(localStorage.getItem("personaUserProfile")).stats;
const recovery = () => JSON.parse(localStorage.getItem("streakRecovery") || "null");

/** Joue une victoire « maintenant » (heure système truquée). */
function playNow(mode = "Classic") {
  updateProfileStats({ result: "win", mode, timeSpent: 0 });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Passage à l'heure d'été — la journée du dimanche fait 23 h
// 2026 : dimanche 29 mars, 02:00 CET → 03:00 CEST (01:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────
describe("heure d'été (journée de 23 h) — 29 mars 2026", () => {
  it("joué samedi 28, rejoue dimanche 29 au matin → série continue", () => {
    vi.setSystemTime(new Date("2026-03-29T08:00:00+02:00"));
    saveProfile({ streak: 4, lastPlayed: "2026-03-28T20:00:00+01:00" });
    playNow();
    expect(stats().streak).toBe(5);
  });

  it("joué dimanche 29 (jour du changement), rejoue lundi 30 à 00:30 Paris → série continue", () => {
    // Le piège : 00:30 CEST lundi = 22:30 UTC dimanche ; moins 24 h = 22:30 UTC
    // samedi = 23:30 CET samedi → « hier » sortirait comme samedi 28 alors que
    // c'est dimanche 29. Le joueur a joué tous les jours : rien ne doit casser.
    vi.setSystemTime(new Date("2026-03-30T00:30:00+02:00"));
    saveProfile({ streak: 4, lastPlayed: "2026-03-29T12:00:00+02:00" });
    playNow();
    expect(stats().streak).toBe(5);
    expect(recovery()).toBeNull(); // et surtout : pas de fausse « série perdue »
  });

  it("joué dimanche 29, rejoue lundi 30 à 00:59 Paris (dernière minute du piège) → continue", () => {
    vi.setSystemTime(new Date("2026-03-30T00:59:59+02:00"));
    saveProfile({ streak: 9, lastPlayed: "2026-03-29T23:59:00+02:00" });
    playNow();
    expect(stats().streak).toBe(10);
  });

  it("joué dimanche 29, rejoue lundi 30 à 01:00 Paris (hors piège) → continue aussi", () => {
    vi.setSystemTime(new Date("2026-03-30T01:00:00+02:00"));
    saveProfile({ streak: 9, lastPlayed: "2026-03-29T10:00:00+02:00" });
    playNow();
    expect(stats().streak).toBe(10);
  });

  it("joué samedi 28, rejoue LUNDI 30 (dimanche sauté) → série cassée, sans exception", () => {
    vi.setSystemTime(new Date("2026-03-30T00:30:00+02:00"));
    saveProfile({ streak: 4, lastPlayed: "2026-03-28T20:00:00+01:00" });
    playNow();
    expect(stats().streak).toBe(1);
    expect(recovery()?.previousStreak).toBe(4);
  });

  it("joue dimanche 29 à 01:59 CET puis à 03:01 CEST (une minute « plus tard ») → même jour", () => {
    vi.setSystemTime(new Date("2026-03-29T01:59:00+01:00"));
    saveProfile({ streak: 2, lastPlayed: "2026-03-28T12:00:00+01:00" });
    playNow();
    expect(stats().streak).toBe(3);
    vi.setSystemTime(new Date("2026-03-29T03:01:00+02:00"));
    playNow();
    expect(stats().streak).toBe(3); // toujours dimanche
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passage à l'heure d'hiver — la journée du dimanche fait 25 h
// 2026 : dimanche 25 octobre, 03:00 CEST → 02:00 CET (01:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────
describe("heure d'hiver (journée de 25 h) — 25 octobre 2026", () => {
  it("joué samedi 24, rejoue dimanche 25 à 00:30 CEST → continue", () => {
    vi.setSystemTime(new Date("2026-10-25T00:30:00+02:00"));
    saveProfile({ streak: 6, lastPlayed: "2026-10-24T18:00:00+02:00" });
    playNow();
    expect(stats().streak).toBe(7);
  });

  it("joué dimanche 25 à 02:30 (heure répétée, 1re fois CEST), rejoue à 02:30 CET → même jour", () => {
    vi.setSystemTime(new Date("2026-10-25T02:30:00+02:00"));
    saveProfile({ streak: 6, lastPlayed: "2026-10-24T18:00:00+02:00" });
    playNow();
    expect(stats().streak).toBe(7);
    vi.setSystemTime(new Date("2026-10-25T02:30:00+01:00")); // une heure plus tard, même affichage
    playNow();
    expect(stats().streak).toBe(7);
  });

  it("joué dimanche 25, rejoue lundi 26 à 00:30 CET → continue", () => {
    vi.setSystemTime(new Date("2026-10-26T00:30:00+01:00"));
    saveProfile({ streak: 6, lastPlayed: "2026-10-25T23:00:00+01:00" });
    playNow();
    expect(stats().streak).toBe(7);
  });

  it("joué dimanche 25, rejoue lundi 26 à 23:30 CET → continue", () => {
    vi.setSystemTime(new Date("2026-10-26T23:30:00+01:00"));
    saveProfile({ streak: 6, lastPlayed: "2026-10-25T01:00:00+02:00" });
    playNow();
    expect(stats().streak).toBe(7);
  });

  it("joué samedi 24, rejoue lundi 26 (dimanche de 25 h sauté) → cassée", () => {
    vi.setSystemTime(new Date("2026-10-26T12:00:00+01:00"));
    saveProfile({ streak: 6, lastPlayed: "2026-10-24T18:00:00+02:00" });
    playNow();
    expect(stats().streak).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Minuit Paris ≠ minuit UTC — le joueur peut être n'importe où dans le monde,
// la journée est TOUJOURS celle de Paris.
// ─────────────────────────────────────────────────────────────────────────────
describe("frontière de minuit Paris, été (UTC+2) et hiver (UTC+1)", () => {
  it("été : joue à 23:59 Paris puis 00:01 Paris → deux jours distincts, série +1", () => {
    vi.setSystemTime(new Date("2026-07-10T23:59:00+02:00"));
    saveProfile({ streak: 0 });
    playNow();
    expect(stats().streak).toBe(1);
    vi.setSystemTime(new Date("2026-07-11T00:01:00+02:00"));
    playNow();
    expect(stats().streak).toBe(2);
  });

  it("été : 22:30 UTC = 00:30 Paris le lendemain → nouveau jour Paris (pas encore en UTC)", () => {
    vi.setSystemTime(new Date("2026-07-10T22:30:00Z")); // 11 juillet 00:30 Paris
    saveProfile({ streak: 3, lastPlayed: "2026-07-10T10:00:00Z" });
    playNow();
    expect(stats().streak).toBe(4);
    expect(parisDateKey()).toBe("2026-07-11");
  });

  it("hiver : 23:30 UTC = 00:30 Paris le lendemain → nouveau jour Paris", () => {
    vi.setSystemTime(new Date("2026-01-10T23:30:00Z")); // 11 janvier 00:30 Paris
    saveProfile({ streak: 3, lastPlayed: "2026-01-10T10:00:00Z" });
    playNow();
    expect(stats().streak).toBe(4);
  });

  it("hiver : 22:30 UTC = 23:30 Paris → même jour, série inchangée", () => {
    vi.setSystemTime(new Date("2026-01-10T22:30:00Z"));
    saveProfile({ streak: 3, lastPlayed: "2026-01-10T10:00:00Z" });
    playNow();
    expect(stats().streak).toBe(3);
  });

  it("lastPlayed enregistré à 23:59 Paris hier, on rejoue à 00:00 Paris pile → +1", () => {
    vi.setSystemTime(new Date("2026-05-02T00:00:00+02:00"));
    saveProfile({ streak: 1, lastPlayed: "2026-05-01T23:59:59+02:00" });
    playNow();
    expect(stats().streak).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Changement d'année, année bissextile
// ─────────────────────────────────────────────────────────────────────────────
describe("bornes du calendrier", () => {
  it("31 décembre → 1er janvier : série continue", () => {
    vi.setSystemTime(new Date("2027-01-01T00:10:00+01:00"));
    saveProfile({ streak: 30, lastPlayed: "2026-12-31T23:50:00+01:00" });
    playNow();
    expect(stats().streak).toBe(31);
  });

  it("28 février → 29 février (2028 bissextile) → 1er mars : trois jours consécutifs", () => {
    vi.setSystemTime(new Date("2028-02-29T09:00:00+01:00"));
    saveProfile({ streak: 1, lastPlayed: "2028-02-28T09:00:00+01:00" });
    playNow();
    expect(stats().streak).toBe(2);
    vi.setSystemTime(new Date("2028-03-01T09:00:00+01:00"));
    playNow();
    expect(stats().streak).toBe(3);
  });

  it("28 février → 1er mars en année NON bissextile (2027) → consécutifs", () => {
    vi.setSystemTime(new Date("2027-03-01T09:00:00+01:00"));
    saveProfile({ streak: 1, lastPlayed: "2027-02-28T09:00:00+01:00" });
    playNow();
    expect(stats().streak).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plusieurs parties, plusieurs modes, le même jour
// ─────────────────────────────────────────────────────────────────────────────
describe("plusieurs parties le même jour", () => {
  it("6 modes joués le même jour → la série n'avance que d'un", () => {
    vi.setSystemTime(new Date("2026-06-01T10:00:00+02:00"));
    saveProfile({ streak: 2, lastPlayed: "2026-05-31T10:00:00+02:00" });
    ["Classic", "Emoji", "Silhouette", "AllOutAttack", "Personae", "Music"].forEach((m) => playNow(m));
    expect(stats().streak).toBe(3);
    expect(stats().games).toBe(6);
  });

  it("un abandon ne casse pas la série côté client (série d'assiduité)", () => {
    vi.setSystemTime(new Date("2026-06-01T10:00:00+02:00"));
    saveProfile({ streak: 2, lastPlayed: "2026-05-31T10:00:00+02:00" });
    updateProfileStats({ result: "giveup", mode: "Classic", timeSpent: 0 });
    expect(stats().streak).toBe(3);
  });

  it("une victoire puis un abandon le même jour → série inchangée", () => {
    vi.setSystemTime(new Date("2026-06-01T10:00:00+02:00"));
    saveProfile({ streak: 2, lastPlayed: "2026-05-31T10:00:00+02:00" });
    playNow();
    updateProfileStats({ result: "giveup", mode: "Emoji", timeSpent: 0 });
    expect(stats().streak).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Trace de récupération (Jack Frost) — écrite quand la série casse
// ─────────────────────────────────────────────────────────────────────────────
describe("trace streakRecovery à la casse", () => {
  it("série de 5 cassée → previousStreak 5, brokenDate = aujourd'hui Paris, shown false", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00+02:00"));
    saveProfile({ streak: 5, lastPlayed: "2026-06-01T10:00:00+02:00" });
    playNow();
    expect(recovery()).toEqual({ previousStreak: 5, brokenDate: "2026-06-03", shown: false });
  });

  it("série de 1 cassée → aucune trace (rien à récupérer)", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00+02:00"));
    saveProfile({ streak: 1, lastPlayed: "2026-06-01T10:00:00+02:00" });
    playNow();
    expect(recovery()).toBeNull();
  });

  it("une trace non consommée n'est PAS écrasée par une casse plus petite", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00+02:00"));
    localStorage.setItem("streakRecovery", JSON.stringify({ previousStreak: 20, brokenDate: "2026-05-01", shown: false }));
    saveProfile({ streak: 3, lastPlayed: "2026-06-01T10:00:00+02:00" });
    playNow();
    expect(recovery().previousStreak).toBe(20);
  });

  it("une trace CONSOMMÉE (previousStreak 0) est remplacée par la nouvelle casse", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00+02:00"));
    localStorage.setItem("streakRecovery", JSON.stringify({ previousStreak: 0, lastUsed: "2026-04-01", shown: true }));
    saveProfile({ streak: 7, lastPlayed: "2026-06-01T10:00:00+02:00" });
    playNow();
    const r = recovery();
    expect(r.previousStreak).toBe(7);
    expect(r.shown).toBe(false);
    expect(r.lastUsed).toBe("2026-04-01"); // le cooldown, lui, est conservé
  });

  it("streakRecovery corrompu (JSON invalide) → la partie s'enregistre quand même", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00+02:00"));
    localStorage.setItem("streakRecovery", "{not json");
    saveProfile({ streak: 7, lastPlayed: "2026-06-01T10:00:00+02:00" });
    expect(() => playNow()).not.toThrow();
    expect(stats().streak).toBe(1);
    expect(stats().games).toBe(1);
  });

  it("lastPlayed illisible (chaîne corrompue) → traité comme première partie, pas d'exception", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00+02:00"));
    saveProfile({ streak: 7, lastPlayed: "pas-une-date" });
    expect(() => playNow()).not.toThrow();
    expect(stats().lastPlayed).toBe(new Date().toISOString());
    expect(Number.isFinite(stats().streak)).toBe(true);
  });
});
