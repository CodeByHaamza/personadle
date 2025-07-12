// === IMPORTS ===
import { silhouetteCharacters as originalCharacters } from "./database/silhouetteCharacters.js";
import { portraitsMapSilhouette as portraitsMap } from "./database/portraitsMapSilhouette.js";
import { personas } from "./database/persona.js";
import { updateProfileStats } from "../profile/profileStats.js";

const modeName = "Shadow";
const todayKey = `statsLogged_${modeName}_${new Date().toISOString().split("T")[0]}`;
let statsAlreadyLogged = localStorage.getItem(todayKey) === "true";
let sessionStartTime = Date.now();


// === CONSTANTES ===
const validOpus = {
  P3: ["P3", "P3P", "P3FES"],
  P4: ["P4", "P4G", "P4AU", "P4D"],
  P5: ["P5", "P5R", "P5S", "P5T"],
  P5X: ["P5X"],
};

let activeFilters = ["P3", "P4", "P5", "P5X"]; // Filtres actifs par défaut
const storedFilters = localStorage.getItem("silhouetteActiveFilters");
if (storedFilters) {
  try {
    const parsed = JSON.parse(storedFilters);
    if (Array.isArray(parsed)) activeFilters = parsed;
  } catch (e) {
    console.warn("⚠️ Erreur lecture filtre localStorage:", e);
  }
}
let filteredCharacters = [];
let target = null;
let attempts = 0;
const maxAttempts = 5;
let maxZoomOut = 1;
let currentZoom = 1.8;
let gameOver = false;
let lastFiveTargets = [];

// === ELEMENTS ===
const textbar = document.getElementById("textbar");
const silhouetteImg = document.getElementById("silhouetteImage");
silhouetteImg.style.visibility = "hidden";
silhouetteImg.style.transform = "scale(1.8)";
silhouetteImg.style.transition = "none";

const guessBtn = document.getElementById("guessButton");
const resetBtn = document.getElementById("resetButton");
const giveUpBtn = document.getElementById("giveUpButton");
const giveUpCounter = document.getElementById("giveUpCounter");
const wrongList = document.getElementById("wrongGuessList");
const silhouetteBox = document.querySelector(".silhouette-box");

// === FILTRAGE ===
function getFilteredCharacters() {
  const accepted = activeFilters.flatMap(o => validOpus[o]);
  return originalCharacters.filter(c => {
    const op = Array.isArray(c.opus) ? c.opus : [c.opus];
    return op.some(o => accepted.includes(o));
  });
}

// === ZOOM ===
function applyZoom(zoomFactor) {
  silhouetteImg.style.transform = `scale(${zoomFactor})`;
}

// === RANDOM ===
function pickCharacter() {
  filteredCharacters = getFilteredCharacters();
  if (filteredCharacters.length === 0) {
    console.error("❌ Aucun personnage disponible après filtrage. Vérifie les filtres actifs ou les données.");
    return;
  }

  const pool = filteredCharacters.filter(c => !lastFiveTargets.includes(c.nom));
  const choices = pool.length > 0 ? pool : [...filteredCharacters];

  target = choices[Math.floor(Math.random() * choices.length)];
  if (!target) {
    console.error("❌ Aucune cible (target) définie. Vérifie le contenu de 'choices'.");
    return;
  }

  target = choices[Math.floor(Math.random() * choices.length)];
  lastFiveTargets.push(target.nom);
  if (lastFiveTargets.length > 5) lastFiveTargets.shift();

  currentZoom = 1.8;

  // Cache l'image pendant le chargement
  silhouetteImg.style.visibility = "hidden";
  silhouetteImg.style.transition = "none";
  silhouetteImg.style.transform = `scale(${currentZoom})`;
  silhouetteImg.style.filter = "brightness(0)";
  silhouetteImg.src = ""; // vide temporairement pour éviter le flash

  // Pré-charge via objet Image
  const tempImage = new Image();
  tempImage.onload = () => {
    silhouetteImg.src = tempImage.src;
    silhouetteImg.alt = "Silhouette";
    silhouetteImg.style.visibility = "visible";
    silhouetteImg.style.transition = "transform 0.3s ease-out";
  };
  tempImage.src = `./database/img/${target.image}.webp`;

  // Sauvegarde dans localStorage
  localStorage.setItem("silhouetteTarget", JSON.stringify(target));
  localStorage.setItem("silhouetteAttempts", attempts);
  localStorage.setItem("silhouetteGameOver", "false");
}


