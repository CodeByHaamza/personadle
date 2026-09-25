import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Réordonnancement des badges épinglés (2.3).
 *
 * Ce que seul un vrai navigateur peut dire : que le glissement FONCTIONNE — à la
 * souris ET au doigt. C'est tout l'enjeu du choix des Pointer Events plutôt que
 * du glisser-déposer HTML5, qui ne se déclenche pas au tactile et aurait laissé
 * la fonctionnalité morte sur mobile sans que rien ne le signale.
 *
 * Et qu'un clic sur le ✕ reste un clic : le seuil de déclenchement existe pour
 * que dépingler ne devienne pas un jeu d'adresse.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

/** Compte avec trois badges épinglés, dans un ordre connu. */
async function joueurAvecBadges(browser, options = {}) {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pseudo = `ord${rnd}`.slice(0, 20);
  const api = await pwRequest.newContext({ baseURL: BASE });
  const r = await api.post("/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(r.ok()).toBeTruthy();
  const { user } = await r.json();

  // Trois badges `manual` : le serveur REFUSE (403) tout badge à condition
  // réelle demandé sans l'avoir remplie — c'est précisément le garde-fou
  // « le client ne décide pas de ce qui existe ».
  const slugs = ["velvet_headache", "into_the_fog", "twin_blade"];
  for (const slug of slugs) {
    const u = await api.post("/api/badges/unlock", {
      data: { badge_id: slug },
      headers: await csrfHeader(api),
    });
    expect(u.ok(), `déblocage de ${slug}`).toBeTruthy();
  }
  const pat = await api.patch(`/api/user/${user.id}`, {
    data: { selected_badges: slugs },
    headers: await csrfHeader(api),
  });
  expect(pat.ok(), "épinglage des trois badges").toBeTruthy();

  const ctx = await browser.newContext({ storageState: await api.storageState(), ...options });
  return { api, page: await ctx.newPage(), ctx, id: user.id, slugs };
}

/**
 * Amène la rangée dans la fenêtre. `page.mouse` et les événements tactiles
 * travaillent en coordonnées de FENÊTRE : la rangée de badges est sous la ligne
 * de flottaison sur la page profil, et sans ce défilement le pointeur ne touche
 * jamais les cases — le test échouerait en accusant le code.
 */
async function amenerAVue(page) {
  await page.locator("#previewBadges").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
}

const ordreAffiche = (page) =>
  page
    .locator("#previewBadges .pin-slot--filled")
    .evaluateAll((els) => els.map((e) => e.dataset.badgeId));

test.describe("Badges épinglés — réordonnancement", () => {
  test("un glissement à la souris change l'ordre, et le serveur le garde", async ({ browser }) => {
    const j = await joueurAvecBadges(browser);
    await gotoSettled(j.page, "/profile/profile.html");

    const cases = j.page.locator("#previewBadges .pin-slot--filled");
    await expect(cases).toHaveCount(3, { timeout: 15000 });
    await amenerAVue(j.page);
    const avant = await ordreAffiche(j.page);

    // Glisse la première case sur la troisième.
    const a = await cases.nth(0).boundingBox();
    const c = await cases.nth(2).boundingBox();
    await j.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await j.page.mouse.down();
    await j.page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 5 });
    await j.page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 10 });
    await j.page.mouse.up();

    await expect
      .poll(async () => (await ordreAffiche(j.page)).join(), { timeout: 8000 })
      .not.toBe(avant.join());

    const apres = await ordreAffiche(j.page);
    expect(apres[2], "le badge glissé doit être au bout").toBe(avant[0]);
    expect([...apres].sort(), "aucun badge perdu").toEqual([...avant].sort());

    // Le serveur doit avoir le nouvel ordre : sans ça il reviendrait au
    // rechargement, et le joueur croirait à un bug.
    await expect
      .poll(
        async () => {
          const p = await (await j.api.get(`/api/user/${j.id}`)).json();
          return (p.profile?.selected_badges ?? []).join();
        },
        { timeout: 15000 }
      )
      .toBe(apres.join());

    await j.ctx.close();
    await j.api.dispose();
  });

  test("le glissement marche AU DOIGT (c'est pourquoi ce n'est pas du DnD HTML5)", async ({
    browser,
  }) => {
    // `hasTouch` est indispensable : sans lui le contexte n'a pas d'écran tactile
    // et les événements ne partent pas du tout.
    const j = await joueurAvecBadges(browser, {
      hasTouch: true,
      isMobile: false,
      viewport: { width: 390, height: 844 },
    });
    await gotoSettled(j.page, "/profile/profile.html");

    const cases = j.page.locator("#previewBadges .pin-slot--filled");
    await expect(cases).toHaveCount(3, { timeout: 15000 });
    await amenerAVue(j.page);
    const avant = await ordreAffiche(j.page);

    const a = await cases.nth(0).boundingBox();
    const b = await cases.nth(1).boundingBox();
    // Séquence tactile brute — c'est exactement ce que le glisser-déposer HTML5
    // ignore, et donc tout l'objet de ce test. Playwright ne sait que « taper » :
    // un glissement au doigt passe par CDP.
    const cdp = await j.page.context().newCDPSession(j.page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: a.x + a.width / 2 + 15, y: a.y + a.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect
      .poll(async () => (await ordreAffiche(j.page)).join(), { timeout: 8000 })
      .not.toBe(avant.join());

    expect([...(await ordreAffiche(j.page))].sort()).toEqual([...avant].sort());

    await j.ctx.close();
    await j.api.dispose();
  });

  test("un clic sur ✕ dépingle toujours, il n'est pas avalé par le glissement", async ({
    browser,
  }) => {
    const j = await joueurAvecBadges(browser);
    await gotoSettled(j.page, "/profile/profile.html");

    const cases = j.page.locator("#previewBadges .pin-slot--filled");
    await expect(cases).toHaveCount(3, { timeout: 15000 });
    await amenerAVue(j.page);

    // Le ✕ est `display: none` tant que la case n'est pas survolée : il faut
    // survoler d'abord, exactement comme un joueur à la souris.
    await cases.nth(0).hover();
    await cases.nth(0).locator(".pin-unpin").click();
    await expect(cases).toHaveCount(2);

    await j.ctx.close();
    await j.api.dispose();
  });

  test("les flèches du clavier déplacent le badge qui a le focus", async ({ browser }) => {
    // Un réordonnancement au seul glissement serait inaccessible au clavier,
    // alors que la rangée est atteignable en tabulation.
    const j = await joueurAvecBadges(browser);
    await gotoSettled(j.page, "/profile/profile.html");

    const cases = j.page.locator("#previewBadges .pin-slot--filled");
    await expect(cases).toHaveCount(3, { timeout: 15000 });
    const avant = await ordreAffiche(j.page);

    await cases.nth(0).focus();
    await j.page.keyboard.press("ArrowRight");

    await expect
      .poll(async () => (await ordreAffiche(j.page))[1], { timeout: 8000 })
      .toBe(avant[0]);

    await j.ctx.close();
    await j.api.dispose();
  });
});

