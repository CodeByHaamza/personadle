/**
 * notifications_challenges.test.js — Le sondage des défis (js/notifications.js).
 *
 * C'est le module qui décide QUAND et OÙ la pop-up de défi apparaît, et c'est
 * lui qui portait les « parfois pas d'animation » de 2.1 : notification perdue
 * parce que marquée « vue » avant d'être montrée, ou étouffée par un plein écran
 * de résultat. Aucun test ne le couvrait — les modules qu'il orchestre
 * (challenge-notif, challenge-result) le sont, pas leur enchaînement.
 *
 * Ce fichier vérifie, depuis chaque surface du produit (accueil, profil, page
 * de jeu, page Amis) :
 *   - qui reçoit une pop-up, et avec quel contenu ;
 *   - deux défis en même temps → les deux sont poussés, dans l'ordre ;
 *   - un défi montré n'est pas rejoué à chaque sondage sur la même page, mais
 *     revient sur une autre page tant que le joueur n'a pas répondu ;
 *   - un défi explicitement fermé (Plus tard, Refuser, croix) ne revient plus ;
 *   - un résultat de défi affiché à l'écran repousse la pop-up au sondage suivant ;
 *   - l'expéditeur voit le résultat (beaten/expired) UNE fois, jamais l'historique ;
 *   - les statuts que la fin de partie n'a pas pu transmettre sont rejoués avant
 *     toute lecture.
 *
 * Les modules d'animation (calling card, TV, evoker, pop-up de défi, résultat)
 * sont remplacés par des espions : leur rendu a ses propres tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../js/calling-card.js", () => ({ queueCallingCards: vi.fn() }));
vi.mock("../js/tv-friend-anim.js", () => ({ queueTvAnimations: vi.fn() }));
vi.mock("../js/p3-evoker-anim.js", () => ({ queueEvokerAnimations: vi.fn() }));
vi.mock("../js/social-link.js", () => ({ showSocialLinkRankUp: vi.fn() }));
vi.mock("../js/challenge-result.js", () => ({ showSenderChallengeResult: vi.fn() }));
vi.mock("../js/challenge-notif.js", () => {
  let handler = null;
  return {
    queueChallengeNotifs: vi.fn(),
    setChallengeNotifDismissHandler: vi.fn((fn) => {
      handler = fn;
    }),
    // Accès test : simule « le joueur a fermé la notification N ».
    __dismiss: (id) => handler?.(id),
  };
});

const ME = 1;
const FRIEND = 7;

let notifications; // module sous test, réimporté à neuf par test
let challengeNotif; // espions de la pop-up
let challengeResult;
let api;
let mockChannel;

async function triggerRecheck() {
  const [, handler] = mockChannel.bind.mock.calls[0];
  handler();
  await vi.runAllTimersAsync();
}

/** Un message « défi » tel que /api/messages le renvoie. */
function msg(overrides = {}) {
  return {
    id: 100,
    type: "challenge",
    sender_id: FRIEND,
    receiver_id: ME,
    status: "unread",
    challenge_mode: "classic",
    challenge_score: 3,
    challenge_date: "2026-09-15",
    challenge_filters: '["P4"]',
    challenge_target: "Yu Narukami",
    challenge_is_expert: 0,
    created_at: new Date().toISOString(),
    sender: { pseudo: "Yosuke", avatar: null },
    receiver: { pseudo: "Me", avatar: null },
    ...overrides,
  };
}

function goTo(pathname) {
  window.history.replaceState({}, "", pathname);
}

/** Importe le module à neuf (file et Set en mémoire remis à zéro = « nouvelle page »). */
async function freshPage(pathname = "/index.html") {
  vi.resetModules();
  goTo(pathname);
  challengeNotif = await import("../js/challenge-notif.js");
  challengeResult = await import("../js/challenge-result.js");
  // Les espions des modules moqués survivent à resetModules : on ne garde que
  // les appels de LA page en cours.
  challengeNotif.queueChallengeNotifs.mockClear();
  challengeResult.showSenderChallengeResult.mockClear();
  notifications = await import("../js/notifications.js");
  window._personadleApi = api;
}

