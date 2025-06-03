import { personas as originalPersonas } from "./database/personas_allOut.js";
import { portraitsMap } from "./database/portraitsMap.js";

let personas = [...originalPersonas];
let attempts = 0;
let gameOver = false;
let target = null;

let previousTarget = null;

let lastFiveTargets = [];

function getBetterRandomCharacter() {
  const filteredPool = personas.filter(name => !lastFiveTargets.includes(name));
  const pool = filteredPool.length > 0 ? filteredPool : [...personas];

  const chaosSeed = performance.now() + Date.now() * Math.random() * 999999;
  let hash = 0;

  for (let i = 0; i < chaosSeed.toString().length; i++) {
    hash = (hash << 5) - hash + chaosSeed.toString().charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % pool.length;
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

// ... le reste du code reste identique jusqu’à la fonction showWrongFeedback

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
  updateGiveUpCounter(); // met à jour le compteur + bouton

  if (guess.toLowerCase() === target.toLowerCase()) {
    document.getElementById("aoaGif").style.filter = "none";
    showVictoryBox(target);
    showConfettiExplosion();
    gameOver = true;
    disableInputs();
    return;
  }

  showWrongFeedback(guess);
  removeFromAutocomplete(guess);

  const blurLevel = Math.max(20 - attempts * 3, 0);
  document.getElementById("aoaGif").style.filter = `blur(${blurLevel}px)`;

  input.value = "";
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

  // ✅ Scroll vers la victoire
  setTimeout(() => {
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 300); // petit délai pour que la box soit visible avant scroll
}


// Par cette version corrigée :
function giveUp() {
  // ✅ Ajouter cette vérification pour empêcher le give up si pas assez d'essais
  if (attempts < 5) return;
  
  if (gameOver) return;
  document.getElementById("aoaGif").style.filter = "none";
  showVictoryBox(target);
  showConfettiExplosion();
  disableInputs();
  gameOver = true;
}
function resetGame() {
  const input = document.getElementById("textbar");
  const gifElement = document.getElementById("aoaGif");
  const wrongList = document.getElementById("wrongGuessList");

  gameOver = false;
  attempts = 0;
  document.getElementById("victoryBox").style.display = "none";

  personas = [...originalPersonas];
  target = getBetterRandomCharacter();

  const imageName = portraitsMap[target] || target.split(" ")[0];
  gifElement.src = `./database/allOutAttack/${encodeURIComponent(imageName)}.gif`;
  gifElement.style.filter = "blur(20px)";

  input.disabled = false;
  document.getElementById("guessButton").disabled = false;
  input.value = "";

  // ✅ SUPPRESSION des feedbacks d’erreur (images rouges)
  if (wrongList) {
    wrongList.innerHTML = "";
  }

  // ✅ Recharge de l’autocomplétion avec liste complète
  initializeAutocomplete(input, personas);
  updateGiveUpButton();
  updateGiveUpCounter();


}

function updateGiveUpButton() {
  const giveUpButton = document.getElementById("giveUpButton");
  if (attempts >= 5) {
    giveUpButton.disabled = false;
    giveUpButton.style.cursor = "pointer";
  } else {
    giveUpButton.disabled = true;
    giveUpButton.style.cursor = "not-allowed";
  }
}

function updateGiveUpCounter() {
  const giveUpCounter = document.getElementById("giveUpCounter");
  const giveUpButton = document.getElementById("giveUpButton");

  if (giveUpCounter) {
    giveUpCounter.textContent = `(${attempts} / 5)`;

    // Ajoute un style "activated" quand on atteint 5 essais
    if (attempts >= 5) {
      giveUpCounter.classList.add("activated");
    } else {
      giveUpCounter.classList.remove("activated");
    }
  }

  if (giveUpButton) {
    giveUpButton.disabled = attempts < 5;
    giveUpButton.style.cursor = attempts >= 5 ? "pointer" : "not-allowed";
  }
}




function disableInputs() {
  document.getElementById("textbar").disabled = true;
  document.getElementById("guessButton").disabled = true;
  document.getElementById("giveUpButton").disabled = true; // ✅ bloque Give Up aussi
  document.getElementById("giveUpButton").style.cursor = "not-allowed"; // pour le visuel
}


document.addEventListener("DOMContentLoaded", () => {
  const textbar = document.getElementById("textbar");
  const guessButton = document.getElementById("guessButton");
  const gifElement = document.getElementById("aoaGif");

  initializeAutocomplete(textbar, personas);
  guessButton.addEventListener("click", handleGuess);
  document.getElementById("giveUpButton").addEventListener("click", giveUp);
  document.getElementById("resetButton").addEventListener("click", resetGame);

  target = getBetterRandomCharacter();
  const imageName = portraitsMap[target] || target.split(" ")[0];
  gifElement.src = `./database/allOutAttack/${encodeURIComponent(imageName)}.gif`;
  gifElement.style.filter = "blur(20px)";
})

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

    // === Modale "How to Play"
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
});

  }

;
