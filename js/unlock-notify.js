/**
 * js/unlock-notify.js — Vérifie badges/titres/wallpapers après une partie, sur
 * n'importe quelle page (pas seulement le profil).
 *
 * Chaque système (badges/titres/wallpapers) garde son propre check "léger" —
 * checkBadgesAfterGame() (profile/badges/badgesManager.js),
 * checkTitlesAfterGame() (profile/titles-ui.js),
 * checkWallpapersAfterGame() (profile/wallpapers-ui.js) — ce module ne fait que
 * les regrouper pour un point d'appel unique dans chaque mode de jeu, plutôt que
 * de dupliquer 3 imports + 3 appels dans les 6 fichiers de mode.
 *
 * Volontairement PAS importé depuis gameCore.js (qui reste sans imports statiques
 * pour éviter tout risque de cycle avec api.js, cf. CLAUDE.md § Pièges critiques) —
 * chaque mode l'importe directement, comme il importe déjà badgesManager.js.
 */

import { checkBadgesAfterGame, trackWeeklyModePlay } from "../profile/badges/badgesManager.js";
import { checkTitlesAfterGame } from "../profile/titles-ui.js";
import { checkWallpapersAfterGame } from "../profile/wallpapers-ui.js";

/**
 * Appeler après un win OU un give-up, dans n'importe quel mode de jeu.
 * Chaque check est indépendant (une erreur dans l'un n'empêche pas les autres).
 *
 * @param {string} [mode] - Mode qui vient d'être joué (ex: "classic", "Music",
 *   "All Out Attack" — n'importe quelle graphie, normalisée en interne). Alimente
 *   le suivi glissant 7 jours du titre akechi_pancakes (weekly_clean_modes).
 *   Optionnel pour compat ascendante : omis, ce suivi est simplement sauté.
 */
export function checkUnlocksAfterGame(mode) {
  if (mode) {
    try {
      const p = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
      trackWeeklyModePlay(
        p,
        () => localStorage.setItem("personaUserProfile", JSON.stringify(p)),
        mode
      );
    } catch (_) {}
  }
  try {
    checkBadgesAfterGame();
  } catch (_) {}
  checkTitlesAfterGame();
  checkWallpapersAfterGame().catch(() => {});
}
