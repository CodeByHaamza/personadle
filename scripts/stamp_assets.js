#!/usr/bin/env node
/**
 * scripts/stamp_assets.js — Réécrit le `?v=` des JS/CSS locaux référencés dans
 * les pages HTML avec l'empreinte de LEUR contenu (sha256, 8 caractères).
 *
 * Remplace les `?v=1`…`?v=21` tenus à la main (et `version-all.sh`, qui mettait
 * le même numéro partout) : la moitié des balises n'en avait pas, l'autre moitié
 * dépendait d'un bump oublié une fois sur deux. Une empreinte de contenu ne
 * change QUE si le fichier change — un déploiement qui ne touche pas
 * `global.css` ne force pas les joueurs à le retélécharger, ce qu'un SHA de
 * commit ferait à chaque push.
 *
 * Périmètre (volontairement étroit) :
 *   - attributs `src="…"` / `href="…"` des balises <script> et <link> ;
 *   - fichiers locaux uniquement (pas de http(s)://, //, data:) ;
 *   - JAMAIS les specifiers d'`import` (fichiers .js et <script type="module">
 *     inline) : `./x.js?v=a` et `./x.js` sont DEUX modules distincts pour le
 *     navigateur — deux instances, deux états (api.js : jeton CSRF, utilisateur).
 *
 * Pour la même raison, une balise <script type="module" src> dont la cible est
 * aussi importée ailleurs (ex. `../../js/api.js` dans friends.html) n'est pas
 * versionnée : son `?v=` la séparerait de l'instance que les autres modules
 * importent. Le script retire même un `?v=` déjà posé sur un tel module.
 *
 * `sw.js` : son `CACHE_VERSION` devient l'empreinte des fichiers que le service
 * worker sert en cache-first (images, sons, polices…). Le bump manuel s'oubliait
 * (CLAUDE.md §7, « Assets périmés après un déploiement ») ; une empreinte change
 * dès qu'un de ces fichiers change, et seulement dans ce cas. Calculée depuis
 * l'index git (`git ls-files -s`) : stager les médias AVANT de tamponner.
 *
 * Limite assumée : les dépendances d'un module d'entrée ne sont pas versionnées.
 * C'est le `Cache-Control: no-cache` du `.htaccess` (revalidation, 304) et le
 * network-first de `sw.js` qui les tiennent fraîches — pas ce script.
 *
 * QUAND : à la release (PR `develop → main`, ou `hotfix/* → main`), pas à chaque
 * commit. Un tampon par commit ferait entrer en conflit, sur ~16 pages, deux
 * branches qui touchent `global.css` — pour un `?v=` que seule la prod lit. La CI
 * n'exige donc des tampons à jour que sur les PR vers `main` ; partout ailleurs
 * elle vérifie seulement qu'aucune page ne cite un fichier absent.
 *
 * Usage :
 *   node scripts/stamp_assets.js               # réécrit les HTML
 *   node scripts/stamp_assets.js --check       # vérifie sans écrire, exit 1 si dérive
 *   node scripts/stamp_assets.js --refs-only   # exit 1 seulement si un fichier cité manque
 *
 * npm run assets:stamp / assets:check / assets:refs — voir package.json.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFS_ONLY = process.argv.includes("--refs-only");
const CHECK = REFS_ONLY || process.argv.includes("--check");
const QUIET = process.argv.includes("--silent");

/** Fichiers suivis par git — ni node_modules, ni artefacts locaux. */
function trackedFiles(pattern) {
  const out = execFileSync("git", ["ls-files", "-z", "--", pattern], { cwd: ROOT });
  return out.toString("utf8").split("\0").filter(Boolean);
}

const hashCache = new Map();
/** Empreinte courte du contenu d'un fichier (null s'il n'existe pas). */
export function contentHash(absPath) {
  if (!hashCache.has(absPath)) {
    hashCache.set(
      absPath,
      existsSync(absPath)
        ? createHash("sha256").update(readFileSync(absPath)).digest("hex").slice(0, 8)
        : null
    );
  }
  return hashCache.get(absPath);
}

/** Fichiers servis en cache-first par sw.js (§5 de sa stratégie de fetch). */
const CACHE_FIRST_EXT =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|mp3|ogg|wav|m4a|mp4|webm|ttf|otf|woff2?)$/i;
const NOT_SITE =
  /^(?:tests|tests-e2e|scripts|docker|docs|sql|\.github|PersonaDLE_Update_Documentation)\//;

/**
 * Empreinte de l'ensemble des fichiers cache-first : chemin + blob git de
 * chacun, triés. Lit l'index git plutôt que les fichiers (≈ 1 Go de médias).
 */
