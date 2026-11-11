/**
 * js/share_day.js — « Partager ma journée » : les six modes du jour en un texte.
 *
 * Lot 10 de la 2.4. « Partager mon résultat » (js/share_result.js) ne parle que de
 * la partie qui vient de finir ; un joueur qui fait ses six modes chaque jour
 * voulait montrer la journée entière, comme une grille Wordle :
 *
 *   PersonaDLE 📅 11/11 — 5/6
 *   🔤 Classic ✅ 3
 *   😄 Emoji 🎯 1
 *   👤 Silhouette 🏳️
 *   ⚔️ All-Out Attack ✅ 2
 *   ✨ Personae ✅ 5
 *   🎵 Music ✅ 4
 *   https://personadle.net
 *
 * Rien ne révèle une cible (et chaque joueur a la sienne de toute façon).
 *
 * Source : `dailyResults` (DAY_RESULTS_KEY), écrit par recordDayResult() dans
 * gameCore.js (appelée par buildGameSession(), d'où sa place : gameCore ne doit
 * pas importer ce module, cf. CLAUDE.md §7 imports circulaires) — la PREMIÈRE
 * partie normale de chaque mode du jour : un Replay ou une partie Expert n'est pas
 * « la partie du jour ». Un mode marqué joué (daily_status.js) mais sans résultat
 * retenu — joué avant cette version, ou sur un autre appareil — s'affiche « joué »,
 * sans détail.
 *
 * Où on le partage : à 6/6, le bouton « Partager mon résultat » de fin de partie
 * partage la journée (share_result.js) — la journée contient la partie qui vient
 * de finir, et un bouton de plus surchargerait la barre de fin de partie sur
 * téléphone ; la carte Discord « 6/6 » copie la journée ; la feuille « Jouer » de
 * la barre du bas a son bouton.
 */

import { DAY_RESULTS_KEY, MODES, modeLabel, parisDateKey } from "./gameCore.js";
import { isModeDoneToday, MODE_ICON } from "./daily_status.js";
const SITE_URL = "https://personadle.net";

function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

function _readDay(storage) {
  try {
    const d = JSON.parse(storage.getItem(DAY_RESULTS_KEY) || "null");
    return d && typeof d.day === "string" && d.modes && typeof d.modes === "object" ? d : null;
  } catch {
    return null;
  }
}

/**
 * État de la journée, mode par mode, dans l'ordre de MODES.
 * @returns {{day: string, done: number, wins: number, total: number,
 *            modes: {key: string, label: string, done: boolean, result: ?string, attempts: ?number}[]}}
 */
export function readDay({ storage = localStorage, today = parisDateKey() } = {}) {
  const stored = _readDay(storage);
  const results = stored?.day === today ? stored.modes : {};
  const modes = MODES.map(({ key, label }) => {
    const r = results[key];
    return {
      key,
      label,
      done: !!r || isModeDoneToday(key, { storage, today }),
      result: r?.result ?? null,
      attempts: r?.attempts ?? null,
    };
  });
  return {
    day: today,
    done: modes.filter((m) => m.done).length,
    wins: modes.filter((m) => m.result === "win").length,
    total: modes.length,
    modes,
  };
}

/** "11/11" — le jour sans l'année, comme share_result.js. */
function _shortDate(dayKey) {
  const [, m, d] = String(dayKey).split("-");
  return d && m ? `${d}/${m}` : dayKey;
}

/**
 * Texte de la journée. Pure : testée dans tests/share_day.test.js.
 * @param {ReturnType<typeof readDay>} day
 */
export function buildDayShareText(day) {
  const lines = [`PersonaDLE 📅 ${_shortDate(day.day)} — ${day.wins}/${day.total}`];
  for (const m of day.modes) {
    const name = _t(`modes.${m.key}.name`, modeLabel(m.key));
    const icon = MODE_ICON[m.key] ?? "🎮";
    let mark;
    if (m.result === "win") mark = m.attempts === 1 ? "🎯 1" : `✅ ${m.attempts}`;
    else if (m.result === "giveup") mark = "🏳️";
    else if (m.done) mark = "✔️";
    else mark = "⬜";
    lines.push(`${icon} ${name} ${mark}`);
  }
  lines.push(SITE_URL);
  return lines.join("\n");
}

/** Le texte de la journée en cours, prêt à copier. */
export function currentDayShareText(opts) {
  return buildDayShareText(readDay(opts));
}

/** Vrai quand les six modes du jour sont joués : c'est là que le bouton apparaît. */
export function isDayComplete(opts) {
  const d = readDay(opts);
  return d.done >= d.total;
}
