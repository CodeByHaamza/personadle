import { personas as originalPersonas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { characters } from "../database/characters_clean.js";

let personas = [...originalPersonas];
let gameOver = false;

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

document.addEventListener("DOMContentLoaded", () => {
  const textbar = document.getElementById("textbar");
  const guessButton = document.getElementById("guessButton");
  const hintButton = document.getElementById("hintButton");
  const quoteHint = document.getElementById("quoteHint");
  const output = document.getElementById("output");
  const resetButton = document.getElementById("resetButton");
  const giveUpButton = document.getElementById("giveUpButton");
  const giveUpCounter = document.getElementById("giveUpCounter");
  const hintCounter = document.getElementById("hintCounter");

  initializeAutocomplete(textbar, personas);

  let attempts = parseInt(localStorage.getItem("attempts")) || 0;
  let target = JSON.parse(localStorage.getItem("target"));
  let history = JSON.parse(localStorage.getItem("guessHistory")) || [];

  if (!target) {
    target = characters[Math.floor(Math.random() * characters.length)];
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

  resetButton.addEventListener("click", resetGame);

  hintButton.addEventListener("click", () => {
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

  function resetGame() {
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
    if (giveUpCounter) giveUpCounter.textContent = "(0 / 8)";
    if (hintCounter) hintCounter.textContent = "(0 / 3)";
    textbar.value = "";
    personas = [...originalPersonas];
    initializeAutocomplete(textbar, personas);
    gameOver = false;
    target = characters[Math.floor(Math.random() * characters.length)];
    localStorage.setItem("target", JSON.stringify(target));
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

      cell.textContent = displayValue;
      setTimeout(() => cell.classList.add("flip"), 100 * (index + 1));
      row.appendChild(cell);
    });

    output.insertBefore(row, output.querySelector(".category-row")?.nextSibling);
    removeFromAutocomplete(guess.nom);

    if (isWin) {
      textbar.disabled = true;
      guessButton.disabled = true;
      giveUpButton.disabled = true;
      gameOver = true;
      showConfettiExplosion();
    }
  }
});
