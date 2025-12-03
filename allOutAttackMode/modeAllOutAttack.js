import { personas as originalPersonas } from "./database/personas_allOut.js";
import { portraitsMap } from "./database/portraitsMap.js";
import { aoaCharacters } from "./database/aoaCharacters.js";
// 🔥 Indexation rapide des personnages pour éviter les recherches O(n²)
const AOA_BY_NAME = new Map(aoaCharacters.map(c => [c.nom, c]));

import { updateProfileStats } from "../profile/profileStats.js";



// 🌐 URL publique du bucket R2
const CDN_BASE_URL = "https://pub-39a737fc7a9c44c08b7701bdd4b2de4a.r2.dev/";

// ⚙️ Forcer le cache navigateur (si CDN le permet)
const CACHE_CONTROL = "public, max-age=86400"; // 24h

// 🚀 Détection locale : si offline, bascule sur dossier local
const IS_LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";

// 🔧 Fonction utilitaire unique et optimisée
function cdn(subfolder, filename, ext = "webp") {
 if (IS_LOCAL) {
  return `./database/allOutAttack/${encodeURIComponent(filename)}.${ext}`;
}


  // Version CDN avec paramètre de cache
  const url = `${CDN_BASE_URL}${subfolder}/${encodeURIComponent(filename)}.${ext}`;
  const params = new URLSearchParams({ cache: CACHE_CONTROL });
  return `${url}?${params}`;
}




let activeOpusFilters = ["P3", "P5","P5X"]; // filtres actifs
let sessionStartTime = Date.now();


const validOpus = {
  P3: ["P3"],
  P5: ["P5"],
  P5X: ["P5X"],
};

const todayKey = `statsLogged_AllOut_${new Date().toISOString().split("T")[0]}`;


