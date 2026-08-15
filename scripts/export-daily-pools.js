#!/usr/bin/env node
/**
 * scripts/export-daily-pools.js — Exporte les pools de tirage quotidien (JS, source
 * de vérité) vers api/data/daily_pools.json (lisible par PHP), pour que le backend
 * puisse recalculer la cible du jour attendue par joueur/mode/date sans dupliquer
 * les datasets à la main.
 *
 * Chaque pool DOIT préserver l'ordre exact du fichier source : getDailyTarget()
 * (js/gameCore.js) fait un index = hash % pool.length, donc un pool réordonné ou
 * incomplet donnerait un index différent de celui vu par le client.
 *
 * Usage :
 *   node scripts/export-daily-pools.js         # régénère api/data/daily_pools.json
 *   node scripts/export-daily-pools.js --check # vérifie sans écrire, exit 1 si dérive
 *
 * npm run pools:build / npm run pools:check — voir package.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const OUT_FILE = join(ROOT, "api/data/daily_pools.json");

const { characters } = await import(join(ROOT, "database/characters_clean.js").replace(/\\/g, "/"));
const { silhouetteCharacters } = await import(
  join(ROOT, "silhouetteMode/database/silhouetteCharacters.js").replace(/\\/g, "/")
);
const { songs } = await import(join(ROOT, "musicsMode/database/songs.js").replace(/\\/g, "/"));
const { personas: aoaAutocompletePool } = await import(
  join(ROOT, "allOutAttackMode/database/personas_allOut.js").replace(/\\/g, "/")
);
const { aoaCharacters } = await import(
  join(ROOT, "allOutAttackMode/database/aoaCharacters.js").replace(/\\/g, "/")
);
const { personaeCharacters } = await import(
  join(ROOT, "personaeMode/database/personaeCharacters.js").replace(/\\/g, "/")
);
const { expertLyrics } = await import(
  join(ROOT, "musicsMode/database/expert_lyrics.js").replace(/\\/g, "/")
);

const opusByName = Object.fromEntries(aoaCharacters.map((c) => [c.nom, c.opus]));

const pools = {
  classic: { pool: characters.map((c) => c.nom) },
  emoji: { pool: characters.filter((c) => c.emoji).map((c) => c.nom) },
  silhouette: { pool: silhouetteCharacters.map((c) => c.nom) },
  music: { pool: songs.map((s) => s.titre) },
  // Mode Music Expert : sous-ensemble strict de `music` — seules les chansons ayant
  // des paroles dans expert_lyrics.js (les instrumentales n'ont rien à révéler).
  // Pool ET clé de hash distincts de `music` : le tirage doit être indépendant,
  // sinon le joueur fait le mode normal (où il entend l'audio), trouve la réponse,
  // et l'Expert du jour devient gratuit. Ordre = celui de songs.js, comme les autres.
  music_expert: { pool: songs.filter((s) => expertLyrics[s.titre]).map((s) => s.titre) },
  alloutattack: {
    pool: aoaAutocompletePool,
    opusByName,
  },
  personae: {
    // `persona` (identifiant unique de l'entrée, ex: "Orpheus ( Male )") sert au
    // test d'appartenance au pool filtré — modePersonae.js compare c.persona,
    // PAS c.user, car plusieurs entrées peuvent partager le même `user` (un
    // perso peut avoir plusieurs personas selon l'opus).
    pool: personaeCharacters.map((c) => ({
      persona: c.persona,
      user: Array.isArray(c.user) ? c.user[0] : c.user,
      opus: c.opus,
    })),
  },
};

const json = JSON.stringify(pools, null, 2) + "\n";

if (CHECK) {
  let current;
  try {
    current = readFileSync(OUT_FILE, "utf8");
  } catch {
    console.error(`❌ ${OUT_FILE.replace(ROOT + "/", "")} n'existe pas — lancer \`npm run pools:build\`.`);
    process.exit(1);
  }
  if (current !== json) {
    console.error(
      `❌ api/data/daily_pools.json est désynchronisé des datasets JS sources.\n` +
        `   → Lancer \`npm run pools:build\` pour régénérer.`
    );
    process.exit(1);
  }
  console.log("✅ api/data/daily_pools.json reflète les datasets JS sources.");
  process.exit(0);
}

writeFileSync(OUT_FILE, json);
console.log(
  `✅ api/data/daily_pools.json régénéré : ` +
    Object.entries(pools)
      .map(([mode, p]) => `${mode}=${p.pool.length}`)
      .join(", ")
);
