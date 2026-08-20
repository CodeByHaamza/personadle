import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * « 50 parties comptent pour 50 parties » — vérification de bout en bout.
 *
 * Jusqu'à la migration 032, `uq_session_per_day (user, mode, date, is_expert)`
 * n'autorisait qu'UNE session par jour et par mode : les parties suivantes
 * étaient refusées en 409 et disparaissaient sans que le joueur le voie. Les
 * tests unitaires ne couvrent que la garde client (`startGame`/`isGameLogged`) ;
 * seul ce test prouve que le serveur enregistre réellement chaque partie.
 *
 * Ce qui est vérifié ici, et nulle part ailleurs :
 *   1. trois parties le MÊME jour, dans le MÊME mode → trois sessions, stats cumulées
 *   2. la streak, elle, reste journalière (3 parties ≠ streak 3)
 *   3. le rejeu d'un `client_session_id` déjà enregistré est refusé (idempotence)
 *   4. une partie Expert ne pollue pas les stats du mode normal
 *
 * Pré-requis : stack Docker démarrée (make up), migrations 031 et 032 appliquées.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";
const MODE = "classic";

const aujourdhui = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

// `uq_session_client_id` est unique GLOBALEMENT, pas par utilisateur : des UUID
// écrits en dur rejoueraient le run précédent et récolteraient un 409 sans
// rapport avec ce qui est testé. Un lot neuf à chaque exécution.
const uuid = () => crypto.randomUUID();

test.describe.serial("API — plusieurs parties le même jour", () => {
  let ctx;
  let userId;
  const jour = aujourdhui();

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext({ baseURL: BASE });
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const res = await ctx.post("/api/auth/register", {
      data: {
        email: `e2e_${rnd}@test.local`,
        pseudo: `e2e_${rnd}`.slice(0, 20),
        password: "test1234",
      },
    });
    expect(
      res.ok(),
      "register doit réussir — si 429, c'est le rate-limit (attendre ~15 min ou vider rate_limits)"
    ).toBeTruthy();
    userId = (await res.json()).user.id;
  });

  test.afterAll(async () => {
    await ctx?.dispose();
  });

  /** Une partie : le client_session_id est la clé d'idempotence (migration 032). */
  const jouer = async (clientSessionId, result, extra = {}) =>
    ctx.post("/api/sessions", {
      data: {
        mode: MODE,
        played_date: jour,
        target_name: `Cible ${clientSessionId}`,
        result,
        attempts: 3,
        time_ms: 4000,
        client_session_id: clientSessionId,
        ...extra,
      },
      headers: await csrfHeader(ctx),
    });

  const partie1 = uuid();

  test("trois parties le même jour sont toutes enregistrées", async () => {
    const r1 = await jouer(partie1, "win");
    const r2 = await jouer(uuid(), "giveup");
    const r3 = await jouer(uuid(), "win");

    for (const [i, r] of [r1, r2, r3].entries()) {
      expect(r.status(), `partie ${i + 1} — 201 attendu, pas un 409 « déjà joué aujourd'hui »`).toBe(
        201
      );
    }

    const stats = (await r3.json()).stats;
    expect(stats.games, "3 parties comptées").toBe(3);
    expect(stats.wins, "2 victoires").toBe(2);
    expect(stats.giveups, "1 abandon").toBe(1);
    // La streak est journalière : jouer trois fois dans la soirée ne la triple pas.
    expect(stats.streak, "la streak reste journalière").toBe(1);
  });

  test("rejouer un client_session_id déjà enregistré est refusé (409)", async () => {
    // C'est le cas réel de savePendingSession() qui rejoue sa file après un
    // timeout sur une requête que le serveur avait pourtant traitée.
    const rejeu = await jouer(partie1, "win");
    expect(rejeu.status(), "doublon refusé, pas inséré une seconde fois").toBe(409);
  });

  test("les stats lues après coup montrent bien les trois parties", async () => {
    const res = await ctx.get(`/api/user/${userId}/stats`);
    expect(res.ok()).toBeTruthy();
    const { by_mode } = (await res.json()).stats;
    const ligne = by_mode.find((m) => m.mode === MODE);
    expect(ligne, `le mode ${MODE} doit apparaître dans by_mode`).toBeTruthy();
    expect(Number(ligne.games)).toBe(3);
    expect(Number(ligne.wins)).toBe(2);
  });

  test("une partie Expert ne compte pas dans les stats du mode normal", async () => {
    const r = await jouer(uuid(), "win", { is_expert: true });
    expect(r.status()).toBe(201);

    const res = await ctx.get(`/api/user/${userId}/stats`);
    const { by_mode, expert_by_mode } = (await res.json()).stats;
    const normal = by_mode.find((m) => m.mode === MODE);
    expect(Number(normal.games), "toujours 3 parties normales").toBe(3);

    const expert = expert_by_mode.find((m) => m.mode === MODE);
    expect(expert, "la partie Expert apparaît dans expert_by_mode").toBeTruthy();
    expect(Number(expert.games)).toBe(1);
  });
});
