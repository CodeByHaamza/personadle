import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * leaderboard_my_rank.spec.js — « Ta place » même hors de la page affichée
 * (2.4, lot 15).
 *
 * Avant : `my_rank` n'existait que pour les joueurs présents sur la page
 * renvoyée (le top 50) — exactement ceux qui n'en avaient pas besoin. Un joueur
 * classé 86ᵉ ne voyait jamais sa place. On le vérifie avec une page d'UNE ligne :
 * un second joueur, moins bien classé, doit quand même recevoir son rang.
 *
 * Pré-requis : stack Docker démarrée (make up).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";
const parisDay = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

/** moderation.spec.js ferme le site quelques ms (503) : on rejoue, comme ailleurs. */
async function call(ctx, method, url, options) {
  let res;
  for (let attempt = 0; attempt < 30; attempt++) {
    res = await ctx[method](url, options);
    if (res.status() !== 503) return res;
    await new Promise((r) => setTimeout(r, 250));
  }
  return res;
}

async function registerUser(tag) {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `lb${tag}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok()).toBeTruthy();
  return { ctx, userId: (await res.json()).user.id };
}

async function win(user) {
  const res = await call(user.ctx, "post", "/api/sessions", {
    data: {
      mode: "classic",
      played_date: parisDay(),
      target_name: `E2E lb ${Math.random().toString(36).slice(2, 8)}`,
      result: "win",
      attempts: 2,
      time_ms: 3000,
      client_session_id: crypto.randomUUID(),
    },
    headers: await csrfHeader(user.ctx),
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test("my_rank comes back even when the player is not on the page returned", async () => {
  const ahead = await registerUser("a");
  const behind = await registerUser("b");
  try {
    await win(ahead);
    await win(ahead);
    await win(behind);

    // Une page d'une seule ligne : le premier du classement, jamais « behind »
    // (« ahead » a plus de victoires que lui).
    const res = await call(
      behind.ctx,
      "get",
      "/api/leaderboard/?mode=classic&period=ever&metric=wins&limit=1&offset=0"
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].user_id).not.toBe(behind.userId);
    expect(body.my_rank, "ta place doit être renvoyée hors de la page").not.toBeNull();
    expect(body.my_rank.rank).toBeGreaterThan(1);
    expect(body.my_rank.rank).toBeLessThanOrEqual(body.count);

    // Et c'est bien sa place : la page qui commence à ce rang le contient.
    const page = await call(
      behind.ctx,
      "get",
      `/api/leaderboard/?mode=classic&period=ever&metric=wins&limit=5&offset=${body.my_rank.rank - 1}`
    );
    const rows = (await page.json()).entries;
    expect(rows.find((e) => e.rank === body.my_rank.rank)?.user_id).toBe(behind.userId);
  } finally {
    await ahead.ctx.dispose();
    await behind.ctx.dispose();
  }
});
