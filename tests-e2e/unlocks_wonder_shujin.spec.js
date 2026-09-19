/**
 * tests-e2e/unlocks_wonder_shujin.spec.js — Le lot du 2026-09-18 se débloque POUR DE
 * VRAI, par l'API, contre la pile complète (migration 046) :
 *
 *   - Starlight Festival, Shujin Outlaws, Absolute Authority : ensembles de cibles
 *     vérifiés depuis game_sessions (`targets_found`) — refusés tant qu'il manque une
 *     cible, accordés dès la dernière ;
 *   - Don't Waste Your Breath : 5 victoires Classique EXPERT au premier essai
 *     (`mode_expert_perfect_wins`) — une victoire en 2 essais ne compte pas ;
 *   - Same Energy : lien social rang 5 + Arai/Chie — refusé au rang 4, accordé aux
 *     DEUX comptes d'un coup quand l'un des deux le réclame ;
 *   - le titre Go Beyond : tout Wonder, dimensions Expert et musiques comprises.
 *
 * Aucun flag client ici : c'est le serveur qui tranche, et c'est lui qu'on teste.
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import { csrfHeader } from "./helpers/csrf.js";
import { registerAndUnlockExpert } from "./helpers/expert-unlock.js";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8080";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

async function call(ctx, method, url, options) {
  let res;
  for (let i = 0; i < 30; i++) {
    res = await ctx[method](url, options);
    if (res.status() !== 503) return res;
    await new Promise((r) => setTimeout(r, 250));
  }
  return res;
}
async function registerUser(suffix) {
  const rnd = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const pseudo = `uw${suffix}_${rnd}`.slice(0, 20);
  const res = await call(ctx, "post", "/api/auth/register", {
    data: { email: `e2e_${pseudo}@test.local`, pseudo, password: "test1234" },
  });
  expect(res.ok(), `register(${suffix}) : ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { ctx, userId: body.user.id, friendCode: body.user.friend_code, pseudo };
}
async function adminContext() {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await call(ctx, "post", "/api/auth/login", {
    data: { identifier: "admin@personadle.local", password: "admintest123" },
  });
  expect(res.ok(), "login admin (base fraîche : make up)").toBeTruthy();
  return ctx;
}
/** Une victoire enregistrée par l'API, comme le ferait le mode. */
async function win(u, mode, target, { expert = false, attempts = 2 } = {}) {
  const r = await call(u.ctx, "post", "/api/sessions", {
    data: { mode, played_date: today(), target_name: target, result: "win", attempts, time_ms: 4000, is_expert: expert, client_session_id: crypto.randomUUID() },
    headers: await csrfHeader(u.ctx),
  });
  expect(r.ok(), `session ${mode}/${target}${expert ? " (Expert)" : ""} : ${r.status()} ${await r.text()}`).toBeTruthy();
}
/** Franchit la porte Expert d'un mode sur le compte courant (mêmes seuils que api/lib/expert_unlocks.php). */
async function unlockExpert(u, mode) {
  const need = { classic: 10, silhouette: 10, emoji: 10, alloutattack: 15, personae: 15, music: 15 }[mode];
  for (let i = 0; i < need; i++) await win(u, mode, `E2E gate ${mode} #${i}`, { attempts: 1 });
}
async function tryUnlock(u, slug) {
  return call(u.ctx, "post", "/api/badges/unlock", { data: { badge_id: slug }, headers: await csrfHeader(u.ctx) });
}
async function badgeUnlocked(u, slug) {
  const res = await call(u.ctx, "get", "/api/badges");
  const list = await res.json();
  return Number((list.find((b) => b.slug === slug) || {}).is_unlocked) === 1;
}

