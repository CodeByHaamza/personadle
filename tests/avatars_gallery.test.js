/**
 * avatars_gallery.test.js — Intégrité de la galerie d'avatars et des fonds de la
 * carte de partage : ce que le code LISTE doit exister sur le disque, et ce que
 * le serveur ACCEPTE doit couvrir tout ce que la galerie propose.
 *
 * Ajouté le 2026-09-17 en important 29 portraits. La première passe a sorti deux
 * avatars présents depuis la 2.0 que le serveur refusait (personadle_validate_avatar,
 * api/lib/validation.php) : `Kanji.avif` (extension hors liste) et
 * `Caroline&justine.png` (le « & »). Choisis, ils restaient locaux — jamais
 * persistés sur le compte, écrasés au prochain pull cloud, absents sur un autre
 * appareil — sans le moindre message. Ce test empêche la récidive.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { AVATAR_GROUPS, ANIMATED_AVATARS } from "../profile/avatars_data.js";
import { shareWallpapers } from "../profile/share-card.js";
import { UNLOCKABLE_WALLPAPERS } from "../profile/wallpapers-ui.js";
import { normalizeAvatarPath } from "../profile/profile-format.js";

const ROOT = join(import.meta.dirname, "..");
const AVATAR_DIR = join(ROOT, "img", "avatar");

/** Miroir EXACT de la liste blanche serveur (api/lib/validation.php, personadle_validate_avatar). */
const SERVER_GALLERY_NAME = /^[A-Za-z0-9_-]+\.(?:gif|png|jpe?g|webp|avif)$/;

const listed = AVATAR_GROUPS.flatMap((g) => g.avatars);
const onDisk = readdirSync(AVATAR_DIR);

