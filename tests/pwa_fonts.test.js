/**
 * pwa_fonts.test.js — application installable et polices auto-hébergées.
 *
 * Deux régressions silencieuses à empêcher : une page qui recharge Google Fonts
 * (la CSP le bloque désormais → texte en police de repli, sans erreur visible),
 * et un manifeste qui pointe vers une icône absente (installation refusée).
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = (glob) =>
  execFileSync("git", ["ls-files", "-z", "--", glob], { cwd: ROOT })
    .toString()
    .split("\0")
    .filter(Boolean);

describe("self-hosted fonts", () => {
  it("no page, stylesheet or script loads Google Fonts anymore (sw.js aside)", () => {
    const offenders = [...tracked("*.html"), ...tracked("*.css"), ...tracked("*.js")]
      .filter((f) => !f.startsWith("node_modules/") && f !== "sw.js" && !f.startsWith("tests/"))
      .filter((f) => !f.startsWith("scripts/fetch_google_fonts.js"))
      .filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(join(ROOT, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("every font file declared by css/fonts.css exists", () => {
    const css = readFileSync(join(ROOT, "css/fonts.css"), "utf8");
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(existsSync(resolve(ROOT, "css", u)), u).toBe(true);
  });

  it("the CSP no longer allows Google", () => {
    const htaccess = readFileSync(join(ROOT, ".htaccess"), "utf8");
    const csp = /Content-Security-Policy "([^"]+)"/.exec(htaccess)[1];
    expect(csp).not.toMatch(/googleapis|gstatic/);
    expect(csp).toMatch(/font-src 'self'/);
  });
});

describe("web app manifest", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));

  it("has what browsers require to offer installation", () => {
    expect(manifest.name).toBe("PersonaDLE");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeTruthy();
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("points to icons and shortcut pages that exist", () => {
    for (const i of manifest.icons) expect(existsSync(join(ROOT, i.src)), i.src).toBe(true);
    for (const s of manifest.shortcuts) {
      expect(existsSync(join(ROOT, s.url.replace(/^\.\//, "").split("?")[0])), s.url).toBe(true);
    }
  });

  it("is linked from every game page", () => {
    const pages = [
      "index.html",
      "classiqueMode/classiqueMode.html",
      "emojiMode/emojiMode.html",
      "silhouetteMode/silhouette.html",
      "allOutAttackMode/allOutAttack.html",
      "personaeMode/personae.html",
      "musicsMode/musics.html",
      "profile/profile.html",
    ];
    for (const p of pages) {
      const html = readFileSync(join(ROOT, p), "utf8");
      const href = /<link rel="manifest" href="([^"]+)"/.exec(html)?.[1];
      expect(href, p).toBeTruthy();
      expect(existsSync(resolve(ROOT, dirname(p), href)), `${p} → ${href}`).toBe(true);
    }
  });
});
