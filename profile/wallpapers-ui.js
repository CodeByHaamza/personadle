/**
 * profile/wallpapers-ui.js — Wallpapers déblocables du profil.
 * Extrait de profile-page.js (bloc "🖼️ WALLPAPERS DÉBLOCABLES").
 *
 * profile/saveProfile sont passés en paramètres explicites (pas de closure sur
 * l'état module-scope de profile-page.js) — même convention que badgesManager.js.
 */

/** Catalogue des wallpapers déblocables. Chaque `check` est pure : (profile, stats, friendCount) → bool. */
export const UNLOCKABLE_WALLPAPERS = [
  {
    id: "kamoshida_palace",
    name: "Kamoshida's Palace",
    src: "../profile/Wallpaper/unlockable/kamoshida_palace.webp",
    condition: "Play at least 1 game in each of the 6 modes",
    // modeCount contient les 6 modes dès l'inscription (lignes user_stats à 0) :
    // on compte donc les modes RÉELLEMENT joués (count > 0), pas la présence des clés.
    check: (p, stats) => Object.values(stats?.modeCount || {}).filter((n) => (n || 0) > 0).length >= 6,
  },
  {
    id: "madarame_wallpaper",
    name: "Madarame's Palace",
    src: "../profile/Wallpaper/unlockable/madarame_wallpaper.webp",
    condition: "Set a custom avatar AND have at least 1 friend",
    check: (p, stats, friendCount) => !!p?.avatar && friendCount >= 1,
  },
  {
    id: "yukiko_dungeons",
    name: "Yukiko's Dungeons",
    src: "../profile/Wallpaper/unlockable/yukiko_dungeons.webp",
    condition: "Play 3 consecutive days with P4 filter active",
    check: (p) => (p?.p4ConsecutiveDays || 0) >= 3,
  },
  {
    id: "kanji_dungeons",
    name: "Kanji's Dungeons",
    src: "../profile/Wallpaper/unlockable/kanji_dungeons.webp",
    condition: "Send a challenge to a friend and have them accept it",
    check: (p) => p?.challengeAcceptedByFriend === true,
  },
  {
    id: "rise_dungeons",
    name: "Rise's Dungeons",
    src: "../profile/Wallpaper/unlockable/rise_dungeons.webp",
    condition: "Play 30 total games in Music mode",
    check: (p, stats) => (stats?.modeCount?.Music || 0) >= 30,
  },
  {
    id: "mitsuo_dungeons",
    name: "Mitsuo's Dungeons",
    src: "../profile/Wallpaper/unlockable/mitsuo_dungeons.webp",
    condition: "Complete 75 total games across all modes",
    check: (p, stats) => Object.values(stats?.modeCount || {}).reduce((a, b) => a + b, 0) >= 75,
  },
  {
    id: "dark_shopping_district",
    name: "Dark Shopping District",
    src: "../profile/Wallpaper/unlockable/dark_shopping_district.webp",
    condition: "Have a Social Link at rank 5 or higher",
    check: (p) => (p?.bestSocialLinkRank || 0) >= 5,
  },
];

/** Rend la galerie de wallpapers (verrouillés/débloqués) dans #unlockableWallpaperGrid. */
export function renderUnlockableWallpaperGallery(p) {
  const container = document.getElementById("unlockableWallpaperGrid");
  if (!container) return;
  const unlocked = p.unlockedWallpapers || [];
  container.innerHTML = UNLOCKABLE_WALLPAPERS.map((wp) => {
    const isUnlocked = unlocked.includes(wp.id);
    return `
      <div class="unlockable-wp-item ${isUnlocked ? "unlocked" : "locked"}"
           data-id="${wp.id}" title="${isUnlocked ? wp.name : wp.condition}">
        <img src="${wp.src}" alt="${wp.name}" loading="lazy">
        ${!isUnlocked ? `<div class="wp-lock-overlay">🔒<span class="wp-lock-cond">${wp.condition}</span></div>` : ""}
        ${isUnlocked ? `<span class="wp-unlocked-label">✓ ${wp.name}</span>` : ""}
      </div>
    `;
  }).join("");
}

/** Vérifie et débloque les nouveaux wallpapers, affiche une notif pour chacun. */
export async function checkAndUnlockWallpapers(p, stats, friendCount, saveProfile) {
  if (!p.unlockedWallpapers) p.unlockedWallpapers = [];
  const newUnlocks = [];
  for (const wp of UNLOCKABLE_WALLPAPERS) {
    if (p.unlockedWallpapers.includes(wp.id)) continue;
    if (wp.check(p, stats, friendCount)) {
      p.unlockedWallpapers.push(wp.id);
      newUnlocks.push(wp);
      window._personadleApi?.wallpapers?.unlock(wp.id).catch(() => {});
    }
  }
  if (newUnlocks.length) {
    saveProfile();
    newUnlocks.forEach((wp) => showWallpaperNotification(wp));
  }
}

/** Affiche une notification toast de déblocage de wallpaper. */
export function showWallpaperNotification(wp) {
  const notif = document.createElement("div");
  notif.className = "wallpaper-notif";
  notif.innerHTML = `
    <img class="wallpaper-notif-thumb" src="${wp.src}" alt="${wp.name}">
    <div class="wallpaper-notif-text">
      <div class="wallpaper-notif-title">🖼️ Wallpaper Unlocked!</div>
      <div class="wallpaper-notif-name">${wp.name}</div>
    </div>
  `;
  document.body.appendChild(notif);
  notif.onclick = () => notif.remove();
  setTimeout(() => notif.classList.add("show"), 80);
  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => notif.remove(), 500);
  }, 4000);
}

/** Sync backend → local des wallpapers débloqués, vérifie les nouveaux, rend la galerie. */
export async function initUnlockableWallpapers(profile, saveProfile) {
  const stats = profile.stats || {};
  let friendCount = 0;
  if (window._currentUser) {
    try {
      const res = await fetch(
        `${window.location.pathname.startsWith("/personadle/") ? "/personadle" : ""}/api/friends`,
        { credentials: "include" }
      ).then((r) => r.json());
      friendCount = (res?.friends || []).length;
    } catch (_) {}
  }

  // Sync backend → local
  if (window._currentUser) {
    try {
      const _prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
      const res = await fetch(`${_prefix}/api/user/${window._currentUser.id}`, {
        credentials: "include",
      }).then((r) => r.json());
      const backendWp = res?.unlocked_wallpapers || [];
      if (!profile.unlockedWallpapers) profile.unlockedWallpapers = [];
      const newFromBackend = backendWp.filter((id) => !profile.unlockedWallpapers.includes(id));
      if (newFromBackend.length) {
        profile.unlockedWallpapers.push(...newFromBackend);
        saveProfile();
      }
    } catch (_) {}
  }

  checkAndUnlockWallpapers(profile, stats, friendCount, saveProfile);
  renderUnlockableWallpaperGallery(profile);
}
