/**
 * challengeNotifExpert.test.js — La pop-up de défi entrant DIT-ELLE que le défi
 * est un défi Expert ?
 *
 * Contexte : `challenge_is_expert` (migration 037) traversait toute la chaîne —
 * api/messages → js/notifications.js → js/challenge-notif.js — mais ne pilotait
 * que trois choses invisibles : la page d'arrivée (`?expert=1`), le casier
 * localStorage et le barème d'XP. À l'écran, un défi Expert et un défi normal
 * étaient RIGOUREUSEMENT identiques : même titre, même pastille de mode, mêmes
 * couleurs. Le joueur ne découvrait la dimension qu'une fois arrivé sur la page
 * du mode — après avoir accepté, donc après s'être engagé sur un barème qui n'a
 * rien à voir (un seul indice, 5 à 30 essais contre 3).
 *
 * Ce fichier verrouille les deux moitiés de la réponse :
 *   1. le MARQUEUR — un texte explicite « ⚡ EXPERT », traduisible, présent dans
 *      le DOM. La couleur seule ne se lit ni en daltonisme, ni quand on n'a pas
 *      la variante normale sous les yeux pour comparer ;
 *   2. le CROCHET DE STYLE — la classe `cn--expert` sur l'overlay, qui porte
 *      tout l'écart visuel (css/challenge-notif.css). Elle est testée ici et
 *      pas la couleur elle-même : jsdom ne résout pas les feuilles externes, et
 *      une valeur hexadécimale dans un test ne prouverait rien de plus que sa
 *      propre recopie.
 *
 * Et surtout : que la notification NORMALE n'a rien attrapé au passage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parisDateKey } from "../js/gameCore.js";

// Même précaution que challengeAccept.test.js : challenge-notif.js garde une
// file et un drapeau `_busy` au niveau du module.
let queueChallengeNotifs;

function challenge(overrides = {}) {
  return {
    id: 42,
    senderPseudo: "Yosuke",
    senderAvatar: null,
    mode: "classic",
    score: 3,
    date: parisDateKey(),
    senderId: 7,
    challengeFilters: null,
    challengeTarget: "Yu Narukami",
    ...overrides,
  };
}

/** Affiche la notification et rend l'overlay. */
function show(payload) {
  queueChallengeNotifs([challenge(payload)]);
  const overlay = document.getElementById("cn-overlay");
  expect(overlay, "la notification de défi ne s'est pas affichée").toBeTruthy();
  return overlay;
}

beforeEach(async () => {
  vi.resetModules();
  ({ queueChallengeNotifs } = await import("../js/challenge-notif.js"));

  localStorage.clear();
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/profile/friends/friends.html");
  window._personadleApi = { messages: { updateStatus: vi.fn().mockResolvedValue({ ok: true }) } };
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  delete window._personadleApi;
  delete window.i18n;
  vi.restoreAllMocks();
});

describe("défi Expert — la pop-up le dit", () => {
  it("pose la classe `cn--expert` sur l'overlay", () => {
    const overlay = show({ challengeIsExpert: true });
    expect(overlay.classList.contains("cn--expert")).toBe(true);
  });

  it("affiche un marqueur EXPERT lisible dans la carte", () => {
    show({ challengeIsExpert: true });
    const tag = document.querySelector(".cn-expert-tag");
    expect(tag, "aucun marqueur .cn-expert-tag dans la carte").toBeTruthy();
    expect(tag.textContent).toMatch(/expert/i);
  });

  it("le message d'accroche est celui de l'Expert, pas celui du défi normal", () => {
    show({ challengeIsExpert: true });
    expect(document.querySelector(".cn-message").textContent).toMatch(/expert/i);
  });

  it("le marqueur est traduisible et ne s'affiche jamais comme une clé brute", () => {
    // Le piège CLAUDE.md §5 : t(key) renvoie la CLÉ (truthy) quand elle manque,
    // donc un `??` ne se déclencherait jamais et la pop-up afficherait
    // « challenge.notif_expert_tag » en toutes lettres.
    window.i18n = { t: (k) => k };

    show({ challengeIsExpert: true });

    const tag = document.querySelector(".cn-expert-tag");
    expect(tag.textContent).not.toContain("challenge.notif_expert_tag");
    expect(tag.textContent).toMatch(/expert/i);
    expect(document.querySelector(".cn-message").textContent).not.toContain(
      "challenge.notif_challenges_you"
    );
  });

  it("une traduction fournie est utilisée telle quelle", () => {
    window.i18n = {
      t: (k) =>
        ({
          "challenge.notif_expert_tag": "⚡ ESPERTO",
          "challenge.notif_challenges_you_expert": "ti sfida in Esperto!",
        })[k] ?? k,
    };

    show({ challengeIsExpert: true });

    expect(document.querySelector(".cn-expert-tag").textContent).toContain("ESPERTO");
    expect(document.querySelector(".cn-message").textContent).toContain("ti sfida in Esperto!");
  });
});

describe("défi normal — rien n'a débordé", () => {
  it("ne porte NI la classe Expert NI le marqueur", () => {
    const overlay = show({ challengeIsExpert: false });

    expect(overlay.classList.contains("cn--expert")).toBe(false);
    expect(document.querySelector(".cn-expert-tag")).toBeNull();
  });

  it("le drapeau absent vaut « défi normal » (défauts de l'ancien format)", () => {
    // notifications.js pose toujours challengeIsExpert, mais la pop-up est aussi
    // appelée depuis d'autres surfaces : le défaut du paramètre doit rester false.
    const overlay = show({});

    expect(overlay.classList.contains("cn--expert")).toBe(false);
    expect(document.querySelector(".cn-expert-tag")).toBeNull();
  });

  it("garde son message d'accroche d'origine", () => {
    show({ challengeIsExpert: false });
    expect(document.querySelector(".cn-message").textContent).not.toMatch(/expert/i);
  });

  // La variante Expert est un jeu de surcharges CSS sur un DOM COMMUN. Si elle se
  // met à diverger structurellement, toute évolution de la pop-up normale cesse de
  // la suivre — c'est l'inverse de ce qui est visé.
  //
  // Deux `it` séparés et non une boucle dans un seul : challenge-notif.js garde un
  // drapeau `_busy` au niveau du module, et une notification jamais refermée le
  // laisse à vrai — le second `queueChallengeNotifs()` empilerait sans rendre. Le
  // `vi.resetModules()` du beforeEach est ce qui remet les compteurs à zéro.
  const PARTS = [
    ".cn-avatar",
    ".cn-pseudo",
    ".cn-message",
    ".cn-mode-badge",
    ".cn-score",
    ".cn-btn--accept",
    ".cn-btn--later",
    ".cn-btn--refuse",
    ".cn-close",
  ];

  it("la pop-up normale expose toutes ses parties", () => {
    show({ challengeIsExpert: false });
    for (const sel of PARTS) expect(document.querySelector(sel), `normal: ${sel}`).toBeTruthy();
  });

  it("la pop-up Expert expose exactement les mêmes", () => {
    show({ challengeIsExpert: true });
    for (const sel of PARTS) expect(document.querySelector(sel), `expert: ${sel}`).toBeTruthy();
  });
});
