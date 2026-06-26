/**
 * profile-page.js — Logique de la page de profil dédiée
 * ─────────────────────────────────────────────────────────
 * Adapté depuis profile/profile.js pour fonctionner sur
 * profile/profile.html (page autonome, pas une modale).
 *
 * Différences clés vs profile.js :
 *   - Chemins images : ../img/ au lieu de ./img/
 *   - Éléments DOM : pageAvatar, pageUsername (page) au lieu de headerAvatar, headerPseudo (modale)
 *   - Pas de logique d'ouverture/fermeture de modale profil
 *   - normalizeAvatarPath() pour la compatibilité avec les profils existants (./img/...)
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
import { pullProfileFromCloud, pushLangToCloud } from "../js/cloud-sync.js";
import { formatPlayTime } from "./formatPlayTime.js";
import { AVATAR_GROUPS } from "./avatars_data.js";

// Exposer les songs pour d'autres modules (notifications.js, social-link.js…)
window._profileSongs = ALL_SONGS;

// ─────────────────────────────────────────────────────────
// THÈMES UI
// ─────────────────────────────────────────────────────────

/**
 * Définitions des thèmes de couleur de l'interface.
 * Les valeurs sont appliquées via les CSS variables --accent, --accent-hover,
 * --accent-light et --accent-rgb sur document.documentElement.
 */
const THEMES = [
  // ── Persona 5 ──────────────────────────────────────────
  {
    id: "all_out",
    accent: "#E63946",
    hover: "#C1121F",
    light: "#FF9999",
    rgb: "230, 57, 70",
    label: "All-Out Attack",
  },
  // ── Velvet Room (bleu nuit d'Igor) ─────────────────────
  {
    id: "velvet_room",
    accent: "#1B3A8A",
    hover: "#162E72",
    light: "#60A5FA",
    rgb: "27, 58, 138",
    label: "Velvet Room",
  },
  // ── Persona 3 (Dark Hour / Tartarus) ───────────────────
  {
    id: "dark_hour",
    accent: "#00B4D8",
    hover: "#0077B6",
    light: "#48CAE4",
    rgb: "0, 180, 216",
    label: "Dark Hour",
  },
  // ── Persona 3 Portable (FeMC, rose doux) ───────────────
  {
    id: "pink_ribbon",
    accent: "#E8739A",
    hover: "#D0507A",
    light: "#F9A8D4",
    rgb: "232, 115, 154",
    label: "Pink Ribbon",
  },
  // ── Persona 4 (Midnight Channel, or TV World) ──────────
  {
    id: "midnight_channel",
    accent: "#EAB308",
    hover: "#CA8A04",
    light: "#FEF08A",
    rgb: "234, 179, 8",
    label: "Midnight Channel",
  },
  // ── Persona 1 (violet mystique, Demon Palace) ──────────
  {
    id: "demon_palace",
    accent: "#9333EA",
    hover: "#7E22CE",
    light: "#D8B4FE",
    rgb: "147, 51, 234",
    label: "Demon Palace",
  },
  // ── Persona 2 EP (Eternal Punishment, indigo) ──────────
  {
    id: "eternal_punishment",
    accent: "#4F46E5",
    hover: "#4338CA",
    light: "#A5B4FC",
    rgb: "79, 70, 229",
    label: "Eternal Punishment",
  },
  // ── Persona Q (labyrinthe doré, orange vif) ────────────
  {
    id: "golden_labyrinth",
    accent: "#F97316",
    hover: "#EA6C12",
    light: "#FDBA74",
    rgb: "249, 115, 22",
    label: "Golden Labyrinth",
  },
  // ── Couleur libre ──────────────────────────────────────
  { id: "custom", accent: null, hover: null, light: null, rgb: null, label: null },
];

/** Convertit un hex en "r, g, b" pour rgba(). */
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "0, 0, 0";
}

/** Éclaircit ou assombrit une couleur hex d'un delta (-255 → 255). */
function adjustHex(hex, delta) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + delta));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + delta));
  const b = Math.min(255, Math.max(0, (n & 0xff) + delta));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

/**
 * Applique un thème en injectant les variables CSS sur <html>.
 * @param {string} themeId  - ID du thème (voir THEMES)
 * @param {string} [customColor] - Couleur hex si themeId === 'custom'
 */
function applyTheme(themeId, customColor) {
  const root = document.documentElement;
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) return;

  let accent, hover, light, rgb;

  if (themeId === "custom" && customColor) {
    accent = customColor;
    hover = adjustHex(customColor, -35);
    light = adjustHex(customColor, 45);
    rgb = hexToRgb(customColor);
  } else if (theme.accent) {
    ({ accent, hover, light, rgb } = theme);
  } else {
    return; // custom sans couleur définie
  }

  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-hover", hover);
  root.style.setProperty("--accent-light", light);
  root.style.setProperty("--accent-rgb", rgb);
}

/**
 * Construit et injecte le sélecteur de thèmes dans #themeSwatches.
 * À rappeler après chaque changement pour mettre à jour l'état actif.
 */
