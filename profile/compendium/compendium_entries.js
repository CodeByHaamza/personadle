/**
 * profile/compendium/compendium_entries.js — du JSON de l'API au carnet.
 *
 * Module PUR (aucun DOM, aucun i18n) : il transforme la réponse de
 * GET /api/user/compendium en chapitres d'entrées prêtes à rendre, chacune avec
 * une clé de texte d'ambiance (`flavor`), ses variables, sa date (ou null) et
 * son visuel. Le texte lui-même est résolu par la page via i18n — décision
 * produit du 2026-09-12 : texte généré, pas de note personnelle.
 *
 * Une entrée :
 *   { chapter, kind, title, flavor, vars, date, img?, icon?, rank?, expert? }
 *   - title  : libellé principal (nom du badge, du titre, de l'ami…), déjà en
 *              clair ou sous forme de clé i18n préfixée « key: » (badges : le
 *              nom vit dans lang/*.json sous badges.<id>.name)
 *   - flavor : clé i18n sous compendium.flavor.*
 *   - date   : chaîne SQL « YYYY-MM-DD[ hh:mm:ss] » ou null (= avant le compendium)
 */

export const CHAPTERS = ["badges", "titles", "wallpapers", "bonds", "challenges", "feats"];

/** Icône par mode, même table que le profil (profile-page.js MODE_META). */
export const MODE_ICON = {
  classic: "🔤",
  emoji: "😄",
  silhouette: "👤",
  alloutattack: "⚔️",
  personae: "✨",
  music: "🎵",
};

/** Tri décroissant par date ; les entrées sans date (avant le compendium) à la fin. */
export function sortByDateDesc(entries) {
  return [...entries].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return String(b.date).localeCompare(String(a.date));
  });
}

/** Nom d'un titre dans la langue demandée, repli EN puis slug. */
export function titleName(title, lang) {
  const n = title?.name ?? {};
  return n[lang] || n.en || title?.slug || "";
}

/**
 * @param {object} data     réponse de l'API compendium
 * @param {object} [opts]
 * @param {string} [opts.lang="en"]
 * @returns {Record<string, object[]>} entrées par chapitre, triées
 */
