// === profile.js ===

// === IMPORTS (EN HAUT !) ===
import { initBadgesSystem, getBadgesForShare, markProfileAsShared } from "./badges/badgesManager.js";

// === VARIABLES ===
let profile = null;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let startX = 0;
let startY = 0;
let selectedAvatarSrc = "";

// === ELEMENTS ===
const profileBtn = document.getElementById("profileButton");
const profileModal = document.getElementById("profileModal");
const closeProfile = document.getElementById("closeProfile");
const pseudoInput = document.getElementById("pseudoInput");
const avatarPreview = document.getElementById("avatarPreview");
const editAvatarBtn = document.getElementById("editAvatarBtn");
const statsContainer = document.getElementById("statsContainer");
const exportBtn = document.getElementById("exportProfile");
const importBtn = document.getElementById("importProfile");
const importFile = document.getElementById("importFileInput");

const cropModal = document.getElementById("avatarCropModal");
const closeCropper = document.getElementById("closeCropper");
const avatarGrid = document.getElementById("avatarGrid");
const canvas = document.getElementById("avatarCanvas");
const ctx = canvas.getContext("2d");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const confirmCrop = document.getElementById("confirmCrop");

// === INIT ===
function initProfile() {
  const saved = localStorage.getItem("personaUserProfile");
  if (saved) {
    profile = JSON.parse(saved);
  } else {
    profile = {
      pseudo: "",
      avatar: "",
      avatarBorderColor: "#000000",
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

  pseudoInput.value = profile.pseudo;
  avatarPreview.src = profile.avatar || "./img/default_avatar.png";
  document.getElementById("headerAvatar").style.borderColor = profile.avatarBorderColor;
  avatarPreview.style.borderColor = profile.avatarBorderColor;
  document.getElementById("borderColorPicker").value = profile.avatarBorderColor;

  if (profile.pseudo || profile.avatar) {
    document.getElementById("profileDisplay").style.display = "block";
    document.getElementById("headerAvatar").src = profile.avatar || "./img/default_avatar.png";
    document.getElementById("headerPseudo").textContent = profile.pseudo || "Guest";
  } else {
    document.getElementById("profileDisplay").style.display = "none";
  }

  renderStats();
}

function saveProfile() {
  localStorage.setItem("personaUserProfile", JSON.stringify(profile));
}

function renderStats() {
  const s = profile.stats;
  const modeNames = {
    Classique: "Classic",
    Emoji: "Emoji",
    Silhouette: "Silhouette",
    AllOutAttack: "All-Out Attack",
    Personae: "Personae",
    Music: "Music",
  };

  const modeFav = s.favoriteMode ? (modeNames[s.favoriteMode] || s.favoriteMode) : "-";
  statsContainer.innerHTML = `
    <p>🏆 Wins: ${s.wins}</p>
    <p>🚫 Give Ups: ${s.giveups}</p>
    <p>▶️ Games Played: ${s.games}</p>
    <p>📆 Current Streak: ${s.streak} day(s)</p>
    <p>🔥 Best Streak: ${s.streakRecord}</p>
    <p>🎮 Favorite Mode: ${modeFav}</p>
    <p>⏱️ Total Time: ${s.totalTimeMinutes} min</p>
    <p>📅 First Played: ${s.firstPlayed?.split("T")[0]}</p>
    <p>📅 Last Played: ${s.lastPlayed?.split("T")[0] || "-"}</p>
  `;
}

// === EVENTS ===
profileBtn.onclick = () => profileModal.classList.remove("hidden");
closeProfile.onclick = () => profileModal.classList.add("hidden");
editAvatarBtn.onclick = () => cropModal.classList.remove("hidden");

document.getElementById("saveAndRefreshBtn").onclick = () => {
  saveProfile();
  location.reload();
};

document.getElementById("resetProfile").onclick = () => {
  const confirmReset = confirm("⚠️ This will permanently erase your profile data. Do you want to continue?");
  if (confirmReset) {
    localStorage.removeItem("personaUserProfile");
    location.reload();
  }
};

closeCropper.onclick = () => cropModal.classList.add("hidden");

pseudoInput.oninput = (e) => {
  profile.pseudo = e.target.value;
  saveProfile();
  document.getElementById("headerPseudo").textContent = profile.pseudo || "Guest";
};

document.getElementById("borderColorPicker").oninput = (e) => {
  profile.avatarBorderColor = e.target.value;
  document.getElementById("headerAvatar").style.borderColor = profile.avatarBorderColor;
  avatarPreview.style.borderColor = profile.avatarBorderColor;
  saveProfile();
};

const avatarList = [
  "Naoya.jpg", "Naoya1.jpg", "Yuka.webp", "Hidehiko.png", "Hidehiko.webp", "Inaba2.webp", "Inaba.webp", "Eriko.png",
  "Tatsuya2.jpg", "Tatsuya.jpg", "Lisa.jpeg", "Jun.jpg", "Ekichi2.jpeg", "Ekichi.jpeg", "Maya2.jpeg", "Maya.jpg",
  "Yuki.jpeg", "yuki.jpg","Kotone2.jpeg", "Kotone.jpeg","Kotone3.jpeg","Aigis2.jpg", "Aigis.jpg", "Akihiko.jpg", "Mitsuru.jpg", "Mitsuru.webp",
  "Junpei2.jpg", "Junpei.png", "Fuuka2.jpeg", "Fuuka.jpeg", "Ken.jpeg", "Koromaru2.jpg", "Koromaru.jpg", "Shinji.jpg", "Shinji.webp","Yukari2.jpg", "Yukari.jpg",
  "Metis.jpg", "Metis2.jpeg", "Elisabeth.jpeg", "Elisabeth2.jpeg","Chidori.jpg","Chidori2.jpg",
  "Yu2.jpg", "Yu.jpg", "Yosuke2.jpg", "Yosuke.jpg", "Chie2.jpg", "Chie.jpg", "Yukiko2.jpg", "Yukiko.jpg",
  "Kanji.avif", "Kanji.jpg", "Rise.jpg", "Rise.png", "Teddie2.jpg", "Teddie.jpg", "Naoto2.jpg", "Naoto.jpg", "Marie.jpg" , "Marie2.webp" ,"Nanako2.jpg", "Nanako.jpg",
  "margaret.jpg",
  "Joker.jpg","ren_t.webp","Ann.jpg", "Ann_2.jpg", "Ryuji.jpg", "Ryuji.png", "Morgana.jpg", "Morgana.png", "Yusuke.jpg", "Yusuke.webp",
  "Makoto2.jpg", "Makoto.jpg","Futaba.jpg", "Futaba.webp","Haru.png", "Har.jpg",  "Akechi2.jpg", "Akechi.jpg", "Sumire2.jpg", "Sumire.jpg","Tae.jpg","Tae2.jpg","Caroline&justine.png","Lavenza.jpg",

  "Wonder.jpg", "wonder1.png", "wonder2.png","Lufel2.png", "Lufel.png","Arai2.png", "Arai.png","Shun2.png", "Shun.png",
  "Riko2.png", "Riko.png","Kayo2.png", "Kayo.png", "Tomoko2.png", "Tomoko.png", 
  "Yaoling2.png", "Yaoling.png", "YUI2.png", "YUI.png",
  "Yuki.gif","Yuki2.gif", "Yu.gif","Yu2.gif", "Ren.gif","Ren2.gif","catlisabeth.gif","luix-dextructor-aigis.gif","Anniversary.gif","aigis.gif","Lavenza7.gif","Maruki.gif",
];

function initAvatarGrid() {
  avatarGrid.innerHTML =
    `<div class="avatar-none" data-src="none" style="display: flex; align-items: center; justify-content: center; background: #333; color: white; font-weight: bold; border-radius: 8px; height: 80px; cursor: pointer;">
      NONE
    </div>` +
    avatarList.map(name =>
      `<img src="./img/avatar/${name}" data-src="./img/avatar/${name}" />`
    ).join("");

  avatarGrid.querySelectorAll("img").forEach(img => {
    img.onclick = () => {
      selectedAvatarSrc = img.dataset.src;
      loadImageToCanvas(selectedAvatarSrc);
    };
  });

  const noneOption = avatarGrid.querySelector(".avatar-none");
  if (noneOption) {
    noneOption.onclick = () => {
      selectedAvatarSrc = "none";
      profile.avatar = "";
      avatarPreview.src = "./img/default_avatar.png";
      document.getElementById("headerAvatar").src = "./img/default_avatar.png";
      saveProfile();
      cropModal.classList.add("hidden");
    };
  }
}

let image = new Image();
function loadImageToCanvas(src) {
  image.src = src;
  image.onload = () => {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    drawCanvas();
  };
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = image.width * zoom;
  const h = image.height * zoom;
  const x = canvas.width / 2 - w / 2 + offsetX;
  const y = canvas.height / 2 - h / 2 + offsetY;
  ctx.drawImage(image, x, y, w, h);
}

canvas.onmousedown = (e) => {
  dragging = true;
  startX = e.offsetX;
  startY = e.offsetY;
};
canvas.onmouseup = () => dragging = false;
canvas.onmouseleave = () => dragging = false;
canvas.onmousemove = (e) => {
  if (!dragging) return;
  offsetX += e.offsetX - startX;
  offsetY += e.offsetY - startY;
  startX = e.offsetX;
  startY = e.offsetY;
  drawCanvas();
};

zoomInBtn.onclick = () => {
  zoom *= 1.1;
  drawCanvas();
};
zoomOutBtn.onclick = () => {
  zoom /= 1.1;
  drawCanvas();
};

confirmCrop.onclick = () => {
  if (selectedAvatarSrc.endsWith(".gif")) {
    profile.avatar = selectedAvatarSrc;
    avatarPreview.src = selectedAvatarSrc;
    document.getElementById("headerAvatar").src = selectedAvatarSrc;
  } else {
    const cropped = canvas.toDataURL("image/png");
    profile.avatar = cropped;
    avatarPreview.src = cropped;
    document.getElementById("headerAvatar").src = cropped;
  }
  saveProfile();
  cropModal.classList.add("hidden");
};

exportBtn.onclick = () => {
  const blob = new Blob([JSON.stringify(profile)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "personadle_profile.json";
  a.click();
};

importBtn.onclick = () => importFile.click();
importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.badges) imported.badges = [];
      if (!imported.selectedBadges) imported.selectedBadges = [];
      if (!imported.eventCodes) imported.eventCodes = [];
      if (!imported.stats.perfectWins) imported.stats.perfectWins = 0;
      profile = imported;
      saveProfile();
      location.reload();
    } catch {
      alert("❌ Invalid file! Please select a valid PersonaDLE profile.");
    }
  };
  reader.readAsText(file);
};

