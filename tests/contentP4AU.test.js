import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { silhouetteCharacters } from "../silhouetteMode/database/silhouetteCharacters.js";
import { portraitsMapSilhouette } from "../silhouetteMode/database/portraitsMapSilhouette.js";
import { songs } from "../musicsMode/database/songs.js";
import { musicTitles } from "../musicsMode/database/musicTitles.js";
import { expertLyrics } from "../musicsMode/database/expert_lyrics.js";
import { badgesList } from "../profile/badges/badgesData.js";


/**
 * Lot de contenu 2.1 : les 8 variantes P4AU du mode Silhouette, la musique
 * « Memories of You » et le badge false_spring qui l'accompagne.
 *
 * Ces tests visent surtout les liens qui cassent EN SILENCE : un dataset qui
 * référence une image absente ne lève rien au build, il rend juste une partie
 * injouable (cadre vide) pour le joueur qui tombe dessus.
 */

const repoPath = (relative) => fileURLToPath(new URL("../" + relative, import.meta.url));

// Les fichiers de langue sont lus, pas importés : les import attributes
// (`with { type: "json" }`) ne passent pas le parser ESLint du projet.
const LANGS = Object.fromEntries(
  ["en", "fr", "es", "de", "it", "pt"].map((code) => [
    code,
    JSON.parse(readFileSync(repoPath(`lang/${code}.json`), "utf8")),
  ])
);

const P4AU_VARIANTS = [
  "Aigis (P4AU)",
  "Akihiko Sanada (P4AU)",
  "Fuuka Yamagishi (P4AU)",
  "Junpei Iori (P4AU)",
  "Ken Amada (P4AU)",
  "Koromaru (P4AU)",
  "Mitsuru Kirijo (P4AU)",
  "Yukari Takeba (P4AU)",
];

describe("silhouette — variantes P4AU de la SEES", () => {
  const byName = (nom) => silhouetteCharacters.find((c) => c.nom === nom);

  it("les 8 variantes sont présentes et taguées P4AU uniquement", () => {
    for (const nom of P4AU_VARIANTS) {
      const entry = byName(nom);
      expect(entry, `${nom} absent de silhouetteCharacters.js`).toBeDefined();
      expect(entry.opus).toEqual(["P4AU"]);
    }
  });

  it("aucun `nom` en double dans tout le dataset silhouette", () => {
    // Deux entrées homonymes feraient pointer showWrong(), le drapeau _guessed et
    // la résolution de cible d'un défi sur la PREMIÈRE trouvée — donc parfois sur
    // la mauvaise version. C'est exactement ce que le suffixe « (P4AU) » évite.
    const seen = new Map();
    const duplicates = [];
    for (const c of silhouetteCharacters) {
      if (seen.has(c.nom)) duplicates.push(c.nom);
      seen.set(c.nom, true);
    }
    expect(duplicates).toEqual([]);
  });

  it("la variante P4AU ne réutilise pas l'image de la version P3", () => {
    // Même dessin des deux côtés = le joueur ne peut pas distinguer les deux
    // propositions de l'autocomplétion, et se voit refuser une bonne réponse.
    for (const nom of P4AU_VARIANTS) {
      const base = byName(nom.replace(" (P4AU)", ""));
      expect(base, `version P3 de ${nom} introuvable`).toBeDefined();
      expect(byName(nom).image).not.toBe(base.image);
    }
  });

  it("chaque silhouette du dataset a bien son fichier .webp sur disque", () => {
    const missing = silhouetteCharacters
      .map((c) => ({ nom: c.nom, file: `silhouetteMode/database/img/${c.image}.webp` }))
      .filter(({ file }) => !existsSync(repoPath(file)));
    expect(missing).toEqual([]);
  });

  it("chaque variante P4AU a son propre portrait, distinct de celui de la version P3", () => {
    for (const nom of P4AU_VARIANTS) {
      const portrait = portraitsMapSilhouette[nom];
      expect(portrait, `portraitsMapSilhouette["${nom}"] manquant`).toBeDefined();
      // Sans entrée dans la map, le fallback `nom.split(" ")[0]` renverrait le
      // portrait P3 — les deux lignes de l'autocomplétion seraient identiques.
      expect(portrait).not.toBe(portraitsMapSilhouette[nom.replace(" (P4AU)", "")]);
      expect(existsSync(repoPath(`database/portraits/${portrait}.webp`))).toBe(true);
    }
  });
});

describe("musique — Memories of You (P3R)", () => {
  const song = songs.find((s) => s.titre === "Memories of You");

  it("est enregistrée en P3R avec son fichier audio présent", () => {
    expect(song).toBeDefined();
    expect(song.opus).toEqual(["P3R"]);
    expect(existsSync(repoPath(`musicsMode/database/music/song/${song.fichier}`))).toBe(true);
  });

  it("est devinable (présente dans musicTitles.js)", () => {
    expect(musicTitles).toContain("Memories of You");
  });

  it("a des paroles, donc entre dans le pool du Mode Expert", () => {
    // Une chanson absente d'expertLyrics est silencieusement hors du tirage Expert.
    expect(expertLyrics["Memories of You"]?.length).toBeGreaterThanOrEqual(2);
  });

  it("tous les fichiers audio référencés par songs.js existent", () => {
    const missing = songs
      .filter((s) => !existsSync(repoPath(`musicsMode/database/music/song/${s.fichier}`)))
      .map((s) => s.titre);
    expect(missing).toEqual([]);
  });
});

describe("badge false_spring — A Gentle Reprieve", () => {
  const badge = badgesList.find((b) => b.id === "false_spring");

  it("existe et ne se débloque que sur l'abandon de Memories of You", () => {
    expect(badge).toBeDefined();
    expect(badge.check({}, {})).toBe(false);
    expect(badge.check({}, { gaveUpOnOurLight: true })).toBe(false);
    expect(badge.check({}, { gaveUpOnMemoriesOfYou: true })).toBe(true);
  });

  it("est traduit dans les 6 langues (nom, condition, description)", () => {
    for (const [code, lang] of Object.entries(LANGS)) {
      const entry = lang.badges?.false_spring;
      expect(entry, `badges.false_spring manquant dans ${code}.json`).toBeDefined();
      for (const field of ["name", "condition", "description"]) {
        expect(entry[field]?.trim(), `${code}.json → ${field} vide`).toBeTruthy();
      }
    }
  });

  it("ne partage pas son image avec un autre badge", () => {
    const sameImage = badgesList.filter((b) => b.img === badge.img);
    expect(sameImage).toHaveLength(1);
  });
});
