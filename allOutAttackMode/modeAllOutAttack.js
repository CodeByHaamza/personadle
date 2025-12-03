import { personas as originalPersonas } from "./database/personas_allOut.js";
import { portraitsMap } from "./database/portraitsMap.js";
import { aoaCharacters } from "./database/aoaCharacters.js";
import { updateProfileStats } from "../profile/profileStats.js";

// 🔥 OPTIMISATION 1 : Cache unique pour les images
const imageCache = new Map();
const MAX_CACHE_SIZE = 20;

// 🔥 OPTIMISATION 2 : Pool d'images pré-chargées
let preloadQueue = [];
let isPreloading = false;

const AOA_BY_NAME = new Map(aoaCharacters.map(c => [c.nom, c]));

const CDN_BASE_URL = "https://pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev/";
const CACHE_CONTROL = "public, max-age=86400";
const IS_LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";

function cdn(subfolder, filename, ext = "webp") {
  if (IS_LOCAL) {
    return `./database/allOutAttack/${encodeURIComponent(filename)}.${ext}`;
  }
  const url = `${CDN_BASE_URL}${subfolder}/${encodeURIComponent(filename)}.${ext}`;
  return `${url}?cache=${CACHE_CONTROL}`;
}

let activeOpusFilters = ["P3", "P5", "P5X"];
let sessionStartTime = Date.now();
const todayKey = `statsLogged_AllOut_${new Date().toISOString().split("T")[0]}`;

let personas = [];
let attempts = 0;
let gameOver = false;
let target = null;
let lastFiveTargets = [];

// 🔥 OPTIMISATION 3 : Gestion intelligente du cache d'images
function addToImageCache(src, imgElement) {
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    const oldImg = imageCache.get(firstKey);
    if (oldImg) oldImg.src = ''; // Libère la mémoire
    imageCache.delete(firstKey);
  }
  imageCache.set(src, imgElement);
}

function getFromCache(src) {
  return imageCache.get(src);
}

// 🔥 OPTIMISATION 4 : Préchargement intelligent avec priorité
async function smartPreload(namesList, priority = 'low') {
  if (isPreloading) return;
  
  isPreloading = true;
  const limitedList = namesList.slice(0, 15); // Augmenté à 15 mais avec gestion intelligente
  
  for (const name of limitedList) {
    const base = portraitsMap[name] || name.split(" ")[0];
    const src = cdn("allOutAttack", base);
    
    // Skip si déjà en cache
    if (getFromCache(src)) continue;
    
    const img = new Image();
    img.loading = priority === 'high' ? 'eager' : 'lazy';
    img.src = src;
    
    // Promesse qui ne bloque pas le reste
    const loadPromise = new Promise((resolve) => {
      img.onload = () => {
        addToImageCache(src, img);
        resolve();
      };
      img.onerror = () => resolve(); // Continue même en cas d'erreur
    });
    
    if (priority === 'high') {
      await loadPromise;
    }
    
    // Délai adaptatif selon la priorité
    await new Promise(r => setTimeout(r, priority === 'high' ? 30 : 100));
  }
  
  isPreloading = false;
}

// 🔥 OPTIMISATION 5 : Chargement d'image avec gestion d'erreur robuste
function loadImageSafely(gifElement, src, onLoadCallback) {
  // Vérifie d'abord le cache
  const cached = getFromCache(src);
  if (cached && cached.complete) {
    gifElement.src = src;
    if (onLoadCallback) onLoadCallback();
    return;
  }
  
  // Charge avec timeout
  const tempImg = new Image();
  let timeoutId;
  
  const cleanup = () => {
    clearTimeout(timeoutId);
    tempImg.onload = null;
    tempImg.onerror = null;
  };
  
  tempImg.onload = () => {
    cleanup();
    addToImageCache(src, tempImg);
    gifElement.src = src;
    gifElement.style.opacity = "1";
    if (onLoadCallback) onLoadCallback();
  };
  
  tempImg.onerror = () => {
    cleanup();
    console.error(`Failed to load: ${src}`);
    gifElement.src = "../img/loading.gif"; // Fallback
  };
  
  // Timeout de 10 secondes
  timeoutId = setTimeout(() => {
    cleanup();
    console.warn(`Timeout loading: ${src}`);
    gifElement.src = "../img/loading.gif";
  }, 10000);
  
  tempImg.src = src;
}

