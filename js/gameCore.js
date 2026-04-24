/**
 * gameCore.js — Shared utilities for all Personadle game modes.
 *
 * Every game mode (Classique, Emoji, Silhouette, AllOutAttack, Personae, Music)
 * imports from this file to avoid code duplication.
 *
 * Exported API:
 *   parisDateKey(d?)            → "YYYY-MM-DD" in Europe/Paris (DST-safe)
 *   msUntilNextParisMidnight()  → ms until next Paris midnight
 *   normalize(str)              → lowercase, accent-stripped, trimmed
 *   showConfettiExplosion(opts) → victory confetti burst + victory sound
 *   revealNextLink(opts)        → shows the mode-navigation bar
 *   setupRulesModal()           → wires the "?" button and modal close
 *   setupDailyReset(onReset)    → schedules an auto-reset at Paris midnight
 *   checkResetOnLoad(...)       → resets the game if a new day has started
 *   setupFilterButtons(...)     → wires opus filter-button click events
 *   showWrongMini(...)          → appends a shaking wrong-guess portrait
 *   buildGameSession(opts)      → builds a standardised session object for the backend
 *   savePendingSession(session) → stores a session in localStorage for later sync
 *   getPlayerSeedId()           → stable per-player seed ID (user_id or anon UUID)
 *   getDailyTarget(pool, mode)  → deterministic per-player daily pick via FNV-1a seeded RNG
 *   showCommunityStats(mode, t) → injects "X% of players found this today" in victory box
 */


// ─────────────────────────────────────────────────────────────────────────────
// DATE UTILITIES (Paris / Europe timezone, DST-safe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns today's date as "YYYY-MM-DD" using the Europe/Paris timezone.
 * Handles Daylight Saving Time automatically via Intl.DateTimeFormat.
 *
 * @param {Date} [d=new Date()] - Optional date to format (default: now)
 * @returns {string} e.g. "2025-03-26"
 */
export function parisDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns the number of milliseconds remaining until the next Paris midnight.
 * Used to schedule the automatic daily reset.
 *
 * @returns {number} Milliseconds until 00:00:00 Paris time
 */
export function msUntilNextParisMidnight() {
  const nowInParis = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  const midnight = new Date(nowInParis);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - nowInParis.getTime();
}


// ─────────────────────────────────────────────────────────────────────────────
// STRING UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes a string for case-insensitive, accent-insensitive comparison.
 * Used in Music mode to compare song titles, but available to all modes.
 *
 * @param {string} str
 * @returns {string} Lowercase, accent-stripped, trimmed string
 *
 * @example
 * normalize("Brûle, ma Peine !") // "brule, ma peine !"
 */
