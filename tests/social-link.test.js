/**
 * social-link.test.js — Unit tests for js/social-link.js
 *
 * Covers the client-side logic that is *not* pure XP/rank math (that lives
 * server-side in api/lib/social_link.php, see tests/php/SocialLinkTest.php):
 * flame indicator, rank-10 permanent effect, and the rank-up overlay's
 * tier/sparkle/phrase selection — plus getSocialLinkData/gainSocialLinkXp/
 * renderSocialLinkGauge (0% coverage before this file), which round-trip to
 * window._personadleApi and were previously entirely untested.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  addFlameIfPlayedToday,
  applyRank10Effect,
  showSocialLinkRankUp,
  getSocialLinkData,
  gainSocialLinkXp,
  renderSocialLinkGauge,
} from "../js/social-link.js";

function clearStorage() {
  localStorage.clear();
}

// getLinkId() caches by friendId in a module-level Map that isn't reset
// between tests — each test below uses its own unique friendId to avoid
// cache bleed instead of trying to reset internal state.
let _nextFriendId = 9000;
function freshFriendId() {
  return ++_nextFriendId;
}

// ─────────────────────────────────────────────────────────────────────────────
// addFlameIfPlayedToday
// ─────────────────────────────────────────────────────────────────────────────

describe("addFlameIfPlayedToday", () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<span id="pseudo"></span>';
    container = document.getElementById("pseudo");
  });

  it("adds the flame when the last interaction is today", () => {
    // « Il y a une minute », au format DATETIME UTC du serveur : c'est aujourd'hui à
    // Paris quelle que soit l'heure. L'ancien « date UTC du jour à 12:00 » tombait
    // HIER à Paris entre minuit et 2 h (la date UTC est encore celle de la veille) —
    // test rouge chaque nuit à cette heure-là, vécu le 2026-09-19 à 01:14.
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString().slice(0, 19).replace("T", " ");
    addFlameIfPlayedToday({ social_link_last_interaction: oneMinuteAgo }, container);
    expect(container.querySelector(".fr-flame")).not.toBeNull();
  });

  it("does not add the flame when the last interaction was yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    addFlameIfPlayedToday({ social_link_last_interaction: `${yesterday} 12:00:00` }, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
  });

  it("la journée est celle de PARIS : une interaction à 00:30 Paris (22:30 UTC la veille) est « aujourd'hui »", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T08:00:00+02:00")); // 11 juillet, matin, Paris
    // Hier soir 22:30 UTC = aujourd'hui 00:30 Paris — même journée Paris que maintenant
    addFlameIfPlayedToday({ social_link_last_interaction: "2026-07-10 22:30:00" }, container);
    expect(container.querySelector(".fr-flame")).not.toBeNull();
    vi.useRealTimers();
  });

  it("…et une interaction à 23:30 Paris hier (21:30 UTC) n'est PAS « aujourd'hui »", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T08:00:00+02:00"));
    addFlameIfPlayedToday({ social_link_last_interaction: "2026-07-10 21:30:00" }, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
    vi.useRealTimers();
  });

  it("accepte aussi un ISO déjà suffixé Z, et ignore une date illisible", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T08:00:00+02:00"));
    addFlameIfPlayedToday({ social_link_last_interaction: "2026-07-10T22:30:00Z" }, container);
    expect(container.querySelector(".fr-flame")).not.toBeNull();
    container.innerHTML = "";
    addFlameIfPlayedToday({ social_link_last_interaction: "n/a" }, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
    vi.useRealTimers();
  });

  it("is a no-op when there is no last interaction", () => {
    addFlameIfPlayedToday({ social_link_last_interaction: null }, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
  });

  it("is a no-op when social_link_last_interaction is undefined", () => {
    addFlameIfPlayedToday({}, container);
    expect(container.querySelector(".fr-flame")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyRank10Effect
// ─────────────────────────────────────────────────────────────────────────────

describe("applyRank10Effect", () => {
  let avatar, pseudo;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="wrap" style="position:static">
        <img id="avatar" />
      </div>
      <span id="pseudo"></span>
    `;
    avatar = document.getElementById("avatar");
    pseudo = document.getElementById("pseudo");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds the permanent rank10-avatar class immediately", () => {
    applyRank10Effect(avatar, pseudo);
    expect(avatar.classList.contains("rank10-avatar")).toBe(true);
  });

  it("appends a single rank10-icon to the pseudo element", () => {
    applyRank10Effect(avatar, pseudo);
    applyRank10Effect(avatar, pseudo); // idempotent — must not duplicate the icon
    expect(pseudo.querySelectorAll(".rank10-icon")).toHaveLength(1);
  });

  it("is a no-op when avatarEl is null", () => {
    expect(() => applyRank10Effect(null, pseudo)).not.toThrow();
  });

  it("spawns 8 particles after the delay, then removes them", () => {
    applyRank10Effect(avatar, pseudo, 0);

    vi.advanceTimersByTime(10);
    const wrap = document.getElementById("wrap");
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(8);

    vi.advanceTimersByTime(900);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(0);
  });

  it("shows then removes the 'True Confidant' label", () => {
    applyRank10Effect(avatar, pseudo, 0);
    const wrap = document.getElementById("wrap");

    vi.advanceTimersByTime(10 + 600);
    const label = wrap.querySelector(".rank10-label");
    expect(label).not.toBeNull();
    expect(label.textContent).toContain("True Confidant");

    vi.advanceTimersByTime(1800 + 600);
    expect(wrap.querySelector(".rank10-label")).toBeNull();
  });

  it("celebrate:false pose le marqueur permanent sans burst ni label", () => {
    // Liste d'amis re-rendue à chaque poll : seule la première apparition
    // célèbre, les rendus suivants ne reposent que l'anneau et la pastille.
    applyRank10Effect(avatar, pseudo, 0, { celebrate: false });
    const wrap = document.getElementById("wrap");

    expect(avatar.classList.contains("rank10-avatar")).toBe(true);
    expect(pseudo.querySelectorAll(".rank10-icon")).toHaveLength(1);

    vi.advanceTimersByTime(10 + 600 + 1800);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(0);
    expect(wrap.querySelector(".rank10-label")).toBeNull();
  });

  it("respects a custom delayMs before starting the particle burst", () => {
    applyRank10Effect(avatar, pseudo, 500);
    const wrap = document.getElementById("wrap");

    vi.advanceTimersByTime(100);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(0);

    vi.advanceTimersByTime(450);
    expect(wrap.querySelectorAll(".rank10-particle")).toHaveLength(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// showSocialLinkRankUp
// ─────────────────────────────────────────────────────────────────────────────

describe("showSocialLinkRankUp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearStorage();
    document.body.innerHTML = "";
    document.documentElement.lang = "en";
    if (!window.requestAnimationFrame) {
      vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(cb, 0));
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("assigns the tier1 class for ranks 1-3", () => {
    showSocialLinkRankUp(2, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--tier1");
  });

  it("assigns the tier2 class for ranks 4-6", () => {
    showSocialLinkRankUp(5, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--tier2");
  });

  it("assigns the tier3 class for ranks 7-9", () => {
    showSocialLinkRankUp(8, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--tier3");
  });

  it("assigns the rank10 class for rank 10", () => {
    showSocialLinkRankUp(10, null);
    expect(document.getElementById("sl-rankup-overlay").className).toBe("sl-ru--rank10");
  });

  it("renders more sparkles for rank 10 than for rank 1", () => {
    showSocialLinkRankUp(10, null);
    const rank10Count = document.querySelectorAll(".sl-ru-sparkle").length;

    document.body.innerHTML = "";
    showSocialLinkRankUp(1, null);
    const rank1Count = document.querySelectorAll(".sl-ru-sparkle").length;

    expect(rank10Count).toBeGreaterThan(rank1Count);
  });

  it("falls back to the internal rank-name table when rankNames is null", () => {
    showSocialLinkRankUp(5, null);
    expect(document.querySelector(".sl-ru-name").textContent).toBe("Confidant");
  });

  it("prefers the provided rankNames for the current language", () => {
    showSocialLinkRankUp(5, { en: "Confidant", fr: "Confident" });
    expect(document.querySelector(".sl-ru-name").textContent).toBe("Confidant");
  });

  it("displays the requested rank number", () => {
    showSocialLinkRankUp(7, null);
    expect(document.querySelector(".sl-ru-rank-num").textContent).toContain("7");
  });

  it("removes a pre-existing overlay before rendering a new one", () => {
    showSocialLinkRankUp(3, null);
    showSocialLinkRankUp(4, null);
    expect(document.querySelectorAll("#sl-rankup-overlay")).toHaveLength(1);
  });

  it("auto-closes after ~6s for non-rank-10 tiers", () => {
    showSocialLinkRankUp(3, null);
    vi.advanceTimersByTime(6000 + 500 + 10);
    expect(document.getElementById("sl-rankup-overlay")).toBeNull();
  });

  it("auto-closes after ~8.5s for rank 10 (longer celebration)", () => {
    showSocialLinkRankUp(10, null);

    vi.advanceTimersByTime(6000);
    expect(document.getElementById("sl-rankup-overlay")).not.toBeNull();

    vi.advanceTimersByTime(2500 + 500 + 10);
    expect(document.getElementById("sl-rankup-overlay")).toBeNull();
  });

  it("closes immediately when the overlay is clicked", () => {
    showSocialLinkRankUp(3, null);
    document.getElementById("sl-rankup-overlay").click();
    vi.advanceTimersByTime(500 + 10);
    expect(document.getElementById("sl-rankup-overlay")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSocialLinkData
// ─────────────────────────────────────────────────────────────────────────────

describe("getSocialLinkData", () => {
  afterEach(() => {
    delete window._personadleApi;
  });

  it("resolves the link id then fetches and returns the full link data", async () => {
    const friendId = freshFriendId();
    const getByFriend = vi.fn().mockResolvedValue({ link_id: 42 });
    const get = vi.fn().mockResolvedValue({ rank: 3, xp: 120 });
    window._personadleApi = { socialLink: { getByFriend, get } };

    const data = await getSocialLinkData(friendId);

    expect(getByFriend).toHaveBeenCalledWith(friendId);
    expect(get).toHaveBeenCalledWith(42);
    expect(data).toEqual({ rank: 3, xp: 120 });
  });

  it("caches the link id — a second call for the same friend does not re-resolve it", async () => {
    const friendId = freshFriendId();
    const getByFriend = vi.fn().mockResolvedValue({ link_id: 7 });
    const get = vi.fn().mockResolvedValue({ rank: 1 });
    window._personadleApi = { socialLink: { getByFriend, get } };

    await getSocialLinkData(friendId);
    await getSocialLinkData(friendId);

    expect(getByFriend).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws when the API bridge is unavailable", async () => {
    delete window._personadleApi;
    await expect(getSocialLinkData(freshFriendId())).rejects.toThrow("API not available");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// gainSocialLinkXp
// ─────────────────────────────────────────────────────────────────────────────

describe("gainSocialLinkXp", () => {
  afterEach(() => {
    delete window._personadleApi;
  });

  it("triggers the interaction and returns the server result", async () => {
    const friendId = freshFriendId();
    const interactByFriend = vi.fn().mockResolvedValue({
      link_id: 55,
      xp_gained: 10,
      is_mutual: false,
      new_xp: 30,
      new_rank: 1,
      ranked_up: false,
    });
    window._personadleApi = { socialLink: { interactByFriend } };

    const result = await gainSocialLinkXp(friendId, "visit_profile");

    expect(interactByFriend).toHaveBeenCalledWith(friendId, "visit_profile");
    expect(result.xp_gained).toBe(10);
  });

  it("caches the link id from the result so a later getSocialLinkData reuses it", async () => {
    const friendId = freshFriendId();
    const interactByFriend = vi.fn().mockResolvedValue({ link_id: 99, xp_gained: 5 });
    const getByFriend = vi.fn().mockResolvedValue({ link_id: 99 });
    const get = vi.fn().mockResolvedValue({ rank: 2 });
    window._personadleApi = { socialLink: { interactByFriend, getByFriend, get } };

    await gainSocialLinkXp(friendId, "compare_stats");
    await getSocialLinkData(friendId);

    expect(getByFriend).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith(99);
  });

  it("throws when the API bridge is unavailable", async () => {
    delete window._personadleApi;
    await expect(gainSocialLinkXp(freshFriendId(), "visit_profile")).rejects.toThrow(
      "API not available"
    );
  });

  it("propagates a server error (e.g. 409 already done today)", async () => {
    const friendId = freshFriendId();
    const interactByFriend = vi.fn().mockRejectedValue(new Error("Already done today"));
    window._personadleApi = { socialLink: { interactByFriend } };

    await expect(gainSocialLinkXp(friendId, "visit_profile")).rejects.toThrow(
      "Already done today"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderSocialLinkGauge
// ─────────────────────────────────────────────────────────────────────────────

describe("renderSocialLinkGauge", () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="gauge"></div>';
    container = document.getElementById("gauge");
    document.documentElement.lang = "en";
    localStorage.clear();
    window._currentUser = { id: 1 };
  });

  afterEach(() => {
    delete window._personadleApi;
    delete window._currentUser;
  });

  it("shows a loading state synchronously before the data resolves", () => {
    window._personadleApi = {
      socialLink: {
        getByFriend: vi.fn(() => new Promise(() => {})), // never resolves
        get: vi.fn(),
      },
    };

    renderSocialLinkGauge(freshFriendId(), container);

    expect(container.querySelector(".sl-loading")).not.toBeNull();
  });

  it("renders the gauge with the rank and XP once the data resolves", async () => {
    window._personadleApi = {
      socialLink: {
        getByFriend: vi.fn().mockResolvedValue({ link_id: 1 }),
        get: vi.fn().mockResolvedValue({
          rank: 3,
          xp: 60,
          xp_current_rank: 50,
          xp_next_rank: 100,
          rank_names: { en: "Companion" },
          today_interactions: [],
        }),
      },
    };

    await renderSocialLinkGauge(freshFriendId(), container);

    expect(container.querySelector(".sl-rank-badge").textContent).toContain("Companion");
    expect(container.querySelector(".sl-bar-fill").style.width).toBe("20%");
  });

  it("clears the container instead of throwing when the fetch fails", async () => {
    window._personadleApi = {
      socialLink: {
        getByFriend: vi.fn().mockRejectedValue(new Error("network")),
        get: vi.fn(),
      },
    };

    await renderSocialLinkGauge(freshFriendId(), container);

    expect(container.innerHTML).toBe("");
  });

  it("raises personaUserProfile.bestSocialLinkRank when the new rank is higher", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ bestSocialLinkRank: 2 }));
    window._personadleApi = {
      socialLink: {
        getByFriend: vi.fn().mockResolvedValue({ link_id: 1 }),
        get: vi.fn().mockResolvedValue({ rank: 5, xp: 0, today_interactions: [] }),
      },
    };

    await renderSocialLinkGauge(freshFriendId(), container);

    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.bestSocialLinkRank).toBe(5);
  });

  // ── XP déplafonnée au rang 10 (2.3) ──────────────────────────────────────
  //
  // Le SERVEUR n'a jamais plafonné l'XP : `add_social_link_xp` additionne sans
  // borne et seul le rang s'arrête à 10. Mais la jauge masquait le total dès le
  // rang atteint, si bien que 2 700 et 50 000 XP s'affichaient à l'identique —
  // et le classement Amitié n'aurait eu aucun moyen de les départager aux yeux
  // du joueur.

  const gaugeAtMax = (xp) => ({
    socialLink: {
      getByFriend: vi.fn().mockResolvedValue({ link_id: 1 }),
      get: vi.fn().mockResolvedValue({
        rank: 10,
        xp,
        xp_current_rank: 2700,
        xp_next_rank: null,
        rank_names: { en: "True Confidant" },
        today_interactions: [],
      }),
    },
  });

  it("affiche le total d'XP au rang 10, au lieu de le masquer", async () => {
    window._personadleApi = gaugeAtMax(7700);
    await renderSocialLinkGauge(freshFriendId(), container);

    const label = container.querySelector(".sl-xp-label").textContent;
    expect(label).toContain("MAX");
    expect(label.replace(/[\s,\u202f\u00a0]/g, "")).toContain("7700");
  });

  it("annonce l'XP gagnée AU-DELÀ du rang 10", async () => {
    window._personadleApi = gaugeAtMax(7700);
    await renderSocialLinkGauge(freshFriendId(), container);

    const beyond = container.querySelector(".sl-xp-beyond");
    expect(beyond, "la ligne d'XP au-delà du rang 10 doit exister").not.toBeNull();
    // 7700 - 2700 = 5000
    expect(beyond.textContent.replace(/[\s,\u202f\u00a0]/g, "")).toContain("5000");
  });

  it("n'affiche pas la ligne « au-delà » quand on vient juste d'atteindre le rang 10", async () => {
    window._personadleApi = gaugeAtMax(2700);
    await renderSocialLinkGauge(freshFriendId(), container);

    expect(container.querySelector(".sl-xp-beyond")).toBeNull();
  });

  it("garde le mémo « comment gagner de l'XP » au rang 10", async () => {
    // Le masquer revenait à dire « c'est fini » à ceux qui jouent le plus
    // ensemble, alors que leur XP continue de compter.
    window._personadleApi = gaugeAtMax(3200);
    await renderSocialLinkGauge(freshFriendId(), container);

    expect(container.querySelector(".sl-howto")).not.toBeNull();
  });

  it("garde la barre pleine et le rang figé à 10", async () => {
    window._personadleApi = gaugeAtMax(50000);
    await renderSocialLinkGauge(freshFriendId(), container);

    expect(container.querySelector(".sl-bar-fill").style.width).toBe("100%");
    expect(container.querySelector(".sl-rank-badge").textContent).toContain("Rank 10");
    expect(container.querySelector(".sl-gauge-wrap").className).toContain("sl-rank-10");
  });

  it("interpole les variables même dans le texte de repli, sans i18n chargé", async () => {
    // Sans ça le joueur lit « +{{xp}} XP au-delà du rang 10 » — ce que ce fichier
    // de test a effectivement attrapé en premier. La jauge peut se rendre avant
    // i18n, et la clé peut manquer dans une langue.
    expect(window.i18n, "ce test n'a de sens que sans i18n").toBeUndefined();
    window._personadleApi = gaugeAtMax(7700);
    await renderSocialLinkGauge(freshFriendId(), container);

    expect(container.querySelector(".sl-xp-beyond").textContent).not.toContain("{{");
  });

  it("does not lower bestSocialLinkRank when the current rank is below the recorded best", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ bestSocialLinkRank: 7 }));
    window._personadleApi = {
      socialLink: {
        getByFriend: vi.fn().mockResolvedValue({ link_id: 1 }),
        get: vi.fn().mockResolvedValue({ rank: 3, xp: 0, today_interactions: [] }),
      },
    };

    await renderSocialLinkGauge(freshFriendId(), container);

    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.bestSocialLinkRank).toBe(7);
  });
});
