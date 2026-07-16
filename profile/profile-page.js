/**
 * profile-page.js — Logique de la page de profil dédiée
 * ─────────────────────────────────────────────────────────
 * Page autonome (profile/profile.html), pas une modale.
 *
 *   - Chemins images : ../img/ (depuis profile/)
 *   - normalizeAvatarPath() pour la compatibilité avec les profils existants
 *     dont l'avatar est stocké en ./img/... (ancien format)
 *
 * Fonctionnalités :
 *   - Chargement et sauvegarde du profil depuis localStorage
 *   - Sélection et recadrage d'avatar (canvas crop)
 *   - Affichage des statistiques avec animation stagger
 *   - Système de badges (délégué à badgesManager.js)
 *   - Code événement (badge exclusif)
 *   - Export / Import JSON
 *   - Partage de profil (canvas → image téléchargeable)
 *   - Réinitialisation du profil
 */

// ─────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────

import {
  initBadgesSystem,
  syncBadgesWithBackend,
  renderBadgesModal,
  renderBadgesPreview,
  getBadgesForShare,
  markProfileAsShared,
} from "./badges/badgesManager.js";
import { songs as ALL_SONGS } from "../musicsMode/database/songs.js";
import { canRecover, showStreakRecoveryMenu } from "../js/streak-recovery.js";
import { openModal, closeModal } from "../js/modal.js";
import { pullProfileFromCloud, pushLangToCloud } from "../js/cloud-sync.js";
import { formatPlayTime } from "./formatPlayTime.js";
import { AVATAR_GROUPS } from "./avatars_data.js";
import { getStreakTier, formatSongTime, normalizeAvatarPath } from "./profile-format.js";
import { THEME_COLORS, hexToRgb, adjustHex, resolveTheme, applyThemeVars } from "./theme.js";
import {
  UNLOCKABLE_WALLPAPERS,
  renderUnlockableWallpaperGallery,
  initUnlockableWallpapers,
} from "./wallpapers-ui.js";
import {
  renderTitlesSection,
  initTitlesSection,
  _bindTitlesModal,
  getEquippedTitle,
  resetTitlesUnlockedState,
  refreshTitlesAfterCloudSync,
} from "./titles-ui.js";
import {
  renderSongCard,
  setupSongPicker,
  stopProfileSong,
  updateSongArtwork,
} from "./song-player.js";
import {
  setupShareProfile,
  setupCopyProfileLink,
  attachPreviewClicksToImages,
  refreshShareCardPreview,
} from "./share-card.js";

// Ré-exportées pour compatibilité avec le code existant qui importe ces
// fonctions depuis profile-page.js plutôt que depuis profile-format.js/theme.js.
export { getStreakTier, formatSongTime, hexToRgb, adjustHex, normalizeAvatarPath };

// Exposer les songs pour d'autres modules (notifications.js, social-link.js…)
window._profileSongs = ALL_SONGS;

// ─────────────────────────────────────────────────────────
// THÈMES UI
// ─────────────────────────────────────────────────────────

/**
 * Définitions des thèmes de couleur de l'interface (labels UI + couleurs).
 * Les couleurs viennent de THEME_COLORS (partagé avec profile-view.js) pour
 * n'avoir qu'une seule source de vérité — seuls les labels sont propres au picker.
 */
const THEME_LABELS = [
  { id: "all_out", label: "All-Out Attack" }, // Persona 5
  { id: "velvet_room", label: "Velvet Room" }, // bleu nuit d'Igor
  { id: "dark_hour", label: "Dark Hour" }, // Persona 3 (Tartarus)
  { id: "pink_ribbon", label: "Pink Ribbon" }, // Persona 3 Portable (FeMC)
  { id: "midnight_channel", label: "Midnight Channel" }, // Persona 4 (TV World)
  { id: "demon_palace", label: "Demon Palace" }, // Persona 1 (violet mystique)
  { id: "eternal_punishment", label: "Eternal Punishment" }, // Persona 2 EP (indigo)
  { id: "golden_labyrinth", label: "Golden Labyrinth" }, // Persona Q (orange vif)
  { id: "custom", label: null }, // Couleur libre
];
const THEMES = THEME_LABELS.map(({ id, label }) => ({
  id,
  label,
  ...(THEME_COLORS[id] || { accent: null, hover: null, light: null, rgb: null }),
}));

/** Traduit une clé i18n avec un vrai fallback string (window.i18n.t renvoie la clé brute si absente). */
function tf(key, fallback) {
  const v = window.i18n?.t?.(key);
  return v != null && v !== key ? v : fallback;
}

/**
 * Applique un thème en injectant les variables CSS sur <html>.
 * @param {string} themeId  - ID du thème (voir THEMES)
 * @param {string} [customColor] - Couleur hex si themeId === 'custom'
 */
function applyTheme(themeId, customColor) {
  if (!THEMES.some((t) => t.id === themeId)) return;
  applyThemeVars(resolveTheme(themeId, customColor));
}

/**
 * Construit et injecte le sélecteur de thèmes dans #themeSwatches.
 * À rappeler après chaque changement pour mettre à jour l'état actif.
 */