export function buildChapters(data, { lang = "en" } = {}) {
  const d = data ?? {};
  const chapters = Object.fromEntries(CHAPTERS.map((c) => [c, []]));

  for (const b of d.badges ?? []) {
    chapters.badges.push({
      chapter: "badges",
      kind: "badge",
      title: `key:badges.${b.badge_id}.name`,
      badgeId: b.badge_id,
      flavor: "compendium.flavor.badge",
      vars: {},
      date: b.unlocked_at ?? null,
    });
  }

  for (const t of d.titles ?? []) {
    chapters.titles.push({
      chapter: "titles",
      kind: "title",
      title: titleName(t, lang),
      flavor: `compendium.flavor.title_${t.rarity || "common"}`,
      flavorFallback: "compendium.flavor.title_common",
      vars: { name: titleName(t, lang) },
      date: t.unlocked_at ?? null,
      img: t.image_path || `profile/titles/${t.slug}.webp`,
      rarity: t.rarity || "common",
    });
  }

  for (const w of d.wallpapers ?? []) {
    chapters.wallpapers.push({
      chapter: "wallpapers",
      kind: "wallpaper",
      title: w.name || w.id,
      flavor: "compendium.flavor.wallpaper",
      vars: { name: w.name || w.id, game: w.game || "" },
      date: w.unlocked_at ?? null,
      img: w.image_path,
    });
  }

  for (const f of d.friends ?? []) {
    const base = { avatar: f.avatar_data ?? null, border: f.avatar_border_color, friendId: f.id };
    chapters.bonds.push({
      chapter: "bonds",
      kind: "bond_created",
      title: f.pseudo,
      flavor: "compendium.flavor.bond_created",
      vars: { name: f.pseudo },
      date: f.accepted_at ?? null,
      ...base,
    });
    const ups = [...(f.rank_ups ?? [])].sort((a, b) => a.rank - b.rank);
    const seen = new Set();
    for (const u of ups) {
      if (seen.has(u.rank)) continue;
      seen.add(u.rank);
      chapters.bonds.push({
        chapter: "bonds",
        kind: u.rank >= 10 ? "bond_max" : "bond_rank",
        title: f.pseudo,
        flavor: u.rank >= 10 ? "compendium.flavor.bond_max" : "compendium.flavor.bond_rank",
        vars: { name: f.pseudo, rank: u.rank },
        date: u.at ?? null,
        rank: u.rank,
        ...base,
      });
    }
    // Rang actuel sans passage daté (lien antérieur à l'historique) : on le
    // montre quand même, sans date — le carnet dit « avant le compendium ».
    if ((f.rank ?? 1) > 1 && !seen.has(f.rank)) {
      chapters.bonds.push({
        chapter: "bonds",
        kind: f.rank >= 10 ? "bond_max" : "bond_rank",
        title: f.pseudo,
        flavor: f.rank >= 10 ? "compendium.flavor.bond_max" : "compendium.flavor.bond_rank",
        vars: { name: f.pseudo, rank: f.rank },
        date: null,
        rank: f.rank,
        ...base,
      });
    }
  }

  // Avatar du partenaire de défi : résolu depuis la liste d'amis (le défi se
  // joue entre amis) — évite de renvoyer l'avatar base64 une fois par défi.
  const friendById = new Map((d.friends ?? []).map((f) => [f.id, f]));
  for (const c of d.challenges ?? []) {
    const won = c.status === "beaten";
    const partner = friendById.get(c.partner?.id);
    const kind =
      c.direction === "received"
        ? won
          ? "challenge_won"
          : "challenge_lost"
        : won
          ? "challenge_sent_beaten"
          : "challenge_sent_held";
    chapters.challenges.push({
      chapter: "challenges",
      kind,
      title: c.partner?.pseudo ?? "?",
      flavor: `compendium.flavor.${kind}`,
      vars: { name: c.partner?.pseudo ?? "?", mode: c.mode, score: c.score ?? "" },
      date: c.at ?? c.date ?? null,
      icon: MODE_ICON[c.mode] ?? "⚔",
      avatar: partner?.avatar_data ?? null,
      border: partner?.avatar_border_color,
      mode: c.mode,
      expert: !!c.is_expert,
      won: c.direction === "received" ? won : !won,
    });
  }

  const feats = d.feats ?? {};
  if (feats.first_game) {
    chapters.feats.push({
      chapter: "feats",
      kind: "first_game",
      title: "key:compendium.feat.first_game",
      flavor: "compendium.flavor.first_game",
      vars: {},
      date: feats.first_game,
      icon: "🎮",
    });
  }
  for (const w of feats.first_wins ?? []) {
    chapters.feats.push({
      chapter: "feats",
      kind: "first_win",
      title: "key:compendium.feat.first_win",
      flavor: "compendium.flavor.first_win",
      vars: { mode: w.mode, target: w.target, n: w.attempts },
      date: w.date,
      icon: MODE_ICON[w.mode] ?? "🏆",
      mode: w.mode,
      expert: !!w.is_expert,
    });
  }
  for (const p of feats.first_perfects ?? []) {
    chapters.feats.push({
      chapter: "feats",
      kind: "first_perfect",
      title: "key:compendium.feat.first_perfect",
      flavor: "compendium.flavor.first_perfect",
      vars: { mode: p.mode, target: p.target },
      date: p.date,
      icon: "💎",
      mode: p.mode,
      expert: !!p.is_expert,
    });
  }
  for (const e of feats.expert_modes ?? []) {
    chapters.feats.push({
      chapter: "feats",
      kind: "expert_unlocked",
      title: "key:compendium.feat.expert_unlocked",
      flavor: e.granted_at
        ? "compendium.flavor.expert_granted"
        : "compendium.flavor.expert_unlocked",
      vars: { mode: e.mode },
      date: e.granted_at ?? e.first_played ?? null,
      icon: "⚡",
      mode: e.mode,
      expert: true,
    });
  }
  if ((feats.streak_record ?? 0) > 0) {
    chapters.feats.push({
      chapter: "feats",
      kind: "streak_record",
      title: "key:compendium.feat.streak_record",
      flavor: "compendium.flavor.streak_record",
      vars: { n: feats.streak_record },
      date: null,
      icon: "🔥",
      pin: true, // un record n'a pas de date : il reste en tête de chapitre
    });
  }

  for (const c of CHAPTERS) {
    const pinned = chapters[c].filter((e) => e.pin);
    const rest = sortByDateDesc(chapters[c].filter((e) => !e.pin));
    chapters[c] = [...pinned, ...rest];
  }
  return chapters;
}

/** Résumé chiffré pour la page de gauche de chaque chapitre. */
export function chapterSummary(data, chapters) {
  const feats = data?.feats ?? {};
  return {
    badges: { count: chapters.badges.length },
    titles: { count: chapters.titles.length },
    wallpapers: { count: chapters.wallpapers.length },
    bonds: {
      count: (data?.friends ?? []).length,
      max: (data?.friends ?? []).filter((f) => (f.rank ?? 1) >= 10).length,
    },
    challenges: {
      count: chapters.challenges.length,
      won: chapters.challenges.filter((e) => e.won).length,
    },
    feats: {
      games: feats.total_games ?? 0,
      wins: feats.total_wins ?? 0,
      days: feats.days_played ?? 0,
      streak: feats.streak_record ?? 0,
    },
  };
}

/** Découpe une liste en pages de `size` entrées (jamais de page vide sauf liste vide). */
export function paginate(entries, size) {
  const pages = [];
  for (let i = 0; i < entries.length; i += size) pages.push(entries.slice(i, i + size));
  return pages.length ? pages : [[]];
}
