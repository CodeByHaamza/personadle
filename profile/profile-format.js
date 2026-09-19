/**
 * profile/profile-format.js — Utilitaires de formatage partagés entre
 * profile-page.js (ton propre profil) et profile-view.js (profil d'un ami),
 * qui affichent tous deux le streak et le lecteur de musique de profil.
 */

/** Détermine le palier visuel (0-5) d'un streak pour les effets de flammes. */
export function getStreakTier(streak) {
  if (streak >= 30) return 5;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

/** Formate un nombre de secondes en "m:ss" pour le lecteur de musique de profil. */
export function formatSongTime(s) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}

/**
 * Normalise un chemin d'avatar pour fonctionner depuis profile/.
 * Convertit les anciens chemins ./img/... en ../img/...
 * Les data URLs (base64) passent sans modification.
 *
 * @param {string|null} avatarPath - Chemin stocké dans localStorage
 * @returns {string} Chemin résolu depuis profile/
 */
export function normalizeAvatarPath(avatarPath) {
  if (!avatarPath) return "../img/default_avatar.png";
  // Data URL base64 — toujours valide, aucun ajustement nécessaire
  if (avatarPath.startsWith("data:")) return avatarPath;
  // Chemins déjà absolus ou root-relatifs
  if (avatarPath.startsWith("/") || avatarPath.startsWith("http")) return avatarPath;
  // Anciens chemins stockés depuis index.html (./img/...) → corriger pour profile/
  return (
    avatarPath
      .replace(/^\.\/img\//, "../img/")
      // Portrait renommé le 2026-09-17 : le « & » n'était pas accepté par le
      // serveur (personadle_validate_avatar), donc jamais persisté sur le compte —
      // seul un profil local peut encore porter l'ancien nom.
      .replace(/\/Caroline&justine\.png$/, "/caroline_justine.png")
  );
}

/**
 * Vrai si le portrait porté est un recadrage dont on ne connaît plus l'origine :
 * `avatar` est une image encodée et `avatarSrc` (portrait galerie d'origine,
 * synchronisé depuis la 052) est absent. C'est le cas de tout joueur qui a
 * recadré son portrait AVANT la 052 (220 comptes en prod le 2026-09-19) : ses
 * amis — et le badge Same Energy — ne savent pas qui il porte tant qu'il ne
 * re-choisit pas son portrait une fois. L'Atelier lui le dit.
 *
 * @param {{avatar?: string|null, avatarSrc?: string|null}|null} profile
 */
export function needsAvatarOrigin(profile) {
  const avatar = profile?.avatar;
  if (typeof avatar !== "string" || !avatar.startsWith("data:")) return false;
  return !/^\.\.\/img\/avatar\/[A-Za-z0-9_-]+\.(?:gif|png|jpe?g|webp|avif)$/i.test(profile?.avatarSrc || "");
}

/**
 * Vue des stats POUR LES DÉBLOCAGES : normal + Expert additionnés.
 *
 * Décision Hamza du 2026-09-19 : une victoire Expert est une victoire — les
 * conditions génériques (« 25 perfects », « 40 victoires en All-Out Attack »…)
 * comptent les deux dimensions, comme le serveur (condition_check.php lit
 * user_stats ET user_stats_expert). Le profil, lui, continue d'AFFICHER les deux
 * séparément : cette vue ne sert qu'à décider quand tenter un unlock.
 *
 * `stats.expert` vient du pull cloud (GET /api/user/:id → expert_stats) ; absent
 * (hors ligne, backend antérieur) → la vue est simplement égale au normal.
 *
 * @param {object|null|undefined} stats profile.stats
 * @returns {object} même forme que profile.stats (wins, giveups, games,
 *          perfectWins, streakRecord, modeWins, modeCount), sans la clé expert
 */
export function statsForUnlocks(stats) {
  const s = stats || {};
  const e = s.expert;
  if (!e) return s;
  const sumMaps = (a = {}, b = {}) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + (v || 0);
    return out;
  };
  const { expert: _omit, ...rest } = s;
  return {
    ...rest,
    wins: (s.wins || 0) + (e.wins || 0),
    giveups: (s.giveups || 0) + (e.giveups || 0),
    games: (s.games || 0) + (e.games || 0),
    perfectWins: (s.perfectWins || 0) + (e.perfectWins || 0),
    streakRecord: Math.max(s.streakRecord || 0, e.streakRecord || 0),
    modeWins: sumMaps(s.modeWins, e.modeWins),
    modeCount: sumMaps(s.modeCount, e.modeCount),
  };
}

/**
 * « Best Mode Overall » — le mode où le joueur performe le mieux.
 *
 * Décision produit 2026-09-12 (retour joueur) : le mode favori devient un CHOIX
 * du joueur, et ce qui était calculé jusque-là (le plus joué) est remplacé par le
 * meilleur taux de victoire. Plancher de parties pour qu'un 1/1 ne fasse pas
 * 100 % : en dessous de `minGames`, le mode n'est pas candidat. Égalité de taux
 * → le plus joué l'emporte (plus de parties = performance mieux établie).
 *
 * @param {Array<{mode: string, games?: number, wins?: number}>} entries
 *        une entrée par mode, dans le vocabulaire de l'appelant (clé ou libellé)
 * @param {number} [minGames=3]
 * @returns {{mode: string, games: number, wins: number, rate: number}|null}
 *          null si aucun mode n'atteint le plancher
 */
export function bestModeOverall(entries, minGames = 3) {
  let best = null;
  for (const e of entries ?? []) {
    const games = Number(e?.games) || 0;
    const wins = Number(e?.wins) || 0;
    if (games < minGames || games <= 0) continue;
    const rate = wins / games;
    if (!best || rate > best.rate || (rate === best.rate && games > best.games)) {
      best = { mode: e.mode, games, wins, rate };
    }
  }
  return best;
}
