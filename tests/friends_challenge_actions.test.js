/**
 * friends_challenge_actions.test.js — Les quatre gestes sur un défi depuis la
 * Boîte de la page Amis (profile/friends/friends.js) : Accepter, Refuser,
 * Reprendre, Abandonner — conduits par les VRAIS boutons que la page rend à
 * partir de la réponse de /api/messages, cliqués comme un joueur le ferait.
 *
 * friends_tabs.test.js couvre l'installation de la case locale ; ce fichier
 * couvre l'orchestration autour : ordre des écritures (rien en local tant que le
 * serveur n'a pas dit oui), la garde « un seul défi par dimension », Reprendre
 * depuis un autre appareil, l'abandon quand le local ne connaît pas le défi, et
 * ce que chaque geste laisse en base et en localStorage.
 *
 * La page est amorcée UNE fois (DOMContentLoaded) : sa délégation de clic vit sur
 * `document`, la réimporter à chaque test empilerait les écouteurs — c'est
 * exactement le piège que CLAUDE.md §4 documente.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import {
  FILTER_STORAGE_KEYS,
  activeChallengeKey,
  parisDateKey,
  readActiveChallenge,
} from "../js/gameCore.js";

vi.mock("../js/social-link.js", () => ({
  addFlameIfPlayedToday: vi.fn(),
  gainSocialLinkXp: vi.fn().mockResolvedValue(undefined),
  applyRank10Effect: vi.fn(),
}));

const ME = 1;
const FRIEND = 7;

let api;
let navigatedTo = null;
let socialLink;

/** Message « défi » tel que /api/messages le renvoie. */
function challengeMsg(overrides = {}) {
  return {
    id: 42,
    type: "challenge",
    sender_id: FRIEND,
    receiver_id: ME,
    status: "unread",
    challenge_mode: "classic",
    challenge_score: 3,
    challenge_date: "2026-09-14",
    challenge_filters: '["P4"]',
    challenge_target: "Yu Narukami",
    challenge_is_expert: 0,
    created_at: new Date().toISOString(),
    sender: { pseudo: "Yosuke", avatar: null },
    receiver: { pseudo: "Me", avatar: null },
    ...overrides,
  };
}

function mountPage() {
  document.body.innerHTML = `
    <div id="friendsConnected" class="hidden">
      <nav class="fr-tabs">
        <button class="fr-tab active" data-tab="friends"><span id="tabFriendsBadge" class="hidden"></span></button>
        <button class="fr-tab" data-tab="inbox"><span id="tabInboxBadge" class="hidden"></span></button>
        <button class="fr-tab" data-tab="find"></button>
      </nav>
      <div class="fr-tab-panel" data-tab-panel="friends">
        <div id="friendsList"></div><span id="friendsCount"></span>
        <div id="pendingSection" class="hidden"><div id="pendingList"></div></div>
      </div>
      <div class="fr-tab-panel hidden" data-tab-panel="inbox">
        <div id="messagesSection"><span id="unreadCount" class="hidden"></span><div id="messagesList"></div></div>
      </div>
      <div class="fr-tab-panel hidden" data-tab-panel="find"><input id="browseSearch" /></div>
    </div>
    <div id="friendsGuest"></div>`;
}

