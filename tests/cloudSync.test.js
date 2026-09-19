/**
 * cloudSync.test.js — js/cloud-sync.js
 *
 * pullProfileFromCloud() n'avait quasi aucune couverture sur son chemin
 * d'échec (68,8% lignes / 22,7% branches, le pire fichier du repo) alors que
 * CLAUDE.md le désigne comme "backend = source de vérité absolue". Ce fichier
 * couvre spécifiquement : que se passe-t-il quand le pull échoue (réseau
 * down, réponse HTTP en erreur, body malformé) ? Le profil local doit rester
 * intact (pas de corruption silencieuse, piège "état dérivé" CLAUDE.md §13),
 * et window._onCloudSync ne doit être notifié qu'en cas de vrai succès.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pullProfileFromCloud, pushLangToCloud } from "../js/cloud-sync.js";

const USER_ID = 42;

function baseUserPayload(overrides = {}) {
  return {
    user: { id: USER_ID, pseudo: "Tester", lang: "en" },
    profile: {},
    stats: [],
    badges: [],
    unlocked_wallpapers: [],
    unlocked_titles: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  globalThis.window._currentUser = { id: USER_ID };
  globalThis.window._personadleApi = { stats: { syncPending: vi.fn().mockResolvedValue() } };
  delete globalThis.window._onCloudSync;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window._currentUser;
  delete globalThis.window._personadleApi;
  delete globalThis.window._onCloudSync;
});

describe("pullProfileFromCloud — chemins d'échec", () => {
  it("retourne null sans appeler fetch si aucun utilisateur connecté", async () => {
    delete globalThis.window._currentUser;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await pullProfileFromCloud();

    expect(res).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("réseau down (fetch rejette) → retourne null, profil local intact", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ stats: { wins: 3 } }));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const onSync = vi.fn();
    globalThis.window._onCloudSync = onSync;

    const res = await pullProfileFromCloud();

    expect(res).toBeNull();
    expect(JSON.parse(localStorage.getItem("personaUserProfile"))).toEqual({ stats: { wins: 3 } });
    expect(onSync).not.toHaveBeenCalled();
  });

  it("réponse HTTP en erreur (res.ok=false) → retourne null, profil local intact", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ stats: { wins: 3 } }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "server error" }),
    });

    const res = await pullProfileFromCloud();

    expect(res).toBeNull();
    expect(JSON.parse(localStorage.getItem("personaUserProfile"))).toEqual({ stats: { wins: 3 } });
  });

  it("body JSON sans champ user (contrat API rompu) → retourne null, profil local intact", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ stats: { wins: 3 } }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: "shape" }),
    });

    const res = await pullProfileFromCloud();

    expect(res).toBeNull();
    expect(JSON.parse(localStorage.getItem("personaUserProfile"))).toEqual({ stats: { wins: 3 } });
  });

  it("json() lui-même rejette (body non parsable) → retourne null au lieu de throw", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    await expect(pullProfileFromCloud()).resolves.toBeNull();
  });

  it("syncPending() qui rejette ne bloque pas le pull (erreur avalée)", async () => {
    globalThis.window._personadleApi.stats.syncPending = vi.fn().mockRejectedValue(new Error("offline"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => baseUserPayload(),
    });

    const res = await pullProfileFromCloud();

    expect(res).not.toBeNull();
    expect(res.user.id).toBe(USER_ID);
  });
});

describe("pullProfileFromCloud — succès", () => {
  it("écrit le profil en localStorage et notifie window._onCloudSync avec les données", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        baseUserPayload({
          stats: [
            { mode: "classic", wins: 5, giveups: 1, games: 6, streak: 2, streak_record: 4, perfect_wins: 0, total_time_ms: 60000 },
          ],
        }),
    });
    const onSync = vi.fn();
    globalThis.window._onCloudSync = onSync;

    const res = await pullProfileFromCloud();

    expect(res.user.pseudo).toBe("Tester");
    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.stats.wins).toBe(5);
    expect(profile._accountId).toBe(USER_ID);
    expect(onSync).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }));
  });

  it("le mode favori CHOISI descend du cloud, et un null efface le choix local", async () => {
    // migration 040 : profiles.favorite_mode est le choix du joueur, distinct du
    // mode le plus joué (stats.favoriteMode, toujours calculé).
    localStorage.setItem("personaUserProfile", JSON.stringify({ favoriteMode: "emoji" }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => baseUserPayload({ profile: { favorite_mode: "music" } }),
    });
    await pullProfileFromCloud();
    expect(JSON.parse(localStorage.getItem("personaUserProfile")).favoriteMode).toBe("music");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => baseUserPayload({ profile: { favorite_mode: null } }),
    });
    await pullProfileFromCloud();
    expect(JSON.parse(localStorage.getItem("personaUserProfile")).favoriteMode).toBeNull();
  });

  it("les journées distinctes viennent du serveur : unique_days remplace le compte local, même plus grand", async () => {
    // Le compte par appareil (uniqueDaysSet) pouvait dépasser celui de la base —
    // jours d'avant le compte inclus : Velvet Regular se débloquait en local, le
    // serveur le refusait à chaque synchro et l'épinglage « s'enlevait » (2026-09-19).
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ uniqueDaysPlayed: 52, uniqueDaysSet: new Array(52).fill("2026-01-01") })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => baseUserPayload({ unique_days: 45 }),
    });
    await pullProfileFromCloud();
    expect(JSON.parse(localStorage.getItem("personaUserProfile")).uniqueDaysPlayed).toBe(45);
  });

  it("un payload sans unique_days (backend antérieur) laisse le compte local intact", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ uniqueDaysPlayed: 12 }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => baseUserPayload(),
    });
    await pullProfileFromCloud();
    expect(JSON.parse(localStorage.getItem("personaUserProfile")).uniqueDaysPlayed).toBe(12);
  });

  it("le portrait d'origine (avatar_src, 052) descend avec l'avatar recadré ; null ou absent l'efface", async () => {
    const pull = async (profile) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => baseUserPayload({ profile }) });
      await pullProfileFromCloud();
      return JSON.parse(localStorage.getItem("personaUserProfile"));
    };
    localStorage.setItem("personaUserProfile", JSON.stringify({ avatarSrc: "../img/avatar/Yukari.jpg" }));

    // Recadré sur un autre appareil : l'origine suit — c'est elle que lit Same Energy.
    let p = await pull({ avatar_data: "data:image/png;base64,xxxx", avatar_src: "../img/avatar/Chie.jpg" });
    expect(p.avatar).toBe("data:image/png;base64,xxxx");
    expect(p.avatarSrc).toBe("../img/avatar/Chie.jpg");

    // Origine inconnue côté serveur (recadré avant la 052) : pas de Yukari fantôme.
    p = await pull({ avatar_data: "data:image/png;base64,xxxx", avatar_src: null });
    expect(p.avatarSrc).toBeUndefined();

    // Backend antérieur (pas de champ) : même prudence qu'avant.
    localStorage.setItem("personaUserProfile", JSON.stringify({ avatarSrc: "../img/avatar/Yukari.jpg" }));
    p = await pull({ avatar_data: "../img/avatar/Ren.gif" });
    expect(p.avatarSrc).toBeUndefined();
  });

  it("un payload sans favorite_mode (backend pas encore migré) laisse le choix local intact", async () => {
    localStorage.setItem("personaUserProfile", JSON.stringify({ favoriteMode: "emoji" }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => baseUserPayload({ profile: {} }),
    });
    await pullProfileFromCloud();
    expect(JSON.parse(localStorage.getItem("personaUserProfile")).favoriteMode).toBe("emoji");
  });

  it("badges/wallpapers/titres cloud jamais régressifs — ajoutés au local existant, rien retiré", async () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({ badges: ["first_win"], unlockedWallpapers: ["kamoshida_palace"], unlockedTitles: [] })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        baseUserPayload({
          badges: [{ badge_id: "first_win" }, { badge_id: "ace_detective" }],
          unlocked_wallpapers: ["kamoshida_palace"],
          unlocked_titles: [{ slug: "phantom_thief" }],
        }),
    });

    await pullProfileFromCloud();

    const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(profile.badges.sort()).toEqual(["ace_detective", "first_win"]);
    expect(profile.unlockedWallpapers).toEqual(["kamoshida_palace"]);
    expect(profile.unlockedTitles).toEqual(["phantom_thief"]);
  });
});

describe("pushLangToCloud", () => {
  it("ne fait rien sans utilisateur connecté", () => {
    delete globalThis.window._currentUser;
    const updateSpy = vi.fn();
    globalThis.window._personadleApi = { user: { update: updateSpy } };

    pushLangToCloud("fr");

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ne fait rien sans bridge api disponible", () => {
    delete globalThis.window._personadleApi;

    expect(() => pushLangToCloud("fr")).not.toThrow();
  });

  it("pousse la langue vers le backend pour l'utilisateur courant", () => {
    const updateSpy = vi.fn().mockResolvedValue({});
    globalThis.window._personadleApi.user = { update: updateSpy };

    pushLangToCloud("fr");

    expect(updateSpy).toHaveBeenCalledWith(USER_ID, { lang: "fr" });
  });

  it("avale silencieusement une erreur backend (fire-and-forget)", async () => {
    const updateSpy = vi.fn().mockRejectedValue(new Error("network"));
    globalThis.window._personadleApi.user = { update: updateSpy };

    expect(() => pushLangToCloud("fr")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe("pullProfileFromCloud — stats Expert (user_stats_expert)", () => {
  it("expert_stats descend dans stats.expert sans toucher aux compteurs normaux ; tableau vide → effacé ; absent → inchangé", async () => {
    const pull = async (extra) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true, status: 200,
        json: async () => baseUserPayload({ stats: [{ mode: "alloutattack", wins: 30, games: 35, perfect_wins: 20, streak_record: 4 }], ...extra }),
      });
      await pullProfileFromCloud();
      return JSON.parse(localStorage.getItem("personaUserProfile")).stats;
    };
    let s = await pull({ expert_stats: [{ mode: "alloutattack", wins: 10, giveups: 2, games: 12, perfect_wins: 5, streak_record: 9 }, { mode: "music", wins: 1, games: 1 }] });
    expect(s.wins, "le total normal reste normal (le profil l'affiche à part)").toBe(30);
    expect(s.expert).toEqual({ wins: 11, giveups: 2, games: 13, perfectWins: 5, streakRecord: 9, modeWins: { AllOutAttack: 10, Music: 1 }, modeCount: { AllOutAttack: 12, Music: 1 } });

    s = await pull({});
    expect(s.expert, "backend antérieur : on garde ce qu'on avait").toBeDefined();

    s = await pull({ expert_stats: [] });
    expect(s.expert, "aucune partie Expert → pas de vue Expert").toBeUndefined();
  });
});
