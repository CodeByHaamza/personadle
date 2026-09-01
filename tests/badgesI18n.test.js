import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { badgesList } from "../profile/badges/badgesData.js";

/**
 * Garde-fou i18n sur les badges (2.1).
 *
 * Une bonne moitié des noms de badges était restée en anglais dans fr/es/de/it :
 * rien ne le signalait, parce qu'une valeur anglaise recopiée est une valeur
 * *présente* — `check-i18n.js` ne vérifie que la présence des clés, pas leur
 * traduction. Ces tests vérifient la traduction elle-même.
 */

const LANG_CODES = ["fr", "es", "de", "it", "pt"];
// Même résolution de chemin que langParity.test.js : `new URL(..., import.meta.url)`
// ne résout pas correctement sous le transform Vitest sur ce projet.
const LANG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "lang");
const load = (code) => JSON.parse(readFileSync(join(LANG_DIR, `${code}.json`), "utf8"));

const en = load("en");
const LANGS = Object.fromEntries(LANG_CODES.map((c) => [c, load(c)]));

/** Badges dont le nom DOIT rester identique à l'anglais dans toutes les langues. */
const KEEP_ORIGINAL = new Set([
  "burn_my_dread", // « Memento Mori » — locution latine
  "hippocampus_reload", // « Reload » = Persona 3 Reload, nom propre
  "golden_week", // période fériée japonaise
  "tanabata", // fête japonaise
]);

/** Ids de badges réellement définis (les autres clés de `badges` sont de l'UI). */
const badgeIds = badgesList.map((b) => b.id);

describe("badges — i18n", () => {
  it("chaque badge de badgesData.js a son entrée dans en.json", () => {
    const missing = badgeIds.filter((id) => !en.badges?.[id]);
    expect(missing).toEqual([]);
  });

  it("chaque badge est traduit dans les 5 langues (nom différent de l'anglais)", () => {
    // Un nom recopié tel quel depuis l'anglais passe `i18n:check` sans broncher :
    // la clé existe. C'est exactement comme ça que la moitié des badges est restée
    // en VO jusqu'à la 2.1.
    const untranslated = [];
    for (const id of badgeIds) {
      if (KEEP_ORIGINAL.has(id)) continue;
      for (const code of LANG_CODES) {
        if (LANGS[code].badges?.[id]?.name === en.badges[id].name) {
          untranslated.push(`${code}/${id}`);
        }
      }
    }
    expect(untranslated).toEqual([]);
  });

  it("les badges gardés en VO le sont dans TOUTES les langues, pas au hasard", () => {
    // Sinon « VO assumée » devient un fourre-tout où l'on range les oublis.
    for (const id of KEEP_ORIGINAL) {
      for (const code of LANG_CODES) {
        expect(LANGS[code].badges?.[id]?.name, `${code}/${id}`).toBe(en.badges[id].name);
      }
    }
  });

  it("aucun badge n'a de nom, condition ou description vide", () => {
    const empty = [];
    for (const id of badgeIds) {
      for (const code of ["en", ...LANG_CODES]) {
        const entry = (code === "en" ? en : LANGS[code]).badges?.[id];
        for (const field of ["name", "condition", "description"]) {
          if (!entry?.[field]?.trim()) empty.push(`${code}/${id}.${field}`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it("une condition secrète reste « ??? » dans toutes les langues", () => {
    // Traduire « ??? » n'aurait aucun sens, mais l'inverse en a un : un badge
    // secret dont une seule langue divulgue la condition fuite le secret.
    const leaked = [];
    for (const id of badgeIds) {
      if (en.badges[id].condition !== "???") continue;
      for (const code of LANG_CODES) {
        if (LANGS[code].badges?.[id]?.condition !== "???") leaked.push(`${code}/${id}`);
      }
    }
    expect(leaked).toEqual([]);
  });
});
