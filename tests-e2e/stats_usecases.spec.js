import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * tests-e2e/stats_usecases.spec.js — l'enregistrement des stats, contre la vraie
 * pile, dans les cas où il a déjà cassé ou pourrait casser.
 *
 * sessions-same-day.spec.js vérifie qu'une partie est comptée et qu'un rejeu est
 * refusé. Ici :
 *
 *   1. `user_stats` (ce que le client affiche, ce que les titres lisent) et
 *      `game_sessions` (ce que les badges lisent) restent d'accord après une
 *      suite mêlée de victoires, d'abandons et de rejeux.
 *   2. Le cas « badge Velvet Regular oui, titre I Am Not Afraid non » : les deux
 *      lisent des tables différentes. 50 victoires Classique le même jour → le
 *      titre s'ouvre (user_stats.wins), le badge non (1 seul jour distinct) ;
 *      et à 49, le serveur refuse le titre en 403 — c'est ce 403, obtenu quand
 *      le client demande le titre AVANT que la 50e session soit enregistrée, que
 *      la réconciliation de profile/titles-ui.js rattrape à la visite suivante.
 *   3. La streak : hier + aujourd'hui = 2 ; par mode et globale.
 *   4. Ce que le serveur refuse (date ancienne, essais absurdes, résultat inconnu)
 *      — et qui ne doit donc jamais rester coincé dans la file locale.
 *
 * Pré-requis : stack Docker (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";
const MODE = "classic";

/**
 * moderation.spec.js ferme le site (503 « maintenance ») quelques centaines de
 * ms au milieu de la suite, et tout tourne en parallèle : un 503 n'est jamais
 * la réponse qu'on teste ici — on attend et on rejoue, comme la file hors ligne
 * du client le ferait. Toutes les requêtes de ce fichier passent par là.
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

const parisDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + offsetDays * 86_400_000)
  );

async function registerUser(suffix) {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `st${suffix}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  return { ctx, userId: (await res.json()).user.id, pseudo };
}

async function play(
  user,
  { result = "win", attempts = 2, date = parisDay(), mode = MODE, extra = {} } = {}
) {
  return call(user.ctx, "post", "/api/sessions", {
    data: {
      mode,
      played_date: date,
      target_name: `E2E ${mode} ${Math.random().toString(36).slice(2, 8)}`,
      result,
      attempts,
      time_ms: 3000,
      client_session_id: crypto.randomUUID(),
      ...extra,
    },
    headers: await csrfHeader(user.ctx),
  });
}

async function playOk(user, opts) {
  const r = await play(user, opts);
  expect(r.ok(), `session refusée : ${r.status()} ${await r.text()}`).toBeTruthy();
  return r.json();
}

async function stats(user, mode = MODE) {
  const res = await call(user.ctx, "get", `/api/user/${user.userId}/stats`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()).stats;
  const row = body.by_mode.find((m) => m.mode === mode) ?? {};
  return {
    games: Number(row.games ?? 0),
    wins: Number(row.wins ?? 0),
    giveups: Number(row.giveups ?? 0),
    streak: Number(row.streak ?? 0),
    streak_record: Number(row.streak_record ?? 0),
    global: body.global ?? {},
  };
}

async function me(user) {
  const res = await call(user.ctx, "get", `/api/user/${user.userId}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function unlockTitle(user, slug) {
  return call(user.ctx, "post", "/api/titles/unlock", {
    data: { title_slug: slug },
    headers: await csrfHeader(user.ctx),
  });
}

async function unlockBadge(user, slug) {
  return call(user.ctx, "post", "/api/badges/unlock", {
    data: { badge_id: slug },
    headers: await csrfHeader(user.ctx),
  });
}

// ═════════════════════════════════════════════════════════════════════════════

test.describe.serial("user_stats et game_sessions restent d'accord", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser("agree");
  });
  test.afterAll(async () => u?.ctx?.dispose());

  test("compte vide au départ", async () => {
    expect(await stats(u)).toMatchObject({ games: 0, wins: 0, giveups: 0 });
  });

  test("3 victoires, 2 abandons : 5 parties, 3 victoires, 2 abandons", async () => {
    await playOk(u, { result: "win", attempts: 1 });
    await playOk(u, { result: "win", attempts: 4 });
    await playOk(u, { result: "giveup", attempts: 6 });
    await playOk(u, { result: "win", attempts: 2 });
    await playOk(u, { result: "giveup", attempts: 0 });

    expect(await stats(u)).toMatchObject({ games: 5, wins: 3, giveups: 2 });
  });

  test("les compteurs renvoyés par POST /api/sessions sont ceux que GET relit", async () => {
    const posted = await playOk(u, { result: "win", attempts: 3 });
    const read = await stats(u);
    expect(Number(posted.stats.games)).toBe(read.games);
    expect(Number(posted.stats.wins)).toBe(read.wins);
    expect(Number(posted.stats.giveups)).toBe(read.giveups);
  });

  test("une partie Expert ne touche pas aux compteurs normaux (403 tant que non débloqué)", async () => {
    const before = await stats(u);
    const r = await play(u, { extra: { is_expert: true } });
    expect(r.status()).toBe(403);
    expect(await stats(u)).toMatchObject({ games: before.games, wins: before.wins });
  });
});

test.describe.serial("le cas « badge oui, titre non » — deux sources de vérité", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser("title");
  });
  test.afterAll(async () => u?.ctx?.dispose());

  test("à 49 victoires Classique, le serveur refuse I Am Not Afraid (403) — c'est la course de fin de partie", async () => {
    for (let i = 0; i < 49; i++) await playOk(u, { result: "win", attempts: 1 });
    expect((await stats(u)).wins).toBe(49);

    const r = await unlockTitle(u, "aigis_i_am_not_afraid");
    expect(r.status(), "condition non remplie côté serveur → 403, jamais 200").toBe(403);
  });

  test("à 50, le titre s'ouvre ; Velvet Regular (50 JOURS distincts) reste fermé avec un seul jour", async () => {
    await playOk(u, { result: "win", attempts: 1 });
    expect((await stats(u)).wins).toBe(50);

    const title = await unlockTitle(u, "aigis_i_am_not_afraid");
    expect(
      title.ok(),
      `le titre doit s'ouvrir : ${title.status()} ${await title.text()}`
    ).toBeTruthy();
    const list = await call(u.ctx, "get", "/api/titles");
    const aigis = (await list.json()).find((t) => t.slug === "aigis_i_am_not_afraid");
    expect(Number(aigis?.is_unlocked)).toBe(1);

    const badge = await unlockBadge(u, "velvet_regular");
    expect(
      badge.status(),
      "50 parties le même jour ≠ 50 jours : le badge lit COUNT(DISTINCT played_date)"
    ).toBe(403);
  });

  test("redemander un titre déjà acquis est idempotent (200, pas de doublon)", async () => {
    const again = await unlockTitle(u, "aigis_i_am_not_afraid");
    expect(again.ok()).toBeTruthy();
    const list = await call(u.ctx, "get", "/api/titles");
    const count = (await list.json()).filter((t) => t.slug === "aigis_i_am_not_afraid").length;
    expect(count).toBe(1);
  });

  test("un titre inconnu ou un slug vide → 400 (définitif : la réconciliation n'insiste pas)", async () => {
    expect((await unlockTitle(u, "nope_not_a_title")).status()).toBe(400);
    expect((await unlockTitle(u, "")).status()).toBe(400);
  });
});

test.describe.serial("streak par mode et globale", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser("streak");
  });
  test.afterAll(async () => u?.ctx?.dispose());

  test("hier puis aujourd'hui : streak 2, record 2, globale 2", async () => {
    await playOk(u, { result: "win", date: parisDay(-1) });
    let s = await stats(u);
    expect(s.streak).toBe(1);

    await playOk(u, { result: "win", date: parisDay() });
    s = await stats(u);
    expect(s.streak).toBe(2);
    expect(s.streak_record).toBe(2);
    expect((await me(u)).global_streak).toBe(2);
  });

  test("rejouer le même jour ne fait pas monter la streak", async () => {
    await playOk(u, { result: "win", date: parisDay() });
    await playOk(u, { result: "giveup", date: parisDay() });
    const s = await stats(u);
    expect(s.streak).toBe(2);
    expect(s.games).toBe(4);
  });

  test("un autre mode joué aujourd'hui a sa propre streak (1), la globale reste 2", async () => {
    await playOk(u, { result: "win", mode: "emoji" });
    expect((await stats(u, "emoji")).streak).toBe(1);
    expect((await stats(u)).streak).toBe(2);
    expect((await me(u)).global_streak).toBe(2);
  });
});

test.describe("ce que le serveur refuse — pour que la file locale ne garde pas l'irrecevable", () => {
  let u;
  test.beforeAll(async () => {
    u = await registerUser("reject");
  });
  test.afterAll(async () => u?.ctx?.dispose());

  test("date d'avant-hier : 400", async () => {
    expect((await play(u, { date: parisDay(-2) })).status()).toBe(400);
  });

  test("date de demain : 400", async () => {
    expect((await play(u, { date: parisDay(1) })).status()).toBe(400);
  });

  test("résultat inconnu, essais > 20, mode inconnu : 400", async () => {
    expect((await play(u, { result: "draw" })).status()).toBe(400);
    expect((await play(u, { attempts: 21 })).status()).toBe(400);
    expect((await play(u, { mode: "tarot" })).status()).toBe(400);
  });

  test("client_session_id mal formé : 400 ; rien de tout cela n'a créé de partie", async () => {
    expect((await play(u, { extra: { client_session_id: "--------" } })).status()).toBe(400);
    expect((await stats(u)).games).toBe(0);
  });

  test("sans session : 401", async () => {
    const anon = await pwRequest.newContext({ baseURL: BASE });
    const r = await call(anon, "post", "/api/sessions", {
      data: {
        mode: MODE,
        played_date: parisDay(),
        target_name: "x",
        result: "win",
        attempts: 1,
        time_ms: 1,
      },
    });
    expect(r.status()).toBe(401);
    await anon.dispose();
  });
});
