/**
 * home_captions.test.js — Une ligne sous chaque mode (2.4, lot 13).
 *
 * Les bannières de l'accueil sont des images : rien ne disait ce qu'on fait dans
 * chaque mode. Chaque bannière porte une légende traduite, et la feuille « Jouer »
 * (téléphone, où la bannière est trop petite pour l'écrire dessus) reprend la même.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlaySheetHTML } from "../js/bottomNav.js";

const ROOT = join(__dirname, "..");
const MODES = ["classic", "emoji", "alloutattack", "silhouette", "personae", "music"];

describe("home mode captions", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const doc = new DOMParser().parseFromString(html, "text/html");

  it("each of the six banners has its caption, inside the button", () => {
    for (const key of MODES) {
      const cap = doc.querySelector(`[data-i18n="index.mode_caption_${key}"]`);
      expect(cap, key).not.toBeNull();
      expect(cap.closest("#gameModeSelector > button"), key).not.toBeNull();
    }
  });

  it("every caption key exists in the six languages", () => {
    for (const lang of ["en", "fr", "es", "de", "it", "pt"]) {
      const dict = JSON.parse(readFileSync(join(ROOT, "lang", `${lang}.json`), "utf8"));
      for (const key of MODES)
        expect(dict.index[`mode_caption_${key}`], `${lang}.${key}`).toBeTruthy();
    }
  });

  it("the play sheet shows the caption under each mode name", () => {
    const progress = {
      done: 0,
      total: 6,
      modes: MODES.map((key) => ({ key, label: key, done: false })),
    };
    const sheet = new DOMParser().parseFromString(
      buildPlaySheetHTML(progress, "/index.html"),
      "text/html"
    );
    expect(sheet.querySelectorAll(".play-sheet-caption")).toHaveLength(6);
  });
});
