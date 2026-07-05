import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Tests E2E via l'API pour les endpoints admin qui n'étaient couverts par
 * AUCUN test avant ce fichier (ni Vitest, ni E2E, ni PHPUnit — seule leur
 * syntaxe (php -l) et leur logique statique (PHPStan) étaient vérifiées) :
 *
 *   api/admin/event_codes.php, error_logs.php, deletion_requests.php,
 *   social_links.php, user_badges.php, user_titles.php, user_wallpapers.php,
 *   user_stats.php, user_friends.php
 *
 * Complète tests-e2e/admin.spec.js, qui ne couvrait que users/audit_log/rate_limits.
 * Même compte admin de seed (docker/mysql/init/02_seed_test.sql) — nécessite
 * `make up` avec une base fraîche.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe.serial("API — endpoints admin étendus (event codes, logs, RGPD, social links, dons utilisateur)", () => {
  let adminCtx;
  let userCtx;
  let targetUserId;

  test.beforeAll(async () => {
    adminCtx = await pwRequest.newContext({ baseURL: BASE });
    const loginRes = await adminCtx.post("/api/auth/login", {
      data: { identifier: "admin@personadle.local", password: "admintest123" },
    });
    expect(
      loginRes.ok(),
      "login admin doit réussir — vérifier que `make up` a bien tourné avec une base fraîche"
    ).toBeTruthy();

    // Utilisateur non-admin pour les vérifications 403
    const rndA = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    userCtx = await pwRequest.newContext({ baseURL: BASE });
    const registerUserRes = await userCtx.post("/api/auth/register", {
      data: {
        email: `e2e_adm_ext_user_${rndA}@test.local`,
        pseudo: `e2eAEU${rndA}`.slice(0, 20),
        password: "test1234",
      },
    });
    expect(registerUserRes.ok(), "register d'un utilisateur normal doit réussir").toBeTruthy();

    // Utilisateur cible pour les tests de don (badges/titres/wallpapers/stats)
    const rndB = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const targetCtx = await pwRequest.newContext({ baseURL: BASE });
    const registerTargetRes = await targetCtx.post("/api/auth/register", {
      data: {
        email: `e2e_adm_ext_target_${rndB}@test.local`,
        pseudo: `e2eAET${rndB}`.slice(0, 20),
        password: "test1234",
      },
    });
    expect(registerTargetRes.ok(), "register de l'utilisateur cible doit réussir").toBeTruthy();
    const targetBody = await registerTargetRes.json();
    targetUserId = targetBody.user?.id ?? targetBody.id;
    expect(targetUserId, "l'id de l'utilisateur cible doit être présent dans la réponse register").toBeTruthy();
    await targetCtx.dispose();
  });

  test.afterAll(async () => {
    await adminCtx?.dispose();
    await userCtx?.dispose();
  });

  // ── Event Codes ──────────────────────────────────────────────────────────
  test.describe("event_codes", () => {
    const code = "E2E_TEST_" + Date.now().toString(36).toUpperCase();

    test("GET /api/admin/event_codes échoue (403) pour un non-admin", async () => {
      const res = await userCtx.get("/api/admin/event_codes");
      expect(res.status()).toBe(403);
    });

    test("POST /api/admin/event_codes crée un code (admin)", async () => {
      const res = await adminCtx.post("/api/admin/event_codes", {
        data: {
          code,
          badge_id: "first_win",
          description: "E2E test code",
          is_permanent: true,
          is_active: true,
        },
        headers: await csrfHeader(adminCtx),
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    });

    test("GET /api/admin/event_codes liste le code créé", async () => {
      const res = await adminCtx.get("/api/admin/event_codes");
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.some((c) => c.code === code)).toBe(true);
    });

    test("PATCH /api/admin/event_codes/:code désactive le code", async () => {
      const res = await adminCtx.patch(`/api/admin/event_codes/${code}`, {
        data: { is_active: false },
        headers: await csrfHeader(adminCtx),
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    });

    test("DELETE /api/admin/event_codes/:code supprime le code", async () => {
      const res = await adminCtx.delete(`/api/admin/event_codes/${code}`, {
        headers: await csrfHeader(adminCtx),
      });
      expect(res.ok(), await res.text()).toBeTruthy();

      const listRes = await adminCtx.get("/api/admin/event_codes");
      const body = await listRes.json();
      expect(body.some((c) => c.code === code)).toBe(false);
    });
  });

  // ── Error Logs ───────────────────────────────────────────────────────────
  test.describe("error_logs", () => {
    test("GET /api/admin/error_logs échoue (403) pour un non-admin", async () => {
      const res = await userCtx.get("/api/admin/error_logs");
      expect(res.status()).toBe(403);
    });

    test("GET /api/admin/error_logs réussit pour un admin (pagination)", async () => {
      const res = await adminCtx.get("/api/admin/error_logs?page=1&limit=5");
      expect(res.ok(), await res.text()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe("number");
    });
  });

  // ── RGPD Deletion Requests ───────────────────────────────────────────────
  test.describe("deletion_requests", () => {
    test("GET /api/admin/deletion_requests échoue (403) pour un non-admin", async () => {
      const res = await userCtx.get("/api/admin/deletion_requests");
      expect(res.status()).toBe(403);
    });

    test("GET /api/admin/deletion_requests réussit pour un admin (pagination)", async () => {
      const res = await adminCtx.get("/api/admin/deletion_requests?page=1&limit=5");
      expect(res.ok(), await res.text()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });

    test("POST /api/admin/deletion_requests/:id/process échoue (403) pour un non-admin", async () => {
      const res = await userCtx.post("/api/admin/deletion_requests/999999/process", {
        data: {},
        headers: await csrfHeader(userCtx),
      });
      expect(res.status()).toBe(403);
    });
  });

  // ── Social Links ─────────────────────────────────────────────────────────
  test.describe("social-links", () => {
    test("GET /api/admin/social-links échoue (403) pour un non-admin", async () => {
      const res = await userCtx.get("/api/admin/social-links");
      expect(res.status()).toBe(403);
    });

    test("GET /api/admin/social-links réussit pour un admin (pagination)", async () => {
      const res = await adminCtx.get("/api/admin/social-links?page=1&limit=5");
      expect(res.ok(), await res.text()).toBeTruthy();
      const body = await res.json();
      expect(Array.isArray(body.links)).toBe(true);
    });

    test("GET /api/admin/social-links/:id renvoie 404 pour un id inexistant", async () => {
      const res = await adminCtx.get("/api/admin/social-links/999999999");
      expect(res.status()).toBe(404);
    });
  });

  // ── User Badges/Titles/Wallpapers (dons) ─────────────────────────────────
  test.describe("dons utilisateur (badges/titres/wallpapers)", () => {
    test("POST /api/admin/users/:id/badges échoue (403) pour un non-admin", async () => {
      const res = await userCtx.post(`/api/admin/users/${targetUserId}/badges`, {
        data: { slug: "first_win" },
        headers: await csrfHeader(userCtx),
      });
      expect(res.status()).toBe(403);
    });

    test("accorde puis retire le badge 'first_win' (admin)", async () => {
      const grant1 = await adminCtx.post(`/api/admin/users/${targetUserId}/badges`, {
        data: { slug: "first_win" },
        headers: await csrfHeader(adminCtx),
      });
      expect(grant1.ok(), await grant1.text()).toBeTruthy();
      expect((await grant1.json()).already_had).toBe(false);

      // Deuxième appel — déjà possédé
      const grant2 = await adminCtx.post(`/api/admin/users/${targetUserId}/badges`, {
        data: { slug: "first_win" },
        headers: await csrfHeader(adminCtx),
      });
      expect(grant2.ok()).toBeTruthy();
      expect((await grant2.json()).already_had).toBe(true);

      const revoke = await adminCtx.delete(`/api/admin/users/${targetUserId}/badges/first_win`, {
        headers: await csrfHeader(adminCtx),
      });
      expect(revoke.ok(), await revoke.text()).toBeTruthy();
    });

    test("POST /api/admin/users/:id/badges échoue (404) pour un slug inconnu", async () => {
      const res = await adminCtx.post(`/api/admin/users/${targetUserId}/badges`, {
        data: { slug: "slug_qui_nexiste_pas_e2e" },
        headers: await csrfHeader(adminCtx),
      });
      expect(res.status()).toBe(404);
    });

    test("accorde, équipe puis retire un titre du catalogue (admin)", async () => {
      const catalogRes = await adminCtx.get("/api/titles");
      expect(catalogRes.ok()).toBeTruthy();
      const catalog = await catalogRes.json();
      const titles = Array.isArray(catalog) ? catalog : (catalog.titles ?? []);
      expect(titles.length, "le catalogue de titres doit contenir au moins une entrée (seed)").toBeGreaterThan(0);
      const titleId = titles[0].id;

      const grant = await adminCtx.post(`/api/admin/users/${targetUserId}/titles`, {
        data: { title_id: titleId },
        headers: await csrfHeader(adminCtx),
      });
      expect(grant.ok(), await grant.text()).toBeTruthy();

      const equip = await adminCtx.patch(`/api/admin/users/${targetUserId}/titles/equip`, {
        data: { title_id: titleId },
        headers: await csrfHeader(adminCtx),
      });
      expect(equip.ok(), await equip.text()).toBeTruthy();

      const unequip = await adminCtx.patch(`/api/admin/users/${targetUserId}/titles/equip`, {
        data: { title_id: null },
        headers: await csrfHeader(adminCtx),
      });
      expect(unequip.ok(), await unequip.text()).toBeTruthy();

      const revoke = await adminCtx.delete(`/api/admin/users/${targetUserId}/titles/${titleId}`, {
        headers: await csrfHeader(adminCtx),
      });
      expect(revoke.ok(), await revoke.text()).toBeTruthy();
    });

    test("accorde puis retire un wallpaper du catalogue (admin)", async () => {
      const catalogRes = await adminCtx.get("/api/wallpapers");
      expect(catalogRes.ok()).toBeTruthy();
      const catalog = await catalogRes.json();
      const wallpapers = Array.isArray(catalog) ? catalog : (catalog.wallpapers ?? []);
      expect(wallpapers.length, "le catalogue de wallpapers doit contenir au moins une entrée (seed)").toBeGreaterThan(0);
      const wallpaperId = wallpapers[0].id;

      const grant = await adminCtx.post(`/api/admin/users/${targetUserId}/wallpapers`, {
        data: { wallpaper_id: wallpaperId },
        headers: await csrfHeader(adminCtx),
      });
      expect(grant.ok(), await grant.text()).toBeTruthy();
      expect((await grant.json()).already_had).toBe(false);

      const revoke = await adminCtx.delete(
        `/api/admin/users/${targetUserId}/wallpapers/${wallpaperId}`,
        { headers: await csrfHeader(adminCtx) }
      );
      expect(revoke.ok(), await revoke.text()).toBeTruthy();
    });
  });

  // ── User Stats (overwrite admin) ─────────────────────────────────────────
  test.describe("user_stats", () => {
    test("PATCH /api/admin/users/:id/stats échoue (403) pour un non-admin", async () => {
      const res = await userCtx.patch(`/api/admin/users/${targetUserId}/stats`, {
        data: { mode: "classic", wins: 1, giveups: 0, games: 1, streak: 1, streak_record: 1, perfect_wins: 0 },
        headers: await csrfHeader(userCtx),
      });
      expect(res.status()).toBe(403);
    });

    test("écrase les stats classic d'un utilisateur (admin)", async () => {
      const res = await adminCtx.patch(`/api/admin/users/${targetUserId}/stats`, {
        data: {
          mode: "classic",
          wins: 12,
          giveups: 3,
          games: 15,
          streak: 4,
          streak_record: 6,
          perfect_wins: 2,
        },
        headers: await csrfHeader(adminCtx),
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    });

    test("échoue (400) avec un mode invalide", async () => {
      const res = await adminCtx.patch(`/api/admin/users/${targetUserId}/stats`, {
        data: { mode: "not_a_real_mode", wins: 1, giveups: 0, games: 1, streak: 0, streak_record: 0, perfect_wins: 0 },
        headers: await csrfHeader(adminCtx),
      });
      expect(res.status()).toBe(400);
    });

    test("échoue (400) avec un champ requis manquant", async () => {
      const res = await adminCtx.patch(`/api/admin/users/${targetUserId}/stats`, {
        data: { mode: "classic", wins: 1 }, // giveups/games/streak/streak_record/perfect_wins manquants
        headers: await csrfHeader(adminCtx),
      });
      expect(res.status()).toBe(400);
    });
  });

  // ── User Friends (suppression forcée) ────────────────────────────────────
  test.describe("user_friends", () => {
    test("DELETE /api/admin/users/:id/friends/:fid échoue (403) pour un non-admin", async () => {
      const res = await userCtx.delete(`/api/admin/users/${targetUserId}/friends/999999`, {
        headers: await csrfHeader(userCtx),
      });
      expect(res.status()).toBe(403);
    });

    test("échoue (404) pour une amitié inexistante", async () => {
      const res = await adminCtx.delete(`/api/admin/users/${targetUserId}/friends/999999999`, {
        headers: await csrfHeader(adminCtx),
      });
      expect(res.status()).toBe(404);
    });
  });
});