export function cacheFirstFingerprint(lsFilesStage) {
  const lines = lsFilesStage
    .split("\0")
    .filter(Boolean)
    .map((l) => {
      const [meta, path] = l.split("\t");
      return { path, blob: meta.split(" ")[1] };
    })
    .filter(({ path }) => CACHE_FIRST_EXT.test(path) && !NOT_SITE.test(path))
    .map(({ path, blob }) => `${path} ${blob}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 10);
}

const CACHE_VERSION_RE = /(const CACHE_VERSION = )(["'])[^"']*\2;/;

/** Réécrit la constante CACHE_VERSION de sw.js. */
export function stampServiceWorker(source, fingerprint) {
  if (!CACHE_VERSION_RE.test(source))
    throw new Error("sw.js : constante CACHE_VERSION introuvable");
  return source.replace(
    CACHE_VERSION_RE,
    (_, decl, q) => `${decl}${q}personadle-${fingerprint}${q};`
  );
}

/** Code jamais chargé par une page : tests, outillage, configs à la racine. */
const NOT_SERVED = /^(?:tests|tests-e2e|scripts|docker|node_modules)\/|^[^/]+\.config\.js$/;

const isLocal = (url) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url);

/** Chemin disque d'une URL locale vue depuis `fromFile` ("/x" = racine du site). */
function resolveLocal(url, fromFile) {
  const clean = url.split(/[?#]/)[0];
  return clean.startsWith("/") ? join(ROOT, clean) : resolve(dirname(join(ROOT, fromFile)), clean);
}

// Specifiers d'import statiques, dynamiques et ré-exports.
const IMPORT_RE =
  /(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]+\s*from\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

/**
 * Fichiers importés par au moins un module (fichiers .js, et <script type="module">
 * inline des HTML). Un module d'entrée qui y figure ne doit pas porter de `?v=`.
 */
export function collectImportedFiles(
  jsFiles,
  htmlFiles,
  read = (f) => readFileSync(join(ROOT, f), "utf8")
) {
  const imported = new Set();
  const scan = (code, fromFile) => {
    for (const [, spec] of code.matchAll(IMPORT_RE)) {
      if (isLocal(spec) && /^\.{0,2}\//.test(spec)) imported.add(resolveLocal(spec, fromFile));
    }
  };
  for (const f of jsFiles) scan(read(f), f);
  for (const f of htmlFiles) {
    for (const [, body] of read(f).matchAll(
      /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
    )) {
      scan(body, f);
    }
  }
  return imported;
}

// <script … src="…js"> et <link … href="…css">, guillemets simples ou doubles.
const TAG_RE =
  /<(script|link)\b[^>]*?\b(src|href)=(["'])([^"']+?\.(?:js|css))(\?[^"'#]*)?(#[^"']*)?\3[^>]*>/gi;

/**
 * Réécrit le `?v=` des balises d'une page. Pure (lecture disque via `hashOf`) :
 * testée dans tests/stamp_assets.test.js.
 *
 * @returns {{ html: string, missing: string[], unversioned: string[] }}
 */
export function stampHtml(html, htmlFile, { imported, hashOf = contentHash }) {
  const missing = [];
  const unversioned = [];
  const out = html.replace(TAG_RE, (tag, tagName, attr, q, path, query = "", hash = "") => {
    if (!isLocal(path)) return tag;
    const abs = resolveLocal(path, htmlFile);
    const isModule =
      tagName.toLowerCase() === "script"
        ? /\btype=(["'])module\1/i.test(tag)
        : /\brel=(["'])modulepreload\1/i.test(tag);
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    params.delete("v");

    if (isModule && imported.has(abs)) {
      unversioned.push(path);
    } else {
      const h = hashOf(abs);
      if (!h) {
        missing.push(path);
        return tag;
      }
      params.set("v", h);
    }
    const qs = params.toString();
    const next = `${path}${qs ? `?${qs}` : ""}${hash}`;
    return tag.replace(`${attr}=${q}${path}${query}${hash}${q}`, () => `${attr}=${q}${next}${q}`);
  });
  return { html: out, missing, unversioned };
}

function main() {
  const htmlFiles = trackedFiles("*.html");
  // Seul le code servi au navigateur compte : un test Vitest qui importe
  // friends.js ne crée pas de seconde instance chez le joueur.
  const browserJs = trackedFiles("*.js").filter((f) => !NOT_SERVED.test(f));
  const imported = collectImportedFiles(browserJs, htmlFiles);
  const drift = [];
  const missing = [];

  for (const f of htmlFiles) {
    const before = readFileSync(join(ROOT, f), "utf8");
    const res = stampHtml(before, f, { imported });
    missing.push(...res.missing.map((p) => `${f} → ${p}`));
    if (res.html !== before) {
      drift.push(f);
      if (!CHECK) writeFileSync(join(ROOT, f), res.html);
    }
  }

  const swPath = join(ROOT, "sw.js");
  if (existsSync(swPath)) {
    const before = readFileSync(swPath, "utf8");
    const stage = execFileSync("git", ["ls-files", "-s", "-z"], { cwd: ROOT, maxBuffer: 64 << 20 });
    const after = stampServiceWorker(before, cacheFirstFingerprint(stage.toString("utf8")));
    if (after !== before) {
      drift.push("sw.js");
      if (!CHECK) writeFileSync(swPath, after);
    }
  }

  if (missing.length) {
    console.error("❌ Référence(s) vers un fichier absent du dépôt :");
    for (const m of missing) console.error(`   - ${m}`);
  }
  if (drift.length && !REFS_ONLY) {
    const verb = CHECK ? "à re-tamponner" : "re-tamponné(s)";
    console[CHECK ? "error" : "log"](`${CHECK ? "❌" : "✏️ "} ${drift.length} fichier(s) ${verb} :`);
    for (const f of drift)
      console[CHECK ? "error" : "log"](`   - ${relative(ROOT, join(ROOT, f))}`);
    if (CHECK) console.error("   → npm run assets:stamp");
  } else if (!QUIET && !missing.length) {
    console.log(
      REFS_ONLY
        ? "✅ Tous les JS/CSS cités par les pages existent"
        : "✅ ?v= à jour sur toutes les pages, CACHE_VERSION de sw.js à jour"
    );
  }
  if (missing.length || (CHECK && !REFS_ONLY && drift.length)) process.exit(1);
}

// Exécuté en CLI uniquement — les tests importent les fonctions.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
