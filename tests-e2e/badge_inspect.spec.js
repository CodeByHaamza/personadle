import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Consulter la fiche d'un badge sans l'épingler (2.3).
 *
 * Ce que seul un vrai parcours peut dire : que cliquer l'œil n'épingle PAS. Dans
 * la grille, un clic sur une carte épingle ou dépingle — l'œil vit dessus et doit
 * arrêter la propagation. S'il ne le faisait pas, regarder un badge le
 * modifierait, soit exactement le problème que ce bouton résout.
 *
 * Le détail de ce qu'une fiche montre (et surtout de ce qu'un badge SECRET
 * verrouillé ne montre pas) est couvert sans navigateur dans
 * tests/badgeInspect.test.js.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe("Badges — inspecter sans épingler", () => {
  test("l'œil ouvre la fiche et ne touche pas aux badges épinglés", async ({ browser }) => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const pseudo = `isp${rnd}`.slice(0, 20);
    const api = await pwRequest.newContext({ baseURL: BASE });
    expect(
      (
        await api.post("/api/auth/register", {
          data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
        })
      ).ok()
    ).toBeTruthy();
    expect(
      (
        await api.post("/api/badges/unlock", {
          data: { badge_id: "velvet_headache" },
          headers: await csrfHeader(api),
        })
      ).ok()
    ).toBeTruthy();

    const ctx = await browser.newContext({ storageState: await api.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.locator("#openBadgesModal").click();

    const carte = page.locator('.badge-item[data-unlocked="true"]').first();
    await expect(carte).toBeVisible({ timeout: 15000 });
    await carte.scrollIntoViewIfNeeded();

    // Un œil sur chaque carte, y compris les verrouillées.
    expect(await page.locator(".badge-inspect-btn").count()).toBeGreaterThan(1);

    await carte.locator(".badge-inspect-btn").click({ force: true });

    const fiche = page.locator(".badge-zoom-content");
    await expect(fiche).toBeVisible();
    await expect(fiche.locator("h3")).not.toBeEmpty();
    await expect(fiche.locator(".badge-condition")).not.toBeEmpty();

    // LE point du lot : rien n'a été épinglé.
    expect(await page.locator(".badge-item.selected").count()).toBe(0);

    // Échap referme la fiche SANS refermer la modale des badges derrière.
    await page.keyboard.press("Escape");
    await expect(fiche).toHaveCount(0);
    await expect(page.locator("#badgesModal")).toBeVisible();

    await ctx.close();
    await api.dispose();
  });

  test("un clic sur la carte elle-même épingle toujours", async ({ browser }) => {
    // Garde-fou inverse : l'œil ne doit pas neutraliser le comportement normal.
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const pseudo = `isq${rnd}`.slice(0, 20);
    const api = await pwRequest.newContext({ baseURL: BASE });
    await api.post("/api/auth/register", {
      data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
    });
    await api.post("/api/badges/unlock", {
      data: { badge_id: "velvet_headache" },
      headers: await csrfHeader(api),
    });

    const ctx = await browser.newContext({ storageState: await api.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.locator("#openBadgesModal").click();

    const carte = page.locator('.badge-item[data-unlocked="true"]').first();
    await expect(carte).toBeVisible({ timeout: 15000 });
    await carte.scrollIntoViewIfNeeded();
    await carte.click({ position: { x: 5, y: 60 } });

    await expect(page.locator(".badge-item.selected")).toHaveCount(1);

    await ctx.close();
    await api.dispose();
  });
});