// 🔥 OPTIMISATION 6 : ShowLoading plus efficace
function showLoading(gifElement) {
  gifElement.style.filter = "none";
  gifElement.style.opacity = "1";
  
  // Utilise une version en cache si disponible
  const loadingCached = getFromCache("../img/loading.gif");
  if (loadingCached) {
    gifElement.src = "../img/loading.gif";
  } else {
    const loadingImg = new Image();
    loadingImg.src = "../img/loading.gif";
    loadingImg.onload = () => {
      addToImageCache("../img/loading.gif", loadingImg);
      gifElement.src = "../img/loading.gif";
    };
  }
}

function getFilteredPersonas() {
  const res = [];
  for (const name of originalPersonas) {
    const entry = AOA_BY_NAME.get(name);
    if (!entry) continue;

    for (let i = 0; i < entry.opus.length; i++) {
      if (activeOpusFilters.includes(entry.opus[i])) {
        res.push(name);
        break;
      }
    }
  }

  if (res.length === 0) {
    console.warn("⚠️ Aucun personnage filtré. activeOpusFilters =", activeOpusFilters);
  }

  return res;
}

function getBetterRandomCharacter() {
  const filteredPool = personas.filter(name => !lastFiveTargets.includes(name));
  const pool = filteredPool.length > 0 ? filteredPool : [...personas];

  if (pool.length === 0) {
    alert("Aucun personnage disponible avec les filtres actuels.");
    return null;
  }

  const index = Math.floor(Math.random() * pool.length);
  const selected = pool[index];

  lastFiveTargets.push(selected);
  if (lastFiveTargets.length > 5) {
    lastFiveTargets.shift();
  }

  return selected;
}

