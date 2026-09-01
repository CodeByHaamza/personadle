import { readFileSync, writeFileSync } from "node:fs";
import { songs } from "../musicsMode/database/songs.js";

const SRC = new URL("../expert_mode_content.md", import.meta.url);
const OUT = new URL("../musicsMode/database/expert_lyrics.js", import.meta.url);

// `split(/\r?\n/)` et non `split("\n")` : le repérage de la section Music se fait
// par égalité STRICTE (`l === "== Music =="`), donc un simple `\r` résiduel la
// rendait introuvable — et le script sortait alors « 0 chanson » en code 0, vidant
// expert_lyrics.js et faisant tomber le pool music_expert à 0 SANS AUCUNE ERREUR.
// Vécu le 2026-08-27 : une édition du .md sur un poste Windows avait converti le
// fichier entier en CRLF. Un format de fin de ligne ne doit pas pouvoir vider un
// pool de jeu en silence.
const lines = readFileSync(SRC, "utf8").split(/\r?\n/);
const isEntry = (l) => /^\S.*\[[ Xx]\]\s*$/.test(l);
const isHeader = (l) => /^(==|--) /.test(l);

let inMusic = false;
let cur = null;
const rows = [];
for (const l of lines) {
  if (l === "== Music ==") inMusic = true;
  if (!inMusic) continue;
  if (isEntry(l)) {
    cur = { title: l.replace(/\s*\[[ Xx]\]\s*$/, "").trim(), body: [] };
    rows.push(cur);
    continue;
  }
  if (isHeader(l)) {
    cur = null;
    continue;
  }
  if (cur) cur.body.push(l);
}

const known = new Set(songs.map((s) => s.titre));
const result = {};
const unknown = [];
let stanzaCount = 0;

for (const r of rows) {
  const raw = r.body.join("\n").replace(/^\s*Parole\s*:/i, "").trim();
  if (!raw) continue;
  if (!known.has(r.title)) unknown.push(r.title);
  // Une ligne = un palier de révélation. Les lignes vides (séparations de strophes
  // dans le .md) sont écartées : elles ne sont pas un indice, elles gaspilleraient un essai.
  const stanzas = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  stanzaCount += stanzas.length;
  result[r.title] = stanzas;
}

// Garde-fou : ne JAMAIS écrire un fichier vide en sortant avec succès.
// Le 2026-08-27, un simple passage du .md en CRLF a fait tomber le parsing à
// « 0 chanson » — le script a alors écrasé expert_lyrics.js avec un objet vide,
// vidé le pool music_expert, et rendu la main en code 0. Aucune erreur nulle
// part : ni la CI, ni le hook pre-commit n'avaient de raison de rougir.
// Un contenu de jeu ne doit pas pouvoir disparaître sans que rien ne le dise.
if (Object.keys(result).length === 0) {
  console.error(
    "❌ Aucune chanson n'a été extraite de expert_mode_content.md.\n" +
      "   Le fichier n'est pas écrit : l'écraser viderait le pool Music Expert.\n" +
      "   Causes déjà vues : section « == Music == » absente ou renommée, ou fins de\n" +
      "   ligne CRLF (le repérage de section se fait par égalité stricte)."
  );
  process.exit(1);
}

const body = Object.entries(result)
  .map(([t, st]) => `  ${JSON.stringify(t)}: [\n${st.map((s) => `    ${JSON.stringify(s)},`).join("\n")}\n  ],`)
  .join("\n");

const header = `/**
 * musicsMode/database/expert_lyrics.js
 * Paroles pour le mode Music Expert — révélation cumulative, un vers par essai raté.
 *
 * Données GÉNÉRÉES depuis expert_mode_content.md (curé à la main par Hamza) — ne pas
 * éditer les paroles ici, éditer le .md puis régénérer.
 * - Clé = \`titre\` exact de songs.js. Les instrumentaux n'ont pas d'entrée : une
 *   chanson absente d'ici est hors du tirage Expert Music.
 * - Valeur = les vers dans l'ordre de la chanson, un par palier de révélation.
 * - Paroles stockées BRUTES, titre non masqué : 31 chansons sur 73 citent leur propre
 *   titre. Le masquage est fait à l'affichage via \`maskTerms()\` (js/gameCore.js), pour
 *   que la fin de partie (victoire ou abandon) n'ait qu'à ré-afficher le texte brut.
 * - Pas de i18n : une parole reste dans sa langue d'origine (CLAUDE.md §5, même
 *   traitement que les titres de musique).
 */
export const expertLyrics = {
${body}
};

`;

writeFileSync(OUT, header);
console.log(`chansons: ${Object.keys(result).length} | vers: ${stanzaCount}`);
console.log(`titres absents de songs.js: ${unknown.join(", ") || "—"}`);
const noStanza = Object.entries(result).filter(([, s]) => s.length < 2).map(([t]) => t);
console.log(`< 2 vers (révélation progressive impossible): ${noStanza.length} → ${noStanza.join(", ") || "—"}`);