// === AUTOCOMPLETE ===
function initializeAutocomplete(input, personasList) {
  let currentFocus = -1;

  input.addEventListener("input", function () {
    closeList();
    const val = this.value.trim();
    if (!val) return;

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);

    const lowerVal = val.toLowerCase();
    const matches = [];

    for (let i = 0; i < personasList.length; i++) {
      const displayName = personasList[i];
      const lowerName = displayName.toLowerCase();

      const character = originalCharacters.find(c => c.nom.trim().toLowerCase() === displayName.trim().toLowerCase());
      if (
        !character ||
        character._guessed ||
        !lowerName.includes(lowerVal) ||
        !character.opus.some(o => validOpus[activeFilters.find(f => validOpus[f].includes(o))])
      ) continue;

      const [firstName, lastName] = displayName.split(" ");
      let priority = 3;
      if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
      else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;

      matches.push({ name: displayName, priority });
    }

    matches.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    matches.forEach(matchObj => {
      const nom = matchObj.name;
      const imageName = portraitsMap[nom] || nom.split(" ")[0];
      const portraitName = encodeURIComponent(imageName);
      const realName = nom.includes("(") ? nom.split("(")[1].replace(")", "") : "";

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="../database/portraits/${portraitName}.webp" alt="${nom}">
        <span style="display: flex; flex-direction: column;">
          <span class="codename">${nom.split(" (")[0]}</span>
          ${realName ? `<span class="realname">(${realName})</span>` : ""}
        </span>
        <input type='hidden' value='${nom}'>
      `;

      option.addEventListener("click", function () {
        input.value = this.querySelector("input").value;
        handleGuess();
        closeList();
      });

      list.appendChild(option);
    });

    currentFocus = -1;
  });

  input.addEventListener("keydown", function (e) {
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

  document.addEventListener("click", function (e) {
    if (!e.target.closest("#autocomplete-list") && e.target !== input) {
      closeList();
    }
  });

  function updateActive(items) {
    items.forEach(i => i.classList.remove("autocomplete-active"));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add("autocomplete-active");
    items[currentFocus].scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function closeList() {
    const lists = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < lists.length; i++) {
      lists[i].parentNode.removeChild(lists[i]);
    }
  }
}

// === CONFETTIS ===
function showConfettiExplosion() {
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

// === VICTOIRE
function showVictory(force = false) {
  gameOver = true;
  textbar.disabled = true;
  guessBtn.disabled = true;
  giveUpBtn.disabled = true;

  silhouetteImg.style.transform = "scale(1)";
  silhouetteImg.style.filter = "none";

  document.querySelectorAll(".victory-message").forEach(e => e.remove());
  const message = document.createElement("div");
  message.className = "victory-box";
  message.innerHTML = force
    ? `<span class="failure-text">❌ The answer was <strong>${target.nom}</strong></span>`
    : `<span class="success-text">🎉 You found <strong>${target.nom}</strong>!</span>`;

  silhouetteBox.insertAdjacentElement("afterend", message);

  if (!force) {
      if (!statsAlreadyLogged) {
    updateProfileStats({
      result: "win",
      mode: modeName,
      sessionDuration: Date.now() - sessionStartTime
    });
    localStorage.setItem(todayKey, "true");
  }

    showConfettiExplosion();
revealNextLink({
  prevHref: "../allOutAttackMode/allOutAttack.html",
  nextHref: "../personaeMode/personae.html"
});
    let winCount = localStorage.getItem("silhouetteWins") || 0;
    localStorage.setItem("silhouetteWins", parseInt(winCount) + 1);
  } else {
revealNextLink({
  prevHref: "../allOutAttackMode/allOutAttack.html",
  nextHref: "../personaeMode/personae.html"
});
  }

  localStorage.setItem("silhouetteGameOver", "true");
  localStorage.setItem("silhouetteForceReveal", force);
}


// === ERREUR
function showWrong(name) {
  const char = originalCharacters.find(c => c.nom.toLowerCase() === name.toLowerCase());
  if (!char || char._guessed) return;
  char._guessed = true;

  const imageName = portraitsMap[char.nom] || char.nom.split(" ")[0];
  const div = document.createElement("div");
  div.className = "wrong-mini";

  const img = document.createElement("img");
  img.src = `../database/portraits/${imageName}.webp`;
  img.alt = name;

  div.appendChild(img);
  wrongList.appendChild(div);
  setTimeout(() => div.classList.add("shake"), 50);
}

// === GUESS
function handleGuess() {
  if (gameOver) return;
  const guess = textbar.value.trim().toLowerCase();
  if (!guess) return;

  attempts++;
  localStorage.setItem("silhouetteAttempts", attempts);
  giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;

  if (attempts >= maxAttempts) {
    giveUpBtn.disabled = false;
    giveUpBtn.style.cursor = "pointer";
    giveUpCounter.classList.add("activated");
  }

  const found = guess === target.nom.toLowerCase();
  if (found) {
    showVictory();
  } else {
    showWrong(guess);
    if (currentZoom > maxZoomOut) {
      currentZoom = Math.max(maxZoomOut, currentZoom - 0.2);
      applyZoom(currentZoom);
    }
  }

  textbar.value = "";
  textbar.dispatchEvent(new Event("input")); // force update autocomplete
}

// === GIVE UP
function giveUp() {
  if (attempts < maxAttempts || gameOver) return;
  showVictory(true);
  if (!statsAlreadyLogged) {
  updateProfileStats({
    result: "giveup",
    mode: modeName,
    sessionDuration: Date.now() - sessionStartTime
  });
  localStorage.setItem(todayKey, "true");
}

}

// === RESET
function resetGame() {
  const nav = document.getElementById("modeNavigationContainer");
if (nav) nav.style.display = "none";

  localStorage.removeItem("silhouetteForceReveal");

  gameOver = false;
  attempts = 0;
  giveUpCounter.textContent = `(0 / ${maxAttempts})`;
  giveUpCounter.classList.remove("activated");
  giveUpBtn.disabled = true;
  giveUpBtn.style.cursor = "not-allowed";
  textbar.disabled = false;
  guessBtn.disabled = false;
  wrongList.innerHTML = "";
  textbar.value = "";
  document.querySelectorAll(".victory-message, .victory-box").forEach(e => e.remove());

  originalCharacters.forEach(c => c._guessed = false);
  pickCharacter();
  const next = document.getElementById("nextLinkContainer");
if (next) {
  next.style.display = "none";
  next.classList.remove("reveal-style");
}

}

// === FILTRES
function setupFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    const val = btn.dataset.opus;

    // ✅ Restaure l'état visuel au chargement
    if (activeFilters.includes(val)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

    btn.addEventListener("click", () => {
      btn.classList.toggle("active");

      if (btn.classList.contains("active")) {
        if (!activeFilters.includes(val)) activeFilters.push(val);
      } else {
        activeFilters = activeFilters.filter(o => o !== val);
      }

      // ✅ Sauvegarde dans localStorage
      localStorage.setItem("silhouetteActiveFilters", JSON.stringify(activeFilters));

      resetGame();
    });
  });
}


// === RÈGLES
function setupRulesModal() {
  const modal = document.getElementById("rulesModal");
  const btn = document.getElementById("rulesButton");
  const closeBtn = modal.querySelector(".close");

  btn.addEventListener("click", () => { modal.style.display = "block"; });
  closeBtn.addEventListener("click", () => { modal.style.display = "none"; });
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

// === DARK MODE
function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;
  const zone = document.querySelector(".silhouette-box");
  if (zone) {
    zone.style.backgroundColor = "#222";
    zone.style.border = "3px solid #888";
  }
}

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  setupRulesModal();
  setupFilterButtons();
  applyDarkModeStyles();

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", () => {
    localStorage.removeItem("silhouetteTarget");
    localStorage.removeItem("silhouetteAttempts");
    localStorage.removeItem("silhouetteGameOver");


  localStorage.removeItem(todayKey);
  statsAlreadyLogged = false;
  sessionStartTime = Date.now();
  
    resetGame();
  });
  giveUpBtn.addEventListener("click", giveUp);

  const usableNames = personas.sort((a, b) => a.localeCompare(b));
  initializeAutocomplete(textbar, usableNames);

  // === 🧠 Restore session ===
  const stored = localStorage.getItem("silhouetteTarget");
  const storedAttempts = parseInt(localStorage.getItem("silhouetteAttempts")) || 0;
  const storedGameOver = localStorage.getItem("silhouetteGameOver") === "true";

  if (stored) {
    try {
      target = JSON.parse(stored);
      filteredCharacters = getFilteredCharacters();
      currentZoom = 1.8 - 0.2 * storedAttempts;
      applyZoom(currentZoom);
      silhouetteImg.style.visibility = "hidden";
      silhouetteImg.style.transition = "none";
      silhouetteImg.style.transform = `scale(1.8)`;
      silhouetteImg.src = `./database/img/${target.image}.webp`;
      silhouetteImg.alt = "Silhouette";
      silhouetteImg.style.filter = storedGameOver ? "none" : "brightness(0)";
      attempts = storedAttempts;
      giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;
      if (attempts >= maxAttempts) {
        giveUpBtn.disabled = false;
        giveUpBtn.style.cursor = "pointer";
        giveUpCounter.classList.add("activated");
      }
      if (storedGameOver) showVictory(localStorage.getItem("silhouetteForceReveal") === "true");
      if (storedGameOver) revealNextLink();


      silhouetteImg.onload = () => {
        silhouetteImg.style.visibility = "visible";
        silhouetteImg.style.transition = "transform 0.3s ease-out";
      };

    } catch (e) {
      resetGame();
    }
  } else {
    resetGame();
  }
    setupDailyReset(); // 🕛 Auto-reset every midnight (Paris time)

});

// =======================
// 🧪 DEBUG PERSONNAGE
// =======================
function debugAllSilhouettes() {
  console.log("🔍 === DÉBUT DU DEBUG SILHOUETTE MODE ===");

  const errors = [];
  const warnings = [];

  const usableNames = [...personas].sort((a, b) => a.localeCompare(b));
  const accepted = activeFilters.flatMap(o => validOpus[o]);

  const foundInSilhouette = new Set(originalCharacters.map(c => c.nom));
  const foundInPersonas = new Set(usableNames);
  const foundInMap = new Set(Object.keys(portraitsMap));

  // === Analyse des noms depuis personas.js ===
  for (const name of usableNames) {
    const inSilhouette = foundInSilhouette.has(name);
    const inMap = foundInMap.has(name);

    if (!inSilhouette) {
      console.warn(`❌ ${name} — Introuvable dans silhouetteCharacters.js`);
      errors.push({ nom: name, cause: "Absent de silhouetteCharacters.js" });
    }

    if (!inMap) {
      console.warn(`❌ ${name} — Image manquante dans portraitsMapSilhouette`);
      errors.push({ nom: name, cause: "Image manquante dans portraitsMapSilhouette" });
    }

    if (inSilhouette) {
      const character = originalCharacters.find(c => c.nom === name);
      const charOpus = Array.isArray(character.opus) ? character.opus : [character.opus];
      const passesFilter = charOpus.some(o => accepted.includes(o));
      if (!passesFilter) {
        console.warn(`⚠️ ${name} — Ne passe pas les filtres actuels (${charOpus.join(", ")})`);
        warnings.push({ nom: name, cause: "Non concerné par les filtres" });
      } else {
        console.log(`✅ ${name} — OK`);
      }
    }
  }

  // === Noms dans silhouetteCharacters non présents dans personas.js ===
  for (const character of originalCharacters) {
    if (!foundInPersonas.has(character.nom)) {
      console.warn(`❌ ${character.nom} — Présent dans silhouetteCharacters.js mais NON listé dans personas.js`);
      errors.push({ nom: character.nom, cause: "Absent de personas.js" });
    }
  }

  // === Résumé final ===
  const total = usableNames.length;
  const totalSilhouettes = originalCharacters.length;
  const totalErrors = errors.length;
  const totalWarnings = warnings.length;

  console.log(`\n📊 === RÉSUMÉ DU DEBUG SILHOUETTE ===`);
  console.log(`🔢 Total de noms dans personas.js : ${total}`);
  console.log(`📁 Total de silhouettes dans silhouetteCharacters.js : ${totalSilhouettes}`);
  console.log(`❌ Erreurs détectées : ${totalErrors}`);
  console.log(`⚠️ Avertissements (filtres) : ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log(`\n🛑 Liste des erreurs :`);
    for (const err of errors) {
      console.log(`- ❌ ${err.nom} — ${err.cause}`);
    }
  }

  console.log("✅ === FIN DU DEBUG ===");
}


function revealNextLink({ nextHref = "../personaeMode/personae.html", prevHref = "../allOutAttackMode/allOutAttack.html" } = {}) {
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
  const parisOffset = new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" });
  const parisNow = new Date(parisOffset);
  const tomorrow = new Date(parisNow);
  tomorrow.setDate(parisNow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilMidnight = tomorrow.getTime() - parisNow.getTime();

  console.log(`🕛 Next auto-reset in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`);

  setTimeout(() => {
    console.log("🔄 Auto-reset triggered at Paris midnight");
    const resetBtn = document.getElementById("resetButton");
    if (resetBtn) resetBtn.click();
    else location.reload();
  }, timeUntilMidnight + 500);
}

