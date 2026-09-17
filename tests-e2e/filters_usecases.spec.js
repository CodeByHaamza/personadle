import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/filters_usecases.spec.js — tous les cas d'usage des filtres d'opus,
 * conduits dans le navigateur contre la vraie pile.
 *
 * Les filtres touchent bien plus que l'autocomplétion : ils sont stockés par
 * mode, voyagent dans les défis (le receveur joue avec ceux de l'expéditeur, et
 * doit retrouver les siens ensuite), décident du pool de tirage au Rejouer, et
 * accompagnent chaque session envoyée au serveur (`active_filters`). Chacun de
 * ces liens est vérifié ici.
 *
 * Couvre :
 *   - la fenêtre : ouverture, fermeture (croix, fond, Escape), compteur d'opus ;
 *   - un opus décoché disparaît de l'autocomplétion, recoché il revient ;
 *   - « tout désélectionner » : avertissement, aucune suggestion, retour arrière ;
 *   - la persistance au rechargement, et l'indépendance entre modes ;
 *   - la CIBLE DU JOUR reste tirée du pool complet, quels que soient les filtres
 *     (c'est la cible que le serveur recalcule — anti-triche) ;
 *   - un défi installe les filtres de l'expéditeur, et les rend au receveur
 *     quand il est terminé ;
 *   - une partie normale envoie ses filtres au serveur.
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
  const pseudo = `flt${suffix}_${rnd}`.slice(0, 20);
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers page
// ─────────────────────────────────────────────────────────────────────────────

const openFilters = async (page) => {
  await page.click("#filterToggleBtn");
  await expect(page.locator("#filterDropdown")).toHaveClass(/open/);
};

/**
 * Déroule les opus d'un jeu (clic sur son logo). Ils sont repliés au départ :
 * tout ce qui vit dans le volet — sous-boutons ET bouton « ✓ Tout / ✗ Aucun » —
 * est inatteignable avant ce clic.
 */
const expandGame = async (page, group) => {
  const panel = page.locator(`[data-group-panel="${group}"]`);
  if (!(await panel.evaluate((el) => el.classList.contains("expanded")))) {
    await page.locator(`[data-opus-group="${group}"]`).click();
    await expect(panel).toHaveClass(/expanded/);
  }
  return panel;
};

/** Coche ou décoche un jeu entier depuis le bouton de son volet. */
const toggleGame = async (page, group) => {
  const panel = await expandGame(page, group);
  await panel.locator(".filter-group-select-btn").click();
};

/** Opus actuellement retenus, lus dans le DOM (source d'affichage). */
const activeOpus = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-opus].active")].map((b) => b.dataset.opus).sort()
  );

/** Ce que le mode a réellement enregistré comme filtres. */
const storedFilters = (page, key = "filters_Classic") =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), key);

/** La cible du jour telle que la page l'a retenue (clé du mode Classique). */
const storedTarget = (page, key = "target") =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    try {
      return raw ? JSON.parse(raw)?.nom ?? null : null;
    } catch {
      return null;
    }
  }, key);

/** Suggestions proposées pour un début de nom. */
async function suggestionsFor(page, text) {
  await page.fill("#textbar", "");
  await page.type("#textbar", text, { delay: 15 });
  await page.waitForTimeout(350);
  return page.evaluate(() =>
    [...document.querySelectorAll("#autocomplete-list > div")]
      .map((el) => el.textContent.trim())
      .filter(Boolean)
  );
}

