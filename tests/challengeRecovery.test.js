/**
 * challengeRecovery.test.js — Les trois façons dont un défi mourait en silence.
 *
 * Signalé en prod : « parfois pas d'animation, parfois pas de redirection donc
 * on joue sans rien, parfois redirigé mais le défi n'est pas lancé et on reste
 * bloqué en défi en cours ». Trois symptômes, trois causes distinctes, toutes
 * muettes — aucune erreur, aucun message, rien en console :
 *
 *   1. `activeChallenge.date` portait le jour de CRÉATION du défi, alors que
 *      toutes ses lectures le comparent au jour COURANT. Un défi envoyé la
 *      veille au soir et accepté le lendemain naissait donc périmé.
 *   2. Cible introuvable dans le pool de la page → repli silencieux sur la cible
 *      du jour, `isChallengePlay()` toujours vrai : la partie ne comptait ni
 *      comme défi ni comme partie quotidienne.
 *   3. Case périmée jamais purgée par le chemin de fin de partie.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  activeChallengeKey,
  getActiveChallengeTarget,
  isChallengePlay,
  parisDateKey,
  releaseActiveChallenge,
  resolveChallengeTarget,
} from "../js/gameCore.js";

const POOL = [{ nom: "Yu Narukami" }, { nom: "Naoto Shirogane" }];

function writeChallenge(overrides = {}) {
  const challenge = {
    msgId: 42,
    mode: "classic",
    date: parisDateKey(),
    score: 3,
    senderId: 7,
    filterKey: null,
    originalFilters: null,
    isExpert: false,
    target: "Yu Narukami",
    ...overrides,
  };
  localStorage.setItem(activeChallengeKey(false), JSON.stringify(challenge));
  return challenge;
}

let updateStatus;

beforeEach(() => {
  localStorage.clear();
  updateStatus = vi.fn().mockResolvedValue({});
  window._personadleApi = { messages: { updateStatus } };
  window.showToast = vi.fn();
  window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html");
});

afterEach(() => {
  localStorage.clear();
  delete window._personadleApi;
  delete window.showToast;
  vi.restoreAllMocks();
});

describe("resolveChallengeTarget — cible jouable", () => {
  it("rend l'entrée du pool quand la cible s'y trouve", () => {
    writeChallenge({ target: "Naoto Shirogane" });

    expect(resolveChallengeTarget("classic", POOL)).toEqual({ nom: "Naoto Shirogane" });
    // Intacte : le défi continue.
    expect(localStorage.getItem(activeChallengeKey(false))).not.toBeNull();
  });

  it("rend null sans rien toucher quand il n'y a pas de défi", () => {
    expect(resolveChallengeTarget("classic", POOL)).toBeNull();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("ignore un défi qui vise un autre mode", () => {
    writeChallenge({ mode: "music" });

    expect(resolveChallengeTarget("classic", POOL)).toBeNull();
    // Surtout pas purgé : ce défi-là est vivant, il attend sa page.
    expect(localStorage.getItem(activeChallengeKey(false))).not.toBeNull();
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("resolveChallengeTarget — cible injouable", () => {
  it("purge le défi au lieu de laisser jouer la cible du jour", () => {
    // Cas réel : pool Expert plus étroit que le pool normal, dataset amputé
    // depuis l'envoi, ou clé de désambiguïsation inconnue du client.
    writeChallenge({ target: "Persona inexistante" });
    localStorage.setItem("target", '{"nom":"Cible du défi"}');

    expect(resolveChallengeTarget("classic", POOL)).toBeNull();

    // Case libérée : le joueur peut de nouveau accepter un défi…
    expect(localStorage.getItem(activeChallengeKey(false))).toBeNull();
    // …ses parties du mode sont de nouveau enregistrées…
    expect(isChallengePlay("classic")).toBe(false);
    // …l'état de mode est purgé (la partie repartira sur la cible du jour)…
    expect(localStorage.getItem("target")).toBeNull();
    // …le serveur ne garde pas un `accepted` éternel…
    expect(updateStatus).toHaveBeenCalledWith(42, "read");
    // …et le joueur est prévenu, au lieu de jouer pour rien.
    expect(window.showToast).toHaveBeenCalled();
  });

  it("rend au joueur ses filtres d'origine", () => {
    localStorage.setItem("filters_Classic", '["P4"]');
    writeChallenge({
      target: "Persona inexistante",
      filterKey: "filters_Classic",
      originalFilters: '["P4"]',
    });
    localStorage.setItem("filters_Classic", '["P5"]'); // filtres imposés par le défi

    resolveChallengeTarget("classic", POOL);

    expect(localStorage.getItem("filters_Classic")).toBe('["P4"]');
  });

  it("libère quand même le joueur si le serveur est injoignable", async () => {
    // Le local est déjà inutilisable : le garder n'y changerait rien et
    // continuerait à bloquer l'acceptation d'un autre défi. La page Amis expose
    // un bouton « Abandonner » sur les défis en cours pour rattraper le serveur.
    updateStatus.mockRejectedValue(new Error("offline"));
    writeChallenge({ target: "Persona inexistante" });

    resolveChallengeTarget("classic", POOL);
    await Promise.resolve();

    expect(localStorage.getItem(activeChallengeKey(false))).toBeNull();
  });
});

describe("date de jeu vs date de création", () => {
  it("un défi daté d'hier n'impose plus sa cible (il est périmé)", () => {
    writeChallenge({ date: "2020-01-01" });

    expect(getActiveChallengeTarget("classic")).toBeNull();
    expect(isChallengePlay("classic")).toBe(false);
  });

  it("un défi daté d'aujourd'hui impose sa cible", () => {
    writeChallenge();

    expect(getActiveChallengeTarget("classic")).toBe("Yu Narukami");
    expect(isChallengePlay("classic")).toBe(true);
  });
});

describe("releaseActiveChallenge", () => {
  it("purge l'état du mode et signale le rechargement pour un défi à cible dédiée", () => {
    const challenge = writeChallenge();
    localStorage.setItem("target", '{"nom":"Yu Narukami"}');
    localStorage.setItem("guessHistory", '["Chie"]');

    expect(releaseActiveChallenge(challenge)).toBe(true);
    expect(localStorage.getItem("target")).toBeNull();
    expect(localStorage.getItem("guessHistory")).toBeNull();
    expect(localStorage.getItem(activeChallengeKey(false))).toBeNull();
  });

  it("laisse l'état du mode intact pour un défi sans cible dédiée (ancien format)", () => {
    // Ancien format : le défi se jouait SUR la cible du jour. Purger l'état
    // effacerait une partie quotidienne légitime, déjà entamée.
    const challenge = writeChallenge({ target: null });
    localStorage.setItem("target", '{"nom":"Cible du jour"}');

    expect(releaseActiveChallenge(challenge)).toBe(false);
    expect(localStorage.getItem("target")).toBe('{"nom":"Cible du jour"}');
    expect(localStorage.getItem(activeChallengeKey(false))).toBeNull();
  });

  it("libère la case de la BONNE dimension", () => {
    const expert = { ...writeChallenge(), isExpert: true };
    localStorage.setItem(activeChallengeKey(true), JSON.stringify(expert));

    releaseActiveChallenge(expert);

    expect(localStorage.getItem(activeChallengeKey(true))).toBeNull();
    // Le défi normal, lui, n'a pas été joué : il reste.
    expect(localStorage.getItem(activeChallengeKey(false))).not.toBeNull();
  });
});
