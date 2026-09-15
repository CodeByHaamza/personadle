/**
 * friends_today.test.js — « Comparer nos parties » (2.2)
 *
 * Deux moitiés : côté envoi, la session porte la suite ordonnée des essais
 * (journal rattaché à l'identifiant de partie, donc vidé par un Replay et
 * retrouvé après un rechargement) ; côté affichage, un bouton 👥 jumeau de
 * ⚔ Défier (même hôte, même verrou) ouvre une fenêtre qui rend la première
 * partie du jour de chaque ami, avec le bon essai en vert, et qui explique
 * « finis ta partie » tant que le serveur répond « play_first ».
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  logGuess,
  readGuessLog,
  startGame,
  checkResetOnLoad,
  buildGameSession,
  showWrongMini,
  showCommunityStats,
  renderFriendsToday,
  openFriendsGamesModal,
  showChallengeButton,
  parisDateKey,
} from "../js/gameCore.js";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html");
  window._currentUser = { id: 1 };
  delete window._personadleApi;
  // Portée de la page posée comme le ferait un mode à l'init
  localStorage.setItem("lastPlayedDate_Classic", parisDateKey());
  checkResetOnLoad("lastPlayedDate_Classic", "Classic", () => {});
});

describe("journal des essais", () => {
  it("s'accumule dans l'ordre et survit à un rechargement (même identifiant de partie)", () => {
    logGuess("Yosuke Hanamura");
    logGuess("Kanji Tatsumi");
    expect(readGuessLog("Classic")).toEqual(["Yosuke Hanamura", "Kanji Tatsumi"]);
    // Rechargement simulé : même localStorage, nouvelle lecture
    expect(readGuessLog("Classic")).toEqual(["Yosuke Hanamura", "Kanji Tatsumi"]);
  });

  it("repart de zéro sur un Replay (startGame) — le journal appartient à la partie", () => {
    logGuess("Yosuke Hanamura");
    startGame("Classic");
    expect(readGuessLog("Classic")).toEqual([]);
    logGuess("Chie Satonaka");
    expect(readGuessLog("Classic")).toEqual(["Chie Satonaka"]);
  });

  it("showWrongMini() journalise la mauvaise réponse par son nom", () => {
    const list = document.createElement("div");
    document.body.appendChild(list);
    showWrongMini("../database/portraits/x.webp", "Teddie", list);
    expect(readGuessLog("Classic")).toEqual(["Teddie"]);
    expect(list.querySelectorAll(".wrong-mini")).toHaveLength(1);
  });

  it("buildGameSession() envoie la suite, le bon nom en dernier si gagné, sans doublon", () => {
    logGuess("Yosuke Hanamura");
    const win = buildGameSession({
      mode: "classic",
      targetName: "Yu Narukami",
      result: "win",
      attempts: 2,
    });
    expect(win.guesses).toEqual(["Yosuke Hanamura", "Yu Narukami"]);
    const giveup = buildGameSession({
      mode: "classic",
      targetName: "Yu Narukami",
      result: "giveup",
      attempts: 1,
    });
    expect(giveup.guesses).toEqual(["Yosuke Hanamura"]);
  });

  it("le journal est borné à 40 entrées", () => {
    for (let i = 0; i < 50; i++) logGuess(`P${i}`);
    expect(readGuessLog("Classic")).toHaveLength(40);
  });
});

describe("bouton 👥 Parties des amis — jumeau de ⚔ Défier", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="expert-toggle-zone"></div>
      <div id="modeNavigationContainer" style="display:none"><div id="nextModeButton"></div></div>`;
    window._personadleApi = {
      friends: { list: vi.fn().mockResolvedValue({ friends: [] }) },
      stats: { friendsToday: vi.fn().mockResolvedValue({ friends: [] }) },
    };
  });

  it("se monte juste après ⚔, verrouillé avec lui, et le suit dans la navigation", () => {
    showChallengeButton("classic", null, ["A"]);
    const fb = document.getElementById("friendsGamesBtn");
    expect(fb).not.toBeNull();
    expect(fb.previousElementSibling.id).toBe("challengeFriendBtn");
    expect(fb.classList.contains("btn-challenge--locked")).toBe(true);
    expect(fb.title).toContain("Finish today's game");

    fb.click();
    expect(document.getElementById("friendsGamesModal"), "verrouillé : pas de fenêtre").toBeNull();
    expect(fb.querySelector(".btn-challenge__hint--show").textContent).toContain("friends' games");

    document.getElementById("modeNavigationContainer").style.display = "flex";
    showChallengeButton("classic", 3, ["A"]);
    expect(fb.classList.contains("btn-challenge--locked")).toBe(false);
    expect(fb.parentElement.id).toBe("modeNavigationContainer");
    expect(fb.previousElementSibling.id).toBe("challengeFriendBtn");
    expect(document.querySelectorAll("#friendsGamesBtn")).toHaveLength(1);
  });

  it("déverrouillé : le clic ouvre la fenêtre, ✕ et Échap la ferment", async () => {
    showChallengeButton("classic", 2, ["A"]);
    document.getElementById("friendsGamesBtn").click();
    const modal = document.getElementById("friendsGamesModal");
    expect(modal).not.toBeNull();
    expect(window._personadleApi.stats.friendsToday).toHaveBeenCalledWith({
      mode: "classic",
      expert: false,
    });
    modal.querySelector("#friendsGamesClose").click();
    expect(document.getElementById("friendsGamesModal")).toBeNull();

    openFriendsGamesModal("classic");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("friendsGamesModal")).toBeNull();
  });

  it("showCommunityStats() reste une no-op (les 6 modes l'appellent encore)", async () => {
    document.body.innerHTML = `<div id="victoryBox"></div>`;
    await showCommunityStats("classic", "X");
    expect(document.getElementById("victoryBox").innerHTML).toBe("");
  });
});

describe("renderFriendsToday — la liste", () => {
  const friendsToday = vi.fn();
  let box;
  beforeEach(() => {
    document.body.innerHTML = `<div id="list"></div>`;
    box = document.getElementById("list");
    friendsToday.mockReset();
    window._personadleApi = { stats: { friendsToday } };
  });

  it("rend une ligne par ami : gagné avec ses essais (le bon en vert), abandon, pas encore joué", async () => {
    friendsToday.mockResolvedValue({
      friends: [
        {
          id: 2,
          pseudo: "Futaba",
          avatar_data: null,
          avatar_border_color: "#f80",
          session: {
            result: "win",
            attempts: 2,
            time_ms: 900,
            guesses: ["Yosuke Hanamura", "Yu Narukami"],
          },
        },
        {
          id: 3,
          pseudo: "Naoto",
          avatar_data: "../img/avatar/naoto.webp",
          session: { result: "giveup", attempts: 8, guesses: null },
        },
        { id: 4, pseudo: "Kanji", avatar_data: null, session: null },
      ],
    });
    await renderFriendsToday(box, "Classic");
    expect(friendsToday).toHaveBeenCalledWith({ mode: "classic", expert: false });

    const rows = [...box.querySelectorAll(".friends-today__row")];
    expect(rows).toHaveLength(3);
    expect(rows[0].className).toContain("friends-today__row--win");
    expect(rows[0].querySelector(".friends-today__status").textContent).toContain("2");
    const chips = [...rows[0].querySelectorAll(".friends-today__chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["Yosuke Hanamura", "Yu Narukami"]);
    // Chaque joueur a SON personnage du jour : le bon essai d'un ami est le dernier de sa partie gagnée.
    expect(chips[1].classList.contains("friends-today__chip--ok")).toBe(true);
    expect(chips[0].classList.contains("friends-today__chip--ok")).toBe(false);

    expect(rows[1].className).toContain("friends-today__row--giveup");
    expect(rows[1].querySelector(".friends-today__avatar").getAttribute("src")).toBe(
      "../img/avatar/naoto.webp"
    );
    expect(rows[1].querySelector(".friends-today__chips")).toBeNull();

    expect(rows[2].className).toContain("friends-today__row--pending");
    expect(rows[2].querySelector(".friends-today__status").textContent).toContain(
      "hasn't played yet"
    );
  });

  it("sans ami : invitation ; play_first (403) : « finis ta partie » ; autre erreur : indisponible", async () => {
    friendsToday.mockResolvedValue({ friends: [] });
    await renderFriendsToday(box, "classic");
    expect(box.querySelector(".friends-today__empty").textContent).toContain("Add friends");

    friendsToday.mockRejectedValue(Object.assign(new Error("play_first"), { status: 403 }));
    await renderFriendsToday(box, "classic");
    expect(box.textContent).toContain("Finish today's game");

    friendsToday.mockRejectedValue(new Error("offline"));
    await renderFriendsToday(box, "classic");
    expect(box.textContent).toContain("Unavailable");
  });

  it("Expert : demande la dimension Expert ; invité : ne fait rien", async () => {
    window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html?expert=1");
    friendsToday.mockResolvedValue({ friends: [] });
    await renderFriendsToday(box, "classic");
    expect(friendsToday).toHaveBeenCalledWith({ mode: "classic", expert: true });

    delete window._currentUser;
    friendsToday.mockClear();
    await renderFriendsToday(box, "classic");
    expect(friendsToday).not.toHaveBeenCalled();
  });
});
