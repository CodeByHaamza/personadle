/**
 * badgesCatalogParity.test.js — Le catalogue client et le catalogue serveur
 * décrivent-ils les MÊMES badges ?
 *
 * Il en existe deux, et rien ne les comparait :
 *   - `profile/badges/badgesData.js` — 64 entrées avec un `check(stats, profile)`
 *     évalué dans le navigateur, qui décide QUAND on propose le déblocage ;
 *   - la table `badges` de `sql/bdd_mysql.sql` — 64 lignes avec
 *     condition_type/mode/value, que `api/badges/index.php` revérifie à l'unlock.
 *
 * `tests/badgesConditions.test.js` couvre le premier, `tests/php/BadgeWallpaperCatalogTest`
 * le second. Aucun des deux ne regarde l'autre : un badge dont le client annonce
 * « 10 victoires » et dont le serveur exige 15 passerait les deux suites au vert,
 * et produirait en prod le pire symptôme possible — le client propose le badge,
 * le serveur répond 403 « Condition not met », et le joueur voit un déblocage qui
 * ne s'applique pas. Un slug ajouté d'un seul côté a le même effet (404 à
 * l'unlock, ou badge en base que personne ne peut gagner).
 *
 * Le seed SQL est lu et parsé directement : pas de base à lancer pour ce fichier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { badgesList } from "../profile/badges/badgesData.js";

const here = dirname(fileURLToPath(import.meta.url));
const sqlSrc = readFileSync(resolve(here, "../sql/bdd_mysql.sql"), "utf-8");

/** Découpe le corps d'un VALUES en lignes (parenthèses hors chaînes). */
function splitRows(body) {
  const rows = [];
  let depth = 0;
  let cur = "";
  let inStr = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      // SQL échappe l'apostrophe en la doublant : « Don''t ».
      if (ch === "'" && body[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      if (ch === "'") inStr = false;
      cur += ch;
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
      continue;
    }
    if (ch === "(") {
      depth++;
      if (depth === 1) {
        cur = "";
        continue;
      }
    }
    if (ch === ")") {
      depth--;
      if (depth === 0) {
        rows.push(cur);
        cur = "";
        continue;
      }
    }
    if (depth > 0) cur += ch;
  }
  return rows;
}

