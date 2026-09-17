/**
 * streak_sync_usecases.test.js — La streak entre DEUX appareils, ou après une
 * reconnexion : ce que le cloud redescend (js/cloud-sync.js) et ce que la
 * première partie qui suit en fait (profile/profileStats.js), jusqu'à la trace
 * Jack Frost (js/streak-recovery.js).
 *
 * Le scénario qui a motivé la suite : un joueur à 15 jours de série se connecte
 * sur un nouveau téléphone (ou se reconnecte après une déconnexion, qui vide le
 * profil local). Le pull écrit `streak = 15`… et rien d'autre sur la dernière
 * journée jouée. Sa première partie voit alors « jamais joué » → série remise à
 * 1, et une trace « tu as perdu 15 jours » est écrite. Au chargement suivant,
 * Jack Frost lui propose de restaurer une série qu'il n'a jamais perdue — et
 * s'il clique, le serveur consomme son crédit de 60 jours pour ne rien changer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pullProfileFromCloud } from "../js/cloud-sync.js";
import { updateProfileStats } from "../profile/profileStats.js";
import { checkStreakRecovery, canRecover } from "../js/streak-recovery.js";

const stats = () => JSON.parse(localStorage.getItem("personaUserProfile")).stats;
const recovery = () => JSON.parse(localStorage.getItem("streakRecovery") || "null");

/** Réponse de GET /api/user/:id telle que l'API la renvoie. */
function cloud({ streak, lastDate, record = streak, recoveredAt = null }) {
  return {
    user: { id: 42, pseudo: "Joker", lang: "fr" },
    profile: {},
    stats: [
      { mode: "classic", wins: 10, giveups: 1, games: 11, streak: 3, streak_record: 5, perfect_wins: 2, total_time_ms: 60000 },
      { mode: "emoji", wins: 4, giveups: 0, games: 4, streak: 1, streak_record: 2, perfect_wins: 0, total_time_ms: 30000 },
    ],
    global_streak: streak,
    global_streak_record: record,
    global_streak_date: lastDate,
    streak_recovered_at: recoveredAt,
    badges: [],
    unlocked_wallpapers: [],
    unlocked_titles: [],
  };
}

function mockFetch(payload) {
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-16T10:00:00+02:00")); // mardi 16 juin, matin, Paris
  window._currentUser = { id: 42, pseudo: "Joker" };
  window._personadleApi = { stats: { syncPending: vi.fn().mockResolvedValue() } };
  delete window._onCloudSync;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("nouvel appareil : le cloud redescend la série ET sa dernière journée", () => {
  it("dernière journée = hier → la première partie fait +1, sans trace Jack Frost", async () => {
    mockFetch(cloud({ streak: 15, lastDate: "2026-06-15" }));
    await pullProfileFromCloud();
    expect(stats().streak).toBe(15);

    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });

    expect(stats().streak).toBe(16);
    expect(recovery()?.previousStreak ?? 0).toBe(0);
  });

  it("dernière journée = aujourd'hui (déjà joué sur l'autre appareil) → série inchangée", async () => {
    mockFetch(cloud({ streak: 16, lastDate: "2026-06-16" }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Emoji", timeSpent: 60 });
    expect(stats().streak).toBe(16);
    expect(recovery()?.previousStreak ?? 0).toBe(0);
  });

  it("dernière journée = avant-hier → la série est VRAIMENT perdue : 1, et la trace est écrite", async () => {
    mockFetch(cloud({ streak: 15, lastDate: "2026-06-14" }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });
    expect(stats().streak).toBe(1);
    expect(recovery()?.previousStreak).toBe(15);
    expect(canRecover()).toBe(true);
  });

  it("le record redescendu n'est jamais abaissé par la première partie", async () => {
    mockFetch(cloud({ streak: 15, lastDate: "2026-06-15", record: 40 }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });
    expect(stats().streakRecord).toBe(40);
  });

  it("Jack Frost ne s'ouvre PAS au chargement suivant quand rien n'a été perdu", async () => {
    mockFetch(cloud({ streak: 15, lastDate: "2026-06-15" }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });
    // Chargement suivant : pull (le backend a compté la partie) puis checkStreakRecovery()
    mockFetch(cloud({ streak: 16, lastDate: "2026-06-16" }));
    await pullProfileFromCloud();
    checkStreakRecovery();
    vi.advanceTimersByTime(2000);
    expect(document.getElementById("streak-recovery-overlay")).toBeNull();
  });
});

describe("le cloud corrige aussi une dernière journée LOCALE périmée", () => {
  it("appareil B pas ouvert depuis 3 jours, mais le joueur a joué hier sur A → +1, pas de fausse casse", async () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ pseudo: "Joker", stats: { streak: 12, streakRecord: 12, lastPlayed: "2026-06-13T18:00:00+02:00" } })
    );
    mockFetch(cloud({ streak: 15, lastDate: "2026-06-15" }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });
    expect(stats().streak).toBe(16);
    expect(recovery()?.previousStreak ?? 0).toBe(0);
  });

  it("après une récupération Jack Frost côté serveur (dernière journée = aujourd'hui), jouer ne casse rien", async () => {
    mockFetch(cloud({ streak: 15, lastDate: "2026-06-16", recoveredAt: "2026-06-16 07:30:00" }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });
    expect(stats().streak).toBe(15);
    expect(recovery()?.previousStreak ?? 0).toBe(0);
  });
});

describe("compatibilité : un backend qui ne renvoie pas encore la dernière journée", () => {
  it("global_streak_date absent → lastPlayed local laissé tel quel", async () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ pseudo: "Joker", stats: { streak: 3, lastPlayed: "2026-06-15T18:00:00+02:00" } })
    );
    const payload = cloud({ streak: 15, lastDate: undefined });
    delete payload.global_streak_date;
    mockFetch(payload);
    await pullProfileFromCloud();
    expect(stats().lastPlayed).toBe("2026-06-15T18:00:00+02:00");
  });

  it("global_streak_date null (jamais joué) → lastPlayed retiré, la première partie vaut 1", async () => {
    mockFetch(cloud({ streak: 0, lastDate: null }));
    await pullProfileFromCloud();
    updateProfileStats({ result: "win", mode: "Classic", timeSpent: 60 });
    expect(stats().streak).toBe(1);
    expect(recovery()?.previousStreak ?? 0).toBe(0);
  });

  it("global_streak_date illisible → ignoré, pas d'exception", async () => {
    mockFetch(cloud({ streak: 15, lastDate: "hier" }));
    await expect(pullProfileFromCloud()).resolves.not.toBeNull();
  });
});
