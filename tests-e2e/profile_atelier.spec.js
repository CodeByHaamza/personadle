import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/profile_atelier.spec.js — la page profil version 2.2 : une VITRINE
 * (badges gagnés, collection de wallpapers, carte de partage) et une modale
 * d'atelier pour tout ce qui s'édite. Conduit dans le navigateur, vraie pile :
 *
 *   - la personnalisation vit dans UNE modale (« Personnaliser », le ✎, la puce
 *     de titre, un emplacement de badge vide y mènent) ; la page n'édite plus rien ;
 *   - les badges débloqués sont montrés en grand sur la page, les wallpapers en
 *     bande compacte avec un aperçu au clic ;
 *   - l'export du profil a quitté la page pour les ⚙ Paramètres ;
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

  test("la page est une vitrine : rien à éditer dessus, pas de Save, pas d'export — et l'atelier est fermé", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await expect(page.locator("#saveAndRefreshBtn")).toHaveCount(0);
    await expect(page.locator("#openTitlesModal")).toHaveCount(0);
    await expect(page.locator("#titlesModal")).toHaveCount(0);
    // L'export a déménagé dans les ⚙ Paramètres
    await expect(page.locator("#exportProfile")).toHaveCount(0);
    await expect(page.locator("#saveStatus")).toHaveAttribute("data-state", "idle");
    // L'atelier existe mais reste fermé tant qu'on ne le demande pas
    await expect(page.locator("#atelierModal")).toBeHidden();
    await expect(page.locator("#atelierModal .atelier-tab")).toHaveCount(5);
    await expect(page.locator("#openAtelierBtn")).toBeVisible();
    await expect(page.locator("#previewBadges .pin-slot")).toHaveCount(4);
    // La vitrine des badges et la bande de wallpapers sont sur la page
    await expect(page.locator("#badgesShowcase")).toBeVisible();
    await expect(page.locator(".wp-chip")).toHaveCount(7);
    await expect(page.locator("#wallpapersCount")).toHaveText(/\d+ \/ 7/);
    await ctx.close();
  });

  test("« Personnaliser » ouvre la modale, la croix et Escape la referment", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    await page.click("#openAtelierBtn");
    await expect(page.locator("#atelierModal")).toBeVisible();
    // La croix doit être CLIQUABLE : elle vit sous les boutons flottants
    // (Mode sombre / ⚙ / Compendium, z-index 9999) — d'où #atelierModal à 10000.
    await page.click("#closeAtelierModal");
    await expect(page.locator("#atelierModal")).toBeHidden();

    await page.click("#openAtelierBtn");
    await page.keyboard.press("Escape");
    await expect(page.locator("#atelierModal")).toBeHidden();
    await ctx.close();
  });

  test("un clic sur un badge de la vitrine l'ouvre en grand ; un wallpaper montre sa condition", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    await page.locator(".wp-chip").first().click();
    await expect(page.locator(".wp-preview")).toBeVisible();
    await expect(page.locator(".wp-preview-cond")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(page.locator(".wp-preview")).toHaveCount(0, { timeout: 5_000 });
    await ctx.close();
  });

  test("l'export du profil se fait depuis les ⚙ Paramètres", async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: await u.ctx.storageState(),
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click("#settingsBtn");
    await expect(page.locator("#settingsModal")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.click("#smExport");
    expect((await download).suggestedFilename()).toBe("personadle_profile.json");
    await ctx.close();
  });

  test("une rafale de pastilles de bordure → « Enregistrement… », puis « Enregistré », un seul envoi complet, la dernière couleur côté serveur", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click("#openAtelierBtn");
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
    await page.click("#openAtelierBtn");
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

  test("aucun import d'image : la seule source est la galerie, recadrable", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click("#openAtelierBtn");
    // Décision Hamza du 2026-09-16 : que les portraits du jeu (dérives).
    await expect(page.locator("#avatarUploadInput")).toHaveCount(0);
    // …mais on peut recadrer celui qu'on porte (certains sont mal cadrés).
    await expect(page.locator("#avatarAdjustBtn")).toBeVisible();
    await ctx.close();

    // Et le serveur refuse ce qui n'est ni un portrait de la galerie ni une image :
    // un chemin inventé, ou un data: qui n'est pas une image.
    for (const bad of ["../img/avatar/Nope_Does_Not_Exist.png", "data:text/html,<b>x</b>"]) {
      const res = await call(u.ctx, "patch", `/api/user/${u.userId}`, {
        data: { avatar_data: bad },
        headers: await csrfHeader(u.ctx),
      });
      expect(res.status(), bad).toBe(400);
    }
  });

  test("recadrer le portrait porté : l'image recadrée remplace le chemin", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click("#openAtelierBtn");
    // Un portrait fixe (un GIF garderait son chemin pour ne pas perdre l'animation)
    await page.locator('#avatarGrid .avatar-cell img:not([data-src$=".gif"])').first().click();
    await page.click("#avatarAdjustBtn");
    await expect(page.locator("#avatarCropModal")).toBeVisible();
    await page.click("#zoomIn");
    await page.click("#confirmCrop");
    await expect(page.locator("#avatarCropModal")).toBeHidden();
    await expect(page.locator("#pageAvatar")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect
      .poll(async () => (await serverProfile(u)).avatar_data)
      .toMatch(/^data:image\/png;base64,/);
    await ctx.close();
  });

  test("un portrait fixe est enregistré par son chemin (même forme que les GIF)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click("#openAtelierBtn");
    const png = page.locator('#avatarGrid .avatar-cell img:not([data-src$=".gif"])').first();
    const src = await png.getAttribute("data-src");
    await png.click();
    await expect(page.locator("#pageAvatar")).toHaveAttribute("src", src);
    await expect.poll(async () => (await serverProfile(u)).avatar_data).toBe(src);
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
    await expect(page.locator("#atelierModal")).toBeVisible();
    await expect(page.locator('.atelier-tab[data-pane="title"]')).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.locator("#pane-title")).toBeVisible();
    await expect(page.locator("#titlesModalGrid .tm-card").first()).toBeVisible();

    await page.click('.atelier-tab[data-pane="theme"]');
    await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.click("#openAtelierBtn");
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
    // …et un titre, pour la collection consultable par un ami
    const titles = await (await call(u.ctx, "get", "/api/titles")).json();
    const junesId = titles.find((t) => t.slug === "junes")?.id;
    expect(junesId, "le titre junes existe au catalogue").toBeTruthy();
    const gt = await call(admin, "post", `/api/admin/users/${u.userId}/titles`, {
      data: { title_id: junesId },
      headers: await csrfHeader(admin),
    });
    expect(gt.ok(), await gt.text()).toBeTruthy();
    // …et il l'équipe : un visiteur doit voir le titre porté sous son pseudo
    const eq = await call(u.ctx, "patch", `/api/user/${u.userId}`, {
      data: { equipped_title_id: junesId },
      headers: await csrfHeader(u.ctx),
    });
    expect(eq.ok(), await eq.text()).toBeTruthy();
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

    // Un « + » vide ouvre la modale sur l'onglet Badges
    await page.locator("#previewBadges .pin-slot--empty").first().click();
    await expect(page.locator("#atelierModal")).toBeVisible();
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

    // La croix (visible au survol) désépingle depuis la carte, modale fermée
    await page.click("#closeAtelierModal");
    const slot = page.locator('#previewBadges .pin-slot--filled[data-badge-id="first_win"]');
    await slot.hover();
    await slot.locator(".pin-unpin").click();
    await expect(page.locator("#previewBadges .pin-slot--filled")).toHaveCount(1);
    await page.click("#openAtelierBtn");
    await expect(page.locator('#badgePickGrid .badge-pick[data-id="first_win"]')).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect.poll(async () => (await serverProfile(u)).selected_badges).toEqual([
      "ace_defective",
    ]);

    // Et la vitrine de la page montre bien les deux badges gagnés, dont l'épinglé
    await page.click("#closeAtelierModal");
    await expect(page.locator("#badgesShowcase .showcase-badge")).toHaveCount(2);
    await expect(
      page.locator('#badgesShowcase .showcase-badge[data-id="ace_defective"]')
    ).toHaveClass(/showcase-badge--pinned/);
    await expect(page.locator("#badgesCount")).toHaveText(/^2 \/ \d+$/);
    await ctx.close();
  });

  test("profil consulté (?view=) : ni atelier, ni indicateur, ni emplacement vide — juste le badge épinglé", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await viewer.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, `/profile/profile.html?view=${u.friendCode}`);
    await expect(page.locator("#atelierModal")).toBeHidden();
    await expect(page.locator("#openAtelierBtn")).toBeHidden();
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

  test("profil consulté : on voit TOUS ses badges, en lecture seule", async ({
    browser,
  }) => {
    // Retour Hamza (2026-09-16) : « il faudrait un truc pour consulter tous les
    // badges d'un ami quand on visite son profil ». (La liste de ses titres a été
    // essayée puis retirée le même jour : « ça rend mal ».)
    const ctx = await browser.newContext({ storageState: await viewer.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, `/profile/profile.html?view=${u.friendCode}`);

    // Ses badges : les deux accordés, avec le compteur de sa collection
    await expect(page.locator("#badgesShowcase .showcase-badge")).toHaveCount(2, {
      timeout: 10_000,
    });
    await expect(page.locator("#badgesCount")).toHaveText(/^2 \/ \d+$/);
    // …et pas le bouton vers SA propre collection à soi
    await expect(page.locator("#openBadgesModal")).toBeHidden();

    // Son titre équipé reste visible sous son pseudo
    await expect(page.locator("#equippedTitleImg")).toBeVisible();
    await ctx.close();
  });
});
