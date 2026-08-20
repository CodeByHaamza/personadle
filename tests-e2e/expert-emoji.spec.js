import { test, expect } from "@playwright/test";

/**
 * Émoji Expert — un émoji ment.
 *
 * Le point vérifié en priorité : le leurre est **déterministe**. Un tirage
 * aléatoire à chaque rendu se re-roulerait à chaque rechargement, et le joueur
 * identifierait l'intrus par simple élimination — le mode perdrait tout son sens.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const EXPERT = "/emojiMode/emojiMode.html?expert=1";
const NORMAL = "/emojiMode/emojiMode.html";

const affiches = (page) =>
  page.locator("#emojiDisplay .emoji-unit").allTextContents();

const vrais = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("emojiExpert_targetEmoji")).emoji);

test.describe("Émoji Expert — bascule", () => {
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
    const k = await page.evaluate(() => ({
      normal: localStorage.getItem("targetEmoji"),
      expert: localStorage.getItem("emojiExpert_targetEmoji"),
    }));
    expect(k.normal).not.toBeNull();
    expect(k.expert).toBeNull();
  });
});

test.describe("Émoji Expert — le leurre", () => {
  test("exactement un émoji affiché n'appartient pas au personnage", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    // On épuise les essais pour que toute la séquence soit révélée.
    for (const nom of ["Yukari Takeba", "Junpei Iori", "Akihiko Sanada", "Mitsuru Kirijo"]) {
      await page.locator("#textbar").fill(nom);
      await page.locator("#guessButton").click();
    }

    const vus = await affiches(page);
    const reels = await vrais(page);
    const intrus = vus.filter((e) => !reels.includes(e));

    expect(vus.length, "la longueur de la séquence ne change pas").toBeLessThanOrEqual(reels.length);
    expect(intrus.length, "un seul leurre, jamais zéro ni deux").toBe(1);
  });

  test("le leurre ne change pas au rechargement", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    for (const nom of ["Yukari Takeba", "Junpei Iori"]) {
      await page.locator("#textbar").fill(nom);
      await page.locator("#guessButton").click();
    }
    const avant = await affiches(page);

    await page.reload();
    await page.waitForLoadState("networkidle");
    const apres = await affiches(page);

    // Déterminisme : sinon le joueur repère l'intrus en rechargeant deux fois.
    expect(apres).toEqual(avant);
  });

  test("le mode normal n'affiche que de vrais émojis", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    for (const nom of ["Yukari Takeba", "Junpei Iori"]) {
      await page.locator("#textbar").fill(nom);
      await page.locator("#guessButton").click();
    }
    const vus = await page.locator("#emojiDisplay .emoji-unit").allTextContents();
    const reels = await page.evaluate(
      () => JSON.parse(localStorage.getItem("targetEmoji")).emoji
    );
    expect(vus.every((e) => reels.includes(e)), "aucun leurre hors Expert").toBe(true);
  });
});

test.describe("Émoji Expert — abandon", () => {
  test("l'abandon révèle les VRAIS émojis et enregistre is_expert", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    // Les noms sont filtrés sur la cible du jour : en dur, l'un d'eux finissait
    // par ÊTRE la cible selon la date, la partie était gagnée avant la 5e erreur
    // et #textbar se retrouvait désactivé — échec intermittent, sans rapport
    // avec ce que le test vérifie.
    const cible = await page.evaluate(
      () => JSON.parse(localStorage.getItem("emojiExpert_targetEmoji")).nom
    );
    const faux = [
      "Yukari Takeba",
      "Junpei Iori",
      "Akihiko Sanada",
      "Mitsuru Kirijo",
      "Chie Satonaka",
      "Yosuke Hanamura",
    ]
      .filter((n) => n !== cible)
      .slice(0, 5);

    for (const nom of faux) {
      await page.locator("#textbar").fill(nom);
      await page.locator("#guessButton").click();
    }
    await page.locator("#giveUpButton").click();

    // La censure tombe : plus aucun intrus dans la séquence affichée.
    const vus = await affiches(page);
    const reels = await vrais(page);
    expect(vus.filter((e) => !reels.includes(e)), "le leurre disparaît à la révélation").toEqual([]);

    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("pendingSessions") || "[]").length > 0,
      { timeout: 5000 }
    );
    const pending = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pendingSessions") || "[]")
    );
    const last = pending[pending.length - 1];
    expect(last.mode).toBe("emoji");
    expect(last.is_expert).toBe(true);
  });
});
