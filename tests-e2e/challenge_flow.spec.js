import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * tests-e2e/challenge_flow.spec.js — le parcours d'un défi, dans un VRAI navigateur.
 *
 * challenge-supersede.spec.js verrouille les règles serveur par l'API. Ici, c'est
 * l'interface qui est conduite, de bout en bout, comme un joueur le ferait :
 *
 *   1. Alice arrive sur le mode Classique : « Défier un ami » est là AVANT toute
 *      partie (lot 2.2 — il n'apparaissait qu'après une victoire, et disparaissait
 *      au rechargement).
 *   2. La modale annonce le score « par » du mode, Alice envoie le défi à Bob :
 *      le message existe côté serveur avec ce score et une cible dédiée.
 *   3. Le bouton survit à un rechargement.
 *   4. Bob, depuis l'onglet Amis, clique ⚔ sur Alice → choisit un mode → arrive
 *      sur la page du mode avec la modale ouverte sur Alice.
 *   5. Bob accepte le défi depuis la Boîte, atterrit sur Classique avec la cible
 *      du défi, la devine : le défi passe en `beaten`.
 *
 * Puis les autres portes, avec un second jeu de comptes :
 *   6. la calling card (js/challenge-notif.js) sur une page quelconque, accepter
 *      emmène sur le mode — le chemin des six pannes silencieuses de la PR #111 ;
 *   7. « Abandonner » depuis le bandeau : case locale libérée, statut `read` ;
 *   8. Give Up en plein défi : statut `expired`, case libérée.
 *
 * Pré-requis : stack Docker démarrée (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

async function registerUser(rnd, suffix) {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `flw${suffix}_${rnd}`.slice(0, 20);
  const res = await ctx.post("/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code, pseudo };
}

/** Lie deux comptes (demande + acceptation). Slash final obligatoire, cf. CLAUDE.md §7. */
async function befriend(from, to) {
  const res = await from.ctx.post("/api/friends/", {
    data: { friend_code: to.friendCode },
    headers: await csrfHeader(from.ctx),
  });
  expect(res.ok(), "la demande d'ami doit réussir").toBeTruthy();
  const { friendship_id: id } = await res.json();
  const acc = await to.ctx.patch(`/api/friends/${id}`, {
    data: { action: "accept" },
    headers: await csrfHeader(to.ctx),
  });
  expect(acc.ok(), "l'acceptation doit réussir").toBeTruthy();
}

/** Défis vus par un compte, du plus récent au plus ancien. */
async function challengesOf(user) {
  const res = await user.ctx.get("/api/messages?type=challenge&limit=50");
  expect(res.ok()).toBeTruthy();
  return (await res.json()).messages ?? [];
}

/** Page de navigateur connectée avec les cookies d'un contexte API. */
async function pageAs(browser, user) {
  const context = await browser.newContext({ storageState: await user.ctx.storageState() });
  return context.newPage();
}

test.describe.serial("UI — un défi de bout en bout", () => {
  let alice, bob;
  let challengeId;

  test.beforeAll(async () => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    alice = await registerUser(rnd, "a");
    bob = await registerUser(rnd, "b");
    await befriend(alice, bob);
  });

  test.afterAll(async () => {
    await alice?.ctx?.dispose();
    await bob?.ctx?.dispose();
  });

  test("1. « Défier un ami » est présent dès l'arrivée, avant toute partie", async ({ browser }) => {
    const page = await pageAs(browser, alice);
    await page.goto("/classiqueMode/classiqueMode.html");

    const btn = page.locator("#challengeFriendBtn");
    await expect(btn, "le bouton attend la résolution de l'auth, puis apparaît").toBeVisible({
      timeout: 10_000,
    });
    // Tant que la partie n'est pas finie, il vit sous le logo, avec la pilule Expert.
    await expect(page.locator(".expert-toggle-zone #challengeFriendBtn")).toHaveCount(1);
    await page.context().close();
  });

  test("2. la modale annonce le score par et envoie le défi à Bob", async ({ browser }) => {
    const page = await pageAs(browser, alice);
    await page.goto("/classiqueMode/classiqueMode.html");
    await page.locator("#challengeFriendBtn").click();

    const modal = page.locator("#challengeModal");
    await expect(modal).toBeVisible();
    // Score « par » du Classique = 5 (CHALLENGE_PAR, js/gameCore.js).
    await expect(modal.locator(".challenge-card__score")).toContainText("5");

    const send = modal.locator(`.js-send-challenge[data-fid="${bob.userId}"]`);
    await expect(send, "Bob doit être dans la liste d'amis de la modale").toBeVisible();
    await send.click();
    await expect(send).toContainText("✓");

    const msgs = await challengesOf(bob);
    const mine = msgs.find((m) => m.sender_id === alice.userId && m.status === "unread");
    expect(mine, "Bob doit avoir reçu un défi non lu d'Alice").toBeTruthy();
    expect(mine.challenge_mode).toBe("classic");
    expect(mine.challenge_score, "score par du Classique").toBe(5);
    expect(mine.challenge_target, "cible dédiée tirée dans le pool").toBeTruthy();
    challengeId = mine.id;
    await page.context().close();
  });

  test("3. le bouton survit à un rechargement de la page", async ({ browser }) => {
    const page = await pageAs(browser, alice);
    await page.goto("/classiqueMode/classiqueMode.html");
    await expect(page.locator("#challengeFriendBtn")).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.locator("#challengeFriendBtn")).toBeVisible({ timeout: 10_000 });
    await page.context().close();
  });

  test("4. ⚔ depuis l'onglet Amis ouvre la modale du mode choisi sur cet ami", async ({ browser }) => {
    const page = await pageAs(browser, bob);
    await page.goto("/profile/friends/friends.html");

    await page.locator('.fr-tab[data-tab="friends"]').click();
    const challengeBtn = page.locator(`.js-challenge[data-friend-id="${alice.userId}"]`);
    await expect(challengeBtn, "Alice doit apparaître dans la liste d'amis").toBeVisible({
      timeout: 10_000,
    });
    await challengeBtn.click();

    const picker = page.locator("#frModePicker");
    await expect(picker).toBeVisible();
    await expect(picker.locator(".fr-mode-picker__btn")).toHaveCount(6);
    await picker.locator(".fr-mode-picker__btn", { hasText: "Emoji" }).click();

    await page.waitForURL(/emojiMode\/emojiMode\.html/);
    // Le paramètre est consommé : un F5 ne rouvrirait pas la modale.
    await expect.poll(() => page.url()).not.toContain("challenge=");
    const row = page.locator(".challenge-friend-row--preselected");
    await expect(row, "la ligne d'Alice est mise en avant").toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(alice.pseudo);
    await page.context().close();
  });

  test("5. Bob accepte depuis la Boîte, joue la cible dédiée et bat le défi", async ({ browser }) => {
    const page = await pageAs(browser, bob);
    await page.goto("/profile/friends/friends.html");

    await page.locator('.fr-tab[data-tab="inbox"]').click();
    await expect(page.locator("#tabInboxBadge"), "un défi non lu = pastille sur la Boîte").toBeVisible();

    const accept = page.locator(`.js-accept-challenge[data-mid="${challengeId}"]`);
    await expect(accept).toBeVisible({ timeout: 10_000 });
    await accept.click();

    await page.waitForURL(/classiqueMode\/classiqueMode\.html/, { timeout: 15_000 });
    await expect(page.locator("#cbScore"), "le bandeau annonce le score à battre").toContainText("5");

    // La cible du défi a remplacé celle du jour (resolveChallengeTarget).
    const { challenge_target: cible } = (await challengesOf(bob)).find((m) => m.id === challengeId);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("target") || "null")?.nom))
      .toBe(cible);

    await page.locator("#textbar").fill(cible);
    await page.locator("#guessButton").click();

    // Un seul essai ≤ 5 : défi battu, statut serveur `beaten`.
    await expect.poll(async () => (await challengesOf(bob)).find((m) => m.id === challengeId)?.status, {
      timeout: 15_000,
    }).toBe("beaten");
    await page.context().close();
  });
});

