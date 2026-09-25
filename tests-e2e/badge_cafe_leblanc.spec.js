import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * Badge secret « Café Leblanc » — de bout en bout.
 *
 * La chaîne complète traverse trois frontières que rien d'autre ne teste
 * ensemble : un `onclick` inline dans `index.html` écrit un drapeau dans le
 * profil local, le catalogue client le lit au chargement du profil, et le
 * serveur accorde (ou non) le badge. Un maillon cassé ne se voit nulle part —
 * le joueur clique simplement, et rien n'arrive.
 *
 * Le lien part vers ko-fi.com dans un nouvel onglet : la navigation externe est
 * interceptée, on ne veut ni dépendre du réseau ni marteler leur site en CI.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

async function compte() {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pseudo = `kofi${rnd}`.slice(0, 20);
  const api = await pwRequest.newContext({ baseURL: BASE });
  const r = await api.post("/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(r.ok()).toBeTruthy();
  const { user } = await r.json();
  return { api, id: user.id };
}

/** Les slugs de badges que le SERVEUR reconnaît comme acquis pour ce compte. */
async function badgesDuServeur(api) {
  const r = await api.get("/api/badges");
  expect(r.ok(), "GET /api/badges").toBeTruthy();
  const j = await r.json();
  const liste = j.badges ?? j.data ?? j;
  return (Array.isArray(liste) ? liste : [])
    .filter((b) => b.unlocked || b.owned || b.is_unlocked)
    .map((b) => b.slug ?? b.badge_id ?? b.id);
}

test.describe("Badge Café Leblanc", () => {
  test("le lien Ko-fi de l'accueil finit par accorder le badge", async ({ browser }) => {
    const c = await compte();
    const ctx = await browser.newContext({ storageState: await c.api.storageState() });
    const page = await ctx.newPage();

    // On ne sort pas du site : le clic ouvre ko-fi.com, on l'intercepte.
    await ctx.route("**://ko-fi.com/**", (route) => route.fulfill({ status: 204, body: "" }));

    await gotoSettled(page, "/index.html");
    const lien = page.locator("#kofiLink");
    await expect(lien).toHaveCount(1);

    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("personaUserProfile") || "{}").visitedKofi
      ),
      "drapeau absent avant le clic"
    ).toBeFalsy();

    await lien.scrollIntoViewIfNeeded();
    await lien.click();
    await page.waitForTimeout(300);

    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("personaUserProfile") || "{}").visitedKofi
      ),
      "drapeau posé par le clic"
    ).toBe(true);

    // Le profil évalue le catalogue au chargement et demande les déblocages dus.
    await gotoSettled(page, "/profile/profile.html");
    await expect
      .poll(async () => (await badgesDuServeur(c.api)).includes("cafe_leblanc"), {
        timeout: 20000,
      })
      .toBe(true);

    await ctx.close();
    await c.api.dispose();
  });

  test("sans le clic, le serveur n'accorde rien", async ({ browser }) => {
    // Le pendant indispensable du test précédent : un badge qui s'accorderait de
    // toute façon passerait le premier scénario au vert sans rien prouver.
    const c = await compte();
    const ctx = await browser.newContext({ storageState: await c.api.storageState() });
    const page = await ctx.newPage();

    await gotoSettled(page, "/profile/profile.html");
    await page.waitForTimeout(3000);

    expect(await badgesDuServeur(c.api)).not.toContain("cafe_leblanc");

    await ctx.close();
    await c.api.dispose();
  });
});
