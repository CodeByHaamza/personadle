/**
 * js/cloud-sync.js — Source de vérité : le backend
 * ─────────────────────────────────────────────────────────────────────
 * Appeler pullProfileFromCloud() après chaque auth sur toutes les pages.
 * Le backend écrase TOUJOURS le localStorage — c'est lui la vérité.
 *
 * Usage :
 *   import { pullProfileFromCloud } from './js/cloud-sync.js';
 *   await window._authReady;
 *   if (window._currentUser) await pullProfileFromCloud();
 */

const MODE_MAP = {
  classic: 'Classic', emoji: 'Emoji', silhouette: 'Silhouette',
  alloutattack: 'AllOutAttack', personae: 'Personae', music: 'Music',
};

function _prefix() {
  return window.location.pathname.startsWith('/personadle/') ? '/personadle' : '';
}

function _getLocalProfile() {
  try { return JSON.parse(localStorage.getItem('personaUserProfile') || '{}'); }
  catch { return {}; }
}

function _saveLocalProfile(p) {
  localStorage.setItem('personaUserProfile', JSON.stringify(p));
}

/**
 * Tire TOUTES les données du backend et les écrit dans localStorage.
 * Appelle window._onCloudSync(data) si défini (pour re-rendre l'UI).
 *
 * Avant de puller, envoie les sessions offline accumulées (pendingSessions)
 * afin que les stats cloud reflètent les parties jouées hors-ligne.
 * L'étape syncPending est silencieuse — une erreur réseau ne bloque pas le pull.
 *
 * @returns {object|null} La réponse complète de l'API, ou null si erreur.
 */
