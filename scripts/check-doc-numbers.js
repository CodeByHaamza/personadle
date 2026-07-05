#!/usr/bin/env node
/**
 * scripts/check-doc-numbers.js — Vérifie (et corrige avec --fix) que les chiffres
 * cités dans la documentation (CLAUDE.md, README.md, ROADMAP.md, CONTRIBUTING.md,
 * tests/README.md) reflètent la réalité du projet : nombre de tests Vitest/PHPUnit/
 * E2E, nombre de tables SQL, nombre de clés i18n.
 *
 * Pourquoi ce script existe : un audit de juillet 2026 a trouvé le même petit
 * groupe de chiffres faux, chacun avec une valeur différente, répété dans 9+
 * fichiers de doc — parce que rien ne les recalculait automatiquement quand un
 * test/une table/une clé était ajouté. Ce script empêche la récidive.
 *
 * Usage :
 *   node scripts/check-doc-numbers.js         # vérifie, exit 1 si dérive
 *   node scripts/check-doc-numbers.js --fix   # corrige en place
 *
 * npm run docs:check / npm run docs:fix — voir package.json.
 * Câblé en CI (.github/workflows/ci.yml) et dans le hook pre-commit.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = process.argv.includes("--fix");

// ── Calcul des chiffres réels ────────────────────────────────────────────────

function countVitestTests() {
  const json = execSync("npx vitest run --reporter=json", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(json).numTotalTests;
}

function countVitestFiles() {
  return readdirSync(join(ROOT, "tests")).filter((f) => f.endsWith(".test.js")).length;
}

function countPhpUnit() {
  const dir = join(ROOT, "tests/php");
  const files = readdirSync(dir).filter((f) => f.endsWith(".php"));
  let total = 0;
  for (const f of files) {
    const content = readFileSync(join(dir, f), "utf8");
    total += (content.match(/public function test/g) || []).length;
  }
  return { total, files: files.length };
}

function countSqlTables() {
  const content = readFileSync(join(ROOT, "sql/bdd_mysql.sql"), "utf8");
  return (content.match(/^CREATE TABLE/gm) || []).length;
}

function countI18nKeys() {
  const en = JSON.parse(readFileSync(join(ROOT, "lang/en.json"), "utf8"));
  let count = 0;
  const walk = (obj) => {
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v);
      else count++;
    }
  };
  walk(en);
  return count;
}

function countE2E() {
  const dir = join(ROOT, "tests-e2e");
  const files = readdirSync(dir).filter((f) => f.endsWith(".spec.js"));
  // `playwright test --list` énumère les tests réellement enregistrés au runtime (il exécute le
  // corps des fichiers .spec.js, sans lancer de navigateur ni toucher au serveur) — contrairement
  // à un comptage par regex sur `test(`, ça compte aussi les tests générés dynamiquement dans une
  // boucle (ex: game-flow.spec.js § responsive, 1 seul appel `test()` dans le code mais 6 tests
  // enregistrés au runtime, un par mode de jeu).
  const out = execSync("npx playwright test --list", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const match = out.match(/Total:\s+(\d+)\s+tests?\s+in\s+\d+\s+files?/);
  if (!match) throw new Error(`Impossible de parser la sortie de "playwright test --list" : ${out}`);
  return { total: Number(match[1]), files: files.length };
}

const vitestTests = countVitestTests();
const vitestFiles = countVitestFiles();
const phpunit = countPhpUnit();
const tables = countSqlTables();
const i18nKeys = countI18nKeys();
const e2e = countE2E();

console.log(
  `📊 Chiffres réels : ${vitestTests} tests Vitest (${vitestFiles} fichiers) · ` +
    `${phpunit.total} méthodes PHPUnit (${phpunit.files} fichiers) · ${tables} tables SQL · ` +
    `${i18nKeys} clés i18n · ${e2e.total} tests E2E (${e2e.files} fichiers)\n`
);

// ── Points de synchronisation ────────────────────────────────────────────────
// Chaque regex doit capturer UNIQUEMENT les nombres à vérifier/remplacer, dans
// l'ordre. Le remplacement se fait par substitution ciblée du nombre trouvé
// (pas de reconstruction de template) pour rester sûr même si le texte autour change.

const CLAUDE_MD = join(ROOT, "CLAUDE.md");
const README = join(ROOT, "README.md");
const ROADMAP = join(ROOT, "ROADMAP.md");
const CONTRIBUTING = join(ROOT, "CONTRIBUTING.md");
const TESTS_README = join(ROOT, "tests/README.md");
const TESTS_E2E_README = join(ROOT, "tests-e2e/README.md");

const syncPoints = [
  // CLAUDE.md
  { file: CLAUDE_MD, re: /en\.json \(source de vérité, (\d+) clés\)/, expected: [i18nKeys] },
  { file: CLAUDE_MD, re: /(\d+) suites Vitest \((\d+) tests\)/, expected: [vitestFiles, vitestTests] },
  { file: CLAUDE_MD, re: /bdd_mysql\.sql \((\d+) tables\)/, expected: [tables] },
  { file: CLAUDE_MD, re: /\*\*(\d+) tests\*\* \(Vitest \+ jsdom\), (\d+) suites/, expected: [vitestTests, vitestFiles] },

  // README.md
  { file: README, re: /Tests-(\d+)%20passing/, expected: [vitestTests] },
  { file: README, re: /(\d+)-table relational schema, (\d+)\+ unit tests/, expected: [tables, vitestTests] },
  { file: README, re: /MariaDB 10\.6\+ → (\d+)-table relational schema/, expected: [tables] },
  { file: README, re: /EN · FR · ES · DE · IT \((\d+) keys each\)/, expected: [i18nKeys] },
  { file: README, re: /Vitest \+ jsdom → (\d+) tests unitaires/, expected: [vitestTests] },
  { file: README, re: /Playwright\s+→ (\d+) E2E sur la stack Docker/, expected: [e2e.total] },
  { file: README, re: /panel admin, (\d+) tests automatisés/, expected: [vitestTests] },
  { file: README, re: /# Run the (\d+) unit tests/, expected: [vitestTests] },

  // ROADMAP.md
  { file: ROADMAP, re: /\*\*(\d+) tests JS · (\d+) PHPUnit · (\d+) E2E · PHPStan/, expected: [vitestTests, phpunit.total, e2e.total] },
  { file: ROADMAP, re: /Schéma BDD \((\d+) tables, MySQL\/MariaDB\)/, expected: [tables] },
  { file: ROADMAP, re: /Tests : (\d+) Vitest · (\d+) PHPUnit · (\d+) E2E/, expected: [vitestTests, phpunit.total, e2e.total] },
  { file: ROADMAP, re: /i18n EN\/FR\/ES\/DE\/IT \((\d+) clés\)/, expected: [i18nKeys] },

  // CONTRIBUTING.md
  { file: CONTRIBUTING, re: /(\d+) tests JS \(Vitest\)/, expected: [vitestTests] },
  { file: CONTRIBUTING, re: /(\d+) méthodes de test PHPUnit dans (\d+) fichiers/, expected: [phpunit.total, phpunit.files] },

  // tests/README.md
  { file: TESTS_README, re: /Vitest-(\d+)%20passing/, expected: [vitestTests] },
  { file: TESTS_README, re: /PHPUnit — (\d+) méthodes \((\d+) fichiers/, expected: [phpunit.total, phpunit.files] },
  { file: TESTS_README, re: /Vitest — (\d+) tests unitaires \(jsdom, (\d+) fichiers\)/, expected: [vitestTests, vitestFiles] },
  { file: TESTS_README, re: /\*\*Total\*\*\s*\|\*\*(\d+)\*\*/, expected: [vitestTests] },
  { file: TESTS_README, re: /\*\*(\d+) méthodes de test\*\* au total sur ces (\d+) fichiers/, expected: [phpunit.total, phpunit.files] },

  // tests-e2e/README.md
  { file: TESTS_E2E_README, re: /\*\*(\d+) tests \((\d+) fichiers\) sur un vrai navigateur/, expected: [e2e.total, e2e.files] },
];