test.describe("Badges du 2026-09-18 — le serveur refuse avant, accorde après", () => {
  test("Starlight Festival : les trois skins Starlight en All-Out Attack", async () => {
    const u = await registerUser("sf");
    expect((await tryUnlock(u, "starlight_festival")).status()).toBe(403);
    await win(u, "alloutattack", "Joker Starlight ( Ren Amamiya )");
    await win(u, "alloutattack", "Panther Starlight ( Ann Takamaki )");
    // Le même Joker trois fois ne remplace pas Mona
    await win(u, "alloutattack", "Joker Starlight ( Ren Amamiya )");
    expect((await tryUnlock(u, "starlight_festival")).status(), "il manque Mona").toBe(403);
    await win(u, "alloutattack", "Mona Starlight ( Morgana )");
    expect((await tryUnlock(u, "starlight_festival")).status()).toBe(200);
    expect(await badgeUnlocked(u, "starlight_festival")).toBe(true);
    await u.ctx.dispose();
  });

  test("Shujin Outlaws : l'AOA Wonder Shujin, puis Ren ET Wonder en Silhouette (pas dans un autre mode)", async () => {
    const u = await registerUser("so");
    await win(u, "alloutattack", "Wonder Shujin ( Nagisa Kamishiro )");
    await win(u, "silhouette", "Ren Amamiya");
    await win(u, "classic", "Nagisa Kamishiro"); // Classique ≠ Silhouette
    expect((await tryUnlock(u, "shujin_outlaws")).status(), "Wonder trouvé en Classique, pas en Silhouette").toBe(403);
    await win(u, "silhouette", "Nagisa Kamishiro");
    expect((await tryUnlock(u, "shujin_outlaws")).status()).toBe(200);
    expect(await badgeUnlocked(u, "shujin_outlaws")).toBe(true);
    await u.ctx.dispose();
  });

  test("Absolute Authority : Mitsuru Kirijo et Makoto Niijima en Classique", async () => {
    const u = await registerUser("aa");
    await win(u, "classic", "Mitsuru Kirijo");
    expect((await tryUnlock(u, "absolute_authority")).status()).toBe(403);
    await win(u, "classic", "Makoto Niijima");
    expect((await tryUnlock(u, "absolute_authority")).status()).toBe(200);
    await u.ctx.dispose();
  });

  test("Don't Waste Your Breath : 5 victoires Classique Expert au PREMIER essai", async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    const { userId } = await registerAndUnlockExpert(ctx, "classic"); // porte Expert franchie (10 victoires rapides)
    const u = { ctx, userId };
    for (let i = 0; i < 4; i++) await win(u, "classic", `Expert perfect #${i}`, { expert: true, attempts: 1 });
    await win(u, "classic", "Expert en deux essais", { expert: true, attempts: 2 }); // ne compte pas
    await win(u, "classic", "Normal en un essai", { expert: false, attempts: 1 }); // ne compte pas non plus
    expect((await tryUnlock(u, "dont_waste_your_breath")).status(), "4 parfaites Expert seulement").toBe(403);
    await win(u, "classic", "Expert perfect #5", { expert: true, attempts: 1 });
    expect((await tryUnlock(u, "dont_waste_your_breath")).status()).toBe(200);
    await ctx.dispose();
  });

  test("Same Energy : rang 5 + Arai/Chie, et le badge tombe pour LES DEUX d'un coup", async () => {
    const a = await registerUser("sa");
    const b = await registerUser("sb");
    // Amis
    const fr = await call(a.ctx, "post", "/api/friends/", { data: { friend_code: b.friendCode }, headers: await csrfHeader(a.ctx) });
    expect(fr.ok()).toBeTruthy();
    const { friendship_id } = await fr.json();
    expect((await call(b.ctx, "patch", `/api/friends/${friendship_id}`, { data: { action: "accept" }, headers: await csrfHeader(b.ctx) })).ok()).toBeTruthy();
    // Avatars : A en Arai RECADRÉ (le cas courant — la fenêtre de recadrage s'ouvre
    // dès qu'on choisit un portrait ; avatar_data n'est plus qu'un PNG, avatar_src dit
    // l'origine, 052), B en Chie (icône) telle quelle.
    const CROPPED = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    for (const [u, data] of [
      [a, { avatar_data: CROPPED, avatar_src: "../img/avatar/Arai.png" }],
      [b, { avatar_data: "../img/avatar/chie_satonaka_icon.jpg" }],
    ]) {
      const r = await call(u.ctx, "patch", `/api/user/${u.userId}`, { data, headers: await csrfHeader(u.ctx) });
      expect(r.ok(), `avatar ${JSON.stringify(data).slice(0, 60)} : ${r.status()} ${await r.text()}`).toBeTruthy();
    }
    // B voit l'origine de A dans sa liste d'amis (retour immédiat côté client)
    const friendsOfB = (await (await call(b.ctx, "get", "/api/friends/")).json()).friends;
    expect(friendsOfB.find((f) => f.friend_id === a.userId)?.avatar_src).toBe("../img/avatar/Arai.png");
    // Le lien social naît à la première interaction ; l'admin le monte au rang voulu
    const inter = await call(a.ctx, "post", `/api/social-links/by-friend/${b.userId}/interact`, { data: { action_type: "visit_profile" }, headers: await csrfHeader(a.ctx) });
    expect(inter.ok(), `interact : ${inter.status()} ${await inter.text()}`).toBeTruthy();
    const linkRes = await call(a.ctx, "get", `/api/social-links/by-friend/${b.userId}`);
    const linkId = (await linkRes.json()).link_id ?? (await linkRes.json()).id;
    expect(linkId, "link_id").toBeTruthy();
    const admin = await adminContext();
    const setRank = async (rank) => {
      const r = await call(admin, "patch", `/api/admin/social-links/${linkId}`, { data: { rank, xp: rank * 100 }, headers: await csrfHeader(admin) });
      expect(r.ok(), `admin rank ${rank} : ${r.status()} ${await r.text()}`).toBeTruthy();
    };

    await setRank(4);
    expect((await tryUnlock(a, "same_energy")).status(), "rang 4 : pas encore").toBe(403);

    await setRank(5);
    expect((await tryUnlock(a, "same_energy")).status()).toBe(200);
    expect(await badgeUnlocked(a, "same_energy")).toBe(true);
    expect(await badgeUnlocked(b, "same_energy"), "B n'a rien réclamé : le serveur lui a accordé le badge en même temps").toBe(true);
    await admin.dispose();
    await a.ctx.dispose();
    await b.ctx.dispose();
  });

  test("avatar_src (052) : déduit d'un chemin galerie, gardé si le recadrage ne dit rien, effacé avec l'avatar, refusé s'il n'est pas un portrait", async () => {
    const u = await registerUser("src");
    const CROPPED = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const patch = async (data) => call(u.ctx, "patch", `/api/user/${u.userId}`, { data, headers: await csrfHeader(u.ctx) });
    const src = async () => (await (await call(u.ctx, "get", `/api/user/${u.userId}`)).json()).profile.avatar_src;

    // Chemin galerie → l'origine est le chemin lui-même, le client n'a rien à dire
    expect((await patch({ avatar_data: "../img/avatar/Chie2.jpg" })).ok()).toBeTruthy();
    expect(await src()).toBe("../img/avatar/Chie2.jpg");

    // Recadrage sans indication (sync complet, client pas rafraîchi) → on garde
    expect((await patch({ avatar_data: CROPPED })).ok()).toBeTruthy();
    expect(await src(), "un PATCH muet ne doit pas effacer l'origine").toBe("../img/avatar/Chie2.jpg");

    // Recadrage d'un autre portrait, dit par le client → suit
    expect((await patch({ avatar_data: CROPPED, avatar_src: "../img/avatar/Arai2.png" })).ok()).toBeTruthy();
    expect(await src()).toBe("../img/avatar/Arai2.png");

    // Origine inconnue dite explicitement → null
    expect((await patch({ avatar_data: CROPPED, avatar_src: null })).ok()).toBeTruthy();
    expect(await src()).toBeNull();

    // Pas un portrait de la galerie → 400, rien d'écrit
    expect((await patch({ avatar_data: CROPPED, avatar_src: "../img/avatar/Arai.png" })).ok()).toBeTruthy();
    for (const bad of [CROPPED, "../img/avatar/Nope.png", "../../api/config.php"]) {
      expect((await patch({ avatar_data: CROPPED, avatar_src: bad })).status(), bad).toBe(400);
    }
    expect(await src()).toBe("../img/avatar/Arai.png");

    // Plus d'avatar → plus d'origine
    expect((await patch({ avatar_data: null })).ok()).toBeTruthy();
    expect(await src()).toBeNull();
    await u.ctx.dispose();
  });

  test("le catalogue expose les cinq badges avec une image qui répond", async () => {
    const u = await registerUser("ct");
    const list = await (await call(u.ctx, "get", "/api/badges")).json();
    for (const slug of ["starlight_festival", "shujin_outlaws", "absolute_authority", "dont_waste_your_breath", "same_energy"]) {
      const b = list.find((x) => x.slug === slug);
      expect(b, slug).toBeTruthy();
      expect(b.condition_type, slug).not.toBe("manual");
      const img = await call(u.ctx, "get", `/${b.image_path}`);
      expect(img.status(), `image ${b.image_path}`).toBe(200);
    }
    await u.ctx.dispose();
  });
});

