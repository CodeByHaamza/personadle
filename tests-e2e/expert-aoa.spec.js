import { test, expect } from "@playwright/test";

/**
 * All-Out Attack Expert — flou figé au maximum et noir et blanc.
 *
 * Le point vérifié en priorité : le flou ne baisse JAMAIS. En mode normal il perd
 * 3px par erreur ; toute régression qui le ferait baisser en Expert rendrait le
 * mode identique au normal sans que rien ne le signale.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const EXPERT = "/allOutAttackMode/allOutAttack.html?expert=1";
const NORMAL = "/allOutAttackMode/allOutAttack.html";

async function guessWrong(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator("#textbar").fill(`Zzz Not A Character ${i}`);
    await page.locator("#guessButton").click();
  }
}

const filtre = (page) =>
  page.evaluate(() => document.getElementById("aoaGif").style.filter);

test.describe("AOA Expert — bascule", () => {
  test("le bouton mène à l'URL Expert et revient", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);

    await page.locator("#expertToggle").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("expert=1");
    await expect(page.locator("body")).toHaveClass(/expert-mode/);
  });

  test("les deux modes ont des parties indépendantes", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    await guessWrong(page, 1);

    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    const k = await page.evaluate(() => ({
      normal: localStorage.getItem("aoaAttempts"),
      expert: localStorage.getItem("aoaExpert_aoaAttempts"),
    }));
    expect(k.normal).toBe("1");
    expect(k.expert).not.toBe("1");
  });
});

test.describe("AOA Expert — l'indice ne bouge pas", () => {
  test("noir et blanc dès le départ, flou au maximum", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    const f = await filtre(page);
    expect(f, "le noir et blanc est ce qui rend le flou max réellement dur").toContain("grayscale");
    expect(f).toMatch(/blur\(20px\)/);
  });

  test("le flou ne baisse jamais, contrairement au mode normal", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    const avant = await filtre(page);

    await guessWrong(page, 4);
    const apres = await filtre(page);
    expect(apres, "quatre erreurs ne doivent rien révéler").toBe(avant);
    expect(apres).toMatch(/blur\(20px\)/);
    expect(apres).toContain("grayscale");
  });

  test("en mode normal le flou baisse bien — la différence est réelle", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    await guessWrong(page, 2);
    const f = await filtre(page);
    expect(f).not.toContain("grayscale");
    // 20 - 2 × 3 = 14px
    expect(f).toMatch(/blur\(14px\)/);
  });
});

test.describe("AOA Expert — abandon", () => {
  test("l'abandon révèle l'image en clair et enregistre is_expert", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    await guessWrong(page, 5);
    await page.locator("#giveUpButton").click();

    // Fin de partie : ni flou ni noir et blanc.
    await expect
      .poll(async () => await filtre(page), { timeout: 10000 })
      .toBe("none");

    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("pendingSessions") || "[]").length > 0,
      { timeout: 5000 }
    );
    const pending = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pendingSessions") || "[]")
    );
    const last = pending[pending.length - 1];
    expect(last.mode).toBe("alloutattack");
    expect(last.is_expert).toBe(true);
    expect(last.result).toBe("giveup");
  });
});
