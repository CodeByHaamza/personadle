// === IMPORTS ===
import { songs as originalSongs } from "./database/songs.js";
import { musicTitles } from "./database/musicTitles.js";

// === CONSTANTES ===
const validOpus = {
  P3: ["P3", "P3P", "P3FES", "P3R"],
  P4: ["P4", "P4G", "P4AU", "P4D"],
  P5: ["P5", "P5R", "P5S", "P5T"],
  P5X: ["P5X"]

};

let activeFilters = ["P3", "P4", "P5", "P5X"];
let filteredSongs = [];
let target = null;
let attempts = 0;
const maxAttempts = 3;
let gameOver = false;
let lastFiveTargets = [];
let triedTitles = [];

let audioBox, audioPlayer, textbar, guessBtn, resetBtn, giveUpBtn, giveUpCounter, wrongList;
let victoryBox, victoryImage, victoryText;

// === DOMContentLoaded : toute l'init est ici
document.addEventListener("DOMContentLoaded", () => {
  // Récupération des éléments HTML
  textbar = document.getElementById("textbar");
  audioBox = document.getElementById("audioBox");
  audioPlayer = document.getElementById("audioPlayer");
  guessBtn = document.getElementById("guessButton");
  resetBtn = document.getElementById("resetButton");
  giveUpBtn = document.getElementById("giveUpButton");
  giveUpCounter = document.getElementById("giveUpCounter");
  wrongList = document.getElementById("wrongGuessList");
  victoryBox = document.getElementById("victoryBox");
  victoryImage = document.getElementById("victoryImage");
  victoryText = document.getElementById("victoryText");

  // === Restauration de session
  const savedTarget = localStorage.getItem("musicTarget");
  const savedAttempts = localStorage.getItem("musicAttempts");
  const savedGameOver = localStorage.getItem("musicGameOver");
  const savedTriedTitles = localStorage.getItem("musicTriedTitles");
  const savedForceReveal = localStorage.getItem("musicForceReveal");

  if (savedTarget) {
    target = JSON.parse(savedTarget);
    attempts = savedAttempts ? parseInt(savedAttempts) : 0;
    triedTitles = savedTriedTitles ? JSON.parse(savedTriedTitles) : [];
    gameOver = savedGameOver === "true";

    audioPlayer.src = `./database/music/song/${target.fichier}`;
    audioPlayer.load();

    giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;
    if (attempts >= maxAttempts) {
      giveUpBtn.disabled = false;
      giveUpCounter.classList.add("activated");
    }

    if (gameOver || savedForceReveal === "true") {
      showVictory(savedForceReveal === "true");
    }
  } else {
    resetGame();
  }

  // Setup UI
  setupFilterButtons();
  applyDarkModeStyles();
  setupRulesModal();

  guessBtn.addEventListener("click", handleGuess);
  resetBtn.addEventListener("click", resetGame);
  giveUpBtn.addEventListener("click", giveUp);

  initializeAutocomplete(textbar, musicTitles.sort((a, b) => a.localeCompare(b)));
    setupDailyReset(); // 🕛 Auto-reset every midnight (Paris time)

});



// === UTILS ===
function getFilteredSongs() {
  const accepted = activeFilters.flatMap(o => validOpus[o]);
  return originalSongs.filter(song => {
    const ops = Array.isArray(song.opus) ? song.opus : [song.opus];
    return ops.some(op => accepted.includes(op));
  });
}

function pickSong() {
  filteredSongs = getFilteredSongs();
  const pool = filteredSongs.filter(s => !lastFiveTargets.includes(s.titre));
  const choices = pool.length > 0 ? pool : [...filteredSongs];

  target = choices[Math.floor(Math.random() * choices.length)];
  localStorage.setItem("musicTarget", JSON.stringify(target));

  lastFiveTargets.push(target.titre);
  if (lastFiveTargets.length > 5) lastFiveTargets.shift();

  audioPlayer.src = `./database/music/song/${target.fichier}`;
  audioPlayer.load();

  localStorage.setItem("musicTarget", JSON.stringify(target));
  localStorage.setItem("musicAttempts", attempts);
  localStorage.setItem("musicGameOver", "false");
}

