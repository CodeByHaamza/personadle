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
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AVATAR_GROUPS } from "../profile/avatars_data.js";
import { shareWallpapers } from "../profile/share-card.js";
import { UNLOCKABLE_WALLPAPERS } from "../profile/wallpapers-ui.js";
import { normalizeAvatarPath } from "../profile/profile-format.js";

const ROOT = join(import.meta.dirname, "..");
const AVATAR_DIR = join(ROOT, "img", "avatar");

/** Miroir EXACT de la liste blanche serveur (api/lib/validation.php, personadle_validate_avatar). */
const SERVER_GALLERY_NAME = /^[A-Za-z0-9_-]+\.(?:gif|png|jpe?g|webp|avif)$/;

const listed = AVATAR_GROUPS.flatMap((g) => g.avatars);

/** Sous-dossier des portraits DÉBLOCABLES (migration 054) — pas de la galerie libre. */
const UNLOCKABLE_DIR = "unlockable";

// `withFileTypes` : sans ça, le sous-dossier `unlockable/` ressortait comme un
// « fichier orphelin » de la galerie libre. Il a son propre garde-fou plus bas.
const onDisk = readdirSync(AVATAR_DIR, { withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => e.name);

describe("galerie d'avatars (profile/avatars_data.js ↔ img/avatar/)", () => {
  it("chaque portrait listé existe sur le disque", () => {
    const missing = listed.filter((n) => !onDisk.includes(n));
    expect(missing, "listés dans avatars_data.js mais absents de img/avatar/").toEqual([]);
  });

  it("chaque fichier de img/avatar/ est proposé dans un groupe (pas d'orphelin)", () => {
    const orphans = onDisk.filter((f) => !listed.includes(f));
    expect(orphans, "fichiers de img/avatar/ que personne ne peut choisir").toEqual([]);
  });

  it("aucun portrait déblocable ne traîne dans la galerie libre", () => {
    // Un portrait du pack listé dans avatars_data.js serait offert à tout le
    // monde : le déblocage n'existerait plus, sans que rien ne le signale.
    const fuites = listed.filter((n) => n.includes(UNLOCKABLE_DIR));
    expect(fuites, "portraits déblocables listés comme libres").toEqual([]);
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

  it("les 26 portraits Persona Q/Q2 sont regroupés dans le groupe « Persona Q », ordonnés P3 → P4 → P5", () => {
    const pq = AVATAR_GROUPS.find((g) => g.key === "personaq");
    expect(pq).toBeTruthy();
    expect(pq.avatars).toEqual([
      "makoto_yuki_pq2.jpg", "kotone_pq.jpg", "yukari_pq2.jpg", "junpei_pq.jpg", "akihiko_pq2.jpg",
      "mitsuru_pq2.jpg", "aigis_pq2.jpg", "koromaru_pq2.jpg", "ken_amada_pq2.jpg", "shinjiro_pq2.jpg",
      "yu_pq.jpg", "yosuke_pq.jpg", "chie_pq.jpg", "yukiko_pq.jpg", "kanji_pq.jpg", "rise_pq.jpg", "teddie_pq.jpg", "naoto_pq.jpg",
      "joker_pq.jpg", "ryuji_pq.jpg", "ann_pq.jpg", "morgana_pq.jpg", "yusuke_pq.jpg", "makoto_nijima_pq.jpg", "haru_pq.jpg", "crow_pq2.jpg",
    ]);
    // Aucun portrait Q/Q2 ne traîne dans un autre groupe
    for (const g of AVATAR_GROUPS) {
      if (g.key === "personaq") continue;
      expect(g.avatars.filter((n) => /_pq2?\.jpg$/.test(n)), g.key).toEqual([]);
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Portraits DÉBLOCABLES (table `avatars`, migration 054)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ces portraits ne vivent PAS dans `avatars_data.js` : leur catalogue est en base,
 * et c'est le serveur qui décide qui les a (api/lib/unlock_reconcile.php). Rien
 * côté JS ne les référence, donc rien côté JS ne s'apercevrait qu'un fichier
 * manque ou qu'une ligne pointe à côté — la vignette serait simplement vide dans
 * la modale, et seulement pour les joueurs qui ont débloqué le pack.
 *
 * On lit donc la migration comme source, et on la confronte au disque.
 */
describe("portraits déblocables (migration 054 ↔ img/avatar/unlockable/)", () => {
  const MIGRATION = join(ROOT, "sql", "migrations", "054_unlockable_avatars.sql");
  const UNLOCKABLE_PATH = join(AVATAR_DIR, UNLOCKABLE_DIR);

  const sql = readFileSync(MIGRATION, "utf8");
  // Les chemins tels que la table les stocke : 'img/avatar/unlockable/<fichier>'.
  const cataloguees = [...sql.matchAll(/'img\/avatar\/unlockable\/([^']+)'/g)].map((m) => m[1]);
  const surDisque = readdirSync(UNLOCKABLE_PATH);

  it("la migration référence au moins un portrait", () => {
    // Si le motif de lecture ci-dessus cassait (chemin réécrit, guillemets
    // changés), tous les cas suivants passeraient au vert sur une liste vide.
    expect(cataloguees.length).toBeGreaterThan(0);
  });

  it("chaque portrait catalogué existe sur le disque", () => {
    const manquants = cataloguees.filter((f) => !surDisque.includes(f));
    expect(manquants, "référencés par la migration 054 mais absents du disque").toEqual([]);
  });

  it("aucun fichier orphelin dans unlockable/", () => {
    const orphelins = surDisque.filter((f) => !cataloguees.includes(f));
    expect(orphelins, "présents sur le disque mais catalogués nulle part").toEqual([]);
  });

  it("chaque nom passe la liste blanche du serveur, sous-dossier compris", () => {
    // `personadle_validate_avatar` (api/lib/validation.php) n'accepte qu'un seul
    // sous-dossier, écrit en toutes lettres. Un nom qui échoue ici serait accepté
    // par l'interface puis refusé par le serveur : le choix resterait local et
    // disparaîtrait au prochain pull cloud, sans le moindre message.
    const refuses = surDisque.filter((f) => !SERVER_GALLERY_NAME.test(f));
    expect(refuses, "refusés par personadle_validate_avatar").toEqual([]);
  });

  it("le pack Kotone est complet et marqué comme animé", () => {
    for (const id of [
      "kotone_listening",
      "kotone_butterfly",
      "kotone_orpheus",
      "kotone_pink_shot",
      "theodore_elevator",
      "theodore_look_back",
    ]) {
      expect(sql, `${id} absent de la migration`).toContain(`'${id}'`);
    }
    // Six portraits, tous `is_animated = 1` et tous sur la même condition : c'est
    // ce qui les fait tomber ENSEMBLE (décision Hamza).
    expect(cataloguees).toHaveLength(6);
    expect([...sql.matchAll(/'avatar_pack_kotone'/g)]).toHaveLength(6);
  });
});
