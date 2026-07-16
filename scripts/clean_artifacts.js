/**
 * clean_artifacts.js
 * Supprime les artefacts de test/CI locaux (fichiers et dossiers) — remplace
 * `rm -f`/`rm -rf` dans le Makefile (Unix-only). Node est déjà une dépendance
 * obligatoire du projet, donc ce script tourne partout (Windows compris).
 *
 * Usage: node scripts/clean_artifacts.js <chemin> [<chemin> ...]
 *        (voir la cible `clean` du Makefile)
 */

import fs from "fs";

const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error("Usage: node scripts/clean_artifacts.js <chemin> [<chemin> ...]");
  process.exit(1);
}

for (const target of targets) {
  // force:true = pas d'erreur si le chemin n'existe pas (équivalent de `rm -f`)
  // recursive:true = supprime aussi les dossiers non vides (équivalent de `rm -rf`)
  fs.rmSync(target, { recursive: true, force: true });
}
