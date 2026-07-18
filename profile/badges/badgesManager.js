// ═══════════════════════════════════════════════════════════════════════════
// 🎖️ PERSONADLE - GESTIONNAIRE DE BADGES
// ═══════════════════════════════════════════════════════════════════════════

import {
  badgesList,
  BADGE_CATEGORIES,
  eventCodes,
  isEventCodeValid,
  getBadgeById,
} from "./badgesData.js";
// Référence au saveProfile courant pour les click handlers (mis à jour à chaque renderBadgesModal)
let _lastSaveProfile = () => {};

// ───────────────────────────────────────────────────────────────────────────
// 🔧 CONSTANTES
// ───────────────────────────────────────────────────────────────────────────
const MAX_SELECTED_BADGES = 4;
const NOTIFICATION_DURATION = 4000;
const MESSAGE_DISPLAY_DURATION = 3000;

// ───────────────────────────────────────────────────────────────────────────
// 🔔 FILE DE NOTIFICATIONS (sequential queue)
// ───────────────────────────────────────────────────────────────────────────
const _notifQueue = [];
let _notifBusy = false;

/** Ajoute un badge à la file et démarre la lecture si elle est libre. */
function queueNotification(badge) {
  _notifQueue.push(badge);
  if (!_notifBusy) _drainNotifQueue();
}

/** Lit la file une notification à la fois. */
function _drainNotifQueue() {
  if (_notifQueue.length === 0) {
    _notifBusy = false;
    return;
  }
  _notifBusy = true;
  const badge = _notifQueue.shift();
  _showBadgeNotificationImmediate(badge, () => _drainNotifQueue());
}

// ───────────────────────────────────────────────────────────────────────────
// 🌐 HELPERS I18N
// ───────────────────────────────────────────────────────────────────────────

/**
 * Retourne le nom traduit d'un badge selon la langue active.
 * Priorité : lang JSON → fallback sur badge.name (EN hardcodé).
 */
function getBadgeName(badge) {
  const t = window.i18n?.t;
  if (t) {
    const translated = t(`badges.${badge.id}.name`);
    // t() retourne la clé brute si introuvable — on vérifie
    if (translated && !translated.startsWith("badges.")) return translated;
  }
  return badge.name;
}

/**
 * Retourne la description traduite d'un badge.
 */
function getBadgeDescription(badge) {
  const t = window.i18n?.t;
  if (t) {
    const translated = t(`badges.${badge.id}.description`);
    if (translated && !translated.startsWith("badges.")) return translated;
  }
  return badge.description || "";
}

/**
 * Retourne la condition traduite d'un badge.
 * Si secret et verrouillé, retourne "???".
 */
function getBadgeCondition(badge, isUnlocked) {
  if (badge.secret && !isUnlocked) return "???";
  const t = window.i18n?.t;
  if (t) {
    const translated = t(`badges.${badge.id}.condition`);
    if (translated && !translated.startsWith("badges.")) return translated;
  }
  return badge.condition;
}

// Labels des catégories (traduits dynamiquement)
const CATEGORY_LABELS = {
  [BADGE_CATEGORIES.ACHIEVEMENT]: {
    icon: "🏆",
    key: "badges.category_achievement",
    fallback: "Achievements",
  },
  [BADGE_CATEGORIES.STREAK]: { icon: "🔥", key: "badges.category_streak", fallback: "Streaks" },
  [BADGE_CATEGORIES.EVENT]: { icon: "🎟️", key: "badges.category_event", fallback: "Events" },
  [BADGE_CATEGORIES.SECRET]: { icon: "🔒", key: "badges.category_secret", fallback: "Secrets" },
  [BADGE_CATEGORIES.SOCIAL]: { icon: "👥", key: "badges.category_social", fallback: "Social" },
};

function getCategoryLabel(category) {
  const meta = CATEGORY_LABELS[category];
  if (!meta) return category;
  const t = window.i18n?.t;
  const label = t ? t(meta.key) : null;
  const name = label && !label.startsWith("badges.") ? label : meta.fallback;
  return `${meta.icon} ${name}`;
}

// ───────────────────────────────────────────────────────────────────────────
// 🎯 INITIALISATION DU SYSTÈME
// ───────────────────────────────────────────────────────────────────────────

/**
 * Initialise le système de badges complet
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde du profil
 */
export function initBadgesSystem(profile, saveProfile) {
  console.log("🎖️ Initializing badges system...");

  initializeProfileBadgesData(profile);

  // 🎊 VÉRIFIER LES ÉVÉNEMENTS DU JOUR EN PREMIER
  checkEventBadges(profile, saveProfile);

  // Vérifier et débloquer les badges
  checkAndUnlockBadges(profile, saveProfile);

  // 🔔 VÉRIFIER LES NOTIFICATIONS EN DERNIER (après que les badges soient ajoutés)
  checkPendingBadgeNotifications(profile, saveProfile);

  // Sync backend (fire-and-forget)
  syncBadgesWithBackend(profile, saveProfile);
  checkSocialBadges(profile, saveProfile);

  // Rendre l'interface
  renderBadgesPreview(profile);
  renderBadgesModal(profile, saveProfile);

  // Configurer le système de codes
  setupEventCodeRedeem(profile, saveProfile);

  console.log("✅ Badges system initialized!");
}

// ───────────────────────────────────────────────────────────────────────────
// 🔁 SYNC BACKEND
// ───────────────────────────────────────────────────────────────────────────

/**
 * Réconcilie les badges local ↔ backend.
 * - Badges backend absents du local → ajoutés + notification
 * - Badges local absents du backend → push via api.badges.unlock()
 */
