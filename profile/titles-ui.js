/**
 * profile/titles-ui.js — Titres visuels (Calling Cards) du profil.
 * Extrait de profile-page.js (bloc "🎴 TITRES VISUELS (CALLING CARDS)").
 *
 * profile/saveProfile/saveProfileToCloud/markDirty sont passés en paramètres
 * explicites (pas de closure sur l'état module-scope de profile-page.js) —
 * même convention que badgesManager.js/wallpapers-ui.js. `_titlesData` (état
 * mutable : quels titres sont débloqués, leurs vrais IDs venus de l'API) reste
 * encapsulé ici, pas exposé brut.
 */

import { openModal, closeModal } from "../js/modal.js";

/** Définitions locales des titres — toujours disponibles ; l'API enrichit avec le statut par utilisateur. */
export const TITLES_LOCAL = [
  { slug: "velvet_room_thou_art_i", name: "Thou Art I", rarity: "legendary", condition_type: "badges_count", condition_value: 20 },
  { slug: "joker_looking_cool", name: "Looking Cool", rarity: "legendary", condition_type: "joker_profile", condition_value: 0, is_hidden: true },
  { slug: "makoto_yuki_memento_mori", name: "Memento Mori", rarity: "epic", condition_type: "unique_days", condition_value: 100 },
  { slug: "akechi_pancakes", name: "Pancakes?", rarity: "epic", condition_type: "weekly_clean_modes", condition_value: 3 },
  { slug: "yu_reach_out_to_the_truth", name: "Reach Out to the Truth", rarity: "epic", condition_type: "all_modes_won", condition_value: 1 },
  { slug: "aigis_i_am_not_afraid", name: "I Am Not Afraid", rarity: "rare", condition_type: "mode_wins", condition_value: 50 },
  { slug: "marie_i_remembered", name: "I Remembered", rarity: "rare", condition_type: "badges_count", condition_value: 15 },
  { slug: "yosuke_ride_the_wind", name: "Ride the Wind", rarity: "rare", condition_type: "friends_count", condition_value: 5 },
  { slug: "naoya_first_awakening", name: "The First Awakening", rarity: "rare", condition_type: "classic_p1_wins", condition_value: 15 },
  { slug: "adachi_boring_isnt_it", name: "Boring, Isn't It?", rarity: "common", condition_type: "giveups_total", condition_value: 50 },
  { slug: "maya_always_be_positive", name: "Always Be Positive", rarity: "common", condition_type: "emoji_p2_wins", condition_value: 10 },
  { slug: "investigation_team", name: "Investigation Team", rarity: "epic", condition_type: "mode_wins", condition_mode: "personae", condition_value: 8 },
  { slug: "junes", name: "Junes", rarity: "rare", condition_type: "mode_wins", condition_mode: "music", condition_value: 15 },
  { slug: "shadows_converge", name: "Shadows Converge", rarity: "legendary", condition_type: "expert_wins_total", condition_value: 50 },
];

/** Mappe un condition_mode (BDD, minuscule) vers la clé de stats.modeWins (capitalisée). */
const _MODEWINS_KEY = {
  classic: "Classic", emoji: "Emoji", silhouette: "Silhouette",
  alloutattack: "AllOutAttack", personae: "Personae", music: "Music",
};

// Chemin relatif à profile.html → toujours correct quelle que soit la config serveur
let _titlesData = TITLES_LOCAL.map((t) => ({
  ...t,
  id: null,
  is_unlocked: 0, // recalculé au render depuis profile réel
  image_path: `titles/${t.slug}.webp`,
}));

/** Réinitialise l'état interne (usage tests uniquement). */
export function _resetTitlesData() {
  _titlesData = TITLES_LOCAL.map((t) => ({
    ...t,
    id: null,
    is_unlocked: 0,
    image_path: `titles/${t.slug}.webp`,
  }));
}

