/**
 * js/expert-unlock-anim.js — Le cadenas qui explose quand un Mode Expert s'ouvre.
 *
 * Déclenché par `consumeNewlyUnlockedExpertModes()` (js/gameCore.js), qui compare
 * l'état de déblocage en cache à celui renvoyé par le serveur. Couvre donc les
 * deux façons dont un mode s'ouvre, sans rien savoir de la différence :
 *   - le joueur a franchi la condition en jouant ;
 *   - un admin lui a accordé l'accès (table `expert_unlocks_granted`).
 *
 * Le SVG est inline : le mode Expert doit pouvoir s'annoncer même si le réseau
 * est mauvais, et une image externe qui n'arrive pas laisserait une case vide au
 * milieu de l'animation.
 */

import { modeLabel } from "./gameCore.js";

const OVERLAY_ID = "expertUnlockOverlay";
/** Durée avant fermeture automatique — calée sur la fin de l'animation CSS. */
const AUTO_DISMISS_MS = 3600;
const SHARD_COUNT = 14;

/** Traduction avec repli, cf. CLAUDE.md §5 (t() renvoie la clé si absente). */
function t(key, vars, fallback) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

/** L'utilisateur a-t-il demandé moins d'animations au niveau système ? */
function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * Cadenas en SVG inline. Corps et anse sont deux groupes distincts : l'anse doit
 * pouvoir se détacher et partir vers le haut pendant que le corps se fend.
 */
function padlockSvg() {
  return `
    <svg class="eu-lock" viewBox="0 0 100 120" aria-hidden="true">
      <g class="eu-shackle">
        <path d="M30 50 V34 a20 20 0 0 1 40 0 V50" fill="none" stroke="currentColor" stroke-width="9"
              stroke-linecap="round" />
      </g>
      <g class="eu-body">
        <rect x="18" y="50" width="64" height="54" rx="9" fill="currentColor" />
        <circle cx="50" cy="72" r="7" class="eu-keyhole" />
        <rect x="47" y="72" width="6" height="16" rx="3" class="eu-keyhole" />
      </g>
    </svg>`;
}

/** Éclats projetés — leur direction est tirée une fois et posée en variable CSS. */
function shardsHtml() {
  let out = "";
  for (let i = 0; i < SHARD_COUNT; i++) {
    const angle = (360 / SHARD_COUNT) * i + (Math.random() * 18 - 9);
    const distance = 90 + Math.random() * 70;
    const delay = Math.random() * 60;
    const size = 6 + Math.random() * 8;
    out +=
      `<span class="eu-shard" style="--eu-angle:${angle.toFixed(1)}deg;` +
      `--eu-dist:${distance.toFixed(0)}px;--eu-delay:${delay.toFixed(0)}ms;` +
      `--eu-size:${size.toFixed(0)}px"></span>`;
  }
  return out;
}

/** Retire l'overlay et libère les écouteurs. */
function dismiss(overlay, onKey) {
  if (!overlay?.isConnected) return;
  document.removeEventListener("keydown", onKey);
  overlay.classList.add("eu-closing");
  // Laisse le fondu se jouer, mais ne dépend pas de transitionend : si l'élément
  // est masqué (onglet en arrière-plan), l'évènement peut ne jamais arriver.
  setTimeout(() => overlay.remove(), 320);
}

/**
 * Annonce l'ouverture d'un ou plusieurs Modes Expert.
 *
 * Un seul overlay quel que soit le nombre de modes : enchaîner six animations
 * ferait de l'annonce une punition. Les noms sont simplement listés.
 *
 * @param {string[]} modes  clés de mode (`classic`, `music`…)
 * @returns {HTMLElement|null} l'overlay créé, ou null s'il n'y avait rien à annoncer
 */
export function showExpertUnlock(modes) {
  if (!Array.isArray(modes) || modes.length === 0) return null;

  // Rejouable : ne jamais empiler deux overlays (deux modes peuvent s'ouvrir sur
  // la même partie, et la page peut être revisitée avant la fin de l'animation).
  document.getElementById(OVERLAY_ID)?.remove();

  const names = modes.map((m) => modeLabel(m)).join(" · ");
  const reduced = prefersReducedMotion();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = `eu-overlay${reduced ? " eu-reduced" : ""}`;
  // Annonce vocale : le cadenas est décoratif, c'est le texte qui porte l'info.
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-live", "assertive");
  overlay.setAttribute("aria-label", `${t("ui.expert_unlocked_title", undefined, "Expert mode unlocked!")} — ${names}`);

  overlay.innerHTML = `
    <div class="eu-stage">
      <div class="eu-burst" aria-hidden="true"></div>
      ${reduced ? "" : `<div class="eu-shards" aria-hidden="true">${shardsHtml()}</div>`}
      ${padlockSvg()}
      <p class="eu-title">${t("ui.expert_unlocked_title", undefined, "Expert mode unlocked!")}</p>
      <p class="eu-modes">${names}</p>
      <p class="eu-hint">${t("ui.expert_unlocked_hint", undefined, "The ⚡ button is yours now.")}</p>
    </div>`;

  const onKey = (e) => {
    if (e.key === "Escape") dismiss(overlay, onKey);
  };
  overlay.addEventListener("click", () => dismiss(overlay, onKey));
  document.addEventListener("keydown", onKey);

  document.body.appendChild(overlay);
  setTimeout(() => dismiss(overlay, onKey), reduced ? 2200 : AUTO_DISMISS_MS);

  return overlay;
}
