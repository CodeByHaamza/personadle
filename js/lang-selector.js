/**
 * lang-selector.js — Widget de sélection de langue (bouton + dropdown).
 * Génère le markup attendu par css/langSelector.css et le câble à js/i18n.js.
 * Usage :
 *   <link rel="stylesheet" href="./css/langSelector.css" />
 *   <div id="langSelectorMount"></div>
 *   <script type="module">
 *     import { initLangSelector } from "./js/lang-selector.js";
 *     await initLangSelector();
 *   </script>
 */

import { initLang, setLang } from "./i18n.js";

const LABELS = { en: "EN", fr: "FR", es: "ES", de: "DE", it: "IT" };

const LANG_OPTIONS = [
  { code: "en", name: "English", label: "English", char: "Lisa_Silverman_english.webp", alt: "Lisa Silverman" },
  { code: "fr", name: "Français", label: "Français", char: "Bebe_french.webp", alt: "Bebe" },
  { code: "es", name: "Español", label: "Español", char: "Morgana_Spanish.webp", alt: "Morgana" },
  { code: "de", name: "Deutsch", label: "Deutsch", char: "Hulkenberg_german.webp", alt: "Hulkenberg" },
  { code: "it", name: "Italiano", label: "Italiano", char: "Caesar_italian.webp", alt: "Caesar" },
];

function buildMarkup() {
  const options = LANG_OPTIONS.map(
    ({ code, name, label, char, alt }) => `
      <div class="lang-opt lang-opt--${code}" data-lang="${code}" role="option" tabindex="0" aria-label="${label}">
        <span class="lang-opt-name">${name}</span>
        <span class="lang-opt-dot" aria-hidden="true">◆</span>
        <img class="lang-opt-char" src="./assets/lang/${char}" alt="${alt}" loading="lazy" />
      </div>`
  ).join("");

  return `
    <button id="langBtn" aria-haspopup="listbox" aria-expanded="false" title="Change language">
      <span class="lang-btn-globe">🌐</span>
      <span id="langBtnLabel">EN</span>
      <span class="lang-btn-chevron">▼</span>
    </button>
    <div id="langDropdown" role="listbox" aria-label="Select language">${options}</div>
  `;
}

/**
 * Injecte le widget dans #langSelectorMount (ou le conteneur fourni),
 * initialise i18n et câble les interactions. Retourne la langue chargée.
 * @param {string} [mountId="langSelectorMount"]
 * @returns {Promise<string>}
 */
export async function initLangSelector(mountId = "langSelectorMount") {
  const mount = document.getElementById(mountId);
  if (!mount) return initLang();

  mount.id = "langToggle";
  mount.innerHTML = buildMarkup();

  const btn = document.getElementById("langBtn");
  const toggle = document.getElementById("langToggle");
  const dropdown = document.getElementById("langDropdown");

  function updateBtnLabel(lang) {
    const el = document.getElementById("langBtnLabel");
    if (el) el.textContent = LABELS[lang] || lang.toUpperCase();
  }

  function applyActive(lang) {
    document
      .querySelectorAll(".lang-opt")
      .forEach((opt) => opt.classList.toggle("is-active", opt.dataset.lang === lang));
    updateBtnLabel(lang);
  }

  function closeDropdown() {
    toggle.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  function openDropdown() {
    toggle.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  async function selectLang(lang) {
    await setLang(lang);
    applyActive(lang);
    closeDropdown();
  }

  const lang = await initLang();
  applyActive(lang);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle.classList.contains("open") ? closeDropdown() : openDropdown();
  });

  document.querySelectorAll(".lang-opt").forEach((opt) => {
    opt.addEventListener("click", () => selectLang(opt.dataset.lang));
    opt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectLang(opt.dataset.lang);
      }
    });
  });

  document.addEventListener("click", () => closeDropdown());
  dropdown.addEventListener("click", (e) => e.stopPropagation());

  return lang;
}