/**
 * Décide si la condition d'un titre est remplie. Pure — ne mute rien, ne fait
 * aucun accès réseau/DOM.
 * @param {object} title - Entrée de TITLES_LOCAL/_titlesData
 * @param {object} ctx - { profile, stats, friendCount, allModesWon, giveups, totalWins, streakRecord }
 */
export function isTitleConditionMet(title, ctx) {
  const { profile, stats = {}, friendCount = 0, allModesWon, giveups, totalWins, streakRecord } = ctx;
  const v = title.condition_value;
  switch (title.condition_type) {
    case "wins_total":
      return totalWins >= v;
    case "wins_mode":
      return Object.values(stats.modeWins || {}).some((w) => w >= v);
    case "streak_record":
      return streakRecord >= v;
    case "badges_count":
      return (profile.badges || []).length >= v;
    case "unique_days":
      return (profile.uniqueDaysPlayed || 0) >= v;
    case "mode_wins": {
      // condition_mode décide du mode (défaut Classic pour compat aigis_i_am_not_afraid).
      const key = _MODEWINS_KEY[title.condition_mode] || "Classic";
      return (stats.modeWins?.[key] || 0) >= v;
    }
    case "friends_count":
      return friendCount >= v;
    case "giveups_total":
      return giveups >= v;
    case "all_modes_won":
      return !!allModesWon;
    case "classic_p1_wins":
      // Alias de mode_wins pour "classic" — mêmes conditions_type côté serveur
      // (api/lib/condition_check.php), pas de champ profile.classicP1Wins distinct.
      return (stats.modeWins?.Classic || 0) >= v;
    case "emoji_p2_wins":
      return (stats.modeWins?.Emoji || 0) >= v;
    case "expert_wins_total":
      // Vérifié UNIQUEMENT côté serveur (api/lib/condition_check.php) : le Mode
      // Expert n'alimente pas `user_stats`, ses victoires se recalculent depuis
      // `game_sessions` et n'existent donc pas dans `stats.modeWins`. L'API
      // /api/titles renvoie `is_unlocked`, qui fait foi à l'affichage.
      return false;
    case "leaderboard_top":
      return (profile.bestLeaderboardRank || 9999) <= v;
    case "weekly_clean_modes":
      return (profile.weeklyCleanWinModes || 0) >= v;
    case "joker_profile": {
      const jokerSongs = [
        "Last_Surprise.mp3",
        "Take_Over.mp3",
        "Wake_Up,_Get_Up,_Get_Out_There.mp3",
        "No_More_What_Ifs.mp3",
      ];
      const song = profile.profileSong?.fichier || profile.profileMusicId || "";
      if (profile.profileTheme === "all_out" && jokerSongs.includes(song)) return true;
      const jokerAvatarFiles = [
        "JOKER.webp", "Joker.jpg", "joker_starlight.jpg",
        "Ren.webp", "Ren.gif", "Ren2.gif", "ren_t.webp", "ren_jazz.jpg",
      ];
      const avatarRef = profile.avatarSrc ||
        (!profile.avatar?.startsWith("data:") ? profile.avatar ?? "" : "");
      return jokerAvatarFiles.some(f => avatarRef.includes(f));
    }
    default:
      return false;
  }
}