/** Relance le rendu de la Boîte avec ces messages (via le PATCH → loadMessages, ou l'init). */
async function renderInbox(messages) {
  api.messages.list.mockResolvedValue({ messages });
  // La page recharge la Boîte après chaque geste ; pour l'état initial on passe
  // par un geste neutre : un « Mark read » sur un message absent recharge la liste.
  document.body.insertAdjacentHTML(
    "beforeend",
    '<button id="__reload" class="js-mark-read" data-mid="999999"></button>'
  );
  document.getElementById("__reload").click();
  await flush();
  document.getElementById("__reload")?.remove();
  api.messages.updateStatus.mockClear();
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function clickAnd(selector) {
  const btn = document.querySelector(selector);
  expect(btn, `bouton ${selector} attendu dans la Boîte`).toBeTruthy();
  btn.click();
  return flush();
}

const slot = (isExpert = false) =>
  JSON.parse(localStorage.getItem(activeChallengeKey(isExpert)) || "null");

beforeAll(async () => {
  window.history.replaceState({}, "", "/profile/friends/friends.html");
  delete window.location;
  window.location = { pathname: "/profile/friends/friends.html", search: "", hash: "" };
  Object.defineProperty(window.location, "href", {
    configurable: true,
    get: () => navigatedTo,
    set: (v) => {
      navigatedTo = v;
    },
  });

  api = {
    friends: { list: vi.fn().mockResolvedValue({ friends: [], pending_requests: [] }) },
    messages: {
      list: vi.fn().mockResolvedValue({ messages: [] }),
      updateStatus: vi.fn().mockResolvedValue({ updated: true }),
    },
    notifications: { markSeen: vi.fn().mockResolvedValue({}) },
    // fetchExpertStatus() met la réponse en cache pour toute la vie du module
    // (une page = un appel) : un seul statut pour tout le fichier — Classique
    // débloqué, Émoji non.
    user: {
      expertStatus: vi.fn().mockResolvedValue({
        expert_status: { classic: { unlocked: true }, emoji: { unlocked: false } },
      }),
    },
  };
  window._personadleApi = api;
  window._currentUser = { id: ME, pseudo: "Me" };
  window.showToast = vi.fn();
  window.confirm = vi.fn(() => true);
  window.alert = vi.fn();

  mountPage();
  socialLink = await import("../js/social-link.js");
  await import("../profile/friends/friends.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
  await flush();
});

beforeEach(() => {
  localStorage.clear();
  navigatedTo = null;
  api.messages.updateStatus.mockReset().mockResolvedValue({ updated: true });
  window.showToast.mockClear();
  window.alert.mockClear();
  window.confirm.mockClear().mockReturnValue(true);
  socialLink.gainSocialLinkXp.mockClear();
});

afterEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Accepter depuis la Boîte", () => {
  it("serveur d'abord, local ensuite, puis redirection vers la page du mode avec la cible", async () => {
    await renderInbox([challengeMsg()]);
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P3"]');

    await clickAnd(".js-accept-challenge");

    expect(api.messages.updateStatus).toHaveBeenCalledWith(42, "accepted");
    expect(slot()).toMatchObject({
      msgId: 42,
      mode: "classic",
      date: parisDateKey(),
      challengeDate: "2026-09-14",
      score: 3,
      senderId: FRIEND,
      target: "Yu Narukami",
      originalFilters: '["P3"]',
      isExpert: false,
    });
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P4"]');
    expect(socialLink.gainSocialLinkXp).toHaveBeenCalledWith(FRIEND, "challenge");
    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html");
  });

  it("le serveur refuse : rien n'est écrit en local, pas de redirection, le bouton se rouvre", async () => {
    await renderInbox([challengeMsg()]);
    api.messages.updateStatus.mockRejectedValue(Object.assign(new Error("409"), { status: 409 }));

    await clickAnd(".js-accept-challenge");

    expect(slot()).toBeNull();
    expect(navigatedTo).toBeNull();
    expect(socialLink.gainSocialLinkXp).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalled();
    expect(document.querySelector(".js-accept-challenge").disabled).toBe(false);
  });

  it("un autre défi de la MÊME dimension est en cours : refus immédiat, sans appel serveur", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({ msgId: 1, mode: "emoji", date: parisDateKey(), score: 2, isExpert: false })
    );
    await renderInbox([challengeMsg()]);

    await clickAnd(".js-accept-challenge");

    expect(api.messages.updateStatus).not.toHaveBeenCalled();
    expect(slot().msgId).toBe(1); // intact
    expect(navigatedTo).toBeNull();
    expect(window.showToast).toHaveBeenCalledWith(expect.stringContaining("Emoji"));
  });

  it("un défi de l'AUTRE dimension en cours ne bloque pas", async () => {
    localStorage.setItem(
      activeChallengeKey(true),
      JSON.stringify({ msgId: 1, mode: "emoji", date: parisDateKey(), score: 2, isExpert: true })
    );
    await renderInbox([challengeMsg()]);

    await clickAnd(".js-accept-challenge");

    expect(api.messages.updateStatus).toHaveBeenCalledWith(42, "accepted");
    expect(slot(false).msgId).toBe(42);
    expect(slot(true).msgId).toBe(1);
  });

  it("un défi en cours de la VEILLE ne bloque plus, et ses filtres sont rendus avant d'accepter", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({
        msgId: 1,
        mode: "classic",
        date: "2020-01-01",
        score: 2,
        isExpert: false,
        filterKey: FILTER_STORAGE_KEYS.classic,
        originalFilters: '["P3","P5"]',
        target: "Kanji Tatsumi",
      })
    );
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P1"]');
    await renderInbox([challengeMsg()]);

    await clickAnd(".js-accept-challenge");

    expect(api.messages.updateStatus).toHaveBeenCalledWith(42, "accepted");
    expect(slot().msgId).toBe(42);
    expect(slot().originalFilters).toBe('["P3","P5"]');
  });

  it("défi Expert sur un mode que je n'ai pas débloqué : refusé avant tout appel serveur", async () => {
    await renderInbox([challengeMsg({ challenge_is_expert: 1, challenge_mode: "emoji" })]);

    await clickAnd(".js-accept-challenge");

    expect(api.messages.updateStatus).not.toHaveBeenCalled();
    expect(slot(true)).toBeNull();
    expect(navigatedTo).toBeNull();
    expect(window.alert).toHaveBeenCalled();
  });

  it("défi Expert débloqué : case Expert, XP Expert, page Expert", async () => {
    await renderInbox([challengeMsg({ challenge_is_expert: 1 })]);

    await clickAnd(".js-accept-challenge");

    expect(slot(true)).toMatchObject({ msgId: 42, isExpert: true });
    expect(slot(false)).toBeNull();
    expect(socialLink.gainSocialLinkXp).toHaveBeenCalledWith(FRIEND, "challenge_expert");
    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html?expert=1");
  });

  it("un double clic ne déclenche qu'une acceptation", async () => {
    await renderInbox([challengeMsg()]);
    const btn = document.querySelector(".js-accept-challenge");
    btn.click();
    btn.click();
    await flush();

    expect(api.messages.updateStatus).toHaveBeenCalledTimes(1);
  });
});

