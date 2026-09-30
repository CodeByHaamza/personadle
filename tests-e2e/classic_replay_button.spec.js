import { test, expect } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Après une partie, on doit pouvoir rejouer.
 *
 * ── Ce que ce test garde ────────────────────────────────────────────────────
 * Les trois fins de partie de Classique ajoutaient `.hidden` à `.input-row` —
 * la rangée qui contient le bouton **Rejouer** (`#resetButton`). Tant que
 * `.hidden` n'était défini nulle part globalement, ces lignes ne faisaient rien
 * et personne ne les avait remarquées. La règle `[hidden], .hidden { display:
 * none !important }` livrée en 2.3.2 les a rendues vraies : le Rejouer a disparu
 * de Classique, en normal comme en Expert, et **rien ne retirait jamais la
 * classe** — le joueur restait bloqué jusqu'au rechargement de la page.
 *
 * Le contrôle du rayon d'action de cette règle n'avait mesuré que des pages
 * FRAÎCHEMENT CHARGÉES : l'état « partie terminée » n'était jamais atteint, donc
 * la régression était invisible. D'où ce test, qui va jusqu'au bout d'une partie.
 *
 * On passe par Abandonner plutôt que par une victoire : c'est le seul chemin
 * déterministe sans connaître la cible du jour, et il emprunte exactement le même
 * code de fin de partie.
 */

/** Joue des réponses fausses jusqu'à ce qu'Abandonner soit disponible. */
async function proposerFaux(page, combien) {
  for (let i = 0; i < combien; i++) {
    await page.fill("#textbar", "zzzz" + i);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }
}

test.describe("Classique — le bouton Rejouer survit à la fin de partie", () => {
  for (const largeur of [390, 1280]) {
    test(`à ${largeur} px, Rejouer reste visible et cliquable après un abandon`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 } });
      const page = await ctx.newPage();
      await gotoSettled(page, "/classiqueMode/classiqueMode.html");
      await page.waitForTimeout(600);

      const rejouer = page.locator("#resetButton");
      const rangee = page.locator(".input-row");

      await expect(rejouer, "Rejouer doit être là avant de jouer").toBeVisible();

      await proposerFaux(page, 3);
      await page.locator("#giveUpButton").click();
      await page.waitForTimeout(800);

      // Le cœur du test : la partie est finie, le bouton doit rester atteignable.
      await expect(
        rangee,
        "la rangée de saisie ne doit pas être masquée : elle contient Rejouer"
      ).toBeVisible();
      await expect(
        rejouer,
        "Rejouer a disparu après la fin de partie — le joueur est bloqué jusqu'au rechargement"
      ).toBeVisible();

      // Visible ne suffit pas : un bouton recouvert ou à zéro pixel ne se clique pas.
      const atteignable = await page.evaluate(() => {
        const el = document.getElementById("resetButton");
        if (!el) return "absent";
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8)
          return `trop petit (${Math.round(r.width)}×${Math.round(r.height)})`;
        const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return dessus && (dessus === el || el.contains(dessus)) ? "ok" : "recouvert";
      });
      expect(atteignable, "Rejouer n'est pas cliquable après la fin de partie").toBe("ok");

      await ctx.close();
    });
  }

  test("cliquer Rejouer relance bien une partie", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await page.waitForTimeout(600);

    await proposerFaux(page, 3);
    await page.locator("#giveUpButton").click();
    await page.waitForTimeout(800);

    await page.locator("#resetButton").click();
    await page.waitForTimeout(800);

    // Une nouvelle partie : le champ de saisie répond de nouveau.
    await expect(
      page.locator("#textbar"),
      "après Rejouer, le champ doit être utilisable"
    ).toBeEnabled();

    await ctx.close();
  });
});
