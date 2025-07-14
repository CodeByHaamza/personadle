import { personas as originalPersonas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { characters } from "../database/characters_clean.js";
import { updateProfileStats } from "../profile/profileStats.js";



// === Filtres par opus ===
const validOpus = {
  P1: ["P1"],
  P2: ["P2IS", "P2EP"],
  P3: ["P3", "P3FES", "P3P"],
  P4: ["P4", "P4G", "P4AU", "P4D"],
  P5: ["P5", "P5R", "P5S", "P5T"]
};

let activeOpus = ["P1", "P2", "P3", "P4", "P5"];
let personas = [...originalPersonas];
let gameOver = false;
const modeName = "Emoji";
const todayKey = `statsLogged_${modeName}_${new Date().toISOString().split("T")[0]}`;
let statsAlreadyLogged = localStorage.getItem(todayKey) === "true";
let sessionStartTime = Date.now();

let attempts = 0;
let target = null;

function filterCharacterPool() {
  const allValid = activeOpus.flatMap(o => validOpus[o]);
  return characters.filter(c => {
    const charOpus = Array.isArray(c.opus) ? c.opus : [c.opus];
    return charOpus.some(op => allValid.includes(op));
  });
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

      const matchIndex = displayName.toLowerCase().indexOf(val.toLowerCase());
      const before = displayName.substring(0, matchIndex);
      const match = displayName.substring(matchIndex, matchIndex + val.length);
      const after = displayName.substring(matchIndex + val.length);

      const option = document.createElement("DIV");
      option.className = "list-options";
      option.innerHTML = `
        <img src="../database/portraits/${portraitName}.webp" alt="${displayName} portrait"
             onerror="this.src='../database/portraits/unknown.webp'" />
        <span title="${displayName}">
          ${before}<strong style="color:#6bbf59">${match}</strong>${after}
        </span>
        <input type='hidden' value='${displayName}'>
      `;

      option.addEventListener("click", function () {
        element.value = this.getElementsByTagName("input")[0].value;
        closeList(null, element);
        document.getElementById("guessButton")?.click();
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

function updateEmojiHint() {
  const displayZone = document.getElementById("emojiDisplay");
  displayZone.innerHTML = "";

  const visibleEmojis = target.emoji.slice(0, attempts);
  visibleEmojis.forEach(e => {
    const span = document.createElement("span");
    span.textContent = e;
    span.classList.add("emoji-unit");
    displayZone.appendChild(span);
  });
}

function updateCounters() {
  const giveUpCounter = document.getElementById("giveUpCounter");
  if (giveUpCounter) {
    giveUpCounter.textContent = `(${attempts} / 8)`;
    giveUpCounter.classList.toggle("activated", attempts >= 8);
  }
}

function checkEmojiGuess(name, forceReveal = false) {
  const displayZone = document.getElementById("emojiDisplay");
  const winMessage = document.getElementById("winMessage");
  const victoryBox = document.getElementById("victoryBox");
  const victoryPortrait = document.getElementById("victoryPortrait");
  const textbar = document.getElementById("textbar");

  const guess = characters.find(c => c.nom.toLowerCase() === name.toLowerCase());
  if (!guess) {
    winMessage.textContent = `"${name}" is not in the database.`;
    return;
  }

  if (guess.nom.toLowerCase() === target.nom.toLowerCase() || forceReveal) {
    displayZone.innerHTML = "";
    target.emoji.forEach(e => {
      const span = document.createElement("span");
      span.textContent = e;
      span.classList.add("emoji-unit");
      displayZone.appendChild(span);
      // 🟩 Ajout à faire ici :
  localStorage.setItem("emojiGameOver", "true");
  localStorage.setItem("emojiForceReveal", forceReveal); // pour distinguer victoire ou give up

    });

    const imageName = portraitsMap[target.nom] || target.nom.split(" ")[0];
    const portraitName = encodeURIComponent(imageName);
    victoryPortrait.src = `../database/portraits/${portraitName}.webp`;
    victoryPortrait.alt = target.nom;

    winMessage.textContent = forceReveal
      ? `You gave up! The answer was: ${target.nom}`
      : `✅ Correct! It was ${target.nom}!`;

    victoryBox.style.display = "flex";
    showConfettiExplosion();
revealNextLink({
  prevHref: "../classiqueMode/classiqueMode.html",
  nextHref: "../allOutAttackMode/allOutAttack.html"
});

if (!statsAlreadyLogged) {
  updateProfileStats({
    result: forceReveal ? "giveup" : "win",
    mode: modeName,
    sessionTime: Date.now() - sessionStartTime
  });
  localStorage.setItem(todayKey, "true");
  statsAlreadyLogged = true;
}


    textbar.disabled = true;
    document.getElementById("guessButton").disabled = true;
    document.getElementById("giveUpButton").disabled = true;
    gameOver = true;
    localStorage.setItem("emojiWin", "true");

  } else {
    attempts++;
    localStorage.setItem("attemptsEmoji", attempts);
    updateEmojiHint();
    updateCounters();
    if (attempts >= 8) enableGiveUpButton();
  }

  removeFromAutocomplete(name);
}

function enableGiveUpButton() {
  const giveUpButton = document.getElementById("giveUpButton");
  giveUpButton.disabled = false;
  giveUpButton.style.cursor = "pointer";
}

function resetGame() {
  localStorage.removeItem(todayKey);
statsAlreadyLogged = false;
sessionStartTime = Date.now();

  const displayZone = document.getElementById("emojiDisplay");
  const winMessage = document.getElementById("winMessage");
  const textbar = document.getElementById("textbar");
  const victoryBox = document.getElementById("victoryBox");

  displayZone.innerHTML = "";
  winMessage.textContent = "";
  victoryBox.style.display = "none";

  textbar.disabled = false;
  document.getElementById("guessButton").disabled = false;
  document.getElementById("giveUpButton").disabled = true;
  document.getElementById("giveUpButton").style.cursor = "not-allowed";
  textbar.value = "";

  personas = filterCharacterPool().map(c => c.nom);
  initializeAutocomplete(textbar, personas);
  gameOver = false;
  attempts = 1;

  const filteredCharacters = filterCharacterPool();
  target = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
  localStorage.setItem("targetEmoji", JSON.stringify(target));
  localStorage.setItem("attemptsEmoji", attempts);
  updateEmojiHint();
  updateCounters();
  const nav = document.getElementById("modeNavigationContainer");
if (nav) {
  nav.style.display = "none";
  nav.classList.remove("reveal-style");
}


}

document.addEventListener("DOMContentLoaded", () => {
  applyDarkModeStyles();
  const textbar = document.getElementById("textbar");
  const guessButton = document.getElementById("guessButton");
  const giveUpButton = document.getElementById("giveUpButton");
  const resetButton = document.getElementById("resetButton");

  // === Gestion filtres ===
  const filterButtons = document.querySelectorAll(".filter-btn");
  // ✅ Lecture des filtres sauvegardés
const savedFilters = JSON.parse(localStorage.getItem("filters_Emoji"));
if (Array.isArray(savedFilters)) {
  activeOpus = savedFilters;
}

// ✅ Appliquer l’état visuel aux boutons
filterButtons.forEach(btn => {
  const filter = btn.dataset.opus;
  if (activeOpus.includes(filter)) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
});

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      activeOpus = Array.from(filterButtons)
      
        .filter(b => b.classList.contains("active"))
        .map(b => b.dataset.opus);
          // ✅ Sauvegarde dans localStorage
    localStorage.setItem("filters_Emoji", JSON.stringify(activeOpus));

      personas = filterCharacterPool().map(c => c.nom);
      initializeAutocomplete(textbar, personas);

      const filteredCharacters = filterCharacterPool();
      if (filteredCharacters.length > 0) {
        target = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
        localStorage.setItem("targetEmoji", JSON.stringify(target));
        attempts = 1;
        localStorage.setItem("attemptsEmoji", attempts);
        updateEmojiHint();
        updateCounters();
      }
    });
  });

  personas = filterCharacterPool().map(c => c.nom);
  initializeAutocomplete(textbar, personas);

  target = JSON.parse(localStorage.getItem("targetEmoji")) || filterCharacterPool()[Math.floor(Math.random() * filterCharacterPool().length)];
  attempts = parseInt(localStorage.getItem("attemptsEmoji")) || 1;
  const emojiGameOver = localStorage.getItem("emojiGameOver") === "true";
const forceReveal = localStorage.getItem("emojiForceReveal") === "true";


  localStorage.setItem("targetEmoji", JSON.stringify(target));
  localStorage.setItem("attemptsEmoji", attempts);

  updateEmojiHint();
  updateCounters();
  if (attempts >= 8) enableGiveUpButton();
  if (emojiGameOver) checkEmojiGuess(target.nom, forceReveal);


  guessButton.addEventListener("click", () => {
    if (gameOver) return;
    const guess = textbar.value.trim();
    if (!guess) return;
    checkEmojiGuess(guess);
    textbar.value = "";
  });

  // Par cette version corrigée :
giveUpButton.addEventListener("click", () => {
  // ✅ Ajouter cette vérification pour empêcher le give up si pas assez d'essais
  if (attempts < 8) return;
  
  if (!gameOver) checkEmojiGuess(target.nom, true);
});

  resetButton.addEventListener("click", () => {
    localStorage.removeItem("targetEmoji");
    localStorage.removeItem("attemptsEmoji");
    resetGame();
    localStorage.removeItem("emojiGameOver");
localStorage.removeItem("emojiForceReveal");

revealNextLink({
  prevHref: "../classiqueMode/classiqueMode.html",
  nextHref: "../allOutAttackMode/allOutAttack.html"
});


  });

  // === Modale "Comment jouer" ===
  const rulesModal = document.getElementById("rulesModal");
  const rulesBtn = document.getElementById("rulesButton");
  const closeBtn = rulesModal.querySelector(".close");

  rulesBtn.addEventListener("click", () => {
    rulesModal.style.display = "block";
    document.body.classList.add("modal-open");
  });

  closeBtn.addEventListener("click", () => {
    rulesModal.style.display = "none";
    document.body.classList.remove("modal-open");
  });

  window.addEventListener("click", (e) => {
    if (e.target === rulesModal) {
      rulesModal.style.display = "none";
      document.body.classList.remove("modal-open");
    }
checkResetOnLoad();
setupDailyReset(); // déjà présent
});
});