describe("galerie d'avatars (profile/avatars_data.js ↔ img/avatar/)", () => {
  it("chaque portrait listé existe sur le disque", () => {
    const missing = listed.filter((n) => !onDisk.includes(n));
    expect(missing, "listés dans avatars_data.js mais absents de img/avatar/").toEqual([]);
  });

  it("chaque fichier de img/avatar/ est proposé dans un groupe (pas d'orphelin)", () => {
    const orphans = onDisk.filter((f) => !listed.includes(f));
    expect(orphans, "fichiers de img/avatar/ que personne ne peut choisir").toEqual([]);
  });

  it("aucun portrait n'apparaît dans deux groupes", () => {
    const dup = listed.filter((n, i) => listed.indexOf(n) !== i);
    expect(dup).toEqual([]);
  });

  it("chaque nom passe la liste blanche du serveur — sinon le choix n'est jamais persisté sur le compte", () => {
    const rejected = listed.filter((n) => !SERVER_GALLERY_NAME.test(n));
    expect(rejected, "refusés par personadle_validate_avatar (espace, &, parenthèse, extension…)").toEqual([]);
  });

  it("les groupes ont une clé connue du picker et un libellé de jeu", () => {
    const known = ["persona1", "persona2", "persona3", "persona4", "persona5", "persona5x", "personaq", "special"];
    for (const g of AVATAR_GROUPS) {
      expect(known).toContain(g.key);
      expect(typeof g.game).toBe("string");
      expect(g.avatars.length).toBeGreaterThan(0);
    }
  });

  it("les portraits Persona Q/Q2 sont regroupés dans le groupe « Persona Q », ordonnés P3 → P4 → P5", () => {
    // Ordre FIGÉ, décision Hamza du 2026-09-18 : ce groupe se range par jeu
    // d'origine, pas par rôle — c'est le style Etrian qu'on y cherche. Les deux
    // médaillons ronds `akihiko_sanada_pq` et `koromaru_pq` ont rejoint le
    // groupe le 2026-09-23 : ils étaient classés en P3 alors que leur art est un
    // art de Persona Q (même correction de principe).
    const pq = AVATAR_GROUPS.find((g) => g.key === "personaq");
    expect(pq).toBeTruthy();
    expect(pq.avatars).toEqual([
      // Persona 3
      "makoto_yuki_pq2.jpg", "kotone_pq.jpg", "yukari_pq2.jpg", "junpei_pq.jpg",
      "akihiko_pq2.jpg", "akihiko_sanada_pq.jpg", "mitsuru_pq2.jpg", "aigis_pq2.jpg",
      "koromaru_pq2.jpg", "koromaru_pq.jpg", "ken_amada_pq2.jpg", "shinjiro_pq2.jpg",
      // Persona 4
      "yu_pq.jpg", "yosuke_pq.jpg", "chie_pq.jpg", "yukiko_pq.jpg", "kanji_pq.jpg",
      "rise_pq.jpg", "teddie_pq.jpg", "naoto_pq.jpg",
      // Persona 5
      "joker_pq.jpg", "ryuji_pq.jpg", "ann_pq.jpg", "morgana_pq.jpg", "yusuke_pq.jpg",
      "makoto_nijima_pq.jpg", "haru_pq.jpg", "crow_pq2.jpg",
    ]);
    // Aucun portrait Q/Q2 ne traîne dans un autre groupe
    for (const g of AVATAR_GROUPS) {
      if (g.key === "personaq") continue;
      expect(g.avatars.filter((n) => /_pq2?\.jpg$/.test(n)), g.key).toEqual([]);
    }
    // …et réciproquement, le groupe ne contient QUE des portraits de ce style.
    expect(pq.avatars.filter((n) => !/_pq2?\.jpg$/.test(n))).toEqual([]);
  });

  it("les trois autres portraits du lot restent dans le jeu de leur personnage", () => {
    const byKey = Object.fromEntries(AVATAR_GROUPS.map((g) => [g.key, g.avatars]));
    expect(byKey.persona4).toContain("naoto_p4r.jpg");
    expect(byKey.persona5).toContain("morgana_dancing.jpg");
    expect(byKey.special).toContain("jojo_frost.jpg");
  });

  it("deux portraits mal rangés depuis la 2.0 sont dans le jeu de leur personnage (retour Hamza 2026-09-18)", () => {
    const byKey = Object.fromEntries(AVATAR_GROUPS.map((g) => [g.key, g.avatars]));
    // Marie est un personnage de Persona 4 (ici sa version P4 Revival), pas de P5X.
    expect(byKey.persona4).toContain("hui_marie_p4r_pfp.jpg");
    expect(byKey.persona5x).not.toContain("hui_marie_p4r_pfp.jpg");
    // JOKER.webp est le Joker d'Innocent Sin (Persona 2), pas celui de Persona 5.
    expect(byKey.persona2).toContain("JOKER.webp");
    expect(byKey.persona5).not.toContain("JOKER.webp");
  });

  it("le groupe Persona Q vient après Persona 5X et avant Spécial", () => {
    const keys = AVATAR_GROUPS.map((g) => g.key);
    expect(keys.indexOf("personaq")).toBe(keys.indexOf("persona5x") + 1);
    expect(keys.indexOf("special")).toBe(keys.indexOf("personaq") + 1);
  });
});

describe("normalizeAvatarPath — portrait renommé", () => {
  it("un profil local qui porte encore « Caroline&justine.png » retombe sur le nouveau nom", () => {
    expect(normalizeAvatarPath("../img/avatar/Caroline&justine.png")).toBe("../img/avatar/caroline_justine.png");
    expect(normalizeAvatarPath("./img/avatar/Caroline&justine.png")).toBe("../img/avatar/caroline_justine.png");
  });

  it("…et le nouveau nom existe bien sur le disque, sous un nom que le serveur accepte", () => {
    expect(onDisk).toContain("caroline_justine.png");
    expect(onDisk).not.toContain("Caroline&justine.png");
    expect(SERVER_GALLERY_NAME.test("caroline_justine.png")).toBe(true);
  });
});

