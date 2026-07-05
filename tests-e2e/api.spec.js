import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Tests E2E via l'API (fiables, sans DOM) sur les 2 corrections sensibles :
 *   1. La sélection de badges épinglés persiste côté serveur (PATCH → GET).
 *   2. Le streak GLOBAL s'incrémente et ne s'effondre pas quand on change de mode.
 *
 * Pré-requis : stack Docker démarrée (make up). Un utilisateur frais est créé
 * par run pour rester idempotent (la contrainte unique sur game_sessions empêche
 * de rejouer le même (user, mode, jour) — d'où le compte neuf à chaque fois).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe.serial("API — régressions sensibles (badges, streak global)", () => {
  let ctx;
  let userId;

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext({ baseURL: BASE });
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const res = await ctx.post("/api/auth/register", {
      data: {
        email: `e2e_${rnd}@test.local`,
        pseudo: `e2e_${rnd}`.slice(0, 20),
        password: "test1234",
      },
    });
    expect(
      res.ok(),
      "register doit réussir — si 429, c'est le rate-limit (attendre ~15 min ou vider rate_limits)"
    ).toBeTruthy();
    const body = await res.json();
    userId = body.user.id;
    expect(userId).toBeTruthy();
  });

  test.afterAll(async () => {
    await ctx?.dispose();
  });

  test("la sélection de badges épinglés persiste (PATCH → GET)", async () => {
    // api/user/index.php vérifie désormais que chaque badge de selected_badges est
    // réellement présent dans badges_unlocked (même garde que wallpaper_id/equipped_title_id) —
    // il faut donc gagner puis débloquer "first_win" avant de pouvoir l'épingler.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    const win = await ctx.post("/api/sessions", {
      data: { mode: "silhouette", played_date: today, target_name: "Target Badge", result: "win", attempts: 1 },
      headers: await csrfHeader(ctx),
    });
    expect(win.ok(), "POST session (pour déclencher first_win) doit réussir").toBeTruthy();

    const unlock = await ctx.post("/api/badges/unlock", {
      data: { badge_id: "first_win" },
      headers: await csrfHeader(ctx),
    });
    expect(unlock.ok(), "POST /api/badges/unlock(first_win) doit réussir après 1 victoire").toBeTruthy();

    const pick = ["first_win"];

    const patch = await ctx.patch(`/api/user/${userId}`, {
      data: { selected_badges: pick },
      headers: await csrfHeader(ctx),
    });
    expect(patch.ok(), "PATCH selected_badges doit réussir").toBeTruthy();

    // Relecture depuis le serveur : la sélection doit avoir été persistée.
    const get = await ctx.get(`/api/user/${userId}`);
    expect(get.ok()).toBeTruthy();
    const body = await get.json();
    expect(body.profile.selected_badges).toEqual(pick);
  });

  test("PATCH selected_badges rejette un badge non débloqué", async () => {
    const patch = await ctx.patch(`/api/user/${userId}`, {
      data: { selected_badges: ["ace_detective"] }, // nécessite 10 victoires, jamais atteint ici
      headers: await csrfHeader(ctx),
    });
    expect(patch.status(), "PATCH doit refuser un badge jamais débloqué").toBe(403);
  });

  test("le streak global s'incrémente et ne s'effondre pas en changeant de mode", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    const playSession = async (mode, name) =>
      ctx.post("/api/sessions", {
        data: { mode, played_date: today, target_name: name, result: "win", attempts: 3 },
        headers: await csrfHeader(ctx),
      });

    // 1re partie (mode classic) → streak global = 1
    const r1 = await playSession("classic", "Target A");
    expect(r1.ok(), "POST session classic doit réussir").toBeTruthy();
    const g1 = (await r1.json()).global_streak;
    expect(g1).toBeGreaterThanOrEqual(1);

    // 2e partie le MÊME jour mais dans un AUTRE mode → le streak global ne doit
    // PAS redescendre (c'est tout l'intérêt du fix : il est global, pas par-mode).
    const r2 = await playSession("emoji", "Target B");
    expect(r2.ok(), "POST session emoji doit réussir").toBeTruthy();
    const g2 = (await r2.json()).global_streak;
    expect(g2).toBeGreaterThanOrEqual(g1);
  });
});

test.describe("API — anti-triche de la récupération de streak (recover-streak)", () => {
  let ctx;

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext({ baseURL: BASE });
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const res = await ctx.post("/api/auth/register", {
      data: {
        email: `e2e_recovery_${rnd}@test.local`,
        pseudo: `e2e_rec_${rnd}`.slice(0, 20),
        password: "test1234",
      },
    });
    expect(res.ok(), "register doit réussir").toBeTruthy();
  });

  test.afterAll(async () => {
    await ctx?.dispose();
  });

  test("rejette previous_streak > nombre de jours distincts réellement joués", async () => {
    // Utilisateur fraîchement inscrit → 0 game_sessions → max autorisé = 1
    // (cf. api/lib/streak_recovery.php: $maxAllowed = max(1, $daysPlayed)).
    const res = await ctx.post("/api/user/recover-streak", {
      data: { previous_streak: 5 },
      headers: await csrfHeader(ctx),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds total days played/i);
  });

  test("rejette un previous_streak hors bornes (< 2)", async () => {
    const res = await ctx.post("/api/user/recover-streak", {
      data: { previous_streak: 1 },
      headers: await csrfHeader(ctx),
    });
    expect(res.status()).toBe(400);
  });
});