export async function pullProfileFromCloud() {
  const user = window._currentUser;
  if (!user?.id) return null;

  // ── Étape 1 : vider la file offline AVANT de lire les stats cloud ──────────
  // Sans cet await, syncPending() (fire-and-forget dans initAuth) peut encore
  // tourner quand le pull arrive, et les stats retournées par l'API ne
  // tiendraient pas compte des sessions jouées offline.
  try {
    await window._personadleApi?.stats?.syncPending?.();
  } catch {
    // Offline ou API indisponible — on continue quand même le pull
  }

  try {
    const res  = await fetch(`${_prefix()}/api/user/${user.id}`, { credentials: 'include' });
    if (!res.ok) return null;
    const json = await res.json();
    // L'API retourne le data directement (pas de wrapper success/data)
    if (!json?.user) return null;

    const d = json; // { user, profile, stats, badges, unlocked_wallpapers, unlocked_titles }
    const p = _getLocalProfile();

    // ── Langue ─────────────────────────────────────────────────────────────
    if (d.user?.lang && d.user.lang !== localStorage.getItem('lang')) {
      localStorage.setItem('lang', d.user.lang);
      // Appliquer sans recharger si i18n est prêt
      window.i18n?.setLang?.(d.user.lang);
    }

    // ── Infos utilisateur ──────────────────────────────────────────────────
    if (d.user?.pseudo) {
      p.username = d.user.pseudo;
      p.pseudo   = d.user.pseudo;
      // Mettre à jour window._currentUser.pseudo pour les autres modules
      if (window._currentUser) window._currentUser.pseudo = d.user.pseudo;
    }

    // ── Profil visuel ──────────────────────────────────────────────────────
    const cp = d.profile ?? {};

    if (cp.avatar_data !== undefined)    p.avatar            = cp.avatar_data;
    if (cp.avatar_border_color)          p.avatarBorderColor = cp.avatar_border_color;
    if (cp.profile_music_id !== undefined) {
      p.profileMusicId = cp.profile_music_id;
      // profileSong est un objet {fichier, titre, ...} résolu par profile-page.js
      // On ne l'écrase pas avec un string brut — c'est _applyCloudToUI qui fait la résolution
    }
    if (cp.selected_badges !== undefined)
      p.selectedBadges = Array.isArray(cp.selected_badges) ? cp.selected_badges : [];
    if (cp.equipped_title_id   !== undefined) p.equippedTitleId   = cp.equipped_title_id   ?? null;
    if (cp.equipped_title_slug !== undefined) p.equippedTitleSlug = cp.equipped_title_slug ?? null;

    // Wallpaper / thème  (wallpaper_id stocke aussi 'custom:#rrggbb' ou l'id de thème)
    if (cp.wallpaper_id) {
      const wid = cp.wallpaper_id;
      p.wallpaperId = wid;
      if (wid.startsWith('custom:')) {
        p.profileTheme       = 'custom';
        p.profileCustomColor = wid.replace('custom:', '');
      } else {
        p.profileTheme = wid;
      }
    }

    // Settings (son, anims…) — merge : le backend enrichit le local, ne le remplace pas
    if (cp.settings && typeof cp.settings === 'object') {
      const local   = JSON.parse(localStorage.getItem('personaSettings') || '{}');
      const merged  = { ...local, ...cp.settings };
      localStorage.setItem('personaSettings', JSON.stringify(merged));
    }

    // ── Stats ──────────────────────────────────────────────────────────────
    if (Array.isArray(d.stats) && d.stats.length) {
      let wins=0, giveups=0, games=0, timeMs=0, best=0, perfect=0;
      const modeCount={}, modeWins={};
      for (const r of d.stats) {
        wins    += r.wins          ?? 0;
        giveups += r.giveups       ?? 0;
        games   += r.games         ?? 0;
        timeMs  += r.total_time_ms ?? 0;
        best     = Math.max(best, r.streak_record ?? 0);
        perfect += r.perfect_wins  ?? 0;
        const k  = MODE_MAP[r.mode];
        if (k) { modeCount[k] = r.games ?? 0; modeWins[k] = r.wins ?? 0; }
      }
      if (!p.stats) p.stats = {};
      p.stats.wins             = wins;
      p.stats.giveups          = giveups;
      p.stats.games            = games;
      p.stats.streakRecord     = best;
      p.stats.totalTimeMinutes = Math.round(timeMs / 60000);
      p.stats.perfectWins      = perfect;
      p.stats.streak           = Math.max(0, ...d.stats.map(r => r.streak ?? 0));
      p.stats.modeCount        = modeCount;
      p.stats.modeWins         = modeWins;
      const fav = d.stats.reduce((b, r) => (!b || r.games > b.games) ? r : b, null);
      if (fav) p.stats.favoriteMode = MODE_MAP[fav.mode] ?? fav.mode;
    }

    // ── Badges (cloud → local, jamais régressif) ───────────────────────────
    let newB = [];
    if (Array.isArray(d.badges)) {
      if (!p.badges) p.badges = [];
      const backIds = d.badges.map(b => b.badge_id);
      newB = backIds.filter(id => !p.badges.includes(id));
      if (newB.length) p.badges = [...p.badges, ...newB];
    }

    // ── Wallpapers débloqués ────────────────────────────────────────────────
    let newW = [];
    if (Array.isArray(d.unlocked_wallpapers)) {
      if (!p.unlockedWallpapers) p.unlockedWallpapers = [];
      newW = d.unlocked_wallpapers.filter(id => !p.unlockedWallpapers.includes(id));
      if (newW.length) p.unlockedWallpapers.push(...newW);
    }

    // ── Titres débloqués ────────────────────────────────────────────────────
    let newT = [];
    if (Array.isArray(d.unlocked_titles)) {
      if (!p.unlockedTitles) p.unlockedTitles = [];
      const slugs = d.unlocked_titles.map(t => t.slug);
      newT = slugs.filter(s => !p.unlockedTitles.includes(s));
      if (newT.length) p.unlockedTitles.push(...newT);
    }

    // ── Notification "cadeau reçu" si nouveaux items (jamais remontrés) ──────
    const _allNew = [
      ...newB.map(id   => ({ type: 'badge',    id })),
      ...newW.map(id   => ({ type: 'wallpaper', id })),
      ...newT.map(slug => ({ type: 'title',     id: slug })),
    ];
    if (_allNew.length > 0) {
      const ANNOUNCED_KEY = '_announcedGiftIds';
      let announced = [];
      try { announced = JSON.parse(localStorage.getItem(ANNOUNCED_KEY) || '[]'); } catch {}
      const _trulyNew = _allNew.filter(item => !announced.includes(`${item.type}:${item.id}`));
      if (_trulyNew.length > 0) {
        _trulyNew.forEach(item => announced.push(`${item.type}:${item.id}`));
        localStorage.setItem(ANNOUNCED_KEY, JSON.stringify(announced));

        // Persiste pour les pages qui n'ont pas encore le listener (ex: mode pages)
        // Les pages qui affichent l'animation (index, profile) vident cette clé après affichage
        try {
          const pending = JSON.parse(localStorage.getItem('_pendingDivineGifts') || '[]');
          pending.push(..._trulyNew);
          localStorage.setItem('_pendingDivineGifts', JSON.stringify(pending));
        } catch {}

        window.dispatchEvent(new CustomEvent('personadle:gifts-received', {
          detail: { items: _trulyNew },
        }));
      }
    }

    // Marquer le profil comme appartenant à cet utilisateur (anti-import étranger)
    p._accountId = user.id;

    _saveLocalProfile(p);

    // Notifier la page courante qu'un sync vient d'avoir lieu
    window._onCloudSync?.(d);

    return d;
  } catch (e) {
    console.warn('[cloud-sync] pullProfileFromCloud error:', e.message);
    return null;
  }
}

/**
 * Pousse le changement de langue vers le backend.
 * Fire-and-forget — ne bloque pas l'UI.
 */
export function pushLangToCloud(lang) {
  const user = window._currentUser;
  const api  = window._personadleApi;
  if (!user?.id || !api) return;
  api.user.update(user.id, { lang }).catch(() => {});
}