/** Texte lisible de la condition d'un titre (fallback si l'API n'a pas fourni de description). */
export function titleConditionText(t) {
  const v = t.condition_value;
  switch (t.condition_type) {
    case "wins_total":
      return `Win ${v} total games`;
    case "wins_mode":
      return `Win ${v} games in any single mode`;
    case "mode_wins":
      return `Win ${v} ${_MODEWINS_KEY[t.condition_mode] || "Classic"} games`;
    case "streak_record":
      return `Reach a ${v}-day streak record`;
    case "badges_count":
      return `Unlock ${v} badges`;
    case "unique_days":
      return `Play on ${v} different days`;
    case "friends_count":
      return `Have ${v} friends`;
    case "giveups_total":
      return `Give up ${v} times`;
    case "all_modes_won":
      return `Win at least once in all 6 modes`;
    case "classic_p1_wins":
      return `Win ${v} Classic games with P1 filter`;
    case "emoji_p2_wins":
      return `Win ${v} Emoji games with P2 filter`;
    case "expert_wins_total":
      return `Win ${v} games in Expert mode`;
    case "leaderboard_top":
      return `Reach top ${v} on the leaderboard`;
    case "weekly_clean_modes":
      // Correspond à ce que vérifie réellement api/lib/condition_check.php : le
      // nombre de modes DISTINCTS joués sur 7 jours, peu importe le résultat —
      // pas "gagner sans abandonner" (voir trackWeeklyModePlay(), badgesManager.js).
      return `Play ${v} different modes within 7 days`;
    case "joker_profile":
      return `Equip the All-Out Attack theme with a P5 signature track`;
    default:
      return t.condition_type || "???";
  }
}

/** Sync _titlesData.is_unlocked depuis profile.unlockedTitles (localStorage). */
function _refreshTitlesUnlockState(profile) {
  const unlocked = new Set(profile.unlockedTitles || []);
  for (const t of _titlesData) {
    // On ne rétrograde jamais : si déjà marqué unlocked (ex: par l'API), on garde
    if (!t.is_unlocked) t.is_unlocked = unlocked.has(t.slug) ? 1 : 0;
  }
}

/**
 * Résout la correspondance ID ↔ slug du titre équipé.
 * - cloud donne equipped_title_id (int) → on cherche le slug dans _titlesData
 * - local peut avoir seulement le slug → on cherche l'id pour pousser vers cloud
 */
function _resolveEquippedTitle(profile, saveProfile, saveProfileToCloud) {
  const eId = profile.equippedTitleId ?? null;
  const eSlug = profile.equippedTitleSlug ?? null;

  if (eId && !eSlug) {
    const match = _titlesData.find((t) => t.id === eId);
    if (match) {
      profile.equippedTitleSlug = match.slug;
      saveProfile();
    }
  } else if (!eId && eSlug) {
    const match = _titlesData.find((t) => t.slug === eSlug);
    if (match?.id) {
      profile.equippedTitleId = match.id;
      saveProfile();
      saveProfileToCloud({ equipped_title_id: match.id });
    }
  }
}

async function checkAndUnlockTitles(profile, saveProfile) {
  const stats = profile.stats || {};
  // stats.giveups (total, tous modes) — pas stats.modeGiveups, un champ jamais
  // peuplé nulle part (js/cloud-sync.js ne calcule que modeCount/modeWins par
  // mode, pas modeGiveups) : giveups valait donc toujours 0, bloquant
  // structurellement adachi_boring_isnt_it (giveups_total >= 50), quel que soit
  // le nombre réel d'abandons. Même champ que la badge ace_defective utilise déjà.
  const giveups = stats.giveups || 0;
  const allModesWon = ["Classic", "Emoji", "Silhouette", "AllOutAttack", "Personae", "Music"].every(
    (m) => (stats.modeWins?.[m] || 0) >= 1
  );

  let friendCount = 0;
  if (window._currentUser) {
    try {
      const _prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
      const res = await fetch(`${_prefix}/api/friends`, { credentials: "include" }).then((r) =>
        r.json()
      );
      friendCount = (res?.friends || []).length;
    } catch (_) {}
  }

  const totalWins = Object.values(stats.modeWins || {}).reduce((a, b) => a + b, 0);
  const streakRecord = stats.streakRecord || 0;
  const ctx = { profile, stats, friendCount, allModesWon, giveups, totalWins, streakRecord };

  for (const title of _titlesData) {
    if (title.is_unlocked) continue;
    if (!isTitleConditionMet(title, ctx)) continue;

    title.is_unlocked = 1;
    if (!profile.unlockedTitles) profile.unlockedTitles = [];
    if (!profile.unlockedTitles.includes(title.slug)) {
      profile.unlockedTitles.push(title.slug);
      saveProfile();
      _showTitleNotification(title);
      // Persister en BDD — on envoie le slug (l'id peut être null si l'API n'a pas répondu)
      window._personadleApi?.titles?.unlock(title.slug).catch(() => {});
    }
  }
}

