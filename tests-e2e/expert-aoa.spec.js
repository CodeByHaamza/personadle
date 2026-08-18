import { test, expect } from "@playwright/test";

/**
 * AOA charge ses GIFs depuis un CDN externe : `networkidle` ne se déclenche pas de
 * façon fiable et rend les tests intermittents. On attend un signal concret de la
 * page — le GIF présent et un filtre déjà appliqué.
 */
async function attendreAoa(page) {
  await page.waitForSelector("#aoaGif", { state: "attached", timeout: 15000 });
  await page.waitForFunction(
    () => (document.getElementById("aoaGif")?.style.filter ?? "") !== "",
    { timeout: 15000 }
  );
  // Le compteur n'est rempli qu'une fois l'init passée.
  await page.waitForFunction(
    () => /\(\d+ \/ \d+\)/.test(document.getElementById("giveUpCounter")?.textContent ?? ""),
    { timeout: 15000 }
  );
}

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

/**
 * Enchaîne n mauvaises réponses en attendant que chacune soit RÉELLEMENT comptée.
 *
 * Le clic est réessayé tant que le compteur ne bouge pas : dans AOA les listeners
 * sont branchés à la toute fin du DOMContentLoaded, après le préchargement des
 * images, donc bien après que le compteur soit rendu. Un premier clic peut partir
 * dans le vide, et il était perdu en silence — le test échouait alors plus loin,
 * sur une cause sans rapport.
 */
async function guessWrong(page, n) {
  for (let i = 0; i < n; i++) {
    const avant = (await page.locator("#giveUpCounter").textContent()).trim();
    await expect
      .poll(
        async () => {
          await page.locator("#textbar").fill(`Zzz Not A Character ${i}`);
          await page.locator("#guessButton").click();
          await page.waitForTimeout(150);
          return (await page.locator("#giveUpCounter").textContent()).trim();
        },
        { timeout: 15000, message: `essai ${i + 1} jamais compté` }
      )
      .not.toBe(avant);
  }
}

const filtre = (page) =>
  page.evaluate(() => document.getElementById("aoaGif").style.filter);

test.describe("AOA Expert — bascule", () => {
  test("le bouton mène à l'URL Expert et revient", async ({ page }) => {
    await page.goto(NORMAL);
    await attendreAoa(page);
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);

    await page.locator("#expertToggle").click();
    await attendreAoa(page);
    expect(page.url()).toContain("expert=1");
    await expect(page.locator("body")).toHaveClass(/expert-mode/);
  });

  test("les deux modes ont des parties indépendantes", async ({ page }) => {
    await page.goto(NORMAL);
    await attendreAoa(page);
    await guessWrong(page, 1);

    await page.goto(EXPERT);
    await attendreAoa(page);

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
    await attendreAoa(page);
    const f = await filtre(page);
    expect(f, "le noir et blanc est ce qui rend le flou max réellement dur").toContain("grayscale");
    expect(f).toMatch(/blur\(20px\)/);
  });

  test("le flou ne baisse jamais, contrairement au mode normal", async ({ page }) => {
    await page.goto(EXPERT);
    await attendreAoa(page);
    const avant = await filtre(page);

    await guessWrong(page, 4);
    const apres = await filtre(page);
    expect(apres, "quatre erreurs ne doivent rien révéler").toBe(avant);
    expect(apres).toMatch(/blur\(20px\)/);
    expect(apres).toContain("grayscale");
  });

  test("en mode normal le flou baisse bien — la différence est réelle", async ({ page }) => {
    await page.goto(NORMAL);
    await attendreAoa(page);
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
    await attendreAoa(page);

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