test.describe("Filtres d'opus — la fenêtre", () => {
  test("s'ouvre, affiche un compteur, et se ferme par la croix, le fond et Escape", async ({
    page,
  }) => {
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await openFilters(page);

    // Le compteur dit combien d'opus sont retenus sur le total
    await expect(page.locator(".filter-head-count")).toHaveText(/^\d+ \/ \d+$/);
    await expect(page.locator(".filter-backdrop")).toBeVisible();

    await page.click(".filter-head-close");
    await expect(page.locator("#filterDropdown")).not.toHaveClass(/open/);
    await expect(page.locator(".filter-backdrop")).toHaveCount(0);

    await openFilters(page);
    // Un point du fond loin de la fenêtre ET du bouton Filtres (coin bas-droit)
    await page.mouse.click(1240, 840);
    await expect(page.locator("#filterDropdown")).not.toHaveClass(/open/);

    await openFilters(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#filterDropdown")).not.toHaveClass(/open/);
    await expect(page.locator(".filter-backdrop")).toHaveCount(0);
  });

  test("tous les opus sont listés et cochés pour un joueur qui n'a rien touché", async ({
    page,
  }) => {
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await openFilters(page);
    const total = await page.locator("[data-opus]").count();
    expect(total).toBeGreaterThan(10);
    expect((await activeOpus(page)).length).toBe(total);
    // Rien n'est écrit tant que le joueur n'a pas choisi : « aucune clé » ≠ « [] »
    expect(await storedFilters(page)).toBeNull();
  });
});

test.describe("Filtres d'opus — effet sur la partie", () => {
  test("décocher un groupe réduit l'autocomplétion, le recocher la rétablit", async ({
    page,
  }) => {
    // On compte, on ne vise pas un nom : beaucoup de personnages traversent
    // plusieurs opus (Yukari est aussi dans P4AU et PQ2), décocher un seul jeu
    // ne les fait donc pas disparaître — ce qui ne veut pas dire que le filtre
    // ne marche pas.
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    const all = (await suggestionsFor(page, "a")).length;
    expect(all).toBeGreaterThan(5);

    await openFilters(page);
    await toggleGame(page, "P3");
    expect(await activeOpus(page)).not.toContain("P3");
    await page.click(".filter-head-close");

    const reduced = (await suggestionsFor(page, "a")).length;
    expect(reduced, "sans les opus P3, il reste moins de monde").toBeLessThan(all);

    await openFilters(page);
    await toggleGame(page, "P3");
    expect(await activeOpus(page)).toContain("P3");
    await page.click(".filter-head-close");

    expect((await suggestionsFor(page, "a")).length).toBe(all);
  });

  test("un personnage exclusif à un jeu disparaît quand ce jeu est décoché", async ({ page }) => {
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    // Naoya Todou est le seul personnage taggé P1 et RIEN d'autre (Maki, elle,
    // est aussi dans P2IS — décocher P1 ne la retire pas, et c'est normal).
    expect((await suggestionsFor(page, "Naoya")).join(" ")).toMatch(/Naoya Todou/i);

    await openFilters(page);
    await page.locator('[data-opus="P1"]').first().click();
    expect(await activeOpus(page)).not.toContain("P1");
    await page.click(".filter-head-close");

    expect((await suggestionsFor(page, "Naoya")).join(" ")).not.toMatch(/Naoya Todou/i);
  });

  test("tout désélectionner : avertissement, partie intacte, et retour arrière possible", async ({
    page,
  }) => {
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    const all = (await suggestionsFor(page, "a")).length;

    await openFilters(page);
    await page.click(".filter-select-all-btn"); // tout est actif → tout décocher
    expect(await activeOpus(page)).toEqual([]);
    expect(await storedFilters(page)).toEqual([]); // choix explicite, pas « absence »

    // La partie en cours n'est pas cassée : le mode garde son pool et prévient,
    // plutôt que de laisser un jeu sans aucune réponse possible.
    await expect(page.locator("#filterEmptyWarning, .filter-empty-warning")).toBeVisible();
    await page.click(".filter-head-close");
    expect((await suggestionsFor(page, "a")).length).toBe(all);

    // …et on peut revenir en arrière
    await openFilters(page);
    await page.click(".filter-select-all-btn");
    expect((await activeOpus(page)).length).toBeGreaterThan(10);
  });

  test("le choix survit au rechargement", async ({ page }) => {
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await openFilters(page);
    await toggleGame(page, "P4");
    const chosen = await activeOpus(page);
    const stored = await storedFilters(page);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await openFilters(page);
    expect(await activeOpus(page)).toEqual(chosen);
    expect(await storedFilters(page)).toEqual(stored);
  });

  test("chaque mode a ses propres filtres", async ({ page }) => {
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await openFilters(page);
    await toggleGame(page, "P3");
    const classic = await storedFilters(page, "filters_Classic");
    expect(classic).not.toBeNull();

    await gotoSettled(page, "/emojiMode/emojiMode.html");
    // Le mode Émoji n'a rien enregistré : ses filtres sont intacts
    expect(await storedFilters(page, "filters_Emoji")).toBeNull();
    // …et ceux du Classique n'ont pas bougé
    expect(await storedFilters(page, "filters_Classic")).toEqual(classic);
  });
});

test.describe("Filtres d'opus — la cible du jour", () => {
  test("la cible du jour est tirée du catalogue COMPLET, pas du pool filtré", async ({
    browser,
  }) => {
    // C'est ce que le serveur recalcule (api/lib/daily_target.php) : si les
    // filtres changeaient la cible seedée, chaque joueur qui filtre serait
    // signalé par l'anti-triche.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await gotoSettled(pageA, "/classiqueMode/classiqueMode.html");
    await pageA.waitForTimeout(400);
    const seed = await pageA.evaluate(() => localStorage.getItem("playerUserId") || localStorage.getItem("anonPlayerId"));
    const targetPlein = await storedTarget(pageA);
    expect(seed, "le seed du joueur doit être posé").toBeTruthy();
    expect(targetPlein).toBeTruthy();
    await ctxA.close();

    // Même joueur (même seed), mais des filtres restreints AVANT le premier rendu
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(BASE + "/classiqueMode/classiqueMode.html");
    await pageB.evaluate(
      ([s, f]) => {
        if (s) localStorage.setItem("anonPlayerId", s);
        localStorage.setItem("filters_Classic", JSON.stringify(f));
        localStorage.removeItem("target");
      },
      [seed, ["P5"]]
    );
    await gotoSettled(pageB, "/classiqueMode/classiqueMode.html");
    await pageB.waitForTimeout(600);
    expect(await storedTarget(pageB)).toBe(targetPlein);
    await ctxB.close();
  });

  test("changer un filtre retire une cible devenue injouable (elle sort du pool)", async ({
    page,
  }) => {
    // Décision 2.2 : un changement de filtre relance une partie — sinon on
    // pouvait rester coincé sur une cible que l'autocomplétion ne propose plus.
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    await page.waitForTimeout(400);

    await openFilters(page);
    await expandGame(page, "P5");
    await page.locator('[data-opus="P5"]').first().click();
    await page.click(".filter-head-close");
    await page.waitForTimeout(400);

    const target = await storedTarget(page);
    expect(target).toBeTruthy();
    // La cible en cours appartient bien au pool retenu : elle est proposée
    const suggestions = await suggestionsFor(page, target.slice(0, 3));
    expect(suggestions.map((s) => s.toLowerCase())).toContain(target.toLowerCase());
  });
});

test.describe("Filtres d'opus — défis", () => {
  let alice, bob;

  test.beforeAll(async () => {
    alice = await registerUser("a");
    bob = await registerUser("b");
    await befriend(alice, bob);
  });
  test.afterAll(async () => {
    await alice?.ctx?.dispose();
    await bob?.ctx?.dispose();
  });

  test("un défi installe les filtres de l'expéditeur, puis rend les siens au receveur", async ({
    browser,
  }) => {
    const res = await call(alice.ctx, "post", "/api/messages/", {
      data: {
        receiver_id: bob.userId,
        type: "challenge",
        challenge_mode: "classic",
        challenge_score: 3,
        challenge_date: parisToday(),
        challenge_filters: JSON.stringify(["P5"]),
      },
      headers: await csrfHeader(alice.ctx),
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const msgId = (await res.json()).id;

    const ctx = await browser.newContext({ storageState: await bob.ctx.storageState() });
    const page = await ctx.newPage();

    // Bob a SES propres filtres avant le défi
    await page.goto(BASE + "/classiqueMode/classiqueMode.html");
    await page.evaluate(() =>
      localStorage.setItem("filters_Classic", JSON.stringify(["P3", "P3FES"]))
    );
    await gotoSettled(page, "/classiqueMode/classiqueMode.html");
    expect(await storedFilters(page)).toEqual(["P3", "P3FES"]);

    // Il accepte le défi : les filtres de l'expéditeur prennent la main
    await page.evaluate(async (id) => {
      const mod = await import("/js/gameCore.js");
      mod.installActiveChallenge({
        msgId: id,
        mode: "classic",
        challengeFilters: JSON.stringify(["P5"]),
        challengeDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
          new Date()
        ),
      });
    }, msgId);
    expect(await storedFilters(page)).toEqual(["P5"]);

    // …et quand le défi est relâché, Bob retrouve exactement les siens
    await page.evaluate(async () => {
      const mod = await import("/js/gameCore.js");
      const active = JSON.parse(localStorage.getItem("activeChallenge") || "null");
      mod.releaseActiveChallenge(active);
    });
    expect(await storedFilters(page)).toEqual(["P3", "P3FES"]);
    await ctx.close();
  });

  test("un receveur qui n'avait jamais touché ses filtres n'en hérite pas d'un « [] »", async ({
    browser,
  }) => {
    // filterMenu.js lit "[]" comme « tout désélectionné » (choix volontaire) et
    // l'absence de clé comme « tout actif ». Un défi ne doit pas transformer le
    // second en premier.
    const ctx = await browser.newContext({ storageState: await bob.ctx.storageState() });
    const page = await ctx.newPage();
    await page.goto(BASE + "/classiqueMode/classiqueMode.html");
    await page.evaluate(() => localStorage.removeItem("filters_Classic"));

    await page.evaluate(async () => {
      const mod = await import("/js/gameCore.js");
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
        new Date()
      );
      mod.installActiveChallenge({
        msgId: 999001,
        mode: "classic",
        challengeFilters: JSON.stringify(["P4"]),
        challengeDate: today,
      });
      const active = JSON.parse(localStorage.getItem("activeChallenge") || "null");
      mod.releaseActiveChallenge(active);
    });

    expect(await storedFilters(page)).toBeNull();
    await ctx.close();
  });
});

test.describe("Filtres d'opus — ce que le serveur reçoit", () => {
  let user;
  test.beforeAll(async () => {
    user = await registerUser("srv");
  });
  test.afterAll(async () => {
    await user?.ctx?.dispose();
  });

  test("une partie enregistre les filtres actifs au moment où elle a été jouée", async () => {
    const res = await call(user.ctx, "post", "/api/sessions", {
      data: {
        mode: "classic",
        played_date: parisToday(),
        target_name: "Yu Narukami",
        result: "win",
        attempts: 3,
        time_ms: 12000,
        active_filters: ["P4", "P4G"],
        // Groupes hexadécimaux séparés par des tirets (api/sessions.php)
        client_session_id: `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`,
      },
      headers: await csrfHeader(user.ctx),
    });
    expect(res.ok(), await res.text()).toBeTruthy();

    // Les stats du mode confirment que la partie est bien entrée
    const stats = await call(user.ctx, "get", `/api/user/${user.userId}/stats`);
    expect(stats.ok()).toBeTruthy();
    const body = await stats.json();
    const classic = (body.by_mode ?? body.stats?.by_mode ?? []).find((s) => s.mode === "classic");
    expect(classic?.wins ?? 0, "la victoire doit être comptée").toBeGreaterThanOrEqual(1);
  });
});
