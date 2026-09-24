/**
 * unlocks_wonder_shujin.test.js — Le lot du 2026-09-18 côté client et données :
 *
 *   - les miroirs client des conditions serveur (TARGET_SETS, SAME_ENERGY_AVATARS)
 *     sont IDENTIQUES aux tables PHP de api/lib/condition_check.php — c'est le
 *     serveur qui tranche, mais un miroir qui dérive ferait tenter l'unlock trop
 *     tôt (403 en boucle) ou jamais (badge invisible) ;
 *   - chaque check() client réagit aux bons flags, et à rien d'autre ;
 *   - checkSocialBadges() pose le drapeau Same Energy depuis la liste d'amis ;
 *   - le titre Go Beyond a sa lecture client (partie visible) et son texte ;
 *   - Wonder Shujin a ses trois assets AOA, et chaque entrée AOA en général ;
 *   - les trois musiques sont jouables, et les deux faces de Light the Fire Up in
 *     the Night sont bien jumelles en Expert.
 *
 * Le déblocage réel par l'API est couvert par tests-e2e/unlocks_wonder_shujin.spec.js.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  badgesList,
  TARGET_SETS,
  SAME_ENERGY_AVATARS,
  targetSetMet,
  wearsAvatar,
} from "../profile/badges/badgesData.js";
import { checkSocialBadges } from "../profile/badges/badgesManager.js";
import { isTitleConditionMet, titleConditionText } from "../profile/titles-ui.js";
import { aoaCharacters } from "../allOutAttackMode/database/aoaCharacters.js";
import { personas as aoaPool } from "../allOutAttackMode/database/personas_allOut.js";
import { portraitsMap } from "../allOutAttackMode/database/portraitsMap.js";
import { songs } from "../musicsMode/database/songs.js";
import { musicTitles } from "../musicsMode/database/musicTitles.js";
import { expertLyrics } from "../musicsMode/database/expert_lyrics.js";
import { EXPERT_TWINS } from "../musicsMode/database/expert_twins.js";
import { AVATAR_GROUPS } from "../profile/avatars_data.js";

const ROOT = join(import.meta.dirname, "..");
const php = readFileSync(join(ROOT, "api/lib/condition_check.php"), "utf8");
const byId = (id) => badgesList.find((b) => b.id === id);

/** Les chaînes '…' d'un bloc PHP délimité par deux marqueurs. */
function phpStrings(startMarker, endMarker) {
  const start = php.indexOf(startMarker);
  const end = php.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`bloc PHP introuvable : ${startMarker}`);
  const body = php.slice(start, end).replace(/\/\/[^\n]*/g, ""); // les commentaires ont des apostrophes
  return [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
}

