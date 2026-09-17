/**
 * profile/compendium/compendium.js — Le Compendium, carnet de collection.
 *
 * Charge GET /api/user/compendium (le sien, ou ?view=CODE pour un ami — public,
 * comme le profil), construit les chapitres (compendium_entries.js, pur) et les
 * rend dans un livre : couverture qui s'ouvre, onglets-signets, double page
 * avec tourne-page ; sur mobile une page, onglets en haut, balayage.
 *
 * Texte d'ambiance généré par i18n (compendium.flavor.*) — décision produit
 * du 2026-09-12 : pas de note personnelle. Les dates absentes (liens antérieurs
 * à l'historique des rang-ups) s'affichent « avant le compendium », jamais
 * inventées.
 */

import { siteRootPrefix } from "../../js/gameCore.js";
import { getBadgeById } from "../badges/badgesData.js";
import {
  buildChapters,
  chapterSummary,
  paginate,
  CHAPTERS,
  MODE_ICON,
} from "./compendium_entries.js";

const PAGE_SIZE = 5;

const CHAPTER_META = {
  badges: { icon: "🎖️" },
  titles: { icon: "🏅" },
  wallpapers: { icon: "🖼️" },
  bonds: { icon: "💙" },
  challenges: { icon: "⚔" },
  feats: { icon: "🌟" },
};

const state = {
  data: null,
  chapters: null,
  summary: null,
  chapter: "badges",
  page: 0,
  lang: "en",
};

/** Traduction avec repli ET variables (cf. CLAUDE.md §5). */
function t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/** Libellé d'un mode via i18n (modes.<key>.name, déjà traduit partout) sinon la clé. */
function modeName(mode) {
  const key = String(mode ?? "").toLowerCase();
  const map = {
    classic: "Classic",
    emoji: "Emoji",
    silhouette: "Silhouette",
    alloutattack: "All-Out Attack",
    personae: "Personae",
    music: "Music",
  };
  return t(`modes.${key}.name`, map[key] ?? mode);
}

/** Date SQL → date locale longue ; null → « avant le compendium ». */
function formatDate(sql) {
  if (!sql) return null;
  const iso = String(sql).replace(" ", "T");
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(sql) ? `${sql}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(sql).slice(0, 10);
  try {
    return new Intl.DateTimeFormat(state.lang, { dateStyle: "long" }).format(d);
  } catch {
    return String(sql).slice(0, 10);
  }
}

/** « 1 essai » / « 4 essais » — les scores de défi et de première victoire sont des tentatives. */
function triesLabel(n) {
  const k = Number(n);
  if (!Number.isFinite(k)) return String(n ?? "");
  return k === 1
    ? t("compendium.tries_one", "1 try")
    : t("compendium.tries", `${k} tries`, { n: k });
}

/** Titre d'une entrée : clair, ou « key:… » à résoudre. Badges : nom i18n sinon badgesData. */
function entryTitle(e) {
  if (e.kind === "badge") {
    const name = t(`badges.${e.badgeId}.name`, null);
    return name ?? getBadgeById(e.badgeId)?.name ?? e.badgeId;
  }
  let title = e.title;
  if (typeof title === "string" && title.startsWith("key:")) {
    title = t(title.slice(4), title.slice(4).split(".").pop());
  }
  // Exploits par mode : « Première victoire · Personae »
  if (e.chapter === "feats" && e.mode) title = `${title} · ${modeName(e.mode)}`;
  return title;
}

function entryFlavor(e) {
  const vars = { ...e.vars };
  if (vars.mode) vars.mode = modeName(vars.mode);
  if (e.chapter === "challenges" && vars.score !== "" && vars.score != null)
    vars.score = triesLabel(vars.score);
  if (e.kind === "first_win" && vars.n != null) vars.n = triesLabel(vars.n);
  const fallback = e.flavorFallback ? t(e.flavorFallback, "", vars) : "";
  return t(e.flavor, fallback, vars);
}

function entryVisual(e) {
  const root = siteRootPrefix();
  if (e.kind === "badge") {
    const img = getBadgeById(e.badgeId)?.img;
    return img
      ? `<span class="cp-entry__visual"><img src="${esc(img)}" alt="" loading="lazy"></span>`
      : `<span class="cp-entry__visual">🎖️</span>`;
  }
  if (e.kind === "title") {
    return `<span class="cp-entry__visual cp-entry__visual--wide"><img src="${esc(root + e.img)}" alt="" loading="lazy"></span>`;
  }
  if (e.kind === "wallpaper") {
    return `<span class="cp-entry__visual"><img src="${esc(root + e.img)}" alt="" loading="lazy"></span>`;
  }
  if (e.chapter === "bonds" || (e.chapter === "challenges" && e.avatar)) {
    const src = e.avatar
      ? e.avatar.startsWith("data:")
        ? e.avatar
        : root + String(e.avatar).replace(/^(\.\.\/|\.\/)+/, "")
      : `${root}img/default_avatar.png`;
    return `<span class="cp-entry__visual cp-entry__visual--avatar" style="border-color:${esc(e.border || "#fff")}"><img src="${esc(src)}" alt="" loading="lazy" onerror="this.src='${root}img/default_avatar.png'"></span>`;
  }
  return `<span class="cp-entry__visual">${e.icon ?? "✦"}</span>`;
}

