import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { showChallengeButton } from "../js/gameCore.js";

/**
 * challengeModalExpert.test.js — Le sélecteur d'amis d'un défi Expert.
 *
 * Ce qu'il protège : proposer un ami qui n'a pas débloqué le Mode Expert du mode
 * l'envoie dans une impasse. Il accepte, la porte Expert le renvoie en mode
 * normal, et le défi reste « accepté » côté serveur — invisible pour sa bannière
 * (qui ne lit que la dimension de la page courante), donc ni jouable ni
 * abandonnable. Et comme un défi accepté n'est jamais remplacé, l'expéditeur ne
 * peut plus lui en envoyer d'autre de la journée : les deux sont bloqués.
 *
 * Le serveur refuse déjà l'envoi (api/messages/index.php) ; ces tests couvrent
 * l'interface, qui doit éviter de proposer l'impossible.
 */

/** Ouvre la modale via le bouton et rend la main après le chargement des amis. */
async function openModal() {
  document.getElementById("challengeFriendBtn")?.click();
  await new Promise((r) => setTimeout(r, 0));
}

let listSpy;

beforeEach(() => {
  document.body.innerHTML = '<div id="modeNavigationContainer"></div>';
  window.history.replaceState({}, "", "/musicsMode/musics.html");
  window._currentUser = { id: 1 };

  listSpy = vi.fn().mockResolvedValue({
    friends: [
      { friend_id: 2, pseudo: "Ann", friend_code: "AAA", avatar_data: null, expert_unlocked: true },
      { friend_id: 3, pseudo: "Ryuji", friend_code: "BBB", avatar_data: null, expert_unlocked: false },
    ],
  });
  window._personadleApi = {
    friends: { list: listSpy },
    messages: { send: vi.fn().mockResolvedValue({}) },
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  delete window._currentUser;
  delete window._personadleApi;
  vi.restoreAllMocks();
});

describe("modale de défi — mode normal", () => {
  it("ne demande PAS l'état de déblocage et propose tous les amis", () => {
    // Le calcul coûte ~2 requêtes par ami côté serveur : inutile hors Expert.
    showChallengeButton("music", 3, ["A", "B"]);
    return openModal().then(() => {
      expect(listSpy).toHaveBeenCalledWith();
      const rows = document.querySelectorAll(".challenge-friend-row");
      expect(rows).toHaveLength(2);
      expect(document.querySelector(".challenge-card--expert")).toBeNull();
    });
  });
});

describe("modale de défi — Mode Expert", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/musicsMode/musics.html?expert=1");
  });

  it("demande l'état de déblocage pour le mode courant", () => {
    showChallengeButton("music", 3, ["A", "B"]);
    return openModal().then(() => {
      expect(listSpy).toHaveBeenCalledWith({ expert_mode: "music" });
    });
  });

  it("ne propose que les amis ayant débloqué ce Mode Expert", () => {
    showChallengeButton("music", 3, ["A", "B"]);
    return openModal().then(() => {
      const pseudos = [...document.querySelectorAll(".challenge-friend-row__pseudo")].map(
        (el) => el.textContent
      );
      expect(pseudos).toEqual(["Ann"]);
    });
  });

  it("porte l'habillage sombre et le texte explicatif", () => {
    // Sans l'explication, la liste plus courte donnerait l'impression d'avoir
    // perdu des amis.
    showChallengeButton("music", 3, ["A", "B"]);
    return openModal().then(() => {
      expect(document.querySelector(".challenge-card--expert")).not.toBeNull();
      expect(document.querySelector(".challenge-overlay--expert")).not.toBeNull();
      expect(document.querySelector(".challenge-card__note")?.textContent?.trim()).toBeTruthy();
    });
  });

  it("affiche un message dédié quand aucun ami n'est éligible", () => {
    listSpy.mockResolvedValue({
      friends: [
        { friend_id: 3, pseudo: "Ryuji", friend_code: "BBB", avatar_data: null, expert_unlocked: false },
      ],
    });
    showChallengeButton("music", 3, ["A", "B"]);
    return openModal().then(() => {
      expect(document.querySelectorAll(".challenge-friend-row")).toHaveLength(0);
      expect(document.querySelector(".challenge-card__empty")?.textContent?.trim()).toBeTruthy();
    });
  });

  it("ne filtre pas si le backend ne renvoie pas encore le champ", () => {
    // Compat ascendante : `expert_unlocked` absent ne doit pas vider la liste.
    // Le serveur refusera l'envoi de toute façon — mieux vaut un refus explicite
    // qu'une modale vide et inexplicable.
    listSpy.mockResolvedValue({
      friends: [
        { friend_id: 2, pseudo: "Ann", friend_code: "AAA", avatar_data: null },
        { friend_id: 3, pseudo: "Ryuji", friend_code: "BBB", avatar_data: null },
      ],
    });
    showChallengeButton("music", 3, ["A", "B"]);
    return openModal().then(() => {
      expect(document.querySelectorAll(".challenge-friend-row")).toHaveLength(2);
    });
  });
});
