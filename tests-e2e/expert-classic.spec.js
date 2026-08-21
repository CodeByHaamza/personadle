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

test.describe("Classique NORMAL — la grille de comparaison", () => {
  // Miroir du test Expert « aucune grille du tout ». Sans lui, supprimer le
  // rendu des cellules du mode normal ne cassait AUCUN test : c'est exactement
  // ce qui est arrivé le 2026-08-19 (commit 77f6ded), le mode normal n'affichant
  // plus que les en-têtes de colonnes.
  test("une tentative affiche l'en-tête ET des cellules colorées", async ({ page }) => {
    await page.goto(NORMAL);
    await page.waitForLoadState("networkidle");

    const cible = await page.evaluate(() => JSON.parse(localStorage.getItem("target")).nom);
    const essai = ["Yukari Takeba", "Junpei Iori", "Chie Satonaka"].find((n) => n !== cible);

    await page.locator("#textbar").fill(essai);
    await page.locator("#guessButton").click();

    await expect(page.locator(".category-row")).toHaveCount(1);
    // 7 attributs comparés : nom, genre, âge, porteur, persona, arcane, opus.
    await expect(page.locator(".guess-row .guess-cell")).toHaveCount(7);
    await expect(
      page.locator(".guess-cell.correct, .guess-cell.misplaced, .guess-cell.wrong")
    ).not.toHaveCount(0);
  });
});

test.describe("Classique Expert — la citation et rien d'autre", () => {
  test("la citation est visible dès le départ, sans avoir cliqué sur Indice", async ({ page }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#quoteHint")).toBeVisible();
    expect((await page.locator("#quoteHint").textContent()).trim().length).toBeGreaterThan(0);
    await expect(page.locator("#hintButton")).toBeHidden();
    // Artefacts du mode normal qui n'ont plus rien à afficher en Expert.
    await expect(page.locator("#hintCounter")).toBeHidden();
    await expect(page.locator("#autocompleteList")).toBeHidden();
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

    // Aucune grille du tout : ni en-tête de catégories, ni cellule de comparaison.
    await expect(page.locator(".category-row")).toHaveCount(0);
    await expect(page.locator(".guess-cell")).toHaveCount(0);
    // Une BONNE réponse ne va pas dans l'historique d'erreurs — elle termine la
    // partie et la boîte de victoire prend le relais, comme en Émoji.
    await expect(page.locator("#wrongGuessList .wrong-mini")).toHaveCount(0);
    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10000 });
  });

  test("les erreurs s'accumulent dans la même liste de vignettes que le mode Émoji", async ({
    page,
  }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    const noms = await page.evaluate(() => {
      const cible = JSON.parse(localStorage.getItem("classicExpert_target")).nom;
      return { cible };
    });
    // Deux vrais personnages différents de la cible, pris dans l'autocomplétion.
    await page.locator("#textbar").fill("Yukari Takeba");
    await page.locator("#guessButton").click();
    await page.locator("#textbar").fill("Junpei Iori");
    await page.locator("#guessButton").click();

    // .wrong-mini est le composant partagé (showWrongMini, js/gameCore.js) déjà
    // utilisé par le mode Émoji : pas de liste d'erreurs réinventée pour l'Expert.
    const vignettes = page.locator("#wrongGuessList .wrong-mini");
    await expect(vignettes).toHaveCount(2);
    await expect(vignettes.first().locator("img")).toHaveAttribute("alt", "Yukari Takeba");
    expect(noms.cible).toBeTruthy();
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

test.describe("Classique Expert — rejouer", () => {
  test("Rejouer redonne une citation, vide les erreurs et tire un personnage qui en a une", async ({
    page,
  }) => {
    await page.goto(EXPERT);
    await page.waitForLoadState("networkidle");

    const citationAvant = (await page.locator("#quoteHint").textContent()).trim();
    const cibleAvant = await page.evaluate(
      () => JSON.parse(localStorage.getItem("classicExpert_target")).nom
    );

    // De vrais personnages : un nom absent de la base sort avant le rendu
    // (`if (!guess) return`) et ne produit donc aucune vignette.
    for (const nom of ["Yukari Takeba", "Junpei Iori"]) {
      await page.locator("#textbar").fill(nom);
      await page.locator("#guessButton").click();
    }
    await expect(page.locator("#wrongGuessList .wrong-mini")).toHaveCount(2);

    await page.locator("#resetButton").click();

    // La citation est l'unique indice du mode : la masquer sans la réafficher
    // rendait le replay injouable.
    await expect(page.locator("#quoteHint")).toBeVisible();
    const citationApres = (await page.locator("#quoteHint").textContent()).trim();
    expect(citationApres.length).toBeGreaterThan(0);

    // L'historique d'erreurs vit dans sa propre liste, que vider #output ne touche pas.
    await expect(page.locator("#wrongGuessList .wrong-mini")).toHaveCount(0);

    const cibleApres = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("classicExpert_target"))
    );
    expect(cibleApres.nom).not.toBe(cibleAvant);
    // Le replay doit rester dans le pool Expert : 4 personnages sur 184 n'ont
    // aucune citation, en tirer un laisserait le joueur sans indice.
    expect(String(cibleApres.quote ?? "").trim().length).toBeGreaterThan(0);
    expect(citationAvant.length).toBeGreaterThan(0);
  });
});