// ── Vérification / correction ────────────────────────────────────────────────

const fileCache = new Map();
function getContent(file) {
  if (!fileCache.has(file)) fileCache.set(file, readFileSync(file, "utf8"));
  return fileCache.get(file);
}

let mismatches = [];
let notFound = [];
const dirtyFiles = new Set();

for (const point of syncPoints) {
  const content = getContent(point.file);
  // Flag "d" : expose la position exacte (début/fin) de chaque groupe capturé dans `content`.
  // Indispensable pour un remplacement positionnel plutôt que par sous-chaîne — sinon un nombre
  // dont les chiffres apparaissent comme sous-chaîne d'un autre (ex: "25" dans "125") se fait
  // corrompre par le `.replace()` du nombre voisin (vécu : "125 PHPUnit" → "130 PHPUnit" en
  // voulant corriger "25 E2E" → "30 E2E" juste à côté).
  const re = new RegExp(point.re.source, point.re.flags.includes("d") ? point.re.flags : point.re.flags + "d");
  const m = re.exec(content);
  if (!m) {
    notFound.push(point);
    continue;
  }
  const found = m.slice(1).map(Number);
  const isStale = found.some((v, i) => v !== point.expected[i]);
  if (isStale) {
    mismatches.push({ ...point, found });
    if (FIX) {
      // Groupes remplacés de la fin vers le début pour que les positions déjà traitées
      // ne soient jamais décalées par un remplacement précédent de longueur différente.
      const groupIndices = m.indices.slice(1);
      let updated = content;
      for (let i = groupIndices.length - 1; i >= 0; i--) {
        const [start, end] = groupIndices[i];
        updated = updated.slice(0, start) + String(point.expected[i]) + updated.slice(end);
      }
      fileCache.set(point.file, updated);
      dirtyFiles.add(point.file);
    }
  }
}

if (notFound.length) {
  console.warn(`⚠️  ${notFound.length} motif(s) introuvable(s) (texte autour a changé ?) — à vérifier à la main :`);
  for (const p of notFound) console.warn(`   - ${p.file.replace(ROOT + "/", "")} : ${p.re}`);
  console.warn("");
}

if (mismatches.length) {
  if (FIX) {
    for (const file of dirtyFiles) writeFileSync(file, fileCache.get(file));
    console.log(`✅ ${mismatches.length} chiffre(s) obsolète(s) corrigé(s) :`);
    for (const m of mismatches) {
      console.log(`   - ${m.file.replace(ROOT + "/", "")} : ${m.found.join(", ")} → ${m.expected.join(", ")}`);
    }
    process.exit(0);
  } else {
    console.error(`❌ ${mismatches.length} chiffre(s) obsolète(s) dans la documentation :`);
    for (const m of mismatches) {
      console.error(`   - ${m.file.replace(ROOT + "/", "")} : annonce ${m.found.join(", ")}, réalité ${m.expected.join(", ")}`);
    }
    console.error("\n   → Lancer `npm run docs:fix` pour corriger automatiquement.");
    process.exit(1);
  }
} else {
  console.log("✅ Toute la documentation reflète les chiffres réels du projet.");
  process.exit(0);
}
