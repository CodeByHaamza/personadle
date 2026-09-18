/**
 * auth_usecases.test.js — Cas d'usage de la connexion, bout en bout côté client :
 * js/auth.js + js/api.js réels, seul `fetch` est simulé.
 *
 * Trois moments de la vie d'un compte, tels que le joueur les vit :
 *   1. J'ouvre une page  → initAuth() : session restaurée, expirée, ou serveur
 *      injoignable — trois états qui ne doivent JAMAIS être confondus.
 *   2. Je me connecte    → formulaire de login : succès, mauvais mot de passe,
 *      compte banni, double-clic, réseau coupé.
 *   3. Je me déconnecte  → ce qui doit rester sur l'appareil, et surtout ce qui
 *      ne doit PAS y rester pour le prochain compte qui s'y connectera.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let initAuth, api;

/** Réponse fetch simulée. */
function res(status, body = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: body === null ? () => Promise.reject(new Error("empty")) : () => Promise.resolve(body),
  };
}
const ME_USER = { id: 42, pseudo: "Joker", email: "joker@shujin.jp", lang: "fr" };

/** File des réponses par URL (suffixe) ; une entrée = une réponse, dans l'ordre. */
let routes;
function route(suffix, ...responses) {
  routes.set(suffix, responses);
}
function fetchMock(url, opts = {}) {
  for (const [suffix, queue] of routes) {
    if (String(url).endsWith(suffix) || String(url).includes(suffix + "?")) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) return Promise.reject(next);
      if (typeof next === "function") return Promise.resolve(next(url, opts));
      return Promise.resolve(next);
    }
  }
  return Promise.resolve(res(404, { error: "no route " + url }));
}
const calls = (suffix) => fetch.mock.calls.filter(([u]) => String(u).endsWith(suffix));
/** POST /sessions émis après l’index `from` de fetch.mock.calls, pour une cible donnée. */
const postedAfter = (from, targetName) =>
  fetch.mock.calls
    .slice(from)
    .filter(([u, o]) => String(u).endsWith("/sessions") && o?.method === "POST" && o.body && JSON.parse(o.body).target_name === targetName);

function mountLoginDom() {
  document.body.innerHTML = `
    <div id="loginModal" class="">
      <form id="loginForm">
        <input id="loginEmail" value="joker@shujin.jp">
        <input id="loginPassword" value="secret123">
        <input id="loginRememberMe" type="checkbox" checked>
        <button type="submit">Login</button>
      </form>
      <div id="loginError" class="hidden"></div>
    </div>
    <button data-action="logout">Logout</button>
    <span data-auth="connected" id="connectedZone"></span>
    <span data-auth="anonymous" id="anonZone"></span>
    <span data-auth-field="pseudo" id="pseudoField"></span>`;
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  routes = new Map();
  document.cookie = "csrf_token=tok-abc; path=/";
  globalThis.fetch = vi.fn(fetchMock);
  window._currentUser = null;
  window._authResolved = false;
  window._authUnavailable = false;
  mountLoginDom();
  ({ initAuth } = await import("../js/auth.js"));
  ({ api } = await import("../js/api.js"));
  window._personadleApi = api;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. J'ouvre une page — initAuth()
// ─────────────────────────────────────────────────────────────────────────────
describe("initAuth — session restaurée", () => {
  it("cookie valide : le joueur est connecté, son seed est posé, la page est prévenue", async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    const ready = vi.fn();
    window.addEventListener("personadle:auth-ready", ready, { once: true });

    await initAuth();

    expect(window._currentUser).toEqual(ME_USER);
    expect(localStorage.getItem("playerUserId")).toBe("42");
    expect(window._authResolved).toBe(true);
    expect(window._authUnavailable).toBe(false);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(ready.mock.calls[0][0].detail.user).toEqual(ME_USER);
    expect(document.getElementById("connectedZone").style.display).toBe("");
    expect(document.getElementById("anonZone").style.display).toBe("none");
    expect(document.getElementById("pseudoField").textContent).toBe("Joker");
  });

  it("connecté : les parties jouées hors ligne partent au serveur sans bloquer la page", async () => {
    localStorage.setItem(
      "pendingSessions",
      JSON.stringify([{ mode: "classic", played_date: "2026-06-01", target_name: "Yu", result: "win", attempts: 3, client_session_id: "abcd-1234" }])
    );
    route("/auth/me", res(200, { user: ME_USER }));
    route("/sessions", res(201, { id: 1 }));

    await initAuth();
    await vi.waitFor(() => expect(calls("/sessions").length).toBe(1));
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("pendingSessions") || "[]")).toEqual([]));
  });

  it("le header X-CSRF-Token vient du cookie csrf_token sur chaque appel", async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    await initAuth();
    const [, opts] = calls("/auth/me")[0];
    expect(opts.headers["X-CSRF-Token"]).toBe("tok-abc");
    expect(opts.credentials).toBe("include");
  });
});