function queuedIds() {
  return challengeNotif.queueChallengeNotifs.mock.calls.flatMap(([list]) => list.map((c) => c.id));
}

beforeEach(async () => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.innerHTML = '<span id="navFriendsBadge" class="hidden"></span>';
  window._currentUser = { id: ME, pseudo: "Me", settings: {} };
  api = {
    notifications: { get: vi.fn().mockResolvedValue({ friend_requests: 0 }) },
    messages: {
      list: vi.fn().mockResolvedValue({ messages: [] }),
      updateStatus: vi.fn().mockResolvedValue({ updated: true }),
    },
    friends: { list: vi.fn().mockResolvedValue({ pending_requests: [] }) },
    socialLink: { getRankUpNotifs: vi.fn().mockResolvedValue({ notifs: [] }) },
  };
  window._personadleApi = api;

  window._pusherKey = "test-key";
  window._pusherCluster = "eu";
  mockChannel = { bind: vi.fn() };
  window.Pusher = vi.fn(function PusherMock() {
    return {
      subscribe: vi.fn().mockReturnValue(mockChannel),
      disconnect: vi.fn(),
      connection: { bind: vi.fn(), state: "connected" },
    };
  });

  await freshPage("/index.html");
});

afterEach(() => {
  notifications?.stopNotifications?.();
  vi.useRealTimers();
  localStorage.clear();
  delete window._personadleApi;
  delete window._currentUser;
  delete window._pusherKey;
  delete window._pusherCluster;
  delete window.Pusher;
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("où la pop-up apparaît", () => {
  it("accueil : un défi reçu non lu est poussé, avec tout ce que la pop-up doit savoir", async () => {
    api.messages.list.mockResolvedValue({ messages: [msg()] });

    await notifications.initNotifications();

    expect(api.messages.list).toHaveBeenCalledWith({ type: "challenge", limit: 30 });
    expect(challengeNotif.queueChallengeNotifs).toHaveBeenCalledTimes(1);
    const [payload] = challengeNotif.queueChallengeNotifs.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: 100,
      senderPseudo: "Yosuke",
      mode: "classic",
      score: 3,
      date: "2026-09-15",
      senderId: FRIEND,
      challengeFilters: '["P4"]',
      challengeTarget: "Yu Narukami",
      challengeIsExpert: false,
    });
  });

  it("profil : même pop-up qu'à l'accueil", async () => {
    await freshPage("/profile/profile.html");
    api.messages.list.mockResolvedValue({ messages: [msg()] });

    await notifications.initNotifications();

    expect(queuedIds()).toEqual([100]);
  });

  it("page de jeu : jamais de pop-up (ni même de lecture des messages)", async () => {
    for (const p of [
      "/classiqueMode/classiqueMode.html",
      "/emojiMode/emojiMode.html",
      "/silhouetteMode/silhouette.html",
      "/allOutAttackMode/allOutAttack.html",
      "/personaeMode/personae.html",
      "/musicsMode/musics.html",
    ]) {
      await freshPage(p);
      api.messages.list.mockResolvedValue({ messages: [msg()] });
      await notifications.initNotifications();
      expect(api.messages.list, p).not.toHaveBeenCalled();
      expect(challengeNotif.queueChallengeNotifs, p).not.toHaveBeenCalled();
      notifications.stopNotifications();
      api.messages.list.mockClear();
    }
  });

  it("page Amis : pas de pop-up (la Boîte les liste déjà), mais les résultats sont lus", async () => {
    await freshPage("/profile/friends/friends.html");
    localStorage.setItem(`_crInitDone_${ME}`, "1");
    api.messages.list.mockResolvedValue({
      messages: [msg(), msg({ id: 200, sender_id: ME, receiver_id: FRIEND, status: "beaten" })],
    });

    await notifications.initNotifications();

    expect(challengeNotif.queueChallengeNotifs).not.toHaveBeenCalled();
    expect(challengeResult.showSenderChallengeResult).toHaveBeenCalledTimes(1);
  });

  it("le drapeau Expert du message décide de la dimension de la pop-up", async () => {
    api.messages.list.mockResolvedValue({ messages: [msg({ challenge_is_expert: 1 })] });

    await notifications.initNotifications();

    expect(challengeNotif.queueChallengeNotifs.mock.calls[0][0][0].challengeIsExpert).toBe(true);
  });
});

