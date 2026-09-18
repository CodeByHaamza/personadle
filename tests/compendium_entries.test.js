/**
 * compendium_entries.test.js — profile/compendium/compendium_entries.js (2.2)
 *
 * Le Compendium transforme la réponse de GET /api/user/compendium en chapitres
 * d'entrées datées. Ce module est pur (pas de DOM, pas d'i18n) : on vérifie ici
 * le découpage en chapitres, le tri, les dates absentes (« avant le
 * compendium »), la déduplication des rang-ups et la pagination.
 */

import { describe, it, expect } from "vitest";
import {
  CHAPTERS,
  buildChapters,
  chapterSummary,
  paginate,
  sortByDateDesc,
  titleName,
} from "../profile/compendium/compendium_entries.js";

const FIXTURE = {
  user: { id: 23, pseudo: "Hamza", friend_code: "GT2UJPML", created_at: "2026-08-25 20:58:21" },
  badges: [
    { badge_id: "first_win", unlocked_at: "2026-08-25 20:58:21" },
    { badge_id: "night_owl", unlocked_at: "2026-08-29 21:00:00" },
  ],
  titles: [
    {
      slug: "joker_looking_cool",
      image_path: "profile/titles/joker_looking_cool.webp",
      rarity: "rare",
      name: { en: "Looking Cool, Joker!", fr: "La classe, Joker !" },
      unlocked_at: "2026-08-26 10:00:00",
    },
    { slug: "no_rarity", image_path: null, rarity: null, name: { en: "Plain" }, unlocked_at: null },
  ],
  wallpapers: [
    {
      id: "kamoshida_palace",
      name: "Kamoshida's Palace",
      game: "P5",
      image_path: "profile/Wallpaper/unlockable/kamoshida_palace.webp",
      unlocked_at: "2026-09-01 08:00:00",
    },
  ],
  friends: [
    {
      id: 2,
      pseudo: "Futaba",
      friend_code: "FUT00001",
      avatar_data: "../img/avatars/futaba.webp",
      avatar_border_color: "#ff8800",
      accepted_at: "2026-08-27 12:00:00",
      rank: 10,
      xp: 999,
      rank_ups: [
        { rank: 5, at: "2026-08-29 09:00:00" },
        { rank: 5, at: "2026-08-29 09:00:01" }, // doublon (deux notifs) — une seule entrée attendue
        { rank: 10, at: "2026-09-11 09:00:00" },
      ],
    },
    // Lien antérieur à l'historique : rang 7 sans aucun passage daté
    {
      id: 3,
      pseudo: "Naoto",
      friend_code: "NAO00001",
      avatar_data: null,
      avatar_border_color: "#fff",
      accepted_at: "2026-08-20 12:00:00",
      rank: 7,
      xp: 500,
      rank_ups: [],
    },
  ],
  challenges: [
    {
      id: 11,
      direction: "received",
      partner: { id: 2, pseudo: "Futaba" },
      mode: "emoji",
      is_expert: false,
      score: 4,
      status: "beaten",
      date: "2026-09-10",
      at: "2026-09-10 18:00:00",
    },
    {
      id: 12,
      direction: "received",
      partner: { id: 3, pseudo: "Naoto" },
      mode: "classic",
      is_expert: true,
      score: 3,
      status: "expired",
      date: "2026-09-08",
      at: "2026-09-08 18:00:00",
    },
    {
      id: 13,
      direction: "sent",
      partner: { id: 2, pseudo: "Futaba" },
      mode: "silhouette",
      is_expert: false,
      score: 4,
      status: "beaten",
      date: "2026-09-11",
      at: "2026-09-11 18:00:00",
    },
    {
      id: 14,
      direction: "sent",
      partner: { id: 99, pseudo: "Stranger" },
      mode: "music",
      is_expert: false,
      score: 2,
      status: "expired",
      date: "2026-09-07",
      at: "2026-09-07 18:00:00",
    },
  ],
  feats: {
    first_game: "2026-08-25",
    total_games: 173,
    total_wins: 156,
    days_played: 6,
    streak_record: 69,
    first_wins: [
      { mode: "personae", is_expert: true, date: "2026-08-31", target: "Junpei Iori", attempts: 1 },
    ],
    first_perfects: [
      { mode: "personae", is_expert: true, date: "2026-08-31", target: "Junpei Iori" },
    ],
    expert_modes: [
      { mode: "music", first_played: "2026-08-30", granted_at: "2026-08-29 10:00:00" },
      { mode: "classic", first_played: "2026-09-01", granted_at: null },
    ],
  },
};