describe("Refuser depuis la Boîte", () => {
  it("passe le message en read, rien en local", async () => {
    await renderInbox([challengeMsg()]);

    await clickAnd(".js-decline-msg");

    expect(api.messages.updateStatus).toHaveBeenCalledWith(42, "read");
    expect(slot()).toBeNull();
    expect(navigatedTo).toBeNull();
  });
});

describe("Reprendre un défi accepté", () => {
  const accepted = (over = {}) => challengeMsg({ status: "accepted", ...over });

  it("sur l'appareil où il a été accepté : redirige sans réécrire la case", async () => {
    const existing = {
      msgId: 42,
      mode: "classic",
      date: parisDateKey(),
      score: 3,
      senderId: FRIEND,
      filterKey: FILTER_STORAGE_KEYS.classic,
      originalFilters: '["P3"]',
      isExpert: false,
      target: "Yu Narukami",
    };
    localStorage.setItem(activeChallengeKey(false), JSON.stringify(existing));
    await renderInbox([accepted()]);

    await clickAnd(".js-resume-challenge");

    expect(api.messages.updateStatus).not.toHaveBeenCalled();
    expect(slot()).toEqual(existing);
    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html");
  });

  it("depuis un AUTRE appareil (aucune case locale) : reconstruit la case depuis le message", async () => {
    await renderInbox([accepted()]);

    await clickAnd(".js-resume-challenge");

    expect(api.messages.updateStatus).not.toHaveBeenCalled(); // le serveur est déjà à accepted
    expect(slot()).toMatchObject({
      msgId: 42,
      mode: "classic",
      date: parisDateKey(),
      score: 3,
      target: "Yu Narukami",
      isExpert: false,
    });
    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html");
  });

  it("case locale de la VEILLE pour ce même défi : reconstruite pour aujourd'hui", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({ msgId: 42, mode: "classic", date: "2020-01-01", score: 3, isExpert: false })
    );
    await renderInbox([accepted()]);

    await clickAnd(".js-resume-challenge");

    expect(slot().date).toBe(parisDateKey());
    expect(readActiveChallenge(false)?.msgId).toBe(42);
  });

  it("un AUTRE défi de la même dimension est en cours : on ne l'écrase pas", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({ msgId: 1, mode: "emoji", date: parisDateKey(), score: 2, isExpert: false })
    );
    await renderInbox([accepted()]);

    await clickAnd(".js-resume-challenge");

    expect(slot().msgId).toBe(1);
    expect(navigatedTo).toBeNull();
    expect(window.showToast).toHaveBeenCalled();
  });

  it("défi Expert : reconstruit dans la case Expert et mène à la page Expert", async () => {
    await renderInbox([accepted({ challenge_is_expert: 1 })]);

    await clickAnd(".js-resume-challenge");

    expect(slot(true)).toMatchObject({ msgId: 42, isExpert: true });
    expect(navigatedTo).toBe("../../classiqueMode/classiqueMode.html?expert=1");
  });
});