describe("ce qui n'est PAS un défi à accepter", () => {
  it("mes propres défis envoyés, et les défis déjà acceptés/refusés/terminés, ne déclenchent rien", async () => {
    api.messages.list.mockResolvedValue({
      messages: [
        msg({ id: 1, sender_id: ME, receiver_id: FRIEND, status: "unread" }), // envoyé par moi
        msg({ id: 2, status: "accepted" }),
        msg({ id: 3, status: "read" }),
        msg({ id: 4, status: "beaten" }),
        msg({ id: 5, status: "expired" }),
      ],
    });

    await notifications.initNotifications();

    expect(challengeNotif.queueChallengeNotifs).not.toHaveBeenCalled();
  });

  it("sans utilisateur connecté ou sans API, le sondage ne démarre pas", async () => {
    delete window._currentUser;
    await notifications.initNotifications();
    expect(api.notifications.get).not.toHaveBeenCalled();
  });
});

describe("plusieurs défis en même temps", () => {
  it("deux amis, deux défis : les deux sont poussés, dans l'ordre du serveur", async () => {
    api.messages.list.mockResolvedValue({
      messages: [msg({ id: 100 }), msg({ id: 101, sender_id: 8, sender: { pseudo: "Chie" } })],
    });

    await notifications.initNotifications();

    expect(challengeNotif.queueChallengeNotifs).toHaveBeenCalledTimes(1);
    expect(queuedIds()).toEqual([100, 101]);
  });

  it("un défi arrivé entre deux sondages est poussé au sondage suivant, seul", async () => {
    api.messages.list.mockResolvedValueOnce({ messages: [msg({ id: 100 })] });
    await notifications.initNotifications();
    expect(queuedIds()).toEqual([100]);

    api.messages.list.mockResolvedValueOnce({ messages: [msg({ id: 100 }), msg({ id: 101 })] });
    await triggerRecheck();

    expect(queuedIds()).toEqual([100, 101]); // 100 n'est pas rejoué, 101 arrive
  });
});

