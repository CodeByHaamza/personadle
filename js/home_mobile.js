/**
 * js/home_mobile.js — L'accueil sur téléphone.
 *
 * 1. Une pastille ✓ sur la bannière de chaque mode déjà joué aujourd'hui
 *    (js/daily_status.js) — sur toutes les tailles d'écran.
 * 2. News et Daily Reset quittent leurs positions flottantes, où ils masquaient
 *    la 3e bannière sur un écran de 390 px : ils sont rangés dans une rangée
 *    sous le titre. Au-delà de 480 px, la rangée est en `display: contents` et
 *    les deux boutons gardent leur position fixe d'origine (css/index.css).
 *    Déplacer le nœud garde ses écouteurs : rien à recâbler.
 */

import { dailyProgress } from "./daily_status.js";

/** Bannière de chaque mode sur l'accueil (index.html, #gameModeSelector). */
export const HOME_BUTTON_ID = {
  classic: "classicButton",
  emoji: "EmojiButton",
  silhouette: "ShadowsButton",
  alloutattack: "AllOutAttackButton",
  personae: "PersonaeButton",
  music: "MusicButton",
};

function _t(key, fallback) {
  const r = window.i18n?.t?.(key);
  return r != null && r !== key ? r : fallback;
}

/** Pose (ou retire) la pastille ✓ de chaque bannière. */
export function renderHomeStatusBadges(progress = dailyProgress(), doc = document) {
  for (const { key, done } of progress.modes) {
    const btn = doc.getElementById(HOME_BUTTON_ID[key]);
    if (!btn) continue;
    let badge = btn.querySelector(".mode-status-badge");
    if (!done) {
      badge?.remove();
      continue;
    }
    if (!badge) {
      badge = doc.createElement("span");
      badge.className = "mode-status-badge";
      btn.appendChild(badge);
    }
    const label = _t("nav.home_status_done", "Played today");
    // data-i18n sur le texte seul : setLang() le retraduit sans effacer le ✓.
    badge.innerHTML = `✓ <span class="mode-status-text" data-i18n="nav.home_status_done">${label}</span>`;
    badge.setAttribute("aria-label", label);
  }
}

/** Range News + Daily Reset dans une rangée sous le titre. */
export function dockQuickActions(doc = document) {
  if (doc.getElementById("homeQuickActions")) return;
  const title = doc.querySelector(".title-wrapper");
  const news = doc.getElementById("newsBtn");
  const daily = doc.getElementById("dailyInfoBtn");
  if (!title || (!news && !daily)) return;
  const row = doc.createElement("div");
  row.id = "homeQuickActions";
  row.className = "home-quick-actions";
  if (news) row.appendChild(news);
  if (daily) row.appendChild(daily);
  title.after(row);
}

export function initHomeMobile() {
  dockQuickActions();
  renderHomeStatusBadges();
  // Retour sur l'accueil après une partie (bouton précédent, onglet rouvert).
  window.addEventListener("pageshow", () => renderHomeStatusBadges());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderHomeStatusBadges();
  });
}
