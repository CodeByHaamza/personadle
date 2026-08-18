/**
 * authTransport.test.js — distinction « serveur injoignable » vs « déconnecté ».
 *
 * Bug signalé le 2026-08-15 : des joueurs à session valide se voyaient demander de
 * se reconnecter en boucle sur la page Amis. Cause : apiCall() lève sur TOUTE
 * réponse non-ok, le service worker transforme toute panne réseau sur /api/* en
 * 503 JSON, et initAuth() attrapait les deux dans le même catch → « anonyme ».
 */

import { describe, it, expect, beforeEach } from "vitest";
import { isTransportError, updateAuthUI } from "../js/auth.js";

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  window._currentUser = null;
});

describe("isTransportError", () => {
  it("un 401 est une réponse, pas une panne", () => {
    expect(isTransportError({ status: 401 })).toBe(false);
  });

  it("un 403 non plus", () => {
    expect(isTransportError({ status: 403 })).toBe(false);
  });

  it("le 503 synthétique du service worker est une panne", () => {
    // sw.js renvoie {error:"offline"} en 503 dès que fetch() échoue sur /api/*.
    expect(isTransportError({ status: 503, data: { error: "offline" } })).toBe(true);
  });

  it("un 500 serveur est une panne", () => {
    expect(isTransportError({ status: 500 })).toBe(true);
  });

  it("une erreur sans status (TypeError de fetch) est une panne", () => {
    expect(isTransportError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isTransportError(undefined)).toBe(true);
  });
});

describe("updateAuthUI — préservation du seed joueur", () => {
  it("mémorise l'id du joueur connecté", () => {
    updateAuthUI({ id: 42 });
    expect(localStorage.getItem("playerUserId")).toBe("42");
  });

  it("purge le seed quand le serveur dit AUTORITAIREMENT que personne n'est connecté", () => {
    localStorage.setItem("playerUserId", "42");
    updateAuthUI(null, true);
    expect(localStorage.getItem("playerUserId")).toBeNull();
  });

  it("conserve le seed quand le serveur est injoignable", () => {
    // Purger ici changerait la cible du jour du joueur : getPlayerSeedId()
    // retomberait sur anonPlayerId, et son puzzle changerait tout seul après un
    // simple blip réseau.
    localStorage.setItem("playerUserId", "42");
    updateAuthUI(null, false);
    expect(localStorage.getItem("playerUserId")).toBe("42");
  });
});
