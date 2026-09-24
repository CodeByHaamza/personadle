import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Classement des AMITIÉS (2.3) — la troisième dimension du classement.
 *
 * Ce que seul un parcours complet peut dire :
 *   - la route répond bien avec le slash final (piège Apache, CLAUDE.md §7) ;
 *   - un lien fraîchement créé, sans XP, n'apparaît PAS — sinon le classement
 *     se remplirait de paires à zéro et n'aurait plus aucun sens ;
 *   - le classement est bien trié par XP, ce qui est tout l'objet du lot 8 :
 *     les premières paires sont toutes au rang 10, seule l'XP les départage ;
 *   - aucun code ami ne fuit dans une liste publique.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe("Classement — amitiés", () => {
  test("la route répond, trie par XP et n'expose aucun code ami", async ({ request }) => {
    const res = await request.get("/api/leaderboard/?view=bonds&limit=20");
    expect(res.status()).toBe(200);
    const data = await res.json();

    expect(data.view).toBe("bonds");
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.total).toBeGreaterThan(0);

    const xps = data.entries.map((e) => e.xp);
    expect([...xps].sort((a, b) => b - a)).toEqual(xps);

    for (const e of data.entries) {
      expect(e.xp, "aucun lien à 0 XP dans le classement").toBeGreaterThan(0);
      for (const cote of [e.a, e.b]) {
        expect(cote.pseudo).toBeTruthy();
        expect(cote, "le code ami n'a rien à faire dans une liste publique").not.toHaveProperty(
          "friend_code"
        );
      }
      expect(e.a.user_id).not.toBe(e.b.user_id);
    }
  });

  test("un lien tout neuf, sans XP, n'entre pas dans le classement", async () => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const faire = async (suffixe) => {
      const pseudo = `bnd${suffixe}${rnd}`.slice(0, 20);
      const ctx = await pwRequest.newContext({ baseURL: BASE });
      const r = await ctx.post("/api/auth/register", {
        data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
      });
      expect(r.ok()).toBeTruthy();
      const b = await r.json();
      return { ctx, id: b.user.id, code: b.user.friend_code, pseudo };
    };

    const a = await faire("a");
    const b = await faire("b");

    // Amitié acceptée → le Social Link existe, mais il est à 0 XP.
    const dem = await a.ctx.post("/api/friends/", {
      data: { friend_code: b.code },
      headers: await csrfHeader(a.ctx),
    });
    expect(dem.ok()).toBeTruthy();
    const { friendship_id } = await dem.json();
    expect(
      (
        await b.ctx.patch(`/api/friends/${friendship_id}`, {
          data: { action: "accept" },
          headers: await csrfHeader(b.ctx),
        })
      ).ok()
    ).toBeTruthy();

    const res = await a.ctx.get("/api/leaderboard/?view=bonds&limit=100&friends_only=1");
    expect(res.status()).toBe(200);
    const data = await res.json();
    const leNotre = (data.entries ?? []).find(
      (e) =>
        (e.a.user_id === a.id && e.b.user_id === b.id) ||
        (e.a.user_id === b.id && e.b.user_id === a.id)
    );
    expect(leNotre, "un lien à 0 XP ne doit pas être classé").toBeUndefined();

    await a.ctx.dispose();
    await b.ctx.dispose();
  });

  test("l'onglet affiche des paires et masque les filtres sans objet", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await gotoSettled(page, "/profile/leaderboard/leaderboard.html");

    await page.locator('#dimensionFilter .lb-pill[data-value="bonds"]').click();

    const lignes = page.locator(".lb-bond-row");
    await expect(lignes.first()).toBeVisible({ timeout: 15000 });
    // Deux joueurs par ligne : c'est ce qui distingue ce classement des autres.
    await expect(lignes.first().locator(".lb-bond-side")).toHaveCount(2);

    // Mode / période / métrique n'ont aucun sens ici : masqués, pas grisés.
    for (const id of ["#modeFilter", "#periodFilter", "#metricFilter"]) {
      await expect(page.locator(id)).toBeHidden();
    }

    // Retour sur Normal : tout revient, et les lignes redeviennent individuelles.
    await page.locator('#dimensionFilter .lb-pill[data-value="normal"]').click();
    await expect(page.locator("#modeFilter")).toBeVisible();
    await expect(page.locator(".lb-bond-row")).toHaveCount(0);
  });
});
