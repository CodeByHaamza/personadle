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
const expertLore = JSON.parse(
  readFileSync(join(ROOT, "personaeMode/database/expert_lore/en.json"), "utf8")
);

const opusByName = Object.fromEntries(aoaCharacters.map((c) => [c.nom, c.opus]));

const pools = {
  classic: { pool: characters.map((c) => c.nom) },
  emoji: { pool: characters.filter((c) => c.emoji).map((c) => c.nom) },
  silhouette: { pool: silhouetteCharacters.map((c) => c.nom) },
  music: { pool: songs.map((s) => s.titre) },
  // ── Pools Mode Expert ──────────────────────────────────────────────────────
  // Tous ont une clé de hash distincte de leur mode normal : le tirage doit être
  // indépendant, sinon jouer le mode normal d'abord — où l'indice est bien plus
  // généreux — donne la réponse de l'Expert du jour.
  //
  // Seuls les modes dont le CONTENU est restreint ont un pool propre ici :
  //   - music_expert  : uniquement les chansons ayant des paroles
  //   - classic_expert: uniquement les personnages ayant une citation
  // AOA et Silhouette Expert rejouent le pool normal (l'indice change, pas le
  // roster) — api/lib/daily_target.php réutilise directement `alloutattack` et
  // `silhouette` avec une clé de hash suffixée, plutôt que d'en dupliquer les
  // entrées ici et de les laisser dériver.
  music_expert: { pool: songs.filter((s) => expertLyrics[s.titre]).map((s) => s.titre) },
  classic_expert: {
    pool: characters.filter((c) => String(c.quote ?? "").trim()).map((c) => c.nom),
  },
  // Personae Expert : seules les personas ayant une fiche de lore sont tirables —
  // sans texte, la partie n'aurait aucun indice. Les variantes cosmétiques
  // (`* Picaro`…) n'ont volontairement pas de fiche et sont donc exclues d'office.
  personae_expert: {
    pool: personaeCharacters
      .filter((c) => expertLore[c.persona])
      .map((c) => ({
        persona: c.persona,
        user: Array.isArray(c.user) ? c.user[0] : c.user,
        opus: c.opus,
      })),
  },
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
