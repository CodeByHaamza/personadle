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

import { expertConditionLabel, modeLabel } from "../js/gameCore.js";

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

/**
 * Pastille de l'entrée quand il n'y a pas d'image à montrer (titre, quête Expert,
 * miniature de badge manquante).
 */
const KIND_ICON = { badge: "🏅", title: "🎖️", expert: "⚡" };

/**
 * Miniature d'un badge (profile/badges/thumbs/, générées par
 * scripts/badge_thumbs.py) : la VRAIE image du badge, réduite. Les originaux pèsent
 * jusqu'à 7,7 Mo pièce (115 Mo au total) pour un affichage de 44 px — la carte en
 * montrait six, ~7 Mo à chaque visite du profil. Les miniatures : ~8 Ko pièce.
 *
 * « profile/badges/images/Badges_Burn_My_Dread_Silver.png »
 *   → « profile/badges/thumbs/badges_burn_my_dread_silver.webp »
 * Même règle que thumb_name() dans le script Python.
 */
export function badgeThumbPath(imagePath) {
  const file = String(imagePath || "")
    .split("/")
    .pop();
  if (!file) return null;
  const stem = file
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return stem ? `profile/badges/thumbs/${stem}.webp` : null;
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
export function buildNextUnlocksHTML(items, root = "../") {
  return items
    .map((item) => {
      const { name, condition } = nextUnlockLabel(item);
      const pct = Math.max(0, Math.min(100, Math.round((item.current / item.required) * 100)));
      const rarity = item.rarity ? ` next-unlock__img--${_esc(item.rarity)}` : "";
      const fallback = KIND_ICON[item.kind] ?? "◆";
      const thumb = item.kind === "badge" ? badgeThumbPath(item.image) : null;
      const icon = thumb
        ? `<img class="next-unlock__img next-unlock__img--badge next-unlock__img--pic${rarity}" src="${_esc(
            root + thumb
          )}" alt="" width="44" height="44" loading="lazy" decoding="async" data-fallback="${fallback}" />`
        : `<span class="next-unlock__img next-unlock__img--${_esc(item.kind)}${rarity}" aria-hidden="true">${fallback}</span>`;
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
    // Miniature absente (badge ajouté sans relancer scripts/badge_thumbs.py) :
    // la pastille 🏅 plutôt qu'une image cassée.
    list.querySelectorAll("img[data-fallback]").forEach((img) => {
      img.addEventListener(
        "error",
        () => {
          const span = doc.createElement("span");
          span.className = img.className.replace("next-unlock__img--pic", "").trim();
          span.setAttribute("aria-hidden", "true");
          span.textContent = img.dataset.fallback;
          img.replaceWith(span);
        },
        { once: true }
      );
    });
    card.hidden = false;
    return true;
  } catch {
    card.hidden = true;
    return false;
  }
}
