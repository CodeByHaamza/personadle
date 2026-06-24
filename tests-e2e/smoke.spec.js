import { test, expect } from "@playwright/test";

/**
 * Smoke tests end-to-end — vérifient qu'une page se charge réellement dans un
 * navigateur (pas seulement la logique unitaire). Point de départ à étoffer :
 * parcours de jeu complet, ouverture du menu Jack Frost, changement de langue…
 */

test.describe("PersonaDLE — smoke", () => {
  test("la page d'accueil se charge avec le bon titre", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page).toHaveTitle(/personadle/i);
  });

  test("le mode Classique est accessible", async ({ page }) => {
    await page.goto("/classiqueMode/classiqueMode.html");
    await expect(page).toHaveTitle(/classic/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("aucune erreur console critique au chargement de l'accueil", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");
    expect(errors, `Erreurs JS au chargement :\n${errors.join("\n")}`).toEqual([]);
  });
});