describe("Abandonner depuis la Boîte", () => {
  const accepted = (over = {}) => challengeMsg({ status: "accepted", ...over });

  it("attend la confirmation, passe en read, libère la case et rend les filtres", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({
        msgId: 42,
        mode: "classic",
        date: parisDateKey(),
        score: 3,
        isExpert: false,
        filterKey: FILTER_STORAGE_KEYS.classic,
        originalFilters: '["P3"]',
        target: "Yu Narukami",
      })
    );
    localStorage.setItem(FILTER_STORAGE_KEYS.classic, '["P4"]');
    localStorage.setItem("target", '{"nom":"Yu Narukami"}');
    await renderInbox([accepted()]);

    await clickAnd(".js-abandon-challenge");

    expect(window.confirm).toHaveBeenCalled();
    expect(api.messages.updateStatus).toHaveBeenCalledWith(42, "read");
    expect(slot()).toBeNull();
    expect(localStorage.getItem(FILTER_STORAGE_KEYS.classic)).toBe('["P3"]');
    expect(localStorage.getItem("target")).toBeNull();
    expect(navigatedTo).toBeNull();
  });

  it("le joueur annule la confirmation : rien ne bouge", async () => {
    window.confirm.mockReturnValue(false);
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({
        msgId: 42,
        mode: "classic",
        date: parisDateKey(),
        score: 3,
        isExpert: false,
      })
    );
    await renderInbox([accepted()]);

    await clickAnd(".js-abandon-challenge");

    expect(api.messages.updateStatus).not.toHaveBeenCalled();
    expect(slot().msgId).toBe(42);
  });

  it("le serveur refuse : la case reste, le bouton se rouvre (pas de divergence local/serveur)", async () => {
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({
        msgId: 42,
        mode: "classic",
        date: parisDateKey(),
        score: 3,
        isExpert: false,
      })
    );
    await renderInbox([accepted()]);
    api.messages.updateStatus.mockRejectedValue(new Error("Failed to fetch"));

    await clickAnd(".js-abandon-challenge");

    expect(slot().msgId).toBe(42);
    expect(window.alert).toHaveBeenCalled();
    expect(document.querySelector(".js-abandon-challenge").disabled).toBe(false);
  });

  it("depuis un autre appareil (pas de case locale) : le serveur passe en read, le local n'est pas touché", async () => {
    // Un AUTRE défi de la même dimension vit sur cet appareil : il ne doit pas
    // être libéré par l'abandon d'un défi que ce navigateur ne connaît pas.
    localStorage.setItem(
      activeChallengeKey(false),
      JSON.stringify({ msgId: 1, mode: "emoji", date: parisDateKey(), score: 2, isExpert: false })
    );
    await renderInbox([accepted()]);

    await clickAnd(".js-abandon-challenge");

    expect(api.messages.updateStatus).toHaveBeenCalledWith(42, "read");
    expect(slot().msgId).toBe(1);
  });
});

describe("ce que la Boîte affiche", () => {
  it("un défi non lu : Accepter + Refuser ; accepté : Reprendre + Abandonner ; terminé : aucun bouton", async () => {
    await renderInbox([
      challengeMsg({ id: 1, status: "unread" }),
      challengeMsg({ id: 2, status: "accepted" }),
      challengeMsg({ id: 3, status: "beaten" }),
      challengeMsg({ id: 4, status: "expired" }),
    ]);

    // Seuls les boutons d'ACTION comptent (le ✕ de suppression et le conteneur
    // de ligne portent aussi data-mid).
    const buttonsOf = (id) =>
      [...document.querySelectorAll(`.fr-msg-actions [data-mid="${id}"]`)].map((b) =>
        [...b.classList].find((c) => c.startsWith("js-"))
      );
    expect(buttonsOf(1)).toEqual(["js-accept-challenge", "js-decline-msg"]);
    expect(buttonsOf(2)).toEqual(["js-resume-challenge", "js-abandon-challenge"]);
    expect(buttonsOf(3)).toEqual([]);
    expect(buttonsOf(4)).toEqual([]);
  });

  it("le compteur de non-lus ne compte que les messages REÇUS non lus", async () => {
    await renderInbox([
      challengeMsg({ id: 1, status: "unread" }),
      challengeMsg({ id: 2, status: "unread", sender_id: ME, receiver_id: FRIEND }),
      challengeMsg({ id: 3, status: "accepted" }),
    ]);
    expect(document.getElementById("unreadCount").textContent).toBe("1");
  });
});
