/**
 * js/daily_status.js — Quels modes ont été joués aujourd'hui (heure de Paris) ?
 *
 * Sert à la navigation mobile : pastille ✓ sur les bannières de l'accueil et
 * dans la feuille « Jouer » de la barre du bas (js/bottomNav.js). Sans elle, il
 * fallait se souvenir des modes déjà faits — ou les ouvrir un par un.
 *
 * Source : la trace `dailyDone_<scope>` posée par markGameLogged() (gameCore.js)
 * quand une partie est enregistrée, datée du JOUR DE JEU (currentGameDay) et non
 * du jour d'enregistrement. Repli pour les parties d'avant cette trace : la partie
 * armée aujourd'hui (`gameDay_<scope>`) et déjà enregistrée (`gameLogged_<scope>`).
 *
 * Seule la dimension NORMALE compte : l'Expert est un défi en plus, pas « le
 * mode du jour ».
 */

import { MODES, modePageHref, parisDateKey } from "./gameCore.js";

/**
 * Portée de stats de chaque mode, telle que chaque page la passe à
 * checkResetOnLoad() / markGameLogged(). ⚠️ Pas de règle commune : Silhouette
 * écrit « silhouette » en minuscules et All-Out Attack « AllOut ».
 * tests/daily_status.test.js relit les fichiers de mode pour qu'elle ne dérive pas.
 */
export const MODE_STATS_SCOPE = {
  classic: "Classic",
  emoji: "Emoji",
  silhouette: "silhouette",
  alloutattack: "AllOut",
  personae: "Personae",
  music: "Music",
};

/** Clé de la trace « partie du jour enregistrée » d'une portée. */
export const dailyDoneKey = (scope) => `dailyDone_${scope}`;

function _read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Vrai si le mode a une partie enregistrée pour aujourd'hui.
 *
 * @param {string} modeKey clé canonique ("classic"…)
 * @param {{storage?: Storage, today?: string}} [opts]
 */
export function isModeDoneToday(modeKey, { storage = localStorage, today = parisDateKey() } = {}) {
  const scope = MODE_STATS_SCOPE[modeKey];
  if (!scope) return false;
  if (_read(storage, dailyDoneKey(scope)) === today) return true;
  const id = _read(storage, `gameId_${scope}`);
  return (
    _read(storage, `gameDay_${scope}`) === today &&
    !!id &&
    _read(storage, `gameLogged_${scope}`) === id
  );
}

/**
 * État du jour pour les 6 modes, dans l'ordre de MODES.
 *
 * @returns {{ done: number, total: number, modes: {key: string, label: string, done: boolean}[] }}
 */
export function dailyProgress(opts) {
  const modes = MODES.map(({ key, label }) => ({ key, label, done: isModeDoneToday(key, opts) }));
  return { done: modes.filter((m) => m.done).length, total: modes.length, modes };
}

/** Emoji de chaque mode dans la feuille « Jouer ». */
export const MODE_ICON = {
  classic: "🔤",
  emoji: "😄",
  silhouette: "👤",
  alloutattack: "⚔️",
  personae: "✨",
  music: "🎵",
};

/** Lien vers la page d'un mode depuis la page courante. */
export const modeHref = (modeKey) => modePageHref(modeKey);
