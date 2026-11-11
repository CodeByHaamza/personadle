/**
 * one_gear_per_mode.test.js — Un seul ⚙ par page de mode (2.4, lot 14).
 *
 * Le bouton FILTRES et le bouton Paramètres portaient tous deux un engrenage :
 * deux ⚙ par page pour deux choses différentes. Les filtres ont désormais un
 * entonnoir ; l'engrenage reste aux Paramètres.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGES = [
  "classiqueMode/classiqueMode.html",
  "emojiMode/emojiMode.html",
  "silhouetteMode/silhouette.html",
  "allOutAttackMode/allOutAttack.html",
  "personaeMode/personae.html",
  "musicsMode/musics.html",
];

describe("one gear per mode page", () => {
  it.each(PAGES)("%s", (file) => {
    const doc = new DOMParser().parseFromString(
      readFileSync(join(__dirname, "..", file), "utf8"),
      "text/html"
    );
    const gears = [...doc.body.querySelectorAll("*")].filter((el) =>
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes("⚙"))
    );
    expect(gears.map((g) => g.id || g.className)).toEqual(["settingsBtn"]);
    expect(doc.querySelector("#filterToggleBtn svg.filter-toggle-icon")).not.toBeNull();
  });
});
