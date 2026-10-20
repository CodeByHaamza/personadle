import { test, expect } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Sur téléphone, le champ de réponse est visible SANS défiler, dans les 6 modes.
 *
 * Mesuré le 2026-10-20 avant correctif : à 390×844, le champ démarrait entre
 * 789 px (Classique) et 1 221 px (Personae) — toujours sous la barre du bas,
 * qui commence à 782 px. Chaque essai demandait un défilement.
 *
 * Le correctif (css/mobile_layout.css) ancre la ligne de saisie au-dessus de la
 * barre de navigation. Le test vérifie l'invariant — le champ tient entre le
 * haut de l'écran et la barre — pas une position au pixel, qui casserait au
 * premier changement de contenu.
 */

const MODES = {
  classique: "/classiqueMode/classiqueMode.html",
  emoji: "/emojiMode/emojiMode.html",
  silhouette: "/silhouetteMode/silhouette.html",
  "all-out attack": "/allOutAttackMode/allOutAttack.html",
  personae: "/personaeMode/personae.html",
  musique: "/musicsMode/musics.html",
};

// 360×740 : le plus petit téléphone courant. 390×844 : l'écran de référence.
const ECRANS = [
  [360, 740],
  [390, 844],
];

for (const [largeur, hauteur] of ECRANS) {
  test.describe(`Saisie visible sans défiler — ${largeur}×${hauteur}`, () => {
    for (const [nom, url] of Object.entries(MODES)) {
      test(nom, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: largeur, height: hauteur },
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        await gotoSettled(page, url);
        await page.waitForTimeout(400);

        const g = await page.evaluate(() => {
          const input = document.querySelector('.input-wrapper input[type="text"]');
          const nav = document.querySelector(".bottom-nav");
          const r = input?.getBoundingClientRect();
          return {
            input: r ? { top: r.top, bottom: r.bottom, width: r.width } : null,
            navTop: nav ? nav.getBoundingClientRect().top : window.innerHeight,
            scrollY: window.scrollY,
            docWidth: document.documentElement.scrollWidth,
            viewWidth: document.documentElement.clientWidth,
          };
        });

        expect(g.input, "champ de réponse présent").not.toBeNull();
        expect(g.scrollY, "la page ne doit pas avoir défilé").toBe(0);
        expect(g.input.top, "champ au-dessus du haut de l'écran").toBeGreaterThanOrEqual(0);
        expect(g.input.bottom, "champ caché sous la barre du bas").toBeLessThanOrEqual(
          g.navTop + 1
        );
        expect(g.input.width, "champ trop étroit pour taper un nom").toBeGreaterThanOrEqual(140);
        expect(g.docWidth, "débordement horizontal").toBeLessThanOrEqual(g.viewWidth + 2);

        // Le champ doit aussi recevoir le doigt : rien ne le recouvre.
        const box = await page.locator('.input-wrapper input[type="text"]').boundingBox();
        const top = await page.evaluate(
          ([x, y]) => document.elementFromPoint(x, y)?.matches?.('input[type="text"]') ?? false,
          [box.x + box.width / 2, box.y + box.height / 2]
        );
        expect(top, "le champ est recouvert par un autre élément").toBe(true);

        await ctx.close();
      });
    }
  });
}

test("la feuille « Jouer » liste les 6 modes et mène au mode choisi", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await gotoSettled(page, "/index.html");
  await page.locator("#navPlayBtn").click();
  const items = page.locator("#navPlaySheet .play-sheet-item");
  await expect(items).toHaveCount(6);
  await items.nth(1).click();
  await expect(page).toHaveURL(/emojiMode\/emojiMode\.html/);
  await ctx.close();
});
