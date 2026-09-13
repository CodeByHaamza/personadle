/**
 * compendium_page.test.js — profile/compendium/compendium.js (2.2)
 *
 * La page du Compendium : couverture → livre, onglets de chapitres, pagination,
 * rendu des entrées (nom, texte d'ambiance, date locale ou « avant le
 * compendium »), et les états d'erreur (déconnecté, joueur introuvable).
 * Les animations sont neutralisées via prefers-reduced-motion pour rester
 * synchrones.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const HTML = `
  <main class="cp-stage">
    <p><a href="../profile.html" id="cpBackLink"><span>My Profile</span></a></p>
    <section class="cp-cover" id="cpCover">
      <p id="cpOwner">…</p>
      <button type="button" id="cpOpenBtn">Open</button>
      <p class="hidden" id="cpCoverState"></p>
    </section>
    <section class="cp-book hidden" id="cpBook">
      <nav id="cpTabs"></nav>
      <div class="cp-spread">
        <article id="cpPageLeft"></article>
        <article id="cpPageRight"></article>
      </div>
      <button id="cpPrev">‹</button><span id="cpPagerInfo"></span><button id="cpNext">›</button>
    </section>
  </main>`;

const DATA = {
  user: { id: 23, pseudo: "Hamza", friend_code: "GT2UJPML" },
  badges: Array.from({ length: 7 }, (_, i) => ({
    badge_id: `b${i}`,
    unlocked_at: `2026-09-0${i + 1} 10:00:00`,
  })),
  titles: [],
  wallpapers: [],
  friends: [
    {
      id: 2,
      pseudo: "Futaba",
      avatar_data: null,
      avatar_border_color: "#fff",
      accepted_at: null,
      rank: 7,
      rank_ups: [],
    },
  ],
  challenges: [
    {
      id: 1,
      direction: "received",
      partner: { id: 2, pseudo: "Futaba" },
      mode: "emoji",
      is_expert: false,
      score: 1,
      status: "beaten",
      at: "2026-09-10 18:00:00",
    },
  ],
  feats: {
    first_game: "2026-08-25",
    total_games: 3,
    total_wins: 2,
    days_played: 2,
    streak_record: 2,
    first_wins: [],
    first_perfects: [],
    expert_modes: [],
  },
};

// i18n minimal : quelques clés réelles, le reste retombe sur le fallback du code
const DICT = {
  "compendium.undated": "Avant le Compendium",
  "compendium.rank": "Rang {{n}}",
  "compendium.tries_one": "1 essai",
  "compendium.tries": "{{n}} essais",
  "compendium.flavor.challenge_won": "{{name}} — {{mode}} — battu en {{score}}.",
  "compendium.chapter.badges": "Badges",
  "compendium.chapter.bonds": "Liens",
  "modes.emoji.name": "Emoji",
  "badges.b0.name": "Premier badge",
  "compendium.not_found": "Aucun Compendium pour ce joueur.",
  "compendium.login_required": "Connecte-toi pour ouvrir ton Compendium.",
};

async function boot({ data = DATA, user = { id: 23 }, search = "", apiError = null } = {}) {
  vi.resetModules();
  document.body.innerHTML = HTML;
  window.history.replaceState({}, "", `/profile/compendium/compendium.html${search}`);
  window.matchMedia = () => ({ matches: true }); // reduced motion → rendu synchrone
  window.i18n = {
    t: (key, vars = {}) => {
      const s = DICT[key];
      if (s == null) return key;
      return s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
    },
    getCurrentLang: () => "fr",
  };
  window._currentUser = user;
  const compendium = vi.fn(async () => {
    if (apiError) throw apiError;
    return data;
  });
  window._personadleApi = { user: { compendium } };
  const mod = await import("../profile/compendium/compendium.js");
  await mod.initCompendium();
  return { mod, compendium };
}

beforeEach(() => {
  delete window._currentUser;
  delete window._personadleApi;
});

describe("couverture", () => {
  it("charge le carnet du joueur connecté et affiche son pseudo", async () => {
    const { compendium } = await boot();
    expect(compendium).toHaveBeenCalledWith({});
    expect(document.getElementById("cpOwner").textContent).toBe("Hamza");
    expect(document.getElementById("cpOpenBtn").disabled).toBe(false);
  });

  it("?view=CODE demande le carnet de ce joueur et renvoie vers son profil", async () => {
    const { compendium } = await boot({ user: null, search: "?view=SEED2222" });
    expect(compendium).toHaveBeenCalledWith({ code: "SEED2222" });
    expect(document.getElementById("cpBackLink").getAttribute("href")).toBe(
      "../profile.html?view=SEED2222"
    );
  });

  it("déconnecté et sans ?view : invite à se connecter, bouton désactivé", async () => {
    const { compendium } = await boot({ user: null });
    expect(compendium).not.toHaveBeenCalled();
    expect(document.getElementById("cpOpenBtn").disabled).toBe(true);
    expect(document.getElementById("cpCoverState").textContent).toBe(
      "Connecte-toi pour ouvrir ton Compendium."
    );
  });

  it("joueur introuvable (404) : message dédié", async () => {
    await boot({ search: "?view=NOPE", apiError: Object.assign(new Error("nf"), { status: 404 }) });
    expect(document.getElementById("cpCoverState").textContent).toBe(
      "Aucun Compendium pour ce joueur."
    );
    expect(document.getElementById("cpOpenBtn").disabled).toBe(true);
  });
});

describe("livre ouvert", () => {
  it("ouvre sur les badges, avec un onglet par chapitre et son compteur", async () => {
    await boot();
    document.getElementById("cpOpenBtn").click();
    expect(document.getElementById("cpCover").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("cpBook").classList.contains("hidden")).toBe(false);
    const tabs = [...document.querySelectorAll(".cp-tab")];
    expect(tabs.map((b) => b.dataset.chapter)).toEqual([
      "badges",
      "titles",
      "wallpapers",
      "bonds",
      "challenges",
      "feats",
    ]);
    expect(tabs[0].classList.contains("active")).toBe(true);
    expect(tabs[0].querySelector(".cp-tab__count").textContent).toBe("7");
  });

  it("pagine à 5 entrées par page et navigue avec ‹ › et les flèches clavier", async () => {
    await boot();
    document.getElementById("cpOpenBtn").click();
    expect(document.querySelectorAll(".cp-entry")).toHaveLength(5);
    expect(document.getElementById("cpPagerInfo").textContent).toBe("1 / 2");
    expect(document.getElementById("cpPrev").disabled).toBe(true);

    document.getElementById("cpNext").click();
    expect(document.querySelectorAll(".cp-entry")).toHaveLength(2);
    expect(document.getElementById("cpPagerInfo").textContent).toBe("2 / 2");
    expect(document.getElementById("cpNext").disabled).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(document.getElementById("cpPagerInfo").textContent).toBe("1 / 2");
  });

  it("un badge affiche son nom i18n et sa date locale longue", async () => {
    await boot();
    document.getElementById("cpOpenBtn").click();
    // b6 est le plus récent (tri décroissant) ; b0 est en page 2
    document.getElementById("cpNext").click();
    const last = [...document.querySelectorAll(".cp-entry")].at(-1);
    expect(last.querySelector(".cp-entry__title").textContent).toContain("Premier badge");
    expect(last.querySelector(".cp-entry__date").textContent).toBe("1 septembre 2026");
  });

  it("changer de chapitre remet à la page 1 et rend les pastilles (rang, mode) et le score en essais", async () => {
    await boot();
    document.getElementById("cpOpenBtn").click();
    document.querySelector('.cp-tab[data-chapter="bonds"]').click();
    expect(document.getElementById("cpPagerInfo").textContent).toBe("1 / 1");
    const bonds = [...document.querySelectorAll(".cp-entry")];
    // Futaba : création (non datée) + rang 7 sans historique → deux entrées « avant le compendium »
    expect(bonds).toHaveLength(2);
    expect(bonds.some((e) => e.querySelector(".cp-pill--rank")?.textContent === "Rang 7")).toBe(
      true
    );
    expect(bonds.every((e) => e.querySelector(".cp-entry__date--undated"))).toBe(true);

    document.querySelector('.cp-tab[data-chapter="challenges"]').click();
    const c = document.querySelector(".cp-entry");
    expect(c.classList.contains("cp-entry--won")).toBe(true);
    expect(c.querySelector(".cp-entry__flavor").textContent).toBe(
      "Futaba — Emoji — battu en 1 essai."
    );
    expect(c.querySelector(".cp-pill:not(.cp-pill--rank)").textContent).toContain("Emoji");
  });

  it("un chapitre vide affiche son message plutôt qu'une liste", async () => {
    await boot();
    document.getElementById("cpOpenBtn").click();
    document.querySelector('.cp-tab[data-chapter="titles"]').click();
    expect(document.querySelector(".cp-entries")).toBeNull();
    expect(document.querySelector(".cp-empty")).not.toBeNull();
    expect(document.getElementById("cpPagerInfo").textContent).toBe("1 / 1");
  });
});
