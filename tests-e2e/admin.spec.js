import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Tests E2E via l'API sur les endpoints admin (api/admin/*.php) — jusqu'ici
 * aucun test (unitaire ou E2E) n'exerçait réellement ces routes, seule leur
 * syntaxe était vérifiée (php -l) et leur logique statique (PHPStan).
 *
 * Utilise le compte admin de seed (docker/mysql/init/02_seed_test.sql,
 * admin@personadle.local / is_admin=1) — nécessite `make up` avec une base
 * fraîche (le seed ne tourne qu'à la première init du volume Docker).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe.serial("API — endpoints admin (requireAdmin, listes)", () => {
  let adminCtx;
  let userCtx;

  test.beforeAll(async () => {
    adminCtx = await pwRequest.newContext({ baseURL: BASE });
    const loginRes = await adminCtx.post("/api/auth/login", {
      data: { identifier: "admin@personadle.local", password: "admintest123" },
    });
    expect(
      loginRes.ok(),
      "login admin doit réussir — vérifier que `make up` a bien tourné avec une base fraîche (le seed admin ne s'exécute qu'à la première init du volume)"
    ).toBeTruthy();

    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    userCtx = await pwRequest.newContext({ baseURL: BASE });
    const registerRes = await userCtx.post("/api/auth/register", {
      data: {
        email: `e2e_admin_check_${rnd}@test.local`,
        pseudo: `e2e_adm_${rnd}`.slice(0, 20),
        password: "test1234",
      },
    });
    expect(registerRes.ok(), "register d'un utilisateur normal doit réussir").toBeTruthy();
  });

  test.afterAll(async () => {
    await adminCtx?.dispose();
    await userCtx?.dispose();
  });

  test("GET /api/admin/users réussit pour un admin", async () => {
    const res = await adminCtx.get("/api/admin/users?page=1&limit=5");
    expect(res.ok(), "GET /api/admin/users doit réussir pour un admin").toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.users)).toBe(true);
  });

  test("GET /api/admin/users échoue (403) pour un utilisateur non-admin", async () => {
    const res = await userCtx.get("/api/admin/users?page=1&limit=5");
    expect(res.status()).toBe(403);
  });

  test("GET /api/admin/audit_log réussit pour un admin", async () => {
    const res = await adminCtx.get("/api/admin/audit_log?page=1&limit=5");
    expect(res.ok(), "GET /api/admin/audit_log doit réussir pour un admin").toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /api/admin/audit_log échoue (403) pour un utilisateur non-admin", async () => {
    const res = await userCtx.get("/api/admin/audit_log?page=1&limit=5");
    expect(res.status()).toBe(403);
  });

  test("GET /api/admin/rate_limits réussit pour un admin", async () => {
    const res = await adminCtx.get("/api/admin/rate_limits?page=1&limit=5");
    expect(res.ok(), "GET /api/admin/rate_limits doit réussir pour un admin").toBeTruthy();
  });

  test("PATCH /api/admin/users/:id (ban) échoue (403) pour un utilisateur non-admin", async () => {
    const res = await userCtx.patch("/api/admin/users/1", {
      data: { is_banned: true },
      headers: await csrfHeader(userCtx),
    });
    expect(res.status()).toBe(403);
  });
});