// ─────────────────────────────────────────────────────────────────────────────
describe("miroirs client ↔ serveur", () => {
  it("chaque nom de TARGET_SETS figure dans PERSONADLE_TARGET_SETS (PHP), et réciproquement pour les cibles visibles", () => {
    const phpNames = new Set(phpStrings("const PERSONADLE_TARGET_SETS = [", "/** Clés d'ensembles connues"));
    for (const [key, reqs] of Object.entries(TARGET_SETS)) {
      expect(php.includes(`'${key}' => [`), `ensemble ${key} absent du PHP`).toBe(true);
      for (const [, names] of reqs) for (const n of names) expect(phpNames.has(n), `${key} : « ${n} » absent du PHP`).toBe(true);
    }
  });

  it("les cibles PHP des badges (hors dimension Expert et musiques) sont toutes dans le miroir client", () => {
    for (const key of ["starlight_trio", "shujin_outlaws", "absolute_authority"]) {
      const block = php.slice(php.indexOf(`'${key}' => [`), php.indexOf("],\n    ],", php.indexOf(`'${key}' => [`)));
      const names = [...block.matchAll(/'([^']+\([^']*\)|[A-Z][^',]+)'/g)].map((m) => m[1]).filter((n) => !/^(alloutattack|silhouette|classic|emoji|personae|music)$/.test(n));
      const clientNames = TARGET_SETS[key].flatMap(([, ns]) => ns);
      for (const n of names) expect(clientNames, `${key} : « ${n} » manque côté client`).toContain(n);
    }
  });

  it("SAME_ENERGY_AVATARS est identique à PERSONADLE_SAME_ENERGY_AVATARS, et chaque fichier existe dans la galerie", () => {
    const phpFiles = phpStrings("const PERSONADLE_SAME_ENERGY_AVATARS = [", "];").filter((s) => /\.(png|jpe?g|webp|gif|avif)$/.test(s));
    const clientFiles = [...SAME_ENERGY_AVATARS.arai, ...SAME_ENERGY_AVATARS.chie];
    expect([...phpFiles].sort()).toEqual([...clientFiles].sort());
    const gallery = AVATAR_GROUPS.flatMap((g) => g.avatars);
    for (const f of clientFiles) expect(gallery, f).toContain(f);
  });

  it("chaque cible des ensembles existe dans les datasets (un renommage rendrait le badge indébloquable)", () => {
    const pools = JSON.parse(readFileSync(join(ROOT, "api/data/daily_pools.json"), "utf8"));
    const known = {
      alloutattack: pools.alloutattack.pool,
      classic: pools.classic.pool,
      emoji: pools.emoji.pool,
      silhouette: pools.silhouette.pool,
      personae: pools.personae.pool.map((e) => e.user),
      music: pools.music.pool,
    };
    for (const [key, reqs] of Object.entries(TARGET_SETS)) {
      for (const [mode, names, min] of reqs) {
        expect(min).toBeLessThanOrEqual(names.length);
        for (const n of names) expect(known[mode], `${key}/${mode} : « ${n} »`).toContain(n);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("check() des cinq badges", () => {
  const empty = { stats: {}, profile: {} };
  const ids = ["starlight_festival", "shujin_outlaws", "absolute_authority", "dont_waste_your_breath", "same_energy"];

  it("les cinq existent, non secrets, avec une image sur le disque", () => {
    for (const id of ids) {
      const b = byId(id);
      expect(b, id).toBeTruthy();
      expect(b.secret).toBe(false);
      const file = b.img.match(/(Badges?_[A-Za-z0-9_]+\.(?:webp|png|gif))$/)?.[1];
      expect(file, b.img).toBeTruthy();
      expect(existsSync(join(ROOT, "profile/badges/images", file)), file).toBe(true);
    }
  });

  it("aucun ne se débloque sur un profil vierge", () => {
    for (const id of ids) expect(byId(id).check(empty.stats, empty.profile), id).toBe(false);
  });

  it("Starlight Festival : les trois skins en AOA, pas deux, pas dans un autre mode", () => {
    const map = (modes) => ({ characterModeMap: modes });
    const c = byId("starlight_festival").check;
    expect(c({}, map({ "Joker Starlight ( Ren Amamiya )": ["alloutattack"], "Panther Starlight ( Ann Takamaki )": ["alloutattack"] }))).toBe(false);
    expect(c({}, map({ "Joker Starlight ( Ren Amamiya )": ["alloutattack"], "Panther Starlight ( Ann Takamaki )": ["alloutattack"], "Mona Starlight ( Morgana )": ["classic"] }))).toBe(false);
    expect(c({}, map({ "Joker Starlight ( Ren Amamiya )": ["alloutattack"], "Panther Starlight ( Ann Takamaki )": ["alloutattack"], "Mona Starlight ( Morgana )": ["alloutattack"] }))).toBe(true);
  });

  it("Shujin Outlaws : Wonder Shujin en AOA + Ren et Wonder en Silhouette", () => {
    const c = byId("shujin_outlaws").check;
    const base = { "Wonder Shujin ( Nagisa Kamishiro )": ["alloutattack"], "Ren Amamiya": ["silhouette"] };
    expect(c({}, { characterModeMap: base })).toBe(false);
    expect(c({}, { characterModeMap: { ...base, "Nagisa Kamishiro": ["classic", "emoji"] } })).toBe(false);
    expect(c({}, { characterModeMap: { ...base, "Nagisa Kamishiro": ["classic", "silhouette"] } })).toBe(true);
  });

  it("Absolute Authority : les deux présidentes en Classique", () => {
    const c = byId("absolute_authority").check;
    expect(c({}, { characterModeMap: { "Mitsuru Kirijo": ["classic"] } })).toBe(false);
    expect(c({}, { characterModeMap: { "Mitsuru Kirijo": ["classic"], "Makoto Niijima": ["silhouette"] } })).toBe(false);
    expect(c({}, { characterModeMap: { "Mitsuru Kirijo": ["classic"], "Makoto Niijima": ["classic"] } })).toBe(true);
  });

  it("Don't Waste Your Breath : 5 parfaites Expert en Classique (compteur profil)", () => {
    const c = byId("dont_waste_your_breath").check;
    expect(c({}, { classicExpertPerfectWins: 4 })).toBe(false);
    expect(c({}, { classicExpertPerfectWins: 5 })).toBe(true);
  });

  it("Same Energy : le drapeau posé par checkSocialBadges", () => {
    const c = byId("same_energy").check;
    expect(c({}, {})).toBe(false);
    expect(c({}, { sameEnergyWith: 77 })).toBe(true);
  });

  it("targetSetMet refuse une clé inconnue ET un profil sans characterModeMap", () => {
    expect(targetSetMet({}, "starlight_trio")).toBe(false);

    // Un ensemble INCONNU vaut `false`. Ce cas répondait `true` jusqu'à la 2.3 :
    // `(TARGET_SETS[cle] || []).every(...)` sur un tableau vide vaut `true`, et
    // le commentaire d'alors s'en remettait au refus du serveur.
    //
    // Sauf que côté joueur, ça voulait dire voir le badge s'allumer en fin de
    // partie puis disparaître au rechargement. Et surtout, ça entrait en
    // contradiction directe avec la règle « aucun badge ne se débloque sur un
    // profil vierge » (tests/badgesConditions.test.js) : les deux badges de la
    // 2.3 s'y sont allumés tout seuls tant que leurs ensembles n'étaient pas
    // déclarés ici. Le client doit être aussi fermé que le serveur.
    expect(targetSetMet({ characterModeMap: {} }, "ensemble_inconnu")).toBe(false);
  });

  it("wearsAvatar : chemin galerie exact, pas une data URL ni un nom voisin", () => {
    expect(wearsAvatar("../img/avatar/Arai.png", SAME_ENERGY_AVATARS.arai)).toBe(true);
    expect(wearsAvatar("./img/avatar/chie_pq.jpg", SAME_ENERGY_AVATARS.chie)).toBe(true);
    expect(wearsAvatar("../img/avatar/Arai.png", SAME_ENERGY_AVATARS.chie)).toBe(false);
    expect(wearsAvatar("data:image/png;base64,Arai.png", SAME_ENERGY_AVATARS.arai)).toBe(false);
    expect(wearsAvatar("../img/avatar/NotArai.png", SAME_ENERGY_AVATARS.arai)).toBe(false);
    expect(wearsAvatar(null, SAME_ENERGY_AVATARS.arai)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("checkSocialBadges — Same Energy depuis la liste d'amis", () => {
  let profile, saved;
  beforeEach(() => {
    profile = { avatar: "../img/avatar/Arai2.png" };
    saved = vi.fn();
    window._currentUser = { id: 1 };
  });
  const withFriends = (friends) => {
    window._personadleApi = { friends: { list: vi.fn().mockResolvedValue({ friends }) } };
  };

  it("un ami de rang 5 en Chie pendant que je porte Arai → drapeau posé et profil sauvé", async () => {
    withFriends([{ user_id: 9, social_link_rank: 5, avatar_data: "../img/avatar/Chie.jpg" }]);
    await checkSocialBadges(profile, saved);
    expect(profile.sameEnergyWith).toBe(9);
    expect(saved).toHaveBeenCalled();
  });

  it("l'inverse aussi : moi en Chie, l'ami en Arai", async () => {
    profile.avatar = "../img/avatar/meme_chie_shut_teddie.jpg";
    withFriends([{ user_id: 4, social_link_rank: 8, avatar_data: "../img/avatar/Arai.png" }]);
    await checkSocialBadges(profile, saved);
    expect(profile.sameEnergyWith).toBe(4);
  });

  it("rang 4, ou deux Arai, ou avatar personnalisé → rien", async () => {
    withFriends([
      { user_id: 2, social_link_rank: 4, avatar_data: "../img/avatar/Chie.jpg" },
      { user_id: 3, social_link_rank: 10, avatar_data: "../img/avatar/Arai.png" },
      { user_id: 5, social_link_rank: 10, avatar_data: "data:image/png;base64,xxxx" },
    ]);
    await checkSocialBadges(profile, saved);
    expect(profile.sameEnergyWith).toBeUndefined();
  });

  it("ne repose pas le drapeau s'il est déjà là", async () => {
    profile.sameEnergyWith = 9;
    withFriends([{ user_id: 9, social_link_rank: 5, avatar_data: "../img/avatar/Chie.jpg" }]);
    await checkSocialBadges(profile, saved);
    expect(saved).not.toHaveBeenCalled();
  });

  it("portraits recadrés des deux côtés : c'est l'origine (avatarSrc / avatar_src) qui parle", async () => {
    // Cas courant : la fenêtre de recadrage s'ouvre dès qu'on choisit un portrait,
    // et valider remplace l'avatar par un PNG. Sans l'origine, rien ne tombait.
    profile.avatar = "data:image/png;base64,xxxx";
    profile.avatarSrc = "../img/avatar/chiesatonaka_revivale.jpg";
    withFriends([{ user_id: 6, social_link_rank: 5, avatar_data: "data:image/png;base64,yyyy", avatar_src: "../img/avatar/Arai.png" }]);
    await checkSocialBadges(profile, saved);
    expect(profile.sameEnergyWith).toBe(6);
  });

  it("toutes les Chie de la galerie comptent (icône et revival comprises)", async () => {
    for (const f of ["chie_satonaka_icon.jpg", "chiesatonaka_revivale.jpg", "Chie2.jpg", "chie_pq.jpg"]) {
      const p = { avatar: "../img/avatar/Arai.png" };
      withFriends([{ user_id: 7, social_link_rank: 5, avatar_data: `../img/avatar/${f}` }]);
      await checkSocialBadges(p, saved);
      expect(p.sameEnergyWith, f).toBe(7);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("titre Go Beyond côté client", () => {
  const title = { slug: "wonder_go_beyond", condition_type: "targets_found", condition_mode: "wonder_go_beyond" };
  const ctx = (characterModeMap) => ({ profile: { characterModeMap }, stats: {} });

  it("la partie visible (AOA ×5, Classique, Émoji, Personae) déclenche la TENTATIVE d'unlock", () => {
    const full = {
      "Wonder ( Nagisa Kamishiro )": ["alloutattack"],
      "Wonder Chinese New Year ( Nagisa Kamishiro )": ["alloutattack"],
      "Wonder Velvet ( Nagisa Kamishiro )": ["alloutattack"],
      "Wonder Summer ( Nagisa Kamishiro )": ["alloutattack"],
      "Wonder Shujin ( Nagisa Kamishiro )": ["alloutattack"],
      "Nagisa Kamishiro": ["classic", "emoji", "personae"],
    };
    expect(isTitleConditionMet(title, ctx(full))).toBe(true);
    const { "Wonder Shujin ( Nagisa Kamishiro )": _drop, ...fourAoa } = full;
    void _drop;
    expect(isTitleConditionMet(title, ctx(fourAoa))).toBe(false);
    expect(isTitleConditionMet(title, ctx({ ...full, "Nagisa Kamishiro": ["classic", "emoji"] }))).toBe(false);
  });

  it("a un texte de condition lisible", () => {
    expect(titleConditionText(title)).toMatch(/All-Out Attack.*Classic.*Emoji.*Personae.*Expert.*P5X/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("All-Out Attack — Wonder Shujin et l'intégrité des assets", () => {
  it("chaque entrée AOA a son webp animé, son portrait et son rendu Battle", () => {
    const missing = [];
    for (const c of aoaCharacters) {
      for (const rel of [`allOutAttack/${c.gif}.webp`, `img/${c.gif}.webp`, `img/${c.gif}_Battle.webp`]) {
        if (!existsSync(join(ROOT, "allOutAttackMode/database", rel))) missing.push(`${c.nom} → ${rel}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("chaque entrée est dans l'autocomplétion et la table des portraits, sans orphelin", () => {
    const names = aoaCharacters.map((c) => c.nom);
    expect([...aoaPool].sort()).toEqual([...names].sort());
    for (const c of aoaCharacters) expect(portraitsMap[c.nom], c.nom).toBe(c.gif);
    expect(Object.keys(portraitsMap).filter((n) => !names.includes(n))).toEqual([]);
  });

  it("Wonder Shujin est le cinquième Wonder, en P5X, à côté des autres tenues", () => {
    const wonders = aoaCharacters.filter((c) => c.nom.startsWith("Wonder "));
    expect(wonders.map((c) => c.gif).sort()).toEqual(["Wonder", "Wonder_ChineseNY", "Wonder_Shujin", "Wonder_Summer", "Wonder_Velvet"]);
    const shujin = aoaCharacters.find((c) => c.gif === "Wonder_Shujin");
    expect(shujin.nom).toBe("Wonder Shujin ( Nagisa Kamishiro )");
    expect(shujin.opus).toEqual(["P5X"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Music — Invitation to Freedom et les deux faces de Light the Fire Up in the Night", () => {
  const NEW = ["Invitation to Freedom", "Light the Fire Up in the Night (P3 Side)", "Light the Fire Up in the Night (P4 Side)"];

  it("les trois chansons existent, avec leur mp3 et leur image, et sont proposées à l'autocomplétion", () => {
    for (const t of NEW) {
      const s = songs.find((x) => x.titre === t);
      expect(s, t).toBeTruthy();
      expect(existsSync(join(ROOT, "musicsMode/database/music/song", s.fichier)), s.fichier).toBe(true);
      expect(existsSync(join(ROOT, "musicsMode/database/img", s.image)), s.image).toBe(true);
      expect(musicTitles).toContain(t);
    }
    expect(songs.find((x) => x.titre === NEW[0]).opus).toEqual(["PQ2"]);
    expect(songs.find((x) => x.titre === NEW[1]).opus).toEqual(["PQ"]);
  });

  it("en Expert : Invitation to Freedom et la face P3 ont des paroles, la face P4 n'en a pas (elle n'est pas tirable)", () => {
    expect(expertLyrics["Invitation to Freedom"]?.length).toBeGreaterThanOrEqual(2);
    expect(expertLyrics["Light the Fire Up in the Night (P3 Side)"]?.length).toBeGreaterThanOrEqual(2);
    expect(expertLyrics["Light the Fire Up in the Night (P4 Side)"]).toBeUndefined();
  });

  it("chaque jumelle Expert : la clé porte les paroles, chaque valeur est un vrai titre SANS paroles propres", () => {
    const titles = new Set(songs.map((s) => s.titre));
    for (const [key, twins] of Object.entries(EXPERT_TWINS)) {
      expect(titles.has(key), key).toBe(true);
      expect(expertLyrics[key], `${key} doit porter les paroles`).toBeTruthy();
      for (const t of twins) {
        expect(titles.has(t), t).toBe(true);
        expect(expertLyrics[t], `${t} ne doit pas être tirable en Expert (sinon deux cibles pour un même texte)`).toBeUndefined();
      }
    }
  });

  it("le mode passe bien par la jumelle pour valider une réponse Expert", () => {
    const src = readFileSync(join(ROOT, "musicsMode/modeMusic.js"), "utf8");
    expect(src).toMatch(/import \{ EXPERT_TWINS \} from "\.\/database\/expert_twins\.js"/);
    expect(src).toMatch(/function guessMatchesTarget\(guess\)/);
    expect(src).toMatch(/if \(guessMatchesTarget\(guess\)\) \{\s*showVictory\(false\)/);
    expect(src).not.toMatch(/if \(normalize\(guess\) === normalize\(target\.titre\)\) \{\s*showVictory/);
  });
});
