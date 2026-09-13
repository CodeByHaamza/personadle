#!/usr/bin/env node
/**
 * scripts/fetch_aoa_assets.js — Les animations d'All-Out Attack (≈ 1,8 Go de .webp)
 * ne sont plus dans git : elles vivent sur Cloudflare R2, le jeu les sert de là en
 * prod et s'y replie en local quand le fichier manque (modeAllOutAttack.js, cdn()).
 * Ce script remplit `allOutAttackMode/database/allOutAttack/` pour jouer hors
 * ligne ou sans dépendre du CDN pendant le dev.
 *
 * La liste attendue est dérivée des datasets (source de vérité), avec la même
 * règle que le jeu : `portraitsMap[nom] || nom.split(" ")[0]`.
 *
 * Usage :
 *   node scripts/fetch_aoa_assets.js          # télécharge ce qui manque en local
 *   node scripts/fetch_aoa_assets.js --check  # ne télécharge rien : dit ce qui manque
 *                                             #   sur R2 (à uploader) et les orphelins
 *                                             #   locaux (fichiers hors dataset) — exit 1
 *                                             #   si un asset du jeu est absent de R2
 *
 * npm run aoa:fetch / npm run aoa:check — voir package.json.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const ASSET_DIR = join(ROOT, "allOutAttackMode/database/allOutAttack");
// Même bucket que CDN_BASE_URL dans modeAllOutAttack.js
const CDN_BASE_URL = "https://pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev/allOutAttack/";
const CONCURRENCY = 4;

const dataset = (rel) => import(pathToFileURL(join(ROOT, rel)).href);

const { aoaCharacters } = await dataset("allOutAttackMode/database/aoaCharacters.js");
const { portraitsMap } = await dataset("allOutAttackMode/database/portraitsMap.js");

/** Noms de fichiers (sans extension) attendus par le jeu, sans doublon, triés. */
const expected = [
  ...new Set(aoaCharacters.map((c) => portraitsMap[c.nom] || c.nom.split(" ")[0])),
].sort();

const localFiles = existsSync(ASSET_DIR)
  ? readdirSync(ASSET_DIR).filter((f) => f.endsWith(".webp"))
  : [];
const localNames = new Set(localFiles.map((f) => f.replace(/\.webp$/, "")));
const orphans = [...localNames].filter((n) => !expected.includes(n));

/** Exécute `fn` sur chaque élément, au plus `limit` en parallèle. */
async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

if (CHECK) {
  const results = await mapLimit(expected, CONCURRENCY, async (name) => {
    const res = await fetch(`${CDN_BASE_URL}${encodeURIComponent(name)}.webp`, { method: "HEAD" });
    return { name, onCdn: res.ok, local: localNames.has(name) };
  });
  const missingCdn = results.filter((r) => !r.onCdn).map((r) => r.name);
  const missingLocal = results.filter((r) => !r.local).map((r) => r.name);

  console.log(`🎞️  ${expected.length} animations attendues par le jeu`);
  console.log(`   sur R2      : ${expected.length - missingCdn.length}/${expected.length}`);
  console.log(`   en local    : ${expected.length - missingLocal.length}/${expected.length}`);
  if (missingCdn.length) {
    console.log(`\n❌ Absentes de R2 (à uploader dans le bucket, dossier allOutAttack/) :`);
    missingCdn.forEach((n) => console.log(`   - ${n}.webp`));
  }
  if (orphans.length) {
    console.log(`\n⚠️  Fichiers locaux hors dataset (orphelins, à supprimer ?) :`);
    orphans.forEach((n) => console.log(`   - ${n}.webp`));
  }
  if (!missingCdn.length) console.log(`\n✅ Tout ce que le jeu demande est sur R2.`);
  process.exit(missingCdn.length ? 1 : 0);
}

mkdirSync(ASSET_DIR, { recursive: true });
const todo = expected.filter((n) => !localNames.has(n));
if (!todo.length) {
  console.log(`✅ ${expected.length} animations déjà présentes dans ${ASSET_DIR}`);
  process.exit(0);
}
console.log(
  `⬇️  ${todo.length} animation(s) à télécharger depuis R2 (${expected.length - todo.length} déjà là)…`
);

let failed = 0;
let bytes = 0;
await mapLimit(todo, CONCURRENCY, async (name) => {
  const url = `${CDN_BASE_URL}${encodeURIComponent(name)}.webp`;
  const dest = join(ASSET_DIR, `${name}.webp`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    bytes += buf.length;
    console.log(`   ✓ ${name}.webp (${(buf.length / 1048576).toFixed(1)} Mo)`);
  } catch (err) {
    failed++;
    console.log(`   ✗ ${name}.webp — ${err.message}`);
  }
});

console.log(
  `\n${failed ? "⚠️ " : "✅ "}${todo.length - failed}/${todo.length} téléchargée(s), ${(bytes / 1048576).toFixed(0)} Mo` +
    (failed ? ` — ${failed} en échec (absente de R2 ?)` : "")
);
if (orphans.length) {
  console.log(`ℹ️  ${orphans.length} fichier(s) local(aux) hors dataset : ${orphans.join(", ")}`);
}