function renderThemePicker() {
  const container = document.getElementById("themeSwatches");
  if (!container) return;

  const currentId = profile.profileTheme || "all_out";
  const customLabel = tf("profile.theme_custom", "Custom color");

  container.innerHTML = THEMES.map((t) => {
    const isCustom = t.id === "custom";
    const isActive = t.id === currentId;
    const label = isCustom ? customLabel : t.label;
    const style = isCustom ? "" : `background:${t.accent};`;
    const cls = `theme-swatch${isActive ? " active" : ""}${isCustom ? " theme-swatch--rainbow" : ""}`;

    return `
      <button class="${cls}" data-theme="${t.id}" style="${style}" title="${label}" aria-label="${label}">
        <span class="theme-swatch-label">${label}</span>
      </button>`;
  }).join("");

  // Afficher/masquer la rangée de couleur custom
  const customRow = document.getElementById("customThemeRow");
  if (customRow) {
    customRow.classList.toggle("hidden", currentId !== "custom");
    const picker = document.getElementById("customThemeColor");
    if (picker && profile.profileCustomColor) {
      picker.value = profile.profileCustomColor;
    }
  }

  // Handlers swatches
  container.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.theme;
      profile.profileTheme = id;

      if (id === "custom") {
        const color = profile.profileCustomColor || "#e63946";
        applyTheme("custom", color);
      } else {
        applyTheme(id);
      }

      saveProfile();
      renderThemePicker();
      updateAppearancePreview();
      markDirty();
      const wid = id === "custom" ? `custom:${profile.profileCustomColor || "#e63946"}` : id;
      saveProfileToCloud({ wallpaper_id: wid });

      // Régénère la preview de partage si la modale est ouverte
      refreshShareCardPreview();
    });
  });

  // Handler couleur custom
  document.getElementById("customThemeColor")?.addEventListener("input", (e) => {
    profile.profileCustomColor = e.target.value;
    applyTheme("custom", e.target.value);
    updateAppearancePreview();
    saveProfile();
    markDirty();
    saveProfileToCloud({ wallpaper_id: `custom:${e.target.value}` });
  });
}

// ─────────────────────────────────────────────────────────
// VARIABLES GLOBALES
// ─────────────────────────────────────────────────────────

let profile = null; // Objet profil utilisateur (localStorage)
let zoom = 1; // Niveau de zoom du canvas crop
let offsetX = 0; // Décalage horizontal du canvas
let offsetY = 0; // Décalage vertical du canvas
let dragging = false; // État du drag
let startX = 0; // Position X initiale du drag
let startY = 0; // Position Y initiale du drag
let selectedAvatarSrc = ""; // Source de l'avatar sélectionné dans la grille

let cropTarget = "avatar"; // 'avatar' | 'song' — détermine où le crop est sauvegardé

// ─────────────────────────────────────────────────────────
// ÉLÉMENTS DOM
// ─────────────────────────────────────────────────────────

// Éléments principaux de la page
const pageAvatar = document.getElementById("pageAvatar");
const pageUsername = document.getElementById("pageUsername");
const pseudoInput = document.getElementById("pseudoInput");

// Boutons principaux
const editAvatarBtn = document.getElementById("editAvatarBtn");
const saveRefreshBtn = document.getElementById("saveAndRefreshBtn");

// ── Dirty-state : bouton visible uniquement si un changement utilisateur est détecté ──
let _profileDirty = false;

function markDirty() {
  if (_profileDirty) return;
  _profileDirty = true;
  saveRefreshBtn.innerHTML = "💾 <span>Save changes</span>";
  saveRefreshBtn.classList.add("btn-dirty");
}

function markClean() {
  _profileDirty = false;
  saveRefreshBtn.classList.add("btn-saving");
  saveRefreshBtn.innerHTML = "✅ <span>Saved!</span>";
  setTimeout(() => saveRefreshBtn.classList.remove("btn-dirty", "btn-saving"), 1300);
}
const resetProfileBtn = document.getElementById("resetProfile");
const exportBtn = document.getElementById("exportProfile");
const borderColorPicker = document.getElementById("borderColorPicker");
const statsContainer = document.getElementById("statsContainer");

// Modale crop
const closeCropper = document.getElementById("closeCropper");
const avatarGrid = document.getElementById("avatarGrid");
const canvas = document.getElementById("avatarCanvas");
const ctx = canvas.getContext("2d");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const confirmCrop = document.getElementById("confirmCrop");

// ─────────────────────────────────────────────────────────
// INITIALISATION DU PROFIL
// ─────────────────────────────────────────────────────────

/**
 * Charge le profil depuis localStorage ou crée un profil vierge.
 * Met à jour tous les éléments visuels de la page.
 */
function initProfile() {
  const saved = localStorage.getItem("personaUserProfile");

  if (saved) {
    profile = JSON.parse(saved);
  } else {
    // Nouveau profil par défaut
    profile = {
      pseudo: "",
      avatar: "",
      avatarBorderColor: "#000000",
      profileTheme: "all_out",
      profileCustomColor: "#e63946",
      profileSong: null,
      badges: [],
      selectedBadges: [],
      eventCodes: [],
      stats: {
        wins: 0,
        giveups: 0,
        games: 0,
        modeCount: {},
        streak: 0,
        streakRecord: 0,
        lastPlayed: null,
        firstPlayed: new Date().toISOString(),
        totalTimeMinutes: 0,
        perfectWins: 0,
      },
    };
    saveProfile();
  }

  // ── Thème UI ──
  // Assure la compatibilité avec les anciens profils sans ces champs
  if (!profile.profileTheme) profile.profileTheme = "all_out";
  if (!profile.profileCustomColor) profile.profileCustomColor = "#e63946";

  const themeId = profile.profileTheme;
  applyTheme(themeId, themeId === "custom" ? profile.profileCustomColor : undefined);

  // ── Affichage de l'avatar ──
  const avatarSrc = normalizeAvatarPath(profile.avatar);
  pageAvatar.src = avatarSrc;
  pageAvatar.style.borderColor = profile.avatarBorderColor || "#000000";

  // ── Pseudo ──
  pageUsername.textContent = profile.pseudo || "Guest";
  pseudoInput.value = profile.pseudo || "";

  // ── Couleur de bordure ──
  borderColorPicker.value = profile.avatarBorderColor || "#000000";
  updateBorderPreview(profile.avatarBorderColor || "#000000");

  // ── Statistiques ──
  renderStats();
}

