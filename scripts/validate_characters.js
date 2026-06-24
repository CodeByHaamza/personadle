/**
 * scripts/validate_characters.js — Validation du schéma des données personnages.
 *
 * Garantit que database/characters_clean.js reste cohérent : champs requis présents
 * et bien typés, codes opus connus, pas de doublon de nom, portrait référencé.
 *
 * Usage :
 *   node scripts/validate_characters.js     → valide la vraie base, exit 1 si erreur
 *   import { validateCharacters }            → réutilisable en test
 */

// Codes opus reconnus (toutes itérations P1→P5X + spin-offs : Arena, Q, Strikers,
// Dancing, Tactica, Phantom X…).
export const VALID_OPUS = new Set([
  "P1",
  "P2IS",
  "P2EP",
  "P3",
  "P3FES",
  "P3P",
  "P3R",
  "P3D",
  "P4",
  "P4G",
  "P4AU",
  "P4D",
  "P5",
  "P5R",
  "P5S",
  "P5T",
  "P5D",
  "P5X",
  "PQ",
  "PQ2",
]);

// Arcanes canoniques : 22 Arcanes Majeurs + variantes propres à la série Persona.
// Toute autre graphie (ex. "Hanged" au lieu de "Hanged Man", "NONE" au lieu de
// "None") est signalée en warning pour normalisation.
export const VALID_ARCANA = new Set([
  "Fool",
  "Magician",
  "Priestess",
  "Empress",
  "Emperor",
  "Hierophant",
  "Lovers",
  "Chariot",
  "Justice",
  "Hermit",
  "Fortune",
  "Strength",
  "Hanged Man",
  "Death",
  "Temperance",
  "Devil",
  "Tower",
  "Star",
  "Moon",
  "Sun",
  "Judgement",
  "World",
  // Spécifiques Persona
  "Aeon",
  "Universe",
  "Jester",
  "Hunger",
  "Councillor",
  "Faith",
  "Hope",
  "Apostle",
  "NONE", // sentinelle « pas d'arcane » (PNJ, antagonistes…)
]);

// Tranches d'âge canoniques (le champ `age` doit être l'une d'elles).
export const VALID_AGES = new Set(["< 15", "15-20", "21-40", "40+", "60+", "80+", "Unknown"]);

// Champs string structurels (leur absence casse l'app) → erreur.
const REQUIRED_STRINGS = ["nom", "age"];
// Champs tableau requis non vides → erreur.
const REQUIRED_ARRAYS = ["genre", "arcane", "opus", "emoji"];
// Champs « contenu » dont l'absence n'empêche pas l'app de tourner → warning.
const CONTENT_STRINGS = ["quote"];

/**
 * Valide un tableau de personnages.
 * @param {Array<object>} chars
 * @param {Record<string,string>} portraits  portraitsMap (nom → identifiant portrait)
 * @param {Set<string>|null} portraitFiles   identifiants présents sur disque
 *                                           (sans extension) ; null = on saute la
 *                                           vérification disque (tests unitaires).
 * @returns {{ errors: string[], warnings: string[] }}
 *          errors   = violations de schéma (bloquantes)
 *          warnings = contenu/cohérence (informatif : quote vide, arcane à
 *                     normaliser, emoji en double…)
 */
