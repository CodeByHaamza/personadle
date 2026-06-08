/**
 * check-i18n.js
 * Vérifie que toutes les clés de lang/en.json existent dans les autres fichiers de langue.
 * Détecte aussi les valeurs vides ("" ou whitespace).
 * Usage: node scripts/check-i18n.js [--silent]
 *        npm run i18n:check
 *
 * --silent : supprime l'output sauf les erreurs (utile pour le pre-commit hook)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANG_DIR = path.join(__dirname, "..", "lang");
const BASE_LANG = "en";
const TARGET_LANGS = ["fr", "es", "de", "it"];

const isSilent = process.argv.includes("--silent");
const log = (...args) => { if (!isSilent) console.log(...args); };
const logError = (...args) => { console.error(...args); };

// Aplatit un objet JSON imbriqué en clés pointées
// { modes: { classic: { title: "..." } } } → ["modes.classic.title"]
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? flatten(value, fullKey)
      : [fullKey];
  });
}

// Aplatit en gardant les valeurs pour détecter les chaînes vides
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
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    logError(`❌ Cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
}

const baseFile = path.join(LANG_DIR, `${BASE_LANG}.json`);
const base = loadJson(baseFile);
const baseKeys = flatten(base);
const baseEntries = flattenWithValues(base);

log(`\n📋 PersonaDLE i18n check`);
log(`Base: ${BASE_LANG}.json (${baseKeys.length} keys)\n`);

let hasErrors = false;

// Vérifier les valeurs vides dans EN lui-même
const emptyInBase = baseEntries.filter(({ value }) => typeof value === "string" && value.trim() === "");
if (emptyInBase.length > 0) {
  hasErrors = true;
  logError(`⚠️  ${BASE_LANG}.json — empty values (${emptyInBase.length}):`);
  emptyInBase.forEach(({ key }) => logError(`     ⬜ ${key}`));
}

for (const lang of TARGET_LANGS) {
  const file = path.join(LANG_DIR, `${lang}.json`);

  if (!fs.existsSync(file)) {
    log(`⚠️  ${lang}.json not found — skipping`);
    continue;
  }

  const target = loadJson(file);
  const targetKeys = new Set(flatten(target));
  const targetEntries = flattenWithValues(target);

  const missing = baseKeys.filter((k) => !targetKeys.has(k));
  const extra = [...targetKeys].filter((k) => !baseKeys.includes(k));
  const emptyValues = targetEntries.filter(({ key, value }) =>
    baseKeys.includes(key) && typeof value === "string" && value.trim() === ""
  );

  if (missing.length === 0 && extra.length === 0 && emptyValues.length === 0) {
    log(`✅ ${lang}.json — all ${baseKeys.length} keys present`);
  } else {
    hasErrors = true;
    logError(`❌ ${lang}.json:`);
    if (missing.length > 0) {
      logError(`   Missing (${missing.length}):`);
      missing.forEach((k) => logError(`     - ${k}`));
    }
    if (extra.length > 0) {
      logError(`   Extra keys not in EN (${extra.length}):`);
      extra.forEach((k) => logError(`     + ${k}`));
    }
    if (emptyValues.length > 0) {
      logError(`   Empty values (${emptyValues.length}):`);
      emptyValues.forEach(({ key }) => logError(`     ⬜ ${key}`));
    }
  }
}

log("");
process.exit(hasErrors ? 1 : 0);
