import { personas as originalPersonas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";
import { characters } from "../database/characters_clean.js";

let personas = [...originalPersonas];
let gameOver = false;
let attempts = 0;
let target = null;

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
  const hintCounter = document.getElementById("hintCounter");
  if (giveUpCounter) giveUpCounter.textContent = `(${attempts} / 8)`;
  if (hintCounter) hintCounter.textContent = `(${attempts} / 3)`;
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
    textbar.disabled = true;
    document.getElementById("guessButton").disabled = true;
    document.getElementById("giveUpButton").disabled = true;
    gameOver = true;
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

  personas = [...originalPersonas];
  initializeAutocomplete(textbar, personas);
  gameOver = false;
  attempts = 1;

  target = characters[Math.floor(Math.random() * characters.length)];
  localStorage.setItem("targetEmoji", JSON.stringify(target));
  localStorage.setItem("attemptsEmoji", attempts);
  updateEmojiHint();
  updateCounters();
}

document.addEventListener("DOMContentLoaded", () => {
  const textbar = document.getElementById("textbar");
  const guessButton = document.getElementById("guessButton");
  const giveUpButton = document.getElementById("giveUpButton");
  const resetButton = document.getElementById("resetButton");

  initializeAutocomplete(textbar, personas);

  // Restore from localStorage
  target = JSON.parse(localStorage.getItem("targetEmoji")) || characters[Math.floor(Math.random() * characters.length)];
  attempts = parseInt(localStorage.getItem("attemptsEmoji")) || 1;

  localStorage.setItem("targetEmoji", JSON.stringify(target));
  localStorage.setItem("attemptsEmoji", attempts);

  updateEmojiHint();
  updateCounters();

  if (attempts >= 8) enableGiveUpButton();

  guessButton.addEventListener("click", () => {
    if (gameOver) return;
    const guess = textbar.value.trim();
    if (!guess) return;
    checkEmojiGuess(guess);
    textbar.value = "";
  });

  giveUpButton.addEventListener("click", () => {
    if (!gameOver) {
      checkEmojiGuess(target.nom, true);
    }
  });

  resetButton.addEventListener("click", () => {
    localStorage.removeItem("targetEmoji");
    localStorage.removeItem("attemptsEmoji");
    resetGame();
  });
});
