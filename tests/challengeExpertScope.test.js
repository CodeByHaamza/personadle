/**
 * challengeExpertScope.test.js — Cloisonnement des défis Normal / Expert.
 *
 * Ce que ce fichier protège, et pourquoi c'était bloquant jusqu'ici :
 *
 *   `activeChallenge` était UNE SEULE case localStorage, partagée par les deux
 *   dimensions. Conséquences, toutes silencieuses :
 *     - accepter un défi Expert écrasait le défi normal en cours, qui restait
 *       alors bloqué en `accepted` côté serveur pour toujours ;
 *     - une victoire en Expert résolvait le défi NORMAL, avec un score issu
 *       d'une autre mécanique (l'Expert ne donne qu'un indice, ses essais ne se
 *       comparent pas à ceux du mode normal).
 *
 *   D'où les gardes qui interdisaient purement et simplement les défis en Expert
 *   (js/gameCore.js, js/challenge-result.js, personaeMode/modePersonae.js).
 *   Le cloisonnement par clé les remplace : il n'y a plus rien à interdire,
 *   une partie ne peut atteindre que le défi de sa propre dimension.
 *
 *   Si ces tests tombent, ce n'est pas un détail de stockage : c'est le retour
 *   du défi écrasé et du barème croisé.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  activeChallengeKey,
  getActiveChallengeTarget,
  getPendingActiveChallenge,
  parisDateKey,
} from "../js/gameCore.js";

/** Place la page en Normal ou en Expert (le mode vit dans l'URL). */
function goTo({ expert }) {
  window.history.replaceState({}, "", expert ? "/personae.html?expert=1" : "/personae.html");
}

function storeChallenge(key, overrides = {}) {
  localStorage.setItem(
    key,
    JSON.stringify({
      msgId: 1,
      mode: "personae",
      date: parisDateKey(),
      score: 3,
      target: "Orpheus",
      ...overrides,
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  goTo({ expert: false });
});

afterEach(() => {
  localStorage.clear();
});

describe("activeChallengeKey — deux cases, jamais une seule", () => {
  it("donne une clé distincte par dimension", () => {
    expect(activeChallengeKey(false)).not.toBe(activeChallengeKey(true));
  });

  it("suit la dimension de la page quand on ne lui dit rien", () => {
    goTo({ expert: false });
    const normal = activeChallengeKey();
    goTo({ expert: true });
    expect(activeChallengeKey()).not.toBe(normal);
  });

  it("garde la clé historique en mode normal", () => {
    // Les défis déjà acceptés avant la migration 037 vivent sous cette clé :
    // la renommer les ferait disparaître du jour au lendemain.
    expect(activeChallengeKey(false)).toBe("activeChallenge");
  });
});

describe("getActiveChallengeTarget — une partie ne voit que son propre défi", () => {
  it("ignore un défi Expert quand on joue en normal", () => {
    storeChallenge(activeChallengeKey(true), { target: "Thanatos" });
    goTo({ expert: false });
    // Sans cloisonnement, la cible du défi Expert s'imposait à la partie normale.
    expect(getActiveChallengeTarget("personae")).toBeNull();
  });

  it("ignore un défi normal quand on joue en Expert", () => {
    storeChallenge(activeChallengeKey(false), { target: "Orpheus" });
    goTo({ expert: true });
    expect(getActiveChallengeTarget("personae")).toBeNull();
  });

  it("rend bien la cible du défi de sa propre dimension", () => {
    storeChallenge(activeChallengeKey(true), { target: "Thanatos" });
    goTo({ expert: true });
    expect(getActiveChallengeTarget("personae")).toBe("Thanatos");
  });

  it("continue d'ignorer un défi d'un AUTRE mode", () => {
    // Le cloisonnement Expert ne doit pas avoir affaibli le filtre par mode.
    storeChallenge(activeChallengeKey(false), { mode: "classic" });
    goTo({ expert: false });
    expect(getActiveChallengeTarget("personae")).toBeNull();
  });
});

describe("getPendingActiveChallenge — les deux dimensions coexistent", () => {
  it("un défi Expert en cours ne bloque pas l'acceptation d'un défi normal", () => {
    // C'est ce qui rend les deux jeux réellement indépendants : sinon accepter
    // un défi Expert condamnait le joueur à refuser tous les défis normaux du
    // jour, et réciproquement.
    storeChallenge(activeChallengeKey(true));
    expect(getPendingActiveChallenge(false)).toBeNull();
    expect(getPendingActiveChallenge(true)).not.toBeNull();
  });

  it("un défi normal en cours ne bloque pas l'acceptation d'un défi Expert", () => {
    storeChallenge(activeChallengeKey(false));
    expect(getPendingActiveChallenge(true)).toBeNull();
    expect(getPendingActiveChallenge(false)).not.toBeNull();
  });

  it("bloque toujours un second défi de la MÊME dimension", () => {
    // La case reste unique PAR dimension : accepter un second défi Expert
    // écraserait le premier, qui resterait bloqué en `accepted` côté serveur.
    storeChallenge(activeChallengeKey(true), { msgId: 42 });
    expect(getPendingActiveChallenge(true)?.msgId).toBe(42);
  });

  it("considère toujours périmé un défi d'un jour précédent", () => {
    storeChallenge(activeChallengeKey(true), { date: "2020-01-01" });
    expect(getPendingActiveChallenge(true)).toBeNull();
  });
});
