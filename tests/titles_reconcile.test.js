/**
 * titles_reconcile.test.js — Réconciliation local → backend des titres
 * (syncTitlesWithBackend / initTitlesSection, profile/titles-ui.js).
 *
 * Le cas réel (Hamza, 2.2) : « j'ai le badge Velvet Regular (50 jours joués)
 * mais pas le titre I Am Not Afraid (50 victoires Classique) ». Les deux
 * déblocages sont décidés par le client puis vérifiés par le serveur — mais en
 * fin de partie, le POST /titles/unlock part AVANT que la session soit
 * enregistrée (savePendingSession n'est pas attendu) : le serveur compte encore
 * 49 victoires, répond 403, et l'erreur est avalée. Le titre est alors dans le
 * profil local (plus jamais renvoyé par checkAndUnlockTitles) et absent de
 * `user_titles`. Les badges, eux, ont syncBadgesWithBackend() qui repousse à
 * chaque visite du profil ce que le serveur n'a pas — les titres ne l'avaient pas.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  _resetTitlesData,
  checkTitlesAfterGame,
  initTitlesSection,
  syncTitlesWithBackend,
} from "../profile/titles-ui.js";

const ME = 1;

function apiTitles(unlocked = []) {
  // La réponse de /api/titles : id, slug, is_unlocked par utilisateur.
  const slugs = [
    "velvet_room_thou_art_i",
    "aigis_i_am_not_afraid",
    "naoya_first_awakening",
    "yosuke_ride_the_wind",
  ];
  return slugs.map((slug, i) => ({
    id: i + 1,
    slug,
    name: slug,
    rarity: "rare",
    is_unlocked: unlocked.includes(slug) ? 1 : 0,
  }));
}

function mockFetch({ titles = apiTitles(), friends = [] } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes("/api/titles")) return { json: async () => titles };
    if (u.includes("/api/friends")) return { json: async () => ({ friends }) };
    return { json: async () => ({}) };
  });
}

let unlock;
let profile;
const save = vi.fn();

beforeEach(() => {
  document.body.innerHTML = '<div id="titlesModalGrid"></div>';
  localStorage.clear();
  _resetTitlesData();
  window.history.replaceState({}, "", "/profile/profile.html");
  window._currentUser = { id: ME, pseudo: "Me" };
  unlock = vi.fn().mockResolvedValue({ unlocked: true });
  window._personadleApi = { titles: { unlock } };
  profile = { stats: { modeWins: {} }, badges: [], unlockedTitles: [] };
  save.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window._currentUser;
  delete window._personadleApi;
  localStorage.clear();
});

describe("syncTitlesWithBackend", () => {
  it("repousse au serveur les titres locaux qu'il n'a pas, et les marque débloqués", async () => {
    profile.unlockedTitles = ["aigis_i_am_not_afraid", "naoya_first_awakening"];

    const res = await syncTitlesWithBackend(profile, ["naoya_first_awakening"], save);

    expect(unlock).toHaveBeenCalledTimes(1);
    expect(unlock).toHaveBeenCalledWith("aigis_i_am_not_afraid");
    expect(res).toEqual({ pushed: ["aigis_i_am_not_afraid"], dropped: [] });
    expect(profile.unlockedTitles).toEqual(["aigis_i_am_not_afraid", "naoya_first_awakening"]);
  });

  it("un titre fantôme (403 : condition réellement non remplie) est retiré du local", async () => {
    profile.unlockedTitles = ["aigis_i_am_not_afraid"];
    unlock.mockRejectedValue(Object.assign(new Error("Condition not met"), { status: 403 }));

    const res = await syncTitlesWithBackend(profile, [], save);

    expect(res).toEqual({ pushed: [], dropped: ["aigis_i_am_not_afraid"] });
    expect(profile.unlockedTitles).toEqual([]);
    expect(save).toHaveBeenCalled();
  });

  it("une panne réseau ou un 404 garde l'entrée locale (on réessaiera)", async () => {
    profile.unlockedTitles = ["aigis_i_am_not_afraid", "yosuke_ride_the_wind"];
    unlock.mockImplementation(async (slug) => {
      if (slug === "aigis_i_am_not_afraid") throw new Error("Failed to fetch");
      throw Object.assign(new Error("Title not found"), { status: 404 });
    });

    const res = await syncTitlesWithBackend(profile, [], save);

    expect(res).toEqual({ pushed: [], dropped: [] });
    expect(profile.unlockedTitles).toEqual(["aigis_i_am_not_afraid", "yosuke_ride_the_wind"]);
    expect(save).not.toHaveBeenCalled();
  });

  it("ne pousse rien pour un profil importé d'un autre compte (même garde que les badges)", async () => {
    profile._accountId = 999;
    profile.unlockedTitles = ["aigis_i_am_not_afraid"];

    await syncTitlesWithBackend(profile, [], save);

    expect(unlock).not.toHaveBeenCalled();
  });

  it("sans utilisateur ou sans API : no-op", async () => {
    profile.unlockedTitles = ["aigis_i_am_not_afraid"];
    delete window._currentUser;
    expect(await syncTitlesWithBackend(profile, [], save)).toEqual({ pushed: [], dropped: [] });
    window._currentUser = { id: ME };
    delete window._personadleApi;
    expect(await syncTitlesWithBackend(profile, [], save)).toEqual({ pushed: [], dropped: [] });
  });
});

describe("le scénario complet « badge oui, titre non »", () => {
  it("fin de partie : la 50e victoire pose le titre en local mais le serveur dit 403 (session pas encore là)", async () => {
    // Sur la page du mode, juste après la victoire : le client compte 50, le
    // serveur 49. Le POST part, échoue, l'erreur est avalée.
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ stats: { modeWins: { Classic: 50 } }, badges: [], unlockedTitles: [] })
    );
    unlock.mockRejectedValue(Object.assign(new Error("Condition not met"), { status: 403 }));
    delete window._currentUser; // pas de fetch /api/friends sur les pages de mode

    checkTitlesAfterGame();
    await new Promise((r) => setTimeout(r, 0));

    const local = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(local.unlockedTitles).toContain("aigis_i_am_not_afraid");
    expect(unlock).toHaveBeenCalledWith("aigis_i_am_not_afraid");
  });

  it("visite suivante du profil : le titre local absent du serveur est repoussé — et accepté cette fois", async () => {
    // Le serveur a maintenant enregistré la session : il accepte.
    profile = {
      stats: { modeWins: { Classic: 50 } },
      badges: [],
      unlockedTitles: ["aigis_i_am_not_afraid"],
    };
    mockFetch({ titles: apiTitles([]) });

    await initTitlesSection(profile, save, vi.fn(), vi.fn());

    expect(unlock).toHaveBeenCalledWith("aigis_i_am_not_afraid");
    expect(profile.unlockedTitles).toContain("aigis_i_am_not_afraid");
    // Rendu comme débloqué.
    const card = document.querySelector('[data-slug="aigis_i_am_not_afraid"]');
    expect(card?.dataset.unlocked).toBe("true");
  });

  it("visite suivante, mais la victoire n'a jamais été enregistrée (403 définitif) : le titre fantôme disparaît", async () => {
    // Stats du cloud (source de vérité) : 49 victoires. Le local croyait 50.
    profile = {
      stats: { modeWins: { Classic: 49 } },
      badges: [],
      unlockedTitles: ["aigis_i_am_not_afraid"],
    };
    unlock.mockRejectedValue(Object.assign(new Error("Condition not met"), { status: 403 }));
    mockFetch({ titles: apiTitles([]) });

    await initTitlesSection(profile, save, vi.fn(), vi.fn());

    expect(profile.unlockedTitles).not.toContain("aigis_i_am_not_afraid");
    const card = document.querySelector('[data-slug="aigis_i_am_not_afraid"]');
    expect(card?.dataset.unlocked).toBe("false");
  });

  it("déjà débloqué côté serveur : rien n'est repoussé", async () => {
    profile = {
      stats: { modeWins: { Classic: 50 } },
      badges: [],
      unlockedTitles: ["aigis_i_am_not_afraid"],
    };
    mockFetch({ titles: apiTitles(["aigis_i_am_not_afraid"]) });

    await initTitlesSection(profile, save, vi.fn(), vi.fn());

    // (naoya_first_awakening — 15 victoires Classique — est légitimement débloqué au passage.)
    expect(unlock).not.toHaveBeenCalledWith("aigis_i_am_not_afraid");
  });

  it("/api/titles injoignable : aucune réconciliation (ni push ni retrait), le local reste tel quel", async () => {
    profile = { stats: { modeWins: {} }, badges: [], unlockedTitles: ["aigis_i_am_not_afraid"] };
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await initTitlesSection(profile, save, vi.fn(), vi.fn());

    expect(unlock).not.toHaveBeenCalled();
    expect(profile.unlockedTitles).toEqual(["aigis_i_am_not_afraid"]);
  });
});
