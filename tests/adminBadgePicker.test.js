/**
 * adminBadgePicker.test.js — sélecteur de badge du panneau admin (2.3).
 *
 * `filtrerBadges()` est la seule logique du module qui puisse mal se comporter :
 * le reste n'est que l'ouverture d'un panneau. Un filtre trop strict rendrait un
 * badge introuvable dans une liste de 73 — et l'admin retomberait à taper le slug
 * à la main, ce que ce lot supprime précisément.
 */

import { describe, it, expect } from "vitest";
import { filtrerBadges } from "../admin/badge_picker.js";

const CATALOGUE = [
  { slug: "first_win", name_en: "First Victory", category: "achievement" },
  { slug: "velvet_headache", name_en: "Velvet Headache", category: "achievement" },
  { slug: "gyotre", name_en: "Gyotre", category: "secret" },
  { slug: "same_energy", name_en: "Same Energy", category: "social" },
];

describe("filtrerBadges", () => {
  it("rend tout le catalogue sans requête", () => {
    expect(filtrerBadges(CATALOGUE, "")).toHaveLength(4);
    expect(filtrerBadges(CATALOGUE, "   ")).toHaveLength(4);
    expect(filtrerBadges(CATALOGUE, null)).toHaveLength(4);
  });

  it("filtre par NOM, sans tenir compte de la casse", () => {
    expect(filtrerBadges(CATALOGUE, "velvet").map((b) => b.slug)).toEqual(["velvet_headache"]);
    expect(filtrerBadges(CATALOGUE, "VELVET").map((b) => b.slug)).toEqual(["velvet_headache"]);
  });

  it("filtre par SLUG — c'est lui qui part en base", () => {
    expect(filtrerBadges(CATALOGUE, "same_energy").map((b) => b.slug)).toEqual(["same_energy"]);
  });

  it("filtre par CATÉGORIE", () => {
    expect(filtrerBadges(CATALOGUE, "secret").map((b) => b.slug)).toEqual(["gyotre"]);
    expect(filtrerBadges(CATALOGUE, "achievement")).toHaveLength(2);
  });

  it("trouve sur une sous-chaîne, pas seulement un début de mot", () => {
    // Un admin tape « head », pas « velvet_headache ».
    expect(filtrerBadges(CATALOGUE, "head").map((b) => b.slug)).toEqual(["velvet_headache"]);
  });

  it("garde l'ordre d'origine du catalogue", () => {
    expect(filtrerBadges(CATALOGUE, "e").map((b) => b.slug)).toEqual(
      CATALOGUE.filter((b) => /e/i.test(b.slug + b.name_en + b.category)).map((b) => b.slug)
    );
  });

  it("rend une liste vide quand rien ne correspond", () => {
    expect(filtrerBadges(CATALOGUE, "zzzz")).toEqual([]);
  });

  it("ne modifie jamais le catalogue d'origine", () => {
    const copie = [...CATALOGUE];
    filtrerBadges(CATALOGUE, "");
    expect(CATALOGUE).toEqual(copie);
    expect(filtrerBadges(CATALOGUE, "")).not.toBe(CATALOGUE);
  });

  it("tolère un catalogue absent ou des entrées incomplètes", () => {
    expect(filtrerBadges(null, "x")).toEqual([]);
    expect(filtrerBadges(undefined, "x")).toEqual([]);
    expect(() => filtrerBadges([{}, { slug: "a" }], "a")).not.toThrow();
    expect(filtrerBadges([{}, { slug: "a" }], "a").map((b) => b.slug)).toEqual(["a"]);
  });
});