describe("mémoire : même page, autre page, fermeture explicite", () => {
  it("un défi montré n'est pas rejoué à chaque sondage tant qu'on reste sur la page", async () => {
    api.messages.list.mockResolvedValue({ messages: [msg()] });
    await notifications.initNotifications();

    await triggerRecheck();
    await triggerRecheck();

    expect(challengeNotif.queueChallengeNotifs).toHaveBeenCalledTimes(1);
  });

  it("une notification simplement manquée revient sur la page suivante (le message est encore unread)", async () => {
    api.messages.list.mockResolvedValue({ messages: [msg()] });
    await notifications.initNotifications();
    expect(queuedIds()).toEqual([100]);
    notifications.stopNotifications();

    // Navigation : nouveau module, même localStorage, aucun « vu » persisté.
    await freshPage("/profile/profile.html");
    api.messages.list.mockResolvedValue({ messages: [msg()] });
    await notifications.initNotifications();

    expect(queuedIds()).toEqual([100]);
  });

  it("un défi explicitement fermé (Plus tard / Refuser / croix) ne revient plus, même sur une autre page", async () => {
    api.messages.list.mockResolvedValue({ messages: [msg()] });
    await notifications.initNotifications();
    challengeNotif.__dismiss(100);
    expect(JSON.parse(localStorage.getItem("seenChallengeNotifIds"))).toEqual([100]);
    notifications.stopNotifications();

    await freshPage("/profile/profile.html");
    api.messages.list.mockResolvedValue({ messages: [msg()] });
    await notifications.initNotifications();

    expect(challengeNotif.queueChallengeNotifs).not.toHaveBeenCalled();
  });

  it("fermer le premier ne touche pas au second : il est re-proposé s'il n'a pas été fermé", async () => {
    api.messages.list.mockResolvedValue({ messages: [msg({ id: 100 }), msg({ id: 101 })] });
    await notifications.initNotifications();
    challengeNotif.__dismiss(100);
    notifications.stopNotifications();

    await freshPage("/index.html");
    api.messages.list.mockResolvedValue({ messages: [msg({ id: 100 }), msg({ id: 101 })] });
    await notifications.initNotifications();

    expect(queuedIds()).toEqual([101]);
  });

  it("la liste des « vus » est bornée (100 derniers) — pas de localStorage qui enfle", async () => {
    await notifications.initNotifications();
    for (let i = 1; i <= 130; i++) challengeNotif.__dismiss(i);
    const seen = JSON.parse(localStorage.getItem("seenChallengeNotifIds"));
    expect(seen).toHaveLength(100);
    expect(seen[0]).toBe(31);
    expect(seen.at(-1)).toBe(130);
  });
});

describe("cohabitation avec le plein écran de résultat", () => {
  it("un résultat de défi affiché repousse la pop-up au sondage suivant, sans la perdre", async () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="cr-overlay"></div>');
    api.messages.list.mockResolvedValue({ messages: [msg()] });

    await notifications.initNotifications();
    expect(challengeNotif.queueChallengeNotifs).not.toHaveBeenCalled();

    document.getElementById("cr-overlay").remove();
    await triggerRecheck();

    expect(queuedIds()).toEqual([100]);
  });
});

describe("résultat pour l'expéditeur", () => {
  const beaten = () => msg({ id: 300, sender_id: ME, receiver_id: FRIEND, status: "beaten" });

  it("première visite : l'historique est marqué vu sans animation (pas de rafale d'anciens résultats)", async () => {
    api.messages.list.mockResolvedValue({ messages: [beaten()] });

    await notifications.initNotifications();

    expect(challengeResult.showSenderChallengeResult).not.toHaveBeenCalled();
    expect(localStorage.getItem(`_crInitDone_${ME}`)).toBe("1");
    expect(JSON.parse(localStorage.getItem("seenChallengeResults"))).toEqual([300]);
  });

  it("ensuite : un défi relevé (beaten) ou manqué (expired) est montré UNE fois, puis mémorisé", async () => {
    localStorage.setItem(`_crInitDone_${ME}`, "1");
    api.messages.list.mockResolvedValue({ messages: [beaten()] });

    await notifications.initNotifications();
    expect(challengeResult.showSenderChallengeResult).toHaveBeenCalledTimes(1);
    expect(challengeResult.showSenderChallengeResult.mock.calls[0][0].id).toBe(300);

    await triggerRecheck();
    expect(challengeResult.showSenderChallengeResult).toHaveBeenCalledTimes(1);

    api.messages.list.mockResolvedValue({
      messages: [beaten(), msg({ id: 301, sender_id: ME, receiver_id: FRIEND, status: "expired" })],
    });
    await triggerRecheck();
    expect(challengeResult.showSenderChallengeResult).toHaveBeenCalledTimes(2);
    expect(challengeResult.showSenderChallengeResult.mock.calls[1][0].id).toBe(301);
  });

  it("un résultat vieux de plus de 48 h n'est plus annoncé", async () => {
    localStorage.setItem(`_crInitDone_${ME}`, "1");
    const old = new Date(Date.now() - 49 * 3600 * 1000).toISOString();
    api.messages.list.mockResolvedValue({ messages: [beaten(), { ...beaten(), created_at: old }] });

    await notifications.initNotifications();

    expect(challengeResult.showSenderChallengeResult).toHaveBeenCalledTimes(1);
  });

  it("un défi que J'AI relevé (je suis le destinataire) n'est pas un résultat d'expéditeur", async () => {
    localStorage.setItem(`_crInitDone_${ME}`, "1");
    api.messages.list.mockResolvedValue({ messages: [msg({ id: 400, status: "beaten" })] });

    await notifications.initNotifications();

    expect(challengeResult.showSenderChallengeResult).not.toHaveBeenCalled();
  });
});

