/**
 * js/share_result.js — « Partager mon résultat », façon Wordle.
 *
 * Le premier canal d'acquisition d'un jeu « -dle » est la grille d'emojis
 * collée dans un groupe : aucun des six modes n'en avait. Le texte ne révèle
 * jamais la cible, seulement le chemin (couleurs ou nombre d'essais).
 *
 *   PersonaDLE 🔤 Classic — 20/10
 *   🟥🟨🟥🟥🟥🟥🟩
 *   🟩🟩🟩🟩🟩🟩🟩
 *   ✅ 2 essais
 *   https://personadle.net
 *
 * Câblage, sans toucher aux six modes un par un :
 *  - buildGameSession() (gameCore.js) retient le résultat de la partie en cours
 *    dans `lastGameResult` (LAST_RESULT_KEY : résultat, essais, identifiant) ;
 *  - revealNextLink(), qu'appellent les six modes en fin de partie — rechargement
 *    compris —, charge ce module et appelle mountShareButton().
 * Le bouton n'apparaît que si le résultat retenu est celui de la partie AFFICHÉE
 * (même identifiant) : une partie de défi, qui n'est pas enregistrée, n'en a pas.
 */

import { isExpertPage, modeLabel, normalizeModeKey } from "./gameCore.js";

/** Emoji de chaque mode dans le texte partagé. */
export const MODE_ICON = {
  classic: "🔤",
  emoji: "😄",
  silhouette: "👤",
  alloutattack: "⚔️",
  personae: "✨",
  music: "🎵",
};

export const LAST_RESULT_KEY = "lastGameResult";
const SITE_URL = "https://personadle.net";
const MAX_ROWS = 8;

function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

/**
 * Le résultat retenu, s'il est celui de la partie affichée (même identifiant).
 * @returns {null | {scope, id, mode, result, attempts, isExpert, day}}
 */
export function readCurrentResult(storage = localStorage) {
  try {
    const r = JSON.parse(storage.getItem(LAST_RESULT_KEY) || "null");
    if (!r?.scope || !r.id) return null;
    if (storage.getItem(`gameId_${r.scope}`) !== r.id) return null;
    return r;
  } catch {
    return null;
  }
}

const CELL = { correct: "🟩", misplaced: "🟨", wrong: "🟥" };

/**
 * Grille de couleurs du mode Classique, lue dans le DOM (#output) : les lignes
 * y sont insérées de la plus récente à la plus ancienne, on les remet dans
 * l'ordre de jeu.
 * @returns {string[]} une chaîne d'emojis par essai
 */
export function readClassicGrid(doc = document) {
  return [...doc.querySelectorAll("#output .guess-row")]
    .reverse()
    .map((row) =>
      [...row.querySelectorAll(".guess-cell")]
        .map(
          (c) =>
            CELL[["correct", "misplaced", "wrong"].find((s) => c.classList.contains(s))] ?? "⬛"
        )
        .join("")
    );
}

/** "20/10" — le jour sans l'année, lisible dans toutes les langues du site. */
function _shortDate(dayKey) {
  const [, m, d] = String(dayKey).split("-");
  return d && m ? `${d}/${m}` : dayKey;
}

/**
 * Texte à partager. Pure : testée dans tests/share_result.test.js.
 *
 * @param {{mode: string, result: "win"|"giveup", attempts: number, isExpert?: boolean,
 *          day: string, grid?: string[]}} r
 */
export function buildShareText({ mode, result, attempts, isExpert = false, day, grid = [] }) {
  const key = normalizeModeKey(mode) ?? mode;
  const name = _t(`modes.${key}.name`, modeLabel(mode));
  const icon = MODE_ICON[key] ?? "🎮";
  const lines = [`PersonaDLE ${icon} ${name}${isExpert ? " ⚡ Expert" : ""} — ${_shortDate(day)}`];

  if (grid.length) {
    const shown = grid.slice(-MAX_ROWS);
    if (grid.length > MAX_ROWS) lines.push("…");
    lines.push(...shown);
  } else {
    const n = Math.max(1, attempts);
    const misses = Math.min(n - (result === "win" ? 1 : 0), MAX_ROWS);
    const tail = result === "win" ? "✅" : "🏳️";
    lines.push("❌".repeat(misses) + (n - (result === "win" ? 1 : 0) > MAX_ROWS ? "…" : "") + tail);
  }

  lines.push(
    result === "win"
      ? attempts === 1
        ? _t("share.one_try", "✅ First try!")
        : _t("share.tries", `✅ ${attempts} tries`, { count: attempts })
      : _t("share.gave_up", `🏳️ Gave up after ${attempts} tries`, { count: attempts })
  );
  lines.push(SITE_URL);
  return lines.join("\n");
}

function _toast(msg) {
  if (typeof window.showToast === "function") {
    window.showToast(msg); // bottomNav.js
    return;
  }
  const el = document.createElement("div");
  el.className = "share-result-toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

/**
 * Partage natif (téléphone) si disponible, sinon presse-papiers.
 * @returns {Promise<"shared"|"copied"|"failed">}
 */
export async function shareText(text, nav = navigator) {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  if (coarse && typeof nav.share === "function") {
    try {
      await nav.share({ text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "shared"; // le joueur a fermé la feuille
    }
  }
  try {
    await nav.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Monte le bouton dans la navigation de fin de partie (#modeNavigationContainer). */
export function mountShareButton(doc = document) {
  const nav = doc.getElementById("modeNavigationContainer");
  const result = readCurrentResult();
  doc.getElementById("shareResultBtn")?.remove();
  if (!nav || !result || result.isExpert !== isExpertPage()) return null;

  const btn = doc.createElement("button");
  btn.type = "button";
  btn.id = "shareResultBtn";
  btn.className = "btn-share-result";
  btn.innerHTML = `<span aria-hidden="true">📋</span><span>${_t("share.button", "Share my result")}</span>`;
  btn.addEventListener("click", async () => {
    const current = readCurrentResult() ?? result;
    const isClassic = normalizeModeKey(current.mode) === "classic" && !current.isExpert;
    const text = buildShareText({ ...current, grid: isClassic ? readClassicGrid(doc) : [] });
    const outcome = await shareText(text);
    if (outcome === "copied") _toast(_t("share.copied", "Result copied — paste it anywhere!"));
    else if (outcome === "failed") _toast(_t("share.failed", "Couldn't copy the result."));
  });
  nav.prepend(btn);
  return btn;
}
