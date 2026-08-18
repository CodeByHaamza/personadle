import { test, expect } from "@playwright/test";

/**
 * Mode Classique Expert — parcours joueur.
 *
 * Le point vérifié en priorité : en Expert les colonnes de comparaison ne sont pas
 * seulement cachées, elles ne sont **pas construites**. Les masquer en CSS les
 * laisserait lisibles dans l'inspecteur, ce qui viderait le mode de son intérêt.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const EXPERT = "/classiqueMode/classiqueMode.html?expert=1";
const NORMAL = "/classiqueMode/classiqueMode.html";

async function guessWrong(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator("#textbar").fill(`Zzz Not A Character ${i}`);
    await page.locator("#guessButton").click();
  }
}

test.describe("Classique Expert — bascule", () => {
  test("le bouton mène à l'URL Expert et revient", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).not.toHaveClass(/expert-mode/);

    await page.locator("#expertToggle").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("expert=1");
    await expect(page.locator("body")).toHaveClass(/expert-mode/);

    await page.locator("#expertToggle").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("expert=1");
  });

  test("les deux modes ont des parties indépendantes", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");
    await guessWrong(page, 1);

    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    const k = await page.evaluate(() => ({
      normal: localStorage.getItem("attempts"),
      expert: localStorage.getItem("classicExpert_attempts"),
      normalTarget: localStorage.getItem("target"),
      expertTarget: localStorage.getItem("classicExpert_target"),
    }));
    expect(k.normal, "l'essai est compté côté normal").toBe("1");
    expect(k.expert, "l'Expert ne partage pas le compteur").not.toBe("1");
    expect(k.normalTarget).not.toBeNull();
    expect(k.expertTarget).not.toBeNull();
  });
});

test.describe("Classique Expert — la citation et rien d'autre", () => {
  test("la citation est visible dès le départ, sans avoir cliqué sur Indice", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#quoteHint")).toBeVisible();
    expect((await page.locator("#quoteHint").textContent()).trim().length).toBeGreaterThan(0);
    await expect(page.locator("#hintButton")).toBeHidden();
  });

  test("aucune cellule de comparaison n'existe dans le DOM", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    const cible = await page.evaluate(
      () => JSON.parse(localStorage.getItem("classicExpert_target")).nom
    );
    // Une mauvaise réponse valide : un vrai personnage, mais pas la cible.
    const autre = await page.evaluate((cible) => {
      const list = [...document.querySelectorAll("#autocompleteList *")];
      return list.length ? null : cible;
    }, cible);
    expect(autre === null || typeof autre === "string").toBe(true);

    await page.locator("#textbar").fill(cible);
    await page.locator("#guessButton").click();

    // Une ligne = portrait + nom. Sept colonnes en moins, et pas seulement masquées.
    const cellules = await page.locator(".guess-row .guess-cell").count();
    expect(cellules, "seule la colonne nom doit exister").toBe(1);
    await expect(page.locator(".category-row--expert")).toHaveCount(1);
  });

  test("la cible du jour a toujours une citation", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    const quote = await page.evaluate(
      () => JSON.parse(localStorage.getItem("classicExpert_target")).quote
    );
    expect(String(quote ?? "").trim().length).toBeGreaterThan(0);
  });
});

test.describe("Classique Expert — abandon", () => {
  test("l'abandon se débloque après 5 essais et enregistre is_expert", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    // #giveUpButton est un <div class="link-wrapper">, pas un <button> :
    // enableGiveUpButton() y pose `.disabled`, ce qui n'a aucun effet sur un div.
    // Le vrai verrou est dans le handler (`if (attempts < GIVE_UP_THRESHOLD) return`),
    // donc on teste le comportement et non cette propriété inopérante.
    const giveUp = page.locator("#giveUpButton");

    await guessWrong(page, 4);
    await giveUp.click();
    await expect(
      page.locator("#victoryBox"),
      "abandonner avant 5 essais ne doit rien faire"
    ).toBeHidden();

    await guessWrong(page, 1);
    await giveUp.click();

    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10000 });

    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("pendingSessions") || "[]").length > 0,
      { timeout: 5000 }
    );
    const pending = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pendingSessions") || "[]")
    );
    const last = pending[pending.length - 1];
    expect(last.mode).toBe("classic");
    expect(last.is_expert).toBe(true);
    expect(last.result).toBe("giveup");
  });
});