/**
 * Sauvegarde le profil dans localStorage.
 */
function saveProfile() {
  localStorage.setItem("personaUserProfile", JSON.stringify(profile));
}

/**
 * Envoie les champs de profil modifiés vers le backend (PATCH /api/user/:id).
 * Fire-and-forget — une erreur réseau ne bloque pas l'UI locale.
 * @param {object} fields - Champs à synchroniser (avatar_data, avatar_border_color, selected_badges…)
 */
async function saveProfileToCloud(fields) {
  if (!window._currentUser?.id) return;
  const api = window._personadleApi;
  if (!api) return;
  try {
    await api.user.update(window._currentUser.id, fields);
  } catch (e) {
    console.warn("[Profile] Cloud sync failed:", e.message);
  }
}

/**
 * Sync initial complet localStorage → cloud au moment du login.
 * Envoie avatar, bordure, wallpaper, musique et badges en une seule requête PATCH.
 * Fire-and-forget — n'écrase que les champs non-null si le profil localStorage existe.
 */
async function syncProfileToCloud() {
  if (!window._currentUser?.id || !window._personadleApi) return;
  if (!profile) return;
  const fields = {
    pseudo: profile.pseudo || null,
    lang: localStorage.getItem("lang") || "en",
    avatar_border_color: profile.avatarBorderColor || "#ffffff",
    wallpaper_id:
      profile.profileTheme === "custom"
        ? `custom:${profile.profileCustomColor || "#e63946"}`
        : profile.profileTheme || "all_out",
    profile_music_id: profile.profileSong?.fichier || profile.profileMusicId || null,
    selected_badges: profile.selectedBadges || [],
    equipped_title_id: profile.equippedTitleId || null,
  };
  if (profile.avatar) fields.avatar_data = profile.avatar;
  // Sync des settings (son, animations…) — stockés dans personaSettings
  const settings = JSON.parse(localStorage.getItem("personaSettings") || "{}");
  if (Object.keys(settings).length) fields.settings = settings;
  try {
    await window._personadleApi.user.update(window._currentUser.id, fields);
  } catch (e) {
    console.warn("[Profile] Sync to cloud failed:", e.message);
  }
}

/**
 * saveProfile + sync cloud pour les badges sélectionnés.
 * Passé comme callback aux fonctions de badgesManager qui modifient selectedBadges.
 */
function saveProfileAndSyncBadges() {
  saveProfile();
  saveProfileToCloud({ selected_badges: profile.selectedBadges || [] });
}

// ─────────────────────────────────────────────────────────
// SYNC STATS DEPUIS LE BACKEND
// ─────────────────────────────────────────────────────────

/**
 * Récupère les stats depuis le backend et écrase les valeurs localStorage.
 * Appelé une fois après auth-ready si l'utilisateur est connecté.
 * En cas d'erreur (offline, serveur), les stats localStorage sont conservées.
 *
 * @param {number} userId - ID de l'utilisateur connecté
 */
async function syncStatsFromBackend(userId) {
  const api = window._personadleApi;
  if (!api) return;

  // Mapping API (lowercase) → localStorage (PascalCase)
  const modeKeyMap = {
    classic: "Classic",
    emoji: "Emoji",
    silhouette: "Silhouette",
    alloutattack: "AllOutAttack",
    personae: "Personae",
    music: "Music",
  };

  try {
    const { stats } = await api.stats.get(userId);
    const g = stats.global;

    // Écraser les stats globales
    profile.stats.wins = g.total_wins;
    profile.stats.giveups = g.total_giveups;
    profile.stats.games = g.total_games;
    profile.stats.streakRecord = g.best_streak;
    profile.stats.totalTimeMinutes = Math.round(g.total_time_ms / 60000);
    profile.stats.perfectWins = g.total_perfect_wins;

    // Streak courant = max des streaks actifs par mode
    profile.stats.streak = Math.max(0, ...stats.by_mode.map((m) => m.streak ?? 0));

    // Stats par mode
    profile.stats.modeCount = {};
    profile.stats.modeWins = {};
    stats.by_mode.forEach((m) => {
      const key = modeKeyMap[m.mode];
      if (key) {
        profile.stats.modeCount[key] = m.games;
        profile.stats.modeWins[key] = m.wins;
      }
    });

    // Mode favori = celui avec le plus de parties
    const fav = stats.by_mode.reduce((best, m) => (!best || m.games > best.games ? m : best), null);
    if (fav) profile.stats.favoriteMode = modeKeyMap[fav.mode] ?? fav.mode;

    saveProfile();
    renderStats();
    renderModeStats();
  } catch {
    // Offline ou erreur serveur — conserver les stats localStorage
  }
}

/**
 * Re-rend toute l'UI à partir du profil localStorage (après un pull cloud).
 * Appelée par window._onCloudSync et pullProfileFromCloud().then().
 */
