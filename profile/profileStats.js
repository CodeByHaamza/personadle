import { parisDateKey, modeLabel } from "../js/gameCore.js";

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

  // Mode favori — libellé canonique via le mapping unique de gameCore.js
  const normalizedMode = modeLabel(mode);
  stats.modeCount = stats.modeCount || {};
  stats.modeCount[normalizedMode] = (stats.modeCount[normalizedMode] || 0) + 1;

  // Victoires par mode
  if (result === "win") {
    stats.modeWins = stats.modeWins || {};
    stats.modeWins[normalizedMode] = (stats.modeWins[normalizedMode] || 0) + 1;
  }

  const mostPlayed = Object.entries(stats.modeCount).sort((a, b) => b[1] - a[1]);
  if (mostPlayed.length > 0) stats.favoriteMode = mostPlayed[0][0];

  // Gestion du streak quotidien — frontière de journée en heure de Paris
  // (jamais UTC : tout le jeu est calé sur Europe/Paris via parisDateKey()).
  const today = parisDateKey();
  const lastPlayed = stats.lastPlayed ? parisDateKey(new Date(stats.lastPlayed)) : null;
  stats.lastPlayed = new Date().toISOString();

  if (!lastPlayed || lastPlayed !== today) {
    const yDate = parisDateKey(new Date(Date.now() - 86_400_000));

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