function renderEntry(e, idx) {
  const date = formatDate(e.date);
  const dateHtml = date
    ? `<p class="cp-entry__date">${esc(date)}</p>`
    : `<p class="cp-entry__date cp-entry__date--undated">${esc(t("compendium.undated", "Before the Compendium"))}</p>`;
  const pills = [];
  if (e.expert) pills.push(`<span class="cp-pill cp-pill--expert">⚡ Expert</span>`);
  if (e.rank) {
    pills.push(
      `<span class="cp-pill cp-pill--rank">${e.rank >= 10 ? "✦ MAX" : esc(t("compendium.rank", `Rank ${e.rank}`, { n: e.rank }))}</span>`
    );
  }
  if (e.mode && e.chapter === "challenges")
    pills.push(`<span class="cp-pill">${MODE_ICON[e.mode] ?? ""} ${esc(modeName(e.mode))}</span>`);
  let cls = e.chapter === "challenges" ? (e.won ? " cp-entry--won" : " cp-entry--lost") : "";
  if (e.kind === "title") cls += " cp-entry--banner";
  return `
    <li class="cp-entry${cls}" style="animation-delay:${idx * 45}ms">
      ${entryVisual(e)}
      <div class="cp-entry__body">
        <p class="cp-entry__title">${esc(entryTitle(e))} ${pills.join(" ")}</p>
        <p class="cp-entry__flavor">${esc(entryFlavor(e))}</p>
        ${dateHtml}
      </div>
    </li>`;
}