/** Découpe une ligne en champs (virgules hors chaînes). */
function splitFields(row) {
  const out = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inStr) {
      if (ch === "'" && row[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      if (ch === "'") inStr = false;
      cur += ch;
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Les badges du seed SQL, indexés par slug. */
function sqlBadges() {
  const m = sqlSrc.match(/INSERT (?:IGNORE )?INTO badges\s*\(([^)]*)\)\s*VALUES([\s\S]*?);\s*\n/);
  expect(m, "seed de la table badges introuvable dans sql/bdd_mysql.sql").toBeTruthy();

  const cols = m[1].split(",").map((c) => c.trim().replace(/`/g, ""));
  // Les commentaires « -- … » vivent dans le corps du VALUES et décaleraient
  // la ligne suivante d'une colonne s'ils n'étaient pas retirés d'abord.
  const body = m[2].replace(/--[^\n]*/g, "");

  const out = {};
  for (const row of splitRows(body)) {
    const f = splitFields(row);
    expect(f.length, `ligne mal découpée : ${row.slice(0, 60)}`).toBe(cols.length);
    const get = (name) => {
      const v = f[cols.indexOf(name)];
      if (v === undefined || /^null$/i.test(v)) return null;
      return v.startsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : v;
    };
    out[get("slug")] = {
      condition_type: get("condition_type"),
      condition_mode: get("condition_mode"),
      condition_value: get("condition_value") === null ? null : Number(get("condition_value")),
      condition_en: get("condition_en"),
      is_secret: get("is_secret") === "1",
    };
  }
  return out;
}

const SQL = sqlBadges();

describe("catalogue badges — client ↔ serveur", () => {
  it("les deux catalogues ont le même nombre d'entrées", () => {
    expect(Object.keys(SQL).length).toBe(badgesList.length);
  });

  it("aucun badge client n'est absent de la table SQL", () => {
    // Symptôme sinon : le client propose le badge, POST /api/badges/unlock
    // répond 404 « Badge not found in catalog », rien ne se débloque.
    const missing = badgesList.map((b) => b.id).filter((id) => !(id in SQL));
    expect(missing).toEqual([]);
  });

  it("aucun badge SQL n'est absent du catalogue client", () => {
    // Symptôme sinon : un badge en base que rien n'évalue côté joueur — donc
    // inaccessible autrement qu'en le poussant à la main.
    const clientIds = new Set(badgesList.map((b) => b.id));
    const orphans = Object.keys(SQL).filter((slug) => !clientIds.has(slug));
    expect(orphans).toEqual([]);
  });

  it("le drapeau « secret » est le même des deux côtés", () => {
    // Un badge secret côté SQL mais visible côté client divulgue sa condition
    // dans la modale des badges — c'est tout l'intérêt du drapeau qui tombe.
    const mismatched = badgesList
      .filter((b) => Boolean(b.secret) !== SQL[b.id]?.is_secret)
      .map((b) => `${b.id} (client=${Boolean(b.secret)}, sql=${SQL[b.id]?.is_secret})`);
    expect(mismatched).toEqual([]);
  });

  it("chaque seuil numérique annoncé par le client est le même en SQL", () => {
    // Ne compare QUE les badges dont le serveur a une condition structurée avec
    // une valeur : les 'manual' n'ont rien à comparer par construction (la
    // condition n'est pas revérifiée côté serveur, cf. l'audit des conditions).
    //
    // Le nombre attendu est extrait du texte de `condition` du client (« Win 10
    // games », « 30-day streak »…) : c'est la SEULE valeur que le joueur lit, et
    // donc celle qui doit correspondre à ce que le serveur exigera.
    const mismatches = [];

    for (const b of badgesList) {
      const sql = SQL[b.id];
      if (!sql || sql.condition_value === null) continue;
      if (sql.condition_type === "manual" || sql.condition_type === "joker_profile") continue;

      const nums = String(b.condition ?? "").match(/\d+/g);
      if (!nums) continue; // condition non chiffrée (« ??? » d'un badge secret)

      if (!nums.map(Number).includes(sql.condition_value)) {
        mismatches.push(
          `${b.id} : client « ${b.condition} » vs SQL ${sql.condition_type}=${sql.condition_value}`
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("aucun badge à condition structurée n'a de condition_value manquante", () => {
    // condition_value est nullable en base. Sur un type numérique, un NULL fait
    // refuser l'unlock (fail-closed voulu, cf. condition_check.php) — donc un
    // badge définitivement indébloquable, sans erreur nulle part.
    const NUMERIC = [
      "wins_total",
      "mode_wins",
      "mode_games",
      "games_total",
      "streak_record",
      "perfect_wins",
      "unique_days",
      "giveups_total",
      "friends_count",
      "badges_count",
      "titles_count",
      "weekly_clean_modes",
      "classic_p1_wins",
      "emoji_p2_wins",
      "mode_wins_under_attempts",
      "mode_wins_single_day",
      "mode_consecutive_perfects",
      "expert_modes_mastered",
      "expert_wins_total",
    ];
    const broken = Object.entries(SQL)
      .filter(([, v]) => NUMERIC.includes(v.condition_type) && v.condition_value === null)
      .map(([slug, v]) => `${slug} (${v.condition_type})`);

    expect(broken).toEqual([]);
  });

  it("un badge à condition « mode_wins » nomme bien un mode reconnu", () => {
    const MODES = ["classic", "emoji", "silhouette", "alloutattack", "personae", "music"];
    const broken = Object.entries(SQL)
      .filter(([, v]) => ["mode_wins", "mode_games"].includes(v.condition_type))
      .filter(([, v]) => !MODES.includes(v.condition_mode ?? ""))
      .map(([slug, v]) => `${slug} (condition_mode=${v.condition_mode})`);

    expect(broken).toEqual([]);
  });
});
