/**
 * stamp_assets.test.js — scripts/stamp_assets.js
 *
 * Le risque n'est pas le hash, c'est le module en double : `./x.js?v=a` et
 * `./x.js` sont deux modules pour le navigateur (deux instances d'api.js, deux
 * jetons CSRF). On vérifie surtout ce que le script NE touche PAS.
 */

import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  stampHtml,
  collectImportedFiles,
  cacheFirstFingerprint,
  stampServiceWorker,
} from "../scripts/stamp_assets.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const abs = (p) => join(ROOT, p);
const hashOf = (p) =>
  p.endsWith("missing.css") ? null : `h_${p.split("/").pop().replace(/\W/g, "")}`;

describe("stampHtml", () => {
  const none = new Set();

  it("replaces a hand-written ?v= with the content hash", () => {
    const { html } = stampHtml(
      '<link rel="stylesheet" href="../css/global.css?v=12" />',
      "profile/profile.html",
      {
        imported: none,
        hashOf,
      }
    );
    expect(html).toBe('<link rel="stylesheet" href="../css/global.css?v=h_globalcss" />');
  });

  it("adds ?v= where there was none, and keeps other query params", () => {
    const { html } = stampHtml(
      '<script src="./js/i18n.js"></script><link href="./a.css?media=x&v=3">',
      "index.html",
      { imported: none, hashOf }
    );
    expect(html).toContain('src="./js/i18n.js?v=h_i18njs"');
    expect(html).toContain('href="./a.css?media=x&v=h_acss"');
  });

  it("leaves external URLs alone", () => {
    const src = '<script src="https://cdn.example.com/x.js"></script><link href="//fonts.x/y.css">';
    expect(stampHtml(src, "index.html", { imported: none, hashOf }).html).toBe(src);
  });

  it("never versions a module entry that another module imports (and strips an old ?v=)", () => {
    const imported = new Set([abs("js/api.js")]);
    const { html, unversioned } = stampHtml(
      '<script type="module" src="../../js/api.js?v=4"></script>',
      "profile/friends/friends.html",
      { imported, hashOf }
    );
    expect(html).toBe('<script type="module" src="../../js/api.js"></script>');
    expect(unversioned).toEqual(["../../js/api.js"]);
  });

  it("versions a module entry nobody imports", () => {
    const { html } = stampHtml(
      '<script type="module" src="./friends.js?v=5"></script>',
      "profile/friends/friends.html",
      {
        imported: new Set([abs("js/api.js")]),
        hashOf,
      }
    );
    expect(html).toBe('<script type="module" src="./friends.js?v=h_friendsjs"></script>');
  });

  it("does not touch import specifiers inside inline module scripts", () => {
    const src = '<script type="module">import { a } from "./js/api.js";</script>';
    expect(stampHtml(src, "index.html", { imported: none, hashOf }).html).toBe(src);
  });

  it("reports a reference to a missing file without rewriting it", () => {
    const src = '<link rel="stylesheet" href="./missing.css?v=1" />';
    const res = stampHtml(src, "index.html", { imported: none, hashOf });
    expect(res.html).toBe(src);
    expect(res.missing).toEqual(["./missing.css"]);
  });

  it("resolves root-relative paths from the site root", () => {
    const seen = [];
    stampHtml('<link href="/css/global.css">', "pages/404.html", {
      imported: none,
      hashOf: (p) => (seen.push(p), "x"),
    });
    expect(seen).toEqual([abs("css/global.css")]);
  });
});

describe("collectImportedFiles", () => {
  const files = {
    "profile/friends/friends.js":
      'import { api } from "../../js/api.js";\nconst m = await import("./lazy.js");',
    "js/re_export.js": 'export { x } from "./gameCore.js";',
    "index.html":
      '<script type="module">import { checkStreakRecovery } from "./js/streak-recovery.js";</script>' +
      '<script type="module" src="./entry.js"></script>',
  };
  const read = (f) => files[f];

  it("collects static, dynamic and re-export specifiers, resolved from the importing file", () => {
    const set = collectImportedFiles(["profile/friends/friends.js", "js/re_export.js"], [], read);
    expect(set.has(abs("js/api.js"))).toBe(true);
    expect(set.has(abs("profile/friends/lazy.js"))).toBe(true);
    expect(set.has(abs("js/gameCore.js"))).toBe(true);
  });

  it("reads inline module scripts but not the src of external ones", () => {
    const set = collectImportedFiles([], ["index.html"], read);
    expect(set.has(abs("js/streak-recovery.js"))).toBe(true);
    expect(set.has(abs("entry.js"))).toBe(false);
  });
});

describe("cacheFirstFingerprint / stampServiceWorker", () => {
  const stage = (entries) => entries.map(([p, b]) => `100644 ${b} 0\t${p}`).join("\0") + "\0";

  it("changes when a cache-first asset changes, not when code changes", () => {
    const base = cacheFirstFingerprint(
      stage([
        ["img/a.png", "aaa"],
        ["js/x.js", "111"],
      ])
    );
    expect(
      cacheFirstFingerprint(
        stage([
          ["img/a.png", "aaa"],
          ["js/x.js", "222"],
        ])
      )
    ).toBe(base);
    expect(
      cacheFirstFingerprint(
        stage([
          ["img/a.png", "bbb"],
          ["js/x.js", "111"],
        ])
      )
    ).not.toBe(base);
  });

  it("ignores files the site never serves (docs, tests, changelogs)", () => {
    const base = cacheFirstFingerprint(stage([["img/a.png", "aaa"]]));
    expect(
      cacheFirstFingerprint(
        stage([
          ["img/a.png", "aaa"],
          ["docs/roadmap/persona-6.jpg", "zzz"],
          ["PersonaDLE_Update_Documentation/PersonaDLE 2.3/x.png", "yyy"],
        ])
      )
    ).toBe(base);
  });

  it("does not depend on listing order", () => {
    const a = cacheFirstFingerprint(
      stage([
        ["img/a.png", "1"],
        ["font/f.ttf", "2"],
      ])
    );
    const b = cacheFirstFingerprint(
      stage([
        ["font/f.ttf", "2"],
        ["img/a.png", "1"],
      ])
    );
    expect(a).toBe(b);
  });

  it("rewrites only the CACHE_VERSION constant", () => {
    const src =
      'const X = 1;\nconst CACHE_VERSION = "personadle-v106";\nconst Y = "personadle-v106";';
    expect(stampServiceWorker(src, "abc123")).toBe(
      'const X = 1;\nconst CACHE_VERSION = "personadle-abc123";\nconst Y = "personadle-v106";'
    );
  });

  it("fails loudly when the constant is missing", () => {
    expect(() => stampServiceWorker("const OTHER = 1;", "x")).toThrow(/CACHE_VERSION/);
  });
});