function _applyCloudToUI() {
  // Relire le profil mis à jour par cloud-sync
  const saved = localStorage.getItem("personaUserProfile");
  if (!saved) return;
  try {
    profile = JSON.parse(saved);
  } catch {
    return;
  }

  // ── Identité ──────────────────────────────────────────────
  if (pageUsername) pageUsername.textContent = profile.pseudo || profile.username || "Guest";
  if (pseudoInput) pseudoInput.value = profile.pseudo || profile.username || "";

  // ── Avatar ────────────────────────────────────────────────
  if (pageAvatar) {
    pageAvatar.src = normalizeAvatarPath(profile.avatar);
    pageAvatar.style.borderColor = profile.avatarBorderColor || "#000000";
  }
  if (borderColorPicker) borderColorPicker.value = profile.avatarBorderColor || "#000000";

  // ── Thème ─────────────────────────────────────────────────
  const themeId = profile.profileTheme || "all_out";
  applyTheme(themeId, themeId === "custom" ? profile.profileCustomColor : undefined);
  renderThemePicker();
  renderBorderPicker();
  updateAppearancePreview();

  // ── Stats ─────────────────────────────────────────────────
  renderStats();
  renderModeStats();

  // ── Musique de profil ─────────────────────────────────────
  // profileMusicId = valeur cloud (undefined = pas encore sync, null = pas de song, string = fichier)
  // profileSong    = objet complet résolu localement
  // Règle : le cloud gagne toujours quand profileMusicId est défini.
  const cloudId = profile.profileMusicId; // undefined | null | string
  const localId = profile.profileSong?.fichier ?? null;

  if (cloudId !== undefined) {
    // On a une info cloud — elle prime sur le local
    if (cloudId && cloudId !== localId) {
      const resolved = ALL_SONGS.find((s) => s.fichier === cloudId);
      if (resolved) {
        profile.profileSong = resolved;
        profile.profileMusicId = cloudId;
        saveProfile();
      }
    } else if (!cloudId && localId) {
      // Le cloud n'a plus de song — on efface le local
      delete profile.profileSong;
      profile.profileMusicId = null;
      saveProfile();
    }
  } else if (localId && !profile.profileSong?.titre) {
    // Pas encore sync depuis le cloud, mais référence locale orpheline — on résout
    const resolved = ALL_SONGS.find((s) => s.fichier === localId);
    if (resolved) {
      profile.profileSong = resolved;
      saveProfile();
    }
  }
  renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty);

  // ── Badges ────────────────────────────────────────────────
  renderBadgesPreview(profile);
  renderBadgesModal(profile, saveProfileAndSyncBadges);

  // ── Wallpapers débloquables ───────────────────────────────
  // Re-render la galerie avec l'état cloud (unlockedWallpapers mis à jour par pullProfileFromCloud)
  renderUnlockableWallpaperGallery(profile);

  // ── Titres ────────────────────────────────────────────────
  refreshTitlesAfterCloudSync(profile, saveProfile, saveProfileToCloud, markDirty);
}

// ─────────────────────────────────────────────────────────
// AFFICHAGE DES STATISTIQUES
// ─────────────────────────────────────────────────────────

/**
 * Construit le HTML de l'item streak avec effets visuels progressifs.
 * @param {number} streak - Valeur du streak actuel
 * @param {string} label  - Label traduit
 * @param {string} delay  - Valeur de animation-delay (ex: "0.22s")
 */