test.describe("Titre Go Beyond — tout Wonder, par l'API", () => {
  test("refusé tant qu'il manque une pièce (Expert ou musique), accordé quand tout y est", async () => {
    test.setTimeout(180_000);
    const u = await registerUser("gb");
    const tryTitle = async () => call(u.ctx, "post", "/api/titles/unlock", { data: { title_slug: "wonder_go_beyond" }, headers: await csrfHeader(u.ctx) });

    // Portes Expert Personae et Music (15 parfaites chacune)
    await unlockExpert(u, "personae");
    await unlockExpert(u, "music");

    for (const aoa of ["Wonder ( Nagisa Kamishiro )", "Wonder Chinese New Year ( Nagisa Kamishiro )", "Wonder Velvet ( Nagisa Kamishiro )", "Wonder Summer ( Nagisa Kamishiro )", "Wonder Shujin ( Nagisa Kamishiro )"]) {
      await win(u, "alloutattack", aoa);
    }
    await win(u, "classic", "Nagisa Kamishiro");
    await win(u, "emoji", "Nagisa Kamishiro");
    await win(u, "personae", "Nagisa Kamishiro");
    const p5x = ["Ambitions and Visions", "Arial Of The Soul", "Fatal Desire", "Last Strike", "Seize the Light", "Shadow Loop", "Wake Up Your Hero", "Wonder Light", "Show Stealer"];
    for (const t of p5x) await win(u, "music", t);
    for (const t of p5x.filter((t) => t !== "Arial Of The Soul" && t !== "Show Stealer")) await win(u, "music", t, { expert: true });
    expect((await tryTitle()).status(), "il manque Personae Expert et Show Stealer Expert").toBe(403);

    await win(u, "personae", "Nagisa Kamishiro", { expert: true });
    expect((await tryTitle()).status(), "il manque Show Stealer Expert").toBe(403);
    await win(u, "music", "Show Stealer", { expert: true });
    const ok = await tryTitle();
    expect(ok.status(), await ok.text()).toBe(200);

    const titles = await (await call(u.ctx, "get", "/api/titles")).json();
    const gb = titles.find((t) => t.slug === "wonder_go_beyond");
    expect(Number(gb.is_unlocked)).toBe(1);
    expect((await call(u.ctx, "get", `/${gb.image_path}`)).status()).toBe(200);
    await u.ctx.dispose();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Une victoire Expert est une victoire (décision du 2026-09-19)", () => {
  test("Take Your Heart (40 victoires AOA) : 30 normales + 10 Expert → accordé ; 30 + 9 → refusé", async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    // La porte Expert AOA = 15 perfects consécutifs : ce sont déjà 15 victoires normales.
    const { userId } = await registerAndUnlockExpert(ctx, "alloutattack");
    const u = { ctx, userId };
    for (let i = 0; i < 15; i++) await win(u, "alloutattack", `AOA normal #${i}`);
    for (let i = 0; i < 9; i++) await win(u, "alloutattack", `AOA expert #${i}`, { expert: true });
    const unlock = async () =>
      call(u.ctx, "post", "/api/titles/unlock", { data: { title_slug: "take_your_heart" }, headers: await csrfHeader(u.ctx) });
    expect((await unlock()).status(), "30 + 9 = 39 : pas encore").toBe(403);
    await win(u, "alloutattack", "AOA expert #9", { expert: true });
    expect((await unlock()).status(), "30 + 10 = 40").toBe(200);

    // Le pull côté client voit les deux dimensions séparément (le profil les affiche à part)…
    const me = await (await call(u.ctx, "get", `/api/user/${userId}`)).json();
    expect(me.stats.find((s) => s.mode === "alloutattack").wins).toBe(30);
    expect(me.expert_stats.find((s) => s.mode === "alloutattack").wins).toBe(10);
    await ctx.dispose();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe("Réconciliation serveur : ce qui est dû est accordé sans que le client le demande", () => {
  test("25 victoires au premier essai → « Je ne suis pas une princesse » apparaît débloqué au simple GET /api/titles", async () => {
    // Le client n'a jamais su évaluer perfect_wins : en prod, un joueur à 363 perfects
    // n'avait pas le titre. Depuis, GET /api/titles accorde lui-même ce qui est dû.
    const u = await registerUser("rc");
    for (let i = 0; i < 24; i++) await win(u, "music", `Perfect #${i}`, { attempts: 1 });
    let titles = await (await call(u.ctx, "get", "/api/titles")).json();
    expect(Number(titles.find((t) => t.slug === "kotone_not_a_princess").is_unlocked), "24 perfects : pas encore").toBe(0);
    await win(u, "music", "Perfect #24", { attempts: 1 });
    titles = await (await call(u.ctx, "get", "/api/titles")).json();
    expect(Number(titles.find((t) => t.slug === "kotone_not_a_princess").is_unlocked), "25 perfects, aucun POST /unlock").toBe(1);
    // Les conditions déclaratives ne tombent jamais d'office
    expect(Number(titles.find((t) => t.slug === "joker_looking_cool").is_unlocked)).toBe(0);
    // Et le badge « 10 victoires » est accordé de la même façon par GET /api/badges
    const badges = await (await call(u.ctx, "get", "/api/badges")).json();
    expect(Number(badges.find((b) => b.slug === "ace_detective").is_unlocked)).toBe(1);
    await u.ctx.dispose();
  });
});