export async function syncBadgesWithBackend(profile, saveProfile) {
  const user = window._currentUser;
  const api = window._personadleApi;
  if (!user || !api) return;

  // Sécurité anti-import : si le profil local appartient à un autre compte,
  // on ne pousse rien vers le backend (seul le pull cloud est autorisé).
  const ownProfile = !profile._accountId || String(profile._accountId) === String(user.id);

  try {
    const catalog = await api.badges.catalog();
    const backendIds = catalog.filter((b) => Number(b.is_unlocked) === 1).map((b) => b.slug);
    const localIds = profile.badges || [];

    // Backend → local (badges débloqués sur un autre appareil ou directement en BDD)
    const toAddLocally = backendIds.filter((id) => !localIds.includes(id));
    if (toAddLocally.length) {
      profile.badges = [...localIds, ...toAddLocally];
      saveProfile();

      // Animer uniquement les badges jamais montrés sur cet appareil
      // (_seenBadgeAnimIds persiste en dehors du profil, résiste aux resets de profil)
      let seenAnims = [];
      try {
        seenAnims = JSON.parse(localStorage.getItem("_seenBadgeAnimIds") || "[]");
      } catch {}
      const toAnimate = toAddLocally.filter((id) => !seenAnims.includes(id));
      if (toAnimate.length) {
        seenAnims.push(...toAnimate);
        localStorage.setItem("_seenBadgeAnimIds", JSON.stringify(seenAnims));
        toAnimate.forEach((id) => {
          const badge = getBadgeById(id);
          if (badge) queueNotification(badge);
        });
      }

      // Re-render : renderBadgesModal était déjà appelé avant la fin de ce fetch async
      renderBadgesPreview(profile);
      renderBadgesModal(profile, saveProfile);
    }

    // Local → backend (bloqué si le profil vient d'un autre compte)
    if (ownProfile) {
      const toSyncUp = localIds.filter((id) => !backendIds.includes(id));
      for (const id of toSyncUp) {
        await api.badges.unlock(id).catch(() => {});
      }
    } else {
      console.warn("[badges] sync local→backend bloqué : profil importé depuis un autre compte");
    }
  } catch (e) {
    console.warn("⚠️ Badge sync failed (offline?):", e.message);
  }
}

/**
 * Vérifie les badges sociaux nécessitant des données backend.
 * Appelée depuis initBadgesSystem si l'utilisateur est connecté.
 */
export async function checkSocialBadges(profile, saveProfile) {
  const user = window._currentUser;
  if (!user) return;

  try {
    const api = window._personadleApi;
    const friendsRes = api ? await api.friends.list() : null;
    const friends = friendsRes?.friends || [];
    const friendCount = friends.length;

    // Best Bro : 2+ amis
    if (friendCount >= 2 && !profile.hasTwoFriends) {
      profile.hasTwoFriends = true;
      saveProfile();
    }

    // Leblanc Meeting : 3+ amis vus aujourd'hui
    const today = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" })
      .format(new Date())
      .split("/")
      .reverse()
      .join("-");
    const onlineToday = friends.filter((f) => f.last_seen_at?.startsWith(today));
    if (onlineToday.length >= 3 && !profile.leblanc3FriendsDay) {
      profile.leblanc3FriendsDay = today;
      saveProfile();
    }
  } catch (e) {
    console.warn("⚠️ Social badge check failed:", e.message);
  }
}

/**
 * Incrémente uniqueDaysPlayed si aujourd'hui n'a pas encore été compté.
 */
export function trackUniqueDay(profile, saveProfile) {
  const today = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");
  if (!profile.uniqueDaysSet) profile.uniqueDaysSet = [];
  if (!profile.uniqueDaysSet.includes(today)) {
    profile.uniqueDaysSet.push(today);
    profile.uniqueDaysPlayed = profile.uniqueDaysSet.length;
    saveProfile();
  }
  trackP4ConsecutiveDays(profile, saveProfile, today);
}

/**
 * Jours consécutifs joués avec un filtre Persona 4 actif (wallpaper Yukiko's Dungeons).
 * Lit les filtres d'opus actifs dans le localStorage de chaque mode ; si au moins un
 * filtre P4* est actif, incrémente le compteur de jours consécutifs (frontière Paris).
 */
function trackP4ConsecutiveDays(profile, saveProfile, today) {
  const FILTER_KEYS = [
    "filters_Classic",
    "filters_Emoji",
    "silhouetteActiveFilters",
    "filters_AllOutAttack",
    "personaeActiveFilters",
    "musicActiveFilters",
  ];
  let p4Active = false;
  for (const k of FILTER_KEYS) {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "[]");
      if (Array.isArray(v) && v.some((f) => typeof f === "string" && f.startsWith("P4"))) {
        p4Active = true;
        break;
      }
    } catch (_) {
      /* clé absente ou JSON invalide → ignorer */
    }
  }
  if (!p4Active) return;
  if (profile.p4LastDate === today) return; // déjà compté aujourd'hui

  const y = new Date(today + "T12:00:00Z");
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);

  profile.p4ConsecutiveDays = profile.p4LastDate === yesterday
    ? (profile.p4ConsecutiveDays || 0) + 1
    : 1;
  profile.p4LastDate = today;
  saveProfile();
}

/**
 * Initialise les propriétés du profil liées aux badges
 * @param {Object} profile - Le profil utilisateur
 */
