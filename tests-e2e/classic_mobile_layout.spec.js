import { test, expect } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Le haut de la page Classique, sur mobile.
 *
 * Classique est le SEUL mode à porter deux badges fixes en haut à droite (dark
 * mode + daltonien). Ils étaient empilés, obligeant la page à réserver 96 px de
 * `padding-top` sous 900 px, contre 50 px pour les cinq autres modes : le logo
 * démarrait à 106 px au lieu de 60, et tout le reste descendait d'autant —
 * « la page Classique n'a pas la taille adaptée, obligé de scroller » (Hamza,
 * 2026-09-25).
 *
 * Les deux badges partagent désormais la même rangée.
 *
 * Ce test mesure des rectangles plutôt que de comparer des captures : ce qui
 * compte n'est pas que le rendu soit identique au pixel, mais que **rien ne se
 * chevauche** et que le haut de page reste comparable aux autres modes. Une
 * capture de référence casserait au moindre changement de contenu.
 */

/** Rectangles des trois éléments qui se disputaient la place. */
async function geometrie(page) {
  return page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    };
    return {
      paddingTop: parseInt(getComputedStyle(document.body).paddingTop, 10),
      dalton: r("#daltonianToggle"),
      dark: r(".darkmode-toggle"),
      logo: r("#imgHomePage"),
    };
  });
}

const seChevauchent = (a, b) =>
  Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);

// 360 : le plus étroit couramment rencontré. 390 : l'écran de référence du dépôt.
// 480 et 899 : les deux bornes de media query, là où une règle prend le relais
// d'une autre — c'est exactement là qu'une correction partielle se voit.
const LARGEURS = [360, 390, 480, 899];

test.describe("Page Classique — haut de page sur mobile", () => {
  for (const largeur of LARGEURS) {
    test(`à ${largeur} px : les deux badges partagent une rangée, rien ne se chevauche`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ viewport: { width: largeur, height: 844 } });
      const page = await ctx.newPage();
      await gotoSettled(page, "/classiqueMode/classiqueMode.html");
      await page.waitForTimeout(400);

      const g = await geometrie(page);
      expect(g.dalton, "bascule daltonien présente").not.toBeNull();
      expect(g.dark, "bascule dark mode présente").not.toBeNull();

      // Sur la même rangée : leurs bandes verticales se croisent.
      expect(
        g.dalton.top < g.dark.bottom && g.dalton.bottom > g.dark.top,
        "les deux badges doivent être sur la même rangée, pas empilés"
      ).toBe(true);

      expect(seChevauchent(g.dalton, g.dark), "les deux badges se chevauchent").toBe(false);
      expect(seChevauchent(g.dalton, g.logo), "le badge daltonien recouvre le logo").toBe(false);
      expect(seChevauchent(g.dark, g.logo), "le badge dark mode recouvre le logo").toBe(false);

      await ctx.close();
    });
  }

  test("le haut de page n'est plus décalé par rapport aux autres modes", async ({ browser }) => {
    // La comparaison se fait contre un mode de référence plutôt que contre une
    // constante : si le gabarit commun change un jour, le test suit au lieu de
    // se mettre à mentir.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();

    await gotoSettled(page, "/emojiMode/emojiMode.html");
    await page.waitForTimeout(300);
    const reference = await geometrie(page);

    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await page.waitForTimeout(300);
    const classique = await geometrie(page);

    // Classique garde un léger surplus : sa bascule daltonien fait 48 px de haut
    // (cible tactile, CLAUDE.md §7) quand celle du dark mode en fait 40. Ce qui
    // n'est plus admis, c'est l'écart d'une rangée entière — 46 px avant.
    expect(
      classique.logo.top - reference.logo.top,
      "le logo de Classique démarre trop bas par rapport aux autres modes"
    ).toBeLessThanOrEqual(16);

    await ctx.close();
  });
});
