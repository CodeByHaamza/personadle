import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * tests-e2e/moderation.spec.js — modération avec messages, annonces, maintenance
 * (migration 042), sur la stack complète : les routes .htaccess, la garde de
 * maintenance de bootstrap.php, et ce qu'un joueur banni voit vraiment.
 *
 * Pré-requis : make up (compte admin de seed admin@personadle.local).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe.serial("Modération, annonces, maintenance", () => {
  let admin, player, playerEmail, playerId;

  test.beforeAll(async () => {
    admin = await pwRequest.newContext({ baseURL: BASE });
    const l = await admin.post("/api/auth/login", {
      data: { identifier: "admin@personadle.local", password: "admintest123" },
    });
    expect(l.ok(), "login admin de seed").toBeTruthy();

    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    playerEmail = `e2e_mod_${rnd}@test.local`;
    player = await pwRequest.newContext({ baseURL: BASE });
    const r = await player.post("/api/auth/register", {
      data: { email: playerEmail, pseudo: `mod${rnd}`.slice(0, 20), password: "test1234" },
    });
    expect(r.ok()).toBeTruthy();
    playerId = (await r.json()).user.id;
  });

  test.afterAll(async () => {
    // Ne jamais laisser la maintenance activée derrière soi
    await admin.patch("/api/admin/settings", {
      data: { maintenance: { enabled: false } },
      headers: await csrfHeader(admin),
    });
    await admin?.dispose();
    await player?.dispose();
  });

  test("ban avec raison et durée : le joueur voit la raison au login, /me le déconnecte", async () => {
    const r = await admin.patch(`/api/admin/users/${playerId}`, {
      data: {
        is_banned: true,
        ban_reason: "Triche au classement",
        ban_note: "note interne",
        ban_hours: 24,
      },
      headers: await csrfHeader(admin),
    });
    expect(r.ok()).toBeTruthy();
    const u = (await r.json()).user;
    expect(u.is_banned).toBe(true);
    expect(u.ban_reason).toBe("Triche au classement");
    expect(u.banned_until).toBeTruthy();

    const me = await (await player.get("/api/auth/me")).json();
    expect(me.user).toBeNull();
    expect(me.banned?.reason).toBe("Triche au classement");

    const fresh = await pwRequest.newContext({ baseURL: BASE });
    const login = await fresh.post("/api/auth/login", {
      data: { identifier: playerEmail, password: "test1234" },
    });
    expect(login.status()).toBe(403);
    const body = await login.json();
    expect(body.code).toBe("banned");
    expect(body.reason).toBe("Triche au classement");
    expect(body.until).toBeTruthy();
    await fresh.dispose();
  });

  test("lever le ban : la raison est effacée, le joueur se reconnecte", async () => {
    const r = await admin.patch(`/api/admin/users/${playerId}`, {
      data: { is_banned: false },
      headers: await csrfHeader(admin),
    });
    expect(r.ok()).toBeTruthy();
    const detail = await (await admin.get(`/api/admin/users/${playerId}`)).json();
    expect(detail.user.is_banned).toBe(false);
    expect(detail.user.ban_reason).toBeNull();

    const login = await player.post("/api/auth/login", {
      data: { identifier: playerEmail, password: "test1234" },
    });
    expect(login.ok()).toBeTruthy();
  });

  test("message de l'équipe : envoyé par l'admin, vu une fois par le joueur, accusé", async () => {
    const sent = await admin.post(`/api/admin/users/${playerId}/notices`, {
      data: { type: "warning", message: "Dernier avertissement." },
      headers: await csrfHeader(admin),
    });
    expect(sent.status()).toBe(201);
    const { id } = await sent.json();

    const pending = await (await player.get("/api/notices/")).json();
    expect(pending.notices.map((n) => n.id)).toContain(id);

    const ack = await player.patch(`/api/notices/${id}`, { headers: await csrfHeader(player) });
    expect(ack.ok()).toBeTruthy();
    const after = await (await player.get("/api/notices/")).json();
    expect(after.notices.map((n) => n.id)).not.toContain(id);

    // L'historique côté admin garde la date de lecture
    const hist = await (await admin.get(`/api/admin/users/${playerId}/notices`)).json();
    expect(hist.notices.find((n) => n.id === id)?.read_at).toBeTruthy();
  });

  test("notes internes : admin seulement", async () => {
    const add = await admin.post(`/api/admin/users/${playerId}/notes`, {
      data: { note: "A déjà été averti." },
      headers: await csrfHeader(admin),
    });
    expect(add.status()).toBe(201);
    const { id } = await add.json();
    expect((await player.get(`/api/admin/users/${playerId}/notes`)).status()).toBe(403);
    const del = await admin.delete(`/api/admin/users/${playerId}/notes/${id}`, {
      headers: await csrfHeader(admin),
    });
    expect(del.ok()).toBeTruthy();
  });

  test("annonce : livrée par /me quand active, plus après désactivation", async () => {
    const created = await admin.post("/api/admin/announcements", {
      data: {
        level: "warning",
        message_fr: "Classement gelé ce soir.",
        message_en: "Leaderboard frozen tonight.",
      },
      headers: await csrfHeader(admin),
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();

    let me = await (await player.get("/api/auth/me")).json();
    expect(me.announcements.some((a) => a.id === id && a.level === "warning")).toBe(true);

    await admin.patch(`/api/admin/announcements/${id}`, {
      data: { is_active: false },
      headers: await csrfHeader(admin),
    });
    me = await (await player.get("/api/auth/me")).json();
    expect(me.announcements.some((a) => a.id === id)).toBe(false);
    await admin.delete(`/api/admin/announcements/${id}`, { headers: await csrfHeader(admin) });
  });

  test("maintenance : 503 pour le joueur, /me la décrit, l'admin passe, puis rouverture", async () => {
    const on = await admin.patch("/api/admin/settings", {
      data: {
        maintenance: {
          enabled: true,
          message_fr: "Migration",
          message_en: "Migration EN",
          until: "2026-12-31T23:00",
        },
      },
      headers: await csrfHeader(admin),
    });
    expect(on.ok()).toBeTruthy();
    expect((await on.json()).maintenance.enabled).toBe(true);

    const me = await (await player.get("/api/auth/me")).json();
    expect(me.maintenance?.message_fr).toBe("Migration");

    const blocked = await player.get("/api/sessions_today?mode=classic");
    expect(blocked.status()).toBe(503);
    expect((await blocked.json()).error).toBe("maintenance");

    const adminCall = await admin.get("/api/admin/settings");
    expect(adminCall.ok(), "l'admin continue d'administrer").toBeTruthy();

    const off = await admin.patch("/api/admin/settings", {
      data: { maintenance: { enabled: false } },
      headers: await csrfHeader(admin),
    });
    expect((await off.json()).maintenance.enabled).toBe(false);
    const reopened = await player.get("/api/sessions_today?mode=classic");
    expect(reopened.status()).not.toBe(503);
  });

  test("reset ciblé, anti-triche, tri et export CSV", async () => {
    const r = await admin.patch(`/api/admin/users/${playerId}`, {
      data: { reset_local_state: true },
      headers: await csrfHeader(admin),
    });
    expect((await r.json()).user.reset_local_state_at).toBeTruthy();
    expect((await (await player.get("/api/auth/me")).json()).reset_local_state_at).toBeTruthy();

    const ac = await admin.get("/api/admin/anticheat?days=30");
    expect(ac.ok()).toBeTruthy();
    expect(Array.isArray((await ac.json()).users)).toBe(true);
    expect((await player.get("/api/admin/anticheat")).status()).toBe(403);

    expect((await admin.get("/api/admin/users?sort=last_login&limit=3")).ok()).toBeTruthy();
    const csv = await admin.get("/api/admin/users?export=csv");
    expect(csv.ok()).toBeTruthy();
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("id;pseudo;email");
  });
});
