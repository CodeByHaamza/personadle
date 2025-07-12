export function updateProfileStats({ result, mode, sessionTime = 0 }) {
  console.log("🎯 CALL updateProfileStats()");
  console.log("➡️ result:", result);
  console.log("➡️ mode:", mode);
  console.log("➡️ sessionTime:", sessionTime);

  const savedProfile = localStorage.getItem("personaUserProfile");
  if (!savedProfile) {
    console.warn("⚠️ Aucun profil trouvé dans localStorage.");
    return;
  }

  const profile = JSON.parse(savedProfile);
  const stats = profile.stats || {};

  console.log("📄 Profil actuel:", profile);

  // Incrémente parties jouées
  stats.games = (stats.games || 0) + 1;

  // Incrémente victoires ou abandons
  if (result === "win") stats.wins = (stats.wins || 0) + 1;
  if (result === "giveup") stats.giveups = (stats.giveups || 0) + 1;

  // Gestion du mode favori
  const validModes = {
    classique: "Classic",
    emoji: "Emoji",
    silhouette: "Silhouette",
    alloutattack: "AllOutAttack",
    personae: "Personae",
    music: "Music",
  };
  const normalizedMode = validModes[mode.toLowerCase()] || mode;

  stats.modeCount = stats.modeCount || {};
  stats.modeCount[normalizedMode] = (stats.modeCount[normalizedMode] || 0) + 1;

  const mostPlayed = Object.entries(stats.modeCount).sort((a, b) => b[1] - a[1]);
  if (mostPlayed.length > 0) stats.favoriteMode = mostPlayed[0][0];

  // Gestion du streak quotidien
  const today = new Date().toISOString().split("T")[0];
  const lastPlayed = stats.lastPlayed?.split("T")[0];
  stats.lastPlayed = new Date().toISOString();

  if (!lastPlayed || lastPlayed !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split("T")[0];

    if (lastPlayed === yDate) {
      stats.streak = (stats.streak || 0) + 1;
    } else {
      stats.streak = 1;
    }

    stats.streakRecord = Math.max(stats.streakRecord || 0, stats.streak);
  }

  // Ajout du temps de session
  stats.totalTimeMinutes = (stats.totalTimeMinutes || 0) + (sessionTime || 0);

  // Mise à jour et sauvegarde finale
  profile.stats = stats;

  console.log("✅ Profil mis à jour:", profile);

  localStorage.setItem("personaUserProfile", JSON.stringify(profile));
}