/**
 * Lightweight title check for game mode pages — mirrors checkBadgesAfterGame()
 * (badgesManager.js). Reads profile from localStorage, evaluates title conditions,
 * shows unlock notifications. Does NOT render the profile page UI.
 * Call this after a game session ends (win or give-up), on any page.
 */
export function checkTitlesAfterGame() {
  const p = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
  const save = () => localStorage.setItem("personaUserProfile", JSON.stringify(p));
  checkAndUnlockTitles(p, save).catch(() => {});
}

/**
 * URL absolue (depuis la racine du site) de l'image d'un titre — correcte depuis
 * N'IMPORTE QUELLE page. Le toast d'unlock s'affiche aussi sur les pages de mode
 * (ex: /silhouetteMode/…) où un chemin relatif casse. `image_path` vaut soit
 * "titles/x.webp" (défaut local, relatif à profile/), soit "profile/titles/x.webp"
 * (enrichi par l'API /api/titles) → on normalise les deux vers "/profile/titles/x.webp".
 */
function _titleImgSrc(title) {
  const base = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
  let p = String(title.image_path || `titles/${title.slug}.webp`);
  if (p.startsWith("/")) return p; // déjà absolu
  if (!p.startsWith("profile/")) p = `profile/${p}`;
  return `${base}/${p}`;
}

function _showTitleNotification(title) {
  const imgSrc = _titleImgSrc(title);
  const cond = titleConditionText(title);

  const notif = document.createElement("div");
  notif.className = "title-notification";
  notif.innerHTML = `
    <div class="title-notif-header">🏅 Title Unlocked!</div>
    <img class="title-notif-img" src="${imgSrc}" alt="${title.name}">
    <div class="title-notif-footer">
      <strong>${title.name}</strong>
      <span class="title-rarity-tag" data-rarity="${title.rarity}">${title.rarity}</span>
    </div>
  `;

  document.body.appendChild(notif);

  notif.onclick = () => {
    notif.remove();
    _showTitleZoom(title);
  };

  setTimeout(() => notif.classList.add("show"), 80);
  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => notif.remove(), 400);
  }, 5000);

  void cond; // conservé pour un futur affichage de la condition dans la toast
}