function buildStreakItem(streak, label, delay) {
  const tier = getStreakTier(streak);

  // Flammes latérales selon le tier
  const flameL = (n) => `<span class="streak-side-flame" aria-hidden="true">🔥</span>`.repeat(n);
  const flameR = (n) =>
    `<span class="streak-side-flame streak-side-flame--r" aria-hidden="true">🔥</span>`.repeat(n);

  let leftDeco = "";
  let rightDeco = "";
  let iconSize = "1.3em";
  let fullWidth = tier >= 5;

  if (tier === 3) {
    leftDeco = flameL(1);
    iconSize = "1.5em";
  }
  if (tier === 4) {
    leftDeco = flameL(2);
    rightDeco = flameR(1);
    iconSize = "1.7em";
  }
  if (tier === 5) {
    leftDeco = `<span class="streak-crown" aria-hidden="true">👑</span>${flameL(1)}`;
    rightDeco = flameR(1);
    iconSize = "1.9em";
    label = `🔥 ${label} 🔥`;
  }

  const classes = [
    "stat-item",
    "stat-streak",
    `stat-streak-t${tier}`,
    fullWidth ? "stat-item--full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="${classes}" style="animation-delay:${delay}">
      ${leftDeco}
      <span class="stat-icon" style="font-size:${iconSize}">🔥</span>
      <div class="stat-body">
        <span class="stat-value">${streak}</span>
        <span class="stat-label">${label}</span>
      </div>
      ${rightDeco}
    </div>`;
}

/**
 * Génère et injecte les blocs de statistiques dans #statsContainer.
 */
function renderStats() {
  const s = profile.stats || {};
  const i = window.i18n || { t: (k, v) => k };

  const modeNames = {
    Classique: "Classic",
    Emoji: "Emoji",
    Silhouette: "Silhouette",
    AllOutAttack: "All-Out Attack",
    Personae: "Personae",
    Music: "Music",
  };
  const modeFav = s.favoriteMode ? modeNames[s.favoriteMode] || s.favoriteMode : "—";

  // Stats standard (hors streak)
  const stats = [
    { icon: "🏆", value: s.wins || 0, label: "Wins" },
    { icon: "🏳️", value: s.giveups || 0, label: "Give-ups" },
    { icon: "🎮", value: s.games || 0, label: "Games Played" },
    { icon: "⭐", value: s.streakRecord || 0, label: "Best Streak" },
    { icon: "⏱️", value: formatPlayTime(s.totalTimeMinutes || 0), label: "Time Played" },
    { icon: "📅", value: s.firstPlayed?.split("T")[0] || "—", label: "First Played", full: true },
    { icon: "🎯", value: modeFav, label: "Fav Mode", full: true },
  ];

  const streakHTML = buildStreakItem(s.streak || 0, "Current Streak", "0.22s");
  const regularHTML = stats
    .map(
      (st, idx) => `
    <div class="stat-item${st.full ? " stat-item--full" : ""}"
         style="animation-delay:${0.1 + idx * 0.06}s">
      <span class="stat-icon">${st.icon}</span>
      <div class="stat-body">
        <span class="stat-value">${st.value}</span>
        <span class="stat-label">${st.label}</span>
      </div>
    </div>`
    )
    .join("");

  statsContainer.innerHTML = regularHTML + streakHTML;

  // Streak à 0 : rendre l'élément cliquable pour ouvrir Jack Frost si récupération disponible
  if ((s.streak || 0) === 0 && canRecover()) {
    const streakEl = statsContainer.querySelector(".stat-streak");
    if (streakEl) {
      streakEl.style.cursor = "pointer";
      streakEl.title = "🔥 Click to restore your streak";
      streakEl.addEventListener("click", () => showStreakRecoveryMenu());
      const btn = document.createElement("button");
      btn.className = "sr-restore-btn";
      btn.textContent = "🔥 Restore";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        showStreakRecoveryMenu();
      });
      streakEl.querySelector(".stat-body")?.appendChild(btn);
    }
  }
}

/** Icônes et couleurs par mode */
const MODE_META = {
  Classic: { icon: "🔤", color: "#E63946" },
  Emoji: { icon: "😄", color: "#F97316" },
  Silhouette: { icon: "👤", color: "#6366F1" },
  AllOutAttack: { icon: "⚔️", color: "#DC2626" },
  Personae: { icon: "✨", color: "#9333EA" },
  Music: { icon: "🎵", color: "#0EA5E9" },
};

/**
 * Génère la section "Mode Breakdown" dans #modeStatsContainer.
 * Affiche jeux joués + victoires + barre proportionnelle par mode.
 */
function renderModeStats() {
  const container = document.getElementById("modeStatsContainer");
  if (!container) return;

  const s = profile.stats || {};
  const counts = s.modeCount || {};
  const wins = s.modeWins || {};

  const modes = Object.keys(MODE_META);
  const maxCount = Math.max(...modes.map((m) => counts[m] || 0), 1);

  // Masquer la section si aucune donnée
  if (maxCount === 0) {
    container.innerHTML = "";
    return;
  }

  const rows = modes
    .map((mode) => {
      const meta = MODE_META[mode];
      const count = counts[mode] || 0;
      const win = wins[mode] || 0;
      const pct = Math.round((count / maxCount) * 100);
      const rate = count > 0 ? Math.round((win / count) * 100) : 0;

      return `
      <div class="mode-stat-row${count === 0 ? " mode-stat-row--empty" : ""}">
        <span class="mode-stat-icon">${meta.icon}</span>
        <span class="mode-stat-name">${mode === "AllOutAttack" ? "All-Out" : mode}</span>
        <div class="mode-stat-bar-wrap">
          <div class="mode-stat-bar"
               style="width:${pct}%;background:${meta.color}"></div>
        </div>
        <span class="mode-stat-right">
          <span class="mode-stat-count">${count}</span>
          ${count > 0 ? `<span class="mode-stat-rate">${rate}%</span>` : ""}
        </span>
      </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="mode-stats-header">
      <span>Mode</span>
      <span>Games / Win %</span>
    </div>
    <div class="mode-stats-list">${rows}</div>`;
}

// ─────────────────────────────────────────────────────────
// GESTIONNAIRES D'ÉVÉNEMENTS — PROFIL
// ─────────────────────────────────────────────────────────

// Ouvrir la modale de crop (avatar)
editAvatarBtn.onclick = () => {
  cropTarget = "avatar";
  openModal("avatarCropModal");
};

// Sauvegarder et rafraîchir
saveRefreshBtn.onclick = async () => {
  if (!_profileDirty) return;
  saveRefreshBtn.classList.add("btn-saving");
  saveRefreshBtn.innerHTML = "⏳ <span>Saving…</span>";
  saveProfile();
  await syncProfileToCloud().catch(() => {});
  markClean();
  // Soft-refresh : pull le cloud et re-applique l'UI sans rechargement de page
  pullProfileFromCloud()
    .then(_applyCloudToUI)
    .catch(() => {});
};

// Réinitialiser le profil
resetProfileBtn.onclick = () => {
  if (confirm(tf("profile.reset_confirm", "Reset your profile? This cannot be undone."))) {
    localStorage.removeItem("personaUserProfile");
    location.reload();
  }
};

// ─────────────────────────────────────────────────────────
// SUPPRESSION DE COMPTE (RGPD)
// Soft-delete immédiat côté serveur (DELETE /api/user/:id, session détruite
// server-side) + hard-delete différé J+30 (api/lib/deletion_requests.php).
// Modale de confirmation avec saisie du pseudo (pas un simple confirm() comme
// pour reset — action plus destructrice, irréversible passé le délai).
// ─────────────────────────────────────────────────────────
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const deleteAccountModal = document.getElementById("deleteAccountModal");
const deleteAccountPseudoEl = document.getElementById("deleteAccountPseudo");
const deleteAccountInput = document.getElementById("deleteAccountConfirmInput");
const deleteAccountConfirmBtn = document.getElementById("deleteAccountConfirmBtn");
const deleteAccountCancelBtn = document.getElementById("deleteAccountCancelBtn");
const closeDeleteAccountBtn = document.getElementById("closeDeleteAccount");

if (deleteAccountBtn && deleteAccountModal) {
  deleteAccountBtn.onclick = () => {
    if (!window._currentUser?.id) {
      alert(tf("profile.delete_account_login_required", "Log in to delete your account."));
      return;
    }
    deleteAccountPseudoEl.textContent = profile.pseudo || "";
    deleteAccountInput.value = "";
    deleteAccountConfirmBtn.disabled = true;
    openModal("deleteAccountModal");
    deleteAccountInput.focus();
  };

  deleteAccountInput.addEventListener("input", () => {
    deleteAccountConfirmBtn.disabled = deleteAccountInput.value.trim() !== (profile.pseudo || "").trim();
  });

  const closeDeleteModal = () => closeModal("deleteAccountModal");
  deleteAccountCancelBtn?.addEventListener("click", closeDeleteModal);
  closeDeleteAccountBtn?.addEventListener("click", closeDeleteModal);

  deleteAccountConfirmBtn.addEventListener("click", async () => {
    const userId = window._currentUser?.id;
    if (!userId || deleteAccountConfirmBtn.disabled) return;
    deleteAccountConfirmBtn.disabled = true;
    const originalLabel = deleteAccountConfirmBtn.innerHTML;
    deleteAccountConfirmBtn.textContent = "…";
    try {
      await window._personadleApi.user.delete(userId);
      alert(
        tf("profile.delete_account_success", "Your account has been deactivated. You'll be logged out now.")
      );
      localStorage.removeItem("personaUserProfile");
      localStorage.removeItem("personaSettings");
      localStorage.removeItem("playerUserId");
      window.location.href = "../index.html";
    } catch (err) {
      console.error("Delete account failed:", err);
      alert(tf("profile.delete_account_error", "Something went wrong. Please try again or contact us."));
      deleteAccountConfirmBtn.disabled = false;
      deleteAccountConfirmBtn.innerHTML = originalLabel;
    }
  });
}

// Mise à jour du pseudo en temps réel + sync cloud déboncée (500ms)
let _pseudoSyncTimer = null;
pseudoInput.oninput = (e) => {
  profile.pseudo = e.target.value;
  pageUsername.textContent = profile.pseudo || "Guest";
  saveProfile();
  markDirty();
  clearTimeout(_pseudoSyncTimer);
  _pseudoSyncTimer = setTimeout(() => {
    saveProfileToCloud({ pseudo: profile.pseudo || null });
  }, 500);
};

// Couleur custom (picker natif) — aperçu live en glissant, sauvegarde à la fin.
borderColorPicker.oninput = (e) => {
  profile.avatarBorderColor = e.target.value;
  if (pageAvatar) pageAvatar.style.borderColor = e.target.value;
  updateAppearancePreview();
};
borderColorPicker.onchange = (e) => setBorderColor(e.target.value);

/**
 * Met à jour le dot de prévisualisation et la valeur hex
 * dans le chip couleur de la perso-card.
 * @param {string} color - Valeur hex (ex. "#1a2b3c")
 */
function updateBorderPreview(color) {
  const ap = document.getElementById("apAvatar");
  if (ap) ap.style.borderColor = color;
}

// Palette de bordures d'avatar (pastilles preset, même UX que le thème).
const BORDER_PRESETS = [
  "#ffd700", "#e63946", "#3b82f6", "#2bae66", "#8b5cf6",
  "#ff6b9d", "#ffffff", "#111111", "#00b8d4", "#f39c12",
];

/** Couleur d'accent du thème actuellement appliqué. */
function _currentAccent() {
  if (profile.profileTheme === "custom") return profile.profileCustomColor || "#e63946";
  const th = THEMES.find((t) => t.id === (profile.profileTheme || "all_out"));
  return th?.accent || "#e63946";
}

/** Met à jour l'aperçu live (avatar bordé + barres d'accent UI). */
function updateAppearancePreview() {
  const border = profile.avatarBorderColor || "#000000";
  const accent = _currentAccent();
  const ap = document.getElementById("apAvatar");
  if (ap) ap.style.borderColor = border;
  ["apAccent", "apAccent2", "apAccentDot"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.background = accent;
  });
}

/** Applique une couleur de bordure (clic pastille ou custom) + sauvegarde. */
function setBorderColor(color) {
  profile.avatarBorderColor = color;
  if (pageAvatar) pageAvatar.style.borderColor = color;
  updateAppearancePreview();
  renderBorderPicker();
  saveProfile();
  markDirty();
  saveProfileToCloud({ avatar_border_color: color });
  refreshShareCardPreview();
}

/** Rend les pastilles de bordure d'avatar (presets + custom), comme le thème. */
function renderBorderPicker() {
  const container = document.getElementById("borderSwatches");
  if (!container) return;
  const current = (profile.avatarBorderColor || "#000000").toLowerCase();
  const presets = BORDER_PRESETS.map((c) => c.toLowerCase());
  const isPreset = presets.includes(current);
  const customLabel = tf("profile.theme_custom", "Custom");

  container.innerHTML =
    BORDER_PRESETS.map(
      (c) =>
        `<button class="swatch${c.toLowerCase() === current ? " active" : ""}" data-color="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`
    ).join("") +
    `<button class="swatch swatch--rainbow${!isPreset ? " active" : ""}" id="borderCustomBtn" title="${customLabel}" aria-label="${customLabel}">🎨</button>`;

  container.querySelectorAll(".swatch[data-color]").forEach((b) =>
    b.addEventListener("click", () => setBorderColor(b.dataset.color))
  );
  document.getElementById("borderCustomBtn")?.addEventListener("click", () => {
    const picker = document.getElementById("borderColorPicker");
    if (picker) {
      picker.value = isPreset ? "#e63946" : current;
      picker.click();
    }
  });
}