// === 🎨 BACKGROUNDS DISPONIBLES ===
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
    pattern: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)",
  },
  {
    id: "dark_hour",
    name: "Dark Hour",
    gradient: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    pattern: "radial-gradient(circle at 80% 20%, rgba(46, 204, 113, 0.1) 0%, transparent 50%)",
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
    pattern: "repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(231, 76, 60, 0.1) 20px, rgba(231, 76, 60, 0.1) 40px)",
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
    pattern: "repeating-linear-gradient(0deg, transparent, transparent 15px, rgba(255,255,255,0.05) 15px, rgba(255,255,255,0.05) 30px)",
  },
  {
    id: "sunset",
    name: "Sunset",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    pattern: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%)",
  },
];
// === 🖼️ WALLPAPERS DISPONIBLES ===
const shareWallpapers = [
  { id: "none", name: "None (Color only)", src: null },
  { id: "velvet_room", name: "Velvet Room", src: "./profile/Wallpaper/Velvet_Room_Wallpaper.png" },
  { id: "p1_prota", name: "Persona 1 - Protagonist", src: "./profile/Wallpaper/P1_Prota_Wallpaper.png" },
  { id: "p2_prota", name: "Persona 2 - Protagonist", src: "./profile/Wallpaper/P2_Prota_Wallpaper.png" },
  { id: "p3_tartarus", name: "Persona 3 - Tartarus", src: "./profile/Wallpaper/P3_Tartarus_Wallpaper.png" },
  { id: "p3_water", name: "Persona 3 - Water", src: "./profile/Wallpaper/P3_Water_Wallapaper.png" },
  { id: "p4_tv", name: "Persona 4 - TV World", src: "./profile/Wallpaper/P4_TV_World_Wallpaper.png" },
  { id: "p5_clinic_tae", name: "Persona 5 - Clinic (Tae)", src: "./profile/Wallpaper/P5_Clinique_vTae_Wallpaper.png" },
  { id: "p5_clinic", name: "Persona 5 - Clinic", src: "./profile/Wallpaper/P5_Clinique_Wallpaper.png" },
  { id: "p5_mementos", name: "Persona 5 - Mementos", src: "./profile/Wallpaper/P5_Memento_Wallpaper.png" },
  { id: "p5_coffe_leblanc", name: "Persona 5 - Coffee Leblanc", src: "./profile/Wallpaper/P5_Leblanc_Cafe_Wallapaper.png" },
  { id: "p5_phantom", name: "Persona 5 - Phantom Thieves", src: "./profile/Wallpaper/P5_Phantom_Thieves_Wallpaper.png" },
  { id: "christmas", name: "Christmas Special", src: "./profile/Wallpaper/Christmas_Wallpaper.png" },
];

