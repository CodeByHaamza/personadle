import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Filtre « Animés » de la galerie de portraits (2.3).
 *
 * Ce que seul un vrai navigateur peut dire : que les portraits animés se
 * CHARGENT (un WebP animé est un format à part, servi par Apache et décodé par
 * le moteur — un `.htaccess` ou un type MIME de travers le casserait sans qu'un
 * test unitaire s'en aperçoive), et que le filtre réduit bien la grille sans
 * perdre le découpage par jeu.
 *
 * Aucun de ces portraits ne se débloque : le filtre est un confort d'affichage,
 * et ce test vérifie aussi ça — un compte NEUF les voit tous.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

test.describe("Galerie — filtre Animés", () => {
  test("un compte neuf voit tous les animés, et le filtre réduit la grille", async ({
    browser,
  }) => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const pseudo = `anim${rnd}`.slice(0, 20);
    const api = await pwRequest.newContext({ baseURL: BASE });
    expect(
      (
        await api.post("/api/auth/register", {
          data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
        })
      ).ok()
    ).toBeTruthy();

    const ctx = await browser.newContext({ storageState: await api.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    await page.locator("#openAtelierBtn").click();
    await page.locator('.atelier-tab[data-pane="avatar"]').click();

    const cellules = page.locator("#avatarGrid .avatar-cell");
    await expect(cellules.first()).toBeVisible({ timeout: 15000 });
    const total = await cellules.count();
    expect(total).toBeGreaterThan(300);

    // Les pastilles ANIM sont posées d'après le contenu des fichiers, pas
    // d'après l'extension : elles doivent déjà être là dans la vue « Tous ».
    const pastilles = await page.locator("#avatarGrid .avatar-tag--gif").count();
    expect(pastilles).toBeGreaterThan(0);

    await page.locator('.avatar-filter-tab[data-filter="animated"]').click();
    const filtre = await cellules.count();
    expect(filtre).toBe(pastilles);
    expect(filtre).toBeLessThan(total);
    // Le découpage par jeu survit au filtre.
    expect(await page.locator("#avatarGrid .avatar-group-header").count()).toBeGreaterThan(1);

    // Un compte NEUF : rien n'est verrouillé, tous les animés sont choisissables.
    await expect(page.locator("#avatarGrid .avatar-cell img").first()).toBeVisible();

    // Le WebP ANIMÉ se décode réellement — c'est le point qu'aucun test
    // unitaire ne couvre.
    const anime = page.locator('#avatarGrid img[src*="_anim_"]').first();
    await expect(anime).toBeVisible();
    await expect
      .poll(() => anime.evaluate((el) => el.complete && el.naturalWidth > 0), { timeout: 10000 })
      .toBe(true);

    await page.locator('.avatar-filter-tab[data-filter="all"]').click();
    expect(await cellules.count()).toBe(total);

    await ctx.close();
    await api.dispose();
  });

  test("choisir un portrait animé l'enregistre côté serveur", async ({ browser }) => {
    // Le piège de la 2.2 (`Kanji.avif`) : un portrait choisissable mais refusé
    // par la liste blanche serveur restait local et disparaissait au pull cloud.
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const pseudo = `anpk${rnd}`.slice(0, 20);
    const api = await pwRequest.newContext({ baseURL: BASE });
    await api.post("/api/auth/register", {
      data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
    });

    const ctx = await browser.newContext({ storageState: await api.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.locator("#openAtelierBtn").click();
    await page.locator('.atelier-tab[data-pane="avatar"]').click();
    await page.locator('.avatar-filter-tab[data-filter="animated"]').click();

    const anime = page.locator('#avatarGrid img[src*="_anim_"]').first();
    await expect(anime).toBeVisible({ timeout: 15000 });
    const choisi = await anime.getAttribute("data-src");
    await anime.click();

    const me = await (await api.get("/api/auth/me")).json();
    const id = me.user?.id ?? me.id;
    await expect
      .poll(
        async () => {
          const p = await (await api.get(`/api/user/${id}`)).json();
          return p.profile?.avatar_data ?? null;
        },
        { timeout: 15000 }
      )
      .toBe(choisi);

    await ctx.close();
    await api.dispose();
  });
});
