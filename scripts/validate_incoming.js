#!/usr/bin/env node
/**
 * scripts/validate_incoming.js — Validation des fichiers en attente d'ingestion.
 *
 * Convention (AMELIORATIONS.md #6, dossier "new data/" historique) : tout nouvel
 * asset à intégrer en base (portrait, animation AOA, musique...) doit d'abord être
 * déposé dans un dossier `incoming/<type>/` avec un nom de fichier en snake_case,
 * AVANT d'être renommé/converti et poussé dans database/ ou <mode>/database/.
 *
 * Convention attendue : incoming/<type>/<persona-snake_case>.<ext>
 *   - <type>   : "portrait" | "aoa" | "music" | "misc"
 *   - <ext>    : whitelist par type (portrait → webp/png/jpg, aoa → webp/mp4,
 *                music → mp3, misc → tout sauf espaces/majuscules)
 *
 * Usage :
 *   node scripts/validate_incoming.js <dossier>   → valide, exit 1 si erreur
 *   import { validateIncoming } from "./validate_incoming.js" → réutilisable en test
 */

import { readdirSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

const EXT_BY_TYPE = {
  portrait: new Set([".webp", ".png", ".jpg", ".jpeg"]),
  aoa: new Set([".webp", ".mp4"]),
  music: new Set([".mp3"]),
  misc: null, // pas de restriction d'extension, seulement le nommage
};

const SNAKE_CASE_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

/**
 * Valide un dossier "incoming/<type>/..." selon la convention ci-dessus.
 *
 * @param {string} rootDir - Chemin du dossier à valider (ex: "incoming")
 * @returns {{ errors: string[], warnings: string[], fileCount: number }}
 */
export function validateIncoming(rootDir) {
  const errors = [];
  const warnings = [];
  let fileCount = 0;

  let types;
  try {
    types = readdirSync(rootDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    errors.push(`Dossier introuvable : ${rootDir}`);
    return { errors, warnings, fileCount };
  }

  for (const typeEntry of types) {
    const type = typeEntry.name;
    const typeDir = join(rootDir, type);

    if (!(type in EXT_BY_TYPE)) {
      warnings.push(`Type de dossier inconnu "${type}" (attendu: ${Object.keys(EXT_BY_TYPE).join(", ")})`);
    }

    const files = readdirSync(typeDir).filter((f) => statSync(join(typeDir, f)).isFile());
    for (const file of files) {
      fileCount++;
      const ext = extname(file).toLowerCase();
      const name = basename(file, extname(file));

      if (!SNAKE_CASE_RE.test(name)) {
        errors.push(`${type}/${file} : nom non conforme snake_case (attendu: persona_nom.${ext.slice(1)})`);
      }

      const allowedExt = EXT_BY_TYPE[type];
      if (allowedExt && !allowedExt.has(ext)) {
        errors.push(
          `${type}/${file} : extension "${ext}" non autorisée pour ce type (attendu: ${[...allowedExt].join(", ")})`
        );
      }
    }
  }

  return { errors, warnings, fileCount };
}

// ── Exécution directe (node scripts/validate_incoming.js <dossier>) ──────────
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const target = process.argv[2] ?? "incoming";
  const { errors, warnings, fileCount } = validateIncoming(target);

  console.log(`📦 ${fileCount} fichier(s) analysé(s) dans "${target}"`);
  warnings.forEach((w) => console.log(`⚠️  ${w}`));

  if (errors.length > 0) {
    console.log(`❌ ${errors.length} erreur(s) :`);
    errors.forEach((e) => console.log(`   - ${e}`));
    process.exit(1);
  }
  console.log("✅ Tous les fichiers respectent la convention d'ingestion.");
}