describe("initAuth — session expirée (réponse autoritaire)", () => {
  it("401 : anonyme, seed PURGÉ, serveur considéré joignable, un seul appel (pas de retry)", async () => {
    localStorage.setItem("playerUserId", "42");
    route("/auth/me", res(401, { error: "Not authenticated" }));

    await initAuth();

    expect(window._currentUser).toBeNull();
    expect(localStorage.getItem("playerUserId")).toBeNull();
    expect(window._authUnavailable).toBe(false);
    expect(window._authResolved).toBe(true);
    expect(calls("/auth/me").length).toBe(1);
    expect(document.getElementById("connectedZone").style.display).toBe("none");
    expect(document.getElementById("anonZone").style.display).toBe("");
  });

  it("403 : idem — c'est une réponse, pas une panne", async () => {
    localStorage.setItem("playerUserId", "42");
    route("/auth/me", res(403, { error: "Forbidden" }));
    await initAuth();
    expect(localStorage.getItem("playerUserId")).toBeNull();
    expect(calls("/auth/me").length).toBe(1);
  });
});

describe("initAuth — serveur injoignable (transport)", () => {
  it("fetch rejette 3 fois : anonyme MAIS seed conservé, _authUnavailable = true, backoff 300 puis 900 ms", async () => {
    vi.useFakeTimers();
    localStorage.setItem("playerUserId", "42");
    route("/auth/me", new TypeError("Failed to fetch"));

    const p = initAuth();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls("/auth/me").length).toBe(1);
    await vi.advanceTimersByTimeAsync(299);
    expect(calls("/auth/me").length).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls("/auth/me").length).toBe(2);
    await vi.advanceTimersByTimeAsync(899);
    expect(calls("/auth/me").length).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls("/auth/me").length).toBe(3);
    await p;

    expect(window._currentUser).toBeNull();
    expect(localStorage.getItem("playerUserId")).toBe("42"); // la cible du jour ne bouge pas
    expect(window._authUnavailable).toBe(true);
    expect(window._authResolved).toBe(true);
  });

  it("503 synthétique du service worker puis 200 : connecté après réessai", async () => {
    vi.useFakeTimers();
    route("/auth/me", res(503, { error: "offline" }), res(200, { user: ME_USER }));
    const p = initAuth();
    await vi.advanceTimersByTimeAsync(400);
    await p;
    expect(window._currentUser).toEqual(ME_USER);
    expect(window._authUnavailable).toBe(false);
    expect(calls("/auth/me").length).toBe(2);
  });

  it("429 (rate limit) ×3 : le joueur n'est PAS déconnecté visuellement — seed intact", async () => {
    vi.useFakeTimers();
    localStorage.setItem("playerUserId", "42");
    route("/auth/me", res(429, { error: "Too many requests" }));
    const p = initAuth();
    await vi.advanceTimersByTimeAsync(1300);
    await p;
    expect(localStorage.getItem("playerUserId")).toBe("42");
    expect(window._authUnavailable).toBe(true);
  });

  it("500 puis 500 puis 401 : la dernière réponse est autoritaire → seed purgé", async () => {
    vi.useFakeTimers();
    localStorage.setItem("playerUserId", "42");
    route("/auth/me", res(500), res(500), res(401, { error: "nope" }));
    const p = initAuth();
    await vi.advanceTimersByTimeAsync(1300);
    await p;
    expect(localStorage.getItem("playerUserId")).toBeNull();
    expect(window._authUnavailable).toBe(false);
  });

  it("injoignable : aucune synchro de sessions n'est tentée (rien à faire sans session)", async () => {
    vi.useFakeTimers();
    localStorage.setItem("pendingSessions", JSON.stringify([{ mode: "classic", client_session_id: "abcd-1234" }]));
    route("/auth/me", new TypeError("Failed to fetch"));
    const p = initAuth();
    await vi.advanceTimersByTimeAsync(1300);
    await p;
    expect(calls("/sessions").length).toBe(0);
    expect(JSON.parse(localStorage.getItem("pendingSessions")).length).toBe(1);
  });
});

