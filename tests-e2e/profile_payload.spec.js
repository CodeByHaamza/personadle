import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Ouvrir son profil ne doit pas télécharger tout le catalogue de badges.
 *
 * ── Ce qui a été mesuré le 2026-09-24 ────────────────────────────────────────
 * Sur un écran de 390 px, ouvrir la page profil transférait **125,6 Mo** — dont
 * 85,9 Mo de badges et 28,5 Mo de wallpapers. La grille de la modale des badges
 * était rendue dans le DOM dès le chargement, sans `loading="lazy"` : les 73
 * images partaient alors que la modale était FERMÉE et ne serait peut-être
 * jamais ouverte.
 *
 * Sur un forfait mobile, consulter son profil coûtait donc plus de 100 Mo. C'est
 * le genre de chose qu'on ne voit jamais en développement — le cache local et la
 * fibre l'effacent complètement.
 *
 * Après correctif : **13,5 Mo**, et les badges ne se chargent qu'à l'ouverture de
 * la modale, au fur et à mesure du défilement.
 *
 * Ce test mesure ce que le NAVIGATEUR dit avoir transféré (`transferSize`), pas
 * ce que le disque contient.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

/** Octets transférés pour les images d'un dossier donné. */
const transfere = (page, motif) =>
  page.evaluate(
    (m) =>
      performance
        .getEntriesByType("resource")
        .filter((r) => new RegExp(m).test(r.name))
        .reduce((a, r) => a + (r.transferSize || 0), 0),
    motif
  );

test.describe("Profil — poids au chargement", () => {
  test("les badges ne se chargent PAS tant que la modale est fermée", async ({ browser }) => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const pseudo = `pld${rnd}`.slice(0, 20);
    const api = await pwRequest.newContext({ baseURL: BASE });
    expect(
      (
        await api.post("/api/auth/register", {
          data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
        })
      ).ok()
    ).toBeTruthy();

    // Mobile : c'est là que le coût compte vraiment.
    const ctx = await browser.newContext({
      storageState: await api.storageState(),
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.waitForTimeout(2500);

    const badgesAvant = await transfere(page, "badges/images");
    expect(
      badgesAvant,
      "aucune image de badge ne doit être transférée avant l'ouverture de la modale"
    ).toBe(0);

    // …mais elles arrivent bien quand on ouvre.
    await page.locator("#openBadgesModal").click();
    await expect(page.locator("#badgesGrid .badge-item").first()).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => transfere(page, "badges/images"), { timeout: 15000 })
      .toBeGreaterThan(0);

    // Et aucune n'est cassée.
    const cassees = await page
      .locator("#badgesGrid img")
      .evaluateAll((els) => els.filter((e) => e.complete && e.naturalWidth === 0).length);
    expect(cassees, "images de badge cassées dans la grille").toBe(0);

    await ctx.close();
    await api.dispose();
  });
});