describe("relance des statuts non transmis", () => {
  it("rejoue la file AVANT de lire les messages, puis la vide", async () => {
    localStorage.setItem(
      "pendingChallengeStatus",
      JSON.stringify([{ msgId: 55, status: "beaten", at: 1 }])
    );
    const order = [];
    api.messages.updateStatus.mockImplementation(async () => {
      order.push("update");
    });
    api.notifications.get.mockImplementation(async () => {
      order.push("get");
      return { friend_requests: 0 };
    });

    await notifications.initNotifications();

    expect(api.messages.updateStatus).toHaveBeenCalledWith(55, "beaten");
    expect(order[0]).toBe("update");
    expect(localStorage.getItem("pendingChallengeStatus")).toBeNull();
  });

  it("une relance refusée définitivement (4xx) est jetée, une panne (5xx/réseau) est retentée", async () => {
    localStorage.setItem(
      "pendingChallengeStatus",
      JSON.stringify([
        { msgId: 1, status: "expired", at: 1 },
        { msgId: 2, status: "beaten", at: 2 },
      ])
    );
    api.messages.updateStatus.mockImplementation(async (id) => {
      if (id === 1) throw Object.assign(new Error("gone"), { status: 400 });
      throw new Error("Failed to fetch");
    });

    await notifications.initNotifications();

    const left = JSON.parse(localStorage.getItem("pendingChallengeStatus"));
    expect(left.map((e) => e.msgId)).toEqual([2]);

    // Le serveur revient : la relance aboutit au sondage suivant.
    api.messages.updateStatus.mockResolvedValue({ updated: true });
    await triggerRecheck();
    expect(localStorage.getItem("pendingChallengeStatus")).toBeNull();
  });

  it("une panne de la relance ne bloque pas le reste du sondage", async () => {
    localStorage.setItem("pendingChallengeStatus", "{not json");
    api.messages.list.mockResolvedValue({ messages: [msg()] });

    await notifications.initNotifications();

    expect(queuedIds()).toEqual([100]);
  });
});

describe("robustesse", () => {
  it("une API en panne ne fait pas planter le sondage, et rien n'est marqué vu", async () => {
    api.notifications.get.mockRejectedValue(new Error("500"));

    await expect(notifications.initNotifications()).resolves.toBeUndefined();

    expect(localStorage.getItem("seenChallengeNotifIds")).toBeNull();
  });

  it("le badge de la nav suit le nombre de demandes d'ami", async () => {
    api.notifications.get.mockResolvedValue({ friend_requests: 12 });
    await notifications.initNotifications();
    const badge = document.getElementById("navFriendsBadge");
    expect(badge.textContent).toBe("9+");
    expect(badge.classList.contains("hidden")).toBe(false);

    api.notifications.get.mockResolvedValue({ friend_requests: 0 });
    await triggerRecheck();
    expect(badge.classList.contains("hidden")).toBe(true);
  });

  it("stopNotifications() arrête le sondage", async () => {
    await notifications.initNotifications();
    notifications.stopNotifications();
    api.notifications.get.mockClear();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(api.notifications.get).not.toHaveBeenCalled();
  });
});