describe("buildChapters", () => {
  const chapters = buildChapters(FIXTURE, { lang: "fr" });

  it("produit exactement les six chapitres, dans l'ordre du livre", () => {
    expect(Object.keys(chapters)).toEqual(CHAPTERS);
    expect(CHAPTERS).toEqual(["badges", "titles", "wallpapers", "bonds", "challenges", "feats"]);
  });

  it("badges : une entrée par badge, nom via clé i18n, triée du plus récent au plus ancien", () => {
    expect(chapters.badges.map((e) => e.badgeId)).toEqual(["night_owl", "first_win"]);
    expect(chapters.badges[0].title).toBe("key:badges.night_owl.name");
    expect(chapters.badges[0].flavor).toBe("compendium.flavor.badge");
  });

  it("titres : nom dans la langue demandée, texte d'ambiance selon la rareté, repli common", () => {
    const [rare, plain] = chapters.titles;
    expect(rare.title).toBe("La classe, Joker !");
    expect(rare.flavor).toBe("compendium.flavor.title_rare");
    expect(rare.img).toBe("profile/titles/joker_looking_cool.webp");
    expect(plain.flavor).toBe("compendium.flavor.title_common");
    expect(plain.img).toBe("profile/titles/no_rarity.webp");
    expect(plain.date).toBeNull();
  });

  it("titres : une entrée sans date passe après les entrées datées", () => {
    expect(chapters.titles.map((e) => e.date)).toEqual(["2026-08-26 10:00:00", null]);
  });

  it("fonds d'écran : nom, jeu et image", () => {
    expect(chapters.wallpapers).toHaveLength(1);
    expect(chapters.wallpapers[0]).toMatchObject({
      kind: "wallpaper",
      title: "Kamoshida's Palace",
      vars: { name: "Kamoshida's Palace", game: "P5" },
      img: "profile/Wallpaper/unlockable/kamoshida_palace.webp",
    });
  });

  it("liens : création + un rang-up par rang (doublons de notifs fusionnés), MAX à 10", () => {
    const futaba = chapters.bonds.filter((e) => e.friendId === 2);
    expect(futaba.map((e) => e.kind)).toEqual(["bond_max", "bond_rank", "bond_created"]);
    expect(futaba.filter((e) => e.rank === 5)).toHaveLength(1);
    expect(futaba[0]).toMatchObject({
      rank: 10,
      flavor: "compendium.flavor.bond_max",
      avatar: "../img/avatars/futaba.webp",
      border: "#ff8800",
    });
  });

  it("liens : un rang atteint avant l'historique est montré sans date, jamais inventée", () => {
    const naoto = chapters.bonds.filter((e) => e.friendId === 3);
    const rankEntry = naoto.find((e) => e.kind === "bond_rank");
    expect(rankEntry).toMatchObject({ rank: 7, date: null, vars: { name: "Naoto", rank: 7 } });
    // et elle se retrouve en fin de chapitre, après les entrées datées
    expect(chapters.bonds.at(-1)).toBe(rankEntry);
  });

  it("défis : sens × issue → quatre genres, l'issue vue de mon côté", () => {
    const byId = Object.fromEntries(chapters.challenges.map((e) => [e.vars.name + e.mode, e]));
    expect(byId["Futabaemoji"]).toMatchObject({ kind: "challenge_won", won: true });
    expect(byId["Naotoclassic"]).toMatchObject({
      kind: "challenge_lost",
      won: false,
      expert: true,
    });
    expect(byId["Futabasilhouette"]).toMatchObject({ kind: "challenge_sent_beaten", won: false });
    expect(byId["Strangermusic"]).toMatchObject({ kind: "challenge_sent_held", won: true });
  });

  it("défis : l'avatar du partenaire vient de la liste d'amis, sinon aucun", () => {
    const withFriend = chapters.challenges.find((e) => e.vars.name === "Futaba");
    const stranger = chapters.challenges.find((e) => e.vars.name === "Stranger");
    expect(withFriend.avatar).toBe("../img/avatars/futaba.webp");
    expect(stranger.avatar).toBeNull();
    expect(stranger.icon).toBe("🎵");
  });

  it("exploits : première partie, premières victoires/sans-faute, modes Expert (accordé vs débloqué)", () => {
    const kinds = chapters.feats.map((e) => e.kind);
    expect(kinds).toContain("first_game");
    expect(kinds).toContain("first_win");
    expect(kinds).toContain("first_perfect");
    expect(kinds.filter((k) => k === "expert_unlocked")).toHaveLength(2);
    const music = chapters.feats.find((e) => e.kind === "expert_unlocked" && e.mode === "music");
    const classic = chapters.feats.find(
      (e) => e.kind === "expert_unlocked" && e.mode === "classic"
    );
    expect(music).toMatchObject({
      flavor: "compendium.flavor.expert_granted",
      date: "2026-08-29 10:00:00",
    });
    expect(classic).toMatchObject({
      flavor: "compendium.flavor.expert_unlocked",
      date: "2026-09-01",
    });
  });

  it("exploits : le record de série est épinglé en tête, sans date", () => {
    expect(chapters.feats[0]).toMatchObject({
      kind: "streak_record",
      pin: true,
      date: null,
      vars: { n: 69 },
    });
  });

  it("exploits : pas de record si la série est nulle", () => {
    const c = buildChapters({ feats: { streak_record: 0 } });
    expect(c.feats).toEqual([]);
  });

  it("tolère une réponse vide ou partielle", () => {
    expect(buildChapters(null)).toEqual(Object.fromEntries(CHAPTERS.map((c) => [c, []])));
    expect(buildChapters({ badges: [{ badge_id: "x" }] }).badges[0].date).toBeNull();
  });
});

