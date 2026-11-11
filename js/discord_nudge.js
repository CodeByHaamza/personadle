/**
 * js/discord_nudge.js — « Poste ta grille sur Discord », au bon moment.
 *
 * Lot 8 de la 2.4. Le serveur PersonaDLE ne gagnait presque personne
 * (2 arrivées en 30 jours, mesure du 2026-11-09) : son seul lien était une icône
 * en bas de l'accueil. Le moment où un joueur a envie d'en parler, c'est juste
 * après une victoire — et plus encore après une journée 6/6.
 *
 * Ce qu'on affiche, dans le bloc posé sous la navigation de fin de partie
 * (endgameSlot(), js/share_result.js) :
 *  - après une victoire : une carte qui copie le résultat (le même texte que
 *    « Partager mon résultat ») et ouvre le serveur ;
 *  - après la 6e victoire du jour : la même, en version « 6/6 ».
 * La cible du jour est tirée PAR joueur : la grille ne divulgue rien à personne,
 * c'est l'argument de la carte.
 *
 * Retenue, pour ne pas devenir une pub :
 *  - une fois par jour (une seconde fois pour le 6/6), et à nouveau seulement si
 *    c'est la MÊME partie qui se réaffiche (rechargement) ;
 *  - jamais après un abandon, jamais pendant un défi (readCurrentResult) ;
 *  - ✕ « j'y suis déjà » la cache pour de bon sur cet appareil.
 *
 * Le compteur de membres vient de /api/discord_counts (proxy en cache côté
 * serveur : l'IP du joueur ne part pas chez Discord tant qu'il ne clique pas).
 * Il ne s'affiche qu'au-delà d'un seuil : « 2 en ligne » ferait fuir.
 */

import { DISCORD_INVITE_URL, isExpertPage, parisDateKey, siteRootPrefix } from "./gameCore.js";
import { dailyProgress } from "./daily_status.js";
import { currentShareText, endgameSlot, readCurrentResult, toast } from "./share_result.js";
import { currentDayShareText } from "./share_day.js";

export const NUDGE_HIDDEN_KEY = "discordNudgeHidden";
export const NUDGE_SHOWN_KEY = "discordNudgeShown";
const COUNTS_CACHE_KEY = "discordCounts";
const COUNTS_TTL_MS = 5 * 60 * 1000;
export const MIN_MEMBERS_SHOWN = 50;
export const MIN_ONLINE_SHOWN = 5;

function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

function _read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function _write(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    /* navigation privée, quota : la carte reviendra, rien de grave */
  }
}

/**
 * Quelle carte montrer, s'il en faut une. Pure : testée dans
 * tests/discord_nudge.test.js.
 *
 * @param {object} o
 * @param {{id: string, result: string}|null} o.result   partie affichée (readCurrentResult)
 * @param {{done: number, total: number}}      o.progress  état du jour (dailyProgress)
 * @param {{day: string, id: string, variant: string}|null} o.record dernière carte montrée
 * @param {boolean} o.hidden  le joueur a fermé la carte pour de bon
 * @param {string}  o.today   jour de Paris
 * @returns {null | "win" | "perfect_day"}
 */
export function pickNudgeVariant({ result, progress, record, hidden, today }) {
  if (hidden || !result || result.result !== "win") return null;
  const variant =
    progress && progress.total > 0 && progress.done >= progress.total ? "perfect_day" : "win";
  if (!record || record.day !== today) return variant;
  if (record.id === result.id) return variant; // même partie, réaffichée
  if (variant === "perfect_day" && record.variant !== "perfect_day") return variant;
  return null;
}

/**
 * Ligne « 69 membres · 7 en ligne », ou null sous les seuils.
 * @param {{members?: number|null, online?: number|null}|null} counts
 */
export function countsLine(counts) {
  const members = Number.isInteger(counts?.members) ? counts.members : 0;
  const online = Number.isInteger(counts?.online) ? counts.online : 0;
  if (members < MIN_MEMBERS_SHOWN) return null;
  const parts = [_t("discord.members", `${members} members`, { members })];
  if (online >= MIN_ONLINE_SHOWN)
    parts.push(_t("discord.online", `${online} online now`, { online }));
  return parts.join(" · ");
}

/**
 * Compteurs du serveur, mis en cache 5 min dans la session du navigateur.
 * Ne lève jamais : null si l'API est absente ou ne répond pas.
 */