function renderThemePicker() {
  const container = document.getElementById("themeSwatches");
  if (!container) return;

  const i = window.i18n || { t: (k) => k };
  const currentId = profile.profileTheme || "all_out";
  const customLabel = i.t("profile.theme_custom") || "Custom color";

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
      markDirty();
      const wid = id === "custom" ? `custom:${profile.profileCustomColor || "#e63946"}` : id;
      saveProfileToCloud({ wallpaper_id: wid });

      // Régénère la preview de partage si la modale est ouverte
      const shareModal = document.getElementById("sharePreviewModal");
      if (shareModal && !shareModal.classList.contains("hidden") && _regenerateSharePreview) {
        _regenerateSharePreview();
      }
    });
  });

  // Handler couleur custom
  document.getElementById("customThemeColor")?.addEventListener("input", (e) => {
    profile.profileCustomColor = e.target.value;
    applyTheme("custom", e.target.value);
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
let _regenerateSharePreview = null; // Référence levée à generatePreview() dans setupShareProfile()
let profileSongAudio = null; // Élément <audio> du profile song

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
const cropModal = document.getElementById("avatarCropModal");
const closeCropper = document.getElementById("closeCropper");
const avatarGrid = document.getElementById("avatarGrid");
const canvas = document.getElementById("avatarCanvas");
const ctx = canvas.getContext("2d");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const confirmCrop = document.getElementById("confirmCrop");

// ─────────────────────────────────────────────────────────
// UTILITAIRE : NORMALISATION DES CHEMINS D'AVATAR
// ─────────────────────────────────────────────────────────

/**
 * Normalise un chemin d'avatar pour fonctionner depuis profile/.
 * Convertit les anciens chemins ./img/... en ../img/...
 * Les data URLs (base64) passent sans modification.
 *
 * @param {string|null} avatarPath - Chemin stocké dans localStorage
 * @returns {string} Chemin résolu depuis profile/
 */
function normalizeAvatarPath(avatarPath) {
  if (!avatarPath) return "../img/default_avatar.png";
  // Data URL base64 — toujours valide, aucun ajustement nécessaire
  if (avatarPath.startsWith("data:")) return avatarPath;
  // Chemins déjà absolus ou root-relatifs
  if (avatarPath.startsWith("/") || avatarPath.startsWith("http")) return avatarPath;
  // Anciens chemins stockés depuis index.html (./img/...) → corriger pour profile/
  return avatarPath.replace(/^\.\/img\//, "../img/");
}

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
  renderSongCard?.();

  // ── Badges ────────────────────────────────────────────────
  renderBadgesPreview(profile);
  renderBadgesModal(profile, saveProfileAndSyncBadges);

  // ── Wallpapers débloquables ───────────────────────────────
  // Re-render la galerie avec l'état cloud (unlockedWallpapers mis à jour par pullProfileFromCloud)
  renderUnlockableWallpaperGallery(profile);

  // ── Titres ────────────────────────────────────────────────
  _refreshTitlesUnlockState();
  _resolveEquippedTitle();
  renderTitlesSection?.();

  // Vérifier si de nouveaux titres ont été débloqués (fire-and-forget)
  checkAndUnlockTitles?.().catch(() => {});
}

// ─────────────────────────────────────────────────────────
// AFFICHAGE DES STATISTIQUES
// ─────────────────────────────────────────────────────────

/**
 * Retourne le tier visuel du streak (0-5).
 * 0 = aucun, 1 = 1-2j, 2 = 3-6j, 3 = 7-13j, 4 = 14-29j, 5 = 30j+
 */
function getStreakTier(streak) {
  if (streak >= 30) return 5;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

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
  cropModal.classList.remove("hidden");
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
  const i = window.i18n || { t: (k) => k };
  if (confirm(i.t("profile.reset_confirm") || "Reset your profile? This cannot be undone.")) {
    localStorage.removeItem("personaUserProfile");
    location.reload();
  }
};

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

// Changement de couleur de bordure
borderColorPicker.oninput = (e) => {
  profile.avatarBorderColor = e.target.value;
  pageAvatar.style.borderColor = profile.avatarBorderColor;
  updateBorderPreview(e.target.value);
  saveProfile();
  markDirty();
  // Régénère la preview de partage si la modale est ouverte
  const shareModal = document.getElementById("sharePreviewModal");
  if (shareModal && !shareModal.classList.contains("hidden") && _regenerateSharePreview) {
    _regenerateSharePreview();
  }
};
// onchange = fin du glissement → envoie la couleur finale au cloud (évite spam API)
borderColorPicker.onchange = (e) => {
  saveProfileToCloud({ avatar_border_color: e.target.value });
};

/**
 * Met à jour le dot de prévisualisation et la valeur hex
 * dans le chip couleur de la perso-card.
 * @param {string} color - Valeur hex (ex. "#1a2b3c")
 */
function updateBorderPreview(color) {
  const dot = document.getElementById("borderColorDot");
  const hex = document.getElementById("borderColorHex");
  if (dot) dot.style.background = color;
  if (hex) hex.textContent = color.toUpperCase();
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
      cropModal.classList.add("hidden");
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
closeCropper.onclick = () => cropModal.classList.add("hidden");

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
    pageAvatar.src = result;
    saveProfile();
    markDirty();
    saveProfileToCloud({ avatar_data: result });
  }
  cropModal.classList.add("hidden");
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

/** Arrière-plans disponibles pour la carte de partage */
const shareBackgrounds = [
  {
    id: "velvet_room",
    name: "Velvet Room",
    gradient: "linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #7e22ce 100%)",
    pattern: "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 0%, transparent 50%)",
  },
  {
    id: "persona_red",
    name: "Persona Red",
    gradient: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
    pattern:
      "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)",
  },
  {
    id: "dark_hour",
    name: "Dark Hour",
    gradient: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    pattern: "radial-gradient(circle at 80% 20%, rgba(46,204,113,0.1) 0%, transparent 50%)",
  },
  {
    id: "golden",
    name: "Golden",
    gradient: "linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)",
    pattern: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)",
  },
  {
    id: "phantom_thief",
    name: "Phantom Thief",
    gradient: "linear-gradient(135deg, #000000 0%, #434343 50%, #e74c3c 100%)",
    pattern:
      "repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(231,76,60,0.1) 20px, rgba(231,76,60,0.1) 40px)",
  },
  {
    id: "midnight_blue",
    name: "Midnight Blue",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    pattern: "radial-gradient(circle at 30% 70%, rgba(255,255,255,0.08) 0%, transparent 50%)",
  },
  {
    id: "metaverse",
    name: "Metaverse",
    gradient: "linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)",
    pattern:
      "repeating-linear-gradient(0deg, transparent, transparent 15px, rgba(255,255,255,0.05) 15px, rgba(255,255,255,0.05) 30px)",
  },
  {
    id: "sunset",
    name: "Sunset",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    pattern: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)",
  },
];

/** Papiers peints disponibles (organisés par jeu) */
const shareWallpapers = {
  none: [{ id: "none", name: "None", src: null }],
  persona1: [
    { id: "p1_prota", name: "Protagonist", src: "../profile/Wallpaper/P1_Prota_Wallpaper.png" },
    { id: "p1_naoya", name: "Naoya Toudou", src: "../profile/Wallpaper/P1_Naoya.jpeg" },
    {
      id: "p1_maki",
      name: "Maki & Butterflies",
      src: "../profile/Wallpaper/P1_Maki_Butterflies.jpg",
    },
    { id: "p1_cast", name: "Full Cast", src: "../profile/Wallpaper/P1_Cast.jpeg" },
  ],
  persona2: [
    { id: "p2_tatsuya", name: "Tatsuya Suou (IS)", src: "../profile/Wallpaper/P2_Tatsuya_IS.jpeg" },
    { id: "p2_maya", name: "Maya Amano (EP)", src: "../profile/Wallpaper/Persona_2_EP_maya.png" },
    { id: "p2_joker", name: "Joker", src: "../profile/Wallpaper/p2_Joker.jpg" },
    {
      id: "p2_prota_legacy",
      name: "Protagonists (Legacy)",
      src: "../profile/Wallpaper/P2_Prota_Wallpaper.png",
    },
  ],
  persona3: [
    { id: "p3_tartarus", name: "Tartarus", src: "../profile/Wallpaper/P3_Tartarus_Wallpaper.png" },
    {
      id: "p3_water",
      name: "The Answer — Water",
      src: "../profile/Wallpaper/P3_Water_Wallapaper.png",
    },
    {
      id: "p3_portable",
      name: "Portable Edition",
      src: "../profile/Wallpaper/Persona_3_portable.jpeg",
    },
    {
      id: "p3p_dual",
      name: "Dual Protagonists",
      src: "../profile/Wallpaper/P3P_Makoto_&_Kotone.jpg",
    },
    {
      id: "p3_kotone_makoto",
      name: "Kotone & Makoto",
      src: "../profile/Wallpaper/Kotone_&_makoto.jpg",
    },
    {
      id: "p3_aigis_makoto",
      name: "Aigis & Makoto",
      src: "../profile/Wallpaper/Aigis_&_makoto.jpg",
    },
    {
      id: "p3_train",
      name: "Makoto & Aigis Train",
      src: "../profile/Wallpaper/P3_Makoto_Aigis_Train.jpeg",
    },
  ],
  persona4: [
    { id: "p4_golden", name: "Golden Edition", src: "../profile/Wallpaper/P4_Golden_Style.jpg" },
    { id: "p4_tv", name: "TV World", src: "../profile/Wallpaper/P4_TV_World_Wallpaper.png" },
    { id: "p4_izanagi", name: "Izanagi", src: "../profile/Wallpaper/P4G_Izanagi.jpg" },
    { id: "p4_yu", name: "Yu Narukami", src: "../profile/Wallpaper/Yu_Narukami.jpg" },
    { id: "p4_friends", name: "Friends Group", src: "../profile/Wallpaper/Friends_groupe.jpg" },
    {
      id: "p4_team",
      name: "Investigation Team",
      src: "../profile/Wallpaper/Investigation_Team.jpg",
    },
    {
      id: "p4_team_golden",
      name: "Investigation Team Golden",
      src: "../profile/Wallpaper/Investigation_Team_Golden.jpg",
    },
    {
      id: "p4_shadow_teddie",
      name: "Shadow Teddie",
      src: "../profile/Wallpaper/Shadow_Teddie_Shadow_World.jpg",
    },
  ],
  persona5: [
    {
      id: "p5_clinic",
      name: "Takemi Clinic",
      src: "../profile/Wallpaper/P5_Clinique_Wallpaper.png",
    },
    {
      id: "p5_clinic_tae",
      name: "Takemi Clinic (with Tae)",
      src: "../profile/Wallpaper/P5_Clinique_vTae_Wallpaper.png",
    },
    { id: "p5_mementos", name: "Mementos", src: "../profile/Wallpaper/P5_Memento_Wallpaper.png" },
    {
      id: "p5_leblanc",
      name: "Café Leblanc",
      src: "../profile/Wallpaper/P5_Leblanc_Cafe_Wallapaper.png",
    },
    {
      id: "p5_phantom",
      name: "Phantom Thieves",
      src: "../profile/Wallpaper/P5_Phantom_Thieves_Wallpaper.png",
    },
    {
      id: "p5_sophia",
      name: "Sophia (Strikers)",
      src: "../profile/Wallpaper/Sophia_wallpaper.jpeg",
    },
  ],
  personaq: [
    { id: "pq_three", name: "Three Protagonists", src: "../profile/Wallpaper/Pq_3_prota.png" },
    { id: "pq2", name: "Persona Q2", src: "../profile/Wallpaper/PQ2.jpg" },
  ],
  other: [
    {
      id: "p3_three_prota",
      name: "Three Protagonists",
      src: "../profile/Wallpaper/3_protagonist.jpeg",
    },
    {
      id: "velvet_room",
      name: "Velvet Room",
      src: "../profile/Wallpaper/Velvet_Room_Wallpaper.png",
    },
    { id: "jack_frost", name: "Jack Frost", src: "../profile/Wallpaper/Jack_frost.jpeg" },
    { id: "black_frost", name: "Black Frost", src: "../profile/Wallpaper/Black_frost.jpeg" },
    {
      id: "christmas",
      name: "Christmas Special",
      src: "../profile/Wallpaper/Christmas_Wallpaper.png",
    },
    { id: "cny", name: "Chinese New Year", src: "../profile/Wallpaper/Wallpaper_chinesse.webp" },
  ],
};

