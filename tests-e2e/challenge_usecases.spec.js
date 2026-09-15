import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * tests-e2e/challenge_usecases.spec.js — TOUS les cas d'usage d'un défi, contre
 * la vraie pile (PHP + MariaDB + navigateur).
 *
 * challenge_flow.spec.js déroule LE parcours heureux (envoi → acceptation →
 * partie → beaten) et trois portes de sortie. Ce fichier prend le problème par
 * l'autre bout : tout ce qui a cassé, ou pourrait casser, autour de ce parcours.
 *
 * Partie 1 — l'API, machine à états d'un défi (api/messages/index.php) :
 *   qui a le droit de changer quoi, depuis quel statut, et ce qu'un défi laissé
 *   dans chaque état autorise le lendemain ou le même jour.
 *
 * Partie 2 — le navigateur, les surfaces d'acceptation :
 *   deux défis reçus en même temps → pop-up à l'accueil, « Plus tard » sur le
 *   premier montre le second, « Refuser » le second ; rechargement : le premier
 *   n'est plus proposé (fermé explicitement) mais reste dans la Boîte ; pop-up
 *   sur la page PROFIL pour un nouveau défi, accepter depuis là ; un second
 *   défi de la même dimension est refusé tant que le premier est en cours ;
 *   l'abandon depuis la Boîte libère ; et surtout : une partie de défi n'entre
 *   PAS dans les stats, la partie du jour qui suit, si.
 *
 * Pré-requis : stack Docker (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

/**
 * moderation.spec.js ferme le site (503 « maintenance ») quelques centaines de
 * ms au milieu de la suite, tout tourne en parallèle : un 503 n'est jamais la
 * réponse testée ici — on attend et on rejoue. Toutes les requêtes API de ce
 * fichier passent par là.
 */
async function call(ctx, method, url, options) {
  let res;
  for (let attempt = 0; attempt < 30; attempt++) {
    res = await ctx[method](url, options);
    if (res.status() !== 503) return res;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return res;
}

/** Date du jour en heure de Paris, "YYYY-MM-DD". */
function parisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

async function registerUser(rnd, suffix) {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `uc${suffix}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code, pseudo };
}

/** Lie deux comptes. Slash final obligatoire, cf. CLAUDE.md §7. */
async function befriend(from, to) {
  const res = await call(from.ctx, "post", "/api/friends/", {
    data: { friend_code: to.friendCode },
    headers: await csrfHeader(from.ctx),
  });
  expect(res.ok(), "la demande d'ami doit réussir").toBeTruthy();
  const { friendship_id: id } = await res.json();
  const acc = await call(to.ctx, "patch", `/api/friends/${id}`, {
    data: { action: "accept" },
    headers: await csrfHeader(to.ctx),
  });
  expect(acc.ok(), "l'acceptation doit réussir").toBeTruthy();
}

/** Envoie un défi par l'API ; renvoie la réponse brute (le statut compte). */
async function sendChallenge(from, to, mode, extra = {}) {
  return call(from.ctx, "post", "/api/messages/", {
    data: {
      receiver_id: to.userId,
      type: "challenge",
      challenge_mode: mode,
      challenge_score: 3,
      challenge_date: parisToday(),
      challenge_target: extra.target ?? null,
      ...extra.body,
    },
    headers: await csrfHeader(from.ctx),
  });
}

async function sendChallengeOk(from, to, mode, extra = {}) {
  const res = await sendChallenge(from, to, mode, extra);
  expect(res.ok(), `l'envoi du défi ${mode} doit réussir (${res.status()})`).toBeTruthy();
  return (await res.json()).id;
}

async function patchStatus(user, id, status) {
  return call(user.ctx, "patch", `/api/messages/${id}`, {
    data: { status },
    headers: await csrfHeader(user.ctx),
  });
}

async function statusOf(user, id) {
  const res = await call(user.ctx, "get", "/api/messages?type=challenge&limit=50");
  expect(res.ok()).toBeTruthy();
  return ((await res.json()).messages ?? []).find((m) => m.id === id)?.status ?? null;
}

async function classicStats(user) {
  const res = await call(user.ctx, "get", `/api/user/${user.userId}/stats`);
  expect(res.ok()).toBeTruthy();
  const row = (await res.json()).stats.by_mode.find((m) => m.mode === "classic");
  return { games: Number(row?.games ?? 0), wins: Number(row?.wins ?? 0) };
}

/** Page de navigateur connectée avec les cookies d'un contexte API. */
async function pageIn(context, path) {
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

// ═════════════════════════════════════════════════════════════════════════════
// Partie 1 — l'API : machine à états
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("API — machine à états d'un défi", () => {
  let alice, bob;

  test.beforeAll(async () => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    alice = await registerUser(rnd, "a");
    bob = await registerUser(rnd, "b");
    await befriend(alice, bob);
  });

  test.afterAll(async () => {
    for (const u of [alice, bob]) await u?.ctx?.dispose();
  });

  test("l'expéditeur ne peut changer AUCUN statut de son défi (403) — DELETE reste sa seule sortie", async () => {
    const id = await sendChallengeOk(alice, bob, "classic");
    for (const status of ["accepted", "beaten", "expired", "read"]) {
      const r = await patchStatus(alice, id, status);
      expect(r.status(), `alice → ${status}`).toBe(403);
    }
    expect(await statusOf(bob, id)).toBe("unread");
    // Nettoyage : Bob refuse, pour ne pas bloquer les cas suivants.
    expect((await patchStatus(bob, id, "read")).ok()).toBeTruthy();
  });

  test("unread → beaten ou expired directement : refusé (400), il faut accepter d'abord", async () => {
    const id = await sendChallengeOk(alice, bob, "classic");
    expect((await patchStatus(bob, id, "beaten")).status()).toBe(400);
    expect((await patchStatus(bob, id, "expired")).status()).toBe(400);
    expect(await statusOf(bob, id)).toBe("unread");
    expect((await patchStatus(bob, id, "read")).ok()).toBeTruthy();
  });

  test("refuser (unread → read) libère la place : un nouveau défi le même jour passe", async () => {
    const id = await sendChallengeOk(alice, bob, "classic");
    expect((await patchStatus(bob, id, "read")).ok()).toBeTruthy();
    expect(await statusOf(bob, id)).toBe("read");

    const again = await sendChallenge(alice, bob, "classic");
    expect(again.status(), "un défi refusé ne bloque pas le suivant").toBe(201);
    expect((await patchStatus(bob, (await again.json()).id, "read")).ok()).toBeTruthy();
  });

  test("accepter deux fois est idempotent, et un défi accepté bloque un nouveau défi le même jour (409)", async () => {
    const id = await sendChallengeOk(alice, bob, "classic");
    expect((await patchStatus(bob, id, "accepted")).ok()).toBeTruthy();

    const twice = await patchStatus(bob, id, "accepted");
    expect(twice.ok(), "double clic / second appareil : pas une erreur").toBeTruthy();
    expect((await twice.json()).status).toBe("accepted");

    const blocked = await sendChallenge(alice, bob, "classic");
    expect(blocked.status(), "un défi en cours n'est jamais remplacé").toBe(409);
    // Et dans l'autre sens aussi : la place entre ces deux amis est prise.
    const reverse = await sendChallenge(bob, alice, "classic");
    expect(reverse.status()).toBe(409);

    // Abandon : accepted → read, la place se libère.
    expect((await patchStatus(bob, id, "read")).ok()).toBeTruthy();
    expect(await statusOf(bob, id)).toBe("read");
    const freed = await sendChallenge(alice, bob, "classic");
    expect(freed.status()).toBe(201);
    expect((await patchStatus(bob, (await freed.json()).id, "read")).ok()).toBeTruthy();
  });

  test("beaten et expired sont finaux : ni retour en accepted, ni passage en read", async () => {
    const id = await sendChallengeOk(alice, bob, "classic");
    expect((await patchStatus(bob, id, "accepted")).ok()).toBeTruthy();
    expect((await patchStatus(bob, id, "beaten")).ok()).toBeTruthy();
    expect(await statusOf(bob, id)).toBe("beaten");

    expect((await patchStatus(bob, id, "accepted")).status()).toBe(400);
    expect((await patchStatus(bob, id, "read")).status()).toBe(400);
    expect((await patchStatus(bob, id, "expired")).status()).toBe(400);
    expect(await statusOf(bob, id)).toBe("beaten");

    // Un défi terminé ne bloque pas le suivant.
    const next = await sendChallenge(alice, bob, "classic");
    expect(next.status()).toBe(201);
    const id2 = (await next.json()).id;
    expect((await patchStatus(bob, id2, "accepted")).ok()).toBeTruthy();
    expect((await patchStatus(bob, id2, "expired")).ok()).toBeTruthy();
    expect((await patchStatus(bob, id2, "beaten")).status()).toBe(400);
    expect(await statusOf(bob, id2)).toBe("expired");
  });

  test("deux amis différents peuvent chacun avoir un défi vivant vers le même joueur", async () => {
    const rnd = Date.now().toString(36);
    const carol = await registerUser(rnd, "c");
    try {
      await befriend(carol, bob);
      const a = await sendChallengeOk(alice, bob, "silhouette");
      const c = await sendChallengeOk(carol, bob, "silhouette");
      expect(await statusOf(bob, a)).toBe("unread");
      expect(await statusOf(bob, c)).toBe("unread");
      // Accepter l'un n'empêche pas d'accepter l'autre côté serveur : la garde
      // « un seul défi en cours » est CLIENT (une seule case locale par dimension).
      expect((await patchStatus(bob, a, "accepted")).ok()).toBeTruthy();
      expect((await patchStatus(bob, c, "accepted")).ok()).toBeTruthy();
      expect((await patchStatus(bob, a, "read")).ok()).toBeTruthy();
      expect((await patchStatus(bob, c, "read")).ok()).toBeTruthy();
    } finally {
      await carol.ctx.dispose();
    }
  });

  test("un tiers (ni expéditeur ni destinataire) ne voit pas le défi (404)", async () => {
    const rnd = Date.now().toString(36);
    const eve = await registerUser(rnd, "e");
    try {
      const id = await sendChallengeOk(alice, bob, "music");
      expect((await patchStatus(eve, id, "read")).status()).toBe(404);
      expect((await patchStatus(bob, id, "read")).ok()).toBeTruthy();
    } finally {
      await eve.ctx.dispose();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Partie 2 — le navigateur : pop-ups, Boîte, stats
// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("UI — deux défis en même temps, Plus tard, Refuser, mémoire", () => {
  let bob, carol, dave;
  let carolId, daveId;
  let bobBrowser;

  test.beforeAll(async ({ browser }) => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    bob = await registerUser(rnd, "b3");
    carol = await registerUser(rnd, "c3");
    dave = await registerUser(rnd, "d3");
    await befriend(carol, bob);
    await befriend(dave, bob);
    carolId = await sendChallengeOk(carol, bob, "classic", { target: "Yu Narukami" });
    daveId = await sendChallengeOk(dave, bob, "emoji", { target: "Chie Satonaka" });
    bobBrowser = await browser.newContext({ storageState: await bob.ctx.storageState() });
  });

  test.afterAll(async () => {
    await bobBrowser?.close();
    for (const u of [bob, carol, dave]) await u?.ctx?.dispose();
  });

  test("accueil : les deux défis arrivent l'un après l'autre — Plus tard sur le premier, Refuser le second", async () => {
    const page = await pageIn(bobBrowser, "/index.html");
    const overlay = page.locator("#cn-overlay");
    await expect(overlay, "la pop-up de défi apparaît à l'accueil").toBeVisible({
      timeout: 15_000,
    });

    // Ordre du serveur : le plus récent d'abord (Dave), puis Carol.
    const firstPseudo = await page.locator("#cn-overlay .cn-pseudo").textContent();
    const first =
      firstPseudo === dave.pseudo ? { id: daveId, other: carolId } : { id: carolId, other: daveId };

    await page.locator("#cn-overlay .cn-btn--later").click();
    // Le second défi prend la place — il n'est pas jeté en attendant un sondage.
    await expect(page.locator("#cn-overlay .cn-pseudo")).not.toHaveText(firstPseudo, {
      timeout: 5_000,
    });
    const secondPseudo = await page.locator("#cn-overlay .cn-pseudo").textContent();
    expect([carol.pseudo, dave.pseudo]).toContain(secondPseudo);

    await page.locator("#cn-overlay .cn-btn--refuse").click();
    await expect(overlay).toBeHidden({ timeout: 5_000 });

    // Serveur : le premier reste à accepter, le second est refusé.
    await expect.poll(() => statusOf(bob, first.id)).toBe("unread");
    await expect.poll(() => statusOf(bob, first.other)).toBe("read");

    // Mémoire locale : les deux ont été fermés explicitement.
    const seen = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("seenChallengeNotifIds") || "[]")
    );
    expect(seen).toEqual(expect.arrayContaining([carolId, daveId]));
    await page.close();
  });

  test("rechargement et page profil : un défi fermé par Plus tard n'est plus proposé, mais reste dans la Boîte", async () => {
    const page = await pageIn(bobBrowser, "/index.html");
    await page.waitForTimeout(2500);
    await expect(page.locator("#cn-overlay"), "pas de nouvelle pop-up à l'accueil").toHaveCount(0);

    await page.goto("/profile/profile.html");
    await page.waitForTimeout(2500);
    await expect(page.locator("#cn-overlay"), "pas de pop-up sur le profil non plus").toHaveCount(
      0
    );

    await page.goto("/profile/friends/friends.html");
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    const pendingId = (await statusOf(bob, carolId)) === "unread" ? carolId : daveId;
    await expect(
      page.locator(`.js-accept-challenge[data-mid="${pendingId}"]`),
      "le défi mis de côté est toujours acceptable depuis la Boîte"
    ).toBeVisible({ timeout: 10_000 });
    await page.close();
  });
});

test.describe.serial("UI — accepter depuis le profil, exclusivité, abandon, et les stats", () => {
  let bob, carol, dave;
  let carolId, daveId;
  let bobBrowser;

  test.beforeAll(async ({ browser }) => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    bob = await registerUser(rnd, "b4");
    carol = await registerUser(rnd, "c4");
    dave = await registerUser(rnd, "d4");
    await befriend(carol, bob);
    await befriend(dave, bob);
    bobBrowser = await browser.newContext({ storageState: await bob.ctx.storageState() });
  });

  test.afterAll(async () => {
    await bobBrowser?.close();
    for (const u of [bob, carol, dave]) await u?.ctx?.dispose();
  });

  test("pop-up sur la page PROFIL : accepter mène sur le mode avec la cible du défi et le bandeau", async () => {
    carolId = await sendChallengeOk(carol, bob, "classic", { target: "Yu Narukami" });
    const page = await pageIn(bobBrowser, "/profile/profile.html");
    await expect(page.locator("#cn-overlay")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#cn-overlay .cn-pseudo")).toHaveText(carol.pseudo);

    await page.locator("#cn-overlay .cn-btn--accept").click();
    await page.waitForURL(/classiqueMode\/classiqueMode\.html/, { timeout: 15_000 });
    await expect(page.locator("#challengeBanner"), "le bandeau du défi est là").toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("target") || "null")?.nom))
      .toBe("Yu Narukami");
    await expect.poll(() => statusOf(bob, carolId)).toBe("accepted");
    await page.close();
  });

  test("un second défi de la même dimension est refusé tant que le premier est en cours — depuis la pop-up ET la Boîte", async () => {
    daveId = await sendChallengeOk(dave, bob, "emoji", { target: "Chie Satonaka" });

    // Pop-up à l'accueil : Accepter refuse et nomme le mode en cours.
    const page = await pageIn(bobBrowser, "/index.html");
    await expect(page.locator("#cn-overlay")).toBeVisible({ timeout: 15_000 });
    await page.locator("#cn-overlay .cn-btn--accept").click();
    await page.waitForTimeout(1500);
    expect(page.url(), "pas de redirection").toContain("/index.html");
    await expect.poll(() => statusOf(bob, daveId)).toBe("unread");
    const local = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("activeChallenge") || "null")
    );
    expect(local?.msgId, "la case locale est toujours celle du défi de Carol").toBe(carolId);
    await page.locator("#cn-overlay .cn-btn--later").click();

    // Boîte : même refus.
    await page.goto("/profile/friends/friends.html");
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    await page.locator(`.js-accept-challenge[data-mid="${daveId}"]`).click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/friends.html");
    await expect.poll(() => statusOf(bob, daveId)).toBe("unread");
    await page.close();
  });

  test("abandonner depuis la Boîte libère : le défi de Carol passe en read, celui de Dave devient acceptable", async () => {
    const page = await pageIn(bobBrowser, "/profile/friends/friends.html");
    page.on("dialog", (d) => d.accept());
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    await page.locator(`.js-abandon-challenge[data-mid="${carolId}"]`).click();
    await expect.poll(() => statusOf(bob, carolId)).toBe("read");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("activeChallenge")))
      .toBeNull();

    await page.locator(`.js-accept-challenge[data-mid="${daveId}"]`).click();
    await page.waitForURL(/emojiMode\/emojiMode\.html/, { timeout: 15_000 });
    await expect.poll(() => statusOf(bob, daveId)).toBe("accepted");
    await page.close();
  });

  test("STATS : une partie de défi n'entre pas dans les stats ; la partie du jour qui suit, si", async () => {
    // Le défi Émoji de Dave occupe encore la case normale : on l'abandonne
    // d'abord (un seul défi en cours par dimension), puis nouveau défi Classique
    // de Carol (elle a abandonné le sien → place libre), joué et gagné : aucune
    // session pour Bob. Puis la partie du jour, enregistrée.
    const page = await pageIn(bobBrowser, "/profile/friends/friends.html");
    page.on("dialog", (d) => d.accept());
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    await page.locator(`.js-abandon-challenge[data-mid="${daveId}"]`).click();
    await expect.poll(() => statusOf(bob, daveId)).toBe("read");

    const id = await sendChallengeOk(carol, bob, "classic", { target: "Yu Narukami" });
    await page.reload();
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    await page.locator(`.js-accept-challenge[data-mid="${id}"]`).click();
    await page.waitForURL(/classiqueMode\/classiqueMode\.html/, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("target") || "null")?.nom))
      .toBe("Yu Narukami");

    const before = await classicStats(bob);
    await page.locator("#textbar").fill("Yu Narukami");
    await page.locator("#guessButton").click();
    await expect.poll(() => statusOf(bob, id), { timeout: 15_000 }).toBe("beaten");
    await page.waitForTimeout(1500);

    const afterChallenge = await classicStats(bob);
    expect(afterChallenge, "la partie de défi ne compte ni en partie ni en victoire").toEqual(
      before
    );
    const localAfterChallenge = await page.evaluate(
      () => JSON.parse(localStorage.getItem("personaUserProfile") || "{}")?.stats?.games ?? 0
    );
    expect(localAfterChallenge, "les stats locales non plus").toBe(0);

    // La partie du jour : la cible du défi a été retirée, celle du jour revient.
    await page.goto("/classiqueMode/classiqueMode.html");
    await expect(page.locator("#challengeBanner")).toHaveCount(0);
    const daily = await page.evaluate(
      () => JSON.parse(localStorage.getItem("target") || "null")?.nom
    );
    expect(daily, "la cible du jour est de retour").toBeTruthy();
    expect(daily).not.toBe("Yu Narukami");
    await page.locator("#textbar").fill(daily);
    await page.locator("#guessButton").click();

    await expect
      .poll(async () => (await classicStats(bob)).games, { timeout: 15_000 })
      .toBe(before.games + 1);
    expect((await classicStats(bob)).wins).toBe(before.wins + 1);
    await page.close();
  });
});