// === 📤 SHARE PROFILE (REMPLACER LA FONCTION EXISTANTE) ===
// === 📤 SHARE PROFILE (REMPLACER LA FONCTION EXISTANTE) ===
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
  let selectedWallpaper = localStorage.getItem("profileShareWallpaper") || "none";
  let activeTab = "color"; // "color" ou "wallpaper"

  if (bgSelector) {
    bgSelector.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center; justify-content: center; margin-bottom: 15px;">
        <button id="tabColor" class="bg-tab active" style="padding: 8px 16px; border-radius: 8px; border: 2px solid #667eea; background: #667eea; color: white; cursor: pointer; font-weight: bold; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
          🎨 Color
        </button>
        <button id="tabWallpaper" class="bg-tab" style="padding: 8px 16px; border-radius: 8px; border: 2px solid #ccc; background: #f5f5f5; color: #666; cursor: pointer; font-weight: bold; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          🖼️ Wallpaper
        </button>
      </div>
      
      <div id="colorSelector" style="display: block; text-align: center;">
        <label for="bgSelect" style="font-weight: bold; margin-right: 10px; color: inherit;">Background:</label>
        <select id="bgSelect" style="padding: 8px; border-radius: 6px; background: #222; color: white; border: 1px solid #555; cursor: pointer;">
          ${shareBackgrounds.map(bg => 
            `<option value="${bg.id}" ${bg.id === selectedBg ? 'selected' : ''}>${bg.name}</option>`
          ).join('')}
        </select>
      </div>
      
      <div id="wallpaperSelector" style="display: none; text-align: center;">
        <label for="wallpaperSelect" style="font-weight: bold; margin-right: 10px; color: inherit;">Wallpaper:</label>
        <select id="wallpaperSelect" style="padding: 8px; border-radius: 6px; background: #222; color: white; border: 1px solid #555; cursor: pointer;">
          ${shareWallpapers.map(wp => 
            `<option value="${wp.id}" ${wp.id === selectedWallpaper ? 'selected' : ''}>${wp.name}</option>`
          ).join('')}
        </select>
      </div>
    `;

    // Gestion des onglets
    const tabColor = document.getElementById("tabColor");
    const tabWallpaper = document.getElementById("tabWallpaper");
    const colorSelector = document.getElementById("colorSelector");
    const wallpaperSelector = document.getElementById("wallpaperSelector");

    function switchTab(tab) {
      activeTab = tab;
      if (tab === "color") {
        tabColor.style.background = "#667eea";
        tabColor.style.borderColor = "#667eea";
        tabColor.style.color = "white";
        tabWallpaper.style.background = "#f5f5f5";
        tabWallpaper.style.borderColor = "#ccc";
        tabWallpaper.style.color = "#666";
        colorSelector.style.display = "block";
        wallpaperSelector.style.display = "none";
      } else {
        tabWallpaper.style.background = "#667eea";
        tabWallpaper.style.borderColor = "#667eea";
        tabWallpaper.style.color = "white";
        tabColor.style.background = "#f5f5f5";
        tabColor.style.borderColor = "#ccc";
        tabColor.style.color = "#666";
        colorSelector.style.display = "none";
        wallpaperSelector.style.display = "block";
      }
      generatePreview();
    }

    tabColor.onclick = () => switchTab("color");
    tabWallpaper.onclick = () => switchTab("wallpaper");

    document.getElementById("bgSelect").onchange = (e) => {
      selectedBg = e.target.value;
      localStorage.setItem("profileShareBg", selectedBg);
      generatePreview();
    };

    document.getElementById("wallpaperSelect").onchange = (e) => {
      selectedWallpaper = e.target.value;
      localStorage.setItem("profileShareWallpaper", selectedWallpaper);
      generatePreview();
    };
  }

  btn.onclick = () => {
    modal.classList.remove("hidden");
    generatePreview();
  };

  function generatePreview() {
    const selectedBadges = getBadgesForShare(profile);
    const bg = shareBackgrounds.find(b => b.id === selectedBg) || shareBackgrounds[0];
    const wallpaper = shareWallpapers.find(w => w.id === selectedWallpaper);

    const card = document.createElement("div");
    card.className = "share-card";
    card.style.cssText = `
      background: ${activeTab === "color" ? bg.gradient : "#1a1a1a"};
      position: relative;
      padding: 40px;
      border-radius: 25px;
      color: white;
      text-align: center;
      width: 500px;
      min-height: 600px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      overflow: hidden;
    `;

    // Wallpaper en fond
    if (activeTab === "wallpaper" && wallpaper && wallpaper.src) {
      const wallpaperDiv = document.createElement("div");
      wallpaperDiv.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: url('${wallpaper.src}');
        background-size: cover;
        background-position: center;
        opacity: 0.85;
        pointer-events: none;
      `;
      card.appendChild(wallpaperDiv);
    }

    // Pattern pour les couleurs uniquement
    if (activeTab === "color") {
      const pattern = document.createElement("div");
      pattern.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: ${bg.pattern};
        pointer-events: none;
      `;
      card.appendChild(pattern);
    }

    // Overlay sombre pour améliorer la lisibilité avec wallpaper
    if (activeTab === "wallpaper" && wallpaper && wallpaper.src) {
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%);
        pointer-events: none;
      `;
      card.appendChild(overlay);
    }

    const content = document.createElement("div");
    content.style.cssText = "position: relative; z-index: 1;";
    content.innerHTML = `
      <div style="margin-bottom: 25px;">
        <h2 style="margin: 0; font-size: 2em; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">PersonaDLE Profile</h2>
      </div>
      <div style="margin: 20px 0;">
        <img src="${profile.avatar || "./img/default_avatar.png"}" alt="Avatar" 
             style="width: 140px; height: 140px; border-radius: 50%; border: 5px solid #ffd700; box-shadow: 0 8px 20px rgba(0,0,0,0.6); object-fit: cover;">
      </div>
      <h3 style="margin: 15px 0; font-size: 2em; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
        ${profile.pseudo || "Guest Player"}
      </h3>
      <div style="display: flex; justify-content: space-around; margin: 30px auto; max-width: 400px; background: rgba(0,0,0,0.5); padding: 20px; border-radius: 15px; backdrop-filter: blur(10px);">
        <div style="text-align: center;">
          <div style="font-size: 2.5em; font-weight: bold; color: #ffd700; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${profile.stats.wins || 0}</div>
          <div style="font-size: 0.9em; opacity: 0.9; margin-top: 5px;">Wins</div>
        </div>
        <div style="width: 2px; background: rgba(255,255,255,0.3);"></div>
        <div style="text-align: center;">
          <div style="font-size: 2.5em; font-weight: bold; color: #ff6b6b; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${profile.stats.streakRecord || 0}</div>
          <div style="font-size: 0.9em; opacity: 0.9; margin-top: 5px;">Best Streak</div>
        </div>
        <div style="width: 2px; background: rgba(255,255,255,0.3);"></div>
        <div style="text-align: center;">
          <div style="font-size: 2.5em; font-weight: bold; color: #4ecdc4; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${profile.badges?.length || 0}</div>
          <div style="font-size: 0.9em; opacity: 0.9; margin-top: 5px;">Badges</div>
        </div>
      </div>
      ${selectedBadges.length > 0 ? `
        <div style="margin-top: 30px;">
          <h4 style="font-size: 1.3em; margin-bottom: 15px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">🏅 Featured Badges</h4>
          <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
            ${selectedBadges.map(b => `
              <div style="text-align: center;">
                <img src="${b.img}" alt="${b.name}" 
                     style="width: 80px; height: 80px; border-radius: 12px; border: 3px solid #ffd700; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">
                <p style="margin: 8px 0 0 0; font-size: 0.75em; opacity: 0.9; text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">${b.name}</p>
              </div>
            `).join("")}
          </div>
        </div>
      ` : `<div style="margin-top: 30px; opacity: 0.6;"><p style="font-size: 0.9em;">No badges selected yet</p></div>`}
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.85em; opacity: 0.8;">
        <strong>personadle.net</strong> • ${new Date().getFullYear()}
      </div>
    `;
    card.appendChild(content);

    area.innerHTML = "";
    area.appendChild(card);

    setTimeout(async () => {
      const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
      const dataUrl = canvas.toDataURL("image/png");

      downloadBtn.onclick = () => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `PersonaDLE_${profile.pseudo || 'Profile'}_${Date.now()}.png`;
        a.click();
        
        unlockPhotographerBadge();
      };

      twitterBtn.onclick = () => {
        const text = encodeURIComponent(`Check out my PersonaDLE profile! 🎭\n${profile.pseudo || 'Guest'} – ${profile.stats.wins || 0} wins & ${profile.badges?.length || 0} badges 🏅\n\n#PersonaDLE #Persona`);
        window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
        
        unlockPhotographerBadge();
      };

      discordBtn.onclick = async () => {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert("📋 Profile image copied! Paste it in Discord with Ctrl+V.");
          
          unlockPhotographerBadge();
        } catch {
          alert("❌ Copy failed. Please download manually.");
        }
      };

      emailBtn.onclick = () => {
        const subject = encodeURIComponent("My PersonaDLE Profile");
        const body = encodeURIComponent(`Check out my PersonaDLE stats!\n\nWins: ${profile.stats.wins || 0}\nBest Streak: ${profile.stats.streakRecord || 0}\nBadges: ${profile.badges?.length || 0}\n\nPlay at: https://personadle.net`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        
        unlockPhotographerBadge();
      };
    }, 100);
  }

  closeBtn.onclick = () => modal.classList.add("hidden");
}
function unlockPhotographerBadge() {
  if (!profile.hasSharedProfile) {
    profile.hasSharedProfile = true;  // ✅ hasSharedProfile
    saveProfile();
    
    import("./badges/badgesManager.js").then(module => {
      module.forceCheckBadges(profile, saveProfile);
    });
  }
}