describe("chapterSummary", () => {
  it("compte amis, True Confidants, défis gagnés et les totaux de jeu", () => {
    const chapters = buildChapters(FIXTURE);
    const s = chapterSummary(FIXTURE, chapters);
    expect(s.badges.count).toBe(2);
    expect(s.bonds).toEqual({ count: 2, max: 1 });
    expect(s.challenges).toEqual({ count: 4, won: 2 });
    expect(s.feats).toEqual({ games: 173, wins: 156, days: 6, streak: 69 });
  });
});

describe("paginate", () => {
  it("découpe en pages pleines puis un reste", () => {
    expect(paginate([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
  it("une liste vide donne une page vide, jamais zéro page", () => {
    expect(paginate([], 5)).toEqual([[]]);
  });
});

describe("sortByDateDesc / titleName", () => {
  it("trie du plus récent au plus ancien, les non datés en dernier, sans muter", () => {
    const list = [{ date: null }, { date: "2026-01-01" }, { date: "2026-03-01" }];
    const sorted = sortByDateDesc(list);
    expect(sorted.map((e) => e.date)).toEqual(["2026-03-01", "2026-01-01", null]);
    expect(list[0].date).toBeNull();
  });
  it("titleName : langue demandée, repli EN, puis slug", () => {
    const t = { slug: "s", name: { en: "EN", fr: "FR" } };
    expect(titleName(t, "fr")).toBe("FR");
    expect(titleName(t, "de")).toBe("EN");
    expect(titleName({ slug: "only" }, "fr")).toBe("only");
  });
});
