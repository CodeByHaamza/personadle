import { test, expect, request as pwRequest } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { csrfHeader } from "./helpers/csrf.js";
import { gotoSettled } from "./helpers/page.js";

/**
 * tests-e2e/daily_target.spec.js — la cible DU JOUR est bien celle du jour, dans
 * les six modes, pour un joueur qui REVIENT.
 *
 * Le bug (2.2, trouvé en cherchant « il affiche Akechi mais la réponse est
 * quelqu'un d'autre ») : le reset quotidien de chaque mode cliquait sur
 * « Rejouer », qui tire AU HASARD. La cible seedée (joueur + jour + mode) ne
 * servait donc qu'à la toute première partie d'un appareil ; dès le lendemain,
 * chaque joueur jouait un personnage aléatoire — différent sur deux appareils,
 * et signalé par l'anti-triche serveur (« Daily target mismatch ») à CHAQUE
 * partie, puisque le serveur recalcule la cible seedée.
 *
 * Pour chaque mode : un compte, deux navigateurs neufs où l'identifiant du
 * compte est déjà connu (comme sur un appareil déjà utilisé) et où traîne
 * l'état d'HIER (date + cible). La page doit :
 *   1. tirer la même cible dans les deux navigateurs ;
 *   2. tirer EXACTEMENT ce que le serveur attend — recalculé ici avec le même
 *      helper (getDailyTarget, importé dans la page) sur le même pool
 *      (api/data/daily_pools.json, la référence de l'anti-triche) ;
 *   3. en Classique, la partie jouée n'est PAS signalée par l'anti-triche.
 *
 * Silhouette en plus : l'image d'hier, retardée exprès de 1,5 s, ne doit pas
 * recouvrir la silhouette du jour (le cas « Akechi » exact).
 *
 * Pré-requis : stack Docker (make up).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";
const HERE = dirname(fileURLToPath(import.meta.url));
const POOLS = JSON.parse(readFileSync(join(HERE, "..", "api", "data", "daily_pools.json"), "utf8"));

const parisDay = (offset = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + offset * 86_400_000)
  );

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
  const pseudo = `dt${suffix}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  return { ctx, userId: (await res.json()).user.id, pseudo };
}

/**
 * Les six modes : page, clés localStorage, pool de l'anti-triche, clé de hash,
 * champ qui porte le nom dans la cible stockée, et une cible « d'hier ».
 */
const MODES = [
  {
    mode: "classic",
    url: "/classiqueMode/classiqueMode.html",
    lastKey: "lastPlayedDate_Classic",
    targetKey: "target",
    pool: "classic",
    hash: "Classic",
    name: (t) => t?.nom,
    stale: { nom: "Goro Akechi", opus: ["P5"] },
  },
  {
    mode: "emoji",
    url: "/emojiMode/emojiMode.html",
    lastKey: "lastPlayedDate_Emoji",
    targetKey: "targetEmoji",
    pool: "emoji",
    hash: "Emoji",
    name: (t) => t?.nom,
    stale: { nom: "Goro Akechi", emoji: ["🕵️"], opus: ["P5"] },
  },
  {
    mode: "silhouette",
    url: "/silhouetteMode/silhouette.html",
    lastKey: "lastPlayedDate_Silhouette",
    targetKey: "silhouetteTarget",
    pool: "silhouette",
    hash: "Silhouette",
    name: (t) => t?.nom,
    stale: { nom: "Goro Akechi", image: "Goro_silhouette", opus: ["P5"] },
  },
  {
    mode: "alloutattack",
    url: "/allOutAttackMode/allOutAttack.html",
    lastKey: "lastPlayedDate_AllOut",
    targetKey: "aoaTarget",
    pool: "alloutattack",
    hash: "AllOutAttack",
    // AOA persiste le nom brut, pas un objet JSON.
    raw: true,
    name: (t) => t,
    stale: "Akechi",
  },
  {
    mode: "personae",
    url: "/personaeMode/personae.html",
    lastKey: "lastPlayedDate_Personae",
    targetKey: "personaeTarget",
    pool: "personae",
    hash: "Personae",
    name: (t) => t?.persona,
    stale: { persona: "Robin Hood", image: "Robin_Hood", user: ["Goro Akechi"], opus: ["P5"] },
  },
  {
    mode: "music",
    url: "/musicsMode/musics.html",
    lastKey: "lastPlayedDate_Music",
    targetKey: "musicTarget",
    pool: "music",
    hash: "Music",
    name: (t) => t?.titre,
    stale: { titre: "Last Surprise", fichier: "Last_Surprise.mp3", opus: ["P5"] },
  },
];

/** Contexte « joueur qui revient » : identifiant connu, état d'hier en place. */
async function returningContext(browser, user, m) {
  const ctx = await browser.newContext({
    serviceWorkers: "block",
    storageState: await user.ctx.storageState(),
  });
  await ctx.addInitScript(
    ([uid, lastKey, targetKey, yesterday, stale]) => {
      if (localStorage.getItem("__seeded")) return;
      localStorage.setItem("playerUserId", String(uid));
      localStorage.setItem(lastKey, yesterday);
      localStorage.setItem(targetKey, typeof stale === "string" ? stale : JSON.stringify(stale));
      localStorage.setItem("__seeded", "1");
    },
    [user.userId, m.lastKey, m.targetKey, parisDay(-1), m.stale]
  );
  return ctx;
}