// === 🔍 ATTACH PREVIEW CLICKS ===
function attachPreviewClicksToImages() {
  const preview = document.getElementById("previewBadges");
  if (!preview) return;
  
  preview.querySelectorAll(".badge-preview-img").forEach((img) => {
    img.style.cursor = "pointer";
    img.onclick = (e) => {
      e.stopPropagation();
      const badgeId = img.dataset.badgeId;
      
      // Import dynamique pour accéder à badgesList
      import("./badges/badgesData.js").then((module) => {
        const badge = module.badgesList.find((b) => b.id === badgeId);
        if (badge) showBadgeZoom(badge);
      });
    };
  });
}

function showBadgeZoom(badge) {
  const modal = document.createElement("div");
  modal.className = "badge-zoom-modal";

  modal.innerHTML = `
    <div class="badge-zoom-content">
      <span class="badge-zoom-close">&times;</span>
      <img src="${badge.img}" alt="${badge.name}">
      <h3>${badge.name}</h3>
      <p class="badge-condition">${badge.condition}</p>
      ${badge.description ? `<p class="badge-description">${badge.description}</p>` : ''}
    </div>
  `;

  document.body.appendChild(modal);

  // 🟢 FERMETURE PAR CLIC FOND
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("badge-zoom-modal")) {
      modal.remove();
    }
  });

  // ❌ FERMETURE CROIX
  modal.querySelector(".badge-zoom-close").onclick = () => modal.remove();

  // 🔥 ANIMATION
  setTimeout(() => modal.classList.add("show"), 10);
}

document.addEventListener("DOMContentLoaded", () => {
  initProfile();
  initAvatarGrid();
  setupShareProfile();
  initBadgesSystem(profile, saveProfile);
});

// ✅ Écouter l'événement de rendu des badges
window.addEventListener('badgesRendered', () => {
  attachPreviewClicksToImages();
});