export function normalize(str) {
  return str
    .normalize("NFD")                     // decompose accented chars
    .replace(/[\u0300-\u036f]/g, "")      // strip combining diacritics
    .replace(/[\u2018\u2019]/g, "'")      // unify curly apostrophes → straight
    .replace(/"/g, "")                    // remove double quotes
    .trim()
    .toLowerCase();
}


// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI / VICTORY CELEBRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plays the victory sound and launches an animated confetti burst.
 *
 * Two spawn styles are supported:
 *   - "sides"  (default): emojis launch from the left and right edges —
 *              used by Classique, Emoji, Silhouette, AllOutAttack.
 *   - "bottom": emojis launch from random positions along the bottom edge —
 *              used by Personae and Music.
 *
 * NOTE: `new Audio(path)` resolves relative to the *document* URL, not this
 * module's URL. All mode pages sit one level deep (e.g. classiqueMode/),
 * so "../assets/…" always resolves to the project root.
 *
 * @param {Object}   [opts]
 * @param {string[]} [opts.emojiList=["🎉","🎊","✨","💥","🌟"]] - Emojis to use
 * @param {number}   [opts.count=40]   - Total number of emoji particles
 * @param {string}   [opts.spreadFrom="sides"] - "sides" | "bottom"
 */
export function showConfettiExplosion({
  emojiList = ["🎉", "🎊", "✨", "💥", "🌟"],
  count = 40,
  spreadFrom = "sides",
} = {}) {
  // Play victory sound (path resolved relative to the HTML page)
  new Audio("../assets/sound_effect/Victory_sound.mp3").play().catch(() => {});

  for (let i = 0; i < count; i++) {
    const emoji = document.createElement("span");
    emoji.textContent = emojiList[Math.floor(Math.random() * emojiList.length)];
    emoji.classList.add("confetti-emoji");
    emoji.style.bottom = "0vh";

    if (spreadFrom === "sides") {
      // Bilateral: first half from left, second half from right
      const isLeft = i < count / 2;
      emoji.style.left = isLeft ? "0vw" : "100vw";
      const xTarget = isLeft
        ? Math.random() * 50 + 25
        : -(Math.random() * 50 + 25);
      emoji.style.setProperty("--x-move", xTarget + "vw");
    } else {
      // Bottom: random horizontal origin
      emoji.style.left = Math.random() * 100 + "vw";
      emoji.style.setProperty(
        "--x-move",
        (Math.random() * 100 - 50) + "vw"
      );
    }

    emoji.style.setProperty("--y-move", -(Math.random() * 50 + 30) + "vh");
    emoji.style.setProperty("--rotate", Math.random() * 360 + "deg");

    document.body.appendChild(emoji);
    setTimeout(() => emoji.remove(), 1000);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// MODE NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reveals the between-modes navigation bar and wires prev/next links.
 * Called after a win or give-up in every game mode.
 *
 * The container (#modeNavigationContainer) must already exist in the HTML
 * with display:none. It is made visible here and scrolled into view.
 *
 * @param {Object} [opts]
 * @param {string} [opts.nextHref=""]   - URL for the "next mode" button
 * @param {string} [opts.prevHref=null] - URL for the "prev mode" button
 *                                        (null/empty = button stays hidden)
 */
export function revealNextLink({ nextHref = "", prevHref = null } = {}) {
  const nav = document.getElementById("modeNavigationContainer");
  const nextButton = document.getElementById("nextModeButton");
  const prevButton = document.getElementById("prevModeButton");

  if (nextButton && nextHref) {
    nextButton.onclick = () => (location.href = nextHref);
  }

  if (prevButton) {
    if (prevHref) {
      prevButton.style.visibility = "visible";
      prevButton.onclick = () => (location.href = prevHref);
    } else {
      prevButton.style.visibility = "hidden";
      prevButton.onclick = null;
    }
  }

  if (nav) {
    nav.style.display = "flex";
    // Delay the scroll so the layout has time to update
    setTimeout(() => {
      nav.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 1500);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// RULES MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires the "How to Play" rules modal:
 *  - Clicking #rulesButton opens the modal and adds "modal-open" to <body>
 *  - Clicking the × button or the backdrop closes it
 *
 * Safe to call even if the elements are missing (no-op).
 */
export function setupRulesModal() {
  const modal = document.getElementById("rulesModal");
  const btn = document.getElementById("rulesButton");
  if (!modal || !btn) return;

  const closeBtn = modal.querySelector(".close");

  const open = () => {
    modal.style.display = "block";
    document.body.classList.add("modal-open");
  };

  const close = () => {
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
  };

  btn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);

  // Close when clicking the semi-transparent backdrop
  window.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// DAILY RESET SCHEDULING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedules a one-time callback at the next Paris midnight + 500 ms buffer.
 * Called once at page load; the callback is responsible for triggering
 * the mode-specific reset (e.g. clicking #resetButton or calling resetGame()).
 *
 * @param {Function} onReset - Called when midnight Paris is reached
 * @returns {number} The setTimeout timer ID (can be cleared if needed)
 */
export function setupDailyReset(onReset) {
  const ms = msUntilNextParisMidnight();
  console.log(`🕛 Next auto-reset in ~${Math.round(ms / 60000)} minutes (Paris)`);
  return setTimeout(onReset, ms + 500);
}

/**
 * Checks at page load whether a new Paris day has started since last visit.
 * If yes, cleans up yesterday's stats key, saves today's date, and triggers
 * the mode-specific reset callback.
 *
 * @param {string}   lastPlayedKey  - localStorage key storing the last-played date
 *                                    (e.g. "lastPlayedDate_Classic")
 * @param {string}   statsModeKey   - Mode identifier used in the stats key
 *                                    (e.g. "Classic" → "statsLogged_Classic_YYYY-MM-DD")
 * @param {Function} onReset        - Callback to run when a new day is detected
 */
export function checkResetOnLoad(lastPlayedKey, statsModeKey, onReset) {
  const storedDate = localStorage.getItem(lastPlayedKey);
  const today = parisDateKey();

  if (storedDate !== today) {
    console.log(`📅 New day detected → auto-reset (${statsModeKey})`);

    // Remove yesterday's stats flag so it can be re-logged today
    if (storedDate) {
      localStorage.removeItem(`statsLogged_${statsModeKey}_${storedDate}`);
    }

    localStorage.setItem(lastPlayedKey, today);
    onReset();
  } else {
    console.log(`📅 Same day, no reset needed (${statsModeKey})`);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// OPUS FILTER BUTTONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wires click events for the opus filter buttons (.filter-btn).
 *
 * On each click:
 *  1. Toggles the "active" CSS class on the clicked button
 *  2. Collects the full list of currently active filter values
 *  3. Persists them to localStorage
 *  4. Calls `onFilterChange` with the new filter array so the mode can
 *     re-filter its character pool and pick a new target
 *
 * The initial visual state (which buttons are active) must be set BEFORE
 * calling this function (see each mode's DOMContentLoaded handler).
 *
 * @param {string}   storageKey     - localStorage key for this mode's filters
 *                                    (e.g. "filters_Classic")
 * @param {Function} onFilterChange - Called with (string[]) newActiveFilters
 */
export function setupFilterButtons(storageKey, onFilterChange) {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");

      const activeFilters = Array.from(
        document.querySelectorAll(".filter-btn.active")
      ).map((b) => b.dataset.opus);

      localStorage.setItem(storageKey, JSON.stringify(activeFilters));
      onFilterChange(activeFilters);
    });
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// WRONG GUESS MINI PORTRAIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends a small "wrong guess" portrait to the wrong-guesses list and
 * triggers the shake animation after a brief delay.
 *
 * Used by Classique, Emoji, Silhouette, AllOutAttack, and Personae.
 * (Music mode has its own variant that also shows the song title.)
 *
 * @param {string}      imageSrc      - Full src URL for the portrait image
 * @param {string}      altText       - Alt text / character name
 * @param {HTMLElement} wrongListEl   - The container element (#wrongGuessList)
 * @param {string}      [fallbackSrc] - Fallback image src on load error
 */
export function showWrongMini(
  imageSrc,
  altText,
  wrongListEl,
  fallbackSrc = "../database/portraits/unknown.webp"
) {
  if (!wrongListEl) return;

  const div = document.createElement("div");
  div.className = "wrong-mini";

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = altText;
  img.onerror = () => { img.src = fallbackSrc; };

  div.appendChild(img);
  wrongListEl.appendChild(div);

  // Small delay so the element is in the DOM before the class triggers CSS
  setTimeout(() => div.classList.add("shake"), 50);
}


// ─────────────────────────────────────────────────────────────────────────────
// GAME SESSION — Backend sync preparation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a standardised game session object ready to be POST-ed to /api/sessions.
 * Call this at the end of each game (win or giveup).
 *
 * @param {object}   opts
 * @param {string}   opts.mode       - Mode name: 'Classic'|'Emoji'|'Silhouette'|'AllOutAttack'|'Personae'|'Music'
 * @param {string}   opts.targetName - The character/track that was to be guessed
 * @param {string}   opts.result     - 'win' | 'giveup'
 * @param {number}   opts.attempts   - Number of attempts made
 * @param {number}   opts.timeMs     - Time spent in milliseconds
 * @param {string[]} [opts.filters]  - Active opus filters at the time of the game
 * @returns {{ mode, played_date, target_name, result, attempts, time_ms, active_filters }}
 */
export function buildGameSession({ mode, targetName, result, attempts, timeMs = 0, filters = [] }) {
  return {
    mode,
    played_date:    parisDateKey(),
    target_name:    targetName,
    result,
    attempts,
    time_ms:        Math.round(timeMs),
    active_filters: filters,
  };
}

/**
 * Saves a completed game session.
 *
 * If the user is connected (window._personadleApi available + session active),
 * the session is posted directly to the backend.
 * On failure (offline, server error), it falls back to localStorage so it
 * can be synced later via api.stats.syncPending().
 *
 * If the user is not connected, the session is queued in localStorage only.
 *
 * After saving, shows community stats in the victory box (if the backend is reachable).
 *
 * @param {ReturnType<typeof buildGameSession>} session
 */
export async function savePendingSession(session) {
  const api = window._personadleApi;

  if (api) {
    try {
      await api.stats.postSession(session);
      // Success — also sync any previously queued offline sessions
      await api.stats.syncPending();
    } catch (err) {
      if (err?.status === 409) return; // Session already recorded (e.g. challenge replay)
      // Offline or other server error — queue to localStorage for later sync
      const pending = JSON.parse(localStorage.getItem('pendingSessions') || '[]');
      pending.push(session);
      localStorage.setItem('pendingSessions', JSON.stringify(pending));
    }
  } else {
    const pending = JSON.parse(localStorage.getItem('pendingSessions') || '[]');
    pending.push(session);
    localStorage.setItem('pendingSessions', JSON.stringify(pending));
  }

  // Always try to show community stats (silent fail if offline)
  showCommunityStats(session.mode, session.target_name);
}


// ─────────────────────────────────────────────────────────────────────────────
// DAILY TARGET — Deterministic seeded RNG (FNV-1a 32-bit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a stable player-specific seed ID used to personalise the daily target.
 *
 * Priority order:
 *   1. Logged-in user → their numeric user_id (set in localStorage by auth.js)
 *   2. Anonymous → a random UUID generated once and stored as 'anonPlayerId'
 *
 * This ensures:
 *   - Every player gets their own unique daily character (not the same as everyone else)
 *   - The pick is stable: reloading the page gives the same character
 *   - On login the player seamlessly switches to their account-based seed
 *
 * @returns {string}
 */
export function getPlayerSeedId() {
  const uid = localStorage.getItem('playerUserId');
  if (uid) return uid;

  let anonId = localStorage.getItem('anonPlayerId');
  if (!anonId) {
    // Generate a random UUID v4-like identifier (crypto.randomUUID when available)
    anonId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    localStorage.setItem('anonPlayerId', anonId);
  }
  return anonId;
}

/**
 * Returns a deterministic daily target from a pool using a player+date+mode seed.
 * Each player gets their own unique character for a given day and mode.
 *
 * Algorithm: FNV-1a 32-bit hash of "${seedId}|${date}|${mode}" modulo pool.length.
 * Stable across reloads for the same player — changes only if seedId, date or mode changes.
 *
 * @param {Array}  pool            - Array of items to pick from (objects or strings)
 * @param {string} mode            - Mode identifier (e.g. 'Classic', 'Music')
 * @param {string} [date]          - YYYY-MM-DD date key (default: today Paris time)
 * @param {string} [seedId]        - Player seed ID (default: getPlayerSeedId())
 * @returns {*} The selected item, or null if pool is empty
 */
export function getDailyTarget(pool, mode, date = parisDateKey(), seedId = getPlayerSeedId()) {
  if (!pool || pool.length === 0) return null;
  // Debug override: debugTarget_<mode> in localStorage (set via debug panel)
  try {
    const override = localStorage.getItem(`debugTarget_${mode}`);
    if (override && pool.includes(override)) return override;
  } catch (_) { /* ignore */ }
  const str = `${seedId}|${date}|${mode}`;
  let h = 2166136261 >>> 0; // FNV-1a offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return pool[h % pool.length];
}


// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY STATS — "X% of players found this today"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches and injects the "X% of N players found this today" stat into the
 * victory box. Called automatically by savePendingSession() after each game.
 *
 * Silent no-op if: offline, API unavailable, or fewer than 2 total plays.
 *
 * @param {string} mode       - Mode string as stored in game_sessions (e.g. 'Classic')
 * @param {string} targetName - The character/song name that was the answer
 */
export async function showCommunityStats(mode, targetName) {
  const api = window._personadleApi;
  if (!api?.communityStats) return;

  try {
    const data = await api.communityStats.get({
      mode: mode.toLowerCase(),
      date: parisDateKey(),
      target: targetName,
    });
    // Skip if too few data points (e.g. first player of the day)
    if (!data?.total || data.total < 2) return;

    const victoryBox = document.getElementById('victoryBox') || document.querySelector('.victory-box');
    if (!victoryBox) return;

    let el = victoryBox.querySelector('.community-stats');
    if (!el) {
      el = document.createElement('p');
      el.className = 'community-stats';
      victoryBox.appendChild(el);
    }

    const i18n = window.i18n || { t: (k) => k };
    el.textContent = i18n.t('game.community_stats', { percent: data.percent, total: data.total });
  } catch {
    // Offline or API not available — silent fail
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Filter storage keys per mode — single source of truth (also exported for friends.js)
export const FILTER_STORAGE_KEYS = {
  classic:      'filters_Classic',
  emoji:        'filters_Emoji',
  silhouette:   'silhouetteActiveFilters',
  alloutattack: 'filters_AllOutAttack',
  personae:     'personaeActiveFilters',
  music:        'musicActiveFilters',
};
const _FILTER_STORAGE_KEY = FILTER_STORAGE_KEYS;

/** Returns the currently active opus filters for a given mode (array of strings). */
function _getActiveFilters(mode) {
  const key = _FILTER_STORAGE_KEY[mode?.toLowerCase()];
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

// CHALLENGE BUTTON — "Challenge a friend" post-victoire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Injecte le bouton "Challenge a Friend" dans le modeNavigationContainer
 * après une victoire. Ne fait rien si l'utilisateur n'est pas connecté.
 *
 * @param {string} mode   - Mode lowercase ('classic', 'emoji', etc.)
 * @param {number} score  - Score à battre (tentatives ou secondes selon le mode)
 */
export function showChallengeButton(mode, score) {
  if (!window._currentUser) return;

  const nav = document.getElementById('modeNavigationContainer');
  if (!nav || document.getElementById('challengeFriendBtn')) return;

  const t    = (key, fb) => window.i18n?.t?.(key) ?? fb;
  const date = parisDateKey();

  const btn = document.createElement('button');
  btn.id        = 'challengeFriendBtn';
  btn.className = 'btn-challenge';
  btn.innerHTML = `<span>⚔</span><span>${t('challenge.challenge_friend', 'Challenge a Friend')}</span>`;

  // Insérer entre prevMode et nextMode
  const nextBtn = document.getElementById('nextModeButton');
  if (nextBtn) nav.insertBefore(btn, nextBtn);
  else         nav.appendChild(btn);

  btn.addEventListener('click', () => _showChallengeModal(mode, score, date, _getActiveFilters(mode)));
}

function _showChallengeModal(mode, score, date, activeFilters = []) {
  const api = window._personadleApi;
  if (!api || !window._currentUser) return;

  document.getElementById('challengeModal')?.remove();

  const t   = (key, fb) => window.i18n?.t?.(key) ?? fb;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  const modal = document.createElement('div');
  modal.id        = 'challengeModal';
  modal.className = 'challenge-overlay';
  modal.innerHTML = `
    <div class="challenge-card">
      <div id="challengeFriendList" class="challenge-card__list">
        <p class="challenge-card__empty">${t('ui.loading', 'Loading…')}</p>
      </div>
      <div class="challenge-card__footer">
        <span class="challenge-card__footer-label">⚔ ${t('challenge.select_friend', 'Challenge a friend')}</span>
        <button id="challengeModalClose" class="challenge-card__footer-close" aria-label="Close">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#challengeModalClose').addEventListener('click', () => modal.remove());

  // Charger la liste d'amis
  api.friends.list().then(data => {
    const friends = data.friends ?? [];
    const listEl  = document.getElementById('challengeFriendList');
    if (!listEl) return;

    if (!friends.length) {
      listEl.innerHTML = `<p class="challenge-card__empty">${t('friends.no_friends', 'No friends yet.')}</p>`;
      return;
    }

    listEl.innerHTML = friends.map(f => `
      <div class="challenge-friend-row">
        <img class="challenge-friend-row__avatar"
             src="${esc(f.avatar_data) || '../img/default_avatar.png'}"
             onerror="this.src='../img/default_avatar.png'"
             alt="${esc(f.pseudo)}">
        <div class="challenge-friend-row__info">
          <div class="challenge-friend-row__pseudo">${esc(f.pseudo)}</div>
          <div class="challenge-friend-row__code">${esc(f.friend_code)}</div>
        </div>
        <button data-fid="${f.friend_id}" class="challenge-friend-row__send js-send-challenge">
          ${t('challenge.send', 'Send')}
        </button>
      </div>
    `).join('');

    listEl.querySelectorAll('.js-send-challenge').forEach(sendBtn => {
      sendBtn.addEventListener('click', async () => {
        sendBtn.disabled = true;
        const friendId = parseInt(sendBtn.dataset.fid);
        try {
          await api.messages.send({
            receiver_id:      friendId,
            type:             'challenge',
            challenge_mode:   mode,
            challenge_score:  score,
            challenge_date:   date,
            challenge_filters: JSON.stringify(activeFilters),
          });
          sendBtn.textContent = '✓ Sent!';
          sendBtn.classList.add('sent');

          // XP Social Link : action 'challenge'
          if (api.socialLink) {
            api.socialLink.interactByFriend(friendId, 'challenge').catch(() => {});
          }
        } catch (err) {
          sendBtn.disabled = false;
          sendBtn.textContent = err?.status === 409
            ? t('challenge.already_sent', 'Already sent today')
            : '✕ Error';
        }
      });
    });
  }).catch(() => {
    const listEl = document.getElementById('challengeFriendList');
    if (listEl) listEl.innerHTML = `<p class="challenge-card__empty">Could not load friends.</p>`;
  });
}