/**
 * Gère le toggle collapse/expand de la perso-card.
 * L'état est persisté dans localStorage.
 */
function setupPersoCard() {
  const btn = document.getElementById("persoToggle");
  const body = document.getElementById("persoBody");
  if (!btn || !body) return;

  // Restaurer l'état sauvegardé (ouvert par défaut)
  const saved = localStorage.getItem("persoCardExpanded");
  const expanded = saved === null ? true : saved === "true";

  btn.setAttribute("aria-expanded", String(expanded));
  if (!expanded) body.classList.add("perso-body--collapsed");

  btn.addEventListener("click", () => {
    const isExpanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!isExpanded));
    body.classList.toggle("perso-body--collapsed", isExpanded);
    localStorage.setItem("persoCardExpanded", String(!isExpanded));
  });
}



/**
 * Construit la grille de sélection d'avatars dans la modale crop.
 * Les chemins sont relatifs à profile/ (../img/avatar/).
 */
function initAvatarGrid() {
  const _t = (k, fb) => {
    const r = window.i18n?.t?.(k);
    return r != null && r !== k ? r : fb;
  };
  // Libellés des groupes (noms de jeux non traduits ; "Spécial" oui).
  const GAME_LABEL = {
    persona1: "Persona 1",
    persona2: "Persona 2",
    persona3: "Persona 3",
    persona4: "Persona 4",
    persona5: "Persona 5",
    persona5x: "Persona 5X",
    special: _t("profile.avatar_group_special", "Special"),
  };
  const themeBadge = (name) => {
    const n = name.toLowerCase();
    if (n.endsWith(".gif")) return `<span class="avatar-tag avatar-tag--gif">GIF</span>`;
    if (n.includes("jazz")) return `<span class="avatar-tag avatar-tag--jazz">JAZZ</span>`;
    return "";
  };

  let html = `<div class="avatar-none" data-src="none">NONE</div>`;
  for (const grp of AVATAR_GROUPS) {
    if (!grp.avatars.length) continue;
    html +=
      `<div class="avatar-group-header avatar-group--${grp.key}">` +
      `<span>${GAME_LABEL[grp.key] ?? grp.game}</span>` +
      `<span class="avatar-group-count">${grp.avatars.length}</span></div>`;
    html +=
      `<div class="avatar-group-grid">` +
      grp.avatars
        .map(
          (name) =>
            `<div class="avatar-cell">${themeBadge(name)}` +
            `<img src="../img/avatar/${name}" data-src="../img/avatar/${name}" loading="lazy" alt="${name}" /></div>`
        )
        .join("") +
      `</div>`;
  }
  avatarGrid.innerHTML = html;

  // Clic sur une image → charger dans le canvas + marquer comme sélectionnée
  avatarGrid.querySelectorAll(".avatar-cell img").forEach((img) => {
    img.onclick = () => {
      avatarGrid.querySelectorAll("img").forEach((i) => i.classList.remove("selected"));
      img.classList.add("selected");
      selectedAvatarSrc = img.dataset.src;
      loadImageToCanvas(selectedAvatarSrc);
    };
  });

  // Option NONE → vider l'avatar
  const noneOption = avatarGrid.querySelector(".avatar-none");
  if (noneOption) {
    noneOption.onclick = () => {
      selectedAvatarSrc = "none";
      profile.avatar = "";
      pageAvatar.src = "../img/default_avatar.png";
      saveProfile();
      saveProfileToCloud({ avatar_data: null });
      closeModal("avatarCropModal");
    };
  }
}

