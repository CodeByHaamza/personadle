import { test, expect } from "@playwright/test";

/**
 * tests-e2e/visual_layout.spec.js — captures de référence des pages de jeu.
 *
 * Opt-in : `E2E_VISUAL=1 npx playwright test visual_layout` — sans la variable,
 * la suite est ignorée. Pourquoi pas en CI : le rendu des polices diffère entre
 * Windows, macOS et le Linux de la CI, et une capture faite ici ne vaut rien
 * là-bas. Les références vivent donc en local, hors dépôt
 * (tests-e2e/__screenshots__/, ignoré par git) :
 *
 *   E2E_VISUAL=1 npx playwright test visual_layout --update-snapshots   # 1re fois / nouvelle référence
 *   E2E_VISUAL=1 npx playwright test visual_layout                      # comparaison
 *   npx playwright show-report                                          # les diffs, côte à côte
 *
 * Usage prévu : figer l'état AVANT la refonte du layout des modes (barre de
 * saisie collante, compactage du haut), puis relire chaque diff pendant. Les
 * 6 modes × 2 viewports (mobile 390×844, desktop 1440×900), page fraîche, non
 * connecté, avant toute partie — l'état le plus reproductible.
 */

const MODES = [
  ["classic", "/classiqueMode/classiqueMode.html"],
  ["emoji", "/emojiMode/emojiMode.html"],
  ["silhouette", "/silhouetteMode/silhouette.html"],
  ["alloutattack", "/allOutAttackMode/allOutAttack.html"],
  ["personae", "/personaeMode/personae.html"],
  ["music", "/musicsMode/musics.html"],
];

const VIEWPORTS = [
  ["mobile", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
];

test.describe("Visuel — pages de jeu, page fraîche", () => {
  test.skip(!process.env.E2E_VISUAL, "opt-in : E2E_VISUAL=1 (références locales, hors CI)");

  for (const [vpName, viewport] of VIEWPORTS) {
    for (const [mode, path] of MODES) {
      test(`${mode} — ${vpName}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport,
          isMobile: vpName === "mobile",
          hasTouch: vpName === "mobile",
          locale: "fr-FR",
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot(`${mode}-${vpName}.png`, {
          fullPage: true,
          animations: "disabled",
          caret: "hide",
          // La cible du jour (silhouette, persona, gif All-Out, emoji) dépend du
          // joueur — un visiteur anonyme tire avec un anonPlayerId aléatoire par
          // navigateur — et change chaque jour. C'est le layout qu'on compare,
          // pas le tirage : ces zones sont masquées, leur cadre reste comparé.
          mask: [page.locator(".silhouette-box, .persona-box, .aoa-gif-zone, #emojiDisplay")],
          // Anti-aliasing : une petite tolérance évite les faux positifs sans
          // masquer un décalage de mise en page.
          maxDiffPixelRatio: 0.01,
        });
        await context.close();
      });
    }
  }
});