test.describe("Badges épinglés — consulter et voir où le badge tombe", () => {
  test("cliquer un badge déjà épinglé ouvre sa fiche", async ({ browser }) => {
    // Avant ce lot, ce clic ne faisait RIEN : pour relire la condition d'un de
    // ses propres badges, il fallait rouvrir l'atelier et le retrouver dans la
    // grille. Le seuil de glissement rend ce clic possible sans casser le geste.
    const j = await joueurAvecBadges(browser);
    await gotoSettled(j.page, "/profile/profile.html");

    const cases = j.page.locator("#previewBadges .pin-slot--filled");
    await expect(cases).toHaveCount(3, { timeout: 15000 });
    await amenerAVue(j.page);
    const avant = await ordreAffiche(j.page);

    await cases.nth(1).click();

    const fiche = j.page.locator(".badge-inspect__card");
    await expect(fiche).toBeVisible({ timeout: 8000 });
    await expect(fiche.locator(".badge-inspect__name")).not.toBeEmpty();
    // Un badge épinglé est débloqué par construction : sa condition est lisible.
    await expect(fiche.locator(".badge-inspect__condition")).not.toBeEmpty();

    // Consulter ne modifie rien — ni l'ordre, ni l'épinglage.
    expect(await ordreAffiche(j.page)).toEqual(avant);
    await j.page.locator(".badge-inspect__close").click();
    await expect(fiche).toBeHidden();
    await expect(cases).toHaveCount(3);

    await j.ctx.close();
    await j.api.dispose();
  });

  test("le badge reste visible à sa future place pendant le glissement", async ({ browser }) => {
    // Le retour qui a motivé cette version : la première laissait un trou à la
    // place du badge saisi (« c'est pas intuitif, ça fait trop vide »). On vérifie
    // donc, POINTEUR ENCORE ENFONCÉ, que le badge est dans la rangée, en
    // transparence, et déjà à la position qu'il aura au relâchement.
    const j = await joueurAvecBadges(browser);
    await gotoSettled(j.page, "/profile/profile.html");

    const cases = j.page.locator("#previewBadges .pin-slot--filled");
    await expect(cases).toHaveCount(3, { timeout: 15000 });
    await amenerAVue(j.page);
    const avant = await ordreAffiche(j.page);

    const a = await cases.nth(0).boundingBox();
    const b = await cases.nth(1).boundingBox();
    await j.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await j.page.mouse.down();
    await j.page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 5 });
    await j.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });

    const saisi = j.page.locator("#previewBadges .pin-slot--dragging");
    await expect(saisi).toHaveCount(1);
    // Toujours affiché, et estompé : c'est l'aperçu, pas un trou.
    await expect(saisi).toBeVisible();
    const opacite = await saisi.evaluate((e) => parseFloat(getComputedStyle(e).opacity));
    expect(opacite, "le badge saisi est transparent").toBeGreaterThan(0);
    expect(opacite, "…mais pas opaque").toBeLessThan(1);

    // Aucune case ne manque, et l'ordre affiché est DÉJÀ le futur ordre.
    await expect(cases).toHaveCount(3);
    expect(await ordreAffiche(j.page)).toEqual([avant[1], avant[0], avant[2]]);

    await j.page.mouse.up();
    await expect
      .poll(async () => (await ordreAffiche(j.page)).join(), { timeout: 8000 })
      .toBe([avant[1], avant[0], avant[2]].join());
    // Le geste terminé, plus rien n'est estompé.
    await expect(j.page.locator("#previewBadges .pin-slot--dragging")).toHaveCount(0);

    await j.ctx.close();
    await j.api.dispose();
  });
});