// ─────────────────────────────────────────────────────────
// CANVAS CROP
// ─────────────────────────────────────────────────────────

let image = new Image();

/**
 * Charge une image dans le canvas de recadrage.
 * @param {string} src - URL ou chemin de l'image
 */
function loadImageToCanvas(src) {
  image.src = src;
  image.onload = () => {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    drawCanvas();
  };
}

/** Redessine le canvas avec les transformations courantes. */
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = image.width * zoom;
  const h = image.height * zoom;
  const x = canvas.width / 2 - w / 2 + offsetX;
  const y = canvas.height / 2 - h / 2 + offsetY;
  ctx.drawImage(image, x, y, w, h);
}

// Fermer la modale crop
closeCropper.onclick = () => closeModal("avatarCropModal");

// Drag sur le canvas (souris)
canvas.onmousedown = (e) => {
  dragging = true;
  startX = e.offsetX;
  startY = e.offsetY;
};
canvas.onmouseup = () => {
  dragging = false;
};
canvas.onmouseleave = () => {
  dragging = false;
};
canvas.onmousemove = (e) => {
  if (!dragging) return;
  offsetX += e.offsetX - startX;
  offsetY += e.offsetY - startY;
  startX = e.offsetX;
  startY = e.offsetY;
  drawCanvas();
};

// Drag sur le canvas (tactile)
canvas.ontouchstart = (e) => {
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  dragging = true;
  startX = t.clientX - rect.left;
  startY = t.clientY - rect.top;
};
canvas.ontouchend = () => {
  dragging = false;
};
canvas.ontouchmove = (e) => {
  if (!dragging) return;
  e.preventDefault();
  const t = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const tx = t.clientX - rect.left;
  const ty = t.clientY - rect.top;
  offsetX += tx - startX;
  offsetY += ty - startY;
  startX = tx;
  startY = ty;
  drawCanvas();
};

// Zoom
zoomInBtn.onclick = () => {
  zoom *= 1.1;
  drawCanvas();
};
zoomOutBtn.onclick = () => {
  zoom /= 1.1;
  drawCanvas();
};

// Confirmer le crop → route vers avatar ou song selon cropTarget
confirmCrop.onclick = () => {
  const result = selectedAvatarSrc.endsWith(".gif")
    ? selectedAvatarSrc
    : canvas.toDataURL("image/png");

  if (cropTarget === "song") {
    if (profile.profileSong) {
      profile.profileSong.customImage = result;
      updateSongArtwork(result);
      saveProfile();
    }
  } else {
    profile.avatar = result;
    profile.avatarSrc = selectedAvatarSrc;
    pageAvatar.src = result;
    saveProfile();
    markDirty();
    saveProfileToCloud({ avatar_data: result });
  }
  closeModal("avatarCropModal");
  cropTarget = "avatar"; // reset systématique
};

// ─────────────────────────────────────────────────────────
// EXPORT / IMPORT JSON
// ─────────────────────────────────────────────────────────

