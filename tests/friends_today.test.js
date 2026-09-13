/**
 * friends_today.test.js — « Comparer nos parties » (2.2)
 *
 * Deux moitiés : côté envoi, la session porte la suite ordonnée des essais
 * (journal rattaché à l'identifiant de partie, donc vidé par un Replay et
 * retrouvé après un rechargement) ; côté affichage, showCommunityStats() rend
 * dans la boîte de victoire la première partie du jour de chaque ami, avec le
 * bon essai en vert, et se tait tant que le serveur répond « play_first ».
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

describe("showCommunityStats — « tes amis aujourd'hui »", () => {
  const friendsToday = vi.fn();
  beforeEach(() => {
    document.body.innerHTML = `<div id="victoryBox"></div>`;
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
        {
          id: 5,
          pseudo: "Rise",
          avatar_data: null,
          session: { result: "win", attempts: 1, guesses: ["Ann Takamaki"] },
        },
        { id: 4, pseudo: "Kanji", avatar_data: null, session: null },
      ],
    });
    await showCommunityStats("Classic", "Yu Narukami");
    expect(friendsToday).toHaveBeenCalledWith({ mode: "classic", expert: false });

    const rows = [...document.querySelectorAll(".friends-today__row")];
    expect(rows).toHaveLength(4);
    // Rise a gagné sur un autre personnage que le mien : son dernier essai est vert quand même
    const rise = rows[2].querySelector(".friends-today__chip");
    expect(rise.textContent).toBe("Ann Takamaki");
    expect(rise.classList.contains("friends-today__chip--ok")).toBe(true);
    expect(rows[0].className).toContain("friends-today__row--win");
    expect(rows[0].querySelector(".friends-today__status").textContent).toContain("2");
    const chips = [...rows[0].querySelectorAll(".friends-today__chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["Yosuke Hanamura", "Yu Narukami"]);
    expect(chips[1].classList.contains("friends-today__chip--ok")).toBe(true);
    expect(chips[0].classList.contains("friends-today__chip--ok")).toBe(false);
    // Chaque joueur a SON personnage du jour : le bon essai d'un ami est le
    // dernier de sa partie gagnée, même s'il diffère de ma cible.
    expect(chips[1].textContent).toBe("Yu Narukami");

    expect(rows[1].className).toContain("friends-today__row--giveup");
    expect(rows[1].querySelector(".friends-today__avatar").getAttribute("src")).toBe(
      "../img/avatar/naoto.webp"
    );
    expect(rows[1].querySelector(".friends-today__chips")).toBeNull();

    expect(rows[3].className).toContain("friends-today__row--pending");
    expect(rows[3].querySelector(".friends-today__status").textContent).toContain(
      "hasn't played yet"
    );
  });

  it("rappelée (mode + savePendingSession) : un seul bloc, rafraîchi", async () => {
    friendsToday.mockResolvedValue({ friends: [{ id: 2, pseudo: "A", session: null }] });
    await showCommunityStats("classic", "X");
    friendsToday.mockResolvedValue({
      friends: [{ id: 2, pseudo: "A", session: { result: "win", attempts: 1, guesses: ["X"] } }],
    });
    await showCommunityStats("classic", "X");
    expect(document.querySelectorAll("#friendsToday")).toHaveLength(1);
    expect(document.querySelector(".friends-today__row--win")).not.toBeNull();
  });

  it("sans ami : message d'invitation ; erreur serveur (play_first, hors ligne) : rien", async () => {
    friendsToday.mockResolvedValue({ friends: [] });
    await showCommunityStats("classic", "X");
    expect(document.querySelector(".friends-today__empty")).not.toBeNull();

    document.body.innerHTML = `<div id="victoryBox"></div>`;
    friendsToday.mockRejectedValue(Object.assign(new Error("play_first"), { status: 403 }));
    await showCommunityStats("classic", "X");
    expect(document.getElementById("friendsToday")).toBeNull();
  });

  it("Expert : demande la dimension Expert ; invité : ne fait rien", async () => {
    window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html?expert=1");
    friendsToday.mockResolvedValue({ friends: [] });
    await showCommunityStats("classic", "X");
    expect(friendsToday).toHaveBeenCalledWith({ mode: "classic", expert: true });

    delete window._currentUser;
    friendsToday.mockClear();
    await showCommunityStats("classic", "X");
    expect(friendsToday).not.toHaveBeenCalled();
  });
});