function initializeProfileBadgesData(profile) {
  if (!profile.badges) {
    profile.badges = [];
    console.log("📦 Created profile.badges array");
  }

  if (!profile.selectedBadges) {
    profile.selectedBadges = [];
    console.log("📦 Created profile.selectedBadges array");
  }

  if (!profile.eventCodes) {
    profile.eventCodes = [];
    console.log("📦 Created profile.eventCodes array");
  }

  if (!profile.foundBurnMyDread) {
    profile.foundBurnMyDread = false;
  }

  if (!profile.hasSharedProfile) {
    profile.hasSharedProfile = false;
  }

  if (!profile.foundCrow) {
    profile.foundCrow = false;
  }

  if (!profile.foundBlackMask) {
    profile.foundBlackMask = false;
  }

  if (!profile.pendingBadgeNotifications) {
    profile.pendingBadgeNotifications = [];
  }

  // 🎊 Badges événementiels
  if (!profile.eventBadges) {
    profile.eventBadges = {};
    console.log("📦 Created profile.eventBadges object");
  }

  // ── Nouveaux flags v2.1 ──────────────────────────────────────────────────
  if (profile.classicHintsUsed === undefined) profile.classicHintsUsed = 0;
  if (profile.uniqueDaysPlayed === undefined) profile.uniqueDaysPlayed = 0;
  if (!profile.uniqueDaysSet) profile.uniqueDaysSet = [];
  if (!profile.characterModeMap) profile.characterModeMap = {};

  // Strega
  if (profile.foundHypnos === undefined) profile.foundHypnos = false;
  if (profile.foundMoros === undefined) profile.foundMoros = false;
  if (profile.foundMedea === undefined) profile.foundMedea = false;

  // Twin Fist
  if (profile.foundMakotoNijima === undefined) profile.foundMakotoNijima = false;
  if (profile.foundMakotoNijimaAOA === undefined) profile.foundMakotoNijimaAOA = false;
  if (profile.foundAkihiko === undefined) profile.foundAkihiko = false;
  if (profile.foundAkihikoAOA === undefined) profile.foundAkihikoAOA = false;

  // Twin Spear
  if (profile.foundKotone === undefined) profile.foundKotone = false;
  if (profile.foundKotoneAOA === undefined) profile.foundKotoneAOA = false;
  if (profile.foundKen === undefined) profile.foundKen = false;
  if (profile.foundKenAOA === undefined) profile.foundKenAOA = false;

  // Tradition & Modernité
  if (profile.foundNaotoPersona === undefined) profile.foundNaotoPersona = false;
  if (profile.foundFutabaPersona === undefined) profile.foundFutabaPersona = false;
  if (profile.foundSecretBase === undefined) profile.foundSecretBase = false;
  if (profile.foundWhenMotherWasThere === undefined) profile.foundWhenMotherWasThere = false;

  // Music
  if (profile.gaveUpOnOurLight === undefined) profile.gaveUpOnOurLight = false;

  // For Real (Ryuji)
  if (profile.foundRyujiAOA === undefined) profile.foundRyujiAOA = false;
  if (profile.foundRyujiPersona === undefined) profile.foundRyujiPersona = false;

  // Sociaux
  if (!profile.visitedProfileIds) profile.visitedProfileIds = [];
  if (profile.leblanc3FriendsDay === undefined) profile.leblanc3FriendsDay = null;
  if (profile.hasTwoFriends === undefined) profile.hasTwoFriends = false;

  // Événements
  if (profile.playedDec31 === undefined) profile.playedDec31 = false;
  if (profile.playedJan1 === undefined) profile.playedJan1 = false;

  // Gameplay
  if (profile.hasWonFirstTry === undefined) profile.hasWonFirstTry = false;
  if (profile.hasWonAOAFirstTry === undefined) profile.hasWonAOAFirstTry = false;
  if (profile.playedAtNight === undefined) profile.playedAtNight = false;
  if (profile.playedAtNyxHour === undefined) profile.playedAtNyxHour = false;

  // Secrets
  if (profile.hifumiArchivesRead === undefined) profile.hifumiArchivesRead = false;
  if (profile.reportSubmitted === undefined) profile.reportSubmitted = false;

  // Streak restore
  if (profile.streakRestorationUsed === undefined) profile.streakRestorationUsed = false;
}

// ───────────────────────────────────────────────────────────────────────────
// 🔓 VÉRIFICATION ET DÉBLOCAGE DES BADGES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Vérifie tous les badges et débloque ceux qui sont obtenus
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 */
function checkAndUnlockBadges(profile, saveProfile) {
  const stats = profile.stats || {};
  const newlyUnlocked = [];

  badgesList.forEach((badge) => {
    // Si déjà débloqué, on passe
    if (profile.badges.includes(badge.id)) {
      return;
    }

    try {
      // Vérifier la condition de déblocage
      const isUnlocked = badge.check(stats, profile);

      if (isUnlocked) {
        console.log(`🎉 Badge unlocked: ${badge.name} (${badge.id})`);
        profile.badges.push(badge.id);
        newlyUnlocked.push(badge);
      }
    } catch (error) {
      console.error(`❌ Error checking badge ${badge.id}:`, error);
    }
  });

  // Sauvegarder et notifier
  if (newlyUnlocked.length > 0) {
    saveProfile();
    console.log(`✅ ${newlyUnlocked.length} new badge(s) unlocked!`);

    // Afficher les notifications uniquement pour les badges jamais montrés
    let seenAnims = [];
    try {
      seenAnims = JSON.parse(localStorage.getItem("_seenBadgeAnimIds") || "[]");
    } catch {}
    let delay = 0;
    newlyUnlocked.forEach((badge) => {
      if (!seenAnims.includes(badge.id)) {
        seenAnims.push(badge.id);
        const d = delay;
        setTimeout(() => showBadgeNotification(badge), d);
        delay += 500;
      }
      window._personadleApi?.badges?.unlock(badge.id).catch(() => {});
    });
    localStorage.setItem("_seenBadgeAnimIds", JSON.stringify(seenAnims));
  }
}