/** Exporte le profil complet en fichier JSON téléchargeable. */
exportBtn.onclick = () => {
  const exportData = {
    ...profile,
    // Jeton de liaison au compte — empêche l'import du JSON sur un autre compte
    _accountId: window._currentUser?.id ?? profile._accountId ?? null,
    _exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "personadle_profile.json";
  a.click();
  URL.revokeObjectURL(a.href);
};


// ─────────────────────────────────────────────────────────
// PARTAGE DE PROFIL
// ─────────────────────────────────────────────────────────

// (voir ./share-card.js — setupShareProfile, setupCopyProfileLink,
// attachPreviewClicksToImages, refreshShareCardPreview)

// ─────────────────────────────────────────────────────────
// PROFILE SONG — Sélecteur + mini-lecteur dans le panneau gauche
// ─────────────────────────────────────────────────────────

// (voir ./song-player.js — getSortedSongGroups, renderSongCard, selectProfileSong,
// setupSongPicker, stopProfileSong, updateSongArtwork)

// ─────────────────────────────────────────────────────────
// INITIALISATION GLOBALE
// ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // En mode consultation (?view=CODE ou ?uid=ID), profile-view.js gère tout.
  const _q = new URLSearchParams(window.location.search);
  if (_q.get("view") || _q.get("uid")) return;

  // 1. Charger le profil et initialiser l'UI
  initProfile();
  renderModeStats();

  // 1b. Sync complet cloud → local (le backend est la source de vérité).
  // Chaîne : pull → apply UI → re-init titres avec session valide → sync badges local→back.
  // Dual approach : immédiat si auth déjà résolue, sinon event listener.
  const _fullCloudSync = async () => {
    if (!window._currentUser?.id) return;
    try {
      await pullProfileFromCloud();
      _applyCloudToUI();
      // Re-fetcher /api/titles avec session valide → is_unlocked correct par user
      await initTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty);
      // Pousser les badges locaux manquants vers le backend (local → cloud)
      await syncBadgesWithBackend(profile, saveProfileAndSyncBadges);
    } catch (_) {}
    window._onLangChange = pushLangToCloud;
  };
  if (window._authResolved) {
    _fullCloudSync();
  } else {
    window.addEventListener("personadle:auth-ready", _fullCloudSync, { once: true });
  }

  // Ré-sync complet au login/register (sans rechargement de page)
  window.addEventListener("personadle:auth-login", () => _fullCloudSync());

  // Reset profil au logout (sans rechargement de page)
  window.addEventListener("personadle:auth-logout", () => {
    // Arrêter la musique si elle joue
    stopProfileSong();
    // localStorage déjà vidé par auth.js — initProfile() crée un profil vierge
    initProfile();
    renderThemePicker();
    renderModeStats();
    renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty);
    renderUnlockableWallpaperGallery(profile);
    renderBadgesPreview(profile);
    renderBadgesModal(profile, saveProfileAndSyncBadges);
    resetTitlesUnlockedState();
    renderTitlesSection(profile, saveProfile, saveProfileToCloud, markDirty);
  });

  // Sync périodique toutes les 3 min + à chaque retour sur l'onglet (pull + apply seulement)
  const _periodicSync = () => {
    if (!window._currentUser?.id) return;
    pullProfileFromCloud()
      .then(_applyCloudToUI)
      .catch(() => {});
  };
  setInterval(_periodicSync, 3 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") _periodicSync();
  });

  // Callback appelé par cloud-sync.js après chaque pull périodique
  window._onCloudSync = () => _applyCloudToUI();

  renderThemePicker();
  setupPersoCard();
  initAvatarGrid();
  setupShareProfile(profile, saveProfile);
  setupCopyProfileLink();
  setupSongPicker(profile, saveProfile, saveProfileToCloud, markDirty);

  // 2. Système de badges
  initBadgesSystem(profile, saveProfileAndSyncBadges);

  // 2b. Wallpapers débloquables + Titres
  // _bindTitlesModal() : rendu immédiat depuis localStorage (avant auth/cloud)
  // initTitlesSection() : appelé dans _fullCloudSync après auth → is_unlocked correct depuis l'API
  initUnlockableWallpapers(profile, saveProfile).catch(() => {});
  _bindTitlesModal(profile, saveProfile, saveProfileToCloud, markDirty);

  // 3. Auth — initAuth() est appelé depuis profile.html (bloc <script type="module">)
  //    setupAuth() supprimé : redondant et en conflit avec initAuth() de js/auth.js

  // 4. Re-render stats + badges à chaque changement de langue (et au chargement initial)
  //    Listener permanent : capte init + chaque setLang() depuis le sélecteur
  window.addEventListener("personadle:i18n-ready", () => {
    renderStats();
    renderBadgesModal(profile, saveProfileAndSyncBadges);
  });

  // Race-condition : si initLang() s'est terminé avant ce listener, l'event est déjà parti
  if (window.i18nIsReady) {
    renderStats();
    renderBadgesModal(profile, saveProfileAndSyncBadges);
  }
});

// Attacher les handlers de zoom badges après leur rendu
window.addEventListener("badgesRendered", () => {
  attachPreviewClicksToImages();
});

// ═══════════════════════════════════════════════════════════════════════════
// 🖼️ WALLPAPERS DÉBLOQUABLES
// ═══════════════════════════════════════════════════════════════════════════

// (voir ./wallpapers-ui.js — UNLOCKABLE_WALLPAPERS, renderUnlockableWallpaperGallery,
// checkAndUnlockWallpapers, showWallpaperNotification, initUnlockableWallpapers)


// ═══════════════════════════════════════════════════════════════════════════
// 🎴 TITRES VISUELS (CALLING CARDS)
// ═══════════════════════════════════════════════════════════════════════════

// (voir ./titles-ui.js — TITLES_LOCAL, isTitleConditionMet, titleConditionText,
// renderTitlesSection, initTitlesSection, _bindTitlesModal, getEquippedTitle,
// resetTitlesUnlockedState, refreshTitlesAfterCloudSync)
