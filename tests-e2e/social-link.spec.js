import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Test E2E via l'API (fiables, sans DOM) du parcours Social Link complet :
 *   ajouter un ami → accepter → interagir (mutuel) → XP cumulée → montée de rang.
 *
 * Ce parcours ne peut PAS être vérifié par les tests unitaires seuls : ceux-ci
 * couvrent la formule XP/rang isolément (tests/php/SocialLinkTest.php) mais pas
 * son branchement réel sur les tables `friendships` → `social_links` → l'auth
 * (garde-fou "Not friends" de la route by-friend/interact).
 *
 * Pré-requis : stack Docker démarrée (make up). Deux comptes frais sont créés
 * par run pour rester idempotent (1 action par jour par couple d'amis).
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

async function registerUser(rnd, suffix) {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/auth/register", {
    data: {
      email: `e2e_sl_${rnd}${suffix}@test.local`,
      pseudo: `e2e_sl_${rnd}${suffix}`.slice(0, 20),
      password: "test1234",
    },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code };
}

test.describe.serial("API — parcours Social Link (ami → interaction → rang)", () => {
  let a, b;

  test.beforeAll(async () => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    a = await registerUser(rnd, "a");
    b = await registerUser(rnd, "b");
  });

  test.afterAll(async () => {
    await a?.ctx?.dispose();
    await b?.ctx?.dispose();
  });

  test("l'action Social Link échoue tant que les deux comptes ne sont pas amis", async () => {
    const res = await a.ctx.post(`/api/social-links/by-friend/${b.userId}/interact`, {
      data: { action_type: "visit_profile" },
      headers: await csrfHeader(a.ctx),
    });
    expect(res.status()).toBe(403); // "Not friends"
  });

  test("A envoie une demande d'ami à B via son friend_code", async () => {
    // Slash final obligatoire : api/friends/.htaccess ne route la racine du
    // dossier (`RewriteRule ^$ index.php`) que pour l'URL avec le "/" final.
    // Sans lui, Apache renvoie d'abord un 301 vers "/api/friends/" (mod_dir),
    // ce qui transforme silencieusement ce POST en GET et fait échouer la
    // création de la demande sans que res.ok() ne le révèle (le GET répond
    // 200 avec la liste des amis, pas l'erreur) — cf. js/api.js qui utilise
    // déjà "/friends/" pour cette même raison.
    const res = await a.ctx.post("/api/friends/", {
      data: { friend_code: b.friendCode },
      headers: await csrfHeader(a.ctx),
    });
    expect(res.ok(), "POST /api/friends doit réussir").toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("pending");
    a.friendshipId = body.friendship_id;
  });

  test("B accepte la demande", async () => {
    const res = await b.ctx.patch(`/api/friends/${a.friendshipId}`, {
      data: { action: "accept" },
      headers: await csrfHeader(b.ctx),
    });
    expect(res.ok(), "PATCH accept doit réussir").toBeTruthy();
    expect((await res.json()).status).toBe("accepted");
  });

  test("A et B gagnent chacun de l'XP mutuelle en faisant 'share_streak' le même jour", async () => {
    const rA = await a.ctx.post(`/api/social-links/by-friend/${b.userId}/interact`, {
      data: { action_type: "share_streak" },
      headers: await csrfHeader(a.ctx),
    });
    expect(rA.ok(), "interact(A, share_streak) doit réussir").toBeTruthy();
    const bodyA = await rA.json();
    expect(bodyA.is_mutual).toBe(false); // B ne l'a pas encore fait aujourd'hui
    expect(bodyA.xp_gained).toBe(15); // solo — cf. api/lib/social_link.php

    const rB = await b.ctx.post(`/api/social-links/by-friend/${a.userId}/interact`, {
      data: { action_type: "share_streak" },
      headers: await csrfHeader(b.ctx),
    });
    expect(rB.ok(), "interact(B, share_streak) doit réussir").toBeTruthy();
    const bodyB = await rB.json();
    expect(bodyB.is_mutual).toBe(true); // A l'a fait aujourd'hui → mutuel
    expect(bodyB.xp_gained).toBe(30); // mutuel — cf. api/lib/social_link.php

    // Les deux actions mutuelles contribuent exactement 2×30 = 60 XP au lien partagé
    // (l'entrée de A est topée jusqu'au tarif mutuel + B reçoit son propre mutuel).
    expect(bodyB.new_xp).toBe(60);
  });

  test("une seconde action mutuelle fait franchir le seuil de rang 2 (100 XP)", async () => {
    const rA = await a.ctx.post(`/api/social-links/by-friend/${b.userId}/interact`, {
      data: { action_type: "challenge" },
      headers: await csrfHeader(a.ctx),
    });
    expect(rA.ok()).toBeTruthy();

    const rB = await b.ctx.post(`/api/social-links/by-friend/${a.userId}/interact`, {
      data: { action_type: "challenge" },
      headers: await csrfHeader(b.ctx),
    });
    expect(rB.ok()).toBeTruthy();
    const bodyB = await rB.json();

    // Total attendu : 60 (share_streak) + 2×35 (challenge mutuel) = 130 XP → rang 2 (seuil 100)
    expect(bodyB.new_xp).toBe(130);
    expect(bodyB.new_rank).toBe(2);
    expect(bodyB.ranked_up).toBe(true);
  });

  test("l'action ne peut pas être répétée le même jour (anti-spam)", async () => {
    const res = await a.ctx.post(`/api/social-links/by-friend/${b.userId}/interact`, {
      data: { action_type: "share_streak" },
      headers: await csrfHeader(a.ctx),
    });
    expect(res.status()).toBe(409);
  });
});