/**
 * Vérifie et affiche les notifications de badges en attente
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 */
function checkPendingBadgeNotifications(profile, saveProfile) {
  if (!profile.pendingBadgeNotifications || profile.pendingBadgeNotifications.length === 0) {
    return;
  }

  // Filtrer les badges dont l'animation a déjà été montrée (clé indépendante du profil)
  let seenAnims = [];
  try {
    seenAnims = JSON.parse(localStorage.getItem("_seenBadgeAnimIds") || "[]");
  } catch {}

  const toNotify = profile.pendingBadgeNotifications.filter((id) => !seenAnims.includes(id));
  console.log(
    "🔔 Pending badge notifications:",
    profile.pendingBadgeNotifications,
    "→ to show:",
    toNotify
  );

  let delay = 0;
  toNotify.forEach((badgeId) => {
    const badge = getBadgeById(badgeId);
    if (badge) {
      seenAnims.push(badgeId);
      const d = delay;
      setTimeout(() => showBadgeNotification(badge), d);
      delay += 500;
    }
  });

  if (toNotify.length) localStorage.setItem("_seenBadgeAnimIds", JSON.stringify(seenAnims));

  // Vider la liste des notifications en attente
  profile.pendingBadgeNotifications = [];
  saveProfile();
}

/**
 * Débloque manuellement un badge (pour les codes événements)
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 * @param {string} badgeId - L'ID du badge à débloquer
 * @returns {boolean} - True si le badge a été débloqué
 */
export function unlockBadge(profile, saveProfile, badgeId) {
  if (profile.badges.includes(badgeId)) {
    console.log(`⚠️ Badge ${badgeId} already unlocked`);
    return false;
  }

  const badge = getBadgeById(badgeId);
  if (!badge) {
    console.error(`❌ Badge ${badgeId} not found`);
    return false;
  }

  console.log(`🔓 Manually unlocking badge: ${badge.name}`);
  profile.badges.push(badgeId);
  saveProfile();
  showBadgeNotification(badge);
  window._personadleApi?.badges?.unlock(badgeId).catch(() => {});

  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// 🎉 NOTIFICATIONS DE BADGES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Affiche une notification de déblocage de badge (via la file — ne se superpose pas).
 * @param {Object} badge - Le badge débloqué
 */
function showBadgeNotification(badge) {
  queueNotification(badge);
}

/**
 * Affiche immédiatement une notification ; appelle `onDone` une fois terminée.
 * Appelée exclusivement par _drainNotifQueue().
 */
function _showBadgeNotificationImmediate(badge, onDone) {
  const notif = document.createElement("div");
  notif.className = "badge-notification";
  notif.style.cursor = "pointer";
  const _k = "badges.notification_title";
  const _r = window.i18n?.t?.(_k);
  const notifTitle = _r && _r !== _k ? _r : "🎖️ Badge Unlocked!";
  const name = getBadgeName(badge);
  const desc = getBadgeDescription(badge);

  notif.innerHTML = `
    <div class="badge-notif-content">
      <img src="${badge.img}" alt="${name}" onerror="this.src=new URL('./images/default.png',import.meta.url).href">
      <div>
        <h4>${notifTitle}</h4>
        <p><strong>${name}</strong></p>
        <small>${desc}</small>
      </div>
    </div>
  `;

  document.body.appendChild(notif);

  // Click : ferme immédiatement et passe à la suivante
  notif.onclick = () => {
    notif.remove();
    showBadgeZoom(badge);
    onDone();
  };

  // Animation d'entrée
  setTimeout(() => notif.classList.add("show"), 100);

  // Animation de sortie → puis callback pour la suivante
  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => {
      notif.remove();
      onDone();
    }, 300);
  }, NOTIFICATION_DURATION);
}

/**
 * Affiche le zoom du badge avec tous les détails
 * @param {Object} badge - Le badge à afficher
 */
function showBadgeZoom(badge) {
  const modal = document.createElement("div");
  modal.className = "badge-zoom-modal";

  const zName = getBadgeName(badge);
  const zDesc = getBadgeDescription(badge);
  const zCond = getBadgeCondition(badge, true); // dans le zoom on montre toujours la condition

  modal.innerHTML = `
    <div class="badge-zoom-content">
      <span class="badge-zoom-close">&times;</span>
      <img src="${badge.img}" alt="${zName}">
      <h3>${zName}</h3>
      <p class="badge-condition">${zCond}</p>
      ${zDesc ? `<p class="badge-description">${zDesc}</p>` : ""}
    </div>
  `;

  document.body.appendChild(modal);

  // 🟢 FERMETURE PAR CLIC FOND
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("badge-zoom-modal")) {
      modal.remove();
    }
  });

  // ❌ FERMETURE CROIX
  modal.querySelector(".badge-zoom-close").onclick = () => modal.remove();

  // 🔥 ANIMATION
  setTimeout(() => modal.classList.add("show"), 10);
}

// ───────────────────────────────────────────────────────────────────────────
// 🏅 PRÉVISUALISATION DES BADGES (4 badges max)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Affiche la prévisualisation des badges sélectionnés
 * @param {Object} profile - Le profil utilisateur
 */
