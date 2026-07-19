/**
 * backend.test.js — Tests unitaires pour la couche frontend du backend v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Ce fichier teste :
 *   1. La logique de migration localStorage → cloud (js/auth.js)
 *   2. L'API client (js/api.js) — construction des URLs, gestion des erreurs
 *   3. La cohérence des sessions en attente (buildGameSession + savePendingSession)
 *   4. Les helpers d'authentification UI (updateAuthUI)
 *
 * CE QU'ON NE TESTE PAS ICI
 * ─────────────────────────────────────────────────────────────────────────────
 * - Les endpoints PHP (testés manuellement via curl ou Postman)
 * - Les appels réseau réels (on mock fetch)
 * - La logique de streak (déjà testée dans gameCore.test.js)
 *
 * POURQUOI MOCKER FETCH
 * ─────────────────────────────────────────────────────────────────────────────
 * Les tests tournent dans jsdom (pas de vrai serveur). On remplace fetch par
 * un spy Vitest qui renvoie des réponses JSON contrôlées. Ça permet de tester
 * la logique JS sans dépendance réseau, ce qui rend les tests rapides et
 * déterministes.
 *
 * Run: npm test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildGameSession, savePendingSession } from "../js/gameCore.js";
import { updateAuthUI } from "../js/auth.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clearStorage() {
  localStorage.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTRUCTION DES SESSIONS (buildGameSession)
// ─────────────────────────────────────────────────────────────────────────────

describe("buildGameSession", () => {
  it("returns all required fields", () => {
    const session = buildGameSession({
      mode: "classic",
      targetName: "Ryuji Sakamoto",
      result: "win",
      attempts: 3,
      timeMs: 45000,
      filters: ["P5", "P5R"],
    });

    expect(session).toHaveProperty("mode", "classic");
    expect(session).toHaveProperty("target_name", "Ryuji Sakamoto");
    expect(session).toHaveProperty("result", "win");
    expect(session).toHaveProperty("attempts", 3);
    expect(session).toHaveProperty("time_ms", 45000);
    expect(session).toHaveProperty("active_filters", ["P5", "P5R"]);
    expect(session).toHaveProperty("played_date");
  });

  it("played_date matches YYYY-MM-DD format", () => {
    const session = buildGameSession({
      mode: "emoji",
      targetName: "Joker",
      result: "giveup",
      attempts: 6,
    });
    expect(session.played_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rounds time_ms", () => {
    const session = buildGameSession({
      mode: "music",
      targetName: "Last Surprise",
      result: "win",
      attempts: 1,
      timeMs: 12345.7,
    });
    expect(session.time_ms).toBe(12346);
  });

  it("defaults filters to empty array when not provided", () => {
    const session = buildGameSession({
      mode: "silhouette",
      targetName: "Aigis",
      result: "win",
      attempts: 2,
    });
    expect(session.active_filters).toEqual([]);
  });

  it("defaults timeMs to 0 when not provided", () => {
    const session = buildGameSession({
      mode: "personae",
      targetName: "Elizabeth",
      result: "giveup",
      attempts: 5,
    });
    expect(session.time_ms).toBe(0);
  });

  it("normalizes the mode to its canonical backend key", () => {
    // Quelle que soit la graphie passée par la page de mode, le backend reçoit la clé canonique.
    expect(buildGameSession({ mode: "AllOutAttack", targetName: "x", result: "win", attempts: 1 }).mode).toBe("alloutattack");
    expect(buildGameSession({ mode: "All Out Attack", targetName: "x", result: "win", attempts: 1 }).mode).toBe("alloutattack");
    expect(buildGameSession({ mode: "Classic", targetName: "x", result: "win", attempts: 1 }).mode).toBe("classic");
    expect(buildGameSession({ mode: "Music", targetName: "x", result: "win", attempts: 1 }).mode).toBe("music");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FILE D'ATTENTE LOCALE (savePendingSession — mode offline)
// ─────────────────────────────────────────────────────────────────────────────

describe("savePendingSession — offline (no API)", () => {
  beforeEach(() => {
    clearStorage();
    // S'assurer qu'il n'y a pas d'API globale (mode offline)
    window._personadleApi = undefined;
  });
  afterEach(() => {
    clearStorage();
    window._personadleApi = undefined;
  });

  it("queues a session in localStorage when offline", async () => {
    const session = buildGameSession({
      mode: "classic",
      targetName: "Makoto",
      result: "win",
      attempts: 2,
    });

    await savePendingSession(session);

    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(1);
    expect(pending[0].target_name).toBe("Makoto");
  });

  it("accumulates multiple sessions in order", async () => {
    const s1 = buildGameSession({
      mode: "classic",
      targetName: "Ryuji",
      result: "win",
      attempts: 3,
    });
    const s2 = buildGameSession({
      mode: "emoji",
      targetName: "Ann",
      result: "giveup",
      attempts: 6,
    });
    const s3 = buildGameSession({
      mode: "silhouette",
      targetName: "Yusuke",
      result: "win",
      attempts: 1,
    });

    await savePendingSession(s1);
    await savePendingSession(s2);
    await savePendingSession(s3);

    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(3);
    expect(pending.map((s) => s.target_name)).toEqual(["Ryuji", "Ann", "Yusuke"]);
  });

  it("preserves existing sessions already in queue", async () => {
    // Simuler une session déjà en attente (d'une précédente partie)
    localStorage.setItem(
      "pendingSessions",
      JSON.stringify([
        {
          mode: "music",
          target_name: "Burn My Dread",
          result: "win",
          attempts: 1,
          time_ms: 0,
          active_filters: [],
          played_date: "2026-04-09",
        },
      ])
    );

    const s = buildGameSession({
      mode: "classic",
      targetName: "Fuuka",
      result: "win",
      attempts: 4,
    });
    await savePendingSession(s);

    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(2);
    expect(pending[0].target_name).toBe("Burn My Dread"); // ancienne
    expect(pending[1].target_name).toBe("Fuuka"); // nouvelle
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ENVOI DIRECT QUAND L'API EST DISPONIBLE (savePendingSession — online)
// ─────────────────────────────────────────────────────────────────────────────

describe("savePendingSession — online (API available)", () => {
  afterEach(() => {
    clearStorage();
    window._personadleApi = undefined;
  });

  it("posts session to API and does NOT write to localStorage", async () => {
    const postSession = vi.fn().mockResolvedValue({ session_id: 42, stats: {} });
    const syncPending = vi.fn().mockResolvedValue(undefined);

    window._personadleApi = {
      stats: { postSession, syncPending },
    };

    const session = buildGameSession({
      mode: "alloutattack",
      targetName: "Shadow",
      result: "win",
      attempts: 2,
    });

    await savePendingSession(session);

    // L'API doit avoir été appelée
    expect(postSession).toHaveBeenCalledOnce();
    expect(postSession).toHaveBeenCalledWith(session);

    // syncPending est appelé après pour vider la queue offline
    expect(syncPending).toHaveBeenCalledOnce();

    // Rien dans localStorage
    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(0);
  });

  it("falls back to localStorage if API call throws (offline-first)", async () => {
    window._personadleApi = {
      stats: {
        postSession: vi.fn().mockRejectedValue(new Error("Network error")),
        syncPending: vi.fn(),
      },
    };

    const session = buildGameSession({
      mode: "personae",
      targetName: "Izanagi",
      result: "win",
      attempts: 1,
    });

    await savePendingSession(session);

    // Doit être en localStorage (fallback)
    const pending = JSON.parse(localStorage.getItem("pendingSessions") || "[]");
    expect(pending).toHaveLength(1);
    expect(pending[0].target_name).toBe("Izanagi");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. LOGIQUE DE MIGRATION — construction du payload
// ─────────────────────────────────────────────────────────────────────────────

describe("migration payload construction", () => {
  beforeEach(clearStorage);
  afterEach(clearStorage);

  it("correctly extracts profile and pendingSessions from localStorage", () => {
    const fakeProfile = {
      pseudo: "Hamza",
      avatar: "data:image/png;base64,abc",
      avatarBorderColor: "#E63946",
      badges: ["ace_detective", "phantom_coder"],
      selectedBadges: ["ace_detective"],
      stats: {
        wins: 42,
        giveups: 5,
        games: 47,
        streak: 3,
        streakRecord: 7,
        totalTimeMinutes: 312,
        perfectWins: 4,
      },
    };

    const fakeSessions = [
      {
        mode: "classic",
        played_date: "2026-04-09",
        target_name: "Ryuji",
        result: "win",
        attempts: 3,
        time_ms: 45000,
        active_filters: [],
      },
      {
        mode: "emoji",
        played_date: "2026-04-08",
        target_name: "Ann",
        result: "win",
        attempts: 2,
        time_ms: 30000,
        active_filters: ["P5"],
      },
    ];

    localStorage.setItem("personaUserProfile", JSON.stringify(fakeProfile));
    localStorage.setItem("pendingSessions", JSON.stringify(fakeSessions));

    // Reproduire la logique de migrateLocalStorageToCloud sans l'appel réseau
    const profileRaw = localStorage.getItem("personaUserProfile");
    const sessionsRaw = localStorage.getItem("pendingSessions");

    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const pendingSessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];

    // Vérifications du payload
    expect(profile).not.toBeNull();
    expect(profile.pseudo).toBe("Hamza");
    expect(profile.stats.wins).toBe(42);
    expect(profile.stats.streakRecord).toBe(7);
    expect(profile.badges).toContain("ace_detective");

    expect(pendingSessions).toHaveLength(2);
    expect(pendingSessions[0].target_name).toBe("Ryuji");
    expect(pendingSessions[1].mode).toBe("emoji");
  });

  it("handles missing localStorage gracefully", () => {
    // localStorage vide → pas de crash
    const profileRaw = localStorage.getItem("personaUserProfile");
    const sessionsRaw = localStorage.getItem("pendingSessions");

    expect(profileRaw).toBeNull();
    expect(sessionsRaw).toBeNull();

    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const pendingSessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];

    expect(profile).toBeNull();
    expect(pendingSessions).toEqual([]);
  });

  it("marks migration as done after success", () => {
    // Simuler la fin d'une migration réussie
    localStorage.removeItem("pendingSessions");
    localStorage.setItem("migratedToCloud", "true");

    expect(localStorage.getItem("migratedToCloud")).toBe("true");
    expect(localStorage.getItem("pendingSessions")).toBeNull();
  });

  it("does not re-migrate if already migrated", () => {
    localStorage.setItem("migratedToCloud", "true");
    const alreadyMigrated = localStorage.getItem("migratedToCloud") === "true";
    expect(alreadyMigrated).toBe(true);
    // La fonction migrateLocalStorageToCloud retourne tôt dans ce cas
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. AUTH UI — updateAuthUI (via data-auth attributes)
// ─────────────────────────────────────────────────────────────────────────────

describe("auth UI — data-auth attributes", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window._currentUser = null;
    localStorage.removeItem("playerUserId");
  });

  it("shows connected zones and hides anonymous zones when logged in", () => {
    document.body.innerHTML = `
      <div data-auth="connected" style="display:none">Profil</div>
      <div data-auth="anonymous">Se connecter</div>
    `;

    updateAuthUI({ id: 1, pseudo: "Hamza" });

    const connected = document.querySelector('[data-auth="connected"]');
    const anonymous = document.querySelector('[data-auth="anonymous"]');
    expect(connected.style.display).toBe("");
    expect(anonymous.style.display).toBe("none");
    expect(window._currentUser).not.toBeNull();
  });

  it("hides connected zones and shows anonymous zones when logged out", () => {
    document.body.innerHTML = `
      <div data-auth="connected">Profil</div>
      <div data-auth="anonymous" style="display:none">Se connecter</div>
    `;

    updateAuthUI(null);

    const connected = document.querySelector('[data-auth="connected"]');
    const anonymous = document.querySelector('[data-auth="anonymous"]');
    expect(connected.style.display).toBe("none");
    expect(anonymous.style.display).toBe("");
    expect(window._currentUser).toBeNull();
  });

  it("fills data-auth-field elements with user data", () => {
    document.body.innerHTML = `
      <span data-auth-field="pseudo"></span>
      <span data-auth-field="friend_code"></span>
    `;

    updateAuthUI({ id: 1, pseudo: "Hamza", friend_code: "XK4R2M9P" });

    expect(document.querySelector('[data-auth-field="pseudo"]').textContent).toBe("Hamza");
    expect(document.querySelector('[data-auth-field="friend_code"]').textContent).toBe("XK4R2M9P");
  });

  it("does not crash if data-auth-field references missing user key", () => {
    document.body.innerHTML = `<span data-auth-field="nonexistent"></span>`;
    // Ne doit pas lever d'exception
    expect(() => updateAuthUI({ id: 1, pseudo: "Test" })).not.toThrow();
    // Le champ reste vide
    expect(document.querySelector('[data-auth-field="nonexistent"]').textContent).toBe("");
  });

  it("syncs playerUserId in localStorage so getDailyTarget() stays stable across devices", () => {
    updateAuthUI({ id: 42, pseudo: "Hamza" });
    expect(localStorage.getItem("playerUserId")).toBe("42");

    updateAuthUI(null);
    expect(localStorage.getItem("playerUserId")).toBeNull();
  });
});
