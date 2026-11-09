/**
 * profile_view_i18n.test.js — Le profil d'un autre joueur parle la langue du site.
 *
 * Vu le 2026-11-09 sur la prod, profil public en français : la section des fonds
 * d'écran disait « 7 wallpapers unlocked » (anglais codé en dur) sous un titre
 * « Fonds d'écran à débloquer » — titre de SON propre profil, qui n'a pas de sens
 * sur celui d'un autre. Même chose pour l'état vide « Nothing to see here… yet. ».
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const VIEW_SRC = readFileSync(join(ROOT, "profile/profile-view.js"), "utf8");
const LANGS = ["en", "fr", "es", "de", "it", "pt"];
const KEYS = ["wallpapers_view_title", "wallpapers_view_count", "view_nothing_yet"];

describe("profil public — fonds d'écran", () => {
  it.each(LANGS)("%s : les trois textes existent et sont traduits", (lang) => {
    const profile = JSON.parse(readFileSync(join(ROOT, "lang", `${lang}.json`), "utf8")).profile;
    for (const key of KEYS) expect(profile[key], `${lang}.profile.${key}`).toBeTruthy();
    expect(profile.wallpapers_view_count).toContain("{{count}}");
  });

  it("la vue passe par l'i18n, plus de phrase anglaise en dur", () => {
    for (const key of KEYS) expect(VIEW_SRC).toContain(`profile.${key}`);
    expect(VIEW_SRC).not.toMatch(/wallpaper\$\{[^}]*\}\s*unlocked/);
  });
});
