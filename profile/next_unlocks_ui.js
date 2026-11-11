/**
 * profile/next_unlocks_ui.js — « Presque là » : les déblocages les plus proches.
 *
 * Lot 11 de la 2.4. Le profil montrait ce qu'on a, jamais ce qui est presque là :
 * un joueur à 8 / 10 victoires Silhouette d'un badge ne le savait pas, à moins
 * d'ouvrir la collection et de compter lui-même. La carte liste, depuis
 * GET /api/user/next-unlocks, les six badges / titres / Modes Expert les plus
 * avancés, avec une barre de progression.
 *
 * Le serveur calcule la progression (la même source que la décision de
 * déblocage) ; ce module ne fait que l'afficher. Les libellés sont construits ici,
 * en i18n : nom de badge (lang/*.json), nom de titre (déjà traduit par l'API),
 * condition Expert (expertConditionLabel(), comme l'infobulle du bouton Expert).
 *
 * Invité ou API muette : la carte reste cachée.
 */

import { expertConditionLabel, modeLabel, siteRootPrefix } from "../js/gameCore.js";

function _t(key, fallback, vars) {
  const r = window.i18n?.t?.(key, vars);
  return r != null && r !== key ? r : fallback;
}

function _esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/** Icône de l'entrée, depuis la racine du site (la page profil est dans /profile/). */
function _imageSrc(item, root) {
  if (item.kind === "expert") return null;
  let p = String(item.image || "");
  if (!p) return null;
  if (p.startsWith("/") || /^https?:/.test(p)) return p;
  // Titres : « titles/x.webp » (relatif à profile/) ou « profile/titles/x.webp ».
  if (item.kind === "title" && !p.startsWith("profile/")) p = `profile/${p}`;
  return `${root}${p}`;
}

/**
 * Nom et condition affichés pour une entrée. Pure : testée dans
 * tests/next_unlocks_ui.test.js.
 * @returns {{name: string, condition: string}}
 */
export function nextUnlockLabel(item) {
  if (item.kind === "expert") {
    const mode = _t(`modes.${item.slug}.name`, modeLabel(item.slug));
    return {
      name: _t("profile.next_unlocks_expert", `Expert mode — ${mode}`, { mode }),
      condition: expertConditionLabel(item),
    };
  }
  if (item.kind === "badge") {
    return {
      name: _t(`badges.${item.slug}.name`, item.name || item.slug),
      condition: _t(`badges.${item.slug}.condition`, item.description || ""),
    };
  }
  return { name: item.name || item.slug, condition: item.description || "" };
}

/** HTML de la liste. Pure (échappée) : testée dans tests/next_unlocks_ui.test.js. */
export function buildNextUnlocksHTML(items, root = siteRootPrefix()) {
  return items
    .map((item) => {
      const { name, condition } = nextUnlockLabel(item);
      const pct = Math.max(0, Math.min(100, Math.round((item.current / item.required) * 100)));
      const src = _imageSrc(item, root);
      const icon = src
        ? `<img class="next-unlock__img next-unlock__img--${_esc(item.kind)}" src="${_esc(src)}" alt="" loading="lazy" />`
        : `<span class="next-unlock__img next-unlock__img--expert" aria-hidden="true">⚡</span>`;
      const kindLabel = _t(`profile.next_unlocks_kind_${item.kind}`, item.kind);
      return `
        <li class="next-unlock next-unlock--${_esc(item.kind)}">
          ${icon}
          <div class="next-unlock__body">
            <div class="next-unlock__head">
              <span class="next-unlock__name">${_esc(name)}</span>
              <span class="next-unlock__kind">${_esc(kindLabel)}</span>
            </div>
            ${condition ? `<p class="next-unlock__cond">${_esc(condition)}</p>` : ""}
            <div class="next-unlock__bar" role="progressbar" aria-valuemin="0"
                 aria-valuemax="${item.required}" aria-valuenow="${item.current}"
                 aria-label="${_esc(name)}">
              <span style="width: ${pct}%"></span>
            </div>
          </div>
          <span class="next-unlock__count">${item.current} / ${item.required}</span>
        </li>`;
    })
    .join("");
}

/**
 * Remplit la carte #nextUnlocksCard. Ne lève jamais : sans compte ou sans réponse,
 * la carte reste cachée.
 */
export async function renderNextUnlocks({
  api = window._personadleApi,
  lang = window.i18n?.getCurrentLang?.() || "en",
  doc = document,
} = {}) {
  const card = doc.getElementById("nextUnlocksCard");
  const list = doc.getElementById("nextUnlocksList");
  if (!card || !list) return false;
  if (!window._currentUser || typeof api?.user?.nextUnlocks !== "function") {
    card.hidden = true;
    return false;
  }
  try {
    const { items = [] } = (await api.user.nextUnlocks(lang)) ?? {};
    if (!items.length) {
      card.hidden = true;
      return false;
    }
    list.innerHTML = buildNextUnlocksHTML(items);
    card.hidden = false;
    return true;
  } catch {
    card.hidden = true;
    return false;
  }
}
