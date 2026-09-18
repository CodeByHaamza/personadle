import { test, expect } from "@playwright/test";

/**
 * Le Compendium (carnet de collection, 2.2) — stack complète.
 *
 * Couvre ce qu'aucun test unitaire ne voit : la route .htaccess
 * (`/api/user/compendium`), l'accès public par code ami, le bouton du profil
 * visité qui pointe vers le carnet du bon joueur, et l'ouverture du livre.
 *
 * Pré-requis : `make up` (DB seedée — SEED2226 = Yu).
 */

test.describe("Compendium", () => {
  test("l'API répond en public par code ami (route .htaccess)", async ({ request }) => {
    const res = await request.get("/api/user/compendium?code=SEED2226");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.user.pseudo).toBe("Yu");
    for (const k of ["badges", "titles", "wallpapers", "friends", "challenges"]) {
      expect(Array.isArray(data[k]), k).toBe(true);
    }
    expect(data.feats).toHaveProperty("total_games");
  });

  test("l'API refuse un code inconnu (404) et exige la session sans cible", async ({ request }) => {
    expect((await request.get("/api/user/compendium?code=NOPE0000")).status()).toBe(404);
    expect((await request.get("/api/user/compendium")).status()).toBe(401);
  });

  test("depuis un profil visité, le bouton Compendium mène au carnet de ce joueur", async ({
    page,
  }) => {
    await page.goto("/profile/profile.html?view=SEED2226");
    const btn = page.locator("#compendiumBtn");
    await expect(btn).toBeVisible({ timeout: 15000 });
    await expect(btn).toHaveAttribute("href", /compendium\.html\?view=SEED2226$/);
  });

  test("le carnet d'un joueur s'ouvre sans être connecté : couverture → livre → chapitres", async ({
    page,
  }) => {
    await page.goto("/profile/compendium/compendium.html?view=SEED2226");
    await expect(page.locator("#cpOwner")).toHaveText("Yu", { timeout: 15000 });
    const open = page.locator("#cpOpenBtn");
    await expect(open).toBeEnabled();
    await open.click();
    await expect(page.locator("#cpBook")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".cp-tab")).toHaveCount(6);
    await expect(page.locator(".cp-tab.active")).toHaveAttribute("data-chapter", "badges");
    await expect(page.locator("#cpPagerInfo")).toHaveText(/^\d+ \/ \d+$/);

    // Changer de chapitre : la page de gauche suit
    await page.locator('.cp-tab[data-chapter="feats"]').click();
    await expect(page.locator(".cp-tab.active")).toHaveAttribute("data-chapter", "feats");
    await expect(page.locator("#cpPageLeft .cp-stats .cp-stat")).toHaveCount(4);
  });
});