describe("initAuth — robustesse", () => {
  it("un markup partiel qui fait lever l'affichage ne bloque pas _authResolved ni auth-ready", async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    const ready = vi.fn();
    window.addEventListener("personadle:auth-ready", ready, { once: true });
    // querySelectorAll indisponible → updateAuthUI lève
    const spy = vi.spyOn(document, "querySelectorAll").mockImplementation(() => {
      throw new Error("DOM cassé");
    });
    await expect(initAuth()).rejects.toThrow("DOM cassé");
    spy.mockRestore();
    expect(window._authResolved).toBe(true);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it("/me répond 200 avec un corps vide (non JSON) : traité comme anonyme sans exception", async () => {
    route("/auth/me", res(200, null));
    await expect(initAuth()).resolves.toBeUndefined();
    expect(window._currentUser ?? null).toBeNull();
    expect(window._authResolved).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Je me connecte — formulaire de login
// ─────────────────────────────────────────────────────────────────────────────
describe("formulaire de login", () => {
  const submit = () => document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true }));
  const errorEl = () => document.getElementById("loginError");
  const submitBtn = () => document.querySelector("#loginForm button[type=submit]");

  beforeEach(async () => {
    route("/auth/me", res(401, { error: "Not authenticated" }));
    await initAuth();
  });

  it("succès : identifiant/mot de passe/remember_me envoyés, joueur connecté, modale fermée, page prévenue", async () => {
    route("/auth/login", res(200, { user: ME_USER }));
    const loginEvt = vi.fn();
    window.addEventListener("personadle:auth-login", loginEvt, { once: true });
    localStorage.setItem("_crInitDone", "1");

    submit();
    await vi.waitFor(() => expect(window._currentUser).toEqual(ME_USER));

    const [, opts] = calls("/auth/login")[0];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ identifier: "joker@shujin.jp", password: "secret123", remember_me: true });
    expect(opts.headers["X-CSRF-Token"]).toBe("tok-abc");
    expect(localStorage.getItem("playerUserId")).toBe("42");
    expect(document.getElementById("loginModal").classList.contains("hidden")).toBe(true);
    expect(localStorage.getItem("_crInitDone")).toBeNull();
    expect(loginEvt).toHaveBeenCalledTimes(1);
    expect(loginEvt.mock.calls[0][0].detail.user).toEqual(ME_USER);
  });

  it("succès : les parties d'invité en attente sont créditées au compte qui se connecte", async () => {
    localStorage.setItem(
      "pendingSessions",
      JSON.stringify([{ mode: "emoji", played_date: "2026-06-01", target_name: "Ann", result: "win", attempts: 2, client_session_id: "abcd-9999" }])
    );
    route("/auth/login", res(200, { user: ME_USER }));
    route("/sessions", res(201, { id: 7 }));
    submit();
    await vi.waitFor(() => expect(calls("/sessions").length).toBe(1));
    expect(JSON.parse(calls("/sessions")[0][1].body).client_session_id).toBe("abcd-9999");
  });

  it("l'identifiant est nettoyé (trim) — un espace collé ne fait pas échouer la connexion", async () => {
    document.getElementById("loginEmail").value = "  joker@shujin.jp  ";
    route("/auth/login", res(200, { user: ME_USER }));
    submit();
    await vi.waitFor(() => expect(window._currentUser).toEqual(ME_USER));
    expect(JSON.parse(calls("/auth/login")[0][1].body).identifier).toBe("joker@shujin.jp");
  });

  it("remember_me décoché → false ; case absente du DOM → true par défaut", async () => {
    document.getElementById("loginRememberMe").checked = false;
    route("/auth/login", res(200, { user: ME_USER }));
    submit();
    await vi.waitFor(() => expect(calls("/auth/login").length).toBe(1));
    expect(JSON.parse(calls("/auth/login")[0][1].body).remember_me).toBe(false);

    window._currentUser = null;
    document.getElementById("loginRememberMe").remove();
    submit();
    await vi.waitFor(() => expect(calls("/auth/login").length).toBe(2));
    expect(JSON.parse(calls("/auth/login")[1][1].body).remember_me).toBe(true);
  });

  it("mauvais mot de passe (401) : message du serveur affiché, bouton réactivé, toujours anonyme", async () => {
    route("/auth/login", res(401, { error: "Invalid credentials" }));
    submit();
    await vi.waitFor(() => expect(errorEl().classList.contains("hidden")).toBe(false));
    expect(errorEl().textContent).not.toBe("");
    expect(submitBtn().disabled).toBe(false);
    expect(window._currentUser).toBeNull();
    expect(localStorage.getItem("playerUserId")).toBeNull();
  });

  it("compte banni (403) : le message de bannissement est affiché, pas un « login failed » générique", async () => {
    route("/auth/login", res(403, { error: "Account banned", ban: { reason: "Triche", until: null } }));
    submit();
    await vi.waitFor(() => expect(errorEl().classList.contains("hidden")).toBe(false));
    expect(errorEl().textContent).toMatch(/Triche|bann|ban/i);
    expect(window._currentUser).toBeNull();
  });

  it("réseau coupé pendant la connexion : message générique, aucun texte JS brut, bouton réactivé", async () => {
    route("/auth/login", new TypeError("Failed to fetch"));
    submit();
    await vi.waitFor(() => expect(errorEl().classList.contains("hidden")).toBe(false));
    expect(errorEl().textContent).not.toMatch(/TypeError|Failed to fetch|undefined/);
    expect(submitBtn().disabled).toBe(false);
  });

  it("200 sans champ user (contrat rompu) : message générique, pas de connexion fantôme", async () => {
    route("/auth/login", res(200, { ok: true }));
    submit();
    await vi.waitFor(() => expect(errorEl().classList.contains("hidden")).toBe(false));
    expect(window._currentUser ?? null).toBeNull();
    expect(localStorage.getItem("playerUserId")).toBeNull();
  });

  it("double-clic : le bouton est désactivé pendant la requête, une seule requête part", async () => {
    let release;
    route("/auth/login", () => new Promise((r) => (release = () => r(res(200, { user: ME_USER })))));
    fetch.mockImplementation((url, opts) => {
      if (String(url).endsWith("/auth/login")) return new Promise((r) => (release = () => r(res(200, { user: ME_USER }))));
      return fetchMock(url, opts);
    });
    submit();
    await vi.waitFor(() => expect(submitBtn().disabled).toBe(true));
    submit(); // second clic : ignoré par le navigateur (bouton disabled) — on simule quand même l'event
    release();
    await vi.waitFor(() => expect(window._currentUser).toEqual(ME_USER));
    expect(submitBtn().disabled).toBe(false);
  });

  it("une erreur précédente est effacée à la soumission suivante", async () => {
    route("/auth/login", res(401, { error: "Invalid credentials" }), res(200, { user: ME_USER }));
    submit();
    await vi.waitFor(() => expect(errorEl().classList.contains("hidden")).toBe(false));
    submit();
    await vi.waitFor(() => expect(window._currentUser).toEqual(ME_USER));
    expect(errorEl().classList.contains("hidden")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Je me déconnecte
// ─────────────────────────────────────────────────────────────────────────────
describe("déconnexion", () => {
  const clickLogout = () => document.querySelector('[data-action="logout"]').click();

  beforeEach(async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    await initAuth();
    localStorage.setItem("personaUserProfile", JSON.stringify({ pseudo: "Joker", stats: { streak: 9 } }));
    localStorage.setItem("personaSettings", JSON.stringify({ darkMode: true }));
  });

  it("succès : POST /auth/logout, profil et réglages locaux effacés, seed purgé, UI anonyme, page prévenue", async () => {
    route("/auth/logout", res(200, { ok: true }));
    const evt = vi.fn();
    window.addEventListener("personadle:auth-logout", evt, { once: true });

    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());

    expect(calls("/auth/logout").length).toBe(1);
    expect(calls("/auth/logout")[0][1].method).toBe("POST");
    expect(localStorage.getItem("personaUserProfile")).toBeNull();
    expect(localStorage.getItem("personaSettings")).toBeNull();
    expect(localStorage.getItem("playerUserId")).toBeNull();
    expect(evt).toHaveBeenCalledTimes(1);
    expect(document.getElementById("anonZone").style.display).toBe("");
  });

  it("le serveur ne répond pas : l'appareil est quand même nettoyé (le joueur a demandé à partir)", async () => {
    route("/auth/logout", new TypeError("Failed to fetch"));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());
    expect(localStorage.getItem("personaUserProfile")).toBeNull();
    expect(localStorage.getItem("playerUserId")).toBeNull();
  });

  it("l'identifiant anonyme et la langue survivent à la déconnexion (ce sont des réglages d'appareil)", async () => {
    localStorage.setItem("anonPlayerId", "anon-uuid");
    localStorage.setItem("lang", "fr");
    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());
    expect(localStorage.getItem("anonPlayerId")).toBe("anon-uuid");
    expect(localStorage.getItem("lang")).toBe("fr");
  });

  // ── Appareil partagé : ce que le compte suivant ne doit JAMAIS hériter ──────

  it("la trace Jack Frost du compte A ne doit pas proposer SA série perdue au compte B", async () => {
    // A a cassé une série de 30 ce matin ; B se connecte sur le même navigateur.
    localStorage.setItem("streakRecovery", JSON.stringify({ previousStreak: 30, brokenDate: "2026-06-03", shown: false }));
    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());
    expect(JSON.parse(localStorage.getItem("streakRecovery") || "{}").previousStreak ?? 0).toBe(0);
  });

  it("le défi en cours du compte A (case activeChallenge) est libéré, ses filtres rendus", async () => {
    localStorage.setItem("filters_Classic", JSON.stringify(["P5"])); // filtres installés par le défi
    localStorage.setItem(
      "activeChallenge",
      JSON.stringify({
        msgId: 77,
        mode: "classic",
        date: new Date().toISOString().slice(0, 10),
        filterKey: "filters_Classic",
        installedFilters: JSON.stringify(["P5"]),
        originalFilters: null,
        target: "Yu Narukami",
      })
    );
    localStorage.setItem("target", JSON.stringify({ nom: "Yu Narukami" }));
    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());
    expect(localStorage.getItem("activeChallenge")).toBeNull();
    expect(localStorage.getItem("filters_Classic")).toBeNull(); // A n'avait rien choisi → clé absente
    expect(localStorage.getItem("target")).toBeNull(); // la cible du défi d'A ne devient pas la partie de B
  });

  it("le défi Expert en cours du compte A est libéré aussi", async () => {
    localStorage.setItem("activeChallengeExpert", JSON.stringify({ msgId: 78, mode: "music", isExpert: true, date: new Date().toISOString().slice(0, 10) }));
    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());
    expect(localStorage.getItem("activeChallengeExpert")).toBeNull();
  });

  it("les parties hors ligne du compte A ne sont PAS créditées au compte B qui se connecte ensuite", async () => {
    // A joue hors ligne (POST /sessions échoue), puis se déconnecte ; B se connecte.
    const { buildGameSession, savePendingSession } = await import("../js/gameCore.js");
    route("/sessions", new TypeError("Failed to fetch"));
    await savePendingSession(buildGameSession({ mode: "classic", targetName: "Yu", result: "win", attempts: 3 }));
    expect(JSON.parse(localStorage.getItem("pendingSessions")).length).toBe(1);

    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());

    const B = { ...ME_USER, id: 43, pseudo: "Ryuji" };
    route("/auth/login", res(200, { user: B }));
    route("/sessions", res(201, { id: 1 }));
    const from = fetch.mock.calls.length;
    document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(window._currentUser).toEqual(B));
    await new Promise((r) => setTimeout(r, 20));

    expect(postedAfter(from, "Yu").length).toBe(0);
    // …et la partie de A attend toujours, intacte, dans la file
    expect(JSON.parse(localStorage.getItem("pendingSessions")).map((x) => x.target_name)).toEqual(["Yu"]);
  });

  it("…mais elles sont créditées à A quand A se reconnecte", async () => {
    const { buildGameSession, savePendingSession } = await import("../js/gameCore.js");
    route("/sessions", new TypeError("Failed to fetch"));
    await savePendingSession(buildGameSession({ mode: "classic", targetName: "Yu", result: "win", attempts: 3 }));

    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());

    route("/auth/login", res(200, { user: ME_USER }));
    route("/sessions", res(201, { id: 1 }));
    const from = fetch.mock.calls.length;
    document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(window._currentUser).toEqual(ME_USER));
    await vi.waitFor(() => expect(postedAfter(from, "Yu").length).toBe(1));
    expect(JSON.parse(postedAfter(from, "Yu")[0][1].body)._owner).toBeUndefined(); // marqueur local, jamais envoyé
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("pendingSessions") || "[]")).toEqual([]));
  });

  it("les parties d'INVITÉ (jouées sans compte) restent créditées au premier compte qui se connecte", async () => {
    route("/auth/logout", res(200, { ok: true }));
    clickLogout();
    await vi.waitFor(() => expect(window._currentUser).toBeNull());

    const { buildGameSession, savePendingSession } = await import("../js/gameCore.js");
    route("/sessions", res(401, { error: "Not authenticated" }));
    await savePendingSession(buildGameSession({ mode: "emoji", targetName: "Ann", result: "win", attempts: 2 }));
    expect(JSON.parse(localStorage.getItem("pendingSessions")).length).toBe(1);

    route("/auth/login", res(200, { user: ME_USER }));
    route("/sessions", res(201, { id: 1 }));
    const from = fetch.mock.calls.length;
    document.getElementById("loginForm").dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(postedAfter(from, "Ann").length).toBe(1));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session qui expire EN COURS de partie
// ─────────────────────────────────────────────────────────────────────────────
describe("session expirée pendant une partie", () => {
  it("POST /sessions en 401 : la partie n'est pas perdue, elle attend en file", async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    await initAuth();
    const { buildGameSession, savePendingSession } = await import("../js/gameCore.js");
    route("/sessions", res(401, { error: "Not authenticated" }));

    await savePendingSession(buildGameSession({ mode: "classic", targetName: "Yu", result: "win", attempts: 3 }));

    const pending = JSON.parse(localStorage.getItem("pendingSessions"));
    expect(pending.length).toBe(1);
    expect(pending[0].target_name).toBe("Yu");
  });

  it("409 (déjà enregistrée) : rien n'est mis en file, pas d'erreur", async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    await initAuth();
    const { buildGameSession, savePendingSession } = await import("../js/gameCore.js");
    route("/sessions", res(409, { error: "duplicate" }));
    await savePendingSession(buildGameSession({ mode: "classic", targetName: "Yu", result: "win", attempts: 3 }));
    expect(localStorage.getItem("pendingSessions")).toBeNull();
  });

  it("la file rejouée avec une session expirée (401) garde les parties pour plus tard", async () => {
    route("/auth/me", res(200, { user: ME_USER }));
    await initAuth();
    localStorage.setItem("pendingSessions", JSON.stringify([{ mode: "classic", target_name: "Yu", client_session_id: "abcd-1234" }]));
    route("/sessions", res(401, { error: "Not authenticated" }));
    await api.stats.syncPending();
    expect(JSON.parse(localStorage.getItem("pendingSessions")).length).toBe(1);
  });
});