export async function fetchDiscordCounts({
  api = window._personadleApi,
  storage = sessionStorage,
  now = Date.now(),
} = {}) {
  try {
    const cached = JSON.parse(_read(storage, COUNTS_CACHE_KEY) || "null");
    if (cached && now - cached.at < COUNTS_TTL_MS) return cached.counts;
  } catch {
    /* cache illisible : on refait l'appel */
  }
  if (typeof api?.discord?.counts !== "function") return null;
  try {
    const counts = await api.discord.counts();
    _write(storage, COUNTS_CACHE_KEY, JSON.stringify({ at: now, counts }));
    return counts;
  } catch {
    return null;
  }
}

function _readRecord(storage) {
  try {
    return JSON.parse(_read(storage, NUDGE_SHOWN_KEY) || "null");
  } catch {
    return null;
  }
}

/**
 * Monte la carte sous #modeNavigationContainer. Appelée par revealNextLink()
 * (gameCore.js) à chaque fin de partie, rechargement compris.
 * @returns {HTMLElement|null}
 */
export function mountDiscordNudge(
  doc = document,
  { storage = localStorage, today = parisDateKey() } = {}
) {
  const nav = doc.getElementById("modeNavigationContainer");
  doc.getElementById("discordNudge")?.remove();
  if (!nav) return null;

  const result = readCurrentResult(storage);
  if (result && result.isExpert !== isExpertPage()) return null;
  const variant = pickNudgeVariant({
    result,
    progress: dailyProgress({ storage, today }),
    record: _readRecord(storage),
    hidden: _read(storage, NUDGE_HIDDEN_KEY) === "1",
    today,
  });
  if (!variant) return null;

  const title =
    variant === "perfect_day"
      ? _t("discord.nudge_perfect_title", "🏆 6/6 today! Show it off on Discord")
      : _t("discord.nudge_win_title", "Nice one! Post your grid on Discord");
  const card = doc.createElement("aside");
  card.id = "discordNudge";
  card.className = `discord-nudge discord-nudge--${variant}`;
  card.setAttribute("aria-label", title);
  card.innerHTML = `
    <span class="discord-nudge__logo" aria-hidden="true">
      <img src="${siteRootPrefix()}assets/buttons/discord.svg" alt="" width="26" height="26" />
    </span>
    <div class="discord-nudge__body">
      <p class="discord-nudge__title"></p>
      <p class="discord-nudge__text"></p>
      <p class="discord-nudge__count" hidden></p>
    </div>
    <a class="discord-nudge__cta" href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener"></a>
    <button type="button" class="discord-nudge__close">✕</button>`;
  card.querySelector(".discord-nudge__title").textContent = title;
  card.querySelector(".discord-nudge__text").textContent = _t(
    "discord.nudge_text",
    "Everyone gets their own target: your grid spoils nothing."
  );
  const cta = card.querySelector(".discord-nudge__cta");
  cta.textContent =
    variant === "perfect_day"
      ? _t("discord.nudge_perfect_cta", "Copy my day & open Discord")
      : _t("discord.nudge_cta", "Copy & open Discord");
  const close = card.querySelector(".discord-nudge__close");
  const hideLabel = _t("discord.nudge_hide", "Hide — I'm already on the server");
  close.setAttribute("aria-label", hideLabel);
  close.title = hideLabel;

  // Un <a> plutôt que window.open() : jamais bloqué comme popup. La copie part
  // pendant le clic, tant que la page a encore le focus (le presse-papiers le
  // refuse sinon) ; l'onglet Discord s'ouvre juste après.
  cta.addEventListener("click", () => {
    // 6/6 : la journée entière (js/share_day.js), sinon la partie qui vient de finir.
    const text =
      variant === "perfect_day" ? currentDayShareText({ storage }) : currentShareText(doc);
    if (!text || typeof navigator.clipboard?.writeText !== "function") return;
    navigator.clipboard
      .writeText(text)
      .then(() => toast(_t("discord.nudge_copied", "Result copied — paste it on the server!")))
      .catch(() => {});
  });
  close.addEventListener("click", () => {
    _write(storage, NUDGE_HIDDEN_KEY, "1");
    card.remove();
  });

  // Sous la barre de fin de partie, dans le même bloc que « Partager » : le bloc
  // se cache avec la barre quand une nouvelle partie démarre (endgameSlot()).
  endgameSlot(doc).appendChild(card);
  _write(storage, NUDGE_SHOWN_KEY, JSON.stringify({ day: today, id: result.id, variant }));

  fetchDiscordCounts().then((counts) => {
    const line = countsLine(counts);
    const el = card.querySelector(".discord-nudge__count");
    if (line && el) {
      el.textContent = line;
      el.hidden = false;
    }
  });
  return card;
}