const wallpaperCategories = [
  { id: "none", name: "❌ None" },
  { id: "persona1", name: "🔮 Persona 1" },
  { id: "persona2", name: "🌹 Persona 2" },
  { id: "persona3", name: "🌙 Persona 3" },
  { id: "persona4", name: "📺 Persona 4" },
  { id: "persona5", name: "🎭 Persona 5" },
  { id: "personaq", name: "🗺️ Persona Q" },
  { id: "other", name: "✨ Extras" },
];

// ─────────────────────────────────────────────────────────
// DIMENSIONS DE LA CARTE DE PARTAGE — format 9:16 portrait téléphone
// ─────────────────────────────────────────────────────────
const CARD_W = 390;
const CARD_H = 693; // 390 × (16/9) ≈ 693

/** Options de police disponibles dans le style du texte de partage. */
const TEXT_FONTS = [
  { id: "arial", name: "Arial", value: "Arial, sans-serif" },
  { id: "arialblk", name: "Arial Black", value: '"Arial Black", Impact, sans-serif' },
  { id: "impact", name: "Impact", value: 'Impact, "Arial Black", sans-serif' },
  { id: "georgia", name: "Georgia", value: "Georgia, serif" },
  { id: "courier", name: "Courier", value: '"Courier New", Courier, monospace' },
  { id: "persona5", name: "Persona 5", value: 'Persona5, "Arial Black", sans-serif' },
];

/** Preset couleurs de texte + blanc par défaut. */
const TEXT_COLOR_PRESETS = [
  { id: "white", value: "#ffffff", label: "White" },
  { id: "gold", value: "#ffd700", label: "Gold" },
  { id: "red", value: "#ff4444", label: "Red" },
  { id: "cyan", value: "#4ecdc4", label: "Cyan" },
  { id: "black", value: "#111111", label: "Black" },
  { id: "custom", value: null, label: "Custom" },
];

/** Tailles de texte disponibles (multiplicateur appliqué aux em de base). */
const TEXT_SIZES = [
  { id: "small", label: "S", scale: 0.78 },
  { id: "medium", label: "M", scale: 1.0 },
  { id: "large", label: "L", scale: 1.25 },
  { id: "xl", label: "XL", scale: 1.55 },
];

/**
 * Construit l'élément carte HTML au format 9:16 portrait.
 * Retourne l'élément DOM (non encore inséré dans le document).
 *
 * @param {Object} bg - Arrière-plan couleur sélectionné
 * @param {Object|null} wallpaper - Wallpaper sélectionné (ou null)
 * @param {string} activeTab - 'color' | 'wallpaper'
 * @param {{ font: string, color: string, scale: number }} [textStyle] - Style texte optionnel
 * @returns {HTMLElement}
 */