function initializeAutocomplete(element, array) {
  let currentFocus = -1;

  element.addEventListener("input", function () {
    const val = this.value.trim();
    closeList(null, element);
    if (!val) return false;

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);

    const matches = [];

    for (let i = 0; i < array.length; i++) {
      const displayName = array[i];
      const lowerName = displayName.toLowerCase();
      const lowerVal = val.toLowerCase();

      if (lowerName.includes(lowerVal)) {
        const [firstName, lastName] = displayName.split(" ");
        let priority = 3;
        if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
        else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;
        matches.push({ name: displayName, priority });
      }
    }

    matches.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    matches.forEach((matchObj) => {
      const displayName = matchObj.name;
      const imageName = portraitsMap[displayName] || displayName.split(" ")[0];
      const portraitName = encodeURIComponent(imageName);
      const realName = displayName.includes("(") ? displayName.split("(")[1].replace(")", "") : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="./database/img/${portraitName}.webp" alt="${displayName}">
        <span style="display: flex; flex-direction: column;">
          <span class="codename">${displayName.split(" (")[0]}</span>
          ${realName ? `<span class="realname">(${realName})</span>` : ""}
        </span>
        <input type='hidden' value='${displayName}'>
      `;

      option.addEventListener("click", function () {
        element.value = this.getElementsByTagName("input")[0].value;
        removeFromAutocomplete(element.value);
        handleGuess();
        closeList(null, element);
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

  element.addEventListener("keydown", function (e) {
    const items = document.querySelectorAll("#autocomplete-list .list-options");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      currentFocus++;
      updateActive(items);
    } else if (e.key === "ArrowUp") {
      currentFocus--;
      updateActive(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentFocus > -1) items[currentFocus].click();
      else items[0]?.click();
    }
  });

  function updateActive(items) {
    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function removeActive(items) {
    for (let item of items) item.classList.remove("autocomplete-active");
  }

  document.addEventListener("click", (e) => {
    closeList(e.target, element);
  });
}

function closeList(e, inputElement) {
  const items = document.getElementsByClassName("autocomplete-items");
  for (let item of items) {
    if (e !== item && e !== inputElement) item.remove();
  }
}

function removeFromAutocomplete(name) {
  const index = personas.findIndex(n => n.toLowerCase() === name.toLowerCase());
  if (index !== -1) personas.splice(index, 1);
}

function showConfettiExplosion() {
  new Audio('../assets/sound_effect/Victory_sound.mp3').play();

  const emojiList = ["🎉", "🎊", "✨", "💥", "🌟"];
  const numEmojisPerSide = 20;

  for (let i = 0; i < numEmojisPerSide * 2; i++) {
    const emoji = document.createElement("span");
    emoji.textContent = emojiList[Math.floor(Math.random() * emojiList.length)];
    emoji.classList.add("confetti-emoji");

    const isLeft = i < numEmojisPerSide;
    emoji.style.left = isLeft ? "0vw" : "100vw";
    emoji.style.bottom = "0vh";

    const xTarget = isLeft ? Math.random() * 50 + 25 : -(Math.random() * 50 + 25);
    const yTarget = -(Math.random() * 50 + 30);
    const rotate = Math.random() * 360;

    emoji.style.setProperty("--x-move", xTarget + "vw");
    emoji.style.setProperty("--y-move", yTarget + "vh");
    emoji.style.setProperty("--rotate", rotate + "deg");

    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1000);
  }
}

function showWrongFeedback(name) {
  const imageName = portraitsMap[name] || name.split(" ")[0];
  const listZone = document.getElementById("wrongGuessList");

  const div = document.createElement("div");
  div.className = "wrong-mini";

  const img = document.createElement("img");
  img.src = `./database/img/${imageName}.webp`;
  img.alt = name;

  div.appendChild(img);
  listZone.appendChild(div);

  setTimeout(() => {
    div.classList.add("shake");
  }, 50);
}

function handleGuess() {
  if (gameOver) return;

  const input = document.getElementById("textbar");
  const guess = input.value.trim();
  if (!guess) return;

  attempts++;
  localStorage.setItem("aoaAttempts", attempts);

  updateGiveUpCounter();

  if (guess.toLowerCase() === target.toLowerCase()) {
    checkAkechiBadge(target);
    document.getElementById("aoaGif").style.filter = "none";
    showVictoryBox(target);
    showConfettiExplosion();
    revealNextLink({
      prevHref: "../emojiMode/emojiMode.html",
      nextHref: "../silhouetteMode/silhouette.html"
    });

    gameOver = true;
    localStorage.setItem("aoaGameOver", "true");
    if (!localStorage.getItem(todayKey)) {
      const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
      updateProfileStats({
        result: "win",
        mode: "All Out Attack",
        timeSpent
      });
      localStorage.setItem(todayKey, "1");
    }

    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", attempts);

    disableInputs();
    return;
  }

  showWrongFeedback(guess);
  removeFromAutocomplete(guess);

  const blurLevel = Math.max(20 - attempts * 3, 0);
  document.getElementById("aoaGif").style.filter = `blur(${blurLevel}px)`;

  input.value = "";
}

function checkAkechiBadge(characterName) {
  const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
  if (!profile) return;

  let shouldSave = false;

  if (characterName.toLowerCase().includes("crow") && characterName.toLowerCase().includes("akechi")) {
    if (!profile.foundCrow) {
      profile.foundCrow = true;
      shouldSave = true;
      console.log("🎭 Crow (Goro Akechi) found!");
    }
  }

  if (characterName.toLowerCase().includes("black mask") && characterName.toLowerCase().includes("akechi")) {
    if (!profile.foundBlackMask) {
      profile.foundBlackMask = true;
      shouldSave = true;
      console.log("🎭 Black Mask (Goro Akechi) found!");
    }
  }

  if (shouldSave) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));

    if (profile.foundCrow && profile.foundBlackMask) {
      if (!profile.pendingBadgeNotifications) {
        profile.pendingBadgeNotifications = [];
      }
      
      if (!profile.badges?.includes("truth_duality")) {
        profile.badges = profile.badges || [];
        profile.badges.push("truth_duality");
        
        if (!profile.pendingBadgeNotifications.includes("truth_duality")) {
          profile.pendingBadgeNotifications.push("truth_duality");
        }
        
        localStorage.setItem("personaUserProfile", JSON.stringify(profile));
        console.log("🎉 Truth & Duality badge unlocked!");
      }
    }
  }
}

function showVictoryBox(name) {
  const baseName = (portraitsMap[name] || name.split(" ")[0]).trim();
  const imgSrc = `./database/img/${baseName}_Battle.webp`;

  const box = document.getElementById("victoryBox");
  const img = document.getElementById("victoryImage");
  const text = document.getElementById("victoryText");

  img.src = imgSrc;
  img.alt = name;
  text.textContent = `🎉 You found ${name}!`;

  box.style.display = "flex";

  setTimeout(() => {
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300);
}

function giveUp() {
  if (attempts < 5 || gameOver) return;
  document.getElementById("aoaGif").style.filter = "none";
  showVictoryBox(target);
  showConfettiExplosion();
  disableInputs();
  gameOver = true;
  if (!localStorage.getItem(todayKey)) {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateProfileStats({
      result: "giveup",
      mode: "All Out Attack",
      timeSpent
    });
    localStorage.setItem(todayKey, "1");
    revealNextLink({
      prevHref: "../emojiMode/emojiMode.html",
      nextHref: "../silhouetteMode/silhouette.html"
    });
  }

  localStorage.setItem("aoaGameOver", "true");
  localStorage.setItem("aoaTarget", target);
  localStorage.setItem("aoaAttempts", attempts);
}

// 🔥 OPTIMISATION 7 : resetGame simplifié
function resetGame() {
  sessionStartTime = Date.now();
  localStorage.removeItem(todayKey);

  const input = document.getElementById("textbar");
  const gifElement = document.getElementById("aoaGif");
  const wrongList = document.getElementById("wrongGuessList");

  gameOver = false;
  attempts = 0;
  document.getElementById("victoryBox").style.display = "none";

  personas = getFilteredPersonas();
  const newTarget = getBetterRandomCharacter();
  if (!newTarget) return;
  target = newTarget;

  gifElement.style.filter = "none";
  showLoading(gifElement);

  const imageName = portraitsMap[target] || target.split(" ")[0];
  const newSrc = cdn("allOutAttack", imageName);

  loadImageSafely(gifElement, newSrc, () => {
    gifElement.style.filter = "blur(20px)";
  });

  // Préchargement intelligent en arrière-plan
  setTimeout(() => smartPreload(personas, 'low'), 800);

  input.disabled = false;
  document.getElementById("guessButton").disabled = false;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";
  input.value = "";

  if (wrongList) wrongList.innerHTML = "";

  initializeAutocomplete(input, personas);
  updateGiveUpCounter();

  localStorage.setItem("aoaTarget", target);
  localStorage.setItem("aoaAttempts", attempts);
  localStorage.removeItem("aoaGameOver");

  const nav = document.getElementById("modeNavigationContainer");
  if (nav) {
    nav.style.display = "none";
    nav.classList.remove("reveal-style");
  }
}

function updateGiveUpCounter() {
  const giveUpCounter = document.getElementById("giveUpCounter");
  const giveUpButton = document.getElementById("giveUpButton");

  if (giveUpCounter) {
    giveUpCounter.textContent = `(${attempts} / 5)`;
    giveUpCounter.classList.toggle("activated", attempts >= 5);
  }

  if (giveUpButton) {
    giveUpButton.disabled = attempts < 5;
    giveUpButton.style.cursor = attempts >= 5 ? "pointer" : "not-allowed";
  }
}

function disableInputs() {
  document.getElementById("textbar").disabled = true;
  document.getElementById("guessButton").disabled = true;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";
}

// 🔥 OPTIMISATION 8 : DOMContentLoaded optimisé
document.addEventListener("DOMContentLoaded", () => {
  applyDarkModeStyles();
  const textbar = document.getElementById("textbar");
  
  const savedFilters = JSON.parse(localStorage.getItem("filters_AllOutAttack"));
  if (Array.isArray(savedFilters)) {
    activeOpusFilters = savedFilters;
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    const group = btn.dataset.opus;
    if (activeOpusFilters.includes(group)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const guessButton = document.getElementById("guessButton");
  const gifElement = document.getElementById("aoaGif");

  personas = getFilteredPersonas();
  
  // Préchargement différé avec priorité basse
  setTimeout(() => smartPreload(personas, 'low'), 1500);

  initializeAutocomplete(textbar, personas);

  const savedTarget = localStorage.getItem("aoaTarget");
  const savedAttempts = parseInt(localStorage.getItem("aoaAttempts")) || 0;
  const savedGameOver = localStorage.getItem("aoaGameOver") === "true";

  if (savedTarget) {
    target = savedTarget;
    attempts = savedAttempts;
    gameOver = savedGameOver;

    const imageName = portraitsMap[target] || target.split(" ")[0];
    const src = cdn("allOutAttack", imageName);
    
    loadImageSafely(gifElement, src, () => {
      gifElement.style.filter = gameOver ? "none" : `blur(${Math.max(20 - attempts * 3, 0)}px)`;
    });

    updateGiveUpCounter();

    if (gameOver) {
      showVictoryBox(target);
      disableInputs();
      revealNextLink({
        prevHref: "../emojiMode/emojiMode.html",
        nextHref: "../silhouetteMode/silhouette.html"
      });
    }

    if (attempts >= 5) {
      document.getElementById("giveUpButton").disabled = false;
      document.getElementById("giveUpButton").style.cursor = "pointer";
    }

  } else {
    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    gifElement.style.filter = "none";
    showLoading(gifElement);

    const newSrc = cdn("allOutAttack", imageName);
    loadImageSafely(gifElement, newSrc, () => {
      gifElement.style.filter = "blur(20px)";
    });

    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", 0);
  }

  guessButton.addEventListener("click", handleGuess);
  document.getElementById("giveUpButton").addEventListener("click", giveUp);
  document.getElementById("resetButton").addEventListener("click", () => {
    localStorage.removeItem("aoaTarget");
    localStorage.removeItem("aoaAttempts");
    localStorage.removeItem("aoaGameOver");
    resetGame();
  });

  const rulesModal = document.getElementById("rulesModal");
  const rulesButton = document.getElementById("rulesButton");
  const closeRulesBtn = rulesModal.querySelector(".close");

  rulesButton.addEventListener("click", () => {
    rulesModal.style.display = "block";
    document.body.classList.add("modal-open");
  });

  closeRulesBtn.addEventListener("click", () => {
    rulesModal.style.display = "none";
    document.body.classList.remove("modal-open");
  });

  window.addEventListener("click", (e) => {
    if (e.target === rulesModal) {
      rulesModal.style.display = "none";
      document.body.classList.remove("modal-open");
    }
  });
});

checkResetOnLoad();
setupDailyReset();

// === FILTRES DYNAMIQUES ===
const filterButtons = document.querySelectorAll(".filter-btn");

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.opus;
    btn.classList.toggle("active");

    if (btn.classList.contains("active")) {
      if (!activeOpusFilters.includes(group)) activeOpusFilters.push(group);
    } else {
      activeOpusFilters = activeOpusFilters.filter(o => o !== group);
    }

    localStorage.setItem("filters_AllOutAttack", JSON.stringify(activeOpusFilters));

    personas = getFilteredPersonas();

    if (personas.length === 0) {
      alert("Aucun personnage ne correspond à ces filtres !");
      return;
    }

    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    const newSrc = cdn("allOutAttack", imageName);

    const gifElement = document.getElementById("aoaGif");
    showLoading(gifElement);
    
    loadImageSafely(gifElement, newSrc, () => {
      gifElement.style.filter = "blur(20px)";
    });

    attempts = 0;
    document.getElementById("wrongGuessList").innerHTML = "";
    document.getElementById("victoryBox").style.display = "none";
    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", 0);
    localStorage.removeItem("aoaGameOver");
    updateGiveUpCounter();

    const textbar = document.getElementById("textbar");
    initializeAutocomplete(textbar, personas);
    textbar.value = "";
    textbar.disabled = false;

    const giveUpButton = document.getElementById("giveUpButton");
    giveUpButton.disabled = true;
    giveUpButton.style.cursor = "not-allowed";
  });
});

function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;

  const emojiZone = document.querySelector(".emoji-hint-zone");
  if (emojiZone) {
    emojiZone.style.background = "rgba(20, 20, 20, 0.7)";
    emojiZone.style.boxShadow = "0 0 12px rgba(255, 255, 255, 0.2)";
  }

  const textbar = document.getElementById("textbar");
  if (textbar) {
    textbar.style.backgroundColor = "#111";
    textbar.style.color = "#fff";
    textbar.style.border = "2px solid #666";
  }

  const persoBox = document.querySelector(".personadle-box");
  if (persoBox) {
    persoBox.style.background = "rgba(10, 10, 10, 0.7)";
    persoBox.style.color = "white";
    persoBox.style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.2)";
  }

  const gifZone = document.querySelector(".aoa-gif-zone");
  if (gifZone) {
    gifZone.style.background = "rgba(20, 20, 20, 0.8)";
    gifZone.style.borderColor = "#ffaaaa";
  }

  const victoryBox = document.getElementById("victoryBox");
  if (victoryBox) {
    victoryBox.style.backgroundColor = "#1a1a1a";
    victoryBox.style.color = "#90ee90";
    victoryBox.style.border = "3px solid #4caf50";
  }
}

function revealNextLink({ nextHref = "", prevHref = "" } = {}) {
  const nav = document.getElementById("modeNavigationContainer");
  const nextButton = document.getElementById("nextModeButton");
  const prevButton = document.getElementById("prevModeButton");

  if (nextButton && nextHref) {
    nextButton.onclick = () => (location.href = nextHref);
  }

  if (prevButton) {
    if (prevHref) {
      prevButton.style.visibility = "visible";
      prevButton.onclick = () => (location.href = prevHref);
    } else {
      prevButton.style.visibility = "hidden";
      prevButton.onclick = null;
    }
  }

  if (nav) {
    nav.style.display = "flex";
    setTimeout(() => {
      nav.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1500);
  }
}

function setupDailyReset() {
  const nowInParis = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const midnightParis = new Date(nowInParis);
  midnightParis.setHours(24, 0, 0, 0);
  
  const timeUntilMidnight = midnightParis.getTime() - nowInParis.getTime();

  console.log(`🕛 Next auto-reset in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes (All Out)`);

  setTimeout(() => {
    console.log("🔄 Auto-reset triggered at Paris midnight (All Out)");
    const resetBtn = document.getElementById("resetButton");
    if (resetBtn) resetBtn.click();
    else location.reload();
  }, timeUntilMidnight + 1000);
}

function checkResetOnLoad() {
  const storedDate = localStorage.getItem("lastPlayedDate_AllOut");
  const today = new Date().toISOString().split("T")[0];

  if (storedDate !== today) {
    console.log("📅 Nouvelle journée détectée → reset automatique (All Out)");
    
    localStorage.removeItem("aoaTarget");
    localStorage.removeItem("aoaAttempts");
    localStorage.removeItem("aoaGameOver");
    
    if (storedDate) {
      const oldStatsKey = `statsLogged_AllOut_${storedDate}`;
      localStorage.removeItem(oldStatsKey);
    }
    
    localStorage.setItem("lastPlayedDate_AllOut", today);
    location.reload();
  } else {
    console.log("📅 Même jour, aucune réinitialisation nécessaire (All Out)");
  }
}