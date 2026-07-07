/**
 * profile/share-card.js — Carte de partage de profil (image PNG 9:16 générée
 * via html2canvas), bouton "Copy profile link" et zoom badges au clic.
 * Extrait de profile-page.js.
 */

import { getBadgesForShare } from "./badges/badgesManager.js";
import { getEquippedTitle } from "./titles-ui.js";
import { UNLOCKABLE_WALLPAPERS } from "./wallpapers-ui.js";
import { normalizeAvatarPath } from "./profile-format.js";
import { openModal, closeModal } from "../js/modal.js";

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
 * @param {Object} profile - Profil utilisateur courant
 * @param {Object} bg - Arrière-plan couleur sélectionné
 * @param {Object|null} wallpaper - Wallpaper sélectionné (ou null)
 * @param {string} activeTab - 'color' | 'wallpaper'
 * @param {{ font: string, color: string, scale: number }} [textStyle] - Style texte optionnel
 * @param {Object} [titleOptions]
 * @returns {HTMLElement}
 */
function buildShareCard(profile, bg, wallpaper, activeTab, textStyle, titleOptions = {}) {
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
      const eq = getEquippedTitle(profile);
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
 * Débloque le badge "Photographer" lors du premier partage.
 * @param {Object} profile
 * @param {Function} saveProfile
 */
function unlockPhotographerBadge(profile, saveProfile) {
  if (!profile.hasSharedProfile) {
    profile.hasSharedProfile = true;
    saveProfile();
    import("./badges/badgesManager.js").then((module) => {
      if (module.forceCheckBadges) module.forceCheckBadges(profile, saveProfile);
    });
  }
}

// Référence vers generatePreview() (posée par setupShareProfile) pour que
// d'autres écrans de profile-page.js (thème, bordure d'avatar) puissent
// rafraîchir la carte de partage si la modale est déjà ouverte.
let _regenerateSharePreview = null;

/**
 * Régénère la prévisualisation de la carte de partage si sa modale est
 * actuellement ouverte — no-op sinon. À appeler après tout changement visuel
 * du profil (thème, couleur de bordure d'avatar…) susceptible d'apparaître
 * sur la carte.
 */
export function refreshShareCardPreview() {
  const shareModal = document.getElementById("sharePreviewModal");
  if (shareModal && !shareModal.classList.contains("hidden") && _regenerateSharePreview) {
    _regenerateSharePreview();
  }
}

/**
 * Configure la modale de partage de profil.
 * Gère la sélection de fond, la génération canvas (PNG) et GIF animé.
 *
 * @param {Object} profile
 * @param {Function} saveProfile
 */
export function setupShareProfile(profile, saveProfile) {
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

  // Exposer generatePreview pour que borderColorPicker/renderThemePicker
  // puissent la déclencher à la volée via refreshShareCardPreview().
  _regenerateSharePreview = generatePreview;

  btn.onclick = () => {
    openModal("sharePreviewModal");
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
    currentCard = buildShareCard(profile, bg, wallpaper, activeTab, textStyle, titleOpts);
    area.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "share-card-wrapper";
    wrapper.appendChild(currentCard);
    area.appendChild(wrapper);

    // Clone hors-écran pour la capture html2canvas (résolution pleine — non affecté par le scale CSS)
    const offscreen = buildShareCard(profile, bg, wallpaper, activeTab, textStyle, titleOpts);
    offscreen.style.position = "fixed";
    offscreen.style.left = "-9999px";
    offscreen.style.top = "0";
    offscreen.style.zIndex = "-1";
    document.body.appendChild(offscreen);

    // Générer le PNG haute résolution (scale:2)
    setTimeout(async () => {
      let cvs;
      try {
        cvs = await html2canvas(offscreen, {
          scale: 2,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          allowTaint: true,
        });
      } catch (err) {
        console.error("Share card generation failed:", err);
        const t = window.i18n?.t;
        const msg = t?.("profile.share_generate_error");
        alert(msg && msg !== "profile.share_generate_error" ? msg : "❌ Couldn't generate the share image. Please try again.");
        return;
      } finally {
        document.body.removeChild(offscreen);
      }
      const dataUrl = cvs.toDataURL("image/png");
      const t = window.i18n?.t;
      const tr = (key, vars, fallback) => {
        const v = t?.(key, vars);
        return v && v !== key ? v : fallback;
      };

      // Bouton PNG
      downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `PersonaDLE_${profile.pseudo || "Profile"}_${Date.now()}.png`;
        a.click();
        unlockPhotographerBadge(profile, saveProfile);
      };

      // Partage Twitter
      twitterBtn.onclick = () => {
        const vars = {
          pseudo: profile.pseudo || "Guest",
          wins: profile.stats?.wins || 0,
          badges: profile.badges?.length || 0,
        };
        const text = encodeURIComponent(
          tr(
            "profile.share_tweet_text",
            vars,
            `Check out my PersonaDLE profile! 🎭\n${vars.pseudo} – ${vars.wins} wins & ${vars.badges} badges 🏅\n\n#PersonaDLE #Persona`
          )
        );
        window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
        unlockPhotographerBadge(profile, saveProfile);
      };

      // Copier pour Discord
      discordBtn.onclick = async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          alert(tr("profile.share_discord_copied", null, "📋 Profile image copied! Paste it in Discord with Ctrl+V."));
          unlockPhotographerBadge(profile, saveProfile);
        } catch {
          alert(tr("profile.share_copy_failed", null, "❌ Copy failed. Please download manually."));
        }
      };

      // Email
      emailBtn.onclick = () => {
        const subject = encodeURIComponent(tr("profile.share_email_subject", null, "My PersonaDLE Profile"));
        const vars = {
          wins: profile.stats?.wins || 0,
          streak: profile.stats?.streakRecord || 0,
          badges: profile.badges?.length || 0,
        };
        const body = encodeURIComponent(
          tr(
            "profile.share_email_body",
            vars,
            `Check out my PersonaDLE stats!\n\nWins: ${vars.wins}\nBest Streak: ${vars.streak}\nBadges: ${vars.badges}\n\nPlay at: https://personadle.net`
          )
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        unlockPhotographerBadge(profile, saveProfile);
      };
    }, 120);
  }

  closeBtn.onclick = () => closeModal("sharePreviewModal");
}

/**
 * Bouton "Copy profile link" — copie l'URL du profil public dans le presse-papier.
 * Visible uniquement si l'utilisateur est connecté (friend_code requis).
 */
export function setupCopyProfileLink() {
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

// ─────────────────────────────────────────────────────────
// BADGES — ZOOM AU CLIC
// ─────────────────────────────────────────────────────────

/** Attache les click handlers sur les images de la prévisualisation badges. */
export function attachPreviewClicksToImages() {
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