function getFilteredPersonas() {
  const res = [];
  for (const name of originalPersonas) {
    const entry = AOA_BY_NAME.get(name);
    if (!entry) continue;

    // ✅ test ultra rapide sans .some()
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



let personas = getFilteredPersonas();
let attempts = 0;
let gameOver = false;
let target = null;
let lastFiveTargets = [];

function getBetterRandomCharacter() {
  const filteredPool = personas.filter(name => !lastFiveTargets.includes(name));
  const pool = filteredPool.length > 0 ? filteredPool : [...personas];

  if (pool.length === 0) {
    alert("Aucun personnage disponible avec les filtres actuels.");
    return null;
  }

  // Utiliser Math.random() de base, qui est suffisant pour le jeu
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
// === 🎭 DÉBLOCAGE DU BADGE AKECHI ===
function checkAkechiBadge(characterName) {
  const profile = JSON.parse(localStorage.getItem("personaUserProfile"));
  if (!profile) return;

  let shouldSave = false;

  // Vérifier si c'est Crow
  if (characterName.toLowerCase().includes("crow") && characterName.toLowerCase().includes("akechi")) {
    if (!profile.foundCrow) {
      profile.foundCrow = true;
      shouldSave = true;
      console.log("🎭 Crow (Goro Akechi) found!");
    }
  }

  // Vérifier si c'est Black Mask
  if (characterName.toLowerCase().includes("black mask") && characterName.toLowerCase().includes("akechi")) {
    if (!profile.foundBlackMask) {
      profile.foundBlackMask = true;
      shouldSave = true;
      console.log("🎭 Black Mask (Goro Akechi) found!");
    }
  }

  // Si l'un des deux a été trouvé, sauvegarder
  if (shouldSave) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));

    // Si les deux sont trouvés, ajouter une notification en attente
    if (profile.foundCrow && profile.foundBlackMask) {
      if (!profile.pendingBadgeNotifications) {
        profile.pendingBadgeNotifications = [];
      }
      
      // Ajouter le badge seulement s'il n'est pas déjà débloqué
      if (!profile.badges?.includes("truth_duality")) {
        profile.badges = profile.badges || [];
        profile.badges.push("truth_duality");
        
        // Ajouter à la liste des notifications en attente
        if (!profile.pendingBadgeNotifications.includes("truth_duality")) {
          profile.pendingBadgeNotifications.push("truth_duality");
        }
        
        localStorage.setItem("personaUserProfile", JSON.stringify(profile));
        console.log("🎉 Truth & Duality badge unlocked! Notification pending...");
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

async function preloadGifs(list) {
  const limitedList = list.slice(0, 10); // précharge seulement les 10 premiers
  for (const name of limitedList) {
    const base = portraitsMap[name] || name.split(" ")[0];
    const img = new Image();
    img.loading = "lazy";
    img.src = cdn("allOutAttack", base);
    await new Promise(r => setTimeout(r, 50)); // petit délai non bloquant
  }
}

function showLoading(gifElement) {
  gifElement.style.filter = "none";       // ✅ enlève le blur inline
  gifElement.style.opacity = "1";         // rétablit opacité normale
  gifElement.src = "../img/loading.gif";  // affiche le gif
}




function resetGame(){
  sessionStartTime = Date.now();
  localStorage.removeItem(todayKey); // 👈 Permet d'enregistrer une nouvelle victoire/giveup dans la même journée


  const input = document.getElementById("textbar");
  const gifElement = document.getElementById("aoaGif");
  const wrongList = document.getElementById("wrongGuessList");

  gameOver = false;
  attempts = 0;
  document.getElementById("victoryBox").style.display = "none";

  personas = getFilteredPersonas();
const newTarget = getBetterRandomCharacter();
if (!newTarget) return; // sécurité anti-erreur
target = newTarget;


gifElement.style.filter = "none"; // ✅ retire tout blur avant le loading
showLoading(gifElement);

const imageName = portraitsMap[target] || target.split(" ")[0];
const newSrc = cdn("allOutAttack", imageName);

// ⏳ charge la nouvelle image sans flash ni blur sur loading
const tempImg = new Image();
tempImg.src = newSrc;
tempImg.onload = () => {
  gifElement.src = newSrc;
  gifElement.style.opacity = "1"; // revient à pleine opacité
  gifElement.style.filter = "blur(20px)"; // flou uniquement sur l'image chargée
};


  // ⚡ Préchargement progressif après reset
setTimeout(() => preloadGifs(personas), 500);


  gifElement.style.filter = "blur(20px)";

  input.disabled = false;
  document.getElementById("guessButton").disabled = false;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";
  input.value = "";

  if (wrongList) wrongList.innerHTML = "";

  initializeAutocomplete(input, personas);
  updateGiveUpCounter();

  // 🟢 Sauvegarde du nouvel état
  localStorage.setItem("aoaTarget", target);
  localStorage.setItem("aoaAttempts", attempts);
  localStorage.removeItem("aoaGameOver");

const nav = document.getElementById("modeNavigationContainer");
if (nav) {
  nav.style.display = "none";
  nav.classList.remove("reveal-style");
}

}


function updateGiveUpButton() {
  const giveUpButton = document.getElementById("giveUpButton");
  giveUpButton.disabled = attempts < 5;
  giveUpButton.style.cursor = attempts >= 5 ? "pointer" : "not-allowed";
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

document.addEventListener("DOMContentLoaded", () => {
  
  applyDarkModeStyles();
  const textbar = document.getElementById("textbar");
  // ✅ Étape 1 : Lire les filtres sauvegardés
const savedFilters = JSON.parse(localStorage.getItem("filters_AllOutAttack"));
if (Array.isArray(savedFilters)) {
  activeOpusFilters = savedFilters;
}

// ✅ Étape 2 : Appliquer les états visuels aux boutons
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
// ⏳ Préchargement différé pour ne pas bloquer l'UI
setTimeout(() => preloadGifs(personas), 1000);





  initializeAutocomplete(textbar, personas);

  // === ✅ Récupération du state
  const savedTarget = localStorage.getItem("aoaTarget");
  const savedAttempts = parseInt(localStorage.getItem("aoaAttempts")) || 0;
  const savedGameOver = localStorage.getItem("aoaGameOver") === "true";

  if (savedTarget) {
    target = savedTarget;
    attempts = savedAttempts;
    gameOver = savedGameOver;

    const imageName = portraitsMap[target] || target.split(" ")[0];
    gifElement.src = cdn("allOutAttack", imageName);
    gifElement.style.filter = gameOver ? "none" : `blur(${Math.max(20 - attempts * 3, 0)}px)`;

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
    // 👇 Si aucune sauvegarde : partie normale
    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
gifElement.style.filter = "none"; // retire le blur résiduel avant loading
showLoading(gifElement);

const newSrc = cdn("allOutAttack", imageName);
const tempImg = new Image();
tempImg.src = newSrc;
tempImg.onload = () => {
  gifElement.src = newSrc;
  gifElement.style.opacity = "1";
  gifElement.style.filter = "blur(20px)";
};

    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", 0);
  }

  // === Écouteurs des boutons
  guessButton.addEventListener("click", handleGuess);
  document.getElementById("giveUpButton").addEventListener("click", giveUp);
  document.getElementById("resetButton").addEventListener("click", () => {
    localStorage.removeItem("aoaTarget");
    localStorage.removeItem("aoaAttempts");
    localStorage.removeItem("aoaGameOver");
    resetGame();
  });

  // === Modal règles
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

// === 🧠 Filtres dynamiques persistants et réactifs
const filterButtons = document.querySelectorAll(".filter-btn");

// 🔹 Étape 1 : Charger les filtres sauvegardés
const savedFilters = JSON.parse(localStorage.getItem("filters_AllOutAttack"));
if (Array.isArray(savedFilters) && savedFilters.length > 0) {
  activeOpusFilters = savedFilters;
}

// 🔹 Étape 2 : Appliquer visuellement les filtres restaurés
filterButtons.forEach((btn) => {
  const group = btn.dataset.opus;
  if (activeOpusFilters.includes(group)) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
});

// 🔹 Étape 3 : Clic sur un filtre → mise à jour dynamique + sauvegarde
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.opus;
    btn.classList.toggle("active");

    // ✅ Met à jour les filtres actifs
    if (btn.classList.contains("active")) {
      if (!activeOpusFilters.includes(group)) activeOpusFilters.push(group);
    } else {
      activeOpusFilters = activeOpusFilters.filter(o => o !== group);
    }

    // 💾 Sauvegarde immédiate
    localStorage.setItem("filters_AllOutAttack", JSON.stringify(activeOpusFilters));

    // ⚙️ Recalcule le pool de personnages filtré
    personas = getFilteredPersonas();

    // 🚫 Si plus aucun perso dispo, avertir et stopper
    if (personas.length === 0) {
      alert("Aucun personnage ne correspond à ces filtres !");
      return;
    }

    // 🔄 Nouveau personnage aléatoire adapté aux filtres
    target = getBetterRandomCharacter();
    const imageName = portraitsMap[target] || target.split(" ")[0];
    const newSrc = cdn("allOutAttack", imageName);

    const gifElement = document.getElementById("aoaGif");
    const tempImg = new Image();
    showLoading(gifElement);
    tempImg.src = newSrc;

    tempImg.onload = () => {
      gifElement.src = newSrc;
      gifElement.style.opacity = "1";
      gifElement.style.filter = "blur(20px)";
    };

    // 🧹 Reset de la partie
    attempts = 0;
    document.getElementById("wrongGuessList").innerHTML = "";
    document.getElementById("victoryBox").style.display = "none";
    localStorage.setItem("aoaTarget", target);
    localStorage.setItem("aoaAttempts", 0);
    localStorage.removeItem("aoaGameOver");
    updateGiveUpCounter();

    // 🧠 Réinitialise l’autocomplétion avec le nouveau pool
    const textbar = document.getElementById("textbar");
    initializeAutocomplete(textbar, personas);
    textbar.value = "";
    textbar.disabled = false;

    // Désactive temporairement le bouton Give Up
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
function debugAllOutAttack() {
  console.log("===== 🛠️ DEBUG ALL OUT ATTACK MODE =====");

  // Vérifie le nombre de personnages valides avec les filtres actuels
  const filtered = getFilteredPersonas();
  console.log(`🎯 Nombre de personas filtrés : ${filtered.length}`);
  console.log("🎯 Personas filtrés :", filtered);

  // Vérifie les noms présents dans originalPersonas mais absents de aoaCharacters
  const missingFromAoa = originalPersonas.filter(n =>
    !aoaCharacters.some(e => e.nom === n)
  );
  if (missingFromAoa.length > 0) {
    console.warn("❌ Noms présents dans personas_allOut.js mais ABSENTS de aoaCharacters.js :", missingFromAoa);
  } else {
    console.log("✅ Tous les noms de personas_allOut sont présents dans aoaCharacters.");
  }

  // Vérifie les noms dans aoaCharacters absents de originalPersonas
  const extraInAoa = aoaCharacters.filter(e =>
    !originalPersonas.includes(e.nom)
  );
  if (extraInAoa.length > 0) {
    console.warn("❌ Noms présents dans aoaCharacters.js mais NON listés dans personas_allOut.js :", extraInAoa.map(e => e.nom));
  } else {
    console.log("✅ Tous les noms de aoaCharacters sont listés dans personas_allOut.");
  }

  // Vérifie si les noms du pool filtré ont bien un mapping portraits
  const notMapped = filtered.filter(name => !portraitsMap[name] && !name.includes("&"));
  if (notMapped.length > 0) {
    console.warn("⚠️ Noms SANS mapping explicite dans portraitsMap :", notMapped);
  } else {
    console.log("✅ Tous les noms du pool filtré ont un mapping dans portraitsMap (ou sont des cas spéciaux).");
  }

  // Vérifie que les GIFs All-Out Attack existent
  const missingGifs = [];
  filtered.forEach(name => {
    const base = portraitsMap[name] || name.split(" ")[0];
    const path = cdn("allOutAttack", base);

    const img = new Image();
    img.onload = () => {};
    img.onerror = () => {
      missingGifs.push({ name, path });
      console.error(`❌ GIF introuvable : ${name} → ${path}`);
    };
    img.src = path;
  });

  // Affiche les infos du target actuel
  if (target) {
    console.log("🎯 Target actuel :", target);
    const targetEntry = aoaCharacters.find(c => c.nom === target);
    if (!targetEntry) {
      console.error("❌ Target NON trouvé dans aoaCharacters.js :", target);
    } else {
      console.log("✅ Target trouvé dans aoaCharacters.js :", targetEntry);
    }

    const gifName = portraitsMap[target] || target.split(" ")[0];
    const gifPath = cdn("allOutAttack", gifName);

    console.log(`🎞️ Chemin GIF : ${gifPath}`);
  } else {
    console.warn("⚠️ Target non défini actuellement.");
  }

  console.log("===== ✅ DEBUG TERMINÉ =====");
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
  // ✅ FIX : Utiliser la même méthode que pour Emoji
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
  }, timeUntilMidnight + 1000); // ✅ 1000ms au lieu de 500ms
}

function checkResetOnLoad() {
  const storedDate = localStorage.getItem("lastPlayedDate_AllOut");
  const today = new Date().toISOString().split("T")[0];

  if (storedDate !== today) {
    console.log("📅 Nouvelle journée détectée → reset automatique (All Out)");
    
    // ✅ NETTOYER TOUTES les clés du jeu AVANT de mettre à jour la date
    localStorage.removeItem("aoaTarget");
    localStorage.removeItem("aoaAttempts");
    localStorage.removeItem("aoaGameOver");
    
    // Nettoie l'ancienne entrée stats
    if (storedDate) {
      const oldStatsKey = `statsLogged_AllOut_${storedDate}`;
      localStorage.removeItem(oldStatsKey);
    }
    
    // ✅ Mettre à jour la date APRÈS le nettoyage
    localStorage.setItem("lastPlayedDate_AllOut", today);

    // ✅ Recharger la page pour forcer un état propre
    location.reload();
  } else {
    console.log("📅 Même jour, aucune réinitialisation nécessaire (All Out)");
  }
}