/**
 * musicsMode/database/expert_twins.js — Chansons jumelles du Mode Expert Music.
 *
 * Deux enregistrements d'une même chanson (mêmes paroles, autre voix) ne se
 * départagent pas depuis les vers révélés. En Expert, seule la première porte
 * les paroles dans expert_mode_content.md — donc seule elle est tirable — et les
 * DEUX titres sont acceptés comme bonne réponse (décision Hamza, 2026-09-18 :
 * « on fera apparaître ces paroles une fois, mais les deux réponses seront
 * bonnes »). En mode normal les deux restent des cibles distinctes : l'audio
 * les départage.
 *
 * Clé : le titre qui porte les paroles ; valeurs : les titres acceptés en plus.
 * Tous sont des titres EXACTS de songs.js (tests/musicExpertTwins.test.js).
 */
export const EXPERT_TWINS = {
  // Yumi Kawamura côté P3, Shihoko Hirata côté P4 — même texte, Lotus Juice des deux côtés.
  "Light the Fire Up in the Night (P3 Side)": ["Light the Fire Up in the Night (P4 Side)"],
};