function showVictory(force = false) {
  gameOver = true;
  textbar.disabled = true;
  guessBtn.disabled = true;
  giveUpBtn.disabled = true;

  victoryImage.src = `./database/img/${target.image}`;
  victoryImage.alt = target.titre;
  const vocal = target.vocalist?.trim();
let vocalLine = "";
if (vocal) vocalLine = `<br>🧑‍🎤 Vocal: <strong>${vocal}</strong>`;

const linkLine = target.lien
  ? `<br>🔗 <a href="${target.lien}" target="_blank" class="victory-link">Listen here</a>`
  : "";

victoryText.innerHTML = force
  ? `💡 It was: <strong>${target.titre}</strong>${vocalLine}${linkLine}`
  : `🎉 Correct! It was: <strong>${target.titre}</strong>${vocalLine}${linkLine}`;


  victoryBox.style.display = "block";
  setTimeout(() => {
  victoryBox.scrollIntoView({ behavior: "smooth", block: "center" });
}, 500);

   showConfettiExplosion();
  localStorage.setItem("musicGameOver", "true");

  // ⏮ Affiche le lien vers Personae Mode
  revealNextLink({
    prevHref: "../personaeMode/personae.html"
  });

}

function showWrong(name) {
  const match = originalSongs.find(song => song.titre.toLowerCase() === name.toLowerCase());

  const div = document.createElement("div");
  div.className = "wrong-mini";

  if (match) {
    div.innerHTML = `
      <img src="./database/img/${match.image}" alt="${name}" class="wrong-img">
      <span class="wrong-name">${name}</span>
    `;
  } else {
    div.textContent = name;
  }

  wrongList.appendChild(div);
  setTimeout(() => div.classList.add("shake"), 50);
}

// === GAME LOGIC ===
function handleGuess() {
  if (gameOver) return;
  const guess = textbar.value.trim();
  if (!triedTitles.includes(guess)) triedTitles.push(guess);

  if (!guess) return;

  attempts++;
  localStorage.setItem("musicAttempts", attempts);
localStorage.setItem("musicTriedTitles", JSON.stringify(triedTitles));

  giveUpCounter.textContent = `(${attempts} / ${maxAttempts})`;

  if (attempts >= maxAttempts) {
    giveUpBtn.disabled = false;
    giveUpCounter.classList.add("activated");
  }

if (normalize(guess) === normalize(target.titre)) {
    showVictory(false);
  } else {
    showWrong(guess);
  }

  textbar.value = "";
}

function giveUp() {
  if (attempts < maxAttempts || gameOver) return;
  gameOver = true;
  localStorage.setItem("musicForceReveal", "true");

  showVictory(true);
}

function resetGame() {
  localStorage.removeItem("musicTarget");
localStorage.removeItem("musicAttempts");
localStorage.removeItem("musicGameOver");
localStorage.removeItem("musicTriedTitles");
localStorage.removeItem("musicForceReveal");

  gameOver = false;
  attempts = 0;
  triedTitles = [];

  giveUpCounter.textContent = `(0 / ${maxAttempts})`;
  giveUpCounter.classList.remove("activated");
  giveUpBtn.disabled = true;
  textbar.disabled = false;
  guessBtn.disabled = false;
  wrongList.innerHTML = "";
  textbar.value = "";
  victoryBox.style.display = "none";
  victoryText.innerHTML = "";
  victoryImage.src = "";
  pickSong();
  // Cache le container des liens de navigation
const navContainer = document.getElementById("modeNavigationContainer");
if (navContainer) navContainer.style.display = "none";

}

