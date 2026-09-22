import { test, expect, request as pwRequest } from "@playwright/test";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/settings_modal.spec.js — la modale ⚙ Paramètres, conduite dans un
 * vrai navigateur.
 *
 * Signalé par Gypotre : « quand on modifie nos paramètres depuis notre profil,
 * on ne voit pas le bouton sauvegarder ».
 *
 * `.sm-panel` défile (`max-height: 88vh; overflow-y: auto`) et « Sauvegarder »
 * en était le dernier enfant. Sur la page profil — et seulement là — la zone de
 * danger est montée en plus (elle dépend de `window._personadleDanger`), ce qui
 * allonge assez le panneau pour pousser le bouton sous la ligne de flottaison.
 * D'où un bug invisible depuis l'accueil, où la même modale tient à l'écran.
 *
 * Un test unitaire jsdom ne peut rien dire ici : il ne calcule aucune mise en
 * page. `tests/settings_modal.test.js` ne verrouille donc que la structure ;
 * c'est ce fichier qui vérifie que le bouton est réellement à l'écran, dans la
 * fenêtre la plus basse qu'on supporte et avant tout défilement.
 *
 * Pré-requis : stack Docker (make up). Compte frais à chaque run.
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

async function registerUser() {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `sm_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), "register doit réussir").toBeTruthy();
  return { ctx, pseudo };
}

/** Ouvre la modale et rend le bouton « Sauvegarder », sans avoir rien défilé. */
async function openSettings(page) {
  await page.click("#settingsBtn");
  const panel = page.locator("#settingsModal .sm-panel");
  await expect(panel).toBeVisible();
  return page.locator("#smSave");
}

/** Pixels de panneau visibles SOUS le pied collant (1 px de bordure attendu). */
async function panelFooterGap(page) {
  return page.locator("#settingsModal .sm-panel").evaluate((el) => {
    const f = el.querySelector(".sm-footer").getBoundingClientRect();
    return Math.round(el.getBoundingClientRect().bottom - f.bottom);
  });
}

test.describe("⚙ Paramètres — le bouton Sauvegarder reste à l'écran", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser();
  });
  test.afterAll(async () => {
    await u?.ctx?.dispose();
  });

  test("depuis le profil, Sauvegarder est visible sans défiler — zone de danger comprise", async ({
    browser,
  }) => {
    // 720 px de haut : la plus petite hauteur de fenêtre qu'on supporte en
    // desktop, donc le pire cas pour un panneau plafonné à 88vh.
    const ctx = await browser.newContext({
      storageState: await u.ctx.storageState(),
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    const save = await openSettings(page);

    // La zone de danger n'est montée QUE sur le profil : c'est elle qui
    // allongeait le panneau. Si elle disparaissait, ce test ne prouverait plus
    // rien — on vérifie donc qu'elle est bien là avant de conclure.
    await expect(page.locator("#smDangerSection")).toBeVisible();

    await expect(save).toBeInViewport();
    await expect(save).toBeEnabled();

    // Le pied doit fermer le panneau, pas flotter au-dessus d'une bande où le
    // contenu continue de défiler. Un élément collant est borné par son bloc
    // conteneur : tant que `.sm-panel` gardait son `padding-bottom`, il restait
    // 27 px de contenu visible sous le bouton (mesuré). Seul le 1 px de bordure
    // est tolérable.
    const ecart = await panelFooterGap(page);
    expect(ecart, "le pied doit être au ras du bas du panneau").toBeLessThanOrEqual(2);

    await ctx.close();
  });

  test("Sauvegarder reste à l'écran une fois le panneau défilé jusqu'en bas", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      storageState: await u.ctx.storageState(),
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    const save = await openSettings(page);
    const panel = page.locator("#settingsModal .sm-panel");

    await panel.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(save).toBeInViewport();

    await panel.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(save).toBeInViewport();

    await ctx.close();
  });

  test("sur mobile aussi, et le clic enregistre vraiment", async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: await u.ctx.storageState(),
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    const save = await openSettings(page);
    await expect(save).toBeInViewport();

    // Visible ne suffit pas : le pied collant ne doit pas non plus intercepter
    // le clic ni sortir du panneau (ses marges négatives suivent le padding,
    // qui change sous 480 px).
    //
    // Le toggle est un switch CSS : l'`input` est masqué et c'est le `.slider`
    // qu'on clique — comme un joueur. `uncheck()` sur l'input échouerait sur un
    // élément invisible, sans rien dire du bug qu'on mesure ici.
    await page.click("#smProfileAutoplayOthers + .slider");
    await expect(page.locator("#smProfileAutoplayOthers")).not.toBeChecked();

    // `toBeVisible()` seul ne prouvait rien : la classe `hidden` que pose
    // `_save()` n'était définie nulle part, donc l'indicateur était toujours
    // dans le flux, vide. On attend maintenant qu'il soit caché AVANT le clic,
    // puis qu'il porte un texte après.
    const status = page.locator("#smStatus");
    await expect(status).toBeHidden();

    await save.click();
    await expect(status).toBeVisible();
    await expect(status).not.toBeEmpty();

    await ctx.close();
  });

  test("le panneau défile à la molette : la zone de danger est atteignable", async ({
    browser,
  }) => {
    // Trouvé en corrigeant le bouton Sauvegarder, et plus grave que lui : le bloc
    // « Identité Persona 5 » en bas de css/settings-modal.css posait
    // `overflow: hidden` sur `.sm-panel`, écrasant le `overflow-y: auto` déclaré
    // plus haut (même sélecteur, même spécificité, déclaré après). Sur une
    // fenêtre de 720 px : 1054 px de contenu pour 690 px visibles, donc 364 px
    // inatteignables — dont « Réinitialiser le profil » et « Supprimer mon
    // compte », sans barre de défilement ni molette pour y aller.
    const ctx = await browser.newContext({
      storageState: await u.ctx.storageState(),
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await openSettings(page);

    const panel = page.locator("#settingsModal .sm-panel");

    // La régression était dans la cascade, pas dans le markup : on la vérifie là
    // où elle se produit. `scrollTop` en JS marche même avec overflow:hidden,
    // donc un test qui défilerait par script ne verrait rien.
    await expect(panel).toHaveCSS("overflow-y", "auto");

    const deleteBtn = page.locator("#smDeleteAccount");
    await expect(deleteBtn).not.toBeInViewport();

    const box = await panel.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1200);

    await expect(deleteBtn).toBeInViewport();
    await expect(page.locator("#smResetProfile")).toBeInViewport();
    // Et le pied ne s'est pas décroché en route.
    await expect(page.locator("#smSave")).toBeInViewport();

    await ctx.close();
  });

  test("depuis l'accueil, la modale n'a pas de zone de danger et Sauvegarder reste visible", async ({
    browser,
  }) => {
    // Le contre-cas : là où le bug ne se voyait pas. Il ne doit pas apparaître
    // dans l'autre sens en rendant le pied collant.
    const ctx = await browser.newContext({
      storageState: await u.ctx.storageState(),
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/index.html");

    const save = await openSettings(page);
    await expect(page.locator("#smDangerSection")).toBeHidden();
    await expect(save).toBeInViewport();

    await ctx.close();
  });
});
