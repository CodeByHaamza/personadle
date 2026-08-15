import { describe, it, expect } from "vitest";
import { maskTerms } from "../js/gameCore.js";
import { expertLyrics } from "../musicsMode/database/expert_lyrics.js";
import { songs } from "../musicsMode/database/songs.js";
import { personaeCharacters } from "../personaeMode/database/personaeCharacters.js";
import loreEn from "../personaeMode/database/expert_lore/en.json";
import loreFr from "../personaeMode/database/expert_lore/fr.json";

const LORE = { en: loreEn, fr: loreFr };
const loadLore = (lang) => LORE[lang];

const LANGS = ["en", "fr"];

// Une fuite, c'est le terme présent en tant que MOT — pas en sous-chaîne : « Christ »
// dans « Christianity » n'en est pas une, et maskTerms() ne le masque pas non plus.
const containsWord = (text, term) =>
  new RegExp(`(^|[^\\w'])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w'])`, "i").test(text);
const entries = (lore) => Object.entries(lore).filter(([k]) => !k.startsWith("_"));

// ─────────────────────────────────────────────────────────────────────────────
// maskTerms — utilitaire partagé par les deux modes Expert
// ─────────────────────────────────────────────────────────────────────────────
describe("maskTerms", () => {
  it("masque le terme quel que soit la casse", () => {
    expect(maskTerms(["Burn My Dread"], "Never gonna burn my dread")).toBe("Never gonna [?]");
  });

  it("tolère la ponctuation interne du terme", () => {
    expect(maskTerms(["Dance!"], "I want to dance tonight")).toBe("I want to [?] tonight");
  });

  it("ne coupe jamais au milieu d'un mot", () => {
    expect(maskTerms(["Mask"], "Beneath the Masked ball")).toBe("Beneath the Masked ball");
    expect(maskTerms(["Eros"], "Erosion of the soul")).toBe("Erosion of the soul");
  });

  it("masque plusieurs termes en une passe", () => {
    expect(maskTerms(["Hades", "Pluto"], "Hades, whom Rome called Pluto")).toBe(
      "[?], whom Rome called [?]",
    );
  });

  it("masque les noms courts — « Io » doit pouvoir être caché", () => {
    expect(maskTerms(["Io"], "Io was a priestess of Hera")).toBe("[?] was a priestess of Hera");
    expect(maskTerms(["Io"], "Ionian sea"), "pas de coupe en milieu de mot").toBe("Ionian sea");
  });

  it("ignore les termes d'une seule lettre", () => {
    expect(maskTerms(["a"], "a persona named a")).toBe("a persona named a");
  });

  it("accepte un token personnalisé", () => {
    expect(maskTerms(["Venus"], "Venus rose from the foam", "[nom]")).toBe(
      "[nom] rose from the foam",
    );
  });

  it("laisse le texte intact quand aucun terme ne matche", () => {
    const t = "You'll never see it coming";
    expect(maskTerms(["Last Surprise"], t)).toBe(t);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Paroles (mode Music Expert)
// ─────────────────────────────────────────────────────────────────────────────
describe("expert_lyrics", () => {
  it("chaque clé correspond à un titre exact de songs.js", () => {
    const titres = new Set(songs.map((s) => s.titre));
    expect(Object.keys(expertLyrics).filter((t) => !titres.has(t))).toEqual([]);
  });

  it("chaque chanson a au moins 2 vers (sinon pas de révélation progressive)", () => {
    expect(
      Object.entries(expertLyrics)
        .filter(([, v]) => v.length < 2)
        .map(([t]) => t),
    ).toEqual([]);
  });

  it("aucun vers vide ou non trimmé", () => {
    for (const [titre, vers] of Object.entries(expertLyrics)) {
      for (const v of vers) {
        expect(v, titre).toBe(v.trim());
        expect(v.length, titre).toBeGreaterThan(0);
      }
    }
  });

  it("les données sont brutes — le titre n'y est jamais pré-masqué", () => {
    for (const [titre, vers] of Object.entries(expertLyrics)) {
      for (const v of vers) expect(v, titre).not.toContain("[?]");
    }
  });

  it("aucun vers masqué ne laisse fuiter le titre", () => {
    for (const [titre, vers] of Object.entries(expertLyrics)) {
      const base = titre.replace(/\s*\(.*?\)\s*/g, " ").trim();
      if (base.length < 4) continue;
      for (const v of vers) {
        expect(containsWord(maskTerms([titre, base], v), base), `${titre} — "${v}"`).toBe(false);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lore (mode Personae Expert) — Persona 2 (IS + EP) et Persona 3
// ─────────────────────────────────────────────────────────────────────────────
describe("expert_lore", () => {
  it.each(LANGS)("%s : chaque clé correspond à une persona existante", (lang) => {
    const noms = new Set(personaeCharacters.map((p) => p.persona));
    expect(entries(loadLore(lang)).map(([k]) => k).filter((k) => !noms.has(k))).toEqual([]);
  });

  it("couvre exactement les mêmes personas dans toutes les langues", () => {
    const [ref, ...rest] = LANGS.map((l) => entries(loadLore(l)).map(([k]) => k).sort());
    for (const other of rest) expect(other).toEqual(ref);
  });

  it("couvre tout le roster Persona 2", () => {
    const p2 = personaeCharacters
      .filter((p) => p.opus.every((o) => o.startsWith("P2")))
      .map((p) => p.persona);
    const couverts = entries(loadLore("en")).map(([k]) => k);
    expect(p2.filter((n) => !couverts.includes(n))).toEqual([]);
  });

  // Variantes cosmétiques : même dessin, même mythe, donc même fiche que l'entrée de
  // base — les inclure rendrait la réponse ambiguë (rien dans le texte ne distingue
  // « Orpheus » de « Orpheus Picaro »). Elles restent hors du contenu Expert, donc
  // hors du tirage. `Orpheus ( Male )` porte la fiche de la famille Orpheus.
  const VARIANTES_P3_EXCLUES = [
    "Orpheus ( Female )",
    "Orpheus Picaro",
    "Orpheus Picaro ( Female )",
    "Orpheus Telos",
    "Thanatos Picaro",
    "Messiah Picaro",
    "Athena Picaros",
  ];

  it("couvre tout le roster Persona 3, variantes cosmétiques exclues", () => {
    const p3 = personaeCharacters
      .filter((p) => p.opus.every((o) => o.startsWith("P3")))
      .map((p) => p.persona)
      .filter((n) => !VARIANTES_P3_EXCLUES.includes(n));
    const couverts = entries(loadLore("en")).map(([k]) => k);
    expect(p3.filter((n) => !couverts.includes(n))).toEqual([]);
  });

  it("les variantes cosmétiques n'ont volontairement pas de fiche", () => {
    const couverts = entries(loadLore("en")).map(([k]) => k);
    expect(VARIANTES_P3_EXCLUES.filter((n) => couverts.includes(n))).toEqual([]);
  });

  it.each(LANGS)("%s : texte de longueur jouable et mask non vide", (lang) => {
    for (const [nom, { text, mask }] of entries(loadLore(lang))) {
      const mots = text.split(/\s+/).length;
      expect(mots, `${nom} (${lang})`).toBeGreaterThan(50);
      expect(mots, `${nom} (${lang})`).toBeLessThan(140);
      expect(mask.length, `${nom} (${lang})`).toBeGreaterThan(0);
    }
  });

  it.each(LANGS)("%s : le texte brut ne contient aucun masque pré-appliqué", (lang) => {
    for (const [nom, { text }] of entries(loadLore(lang))) {
      expect(text, `${nom} (${lang})`).not.toContain("[?]");
    }
  });

  it.each(LANGS)("%s : aucun texte masqué ne laisse fuiter le nom de la persona", (lang) => {
    for (const [nom, { text, mask }] of entries(loadLore(lang))) {
      const masque = maskTerms(mask, text);
      for (const terme of [nom, ...mask]) {
        if (terme.length < 2) continue;
        expect(containsWord(masque, terme), `${nom} (${lang}) — terme "${terme}"`).toBe(false);
      }
    }
  });

  it.each(LANGS)("%s : chaque fiche se nomme, pour que la révélation montre quelque chose", (lang) => {
    // Le texte doit citer la persona sous AU MOINS une de ses formes (le FR dit
    // « Maïa », l'EN « Maia ») : sans ça, rien n'est masqué pendant la partie et la
    // révélation de fin (victoire ou abandon) n'affiche rien de nouveau.
    for (const [nom, { text, mask }] of entries(loadLore(lang))) {
      const cite = mask.some((m) => text.toLowerCase().includes(m.toLowerCase()));
      expect(cite, `${nom} (${lang}) : aucune forme du nom dans le texte`).toBe(true);
      expect(maskTerms(mask, text), `${nom} (${lang})`).not.toBe(text);
    }
  });
});
