/**
 * htaccess_fichiers_internes.test.js — Les notes internes du dépôt ne sont pas servies.
 *
 * Le webroot Hostinger est un clone git de `main` : TOUT le dépôt y est copié.
 * Vu le 2026-11-09 sur la prod : `personadle.net/CLAUDE.md`, `/TODO.md`,
 * `/DEPLOY.md`, `/expert_mode_content.md`, `/nom`, `/version-all.sh` répondaient
 * 200 — notes d'exploitation, procédures, noms d'hôtes et de base lisibles par
 * n'importe qui. Rien de secret au sens strict (le dépôt est public), mais
 * aucune raison de les servir depuis le site.
 *
 * On applique ici les VRAIES règles `<FilesMatch>` du `.htaccess` qui finissent
 * par `Require all denied` : comme Apache, elles portent sur le nom du fichier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HTACCESS = readFileSync(join(__dirname, "..", ".htaccess"), "utf8");

/** Motifs des blocs <FilesMatch "…"> … Require all denied … </FilesMatch>. */
function deniedPatterns(source) {
  const blocks = [...source.matchAll(/<FilesMatch "([^"]+)">([\s\S]*?)<\/FilesMatch>/g)];
  return blocks
    .filter(([, , body]) => /Require all denied/.test(body))
    .map(([, pattern]) => {
      // Apache (PCRE) accepte `(?i)` en tête ; JavaScript veut le drapeau.
      const insensitive = pattern.startsWith("(?i)");
      return new RegExp(insensitive ? pattern.slice(4) : pattern, insensitive ? "i" : "");
    });
}

const PATTERNS = deniedPatterns(HTACCESS);
const isDenied = (file) => PATTERNS.some((re) => re.test(file));

describe(".htaccess — notes internes", () => {
  it.each([
    "CLAUDE.md",
    "TODO.md",
    "DEPLOY.md",
    "README.md",
    "DEV_CHANGELOG.md",
    "expert_mode_content.md",
    "version-all.sh",
    "setup.sh",
    "nom",
    "iddée_demander.txt",
  ])("%s n'est pas servi", (file) => {
    expect(isDenied(file)).toBe(true);
  });

  it.each([
    "robots.txt",
    "LICENSE.txt",
    "sitemap.xml",
    "index.html",
    "PersonaDLE_Update.html",
    "sw.js",
    "en.json",
    "global.css",
    "Joker_aoa_illusration.webp",
  ])("%s reste servi", (file) => {
    expect(isDenied(file)).toBe(false);
  });
});