function _showTitleZoom(title) {
  const imgSrc = _titleImgSrc(title);
  const cond = titleConditionText(title);

  const modal = document.createElement("div");
  modal.className = "badge-zoom-modal title-zoom-modal";
  modal.innerHTML = `
    <div class="badge-zoom-content title-zoom-content">
      <span class="badge-zoom-close">&times;</span>
      <img src="${imgSrc}" alt="${title.name}" style="width:100%;border-radius:10px;display:block;margin-bottom:14px;">
      <h3 style="margin:0 0 6px;color:#ffd700;">${title.name}</h3>
      <span class="title-rarity-tag" data-rarity="${title.rarity}" style="font-size:.7rem;">${title.rarity}</span>
      <p class="badge-condition" style="margin-top:10px;opacity:.85;">${cond}</p>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  modal.querySelector(".badge-zoom-close").onclick = () => modal.remove();
  setTimeout(() => modal.classList.add("show"), 10);
}

/** Rend l'image de calling card sous l'avatar + la grille modale. */
export function renderTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty) {
  // ── Calling card image sous avatar/pseudo ─────────────────────────────────
  const equippedId = profile.equippedTitleId || null;
  const equippedSlug = profile.equippedTitleSlug || null;
  const eq = _titlesData.find(
    (t) => (equippedId && t.id && t.id === equippedId) || (equippedSlug && t.slug === equippedSlug)
  );
  const titleImg = document.getElementById("equippedTitleImg");
  if (titleImg) {
    if (eq) {
      titleImg.src = eq.image_path || `titles/${eq.slug}.webp`;
      titleImg.dataset.rarity = eq.rarity || "common";
      titleImg.style.display = "block";
    } else {
      titleImg.style.display = "none";
    }
  }
  // ── Grille modale ─────────────────────────────────────────────────────────
  _renderTitlesGrid(profile, saveProfile, saveProfileToCloud, markDirty);
}

// Render séparé sans dépendance à l'état du modal
function _renderTitlesGrid(profile, saveProfile, saveProfileToCloud, markDirty) {
  const grid = document.getElementById("titlesModalGrid");
  if (!grid) return;

  // Source de vérité combinée : localStorage.unlockedTitles OU _titlesData.is_unlocked (depuis API)
  const unlockedSlugs = new Set(profile?.unlockedTitles || []);
  const equippedSlug = profile?.equippedTitleSlug || null;
  const equippedId = profile?.equippedTitleId || null;

  grid.innerHTML = (_titlesData || [])
    .filter((t) => !t.is_hidden || unlockedSlugs.has(t.slug) || !!t.is_unlocked)
    .map((t) => {
      const isUnlocked = unlockedSlugs.has(t.slug) || !!t.is_unlocked;
      const isEquipped =
        (equippedSlug && equippedSlug === t.slug) || (equippedId && t.id && equippedId === t.id);
      const imgSrc = t.image_path || `titles/${t.slug}.webp`;
      return `
      <div class="tm-card ${isUnlocked ? "tm-unlocked" : "tm-locked"} ${isEquipped ? "tm-equipped" : ""}"
           data-slug="${t.slug}" data-id="${t.id ?? ""}" data-unlocked="${isUnlocked}">
        <div class="tm-img-wrap">
          <img src="${imgSrc}" alt="${t.name}" loading="lazy">
          ${!isUnlocked ? '<span class="tm-lock">🔒</span>' : ""}
          ${isEquipped ? '<span class="tm-badge-equipped">✓ Equipped</span>' : ""}
        </div>
        <div class="tm-info">
          <strong class="tm-name">${t.name}</strong>
          <span class="tm-rarity" data-rarity="${t.rarity || "common"}">${t.rarity || "common"}</span>
          <span class="tm-cond">${isUnlocked ? "🔓" : "🔒"} ${titleConditionText(t)}</span>
        </div>
      </div>`;
    })
    .join("");

  // Délégation d'événements — un seul listener sur le conteneur, pas un par carte
  grid.onclick = (e) => {
    const card = e.target.closest(".tm-card");
    if (!card) return;
    const slug = card.dataset.slug;
    const titleId = card.dataset.id ? parseInt(card.dataset.id, 10) : null;
    const isUnlocked = card.dataset.unlocked === "true";
    if (isUnlocked) {
      const currentEquipped = profile?.equippedTitleSlug;
      const alreadyEquipped = currentEquipped === slug;
      // titleId vient de /api/titles (via initTitlesSection), pas encore résolu juste
      // après l'ouverture de la modale (rendu immédiat depuis localStorage, cf.
      // _bindTitlesModal). Équiper avec un id null enverrait equipped_title_id: null
      // au serveur et déséquiperait silencieusement le titre actuel — on ignore le
      // clic le temps que la grille se re-rende avec les vrais IDs.
      if (!alreadyEquipped && titleId === null) return;
      profile.equippedTitleSlug = alreadyEquipped ? null : slug;
      profile.equippedTitleId = alreadyEquipped ? null : titleId;
      saveProfile();
      markDirty();
      saveProfileToCloud({ equipped_title_id: profile.equippedTitleId ?? null });
      renderTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty); // re-render image + grille
    } else {
      const titleObj = (_titlesData || []).find((t) => t.slug === slug);
      if (titleObj) _showTitleZoom(titleObj);
    }
  };
}

export function _bindTitlesModal(profile, saveProfile, saveProfileToCloud, markDirty) {
  const modal = document.getElementById("titlesModal");
  const overlay = document.getElementById("titlesModalOverlay");
  const openBtn = document.getElementById("openTitlesModal");
  const closeBtn = document.getElementById("closeTitlesModal");
  if (!modal || !openBtn) return;

  _renderTitlesGrid(profile, saveProfile, saveProfileToCloud, markDirty);

  const open = () => {
    // Escape (géré par le trap clavier d'openModal) doit aussi refermer
    // l'overlay séparé — d'où le onClose.
    openModal("titlesModal", { onClose: () => overlay?.classList.add("hidden") });
    if (overlay) overlay.classList.remove("hidden");
  };
  const close = () => {
    closeModal("titlesModal");
    if (overlay) overlay.classList.add("hidden");
  };

  // addEventListener au lieu de onclick (plus fiable)
  openBtn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
}

/** Retourne le titre actuellement équipé (ou null), pour un usage en lecture seule (ex: carte de partage). */
export function getEquippedTitle(profile) {
  return (
    _titlesData.find(
      (t) =>
        (profile.equippedTitleId && t.id && t.id === profile.equippedTitleId) ||
        (profile.equippedTitleSlug && t.slug === profile.equippedTitleSlug)
    ) || null
  );
}

/** Remet tous les titres à "non débloqué" (affichage local uniquement — utilisé au logout). */
export function resetTitlesUnlockedState() {
  _titlesData.forEach((t) => {
    t.is_unlocked = 0;
  });
}

/**
 * Rafraîchissement léger après un pull cloud (sans re-fetch de /api/titles) :
 * resync l'état débloqué depuis profile.unlockedTitles, résout l'équipé,
 * revérifie les conditions, re-rend.
 */
export function refreshTitlesAfterCloudSync(profile, saveProfile, saveProfileToCloud, markDirty) {
  _refreshTitlesUnlockState(profile);
  _resolveEquippedTitle(profile, saveProfile, saveProfileToCloud);
  renderTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty);
  checkAndUnlockTitles(profile, saveProfile).catch(() => {});
}

/** Point d'entrée : charge les titres (API + local), résout l'équipé, débloque, rend. */
export async function initTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty) {
  const lang = window.i18n?.getCurrentLang?.() || "en";
  const _prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";

  // 1. Charger les titres depuis l'API :
  //    - vrais IDs (pour les appels unlock)
  //    - noms localisés (depuis la BDD)
  //    - is_unlocked PER-USER (la source de vérité la plus fiable)
  try {
    const res = await fetch(`${_prefix}/api/titles?lang=${lang}`, { credentials: "include" });
    const json = await res.json();
    const apiTitles = Array.isArray(json) ? json : [];
    if (apiTitles.length > 0) {
      const bySlug = {};
      for (const t of apiTitles) bySlug[t.slug] = t;

      _titlesData = _titlesData.map((t) => {
        const api = bySlug[t.slug];
        if (!api) return t;
        return {
          ...t,
          id: api.id ?? t.id,
          name: api.name || t.name,
          // On garde le chemin local relatif (titles/slug.webp depuis profile/)
          // Le chemin DB (profile/titles/...) est réservé à profile-view.js
          is_unlocked: api.is_unlocked ? 1 : 0,
        };
      });
    }
  } catch (_) {}

  // 2. Fusionner avec localStorage (titres débloqués offline ou sur un autre appareil)
  _refreshTitlesUnlockState(profile);

  // 3. Résoudre ID ↔ slug du titre équipé (cloud-sync donne les deux désormais)
  _resolveEquippedTitle(profile, saveProfile, saveProfileToCloud);

  // 4. Vérifier les conditions et déverouiller les nouveaux titres mérités
  await checkAndUnlockTitles(profile, saveProfile);
  renderTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty);
}
