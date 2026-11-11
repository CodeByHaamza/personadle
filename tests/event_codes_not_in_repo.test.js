/**
 * event_codes_not_in_repo.test.js — aucun code événement dans un fichier suivi.
 *
 * Le dépôt est public. Jusqu'à la 2.3, les codes étaient écrits dans les
 * migrations et dans `sql/bdd_mysql.sql` — y compris celui de la 2.3 « dévoilé
 * dans l'annonce Discord » (migration 054) : n'importe qui pouvait le lire sur
 * GitHub. Un code « exclusif au Discord » n'a de valeur que s'il n'existe que là.
 *
 * Depuis la 2.4 (lot 9), un code se crée dans l'admin (api/admin/event_codes.php),
 * donc dans la base de prod seulement. Ce test refuse toute insertion dans
 * `event_codes` dans une migration à partir de la 057. Les migrations plus
 * anciennes et le jeu de données de `bdd_mysql.sql` restent tels quels : les
 * réécrire n'effacerait rien de l'historique git. La seule parade pour eux est
 * de désactiver ces codes en prod et d'en créer de nouveaux dans l'admin.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(__dirname, "..", "sql", "migrations");
const FIRST_GUARDED = 57;

describe("event codes stay out of the public repo", () => {
  it("no migration from 057 on inserts into event_codes", () => {
    const offenders = readdirSync(MIGRATIONS)
      .filter((f) => /^\d{3}_.*\.sql$/.test(f) && Number(f.slice(0, 3)) >= FIRST_GUARDED)
      .filter((f) => {
        const sql = readFileSync(join(MIGRATIONS, f), "utf8")
          // Les commentaires peuvent parler des codes, pas en insérer.
          .replace(/--[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        return /\b(INSERT|REPLACE)\b[^;]*\bINTO\s+`?event_codes`?\s*[(\s]/i.test(sql);
      });
    expect(offenders, "crée ces codes dans l'admin, pas dans une migration").toEqual([]);
  });

  it("the guard actually catches an insert (self-check)", () => {
    const sql = "INSERT IGNORE INTO event_codes (code, badge_id) VALUES ('X', 'y');";
    expect(/\b(INSERT|REPLACE)\b[^;]*\bINTO\s+`?event_codes`?\s*[(\s]/i.test(sql)).toBe(true);
    // event_codes_redeemed n'est pas event_codes.
    const other = "INSERT INTO event_codes_redeemed (user_id, code) VALUES (1, 'X');";
    expect(/\b(INSERT|REPLACE)\b[^;]*\bINTO\s+`?event_codes`?\s*[(\s]/i.test(other)).toBe(false);
  });
});