function buildShareCard(bg, wallpaper, activeTab, textStyle, titleOptions = {}) {
  const txtFont = textStyle?.font || "Arial, sans-serif";
  const txtColor = textStyle?.color || "#ffffff";
  const txtScale = textStyle?.scale ?? 1;
  const selectedBadges = getBadgesForShare(profile);
  const avatarForShare = normalizeAvatarPath(profile.avatar);
  const wallpaperActive = activeTab === "wallpaper" && wallpaper?.src;

  // ── Conteneur carte (9:16 portrait) ──
  const card = document.createElement("div");
  card.id = "shareCard";
  card.style.cssText = `
    width:${CARD_W}px; height:${CARD_H}px;
    border-radius:20px; overflow:hidden;
    background:${bg.gradient};
    color:${txtColor}; text-align:center;
    box-sizing:border-box; position:relative;
    font-family:${txtFont};
    flex-shrink:0;
  `;

  // ── Fond (wallpaper ou couleur) ──
  if (wallpaperActive) {
    if (wallpaper.src.endsWith(".gif")) {
      // GIF : utiliser <img> (les CSS background ne jouent pas les GIFs dans html2canvas)
      const wpImg = document.createElement("img");
      wpImg.src = wallpaper.src;
      wpImg.crossOrigin = "anonymous";
      wpImg.style.cssText = `
        position:absolute;top:0;left:0;width:100%;height:100%;
        object-fit:cover;pointer-events:none;
      `;
      card.appendChild(wpImg);
    } else {
      const wpDiv = document.createElement("div");
      wpDiv.style.cssText = `
        position:absolute;top:0;left:0;right:0;bottom:0;
        background:url('${wallpaper.src}') center/cover no-repeat;
        pointer-events:none;
      `;
      card.appendChild(wpDiv);
    }

    // Overlay sombre pour la lisibilité
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:absolute;top:0;left:0;right:0;bottom:0;
      background:linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,rgba(0,0,0,0.65) 100%);
      pointer-events:none;
    `;
    card.appendChild(overlay);
  } else {
    // Pattern décoratif sur fond couleur
    const pattern = document.createElement("div");
    pattern.style.cssText = `
      position:absolute;top:0;left:0;right:0;bottom:0;
      background:${bg.pattern};pointer-events:none;
    `;
    card.appendChild(pattern);
  }

  // ── Contenu (au-dessus du fond) ──
  const content = document.createElement("div");
  content.style.cssText = `
    position:relative;z-index:1;
    display:flex;flex-direction:column;align-items:center;
    height:100%;padding:32px 20px 24px;box-sizing:border-box;
  `;

  const s = txtScale;
  content.innerHTML = `
    <!-- Titre -->
    <div style="margin-bottom:20px;">
      <p style="margin:0;font-size:${(0.75 * s).toFixed(2)}em;letter-spacing:0.2em;text-transform:uppercase;
                color:${txtColor};opacity:0.8;text-shadow:1px 1px 3px rgba(0,0,0,0.8);">PersonaDLE</p>
      <h2 style="margin:4px 0 0;font-size:${(1.5 * s).toFixed(2)}em;font-weight:900;letter-spacing:0.08em;
                 color:${txtColor};text-shadow:2px 2px 6px rgba(0,0,0,0.8);">PROFILE</h2>
      <div style="width:40px;height:3px;background:#e63946;margin:8px auto 0;border-radius:2px;"></div>
    </div>

    <!-- Avatar -->
    <div style="margin:8px 0 16px;">
      <img src="${avatarForShare}" alt="Avatar" crossorigin="anonymous"
           style="width:140px;height:140px;border-radius:50%;
                  border:4px solid ${profile.avatarBorderColor || "#ffd700"};
                  box-shadow:0 6px 20px rgba(0,0,0,0.7);
                  object-fit:cover;">
    </div>

    <!-- Pseudo -->
    <h3 style="margin:0 0 4px;font-size:${(1.6 * s).toFixed(2)}em;font-weight:900;
               color:${txtColor};text-shadow:2px 2px 6px rgba(0,0,0,0.8);
               max-width:340px;word-break:break-word;">
      ${profile.pseudo || "Guest Player"}
    </h3>
    ${(() => {
      if (titleOptions.include === false) return "";
      const eq =
        typeof _titlesData !== "undefined" && _titlesData
          ? _titlesData.find(
              (t) =>
                (profile.equippedTitleId && t.id && t.id === profile.equippedTitleId) ||
                (profile.equippedTitleSlug && t.slug === profile.equippedTitleSlug)
            )
          : null;
      if (!eq) return "";
      const _prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
      const imgSrc = `${_prefix}/profile/${eq.image_path || `titles/${eq.slug}.webp`}`;
      const szMap = { small: 150, medium: 220, large: 300 };
      const w = szMap[titleOptions.size] || 220;
      return `<img src="${imgSrc}" alt="${eq.name}" crossorigin="anonymous"
        style="width:${w}px;border-radius:8px;display:block;margin:0 auto 14px;
               box-shadow:0 3px 14px rgba(0,0,0,0.6);">`;
    })()}

    <!-- Stats row -->
    <div style="display:flex;justify-content:space-around;align-items:center;
                width:100%;max-width:340px;
                background:rgba(0,0,0,0.5);
                padding:14px 8px;border-radius:14px;
                backdrop-filter:blur(6px);
                margin-bottom:20px;">
      <div style="text-align:center;flex:1;">
        <div style="font-size:${(2 * s).toFixed(2)}em;font-weight:900;color:#ffd700;
                    text-shadow:2px 2px 4px rgba(0,0,0,0.8);">${profile.stats?.wins || 0}</div>
        <div style="font-size:${(0.72 * s).toFixed(2)}em;opacity:0.85;margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;color:${txtColor};">Wins</div>
      </div>
      <div style="width:1px;height:36px;background:rgba(255,255,255,0.25);"></div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:${(2 * s).toFixed(2)}em;font-weight:900;color:#ff6b6b;
                    text-shadow:2px 2px 4px rgba(0,0,0,0.8);">${profile.stats?.streakRecord || 0}</div>
        <div style="font-size:${(0.72 * s).toFixed(2)}em;opacity:0.85;margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;color:${txtColor};">Best Streak</div>
      </div>
      <div style="width:1px;height:36px;background:rgba(255,255,255,0.25);"></div>
      <div style="text-align:center;flex:1;">
        <div style="font-size:${(2 * s).toFixed(2)}em;font-weight:900;color:#4ecdc4;
                    text-shadow:2px 2px 4px rgba(0,0,0,0.8);">${profile.badges?.length || 0}</div>
        <div style="font-size:${(0.72 * s).toFixed(2)}em;opacity:0.85;margin-top:3px;letter-spacing:0.06em;text-transform:uppercase;color:${txtColor};">Badges</div>
      </div>
    </div>

    <!-- Badges sélectionnés -->
    ${
      selectedBadges.length > 0
        ? `
      <div style="margin-bottom:16px;width:100%;">
        <p style="margin:0 0 10px;font-size:0.8em;opacity:0.85;
                  color:${txtColor};text-transform:uppercase;letter-spacing:0.1em;">🏅 Featured</p>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
          ${selectedBadges
            .map(
              (b) => `
            <div style="text-align:center;">
              <img src="${b.img}" alt="${b.name}" crossorigin="anonymous"
                   style="width:65px;height:65px;border-radius:10px;
                          border:3px solid #ffd700;
                          box-shadow:0 4px 10px rgba(0,0,0,0.6);">
              <p style="margin:5px 0 0;font-size:0.62em;opacity:0.9;color:${txtColor};
                         max-width:70px;word-break:break-word;">${b.name}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
        : '<div style="flex:1;"></div>'
    }

    <!-- Spacer flex -->
    <div style="flex:1;min-height:8px;"></div>

    <!-- Footer -->
    <div style="padding-top:12px;border-top:1px solid rgba(255,255,255,0.2);
                font-size:0.75em;opacity:0.65;letter-spacing:0.06em;color:${txtColor};">
      <strong>personadle.net</strong> &nbsp;•&nbsp; ${new Date().getFullYear()}
    </div>
  `;

  card.appendChild(content);
  return card;
}

/**
 * Configure la modale de partage de profil.
 * Gère la sélection de fond, la génération canvas (PNG) et GIF animé.
 */
function setupShareProfile() {
  const btn = document.getElementById("shareProfileBtn");
  const modal = document.getElementById("sharePreviewModal");
  const closeBtn = document.getElementById("closeSharePreview");
  const area = document.getElementById("sharePreviewArea");
  const downloadBtn = document.getElementById("downloadProfileBtn");
  const twitterBtn = document.getElementById("shareTwitterBtn");
  const discordBtn = document.getElementById("shareDiscordBtn");
  const emailBtn = document.getElementById("shareEmailBtn");
  const bgSelector = document.getElementById("backgroundSelector");

  if (!btn || !modal) return;

  let selectedBg = localStorage.getItem("profileShareBg") || "velvet_room";
  let selectedWallpaperCategory = localStorage.getItem("profileShareWallpaperCat") || "none";
  let selectedWallpaper = localStorage.getItem("profileShareWallpaper") || "none";
  let selectedFont = "arial";
  let selectedColor = localStorage.getItem("profileShareColor") || "#ffffff";
  let selectedSize = localStorage.getItem("profileShareSize") || "medium";
  let titleIncluded = localStorage.getItem("profileShareTitleInclude") !== "false";
  let titleSize = localStorage.getItem("profileShareTitleSize") || "medium";
  let activeTab = "color";
  let currentCard = null;

  // ── Sélecteur de fond ──
  if (bgSelector) {
    bgSelector.innerHTML = `
      <div class="share-tab-row">
        <button id="tabColor" class="share-tab active">🎨 Color</button>
        <button id="tabWallpaper" class="share-tab">🖼️ Wallpaper</button>
      </div>
      <div id="colorSelector" class="share-panel active">
        <div class="share-selector-row">
          <label>Background</label>
          <select id="bgSelect" class="share-select">
            ${shareBackgrounds.map((bg) => `<option value="${bg.id}" ${bg.id === selectedBg ? "selected" : ""}>${bg.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="wallpaperSelector" class="share-panel">
        <div class="share-selector-row">
          <label>Category</label>
          <select id="wallpaperCategorySelect" class="share-select">
            ${wallpaperCategories.map((cat) => `<option value="${cat.id}" ${cat.id === selectedWallpaperCategory ? "selected" : ""}>${cat.name}</option>`).join("")}
          </select>
        </div>
        <div class="share-selector-row">
          <label>Wallpaper</label>
          <select id="wallpaperSelect" class="share-select"></select>
        </div>
      </div>

      <!-- ── Séparateur style texte ── -->
      <div class="share-text-divider">✏️ Text style</div>
      <div class="share-text-style">
        <div class="share-selector-row">
          <label>Font</label>
          <select id="textFontSelect" class="share-select">
            ${TEXT_FONTS.map((f) => `<option value="${f.id}" ${f.id === selectedFont ? "selected" : ""}>${f.name}</option>`).join("")}
          </select>
        </div>
        <div class="share-selector-row">
          <label>Color</label>
          <div class="share-color-row">
            ${TEXT_COLOR_PRESETS.filter((p) => p.id !== "custom")
              .map(
                (p) => `
              <button class="share-color-swatch ${selectedColor === p.value ? "active" : ""}"
                      data-color="${p.value}" title="${p.label}"
                      style="background:${p.value};"></button>
            `
              )
              .join("")}
            <input type="color" id="textColorPicker" value="${selectedColor}"
                   title="Custom color" class="share-color-picker">
          </div>
        </div>
        <div class="share-selector-row">
          <label>Size</label>
          <div class="share-size-row">
            ${TEXT_SIZES.map(
              (sz) => `
              <button class="share-size-btn ${selectedSize === sz.id ? "active" : ""}"
                      data-size="${sz.id}">${sz.label}</button>
            `
            ).join("")}
          </div>
        </div>
      </div>

      <!-- ── Section Titre visuel ── -->
      <div class="share-text-divider">🏅 Title card</div>
      <div class="share-text-style">
        <div class="share-selector-row">
          <label>Show title</label>
          <label class="share-toggle">
            <input type="checkbox" id="titleIncludeToggle" ${titleIncluded ? "checked" : ""}>
            <span class="share-toggle-slider"></span>
          </label>
        </div>
        <div class="share-selector-row" id="titleSizeRow" style="${titleIncluded ? "" : "opacity:.4;pointer-events:none;"}">
          <label>Size</label>
          <div class="share-size-row">
            <button class="share-size-btn ${titleSize === "small" ? "active" : ""}" data-title-size="small">S</button>
            <button class="share-size-btn ${titleSize === "medium" ? "active" : ""}" data-title-size="medium">M</button>
            <button class="share-size-btn ${titleSize === "large" ? "active" : ""}" data-title-size="large">L</button>
          </div>
        </div>
      </div>
    `;

    const tabColor = document.getElementById("tabColor");
    const tabWallpaper = document.getElementById("tabWallpaper");
    const colorSelector = document.getElementById("colorSelector");
    const wallpaperSelector = document.getElementById("wallpaperSelector");
    const wallpaperCatSel = document.getElementById("wallpaperCategorySelect");
    const wallpaperSel = document.getElementById("wallpaperSelect");

    // Inject unlockable category if user has any unlocked wallpapers
    const _unlockedIds = new Set(
      JSON.parse(localStorage.getItem("visitedProfileIds") ? "[]" : "[]")
    );
    const _profileForWp = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
    const _unlockedWpIds = new Set(_profileForWp.unlockedWallpapers || []);
    const _unlockedWps = UNLOCKABLE_WALLPAPERS.filter((wp) => _unlockedWpIds.has(wp.id));
    if (_unlockedWps.length > 0) {
      shareWallpapers["unlockables"] = _unlockedWps;
      if (!wallpaperCategories.find((c) => c.id === "unlockables")) {
        wallpaperCategories.push({ id: "unlockables", name: "🏆 Unlockables" });
      }
      // Re-render category select to include unlockables
      wallpaperCatSel.innerHTML = wallpaperCategories
        .map(
          (cat) =>
            `<option value="${cat.id}" ${cat.id === selectedWallpaperCategory ? "selected" : ""}>${cat.name}</option>`
        )
        .join("");
    }

    function updateWallpaperList() {
      const wallpapers = shareWallpapers[wallpaperCatSel.value] || [];
      wallpaperSel.innerHTML = wallpapers
        .map(
          (wp) =>
            `<option value="${wp.id}" ${wp.id === selectedWallpaper ? "selected" : ""}>${wp.name}</option>`
        )
        .join("");
      if (!wallpapers.find((w) => w.id === selectedWallpaper)) {
        selectedWallpaper = wallpapers[0]?.id || "none";
        wallpaperSel.value = selectedWallpaper;
      }
    }

    function switchTab(tab) {
      activeTab = tab;
      tabColor.classList.toggle("active", tab === "color");
      tabWallpaper.classList.toggle("active", tab === "wallpaper");
      colorSelector.classList.toggle("active", tab === "color");
      wallpaperSelector.classList.toggle("active", tab === "wallpaper");
      if (tab === "wallpaper") updateWallpaperList();
      generatePreview();
    }

    tabColor.onclick = () => switchTab("color");
    tabWallpaper.onclick = () => switchTab("wallpaper");

    document.getElementById("bgSelect").onchange = (e) => {
      selectedBg = e.target.value;
      localStorage.setItem("profileShareBg", selectedBg);
      generatePreview();
    };

    wallpaperCatSel.onchange = (e) => {
      selectedWallpaperCategory = e.target.value;
      localStorage.setItem("profileShareWallpaperCat", selectedWallpaperCategory);
      updateWallpaperList();
      selectedWallpaper = wallpaperSel.value;
      localStorage.setItem("profileShareWallpaper", selectedWallpaper);
      generatePreview();
    };

    wallpaperSel.onchange = (e) => {
      selectedWallpaper = e.target.value;
      localStorage.setItem("profileShareWallpaper", selectedWallpaper);
      generatePreview();
    };

    updateWallpaperList();

    // ── Contrôles style texte ──
    document.getElementById("textFontSelect").onchange = (e) => {
      selectedFont = e.target.value;
      generatePreview();
    };

    bgSelector.querySelectorAll(".share-color-swatch").forEach((swatch) => {
      swatch.onclick = () => {
        selectedColor = swatch.dataset.color;
        localStorage.setItem("profileShareColor", selectedColor);
        document.getElementById("textColorPicker").value = selectedColor;
        bgSelector
          .querySelectorAll(".share-color-swatch")
          .forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");
        generatePreview();
      };
    });

    const colorPicker = document.getElementById("textColorPicker");
    colorPicker.oninput = (e) => {
      selectedColor = e.target.value;
      localStorage.setItem("profileShareColor", selectedColor);
      bgSelector
        .querySelectorAll(".share-color-swatch")
        .forEach((s) => s.classList.remove("active"));
      generatePreview();
    };

    bgSelector.querySelectorAll(".share-size-btn[data-size]").forEach((sizeBtn) => {
      sizeBtn.onclick = () => {
        selectedSize = sizeBtn.dataset.size;
        localStorage.setItem("profileShareSize", selectedSize);
        bgSelector
          .querySelectorAll(".share-size-btn[data-size]")
          .forEach((s) => s.classList.remove("active"));
        sizeBtn.classList.add("active");
        generatePreview();
      };
    });

    // ── Contrôles titre visuel ──
    const titleToggle = document.getElementById("titleIncludeToggle");
    const titleSizeRow = document.getElementById("titleSizeRow");
    if (titleToggle) {
      titleToggle.onchange = () => {
        titleIncluded = titleToggle.checked;
        localStorage.setItem("profileShareTitleInclude", titleIncluded);
        if (titleSizeRow) {
          titleSizeRow.style.opacity = titleIncluded ? "" : "0.4";
          titleSizeRow.style.pointerEvents = titleIncluded ? "" : "none";
        }
        generatePreview();
      };
    }
    bgSelector.querySelectorAll(".share-size-btn[data-title-size]").forEach((btn) => {
      btn.onclick = () => {
        titleSize = btn.dataset.titleSize;
        localStorage.setItem("profileShareTitleSize", titleSize);
        bgSelector
          .querySelectorAll(".share-size-btn[data-title-size]")
          .forEach((s) => s.classList.remove("active"));
        btn.classList.add("active");
        generatePreview();
      };
    });
  }

  // Exposer generatePreview pour que borderColorPicker puisse la déclencher à la volée
  _regenerateSharePreview = generatePreview;

  btn.onclick = () => {
    modal.classList.remove("hidden");
    generatePreview();
  };

  // ── Génération de la prévisualisation ──
  function generatePreview() {
    const bg = shareBackgrounds.find((b) => b.id === selectedBg) || shareBackgrounds[0];

    let wallpaper = null;
    if (activeTab === "wallpaper") {
      const catWps = shareWallpapers[selectedWallpaperCategory] || [];
      wallpaper = catWps.find((w) => w.id === selectedWallpaper) || null;
    }

    const fontDef = TEXT_FONTS.find((f) => f.id === selectedFont) || TEXT_FONTS[0];
    const sizeDef = TEXT_SIZES.find((s) => s.id === selectedSize) || TEXT_SIZES[1];
    const textStyle = { font: fontDef.value, color: selectedColor, scale: sizeDef.scale };
    const titleOpts = { include: titleIncluded, size: titleSize };

    // Carte affichée dans la zone (scaled via CSS .share-card-wrapper)
    currentCard = buildShareCard(bg, wallpaper, activeTab, textStyle, titleOpts);
    area.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "share-card-wrapper";
    wrapper.appendChild(currentCard);
    area.appendChild(wrapper);

    // Clone hors-écran pour la capture html2canvas (résolution pleine — non affecté par le scale CSS)
    const offscreen = buildShareCard(bg, wallpaper, activeTab, textStyle, titleOpts);
    offscreen.style.position = "fixed";
    offscreen.style.left = "-9999px";
    offscreen.style.top = "0";
    offscreen.style.zIndex = "-1";
    document.body.appendChild(offscreen);

    // Générer le PNG haute résolution (scale:2)
    setTimeout(async () => {
      const cvs = await html2canvas(offscreen, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        allowTaint: true,
      });
      document.body.removeChild(offscreen);
      const dataUrl = cvs.toDataURL("image/png");

      // Bouton PNG
      downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `PersonaDLE_${profile.pseudo || "Profile"}_${Date.now()}.png`;
        a.click();
        unlockPhotographerBadge();
      };

      // Partage Twitter
      twitterBtn.onclick = () => {
        const text = encodeURIComponent(
          `Check out my PersonaDLE profile! 🎭\n${profile.pseudo || "Guest"} – ${profile.stats?.wins || 0} wins & ${profile.badges?.length || 0} badges 🏅\n\n#PersonaDLE #Persona`
        );
        window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
        unlockPhotographerBadge();
      };

      // Copier pour Discord
      discordBtn.onclick = async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          alert("📋 Profile image copied! Paste it in Discord with Ctrl+V.");
          unlockPhotographerBadge();
        } catch {
          alert("❌ Copy failed. Please download manually.");
        }
      };

      // Email
      emailBtn.onclick = () => {
        const subject = encodeURIComponent("My PersonaDLE Profile");
        const body = encodeURIComponent(
          `Check out my PersonaDLE stats!\n\nWins: ${profile.stats?.wins || 0}\nBest Streak: ${profile.stats?.streakRecord || 0}\nBadges: ${profile.badges?.length || 0}\n\nPlay at: https://personadle.net`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        unlockPhotographerBadge();
      };
    }, 120);
  }

  closeBtn.onclick = () => modal.classList.add("hidden");
}

