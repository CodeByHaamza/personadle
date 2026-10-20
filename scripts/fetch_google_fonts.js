#!/usr/bin/env node
/**
 * scripts/fetch_google_fonts.js — Rapatrie les polices Google du site dans font/
 * et génère css/fonts.css (les @font-face, chemins locaux).
 *
 * Pourquoi : chaque page ouvrait deux connexions tierces (fonts.googleapis.com
 * pour la CSS, fonts.gstatic.com pour les fichiers), bloquantes pour le rendu,
 * avec un texte qui changeait de police une fois chargé (FOUT). Servies depuis
 * font/, elles profitent du cache d'un an `immutable` déjà prévu par .htaccess,
 * marchent hors ligne, et la CSP n'a plus à autoriser Google.
 *
 * À relancer seulement si on ajoute une famille ou une graisse : modifier
 * FAMILIES ci-dessous, puis `node scripts/fetch_google_fonts.js`.
 * Sous-ensembles gardés : latin + latin-ext (FR/ES/DE/IT/PT/EN).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "font", "google");
const CSS_OUT = join(ROOT, "css", "fonts.css");

/** Toutes les familles/graisses demandées par les pages au 2026-10-20. */
const FAMILIES = [
  "Cinzel:wght@400;600;700;800",
  "Oswald:wght@400;700",
  "Playfair+Display:ital,wght@0,700;1,400;1,700",
  "Abril+Fatface",
  "Special+Elite",
  "Inter:wght@400;600;700",
  "JetBrains+Mono:wght@400;700",
  "Montserrat:wght@700;800",
];
const SUBSETS = new Set(["latin", "latin-ext"]);

// Un UA moderne : Google ne sert du woff2 qu'aux navigateurs qui le comprennent.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const url = `https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f}`).join("&")}&display=swap`;
const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();

// Chaque bloc est précédé d'un commentaire « /* latin */ » qui nomme son sous-ensemble.
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*{[^}]+})/g)];
mkdirSync(OUT_DIR, { recursive: true });

const downloaded = new Map();
const out = [
  "/* =============================================================",
  "   fonts.css — polices auto-hébergées (généré, ne pas éditer à la main)",
  "   Source : scripts/fetch_google_fonts.js. Fichiers : font/google/.",
  "   ============================================================= */",
  "",
];

for (const [, subset, block] of blocks) {
  if (!SUBSETS.has(subset)) continue;
  const family = /font-family:\s*'([^']+)'/.exec(block)[1];
  const style = /font-style:\s*(\w+)/.exec(block)[1];
  const weight = /font-weight:\s*([\d ]+)/.exec(block)[1].trim();
  const remote = /url\((https:[^)]+)\)/.exec(block)[1];

  // Un fichier variable couvre plusieurs graisses : un seul téléchargement.
  let file = downloaded.get(remote);
  if (!file) {
    const slug = family.toLowerCase().replace(/\s+/g, "_");
    file = `${slug}_${style}_${subset.replace("-", "_")}_${downloaded.size}.woff2`;
    const buf = Buffer.from(
      await (await fetch(remote, { headers: { "User-Agent": UA } })).arrayBuffer()
    );
    writeFileSync(join(OUT_DIR, file), buf);
    downloaded.set(remote, file);
  }
  out.push(
    `/* ${family} ${weight} ${style} — ${subset} */`,
    block
      .replace(/url\([^)]+\)/, `url("../font/google/${file}")`)
      .replace(/\n\s*/g, "\n  ")
      .replace(/\n {2}}$/, "\n}"),
    ""
  );
}

writeFileSync(CSS_OUT, out.join("\n"));
console.log(`✅ ${downloaded.size} fichiers woff2 dans font/google/, css/fonts.css régénéré`);
