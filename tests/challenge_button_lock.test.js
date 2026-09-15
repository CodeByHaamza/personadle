/**
 * challenge_button_lock.test.js — « Défier un ami » : visible dès l'arrivée,
 * verrouillé tant que la partie du jour n'est pas finie (2.2)
 *
 * Retour joueur : le bouton n'apparaissait qu'après une victoire, et
 * « disparaissait parfois » (rechargement : la victoire n'est plus fraîche, et
 * l'auth n'a pas encore posé _currentUser quand le mode restaure sa partie).
 * Décision Hamza (2026-09-13) : il est là tout de suite, mais **verrouillé**
 * jusqu'à la fin de la partie — un défi porte toujours un vrai score, jamais un
 * score de référence. Contrat de showChallengeButton() / initChallengeButton() :
 *   - montage précoce dans .expert-toggle-zone tant que la navigation de fin de
 *     partie est cachée, déplacement dans la navigation une fois révélée ;
 *   - verrouillé (grisé, message au clic) sans score, déverrouillé avec ;
 *   - rappeler la fonction met à jour, ne fait plus rien d'autre ;
 *   - ?challenge=<ami> sur une partie non finie attend la fin, puis ouvre la
 *     modale sur cet ami.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  showChallengeButton,
  initChallengeButton,
  challengeScoreFor,
  isChallengeLocked,
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

describe("challengeScoreFor / isChallengeLocked", () => {
  it("un vrai score passe tel quel ; sans score, pas de par : null et verrouillé", () => {
    expect(challengeScoreFor(3)).toBe(3);
    expect(challengeScoreFor(null)).toBeNull();
    expect(challengeScoreFor(0)).toBeNull();
    expect(challengeScoreFor(undefined)).toBeNull();
    expect(challengeScoreFor(NaN)).toBeNull();
    expect(isChallengeLocked(null)).toBe(true);
    expect(isChallengeLocked(4)).toBe(false);
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

describe("showChallengeButton — verrou, score et pool lus au clic", () => {
  it("sans score : verrouillé, le clic montre le message et n'ouvre rien", async () => {
    mountPage();
    showChallengeButton("classic", null, ["A"]);
    expect(btn().classList.contains("btn-challenge--locked")).toBe(true);
    expect(btn().getAttribute("aria-disabled")).toBe("true");
    expect(btn().title).toContain("Finish today's game");
    await openModal();
    expect(document.getElementById("challengeModal")).toBeNull();
    const hint = btn().querySelector(".btn-challenge__hint");
    expect(hint?.classList.contains("btn-challenge__hint--show")).toBe(true);
    expect(hint.textContent).toContain("Finish today's game");
  });

  it("fin de partie : rappel avec le vrai score — même bouton, déverrouillé, score dans la modale", async () => {
    mountPage();
    showChallengeButton("classic", null, ["A"]);
    showChallengeButton("classic", 2, ["A"]);
    expect(btn().classList.contains("btn-challenge--locked")).toBe(false);
    expect(btn().getAttribute("aria-disabled")).toBe("false");
    expect(btn().hasAttribute("title")).toBe(false);
    await openModal();
    expect(document.querySelector(".challenge-card__score").textContent).toContain("2");
    expect(document.querySelectorAll("#challengeFriendBtn")).toHaveLength(1);
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

  it("?challenge=<ami> sur une partie non finie : message, puis la modale s'ouvre seule à la fin", async () => {
    mountPage();
    window.history.replaceState({}, "", "/classiqueMode/classiqueMode.html?challenge=2");
    window._authReady = Promise.resolve();
    window._personadleApi.friends.list.mockResolvedValue({
      friends: [{ friend_id: 2, pseudo: "Ann", friend_code: "AAA", avatar_data: null }],
    });
    await initChallengeButton("classic", ["A"], null);
    expect(window.location.search, "le paramètre est consommé").toBe("");
    expect(document.getElementById("challengeModal"), "pas de modale sans score").toBeNull();
    expect(btn().querySelector(".btn-challenge__hint--show")).not.toBeNull();

    showChallengeButton("classic", 3, ["A"]);
    await new Promise((r) => setTimeout(r, 0));
    const modal = document.getElementById("challengeModal");
    expect(modal, "la fin de partie ouvre la modale sur l'ami présélectionné").not.toBeNull();
    await vi.waitFor(() =>
      expect(modal.querySelector(".challenge-friend-row--preselected")).not.toBeNull()
    );
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

describe("les 6 modes montent le bouton dès l'arrivée (verrouillé)", () => {
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

describe("filtres transmis avec le défi", () => {
  it("prend la liste EFFECTIVE de filterMenu quand elle est enregistrée, même sans localStorage", async () => {
    // Joueur qui n'a jamais touché ses filtres : localStorage vide (= tout actif),
    // filterMenu tient la vraie liste en mémoire. Avant : `[]` partait au
    // destinataire, qui gardait ses propres filtres.
    const { registerActiveFilters } = await import("../js/gameCore.js");
    localStorage.removeItem("filters_Classic");
    registerActiveFilters("filters_Classic", () => ["P3", "P4", "P5"]);
    window._personadleApi.friends.list.mockResolvedValue({
      friends: [{ friend_id: 2, pseudo: "Ann", friend_code: "AAA", avatar_data: null }],
    });

    mountPage();
    showChallengeButton("classic", 4, ["A", "B"]);
    await openModal();
    document.querySelector('.js-send-challenge[data-fid="2"]').click();
    await vi.waitFor(() => expect(window._personadleApi.messages.send).toHaveBeenCalledTimes(1));

    const payload = window._personadleApi.messages.send.mock.calls[0][0];
    expect(JSON.parse(payload.challenge_filters)).toEqual(["P3", "P4", "P5"]);
    expect(payload.challenge_score).toBe(4);
    expect(["A", "B"]).toContain(payload.challenge_target);
    registerActiveFilters("filters_Classic", null);
  });

  it("sans fournisseur, lit localStorage comme avant", async () => {
    localStorage.setItem("filters_Classic", JSON.stringify(["P5"]));
    window._personadleApi.friends.list.mockResolvedValue({
      friends: [{ friend_id: 2, pseudo: "Ann", friend_code: "AAA", avatar_data: null }],
    });
    mountPage();
    showChallengeButton("classic", 3, ["A"]);
    await openModal();
    document.querySelector('.js-send-challenge[data-fid="2"]').click();
    await vi.waitFor(() => expect(window._personadleApi.messages.send).toHaveBeenCalledTimes(1));
    expect(JSON.parse(window._personadleApi.messages.send.mock.calls[0][0].challenge_filters)).toEqual(["P5"]);
    localStorage.removeItem("filters_Classic");
  });
});
