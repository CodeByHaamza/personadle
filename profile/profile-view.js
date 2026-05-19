import {
  renderSocialLinkGauge,
  gainSocialLinkXp,
  getSocialLinkData,
  applyRank10Effect,
} from "../js/social-link.js";

/**
 * profile/profile-view.js — Mode consultation du profil d'un autre joueur
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Activé quand profile.html est chargé avec ?view=FRIENDCODE ou ?view=pseudo.
 * Dans ce cas, ce module :
 *   1. Charge le profil public via GET /api/user/public?code=...
 *   2. Applique le thème du joueur consulté (CSS vars)
 *   3. Remplit la page avec les données du joueur consulté — IDENTIQUE à son propre profil
 *   4. Masque tous les éléments d'édition
 *   5. Lance la musique de profil (même lecteur que le profil personnel)
 *   6. Propose "Add friend" si l'utilisateur est connecté
 *
 * profile-page.js détecte ?view= et bail immédiatement — pas de conflit.
 */

const params = new URLSearchParams(window.location.search);
const viewParam = params.get("view")?.trim() ?? "";

if (viewParam) {
  // ─────────────────────────────────────────────────────────────────────────────
  // THÈMES — identiques à profile-page.js
  // ─────────────────────────────────────────────────────────────────────────────

  const PROFILE_THEMES = {
    all_out: { accent: "#E63946", hover: "#C1121F", light: "#FF9999", rgb: "230, 57, 70" },
    velvet_room: { accent: "#1B3A8A", hover: "#162E72", light: "#60A5FA", rgb: "27, 58, 138" },
    dark_hour: { accent: "#00B4D8", hover: "#0077B6", light: "#48CAE4", rgb: "0, 180, 216" },
    pink_ribbon: { accent: "#E8739A", hover: "#D0507A", light: "#F9A8D4", rgb: "232, 115, 154" },
    midnight_channel: { accent: "#EAB308", hover: "#CA8A04", light: "#FEF08A", rgb: "234, 179, 8" },
    demon_palace: { accent: "#9333EA", hover: "#7E22CE", light: "#D8B4FE", rgb: "147, 51, 234" },
    eternal_punishment: {
      accent: "#4F46E5",
      hover: "#4338CA",
      light: "#A5B4FC",
      rgb: "79, 70, 229",
    },
    golden_labyrinth: {
      accent: "#F97316",
      hover: "#EA6C12",
      light: "#FDBA74",
      rgb: "249, 115, 22",
    },
  };

  function _hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "0, 0, 0";
  }
  function _adjustHex(hex, delta) {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.max(0, (n >> 16) + delta));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + delta));
    const b = Math.min(255, Math.max(0, (n & 0xff) + delta));
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
  }

  function applyViewTheme(wallpaperId) {
    if (!wallpaperId) return;
    const root = document.documentElement;

    if (wallpaperId.startsWith("custom:")) {
      const hex = wallpaperId.slice(7);
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
      root.style.setProperty("--accent", hex);
      root.style.setProperty("--accent-hover", _adjustHex(hex, -35));
      root.style.setProperty("--accent-light", _adjustHex(hex, 45));
      root.style.setProperty("--accent-rgb", _hexToRgb(hex));
      return;
    }

    const theme = PROFILE_THEMES[wallpaperId];
    if (!theme) return;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-hover", theme.hover);
    root.style.setProperty("--accent-light", theme.light);
    root.style.setProperty("--accent-rgb", theme.rgb);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IMPORT DYNAMIQUE — badgesList
  // ─────────────────────────────────────────────────────────────────────────────

  let _badgesList = null;
  import("./badges/badgesData.js")
    .then((m) => {
      _badgesList = m.badgesList ?? null;
    })
    .catch(() => {});

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]
    );
  }

  function t(key, fallback) {
    // window.i18n.t returns the key string when not found, so check r !== key
    const r = window.i18n?.t?.(key);
    return r != null && r !== key ? r : (fallback ?? key);
  }

  /** Formate "m:ss" depuis des secondes. */
  function formatSongTime(s) {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Formate des minutes en texte lisible — copié de profile-page.js.
   */
  function formatPlayTime(totalMinutes) {
    const lang = localStorage.getItem("lang") || "en";
    const U = {
      en: {
        min: "min",
        h: "h",
        day: ["day", "days"],
        week: ["week", "weeks"],
        month: ["month", "months"],
        year: ["year", "years"],
      },
      fr: {
        min: "min",
        h: "h",
        day: ["jour", "jours"],
        week: ["semaine", "semaines"],
        month: ["mois", "mois"],
        year: ["an", "ans"],
      },
      es: {
        min: "min",
        h: "h",
        day: ["día", "días"],
        week: ["semana", "semanas"],
        month: ["mes", "meses"],
        year: ["año", "años"],
      },
      de: {
        min: "Min.",
        h: "Std.",
        day: ["Tag", "Tage"],
        week: ["Woche", "Wochen"],
        month: ["Monat", "Monate"],
        year: ["Jahr", "Jahre"],
      },
      it: {
        min: "min",
        h: "h",
        day: ["giorno", "giorni"],
        week: ["settimana", "settimane"],
        month: ["mese", "mesi"],
        year: ["anno", "anni"],
      },
    };
    const u = U[lang] || U.en;
    const p = (n, [s, pl]) => `${n} ${n <= 1 ? s : pl}`;
    const m = Math.max(0, Math.round(totalMinutes));
    const PER_DAY = 1440,
      PER_WEEK = 10080,
      PER_MONTH = 43200,
      PER_YEAR = 525600;
    if (m < PER_DAY) return `${m} ${u.min}`;
    if (m < PER_WEEK) {
      const d = Math.floor(m / PER_DAY),
        h = Math.floor((m % PER_DAY) / 60);
      return h ? `${p(d, u.day)} ${h}${u.h}` : p(d, u.day);
    }
    if (m < PER_MONTH) {
      const w = Math.floor(m / PER_WEEK),
        d = Math.floor((m % PER_WEEK) / PER_DAY);
      return d ? `${p(w, u.week)} ${p(d, u.day)}` : p(w, u.week);
    }
    if (m < PER_YEAR) {
      const mo = Math.floor(m / PER_MONTH),
        w = Math.floor((m % PER_MONTH) / PER_WEEK);
      return w ? `${p(mo, u.month)} ${p(w, u.week)}` : p(mo, u.month);
    }
    const yr = Math.floor(m / PER_YEAR),
      mo = Math.floor((m % PER_YEAR) / PER_MONTH);
    return mo ? `${p(yr, u.year)} ${p(mo, u.month)}` : p(yr, u.year);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STREAK — copié de profile-page.js
  // ─────────────────────────────────────────────────────────────────────────────

  function getStreakTier(streak) {
    if (streak >= 30) return 5;
    if (streak >= 14) return 4;
    if (streak >= 7) return 3;
    if (streak >= 3) return 2;
    if (streak >= 1) return 1;
    return 0;
  }

  function buildStreakItem(streak, label, delay) {
    const tier = getStreakTier(streak);
    const flameL = (n) => `<span class="streak-side-flame" aria-hidden="true">🔥</span>`.repeat(n);
    const flameR = (n) =>
      `<span class="streak-side-flame streak-side-flame--r" aria-hidden="true">🔥</span>`.repeat(n);

    let leftDeco = "";
    let rightDeco = "";
    let iconSize = "1.3em";
    const fullWidth = tier >= 5;

    if (tier === 3) {
      leftDeco = flameL(1);
      iconSize = "1.5em";
    }
    if (tier === 4) {
      leftDeco = flameL(2);
      rightDeco = flameR(1);
      iconSize = "1.7em";
    }
    if (tier === 5) {
      leftDeco = `<span class="streak-crown" aria-hidden="true">👑</span>${flameL(1)}`;
      rightDeco = flameR(1);
      iconSize = "1.9em";
      label = `🔥 ${label} 🔥`;
    }

    const classes = [
      "stat-item",
      "stat-streak",
      `stat-streak-t${tier}`,
      fullWidth ? "stat-item--full" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
    <div class="${classes}" style="animation-delay:${delay}">
      ${leftDeco}
      <span class="stat-icon" style="font-size:${iconSize}">🔥</span>
      <div class="stat-body">
        <span class="stat-value">${streak}</span>
        <span class="stat-label">${label}</span>
      </div>
      ${rightDeco}
    </div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BADGE ZOOM MODAL — copié de profile-page.js
  // ─────────────────────────────────────────────────────────────────────────────

  function showBadgeZoom(badge) {
    const _t = window.i18n?.t;
    const _tr = (key, fallback) => {
      if (!_t) return fallback;
      const v = _t(key);
      return v && !v.startsWith("badges.") ? v : fallback;
    };
    const name = _tr(`badges.${badge.id}.name`, badge.name || "");
    const cond = _tr(`badges.${badge.id}.condition`, badge.condition || "");
    const desc = _tr(`badges.${badge.id}.description`, badge.description || "");

    const modal = document.createElement("div");
    modal.className = "badge-zoom-modal";
    modal.innerHTML = `
    <div class="badge-zoom-content">
      <span class="badge-zoom-close">&times;</span>
      <img src="${escapeHtml(badge.img)}" alt="${escapeHtml(name)}">
      <h3>${escapeHtml(name)}</h3>
      <p class="badge-condition">${escapeHtml(cond)}</p>
      ${desc ? `<p class="badge-description">${escapeHtml(desc)}</p>` : ""}
    </div>
  `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
    modal.querySelector(".badge-zoom-close").onclick = () => modal.remove();
    setTimeout(() => modal.classList.add("show"), 10);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODE META — identique à profile-page.js (clés lowercase car API)
  // ─────────────────────────────────────────────────────────────────────────────

  const VIEW_MODE_META = {
    classic: { icon: "🔤", color: "#E63946", label: "Classic" },
    emoji: { icon: "😄", color: "#F97316", label: "Emoji" },
    silhouette: { icon: "👤", color: "#6366F1", label: "Silhouette" },
    alloutattack: { icon: "⚔️", color: "#DC2626", label: "All-Out" },
    personae: { icon: "✨", color: "#9333EA", label: "Personae" },
    music: { icon: "🎵", color: "#0EA5E9", label: "Music" },
  };

  // Fallback name→slug si l'API ne retourne pas le slug
  const _TITLE_SLUG_MAP = {
    "Thou Art I": "velvet_room_thou_art_i",
    "Looking Cool": "joker_looking_cool",
    "Memento Mori": "makoto_yuki_memento_mori",
    "Pancakes?": "akechi_pancakes",
    "Reach Out to the Truth": "yu_reach_out_to_the_truth",
    "I Am Not Afraid": "aigis_i_am_not_afraid",
    "I Remembered": "marie_i_remembered",
    "Ride the Wind": "yosuke_ride_the_wind",
    "The First Awakening": "naoya_first_awakening",
    "Boring, Isn't It?": "adachi_boring_isnt_it",
    "Always Be Positive": "maya_always_be_positive",
  };
  function _titleNameToSlug(name) {
    return _TITLE_SLUG_MAP[name] || null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MASQUAGE MODE READ-ONLY
  // ─────────────────────────────────────────────────────────────────────────────

  function activateReadOnlyMode() {
    const hide = (el) => {
      if (el) el.style.display = "none";
    };

    hide(document.getElementById("editAvatarBtn"));
    hide(document.getElementById("saveAndRefreshBtn"));
    hide(document.getElementById("authSection"));
    hide(document.querySelector(".pseudo-edit-row"));
    hide(document.querySelector(".perso-card"));
    hide(document.getElementById("openBadgesModal"));
    hide(document.getElementById("openTitlesModal"));

    // Masquer les cartes d'action (export, import, share, reset, event code)
    document.querySelectorAll(".profile-card").forEach((card) => {
      const key = card.querySelector("[data-i18n]")?.getAttribute("data-i18n") ?? "";
      if (
        key.includes("export") ||
        key.includes("import") ||
        key.includes("share") ||
        key.includes("reset") ||
        key.includes("event_code") ||
        key.includes("data")
      ) {
        hide(card);
      }
    });

    // Vider les containers qui seront rechargés avec les données du joueur consulté
    const songCard = document.getElementById("songCard");
    if (songCard) {
      songCard.innerHTML = "";
      songCard.classList.add("hidden");
    }
    const modeStatsContainer = document.getElementById("modeStatsContainer");
    if (modeStatsContainer) modeStatsContainer.innerHTML = "";

    // Titre de la page
    const pageTitle = document.querySelector('[data-i18n="profile.title"]');
    if (pageTitle) {
      pageTitle.removeAttribute("data-i18n");
      pageTitle.textContent = "Profile";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BANDEAU "Viewing X" + bouton Add Friend
  // ─────────────────────────────────────────────────────────────────────────────

  function buildViewingBanner(pseudo, friendCode, friendshipStatus) {
    const banner = document.createElement("div");
    banner.id = "viewingBanner";
    banner.className = "viewing-banner";

    let friendBtn = "";
    if (window._currentUser) {
      if (friendshipStatus === "accepted") {
        friendBtn = `
        <span class="vb-friend-status vb-friend-status--ok">✓ ${t("friends.already_friends") || "Friends"}</span>
        <button id="vbCompareBtn" class="vb-friend-btn vb-compare-btn" data-fid="">
          ${t("compare.btn", "⚖ Compare Stats")}
        </button>
      `;
      } else if (friendshipStatus === "pending_sent") {
        friendBtn = `<span class="vb-friend-status vb-friend-status--pending">${t("friends.request_sent") || "Request sent"}</span>`;
      } else if (friendshipStatus === "pending_received") {
        friendBtn = `<button id="vbAcceptBtn" class="vb-friend-btn vb-friend-btn--accept" data-code="${escapeHtml(friendCode)}">${t("friends.accept") || "Accept"}</button>`;
      } else {
        friendBtn = `<button id="vbAddFriendBtn" class="vb-friend-btn" data-code="${escapeHtml(friendCode)}">${t("friends.add_friend") || "+ Add friend"}</button>`;
      }
    }

    banner.innerHTML = `
    <span class="vb-eye">👁</span>
    <div class="vb-text">
      <span class="vb-pseudo">${escapeHtml(pseudo)}</span>
      <span class="vb-code">${escapeHtml(friendCode)}</span>
    </div>
    ${friendBtn}
    <a href="profile.html" class="vb-back">← ${t("ui.back_my_profile") || t("ui.back") || "My Profile"}</a>
  `;
    return banner;
  }

  function attachBannerActions(friendCode) {
    const addBtn = document.getElementById("vbAddFriendBtn");
    const acceptBtn = document.getElementById("vbAcceptBtn");

    if (addBtn) {
      addBtn.addEventListener("click", async () => {
        addBtn.disabled = true;
        addBtn.textContent = "…";
        try {
          await window._personadleApi.friends.request(friendCode);
          addBtn.outerHTML = `<span class="vb-friend-status vb-friend-status--pending">${t("friends.request_sent") || "Request sent"}</span>`;
        } catch (err) {
          addBtn.disabled = false;
          addBtn.textContent = t("friends.add_friend") || "+ Add friend";
          alert(err.message || "Could not send friend request.");
        }
      });
    }

    if (acceptBtn) {
      acceptBtn.addEventListener("click", async () => {
        acceptBtn.disabled = true;
        try {
          const data = await window._personadleApi.friends.list();
          const pending = data.pending_requests ?? [];
          const req = pending.find((p) => p.friend_code === friendCode);
          if (req) {
            await window._personadleApi.friends.respond(req.friendship_id, "accept");
            acceptBtn.outerHTML = `<span class="vb-friend-status vb-friend-status--ok">✓ ${t("friends.already_friends") || "Friends"}</span>`;
          }
        } catch {
          acceptBtn.disabled = false;
          acceptBtn.textContent = t("friends.accept") || "Accept";
        }
      });
    }

    const compareBtn = document.getElementById("vbCompareBtn");
    if (compareBtn) {
      compareBtn.addEventListener("click", () => {
        const friendId = parseInt(compareBtn.dataset.fid, 10);
        if (friendId && window._openCompareOverlay) {
          window._openCompareOverlay(friendId);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATUT FRIENDSHIP
  // ─────────────────────────────────────────────────────────────────────────────

  async function getFriendshipStatus(viewedCode) {
    if (!window._currentUser || !window._personadleApi) return null;
    try {
      const data = await window._personadleApi.friends.list();
      if ((data.friends ?? []).some((f) => f.friend_code === viewedCode)) return "accepted";
      const pending = data.pending_requests ?? [];
      const match = pending.find((p) => p.friend_code === viewedCode);
      if (match) return match.direction === "sent" ? "pending_sent" : "pending_received";
      return null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BADGES — avec click-to-zoom identique à profile-page.js
  // ─────────────────────────────────────────────────────────────────────────────

  function renderViewBadges(profile, unlockedBadges) {
    const previewEl = document.getElementById("previewBadges");
    if (!previewEl) return;

    const selectedIds =
      Array.isArray(profile.selected_badges) && profile.selected_badges.length
        ? profile.selected_badges
        : (unlockedBadges ?? []).slice(0, 4).map((b) => b.badge_id);

    if (!selectedIds.length) {
      previewEl.innerHTML = "";
      return;
    }

    const doRender = async () => {
      if (!_badgesList) return;
      previewEl.innerHTML = "";

      for (const id of selectedIds) {
        // ── Regular badge ─────────────────────────────────────────────
        const badge = _badgesList.find((b) => b.id === id);
        if (!badge) continue;
        const wrapper = document.createElement("div");
        wrapper.className = "badge-preview-item";
        wrapper.title = escapeHtml(badge.name);
        const img = document.createElement("img");
        img.className = "badge-preview-img";
        img.src = escapeHtml(badge.img);
        img.alt = escapeHtml(badge.name);
        img.loading = "lazy";
        img.dataset.badgeId = escapeHtml(badge.id);
        img.style.cursor = "pointer";
        img.addEventListener("click", (e) => {
          e.stopPropagation();
          showBadgeZoom(badge);
        });
        wrapper.appendChild(img);
        previewEl.appendChild(wrapper);
      }
    };

    if (_badgesList) {
      doRender().catch(() => {});
    } else {
      const interval = setInterval(() => {
        if (_badgesList) {
          clearInterval(interval);
          doRender().catch(() => {});
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 5000);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REMPLISSAGE DU PROFIL — identique à profile-page.js
  // ─────────────────────────────────────────────────────────────────────────────

  function populatePublicProfile(data) {
    const { user, profile, stats, badges, equipped_title, unlocked_wallpapers = [] } = data;
    const byMode = stats.by_mode ?? [];

    // ── Agrégats calculés côté client (manquants dans l'API) ──
    const totalGiveups = byMode.reduce((acc, m) => acc + (m.giveups ?? 0), 0);
    const totalTimeMinutes = (stats.total_time_ms ?? 0) / 60000;
    const currentStreak = byMode.reduce((acc, m) => Math.max(acc, m.streak ?? 0), 0);
    const favMode = byMode.reduce((acc, m) => (!acc || m.games > acc.games ? m : acc), null);
    const favModeLabel = favMode ? (VIEW_MODE_META[favMode.mode]?.label ?? favMode.mode) : "—";

    // ── Avatar — supporte les GIFs animés ──
    const avatarEl = document.getElementById("pageAvatar");
    if (avatarEl) {
      // Normalize old "./img/..." paths (stored from root context) to "../img/..."
      // (profile-view runs from profile/, so one level up is needed)
      let rawAvatar = profile.avatar_data ?? "";
      if (
        rawAvatar &&
        !rawAvatar.startsWith("data:") &&
        !rawAvatar.startsWith("/") &&
        !rawAvatar.startsWith("http")
      ) {
        rawAvatar = rawAvatar.replace(/^\.\//, "../");
      }
      avatarEl.src = rawAvatar || "../img/default_avatar.png";
      avatarEl.style.borderColor = profile.avatar_border_color || "#ffffff";
      avatarEl.onerror = () => {
        avatarEl.src = "../img/default_avatar.png";
      };
    }

    // ── Pseudo ──
    const usernameEl = document.getElementById("pageUsername");
    if (usernameEl) usernameEl.textContent = user.pseudo;

    // ── Titre équipé — calling card image ──
    if (equipped_title) {
      const _prefix = window.location.pathname.startsWith("/personadle/") ? "/personadle" : "";
      const titleImg = document.getElementById("equippedTitleImg");
      if (titleImg) {
        let src = null;
        if (equipped_title.image_path) {
          // image_path in DB: "profile/titles/velvet_room_thou_art_i.webp"
          src = `${_prefix}/${equipped_title.image_path}`;
        } else {
          // fallback: try name→slug map (old filenames), then DB slug
          const slug = _titleNameToSlug(equipped_title.name) || equipped_title.slug;
          if (slug) src = `${_prefix}/profile/titles/${slug}.webp`;
        }
        if (src) {
          titleImg.src = src;
          titleImg.style.display = "block";
        }
      }
    }

    // ── Wallpapers débloquables — état vide si le joueur n'en a pas ──
    const wpGrid = document.getElementById("unlockableWallpaperGrid");
    if (wpGrid) {
      const unlockedWps = unlocked_wallpapers;
      if (unlockedWps.length === 0) {
        wpGrid.innerHTML = `<p class="view-empty-state">🔒 Nothing to see here… yet.</p>`;
      } else {
        wpGrid.innerHTML = `<p class="view-empty-state" style="opacity:.7;">🖼️ ${unlockedWps.length} wallpaper${unlockedWps.length > 1 ? "s" : ""} unlocked</p>`;
      }
    }

    // ── Date d'inscription + code ami ──
    const infoContainer = usernameEl?.closest(".avatar-card-info");
    if (infoContainer) {
      const rawDate = user.first_game_date || user.created_at;
      if (rawDate) {
        const joinEl = document.createElement("p");
        joinEl.className = "profile-join-date";
        joinEl.textContent = `${t("profile.since") || "Since"} ${new Date(rawDate).toLocaleDateString(undefined, { year: "numeric", month: "long" })}`;
        infoContainer.appendChild(joinEl);
      }
      const codeEl = document.createElement("p");
      codeEl.className = "profile-friend-code";
      codeEl.textContent = `🔑 ${user.friend_code}`;
      infoContainer.appendChild(codeEl);
    }

    // ── Stats — structure IDENTIQUE à renderStats() dans profile-page.js ──
    const statsContainer = document.getElementById("statsContainer");
    if (statsContainer) {
      const firstPlayedStr = (user.first_game_date || user.created_at || "").slice(0, 10) || "—";

      const items = [
        { icon: "🏆", value: stats.total_wins ?? 0, label: t("profile.stat_wins_label") || "Wins" },
        { icon: "🏳️", value: totalGiveups, label: t("profile.stat_giveups_label") || "Give-ups" },
        {
          icon: "🎮",
          value: stats.total_games ?? 0,
          label: t("profile.stat_games_label") || "Games Played",
        },
        {
          icon: "⭐",
          value: stats.best_streak ?? 0,
          label: t("profile.stat_best_streak_label") || "Best Streak",
        },
        {
          icon: "⏱️",
          value: formatPlayTime(totalTimeMinutes),
          label: t("profile.stat_time_label") || "Time Played",
        },
        {
          icon: "📅",
          value: firstPlayedStr,
          label: t("profile.stat_first_played_label") || "First Played",
          full: true,
        },
        {
          icon: "🎯",
          value: favModeLabel,
          label: t("profile.stat_fav_mode_label") || "Fav Mode",
          full: true,
        },
      ];

      const regularHTML = items
        .map(
          (st, idx) => `
      <div class="stat-item${st.full ? " stat-item--full" : ""}"
           style="animation-delay:${0.1 + idx * 0.06}s">
        <span class="stat-icon">${st.icon}</span>
        <div class="stat-body">
          <span class="stat-value">${escapeHtml(String(st.value))}</span>
          <span class="stat-label">${st.label}</span>
        </div>
      </div>`
        )
        .join("");

      const streakHTML = buildStreakItem(
        currentStreak,
        t("profile.stat_current_streak_label") || "Current Streak",
        "0.5s"
      );
      statsContainer.innerHTML = regularHTML + streakHTML;
    }

    // ── Mode Breakdown — structure IDENTIQUE à renderModeStats() dans profile-page.js ──
    const modeContainer = document.getElementById("modeStatsContainer");
    if (modeContainer) {
      const playedModes = byMode.filter((m) => m.games > 0);
      if (playedModes.length) {
        const maxGames = Math.max(...playedModes.map((m) => m.games), 1);

        const rows = playedModes
          .map((m) => {
            const meta = VIEW_MODE_META[m.mode] ?? { icon: "🎮", color: "#888", label: m.mode };
            const pct = Math.round((m.games / maxGames) * 100);
            const rate = Math.round((m.wins / m.games) * 100);
            return `
          <div class="mode-stat-row">
            <span class="mode-stat-icon">${meta.icon}</span>
            <span class="mode-stat-name">${meta.label}</span>
            <div class="mode-stat-bar-wrap">
              <div class="mode-stat-bar" style="width:${pct}%;background:${meta.color}"></div>
            </div>
            <span class="mode-stat-right">
              <span class="mode-stat-count">${m.games}</span>
              <span class="mode-stat-rate">${rate}%</span>
            </span>
          </div>`;
          })
          .join("");

        modeContainer.innerHTML = `
        <div class="mode-stats-header">
          <span>${t("profile.mode_col_mode") || "Mode"}</span>
          <span>${t("profile.mode_col_games") || "Games / Win %"}</span>
        </div>
        <div class="mode-stats-list">${rows}</div>`;
      }
    }

    // ── Badges avec click-to-zoom ──
    renderViewBadges(profile, badges);

    // ── Thème du joueur consulté ──
    applyViewTheme(profile.wallpaper_id || "all_out");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SONG PLAYER — structure IDENTIQUE à renderSongCard() + initSongPlayer() dans profile-page.js
  // ─────────────────────────────────────────────────────────────────────────────

  let _viewSongAudio = null;

  async function renderViewSongCard(profileMusicId) {
    const songCard = document.getElementById("songCard");
    if (!songCard) return;

    // Aucune music → on cache la card entièrement (pas de zone vide)
    if (!profileMusicId) {
      songCard.classList.add("hidden");
      return;
    }

    // Récupérer les métadonnées depuis songs.js
    let songData = null;
    try {
      const { songs } = await import("../musicsMode/database/songs.js");
      // Recherche insensible à la casse pour tolérer les variantes de nommage
      songData =
        songs.find((s) => s.fichier.toLowerCase() === profileMusicId.toLowerCase()) ?? null;
    } catch {
      /* songs.js indisponible */
    }

    const songTitle = songData?.titre ?? profileMusicId.replace(/\.mp3$/i, "").replace(/_/g, " ");
    const songOpus = songData?.opus?.[0] ?? "";
    const placeholder = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' rx='8' fill='%231a1a2e'/%3E%3Ctext x='40' y='55' font-size='42' text-anchor='middle' fill='%23e63946'%3E%E2%99%AA%3C/text%3E%3C/svg%3E`;
    const artSrc = songData ? `../musicsMode/database/img/${songData.image}` : placeholder;

    // HTML identique à renderSongCard() dans profile-page.js (sans les boutons d'action)
    songCard.classList.remove("hidden");
    songCard.innerHTML = `
    <h3 class="card-title"><span class="card-accent">◆</span> ${t("profile.song_title") || "Profile Song"}</h3>
    <div id="viewSongPlayerUI" class="song-player">
      <img id="viewSongArtwork"
           class="song-artwork"
           src="${escapeHtml(artSrc)}"
           alt="${escapeHtml(songTitle)}"
           crossorigin="anonymous"
           onerror="this.src='${placeholder}'">
      <div class="song-info">
        <div id="viewSongTitleEl" class="song-title">${escapeHtml(songTitle)}</div>
        <div id="viewSongOpusEl"  class="song-opus-badge">${escapeHtml(songOpus)}</div>
        <div class="song-controls">
          <button id="viewSongPlayBtn" class="song-play-btn">▶</button>
          <div class="song-progress-wrap">
            <div id="viewSongProgressBar" class="song-progress">
              <div id="viewSongProgressFill" class="song-progress-fill"></div>
            </div>
            <div class="song-time-row">
              <span id="viewSongCurrentTime">0:00</span>
              <span id="viewSongDuration">--:--</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    initViewSongPlayer(profileMusicId);
  }

  function initViewSongPlayer(profileMusicId) {
    if (!_viewSongAudio) _viewSongAudio = new Audio();
    _viewSongAudio.src = `../musicsMode/database/music/song/${profileMusicId}`;
    _viewSongAudio.loop = true;
    _viewSongAudio.load();

    // ── Progression ──
    _viewSongAudio.ontimeupdate = () => {
      const fill = document.getElementById("viewSongProgressFill");
      const cur = document.getElementById("viewSongCurrentTime");
      const pct = _viewSongAudio.duration
        ? (_viewSongAudio.currentTime / _viewSongAudio.duration) * 100
        : 0;
      if (fill) fill.style.width = `${pct}%`;
      if (cur) cur.textContent = formatSongTime(_viewSongAudio.currentTime);
    };

    // ── Durée totale ──
    _viewSongAudio.onloadedmetadata = () => {
      const dur = document.getElementById("viewSongDuration");
      if (dur) dur.textContent = formatSongTime(_viewSongAudio.duration);
    };

    // ── Play / Pause UI ──
    _viewSongAudio.onplay = () => {
      const btn = document.getElementById("viewSongPlayBtn");
      if (btn) btn.textContent = "⏸";
      document.getElementById("viewSongPlayerUI")?.classList.add("playing");
    };

    _viewSongAudio.onpause = () => {
      const btn = document.getElementById("viewSongPlayBtn");
      if (btn) btn.textContent = "▶";
      document.getElementById("viewSongPlayerUI")?.classList.remove("playing");
    };

    // ── Seek (clic sur la barre de progression) ──
    document.getElementById("viewSongProgressBar")?.addEventListener("click", (e) => {
      if (!_viewSongAudio?.duration) return;
      _viewSongAudio.currentTime =
        (e.offsetX / e.currentTarget.offsetWidth) * _viewSongAudio.duration;
    });

    // ── Bouton Play/Pause ──
    document.getElementById("viewSongPlayBtn")?.addEventListener("click", () => {
      if (!_viewSongAudio) return;
      if (_viewSongAudio.paused) {
        _viewSongAudio.play().catch(() => {});
      } else {
        _viewSongAudio.pause();
      }
    });

    // ── Autoplay avec fallback au premier geste utilisateur ──
    _viewSongAudio.play().catch(() => {
      const unlock = () => _viewSongAudio.play().catch(() => {});
      document.addEventListener("click", unlock, { once: true });
      document.addEventListener("keydown", unlock, { once: true });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POINT D'ENTRÉE
  // ─────────────────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", async () => {
    if (window.__i18nReady) await window.__i18nReady;

    const isFriendCode = /^[A-Z0-9]{8}$/i.test(viewParam);
    const fetchParams = isFriendCode ? { code: viewParam.toUpperCase() } : { pseudo: viewParam };

    // Mode read-only immédiatement (avant le chargement réseau)
    activateReadOnlyMode();

    // Charger le profil public
    let profileData = null;
    try {
      const api = window._personadleApi;
      if (!api) throw new Error("API not available");
      profileData = await api.publicProfile.get(fetchParams);
    } catch (err) {
      document.querySelector(".profile-container")?.insertAdjacentHTML(
        "beforebegin",
        `
      <div class="viewing-error">
        <p>⚠️ ${err.status === 404 ? "Player not found." : "Could not load this profile."}</p>
        <a href="profile.html">← Back to my profile</a>
      </div>
    `
      );
      return;
    }

    const { user, profile } = profileData;

    // Détecter le statut de friendship (en parallèle)
    const friendshipStatus = await getFriendshipStatus(user.friend_code);

    // Bandeau "Viewing X"
    const header = document.querySelector(".profile-page-header");
    const banner = buildViewingBanner(user.pseudo, user.friend_code, friendshipStatus);
    const compareBtn = banner.querySelector("#vbCompareBtn");
    if (compareBtn) compareBtn.dataset.fid = user.id;
    header?.insertAdjacentElement("afterend", banner);
    attachBannerActions(user.friend_code);

    // Remplir le profil + appliquer le thème
    populatePublicProfile(profileData);

    // Song player (async, non-bloquant) — toujours appelé ; cache la card si pas de music
    renderViewSongCard(profile.profile_music_id ?? null);

    // Social Link gauge — uniquement si l'utilisateur est connecté et consulte le profil d'un autre
    const gaugeContainer = document.getElementById("socialLinkGaugeContainer");
    if (gaugeContainer && window._currentUser && user.id !== window._currentUser.id) {
      gaugeContainer.classList.remove("hidden");
      renderSocialLinkGauge(user.id, gaugeContainer);
      // Effet visuel rang 10 — True Confidant
      getSocialLinkData(user.id)
        .then((data) => {
          if ((data?.rank ?? 0) >= 10) {
            applyRank10Effect(
              document.getElementById("pageAvatar"),
              document.getElementById("pageUsername")
            );
          }
        })
        .catch(() => {});
      // XP pour visite de profil — awarded once per day server-side (409 on repeat)
      gainSocialLinkXp(user.id, "visit_profile")
        .then((res) => {
          if (res?.ranked_up) {
            window._showSocialLinkRankUp?.(res.new_rank, null, {
              friendAvatar: profile.avatar_data,
              friendPseudo: user.pseudo,
            });
          }
          // Refresh gauge so visit_profile shows as "Done today"
          if (res?.xp_gained > 0) {
            setTimeout(() => renderSocialLinkGauge(user.id, gaugeContainer), 800);
          }
        })
        .catch(() => {});

      // 🔍 DATA MINING badge — track unique profiles visited
      const visitedSet = new Set(JSON.parse(localStorage.getItem("visitedProfileIds") || "[]"));
      visitedSet.add(String(user.id));
      localStorage.setItem("visitedProfileIds", JSON.stringify([...visitedSet]));
      const localProfile = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
      // Keep profile.visitedProfileIds in sync so badgesData.js check() can read it
      localProfile.visitedProfileIds = [...visitedSet];
      localStorage.setItem("personaUserProfile", JSON.stringify(localProfile));
      if (visitedSet.size >= 5) {
        import("./badges/badgesManager.js")
          .then((m) => {
            const p = JSON.parse(localStorage.getItem("personaUserProfile") || "{}");
            m.checkBadges(p, (updated) =>
              localStorage.setItem("personaUserProfile", JSON.stringify(updated))
            );
          })
          .catch(() => {});
      }
    }
  });
} // fin if (viewParam)
