import { personas as originalPersonas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { characters } from "../database/characters_clean.js";

let personas = [...originalPersonas];
let gameOver = false;

// === Filtres par opus ===
const validOpus = {
  P1: ["P1"],
  P2: ["P2IS", "P2EP"],
  P3: ["P3", "P3FES", "P3P"],
  P4: ["P4", "P4G", "P4AU", "P4D"],
  P5: ["P5", "P5R", "P5S", "P5T"]
};

let activeOpus = ["P1", "P2", "P3", "P4", "P5"];

let daltonianMode = localStorage.getItem("daltonianMode") === "enabled";
const daltonianToggle = document.getElementById("daltonianToggle");
daltonianToggle.textContent = `Daltonian Mode: ${daltonianMode ? "ON" : "OFF"}`;




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

    matches.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });

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
      if (currentFocus > -1) {
        items[currentFocus].click();
      } else {
        items[0]?.click();
      }
    }
  });

  function updateActive(items) {
    if (!items) return;
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
  for (let i = 0; i < items.length; i++) {
    if (e !== items[i] && e !== inputElement) {
      items[i].parentNode.removeChild(items[i]);
    }
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

// === Filtres opus ===
function filterCharacterPool() {
  const allValid = activeOpus.flatMap(o => validOpus[o]);

  personas = originalPersonas.filter(name => {
    const character = characters.find(c => c.nom === name);
    if (!character || !character.opus) return false;
    const charOpus = Array.isArray(character.opus) ? character.opus : [character.opus];
    return charOpus.some(op => allValid.includes(op));
  });

  initializeAutocomplete(document.getElementById("textbar"), personas);
}

document.addEventListener("DOMContentLoaded", () => {
  applyDarkModeStyles();
  const textbar = document.getElementById("textbar");
  const guessButton = document.getElementById("guessButton");
  const hintButton = document.getElementById("hintButton");
  const quoteHint = document.getElementById("quoteHint");
  const output = document.getElementById("output");
  const resetButton = document.getElementById("resetButton");
  const giveUpButton = document.getElementById("giveUpButton");
  const giveUpCounter = document.getElementById("giveUpCounter");
  const hintCounter = document.getElementById("hintCounter");

  // Filtres actifs
  const filterButtons = document.querySelectorAll(".filter-btn");
  filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("active");

    activeOpus = Array.from(filterButtons)
      .filter(b => b.classList.contains("active"))
      .map(b => b.dataset.opus);

    filterCharacterPool();

    // 🔁 Corriger ici : changer aussi le personnage tiré !
    const filteredCharacters = characters.filter(c => {
      const charOpus = Array.isArray(c.opus) ? c.opus : [c.opus];
      return charOpus.some(op => activeOpus.flatMap(o => validOpus[o]).includes(op));
    });

    if (filteredCharacters.length > 0) {
      target = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
      localStorage.setItem("target", JSON.stringify(target));
    } else {
      console.warn("⚠ No characters match the selected filters.");
    }
  });
});


  filterCharacterPool();

  let attempts = parseInt(localStorage.getItem("attempts")) || 0;
  let target = JSON.parse(localStorage.getItem("target"));
  let history = JSON.parse(localStorage.getItem("guessHistory")) || [];

  if (history.includes(target?.nom)) {
  gameOver = true;
  textbar.disabled = true;
  guessButton.disabled = true;
  giveUpButton.disabled = true;
  revealNextLink(); // ✅ Affiche le lien si la partie est terminée
}


  if (!target) {
    const filteredCharacters = characters.filter(c => {
      const charOpus = Array.isArray(c.opus) ? c.opus : [c.opus];
      return charOpus.some(op => activeOpus.flatMap(o => validOpus[o]).includes(op));
    });
    target = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
    localStorage.setItem("target", JSON.stringify(target));
  }

  history.forEach(name => checkGuess(name, target));

  updateCounters();
  if (attempts >= 3) enableHintButton();
  if (attempts >= 8) enableGiveUpButton();

  guessButton.addEventListener("click", () => {
    if (gameOver) return;
    const guessName = textbar.value.trim();
    if (!guessName) return;
    attempts++;
    localStorage.setItem("attempts", attempts);
    history.push(guessName);
    localStorage.setItem("guessHistory", JSON.stringify(history));
    updateCounters();
    if (attempts >= 3) enableHintButton();
    if (attempts >= 8) enableGiveUpButton();
    checkGuess(guessName, target);
    textbar.value = "";
  });

  resetButton.addEventListener("click", () => {
    localStorage.removeItem("target");
    localStorage.removeItem("attempts");
    localStorage.removeItem("guessHistory");
    attempts = 0;
    history = [];
    updateCounters();
    output.innerHTML = "";
    quoteHint.style.display = "none";
    textbar.disabled = false;
    guessButton.disabled = false;
    hintButton.disabled = true;
    hintButton.style.cursor = "not-allowed";
    giveUpButton.disabled = true;
    giveUpButton.style.cursor = "not-allowed";
    giveUpCounter.textContent = "(0 / 8)";
    hintCounter.textContent = "(0 / 3)";
    textbar.value = "";
    filterCharacterPool();
    gameOver = false;

    const filteredCharacters = characters.filter(c => {
      const charOpus = Array.isArray(c.opus) ? c.opus : [c.opus];
      return charOpus.some(op => activeOpus.flatMap(o => validOpus[o]).includes(op));
    });
    target = filteredCharacters[Math.floor(Math.random() * filteredCharacters.length)];
    localStorage.setItem("target", JSON.stringify(target));

    const next = document.getElementById("nextLinkContainer");
if (next) {
  next.style.display = "none";
  next.classList.remove("reveal-style");
}

  });

  hintButton.addEventListener("click", () => {
  // ✅ Ajouter cette vérification pour empêcher le hint si pas assez d'essais
  if (attempts < 3) return;
  
  if (target && target.quote) {
    quoteHint.textContent = target.quote;
    quoteHint.style.display = "block";
    hintButton.disabled = true;
    hintButton.style.cursor = "not-allowed";
  }
});
  giveUpButton.addEventListener("click", () => {
    if (attempts < 8) return;
    if (target && target.nom) {
      checkGuess(target.nom, target, true);
    }
    textbar.disabled = true;
    guessButton.disabled = true;
    giveUpButton.disabled = true;
    gameOver = true;
    if (!history.includes(target.nom)) {
      history.push(target.nom);
      localStorage.setItem("guessHistory", JSON.stringify(history));
    }
  });

  function updateCounters() {
    if (hintCounter) {
      hintCounter.textContent = `(${attempts} / 3)`;
      hintCounter.classList.toggle("activated", attempts >= 3);
    }
    if (giveUpCounter) {
      giveUpCounter.textContent = `(${attempts} / 8)`;
      giveUpCounter.classList.toggle("activated", attempts >= 8);
    }
  }

  function enableHintButton() {
    hintButton.disabled = false;
    hintButton.style.cursor = "pointer";
  }

  function enableGiveUpButton() {
    giveUpButton.disabled = false;
    giveUpButton.style.cursor = "pointer";
  }

  function convertAgeToValue(age) {
    const map = {
      "< 15": 10,
      "15-20": 17.5,
      "21-40": 30,
      "40+": 50,
      "80+": 85
    };
    return map[age] ?? -1;
  }


  function checkGuess(name, target, forceReveal = false) {
    const guess = characters.find(c => c.nom.toLowerCase() === name.toLowerCase());
    if (!guess) {
      output.innerHTML += `<p class="wrong">${name} does not exist in the database!</p>`;
      return;
    }

    if (!document.querySelector(".category-row")) {
      const categoryRow = document.createElement("div");
      categoryRow.classList.add("category-row");
      categoryRow.innerHTML = `
      <div></div>
      <div class="tooltip">Name<span class="tooltip-text">The full name of the character as known in the Persona universe.</span></div>
      <div class="tooltip">Gender<span class="tooltip-text">Represents the character’s identity or nature — can be Human, Artificial, Shadow, or Entity.</span></div>
      <div class="tooltip">Age<span class="tooltip-text">Age range based on lore, from "< 15" to "40+", including unique entities like "80+".</span></div>
      <div class="tooltip">Persona User / Shadow<span class="tooltip-text">Indicates if the character can summon a Persona or is a Shadow themselves.</span></div>
      <div class="tooltip">Persona / Shadow<span class="tooltip-text">The specific Persona linked to the character — or their Shadow form if applicable.</span></div>
      <div class="tooltip">Arcana<span class="tooltip-text">Their corresponding Tarot Arcana, which defines their symbolic and narrative role.</span></div>
      <div class="tooltip">Opus<span class="tooltip-text">The game(s) in which this character appears: P3, P4G, P5, PQ2, P5T, etc.</span></div>`;
      output.insertBefore(categoryRow, output.firstChild);
    }

    const row = document.createElement("div");
    row.classList.add("guess-row");

    const imageName = portraitsMap[guess.nom] || guess.nom.split(" ")[0];
    const portraitName = encodeURIComponent(imageName);
    const img = document.createElement("img");
    img.src = `../database/portraits/${portraitName}.webp`;
    img.alt = guess.nom;
    img.className = "guess-image";
    row.appendChild(img);

    const keysToCompare = ["nom", "genre", "age", "personaUser", "persona", "arcane", "opus"];
    const isWin = guess.nom.toLowerCase() === target.nom.toLowerCase() || forceReveal;

    keysToCompare.forEach((key, index) => {
      const cell = document.createElement("div");
      cell.classList.add("guess-cell");

      let value = guess[key];
      let targetVal = target[key];
      let displayValue = Array.isArray(value) ? value.join(", ") : value;

      if (isWin) {
        cell.classList.add("correct");
      } else if (key === "age") {
        const guessVal = convertAgeToValue(value);
        const targetValue = convertAgeToValue(targetVal);
        if (value === targetVal) {
          cell.classList.add("correct");
        } else if (guessVal !== -1 && targetValue !== -1) {
          const arrow = guessVal < targetValue ? "↑" : "↓";
          cell.classList.add("misplaced");
          displayValue += ` ${arrow}`;
        } else {
          cell.classList.add("wrong");
        }
      } else if (typeof value === "boolean" || typeof targetVal === "boolean") {
        const boolStr = val => val ? "Yes" : "No";
        displayValue = boolStr(value);
        cell.classList.add(value === targetVal ? "correct" : "wrong");
      } else if (Array.isArray(targetVal)) {
        const guessArr = Array.isArray(value) ? value : [value];
        const intersection = guessArr.filter(v => targetVal.includes(v));
        if (intersection.length === targetVal.length && guessArr.length === targetVal.length) {
          cell.classList.add("correct");
        } else if (intersection.length > 0) {
          cell.classList.add("misplaced");
        } else {
          cell.classList.add("wrong");
        }
      } else {
        if (typeof value === "string" && typeof targetVal === "string" && value.toLowerCase() === targetVal.toLowerCase()) {
          cell.classList.add("correct");
        } else {
          cell.classList.add("wrong");
        }
      }

      if (daltonianMode) {
  let symbol = "";
  let bgColor = "";
  if (cell.classList.contains("correct")) {
    symbol = " ✔";
    bgColor = "#4F81BD"; // Bleu
  } else if (cell.classList.contains("misplaced")) {
    symbol = " ▲";
    bgColor = "#F79646"; // Orange
  } else if (cell.classList.contains("wrong")) {
    symbol = " ✖";
    bgColor = "#A6A6A6"; // Gris
  }

  cell.textContent = `${displayValue}${symbol}`;
  cell.style.backgroundColor = bgColor;
  cell.style.color = "white";
} else {
  cell.textContent = displayValue;
}
 

setTimeout(() => cell.classList.add("flip"), 100 * (index + 1));

      row.appendChild(cell);

      if (daltonianMode) {
  let symbol = "";
  let bgColor = "";
  if (cell.classList.contains("correct")) {
    symbol = " ✔";
    bgColor = "#4F81BD"; // Bleu
  } else if (cell.classList.contains("misplaced")) {
    symbol = " ▲";
    bgColor = "#F79646"; // Orange
  } else if (cell.classList.contains("wrong")) {
    symbol = " ✖";
    bgColor = "#A6A6A6"; // Gris
  }

  cell.textContent = `${displayValue}${symbol}`;
  cell.style.backgroundColor = bgColor;
  cell.style.color = "white";
} else {
  cell.textContent = displayValue;
}


    });

    output.insertBefore(row, output.querySelector(".category-row")?.nextSibling);
    removeFromAutocomplete(guess.nom);

    if (isWin) {
      textbar.disabled = true;
      guessButton.disabled = true;
      giveUpButton.disabled = true;
      gameOver = true;
      showConfettiExplosion();
        revealNextLink(); // ⬅️ fait apparaître le lien
    }
  }

    // === GESTION DU BOUTON "COMMENT JOUER" ===
  const rulesModal = document.getElementById("rulesModal");
  const rulesButton = document.getElementById("rulesButton");
  const closeRulesBtn = document.querySelector(".modal .close");

  if (rulesButton && rulesModal && closeRulesBtn) {
    rulesButton.addEventListener("click", () => {
      rulesModal.style.display = "block";
    });

    closeRulesBtn.addEventListener("click", () => {
      rulesModal.style.display = "none";
    });

    window.addEventListener("click", (e) => {
      if (e.target === rulesModal) {
        rulesModal.style.display = "none";
      }
    });

    

    
  }

 document.getElementById("daltonianToggle").addEventListener("click", () => {
  daltonianMode = !daltonianMode;
  localStorage.setItem("daltonianMode", daltonianMode ? "enabled" : "disabled");
  document.getElementById("daltonianToggle").textContent = `Daltonian Mode: ${daltonianMode ? "ON" : "OFF"}`;
  location.reload(); // ⬅ recharge la page pour que le mode s'applique immédiatement
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

function debugModeClassique() {
  console.log("=== 🛠 DEBUG PERSONAS CLASSIQUE ===");

  const namesSeen = new Set();
  const duplicates = [];
  const notInCharacters = [];
  const missingPortraits = [];

  // Doublons dans personas.js
  personas.forEach(name => {
    if (namesSeen.has(name)) {
      duplicates.push(name);
    } else {
      namesSeen.add(name);
    }
  });

  if (duplicates.length > 0) {
    console.warn(`❌ Doublons dans personas.js (${duplicates.length}) :`, duplicates);
  } else {
    console.log("✅ Aucun doublon dans personas.js");
  }

  // Vérifie que chaque nom est présent dans characters
  personas.forEach(name => {
    const found = characters.find(c => c.nom === name);
    if (!found) notInCharacters.push(name);
  });

  if (notInCharacters.length > 0) {
    console.error(`❌ ${notInCharacters.length} noms dans personas.js ne sont pas dans characters :`, notInCharacters);
  } else {
    console.log("✅ Tous les noms de personas.js sont présents dans characters");
  }

  // Vérifie les images disponibles dans portraitsMap
  personas.forEach(name => {
    const imageName = portraitsMap[name] || name.split(" ")[0];
    const imagePath = `../database/portraits/${encodeURIComponent(imageName)}.webp`;

    // Test en préchargeant l’image
    const img = new Image();
    img.onload = () => {
      // OK
    };
    img.onerror = () => {
      missingPortraits.push({ name, path: imagePath });
      console.warn(`🖼️ Image manquante pour "${name}" → ${imagePath}`);
    };
    img.src = imagePath;
  });

  setTimeout(() => {
    if (missingPortraits.length === 0) {
      console.log("✅ Toutes les images sont présentes pour l’autocomplétion");
    } else {
      console.error(`❌ ${missingPortraits.length} images manquantes dans portraitsMap :`, missingPortraits);
    }

    // Vérifie si le personnage cible correspond aux filtres actifs
    const currentTarget = JSON.parse(localStorage.getItem("target"));
    const allValidOpus = activeOpus.flatMap(o => validOpus[o]);
    const targetOpus = Array.isArray(currentTarget.opus) ? currentTarget.opus : [currentTarget.opus];
    const isInFilter = targetOpus.some(op => allValidOpus.includes(op));

    if (isInFilter) {
      console.log(`🎯 Cible "${currentTarget.nom}" est bien dans les filtres actifs ✅`);
    } else {
      console.warn(`❌ Cible "${currentTarget.nom}" ne correspond pas aux filtres actifs !`, currentTarget.opus);
    }

    console.log("=== ✅ FIN DEBUG CLASSIQUE ===");
  }, 1000); // Laisse le temps au chargement d’image
}

function revealNextLink() {
  const next = document.getElementById("nextLinkContainer");
  if (next) {
    next.style.display = "block";
    next.classList.add("reveal-style");

    // ⏳ Scroll après un délai de 2 secondes
    setTimeout(() => {
      next.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1500);
  }
}
