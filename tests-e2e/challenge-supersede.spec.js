import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";

/**
 * Règle « un seul défi vivant par expéditeur » (api/messages/index.php, POST).
 *
 * Un nouveau défi remplace ceux que le MÊME expéditeur avait envoyés au MÊME
 * destinataire sans qu'ils soient relevés. Sans cette règle, un ami qui propose
 * un défi chaque jour construit une pile que le destinataire ne rattrapera
 * jamais — l'empilement que la migration 036 a dû nettoyer à la main.
 *
 * Ce que ce fichier verrouille, et qu'aucun test unitaire ne peut prouver :
 *   1. le remplacement ne touche QUE les défis `unread` — un défi déjà accepté
 *      est un engagement, seul le joueur en sort (bouton « abandonner ») ;
 *   2. il est cloisonné par expéditeur — le défi d'un autre ami est intact ;
 *   3. l'API renvoie toujours l'id réel du défi créé. Ce dernier point n'est pas
 *      cosmétique : `lastInsertId()` retombe à 0 dès qu'un UPDATE passe sur la
 *      même connexion (vérifié sur MariaDB 10.6), et la règle en exécute un.
 *
 * Pré-requis : stack Docker démarrée (make up). Comptes frais à chaque run.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";

/** Dates de défi distinctes : un même couple ne peut avoir qu'un défi par jour (409). */
const DAY_1 = "2026-03-02";
const DAY_2 = "2026-03-03";
const DAY_3 = "2026-03-04";

async function registerUser(rnd, suffix) {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  // Le suffixe est placé EN TÊTE : `pseudo` est plafonné à 20 caractères et
  // porte une contrainte UNIQUE. Mis en fin, il se faisait tronquer et les
  // trois comptes demandaient le même pseudo — inscription en 409.
  const pseudo = `sup${suffix}_${rnd}`.slice(0, 20);
  const res = await ctx.post("/api/auth/register", {
    data: {
      email: `e2e_${pseudo}@test.local`,
      pseudo,
      password: "test1234",
    },
  });
  expect(res.ok(), `register(${suffix}) doit réussir`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code };
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

async function sendChallenge(from, to, date, mode = "classic") {
  const res = await from.ctx.post("/api/messages/", {
    data: {
      receiver_id: to.userId,
      type: "challenge",
      challenge_mode: mode,
      challenge_score: 3,
      challenge_date: date,
    },
    headers: await csrfHeader(from.ctx),
  });
  expect(res.ok(), `l'envoi du défi (${date}) doit réussir`).toBeTruthy();
  return await res.json();
}

/** Statut d'un défi vu par le destinataire. */
async function statusOf(user, msgId) {
  const res = await user.ctx.get("/api/messages?type=challenge&limit=50");
  expect(res.ok()).toBeTruthy();
  const { messages } = await res.json();
  return messages.find((m) => m.id === msgId)?.status ?? null;
}

test.describe.serial("API — un seul défi vivant par expéditeur", () => {
  let alice, bob, carol;
  let first, second;

  test.beforeAll(async () => {
    const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    alice = await registerUser(rnd, "a");
    bob = await registerUser(rnd, "b");
    carol = await registerUser(rnd, "c");
    await befriend(alice, bob);
    await befriend(carol, bob);
  });

  test.afterAll(async () => {
    await alice?.ctx?.dispose();
    await bob?.ctx?.dispose();
    await carol?.ctx?.dispose();
  });

  test("l'API renvoie l'id réel du défi créé, pas 0", async () => {
    // Régression directe : la règle exécute un UPDATE après l'INSERT, et
    // `lastInsertId()` retombe à 0 après un UPDATE. Lu trop tard, l'API
    // répondrait `{"id": 0}` sans que rien d'autre ne le signale.
    first = await sendChallenge(alice, bob, DAY_1);
    expect(first.created).toBe(true);
    expect(first.id).toBeGreaterThan(0);
  });

  test("un nouveau défi du même ami remplace le précédent non relevé", async () => {
    expect(await statusOf(bob, first.id)).toBe("unread");

    second = await sendChallenge(alice, bob, DAY_2);
    expect(second.id).toBeGreaterThan(0);

    // Le premier est retiré de la pile…
    expect(await statusOf(bob, first.id)).toBe("read");
    // …et le nouveau prend sa place.
    expect(await statusOf(bob, second.id)).toBe("unread");
  });

  test("le défi d'un AUTRE ami n'est pas touché", async () => {
    const fromCarol = await sendChallenge(carol, bob, DAY_2);
    expect(await statusOf(bob, fromCarol.id)).toBe("unread");

    // Carol envoie chez elle : le défi d'Alice doit rester vivant.
    expect(await statusOf(bob, second.id)).toBe("unread");

    // Et réciproquement : un nouveau défi d'Alice ne touche pas celui de Carol.
    const third = await sendChallenge(alice, bob, DAY_3);
    expect(await statusOf(bob, fromCarol.id)).toBe("unread");
    expect(await statusOf(bob, third.id)).toBe("unread");
    // Celui d'Alice au jour 2, lui, a bien été remplacé.
    expect(await statusOf(bob, second.id)).toBe("read");
  });

  test("un défi DÉJÀ ACCEPTÉ n'est jamais remplacé", async () => {
    // Le point le plus important du fichier : accepter, c'est s'engager. Retirer
    // un défi accepté dans le dos du joueur annulerait une partie peut-être en
    // cours, et le priverait du seul chemin de sortie prévu (« abandonner »).
    const accepted = await sendChallenge(alice, bob, "2026-03-05");
    const patch = await bob.ctx.patch(`/api/messages/${accepted.id}`, {
      data: { status: "accepted" },
      headers: await csrfHeader(bob.ctx),
    });
    expect(patch.ok(), "B doit pouvoir accepter le défi").toBeTruthy();
    expect(await statusOf(bob, accepted.id)).toBe("accepted");

    await sendChallenge(alice, bob, "2026-03-06");

    expect(
      await statusOf(bob, accepted.id),
      "un défi accepté doit survivre à l'arrivée d'un nouveau"
    ).toBe("accepted");
  });
});
