/**
 * check-i18n.js
 * Vérifie que toutes les clés de lang/en.json existent dans les autres fichiers de langue.
 * Usage: node scripts/check-i18n.js
 *        npm run i18n:check
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANG_DIR  = path.join(__dirname, '..', 'lang');
const BASE_LANG  = 'en';
const TARGET_LANGS = ['fr', 'es', 'de'];

// Aplatit un objet JSON imbriqué en clés pointées
// { modes: { classic: { title: "..." } } } → ["modes.classic.title"]
function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? flatten(value, fullKey)
      : [fullKey];
  });
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`❌ Cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
}

const baseFile = path.join(LANG_DIR, `${BASE_LANG}.json`);
const base = loadJson(baseFile);
const baseKeys = flatten(base);

console.log(`\n📋 PersonaDLE i18n check`);
console.log(`Base: ${BASE_LANG}.json (${baseKeys.length} keys)\n`);

let hasErrors = false;

for (const lang of TARGET_LANGS) {
  const file = path.join(LANG_DIR, `${lang}.json`);

  if (!fs.existsSync(file)) {
    console.warn(`⚠️  ${lang}.json not found — skipping`);
    continue;
  }

  const target = loadJson(file);
  const targetKeys = new Set(flatten(target));

  const missing = baseKeys.filter(k => !targetKeys.has(k));
  const extra   = [...targetKeys].filter(k => !baseKeys.includes(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅ ${lang}.json — all ${baseKeys.length} keys present`);
  } else {
    hasErrors = true;
    console.log(`❌ ${lang}.json:`);
    if (missing.length > 0) {
      console.log(`   Missing (${missing.length}):`);
      missing.forEach(k => console.log(`     - ${k}`));
    }
    if (extra.length > 0) {
      console.log(`   Extra keys not in EN (${extra.length}):`);
      extra.forEach(k => console.log(`     + ${k}`));
    }
  }
}

console.log('');
process.exit(hasErrors ? 1 : 0);
