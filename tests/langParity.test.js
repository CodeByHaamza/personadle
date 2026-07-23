/**
 * langParity.test.js — Vérifie que chaque fichier de langue (fr/es/de/it/pt)
 * couvre exactement les clés de en.json (source de vérité) et garde les mêmes
 * placeholders {{variable}}. Double le garde-fou de scripts/check-i18n.js
 * directement dans la suite Vitest (échec visible dès `npm test`).
 *
 * Ajouté avec le portugais (pt) — sans ce test, une clé oubliée dans pt.json ne
 * serait attrapée qu'au `npm run i18n:check`, pas dans la suite unitaire.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LANG_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "lang");
const TARGET_LANGS = ["fr", "es", "de", "it", "pt"];

/** Aplati un objet imbriqué en Map("a.b.c" → valeur feuille). */
function flatten(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

/** Ensemble trié des placeholders {{var}} d'une chaîne. */
function vars(str) {
  return typeof str === "string" ? (str.match(/\{\{\w+\}\}/g) || []).sort().join(",") : "";
}

const load = (lang) => JSON.parse(readFileSync(join(LANG_DIR, `${lang}.json`), "utf-8"));
const enFlat = flatten(load("en"));

describe("i18n language parity (en = source of truth)", () => {
  for (const lang of TARGET_LANGS) {
    describe(`${lang}.json`, () => {
      const langFlat = flatten(load(lang));

      it("has no missing keys vs en.json", () => {
        const missing = [...enFlat.keys()].filter((k) => !langFlat.has(k));
        expect(missing).toEqual([]);
      });

      it("has no extra keys vs en.json", () => {
        const extra = [...langFlat.keys()].filter((k) => !enFlat.has(k));
        expect(extra).toEqual([]);
      });

      it("keeps the same {{placeholders}} on every string", () => {
        const mismatches = [...enFlat.entries()]
          .filter(([k, v]) => typeof v === "string" && vars(v) !== vars(langFlat.get(k)))
          .map(([k]) => k);
        expect(mismatches).toEqual([]);
      });
    });
  }
});
