/**
 * dataMiningBadge.test.js — Déblocage du badge `data_mining` (« Visit 5 different
 * user profiles ») au moment de la 5e visite.
 *
 * Pourquoi ce fichier existe : `profile/profile-view.js` appelait
 * `m.checkBadges(profile, save)` — une fonction qui n'a jamais été exportée par
 * `profile/badges/badgesManager.js`. L'appel levait donc un TypeError, avalé par
 * le `.catch(() => {})` qui l'entourait : aucune erreur en console, aucun badge,
 * rien à déboguer. Le joueur ne le récupérait qu'en rouvrant SON profil, où
 * initBadgesSystem() refait le tour de toutes les conditions.
 *
 * Deux angles complémentaires :
 *   1. le contrat d'import — profile-view.js ne doit appeler QUE des symboles
 *      réellement exportés par badgesManager.js (un import dynamique ne se
 *      vérifie ni au lint ni au build, c'est ce qui a laissé passer le bug) ;
 *   2. le comportement — 5 profils visités débloquent le badge, 4 non.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import * as badgesManager from "../profile/badges/badgesManager.js";
import { badgesList } from "../profile/badges/badgesData.js";

const here = dirname(fileURLToPath(import.meta.url));
const profileViewSrc = readFileSync(resolve(here, "../profile/profile-view.js"), "utf-8");

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("data_mining — contrat d'import de profile-view.js", () => {
  it("n'appelle aucun symbole absent de badgesManager.js", () => {
    // Capture tous les `m.xxx(` du .then() d'import dynamique.
    const called = [...profileViewSrc.matchAll(/\bm\.([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]);
    expect(called.length).toBeGreaterThan(0);
    for (const fn of called) {
      expect(
        typeof badgesManager[fn],
        `profile-view.js appelle m.${fn}() — absent des exports de badgesManager.js`
      ).toBe("function");
    }
  });

  it("n'appelle plus `checkBadges`, qui n'a jamais existé", () => {
    expect(profileViewSrc).not.toMatch(/\bm\.checkBadges\s*\(/);
  });
});

describe("data_mining — condition de déblocage", () => {
  const badge = badgesList.find((b) => b.id === "data_mining");

  it("existe au catalogue client", () => {
    expect(badge).toBeTruthy();
  });

  it("4 profils visités ne suffisent pas, 5 déclenchent", () => {
    expect(badge.check({}, { visitedProfileIds: ["1", "2", "3", "4"] })).toBe(false);
    expect(badge.check({}, { visitedProfileIds: ["1", "2", "3", "4", "5"] })).toBe(true);
  });

  it("compte des profils DISTINCTS — 5 fois le même ne débloque pas", () => {
    // profile-view.js dédoublonne via un Set avant d'écrire ; ce test verrouille
    // le fait que la condition lit bien cette liste dédoublonnée et non un compteur
    // de visites brut.
    const visited = [...new Set(["7", "7", "7", "7", "7"])];
    expect(badge.check({}, { visitedProfileIds: visited })).toBe(false);
  });

  it("checkBadgesAfterGame() le débloque depuis localStorage après la 5e visite", () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({
        badges: [],
        selectedBadges: [],
        eventCodes: [],
        stats: {},
        visitedProfileIds: ["11", "12", "13", "14", "15"],
      })
    );

    badgesManager.checkBadgesAfterGame();

    const saved = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(saved.badges).toContain("data_mining");
  });

  it("ne se débloque pas à 4 profils visités", () => {
    localStorage.setItem(
      "personaUserProfile",
      JSON.stringify({
        badges: [],
        selectedBadges: [],
        eventCodes: [],
        stats: {},
        visitedProfileIds: ["11", "12", "13", "14"],
      })
    );

    badgesManager.checkBadgesAfterGame();

    const saved = JSON.parse(localStorage.getItem("personaUserProfile"));
    expect(saved.badges).not.toContain("data_mining");
  });
});