function renderLeft() {
  const c = state.chapter;
  const sum = state.summary[c] ?? {};
  const title = t(`compendium.chapter.${c}`, c);
  const desc = t(`compendium.chapter_desc.${c}`, "");
  let stats = "";
  if (c === "feats") {
    stats = [
      [sum.games, t("compendium.stat.games", "Games")],
      [sum.wins, t("compendium.stat.wins", "Wins")],
      [sum.days, t("compendium.stat.days", "Days played")],
      [sum.streak, t("compendium.stat.streak", "Best streak")],
    ];
  } else if (c === "bonds") {
    stats = [
      [sum.count, t("compendium.stat.friends", "Friends")],
      [sum.max, t("compendium.stat.confidants", "True Confidants")],
    ];
  } else if (c === "challenges") {
    stats = [
      [sum.count, t("compendium.stat.challenges", "Challenges")],
      [sum.won, t("compendium.stat.won", "Won")],
    ];
  } else {
    stats = [[sum.count, t(`compendium.chapter.${c}`, c)]];
  }
  const statsHtml = stats
    .map(
      ([v, l]) =>
        `<div class="cp-stat"><span class="cp-stat__value">${esc(v ?? 0)}</span><span class="cp-stat__label">${esc(l)}</span></div>`
    )
    .join("");
  document.getElementById("cpPageLeft").innerHTML = `
    <p class="cp-chapter__kicker">${esc(t("compendium.chapter_kicker", "Chapter"))} ${CHAPTERS.indexOf(c) + 1}</p>
    <h2 class="cp-chapter__title">${esc(title)}</h2>
    <div class="cp-chapter__icon" aria-hidden="true">${CHAPTER_META[c].icon}</div>
    <p class="cp-chapter__desc">${esc(desc)}</p>
    <div class="cp-stats">${statsHtml}</div>
    <div class="cp-chapter__rule" aria-hidden="true"></div>
    <div class="cp-chapter__watermark" aria-hidden="true">${CHAPTER_META[c].icon}</div>
    <p class="cp-folio cp-folio--left" aria-hidden="true">${ROMAN[CHAPTERS.indexOf(c)]}</p>`;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

function renderRight() {
  const entries = state.chapters[state.chapter] ?? [];
  const pages = paginate(entries, PAGE_SIZE);
  state.page = Math.min(state.page, pages.length - 1);
  const list = pages[state.page];
  const right = document.getElementById("cpPageRight");
  right.innerHTML =
    (list.length
      ? `<ul class="cp-entries">${list.map(renderEntry).join("")}</ul>`
      : `<p class="cp-empty">${esc(t(`compendium.empty.${state.chapter}`, t("compendium.empty.default", "Nothing here yet.")))}</p>`) +
    `<p class="cp-folio cp-folio--right" aria-hidden="true">${state.page + 1}</p>`;

  document.getElementById("cpPagerInfo").textContent = `${state.page + 1} / ${pages.length}`;
  document.getElementById("cpPrev").disabled = state.page === 0;
  document.getElementById("cpNext").disabled = state.page >= pages.length - 1;
}

function renderTabs() {
  const tabs = document.getElementById("cpTabs");
  tabs.innerHTML = CHAPTERS.map((c) => {
    const n = state.chapters[c]?.length ?? 0;
    return `<button type="button" role="tab" class="cp-tab${c === state.chapter ? " active" : ""}" data-chapter="${c}" aria-selected="${c === state.chapter}">
      <span class="cp-tab__icon" aria-hidden="true">${CHAPTER_META[c].icon}</span>
      <span>${esc(t(`compendium.chapter.${c}`, c))}</span>
      <span class="cp-tab__count">${n}</span>
    </button>`;
  }).join("");
  tabs.querySelectorAll(".cp-tab").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.chapter === state.chapter) return;
      state.chapter = b.dataset.chapter;
      state.page = 0;
      flip("next", () => {
        renderTabs();
        renderLeft();
        renderRight();
      });
    })
  );
}

/** Tourne la page de droite (3D sur desktop, glissement sur mobile) puis re-rend. */
function flip(direction, rerender) {
  const right = document.getElementById("cpPageRight");
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    rerender();
    return;
  }
  const out = direction === "next" ? "cp-page--flip-out" : "cp-page--flip-back-out";
  const inn = direction === "next" ? "cp-page--flip-in" : "cp-page--flip-back-in";
  right.classList.remove("cp-page--flip-in", "cp-page--flip-back-in");
  right.classList.add(out);
  const done = () => {
    right.removeEventListener("animationend", done);
    right.classList.remove(out);
    rerender();
    right.classList.add(inn);
    right.addEventListener("animationend", () => right.classList.remove(inn), { once: true });
  };
  right.addEventListener("animationend", done, { once: true });
  // Filet : si l'événement ne vient pas (onglet en arrière-plan), on ne bloque pas.
  setTimeout(() => {
    if (right.classList.contains(out)) done();
  }, 500);
}

function goPage(delta) {
  if (!state.chapters) return;
  const pages = paginate(state.chapters[state.chapter] ?? [], PAGE_SIZE);
  const next = state.page + delta;
  if (next < 0 || next >= pages.length) return;
  state.page = next;
  flip(delta > 0 ? "next" : "prev", renderRight);
}

