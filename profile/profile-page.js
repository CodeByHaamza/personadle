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
 *   - Choix de l'avatar parmi les portraits du jeu (pas d'import : 2026-09-16)
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
  forceCheckBadges,
  syncBadgesWithBackend,
  renderBadgesModal,
  renderBadgesPreview,
  renderBadgePicker,
  renderBadgesShowcase,
} from "./badges/badgesManager.js";
import { songs as ALL_SONGS } from "../musicsMode/database/songs.js";
import { canRecover, getPreviousStreak, showStreakRecoveryMenu } from "../js/streak-recovery.js";
import { openModal, closeModal } from "../js/modal.js";
import { pullProfileFromCloud, pushLangToCloud } from "../js/cloud-sync.js";
import { formatPlayTime } from "./formatPlayTime.js";
import { MODES, modeLabel, normalizeModeKey } from "../js/gameCore.js";
import { AVATAR_GROUPS } from "./avatars_data.js";
import {
  getStreakTier,
  formatSongTime,
  normalizeAvatarPath,
  bestModeOverall,
} from "./profile-format.js";
import { THEME_COLORS, hexToRgb, adjustHex, resolveTheme, applyThemeVars } from "./theme.js";
import { initAtelier, openAtelier, initSaveStatus, scheduleAutosave } from "./atelier.js";
import {
  renderUnlockableWallpaperGallery,
  initUnlockableWallpapers,
} from "./wallpapers-ui.js";
import {
  renderTitlesSection,
  initTitlesSection,
  _bindTitlesModal,
  resetTitlesUnlockedState,
  refreshTitlesAfterCloudSync,
} from "./titles-ui.js";
import { renderSongCard, setupSongPicker, stopProfileSong } from "./song-player.js";
import {
  setupShareProfile,
  setupCopyProfileLink,
  attachPreviewClicksToImages,
  refreshShareCardPreview,
} from "./share-card.js";

// Ré-exportées pour compatibilité avec le code existant qui importe ces
// fonctions depuis profile-page.js plutôt que depuis profile-format.js/theme.js.
export { getStreakTier, formatSongTime, hexToRgb, adjustHex, normalizeAvatarPath };
// Exporté pour les tests (tests/profilePage.test.js) — voir le bug {{count}} sur tf().
export { tf as _tf };

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

/**
 * Traduit une clé i18n avec un vrai fallback string (window.i18n.t renvoie la clé
 * brute si absente). `vars` est transmis à t() pour les {{placeholders}} — il était
 * ignoré, et le bouton Jack Frost affichait « 0 → {{count}} jours » (retour 2.2).
 */
function tf(key, fallback, vars) {
  const v = window.i18n?.t?.(key, vars);
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
    saveProfile();
    markDirty();
    saveProfileToCloud({ wallpaper_id: `custom:${e.target.value}` });
  });
}

// ─────────────────────────────────────────────────────────
// VARIABLES GLOBALES
// ─────────────────────────────────────────────────────────

let profile = null; // Objet profil utilisateur (localStorage)
let zoom = 1; // Niveau de zoom du canvas de recadrage
let offsetX = 0; // Décalage horizontal du canvas
let offsetY = 0; // Décalage vertical du canvas
let dragging = false; // État du drag
let startX = 0; // Position X initiale du drag
let startY = 0; // Position Y initiale du drag
let selectedAvatarSrc = ""; // Portrait sélectionné dans la grille (chemin ../img/avatar/…)


// ─────────────────────────────────────────────────────────
// ÉLÉMENTS DOM
// ─────────────────────────────────────────────────────────

// Éléments principaux de la page
const pageAvatar = document.getElementById("pageAvatar");
const pageUsername = document.getElementById("pageUsername");
const pseudoInput = document.getElementById("pseudoInput");

// Boutons principaux
const editAvatarBtn = document.getElementById("editAvatarBtn");