/**
 * Bouton "Copy profile link" — copie l'URL du profil public dans le presse-papier.
 * Visible uniquement si l'utilisateur est connecté (friend_code requis).
 */
function setupCopyProfileLink() {
  const btn = document.getElementById("copyProfileLinkBtn");
  const status = document.getElementById("shareStatus");
  if (!btn) return;

  // Afficher le bouton uniquement si l'user est connecté
  function _show() {
    const code = window._currentUser?.friend_code;
    if (code) btn.style.display = "";
  }
  _show();
  window.addEventListener("personadle:auth-ready", _show);

  btn.addEventListener("click", async () => {
    const code = window._currentUser?.friend_code;
    if (!code) return;

    const base = window.location.origin + window.location.pathname.replace(/\/profile\.html$/, "");
    const url = `${base}/profile.html?view=${encodeURIComponent(code)}`;
    const i18n = window.i18n || { t: (k, fb) => fb };

    try {
      await navigator.clipboard.writeText(url);
      if (status) {
        status.textContent = i18n.t("profile.link_copied", "Link copied!");
        setTimeout(() => {
          if (status) status.textContent = "";
        }, 3000);
      }
    } catch {
      // Fallback : prompt pour copier manuellement
      window.prompt(i18n.t("profile.copy_link", "Copy link") + ":", url);
    }
  });
}