export function validateCharacters(chars, portraits = {}, portraitFiles = null) {
  const errors = [];
  const warnings = [];
  const seen = new Map();

  chars.forEach((c, i) => {
    const id = c && typeof c.nom === "string" && c.nom.trim() ? c.nom : `#${i}`;

    // ── Champs string structurels ───────────────────────────────────────────
    for (const f of REQUIRED_STRINGS) {
      if (typeof c?.[f] !== "string" || !c[f].trim()) {
        errors.push(`[${id}] champ "${f}" manquant ou vide`);
      }
    }

    // ── Champs « contenu » (warning seulement) ──────────────────────────────
    for (const f of CONTENT_STRINGS) {
      if (typeof c?.[f] !== "string" || !c[f].trim()) {
        warnings.push(`[${id}] champ "${f}" vide (contenu à compléter)`);
      }
    }

    // ── Champs tableau requis (non vides) ───────────────────────────────────
    for (const f of REQUIRED_ARRAYS) {
      if (!Array.isArray(c?.[f]) || c[f].length === 0) {
        errors.push(`[${id}] champ "${f}" doit être un tableau non vide`);
      }
    }

    // ── personaUser booléen + cohérence avec persona ────────────────────────
    if (typeof c?.personaUser !== "boolean") {
      errors.push(`[${id}] champ "personaUser" doit être un booléen`);
    } else if (c.personaUser && (typeof c.persona !== "string" || !c.persona.trim())) {
      errors.push(`[${id}] personaUser=true mais "persona" est vide`);
    }

    // ── Tranche d'âge canonique ─────────────────────────────────────────────
    if (typeof c?.age === "string" && c.age.trim() && !VALID_AGES.has(c.age)) {
      errors.push(`[${id}] age "${c.age}" hors des tranches autorisées (${[...VALID_AGES].join(", ")})`);
    }

    // ── Codes opus connus ───────────────────────────────────────────────────
    if (Array.isArray(c?.opus)) {
      for (const o of c.opus) {
        if (!VALID_OPUS.has(o)) errors.push(`[${id}] opus inconnu "${o}"`);
      }
    }

    // ── Arcanes canoniques (warning : à normaliser) ─────────────────────────
    if (Array.isArray(c?.arcane)) {
      for (const a of c.arcane) {
        if (!VALID_ARCANA.has(a)) {
          warnings.push(`[${id}] arcane non canonique "${a}" (à normaliser)`);
        }
      }
    }

    // ── Emoji en double dans le même personnage (warning) ───────────────────
    if (Array.isArray(c?.emoji)) {
      const dup = c.emoji.filter((e, idx) => c.emoji.indexOf(e) !== idx);
      if (dup.length) {
        warnings.push(`[${id}] emoji en double : ${[...new Set(dup)].join(" ")}`);
      }
    }

    // ── Doublon de nom ──────────────────────────────────────────────────────
    if (typeof c?.nom === "string") {
      if (seen.has(c.nom)) {
        errors.push(`[${id}] doublon de nom (déjà présent à l'index ${seen.get(c.nom)})`);
      } else {
        seen.set(c.nom, i);
      }
    }

    // ── Portrait : référencé dans la map ET présent sur disque ──────────────
    if (typeof c?.nom === "string" && c.nom.trim()) {
      if (!(c.nom in portraits)) {
        errors.push(`[${id}] absent de portraitsMap (aucun portrait associé)`);
      } else if (portraitFiles instanceof Set && !portraitFiles.has(portraits[c.nom])) {
        errors.push(`[${id}] portrait "${portraits[c.nom]}.webp" introuvable sur disque`);
      }
    }
  });

  return { errors, warnings };
}

// ── CLI : valider la vraie base ────────────────────────────────────────────────
// Exécuté uniquement quand le script est lancé directement (pas à l'import).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { readdirSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");

  const { characters } = await import("../database/characters_clean.js");
  const { portraitsMap } = await import("../database/portraitsMap.js");

  // Identifiants de portraits réellement présents sur disque (sans extension).
  const portraitsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "database", "portraits");
  const portraitFiles = new Set(
    readdirSync(portraitsDir)
      .filter((f) => f.endsWith(".webp"))
      .map((f) => f.replace(/\.webp$/, ""))
  );

  const { errors, warnings } = validateCharacters(characters, portraitsMap, portraitFiles);

  if (warnings.length) {
    console.warn(`⚠ ${warnings.length} avertissement(s) (non bloquant) :`);
    for (const w of warnings) console.warn("  - " + w);
    console.warn("");
  }

  if (errors.length) {
    console.error(`✗ ${errors.length} erreur(s) de données :\n`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }

  console.log(
    `✓ ${characters.length} personnages valides — schéma conforme` +
      (warnings.length ? ` (${warnings.length} contenu(s) à compléter).` : ".")
  );
}
