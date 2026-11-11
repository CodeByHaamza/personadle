/**
 * profile/profile_mobile.js — Le profil sur téléphone (≤ 480 px).
 *
 * Mesuré le 2026-10-20 en 390×844 : 3,3 écrans de haut. Les stats passent sur
 * deux colonnes (profile-page.css) et les sections secondaires deviennent
 * repliables ici : un tap sur leur titre les ouvre ou les ferme, et le choix
 * est retenu (localStorage). Au-delà de 480 px, rien ne change.
 *
 * Code événement, Partage et Wallpapers sont repliés par défaut : on y vient
 * pour une action précise. Les Badges restent ouverts — c'est la vitrine.
 */

const STORAGE_KEY = "profileCardsCollapsed";

/** Sections repliables, par clé i18n de leur titre → repliée par défaut ? */
export const COLLAPSIBLE_CARDS = {
  "profile.badges_title": false,
  "profile.event_code_title": true,
  "profile.share_title": true,
  "profile.wallpapers_title": true,
};

function _readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function _writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* navigation privée pleine : l'état ne sera simplement pas retenu */
  }
}

/** Cartes repliables présentes dans la page, avec leur clé. */
export function findCollapsibleCards(doc = document) {
  return [...doc.querySelectorAll(".profile-card")]
    .map((card) => {
      const key = card.querySelector(".card-title [data-i18n]")?.getAttribute("data-i18n");
      return key in COLLAPSIBLE_CARDS ? { card, key } : null;
    })
    .filter(Boolean);
}

function _setCollapsed(card, title, collapsed) {
  card.classList.toggle("is-collapsed", collapsed);
  title.setAttribute("aria-expanded", String(!collapsed));
}

function _onTitleActivate(e) {
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  const title = e.currentTarget;
  const card = title.closest(".profile-card");
  const key = title.querySelector("[data-i18n]")?.getAttribute("data-i18n");
  const collapsed = !card.classList.contains("is-collapsed");
  _setCollapsed(card, title, collapsed);
  const state = _readState();
  state[key] = collapsed;
  _writeState(state);
}

/** Active (mobile) ou retire (desktop) le repli des sections. */
export function applyCollapsible(enabled, doc = document) {
  const state = _readState();
  for (const { card, key } of findCollapsibleCards(doc)) {
    const title = card.querySelector(".card-title");
    if (enabled) {
      if (card.classList.contains("is-collapsible")) continue;
      card.classList.add("is-collapsible");
      title.setAttribute("role", "button");
      title.setAttribute("tabindex", "0");
      title.addEventListener("click", _onTitleActivate);
      title.addEventListener("keydown", _onTitleActivate);
      _setCollapsed(card, title, state[key] ?? COLLAPSIBLE_CARDS[key]);
    } else if (card.classList.contains("is-collapsible")) {
      card.classList.remove("is-collapsible", "is-collapsed");
      title.removeAttribute("role");
      title.removeAttribute("tabindex");
      title.removeAttribute("aria-expanded");
      title.removeEventListener("click", _onTitleActivate);
      title.removeEventListener("keydown", _onTitleActivate);
    }
  }
}

export function initProfileMobile() {
  const mq = window.matchMedia("(max-width: 480px)");
  applyCollapsible(mq.matches);
  mq.addEventListener?.("change", (e) => applyCollapsible(e.matches));
}