/**
 * Débloque le badge "Photographer" lors du premier partage.
 */
function unlockPhotographerBadge() {
  if (!profile.hasSharedProfile) {
    profile.hasSharedProfile = true;
    saveProfile();
    import("./badges/badgesManager.js").then((module) => {
      if (module.forceCheckBadges) module.forceCheckBadges(profile, saveProfile);
    });
  }
}

// ─────────────────────────────────────────────────────────
// BADGES — ZOOM AU CLIC
// ─────────────────────────────────────────────────────────

/** Attache les click handlers sur les images de la prévisualisation badges. */
function attachPreviewClicksToImages() {
  const preview = document.getElementById("previewBadges");
  if (!preview) return;

  preview.querySelectorAll(".badge-preview-img").forEach((img) => {
    img.style.cursor = "pointer";
    img.onclick = (e) => {
      e.stopPropagation();
      const badgeId = img.dataset.badgeId;
      import("./badges/badgesData.js").then((module) => {
        const badge = module.badgesList.find((b) => b.id === badgeId);
        if (badge) showBadgeZoom(badge);
      });
    };
  });
}

/**
 * Affiche une modale de zoom pour un badge.
 * @param {Object} badge
 */
function showBadgeZoom(badge) {
  // Helpers i18n — même logique que getBadgeName/Description dans badgesManager.js
  const _t = window.i18n?.t;
  const _tr = (key, fallback) => {
    if (!_t) return fallback;
    const v = _t(key);
    return v && !v.startsWith("badges.") ? v : fallback;
  };
  const name = _tr(`badges.${badge.id}.name`, badge.name);
  const cond = _tr(`badges.${badge.id}.condition`, badge.condition);
  const desc = _tr(`badges.${badge.id}.description`, badge.description || "");

  const modal = document.createElement("div");
  modal.className = "badge-zoom-modal";
  modal.innerHTML = `
    <div class="badge-zoom-content">
      <span class="badge-zoom-close">&times;</span>
      <img src="${badge.img}" alt="${name}">
      <h3>${name}</h3>
      <p class="badge-condition">${cond}</p>
      ${desc ? `<p class="badge-description">${desc}</p>` : ""}
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("badge-zoom-modal")) modal.remove();
  });
  modal.querySelector(".badge-zoom-close").onclick = () => modal.remove();
  setTimeout(() => modal.classList.add("show"), 10);
}

// ─────────────────────────────────────────────────────────
// PROFILE SONG — Sélecteur + mini-lecteur dans le panneau gauche
// ─────────────────────────────────────────────────────────

/**
 * Ordre d'affichage des opus dans le sélecteur de musique.
 * Chaque entrée devient un <optgroup> dans le <select>.
 */
const SONG_OPUS_ORDER = [
  "P1",
  "P2IS",
  "P2EP",
  "P3",
  "P3FES",
  "P3P",
  "P3R",
  "P4",
  "P4G",
  "P4D",
  "P5",
  "P5R",
  "P5S",
  "P5X",
  "PQ",
  "PQ2",
];

const SONG_OPUS_LABELS = {
  P1: "Persona 1",
  P2IS: "Persona 2 — Innocent Sin",
  P2EP: "Persona 2 — Eternal Punishment",
  P3: "Persona 3",
  P3FES: "Persona 3 FES",
  P3P: "Persona 3 Portable",
  P3R: "Persona 3 Reload",
  P4: "Persona 4",
  P4G: "Persona 4 Golden",
  P4D: "Persona 4 Dancing All Night",
  P5: "Persona 5",
  P5R: "Persona 5 Royal",
  P5S: "Persona 5 Strikers",
  P5X: "Persona 5: The Phantom X",
  PQ: "Persona Q",
  PQ2: "Persona Q2",
};

/**
 * Construit les groupes de chansons triés selon SONG_OPUS_ORDER.
 * Chaque chanson est placée dans le groupe de son premier opus reconnu.
 * À l'intérieur de chaque groupe, les titres sont triés alphabétiquement.
 * @returns {Object} { opusCode: [song, ...] }
 */
function getSortedSongGroups() {
  const groups = {};
  SONG_OPUS_ORDER.forEach((op) => {
    groups[op] = [];
  });

  ALL_SONGS.forEach((song) => {
    const key = SONG_OPUS_ORDER.find((op) => song.opus.includes(op)) || song.opus[0] || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(song);
  });

  // Tri alphabétique dans chaque groupe
  Object.values(groups).forEach((list) => list.sort((a, b) => a.titre.localeCompare(b.titre)));
  return groups;
}

/** Formate un nombre de secondes en "m:ss". */
function formatSongTime(s) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}

/** Met à jour la barre de progression et le temps courant du lecteur. */
function updateSongProgress() {
  if (!profileSongAudio) return;
  const fill = document.getElementById("songProgressFill");
  const cur = document.getElementById("songCurrentTime");
  const pct = profileSongAudio.duration
    ? (profileSongAudio.currentTime / profileSongAudio.duration) * 100
    : 0;
  if (fill) fill.style.width = `${pct}%`;
  if (cur) cur.textContent = formatSongTime(profileSongAudio.currentTime);
}

/** Met à jour l'image de la song dans le lecteur (crop ou image opus). */
function updateSongArtwork(src) {
  const img = document.getElementById("songArtwork");
  if (img) img.src = src;
}

/** Met à jour l'image de preview dans le sélecteur (live au changement du select). */
function _songT(key, fallback) {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

function renderSongCard() {
  const card = document.getElementById("songCard");
  if (!card) return;

  const hasSong = !!profile.profileSong?.fichier;
  // Sur son propre profil la card est toujours visible (le picker sert à choisir).
  card.classList.remove("hidden");

  card.innerHTML = `
    <h3 class="card-title"><span class="card-accent">◆</span> Profile Song</h3>

    ${
      hasSong
        ? `
    <!-- Mini-lecteur actif — sélecteur masqué, image grande + infos dessous -->
    <div id="songPlayerUI" class="song-player">
      <img id="songArtwork" class="song-artwork" src="" alt="Song artwork" crossorigin="anonymous">
      <div class="song-info">
        <div id="songTitleEl" class="song-title"></div>
        <div id="songOpusEl"  class="song-opus-badge"></div>
        <div class="song-controls">
          <button id="songPlayBtn" class="song-play-btn">▶</button>
          <div class="song-progress-wrap">
            <div id="songProgressBar" class="song-progress">
              <div id="songProgressFill" class="song-progress-fill"></div>
            </div>
            <div class="song-time-row">
              <span id="songCurrentTime">0:00</span>
              <span id="songDuration">--:--</span>
            </div>
          </div>
        </div>
        <div class="song-action-row">
          <button id="songRemoveBtn" class="btn-danger song-btn-sm">✕ Remove</button>
        </div>
      </div>
    </div>
    `
        : `
    <!-- Aucune song : bouton qui ouvre le modal visuel de sélection -->
    <div class="song-empty">
      <button type="button" id="openSongModal" class="song-choose-btn">
        🎵 ${_songT("profile.song_choose", "Choose your profile music")}
      </button>
      <p class="song-empty-hint">${_songT("profile.song_choose_hint", "A track that plays when friends visit your profile")}</p>
    </div>
    `
    }
  `;

  attachSongHandlers();
  if (hasSong) initSongPlayer();
}

/** Attache les event handlers de la song card. */
function selectProfileSong(fichier) {
  const song = ALL_SONGS.find((s) => s.fichier === fichier);
  if (!song) return;
  if (profileSongAudio) {
    profileSongAudio.pause();
    profileSongAudio.currentTime = 0;
  }
  profile.profileSong = {
    fichier: song.fichier,
    titre: song.titre,
    opus: song.opus,
    image: song.image,
    customImage: null,
  };
  saveProfile();
  renderSongCard();
  markDirty();
  saveProfileToCloud({ profile_music_id: song.fichier });
}

/** Construit (une fois) et ouvre le modal visuel de sélection de musique. */
function openSongModal() {
  let modal = document.getElementById("songModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "songModal";
    modal.className = "song-modal hidden";
    document.body.appendChild(modal);
  }

  const groups = getSortedSongGroups();
  const IMG = "../musicsMode/database/img/";
  const cardsHTML = SONG_OPUS_ORDER.filter((op) => groups[op]?.length > 0)
    .map(
      (op) =>
        `<div class="song-modal-group" data-group="${op}">` +
        `<div class="song-modal-head">${SONG_OPUS_LABELS[op] || op}</div>` +
        `<div class="song-modal-grid">` +
        groups[op]
          .map(
            (s) =>
              `<button type="button" class="song-pick-card" data-fichier="${s.fichier}" data-title="${s.titre.toLowerCase()}">` +
              `<img class="song-card-cover" src="${IMG}${s.image}" alt="${SONG_OPUS_LABELS[op] || op}" loading="lazy">` +
              `<span class="song-card-title">${s.titre}</span>` +
              `<span class="song-card-opus">${SONG_OPUS_LABELS[op] || op}</span>` +
              `<span class="song-card-play">▶</span></button>`
          )
          .join("") +
        `</div></div>`
    )
    .join("");

  modal.innerHTML = `
    <div class="song-modal-box" role="dialog" aria-modal="true" aria-label="${_songT("profile.song_modal_title", "Choose your profile music")}">
      <div class="song-modal-bar">
        <input type="text" id="songSearch" class="song-search" autocomplete="off"
               placeholder="${_songT("profile.song_search", "🔎 Search a track…")}">
        <button type="button" id="closeSongModal" class="song-modal-close" aria-label="Close">&times;</button>
      </div>
      <div id="songModalBody" class="song-modal-body">${cardsHTML}</div>
      <p id="songNoResult" class="song-empty-hint" style="display:none">${_songT("profile.song_no_result", "No track found.")}</p>
    </div>`;

  modal.classList.remove("hidden");

  const close = () => modal.classList.add("hidden");
  modal.querySelector("#closeSongModal").onclick = close;
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };
  const onKey = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);

  modal.querySelectorAll(".song-pick-card").forEach((cardEl) => {
    cardEl.onclick = () => {
      selectProfileSong(cardEl.dataset.fichier);
      close();
    };
  });

  const search = modal.querySelector("#songSearch");
  search?.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    let anyVisible = false;
    modal.querySelectorAll(".song-modal-group").forEach((grp) => {
      let groupHas = false;
      grp.querySelectorAll(".song-pick-card").forEach((cardEl) => {
        const match = !q || cardEl.dataset.title.includes(q);
        cardEl.style.display = match ? "" : "none";
        if (match) groupHas = true;
      });
      grp.style.display = groupHas ? "" : "none";
      if (groupHas) anyVisible = true;
    });
    const nr = modal.querySelector("#songNoResult");
    if (nr) nr.style.display = anyVisible ? "none" : "block";
  });
  search?.focus();
}

function attachSongHandlers() {
  // ── Bouton « Choisir ma musique » → ouvre le modal visuel ──
  document.getElementById("openSongModal")?.addEventListener("click", openSongModal);

  // ── Play / Pause ──
  document.getElementById("songPlayBtn")?.addEventListener("click", () => {
    if (!profileSongAudio) return;
    if (profileSongAudio.paused) {
      profileSongAudio.play().catch(() => {});
    } else {
      profileSongAudio.pause();
    }
  });

  // ── Seek en cliquant sur la barre ──
  document.getElementById("songProgressBar")?.addEventListener("click", (e) => {
    if (!profileSongAudio?.duration) return;
    profileSongAudio.currentTime =
      (e.offsetX / e.currentTarget.offsetWidth) * profileSongAudio.duration;
  });

  // ── Supprimer la song ──
  document.getElementById("songRemoveBtn")?.addEventListener("click", () => {
    if (profileSongAudio) {
      profileSongAudio.pause();
      profileSongAudio.src = "";
    }
    delete profile.profileSong;
    saveProfile();
    renderSongCard();
    markDirty();
    saveProfileToCloud({ profile_music_id: null });
  });
}

/**
 * Charge la song dans l'élément <audio> et configure tous les callbacks.
 * L'autoplay démarre immédiatement si le navigateur le permet ;
 * sinon il se déclenche au premier clic/touche de l'utilisateur.
 */
function initSongPlayer() {
  const song = profile.profileSong;
  if (!song?.fichier) return;

  // Artwork du lecteur
  const artSrc = song.customImage || `../musicsMode/database/img/${song.image}`;
  updateSongArtwork(artSrc);

  const titleEl = document.getElementById("songTitleEl");
  const opusEl = document.getElementById("songOpusEl");
  if (titleEl) titleEl.textContent = song.titre;
  if (opusEl) opusEl.textContent = song.opus[0] || "";

  if (!profileSongAudio) profileSongAudio = new Audio();
  profileSongAudio.src = `../musicsMode/database/music/song/${song.fichier}`;
  profileSongAudio.loop = true; // Lecture en boucle — fait partie du profil
  profileSongAudio.load();

  // ── Callbacks UI ──
  profileSongAudio.ontimeupdate = updateSongProgress;

  profileSongAudio.onloadedmetadata = () => {
    const dur = document.getElementById("songDuration");
    if (dur) dur.textContent = formatSongTime(profileSongAudio.duration);
  };

  profileSongAudio.onplay = () => {
    const btn = document.getElementById("songPlayBtn");
    if (btn) btn.textContent = "⏸";
    document.getElementById("songPlayerUI")?.classList.add("playing");
  };

  profileSongAudio.onpause = () => {
    const btn = document.getElementById("songPlayBtn");
    if (btn) btn.textContent = "▶";
    document.getElementById("songPlayerUI")?.classList.remove("playing");
  };

  // ── Autoplay avec fallback au premier geste utilisateur ──
  profileSongAudio.play().catch(() => {
    // Autoplay bloqué — on attend la première interaction
    const unlock = () => {
      profileSongAudio.play().catch(() => {});
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
  });
}

/** Initialise le système de profile song (appelé au DOMContentLoaded). */
function setupSongPicker() {
  if (!profileSongAudio) profileSongAudio = new Audio();
  // renderSongCard() appelé par _applyCloudToUI() après le cloud pull —
  // évite d'afficher un picker vide avant que profile.profileSong soit résolu.
  renderSongCard();
}

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
      await initTitlesSection();
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
    if (profileSongAudio) {
      profileSongAudio.pause();
      profileSongAudio.src = "";
    }
    // localStorage déjà vidé par auth.js — initProfile() crée un profil vierge
    initProfile();
    renderThemePicker();
    renderModeStats();
    renderSongCard?.();
    renderUnlockableWallpaperGallery(profile);
    renderBadgesPreview(profile);
    renderBadgesModal(profile, saveProfileAndSyncBadges);
    _titlesData.forEach((t) => {
      t.is_unlocked = 0;
    });
    renderTitlesSection?.();
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
  setupShareProfile();
  setupCopyProfileLink();
  setupSongPicker();

  // 2. Système de badges
  initBadgesSystem(profile, saveProfileAndSyncBadges);

  // 2b. Wallpapers débloquables + Titres
  // _bindTitlesModal() : rendu immédiat depuis localStorage (avant auth/cloud)
  // initTitlesSection() : appelé dans _fullCloudSync après auth → is_unlocked correct depuis l'API
  initUnlockableWallpapers().catch(() => {});
  _bindTitlesModal();

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

const UNLOCKABLE_WALLPAPERS = [
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

function renderUnlockableWallpaperGallery(p) {
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

async function checkAndUnlockWallpapers(p, stats, friendCount) {
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

function showWallpaperNotification(wp) {
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

async function initUnlockableWallpapers() {
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

  checkAndUnlockWallpapers(profile, stats, friendCount);
  renderUnlockableWallpaperGallery(profile);
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 TITRES VISUELS (CALLING CARDS)
// ═══════════════════════════════════════════════════════════════════════════

// Local title definitions — always available, API enriches with user's unlock status
const TITLES_LOCAL = [
  {
    slug: "velvet_room_thou_art_i",
    name: "Thou Art I",
    rarity: "legendary",
    condition_type: "badges_count",
    condition_value: 20,
  },
  {
    slug: "joker_looking_cool",
    name: "Looking Cool",
    rarity: "legendary",
    condition_type: "joker_profile",
    condition_value: 0,
    is_hidden: true,
  },
  {
    slug: "makoto_yuki_memento_mori",
    name: "Memento Mori",
    rarity: "epic",
    condition_type: "unique_days",
    condition_value: 100,
  },
  {
    slug: "akechi_pancakes",
    name: "Pancakes?",
    rarity: "epic",
    condition_type: "weekly_clean_modes",
    condition_value: 3,
  },
  {
    slug: "yu_reach_out_to_the_truth",
    name: "Reach Out to the Truth",
    rarity: "epic",
    condition_type: "all_modes_won",
    condition_value: 1,
  },
  {
    slug: "aigis_i_am_not_afraid",
    name: "I Am Not Afraid",
    rarity: "rare",
    condition_type: "mode_wins",
    condition_value: 50,
  },
  {
    slug: "marie_i_remembered",
    name: "I Remembered",
    rarity: "rare",
    condition_type: "badges_count",
    condition_value: 15,
  },
  {
    slug: "yosuke_ride_the_wind",
    name: "Ride the Wind",
    rarity: "rare",
    condition_type: "friends_count",
    condition_value: 5,
  },
  {
    slug: "naoya_first_awakening",
    name: "The First Awakening",
    rarity: "rare",
    condition_type: "classic_p1_wins",
    condition_value: 15,
  },
  {
    slug: "adachi_boring_isnt_it",
    name: "Boring, Isn't It?",
    rarity: "common",
    condition_type: "giveups_total",
    condition_value: 50,
  },
  {
    slug: "maya_always_be_positive",
    name: "Always Be Positive",
    rarity: "common",
    condition_type: "emoji_p2_wins",
    condition_value: 10,
  },
];

// Chemin relatif à profile.html → toujours correct quelle que soit la config serveur
let _titlesData = TITLES_LOCAL.map((t) => ({
  ...t,
  id: null,
  is_unlocked: 0, // recalculé au render depuis profile réel
  image_path: `titles/${t.slug}.webp`,
}));

/**
 * Sync _titlesData.is_unlocked depuis profile.unlockedTitles (localStorage).
 * À appeler après chaque cloud pull ou modification de profile.unlockedTitles.
 */
function _refreshTitlesUnlockState() {
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
function _resolveEquippedTitle() {
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

async function initTitlesSection() {
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
  _refreshTitlesUnlockState();

  // 3. Résoudre ID ↔ slug du titre équipé (cloud-sync donne les deux désormais)
  _resolveEquippedTitle();

  // 4. Vérifier les conditions et déverouiller les nouveaux titres mérités
  await checkAndUnlockTitles();
  renderTitlesSection();
}

async function checkAndUnlockTitles() {
  const stats = profile.stats || {};
  const badges = profile.badges || [];
  const giveups = Object.values(stats.modeGiveups || {}).reduce((a, b) => a + b, 0);
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

  for (const title of _titlesData) {
    if (title.is_unlocked) continue;
    let met = false;
    switch (title.condition_type) {
      case "wins_total":
        met = totalWins >= title.condition_value;
        break;
      case "wins_mode":
        met = Object.values(stats.modeWins || {}).some((w) => w >= title.condition_value);
        break;
      case "streak_record":
        met = streakRecord >= title.condition_value;
        break;
      case "badges_count":
        met = badges.length >= title.condition_value;
        break;
      case "unique_days":
        met = (profile.uniqueDaysPlayed || 0) >= title.condition_value;
        break;
      case "mode_wins":
        met = (stats.modeWins?.Classic || 0) >= title.condition_value;
        break;
      case "friends_count":
        met = friendCount >= title.condition_value;
        break;
      case "giveups_total":
        met = giveups >= title.condition_value;
        break;
      case "all_modes_won":
        met = allModesWon;
        break;
      case "classic_p1_wins":
        met = (profile.classicP1Wins || 0) >= title.condition_value;
        break;
      case "emoji_p2_wins":
        met = (profile.emojiP2Wins || 0) >= title.condition_value;
        break;
      case "leaderboard_top":
        met = (profile.bestLeaderboardRank || 9999) <= title.condition_value;
        break;
      case "weekly_clean_modes":
        met = (profile.weeklyCleanWinModes || 0) >= title.condition_value;
        break;
      case "joker_profile": {
        const _jokerSongs = [
          "Last_Surprise.mp3",
          "Take_Over.mp3",
          "Wake_Up,_Get_Up,_Get_Out_There.mp3",
          "No_More_What_Ifs.mp3",
        ];
        const _song = profile.profileSong?.fichier || profile.profileMusicId || "";
        met = profile.profileTheme === "all_out" && _jokerSongs.includes(_song);
        break;
      }
    }
    if (met) {
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
}

function _showTitleNotification(title) {
  const imgSrc = title.image_path || `titles/${title.slug}.webp`;
  const cond = _titleConditionText(title);

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
}

function _showTitleZoom(title) {
  const imgSrc = title.image_path || `titles/${title.slug}.webp`;
  const cond = _titleConditionText(title);

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

/** Human-readable condition text from API fields. */
function _titleConditionText(t) {
  const v = t.condition_value;
  switch (t.condition_type) {
    case "wins_total":
      return `Win ${v} total games`;
    case "wins_mode":
      return `Win ${v} games in any single mode`;
    case "mode_wins":
      return `Win ${v} Classic games`;
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
    case "leaderboard_top":
      return `Reach top ${v} on the leaderboard`;
    case "weekly_clean_modes":
      return `Win all modes in one week without giving up`;
    case "joker_profile":
      return `Equip the All-Out Attack theme with a P5 signature track`;
    default:
      return t.condition_type || "???";
  }
}

function renderTitlesSection() {
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
  _renderTitlesGrid();
}

function _bindTitlesModal() {
  const modal = document.getElementById("titlesModal");
  const overlay = document.getElementById("titlesModalOverlay");
  const openBtn = document.getElementById("openTitlesModal");
  const closeBtn = document.getElementById("closeTitlesModal");
  if (!modal || !openBtn) return;

  _renderTitlesGrid();

  const open = () => {
    modal.classList.remove("hidden");
    if (overlay) overlay.classList.remove("hidden");
  };
  const close = () => {
    modal.classList.add("hidden");
    if (overlay) overlay.classList.add("hidden");
  };

  // addEventListener au lieu de onclick (plus fiable)
  openBtn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// Render séparé sans dépendance à l'état du modal
function _renderTitlesGrid() {
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
          <span class="tm-cond">${isUnlocked ? "🔓" : "🔒"} ${_titleConditionText(t)}</span>
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
      profile.equippedTitleSlug = alreadyEquipped ? null : slug;
      profile.equippedTitleId = alreadyEquipped ? null : titleId;
      saveProfile();
      markDirty();
      saveProfileToCloud({ equipped_title_id: profile.equippedTitleId ?? null });
      renderTitlesSection(); // re-render image + grille
    } else {
      const titleObj = (_titlesData || []).find((t) => t.slug === slug);
      if (titleObj) _showTitleZoom(titleObj);
    }
  };
}
