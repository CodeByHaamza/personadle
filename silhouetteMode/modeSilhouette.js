// === IMPORTS ===
import { silhouetteCharacters as originalCharacters } from "./database/silhouetteCharacters.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { personas } from "../database/personas.js";

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
  applyZoom(currentZoom);
  silhouetteImg.src = `./database/img/${target.image}.webp`;
  silhouetteImg.alt = "Silhouette";
  silhouetteImg.style.filter = "brightness(0)";
}

// === AUTOCOMPLETE ===
function initializeAutocomplete(input, personasList) {
  let currentFocus = -1;

  input.addEventListener("input", function () {
    closeList();
    const val = this.value.trim().toLowerCase();
    if (!val) return;

    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);

    const matches = personasList
      .filter(displayName => {
        const character = originalCharacters.find(c => c.nom.toLowerCase() === displayName.toLowerCase());
        return character && !character._guessed && displayName.toLowerCase().includes(val)
          && character.opus.some(o => validOpus[activeFilters.find(f => validOpus[f].includes(o))]);
      })
      .sort((a, b) => a.localeCompare(b));

    matches.forEach(nom => {
      const imageName = portraitsMap[nom] || nom.split(" ")[0];
      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="../database/portraits/${imageName}.webp" alt="${nom}">
        <span>${nom}</span>
        <input type='hidden' value='${nom}'>
      `;
      option.addEventListener("click", function () {
        input.value = this.querySelector("input").value;
        handleGuess();
        closeList();
      });
      list.appendChild(option);
    });
  });

  input.addEventListener("keydown", function (e) {
    let items = document.querySelectorAll("#autocomplete-list .list-options");
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
  textbar.dispatchEvent(new Event("input")); // force la mise à jour de l'autocomplétion

}

// === GIVE UP
function giveUp() {
  if (attempts < maxAttempts || gameOver) return;
  showVictory(true);
}

// === RESET
function resetGame() {
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
  resetBtn.addEventListener("click", resetGame);
  giveUpBtn.addEventListener("click", giveUp);

  const usableNames = personas.sort((a, b) => a.localeCompare(b));
  initializeAutocomplete(textbar, usableNames);
  resetGame();
});
