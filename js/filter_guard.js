/**
 * js/filter_guard.js — Changer de filtre en cours de partie = abandon (2.4, lot 12).
 *
 * L'« étape B anti-triche », annoncée dans le changelog de la 2.3. Changer de filtre
 * relance la partie avec une nouvelle cible, et la partie en cours disparaissait
 * sans être enregistrée. Dans les six modes, on pouvait donc esquiver une cible
 * difficile — trois essais ratés, un filtre décoché, nouvelle cible — sans que
 * l'abandon compte dans les stats ni dans les quêtes Expert « d'affilée ».
 *
 * Désormais, au PREMIER changement de filtre d'une partie entamée :
 *  1. un avertissement demande confirmation (« cette partie comptera comme un
 *     abandon ») — Annuler laisse filtres et partie intacts ;
 *  2. confirmé, la partie est enregistrée en abandon : la MÊME session que le bouton
 *     « Abandonner » (buildGameSession + savePendingSession, stats locales,
 *     déblocages), sans le seuil d'essais du bouton, puis le mode relance la partie
 *     comme avant.
 *
 * Ne déclenche rien : une partie pas commencée (0 essai), déjà finie ou déjà
 * enregistrée, une partie de défi (elle n'est jamais enregistrée en quotidien).
 * Les filtres posés par programme (défi) ne passent pas par ce garde : seuls les
 * clics du menu (js/filterMenu.js) le consultent.
 */

import {
  buildGameSession,
  isChallengePlay,
  isGameLogged,
  markGameLogged,
  savePendingSession,
} from "./gameCore.js";
import { updateProfileStats } from "../profile/profileStats.js";
import { checkUnlocksAfterGame } from "./unlock-notify.js";

function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

/**
 * Crée le garde `beforeChange` à passer à initFilterMenu().
 *
 * @param {object} o
 * @param {string}  o.scope      portée de stats du mode (STATS_SCOPE)
 * @param {string}  o.modeKey    clé de défi ("classic", "alloutattack"…)
 * @param {string}  o.sessionMode `mode` passé à buildGameSession (comme le bouton Abandonner)
 * @param {string}  [o.statsMode] `mode` passé à updateProfileStats (défaut : sessionMode)
 * @param {boolean} o.isExpert
 * @param {() => {attempts: number, gameOver: boolean, targetName: ?string,
 *                 filters?: string[], startedAt: number}} o.getState
 * @param {() => void} [o.onAbandoned] nettoyage propre au mode, avant la relance
 * @param {(msg: string) => boolean} [o.confirmFn]
 * @returns {() => boolean} vrai = le changement peut s'appliquer
 */
export function createMidGameFilterGuard({
  scope,
  modeKey,
  sessionMode,
  statsMode = sessionMode,
  isExpert,
  getState,
  onAbandoned,
  confirmFn = (msg) => window.confirm(msg),
}) {
  return () => {
    const st = getState();
    const inProgress =
      st.attempts > 0 &&
      !st.gameOver &&
      !!st.targetName &&
      !isGameLogged(scope) &&
      !isChallengePlay(modeKey);
    if (!inProgress) return true;

    const ok = confirmFn(
      _t(
        "ui.filter_midgame_confirm",
        "Changing filters now ends this game: it will count as a give-up in your stats. Change anyway?"
      )
    );
    if (!ok) return false;

    const timeSpent = Math.max(0, Math.floor((Date.now() - st.startedAt) / 1000));
    if (!isExpert) updateProfileStats({ result: "giveup", mode: statsMode, timeSpent });
    savePendingSession(
      buildGameSession({
        mode: sessionMode,
        targetName: st.targetName,
        isExpert,
        result: "giveup",
        attempts: st.attempts,
        timeMs: timeSpent * 1000,
        filters: st.filters ?? [],
        clientSessionId: markGameLogged(scope),
      })
    );
    if (!isExpert) checkUnlocksAfterGame(statsMode);
    onAbandoned?.();
    window.showToast?.(
      _t("ui.filter_midgame_done", `Game counted as a give-up — it was ${st.targetName}.`, {
        target: st.targetName,
      })
    );
    return true;
  };
}
