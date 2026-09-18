/**
 * challengeAbandon.test.js — abandonActiveChallenge() (js/challenge-banner.js)
 *
 * Ce que ce fichier protège, et pourquoi ça n'allait pas de soi :
 *
 *   1. **L'appel serveur est ATTENDU.** `activeChallenge` est une case unique :
 *      tant qu'elle est occupée, `challenge-notif.js` refuse d'accepter un autre
 *      défi. Purger le localStorage avant la confirmation du serveur laisserait
 *      le défi `accepted` en base — donc toujours bloquant côté expéditeur —
 *      pendant que le client se croirait libéré. C'est exactement le piège de
 *      `performRecovery()` (CLAUDE.md §7), qui a déjà coûté un revert silencieux.
 *
 *   2. **Le statut envoyé est `read`, pas `expired`.** Dans ce code `expired`
 *      signifie « tenté et manqué » (checkChallengeCompletion) : l'envoyer ferait
 *      lire à l'expéditeur une défaite qui n'a jamais eu lieu.
 *
 *   3. **L'état du mode n'est purgé que pour un défi à cible dédiée.** Sur un
 *      défi sans `target`, la partie affichée EST celle du jour — l'effacer
 *      ferait perdre au joueur une partie qui n'a rien à voir avec le défi.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { abandonActiveChallenge } from "../js/challenge-banner.js";

function challenge(overrides = {}) {
  return {
    msgId: 42,
    mode: "classic",
    date: "2026-08-26",
    score: 3,
    senderId: 7,
    filterKey: null,
    originalFilters: null,
    target: null,
    ...overrides,
  };
}

let updateStatus;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  updateStatus = vi.fn().mockResolvedValue({ updated: true });
  window._personadleApi = { messages: { updateStatus } };
  window.confirm = vi.fn(() => true);
  window.showToast = vi.fn();
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  window._personadleApi = undefined;
  vi.restoreAllMocks();
});

describe("abandonActiveChallenge — chemin nominal", () => {
  it("prévient le serveur avec le statut `read`", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(challenge()));

    const ok = await abandonActiveChallenge(challenge());

    expect(ok).toBe(true);
    // `read` et non `expired` : le joueur n'a pas perdu, il n'a pas joué.
    expect(updateStatus).toHaveBeenCalledWith(42, "read");
  });

  it("libère la case activeChallenge", async () => {
    localStorage.setItem("activeChallenge", JSON.stringify(challenge()));

    await abandonActiveChallenge(challenge());

    expect(localStorage.getItem("activeChallenge")).toBeNull();
  });

  it("restaure les filtres d'origine du joueur", async () => {
    // Accepter un défi écrase les filtres par ceux de l'expéditeur : abandonner
    // doit rendre au joueur les siens, sinon il repart avec ceux d'un autre.
    const c = challenge({ filterKey: "classicFilters", originalFilters: '["P3","P4"]' });
    localStorage.setItem("classicFilters", '["P5X"]');

    await abandonActiveChallenge(c);

    expect(localStorage.getItem("classicFilters")).toBe('["P3","P4"]');
  });

  it("retire la clé quand le joueur n'avait aucun filtre à lui", async () => {
    // Clé ABSENTE à l'acceptation = « je n'ai jamais touché mes filtres, tout est
    // actif ». L'abandon doit rendre cet état-là, donc supprimer la clé : la
    // version précédente ne faisait rien, et les filtres de l'expéditeur restaient
    // pour toujours (bug sorti par tests-e2e/filters_usecases.spec.js).
    const c = challenge({
      filterKey: "classicFilters",
      originalFilters: null,
      installedFilters: '["P5X"]',
    });
    localStorage.setItem("classicFilters", '["P5X"]');

    await abandonActiveChallenge(c);

    expect(localStorage.getItem("classicFilters")).toBeNull();
  });

  it("ne touche pas aux filtres si le joueur les a rechoisis pendant le défi", async () => {
    // Son choix est plus récent que celui du défi : il gagne.
    const c = challenge({
      filterKey: "classicFilters",
      originalFilters: '["P3"]',
      installedFilters: '["P5X"]',
    });
    localStorage.setItem("classicFilters", '["P4","P4G"]');

    await abandonActiveChallenge(c);

    expect(localStorage.getItem("classicFilters")).toBe('["P4","P4G"]');
  });
});

describe("abandonActiveChallenge — échec serveur", () => {
  it("ne purge RIEN si le serveur refuse", async () => {
    // Le cœur du fichier : client et serveur ne doivent jamais diverger.
    updateStatus.mockRejectedValue(new Error("500"));
    const raw = JSON.stringify(challenge());
    localStorage.setItem("activeChallenge", raw);

    const ok = await abandonActiveChallenge(challenge());

    expect(ok).toBe(false);
    expect(localStorage.getItem("activeChallenge")).toBe(raw);
  });

  it("ne restaure pas les filtres si le serveur refuse", async () => {
    updateStatus.mockRejectedValue(new Error("réseau"));
    const c = challenge({ filterKey: "classicFilters", originalFilters: '["P3"]' });
    localStorage.setItem("classicFilters", '["P5X"]');

    await abandonActiveChallenge(c);

    // Les filtres du défi restent en place : la partie en cours est toujours
    // celle du défi, puisqu'il n'a pas été abandonné.
    expect(localStorage.getItem("classicFilters")).toBe('["P5X"]');
  });

  it("échoue proprement quand le bridge API est absent", async () => {
    // Hors ligne / bridge non chargé : sans API, le serveur ne saura jamais que
    // le défi a été abandonné. On ne touche donc pas à l'état local.
    window._personadleApi = undefined;
    const raw = JSON.stringify(challenge());
    localStorage.setItem("activeChallenge", raw);

    const ok = await abandonActiveChallenge(challenge());

    expect(ok).toBe(false);
    expect(localStorage.getItem("activeChallenge")).toBe(raw);
  });

  it("échoue proprement si le défi n'a pas d'identifiant de message", async () => {
    const ok = await abandonActiveChallenge(challenge({ msgId: null }));

    expect(ok).toBe(false);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("abandonActiveChallenge — état du mode", () => {
  it("purge l'état du mode pour un défi à cible dédiée", async () => {
    // La partie chargée n'est PAS celle du jour : sans purge, le joueur
    // continuerait sur la cible du défi qu'on vient d'abandonner.
    localStorage.setItem("target", "Joker");
    localStorage.setItem("attempts", "2");

    await abandonActiveChallenge(challenge({ target: "Makoto Yuki" }));

    expect(localStorage.getItem("target")).toBeNull();
    expect(localStorage.getItem("attempts")).toBeNull();
  });

  it("laisse l'état du mode intact pour un défi SANS cible dédiée", async () => {
    // Ici la partie affichée est celle du jour : l'effacer ferait perdre au
    // joueur une partie qui n'appartient pas au défi.
    localStorage.setItem("target", "Joker");
    localStorage.setItem("attempts", "2");

    await abandonActiveChallenge(challenge({ target: null }));

    expect(localStorage.getItem("target")).toBe("Joker");
    expect(localStorage.getItem("attempts")).toBe("2");
  });
});
