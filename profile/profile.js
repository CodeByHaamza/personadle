// === profile.js ===

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
  saveProfile();      // Sauvegarde les données modifiées
  location.reload();  // Recharge la page proprement
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
  // === P1 ===
  "Naoya.jpg", "Naoya1.jpg", "Yuka.webp", "Hidehiko.png", "Hidehiko.webp", "Inaba2.webp", "Inaba.webp", "Eriko.png",

  // === P2 ===
  "Tatsuya2.jpg", "Tatsuya.jpg", "Lisa.jpeg", "Jun.jpg", "Ekichi2.jpeg", "Ekichi.jpeg", "Maya2.jpeg", "Maya.jpg",

  // === P3 ===
  "Yuki.jpeg", "yuki.jpg","Kotone2.jpeg", "Kotone.jpeg","Kotone3.jpeg","Aigis2.jpg", "Aigis.jpg", "Akihiko.jpg", "Mitsuru.jpg", "Mitsuru.webp",
  "Junpei2.jpg", "Junpei.png", "Fuuka2.jpeg", "Fuuka.jpeg", "Ken.jpeg", "Koromaru2.jpg", "Koromaru.jpg", "Shinji.jpg", "Shinji.webp","Yukari2.jpg", "Yukari.jpg",

  // === P4 ===
  "Yu2.jpg", "Yu.jpg", "Yosuke2.jpg", "Yosuke.jpg", "Chie2.jpg", "Chie.jpg", "Yukiko2.jpg", "Yukiko.jpg",
  "Kanji.avif", "Kanji.jpg", "Rise.jpg", "Rise.png", "Teddie2.jpg", "Teddie.jpg", "Naoto2.jpg", "Naoto.jpg", "Nanako2.jpg", "Nanako.jpg",

  // === P5 ===
  "Joker.jpg","ren_t.webp","Ann.jpg", "ANn.jpg", "Ryuji.jpg", "Ryuji.png", "Morgana.jpg", "Morgana.png", "Yusuke.jpg", "Yusuke.webp",
  "Haru.png", "Har.jpg", "Futaba.jpg", "Futaba.webp", "Akechi2.jpg", "Akechi.jpg", "Sumire2.jpg", "Sumire.jpg", "Makoto2.jpg", "Makoto.jpg",
  

  // === P5X ===
  "Wonder.jpg", "wonder1.png", "wonder2.png","Lufel2.png", "Lufel.png","Arai2.png", "Arai.png","Shun2.png", "Shun.png",
 "Riko2.png", "Riko.png","Kayo2.png", "Kayo.png",  
   "Tomoko2.png", "Tomoko.png", 
  "Yaoling2.png", "Yaoling.png", "YUI2.png", "YUI.png",

// === GIFs Only ===
"Yuki.gif","Yuki2.gif", "Yu.gif","Yu2.gif", "Ren.gif","Ren2.gif","catlisabeth.gif","luix-dextructor-aigis.gif","Anniversary.gif","aigis.gif"
];


  // === Avatar Grid Rendering ===
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

// === CANVAS CROP ===
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

// === EXPORT / IMPORT ===
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
      profile = JSON.parse(reader.result);
      saveProfile();
      initProfile();
      alert("Profile imported successfully!");
    } catch {
      alert("Invalid file!");
    }
  };
  reader.readAsText(file);
};

// === LANCEMENT ===
document.addEventListener("DOMContentLoaded", () => {
  initProfile();
  initAvatarGrid();
});
