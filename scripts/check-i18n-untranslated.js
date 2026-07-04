/**
 * check-i18n-untranslated.js
 * Repère les clés dont la valeur FR/ES/DE/IT est identique à l'anglais —
 * signe probable d'une traduction jamais faite (copié-collé de en.json).
 *
 * Rapport uniquement (advisory) : ne fait JAMAIS échouer la commande.
 * Beaucoup de correspondances sont volontaires (voir CLAUDE.md §5 —
 * noms de persos/personas, titres de musiques, codes opus, termes de lore),
 * donc ce script sert à repérer les candidats à vérifier, pas à les
 * corriger automatiquement.
 *
 * Usage: node scripts/check-i18n-untranslated.js [--silent]
 *        npm run i18n:check-untranslated
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANG_DIR = path.join(__dirname, "..", "lang");
const BASE_LANG = "en";
const TARGET_LANGS = ["fr", "es", "de", "it"];

const isSilent = process.argv.includes("--silent");
const log = (...args) => {
  if (!isSilent) console.log(...args);
};

function flattenWithValues(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return flattenWithValues(value, fullKey);
    }
    return [{ key: fullKey, value }];
  });
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// Une valeur ne contenant que des placeholders {{...}}, symboles ou chiffres
// n'a de toute façon rien à traduire — pas la peine de la lister.
function isTranslatableText(value) {
  const stripped = value.replace(/\{\{[^}]+\}\}/g, "").trim();
  return /[a-zA-Z]{2,}/.test(stripped);
}

const base = loadJson(path.join(LANG_DIR, `${BASE_LANG}.json`));
const baseEntries = new Map(flattenWithValues(base).map(({ key, value }) => [key, value]));

log(`\n📋 PersonaDLE i18n — valeurs identiques à l'anglais (candidats non traduits)\n`);

let totalCandidates = 0;

for (const lang of TARGET_LANGS) {
  const file = path.join(LANG_DIR, `${lang}.json`);
  if (!fs.existsSync(file)) continue;

  const target = flattenWithValues(loadJson(file));
  const identical = target.filter(({ key, value }) => {
    if (typeof value !== "string" || value.trim() === "") return false;
    const enValue = baseEntries.get(key);
    if (typeof enValue !== "string") return false;
    return enValue.trim() === value.trim() && isTranslatableText(value);
  });

  totalCandidates += identical.length;

  if (identical.length === 0) {
    log(`✅ ${lang}.json — aucune valeur suspecte`);
    continue;
  }

  log(`⚠️  ${lang}.json — ${identical.length} valeur(s) identique(s) à l'anglais :`);
  identical.forEach(({ key, value }) => log(`     ${key} => ${JSON.stringify(value)}`));
}

log(
  `\nRappel (CLAUDE.md §5) : ne pas traduire noms de persos/personas, titres de` +
    ` musiques, codes opus, termes de lore — ces correspondances sont attendues.` +
    ` À vérifier surtout les phrases ordinaires (verbes, articles, ponctuation).\n`
);
log(`Total : ${totalCandidates} candidat(s) à travers les 4 langues cibles.\n`);

// Toujours exit 0 — ce script informe, il ne bloque jamais un commit/CI.
process.exit(0);
