import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Ouvrir une page ne doit JAMAIS effacer ce que le serveur sait du profil.
 *
 * ── Le bug ───────────────────────────────────────────────────────────────────
 * `_syncLocalProfileToCloud()` (js/auth.js) poussait les champs de présentation à
 * chaque chargement de page, sur toutes les pages, AVANT tout pull. Sur un
 * appareil au profil local vide — second appareil, navigateur neuf, cache vidé,
 * fenêtre privée — elle envoyait `selected_badges: []` et les valeurs par défaut,
 * et le serveur perdait les choix du joueur.
 *
 * Constaté le 2026-09-24 : badges épinglés en base, ouverture de la page profil
 * sur un navigateur neuf, badges effacés en moins de trois secondes, sans la
 * moindre action. Silencieux, et contraire à la règle qui gouverne tout le reste
 * de la synchronisation (le backend est la vérité).
 *
 * Ce fichier tient les DEUX côtés : le serveur n'est plus écrasé, et la migration
 * d'un profil local vers un compte neuf — la raison d'être de cette fonction —
 * continue de marcher.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

async function nouveauCompte(suffixe) {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pseudo = `nov${suffixe}${rnd}`.slice(0, 20);
  const api = await pwRequest.newContext({ baseURL: BASE });
  const res = await api.post("/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok()).toBeTruthy();
  const { user } = await res.json();
  return { api, id: user.id };
}

const profilServeur = async (c) => (await (await c.api.get(`/api/user/${c.id}`)).json()).profile;

test.describe("Profil — un appareil vierge n'écrase pas le serveur", () => {
  test("badges épinglés et couleur survivent à l'ouverture sur un navigateur neuf", async ({
    browser,
  }) => {
    const c = await nouveauCompte("a");

    // Trois badges `manual` épinglés, et une couleur choisie — côté SERVEUR
    // uniquement, comme si tout avait été fait depuis un autre appareil.
    const badges = ["velvet_headache", "into_the_fog", "twin_blade"];
    for (const slug of badges) {
      expect(
        (
          await c.api.post("/api/badges/unlock", {
            data: { badge_id: slug },
            headers: await csrfHeader(c.api),
          })
        ).ok()
      ).toBeTruthy();
    }
    expect(
      (
        await c.api.patch(`/api/user/${c.id}`, {
          data: { selected_badges: badges, avatar_border_color: "#123456" },
          headers: await csrfHeader(c.api),
        })
      ).ok()
    ).toBeTruthy();

    // Navigateur NEUF : localStorage vide, seulement les cookies de session.
    const ctx = await browser.newContext({ storageState: await c.api.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await expect(page.locator("#previewBadges .pin-slot--filled")).toHaveCount(3, {
      timeout: 15000,
    });

    const apres = await profilServeur(c);
    expect(apres.selected_badges, "les badges épinglés ne doivent pas être effacés").toEqual(
      badges
    );
    expect(apres.avatar_border_color, "la couleur ne doit pas retomber au défaut").toBe("#123456");

    await ctx.close();
    await c.api.dispose();
  });

  test("un profil local est toujours migré vers un compte encore vierge", async ({ browser }) => {
    // Le cas qui justifie la fonction : le joueur a personnalisé avant de créer
    // son compte. Le retirer pour corriger le bug ci-dessus aurait été jeter le
    // bébé avec l'eau du bain.
    const c = await nouveauCompte("b");
    const ctx = await browser.newContext({ storageState: await c.api.storageState() });
    const page = await ctx.newPage();

    await gotoSettled(page, "/index.html");
    await page.evaluate(() =>
      localStorage.setItem(
        "personaUserProfile",
        JSON.stringify({
          badges: [],
          selectedBadges: [],
          eventCodes: [],
          avatarBorderColor: "#ff00aa",
          profileTheme: "dark_hour",
        })
      )
    );

    await gotoSettled(page, "/profile/profile.html");

    await expect
      .poll(async () => (await profilServeur(c)).avatar_border_color, { timeout: 15000 })
      .toBe("#ff00aa");
    expect((await profilServeur(c)).wallpaper_id).toBe("dark_hour");

    await ctx.close();
    await c.api.dispose();
  });
});
