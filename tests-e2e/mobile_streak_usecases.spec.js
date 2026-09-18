import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/mobile_streak_usecases.spec.js — deux angles que le reste de la
 * suite ne prend pas :
 *
 * Partie 1 — la STREAK et les STATS telles que le joueur les VOIT, après de
 *   vraies parties jouées dans le navigateur (pas seulement par l'API) : profil
 *   à zéro, victoire du jour → Parties 1 / Victoires 1 / Série 1 ; partie
 *   d'hier (API) puis victoire du jour (navigateur) → Série 2 ; abandon dans un
 *   autre mode → Abandons 1, la série globale ne bouge pas (elle compte les
 *   jours joués) ; la page rechargée montre la même chose (cloud = vérité).
 *
 * Partie 2 — MOBILE (390 × 844, tactile) : pop-up de défi à l'accueil, Accepter
 *   mène sur le mode avec le bandeau, aucune page ne déborde horizontalement
 *   (accueil, mode, Amis, profil), la Boîte de la page Amis fonctionne au doigt,
 *   la modale des badges tient dans l'écran et sa bulle d'info reste dans la
 *   fenêtre.
 *
 * Pré-requis : stack Docker (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

/** Un iPhone 13 en Chromium : viewport, tactile, UA mobile (pas de webkit en CI). */
const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  serviceWorkers: "block",
};
const parisDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + offset * 86_400_000)
  );

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
  const pseudo = `ms${suffix}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code, pseudo };
}

async function befriend(from, to) {
  const res = await call(from.ctx, "post", "/api/friends/", {
    data: { friend_code: to.friendCode },
    headers: await csrfHeader(from.ctx),
  });
  expect(res.ok()).toBeTruthy();
  const { friendship_id: id } = await res.json();
  const acc = await call(to.ctx, "patch", `/api/friends/${id}`, {
    data: { action: "accept" },
    headers: await csrfHeader(to.ctx),
  });
  expect(acc.ok()).toBeTruthy();
}

async function playApi(user, { mode = "classic", result = "win", date = parisDay() } = {}) {
  const r = await call(user.ctx, "post", "/api/sessions", {
    data: {
      mode,
      played_date: date,
      target_name: `E2E ${mode} ${Math.random().toString(36).slice(2, 8)}`,
      result,
      attempts: 2,
      time_ms: 2000,
      client_session_id: crypto.randomUUID(),
    },
    headers: await csrfHeader(user.ctx),
  });
  expect(r.ok(), `session refusée : ${r.status()} ${await r.text()}`).toBeTruthy();
}

/** Lit une tuile de stats du profil par son libellé (langue par défaut : EN). */
async function statValue(page, label) {
  const item = page
    .locator(".stat-item")
    .filter({ has: page.locator(".stat-label", { hasText: label }) });
  await expect(item.first()).toBeVisible({ timeout: 10_000 });
  return (await item.first().locator(".stat-value").textContent()).trim();
}

/** Gagne la partie du jour en Classique en tapant le nom de la cible. */
async function winClassic(page) {
  await gotoSettled(page, "/classiqueMode/classiqueMode.html");
  const target = await page.evaluate(
    () => JSON.parse(localStorage.getItem("target") || "null")?.nom
  );
  expect(target, "la cible du jour est posée").toBeTruthy();
  await page.locator("#textbar").fill(target);
  await page.locator("#guessButton").click();
  await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10_000 });
  return target;
}

async function noHorizontalOverflow(page, label) {
  const { sw, iw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(sw, `${label} : pas de débordement horizontal (${sw} > ${iw})`).toBeLessThanOrEqual(
    iw + 1
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Partie 1 — streak et stats vues du profil
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("Profil : la streak et les stats après de vraies parties", () => {
  let u;
  let ctx;

  test.beforeAll(async ({ browser }) => {
    u = await registerUser("stk");
    ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
  });
  test.afterAll(async () => {
    await ctx?.close();
    await u?.ctx?.dispose();
  });

  test("compte neuf : tout à zéro", async () => {
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    expect(await statValue(page, "Games Played")).toBe("0");
    expect(await statValue(page, "Current Streak")).toBe("0");
    await page.close();
  });

  test("partie d'hier (sync tardive) + victoire du jour dans le navigateur : Parties 2, Victoires 2, Série 2", async () => {
    await playApi(u, { date: parisDay(-1) });
    const page = await ctx.newPage();
    await winClassic(page);
    // La session part en arrière-plan : on attend qu'elle soit en base.
    await expect
      .poll(
        async () => {
          const res = await call(u.ctx, "get", `/api/user/${u.userId}/stats`);
          return Number(
            (await res.json()).stats.by_mode.find((m) => m.mode === "classic")?.games ?? 0
          );
        },
        { timeout: 15_000 }
      )
      .toBe(2);

    await gotoSettled(page, "/profile/profile.html");
    expect(await statValue(page, "Games Played")).toBe("2");
    expect(await statValue(page, "Wins")).toBe("2");
    expect(await statValue(page, "Current Streak")).toBe("2");
    expect(await statValue(page, "Best Streak")).toBe("2");
    await page.close();
  });

  test("abandon en Émoji : Abandons 1, Parties 3, la série globale reste 2 (elle compte les jours)", async () => {
    const page = await ctx.newPage();
    await gotoSettled(page, "/emojiMode/emojiMode.html");
    // L'Émoji ne compte un essai que pour un nom CONNU : 8 vrais personnages,
    // en évitant la cible du jour (sinon on gagnerait au lieu d'abandonner).
    const target = await page.evaluate(
      () => JSON.parse(localStorage.getItem("targetEmoji") || "null")?.nom
    );
    const decoys = [
      "Yu Narukami",
      "Yosuke Hanamura",
      "Chie Satonaka",
      "Yukiko Amagi",
      "Kanji Tatsumi",
      "Rise Kujikawa",
      "Naoto Shirogane",
      "Teddie",
      "Ryuji Sakamoto",
      "Ann Takamaki",
    ].filter((n) => n !== target);
    for (const name of decoys.slice(0, 8)) {
      await page.locator("#textbar").fill(name);
      await page.locator("#guessButton").click();
    }
    await page.locator("#giveUpButton").click();
    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(
        async () => {
          const res = await call(u.ctx, "get", `/api/user/${u.userId}/stats`);
          return Number(
            (await res.json()).stats.by_mode.find((m) => m.mode === "emoji")?.giveups ?? 0
          );
        },
        { timeout: 15_000 }
      )
      .toBe(1);

    await gotoSettled(page, "/profile/profile.html");
    expect(await statValue(page, "Give-ups")).toBe("1");
    expect(await statValue(page, "Games Played")).toBe("3");
    expect(await statValue(page, "Current Streak")).toBe("2");
    await page.close();
  });

  test("autre appareil : le profil montre les mêmes chiffres (le cloud est la vérité)", async ({
    browser,
  }) => {
    const fresh = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await fresh.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await expect.poll(() => statValue(page, "Games Played"), { timeout: 10_000 }).toBe("3");
    expect(await statValue(page, "Current Streak")).toBe("2");
    await fresh.close();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partie 2 — mobile
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("Mobile (390 × 844, tactile) : défis, pages, badges", () => {
  let bob, carol;
  let challengeId;

  test.beforeAll(async () => {
    bob = await registerUser("mb");
    carol = await registerUser("mc");
    await befriend(carol, bob);
    const r = await call(carol.ctx, "post", "/api/messages/", {
      data: {
        receiver_id: bob.userId,
        type: "challenge",
        challenge_mode: "classic",
        challenge_score: 3,
        challenge_date: parisDay(),
        challenge_target: "Yu Narukami",
      },
      headers: await csrfHeader(carol.ctx),
    });
    expect(r.ok()).toBeTruthy();
    challengeId = (await r.json()).id;
  });
  test.afterAll(async () => {
    for (const x of [bob, carol]) await x?.ctx?.dispose();
  });

  test("accueil : la pop-up de défi tient dans l'écran, Accepter au doigt mène sur le mode avec le bandeau", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      ...MOBILE,
      storageState: await bob.ctx.storageState(),
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/index.html");
    await noHorizontalOverflow(page, "accueil");
    const card = page.locator("#cn-overlay .cn-card");
    await expect(card).toBeVisible({ timeout: 15_000 });
    // L'entrée est animée (échelle) : mesurer une fois posée.
    await page.waitForTimeout(1500);
    const box = await card.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);

    await page.locator("#cn-overlay .cn-btn--accept").tap();
    await page.waitForURL(/classiqueMode\.html/, { timeout: 15_000 });
    await expect(page.locator("#challengeBanner")).toBeVisible({ timeout: 10_000 });
    await noHorizontalOverflow(page, "mode Classique avec bandeau");
    await expect
      .poll(async () => {
        const res = await call(bob.ctx, "get", "/api/messages?type=challenge&limit=20");
        return ((await res.json()).messages ?? []).find((m) => m.id === challengeId)?.status;
      })
      .toBe("accepted");
    await ctx.close();
  });

  test("page Amis : onglets et Boîte au doigt, le défi en cours propose Reprendre / Abandonner", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      ...MOBILE,
      storageState: await bob.ctx.storageState(),
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/friends/friends.html");
    await noHorizontalOverflow(page, "page Amis");
    await page.locator('.fr-tab[data-tab="inbox"]').tap();
    await expect(page.locator(`.js-resume-challenge[data-mid="${challengeId}"]`)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(`.js-abandon-challenge[data-mid="${challengeId}"]`)).toBeVisible();
    await ctx.close();
  });

  test("profil : pas de débordement, la modale des badges tient dans l'écran et la bulle d'info reste visible", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      ...MOBILE,
      storageState: await bob.ctx.storageState(),
    });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await noHorizontalOverflow(page, "profil");

    // dispatchEvent et non tap : le bouton peut arriver sous la barre de
    // navigation fixe du bas, qui intercepte le point de contact (même piège que
    // ⚔ Défier en CI, cf. challenge_flow.spec.js).
    await page.locator("#openBadgesModal").dispatchEvent("click");
    const modal = page.locator("#badgesModal");
    await expect(modal).toBeVisible();
    const mb = await modal.boundingBox();
    expect(mb.x, "bord gauche de la modale dans l'écran").toBeGreaterThanOrEqual(0);
    expect(mb.x + mb.width, "bord droit de la modale dans l'écran").toBeLessThanOrEqual(391);

    // Premier badge de la première catégorie, AMENÉ contre le haut de la modale
    // (défilement interne) : pas la place au-dessus → la bulle bascule sous lui
    // et reste entière dans la fenêtre.
    const item = page.locator("#badgesModal .badge-item").first();
    await page.evaluate(() => {
      const m = document.getElementById("badgesModal");
      const it = m.querySelector(".badge-item");
      m.scrollTop += it.getBoundingClientRect().top - m.getBoundingClientRect().top - 40;
    });
    // Les écouteurs de survol se posent 100 ms après le rendu (adjustTooltipPositions).
    await page.waitForTimeout(400);
    await item.hover();
    await page.waitForTimeout(400);
    const tip = item.locator(".badge-tooltip");
    await expect(tip).toHaveClass(/badge-tooltip--below/);
    const tb = await tip.boundingBox();
    expect(tb.y).toBeGreaterThanOrEqual(mb.y);
    expect(tb.x).toBeGreaterThanOrEqual(0);
    expect(tb.x + tb.width).toBeLessThanOrEqual(391);
    await ctx.close();
  });
});