// ── Enregistrement automatique (2.2) ─────────────────────────────────────────
// `markDirty()` est l'historique « quelque chose a changé » que tous les
// modules de la page appellent après un choix du joueur. Il n'allume plus un
// bouton Save à ne pas oublier : il programme l'envoi complet du profil
// (syncProfileToCloud) après un court regroupement, et l'indicateur #saveStatus
// sur la carte d'identité dit où on en est (profile/atelier.js). Chaque
// changement continue par ailleurs d'envoyer son propre champ tout de suite
// (saveProfileToCloud) : l'envoi complet est le filet, pas le chemin nominal.
function markDirty() {
  scheduleAutosave();
}
const resetProfileBtn = document.getElementById("resetProfile");
const borderColorPicker = document.getElementById("borderColorPicker");
const statsContainer = document.getElementById("statsContainer");

const avatarGrid = document.getElementById("avatarGrid");

// Modale de recadrage (sur un portrait du jeu — aucun import)
const closeCropper = document.getElementById("closeCropper");
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
    // Un profil enregistré avant l'ajout d'un de ces champs ne l'a pas du tout :
    // le bloc « nouveau profil » ci-dessous ne s'exécute jamais pour lui. Sans
    // cette normalisation, un `.includes()`/`.push()` en aval lève un TypeError
    // (cf. le code événementiel, qui accordait le badge côté serveur puis
    // plantait côté client en l'annonçant comme invalide).
    if (!Array.isArray(profile.badges)) profile.badges = [];
    if (!Array.isArray(profile.selectedBadges)) profile.selectedBadges = [];
    if (!Array.isArray(profile.eventCodes)) profile.eventCodes = [];
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

  // ── Statistiques ──
  renderStats();
}

/**
 * Affiche le code ami de l'utilisateur connecté sous le pseudo, sur sa propre page de
 * profil — même pattern que profile-view.js pour un profil public (.profile-friend-code),
 * jamais câblé côté propriétaire du profil. Idempotent (crée l'élément une seule fois,
 * le réutilise sinon) car appelée à chaque _fullCloudSync. Retire l'élément si déconnecté.
 */
export function _renderFriendCode() {
  const code = window._currentUser?.friend_code;
  const container = pageUsername?.closest(".avatar-card-info");
  if (!container) return;
  let codeEl = container.querySelector(".profile-friend-code");
  if (!code) {
    codeEl?.remove();
    return;
  }
  if (!codeEl) {
    // <button> : cliquable pour copier le code ami dans le presse-papier.
    codeEl = document.createElement("button");
    codeEl.type = "button";
    codeEl.className = "profile-friend-code";
    codeEl.title = tf("profile.friend_code_copy_hint", "Click to copy your friend code");
    container.appendChild(codeEl);
    codeEl.addEventListener("click", async () => {
      const c = codeEl.dataset.code;
      if (!c) return;
      try {
        await navigator.clipboard.writeText(c);
      } catch {
        // Fallback (contexte non sécurisé / API clipboard indisponible)
        const ta = document.createElement("textarea");
        ta.value = c;
        ta.style.cssText = "position:fixed;top:-9999px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (_) {}
        ta.remove();
      }
      const label = codeEl.querySelector(".pfc-code");
      if (!label) return;
      codeEl.classList.add("copied");
      label.textContent = tf("profile.friend_code_copied", "Copied!");
      clearTimeout(codeEl._copyTimer);
      codeEl._copyTimer = setTimeout(() => {
        label.textContent = codeEl.dataset.code || "";
        codeEl.classList.remove("copied");
      }, 1400);
    });
  }
  codeEl.dataset.code = code;
  // Structure statique posée une seule fois ; le code lui-même via textContent
  // (jamais interpolé dans innerHTML — défensif, même si friend_code est un code
  // alphanumérique généré serveur).
  if (!codeEl.querySelector(".pfc-code")) {
    codeEl.innerHTML =
      `<span class="pfc-key" aria-hidden="true">🔑</span>` +
      `<span class="pfc-code"></span>` +
      `<span class="pfc-copy" aria-hidden="true">📋</span>`;
  }
  const codeLabel = codeEl.querySelector(".pfc-code");
  if (!codeEl.classList.contains("copied")) codeLabel.textContent = code;
}

/**
 * Sauvegarde le profil dans localStorage.
 */
function saveProfile() {
  localStorage.setItem("personaUserProfile", JSON.stringify(profile));
}