export function renderBadgesPreview(profile) {
  const preview = document.getElementById("previewBadges");
  if (!preview) return;

  const ids = profile.selectedBadges || [];
  preview.innerHTML = "";

  if (ids.length === 0) {
    preview.innerHTML = `<p style="opacity:0.6; text-align:center;">No badges selected yet.</p>`;
    window.dispatchEvent(new CustomEvent("badgesRendered"));
    return;
  }

  ids.forEach((id) => {
    const strId = String(id);
    const badge = badgesList.find((b) => b.id === id);
    if (!badge) return;
    const img = document.createElement("img");
    img.src = badge.img;
    img.alt = badge.name;
    img.title = badge.name;
    img.className = "badge-preview-img";
    img.dataset.badgeId = strId;
    img.onerror = () => {
      img.src = new URL("./images/default.png", import.meta.url).href;
    };
    preview.appendChild(img);
  });

  window.dispatchEvent(new CustomEvent("badgesRendered"));
}

// ───────────────────────────────────────────────────────────────────────────
// 📋 MODAL DE GESTION DES BADGES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Affiche la modal complète avec tous les badges
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 */
export function renderBadgesModal(profile, saveProfile) {
  _lastSaveProfile = saveProfile;
  const grid = document.getElementById("badgesGrid");
  const counter = document.getElementById("badgesCounter");
  const openBtn = document.getElementById("openBadgesModal");
  const modal = document.getElementById("badgesModal");
  const closeBtn = document.getElementById("closeBadgesModal");

  if (!grid) {
    console.warn("⚠️ badgesGrid element not found");
    return;
  }

  // Regrouper les badges par catégorie (secrets non débloqués masqués)
  const categoryOrder = [
    BADGE_CATEGORIES.ACHIEVEMENT,
    BADGE_CATEGORIES.STREAK,
    BADGE_CATEGORIES.EVENT,
    BADGE_CATEGORIES.SOCIAL,
    BADGE_CATEGORIES.SECRET,
  ];

  const grouped = {};
  categoryOrder.forEach((cat) => {
    grouped[cat] = [];
  });

  badgesList.forEach((badge) => {
    // Masquer les secrets non débloqués
    if (badge.secret && !profile.badges.includes(badge.id)) return;
    const cat = badge.category || BADGE_CATEGORIES.ACHIEVEMENT;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(badge);
  });

  // Générer le HTML par sections
  let html = "";
  categoryOrder.forEach((cat) => {
    const badges = grouped[cat];
    if (!badges || badges.length === 0) return;

    const unlockedInCat = badges.filter((b) => profile.badges.includes(b.id)).length;
    const catLabel = getCategoryLabel(cat);

    html += `
      <div class="badges-category-section" data-category="${cat}">
        <button class="badges-category-header" aria-expanded="true">
          <span class="badges-category-title">${catLabel}</span>
          <span class="badges-category-right">
            <span class="badges-category-count">${unlockedInCat}/${badges.length}</span>
            <span class="badges-category-chevron" aria-hidden="true">▼</span>
          </span>
        </button>
        <div class="badges-grid-wrap">
        <div class="badges-grid">
          ${badges
            .map((badge) => {
              const isUnlocked = profile.badges.includes(badge.id);
              const isSelected = profile.selectedBadges.includes(badge.id);
              const name = getBadgeName(badge);
              const desc = getBadgeDescription(badge);
              const cond = getBadgeCondition(badge, isUnlocked);

              return `
              <div
                class="badge-item ${!isUnlocked ? "locked" : ""} ${isSelected ? "selected" : ""}"
                data-id="${badge.id}"
                data-unlocked="${isUnlocked}"
              >
                <img
                  src="${badge.img}"
                  alt="${name}"
                  onerror="this.src=new URL('./images/default.png',import.meta.url).href"
                >
                <p>${name}</p>
                ${isSelected ? '<span class="check-mark">✓</span>' : ""}
                <div class="badge-tooltip">
                  ${isUnlocked ? "🔓" : "🔒"} <strong>${name}</strong><br>
                  <span>${cond}</span><br>
                  <small style="opacity:0.8;">${desc}</small>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;

  // Mettre à jour le compteur
  updateBadgeCounter(profile, counter);

  // Attacher les événements de clic
  attachBadgeClickEvents(profile, saveProfile, grid);

  // Configurer l'ouverture/fermeture de la modal
  setupModalControls(openBtn, closeBtn, modal);

  // Catégories collapsibles
  setupCategoryCollapse(grid);

  // Recherche en temps réel
  setupBadgesSearch(grid);

  // Ajuster les tooltips après le rendu
  setTimeout(() => adjustTooltipPositions(), 100);

  console.log("✅ Badges modal rendered");
}

/**
 * Met à jour le compteur de badges
 * @param {Object} profile - Le profil utilisateur
 * @param {HTMLElement} counter - L'élément du compteur
 */
function updateBadgeCounter(profile, counter) {
  if (!counter) return;

  const totalBadges = badgesList.length;
  const unlockedBadges = profile.badges.length;
  const percentage = Math.round((unlockedBadges / totalBadges) * 100);

  const t = window.i18n?.t;
  const unlockedLabel =
    t && !t("profile.badges_unlocked").startsWith("profile.")
      ? t("profile.badges_unlocked")
      : "badges unlocked";

  counter.innerHTML = `
    🔓 <strong>${unlockedBadges} / ${totalBadges}</strong> ${unlockedLabel}
    <span style="opacity:0.7;">(${percentage}%)</span>
  `;
}

/**
 * Attache les événements de clic sur les badges
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 * @param {HTMLElement} grid - La grille de badges
 */
function attachBadgeClickEvents(profile, saveProfile, grid) {
  grid.querySelectorAll(".badge-item").forEach((element) => {
    element.onclick = () => {
      const badgeId = element.dataset.id;
      const isUnlocked = element.dataset.unlocked === "true";

      if (isUnlocked) {
        toggleBadgeSelection(profile, saveProfile, badgeId);
      } else {
        // Feedback visuel pour badge verrouillé
        element.style.animation = "shake 0.3s";
        setTimeout(() => {
          element.style.animation = "";
        }, 300);
      }
    };
  });
}

function setupCategoryCollapse(grid) {
  grid.querySelectorAll(".badges-category-header").forEach((header) => {
    header.addEventListener("click", () => {
      const section = header.closest(".badges-category-section");
      const isCollapsed = section.classList.toggle("collapsed");
      header.setAttribute("aria-expanded", String(!isCollapsed));
    });
  });
}

function setupBadgesSearch(grid) {
  const input = document.getElementById("badgesSearch");
  if (!input) return;
  input.value = "";
  input.oninput = () => {
    const q = input.value.toLowerCase().trim();
    grid.querySelectorAll(".badges-category-section").forEach((section) => {
      let anyVisible = false;
      section.querySelectorAll(".badge-item").forEach((item) => {
        const name = (item.querySelector("p")?.textContent || "").toLowerCase();
        const show = !q || name.includes(q);
        item.style.display = show ? "" : "none";
        if (show) anyVisible = true;
      });
      section.style.display = anyVisible ? "" : "none";
      // Auto-expand sections that have matching results
      if (q && anyVisible) {
        section.classList.remove("collapsed");
        section.querySelector(".badges-category-header")?.setAttribute("aria-expanded", "true");
      }
    });
  };
}

/**
 * Configure les contrôles de la modal (ouverture/fermeture)
 * @param {HTMLElement} openBtn - Bouton d'ouverture
 * @param {HTMLElement} closeBtn - Bouton de fermeture
 * @param {HTMLElement} modal - La modal
 */
function setupModalControls(openBtn, closeBtn, modal) {
  if (openBtn && modal) {
    openBtn.onclick = () => {
      modal.classList.remove("hidden");
      console.log("📂 Badges modal opened");
    };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      modal.classList.add("hidden");
      console.log("📁 Badges modal closed");
    };
  }

  // Fermer en cliquant en dehors
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    };
  }

  // Bouton « Sauvegarder » explicite, en bas de la modale (sticky). La sélection
  // s'auto-sauve déjà à chaque clic, mais ce bouton confirme visuellement
  // (sync cloud best-effort + feedback inline + fermeture).
  if (modal && !document.getElementById("saveBadgesBtn")) {
    const _t = (k, fb) => {
      const r = window.i18n?.t?.(k);
      return r != null && r !== k ? r : fb;
    };
    const footer = document.createElement("div");
    footer.className = "badges-modal-footer";
    const btn = document.createElement("button");
    btn.id = "saveBadgesBtn";
    btn.type = "button";
    btn.className = "badges-save-btn";
    const label = _t("profile.badges_save", "💾 Save");
    btn.textContent = label;
    btn.onclick = () => {
      try {
        _lastSaveProfile();
      } catch (_) {
        /* sauvegarde best-effort */
      }
      // Feedback inline garanti (ne dépend pas de window.showToast qui peut manquer)
      btn.classList.add("saved");
      btn.textContent = _t("profile.badges_saved", "✅ Badges saved!");
      if (typeof window.showToast === "function") {
        window.showToast(_t("profile.badges_saved", "✅ Badges saved!"));
      }
      setTimeout(() => modal.classList.add("hidden"), 550);
      setTimeout(() => {
        btn.classList.remove("saved");
        btn.textContent = label;
      }, 900);
    };
    footer.appendChild(btn);
    // En bas de la modale, après la grille des badges.
    modal.appendChild(footer);
  }
}

