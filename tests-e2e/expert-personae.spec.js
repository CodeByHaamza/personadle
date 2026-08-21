import { test, expect } from "@playwright/test";
import { personaeCharacters } from "../personaeMode/database/personaeCharacters.js";
import { expertWielders } from "../personaeMode/database/expert_lore/wielders.js";

/**
 * Personae Expert — la fiche de lore, pas l'image.
 *
 * Le point vérifié en priorité : l'image ne doit **jamais** être chargée avant la
 * révélation. Elle n'est pas un indice ici, elle EST la réponse — un `display:none`
 * l'aurait laissée lisible dans l'inspecteur.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const EXPERT = "/personaeMode/personae.html?expert=1";
const NORMAL = "/personaeMode/personae.html";

/**
 * Attend que la page soit réellement prête.
 *
 * Après un bump de CACHE_VERSION, le service worker s'active et les pages se
 * rechargent seules (écouteur SW_UPDATED). `networkidle` peut alors se résoudre
 * sur le chargement avorté, et les assertions tombent sur une page en pleine
 * navigation. On attend donc un signal du mode lui-même.
 */
async function attendrePret(page, expert = true) {
  await page.waitForFunction(
    (exp) => {
      const cle = exp ? "personaeExpert_personaeTarget" : "personaeTarget";
      if (!localStorage.getItem(cle)) return false;
      if (!exp) return true;
      return (document.getElementById("expertLoreText")?.textContent ?? "").trim().length > 0;
    },
    expert,
    { timeout: 15000 }
  );
}

const cible = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("personaeExpert_personaeTarget")));

/**
 * Enchaîne n réponses garanties fausses.
 *
 * Les noms sont calculés à partir de la cible réelle : une fiche accepte TOUS les
 * manieurs de la figure (Orphée vaut pour Makoto, Kotone et Aigis), donc une liste
 * de noms écrite en dur finissait par tomber sur la bonne réponse et terminait la
 * partie au milieu du test.
 */
async function guessWrong(page, n) {
  const t = await cible(page);
  const acceptes = new Set(
    expertWielders(t.persona, personaeCharacters).map((u) => u.toLowerCase())
  );
  const faux = [
    ...new Set(personaeCharacters.flatMap((c) => (Array.isArray(c.user) ? c.user : [c.user]))),
  ].filter((u) => !acceptes.has(u.toLowerCase()));

  // Le clic est réessayé tant que le compteur ne bouge pas : les listeners sont
  // branchés en fin d'init, un premier clic peut partir dans le vide et serait
  // perdu en silence — le test échouerait plus loin, sur une cause sans rapport.
  for (let i = 0; i < n; i++) {
    const avant = (await page.locator("#giveUpCounter").textContent()).trim();
    await expect
      .poll(
        async () => {
          await page.locator("#textbar").fill(faux[i % faux.length]);
          await page.locator("#guessButton").click();
          await page.waitForTimeout(150);
          return (await page.locator("#giveUpCounter").textContent()).trim();
        },
        { timeout: 15000, message: `essai ${i + 1} jamais compté` }
      )
      .not.toBe(avant);
  }
}

test.describe("Personae Expert — bascule", () => {
  test("le bouton mène à l'URL Expert", async ({ page }) => {
    await page.goto(NORMAL);
    await attendrePret(page, false);
    await expect(page.locator("#expertLoreBox")).toBeHidden();

    await page.locator("#expertToggle").click();
    await attendrePret(page);
    expect(page.url()).toContain("expert=1");
    await expect(page.locator("#expertLoreBox")).toBeVisible();
  });

  test("les deux modes tirent des personas différentes", async ({ page }) => {
    await page.goto(NORMAL);
    await attendrePret(page, false);
    const normale = await page.evaluate(
      () => JSON.parse(localStorage.getItem("personaeTarget")).persona
    );
    await page.goto(EXPERT);
    await attendrePret(page);
    const experte = (await cible(page)).persona;
    // Clés de hash distinctes : jouer le mode normal ne doit pas donner la réponse.
    expect(experte).not.toBe(normale);
  });
});

test.describe("Personae Expert — le lore", () => {
  test("un texte est affiché, et l'image n'est pas chargée", async ({ page }) => {
    await page.goto(EXPERT);
    await attendrePret(page);

    const texte = await page.locator("#expertLoreText").textContent();
    expect(texte.trim().length).toBeGreaterThan(50);

    // L'image EST la réponse : elle ne doit pas exister dans le DOM, pas seulement
    // être masquée. L'attribut est RETIRÉ, pas vidé — `src=""` déclenche une
    // requête vers l'URL du document sur certains moteurs, donc `getAttribute()`
    // rend null et non "".
    const src = await page.locator("#personaImage").getAttribute("src");
    expect(src, "aucune illustration avant la révélation").toBeNull();

    // Et le nom de la persona ne doit pas non plus fuiter par l'attribut alt.
    const alt = await page.locator("#personaImage").getAttribute("alt");
    expect(alt ?? "", "le alt ne doit pas donner la réponse").toBe("");
  });

  test("le nom de la persona est masqué dans sa propre fiche", async ({ page }) => {
    await page.goto(EXPERT);
    await attendrePret(page);

    const t = await cible(page);
    const texte = (await page.locator("#expertLoreText").textContent()).toLowerCase();
    const base = t.persona.replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
    if (base.length >= 4) {
      expect(texte, `« ${t.persona} » ne doit pas apparaître`).not.toContain(base);
    }
    expect(texte).toContain("▮");
  });

  test("la cible du jour a toujours une fiche", async ({ page }) => {
    await page.goto(EXPERT);
    await attendrePret(page);
    const texte = await page.locator("#expertLoreText").textContent();
    expect(texte.trim().length).toBeGreaterThan(0);
  });
});

test.describe("Personae Expert — abandon", () => {
  test("l'abandon révèle l'image et le texte en clair, et enregistre is_expert", async ({
    page,
  }) => {
    await page.goto(EXPERT);
    await attendrePret(page);

    await guessWrong(page, 5);
    await page.locator("#giveUpButton").click();
    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10000 });

    // La censure tombe des deux côtés.
    const texte = await page.locator("#expertLoreText").textContent();
    expect(texte, "le masque disparaît").not.toContain("▮");
    const src = await page.locator("#personaImage").getAttribute("src");
    expect(src, "l'illustration apparaît").toContain("/database/img/");

    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("pendingSessions") || "[]").length > 0,
      { timeout: 5000 }
    );
    const pending = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pendingSessions") || "[]")
    );
    const last = pending[pending.length - 1];
    expect(last.mode).toBe("personae");
    expect(last.is_expert).toBe(true);
    expect(last.result).toBe("giveup");
  });
});