/**
 * Chemin de galerie d'un avatar, ou null si ce n'en est pas un (image encodée
 * d'avant 2026-09-16, valeur vide…). Les anciens chemins « ./img/… » (stockés
 * depuis la racine du site en v1) sont ramenés à la forme « ../img/… » attendue
 * depuis profile/.
 * @param {string|undefined} avatar
 * @returns {string|null}
 */
function galleryAvatarPath(avatar) {
  if (typeof avatar !== "string" || !avatar) return null;
  const path = avatar.replace(/^\.\/img\//, "../img/");
  return /^\.\.\/img\/avatar\/[A-Za-z0-9_-]+\.(?:gif|png|jpe?g|webp)$/i.test(path) ? path : null;
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
 * Sync complet localStorage → cloud : au login, et après chaque changement du
 * joueur (enregistrement automatique 2.2, via markDirty → scheduleAutosave).
 * Envoie avatar, bordure, wallpaper, musique et badges en une seule requête PATCH.
 * @param {{ strict?: boolean }} [opts]  strict : laisser l'erreur remonter (l'indicateur
 *        #saveStatus doit pouvoir afficher « Non enregistré ») — sinon fire-and-forget.
 */
async function syncProfileToCloud({ strict = false } = {}) {
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
    favorite_mode: normalizeModeKey(profile.favoriteMode) ?? null,
  };
  // Portrait de la galerie, ou son recadrage encodé — les deux formes que le
  // serveur accepte (personadle_validate_avatar). Un ancien chemin v1 « ./img/… »
  // est ramené à la forme attendue depuis profile/.
  if (profile.avatar) {
    fields.avatar_data = galleryAvatarPath(profile.avatar) ?? profile.avatar;
  }
  // Sync des settings (son, animations…) — stockés dans personaSettings
  const settings = JSON.parse(localStorage.getItem("personaSettings") || "{}");
  if (Object.keys(settings).length) fields.settings = settings;
  try {
    await window._personadleApi.user.update(window._currentUser.id, fields);
  } catch (e) {
    console.warn("[Profile] Sync to cloud failed:", e.message);
    if (strict) throw e;
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
  renderFavoriteModePicker();

  // ── Stats ─────────────────────────────────────────────────
  renderStats();
  renderModeStats();
    renderExpertStats();

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
  renderBadgePicker(profile, saveProfileAndSyncBadges);
  renderBadgesShowcase(profile);
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

  // Décorateurs selon le tier
  const flameL = (n) => `<span class="streak-side-flame" aria-hidden="true">🔥</span>`.repeat(n);
  const flameR = (n) =>
    `<span class="streak-side-flame streak-side-flame--r" aria-hidden="true">🔥</span>`.repeat(n);
  const snowL = (n) => `<span class="streak-side-flake" aria-hidden="true">❄️</span>`.repeat(n);
  const snowR = (n) =>
    `<span class="streak-side-flake streak-side-flake--r" aria-hidden="true">❄️</span>`.repeat(n);

  let leftDeco = "";
  let rightDeco = "";
  let icon = "🔥";
  let iconSize = "1.3em";
  let fullWidth = tier >= 5;

  if (tier === 0) {
    leftDeco = snowL(1);
    rightDeco = snowR(1);
    icon = "❄️";
    iconSize = "1.3em";
  }

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
      <span class="stat-icon" style="font-size:${iconSize}">${icon}</span>
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

  const modeNames = {
    Classique: "Classic",
    Emoji: "Emoji",
    Silhouette: "Silhouette",
    AllOutAttack: "All-Out Attack",
    Personae: "Personae",
    Music: "Music",
  };
  // Mode favori = le CHOIX du joueur (profile.favoriteMode, migration 040), plus le
  // mode le plus joué (l'ancien stats.favoriteMode, retiré en 2.2).
  // Retour joueur 2.2 : « je veux le choisir, et mettre le mode où je performe le
  // mieux à côté, sous "Best Mode Overall" ».
  const favKey = normalizeModeKey(profile.favoriteMode);
  const modeFav = favKey ? modeNames[modeLabel(favKey)] || modeLabel(favKey) : "—";
  const best = bestModeOverall(
    Object.keys(s.modeCount || {}).map((m) => ({
      mode: m,
      games: s.modeCount?.[m] || 0,
      wins: s.modeWins?.[m] || 0,
    }))
  );
  const modeBest = best
    ? `${modeNames[modeLabel(best.mode)] || modeLabel(best.mode)} · ${Math.round(best.rate * 100)}%`
    : "—";

  // Stats standard (hors streak)
  const stats = [
    { icon: "🏆", value: s.wins || 0, label: tf("profile.stat_wins_label", "Wins") },
    { icon: "🏳️", value: s.giveups || 0, label: tf("profile.stat_giveups_label", "Give-ups") },
    { icon: "🎮", value: s.games || 0, label: tf("profile.stat_games_label", "Games Played") },
    { icon: "⭐", value: s.streakRecord || 0, label: tf("profile.stat_best_streak_label", "Best Streak") },
    { icon: "⏱️", value: formatPlayTime(s.totalTimeMinutes || 0), label: tf("profile.stat_time_label", "Time Played") },
    { icon: "📅", value: s.firstPlayed?.split("T")[0] || "—", label: tf("profile.stat_first_played_label", "First Played"), full: true },
    { icon: "🎯", value: modeFav, label: tf("profile.stat_fav_mode_label", "Fav Mode") },
    { icon: "🏅", value: modeBest, label: tf("profile.stat_best_mode_label", "Best Mode Overall") },
  ];

  const streakHTML = buildStreakItem(s.streak || 0, tf("profile.stat_current_streak_label", "Current Streak"), "0.22s");
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

  // Bouton de récupération visible sous les stats quand streak = 0 et cooldown OK
  const recoveryPrompt = document.getElementById("streakRecoveryPrompt");
  if (recoveryPrompt) {
    if ((s.streak || 0) === 0 && canRecover()) {
      const prev = getPreviousStreak();
      if (prev > 1) {
        const btnLabel = tf(
          "streak_recovery.profile_btn",
          `❄️ Reignite — 0 → ${prev} days`,
          { count: prev }
        );
        recoveryPrompt.innerHTML = `<button class="srp-btn">${btnLabel}</button>`;
        recoveryPrompt.querySelector(".srp-btn").addEventListener("click", () =>
          showStreakRecoveryMenu(prev)
        );
        recoveryPrompt.classList.remove("hidden");
      } else {
        recoveryPrompt.classList.add("hidden");
      }
    } else {
      recoveryPrompt.classList.add("hidden");
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
      <span>${tf("profile.mode_col_mode", "Mode")}</span>
      <span>${tf("profile.mode_col_games", "Games / Win %")}</span>
    </div>
    <div class="mode-stats-list">${rows}</div>`;
}


/**
 * Section « Mode Expert » — rendue sous le Mode Breakdown, uniquement si le joueur
 * a au moins une partie Expert.
 *
 * Les données viennent de l'API (`stats.expert_by_mode`) et non de `profile.stats`
 * comme le reste de la page : le Mode Expert n'écrit rien dans les stats client, et
 * n'agrège pas non plus dans `user_stats` côté serveur — ses parties ne vivent que
 * dans `game_sessions`, d'où l'endpoint les recalcule (api/user/stats.php).
 *
 * Silencieux si l'appel échoue ou si le joueur est déconnecté : c'est un bonus
 * d'affichage, il ne doit jamais casser la page profil.
 */
/**
 * Réponse `/user/{id}/stats` mémoïsée le temps du chargement de page.
 *
 * renderExpertStats() est appelée depuis cinq endroits (montage, pull cloud,
 * i18n prêt…) parce que les libellés dépendent d'i18n. renderModeStats(), son
 * voisin, est local et gratuit ; celle-ci fait un aller-retour réseau et un
 * GROUP BY + un recalcul de streak par mode. Sans cache : cinq fois.
 */
let _expertStatsPromise = null;

async function renderExpertStats() {
  const container = document.getElementById("expertStatsContainer");
  if (!container) return;
  container.innerHTML = "";

  // `playerUserId` est la clé écrite par updateAuthUI() (js/auth.js) — c'est la
  // seule source de l'id côté client. `localStorage["user"]` n'existe pas et n'a
  // jamais existé dans ce dépôt : la section entière ne s'affichait donc jamais.
  const userId = window._currentUser?.id ?? localStorage.getItem("playerUserId");
  if (!userId || !window._personadleApi) return;

  let modes = [];
  try {
    _expertStatsPromise ??= window._personadleApi.stats.get(userId);
    const res = await _expertStatsPromise;
    modes = res?.stats?.expert_by_mode ?? [];
  } catch {
    _expertStatsPromise = null; // un échec ne doit pas être mis en cache
    return; // hors ligne / non connecté — on n'affiche simplement rien
  }
  if (!modes.length) return;

  const rows = modes
    .map((m) => {
      // modeLabel() et non une capitale à la main : « alloutattack » donnait
      // « Alloutattack ». Vocabulaire des modes = gameCore (CLAUDE.md §8).
      const label = modeLabel(m.mode);
      const rate = m.games > 0 ? Math.round((m.wins / m.games) * 100) : 0;
      const best = m.best_attempts == null ? "—" : m.best_attempts;
      return `
      <div class="mode-stat-row expert-stat-row">
        <span class="mode-stat-icon">⚡</span>
        <span class="mode-stat-name">${label}</span>
        <span class="expert-stat-cell">${m.wins}/${m.games}</span>
        <span class="expert-stat-cell">${rate}%</span>
        <span class="expert-stat-cell" title="${tf("profile.expert_best_hint", "Fewest guesses in a win")}">${best}</span>
        <span class="expert-stat-cell">🔥 ${m.streak}</span>
      </div>`;
    })
    .join("");

  // Les 4 libellés de colonnes vivent dans une seule clé (« Won / Played · Rate ·
  // Best · Streak », même forme dans les 6 langues) : on la découpe sur « · »
  // pour poser chaque libellé au-dessus de SA colonne, dans la même grille que
  // les lignes. En un seul <span> calé à droite, l'en-tête n'était aligné sur
  // rien — retour joueur 2.2 : « les chiffres sont décalés du texte ».
  const cols = tf("profile.expert_cols", "Won / Played · Rate · Best · Streak").split(/\s*·\s*/);
  container.innerHTML = `
    <div class="mode-stats-header expert-stats-header">
      <span>${tf("profile.expert_title", "⚡ Expert Mode")}</span>
    </div>
    <div class="mode-stat-row expert-stat-row expert-stat-cols" aria-hidden="true">
      <span></span><span></span>
      ${cols.map((c) => `<span class="expert-stat-cell">${c}</span>`).join("")}
    </div>
    <div class="mode-stats-list">${rows}</div>`;
}

// ─────────────────────────────────────────────────────────
// GESTIONNAIRES D'ÉVÉNEMENTS — PROFIL
// ─────────────────────────────────────────────────────────

// ✎ sur l'avatar → onglet Avatar de l'atelier (les portraits s'appliquent au
// clic ; le recadrage n'est proposé que pour une image importée ou « Ajuster »).
if (editAvatarBtn) editAvatarBtn.onclick = () => openAtelier("avatar");

// Le titre sous le pseudo → onglet Titre.
document.getElementById("equippedTitleBtn")?.addEventListener("click", () => {
  openAtelier("title");
});

/**
 * Applique un portrait du jeu. On enregistre le CHEMIN du portrait, jamais une
 * image encodée : c'est ce qui garantit qu'un avatar est toujours un portrait
 * du jeu (décision Hamza du 2026-09-16), et ça évite au passage de trimballer
 * ~100 Ko de base64 dans chaque liste d'amis et chaque défi.
 * @param {string} src  chemin relatif à profile/ (../img/avatar/…)
 */
function applyAvatarPreset(src) {
  selectedAvatarSrc = src;
  commitAvatar(src);
}

/** Pose l'avatar, sauvegarde, envoie. */
function commitAvatar(result) {
  profile.avatar = result;
  profile.avatarSrc = selectedAvatarSrc;
  pageAvatar.src = result;
  saveProfile();
  markDirty();
  saveProfileToCloud({ avatar_data: result });
  refreshShareCardPreview();
  _markSelectedAvatarCell();
}

// « Ajuster le cadrage » : recadre le portrait porté (certains sont mal cadrés
// par défaut — retour Hamza du 2026-09-16). Sans portrait choisi, rien à recadrer.
document.getElementById("avatarAdjustBtn")?.addEventListener("click", () => {
  const src = selectedAvatarSrc || galleryAvatarPath(profile.avatarSrc || profile.avatar);
  if (!src || src === "none") {
    openAtelier("avatar");
    return;
  }
  selectedAvatarSrc = src;
  loadImageToCanvas(src);
  openModal("avatarCropModal");
});

/**
 * Surligne dans la grille le portrait actuellement porté. Un portrait recadré
 * (PNG) se reconnaît à avatarSrc ; un GIF est stocké tel quel dans avatar
 * (../img/avatar/…), et avatarSrc ne survit pas à un pull cloud — on regarde
 * donc les deux.
 */
function _markSelectedAvatarCell() {
  const current = profile.avatarSrc || (profile.avatar?.startsWith("../img/") ? profile.avatar : "");
  avatarGrid?.querySelectorAll(".avatar-cell img").forEach((img) => {
    img.classList.toggle("selected", !!current && img.dataset.src === current);
  });
}

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
};
borderColorPicker.onchange = (e) => setBorderColor(e.target.value);

// Palette de bordures d'avatar (pastilles preset, même UX que le thème).
const BORDER_PRESETS = [
  "#ffd700", "#e63946", "#3b82f6", "#2bae66", "#8b5cf6",
  "#ff6b9d", "#ffffff", "#111111", "#00b8d4", "#f39c12",
];

/** Applique une couleur de bordure (clic pastille ou custom) + sauvegarde. */
function setBorderColor(color) {
  profile.avatarBorderColor = color;
  if (pageAvatar) pageAvatar.style.borderColor = color;
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

/** Icône par clé de mode pour le sélecteur de mode favori (même table que MODE_META). */
const MODE_ICON_BY_KEY = Object.fromEntries(
  Object.entries(MODE_META).map(([label, meta]) => [normalizeModeKey(label), meta.icon])
);

/**
 * Rend le sélecteur de mode favori (carte Customization) : une puce par mode,
 * plus « Aucun ». Le choix est sauvegardé localement et poussé en cloud tout de
 * suite, comme la couleur de bordure — le bouton Save global le renvoie aussi.
 */
function renderFavoriteModePicker() {
  const container = document.getElementById("favModeChips");
  if (!container) return;
  const current = normalizeModeKey(profile.favoriteMode);
  const noneLabel = tf("profile.fav_mode_none", "None");

  container.innerHTML =
    MODES.map(
      ({ key, label }) =>
        `<button type="button" class="mode-chip${key === current ? " active" : ""}" data-mode="${key}" aria-pressed="${key === current}">${MODE_ICON_BY_KEY[key] ?? ""} ${label === "AllOutAttack" ? "All-Out" : label}</button>`
    ).join("") +
    `<button type="button" class="mode-chip mode-chip--none${current ? "" : " active"}" data-mode="" aria-pressed="${!current}">${noneLabel}</button>`;

  container.querySelectorAll(".mode-chip").forEach((b) =>
    b.addEventListener("click", () => setFavoriteMode(b.dataset.mode || null))
  );
}

function setFavoriteMode(key) {
  const next = normalizeModeKey(key) ?? null;
  if (next === (normalizeModeKey(profile.favoriteMode) ?? null)) return;
  profile.favoriteMode = next;
  saveProfile();
  markDirty();
  saveProfileToCloud({ favorite_mode: next });
  renderFavoriteModePicker();
  renderStats();
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

  // Clic sur un portrait → appliqué tout de suite (plus d'étape « Appliquer »)
  avatarGrid.querySelectorAll(".avatar-cell img").forEach((img) => {
    img.onclick = () => applyAvatarPreset(img.dataset.src);
  });
  _markSelectedAvatarCell();

  // Option NONE → vider l'avatar
  const noneOption = avatarGrid.querySelector(".avatar-none");
  if (noneOption) {
    noneOption.onclick = () => {
      selectedAvatarSrc = "none";
      profile.avatar = "";
      profile.avatarSrc = "";
      pageAvatar.src = "../img/default_avatar.png";
      saveProfile();
      markDirty();
      saveProfileToCloud({ avatar_data: null });
      refreshShareCardPreview();
      _markSelectedAvatarCell();
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

// Appliquer le recadrage. Un GIF garde son chemin (le canvas perdrait
// l'animation) ; sinon on enregistre l'image recadrée. La SOURCE reste toujours
// un portrait du jeu : la modale ne s'ouvre que sur celui qui est porté.
confirmCrop.onclick = () => {
  commitAvatar(
    selectedAvatarSrc.toLowerCase().endsWith(".gif")
      ? selectedAvatarSrc
      : canvas.toDataURL("image/png")
  );
  closeModal("avatarCropModal");
};

// ─────────────────────────────────────────────────────────
// EXPORT JSON
// ─────────────────────────────────────────────────────────

// L'export du profil vit désormais dans la modale ⚙ Paramètres
// (js/settings-modal.js → exportProfileFile), retour Hamza du 2026-09-16.


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
    renderExpertStats();

  // 1b. Sync complet cloud → local (le backend est la source de vérité).
  // Chaîne : pull → apply UI → re-init titres avec session valide → sync badges local→back.
  // Dual approach : immédiat si auth déjà résolue, sinon event listener.
  const _fullCloudSync = async () => {
    if (!window._currentUser?.id) return;
    _renderFriendCode();
    try {
      await pullProfileFromCloud();
      _applyCloudToUI();
      // Re-vérifier les badges dont la condition dépend de stats agrégées côté
      // backend (giveups_total, wins…) : le premier appel à initBadgesSystem()
      // plus bas tourne AVANT que ce pull résolve, donc sur un profil local
      // potentiellement périmé (autre appareil, localStorage vidé…).
      forceCheckBadges(profile, saveProfileAndSyncBadges);
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
    _renderFriendCode(); // window._currentUser déjà à null → retire l'élément
    // localStorage déjà vidé par auth.js — initProfile() crée un profil vierge
    initProfile();
    renderThemePicker();
    renderBorderPicker();
    renderFavoriteModePicker();
    renderModeStats();
    renderExpertStats();
    renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty);
    renderUnlockableWallpaperGallery(profile);
    renderBadgesPreview(profile);
    renderBadgePicker(profile, saveProfileAndSyncBadges);
    renderBadgesShowcase(profile);
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

  // Retour bfcache (bouton "précédent" du navigateur après avoir joué une partie
  // sur une autre page) : la page est restaurée depuis le cache mémoire du
  // navigateur SANS ré-exécuter ce script — `profile` reste l'objet périmé chargé
  // avant la partie jouée. `_periodicSync()` ne suffit pas ici (il ne fait que
  // pull+apply, pas de re-check badges/titres) : on relance le sync complet pour
  // que toute condition remplie entre-temps (badge/wallpaper/titre à flags locaux
  // type `foundXPersona`, écrits par un autre mode de jeu) soit re-testée tout de
  // suite, sans attendre un rechargement complet fortuit de la page.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) _fullCloudSync();
  });

  // Callback appelé par cloud-sync.js après chaque pull périodique
  window._onCloudSync = () => _applyCloudToUI();

  renderThemePicker();
  // Bordure et mode favori : rendus ici aussi, pas seulement après le pull cloud
  // (_applyCloudToUI) — sinon un invité, ou un joueur hors ligne, voit les deux
  // sections vides sous leur intitulé.
  renderBorderPicker();
  renderFavoriteModePicker();
  initAvatarGrid();
  // L'atelier : onglets + indicateur d'enregistrement branché sur l'envoi complet.
  initAtelier();
  initSaveStatus(() => {
    saveProfile();
    return syncProfileToCloud({ strict: true });
  });
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
    renderModeStats();
    renderExpertStats();
    renderBadgesModal(profile, saveProfileAndSyncBadges);
  });

  // Race-condition : si initLang() s'est terminé avant ce listener, l'event est déjà parti
  if (window.i18nIsReady) {
    renderStats();
    renderModeStats();
    renderExpertStats();
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
