/**
 * profile/leaderboard.js — Logique de la page classement PersonaDLE
 * ─────────────────────────────────────────────────────────────────
 *
 * Fonctionnalités :
 *   1. Filtres : mode (all/classic/emoji/…), période (ever/month/week/day),
 *      métrique (wins/winrate/streak/perfect/games)
 *   2. Chargement depuis GET /api/leaderboard avec les params actifs
 *   3. Rendu des lignes avec top 3 mis en avant
 *   4. Bandeau "Votre classement" si l'utilisateur est connecté
 *   5. Pagination (50 par page)
 *
 * Dépendances :
 *   - window._personadleApi  (injecté par api.js)
 *   - window._currentUser    (injecté par auth.js après initAuth())
 *   - window.__i18nReady     (injecté par i18n.js)
 */

const PAGE_SIZE = 50;

// ─────────────────────────────────────────────────────────
// ÉTAT DES FILTRES
// ─────────────────────────────────────────────────────────

const filters = {
  mode: "all",
  period: "ever",
  metric: "wins",
  friendsOnly: false,
  offset: 0,
};

// ─────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────

function esc(str) {
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

function t(key) {
  const val = window.i18n?.t?.(key);
  return val != null && val !== key ? val : "";
}

/** Formate la valeur de score selon la métrique courante. */
function formatScore(entry) {
  switch (filters.metric) {
    case "winrate":
      return `${entry.score ?? 0}%`;
    case "streak":
      return `🔥 ${entry.score ?? 0}`;
    default:
      return String(entry.score ?? 0);
  }
}

/** Label de la métrique courante (pour la sous-info). */
function metricLabel() {
  const labels = {
    wins: t("leaderboard.metric_wins") || "wins",
    winrate: t("leaderboard.metric_winrate") || "win rate",
    streak: t("leaderboard.metric_streak") || "best streak",
    perfect: t("leaderboard.metric_perfect") || "perfect wins",
    games: t("leaderboard.metric_games") || "games",
  };
  return labels[filters.metric] ?? filters.metric;
}

/** Renders the active filter summary banner below the filter card. */
function renderFilterNote() {
  const el = document.getElementById("lbFilterNote");
  if (!el) return;

  const modeLabels = {
    all: t("leaderboard.filter_all_modes") || "All modes",
    classic: "Classic",
    emoji: "Emoji",
    silhouette: "Silhouette",
    alloutattack: "All-Out Attack",
    personae: "Personae",
    music: "Music",
  };
  const periodLabels = {
    ever: t("leaderboard.period_ever") || "All time",
    month: t("leaderboard.period_month") || "This month",
    week: t("leaderboard.period_week") || "This week",
    day: t("leaderboard.period_day") || "Today",
  };
  const metricLabels = {
    wins: t("leaderboard.metric_wins") || "Wins",
    winrate: t("leaderboard.metric_winrate") || "Win rate",
    streak: t("leaderboard.metric_streak") || "Best streak",
    perfect: t("leaderboard.metric_perfect") || "Perfect",
    games: t("leaderboard.metric_games") || "Games",
  };

  const mode = esc(modeLabels[filters.mode] ?? filters.mode);
  const period = esc(periodLabels[filters.period] ?? filters.period);
  const metric = esc(metricLabels[filters.metric] ?? filters.metric);
  const note = esc(t("leaderboard.filter_note") || "Opus filters are not factored in.");

  const friendsChip = filters.friendsOnly
    ? `<span class="lb-fn-sep">·</span><span class="lb-fn-chip lb-fn-chip--friends">👥 ${esc(t("leaderboard.scope_friends") || "Friends")}</span>`
    : "";

  el.innerHTML = `
    <span class="lb-fn-chips">
      <span class="lb-fn-chip">${mode}</span>
      <span class="lb-fn-sep">·</span>
      <span class="lb-fn-chip">${period}</span>
      <span class="lb-fn-sep">·</span>
      <span class="lb-fn-chip">${metric}</span>
      ${friendsChip}
    </span>
    <span class="lb-fn-note">${note}</span>
  `;
}

// ─────────────────────────────────────────────────────────
// RENDU
// ─────────────────────────────────────────────────────────

/** Normalise les chemins avatar stockés en DB (relatifs à profile/) pour ce dossier (profile/leaderboard/). */
function avatarSrc(avatarData) {
  if (!avatarData) return "../../img/default_avatar.png";
  if (avatarData.startsWith("data:")) return avatarData;
  if (avatarData.startsWith("../img/")) return "../" + avatarData;  // ../../img/
  if (avatarData.startsWith("./img/"))  return "../../img/" + avatarData.slice(6);
  return avatarData;
}

/**
 * Rend une ligne du classement.
 * @param {{ rank, user_id, pseudo, friend_code, avatar_data, score }} entry
 * @param {number|null} myId - ID de l'utilisateur connecté (pour mise en avant)
 */
function renderRow(entry, myId) {
  const rank = entry.rank ?? filters.offset + 1;
  const isMe = myId && entry.user_id === myId;
  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  const href = isMe ? "../profile.html" : `../profile.html?view=${esc(entry.friend_code)}`;
  // Couleur de bordure personnelle (sauf top 3 qui ont leurs couleurs podium en CSS)
  const borderStyle =
    rank > 3 && entry.avatar_border_color
      ? `style="border-color:${esc(entry.avatar_border_color)}"`
      : "";

  return `
    <a class="lb-row lb-row--${rank <= 3 ? rank : "n"} ${isMe ? "lb-row--me" : ""}"
       href="${href}"
       title="${t("friends.view_profile") || "View profile"}">
      <span class="lb-rank">${rankEmoji}</span>
      <img class="lb-avatar"
           src="${esc(avatarSrc(entry.avatar_data))}"
           alt="${esc(entry.pseudo)}"
           loading="lazy"
           ${borderStyle}
           onerror="this.src='../../img/default_avatar.png'">
      <div class="lb-info">
        <div class="lb-pseudo">${esc(entry.pseudo)}</div>
        <div class="lb-sub">${entry.total_games ? `${entry.total_games} games` : metricLabel()}</div>
      </div>
      <span class="lb-score">${esc(formatScore(entry))}</span>
      <span class="lb-profile-link">→</span>
    </a>
  `;
}

/** Met à jour le bandeau "Mon classement". */
function renderMyRank(myRank) {
  const banner = document.getElementById("myRankBanner");
  if (!banner) return;

  if (!myRank || !myRank.rank) {
    banner.classList.add("hidden");
    return;
  }

  banner.innerHTML = `
    <span class="lb-my-rank__rank">#${myRank.rank}</span>
    <span>${t("leaderboard.your_rank") || "Your rank"} — <strong>${esc(formatScore(myRank))}</strong> ${metricLabel()}</span>
  `;
  banner.classList.remove("hidden");
}

/** Affiche le corps du leaderboard. */
function renderLeaderboard(data) {
  const body = document.getElementById("leaderboardBody");
  const myId = window._currentUser?.id ?? null;
  const entries = data.entries ?? [];

  if (!entries.length) {
    const emptyText = filters.friendsOnly
      ? t("leaderboard.no_friends") || "None of your friends appear in this ranking yet."
      : t("leaderboard.no_entries") || "No entries for this period.";
    const emptySub = filters.friendsOnly
      ? ""
      : `<p class="lb-empty__sub">${t("leaderboard.no_entries_sub") || "Play some games to appear here!"}</p>`;
    body.innerHTML = `
      <div class="lb-empty">
        <span class="lb-empty__icon">${filters.friendsOnly ? "👥" : "📊"}</span>
        <p class="lb-empty__text">${emptyText}</p>
        ${emptySub}
      </div>`;
    return;
  }

  let html = "";
  entries.forEach((entry, i) => {
    // Séparateur après le podium
    if (i === 3 && filters.offset === 0) {
      html += `<div class="lb-podium-divider">── ${t("leaderboard.others") || "Others"} ──</div>`;
    }
    html += renderRow(entry, myId);
  });

  body.innerHTML = html;

  // Bandeau perso
  renderMyRank(data.my_rank ?? null);
}

/** Met à jour la pagination. */
function renderPagination(total) {
  const paginationEl = document.getElementById("lbPagination");
  const pageInfoEl = document.getElementById("lbPageInfo");
  const prevBtn = document.getElementById("lbPrevBtn");
  const nextBtn = document.getElementById("lbNextBtn");

  if (total <= PAGE_SIZE) {
    paginationEl?.classList.add("hidden");
    return;
  }

  paginationEl?.classList.remove("hidden");

  const currentPage = Math.floor(filters.offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (pageInfoEl) {
    pageInfoEl.textContent = `${currentPage} / ${totalPages}`;
  }

  if (prevBtn) prevBtn.disabled = filters.offset === 0;
  if (nextBtn) nextBtn.disabled = filters.offset + PAGE_SIZE >= total;
}

// ─────────────────────────────────────────────────────────
// CHARGEMENT
// ─────────────────────────────────────────────────────────

async function loadLeaderboard() {
  const api = window._personadleApi;
  const body = document.getElementById("leaderboardBody");

  if (filters.friendsOnly && !window._currentUser) {
    renderFilterNote();
    if (body)
      body.innerHTML = `
      <div class="lb-empty">
        <span class="lb-empty__icon">🔒</span>
        <p class="lb-empty__text">${t("leaderboard.login_for_friends") || "Log in to see your friends leaderboard."}</p>
      </div>`;
    document.getElementById("myRankBanner")?.classList.add("hidden");
    document.getElementById("lbPagination")?.classList.add("hidden");
    return;
  }

  if (!api) {
    if (body)
      body.innerHTML = `<p class="lb-loading">${t("ui.offline") || "Offline — leaderboard unavailable."}</p>`;
    return;
  }

  if (body) body.innerHTML = `<p class="lb-loading">${t("ui.loading") || "Loading…"}</p>`;
  renderFilterNote();

  try {
    const data = await api.leaderboard.get({
      mode: filters.mode,
      period: filters.period,
      metric: filters.metric,
      limit: PAGE_SIZE,
      offset: filters.offset,
      friends_only: filters.friendsOnly ? 1 : 0,
    });

    renderLeaderboard(data);
    renderPagination(data.count ?? 0);
  } catch (err) {
    if (body) {
      const msg =
        err.status === 0
          ? t("ui.offline") || "Offline — leaderboard unavailable."
          : t("leaderboard.error") || "Could not load leaderboard.";
      body.innerHTML = `
        <div class="lb-empty">
          <span class="lb-empty__icon">⚠️</span>
          <p class="lb-empty__text">${msg}</p>
        </div>`;
    }
  }
}

// ─────────────────────────────────────────────────────────
// FILTRES — GESTION DES PILLS
// ─────────────────────────────────────────────────────────

/**
 * Active une pill dans un groupe et met à jour le filtre correspondant.
 * @param {HTMLElement} groupEl - Conteneur des pills
 * @param {string} value        - Valeur sélectionnée
 */
function activatePill(groupEl, value) {
  groupEl.querySelectorAll(".lb-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.value === value);
  });
}

/** Attache les listeners sur les groupes de filtres. */
function attachFilterListeners() {
  const modeGroup = document.getElementById("modeFilter");
  const periodGroup = document.getElementById("periodFilter");
  const metricGroup = document.getElementById("metricFilter");

  modeGroup?.addEventListener("click", (e) => {
    const pill = e.target.closest(".lb-pill");
    if (!pill) return;
    filters.mode = pill.dataset.value;
    filters.offset = 0;
    activatePill(modeGroup, filters.mode);
    loadLeaderboard();
  });

  periodGroup?.addEventListener("click", (e) => {
    const pill = e.target.closest(".lb-pill");
    if (!pill) return;
    filters.period = pill.dataset.value;
    filters.offset = 0;
    activatePill(periodGroup, filters.period);
    loadLeaderboard();
  });

  metricGroup?.addEventListener("click", (e) => {
    const pill = e.target.closest(".lb-pill");
    if (!pill) return;
    filters.metric = pill.dataset.value;
    filters.offset = 0;
    activatePill(metricGroup, filters.metric);
    loadLeaderboard();
  });

  document.getElementById("scopeFilter")?.addEventListener("click", (e) => {
    const pill = e.target.closest(".lb-pill");
    if (!pill) return;
    filters.friendsOnly = pill.dataset.value === "friends";
    filters.offset = 0;
    activatePill(document.getElementById("scopeFilter"), pill.dataset.value);
    loadLeaderboard();
  });

  // Pagination
  document.getElementById("lbPrevBtn")?.addEventListener("click", () => {
    if (filters.offset === 0) return;
    filters.offset = Math.max(0, filters.offset - PAGE_SIZE);
    loadLeaderboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("lbNextBtn")?.addEventListener("click", () => {
    filters.offset += PAGE_SIZE;
    loadLeaderboard();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ─────────────────────────────────────────────────────────
// POINT D'ENTRÉE
// ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__i18nReady) await window.__i18nReady;

  attachFilterListeners();
  loadLeaderboard(); // calls renderFilterNote() internally
});
