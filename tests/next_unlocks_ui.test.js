/**
 * next_unlocks_ui.test.js — carte « Presque là » du profil (profile/next_unlocks_ui.js),
 * 2.4 lot 11.
 *
 * Ce qui compte : libellés justes par sorte (badge traduit côté client, titre déjà
 * traduit par l'API, quête Expert construite en i18n), HTML échappé, barre au bon
 * pourcentage, et carte cachée pour un invité ou une API muette.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  badgeThumbPath,
  buildNextUnlocksHTML,
  nextUnlockLabel,
  renderNextUnlocks,
} from "../profile/next_unlocks_ui.js";

const badge = {
  kind: "badge",
  slug: "shadow_slayer",
  name: null,
  image: "profile/badges/images/x.png",
  description: "Win 5 Silhouette games",
  condition_type: "mode_wins",
  condition_mode: "silhouette",
  current: 4,
  required: 5,
};
const title = {
  kind: "title",
  slug: "yosuke_ride_the_wind",
  name: "Ride the <Wind>",
  image: "titles/yosuke_ride_the_wind.webp",
  description: "Have 5 friends",
  condition_type: "friends_count",
  current: 1,
  required: 5,
};
const expert = {
  kind: "expert",
  slug: "silhouette",
  name: null,
  image: null,
  condition_type: "mode_wins_under_attempts",
  condition_mode: "silhouette",
  current: 3,
  required: 10,
};

describe("nextUnlockLabel", () => {
  it("falls back to the server text, and builds the Expert line itself", () => {
    expect(nextUnlockLabel(badge)).toEqual({
      name: "shadow_slayer",
      condition: "Win 5 Silhouette games",
    });
    expect(nextUnlockLabel(title).name).toBe("Ride the <Wind>");
    const e = nextUnlockLabel(expert);
    expect(e.name).toBe("Expert mode — Silhouette");
    expect(e.condition).toBe("Win 10 games in 4 attempts or fewer");
  });
});

describe("buildNextUnlocksHTML", () => {
  it("shows the real badge (as a light thumbnail), icons for titles and Expert, escaped", () => {
    const doc = new DOMParser().parseFromString(
      `<ul>${buildNextUnlocksHTML([{ ...badge, rarity: "rare" }, title, expert], "../")}</ul>`,
      "text/html"
    );
    const rows = doc.querySelectorAll(".next-unlock");
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector(".next-unlock__bar > span").style.width).toBe("80%");
    expect(rows[0].querySelector(".next-unlock__count").textContent).toBe("4 / 5");
    // Badge : sa miniature (jamais l'original de plusieurs Mo), pastille de secours.
    const img = rows[0].querySelector("img");
    expect(img.getAttribute("src")).toBe("../profile/badges/thumbs/x.webp");
    expect(img.dataset.fallback).toBe("🏅");
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(rows[1].querySelector(".next-unlock__img--title").textContent).toBe("🎖️");
    expect(rows[2].querySelector(".next-unlock__img--expert").textContent).toBe("⚡");
    // Échappé : le nom ne devient jamais du HTML.
    expect(rows[1].querySelector(".next-unlock__name").textContent).toBe("Ride the <Wind>");
    expect(rows[1].querySelector("wind")).toBeNull();
  });
});

describe("badgeThumbPath", () => {
  it("maps an original to its snake_case webp thumbnail", () => {
    expect(badgeThumbPath("profile/badges/images/Badges_Burn_My_Dread_Silver.png")).toBe(
      "profile/badges/thumbs/badges_burn_my_dread_silver.webp"
    );
    expect(badgeThumbPath("")).toBeNull();
  });

  it("every badge image has its thumbnail (scripts/badge_thumbs.py was run)", () => {
    const root = join(__dirname, "..");
    const missing = readdirSync(join(root, "profile/badges/images"))
      .filter((f) => /\.(png|webp|jpe?g|gif)$/i.test(f))
      .map((f) => badgeThumbPath(`profile/badges/images/${f}`))
      .filter((thumb) => !existsSync(join(root, thumb)));
    expect(missing, "relance python scripts/badge_thumbs.py").toEqual([]);
  });
});

describe("renderNextUnlocks", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="nextUnlocksCard" hidden><ul id="nextUnlocksList"></ul></div>`;
  });
  afterEach(() => {
    delete window._currentUser;
  });

  it("stays hidden for a guest", async () => {
    const api = { user: { nextUnlocks: async () => ({ items: [badge] }) } };
    expect(await renderNextUnlocks({ api })).toBe(false);
    expect(document.getElementById("nextUnlocksCard").hidden).toBe(true);
  });

  it("shows the list for a signed-in player, and hides it when empty or failing", async () => {
    window._currentUser = { id: 1 };
    expect(
      await renderNextUnlocks({ api: { user: { nextUnlocks: async () => ({ items: [badge] }) } } })
    ).toBe(true);
    expect(document.getElementById("nextUnlocksCard").hidden).toBe(false);
    expect(document.querySelectorAll(".next-unlock")).toHaveLength(1);

    expect(
      await renderNextUnlocks({ api: { user: { nextUnlocks: async () => ({ items: [] }) } } })
    ).toBe(false);
    expect(document.getElementById("nextUnlocksCard").hidden).toBe(true);

    const failing = {
      user: {
        nextUnlocks: async () => {
          throw new Error("500");
        },
      },
    };
    expect(await renderNextUnlocks({ api: failing })).toBe(false);
  });
});