function applyDarkModeStyles() {
  if (document.body.classList.contains("darkmode")) {
    const emojiZone = document.querySelector(".emoji-hint-zone");
    if (emojiZone) {
      emojiZone.style.background = "rgba(20, 20, 20, 0.7)";
      emojiZone.style.boxShadow = "0 0 12px rgba(255, 255, 255, 0.2)";
    
    const autocompleteList = document.getElementById("autocompleteList");
    if (autocompleteList) {
      autocompleteList.style.backgroundColor = "#222";
      autocompleteList.style.color = "#fff";
      autocompleteList.style.border = "2px solid #666";
      autocompleteList.style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.2)";
    }

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
}

function debugCharactersFull() {
  const allValid = activeOpus.flatMap(o => validOpus[o]);
  const filtered = characters.filter(c => {
    const charOpus = Array.isArray(c.opus) ? c.opus : [c.opus];
    return charOpus.some(op => allValid.includes(op));
  });

  const missingInPersonas = [];
  const missingInPortraits = [];
  const invalidEmojis = [];

  console.log("=== DEBUG PERSONNAGES FILTRÉS ===");

  filtered.forEach((char, i) => {
    const name = char.nom;
    const foundInPersonas = personas.includes(name);
    const portraitKey = portraitsMap[name] || name.split(" ")[0];
    const hasPortrait = !!portraitKey;
    const hasEmoji = char.emoji !== undefined;
    const validEmoji = Array.isArray(char.emoji) && char.emoji.length > 0;

    let status = `✅ OK : ${name}`;

    if (!foundInPersonas) {
      status = `❌ Problème : ${name} → ❗ Absente de personas.js`;
      missingInPersonas.push(name);
    } else if (!hasPortrait) {
      status = `❌ Problème : ${name} → ❗ Aucune correspondance dans portraitsMap.js`;
      missingInPortraits.push(name);
    } else if (!hasEmoji) {
      status = `❌ Problème : ${name} → ❗ Pas de champ 'emoji' dans characters_clean.js`;
      invalidEmojis.push(name);
    } else if (!validEmoji) {
      status = `❌ Problème : ${name} → ❗ Champ 'emoji' invalide (pas un tableau non vide)`;
      invalidEmojis.push(name);
    }

    console.log(status);
  });

  console.log("\n=== RÉSUMÉ ===");
  console.log(`🔍 Personnages manquants dans personas.js : ${missingInPersonas.length}`);
  console.log(`🖼️  Personnages sans image/portrait valide : ${missingInPortraits.length}`);
  console.log(`😶 Personnages avec champ emoji absent/invalide : ${invalidEmojis.length}`);

  if (missingInPersonas.length) console.log("→ À ajouter dans personas.js :", missingInPersonas);
  if (missingInPortraits.length) console.log("→ À corriger dans portraitsMap.js :", missingInPortraits);
  if (invalidEmojis.length) console.log("→ À corriger dans characters_clean.js :", invalidEmojis);

  console.log("=== DEBUG TERMINÉ ===");
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
    else location.reload(); // Fallback si le bouton est manquant
  }, timeUntilMidnight + 500);
}

function checkResetOnLoad() {
  const storedDate = localStorage.getItem("lastPlayedDate_Emoji");
  const today = new Date().toISOString().split("T")[0];

  if (storedDate !== today) {
    console.log("📅 Nouvelle journée détectée → reset automatique (Emoji)");
    localStorage.setItem("lastPlayedDate_Emoji", today);

    // Nettoyage des stats d’hier (facultatif)
    if (storedDate) {
      const oldStatsKey = `statsLogged_Emoji_${storedDate}`;
      localStorage.removeItem(oldStatsKey);
    }

    const resetBtn = document.getElementById("resetButton");
    if (resetBtn) resetBtn.click();
    else location.reload(); // fallback si pas de bouton
  } else {
    console.log("📅 Même jour, aucune réinitialisation nécessaire (Emoji)");
  }
}