describe("fonds de la carte de partage (profile/share-card.js)", () => {
  const all = Object.values(shareWallpapers).flat();

  it("chaque fond référencé existe sur le disque (chemins relatifs à profile/)", () => {
    const missing = all.filter((w) => w.src && !existsSync(join(ROOT, "profile", w.src)));
    expect(missing.map((w) => w.src), "fonds listés mais absents").toEqual([]);
  });

  it("les identifiants de fonds sont uniques", () => {
    const ids = all.map((w) => w.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("Persona 4 Revival est disponible d'office dans le groupe Persona 4, pas comme déblocable", () => {
    const p4r = shareWallpapers.persona4.find((w) => w.id === "p4_revival");
    expect(p4r).toBeTruthy();
    expect(p4r.src).toBe("../profile/Wallpaper/wallpaper_p4r.jpg");
    expect(existsSync(join(ROOT, "profile", p4r.src))).toBe(true);
    expect(UNLOCKABLE_WALLPAPERS.some((w) => w.id === "p4_revival" || /p4r/.test(w.src))).toBe(false);
  });

  it("chaque fond déblocable existe aussi sur le disque", () => {
    const missing = UNLOCKABLE_WALLPAPERS.filter((w) => !existsSync(join(ROOT, "profile", w.src)));
    expect(missing.map((w) => w.src)).toEqual([]);
  });
});

/**
 * Relit l'en-tête d'un fichier pour dire s'il est animé — même logique que
 * `scripts/sort_avatars_data.mjs`, réécrite ici volontairement. Un test qui
 * importerait la fonction du générateur ne prouverait rien : il confirmerait que
 * le générateur est d'accord avec lui-même. Ici on repart des OCTETS.
 */
function bougeVraiment(chemin) {
  const tete = Buffer.alloc(8192);
  const fd = openSync(chemin, "r");
  let lus = 0;
  try {
    lus = readSync(fd, tete, 0, tete.length, 0);
  } finally {
    closeSync(fd);
  }
  const buf = tete.subarray(0, lus);
  if (buf.subarray(0, 4).toString("latin1") === "RIFF") {
    return buf.includes("ANIM") || buf.includes("ANMF");
  }
  if (buf.subarray(0, 3).toString("latin1") === "GIF") {
    if (buf.includes("NETSCAPE")) return true;
    let blocs = 0;
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0x21 && buf[i + 1] === 0xf9 && buf[i + 2] === 0x04 && ++blocs >= 2) return true;
    }
  }
  return false;
}

describe("portraits animés (ANIMATED_AVATARS)", () => {
  it("la liste est exactement l'ensemble des portraits qui bougent sur le disque", () => {
    // Le filtre « Animés » de l'atelier se lit UNIQUEMENT dans cette liste. Si
    // elle dérive du disque, le joueur voit soit des portraits fixes dans
    // l'onglet, soit des animés introuvables — et rien ne lèverait d'erreur.
    const reels = listed.filter((n) => bougeVraiment(join(AVATAR_DIR, n))).sort();
    expect([...ANIMATED_AVATARS].sort()).toEqual(reels);
  });

  it("chaque portrait animé est bien proposé dans un groupe", () => {
    // Un animé listé mais absent des groupes serait invisible partout : le
    // filtre parcourt les groupes, il ne lit pas la liste directement.
    const horsGroupes = [...ANIMATED_AVATARS].filter((n) => !listed.includes(n));
    expect(horsGroupes, "animés absents de tout groupe de la galerie").toEqual([]);
  });

  it("l'extension ne suffisait pas à trancher — c'est bien pour ça qu'on lit les octets", () => {
    // Ce test documente la raison d'être du mécanisme, et se casserait si
    // quelqu'un revenait à un test sur `.gif`. Les WebP de Kotone sont animés,
    // et la galerie contient par ailleurs des .webp parfaitement fixes.
    const animesNonGif = [...ANIMATED_AVATARS].filter((n) => !n.toLowerCase().endsWith(".gif"));
    expect(animesNonGif.length, "des animés qui ne sont pas des .gif").toBeGreaterThan(0);

    const webpFixes = listed.filter(
      (n) => n.toLowerCase().endsWith(".webp") && !ANIMATED_AVATARS.has(n)
    );
    expect(webpFixes.length, "des .webp fixes dans la galerie").toBeGreaterThan(0);
  });

  it("les portraits animés passent la liste blanche du serveur", () => {
    // Même piège que `Kanji.avif` en 2.2 : un portrait choisissable mais refusé
    // à l'enregistrement reste local et disparaît au prochain pull cloud.
    const refuses = [...ANIMATED_AVATARS].filter((n) => !SERVER_GALLERY_NAME.test(n));
    expect(refuses, "animés que personadle_validate_avatar refuserait").toEqual([]);
  });
});
