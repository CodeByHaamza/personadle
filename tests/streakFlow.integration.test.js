/**
 * streakFlow.integration.test.js — Test d'INTÉGRATION du flux streak complet.
 *
 * Contrairement aux tests unitaires (chaque maillon isolé), celui-ci câble
 * ensemble performRecovery() (js/streak-recovery.js) et pullProfileFromCloud()
 * (js/cloud-sync.js) autour d'un faux backend, pour prouver la cohérence
 * bout-en-bout — exactement le scénario qui laissait passer le "revert silencieux".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { performRecovery } from "../js/streak-recovery.js";
import { pullProfileFromCloud } from "../js/cloud-sync.js";

const USER_ID = 1;

/** Construit la réponse GET /api/user/:id à partir d'une streak par mode. */
function userPayload(streakByMode) {
  return {
    user: { id: USER_ID, pseudo: "Tester", lang: "en" },
    profile: {},
    stats: Object.entries(streakByMode).map(([mode, streak]) => ({
      mode,
      wins: streak,
      giveups: 0,
      games: streak,
      streak,
      streak_record: streak,
      perfect_wins: 0,
      total_time_ms: 0,
    })),
    badges: [],
    unlocked_wallpapers: [],
    unlocked_titles: [],
  };
}

/**
 * Faux backend en mémoire. Route les fetch par URL :
 *  - POST /api/user/recover-streak → succès ou refus configurable
 *  - GET  /api/user/:id            → renvoie l'état streak courant
 */
function installFakeBackend({ recoverStatus = 200, streakByMode }) {
  const state = { streakByMode: { ...streakByMode } };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, opts = {}) => {
    if (String(url).includes("/recover-streak")) {
      if (recoverStatus === 200) {
        // Le backend restaure : toutes les modes < prev passent à prev.
        const prev = JSON.parse(opts.body).previous_streak;
        for (const m of Object.keys(state.streakByMode)) {
          if (state.streakByMode[m] < prev) state.streakByMode[m] = prev;
        }
        return { ok: true, status: 200, json: async () => ({ recovered: true }) };
      }
      return {
        ok: false,
        status: recoverStatus,
        json: async () => ({ error: "rejected" }),
      };
    }
    // GET user
    return { ok: true, status: 200, json: async () => userPayload(state.streakByMode) };
  });
  return state;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  globalThis.window._currentUser = { id: USER_ID };
  // syncPending est appelé par pullProfileFromCloud — on le neutralise.
  globalThis.window._personadleApi = { stats: { syncPending: vi.fn().mockResolvedValue() } };
  // État de départ : streak cassée à 0, crédit de récupération disponible (prev=7).
  localStorage.setItem(
    "personaUserProfile",
    JSON.stringify({ stats: { streak: 0, streakRecord: 7 } })
  );
  localStorage.setItem("streakRecovery", JSON.stringify({ previousStreak: 7 }));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window._currentUser;
  delete globalThis.window._personadleApi;
});

describe("flux streak : récupération + sync cloud", () => {
  it("récup acceptée → la streak reste restaurée après un pull cloud (pas de revert)", async () => {
    installFakeBackend({ recoverStatus: 200, streakByMode: { classic: 0, emoji: 0 } });

    const res = await performRecovery(7);
    expect(res.ok).toBe(true);

    // Le prochain sync cloud (source de vérité) doit confirmer la streak, pas l'effacer.
    await pullProfileFromCloud();

    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.stats.streak).toBe(7);
  });

  it("récup refusée (cooldown) → crédit intact, aucune fausse restauration après pull", async () => {
    installFakeBackend({ recoverStatus: 429, streakByMode: { classic: 0, emoji: 0 } });

    const res = await performRecovery(7);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);

    // Le crédit n'est PAS consommé → l'utilisateur pourra réessayer.
    const rec = JSON.parse(localStorage.getItem("streakRecovery"));
    expect(rec.previousStreak).toBe(7);
    expect(rec.lastUsed).toBeUndefined();

    // Et le pull cloud reflète la réalité backend (streak toujours 0), sans
    // état "récupéré" fantôme en localStorage.
    await pullProfileFromCloud();
    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.stats.streak).toBe(0);
  });
});
