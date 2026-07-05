import { test, expect } from "@playwright/test";

/**
 * Scénarios E2E manquants listés dans tests-e2e/README.md § Scénarios à ajouter :
 * partie complète (via Give Up, la seule façon d'obtenir un résultat déterministe
 * sans devoir prédire la cible du jour), changement de langue + persistance,
 * responsive (viewport mobile) sur les 6 modes.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

test.describe("PersonaDLE — partie complète (Give Up) et vérification de session", () => {
  test("Give Up en mode Classique révèle la réponse et enregistre une session 'giveup'", async ({
    page,
  }) => {
    await page.goto("/classiqueMode/classiqueMode.html");
    await page.waitForLoadState("networkidle");

    const textbar = page.locator("#textbar");
    const guessButton = page.locator("#guessButton");
    const giveUpButton = page.locator("#giveUpButton");

    // 8 réponses bidon pour atteindre GIVE_UP_THRESHOLD (aucun perso ne s'appelle ainsi)
    for (let i = 0; i < 8; i++) {
      await textbar.fill(`Zzz Not A Real Character ${i}`);
      await guessButton.click();
    }

    await giveUpButton.click();

    // La révélation doit apparaître (victoryBox devient visible)
    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10000 });

    // La session mise en attente localement doit porter result: "giveup" (pas "win" —
    // cf. le fix du 2026-07-05, checkGuess() loggait "win" même sur un Give Up).
    const pending = await page.evaluate(() => JSON.parse(localStorage.getItem("pendingSessions") || "[]"));
    expect(pending.length).toBeGreaterThan(0);
    const last = pending[pending.length - 1];
    expect(last.mode).toBe("classic");
    expect(last.result).toBe("giveup");
  });
});

test.describe("PersonaDLE — changement de langue", () => {
  test("changer de langue met à jour l'UI et persiste après rechargement", async ({ page }) => {
    await page.goto("/index.html");
    await page.waitForLoadState("networkidle");

    await page.locator("#langBtn").click();
    await page.locator('.lang-opt[data-lang="fr"]').click();
    await expect(page.locator("#langBtnLabel")).toHaveText("FR");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#langBtnLabel")).toHaveText("FR");
    const storedLang = await page.evaluate(() => localStorage.getItem("lang"));
    expect(storedLang).toBe("fr");
  });
});

test.describe("PersonaDLE — responsive (viewport mobile)", () => {
  const modes = [
    { name: "Classique", path: "/classiqueMode/classiqueMode.html" },
    { name: "Emoji", path: "/emojiMode/emojiMode.html" },
    { name: "Silhouette", path: "/silhouetteMode/silhouette.html" },
    { name: "All-Out Attack", path: "/allOutAttackMode/allOutAttack.html" },
    { name: "Personae", path: "/personaeMode/personae.html" },
    { name: "Music", path: "/musicsMode/musics.html" },
  ];

  for (const mode of modes) {
    test(`${mode.name} charge sans débordement horizontal en viewport mobile (375px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(mode.path);
      await page.waitForLoadState("networkidle");

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      // Tolérance de quelques px pour les scrollbars/arrondis — un vrai débordement
      // horizontal (élément non responsive) dépasse largement cette marge.
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }
});
