/**
 * profil_debordement_mobile.spec.js — Le profil ne déborde pas sur téléphone.
 *
 * Alerte du test de fumée de la prod (serveur maison) chaque nuit depuis au moins le
 * 2026-10-12 : « profil @390px — débordement horizontal +14px », « @480px +12px ».
 *
 * La cause : les cartes du profil entrent en glissant depuis la droite
 * (`.animate-right`, `translateX(28px)` → 0). À la première image, elles dépassent de
 * l'écran ; sur mobile, le navigateur élargit alors la zone de mise en page (404 px
 * pour un écran de 390) et la garde après la fin de l'animation. La barre du bas,
 * fixée de bord à bord, suit cette largeur et la page défile de côté.
 *
 * ⚠️ Comparer à la largeur DEMANDÉE, pas à `window.innerWidth` : avec ce bug,
 * `innerWidth` gonfle lui aussi (404) et un test « scrollWidth <= innerWidth » passe
 * sans rien voir — c'est pour ça que les tests existants ne l'avaient pas attrapé.
 * `isMobile` est indispensable : sans lui, Chromium n'élargit pas la zone de mise en page.
 */

import { test, expect } from "@playwright/test";

for (const width of [390, 480]) {
  test.describe(`profil à ${width} px`, () => {
    test.use({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

    test("aucun débordement horizontal après le chargement", async ({ page }) => {
      await page.goto("/profile/profile.html", { waitUntil: "networkidle" });
      // Laisser finir l'entrée des cartes (0,45 s) : le bug survit à l'animation.
      await page.waitForTimeout(1200);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `la page fait ${scrollWidth} px pour un écran de ${width}`).toBeLessThanOrEqual(width);
    });
  });
}
