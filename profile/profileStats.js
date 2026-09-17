import { parisDateKey, shiftDateKey, modeLabel } from "../js/gameCore.js";

/**
 * Jour Paris du dernier `lastPlayed` enregistré, ou null s'il est absent ou
 * illisible. Une valeur corrompue faisait lever Intl (RangeError) et la partie
 * n'était plus comptée du tout — mieux vaut la traiter comme une première partie.
 */
function _lastPlayedKey(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : parisDateKey(d);
}

export function updateProfileStats({ result, mode, timeSpent = 0 }) {
  const savedProfile = localStorage.getItem("personaUserProfile");
  if (!savedProfile) return;

  const profile = JSON.parse(savedProfile);
  const stats = profile.stats || {};

  // Incrémente parties jouées
  stats.games = (stats.games || 0) + 1;

  // Incrémente victoires ou abandons
  if (result === "win") stats.wins = (stats.wins || 0) + 1;
  if (result === "giveup") stats.giveups = (stats.giveups || 0) + 1;

  // Compteurs par mode — libellé canonique via le mapping unique de gameCore.js.
  // (Le « mode favori » n'est plus dérivé d'ici depuis la 2.2 : c'est un choix du
  // joueur, profile.favoriteMode ; le « meilleur mode » se calcule à l'affichage.)
  const normalizedMode = modeLabel(mode);
  stats.modeCount = stats.modeCount || {};
  stats.modeCount[normalizedMode] = (stats.modeCount[normalizedMode] || 0) + 1;

  // Victoires par mode
  if (result === "win") {
    stats.modeWins = stats.modeWins || {};
    stats.modeWins[normalizedMode] = (stats.modeWins[normalizedMode] || 0) + 1;
  }

  // Gestion du streak quotidien — frontière de journée en heure de Paris
  // (jamais UTC : tout le jeu est calé sur Europe/Paris via parisDateKey()).
  const today = parisDateKey();
  const lastPlayed = _lastPlayedKey(stats.lastPlayed);
  stats.lastPlayed = new Date().toISOString();

  if (!lastPlayed || lastPlayed !== today) {
    // « Hier » en jours CALENDAIRES Paris — pas `now − 24 h`, qui retombe deux
    // jours en arrière entre 00:00 et 00:59 le lendemain du passage à l'heure
    // d'été (journée de 23 h). Voir shiftDateKey() dans gameCore.js.
    const yDate = shiftDateKey(today, -1);

    if (lastPlayed === yDate) {
      stats.streak = (stats.streak || 0) + 1;
    } else {
      // Streak brisée — sauvegarder pour permettre la récupération via Jack Frost
      const broken = stats.streak || 0;
      if (broken > 1) {
        try {
          const rec = JSON.parse(localStorage.getItem("streakRecovery") || "{}");
          // Ne pas écraser si déjà enregistrée et non consommée
          if (!rec.previousStreak || rec.previousStreak === 0) {
            rec.previousStreak = broken;
            rec.brokenDate = today;
            rec.shown = false;
            localStorage.setItem("streakRecovery", JSON.stringify(rec));
          }
        } catch (_) {}
      }
      stats.streak = 1;
    }

    stats.streakRecord = Math.max(stats.streakRecord || 0, stats.streak);
  }

  // ✅ CORRECTION : Conversion de secondes en minutes
  const timeInMinutes = Math.round(timeSpent / 60);
  stats.totalTimeMinutes = (stats.totalTimeMinutes || 0) + timeInMinutes;

  // Mise à jour et sauvegarde finale
  profile.stats = stats;
  localStorage.setItem("personaUserProfile", JSON.stringify(profile));
}
