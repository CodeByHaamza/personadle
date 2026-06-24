/**
 * scripts/gen_seed_dev.mjs — Génère sql/seed_dev.sql (faux joueurs de dev).
 *
 * Casting cohérent dans la DA Persona : chaque protagoniste + persos clés, avec
 * avatar (base64), musique de profil, titre nominatif, badges équipés, couleur UI.
 * Stats variées + sessions récentes + amis + Social Links → leaderboard / profils
 * / social testables immédiatement.
 *
 *   node scripts/gen_seed_dev.mjs        → écrit sql/seed_dev.sql
 *
 * Idempotent : le SQL supprime d'abord les comptes seed (email @personadle.seed)
 * avant de réinsérer (FK ON DELETE CASCADE).
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AVATAR_DIR = join(ROOT, "img", "avatar");
const PASSWORD_HASH = "$2y$10$cmw.qswDMBmzD7AVfrLW0uj3pGgg3SucvO6Ayg6LmxtSjTnoYueGC"; // bcrypt("test1234")
const MODES = ["classic", "emoji", "silhouette", "alloutattack", "personae", "music"];

// Résout le vrai nom de fichier d'un avatar (insensible à la casse / extension).
const AVATAR_FILES = readdirSync(AVATAR_DIR);
function resolveAvatar(base) {
  const hit = AVATAR_FILES.find((f) => f.toLowerCase().startsWith(base.toLowerCase() + "."));
  if (!hit) throw new Error(`Avatar introuvable: ${base}`);
  return hit;
}
function avatarDataUrl(base) {
  const file = resolveAvatar(base);
  const ext = file.split(".").pop().toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
  const b64 = readFileSync(join(AVATAR_DIR, file)).toString("base64");
  return `data:${mime};base64,${b64}`;
}

// ── Le casting (validé) ────────────────────────────────────────────────────────
// tier : 0=casual … 4=top → pilote les stats (wins/streak) pour un vrai classement.
const ROSTER = [
  { p: "Ren",        av: "joker_starlight",              music: "Last_Surprise.mp3",                       title: "joker_looking_cool",        color: "#E63946", tier: 4, badges: ["github_contributor", "one_shot", "take_the_pose", "music_master"] },
  { p: "Wonder",     av: "wonder_velvet",                music: "Wonder_Light.mp3",                        title: null,                        color: "#7B2CBF", tier: 4, badges: ["aoa_vision", "take_the_pose", "emoji_decoder"] },
  { p: "MakotoYuki", av: "makoto_yuki",                  music: "Mass_Destruction.mp3",                    title: "makoto_yuki_memento_mori",  color: "#2A4D9B", tier: 3, badges: ["burn_my_dread", "hippocampus_reload", "one_shot"] },
  { p: "Kotone",     av: "kotone_shiomi",                music: "Wiping_All_Out.mp3",                      title: null,                        color: "#F4A6C0", tier: 2, badges: ["burn_my_dread", "music_master"] },
  { p: "Yu",         av: "yu_narukami_mc_icon",          music: "Pursuing_my_True_Self.mp3",               title: "yu_reach_out_to_the_truth", color: "#FFD166", tier: 3, badges: ["into_the_fog", "shadow_slayer"] },
  { p: "Yosuke",     av: "yosuke_hanamura_icon",         music: "Backside_Of_The_TV.mp3",                  title: "yosuke_ride_the_wind",      color: "#2EC4B6", tier: 2, badges: ["best_bro", "into_the_fog", "twin_spear"] },
  { p: "Adachi",     av: "Adachi",                       music: "Shadow_World.mp3",                        title: "adachi_boring_isnt_it",     color: "#6C757D", tier: 1, badges: ["ace_defective", "into_the_fog"] },
  { p: "Naoya",      av: "Naoya",                        music: "A_lone_prayer.mp3",                       title: "naoya_first_awakening",     color: "#5A189A", tier: 2, badges: ["p1_p2_fan", "velvet_regular"] },
  { p: "Tatsuya",    av: "Tatsuya",                      music: "Unbreakable_tie.mp3",                     title: null,                        color: "#E85D04", tier: 2, badges: ["p1_p2_fan", "twin_blade"] },
  { p: "Maya",       av: "Maya",                         music: "Maya_theme.mp3",                          title: "maya_always_be_positive",   color: "#3A0CA3", tier: 1, badges: ["p1_p2_fan", "music_master"] },
  { p: "Akechi",     av: "akechi_jazz",                  music: "No_More_What_Ifs.mp3",                    title: "akechi_pancakes",           color: "#9D0208", tier: 4, badges: ["ace_detective", "crimson_legacy", "one_shot"] },
  { p: "Aigis",      av: "Aigis",                        music: "Disconnected.mp3",                        title: "aigis_i_am_not_afraid",     color: "#D00000", tier: 3, badges: ["burn_my_dread", "hippocampus_reload"] },
  { p: "Futaba",     av: "futaba_headphones",            music: "The_Days_When_My_Mother_Was_There.mp3",   title: null,                        color: "#2BAE66", tier: 2, badges: ["true_hacker", "navigator", "tradition_modernite"] },
  { p: "Naoto",      av: "naoto_shirogane_icon_revivae", music: "Secret_Base.mp3",                         title: null,                        color: "#1B263B", tier: 3, badges: ["ace_detective", "tradition_modernite", "shadow_slayer"] },
  { p: "Sumire",     av: "sumire_jazz",                  music: "Colors_Flying_High.mp3",                  title: null,                        color: "#E5383B", tier: 3, badges: ["one_shot", "take_the_pose"] },
  { p: "Marie",      av: "hui_marie_p4r_pfp",            music: "Heaven.mp3",                              title: "marie_i_remembered",        color: "#ADB5BD", tier: 1, badges: ["into_the_fog", "music_master"] },
  { p: "Lavenza",    av: "catlisabeth",                  music: "Aria_Of_The_Soul.mp3",                    title: "velvet_room_thou_art_i",    color: "#3D5A80", tier: 2, badges: ["velvet_master", "velvet_regular", "velvet_headache"] },
  { p: "Chie",       av: "chie_satonaka_icon",           music: "Reach_Out_To_The_Truth.mp3",              title: null,                        color: "#43AA8B", tier: 2, badges: ["one_shot", "golden_week", "into_the_fog", "twin_fist"] },
  { p: "Maruki",     av: "Maruki",                       music: "Our_Light.mp3",                           title: null,                        color: "#4CC9A0", tier: 3, badges: ["ideal_reality", "navigator", "velvet_headache", "music_master"] },
];

// Amitiés (acceptées) + Social Links (rank/xp) — paires thématiques.
const FRIENDS = [
  ["Ren", "Futaba"], ["Ren", "Akechi"], ["Ren", "Sumire"], ["Ren", "Maruki"],
  ["Yu", "Yosuke"], ["Yu", "Chie"], ["Yu", "Naoto"], ["Yu", "Adachi"],
  ["MakotoYuki", "Aigis"], ["MakotoYuki", "Kotone"], ["Naoya", "Maya"], ["Maya", "Tatsuya"],
  ["Wonder", "Ren"], ["Lavenza", "Ren"],
];
// Social Links avec rang (10 = True Confidant → halo doré à tester).
const SOCIAL = [
  ["Ren", "Futaba", 10], ["Yu", "Yosuke", 10], ["Ren", "Akechi", 9],
  ["MakotoYuki", "Aigis", 8], ["Yu", "Chie", 6], ["Ren", "Sumire", 7],
  ["Naoya", "Maya", 5], ["Yu", "Adachi", 3], ["Wonder", "Ren", 4],
];
const XP_FOR_RANK = { 1: 0, 2: 100, 3: 250, 4: 450, 5: 700, 6: 1000, 7: 1350, 8: 1750, 9: 2200, 10: 2700 };

// ── Helpers SQL ─────────────────────────────────────────────────────────────────
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const email = (r) => `${r.p.toLowerCase()}@personadle.seed`;
// friend_code unique de 8 chars sur alphabet sûr (sans 0/O/1/I) : "SEED" + base-8 de i.
function friendCode(i) {
  const D = "23456789";
  let s = "",
    n = i;
  for (let k = 0; k < 4; k++) {
    s = D[n % 8] + s;
    n = Math.floor(n / 8);
  }
  return "SEED" + s;
}
let out = [];
const w = (s) => out.push(s);

// Stats déterministes selon le tier (varie par mode pour un classement réaliste).
function statsFor(r, modeIdx) {
  const base = [3, 12, 30, 60, 110][r.tier];
  const spread = ((r.p.charCodeAt(0) + modeIdx * 7) % 13) - 4; // -4..+8
  const games = Math.max(1, base + spread);
  const wins = Math.round(games * (0.55 + r.tier * 0.07)); // meilleurs = meilleur winrate
  const giveups = Math.max(0, games - wins - (modeIdx % 3));
  const streakRecord = Math.max(1, Math.round(wins * 0.4) + r.tier);
  const streak = modeIdx === 0 ? Math.max(0, streakRecord - (r.p.length % 4)) : Math.round(streakRecord / 2);
  const perfect = Math.round(wins * 0.15);
  const timeMs = games * (40000 + (r.p.charCodeAt(1) % 30) * 1000);
  return { games, wins: Math.min(wins, games), giveups, streak, streakRecord, perfect, timeMs };
}

// ── Génération ───────────────────────────────────────────────────────────────────
w("-- ============================================================================");
w("-- seed_dev.sql — Faux joueurs de DEV (généré par scripts/gen_seed_dev.mjs).");
w("-- NE JAMAIS charger en production. Mot de passe commun : test1234");
w("-- Charger :  docker compose exec -T db mariadb -u root -proot personadle_db < sql/seed_dev.sql");
w("-- ============================================================================");
w("SET NAMES utf8mb4;");
w("");
w("-- Nettoyage idempotent (FK ON DELETE CASCADE purge profiles/stats/etc.)");
w("DELETE FROM users WHERE email LIKE '%@personadle.seed';");
w("");

// users
w("-- ── Comptes ──────────────────────────────────────────────────────────────────");
ROSTER.forEach((r, i) => {
  w(
    `INSERT INTO users (email, pseudo, password_hash, friend_code, lang, has_migrated, last_login_at) ` +
      `VALUES (${q(email(r))}, ${q(r.p)}, ${q(PASSWORD_HASH)}, ${q(friendCode(i))}, 'en', 1, NOW() - INTERVAL ${i % 5} DAY);`
  );
});
w("");

// Pour chaque joueur : profil, titre, badges, stats, sessions
ROSTER.forEach((r) => {
  const uid = `(SELECT id FROM users WHERE email = ${q(email(r))})`;
  const badgesJson = JSON.stringify(r.badges);
  const titleExpr = r.title ? `(SELECT id FROM titles WHERE slug = ${q(r.title)})` : "NULL";

  w(`-- ── ${r.p} ──`);
  // profil
  w(
    `INSERT INTO profiles (user_id, avatar_data, avatar_border_color, profile_music_id, selected_badges, equipped_title_id) ` +
      `VALUES (${uid}, ${q(avatarDataUrl(r.av))}, ${q(r.color)}, ${q(r.music)}, ${q(badgesJson)}, ${titleExpr});`
  );
  // titre possédé (pour que l'équipement soit valide)
  if (r.title) {
    w(`INSERT INTO user_titles (user_id, title_id) VALUES (${uid}, (SELECT id FROM titles WHERE slug = ${q(r.title)}));`);
  }
  // badges débloqués (équipés + quelques extras de base)
  const owned = [...new Set([...r.badges, "first_win"])];
  for (const b of owned) {
    w(`INSERT INTO badges_unlocked (user_id, badge_id) VALUES (${uid}, ${q(b)});`);
  }
  // stats par mode
  MODES.forEach((mode, mi) => {
    const s = statsFor(r, mi);
    w(
      `INSERT INTO user_stats (user_id, mode, wins, giveups, games, streak, streak_record, perfect_wins, total_time_ms, last_played_at, first_played_at) ` +
        `VALUES (${uid}, ${q(mode)}, ${s.wins}, ${s.giveups}, ${s.games}, ${s.streak}, ${s.streakRecord}, ${s.perfect}, ${s.timeMs}, NOW() - INTERVAL ${mi} DAY, NOW() - INTERVAL 90 DAY);`
    );
  });
  // sessions récentes (12 derniers jours, 2 modes forts) → leaderboard semaine/mois
  const strongModes = [MODES[r.p.length % 6], MODES[(r.p.length + 2) % 6]];
  for (let d = 0; d < 12; d++) {
    strongModes.forEach((mode, k) => {
      const win = (d + k) % 4 !== 0 ? "win" : "giveup";
      w(
        `INSERT INTO game_sessions (user_id, mode, played_date, target_name, result, attempts, time_ms) ` +
          `VALUES (${uid}, ${q(mode)}, DATE(NOW() - INTERVAL ${d} DAY), 'Joker', ${q(win)}, ${1 + (d % 6)}, ${30000 + d * 1500});`
      );
    });
  }
  w("");
});

// Amitiés
w("-- ── Amitiés (acceptées) ──────────────────────────────────────────────────────");
FRIENDS.forEach(([a, b]) => {
  const ea = q(`${a.toLowerCase()}@personadle.seed`);
  const eb = q(`${b.toLowerCase()}@personadle.seed`);
  w(
    `INSERT INTO friendships (requester_id, addressee_id, status, accepted_at, seen_at) ` +
      `VALUES ((SELECT id FROM users WHERE email = ${ea}), (SELECT id FROM users WHERE email = ${eb}), 'accepted', NOW(), NOW());`
  );
});
w("");

// Social Links
w("-- ── Social Links (rangs ; 10 = True Confidant) ───────────────────────────────");
SOCIAL.forEach(([a, b, rank]) => {
  const ia = `(SELECT id FROM users WHERE email = ${q(`${a.toLowerCase()}@personadle.seed`)})`;
  const ib = `(SELECT id FROM users WHERE email = ${q(`${b.toLowerCase()}@personadle.seed`)})`;
  // chk_sl_order : user_a_id < user_b_id → on ordonne via LEAST/GREATEST.
  w(
    `INSERT INTO social_links (user_a_id, user_b_id, \`rank\`, xp) ` +
      `VALUES (LEAST(${ia}, ${ib}), GREATEST(${ia}, ${ib}), ${rank}, ${XP_FOR_RANK[rank]});`
  );
});
w("");
w(`-- ${ROSTER.length} joueurs · mdp commun : test1234`);

const sql = out.join("\n") + "\n";
writeFileSync(join(ROOT, "sql", "seed_dev.sql"), sql);
console.log(`✓ sql/seed_dev.sql généré — ${ROSTER.length} joueurs, ${(sql.length / 1024).toFixed(0)} Ko`);