// === AUTOCOMPLETE ===
function initializeAutocomplete(input, titlesList) {
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
const acceptedOpus = activeFilters.flatMap(o => validOpus[o]);

const matches = originalSongs
  .filter(song => {
    const songOpus = Array.isArray(song.opus) ? song.opus : [song.opus];
    return (
      song.titre.toLowerCase().includes(lowerVal) &&
      !triedTitles.includes(song.titre) &&
      songOpus.some(op => acceptedOpus.includes(op))
    );
  })
  .map(song => song.titre);


   matches.forEach(nom => {
  const songData = originalSongs.find(s => s.titre === nom);
  const imagePath = songData ? `./database/img/${songData.image}` : "";

  const option = document.createElement("DIV");
  option.className = "list-options";
  option.innerHTML = `
    <img src="${imagePath}" alt="${nom}" class="autocomplete-thumb">
    <span class="codename">${nom}</span>
<input type="hidden" value="${nom.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">
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

// === UI SETUP ===
function setupFilterButtons() {
  const btns = document.querySelectorAll(".filter-btn");

  btns.forEach(btn => {
    const val = btn.dataset.opus;
    if (activeFilters.includes(val)) btn.classList.add("active");
    else btn.classList.remove("active");

    btn.addEventListener("click", () => {
      const val = btn.dataset.opus;
      btn.classList.toggle("active");

      if (btn.classList.contains("active")) {
        if (!activeFilters.includes(val)) activeFilters.push(val);
      } else {
        activeFilters = activeFilters.filter(o => o !== val);
      }

      localStorage.setItem("musicActiveFilters", JSON.stringify(activeFilters));
      resetGame();
    });
  });
}

function setupRulesModal() {
  const modal = document.getElementById("rulesModal");
  const btn = document.getElementById("rulesButton");
  const closeBtn = modal.querySelector(".close");
  btn.addEventListener("click", () => modal.style.display = "block");
  closeBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
}

function applyDarkModeStyles() {
  if (!document.body.classList.contains("darkmode")) return;
  if (audioBox) {
    audioBox.style.backgroundColor = "#222";
    audioBox.style.border = "3px solid #888";
  }
}

// === CONFETTIS ===
function showConfettiExplosion() {
  const emojiList = ["🎵", "🎶", "🎉", "✨"];
  const numEmojis = 30;

  for (let i = 0; i < numEmojis; i++) {
    const emoji = document.createElement("span");
    emoji.textContent = emojiList[Math.floor(Math.random() * emojiList.length)];
    emoji.classList.add("confetti-emoji");
    emoji.style.left = Math.random() * 100 + "vw";
    emoji.style.bottom = "0vh";
    emoji.style.setProperty("--x-move", (Math.random() * 100 - 50) + "vw");
    emoji.style.setProperty("--y-move", -(Math.random() * 50 + 30) + "vh");
    emoji.style.setProperty("--rotate", Math.random() * 360 + "deg");
    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1000);
  }
}

function normalize(str) {
  return str
    .normalize("NFD") // Enlève les accents
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'") // Remplace les apostrophes typographiques par la simple
    .replace(/"/g, "") // (optionnel) supprime les guillemets
    .trim()
    .toLowerCase();
}


// === DEBUG ===
export function debugAllMusic() {
  console.log("=== DEBUG MUSIC MODE ===");
  const errors = [];
  const usableTitles = musicTitles.sort();
  for (const name of usableTitles) {
    const match = originalSongs.find(s => s.titre === name);
    if (!match) errors.push(`❌ ${name} — Missing from songs.js`);
    else console.log(`✅ OK: ${name}`);
  }
  if (errors.length) console.log(errors.join("\n"));
  else console.log("🎉 No missing titles!");
}
debugAllMusic();

function revealNextLink({ prevHref = null, nextHref = null } = {}) {
  const container = document.getElementById("modeNavigationContainer");
  const prev = document.getElementById("prevModeButton");
  const next = document.getElementById("nextModeButton");

  if (prevHref) {
    prev.style.visibility = "visible";
    prev.onclick = () => (window.location.href = prevHref);
  }

  if (nextHref) {
    next.style.visibility = "visible";
    next.onclick = () => (window.location.href = nextHref);
  }

  container.style.display = "flex";

  setTimeout(() => {
    container.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 1500);
}

function setupDailyReset() {
  const parisOffset = new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" });
  const parisNow = new Date(parisOffset);
  const tomorrow = new Date(parisNow);
  tomorrow.setDate(parisNow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilMidnight = tomorrow.getTime() - parisNow.getTime();

  console.log(`🕛 Next auto-reset in ${Math.round(timeUntilMidnight / 60000)} minutes`);

  setTimeout(() => {
    console.log("🔄 Auto-reset triggered at Paris midnight");
    const resetBtn = document.getElementById("resetButton");
    if (resetBtn) resetBtn.click();
    else location.reload(); // fallback
  }, timeUntilMidnight + 500);
}