/** Ce que le serveur attend : le même helper, sur le pool de l'anti-triche. */
async function expectedDaily(page, m, userId) {
  const poolNames = POOLS[m.pool].pool.map((e) => (typeof e === "string" ? e : e.persona));
  return page.evaluate(
    async ([names, hash, uid]) => {
      const core = await import("/js/gameCore.js");
      const pool = names.map((n) => ({ nom: n }));
      return core.getDailyTarget(pool, hash, core.parisDateKey(), String(uid))?.nom ?? null;
    },
    [poolNames, m.hash, userId]
  );
}

for (const m of MODES) {
  test.describe.serial(`Cible du jour — ${m.mode}`, () => {
    let user;
    test.beforeAll(async () => {
      user = await registerUser(m.mode.slice(0, 3));
    });
    test.afterAll(async () => user?.ctx?.dispose());

    test(`${m.mode} : le lendemain, deux navigateurs tirent la même cible, celle que le serveur attend`, async ({
      browser,
    }) => {
      const picks = [];
      let expected = null;
      for (let i = 0; i < 2; i++) {
        const ctx = await returningContext(browser, user, m);
        const page = await ctx.newPage();
        await gotoSettled(page, m.url);
        await page.waitForTimeout(800);
        const stored = await page.evaluate(
          ([k, raw]) =>
            raw ? localStorage.getItem(k) : JSON.parse(localStorage.getItem(k) || "null"),
          [m.targetKey, Boolean(m.raw)]
        );
        picks.push(m.name(stored));
        expected = expected ?? (await expectedDaily(page, m, user.userId));
        // La date du jour est posée : le reset ne rejouera pas à la prochaine visite.
        expect(await page.evaluate((k) => localStorage.getItem(k), m.lastKey)).toBe(parisDay());
        await ctx.close();
      }
      expect(picks[0], "la cible d'hier a été remplacée").not.toBe(m.name(m.stale));
      expect(picks[1], "deux appareils, la même cible").toBe(picks[0]);
      expect(picks[0], "la cible seedée, celle que l'anti-triche recalcule").toBe(expected);
    });
  });
}

test.describe
  .serial("Classique : la partie du lendemain n'est pas signalée par l'anti-triche", () => {
  let user;
  test.beforeAll(async () => {
    user = await registerUser("ac");
  });
  test.afterAll(async () => user?.ctx?.dispose());

  test("jouer et gagner la cible du jour → session enregistrée sans « Daily target mismatch »", async ({
    browser,
  }) => {
    const m = MODES[0];
    const ctx = await returningContext(browser, user, m);
    const page = await ctx.newPage();
    await gotoSettled(page, m.url);
    const target = await page.evaluate(
      () => JSON.parse(localStorage.getItem("target") || "null")?.nom
    );
    await page.locator("#textbar").fill(target);
    await page.locator("#guessButton").click();
    await expect(page.locator("#victoryBox")).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(
        async () => {
          const res = await call(user.ctx, "get", `/api/user/${user.userId}/stats`);
          const games = Number(
            (await res.json()).stats.by_mode.find((r) => r.mode === "classic")?.games ?? 0
          );
          if (games === 0) await page.reload();
          return games;
        },
        { timeout: 20_000, intervals: [1000, 2000, 3000] }
      )
      .toBe(1);

    // Le journal anti-triche est l'oracle : il n'a rien à dire sur ce joueur.
    // Lu via l'admin (seul accès au journal) — même compte seed que admin.spec.js.
    const admin = await pwRequest.newContext({ baseURL: BASE });
    const login = await call(admin, "post", "/api/auth/login", {
      data: { identifier: "admin@personadle.local", password: "admintest123" },
    });
    expect(login.ok()).toBeTruthy();
    const ac = await (await call(admin, "get", "/api/admin/anticheat?days=1")).json();
    const flagged = (ac.users ?? []).find((u) => u.user_id === user.userId);
    expect(flagged, `anti-triche : ${JSON.stringify(flagged ?? null)}`).toBeUndefined();
    await admin.dispose();
    await ctx.close();
  });
});

test.describe.serial("Silhouette : l'image d'hier ne recouvre pas la silhouette du jour", () => {
  let user;
  test.beforeAll(async () => {
    user = await registerUser("sil");
  });
  test.afterAll(async () => user?.ctx?.dispose());

  test("image d'hier retardée de 1,5 s : la silhouette affichée est celle de la cible du jour", async ({
    browser,
  }) => {
    const m = MODES.find((x) => x.mode === "silhouette");
    const ctx = await returningContext(browser, user, m);
    // Le cas réel : l'image de la cible d'hier (Akechi) finit de charger APRÈS le
    // tirage du jour. Sans jeton sur le chargement de restauration, c'est elle
    // qui s'affichait — et taper « Akechi » ne marchait pas.
    await ctx.route("**/database/img/Goro_silhouette.webp", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    const page = await ctx.newPage();
    await gotoSettled(page, m.url);
    await page.waitForTimeout(2500);
    const shown = await page.evaluate(
      () => document.getElementById("silhouetteImage")?.dataset.target
    );
    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem("silhouetteTarget") || "null")?.image
    );
    expect(stored).not.toBe("Goro_silhouette");
    expect(shown, "l'image affichée est celle de la cible du jour").toBe(stored);
    await ctx.close();
  });
});