/**
 * Ajuste dynamiquement la position des tooltips pour éviter les débordements
 */
function adjustTooltipPositions() {
  const modal = document.getElementById("badgesModal");
  if (!modal) return;

  document.querySelectorAll(".badge-item").forEach((item) => {
    const tooltip = item.querySelector(".badge-tooltip");
    if (!tooltip) return;

    item.addEventListener("mouseenter", function adjustOnHover() {
      const modalRect = modal.getBoundingClientRect();

      setTimeout(() => {
        const tooltipRect = tooltip.getBoundingClientRect();

        // Déborde à gauche
        if (tooltipRect.left < modalRect.left + 10) {
          tooltip.style.left = "0";
          tooltip.style.right = "auto";
          tooltip.style.transform = "translateX(0) translateY(-10px)";
        }
        // Déborde à droite
        else if (tooltipRect.right > modalRect.right - 10) {
          tooltip.style.left = "auto";
          tooltip.style.right = "0";
          tooltip.style.transform = "translateX(0) translateY(-10px)";
        }
        // Centré (position normale)
        else {
          tooltip.style.left = "50%";
          tooltip.style.right = "auto";
          tooltip.style.transform = "translate(-50%, -10px)";
        }
      }, 10);
    });
  });
}

// ───────────────────────────────────────────────────────────────────────────
// ✅ SÉLECTION DE BADGES (Maximum 4)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Bascule la sélection d'un badge
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 * @param {string} badgeId - L'ID du badge
 */
