// Importing data for personas and their corresponding portraits
import { personas } from "../database/personas.js";
import { portraitsMap } from "../database/portraitsMap.js";

// Wait for the DOM to fully load before initializing the autocomplete
document.addEventListener("DOMContentLoaded", () => {
  const textbar = document.getElementById("textbar");
  initializeAutocomplete(textbar, personas);
});

/**
 * Initializes the autocomplete functionality for a given input element.
 * @param {HTMLElement} element - The input element to attach autocomplete to.
 * @param {Array} array - The array of strings to use for autocomplete suggestions.
 */
function initializeAutocomplete(element, array) {
  element.addEventListener("input", function () {
    const val = this.value.trim(); // Get the trimmed input value
    closeList(null, element); // Close any existing autocomplete lists
    if (!val) return false; // Exit if input is empty

    // Create a container for autocomplete suggestions
    const list = document.createElement("DIV");
    list.setAttribute("id", "autocomplete-list");
    list.setAttribute("class", "autocomplete-items");
    this.parentNode.appendChild(list);

    const matches = [];

    // Find matches in the array based on the input value
    for (let i = 0; i < array.length; i++) {
      const displayName = array[i];
      const lowerName = displayName.toLowerCase();
      const lowerVal = val.toLowerCase();

      if (lowerName.includes(lowerVal)) {
        const [firstName, lastName] = displayName.split(" ");

        // Assign priority based on whether the match is at the start of the first or last name
        let priority = 3;
        if (firstName?.toLowerCase().startsWith(lowerVal)) priority = 1;
        else if (lastName?.toLowerCase().startsWith(lowerVal)) priority = 2;

        matches.push({ name: displayName, priority });
      }
    }

    // Sort matches by priority and alphabetically
    matches.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });

    // Create and append suggestion elements to the list
    matches.forEach((matchObj) => {
      const displayName = matchObj.name;
      const imageName = portraitsMap[displayName] || displayName;
      const portraitName = encodeURIComponent(imageName);

      // Highlight the matching part of the name
      const matchIndex = displayName.toLowerCase().indexOf(val.toLowerCase());
      const before = displayName.substring(0, matchIndex);
      const match = displayName.substring(matchIndex, matchIndex + val.length);
      const after = displayName.substring(matchIndex + val.length);

      const option = document.createElement("DIV");
      option.className = "list-options";

      // Use a template literal for the suggestion's HTML
      option.innerHTML = `
        <img src="../database/portraits/${portraitName}.webp" alt="${displayName} portrait"
             onerror="this.src='../database/portraits/unknown.webp'" />
        <span title="${displayName}">
          ${before}<strong style="color:#6bbf59">${match}</strong>${after}
        </span>
        <input type='hidden' value='${displayName}'>
      `;

      // Set the input value to the selected suggestion on click
      option.addEventListener("click", function () {
        element.value = this.getElementsByTagName("input")[0].value;
        closeList(null, element);
      });

      list.appendChild(option);
    });
  });

  // Close the autocomplete list when clicking outside of it
  document.addEventListener("click", (e) => {
    closeList(e.target, element);
  });
}

/**
 * Closes all autocomplete suggestion lists except the one associated with the input element.
 * @param {HTMLElement} e - The clicked element.
 * @param {HTMLElement} inputElement - The input element associated with the autocomplete.
 */
function closeList(e, inputElement) {
  const items = document.getElementsByClassName("autocomplete-items");
  for (let i = items.length - 1; i >= 0; i--) {
    if (e !== items[i] && e !== inputElement) {
      items[i].parentNode.removeChild(items[i]);
    }
  }
}
