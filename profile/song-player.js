/**
 * profile/song-player.js — Musique de profil : sélecteur visuel + mini-lecteur.
 * Extrait de profile-page.js (bloc "PROFILE SONG").
 *
 * profile/saveProfile/saveProfileToCloud/markDirty sont passés en paramètres
 * explicites (même convention que badgesManager.js/wallpapers-ui.js/titles-ui.js).
 * L'élément <audio> (profileSongAudio) reste un état interne encapsulé — jamais
 * exposé brut, comme _titlesData dans titles-ui.js.
 */

import { songs as ALL_SONGS } from "../musicsMode/database/songs.js";
import { formatSongTime } from "./profile-format.js";
import { openModal, closeModal } from "../js/modal.js";

/** Élément <audio> du profile song — état interne, jamais exposé directement. */
let profileSongAudio = null;

/** Traduit une clé i18n avec un vrai fallback string. */
function songT(key, fallback) {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

/**
 * Ordre d'affichage des opus dans le sélecteur de musique.
 * Chaque entrée devient un <optgroup> dans le <select>.
 */
const SONG_OPUS_ORDER = [
  "P1", "P2IS", "P2EP", "P3", "P3FES", "P3P", "P3R", "P4", "P4G", "P4D",
  "P5", "P5R", "P5S", "P5X", "PQ", "PQ2",
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
export function getSortedSongGroups() {
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
export function updateSongArtwork(src) {
  const img = document.getElementById("songArtwork");
  if (img) img.src = src;
}

export function renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty) {
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
        🎵 ${songT("profile.song_choose", "Choose your profile music")}
      </button>
      <p class="song-empty-hint">${songT("profile.song_choose_hint", "A track that plays when friends visit your profile")}</p>
    </div>
    `
    }
  `;

  attachSongHandlers(profile, saveProfile, saveProfileToCloud, markDirty);
  if (hasSong) initSongPlayer(profile);
}

/** Sélectionne une nouvelle song de profil (depuis le modal ou par fichier). */
export function selectProfileSong(fichier, profile, saveProfile, saveProfileToCloud, markDirty) {
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
  renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty);
  markDirty();
  saveProfileToCloud({ profile_music_id: song.fichier });
}

/** Construit (une fois) et ouvre le modal visuel de sélection de musique. */
function openSongModal(profile, saveProfile, saveProfileToCloud, markDirty) {
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
              `<img class="song-card-cover" src="${IMG}${s.image}" alt="${SONG_OPUS_LABELS[op] || op}" loading="lazy"` +
              ` onerror="this.onerror=null;this.src='${IMG}${(s.opus && s.opus[0]) || "P5"}.webp'">` +
              `<span class="song-card-title">${s.titre}</span>` +
              `<span class="song-card-opus">${SONG_OPUS_LABELS[op] || op}</span>` +
              `<span class="song-card-play">▶</span></button>`
          )
          .join("") +
        `</div></div>`
    )
    .join("");

  modal.innerHTML = `
    <div class="song-modal-box" aria-label="${songT("profile.song_modal_title", "Choose your profile music")}">
      <div class="song-modal-bar">
        <input type="text" id="songSearch" class="song-search" autocomplete="off"
               placeholder="${songT("profile.song_search", "🔎 Search a track…")}">
        <button type="button" id="closeSongModal" class="song-modal-close" aria-label="Close">&times;</button>
      </div>
      <div id="songModalBody" class="song-modal-body">${cardsHTML}</div>
      <p id="songNoResult" class="song-empty-hint" style="display:none">${songT("profile.song_no_result", "No track found.")}</p>
    </div>`;

  // openModal() gère role=dialog/aria-modal, le focus initial (1er élément
  // focusable = #songSearch), le trap clavier (Tab) et Escape.
  openModal("songModal");
  const close = () => closeModal("songModal");

  modal.querySelector("#closeSongModal").onclick = close;
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };

  modal.querySelectorAll(".song-pick-card").forEach((cardEl) => {
    cardEl.onclick = () => {
      selectProfileSong(cardEl.dataset.fichier, profile, saveProfile, saveProfileToCloud, markDirty);
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
}

/** Attache les event handlers de la song card. */
function attachSongHandlers(profile, saveProfile, saveProfileToCloud, markDirty) {
  // ── Bouton « Choisir ma musique » → ouvre le modal visuel ──
  document
    .getElementById("openSongModal")
    ?.addEventListener("click", () => openSongModal(profile, saveProfile, saveProfileToCloud, markDirty));

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
    renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty);
    markDirty();
    saveProfileToCloud({ profile_music_id: null });
  });
}

/**
 * Charge la song dans l'élément <audio> et configure tous les callbacks.
 * L'autoplay démarre immédiatement si le navigateur le permet ;
 * sinon il se déclenche au premier clic/touche de l'utilisateur.
 */
function initSongPlayer(profile) {
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
export function setupSongPicker(profile, saveProfile, saveProfileToCloud, markDirty) {
  if (!profileSongAudio) profileSongAudio = new Audio();
  // renderSongCard() appelé par _applyCloudToUI() après le cloud pull —
  // évite d'afficher un picker vide avant que profile.profileSong soit résolu.
  renderSongCard(profile, saveProfile, saveProfileToCloud, markDirty);
}

/** Coupe la lecture en cours (utilisé au logout). */
export function stopProfileSong() {
  if (profileSongAudio) {
    profileSongAudio.pause();
    profileSongAudio.src = "";
  }
}
