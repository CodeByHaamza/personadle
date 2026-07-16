/**
 * make_help.js
 * Affiche la liste des cibles `make` disponibles (parsing du Makefile lui-même,
 * lignes `cible: ## description`) — remplace le pipeline grep|sort|awk
 * (Unix-only) dans le Makefile. Node est déjà une dépendance obligatoire du
 * projet, donc ce script tourne partout (Windows compris).
 *
 * Usage: node scripts/make_help.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAKEFILE = path.join(__dirname, "..", "Makefile");

const lines = fs.readFileSync(MAKEFILE, "utf-8").split("\n");

// Une cible documentée : `nom-cible: [prérequis] ## description` en début de ligne
// (pas une ligne de recette, qui commence toujours par une tabulation).
const TARGET_RE = /^([a-zA-Z_-]+):.*?## (.*)$/;

const targets = lines
  .map((line) => line.match(TARGET_RE))
  .filter(Boolean)
  .map((m) => ({ name: m[1], description: m[2] }))
  .sort((a, b) => a.name.localeCompare(b.name));

console.log("PersonaDLE — cibles disponibles :");
for (const { name, description } of targets) {
  console.log(`  \x1b[36m${name.padEnd(16)}\x1b[0m ${description}`);
}
