/**
 * validateIncoming.test.js — Tests du validateur de dossier d'ingestion.
 *
 * `validateIncoming(rootDir)` lit un dossier `incoming/<type>/...` sur disque et renvoie
 * une liste d'erreurs/avertissements lisibles. Zéro erreur = fichiers conformes à la
 * convention `incoming/<type>/<persona-snake_case>.<ext>` (voir ROADMAP.md).
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateIncoming } from "../scripts/validate_incoming.js";

let tmpDir;

function makeIncoming(structure) {
  tmpDir = mkdtempSync(join(tmpdir(), "personadle-incoming-"));
  for (const [type, files] of Object.entries(structure)) {
    const typeDir = join(tmpDir, type);
    mkdirSync(typeDir, { recursive: true });
    for (const file of files) {
      writeFileSync(join(typeDir, file), "");
    }
  }
  return tmpDir;
}

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("validateIncoming", () => {
  it("returns no error and no warning for a fully valid incoming folder", () => {
    const dir = makeIncoming({ portrait: ["joker.webp"], music: ["aria_of_the_soul.mp3"] });
    expect(validateIncoming(dir)).toEqual({ errors: [], warnings: [], fileCount: 2 });
  });

  it("flags a non-snake_case file name as an error", () => {
    const dir = makeIncoming({ portrait: ["Joker-Final.webp"] });
    const { errors } = validateIncoming(dir);
    expect(errors.join()).toMatch(/snake_case/);
  });

  it("flags an extension not allowed for the given type as an error", () => {
    const dir = makeIncoming({ portrait: ["joker.mp4"] });
    const { errors } = validateIncoming(dir);
    expect(errors.join()).toMatch(/extension/);
  });

  it("warns on an unknown type directory but does not error on its files", () => {
    const dir = makeIncoming({ unknown_type: ["joker.psd"] });
    const { errors, warnings } = validateIncoming(dir);
    expect(warnings.join()).toMatch(/Type de dossier inconnu/);
    expect(errors).toEqual([]);
  });

  it("does not restrict extensions for the misc type", () => {
    const dir = makeIncoming({ misc: ["notes.txt"] });
    expect(validateIncoming(dir).errors).toEqual([]);
  });

  it("reports an error when the root directory does not exist", () => {
    const { errors, fileCount } = validateIncoming(join(tmpdir(), "personadle-does-not-exist"));
    expect(errors.join()).toMatch(/introuvable/i);
    expect(fileCount).toBe(0);
  });
});
