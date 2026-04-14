// ═══════════════════════════════════════════════════════════════════════════
// 🎖️ PERSONADLE - GESTIONNAIRE DE BADGES
// ═══════════════════════════════════════════════════════════════════════════

import { badgesList, BADGE_CATEGORIES, eventCodes, isEventCodeValid, getBadgeById } from "./badgesData.js";

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
let   _notifBusy  = false;

/** Ajoute un badge à la file et démarre la lecture si elle est libre. */
function queueNotification(badge) {
  _notifQueue.push(badge);
  if (!_notifBusy) _drainNotifQueue();
}

/** Lit la file une notification à la fois. */
function _drainNotifQueue() {
  if (_notifQueue.length === 0) { _notifBusy = false; return; }
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
    if (translated && !translated.startsWith('badges.')) return translated;
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
    if (translated && !translated.startsWith('badges.')) return translated;
  }
  return badge.description || '';
}

/**
 * Retourne la condition traduite d'un badge.
 * Si secret et verrouillé, retourne "???".
 */
function getBadgeCondition(badge, isUnlocked) {
  if (badge.secret && !isUnlocked) return '???';
  const t = window.i18n?.t;
  if (t) {
    const translated = t(`badges.${badge.id}.condition`);
    if (translated && !translated.startsWith('badges.')) return translated;
  }
  return badge.condition;
}

// Labels des catégories (traduits dynamiquement)
const CATEGORY_LABELS = {
  [BADGE_CATEGORIES.ACHIEVEMENT]: { icon: '🏆', key: 'badges.category_achievement', fallback: 'Achievements' },
  [BADGE_CATEGORIES.EVENT]:       { icon: '🎟️', key: 'badges.category_event',       fallback: 'Events'       },
  [BADGE_CATEGORIES.SECRET]:      { icon: '🔒', key: 'badges.category_secret',      fallback: 'Secrets'      },
  [BADGE_CATEGORIES.SOCIAL]:      { icon: '👥', key: 'badges.category_social',      fallback: 'Social'       },
};

function getCategoryLabel(category) {
  const meta = CATEGORY_LABELS[category];
  if (!meta) return category;
  const t = window.i18n?.t;
  const label = t ? t(meta.key) : null;
  const name = (label && !label.startsWith('badges.')) ? label : meta.fallback;
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
  
  // Rendre l'interface
  renderBadgesPreview(profile);
  renderBadgesModal(profile, saveProfile);
  
  // Configurer le système de codes
  setupEventCodeRedeem(profile, saveProfile);
  
  console.log("✅ Badges system initialized!");
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
  console.log("🔍 Checking badges...");
  
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
    
    // Afficher les notifications
    newlyUnlocked.forEach((badge, index) => {
      setTimeout(() => {
        showBadgeNotification(badge);
      }, index * 500); // Décalage de 500ms entre chaque notification
    });
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

  console.log("🔔 Pending badge notifications found:", profile.pendingBadgeNotifications);

  profile.pendingBadgeNotifications.forEach((badgeId, index) => {
    const badge = getBadgeById(badgeId);
    if (badge) {
      setTimeout(() => {
        showBadgeNotification(badge);
      }, index * 500); // Décalage de 500ms entre chaque notification
    }
  });

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
  const notifTitle = window.i18n?.t('badges.notification_title') || '🎖️ Badge Unlocked!';
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
      ${zDesc ? `<p class="badge-description">${zDesc}</p>` : ''}
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
function renderBadgesPreview(profile) {
  const preview = document.getElementById("previewBadges");
  if (!preview) {
    console.warn("⚠️ previewBadges element not found");
    return;
  }

  const selectedBadges = badgesList.filter((badge) =>
    profile.selectedBadges.includes(badge.id)
  );

  if (selectedBadges.length === 0) {
    preview.innerHTML = `<p style="opacity:0.6; text-align:center;">No badges selected yet.</p>`;
  } else {
    preview.innerHTML = selectedBadges
      .map((badge) => `
        <img 
          src="${badge.img}" 
          alt="${badge.name}" 
          title="${badge.name}"
          class="badge-preview-img" 
          data-badge-id="${badge.id}"
          onerror="this.src=new URL('./images/default.png',import.meta.url).href"
        >
      `)
      .join("");
  }
  
  // Notifier que le rendu est terminé
  window.dispatchEvent(new CustomEvent('badgesRendered'));
  console.log("✅ Badges preview rendered");
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
    BADGE_CATEGORIES.EVENT,
    BADGE_CATEGORIES.SOCIAL,
    BADGE_CATEGORIES.SECRET,
  ];

  const grouped = {};
  categoryOrder.forEach(cat => { grouped[cat] = []; });

  badgesList.forEach(badge => {
    // Masquer les secrets non débloqués
    if (badge.secret && !profile.badges.includes(badge.id)) return;
    const cat = badge.category || BADGE_CATEGORIES.ACHIEVEMENT;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(badge);
  });

  // Générer le HTML par sections
  let html = '';
  categoryOrder.forEach(cat => {
    const badges = grouped[cat];
    if (!badges || badges.length === 0) return;

    const unlockedInCat = badges.filter(b => profile.badges.includes(b.id)).length;
    const catLabel = getCategoryLabel(cat);

    html += `
      <div class="badges-category-section" data-category="${cat}">
        <div class="badges-category-header">
          <span class="badges-category-title">${catLabel}</span>
          <span class="badges-category-count">${unlockedInCat}/${badges.length}</span>
        </div>
        <div class="badges-grid">
          ${badges.map(badge => {
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
                ${isSelected ? '<span class="check-mark">✓</span>' : ''}
                <div class="badge-tooltip">
                  ${isUnlocked ? '🔓' : '🔒'} <strong>${name}</strong><br>
                  <span>${cond}</span><br>
                  <small style="opacity:0.8;">${desc}</small>
                </div>
              </div>
            `;
          }).join('')}
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
  const unlockedLabel = (t && !t('profile.badges_unlocked').startsWith('profile.'))
    ? t('profile.badges_unlocked')
    : 'badges unlocked';

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
function toggleBadgeSelection(profile, saveProfile, badgeId) {
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
function handleEventCodeSubmit(profile, saveProfile, input, msg) {
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
    warning: "#f39c12"
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
  return badgesList
    .filter((badge) => profile.selectedBadges?.includes(badge.id))
    .slice(0, MAX_SELECTED_BADGES);
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
export function checkEventBadges() {
  const profile = JSON.parse(localStorage.getItem('personaUserProfile'));
  
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
  
  let hasChanges = false;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌸 BADGE RENTRÉE (1er avril - Rentrée scolaire japonaise)
  // ═══════════════════════════════════════════════════════════════════════
  if (month === 4 && day === 1 && !profile.eventBadges.rentree) {
    console.log("🌸 Event detected: Japanese School Year Start (April 1st)");
    profile.eventBadges.rentree = true;
    hasChanges = true;
    
    // Ajouter à la file de notifications
    if (!profile.pendingBadgeNotifications.includes('rentree')) {
      profile.pendingBadgeNotifications.push('rentree');
      console.log("🔔 Badge 'Spring Awakening' added to notifications queue");
    }
  }
  
  
  // Sauvegarder si des changements ont été détectés
  if (hasChanges) {
    localStorage.setItem('personaUserProfile', JSON.stringify(profile));
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