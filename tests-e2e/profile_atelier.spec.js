import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/profile_atelier.spec.js — la personnalisation du profil version 2.2
 * (l'« atelier »), conduite dans le navigateur contre la vraie pile :
 *
 *   - plus de bouton Save : un choix dans l'atelier part au serveur tout seul,
 *     l'indicateur passe par « Enregistrement… » puis « Enregistré », et une
 *     rafale de clics ne fait qu'un envoi complet ;
 *   - un portrait de la galerie s'applique au clic (plus de modale à valider),
 *     un GIF animé compris — et il SURVIT au rechargement (le serveur refusait
 *     cette forme jusqu'en 2.2, le choix revenait en arrière au pull suivant) ;
 *   - les 4 emplacements de badges sur la carte : épingler depuis l'onglet
 *     Badges, désépingler d'une croix, tout ça persiste côté serveur ;
 *   - la puce « Choisir un titre » ouvre l'onglet Titre ; l'onglet rouvert est
 *     celui de la dernière visite ;
 *   - un profil consulté (?view=) ne montre ni l'atelier, ni l'indicateur, ni
 *     les emplacements vides.
 *
 * Pré-requis : stack Docker (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

/** moderation.spec.js ferme le site (503) quelques centaines de ms : on rejoue. */
async function call(ctx, method, url, options) {
  let res;
  for (let attempt = 0; attempt < 30; attempt++) {
    res = await ctx[method](url, options);
    if (res.status() !== 503) return res;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return res;
}

async function registerUser(suffix) {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `at${suffix}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code, pseudo };
}

async function adminContext() {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await call(ctx, "post", "/api/auth/login", {
    data: { identifier: "admin@personadle.local", password: "admintest123" },
  });
  expect(res.ok(), "login admin (base fraîche : make up)").toBeTruthy();
  return ctx;
}

const serverProfile = async (u) =>
  (await (await call(u.ctx, "get", `/api/user/${u.userId}`)).json()).profile;

test.describe("Atelier — enregistrement automatique, avatar, bordure", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser("auto");
  });
  test.afterAll(async () => {
    await u?.ctx?.dispose();
  });

  test("la page n'a plus de bouton Save ni de modale Titres ; l'indicateur dit « tout est enregistré »", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await expect(page.locator("#saveAndRefreshBtn")).toHaveCount(0);
    await expect(page.locator("#openTitlesModal")).toHaveCount(0);
    await expect(page.locator("#titlesModal")).toHaveCount(0);
    await expect(page.locator("#saveStatus")).toHaveAttribute("data-state", "idle");
    await expect(page.locator("#atelier .atelier-tab")).toHaveCount(5);
    await expect(page.locator("#previewBadges .pin-slot")).toHaveCount(4);
    await ctx.close();
  });

  test("une rafale de pastilles de bordure → « Enregistrement… », puis « Enregistré », un seul envoi complet, la dernière couleur côté serveur", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click('.atelier-tab[data-pane="border"]');

    // Compter les PATCH complets (ceux qui portent wallpaper_id ET avatar_border_color
    // ensemble = syncProfileToCloud) pendant la rafale.
    let fullPatches = 0;
    page.on("request", (r) => {
      if (r.method() !== "PATCH" || !r.url().includes("/api/user/")) return;
      const body = r.postDataJSON?.() ?? {};
      if ("wallpaper_id" in body && "avatar_border_color" in body) fullPatches++;
    });

    for (const c of ["#ffd700", "#e63946", "#3b82f6"]) {
      await page.click(`#borderSwatches .swatch[data-color="${c}"]`);
    }
    await expect(page.locator("#saveStatus")).toHaveAttribute("data-state", "saving");
    await expect(page.locator("#saveStatus")).toHaveAttribute("data-state", "saved", {
      timeout: 10_000,
    });
    await expect(page.locator("#pageAvatar")).toHaveCSS("border-color", "rgb(59, 130, 246)");
    // Le « Enregistré » s'efface tout seul
    await expect(page.locator("#saveStatus")).toHaveAttribute("data-state", "idle", {
      timeout: 5_000,
    });
    expect(fullPatches, "une rafale = un envoi complet").toBe(1);
    await expect.poll(async () => (await serverProfile(u)).avatar_border_color).toBe("#3b82f6");
    await ctx.close();
  });

  test("un portrait GIF de la galerie s'applique au clic, est accepté par le serveur et survit au rechargement", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click('.atelier-tab[data-pane="avatar"]');
    const gif = page.locator('#avatarGrid .avatar-cell img[data-src$=".gif"]').first();
    const src = await gif.getAttribute("data-src");
    expect(src).toMatch(/^\.\.\/img\/avatar\/[\w-]+\.gif$/);

    const patch = page.waitForResponse(
      (r) =>
        r.request().method() === "PATCH" &&
        r.url().includes("/api/user/") &&
        "avatar_data" in (r.request().postDataJSON?.() ?? {})
    );
    await gif.click();
    expect((await patch).status(), "le serveur accepte un portrait de la galerie").toBe(200);
    await expect(page.locator("#pageAvatar")).toHaveAttribute("src", src);
    await expect(gif).toHaveClass(/selected/);
    await expect.poll(async () => (await serverProfile(u)).avatar_data).toBe(src);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#pageAvatar")).toHaveAttribute("src", src, { timeout: 10_000 });
    await ctx.close();
  });

  test("un portrait fixe est rendu en PNG (data:) comme le recadrage — même format pour amis et défis", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    const png = page
      .locator('#avatarGrid .avatar-cell img:not([data-src$=".gif"])')
      .first();
    await png.click();
    await expect(page.locator("#pageAvatar")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect.poll(async () => (await serverProfile(u)).avatar_data).toMatch(
      /^data:image\/png;base64,/
    );
    await ctx.close();
  });

  test("« Choisir un titre » ouvre l'onglet Titre ; l'onglet rouvert est celui de la dernière visite", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await expect(page.locator("#equippedTitleEmpty")).toBeVisible();
    await page.click("#equippedTitleBtn");
    await expect(page.locator('.atelier-tab[data-pane="title"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator("#pane-title")).toBeVisible();
    await expect(page.locator("#titlesModalGrid .tm-card").first()).toBeVisible();

    await page.click('.atelier-tab[data-pane="theme"]');
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator('.atelier-tab[data-pane="theme"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator("#pane-theme")).toBeVisible();
    await ctx.close();
  });
});

test.describe("Atelier — badges épinglés et profil consulté", () => {
  let u, viewer, admin;
  test.beforeAll(async () => {
    u = await registerUser("pin");
    viewer = await registerUser("see");
    admin = await adminContext();
    for (const slug of ["first_win", "ace_defective"]) {
      const r = await call(admin, "post", `/api/admin/users/${u.userId}/badges`, {
        data: { slug },
        headers: await csrfHeader(admin),
      });
      expect(r.ok()).toBeTruthy();
    }
  });
  test.afterAll(async () => {
    await u?.ctx?.dispose();
    await viewer?.ctx?.dispose();
    await admin?.dispose();
  });

  test("épingler depuis l'onglet Badges, désépingler d'une croix : la carte et le serveur suivent", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    // Un « + » vide ouvre l'onglet Badges
    await page.locator("#previewBadges .pin-slot--empty").first().click();
    await expect(page.locator('.atelier-tab[data-pane="badges"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    // Les deux badges accordés en base apparaissent (réconciliation serveur → local)
    await expect(page.locator("#badgePickGrid .badge-pick")).toHaveCount(2, { timeout: 10_000 });

    await page.click('#badgePickGrid .badge-pick[data-id="first_win"]');
    await expect(page.locator('#badgePickGrid .badge-pick[data-id="first_win"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.locator("#previewBadges .pin-slot--filled")).toHaveCount(1);
    await expect(page.locator("#previewBadges .pin-slot--empty")).toHaveCount(3);
    await expect(page.locator("#badgePickHint")).toHaveAttribute("data-count", "1/4");
    await expect.poll(async () => (await serverProfile(u)).selected_badges).toEqual(["first_win"]);

    await page.click('#badgePickGrid .badge-pick[data-id="ace_defective"]');
    await expect(page.locator("#previewBadges .pin-slot--filled")).toHaveCount(2);
    await expect
      .poll(async () => (await serverProfile(u)).selected_badges)
      .toEqual(["first_win", "ace_defective"]);

    // La croix (visible au survol) désépingle sans passer par l'onglet
    const slot = page.locator('#previewBadges .pin-slot--filled[data-badge-id="first_win"]');
    await slot.hover();
    await slot.locator(".pin-unpin").click();
    await expect(page.locator("#previewBadges .pin-slot--filled")).toHaveCount(1);
    await expect(page.locator('#badgePickGrid .badge-pick[data-id="first_win"]')).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect.poll(async () => (await serverProfile(u)).selected_badges).toEqual([
      "ace_defective",
    ]);
    await ctx.close();
  });

  test("profil consulté (?view=) : ni atelier, ni indicateur, ni emplacement vide — juste le badge épinglé", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await viewer.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, `/profile/profile.html?view=${u.friendCode}`);
    await expect(page.locator("#atelier")).toBeHidden();
    await expect(page.locator("#saveStatus")).toBeHidden();
    await expect(page.locator("#equippedTitleEmpty")).toBeHidden();
    await expect(page.locator("#editAvatarBtn")).toBeHidden();
    await expect(page.locator("#previewBadges .pin-slot--empty")).toHaveCount(0);
    await expect(
      page.locator('#previewBadges .pin-slot--filled img[data-badge-id="ace_defective"]')
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#previewBadges .pin-unpin")).toHaveCount(0);
    await ctx.close();
  });
});
