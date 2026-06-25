import { test, expect } from "@playwright/test";

/**
 * Smoke tests end-to-end sur la stack Docker complète (PHP + MariaDB + seed).
 * Couvre les parcours qui ont cassé en cours de route (login, leaderboard,
 * profil public) — ce qu'aucun test unitaire ne voyait.
 *
 * Pré-requis : `make up` (DB seedée avec 19 faux joueurs, mdp test1234).
 */

test.describe("PersonaDLE — smoke (stack complète)", () => {
  test("la page d'accueil se charge", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page).toHaveTitle(/personadle/i);
  });

  test("le mode All-Out Attack se charge", async ({ page }) => {
    await page.goto("/allOutAttackMode/allOutAttack.html");
    await expect(page).toHaveTitle(/all.?out|personadle/i);
  });

  test("le leaderboard affiche les faux joueurs (DB + API + front)", async ({ page }) => {
    await page.goto("/profile/leaderboard/leaderboard.html");
    // Le classement se charge en async (fetch) → attendre une ligne, puis vérifier un pseudo seed.
    await page.locator(".lb-pseudo").first().waitFor({ state: "visible", timeout: 25000 });
    await expect(page.locator(".lb-pseudo", { hasText: /Wonder|Ren|Akechi|Yu/ }).first()).toBeVisible();
  });

  test("un profil public est consultable SANS être connecté (?view=)", async ({ page }) => {
    await page.goto("/profile/profile.html?view=SEED2226"); // Yu
    await expect(page.getByText("Yu", { exact: true }).first()).toBeVisible({ timeout: 15000 });
  });

  test("login d'un faux joueur (parcours auth réel)", async ({ page }) => {
    await page.goto("/profile/profile.html");
    await page.waitForLoadState("networkidle");
    // Ouvrir la modale de connexion puis attendre qu'elle soit visible
    await page.locator('[data-open-modal="loginModal"]').first().click();
    const modal = page.locator("#loginModal");
    await modal.waitFor({ state: "visible", timeout: 10000 });
    await modal.locator("#loginEmail").fill("ren@personadle.seed");
    await modal.locator("#loginPassword").fill("test1234");
    await modal.locator('button[type="submit"]').first().click();
    // Succès : la modale se ferme (et pas d'erreur affichée).
    await expect(modal).toBeHidden({ timeout: 15000 });
  });
});