/** Date du jour en heure de Paris, "YYYY-MM-DD" — même frontière que le jeu. */
function parisToday() {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Envoi d'un défi par l'API (cible du jour, ancien format — suffit pour ces parcours). */
async function sendChallengeApi(from, to, mode) {
  const res = await from.ctx.post("/api/messages/", {
    data: {
      receiver_id: to.userId,
      type: "challenge",
      challenge_mode: mode,
      challenge_score: 3,
      challenge_date: parisToday(),
    },
    headers: await csrfHeader(from.ctx),
  });
  expect(res.ok(), `l'envoi du défi ${mode} doit réussir`).toBeTruthy();
  return (await res.json()).id;
}

test.describe.serial("UI — les autres portes du défi : calling card, abandon, Give Up", () => {
  let bob, carol, dave;
  let carolChallenge, daveChallenge;
  // UN SEUL navigateur pour Bob sur les trois tests : le défi accepté vit dans
  // localStorage (`activeChallenge`), un contexte neuf par test l'oublierait.
  let bobBrowser;

  test.beforeAll(async ({ browser }) => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    bob = await registerUser(rnd, "b2");
    carol = await registerUser(rnd, "c2");
    dave = await registerUser(rnd, "d2");
    await befriend(carol, bob);
    await befriend(dave, bob);
    carolChallenge = await sendChallengeApi(carol, bob, "emoji");
    bobBrowser = await browser.newContext({ storageState: await bob.ctx.storageState() });
  });

  test.afterAll(async () => {
    await bobBrowser?.close();
    for (const u of [bob, carol, dave]) await u?.ctx?.dispose();
  });

  test("6. la calling card apparaît sur n'importe quelle page, accepter emmène sur le mode", async () => {
    // Deuxième porte d'acceptation (js/challenge-notif.js), celle des six pannes
    // silencieuses corrigées par la PR #111 — jamais couverte jusqu'ici.
    const page = await bobBrowser.newPage();
    await page.goto("/index.html");

    const card = page.locator(".cn-card");
    await expect(card, "notification plein écran d'un défi non lu").toBeVisible({ timeout: 15_000 });
    await expect(card.locator(".cn-pseudo")).toContainText(carol.pseudo);
    await card.locator(".cn-btn--accept").click();

    await page.waitForURL(/emojiMode\/emojiMode\.html/, { timeout: 15_000 });
    await expect(page.locator("#cbScore")).toContainText("3");
    await expect
      .poll(async () => (await challengesOf(bob)).find((m) => m.id === carolChallenge)?.status)
      .toBe("accepted");
    await page.close();
  });

  test("7. « Abandonner » depuis le bandeau libère le défi sans le compter comme perdu", async () => {
    const page = await bobBrowser.newPage();
    await page.goto("/emojiMode/emojiMode.html");
    await expect(page.locator("#cbAbandon")).toBeVisible({ timeout: 10_000 });

    page.once("dialog", (d) => d.accept());
    await page.locator("#cbAbandon").click();

    await expect(page.locator("#cbAbandon")).toBeHidden({ timeout: 10_000 });
    // La case locale est libérée (une seule case par dimension — sans ça, plus
    // aucun autre défi ne pouvait être accepté de la journée).
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("activeChallenge")))
      .toBeNull();
    // Côté serveur : retour à `read`, pas `expired` — l'abandon n'est pas une défaite.
    await expect
      .poll(async () => (await challengesOf(bob)).find((m) => m.id === carolChallenge)?.status)
      .toBe("read");
    await page.close();
  });

  test("8. Give Up en plein défi → le défi expire, côté client comme côté serveur", async () => {
    daveChallenge = await sendChallengeApi(dave, bob, "classic");

    const page = await bobBrowser.newPage();
    await page.goto("/profile/friends/friends.html");
    await page.locator('.fr-tab[data-tab="inbox"]').click();
    const accept = page.locator(`.js-accept-challenge[data-mid="${daveChallenge}"]`);
    await expect(accept).toBeVisible({ timeout: 10_000 });
    await accept.click();
    await page.waitForURL(/classiqueMode\/classiqueMode\.html/, { timeout: 15_000 });
    await expect(page.locator("#cbScore")).toContainText("3");

    // Huit essais (GIVE_UP_THRESHOLD du Classique) puis Give Up. Un nom inconnu
    // compte comme un essai, comme dans expert-classic.spec.js.
    for (let i = 0; i < 8; i++) {
      await page.locator("#textbar").fill(`Zzz Not A Character ${i}`);
      await page.locator("#guessButton").click();
    }
    const giveUp = page.locator("#giveUpButton");
    await expect(giveUp).toHaveAttribute("aria-disabled", "false");
    await giveUp.click();

    await expect
      .poll(async () => (await challengesOf(bob)).find((m) => m.id === daveChallenge)?.status, {
        timeout: 15_000,
      })
      .toBe("expired");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("activeChallenge")))
      .toBeNull();
    await page.close();
  });
});
