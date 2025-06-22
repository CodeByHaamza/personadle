// === IMPORTS ===
import { silhouetteCharacters as originalCharacters } from "./database/silhouetteCharacters.js";
import { portraitsMapSilhouette as portraitsMap } from "./database/portraitsMapSilhouette.js";
import { personas } from "./database/persona.js";

// === CONSTANTES ===
const validOpus = {
  P3: ["P3", "P3P", "P3FES"],
  P4: ["P4", "P4G", "P4AU", "P4D"],
  P5: ["P5", "P5R", "P5S", "P5T"]
};

let activeFilters = ["P3", "P4", "P5"];
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
  const pool = filteredCharacters.filter(c => !lastFiveTargets.includes(c.nom));
  const choices = pool.length > 0 ? pool : [...filteredCharacters];

  target = choices[Math.floor(Math.random() * choices.length)];
  lastFiveTargets.push(target.nom);
  if (lastFiveTargets.length > 5) lastFiveTargets.shift();

  currentZoom = 1.8;

  // Avant chargement, applique zoom et cache l'image sans transition
  silhouetteImg.style.visibility = "hidden";
  silhouetteImg.style.transition = "none";
  silhouetteImg.style.transform = `scale(${currentZoom})`;
  silhouetteImg.style.filter = "brightness(0)";

  silhouetteImg.onload = () => {
    silhouetteImg.style.visibility = "visible";
    silhouetteImg.style.transition = "transform 0.3s ease-out";
  };

  silhouetteImg.src = `./database/img/${target.image}.webp`;
  silhouetteImg.alt = "Silhouette";

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
    showConfettiExplosion();
    let winCount = localStorage.getItem("silhouetteWins") || 0;
    localStorage.setItem("silhouetteWins", parseInt(winCount) + 1);
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
}

// === RESET
function resetGame() {
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
}

// === FILTRES
function setupFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.opus;
      btn.classList.toggle("active");
      if (btn.classList.contains("active")) {
        if (!activeFilters.includes(val)) activeFilters.push(val);
      } else {
        activeFilters = activeFilters.filter(o => o !== val);
      }
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
});

// =======================
// 🧪 DEBUG PERSONNAGE
// =======================
function debugAllSilhouettes() {
  console.log("=== DÉBUT DU DEBUG SILHOUETTE MODE ===");

  const errors = [];
  const usableNames = personas.sort((a, b) => a.localeCompare(b));
  const accepted = activeFilters.flatMap(o => validOpus[o]);

  for (const name of usableNames) {
    const result = { nom: name, found: false, inMap: false, inSilhouette: false, passesFilter: false };

    const character = originalCharacters.find(c => c.nom === name);
    result.inSilhouette = !!character;

    if (!character) {
      console.warn(`❌ ${name} — Introuvable dans silhouetteCharacters.js`);
      errors.push({ nom: name, cause: "Absent de silhouetteCharacters.js" });
      continue;
    }

    result.found = personas.includes(name);
    if (!result.found) {
      console.warn(`❌ ${name} — Pas présent dans personas.js`);
      errors.push({ nom: name, cause: "Absent de personas.js" });
    }

    const imageKey = portraitsMap[name];
    result.inMap = !!imageKey;
    if (!imageKey) {
      console.warn(`❌ ${name} — Aucune image dans portraitsMapSilhouette`);
      errors.push({ nom: name, cause: "Image manquante dans portraitsMapSilhouette" });
    }

    const charOpus = Array.isArray(character.opus) ? character.opus : [character.opus];
    result.passesFilter = charOpus.some(o => accepted.includes(o));
    if (!result.passesFilter) {
      console.warn(`⚠️ ${name} — Ne passe pas les filtres actuels (${charOpus})`);
    }

    // Résumé du personnage
    if (result.found && result.inMap && result.inSilhouette) {
      console.log(`✅ OK : ${name}`);
    }
  }

  // Résumé global
  if (errors.length > 0) {
    console.log(`\n=== TEST TERMINÉ : ${errors.length} problème(s) détecté(s) ===`);
    for (const err of errors) {
      console.log(`- ❌ ${err.nom} — ${err.cause}`);
    }
  } else {
    console.log("🎉 Aucune erreur détectée !");
  }

  console.log("=== FIN DU DEBUG ===");
}
