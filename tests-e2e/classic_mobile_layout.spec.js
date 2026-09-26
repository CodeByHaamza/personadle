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

/**
 * La rangée Indice + Abandon, sur mobile.
 *
 * Deuxième moitié du même symptôme (« obligé de scroller pour répondre »), et
 * la plus coûteuse : `.hint-giveup-row` est un `flex` avec `flex-wrap: wrap`, et
 * Classique est le seul mode à y placer DEUX blocs. À 390 px ils faisaient
 * 229 px chacun pour 380 px disponibles → passage à la ligne, 292 px de haut au
 * lieu de 136, et le champ de réponse repoussé à 894 px contre 748 en Émoji.
 *
 * Le correctif de la 2.3.1 n'avait traité que le `padding-top` (46 px) ; ces
 * 154 px-là venaient du `padding: 12px 20px` de `.link-wrapper`.
 *
 * Le test vérifie l'invariant, pas les valeurs : les deux blocs sur une seule
 * rangée, et le champ de réponse jamais plus bas que dans un mode de référence.
 * Figer « 724 px » casserait au premier changement de contenu.
 */
test.describe("Page Classique — rangée Indice/Abandon sur mobile", () => {
  async function rects(page) {
    return page.evaluate(() => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height };
      };
      return {
        hint: r(".hint-block"),
        giveup: r(".giveup-block"),
        bouton: r("#hintButton"),
        saisie: r(".input-wrapper"),
        largeurDoc: document.documentElement.scrollWidth,
        largeurVue: document.documentElement.clientWidth,
      };
    });
  }

  for (const largeur of [360, 390, 412, 480]) {
    test(`à ${largeur} px : Indice et Abandon restent côte à côte`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largeur, height: 844 } });
      const page = await ctx.newPage();
      await gotoSettled(page, "/classiqueMode/classiqueMode.html");
      await page.waitForTimeout(400);

      const g = await rects(page);
      expect(g.hint, "bloc Indice présent").not.toBeNull();
      expect(g.giveup, "bloc Abandon présent").not.toBeNull();

      // Côte à côte : leurs bandes verticales se croisent, et l'un est à gauche
      // de l'autre. C'est la définition d'une rangée, indépendamment des tailles.
      expect(
        g.hint.top < g.giveup.bottom && g.hint.bottom > g.giveup.top,
        "Indice et Abandon sont empilés au lieu d'être côte à côte"
      ).toBe(true);
      expect(g.hint.right).toBeLessThanOrEqual(g.giveup.left + 1);

      // Le gain ne doit pas se payer en débordement latéral.
      expect(
        g.largeurDoc,
        "la rangée forcée sur une ligne fait déborder la page horizontalement"
      ).toBeLessThanOrEqual(g.largeurVue + 2);

      // Cible tactile : CLAUDE.md §7 impose 48 px, le bouton doit rester confortable.
      expect(
        g.bouton.bottom - g.bouton.top,
        "bouton Indice trop bas pour le doigt"
      ).toBeGreaterThanOrEqual(48);
      expect(g.bouton.right - g.bouton.left, "bouton Indice trop étroit").toBeGreaterThanOrEqual(
        48
      );

      await ctx.close();
    });
  }

  test("le champ de réponse n'est pas plus bas que dans les autres modes", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();

    await gotoSettled(page, "/emojiMode/emojiMode.html");
    await page.waitForTimeout(300);
    const reference = await rects(page);

    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await page.waitForTimeout(300);
    const classique = await rects(page);

    expect(reference.saisie, "champ de réponse trouvé en Émoji").not.toBeNull();
    expect(classique.saisie, "champ de réponse trouvé en Classique").not.toBeNull();

    // Classique porte un bloc de plus (Indice) et 10 px de padding-top en plus :
    // on tolère une marge, mais plus l'écart d'une rangée entière (146 px avant).
    expect(
      classique.saisie.top - reference.saisie.top,
      "le champ de réponse de Classique est nettement plus bas que celui d'Émoji"
    ).toBeLessThanOrEqual(24);

    await ctx.close();
  });
});