/** Balayage horizontal (mobile) : page suivante / précédente. */
function setupSwipe() {
  const spread = document.querySelector(".cp-spread");
  if (!spread) return;
  let x0 = null;
  let y0 = null;
  spread.addEventListener(
    "touchstart",
    (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    { passive: true }
  );
  spread.addEventListener(
    "touchend",
    (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = y0 = null;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      goPage(dx < 0 ? 1 : -1);
    },
    { passive: true }
  );
}

function openBook() {
  const cover = document.getElementById("cpCover");
  const book = document.getElementById("cpBook");
  const reveal = () => {
    cover.classList.add("hidden");
    book.classList.remove("hidden");
    renderTabs();
    renderLeft();
    renderRight();
  };
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    reveal();
    return;
  }
  cover.classList.add("cp-cover--opening");
  cover.addEventListener("animationend", reveal, { once: true });
  setTimeout(() => {
    if (!cover.classList.contains("hidden")) reveal();
  }, 900);
}

/** Cible du carnet : ?view=CODE (ami, public) ou soi-même (connecté). */
function target() {
  const q = new URLSearchParams(window.location.search);
  const code = q.get("view");
  return code ? { code } : null;
}

async function load() {
  const api = window._personadleApi;
  const owner = document.getElementById("cpOwner");
  const stateEl = document.getElementById("cpCoverState");
  const openBtn = document.getElementById("cpOpenBtn");
  const tgt = target();

  if (!tgt && !window._currentUser) {
    owner.textContent = "";
    stateEl.textContent = t("compendium.login_required", "Log in to open your Compendium.");
    stateEl.classList.remove("hidden");
    openBtn.disabled = true;
    return;
  }
  if (!api?.user?.compendium) {
    stateEl.textContent = t("compendium.unavailable", "The Compendium is unavailable right now.");
    stateEl.classList.remove("hidden");
    openBtn.disabled = true;
    return;
  }
  try {
    const data = await api.user.compendium(tgt ?? {});
    state.data = data;
    state.chapters = buildChapters(data, { lang: state.lang });
    state.summary = chapterSummary(data, state.chapters);
    owner.textContent = data.user?.pseudo ?? "";
    document.title = `${data.user?.pseudo ?? ""} — Compendium — PersonaDLE`;
    // Lien retour : vers le profil visité si on lit celui d'un ami
    const back = document.getElementById("cpBackLink");
    if (tgt?.code && back) {
      back.href = `../profile.html?view=${encodeURIComponent(tgt.code)}`;
      back.querySelector("span").textContent = t("compendium.back_to_profile", "Back to profile");
    }
    openBtn.disabled = false;
  } catch (err) {
    stateEl.textContent =
      err?.status === 404
        ? t("compendium.not_found", "No Compendium for this player.")
        : t("compendium.unavailable", "The Compendium is unavailable right now.");
    stateEl.classList.remove("hidden");
    openBtn.disabled = true;
  }
}

/** Point d'entrée de la page (exporté pour les tests ; la page l'appelle au DOMContentLoaded). */
export async function initCompendium() {
  if (window.__i18nReady) await window.__i18nReady;
  if (window._authReady) await window._authReady.catch(() => {});
  state.lang = window.i18n?.getCurrentLang?.() ?? document.documentElement.lang ?? "en";

  document.getElementById("cpOpenBtn").addEventListener("click", () => {
    if (state.chapters) openBook();
  });
  const prev = document.getElementById("cpPrev");
  const next = document.getElementById("cpNext");
  prev.addEventListener("click", () => goPage(-1));
  next.addEventListener("click", () => goPage(1));
  // Libellés d'accessibilité (data-i18n ne couvre que text/title/placeholder)
  prev.setAttribute("aria-label", t("compendium.page_prev", "Previous page"));
  next.setAttribute("aria-label", t("compendium.page_next", "Next page"));
  document.getElementById("cpTabs").setAttribute("aria-label", t("compendium.chapters_label", "Chapters"));
  document.addEventListener("keydown", (e) => {
    if (document.getElementById("cpBook").classList.contains("hidden")) return;
    if (e.key === "ArrowRight") goPage(1);
    if (e.key === "ArrowLeft") goPage(-1);
  });
  setupSwipe();

  await load();
}

/** État courant, exposé en lecture pour les tests (chapitre, page, données). */
export const _state = state;

document.addEventListener("DOMContentLoaded", initCompendium);