export function toggleBadgeSelection(profile, saveProfile, badgeId) {
  const selectedBadges = profile.selectedBadges || [];
  const isCurrentlySelected = selectedBadges.includes(badgeId);

  if (isCurrentlySelected) {
    // Désélectionner
    profile.selectedBadges = selectedBadges.filter((id) => id !== badgeId);
    console.log(`➖ Badge deselected: ${badgeId}`);
  } else {
    // Vérifier la limite
    if (selectedBadges.length >= MAX_SELECTED_BADGES) {
      showSelectionLimitAlert();
      return;
    }

    // Sélectionner
    profile.selectedBadges.push(badgeId);
    console.log(`➕ Badge selected: ${badgeId}`);
  }

  // Sauvegarder et rafraîchir
  saveProfile();
  renderBadgesPreview(profile);
  renderBadgesModal(profile, saveProfile);
}

/**
 * Affiche une alerte quand la limite de sélection est atteinte
 */
function showSelectionLimitAlert() {
  const alertDiv = document.createElement("div");
  alertDiv.className = "badge-limit-alert";
  alertDiv.innerHTML = `
    <div class="alert-content">
      ⚠️ You can only select <strong>${MAX_SELECTED_BADGES} badges</strong>!<br>
      <small>Deselect one first.</small>
    </div>
  `;

  document.body.appendChild(alertDiv);

  setTimeout(() => alertDiv.classList.add("show"), 100);
  setTimeout(() => {
    alertDiv.classList.remove("show");
    setTimeout(() => alertDiv.remove(), 300);
  }, 2500);
}

// ───────────────────────────────────────────────────────────────────────────
// 🎟️ SYSTÈME DE CODES ÉVÉNEMENTIELS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Configure le système de saisie de codes événementiels
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 */
function setupEventCodeRedeem(profile, saveProfile) {
  const input = document.getElementById("eventCodeInput");
  const btn = document.getElementById("redeemEventCodeBtn");
  const msg = document.getElementById("eventCodeMessage");

  if (!input || !btn) {
    console.warn("⚠️ Event code elements not found");
    return;
  }

  btn.onclick = () => handleEventCodeSubmit(profile, saveProfile, input, msg);

  // Permettre l'envoi avec Enter
  input.onkeypress = (e) => {
    if (e.key === "Enter") {
      handleEventCodeSubmit(profile, saveProfile, input, msg);
    }
  };

  console.log("✅ Event code system initialized");
}

/**
 * Gère la soumission d'un code événementiel
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 * @param {HTMLInputElement} input - Le champ de saisie
 * @param {HTMLElement} msg - L'élément de message
 */
export function handleEventCodeSubmit(profile, saveProfile, input, msg) {
  const code = input.value.trim().toUpperCase();

  // Vérifier que le code n'est pas vide
  if (!code) {
    showCodeMessage(msg, "⚠️ Please enter a code first!", "warning");
    return;
  }

  // Vérifier que le code existe
  const codeData = eventCodes[code];
  if (!codeData) {
    showCodeMessage(msg, "❌ Invalid code. Check your spelling!", "error");
    input.value = "";
    return;
  }

  // Vérifier si déjà utilisé
  if (profile.eventCodes.includes(code)) {
    showCodeMessage(msg, "✅ You already redeemed this code!", "success");
    input.value = "";
    return;
  }

  // Vérifier la validité temporelle (sauf codes permanents)
  if (!codeData.permanent && !isEventCodeValid(code)) {
    showCodeMessage(msg, "⏰ This event is not active yet or has expired.", "error");
    input.value = "";
    return;
  }

  // Code valide : débloquer le badge
  profile.eventCodes.push(code);
  console.log(`🎟️ Code redeemed: ${code}`);

  const badge = getBadgeById(codeData.badgeId);
  if (badge) {
    if (!profile.badges.includes(badge.id)) {
      profile.badges.push(badge.id);
      showBadgeNotification(badge);
    }
  }

  // Sauvegarder et rafraîchir
  saveProfile();
  renderBadgesModal(profile, saveProfile);
  renderBadgesPreview(profile);

  input.value = "";
  showCodeMessage(msg, "🎉 Badge unlocked successfully!", "success");
}

/**
 * Affiche un message de retour pour les codes
 * @param {HTMLElement} element - L'élément du message
 * @param {string} text - Le texte à afficher
 * @param {string} type - Le type de message (success, error, warning)
 */
function showCodeMessage(element, text, type) {
  if (!element) return;

  const colors = {
    error: "#e74c3c",
    success: "#2ecc71",
    warning: "#f39c12",
  };

  element.textContent = text;
  element.style.color = colors[type] || colors.warning;
  element.style.opacity = "1";

  setTimeout(() => {
    element.style.opacity = "0";
    setTimeout(() => {
      element.textContent = "";
    }, 300);
  }, MESSAGE_DISPLAY_DURATION);
}

// ───────────────────────────────────────────────────────────────────────────
// 📤 FONCTIONS UTILITAIRES PUBLIQUES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Récupère les badges sélectionnés pour le partage de profil
 * @param {Object} profile - Le profil utilisateur
 * @returns {Array} - Les badges sélectionnés (max 4)
 */
export function getBadgesForShare(profile) {
  const result = [];
  for (const id of profile.selectedBadges || []) {
    if (result.length >= MAX_SELECTED_BADGES) break;
    const badge = badgesList.find((b) => b.id === id);
    if (badge) result.push(badge);
  }
  return result;
}

