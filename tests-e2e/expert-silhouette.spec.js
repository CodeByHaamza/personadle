import { test, expect } from "@playwright/test";

// Compte pré-débloqué (tests-e2e/global-setup.js) : la porte d'entrée du Mode
// Expert (js/gameCore.js::applyExpertGate) redirige `?expert=1` vers le mode
// normal pour un visiteur non débloqué — ces tests couvrent le GAMEPLAY
// Expert, pas cette redirection.
test.use({ storageState: "playwright/.auth/silhouette.json" });

/**
 * Silhouette Expert — la silhouette n'apparaît qu'en flash.
 *
 * Ce qui est vérifié en priorité : l'image est réellement **invisible** entre
 * deux flashs, et le flash est **payant** (un crédit consommé par appui, +1 par
 * erreur). Un bouton FLASH qui laisserait l'image affichée, ou des crédits
 * infinis, ramèneraient le mode normal sans le dézoom.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const EXPERT = "/silhouetteMode/silhouette.html?expert=1";
const NORMAL = "/silhouetteMode/silhouette.html";

const opacite = (page) =>
  page.evaluate(() => getComputedStyle(document.getElementById("silhouetteImage")).opacity);

const credits = (page) =>
  page.evaluate(() => Number(localStorage.getItem("silhouetteExpert_silhouetteFlashes")));

/** Noms sûrs : jamais la cible du jour, sinon la partie se gagne par accident. */
async function fauxNoms(page, n) {
  const cible = await page.evaluate(
    () => JSON.parse(localStorage.getItem("silhouetteExpert_silhouetteTarget") || "null")?.nom
  );
  return [
    "Yukari Takeba",
    "Junpei Iori",
    "Akihiko Sanada",
    "Mitsuru Kirijo",
    "Chie Satonaka",
    "Yosuke Hanamura",
  ]
    .filter((nom) => nom !== cible)
    .slice(0, n);
}

test.describe("Silhouette Expert — bascule", () => {
  test("le bouton mène à l'URL Expert et revient", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);
    await expect(page.locator("#flashButton")).toBeHidden();

    await page.locator("#expertToggle").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("expert=1");
    await expect(page.locator("body")).toHaveClass(/expert-mode/);
    await expect(page.locator("#flashButton")).toBeVisible();
  });

  test("les deux modes ont des parties indépendantes", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    const k = await page.evaluate(() => ({
      normal: localStorage.getItem("silhouetteTarget"),
      expert: localStorage.getItem("silhouetteExpert_silhouetteTarget"),
    }));
    expect(k.normal).not.toBeNull();
    expect(k.expert).toBeNull();
  });
});

test.describe("Silhouette Expert — le flash", () => {
  test("l'image est invisible tant qu'on ne flashe pas", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    expect(await opacite(page)).toBe("0");
    await expect(page.locator("#flashCounter")).toHaveText("(1)");
  });

  test("un appui consomme le crédit, montre l'image, puis la recache", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    // Clic + lecture dans le MÊME tour de boucle : à 120 ms, un aller-retour
    // Playwright entre les deux serait déjà trop lent pour observer le flash.
    const pendant = await page.evaluate(() => {
      document.getElementById("flashButton").click();
      return getComputedStyle(document.getElementById("silhouetteImage")).opacity;
    });
    expect(pendant, "l'image apparaît pendant le flash").toBe("1");

    await expect.poll(() => opacite(page), { message: "le flash se referme tout seul" }).toBe("0");
    expect(await credits(page)).toBe(0);
    await expect(page.locator("#flashButton")).toHaveClass(/disabled/);
  });

  test("sans crédit, le bouton ne montre plus rien", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => document.getElementById("flashButton").click());
    await expect.poll(() => opacite(page)).toBe("0");

    const pendant = await page.evaluate(() => {
      document.getElementById("flashButton").click();
      return getComputedStyle(document.getElementById("silhouetteImage")).opacity;
    });
    expect(pendant, "aucun flash gratuit").toBe("0");
  });

  test("chaque erreur recharge un flash", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    const [faux] = await fauxNoms(page, 1);
    await page.evaluate(() => document.getElementById("flashButton").click());
    await expect.poll(() => credits(page)).toBe(0);

    await page.locator("#textbar").fill(faux);
    await page.locator("#guessButton").click();

    expect(await credits(page), "l'erreur redonne un flash").toBe(1);
    await expect(page.locator("#flashCounter")).toHaveText("(1)");
  });

  test("les crédits survivent au rechargement", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.getElementById("flashButton").click());
    await expect.poll(() => credits(page)).toBe(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    // Sans persistance, un F5 par essai rendrait la partie gratuite.
    expect(await credits(page)).toBe(0);
    expect(await opacite(page)).toBe("0");
  });
});

test.describe("Silhouette Expert — fin de partie", () => {
  test("l'abandon révèle l'image et enregistre is_expert", async ({ page }) => {
    // Compte authentifié (storageState) : la session part directement en POST
    // /api/sessions au lieu d'atterrir dans la file `pendingSessions` (réservée
    // au hors-ligne/anonyme, cf. savePendingSession() dans js/gameCore.js) — on
    // intercepte donc la requête plutôt que de lire la file locale.
    const sessionRequests = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/sessions")) {
        sessionRequests.push(req.postDataJSON());
      }
    });

    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    for (const nom of await fauxNoms(page, 5)) {
      await page.locator("#textbar").fill(nom);
      await page.locator("#guessButton").click();
    }
    await page.locator("#giveUpButton").click();

    expect(await opacite(page), "la silhouette reste affichée après l'abandon").toBe("1");

    await expect.poll(() => sessionRequests.length, { timeout: 5000 }).toBeGreaterThan(0);
    const last = sessionRequests[sessionRequests.length - 1];
    expect(last.mode).toBe("silhouette");
    expect(last.is_expert).toBe(true);
  });
});
