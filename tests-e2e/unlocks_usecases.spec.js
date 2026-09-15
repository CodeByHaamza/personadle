import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/unlocks_usecases.spec.js — tout ce qui se DÉBLOQUE, contre la vraie
 * pile : Mode Expert (et son couplage avec les défis, « ça bug beaucoup »),
 * badges, titres, fonds d'écran, codes événement — et ce que voit un joueur qui
 * arrive sur un autre appareil.
 *
 * Partie 1 — Expert ↔ défis (API + navigateur) :
 *   la porte se franchit exactement au seuil (9 victoires rapides : fermé,
 *   10 : ouvert) ; une session Expert est refusée avant ; un défi Expert vers
 *   un ami NON débloqué est refusé à l'envoi (409) ; un défi normal et un défi
 *   Expert coexistent le même jour entre les mêmes amis ; un défi Expert en
 *   cours ne bloque pas un défi normal (deux cases) ; accepter un défi Expert
 *   mène sur la page `?expert=1` avec le bandeau, et le jouer n'écrit aucune
 *   session ; le cadenas s'anime UNE fois quand le mode vient de s'ouvrir.
 *
 * Partie 2 — badges / titres / fonds d'écran / codes (API) :
 *   condition vérifiée côté serveur (403 avant, 200 après, idempotent), slug
 *   inconnu, code événement (valide, déjà utilisé, désactivé), et le catalogue
 *   qui reflète tout ça.
 *
 * Partie 3 — autre appareil (navigateur neuf, aucun localStorage) :
 *   un badge et un titre accordés en base apparaissent débloqués, le titre
 *   s'équipe et l'équipement persiste.
 *
 * Pré-requis : stack Docker (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";
const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

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
  const pseudo = `ul${suffix}_${rnd}`.slice(0, 20);
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

async function play(
  user,
  { mode = "classic", result = "win", attempts = 1, isExpert = false } = {}
) {
  return call(user.ctx, "post", "/api/sessions", {
    data: {
      mode,
      played_date: parisToday(),
      target_name: `E2E ${mode} ${Math.random().toString(36).slice(2, 8)}`,
      result,
      attempts,
      time_ms: 2000,
      client_session_id: crypto.randomUUID(),
      is_expert: isExpert,
    },
    headers: await csrfHeader(user.ctx),
  });
}

async function playOk(user, opts) {
  const r = await play(user, opts);
  expect(r.ok(), `session refusée : ${r.status()} ${await r.text()}`).toBeTruthy();
  return r.json();
}

async function expertStatus(user, mode) {
  const res = await call(user.ctx, "get", "/api/user/expert-status");
  expect(res.ok()).toBeTruthy();
  return (await res.json()).expert_status[mode];
}

async function sendChallenge(from, to, mode, { isExpert = false, target = null } = {}) {
  return call(from.ctx, "post", "/api/messages/", {
    data: {
      receiver_id: to.userId,
      type: "challenge",
      challenge_mode: mode,
      challenge_score: 3,
      challenge_date: parisToday(),
      challenge_target: target,
      challenge_is_expert: isExpert,
    },
    headers: await csrfHeader(from.ctx),
  });
}

async function statusOf(user, id) {
  const res = await call(user.ctx, "get", "/api/messages?type=challenge&limit=50");
  return ((await res.json()).messages ?? []).find((m) => m.id === id)?.status ?? null;
}

async function classicStats(user, isExpert = false) {
  const res = await call(user.ctx, "get", `/api/user/${user.userId}/stats`);
  const s = (await res.json()).stats;
  const rows = isExpert ? s.expert_by_mode : s.by_mode;
  const row = rows.find((m) => m.mode === "classic") ?? {};
  return { games: Number(row.games ?? 0), wins: Number(row.wins ?? 0) };
}

// ═════════════════════════════════════════════════════════════════════════════
// Partie 1 — Expert ↔ défis
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("Expert : la porte, et son couplage avec les défis", () => {
  let pro, novice; // pro débloquera Classique Expert ; novice jamais
  let proBrowser;

  test.beforeAll(async ({ browser }) => {
    pro = await registerUser("pro");
    novice = await registerUser("nov");
    await befriend(pro, novice);
    proBrowser = await browser.newContext({ storageState: await pro.ctx.storageState() });
  });

  test.afterAll(async () => {
    await proBrowser?.close();
    for (const u of [pro, novice]) await u?.ctx?.dispose();
  });

  test("9 victoires rapides : Classique Expert fermé, une session Expert est refusée (403), `?expert=1` renvoie au mode normal", async () => {
    for (let i = 0; i < 9; i++) await playOk(pro, { attempts: 1 });
    const st = await expertStatus(pro, "classic");
    expect(st.unlocked).toBe(false);
    expect(Number(st.current)).toBe(9);
    expect(Number(st.required)).toBe(10);

    expect((await play(pro, { isExpert: true })).status()).toBe(403);

    const page = await proBrowser.newPage();
    await gotoSettled(page, "/classiqueMode/classiqueMode.html?expert=1");
    expect(page.url()).not.toContain("expert=1");
    // L'état « fermé » est mémorisé sur cet appareil : c'est ce que l'animation
    // de déblocage comparera à la prochaine visite.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("expertUnlockStatus") || "null")?.modes?.classic
              ?.unlocked
        )
      )
      .toBe(false);
    await page.close();
  });

  test("un défi Expert vers un ami qui n'a pas débloqué le mode est refusé à l'ENVOI (409)", async () => {
    // pro n'est pas débloqué non plus, mais c'est le DESTINATAIRE que le serveur vérifie.
    const r = await sendChallenge(novice, pro, "classic", { isExpert: true });
    expect(r.status()).toBe(409);
  });

  test("la 10e victoire rapide ouvre le mode : statut, session Expert acceptée, stats Expert à part", async () => {
    await playOk(pro, { attempts: 1 });
    const st = await expertStatus(pro, "classic");
    expect(st.unlocked).toBe(true);

    const normalBefore = await classicStats(pro);
    const r = await play(pro, { isExpert: true, attempts: 2 });
    expect(r.ok(), `session Expert refusée : ${r.status()} ${await r.text()}`).toBeTruthy();
    const body = await r.json();
    expect(body.is_expert).toBe(true);

    expect(await classicStats(pro)).toEqual(normalBefore); // user_stats intact
    expect((await classicStats(pro, true)).wins).toBe(1); // expert_by_mode : 1
  });

  test("le cadenas s'anime UNE fois à la première visite après le déblocage, pas la suivante", async () => {
    const page = await proBrowser.newPage();
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await expect(page.locator("#expertUnlockOverlay"), "l'animation de déblocage joue").toBeVisible(
      { timeout: 10_000 }
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await expect(page.locator("#expertUnlockOverlay"), "pas de seconde fois").toHaveCount(0);
    // Et la page Expert est maintenant accessible.
    await gotoSettled(page, "/classiqueMode/classiqueMode.html?expert=1");
    expect(page.url()).toContain("expert=1");
    await page.close();
  });

  test("normal + Expert le même jour entre les mêmes amis : les deux défis passent ; un 2e Expert est refusé (409)", async () => {
    const normal = await sendChallenge(novice, pro, "classic", { target: "Yu Narukami" });
    expect(normal.status()).toBe(201);
    const expert = await sendChallenge(novice, pro, "classic", {
      isExpert: true,
      target: "Yu Narukami",
    });
    expect(expert.status(), "pro a débloqué Classique Expert : le défi Expert passe").toBe(201);
    const again = await sendChallenge(novice, pro, "classic", { isExpert: true });
    expect(again.status(), "un seul défi vivant par jour et par dimension").toBe(409);

    // Nettoyage pour la suite : pro refuse le normal, garde l'Expert.
    const normalId = (await normal.json()).id;
    await call(pro.ctx, "patch", `/api/messages/${normalId}`, {
      data: { status: "read" },
      headers: await csrfHeader(pro.ctx),
    });
    expect(await statusOf(pro, normalId)).toBe("read");
  });

  test("accepter le défi Expert depuis la Boîte mène sur la page Expert avec le bandeau ; le jouer n'écrit AUCUNE session, normale ou Expert", async () => {
    const page = await proBrowser.newPage();
    await gotoSettled(page, "/profile/friends/friends.html");
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    const accept = page.locator(".js-accept-challenge[data-isexpert='1']");
    await expect(accept).toBeVisible({ timeout: 10_000 });
    const expertId = Number(await accept.getAttribute("data-mid"));
    await accept.click();

    await page.waitForURL(/classiqueMode\.html\?expert=1/, { timeout: 15_000 });
    await expect(page.locator("#challengeBanner")).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => statusOf(pro, expertId)).toBe("accepted");
    const slots = await page.evaluate(() => ({
      expert: JSON.parse(localStorage.getItem("activeChallengeExpert") || "null")?.msgId ?? null,
      normal: JSON.parse(localStorage.getItem("activeChallenge") || "null")?.msgId ?? null,
    }));
    expect(slots.expert).toBe(expertId);
    expect(slots.normal, "la case normale reste libre").toBeNull();

    // Un défi normal reste acceptable pendant qu'un Expert est en cours (deux cases).
    const normal = await sendChallenge(novice, pro, "emoji", { target: "Chie Satonaka" });
    expect(normal.status()).toBe(201);
    const normalId = (await normal.json()).id;
    await gotoSettled(page, "/profile/friends/friends.html");
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    await page.locator(`.js-accept-challenge[data-mid="${normalId}"]`).click();
    await page.waitForURL(/emojiMode\.html/, { timeout: 15_000 });
    await expect.poll(() => statusOf(pro, normalId)).toBe("accepted");

    // Retour sur le défi Expert : le jouer et le gagner.
    await gotoSettled(page, "/classiqueMode/classiqueMode.html?expert=1");
    await expect(page.locator("#challengeBanner")).toBeVisible({ timeout: 10_000 });
    const before = { n: await classicStats(pro), e: await classicStats(pro, true) };
    await page.locator("#textbar").fill("Yu Narukami");
    await page.locator("#guessButton").click();
    await expect.poll(() => statusOf(pro, expertId), { timeout: 15_000 }).toBe("beaten");
    await page.waitForTimeout(1200);
    expect(await classicStats(pro)).toEqual(before.n);
    expect(await classicStats(pro, true)).toEqual(before.e);
    await page.close();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partie 2 — badges, titres, fonds d'écran, codes événement (API)
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("Déblocages vérifiés par le serveur", () => {
  let u;
  let admin;
  const code = `E2E${Date.now().toString(36).toUpperCase().slice(-6)}`;

  test.beforeAll(async () => {
    u = await registerUser("unl");
    admin = await adminContext();
  });
  test.afterAll(async () => {
    await u?.ctx?.dispose();
    await admin?.dispose();
  });

  const unlockBadge = async (slug) =>
    call(u.ctx, "post", "/api/badges/unlock", {
      data: { badge_id: slug },
      headers: await csrfHeader(u.ctx),
    });
  const unlockWallpaper = async (id) =>
    call(u.ctx, "post", "/api/wallpapers/unlock", {
      data: { wallpaper_id: id },
      headers: await csrfHeader(u.ctx),
    });

  test("badge first_win (1 victoire) : 403 avant, 200 après, idempotent, visible au catalogue", async () => {
    expect((await unlockBadge("first_win")).status()).toBe(403);
    await playOk(u, { attempts: 3 });
    expect((await unlockBadge("first_win")).ok()).toBeTruthy();
    expect((await unlockBadge("first_win")).ok(), "redemander = ok, pas de doublon").toBeTruthy();

    const cat = await (await call(u.ctx, "get", "/api/badges")).json();
    expect(Number(cat.find((b) => b.slug === "first_win")?.is_unlocked)).toBe(1);
    expect(cat.filter((b) => b.slug === "first_win")).toHaveLength(1);
  });

  test("badge ace_defective (10 abandons) : compte les abandons, pas les parties", async () => {
    for (let i = 0; i < 9; i++) await playOk(u, { result: "giveup", attempts: 6 });
    expect((await unlockBadge("ace_defective")).status()).toBe(403);
    await playOk(u, { result: "giveup", attempts: 6 });
    expect((await unlockBadge("ace_defective")).ok()).toBeTruthy();
  });

  test("badge inconnu → 404 ; badge « manuel » (one_shot) → toujours accordé sur déclaration", async () => {
    expect((await unlockBadge("nope_badge")).status()).toBe(404);
    expect((await unlockBadge("one_shot")).ok()).toBeTruthy();
  });

  test("fond d'écran rise_dungeons (30 parties Musique) : 403 à 29, 200 à 30, inconnu → 404", async () => {
    for (let i = 0; i < 29; i++)
      await playOk(u, { mode: "music", result: i % 2 ? "win" : "giveup", attempts: 2 });
    expect((await unlockWallpaper("rise_dungeons")).status()).toBe(403);
    await playOk(u, { mode: "music", attempts: 2 });
    expect((await unlockWallpaper("rise_dungeons")).ok()).toBeTruthy();
    expect((await unlockWallpaper("nope_wallpaper")).status()).toBe(404);

    const cat = await (await call(u.ctx, "get", "/api/wallpapers")).json();
    expect(Number(cat.find((w) => w.id === "rise_dungeons")?.is_unlocked)).toBe(1);
  });

  test("titre marie_i_remembered (15 badges) : 403 avec 3 badges, 200 quand l'admin en accorde 12 de plus", async () => {
    const unlockTitle = async () =>
      call(u.ctx, "post", "/api/titles/unlock", {
        data: { title_slug: "marie_i_remembered" },
        headers: await csrfHeader(u.ctx),
      });
    expect((await unlockTitle()).status()).toBe(403);

    const cat = await (await call(u.ctx, "get", "/api/badges")).json();
    const locked = cat.filter((b) => Number(b.is_unlocked) === 0).slice(0, 12);
    for (const b of locked) {
      const r = await call(admin, "post", `/api/admin/users/${u.userId}/badges`, {
        data: { slug: b.slug },
        headers: await csrfHeader(admin),
      });
      expect(r.ok(), `grant ${b.slug}: ${r.status()}`).toBeTruthy();
    }
    expect((await unlockTitle()).ok()).toBeTruthy();
    const titles = await (await call(u.ctx, "get", "/api/titles")).json();
    expect(Number(titles.find((t) => t.slug === "marie_i_remembered")?.is_unlocked)).toBe(1);
  });

  test("code événement : créé par l'admin, utilisé une fois (201), refusé la deuxième (409), refusé désactivé (404)", async () => {
    const created = await call(admin, "post", "/api/admin/event_codes", {
      data: {
        code,
        badge_id: "p1_p2_fan",
        description: "E2E unlocks",
        is_permanent: true,
        is_active: true,
      },
      headers: await csrfHeader(admin),
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    const redeem = async () =>
      call(u.ctx, "post", "/api/badges/redeem", {
        data: { code },
        headers: await csrfHeader(u.ctx),
      });
    const first = await redeem();
    expect(first.ok(), await first.text()).toBeTruthy();
    const cat = await (await call(u.ctx, "get", "/api/badges")).json();
    expect(Number(cat.find((b) => b.slug === "p1_p2_fan")?.is_unlocked)).toBe(1);

    expect((await redeem()).status()).toBe(409);

    const off = await call(admin, "patch", `/api/admin/event_codes/${code}`, {
      data: { is_active: false },
      headers: await csrfHeader(admin),
    });
    expect(off.ok()).toBeTruthy();
    // Un AUTRE compte (l'admin n'a jamais utilisé ce code) : désactivé = introuvable.
    const r = await call(admin, "post", "/api/badges/redeem", {
      data: { code },
      headers: await csrfHeader(admin),
    });
    expect(r.status()).toBe(404);
    await call(admin, "delete", `/api/admin/event_codes/${code}`, {
      headers: await csrfHeader(admin),
    });
  });

  test("code inconnu → 404, code vide → 400", async () => {
    expect(
      (
        await call(u.ctx, "post", "/api/badges/redeem", {
          data: { code: "NOPE-NOPE" },
          headers: await csrfHeader(u.ctx),
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await call(u.ctx, "post", "/api/badges/redeem", {
          data: { code: "" },
          headers: await csrfHeader(u.ctx),
        })
      ).status()
    ).toBe(400);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partie 3 — autre appareil : ce qui est en base s'affiche, et s'équipe
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("Autre appareil : badges et titres accordés en base", () => {
  let u;
  let admin;

  test.beforeAll(async () => {
    u = await registerUser("dev2");
    admin = await adminContext();
    for (const slug of ["first_win", "ace_defective"]) {
      const r = await call(admin, "post", `/api/admin/users/${u.userId}/badges`, {
        data: { slug },
        headers: await csrfHeader(admin),
      });
      expect(r.ok()).toBeTruthy();
    }
    const titles = await (await call(u.ctx, "get", "/api/titles")).json();
    const junesId = titles.find((t) => t.slug === "junes")?.id;
    expect(junesId, "le titre junes existe au catalogue").toBeTruthy();
    const t = await call(admin, "post", `/api/admin/users/${u.userId}/titles`, {
      data: { title_id: junesId },
      headers: await csrfHeader(admin),
    });
    expect(t.ok(), await t.text()).toBeTruthy();
  });
  test.afterAll(async () => {
    await u?.ctx?.dispose();
    await admin?.dispose();
  });

  test("navigateur neuf : les deux badges et le titre sont débloqués sur le profil", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");

    await page.click("#openBadgesModal");
    for (const slug of ["first_win", "ace_defective"]) {
      await expect(page.locator(`#badgesModal .badge-item[data-id="${slug}"]`)).toHaveAttribute(
        "data-unlocked",
        "true",
        { timeout: 10_000 }
      );
    }

    const local = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("personaUserProfile") || "{}")
    );
    expect(local.badges ?? []).toEqual(expect.arrayContaining(["first_win", "ace_defective"]));
    expect(local.unlockedTitles ?? []).toContain("junes");
    await ctx.close();
  });

  test("équiper le titre depuis un navigateur neuf : persiste côté serveur et sur un autre navigateur", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page = await ctx.newPage();
    await gotoSettled(page, "/profile/profile.html");
    await page.click("#openTitlesModal");
    const card = page.locator('#titlesModalGrid .tm-card[data-slug="junes"]');
    await expect(card).toHaveAttribute("data-unlocked", "true", { timeout: 10_000 });
    await expect.poll(() => card.getAttribute("data-id")).not.toBe("");
    await card.click();
    await expect
      .poll(
        async () =>
          (await (await call(u.ctx, "get", `/api/user/${u.userId}`)).json()).profile
            ?.equipped_title_slug,
        { timeout: 10_000 }
      )
      .toBe("junes");
    await ctx.close();

    const ctx2 = await browser.newContext({ storageState: await u.ctx.storageState() });
    const page2 = await ctx2.newPage();
    await gotoSettled(page2, "/profile/profile.html");
    await expect
      .poll(() =>
        page2.evaluate(
          () => JSON.parse(localStorage.getItem("personaUserProfile") || "{}").equippedTitleSlug
        )
      )
      .toBe("junes");
    await ctx2.close();
  });
});