/**
 * Marque le profil comme partagé (débloque le badge "Take The Pose")
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 */
export function markProfileAsShared(profile, saveProfile) {
  if (!profile.hasSharedProfile) {
    profile.hasSharedProfile = true;
    console.log("📸 Profile marked as shared!");
    saveProfile();

    // Vérifier et débloquer les badges
    checkAndUnlockBadges(profile, saveProfile);
  }
}

/**
 * Force la vérification de tous les badges (utile après une action spéciale)
 * @param {Object} profile - Le profil utilisateur
 * @param {Function} saveProfile - Fonction de sauvegarde
 */
export function forceCheckBadges(profile, saveProfile) {
  console.log("🔄 Forcing badge check...");
  checkAndUnlockBadges(profile, saveProfile);
  renderBadgesModal(profile, saveProfile);
  renderBadgesPreview(profile);
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎊 PERSONADLE - GESTIONNAIRE DE BADGES ÉVÉNEMENTIELS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie et débloque automatiquement les badges événementiels selon la date
 */
export function checkEventBadges(inMemoryProfile) {
  // Quand appelée depuis initBadgesSystem, on reçoit le profil en mémoire et on le
  // modifie directement — sinon la sauvegarde ultérieure écraserait nos changements.
  // Quand appelée de manière autonome (intervalle horaire), on lit/écrit localStorage.
  const standalone = !inMemoryProfile || typeof inMemoryProfile !== "object";
  const profile = standalone
    ? JSON.parse(localStorage.getItem("personaUserProfile"))
    : inMemoryProfile;

  if (!profile) {
    console.warn("⚠️ No profile found, skipping event badges check");
    return;
  }

  // Initialiser les propriétés si nécessaire
  if (!profile.eventBadges) {
    profile.eventBadges = {};
  }

  if (!profile.pendingBadgeNotifications) {
    profile.pendingBadgeNotifications = [];
  }

  const today = new Date();
  const month = today.getMonth() + 1; // 1 = janvier, 4 = avril
  const day = today.getDate();

  // _seenBadgeAnimIds persiste indépendamment du profil — résiste aux re-logins
  let seenAnims = [];
  try {
    seenAnims = JSON.parse(localStorage.getItem("_seenBadgeAnimIds") || "[]");
  } catch {}

  // Helper : ajoute à pending uniquement si jamais montré
  const _queueEvent = (id) => {
    if (!seenAnims.includes(id) && !profile.pendingBadgeNotifications.includes(id)) {
      profile.pendingBadgeNotifications.push(id);
    }
  };

  let hasChanges = false;

  // ═══════════════════════════════════════════════════════════════════════
  // 🌸 BADGE RENTRÉE (1er avril - Rentrée scolaire japonaise)
  // ═══════════════════════════════════════════════════════════════════════
  if (month === 4 && day === 1 && !profile.eventBadges.rentree) {
    console.log("🌸 Event detected: Japanese School Year Start (April 1st)");
    profile.eventBadges.rentree = true;
    hasChanges = true;
    _queueEvent("rentree");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🌟 GOLDEN WEEK (29 avril – 5 mai)
  // ═══════════════════════════════════════════════════════════════════════
  if (!profile.eventBadges.golden_week) {
    const isGW = (month === 4 && day >= 29) || (month === 5 && day <= 5);
    if (isGW) {
      profile.eventBadges.golden_week = true;
      hasChanges = true;
      _queueEvent("golden_week");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🎋 TANABATA (7 juillet)
  // ═══════════════════════════════════════════════════════════════════════
  if (!profile.eventBadges.tanabata && month === 7 && day === 7) {
    profile.eventBadges.tanabata = true;
    hasChanges = true;
    _queueEvent("tanabata");
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🌑 PROMISED DAY (31 déc + 1er jan, les deux requis)
  // ═══════════════════════════════════════════════════════════════════════
  if (!profile.eventBadges.promised_day) {
    if (month === 12 && day === 31) {
      profile.playedDec31 = true;
      hasChanges = true;
    }
    if (month === 1 && day === 1) {
      profile.playedJan1 = true;
      hasChanges = true;
    }
    if (profile.playedDec31 && profile.playedJan1) {
      profile.eventBadges.promised_day = true;
      _queueEvent("promised_day");
    }
  }

  // Sauvegarder si mode autonome (intervalle) — en mode inline, le caller sauvegarde
  if (hasChanges && standalone) {
    localStorage.setItem("personaUserProfile", JSON.stringify(profile));
    console.log("💾 Event badges saved to profile");
  }
}

/**
 * Initialise la vérification automatique des badges événementiels
 * À appeler au chargement de chaque page
 */
export function initEventBadgesCheck() {
  console.log("🎊 Initializing event badges check...");

  // Vérifier immédiatement au chargement
  checkEventBadges();

  // Vérifier toutes les heures (au cas où l'utilisateur reste longtemps sur la page)
  setInterval(checkEventBadges, 60 * 60 * 1000); // 1 heure = 3600000 ms

  console.log("✅ Event badges check initialized");
}

/**
 * Lightweight badge check for game mode pages.
 * Reads profile from localStorage, evaluates all badge conditions,
 * shows unlock notifications. Does NOT render the profile page UI.
 * Call this after setting badge flags in a game mode's win/giveup handler.
 */
export function checkBadgesAfterGame() {
  const p = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
  if (!p.badges) p.badges = [];
  const save = () => localStorage.setItem("personaUserProfile", JSON.stringify(p));
  checkAndUnlockBadges(p, save);
}

// Unlock reborn_phoenix when streak-recovery fires, regardless of which page is loaded
window.addEventListener("personadle:streak-recovered", () => checkBadgesAfterGame());
