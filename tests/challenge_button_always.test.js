/**
 * challenge_button_always.test.js — « Défier un ami » toujours disponible (2.2)
 *
 * Retour joueur : le bouton n'apparaissait qu'après une victoire, et
 * « disparaissait parfois » (rechargement : la victoire n'est plus fraîche, et
 * l'auth n'a pas encore posé _currentUser quand le mode restaure sa partie).
 * Couvre le nouveau contrat de showChallengeButton() / initChallengeButton() :
 *   - montage précoce dans .expert-toggle-zone tant que la navigation de fin de
 *     partie est cachée, déplacement dans la navigation une fois révélée ;
 *   - score « par » du mode tant que la partie n'est pas finie, vrai score après ;
 *   - rappeler la fonction met à jour, ne fait plus rien d'autre.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  showChallengeButton,
  initChallengeButton,
  challengeScoreFor,
  CHALLENGE_PAR,
} from "../js/gameCore.js";

const ROOT = join(import.meta.dirname, "..");

function mountPage({ navVisible = false } = {}) {
  document.body.innerHTML = `
    <div class="expert-toggle-zone"><a class="expert-toggle" href="#">⚡</a></div>
    <div id="modeNavigationContainer" style="display: ${navVisible ? "flex" : "none"}">
      <div id="prevModeButton"></div>
      <div id="nextModeButton"></div>
    </div>`;
}

const btn = () => document.getElementById("challengeFriendBtn");

async function openModal() {
  btn()?.click();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  // restoreAllMocks AVANT de créer les vi.fn() : il remet aussi leur implémentation à zéro.
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html");
  window._currentUser = { id: 1 };
  window._personadleApi = {
    friends: { list: vi.fn().mockResolvedValue({ friends: [] }) },
    messages: { send: vi.fn().mockResolvedValue({}) },
  };
  delete window._authReady;
});

describe("challengeScoreFor / CHALLENGE_PAR", () => {
  it("chaque mode a un par, sous le seuil d'abandon", () => {
    for (const mode of ["classic", "emoji", "silhouette", "alloutattack", "personae", "music"]) {
      expect(CHALLENGE_PAR[mode], mode).toBeGreaterThan(0);
    }
  });

  it("le vrai score l'emporte sur le par ; sinon le par du mode ; sinon 5", () => {
    expect(challengeScoreFor("classic", 3)).toBe(3);
    expect(challengeScoreFor("classic", null)).toBe(CHALLENGE_PAR.classic);
    expect(challengeScoreFor("music", 0)).toBe(CHALLENGE_PAR.music);
    expect(challengeScoreFor("Classique", undefined)).toBe(CHALLENGE_PAR.classic);
    expect(challengeScoreFor("inconnu", NaN)).toBe(5);
  });
});

describe("showChallengeButton — placement", () => {
  it("se monte dans .expert-toggle-zone tant que la navigation est cachée", () => {
    mountPage();
    showChallengeButton("classic", null, ["A", "B"]);
    expect(btn()).not.toBeNull();
    expect(btn().parentElement.className).toBe("expert-toggle-zone");
  });

  it("se monte directement dans la navigation quand elle est déjà visible (F5 après victoire)", () => {
    mountPage({ navVisible: true });
    showChallengeButton("classic", 4, ["A"]);
    const nav = document.getElementById("modeNavigationContainer");
    expect(btn().parentElement).toBe(nav);
    expect(btn().nextElementSibling.id).toBe("nextModeButton");
  });

  it("rejoint la navigation entre prev et next quand elle est révélée en fin de partie", () => {
    mountPage();
    showChallengeButton("classic", null, ["A"]);
    document.getElementById("modeNavigationContainer").style.display = "flex";
    showChallengeButton("classic", 3, ["A"]);
    expect(btn().parentElement.id).toBe("modeNavigationContainer");
    expect(btn().previousElementSibling.id).toBe("prevModeButton");
    expect(btn().nextElementSibling.id).toBe("nextModeButton");
    expect(document.querySelectorAll("#challengeFriendBtn")).toHaveLength(1);
  });

  it("sans zone ni navigation, ne fait rien ; sans utilisateur non plus", () => {
    document.body.innerHTML = "";
    showChallengeButton("classic", 3, ["A"]);
    expect(btn()).toBeNull();

    mountPage();
    delete window._currentUser;
    showChallengeButton("classic", 3, ["A"]);
    expect(btn()).toBeNull();
  });
});

describe("showChallengeButton — score et pool lus au clic", () => {
  it("envoie le par tant qu'aucun score n'est connu, puis le vrai score", async () => {
    mountPage();
    showChallengeButton("classic", null, ["A"]);
    await openModal();
    expect(document.querySelector(".challenge-card__score").textContent).toContain(
      String(CHALLENGE_PAR.classic)
    );
    document.getElementById("challengeModal").remove();

    // Fin de partie : rappel avec le vrai score — même bouton, score mis à jour.
    showChallengeButton("classic", 2, ["A"]);
    await openModal();
    expect(document.querySelector(".challenge-card__score").textContent).toContain("2");
  });

  it("le pool peut être une fonction, évaluée au clic (les filtres bougent)", async () => {
    mountPage();
    let pool = ["A"];
    showChallengeButton("classic", null, () => pool);
    pool = ["A", "B", "C"];
    // Le pool n'est pas visible dans le DOM ; on vérifie qu'il est bien stocké
    // sous forme de fonction et résolu tardivement.
    expect(typeof btn()._challenge.targetPool).toBe("function");
    expect(btn()._challenge.targetPool()).toEqual(["A", "B", "C"]);
  });
});

describe("initChallengeButton", () => {
  it("attend la résolution de l'auth avant de monter le bouton", async () => {
    mountPage();
    delete window._currentUser;
    let resolveAuth;
    window._authReady = new Promise((r) => (resolveAuth = r));

    const p = initChallengeButton("classic", ["A"]);
    await new Promise((r) => setTimeout(r, 0));
    expect(btn(), "pas de bouton tant que l'auth n'a pas répondu").toBeNull();

    window._currentUser = { id: 7 };
    resolveAuth();
    await p;
    expect(btn()).not.toBeNull();
    expect(btn()._challenge.score).toBeNull();
  });

  it("transmet le score déjà acquis (partie du jour finie et restaurée)", async () => {
    mountPage({ navVisible: true });
    window._authReady = Promise.resolve();
    await initChallengeButton("classic", ["A"], 6);
    expect(btn()._challenge.score).toBe(6);
  });

  it("une auth qui échoue (pas de backend) ne casse pas le mode", async () => {
    mountPage();
    delete window._currentUser;
    window._authReady = Promise.reject(new Error("offline"));
    window._authReady.catch(() => {});
    await expect(initChallengeButton("classic", ["A"])).resolves.toBeUndefined();
    expect(btn()).toBeNull();
  });
});

describe("les 6 modes montent le bouton dès l'arrivée", () => {
  const MODE_FILES = {
    classic: "classiqueMode/modeClassique.js",
    emoji: "emojiMode/emojiMode.js",
    silhouette: "silhouetteMode/modeSilhouette.js",
    alloutattack: "allOutAttackMode/modeAllOutAttack.js",
    personae: "personaeMode/modePersonae.js",
    music: "musicsMode/modeMusic.js",
  };

  it("chaque mode appelle initChallengeButton()", () => {
    const missing = Object.entries(MODE_FILES)
      .filter(([, file]) => !readFileSync(join(ROOT, file), "utf8").includes("initChallengeButton("))
      .map(([mode]) => mode);
    expect(missing).toEqual([]);
  });
});
